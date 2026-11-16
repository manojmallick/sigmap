'use strict';

/**
 * `sigmap advise` (src/advise/): offline facts for choosing how an agent gets SigMap. It reports facts and makes no call.
 *
 * Why no call: the agent study's Stage I (docs-vp/guide/agent-study-protocol.md) tested, with its bar written first, whether anything computable for
 * free on a repository predicts the saving. It did not pass, so this command must never print a forecast, and what it quotes from the study must be
 * what the committed data file says. Why these tests: the mining rule must be the one that built the study's questions, the grep scan must be the
 * benchmark's scan, the command must write nothing, and the study numbers it prints must not drift from the data they come from.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const { mineQuestions, resolveSince } = require(path.join(ROOT, 'src/advise/mine.js'));
const { buildAdvice, formatAdvice, wilson, STUDY } = require(path.join(ROOT, 'src/advise/advise.js'));
const { grepRank: srcGrepRank, sigmapOutputs: srcOutputs } = require(path.join(ROOT, 'src/advise/grep-scan.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
}

const ENV = { ...process.env, SIGMAP_NO_UPDATE_CHECK: '1', NO_COLOR: '1', GIT_TERMINAL_PROMPT: '0' };
const IDENT = { GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'dev@example.com' };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'advise-'));
const repo = path.join(tmp, 'project');
fs.mkdirSync(repo);

function gitAt(dir, args, env) {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...ENV, ...IDENT, ...(env || {}) } });
  assert.strictEqual(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}
function commitAt(dir, title, files, env) {
  for (const [f, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), body); }
  gitAt(dir, ['add', '-A']);
  gitAt(dir, ['commit', '-q', '-m', title], env);
}
const git = (args, env) => gitAt(repo, args, env);
const commit = (title, files, env) => commitAt(repo, title, files, env);
const js = (name, body) => `function ${name}(a, b) {\n  // ${body}\n  return a + b;\n}\nmodule.exports = { ${name} };\n`;

git(['init', '-q']);
commit('initial import of the project', { 'src/billing.js': js('formatCurrency', 'money'), 'src/invoice.js': js('renderInvoice', 'invoice'), 'src/shipping.js': js('estimateShipping', 'ship'), 'src/users.js': js('createUser', 'user'), 'src/audit.js': js('writeAuditLog', 'audit'), 'src/search.js': js('indexDocuments', 'search'), 'src/mailer.js': js('sendWelcomeMail', 'mail') });
commit('compute tax for invoices with several line items', { 'src/tax.js': js('computeTax', 'line items tax') });
commit('retry failed webhook deliveries with exponential backoff', { 'src/dispatcher.js': js('retryDelivery', 'webhook backoff') });
commit('refactor tests and docs for the billing module cleanup', { 'src/billing.js': js('formatCurrency', 'money again') });
commit('Bump lodash from 4.17.20 to 4.17.21 in the lockfile', { 'src/users.js': js('createUser', 'bump') });
commit('extract shared validation logic into one common place', { 'src/a1.js': js('va1', 'x'), 'src/a2.js': js('va2', 'x'), 'src/a3.js': js('va3', 'x'), 'src/a4.js': js('va4', 'x') });
commit('fix crash in billing.js when the currency is missing', { 'src/billing.js': js('formatCurrency', 'currency') });
commit('handle slow machines when waiting for webhook retries', { 'tests/webhook.test.js': "// slow machines\ntest('x', () => {});\n" });
// a bot's change that would otherwise qualify (the title names no file): only its author drops it
commit('keep the report from dropping its final line of output', { 'src/audit.js': js('writeAuditLog', 'final line') }, { GIT_AUTHOR_NAME: 'dependabot[bot]', GIT_AUTHOR_EMAIL: 'bot@users.noreply.github.com' });
// the title names the file by its whole name, and the stem is too short (4) for the stem rule: only the basename rule drops it
commit('make the cart.js totals add up when discounts apply', { 'src/cart.js': js('cartTotal', 'discounts') });
// the title names the file by its stem only (7 characters), not by its whole name: only the stem rule drops it
commit('resend failed webhook notifications with growing delays', { 'src/webhook.js': js('resendNotice', 'growing delays') });
// a title of 23 characters: describes behaviour in four words or more, and is still too short to be a question (25 to 160)
commit('stop the tax rate drift', { 'src/rates.js': js('currentRate', 'drift') });
// a merge-commit pull request: with the first-parent walk it is ONE question (its title is the first line of its body); without it the branch's own commit is a second
const trunk = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
git(['checkout', '-q', '-b', 'credits']);
commit('add partial credit calculation to the credit notes', { 'src/credits.js': js('partialCredit', 'credit calc') });
git(['checkout', '-q', trunk]);
git(['merge', '--no-ff', '-q', 'credits', '-m', 'Merge pull request #7 from dev/credits', '-m', 'support partial refunds when an order is amended later']);

// directories a grep never reads: left untracked on purpose (a vendored dependency, a gitignored build output), each holding a term the scans ask for
fs.mkdirSync(path.join(repo, 'node_modules', 'dep'), { recursive: true });
fs.writeFileSync(path.join(repo, 'node_modules', 'dep', 'index.js'), 'function retryDelivery() {}\n');
fs.writeFileSync(path.join(repo, 'blob.bin'), Buffer.from('retryDelivery\0\0binary')); // a binary file holding a searched term
fs.writeFileSync(path.join(repo, '.gitignore'), 'generated-out/\n');
fs.mkdirSync(path.join(repo, 'generated-out'));
fs.writeFileSync(path.join(repo, 'generated-out', 'gen.js'), 'function retryDelivery() {}\n');

console.log('sigmap advise');

test('the mining rule keeps the qualifying changes, oldest first, and names why it dropped each other one', () => {
  const m = mineQuestions(repo, { since: '365d' });
  assert.strictEqual(m.ok, true);
  assert.deepStrictEqual(m.questions.map((q) => q.title), ['compute tax for invoices with several line items', 'retry failed webhook deliveries with exponential backoff', 'support partial refunds when an order is amended later']);
  assert.deepStrictEqual(m.questions.map((q) => q.files), [['src/tax.js'], ['src/dispatcher.js'], ['src/credits.js']]);
  const why = Object.keys(m.skipped).join(' | ');
  for (const reason of ['no parent', 'vague', 'dependency bump', 'not 1 to 3 source files', 'names a changed file']) assert.ok(why.includes(reason), `no skip reason "${reason}" in: ${why}`);
  assert.ok(m.skipped['not 1 to 3 source files'] >= 2, 'both the four-file change and the tests-only change should be "not 1 to 3 source files"');
  assert.strictEqual(m.skipped['a bot, or no parent in the history'], 2, 'the initial commit (no parent) and the bot\'s change');
  assert.strictEqual(m.skipped['the title names a changed file'], 3, 'billing.js (both rules), cart.js (basename only), webhook (stem only)');
  assert.strictEqual(m.skipped['title length'], 1);
  assert.strictEqual(m.examined, 13, 'first-parent commits only: the merge counts once and the branch\'s own commit not at all');
});

test('--max keeps the oldest qualifying changes, the same ones a full pass would', () => {
  const one = mineQuestions(repo, { since: '365d', max: 1 });
  assert.deepStrictEqual(one.questions.map((q) => q.title), ['compute tax for invoices with several line items']);
});

test('--since reads a date, 90d, 6m and 1y, and refuses what it cannot read', () => {
  assert.strictEqual(resolveSince('2026-01-02'), '2026-01-02');
  const now = Date.UTC(2026, 10, 14);
  assert.strictEqual(resolveSince('90d', now), '2026-08-16');
  assert.strictEqual(resolveSince('1y', now), '2025-11-14');
  assert.strictEqual(resolveSince('6m', now), '2026-05-18');
  assert.strictEqual(resolveSince('soon'), null);
  const bad = mineQuestions(repo, { since: 'soon' });
  assert.strictEqual(bad.ok, false);
  assert.ok(/--since/.test(bad.reason), bad.reason);
});

test('a directory that is not a git work tree says so and mines nothing', () => {
  const plain = fs.mkdtempSync(path.join(tmp, 'plain-'));
  const m = mineQuestions(plain, {});
  assert.deepStrictEqual([m.ok, m.questions.length], [false, 0]);
  assert.ok(/not a git work tree/.test(m.reason), m.reason);
});

function snapshot(dir) {
  const out = {};
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      const st = fs.statSync(p);
      out[path.relative(dir, p)] = `${st.size}:${st.mtimeMs}`;
    }
  })(dir);
  return out;
}

test('without an index it says to run sigmap first, never generates one, and writes nothing', () => {
  const before = snapshot(repo);
  const a = buildAdvice(repo, {});
  assert.strictEqual(a.lead, null);
  assert.ok(a.notes.some((n) => /run `sigmap` first/.test(n)), a.notes.join('\n'));
  assert.ok(a.questions.ok && a.questions.used === 3);
  assert.deepStrictEqual(snapshot(repo), before, 'advise wrote or changed a file');
  assert.ok(!fs.existsSync(path.join(repo, '.context')), 'advise created .context/');
});

// from here on the project has an index, as it does for anyone who has run sigmap
const gen = spawnSync(process.execPath, [GEN], { cwd: repo, encoding: 'utf8', env: ENV });
assert.strictEqual(gen.status, 0, `sigmap failed in the fixture: ${gen.stdout}${gen.stderr}`);

test('with an index it scores SigMap and a single-shot grep on the same questions, with an interval, and says when there are too few', () => {
  const a = buildAdvice(repo, {});
  assert.strictEqual(a.lead.n, 3);
  assert.strictEqual(a.lead.enough, false);
  assert.ok(a.lead.sigmap.count >= 0 && a.lead.sigmap.count <= 3 && a.lead.grep.count >= 0 && a.lead.grep.count <= 3);
  assert.ok(a.lead.sigmap.lo <= a.lead.sigmap.share && a.lead.sigmap.share <= a.lead.sigmap.hi);
  assert.strictEqual(a.lead.headroomPoints, Math.round(100 * (a.lead.sigmap.count - a.lead.grep.count) / 3));
  assert.ok(a.notes.some((n) => /only 3 question/.test(n)), a.notes.join('\n'));
  assert.ok(a.lead.filesScanned > 0);
});

test('--no-grep leaves the grep side out, and says nothing about headroom', () => {
  const a = buildAdvice(repo, { noGrep: true });
  assert.strictEqual(a.lead.grep, null);
  assert.strictEqual(a.lead.headroomPoints, null);
  assert.ok(!/headroom \(SigMap minus grep\)/.test(formatAdvice(a)), 'a headroom row is printed without a grep side');
  assert.ok(!/single-shot grep's/.test(formatAdvice(a)));
});

test('it reads the tool profiles from the real profile module: counts and tokens', () => {
  const a = buildAdvice(repo, {});
  const t = a.standing.tools;
  assert.deepStrictEqual([t.locate.tools, t.core.tools, t.all.tools], [2, 7, 22]);
  assert.ok(t.locate.tokens < t.core.tokens && t.core.tokens < t.all.tokens);
  assert.strictEqual(a.standing.hook.standingTokens, 0);
});

test('it makes no call and prints no forecast: call and forecast are null, and the text says so', () => {
  const a = buildAdvice(repo, {});
  assert.strictEqual(a.call, null);
  assert.strictEqual(a.forecast, null);
  const text = formatAdvice(a);
  assert.ok(/makes no call/.test(text), text);
  for (const banned of [/will save/i, /expected (saving|saving)/i, /you (will|should) (save|use)/i, /recommend(ed)?:/i]) assert.ok(!banned.test(text), `the text contains ${banned}: ${text}`);
  assert.ok(/did not predict which repositories save/.test(text));
});

test('writing nothing holds with an index too: no file of the project changes', () => {
  const before = snapshot(repo);
  const r = spawnSync(process.execPath, [GEN, 'advise'], { cwd: repo, encoding: 'utf8', env: ENV });
  assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.deepStrictEqual(snapshot(repo), before, 'advise wrote or changed a file');
});

test('the CLI: text, --json, --no-grep, a bad --max, and a line in --help', () => {
  const run = (args) => spawnSync(process.execPath, [GEN, ...args], { cwd: repo, encoding: 'utf8', env: ENV });
  const t = run(['advise']);
  assert.strictEqual(t.status, 0);
  assert.ok(/sigmap advise/.test(t.stdout) && /What this does NOT do/.test(t.stdout), t.stdout);
  const j = run(['advise', '--json']);
  const o = JSON.parse(j.stdout);
  assert.deepStrictEqual([o.call, o.forecast], [null, null]);
  assert.ok(o.standing && o.questions && o.lead && o.study);
  assert.strictEqual(JSON.parse(run(['advise', '--json', '--no-grep']).stdout).lead.grep, null);
  assert.strictEqual(run(['advise', '--max', '0']).status, 2);
  assert.strictEqual(run(['advise', '--max', 'many']).status, 2);
  assert.ok(/\badvise\b/.test(run(['--help']).stdout), '--help does not list advise');
});

test('the grep scan is the benchmark scan: identical rankings on the fixture, with and without SigMap\'s own files', () => {
  const tasks = [{ id: 't1', query: 'compute tax for invoices with several line items' }, { id: 't2', query: 'retry failed webhook deliveries with exponential backoff' }, { id: 't3', query: 'format currency in billing' }, { id: 't4', query: 'module exports function return' }, { id: 't5', query: 'retryDelivery dispatcher' }, { id: 't6', query: 'ex retry' }];
  const mine = { skip: srcGrepRank(repo, tasks, { skipFile: srcOutputs(repo) }), none: srcGrepRank(repo, tasks) };
  const script = `import(${JSON.stringify(path.join(ROOT, 'scripts/lib/grep-baseline.mjs'))}).then((m) => {
    const tasks = ${JSON.stringify(tasks)};
    const f = ${JSON.stringify(repo)};
    const skip = m.grepRank(f, tasks, { skipFile: m.sigmapOutputs(f) }); const none = m.grepRank(f, tasks);
    console.log(JSON.stringify({ skip: [[...skip.ranked], skip.filesScanned], none: [[...none.ranked], none.filesScanned] }));
  });`;
  const r = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', env: ENV });
  assert.strictEqual(r.status, 0, r.stderr);
  const theirs = JSON.parse(r.stdout);
  assert.deepStrictEqual([[...mine.skip.ranked], mine.skip.filesScanned], theirs.skip, 'rankings differ when SigMap\'s files are left out');
  assert.deepStrictEqual([[...mine.none.ranked], mine.none.filesScanned], theirs.none, 'rankings differ over every file');
  assert.ok(mine.skip.filesScanned < mine.none.filesScanned, 'the fixture has SigMap files, so leaving them out must scan fewer');
  assert.strictEqual(mine.skip.ranked.get('t4').length, 10, 'a task matching more than ten files keeps ten');
  assert.ok(mine.skip.ranked.get('t6').length < 10, 'a term of two letters (ex) is not searched, so only the files holding retry rank');
  for (const r of mine.skip.ranked.get('t5')) assert.ok(!/^(node_modules|generated-out)\//.test(r) && r !== 'blob.bin', `the scan read ${r}`);
});

test('the Wilson interval: a whole range for no data, and it brackets the share', () => {
  assert.deepStrictEqual(wilson(0, 0), { lo: 0, hi: 1 });
  const w = wilson(5, 10);
  assert.ok(Math.abs(w.lo - 0.2366) < 0.002 && Math.abs(w.hi - 0.7634) < 0.002, `5 of 10 at 95%: ${JSON.stringify(w)}`);
  const all = wilson(12, 12);
  assert.ok(Math.abs(all.hi - 1) < 1e-9 && Math.abs(all.lo - 0.7575) < 0.002, `12 of 12 at 95%: ${JSON.stringify(all)}`);
});

test('what it quotes from the study is what the committed data file says', () => {
  const txt = fs.readFileSync(path.join(ROOT, 'benchmarks/agent-study/data/setup-signal-eval.txt'), 'utf8');
  const p = /rho (-?\d\.\d+)\s+95% interval \[(-?\d\.\d+), (-?\d\.\d+)\]/.exec(txt);
  assert.ok(p, 'no primary line in the data file');
  assert.deepStrictEqual([STUDY.primary.rho, STUDY.primary.lo, STUDY.primary.hi], [Number(p[1]), Number(p[2]), Number(p[3])]);
  assert.ok(/DOES NOT PASS/.test(txt), 'the data file no longer says the primary test failed; advise must then stop saying it makes no call');
  const rows = [...txt.matchAll(/^\| (cost|time|tokens) \| `(index|prefetch|locate)` \| (\d+) \| (\d+) \| (\d+) \| ([+-]\d+)% \[/gm)];
  assert.strictEqual(rows.length, 9, `expected 9 by-goal rows, found ${rows.length}`);
  for (const [, goal, setup, saves, none, costs, pooled] of rows) {
    assert.deepStrictEqual(STUDY.byGoal[goal][setup], { saves: Number(saves), none: Number(none), costs: Number(costs), pooled: Number(pooled) }, `${goal}/${setup}`);
  }
  assert.strictEqual(STUDY.repositories, 20);
});

test('the first five: a rank counts from 1, five is in and six is out, and 0 means absent', () => {
  const { rankOf, inTop, TOP } = require(path.join(ROOT, 'src/advise/advise.js'));
  assert.strictEqual(TOP, 5);
  assert.strictEqual(rankOf(['a', 'b', 'c'], ['c', 'z']), 3);
  assert.strictEqual(rankOf(['a', 'b'], ['b', 'a']), 1, 'the first of the expected files to appear');
  assert.strictEqual(rankOf(['a'], ['b']), 0);
  assert.strictEqual(rankOf([], ['a']), 0);
  assert.deepStrictEqual([0, 1, 4, 5, 6, 10].map(inTop), [false, true, true, true, false, false]);
});

test('headroom: SigMap minus grep in whole points, signed, and nothing when grep was not scored', () => {
  const { headroomPoints } = require(path.join(ROOT, 'src/advise/advise.js'));
  assert.strictEqual(headroomPoints(9, 1, 12), 67);
  assert.strictEqual(headroomPoints(1, 9, 12), -67);
  assert.strictEqual(headroomPoints(3, 3, 10), 0);
  assert.strictEqual(headroomPoints(5, null, 10), null);
  assert.strictEqual(headroomPoints(1, 0, 0), null);
});

test('the SigMap side counts a question when its file is among the first five rows query_context returns, and not at the sixth', () => {
  const handlers = require(path.join(ROOT, 'src/mcp/handlers.js'));
  const real = handlers.queryContext;
  const EXPECTED = ['src/tax.js', 'src/dispatcher.js', 'src/credits.js'];
  const AT = [5, 6, 1]; // the expected file's row for each of the three mined questions, oldest first
  let call = 0;
  handlers.queryContext = () => {
    const k = call++;
    const rows = Array.from({ length: 10 }, (_, i) => (i + 1 === AT[k] ? EXPECTED[k] : `other${i + 1}.js`));
    return `## Query\n\n| Rank | File | Score | Sigs | Penalty |\n|------|------|-------|------|---------|\n${rows.map((f, i) => `| ${i + 1} | ${f} | ${(10 - i).toFixed(2)} | 1 | 1.00 |`).join('\n')}\n`;
  };
  try {
    const a = buildAdvice(repo, { noGrep: true });
    assert.strictEqual(call, 3, 'one query_context call per question');
    assert.strictEqual(a.lead.sigmap.count, 2, 'rows 5 and 1 count, row 6 does not');
  } finally { handlers.queryContext = real; }
});

test('grep side on a fixture where every file ties: the file at grep rank 4 is in the first five, the one at rank 8 is not', () => {
  const rankRepo = path.join(tmp, 'ranks');
  fs.mkdirSync(rankRepo);
  gitAt(rankRepo, ['init', '-q']);
  const same = '// notify listeners whenever the queue drains completely, and retry listeners whenever the queue drains partially\nfunction onEvent(a) { return a; }\nmodule.exports = { onEvent };\n';
  commitAt(rankRepo, 'initial import of the event handlers', Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((i) => [`src/ev${i}.js`, same])));
  commitAt(rankRepo, 'notify listeners whenever the queue drains completely', { 'src/ev4.js': `${same}function extra4() { return 4; }\n` });
  commitAt(rankRepo, 'retry listeners whenever the queue drains partially', { 'src/ev8.js': `${same}function extra8() { return 8; }\n` });
  const g = spawnSync(process.execPath, [GEN], { cwd: rankRepo, encoding: 'utf8', env: ENV });
  assert.strictEqual(g.status, 0, `${g.stdout}${g.stderr}`);
  const a = buildAdvice(rankRepo, {});
  assert.strictEqual(a.lead.n, 2);
  assert.strictEqual(a.lead.grep.count, 1, 'ev4 is 4th of 8 tied files (in), ev8 is 8th (out); a cut at 3 gives 0, a cut at 10 gives 2');
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
