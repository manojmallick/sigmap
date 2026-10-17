'use strict';

/**
 * `sigmap ask` leads with the answer (#966, from #879).
 *
 * `ask` used to print a 12-line box and nothing else on stdout; the ranked files
 * lived only in `.context/query-context.md`. Now the default is the ranked files,
 * one summary line, and a second line only when something is actionable. What is
 * pinned here:
 *
 *   - the files come first, and the rows ARE the `--json` `rankedFiles`;
 *   - the summary line carries what makes a result auditable (#775): count, cutoff,
 *     tokens, hash — and each of them equals the `--json` figure;
 *   - at most two lines that are not files, however many options are in play;
 *   - `risk:` appears only when a SELECTED file is itself changed vs HEAD (not for
 *     any dirty tree), and is computed against the project, not the repo root;
 *   - `--verbose` is the old box, line for line, behind the same rows;
 *   - `--json` keeps every key it had, and `--verbose` does not touch it;
 *   - the warnings stay on stderr, before the list.
 *
 * Run: node test/integration/ask-files-first.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const out = require(path.join(ROOT, 'src', 'format', 'ask-output.js'));

let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const run = (dir, args) => {
  const r = spawnSync(process.execPath, [GEN, ...args], { cwd: dir, encoding: 'utf8', timeout: 60000 });
  return { out: r.stdout || '', err: r.stderr || '', status: r.status, lines: (r.stdout || '').split('\n').filter((l) => l.length > 0) };
};
const json = (dir, args) => JSON.parse(run(dir, [...args, '--json']).out.trim().split('\n').pop());
const git = (dir, args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });

const Q = 'how does the middleware chain dispatch a request';
const ROW = /^\s*(\d+)\s+(\S+)\s+(-|\d+\.\d{3})(?:\s+([\d,]+) tok)?$/;
const SUMMARY = /^(\d+) of (\d+) files(?: · cutoff (\d+\.\d{3}))? · ([\d,]+) tokens · (sha256:[0-9a-f]{12}) → (\S+)$/;
const isRow = (l) => ROW.test(l);
const rowsOf = (lines) => lines.filter(isRow);
const extraOf = (lines) => lines.filter((l) => !isRow(l));

const SOURCES = {
  'router.js':
    '/** Dispatch a request through the middleware chain. */\n'
    + 'function dispatchMiddleware(request, chain) {\n  let index = 0;\n  const next = () => {\n'
    + '    const handler = chain[index++];\n    return handler ? handler(request, next) : request;\n  };\n  return next();\n}\n\n'
    + 'function registerRoute(table, method, routePath, handler) {\n  table[`${method} ${routePath}`] = handler;\n  return table;\n}\n\n'
    + 'module.exports = { dispatchMiddleware, registerRoute };\n',
  'server.js':
    "const { dispatchMiddleware } = require('./router');\n"
    + 'function handleRequest(request, chain) {\n  return dispatchMiddleware(request, chain);\n}\nmodule.exports = { handleRequest };\n',
  'billing.js':
    'function chargeInvoice(invoice, card) {\n  return { ok: true, invoice, card };\n}\nmodule.exports = { chargeInvoice };\n',
};

/** A small project with an index. `git: true` commits it clean. */
function makeRepo({ git: underGit = true, files = SOURCES } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-ask-files-'));
  const dir = base;
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'src', name), body);
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'], outputs: ['copilot'], maxTokens: 6000 }));
  fs.writeFileSync(path.join(base, '.gitignore'), '.context/\n');
  run(dir, []); // build the index
  if (underGit) {
    git(base, ['init', '-q', '.']);
    git(base, ['config', 'user.email', 't@t']);
    git(base, ['config', 'user.name', 'T']);
    git(base, ['add', '-A']);
    git(base, ['commit', '-qm', 'base']);
  }
  return { base, dir };
}
const cleanup = (r) => fs.rmSync(r.base, { recursive: true, force: true });
const touch = (dir, rel) => fs.appendFileSync(path.join(dir, rel), '\n// edited\n');

console.log('\nask: ranked files first, one summary line, a second only when it matters\n');

// ---------------------------------------------------------------------------
// The shape of the default output
// ---------------------------------------------------------------------------

test('the first line is a ranked file; the last is the summary; nothing else on a clean tree', () => {
  const r = makeRepo();
  try {
    const a = run(r.dir, ['ask', Q]);
    assert.strictEqual(a.status, 0, a.err);
    assert.ok(isRow(a.lines[0]), `first line must be a file row: ${a.lines[0]}`);
    assert.ok(SUMMARY.test(a.lines[a.lines.length - 1]), `last line must be the summary: ${a.lines[a.lines.length - 1]}`);
    assert.deepStrictEqual(extraOf(a.lines), [a.lines[a.lines.length - 1]], `only the summary is not a file: ${a.out}`);
    assert.ok(!/Intent|Coverage|Cost|─{5}/.test(a.out), `the box must not leak into the default: ${a.out}`);
  } finally { cleanup(r); }
});

test('the rows are exactly --json rankedFiles: same files, same order, same scores, same tokens', () => {
  const r = makeRepo();
  try {
    const rows = rowsOf(run(r.dir, ['ask', Q]).lines).map((l) => ROW.exec(l));
    const j = json(r.dir, ['ask', Q]);
    assert.strictEqual(rows.length, j.rankedFiles.length);
    rows.forEach((m, i) => {
      const want = j.rankedFiles[i];
      assert.strictEqual(Number(m[1]), want.rank);
      assert.strictEqual(m[2], want.file);
      assert.strictEqual(m[3], want.score.toFixed(3));
      assert.strictEqual(m[4] === undefined ? null : Number(m[4].replace(/,/g, '')), want.tokens);
    });
  } finally { cleanup(r); }
});

test('the summary line carries count, cutoff, tokens and hash — each equal to the --json figure', () => {
  const r = makeRepo();
  try {
    const a = run(r.dir, ['ask', Q]);
    const m = SUMMARY.exec(a.lines[a.lines.length - 1]);
    assert.ok(m, a.out);
    const j = json(r.dir, ['ask', Q]);
    assert.strictEqual(Number(m[1]), j.selectedFiles);
    assert.strictEqual(m[3], j.cutoffScore.toFixed(3), 'the cutoff is the last row\'s score');
    assert.strictEqual(Number(m[4].replace(/,/g, '')), j.contextTokens);
    assert.strictEqual(m[5], j.contextHash, 'the hash is the determinism proof; it must be the same one');
    assert.strictEqual(m[6], j.contextPath);
    assert.strictEqual(Number(m[1]), rowsOf(a.lines).length, 'the count is the number of rows');
  } finally { cleanup(r); }
});

test('the same query hashes identically across runs, and --verbose does not change the written context', () => {
  const r = makeRepo();
  try {
    const hash = (args) => (SUMMARY.exec(run(r.dir, args).lines.slice(-1)[0]) || [])[5];
    const a = hash(['ask', Q]);
    assert.ok(a, 'no hash');
    assert.strictEqual(hash(['ask', Q]), a);
    const v = run(r.dir, ['ask', Q, '--verbose']);
    assert.ok(v.out.includes(`Hash      : ${a}`), `--verbose must report the same hash: ${v.out}`);
  } finally { cleanup(r); }
});

test('the files plus one line cost less than the box they replaced', () => {
  const files = {};
  for (let i = 1; i <= 6; i++) {
    files[`pay${i}.js`] = `function chargeInvoice${i}(invoice, card) {\n  return { ok: ${i}, invoice, card };\n}\nmodule.exports = { chargeInvoice${i} };\n`;
  }
  const r = makeRepo({ files });
  try {
    const q = 'charge invoice card payment';
    const plain = run(r.dir, ['ask', q]);
    assert.strictEqual(rowsOf(plain.lines).length, 5, `needs a full 5-file selection: ${plain.out}`);
    const box = run(r.dir, ['ask', q, '--verbose']).out.split('\n').filter((l) => !isRow(l)).join('\n');
    assert.ok(plain.out.length < box.length,
      `default ${plain.out.length} chars vs box ${box.length} — the answer AND its audit line must cost less than the metadata that used to stand alone`);
    assert.ok(extraOf(plain.lines).length === 1);
  } finally { cleanup(r); }
});

test('an empty selection says so, exits 0, and still carries the summary', () => {
  const r = makeRepo();
  try {
    const a = run(r.dir, ['ask', 'zzqqxx flibbertigibbet']);
    assert.strictEqual(a.status, 0, a.err);
    assert.strictEqual(rowsOf(a.lines).length, 0);
    assert.ok(/^0 of \d+ files · [\d,]+ tokens · sha256:[0-9a-f]{12} → /.test(a.lines[0]), a.out);
    assert.ok(/no file matched/.test(a.lines[1]) && /--explain/.test(a.lines[1]), `the miss must be actionable: ${a.out}`);
    assert.ok(a.lines.length <= 2);
  } finally { cleanup(r); }
});

// ---------------------------------------------------------------------------
// risk: only when the answer stands on code that is mid-edit
// ---------------------------------------------------------------------------

test('a dirty tree whose changes are NOT in the selection prints no risk line', () => {
  const r = makeRepo();
  try {
    touch(r.dir, path.join('src', 'billing.js'));
    const a = run(r.dir, ['ask', Q]);
    assert.ok(!/risk/i.test(a.out), `an unrelated edit is not the reader's problem: ${a.out}`);
    assert.deepStrictEqual(extraOf(a.lines).length, 1);
    // ...but the whole-tree figure is still one flag away, unchanged.
    assert.ok(/ Risk      : LOW \(1 file\(s\) changed vs HEAD\)/.test(run(r.dir, ['ask', Q, '--verbose']).out));
  } finally { cleanup(r); }
});

test('a changed file IN the selection prints risk, with the count and the basis', () => {
  const r = makeRepo();
  try {
    touch(r.dir, path.join('src', 'server.js'));
    const a = run(r.dir, ['ask', Q]);
    const n = rowsOf(a.lines).length;
    assert.ok(new RegExp(`^risk: LOW \\(1 of ${n} selected file\\(s\\) changed vs HEAD\\)$`).test(a.lines[a.lines.length - 1]), a.out);
    assert.strictEqual(extraOf(a.lines).length, 2, 'summary + risk, nothing more');
  } finally { cleanup(r); }
});

test('a STAGED change in the selection counts too (it differs from HEAD)', () => {
  const r = makeRepo();
  try {
    touch(r.dir, path.join('src', 'router.js'));
    git(r.base, ['add', 'src/router.js']);
    assert.ok(/risk: LOW \(1 of \d+ selected/.test(run(r.dir, ['ask', Q]).out));
  } finally { cleanup(r); }
});

test('run from a subdirectory: SigMap re-roots at the git root and the risk line still meets the selection', () => {
  const r = makeRepo();
  try {
    // git reports paths from the repo root and ask ranks paths from the project root;
    // they are the same root, whichever directory the command was typed in.
    touch(r.dir, path.join('src', 'server.js'));
    const a = run(path.join(r.dir, 'src'), ['ask', Q]);
    assert.ok(/using project root/.test(a.err), `the premise of this test is a re-root: ${a.err}`);
    assert.ok(/risk: LOW \(1 of \d+ selected file\(s\) changed vs HEAD\)/.test(a.out), `a nested invocation lost its risk: ${a.out}`);
  } finally { cleanup(r); }
});

test('--cwd <dir> is taken as given (no re-root): ranked paths are relative to it, and risk still meets them', () => {
  // The other way to run below the git root. Here git prints `packages/foo/src/server.js` while
  // the ranker prints `src/server.js`; without `--relative` they never meet.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-ask-cwd-'));
  try {
    const rel = path.join('packages', 'foo');
    const pkg = path.join(base, rel);
    fs.mkdirSync(path.join(pkg, 'src'), { recursive: true });
    fs.mkdirSync(path.join(base, 'packages', 'bar'), { recursive: true });
    for (const [name, body] of Object.entries(SOURCES)) fs.writeFileSync(path.join(pkg, 'src', name), body);
    fs.writeFileSync(path.join(base, 'packages', 'bar', 'other.js'), 'function other() {\n  return 1;\n}\nmodule.exports = { other };\n');
    fs.writeFileSync(path.join(base, '.gitignore'), '.context/\n');
    assert.strictEqual(run(base, ['--cwd', rel]).status, 0, 'building the package index');
    git(base, ['init', '-q', '.']);
    git(base, ['config', 'user.email', 't@t']);
    git(base, ['config', 'user.name', 'T']);
    git(base, ['add', '-A']);
    git(base, ['commit', '-qm', 'base']);

    // A change in the selection, below --cwd: reported.
    touch(pkg, path.join('src', 'server.js'));
    const a = run(base, ['ask', Q, '--cwd', rel]);
    assert.ok(rowsOf(a.lines).length > 0 && rowsOf(a.lines).every((l) => /\ssrc\//.test(l)), `paths are relative to --cwd: ${a.out}`);
    assert.ok(/risk: LOW \(1 of \d+ selected file\(s\) changed vs HEAD\)/.test(a.out), `--cwd lost its risk line: ${a.out}`);

    // A change elsewhere in the monorepo is not in the selection: not reported.
    git(base, ['checkout', '--', 'packages/foo/src/server.js']);
    touch(base, path.join('packages', 'bar', 'other.js'));
    assert.ok(!/risk/i.test(run(base, ['ask', Q, '--cwd', rel]).out), 'a sibling package\'s edit is not this answer\'s problem');
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('an UNTRACKED selected file is not counted: like the box, risk is "changed vs HEAD" (tracked files)', () => {
  const r = makeRepo();
  try {
    fs.writeFileSync(path.join(r.dir, 'src', 'dispatch.js'),
      'function dispatchMiddlewareNow(request, chain) {\n  return chain;\n}\nmodule.exports = { dispatchMiddlewareNow };\n');
    run(r.dir, []); // index the new file
    const a = run(r.dir, ['ask', 'dispatch middleware now']);
    assert.ok(rowsOf(a.lines).some((l) => l.includes('dispatch.js')), `the new file must be selected: ${a.out}`);
    assert.ok(!/risk/i.test(a.out), `git diff HEAD does not see an untracked file, and the docs say "tracked": ${a.out}`);
    // The box counts the same way, so the two cannot disagree. (Re-indexing rewrote a tracked
    // output file, so the honest count here is git's own, not zero.)
    const tracked = git(r.dir, ['diff', '--name-only', 'HEAD']).split('\n').filter(Boolean);
    assert.ok(!tracked.includes('src/dispatch.js'), `the premise: the new file is untracked: ${tracked}`);
    const box = / Risk      : \w+ \((\d+) file\(s\) changed vs HEAD\)/.exec(run(r.dir, ['ask', 'dispatch middleware now', '--verbose']).out);
    assert.ok(box, 'the box must report a count');
    assert.strictEqual(Number(box[1]), tracked.length, 'the box counts tracked changes only, as git diff HEAD does');
  } finally { cleanup(r); }
});

test('a selected file with a non-ASCII name still gets its risk line (git quotes such paths)', () => {
  // `git diff --name-only` prints "src/caf\303\251.js", quotes included, unless told otherwise.
  const files = {
    'café.js': 'function renderCafeMenu(menu) {\n  return menu;\n}\nmodule.exports = { renderCafeMenu };\n',
    'other.js': 'function other() {\n  return 1;\n}\nmodule.exports = { other };\n',
  };
  const r = makeRepo({ files });
  try {
    touch(r.dir, path.join('src', 'café.js'));
    const a = run(r.dir, ['ask', 'render cafe menu']);
    assert.ok(rowsOf(a.lines).some((l) => l.includes('café.js')), `the fixture must select the file: ${a.out}`);
    assert.ok(/risk: LOW \(1 of \d+ selected file\(s\) changed vs HEAD\)/.test(a.out), `a non-ASCII path lost its risk line: ${a.out}`);
  } finally { cleanup(r); }
});

test('no git repo: no risk line, no crash — and --verbose still says "not assessed"', () => {
  const r = makeRepo({ git: false });
  try {
    const a = run(r.dir, ['ask', Q]);
    assert.strictEqual(a.status, 0, a.err);
    assert.ok(!/risk/i.test(a.out), a.out);
    assert.ok(/ Risk      : not assessed/.test(run(r.dir, ['ask', Q, '--verbose']).out));
  } finally { cleanup(r); }
});

test('one Risk scale: the box, --json and the default line grade a count the same way', () => {
  for (const [n, level] of [[0, 'NONE'], [1, 'LOW'], [3, 'LOW'], [4, 'MEDIUM'], [10, 'MEDIUM'], [11, 'HIGH'], [40, 'HIGH']]) {
    assert.strictEqual(out.riskLevel(n), level, `${n} changed files`);
  }
  const r = makeRepo();
  try {
    for (const f of ['router.js', 'server.js', 'billing.js']) touch(r.dir, path.join('src', f));
    fs.writeFileSync(path.join(r.dir, 'src', 'extra.js'), 'function extra() {}\n');
    git(r.base, ['add', '-N', 'src/extra.js']);
    const j = json(r.dir, ['ask', Q]);
    assert.strictEqual(j.riskChangedFiles, 4);
    assert.strictEqual(j.riskLevel, out.riskLevel(4));
    assert.ok(new RegExp(` Risk      : ${j.riskLevel} \\(4 file\\(s\\) changed vs HEAD\\)`).test(run(r.dir, ['ask', Q, '--verbose']).out));
  } finally { cleanup(r); }
});

// ---------------------------------------------------------------------------
// --verbose is the old box; --json is untouched
// ---------------------------------------------------------------------------

test('--verbose prints the same rows, then the box in its original order', () => {
  const r = makeRepo();
  try {
    const plain = run(r.dir, ['ask', Q]);
    const v = run(r.dir, ['ask', Q, '--verbose']);
    assert.deepStrictEqual(rowsOf(v.lines), rowsOf(plain.lines), 'the same files lead in both modes');
    const box = v.lines.slice(rowsOf(v.lines).length);
    const labels = ['─', ' sigmap ask  "', ' Intent    :', ' Context   :', ' Selected  :', ' Hash      :', ' Selection :',
      ' Coverage  :', ' Risk      :', ' Cost      :', '           est. @', '─'];
    assert.strictEqual(box.length, labels.length, `unexpected box shape:\n${box.join('\n')}`);
    labels.forEach((p, i) => assert.ok(box[i].startsWith(p), `box line ${i} should start with "${p}": ${box[i]}`));
    assert.ok(/ Selected  : \d+ of \d+ file\(s\) \(--top 5\) · cutoff score \d/.test(box[4]), box[4]);
  } finally { cleanup(r); }
});

test('--json keeps every key it had, and --verbose does not touch it', () => {
  const r = makeRepo();
  try {
    const before = [
      'intent', 'coverage', 'contextTokens', 'coveragePopulation', 'coverageIncluded', 'coverageTotal', 'coverageBasis',
      'costBefore', 'costAfter', 'savingsPct', 'pricedModel', 'priceAsOf', 'tokenBasis', 'costBasis', 'riskLevel',
      'riskAssessed', 'riskChangedFiles', 'riskBasis', 'sourceFiles', 'supportFiles', 'sourceFree', 'stale',
      'staleWarning', 'withSource', 'source', 'contextPath', 'rankedFiles', 'topK', 'selectedFiles', 'cutoffScore',
      'notes', 'contextHash',
    ];
    const j = json(r.dir, ['ask', Q]);
    for (const k of before) assert.ok(k in j, `--json lost "${k}"`);
    const a = run(r.dir, ['ask', Q, '--json']).out;
    const b = run(r.dir, ['ask', Q, '--json', '--verbose']).out;
    assert.strictEqual(b, a, '--verbose must not change the JSON by a byte');
  } finally { cleanup(r); }
});

// ---------------------------------------------------------------------------
// Everything that used to be on the box and still matters is not lost
// ---------------------------------------------------------------------------

test('the warnings stay on stderr and never leak into the answer', () => {
  // (Their order relative to the list cannot be observed across two pipes; the code writes
  // them first. What matters to a reader piping the answer is the stream.)
  const r = makeRepo();
  try {
    const future = new Date(Date.now() + 5 * 3600 * 1000);
    fs.utimesSync(path.join(r.dir, 'src', 'router.js'), future, future);
    const a = run(r.dir, ['ask', Q]);
    assert.ok(/stale ground/.test(a.err), `the stale warning must stay on stderr: ${a.err}`);
    assert.ok(!/stale ground/.test(a.out), 'and never leak into the answer');
    const none = run(r.dir, ['ask', 'zzqqxx flibbertigibbet']);
    assert.ok(!/⚠|\[sigmap\]/.test(none.out), `nothing but the answer on stdout: ${none.out}`);
  } finally { cleanup(r); }
});

test('the "of M" in the summary is the indexed file count the box reports, and N never exceeds it', () => {
  const r = makeRepo();
  try {
    const m = SUMMARY.exec(run(r.dir, ['ask', Q]).lines.slice(-1)[0]);
    const box = / Selected  : \d+ of (\d+) file\(s\)/.exec(run(r.dir, ['ask', Q, '--verbose']).out);
    assert.ok(m && box, 'both modes must report the indexed count');
    assert.strictEqual(m[2], box[1], 'one number, two spellings');
    assert.ok(Number(m[1]) < Number(m[2]), `the fixture must select fewer files than it indexes, or this proves nothing: ${m[0]}`);
  } finally { cleanup(r); }
});

test('--with-source adds a source line to the heads-up (and a truncation is disclosed)', () => {
  const r = makeRepo();
  try {
    const a = run(r.dir, ['ask', Q, '--with-source']);
    assert.ok(/^source: \d+ of \d+ top symbol\(s\), [\d,]+ of [\d,]+ budget token\(s\)$/m.test(a.out), a.out);
    assert.ok(extraOf(a.lines).length <= 2, a.out);
    const t = run(r.dir, ['ask', Q, '--with-source', '--source-budget', '40']);
    assert.ok(/omitted \(over budget\)/.test(t.out), `a truncated read must say so: ${t.out}`);
    assert.ok(extraOf(t.lines).length <= 2, t.out);
  } finally { cleanup(r); }
});

test('--with-source that fits nothing is reported on the heads-up line, not dropped', () => {
  const r = makeRepo();
  try {
    const a = run(r.dir, ['ask', Q, '--with-source', '--source-budget', '1']);
    assert.ok(/^source: none included — no anchored symbol fit the 1-token budget/m.test(a.out), a.out);
    assert.ok(extraOf(a.lines).length <= 2, a.out);
    // ...and without the flag the line is simply absent.
    assert.ok(!/source:/.test(run(r.dir, ['ask', Q]).out));
  } finally { cleanup(r); }
});

test('--since that leaves nothing says so, instead of claiming nothing matched', () => {
  const r = makeRepo();
  try {
    const a = run(r.dir, ['ask', Q, '--since', 'HEAD']);
    assert.strictEqual(rowsOf(a.lines).length, 0, a.out);
    assert.ok(/none of the \d+ ranked files changed since HEAD/.test(a.out), `the filter emptied it: ${a.out}`);
    assert.ok(!/no file matched/.test(a.out), `the query DID match; saying otherwise sends the reader to reword it: ${a.out}`);
    // A genuine miss still reads as one with the filter on.
    assert.ok(/no file matched/.test(run(r.dir, ['ask', 'zzqqxx flibbertigibbet', '--since', 'HEAD']).out));
    // A changed file in the ranking comes back as a row, with no hint at all.
    touch(r.dir, path.join('src', 'server.js'));
    const hit = run(r.dir, ['ask', Q, '--since', 'HEAD']);
    assert.ok(rowsOf(hit.lines).some((l) => l.includes('server.js')), hit.out);
    assert.ok(!/none of the|no file matched/.test(hit.out), hit.out);
  } finally { cleanup(r); }
});

test('never more than two lines that are not files, whatever is in play', () => {
  const r = makeRepo();
  try {
    run(r.dir, ['note', 'dispatching the middleware chain lives in src/router.js']);
    touch(r.dir, path.join('src', 'server.js'));
    const a = run(r.dir, ['ask', Q, '--with-source', '--source-budget', '40']);
    assert.ok(/notes: 1 matching/.test(a.out), `the note must surface: ${a.out}`);
    assert.ok(/source:/.test(a.out) && /risk: /.test(a.out), `source and risk must both surface: ${a.out}`);
    assert.strictEqual(extraOf(a.lines).length, 2, `summary + one heads-up line, however much is in it:\n${a.out}`);
  } finally { cleanup(r); }
});

test('a usage error names --verbose', () => {
  const r = makeRepo();
  try {
    const a = run(r.dir, ['ask']);
    assert.strictEqual(a.status, 1);
    assert.ok(/--verbose/.test(a.err), a.err);
  } finally { cleanup(r); }
});

// ---------------------------------------------------------------------------
// The formatter on its own
// ---------------------------------------------------------------------------

test('formatRankedList aligns columns, pads rank at 10+, and tolerates a missing token count', () => {
  const rows = out.formatRankedList([
    { file: 'src/a.js', score: 12.3456, tokens: 1200 },
    { file: 'src/long/path/b.js', score: 3, tokens: 7 },
    { file: 'c.js', score: 0.5 },
  ]);
  assert.deepStrictEqual(rows.map((l) => l.length > 0), [true, true, true]);
  assert.ok(/^1 {2}src\/a\.js {10,}12\.346 {2}1,200 tok$/.test(rows[0]), rows[0]);
  assert.ok(/ {2}3\.000 {2}\s*7 tok$/.test(rows[1]), rows[1]);
  assert.ok(/ {2}0\.500$/.test(rows[2]) && !/tok/.test(rows[2]), rows[2]);
  const ten = out.formatRankedList(Array.from({ length: 10 }, (_, i) => ({ file: `f${i}.js`, score: i, tokens: i })));
  assert.ok(/^ 1 {2}f0\.js/.test(ten[0]) && /^10 {2}f9\.js/.test(ten[9]), `${ten[0]} / ${ten[9]}`);
  assert.deepStrictEqual(out.formatRankedList([]), []);
  assert.deepStrictEqual(out.formatRankedList(null), []);
  // A score that is not a number prints as "-" (as --json prints null), never "NaN".
  assert.ok(/ {2}- {2}5 tok$/.test(out.formatRankedList([{ file: 'x.js', score: NaN, tokens: 5 }])[0]));
  assert.ok(!/cutoff/.test(out.formatSummary({ selected: 1, indexed: 2, cutoff: NaN, tokens: 3, hash: 'h', contextPath: 'p' })));
});

test('formatSummary drops the cutoff when there is none; formatHeadsUp is null when empty and ordered when not', () => {
  const base = { selected: 0, indexed: 9, cutoff: null, tokens: 15, hash: 'sha256:abc', contextPath: '.context/q.md' };
  assert.strictEqual(out.formatSummary(base), '0 of 9 files · 15 tokens · sha256:abc → .context/q.md');
  assert.strictEqual(out.formatSummary({ ...base, selected: 2, cutoff: 1.5 }), '2 of 9 files · cutoff 1.500 · 15 tokens · sha256:abc → .context/q.md');
  assert.strictEqual(out.formatHeadsUp({}), null);
  assert.strictEqual(out.formatHeadsUp({ notes: [], source: null, risk: null }), null);
  assert.strictEqual(
    out.formatHeadsUp({ empty: out.NO_MATCH_HINT, notes: ['a', 'b'], source: 'source: x', risk: out.selectionRisk(5, 2) }),
    'no file matched — try other wording, or --explain to see which tokens matched · notes: 2 matching (a / b) · source: x · risk: LOW (2 of 5 selected file(s) changed vs HEAD)');
  assert.strictEqual(out.formatHeadsUp({ empty: 'none of the 3 ranked files changed since main' }), 'none of the 3 ranked files changed since main');
  assert.strictEqual(out.formatHeadsUp({ empty: null }), null);
  assert.strictEqual(out.selectionRisk(5, 0), null);
});

test('formatRankedList survives a very large --top (spreading the rows overflowed the call stack)', () => {
  const many = Array.from({ length: 200000 }, (_, i) => ({ file: `f${i}.js`, score: i % 7, tokens: i }));
  const rows = out.formatRankedList(many);
  assert.strictEqual(rows.length, 200000);
  assert.ok(/^ {5}1 {2}f0\.js/.test(rows[0]) && /^200000 {2}f199999\.js/.test(rows[199999]), `${rows[0]} / ${rows[199999]}`);
});

test('formatSourceStatus reports a request that put nothing in, and stays silent when not asked', () => {
  assert.strictEqual(out.formatSourceStatus(null, false), null);
  assert.ok(/^source: none included — no anchored symbol fit the 0-token budget/.test(out.formatSourceStatus(null, true)));
  const sec = { included: 0, candidates: 3, spentTokens: 0, budgetTokens: 1200, truncated: true, skipped: 3 };
  assert.ok(/none included — no anchored symbol fit the 1,200-token budget/.test(out.formatSourceStatus(sec, true)));
  assert.strictEqual(
    out.formatSourceStatus({ included: 2, candidates: 4, spentTokens: 90, budgetTokens: 1200, truncated: true, skipped: 2 }, true),
    'source: 2 of 4 top symbol(s), 90 of 1,200 budget token(s); 2 omitted (over budget)');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
