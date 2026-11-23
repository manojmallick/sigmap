'use strict';

/**
 * Published statements that an outsider could falsify in one step stay out (#992).
 *
 * Each of these got ahead of the measurement it rested on, and nothing failed
 * because nothing read the prose against the files and constants behind it:
 *
 *   1. "no per-repo tuning" / "blind selection" — the retrieval benchmark loads
 *      benchmarks/config-overrides.json, which pins `srcDirs` for every repo.
 *   2. "Hidden files … 0" — a literal in the quality benchmark; SigMap's budget
 *      does omit files from the written map, and says so when it does.
 *   3. The Zenodo record — its results file has `final_tokens` = 0 in all 405 rows.
 *   4. "105 real coding tasks" — a prompt-weight model, not live sessions.
 *   5. "5.9× lift" — 80.4% over a RANDOM-file baseline of 13.6%, not over a tool.
 *   6. "Use `.sigmapignore` to exclude sensitive files" (SECURITY.md) — that file only steers
 *      source-root detection; the file filter is `.contextignore` (#1089). The page was not
 *      read by any test, and a test that greps for the phrase would not have read the CODE.
 *   7. "`sigmap --init` writes the `core` profile" — a new config starts on `index` and `locate`
 *      since v8.88.0 (#1071). The guard that was written for it read README.md and six guides,
 *      one word order and three verbs, and missed seven sentences on four other pages (#1089).
 *
 * (The About texts of two other repositories are outside this repository; a
 * test cannot read them.) History files — the roadmap and the changelog — record
 * what was published at the time and are not rewritten.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

const HISTORY = new Set(['roadmap.md', 'changelog.md']);

function docs() {
  // Every page a reader is sent to: the root pages, the guides, and `docs/` (the README's "Start here" pages live in docs/readmes). The files git tracks, so a
  // local draft (docs/growth is gitignored) cannot make the suite depend on the checkout; without git, a walk that skips it.
  const tracked = spawnSync('git', ['ls-files', '-z', '--', 'README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'KNOWN_LIMITATIONS.md', 'docs', 'docs-vp', 'llms.txt', 'llms-full.txt'], { cwd: ROOT, encoding: 'utf8' });
  let rels = tracked.status === 0 ? tracked.stdout.split('\0').filter(Boolean) : null;
  if (!rels || rels.length < 20) {
    rels = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        if (['node_modules', '.vitepress', 'growth'].includes(e.name)) continue;
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel); else rels.push(rel);
      }
    };
    for (const f of ['README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'KNOWN_LIMITATIONS.md', 'llms.txt', 'llms-full.txt']) rels.push(f);
    walk('docs-vp'); walk('docs');
  }
  return rels
    .filter((rel) => /\.(md|txt)$/.test(rel) && !HISTORY.has(path.basename(rel).toLowerCase()) && !/(^|\/)(node_modules|\.vitepress)\//.test(rel) && fs.existsSync(path.join(ROOT, rel)))
    .map((rel) => ({ rel, text: fs.readFileSync(path.join(ROOT, rel), 'utf8') }));
}

/** Every line of every published document that matches `re`. */
function linesMatching(re) {
  const hits = [];
  for (const d of docs()) {
    d.text.split('\n').forEach((line, i) => { if (re.test(line)) hits.push({ where: `${d.rel}:${i + 1}`, line }); });
  }
  return hits;
}

const json = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

// ---------------------------------------------------------------------------
test('1. no document claims "no per-repo tuning", "zero per-repo tuning" or "blind selection"', () => {
  const hits = linesMatching(/\b(?:no|zero|without)\s+per-repo\s+tuning\b|blind selection/i);
  assert.deepStrictEqual(hits.map((h) => h.where), [], hits.map((h) => `${h.where}: ${h.line.trim().slice(0, 120)}`).join('\n'));
});

test('1. the generalization page names the pinned srcDirs, and counts them from the file', () => {
  const pinned = Object.keys(json('benchmarks/config-overrides.json')).length;
  const page = fs.readFileSync(path.join(ROOT, 'docs-vp/guide/generalization.md'), 'utf8');
  assert.ok(page.includes('benchmarks/config-overrides.json'), 'the page must name the file that pins the source directories');
  assert.ok(new RegExp(`\\b${pinned}\\b[^\\n]*(?:repos|of ${pinned})|${pinned} of ${pinned}`).test(page), `the page must state the number of pinned repos (${pinned})`);
  assert.ok(/xrepo|zero-config/i.test(page), 'the zero-config third-party measurement stands beside the headline');
});

// ---------------------------------------------------------------------------
test('2. the quality benchmark computes the SigMap side of "hidden files"; it is not a literal', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/run-quality-benchmark.mjs'), 'utf8');
  assert.ok(!/filesHiddenSigMap\s*=\s*0\b/.test(src), 'filesHiddenSigMap is still a literal 0');
  assert.ok(/filesHiddenSigMap\s*=\s*repo\.droppedCount/.test(src), 'filesHiddenSigMap must come from the measured droppedCount');
  // (The context-window OVERFLOW lines say "With SigMap: 0" and are true by construction of the token budget;
  // it is the files-hidden lines that must carry the measured count.)
  const hiddenLines = src.split('\n').filter((l) => /hidden/i.test(l) && (/With SigMap: 0\b/.test(l) || /→ 0 with SigMap/.test(l)));
  assert.deepStrictEqual(hiddenLines.map((l) => l.trim()), [], 'a files-hidden line still says 0 with SigMap');
});

test('2. the published hidden-files row carries the measured numbers, not 0', () => {
  const row = linesMatching(/^\|\s*Files left out of the context\s*\|/)[0];
  assert.ok(row, 'the headline table has the files-left-out row');
  assert.ok(!/^\|\s*Hidden files/i.test(row.line));
  const dropped = json('benchmarks/reports/token-reduction.json').repos.reduce((s, r) => s + (r.droppedCount || 0), 0);
  const hiddenRaw = json('benchmarks/reports/quality.json').summary.totalHiddenFiles;
  assert.ok(dropped > 0, 'the saved run did drop files, so "0 hidden" was false');
  assert.ok(row.line.includes(dropped.toLocaleString('en-US')), `the row must show ${dropped.toLocaleString('en-US')} files omitted from the map: ${row.line}`);
  assert.ok(row.line.includes(hiddenRaw.toLocaleString('en-US')), `the row must show ${hiddenRaw.toLocaleString('en-US')} hidden without SigMap: ${row.line}`);
});

// ---------------------------------------------------------------------------
test('3. every Zenodo link says what is wrong with the record it points at', () => {
  const hits = linesMatching(/zenodo\.(?:org\/records\/|19898842)|10\.5281\/zenodo\.19898842/);
  assert.ok(hits.length >= 5, `expected the README, four guides and the llms files to link the record, found ${hits.length}`);
  const bare = hits.filter((h) => !/known defect/i.test(h.line));
  assert.deepStrictEqual(bare.map((h) => h.where), [], `a link without the caveat:\n${bare.map((h) => `${h.where}: ${h.line.trim().slice(0, 140)}`).join('\n')}`);
});

// ---------------------------------------------------------------------------
test('4. the prompts figure is called modeled wherever it is called a reduction across tasks', () => {
  const hits = linesMatching(/prompts?\b.*real coding tasks|real coding tasks.*prompts?\b/i);
  assert.deepStrictEqual(hits.map((h) => h.where), [], hits.map((h) => `${h.where}: ${h.line.trim().slice(0, 140)}`).join('\n'));
  const card = linesMatching(/Latest saved run:.*prompts without SigMap/)[0];
  assert.ok(card && /modeled/i.test(card.line), `the homepage card must say modeled: ${card && card.line}`);
});

// ---------------------------------------------------------------------------
test('5. 5.9× is only ever stated against its random-file baseline', () => {
  const hits = linesMatching(/5\.9\s*[×x]/);
  const bare = hits.filter((h) => !/random/i.test(h.line));
  assert.deepStrictEqual(bare.map((h) => h.where), [], `5.9× with no baseline named:\n${bare.map((h) => `${h.where}: ${h.line.trim().slice(0, 140)}`).join('\n')}`);
  const m = json('version.json').metrics;
  assert.ok(Math.abs(m.retrieval_lift - m.hit_at_5 / m.baseline_hit_at_5) < 0.06, 'retrieval_lift is hit@5 over the baseline hit@5');
  assert.ok(m.baseline_hit_at_5 < 0.2, 'and that baseline is the random-file one');
});

// ---------------------------------------------------------------------------
// #1089. Each claim below is checked against the code or the data it describes, and where the claim is about what a run does, by RUNNING
// SigMap on a small project. A test that greps for a phrase misses the same claim in other words, so the rules here are built on what is
// being claimed, not on how one sentence happened to put it. What each rule cannot see is said next to it.

const readRel = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
const numberOf = (word) => (/^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word.toLowerCase()]);
const where = (hits) => hits.map((h) => `${h.where}: ${h.line.trim().slice(0, 120)}`).join('\n');
/** llms-full.txt is generated from src/ (command help, tool descriptions) and follows it. llms.txt is read: its hand-typed lines come from scripts/generate-llms.mjs and scripts/llms-manual.mjs. */
const notGenerated = (h) => !/llms-full\.txt:/.test(h.where);

// 0. The rules below are scans of the pages docs() returns. A refactor of docs(), or a reorganisation of the docs, that made it return little or nothing
// would leave most of them green and checking nothing, so this is the control for all of them.
test('0. the pages the rules read are read: the root pages, the guides, docs/readmes and both llms files', () => {
  const pages = docs();
  assert.ok(pages.length >= 60, `docs() reads ${pages.length} pages, expected 60 or more`);
  for (const rel of ['README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'KNOWN_LIMITATIONS.md', 'llms.txt', 'docs/readmes/GETTING_STARTED.md', 'docs/readmes/MCP_SETUP.md', 'docs-vp/guide/mcp.md', 'docs-vp/guide/cli.md', 'docs-vp/guide/retrieval-benchmark.md', 'docs-vp/guide/agent-study.md', 'docs-vp/guide/languages.md']) assert.ok(pages.some((d) => d.rel === rel), `docs() must read ${rel}`);
  assert.ok(!pages.some((d) => /(^|\/)growth\//.test(d.rel) || /roadmap\.md$/i.test(d.rel)), 'and not a local draft or a history page');
});

/** A scratch project in a scratch home, removed afterwards. Its own git root, and no inherited GIT_* variables, so a TMPDIR inside a work tree
 *  (or a GIT_DIR set by a hook) cannot make some enclosing repository the project. */
function withProject(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-claim-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-claim-home-'));
  try {
    for (const [rel, body] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), body);
    }
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/.test(k)));
    Object.assign(env, { HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex') });
    spawnSync('git', ['init', '-q', dir], { env, stdio: 'ignore' });
    const run = (script, ...args) => spawnSync(process.execPath, [path.join(ROOT, script), ...args], { cwd: dir, encoding: 'utf8', env, timeout: 90000 });
    const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8', env });
    // one MCP session over stdio: initialize, then one tools/call; returns the text of the result
    const mcp = (name, args = {}) => {
      const input = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } } }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } }].map((m) => JSON.stringify(m)).join('\n') + '\n';
      const r = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--mcp'], { cwd: dir, encoding: 'utf8', env, input, timeout: 90000 });
      const last = r.stdout.trim().split('\n').pop();
      try { return JSON.parse(last).result.content[0].text; } catch (_) { return `${r.stdout}${r.stderr}`; }
    };
    const read = (rel) => { try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch (_) { return ''; } };
    // everything SigMap wrote for an agent to read: all files outside the sources, the index directory and the project's own config
    const written = () => {
      const out = [];
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          if (e.isDirectory()) { if (!['src', 'private', 'app', 'secrets', '.context', 'node_modules', '.git'].includes(e.name)) walk(path.join(d, e.name)); }
          else if (!/^(?:gen-context\.config\.json|package\.json|\.contextignore|\.repomixignore|\.sigmapignore|answer\.md)$/.test(e.name)) out.push(fs.readFileSync(path.join(d, e.name), 'utf8'));
        }
      };
      walk(dir);
      return out.join('\n');
    };
    return fn({ dir, run, git, mcp, sigmap: (...args) => run('gen-context.js', ...args), read, written });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 6. Ignore files (SECURITY.md). It told users to use `.sigmapignore` to exclude sensitive files; it only steers source-root detection. The
// first version of this test looked for the verb "exclude" and so could not see the sentence that replaced it ("keep ... out"): this one does
// not depend on a verb. Every ignore file is tried on a project, and one that keeps nothing out may only be mentioned with a negation right
// after its name. The caveats SECURITY.md lists are each checked by a run below, so they cannot go stale in either direction.
const IGNORE_FILES = ['.contextignore', '.repomixignore', '.sigmapignore'];
const HONEST_MENTION = /\.sigmapignore`?\s+(?:only|is not|isn't|does not|doesn't|never|keeps nothing|excludes nothing)\b/i;

/** keep.js imports secret_vault.js; `ignoreFile` lists `patterns`. */
const secretProject = (ignoreFile, patterns, strategy = 'full', dir = 'src') => ({
  'src/keep.js': `const { readTheVaultToken } = require("${dir === 'src' ? './' : '../private/'}secret_vault");\nfunction keptHelper(a) { return readTheVaultToken() + a; }\nmodule.exports = { keptHelper };\n`,
  [`${dir}/secret_vault.js`]: 'function readTheVaultToken() { return 1; }\nmodule.exports = { readTheVaultToken };\n',
  'gen-context.config.json': `${JSON.stringify({ srcDirs: dir === 'src' ? ['src'] : ['src', dir], outputs: ['claude'], strategy })}\n`,
  [ignoreFile]: `${patterns.join('\n')}\n`,
});

/** Generate in the project and report what reached the written map and the signature index. */
function generated(ctx, { mapListsSignatures = true } = {}) {
  const r = ctx.sigmap();
  assert.strictEqual(r.status, 0, `generation failed in the fixture: ${(r.stdout + r.stderr).slice(-300)}`);
  const map = ctx.written();
  const index = ctx.read('.context/sig-index.json');
  assert.ok(index.includes('keep.js') && (!mapListsSignatures || map.includes('keptHelper')), 'control: the file nothing lists must be indexed, or this proves nothing');
  return { signatureInMap: map.includes('readTheVaultToken'), signatureInIndex: index.includes('readTheVaultToken'), nameInMap: map.includes('secret_vault') };
}
const keepsOut = (ignoreFile, patterns = ['src/secret_vault.js'], dir = 'src') => withProject(secretProject(ignoreFile, patterns, 'full', dir), (ctx) => {
  const g = generated(ctx);
  return !g.signatureInMap && !g.signatureInIndex;
});

test('6. an ignore file that keeps nothing out is only mentioned with a negation right after its name; SECURITY.md is read and names one that works', () => {
  const pages = docs();
  const security = pages.find((d) => d.rel === 'SECURITY.md');
  assert.ok(security, 'control: SECURITY.md is among the pages read');
  assert.ok(/\.contextignore/.test(security.text), 'SECURITY.md must name the ignore file that works');
  // what the page says is pinned too: the runs below check the code against these statements, so a "simplifying" edit that flips or drops one fails here
  for (const required of ['`.contextignore` is not an access control', 'run `sigmap` again', '`sigmap explain <file>`', 'monorepo: true', '`.sigmapignore` is not a file filter', '`get_diff_context`', '`sigmap review-pr`', 'a `!` re-include do not', '`sigmap lines`', '`get_lines`', '`--impact`', '`--callers`', '`gen-project-map.js`', '`.context/extract-cache.json`']) assert.ok(security.text.includes(required), `SECURITY.md must keep saying: ${required}`);
  const mentions = new Map();
  for (const d of pages) {
    d.text.split('\n').forEach((line, i) => {
      for (const f of IGNORE_FILES) if (line.includes(f)) mentions.set(f, [...(mentions.get(f) || []), { where: `${d.rel}:${i + 1}`, line }]);
    });
  }
  assert.ok(mentions.has('.sigmapignore') && mentions.has('.contextignore'), 'control: pages name both .contextignore and .sigmapignore (the rule needs something to judge)');
  const works = {};
  for (const f of IGNORE_FILES) works[f] = keepsOut(f);
  assert.ok(works['.contextignore'] && works['.repomixignore'], 'control: .contextignore and .repomixignore each keep the listed file out');
  assert.ok(!works['.sigmapignore'], 'control: .sigmapignore keeps nothing out of a project that sets srcDirs, so a mention of it must say so');
  const bad = [];
  for (const [f, hits] of mentions) {
    if (works[f]) continue;
    for (const h of hits) if (!HONEST_MENTION.test(h.line)) bad.push(`${h.where} names ${f}, which keeps no file out, without saying so right after its name ("${f} is not ...", "${f} only ..."): ${h.line.trim().slice(0, 120)}`);
  }
  assert.deepStrictEqual(bad, [], bad.join('\n'));
  // the rule's own controls: a wrong offer in other words is flagged, the honest forms pass
  for (const wrong of ['Put the paths in `.sigmapignore` and SigMap leaves them out of the map', '- Add secrets to `.sigmapignore` so SigMap does not index them', 'Use `.sigmapignore` to exclude sensitive files from the source roots and the map', '`.sigmapignore` keeps secrets out, which is not what .gitignore does']) assert.ok(!HONEST_MENTION.test(wrong), `must flag: ${wrong}`);
  for (const honest of ['`.sigmapignore` is not a file filter', '`.sigmapignore` only steers source-root detection', '`.sigmapignore` does not exclude files from the map; use `.contextignore`']) assert.ok(HONEST_MENTION.test(honest), `must pass: ${honest}`);
});

test('6. what SECURITY.md says about regenerating, `sigmap explain`, and what an excluded file is still reachable by is what a run does', () => {
  withProject(secretProject('.sigmapignore', ['src/secret_vault.js']), (ctx) => {
    const g = generated(ctx);
    assert.ok(g.signatureInMap && g.signatureInIndex, 'control: a file listed only in .sigmapignore stays in the map and the index');
    assert.match(ctx.sigmap('explain', 'src/secret_vault.js').stdout, /INCLUDED/, 'explain says INCLUDED for a file the pattern did not match');
  });
  // list the file AFTER a run: explain says EXCLUDED at once, but what was written keeps the file until SigMap runs again
  withProject(secretProject('.contextignore', ['src/other.js']), (ctx) => {
    generated(ctx);
    fs.writeFileSync(path.join(ctx.dir, '.contextignore'), 'src/secret_vault.js\n');
    const explain = ctx.sigmap('explain', 'src/secret_vault.js').stdout;
    assert.ok(/EXCLUDED/.test(explain) && /matched \.contextignore/.test(explain), `explain must say EXCLUDED with the reason: ${explain.slice(0, 200)}`);
    assert.ok(ctx.written().includes('readTheVaultToken') && ctx.read('.context/sig-index.json').includes('readTheVaultToken'), 'what was generated before still holds the signature');
    ctx.sigmap();
    assert.ok(!ctx.written().includes('readTheVaultToken') && !ctx.read('.context/sig-index.json').includes('readTheVaultToken'), 'running SigMap again removes it');
  });
  withProject(secretProject('.contextignore', ['src/secret_vault.js']), (ctx) => {
    const g = generated(ctx);
    assert.ok(!g.signatureInMap && !g.signatureInIndex, 'control: the signature is kept out of the map and the index');
    const lines = ctx.sigmap('lines', 'src/secret_vault.js', ':1', '--context', '1');
    assert.ok(lines.stdout.includes('readTheVaultToken'), `"sigmap lines" must still read the excluded file: ${(lines.stdout + lines.stderr).slice(0, 200)}`);
    assert.ok(ctx.mcp('get_lines', { file: 'src/secret_vault.js', start: 1, end: 2 }).includes('readTheVaultToken'), 'the MCP get_lines tool must still read it');
    assert.ok(ctx.sigmap('--callers', 'readTheVaultToken').stdout.includes('src/keep.js'), '"--callers" must still find the excluded function\'s caller');
    assert.ok(/secret_vault/.test(ctx.sigmap('--impact', 'src/secret_vault.js').stdout), '"--impact" must still answer for the excluded file');
    ctx.run('gen-project-map.js');
    assert.ok(ctx.read('PROJECT_MAP.md').includes('secret_vault'), 'node gen-project-map.js does not read .contextignore, so the map it writes names the file');
    assert.ok(ctx.read('.context/extract-cache.json').includes('secret_vault'), '.context/extract-cache.json records the excluded module\'s name');
    // a changed excluded file: get_diff_context and review-pr print its signatures
    ctx.git('add', '-A'); ctx.git('commit', '-q', '-m', 'init');
    fs.writeFileSync(path.join(ctx.dir, 'src/secret_vault.js'), 'function readTheVaultToken() { return 1; }\nfunction addedLater() { return 2; }\nmodule.exports = { readTheVaultToken, addedLater };\n');
    ctx.git('add', 'src/secret_vault.js');
    assert.ok(ctx.mcp('get_diff_context').includes('addedLater'), 'the MCP get_diff_context tool prints an excluded changed file\'s signatures');
    assert.ok(ctx.sigmap('review-pr', '--staged', '--markdown').stdout.includes('addedLater'), '"sigmap review-pr" prints an excluded changed file\'s signatures');
  });
  // an importer's dependency line names the module under the strategies that list dependencies, and not under `index`
  for (const strategy of ['full', 'per-module', 'hot-cold']) {
    withProject(secretProject('.contextignore', ['src/secret_vault.js'], strategy), (ctx) => {
      const g = generated(ctx);
      assert.ok(g.nameInMap && !g.signatureInMap, `strategy ${strategy}: the importer's dependency line names the module and the signature is absent`);
    });
  }
  withProject(secretProject('.contextignore', ['src/secret_vault.js'], 'index'), (ctx) => {
    assert.ok(!generated(ctx, { mapListsSignatures: false }).nameInMap, 'strategy index: the map does not name the excluded module');
  });
});

test('6. what SECURITY.md says the matcher does and does not match, and about monorepos and .sigmapignore, is what a run does', () => {
  for (const pattern of ['src/secret_vault.js', 'src/secret_*.js', '*_vault.js']) assert.ok(keepsOut('.contextignore', [pattern]), `"${pattern}" must exclude the file (plain paths and *.ext work)`);
  for (const pattern of ['private/', 'private/*']) assert.ok(keepsOut('.contextignore', [pattern], 'private'), `"${pattern}" must exclude the directory's file (dir/ and dir/* work)`);
  for (const pattern of ['/src/secret_vault.js', 'src/secre?_vault.js']) assert.ok(!keepsOut('.contextignore', [pattern]), `"${pattern}" excludes the file now: SECURITY.md says a leading / and a one-character ? do not match`);
  assert.ok(!keepsOut('.contextignore', ['/private/'], 'private'), 'a leading slash on a directory pattern fails open too');
  withProject(secretProject('.contextignore', ['src/secret_*.js', '!src/secret_vault.js']), (ctx) => {
    const g = generated(ctx);
    assert.ok(!g.signatureInMap && !g.signatureInIndex, '"!" re-includes the file now: SECURITY.md says it does not');
  });
  // .sigmapignore: a top-level directory is not offered as a source root when srcDirs is not set, and it does nothing when srcDirs is set
  const zeroConfig = (extra) => ({
    'app/main.js': 'function appFn() { return 1; }\nmodule.exports = { appFn };\n',
    'app/other.js': 'function appTwo() { return 1; }\nmodule.exports = { appTwo };\n',
    'secrets/vault.js': 'function vaultFn() { return 1; }\nmodule.exports = { vaultFn };\n',
    'secrets/more.js': 'function vaultTwo() { return 1; }\nmodule.exports = { vaultTwo };\n',
    '.sigmapignore': 'secrets/\n',
    ...extra,
  });
  withProject(zeroConfig({}), (ctx) => {
    ctx.sigmap();
    const index = ctx.read('.context/sig-index.json');
    assert.ok(index.includes('appFn') && !index.includes('vaultFn'), '.sigmapignore keeps a top-level directory from becoming a source root when srcDirs is not set');
  });
  withProject(zeroConfig({ 'gen-context.config.json': '{"srcDirs":["app","secrets"],"outputs":["claude"]}\n' }), (ctx) => {
    ctx.sigmap();
    assert.ok(ctx.read('.context/sig-index.json').includes('vaultFn'), '.sigmapignore does nothing when srcDirs is set');
  });
  const monorepo = (extra) => ({
    'package.json': '{"name":"root","private":true,"workspaces":["packages/*"]}\n',
    'packages/a/package.json': '{"name":"a","version":"1.0.0"}\n',
    'packages/b/package.json': '{"name":"b","version":"1.0.0"}\n',
    'packages/a/src/a.js': 'function aHelper(x) { return x; }\nmodule.exports = { aHelper };\n',
    'packages/b/src/b.js': 'function bHelper(x) { return x; }\nmodule.exports = { bHelper };\n',
    'packages/b/src/secret.js': 'function monoSecretFn() { return 1; }\nmodule.exports = { monoSecretFn };\n',
    'gen-context.config.json': '{"outputs":["claude"],"strategy":"full","monorepo":true}\n',
    // both a root-relative and a bare pattern: neither reaches a package
    '.contextignore': 'packages/b/src/secret.js\nsecret.js\n',
    ...extra,
  });
  withProject(monorepo({}), (ctx) => {
    const r = ctx.sigmap('--monorepo');
    assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`.slice(-300));
    assert.ok(ctx.read('packages/b/CLAUDE.md').includes('bHelper'), 'control: the package was generated');
    assert.ok(ctx.read('packages/b/CLAUDE.md').includes('monoSecretFn'), 'a root .contextignore is applied to a package now: SECURITY.md says it is not');
    assert.match(ctx.sigmap('explain', 'packages/b/src/secret.js').stdout, /EXCLUDED/, 'and explain, run from the root, says EXCLUDED for it anyway: it is not reliable there');
  });
  withProject(monorepo({ 'packages/b/.contextignore': 'src/secret.js\n' }), (ctx) => {
    ctx.sigmap('--monorepo');
    assert.ok(ctx.read('packages/b/CLAUDE.md').includes('bHelper') && !ctx.read('packages/b/CLAUDE.md').includes('monoSecretFn'), "a package's own .contextignore keeps the file out");
  });
});

// ---------------------------------------------------------------------------
// 7. What `sigmap --init` writes. A new config starts on the `index` strategy and the two-tool `locate` profile since v8.88.0. The guard that
// came with it (new-install-default-guard.test.js) read README.md and six guides for `--init`, one of three verbs and `core`, in that order.
// This one reads three lines at a time on every page, takes any cue that a sentence is about a new install and any spelling of the old
// default, and lets a sentence off only if it also names `locate` (or "two tools", what the new default is called in prose) without
// calling it opt-in. It cannot see a stale sentence that also names `locate`, so the pages that held the claim are pinned separately below.
const NEW_INSTALL = /--init|\bnew(?:ly)?[- ](?:created |set up )?(?:configs?|installs?|projects?|ones?)\b|\bfresh (?:install|project|config)|\bstarter config|\bout of the box|\bconfig written by\b|\bfirst[- ]time (?:user|run|install)/i;
const OLD_DEFAULT = /["`]core["`]|\bcore (?:profile|tools?|set)\b|\bmcp\.tools\b[^.\n]{0,30}\bcore\b|\b(?:seven|7)(?:[- ](?:core|mcp))?[- ]tools?\b|\b7-tool core\b|\bstrategy[`" :=]*full\b|\b`?full`? strategy\b|\ball 22\b|\bevery tool\b/i;
const NEW_DEFAULT = /\blocate\b|\btwo[- ]tools?\b|\bonly two of these tools\b|`query_context` and `get_lines`/i;
const LOCATE_AS_OPT_IN = /\blocate\b[^.\n]{0,60}\bopt(?:-| )in\b|\bopt(?:-| )in\b[^.\n]{0,40}\blocate\b/i;
const HISTORICAL = /\b(?:before v?\d|until v?\d|prior to|used to|previously|formerly|wrote|was)\b/i;
// judged sentence by sentence (a window of three lines is joined first, so a hard-wrapped sentence is one sentence): `locate` somewhere else in the same long
// line must not excuse a sentence that still gives the new install `core`
const isOldNewInstallClaim = (text) => text.replace(/\*+/g, '').split(/(?<=\.)\s+/).some((s) => NEW_INSTALL.test(s) && !HISTORICAL.test(s) && (LOCATE_AS_OPT_IN.test(s) || (OLD_DEFAULT.test(s) && !NEW_DEFAULT.test(s))));

test('7. the rule that finds the old new-install wording flags the old claim in many spellings and passes the current wording (controls)', () => {
  for (const old of [
    'a config written by `sigmap --init` sets it to `"core"`',
    '`"core"` is seven of them (`query_context`, `read_context`), and `sigmap --init` writes it into a new config.',
    'The new one starts the MCP server on the seven-tool `core` profile.',
    'on the `core` profile a `sigmap --init` config sets, the seven listed above',
    'the seven of `core` in a config written by `sigmap --init`',
    'A project created with `sigmap --init` gets the seven `core` tools.',
    'New projects start on the seven-tool `core` profile (`"mcp": { "tools": "core" }`);',
    'The starter config sets `mcp.tools: core`.',
    'A fresh project defaults to the full strategy.',
    'Out of the box `sigmap --init` produces a config on strategy `full`.',
    'The new one starts on the\nseven-tool `core` profile (`"mcp": { "tools": "core" }`);',
    '`sigmap --init` generates a config that advertises 7 tools.',
    'A config written by `sigmap --init` sets `mcp.tools` to core, the core set of tools.',
    'a config written by `sigmap --init` sets `"all"`, which advertises all 22 tools',
    "SigMap's installer, `sigmap --init`, writes a config for a new project\nand picks the MCP tool profile the agent sees,\nwhich is the seven-tool `core` profile.",
    'A config written by `sigmap --init` sets `mcp.tools` to `"core"`; `"locate"` (two tools) is the opt-in.',
  ]) assert.ok(isOldNewInstallClaim(old.split('\n').slice(0, 3).join(' ')), `the rule must flag: ${old}`);
  for (const current of [
    '`sigmap --init` writes `"locate"` (two tools) into a new config.',
    'A new config starts on the `index` strategy and the two-tool `locate` MCP profile, under a third of the tool-definition tokens of `core`.',
    'A project set up with `sigmap --init` starts on the `index` strategy and advertises only two of these tools.',
    'To get seven tools from a config `sigmap --init` writes, set `"mcp": { "tools": "core" }`; it starts on `locate`.',
    'Set `"mcp": { "tools": "core" }` for seven tools.',
    'Before v8.88.0, `sigmap --init` wrote the seven-tool `core` profile into a new config.',
    'A new config starts on `locate`. A **core** tool profile is the opt-in with seven tools.',
    'A project with no `mcp.tools` key gets all 22, and a config written by `sigmap --init` sets it to `"locate"`.',
  ]) assert.ok(!isOldNewInstallClaim(current), `the rule must pass: ${current}`);
});

test('7. no page says `--init` or a new config is given `core`, seven tools or strategy `full` (the pre-v8.88.0 wording), in any spelling', () => {
  const bad = [];
  for (const d of docs()) {
    const ls = d.text.split('\n');
    ls.forEach((line, i) => { if (isOldNewInstallClaim([line, ls[i + 1], ls[i + 2]].filter((x) => x !== undefined).join(' '))) bad.push(`${d.rel}:${i + 1}: ${line.trim().slice(0, 110)}`); });
  }
  assert.deepStrictEqual(bad, [], `these lines still say a new install gets the old default; since v8.88.0 \`sigmap --init\` writes strategy "index" and the "locate" profile (name \`locate\` in the same sentence when you mention it, and do not call it opt-in):\n${bad.join('\n')}`);
  // the pages that held the claim, pinned: each paragraph that mentions `sigmap --init` and a profile names locate as what it writes
  for (const rel of ['docs/readmes/GETTING_STARTED.md', 'docs/readmes/MCP_SETUP.md', 'docs/readmes/vscode-extension.md']) {
    const mentions = readRel(rel).split('\n').filter((l) => /`sigmap --init`/.test(l) && /\bcore\b|mcp\.tools|\bprofile\b/.test(l));
    assert.ok(mentions.length >= 1 && mentions.every((l) => /\blocate\b/.test(l)), `${rel}: each line about what \`sigmap --init\` writes must name locate`);
  }
  // the pages that called index plus core "the documented optimum" and locate "opt-in" (agent-study.md) and full the default "for onboarding" (strategies.md)
  const stale = linesMatching(/the documented optimum:|Two things the study led to are now in SigMap, both opt-in|Default for all IDEs and onboarding/);
  assert.deepStrictEqual(stale.map((h) => h.where), [], `v8.88.0 writes index plus locate for a new project:\n${where(stale)}`);
});

// ---------------------------------------------------------------------------
// 8. Claude Code reads its project MCP servers from .mcp.json, and the installer has written that file since #994. A line is the old claim
// when it puts a Claude Code settings file next to MCP (on that line or in the next three) and does not say it is moving an older entry out.
const SETTINGS_FILE = /\.claude\/settings(?:\.local)?\.json|Claude Code(?:'s)? (?:project |user )?settings(?: file)?|\bsettings\.json\b[^.\n]{0,25}\.claude\b/i;
const NEGATED_READ = /\bnot (?:read|use|the file)\b|\bdoes not\b|\bdoesn't\b|\binstead of\b|\brather than\b/i;
const MIGRATION = /\bmigrat\w*|\bmoved?\b|\blegacy\b|\bolder (?:SigMap )?(?:entry|config)/i;
const MCP_WORDS = /\bmcp\b|mcpServers|\bservers?\b/i;
// on the pages about the MCP server itself a Claude settings file is only named while saying something moved out of it (hooks and permissions are the other legitimate subjects)
const MCP_PAGE = /(?:^|\/)(?:MCP_SETUP\.md|mcp\.md)$/;
const isOldSettingsClaim = (line, following, rel = '') => SETTINGS_FILE.test(line) && !MIGRATION.test(line) && !NEGATED_READ.test(line) && (MCP_WORDS.test(line) || (MCP_WORDS.test(following) && !/\bhooks?\b/i.test(line)) || (MCP_PAGE.test(rel) && !/\b(?:hooks?|permissions?)\b/i.test(line)));

test('8. no page names .claude/settings.json (or "Claude Code settings") as where Claude Code reads MCP servers from', () => {
  for (const [line, following, rel] of [
    ['Add to `.claude/settings.json`:', '```json { "mcpServers": { "sigmap": {} } }'],
    ['Register the server in `.claude/settings.json` in your project.', ''],
    ['Add to `.claude/settings.local.json`.', '', 'docs/readmes/MCP_SETUP.md'],
    ['Add the MCP server (next to your hooks) to `.claude/settings.json`.', ''],
    ['Register the server in `.claude/settings.local.json`.', 'MCP'],
    ['Wire MCP up in your Claude Code settings.', ''],
    ['Add the MCP server in Claude Code project settings (works in older versions too).', ''],
  ]) assert.ok(isOldSettingsClaim(line, following, rel), `the rule must flag: ${line}`);
  for (const [line, following] of [
    ['`sigmap hooks install claude --shared` writes the committed `.claude/settings.json` instead.', 'hooks only'],
    ['An older Claude `.claude/settings.json` entry is moved to `.mcp.json`.', 'MCP'],
    ['Add the `permissions.allow` array to `.claude/settings.json`.', 'to pre-approve the sigmap commands'],
  ]) assert.ok(!isOldSettingsClaim(line, following), `the rule must pass: ${line}`);
  const bad = [];
  for (const d of docs()) {
    const ls = d.text.split('\n');
    ls.forEach((line, i) => { if (isOldSettingsClaim(line, ls.slice(i + 1, i + 4).join(' '), d.rel)) bad.push({ where: `${d.rel}:${i + 1}`, line }); });
  }
  assert.deepStrictEqual(bad.map((h) => h.where), [], `these lines send Claude Code's MCP server to its settings file; since #994 the installer writes .mcp.json:\n${where(bad)}`);
  assert.match(readRel('src/mcp/install.js'), /claude:\s*\{[^}]*project:\s*\['\.mcp\.json'\]/, 'control: the installer really does write .mcp.json for Claude Code');
  assert.ok(linesMatching(/\.mcp\.json/).length >= 5, 'control: the pages name .mcp.json in several places');
  const example = json('examples/claude-code-settings.json')._comment;
  assert.ok(/\.mcp\.json/.test(example) && !/\.claude\/settings\.json/.test(example), `the example file must say where it goes: ${example}`);
  // what the pages say about the launch command is what the installer writes: `npx -y sigmap --mcp`, not `npx sigmap mcp`
  assert.ok(!linesMatching(/"args": \["sigmap", "mcp"\]/).length, 'a server entry that runs `sigmap mcp` exits at once (it is `sigmap --mcp`)');
  withProject({ 'src/a.js': 'function alpha(x) { return x; }\n', 'gen-context.config.json': '{"srcDirs":["src"],"outputs":["claude"]}\n' }, (ctx) => {
    ctx.sigmap('mcp', 'install', 'claude');
    const entry = JSON.parse(ctx.read('.mcp.json')).mcpServers.sigmap;
    assert.deepStrictEqual([entry.command, ...entry.args], ['npx', '-y', 'sigmap', '--mcp'], 'the entry `sigmap mcp install claude` writes (MCP_SETUP.md and GETTING_STARTED.md quote it)');
  });
});

// ---------------------------------------------------------------------------
// 9. The agent study publishes its figures (v8.88.0), so no page may say the agent-level benchmark has none.
test('9. no page says the agent-level benchmark has published no figure', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'docs-vp/guide/agent-study.md')) && /−\d+(?:\.\d)?%|-\d+(?:\.\d)?%/.test(readRel('docs-vp/guide/agent-study.md')), 'control: the results page exists and holds measured figures');
  const NONE = /\bno (?:[\w-]+ ){0,3}(?:figures?|numbers?|results?)\b[^.]{0,60}\b(?:published|available)\b|\bno (?:figures?|numbers?|results?)\b[^.]{0,30}\bfrom (?:it|the agent)|\b(?:has|have) no published (?:figures?|numbers?|results?)\b|\bnumbers? come from a live run\b|\bnothing from it is published\b/i;
  assert.ok(NONE.test('No figure from it is published yet') && NONE.test('No agent-level number is published yet') && !NONE.test('The agent study publishes its figures.'), 'control: the rule reads the old sentence and not the new one');
  const bad = docs().filter((d) => NONE.test(d.text.replace(/\s+/g, ' '))).map((d) => d.rel);
  assert.deepStrictEqual(bad, [], `the agent study (docs-vp/guide/agent-study.md) is published; these pages still say there is no figure: ${bad.join(', ')}`);
});

// ---------------------------------------------------------------------------
// 10. The third-party (xrepo) tallies a page states are the baseline's, whatever the wording.
test('10. the third-party figures a page states are the baseline\'s: the totals, the per-batch tallies and how many tasks are unreachable', () => {
  const b = json('benchmarks/xrepo-baseline.json');
  const tallies = (lo, hi) => {
    let n = 0; let h = 0;
    for (const r of Object.values(b.repos)) for (const [id, rank] of Object.entries(r.ranks)) {
      const k = Number(id.replace(/\D/g, ''));
      if (k >= lo && k <= hi) { n++; if (rank !== null && rank <= 5) h++; }
    }
    return { n, h, pct: (100 * h / n).toFixed(1) };
  };
  const all = tallies(0, 999); const first83 = tallies(0, 83); const first20 = tallies(84, 103); const next25 = tallies(104, 128);
  const first128 = tallies(0, 128); const added45 = tallies(84, 128); const last80 = tallies(129, 999);
  assert.deepStrictEqual([all.n, all.h], [b.overall.tasks, b.overall.hits], 'control: the batch tallies add up to the baseline total');
  const unreachable = Object.values(b.repos).reduce((s, r) => s + (r.unreachable || []).length, 0);
  // every "N of 208" / "N out of 208" / "N/208" (not "205 / 208 of 222", a different quantity) and every "NN.N% hit@5 over 208 tasks"
  const ofAll = /\b(\d+) ?(?:hits )?(?:of|out of|\/) ?208\b(?! of \d)/;
  const states = linesMatching(ofAll);
  assert.ok(states.length >= 5, `control: the pages state the third-party tally in several places, found ${states.length}`);
  const wrong = states.filter((h) => [...h.line.matchAll(new RegExp(ofAll.source, 'g'))].some((m) => Number(m[1]) !== all.h));
  assert.deepStrictEqual(wrong.map((h) => h.where), [], `the baseline is ${all.h} of 208 = ${all.pct}%:\n${where(wrong)}`);
  const old = linesMatching(/\b55\.[38]\s?%/).filter((h) => !/\b(?:was|were|from|→|->|then|before|until|used to)\b/i.test(h.line));
  assert.deepStrictEqual(old.map((h) => h.where), [], `55.3% and 55.8% are the figures of v8.84.0 and v8.82.0; the baseline reads ${all.pct}%:\n${where(old)}`);
  const rate = new RegExp(`\\b(\\d{2}\\.\\d)% hit@5 (?:over|across|on) ${b.overall.tasks} (?:tasks|questions)`);
  const rates = linesMatching(rate);
  assert.ok(rates.length >= 1, 'control: a page states the rate in this form');
  const wrongRate = rates.filter((h) => h.line.match(rate)[1] !== all.pct);
  assert.deepStrictEqual(wrongRate.map((h) => h.where), [], `the baseline reads ${all.pct}%:\n${where(wrongRate)}`);
  // the same figure in the README bullets, the comparison table and the Overall row of the guide's table
  const headlineRe = /(\d{2}\.\d)% hit@5 on repositories we do not control|\*\*(\d{2}\.\d)%\*\* on repositories we do not control/;
  const headline = linesMatching(headlineRe);
  assert.ok(headline.length >= 2, `control: the README and the comparison page state the headline third-party rate, found ${headline.length}`);
  const wrongHeadline = headline.filter((h) => [...h.line.matchAll(new RegExp(headlineRe.source, 'g'))].some((m) => (m[1] || m[2]) !== all.pct));
  assert.deepStrictEqual(wrongHeadline.map((h) => h.where), [], `the baseline reads ${all.pct}%:\n${where(wrongHeadline)}`);
  const overall = linesMatching(/^\| \*\*Overall\*\* /).find((h) => h.where.startsWith('docs-vp/guide/retrieval-benchmark.md'));
  assert.ok(overall, 'the retrieval guide has an Overall row');
  assert.deepStrictEqual([...overall.line.matchAll(/\*\*([\d.]+%?)\*\*/g)].map((m) => m[1]), [String(all.n), String(all.h), `${all.pct}%`, String(unreachable)], "the Overall row of the third-party table is the baseline's: tasks, hits, hit@5, unreachable");
  // the band paragraph of the retrieval guide, batch by batch
  const guide = readRel('docs-vp/guide/retrieval-benchmark.md').replace(/\s+/g, ' ');
  const read = (re) => { const m = guide.match(re); assert.ok(m, `the retrieval guide no longer has: ${re}`); return m; };
  assert.deepStrictEqual(read(/The 45 questions added since read (\d+) of 45/).slice(1).map(Number), [added45.h], '"the 45 questions added since read N of 45"');
  assert.deepStrictEqual(read(/\((\d+) of the first 20, (\d+) of the next 25\)/).slice(1).map(Number), [first20.h, next25.h], '"(N of the first 20, M of the next 25)"');
  assert.deepStrictEqual(read(/The 16 original repositories still score exactly what they did \((\d+) of 83\)/).slice(1).map(Number), [first83.h], '"the 16 original repositories ... (N of 83)"');
  assert.deepStrictEqual(read(/the 45 questions added since read (\w+) more than when they were first scored, (\d+) of 45/).slice(1), ['one', '22'], 'the 45 added questions read one more than the 22 they first read (Rails x084 and x087 gained, spdlog x102 lost)');
  assert.deepStrictEqual(read(/took the whole to (\d+) of 128, ([\d.]+)%/).slice(1), [String(first128.h), first128.pct], '"took the whole to N of 128"');
  assert.deepStrictEqual(read(/the 80 added last read (\d+) of 80 \(([\d.]+)%\)/).slice(1), [String(last80.h), last80.pct], '"the 80 added last read N of 80"');
  const lastBatchUnreachable = Object.values(b.repos).reduce((s, r) => s + (r.unreachable || []).filter((id) => Number(id.replace(/\D/g, '')) >= 129).length, 0);
  assert.strictEqual(numberOf(read(/(\w+) of whose answers have no signatures/)[1]), lastBatchUnreachable, '"N of whose answers have no signatures in the zero-config index" counts the unreachable tasks among the last 80');
  // how many tasks are unreachable, in the forms the pages use; the miss table's "no token in common" class
  const count = /\b([A-Za-z]+|\d+) (?:tasks )?(?:are|is) (?:now )?unreachable(?: now)?\b/g;
  const counts = linesMatching(new RegExp(count.source));
  assert.ok(counts.length >= 1, 'control: a page states how many tasks are unreachable');
  const wrongCount = counts.filter((h) => [...h.line.matchAll(count)].some((m) => { const n = numberOf(m[1]); return n !== undefined && n !== unreachable; }));
  assert.deepStrictEqual(wrongCount.map((h) => h.where), [], `the baseline lists ${unreachable} unreachable tasks:\n${where(wrongCount)}`);
  assert.deepStrictEqual(read(/they hold (\d+) and 0 now/).slice(1).map(Number), [unreachable], '"they hold N and 0 now" (the unreachable count in the miss table)');
  const noToken = b.why.misses['no token in common with the question'];
  const left = read(/(\w+) tasks are left in it \(one original question, (\w+) added since\)/);
  assert.deepStrictEqual([numberOf(left[1]), numberOf(left[2])], [noToken, noToken - 1], '"N tasks are left in it (one original question, M added since)" is the baseline\'s no-token-in-common count');
});

// ---------------------------------------------------------------------------
// 11. The languages page lists for Ruby what the extractor emits.
test('11. the languages page lists for Ruby only what the extractor emits, and its positive claims are what it does', () => {
  const { extract } = require(path.join(ROOT, 'src', 'extractors', 'ruby.js'));
  const out = extract('module M\n  class Foo\n    include Bar\n    extend Baz\n    attr_accessor :a\n    attr_reader :b\n    def hi(x)\n    end\n    private\n    def hidden_one\n    end\n    protected\n    def guarded_one\n    end\n    def _skipped\n    end\n  end\nend\n').join('\n');
  assert.ok(/\bmodule M\b/.test(out) && /\bclass Foo\b/.test(out) && /\bdef hi\b/.test(out), `control: the extractor lists the module, the class and the method: ${out}`);
  const row = linesMatching(/^\|\s*Ruby\s*\|/).find((h) => h.where.startsWith('docs-vp/guide/languages.md'));
  assert.ok(row, 'the languages page has a Ruby row');
  const claimed = ['attr_accessor', 'attr_reader', 'attr_writer', 'include', 'extend', 'constants?', 'mixins?', 'alias_method', 'define_method'].filter((k) => new RegExp(`\\b${k}\\b`).test(row.line) && !/\bnot\b/.test(row.line));
  assert.deepStrictEqual(claimed.filter((k) => !new RegExp(`\\b${k}\\b`).test(out)), [], `the Ruby row names what the extractor does not emit (it lists class, module and def): ${row.line.trim()}`);
  if (/anchors?/i.test(row.line)) assert.ok(/:\d+-\d+\s*$/m.test(out), 'the row says the entries carry :start-end anchors, but the extractor output has none');
  if (/owns|owner|under the class/i.test(row.line)) assert.ok(/^ {2}def hi/m.test(out), 'the row says each def sits under its owner, but the extractor output does not indent it');
  // what the page says the Ruby extractor does with private and protected defs, in whatever words: it lists them and skips only a leading underscore
  const never = readRel('docs-vp/guide/languages.md');
  assert.ok(/\bdef hidden_one\b/.test(out) && /\bdef guarded_one\b/.test(out) && !/\b_skipped\b/.test(out), 'control: the extractor lists private and protected defs and skips a leading _');
  const aboutPrivate = never.split(/(?<=[.;)])\s+|\n/).filter((s) => /\bRuby\b/.test(s) && /\b(?:private|protected)\b/.test(s));
  assert.ok(aboutPrivate.length >= 1, 'the page says what the Ruby extractor does with private and protected defs (it lists them, so the "Private class members ... are never extracted" bullet is not true of it)');
  const SKIPS_PRIVATE = /\b(?:skips?|omits?|drops?|ignores?|hides?|excludes?)\b[^.;)\n]{0,30}`?(?:private|protected)\b|\b(?:does not|doesn't|never|not)\s+(?:lists?|extracts?|emits?)\b[^.;)\n]{0,30}`?(?:private|protected)\b/i;
  assert.deepStrictEqual(aboutPrivate.filter((s) => SKIPS_PRIVATE.test(s)), [], 'the Ruby extractor lists private and protected defs, and the page says it does not');
});

// ---------------------------------------------------------------------------
// 12. The extractor contract: the per-file ceiling, what is said when a file is cut, and the budgets applied after the extractor.
test('12. CONTRIBUTING.md teaches the ceiling the extractors use, the notice a cut prints, and the two budgets applied after them', () => {
  const ceilings = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'src', 'extractors')).filter((n) => n.endsWith('.js'))) {
    const src = readRel(`src/extractors/${f}`);
    for (const m of src.matchAll(/const (?:PER_FILE_LIMIT|MAX_SIGS_PER_FILE) = (\d+);/g)) ceilings.push(Number(m[1]));
    for (const m of src.matchAll(/capWithNotice\([^,()]+,\s*(\d+)\s*,/g)) ceilings.push(Number(m[1]));
  }
  const counts = ceilings.reduce((o, n) => ({ ...o, [n]: (o[n] || 0) + 1 }), {});
  const common = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  assert.ok(ceilings.length >= 30 && counts[common] >= ceilings.length * 0.9, `control: nearly every extractor shares one ceiling, found ${JSON.stringify(counts)}`);
  const text = readRel('CONTRIBUTING.md');
  const STALE_25 = /slice\(0,\s*25\)|\bNever exceed 25 signatures\b|\b(?:no more than|at most|up to|cap(?:ped)?(?: each file)? at)\s+25\s+signatures|(?:return|emit)[^.\n]{0,20}\b25 signatures|Math\.min\([^)]*,\s*25\)/i;
  assert.ok(STALE_25.test('- Cap each file at 25 signatures') && STALE_25.test('return sigs.slice(0, 25);') && STALE_25.test('- Return at most 25 signatures per file') && !STALE_25.test('The context file keeps the first 25 signatures by default.'), 'control: the rule flags the old teaching in other words and not the true statement about the default');
  assert.ok(!STALE_25.test(text), 'CONTRIBUTING.md still teaches a cut at 25 signatures; 25 is the default of maxSigsPerFile, applied after the extractor');
  // A verb list cannot see every way to say "cut at 25" ("Max 25 per file", "Truncate to 25"): the only place a 25 belongs in the extractor contract is beside
  // maxSigsPerFile, whose default it is (the two quotes of that default are pinned against defaults.js below).
  const contract = text.split(/^## /m).find((s) => /^Extractor contract/.test(s)) || '';
  assert.ok(/maxSigsPerFile/.test(contract) && /PER_FILE_LIMIT/.test(contract), 'control: the extractor-contract section is found');
  assert.deepStrictEqual(contract.split('\n').filter((l) => /\b25\b/.test(l) && !/maxSigsPerFile/.test(l)), [], 'a 25 in the extractor contract that is not the default of maxSigsPerFile teaches the retired cap');
  assert.ok(text.includes("const { capWithNotice } = require('../util/truncate');"), 'the sample imports capWithNotice, which src/util/truncate.js exports');
  assert.ok(text.includes(`const PER_FILE_LIMIT = ${common};`) && new RegExp(`\\b${common}\\b[^\\n]*signatures`, 'i').test(text), `CONTRIBUTING.md must teach the ceiling the extractors use (${common})`);
  assert.ok(text.includes("return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');"), 'and the sample must cut with capWithNotice, which says so (a silent cut is what #576 removed)');
  const EVERY = /\b(?:every|all)\b[^.\n]{0,20}\bextractors?\b[^.\n]{0,25}\b(?:use|uses|cap|caps|have|has|stop|stops)\b/i;
  assert.ok(!text.split('\n').some((l) => EVERY.test(l) && !/\bnot (?:every|all)\b|\bno ceiling\b|\bnone\b/i.test(l)), 'not every in-tree extractor has a ceiling (SQL, GraphQL, protobuf and Terraform have none, the generic one stops at 15)');
  const { capWithNotice } = require(path.join(ROOT, 'src', 'util', 'truncate.js'));
  const notice = capWithNotice(['a', 'b'], 1, 'signatures')[1];
  assert.ok(text.includes(notice.replace('+1', '+N')), `CONTRIBUTING.md must quote the notice capWithNotice prints (${notice})`);
  const { DEFAULTS } = require(path.join(ROOT, 'src', 'config', 'defaults.js'));
  assert.ok(text.includes(`\`maxSigsPerFile\` (${DEFAULTS.maxSigsPerFile})`) && text.includes(`\`maxSigsPerFile\` (default ${DEFAULTS.maxSigsPerFile})`) && text.includes(`\`maxIndexSigsPerFile\` (default ${DEFAULTS.maxIndexSigsPerFile}`), 'CONTRIBUTING.md must quote the two defaults as src/config/defaults.js has them');
});

// ---------------------------------------------------------------------------
// 13. The quality benchmark prints what it measured for files hidden with SigMap, not a literal.
test('13. the quality benchmark prints the computed hidden-file counts, and says nothing that the same table contradicts', () => {
  const src = readRel('scripts/run-quality-benchmark.mjs').replace(/(^|\s)\/\/.*$/gm, '$1'); // comments do not count: a retired line left in one must not satisfy the check
  const LITERAL = /pad\(\s*['"]0 hidden['"]|reduces hidden files to (?:0|zero)\b|surfaces (?:all|every) files? as signatures|With SigMap (?:all|every file)\b[^.\n]{0,20}\bvisible|SigMap hides no files|hides no files/i;
  const literal = src.split('\n').map((l, i) => ({ l, i: i + 1 })).filter(({ l }) => LITERAL.test(l));
  assert.deepStrictEqual(literal.map(({ l, i }) => `scripts/run-quality-benchmark.mjs:${i}: ${l.trim()}`), [], 'a line says no file is hidden with SigMap whatever the run measured');
  assert.ok(/pad\([^)]*filesHiddenSigMap[^)]*\)/.test(src) && /reduce\([^;]*filesHiddenSigMap/.test(src), 'the per-repo table and the sentence under it print the measured filesHiddenSigMap');
});

// ---------------------------------------------------------------------------
// 14. What `sigmap verify` is said to check is what a run reports as checked, and the footer names what it did not.
test('14. what verify is said to check matches a run of it and the list of what it does not check (NOT_CHECKED in src/verify/coverage.js)', () => {
  const { NOT_CHECKED } = require(path.join(ROOT, 'src', 'verify', 'coverage.js'));
  const stems = NOT_CHECKED.map((c) => c.replace(/\s*\(.*$/, ''));
  assert.ok(stems.length >= 3 && stems.includes('library APIs') && stems.includes('member calls'), `control: the list of what verify does not check is ${JSON.stringify(stems)}`);
  withProject({ 'src/a.js': 'function alpha(x) { return x; }\nmodule.exports = { alpha };\n', 'gen-context.config.json': '{"srcDirs":["src"],"outputs":["claude"]}\n', 'answer.md': 'See `src/a.js` and call `alpha(1)`.\n' }, (ctx) => {
    ctx.sigmap();
    const r = ctx.sigmap('verify', 'answer.md');
    const out = r.stdout + r.stderr;
    assert.ok(/1 file path/.test(out) && /1 backticked call/.test(out), `verify reports the claim classes it checked: ${out.slice(-300)}`);
    for (const full of NOT_CHECKED) assert.ok(out.includes(full), `the footer of "sigmap verify" must name "${full}": ${out.slice(-300)}`);
  });
  // the over-claim, in the verbs and objects it comes in; a line that says what verify does NOT do is not the claim
  const OVERCLAIM = /verify`?\s+(?:flags|catches|detects|rejects|proves)\s+(?:any|every|all)\b|\b(?:flags?|catch(?:es)?|detects?|rejects?)\s+(?:any|every|all)\s+(?:fabricat|hallucinat|fake|ungrounded|suggestion)\w*|\b(?:flags?|catch(?:es)?|detects?)\s+(?:fabricated|fake|hallucinated)\b|flags files, imports,? and symbols|an AI answer made up|\bverify(?:_suggestion)?\`?\s+proves? (?:an AI answer|the calls|the symbols)\b|\bflagging (?:fake|fabricated|non-existent)\b|\bgrounding check that proves\b/i;
  const NEGATED_VERB = /\b(?:does not|doesn't|do not|don't|never|cannot|can't|will not|won't)\s+(?:flag|catch|detect|reject|prove)/i;
  const isOverclaim = (line) => OVERCLAIM.test(line) && !NEGATED_VERB.test(line);
  for (const claim of ['`sigmap verify` flags any AI claim that is not grounded.', '`sigmap verify` catches hallucinated functions before they ship.', 'Detects hallucinated symbols in AI answers.', '`sigmap verify` proves an AI answer is grounded.', 'verify_suggestion proves the calls exist', 'rejects any suggestion that names a missing file']) assert.ok(isOverclaim(claim), `the rule must flag: ${claim}`);
  assert.ok(!isOverclaim('It does not flag fake member calls, because it never reads them.'), 'a line about what verify does not do is not the claim');
  const bad = linesMatching(OVERCLAIM).filter(notGenerated).filter((h) => isOverclaim(h.line));
  assert.deepStrictEqual(bad.map((h) => h.where), [], `verify is a name-level linter, not a check of every claim (its own footer lists what it skips):\n${where(bad)}`);
  // the opposite over-claim: a sentence that lists, among what verify checks, a class its own footer says it does not check
  const NOT_CHECKED_STEM = new RegExp(stems.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  const CHECK_VERB = /\b(?:checks?|tests? whether|proves?|grounds?|confirms?)\b/gi;
  const STOPS = /\b(?:not|never|except|without|besides|n't)\b|\(|\bsays what\b|\bwhat it did\b/i;
  // judged per sentence, but "verify" may be named in a neighbouring sentence of the same line ("Run `sigmap verify`. It checks ..."), so the line is the context; markdown emphasis is dropped
  const listsUncheckedAsChecked = (sentence, line = sentence) => /\bverif/i.test(line) && [...sentence.matchAll(CHECK_VERB)].some((m) => {
    if (/\b(?:not|never|nor|n't|cannot|can't|without)\s+(?:\w+\s+)?$/i.test(sentence.slice(Math.max(0, m.index - 24), m.index))) return false; // a negated verb
    const after = sentence.slice(m.index + m[0].length);
    const stop = STOPS.exec(after);
    return NOT_CHECKED_STEM.test(stop ? after.slice(0, stop.index) : after);
  });
  const claimsUncheckedClass = (raw) => { const line = raw.replace(/\*+/g, ''); return line.split(/(?<=[.!?])\s+/).some((s) => listsUncheckedAsChecked(s, line)); };
  for (const bad of ['`sigmap verify` checks the files, imports, member calls and npm scripts an AI answer names.', 'verify_suggestion checks library APIs against the installed packages.', '`sigmap verify` confirms calls in fenced or raw code exist.', 'Run `sigmap verify`. It deterministically checks the suggestion and its member calls.', 'verify: a snippet is grounded; checks member calls too.']) assert.ok(claimsUncheckedClass(bad), `control: the rule must flag: ${bad}`);
  for (const ok of ['`sigmap verify` checks the files and imports, and its footer says what it did not check, among them member calls and library APIs.', 'verify does **not** check member calls.', 'It is a name-level linter: it does not check member calls, calls in raw code, or whether a library API exists.']) assert.ok(!claimsUncheckedClass(ok), `control: the rule must pass: ${ok}`);
  const unchecked = [];
  for (const d of docs().filter((x) => !/llms-full\.txt$/.test(x.rel))) d.text.split('\n').forEach((l, i) => { if (claimsUncheckedClass(l)) unchecked.push(`${d.rel}:${i + 1}: ${l.trim().slice(0, 120)}`); });
  assert.deepStrictEqual(unchecked, [], 'a sentence lists, among what verify checks, a class the footer of `sigmap verify` says it does not check');
  assert.ok(!OVERCLAIM.test(json('package.json').description), `package.json description over-claims what verify flags: ${json('package.json').description}`);
  assert.ok(json('package.json').description.length <= 255, 'npm cuts a description at 255 characters');
  const line = linesMatching(/`sigmap verify` checks/).find((h) => h.where.startsWith('README.md'));
  assert.ok(line, 'the README states what `sigmap verify` checks');
  assert.ok(line.line.includes('member calls') && line.line.includes('library APIs') && /raw code/.test(line.line) && /fenced/.test(line.line), 'the README line must name what the footer says verify skips: member calls, library APIs, and whether a call in raw code or a fenced block exists');
  assert.ok(/named imports from, and members of, installed libraries/.test(line.line), 'and say which library claims it skips, as the footer does');
  // arity checks run for the languages the arity module reads
  const { EXACT_PARAM_EXTS } = require(path.join(ROOT, 'src', 'verify', 'arity.js'));
  const limits = readRel('KNOWN_LIMITATIONS.md').split('\n').find((l) => /arity checks/.test(l));
  assert.ok(limits, 'KNOWN_LIMITATIONS.md describes the arity checks');
  for (const [ext, name] of [['.ts', 'JS/TS'], ['.py', 'Python'], ['.go', 'Go']]) assert.ok(!EXACT_PARAM_EXTS.has(ext) || limits.includes(name), `arity checks read ${ext} files, so KNOWN_LIMITATIONS.md must name ${name}`);
});

// ---------------------------------------------------------------------------
// 15. Routing: no measured saving exists, and the worked example is the arithmetic of the prices (src/config/models.js) it sits under.
test('15. no page promises a saving from model routing, and the worked example is the arithmetic of the prices it sits under', () => {
  const PROMISE = /\b40\s*(?:%|percent)?\s*(?:[–—-]|to|and)\s*80\s*(?:%|percent)|\bup to 80\s*(?:%|percent)|\b(?:cuts?|saves?|saving|reduces?)\b[^.|]{0,40}\b\d{2,3}\s*(?:%|percent)?\s*[–—-]?\s*(?:\d{2,3}\s*)?(?:%|percent)|\bhalves? (?:the|your) (?:bill|cost|spend)/i;
  // judged per sentence: the disclaimer that sits on the same (long) line as a promise must not excuse it
  const NOT_A_PROMISE = /\b(?:earlier|used to|previously|formerly|no measurement|not a measurement)\b/i;
  const promised = (line) => line.split(/(?<=[.!?])\s+/).some((s) => PROMISE.test(s) && !NOT_A_PROMISE.test(s));
  const hits = linesMatching(PROMISE).filter((h) => (/routing|model tier|\btiers?\b/i.test(h.line) || h.where.includes('MODEL_ROUTING')) && !/\*\*~?\d+%\*\*/.test(h.line) && promised(h.line));
  assert.deepStrictEqual(hits.map((h) => h.where), [], `no measurement stands behind a routing saving:\n${where(hits)}`);
  assert.ok(promised('Applying this guide typically saves 50-70% of API spend on a mixed workload. This guide suggests a tier; the example is not a measurement.') && !promised('Routing used to be said to cut cost 40-80%; no measurement stands behind it.'), 'control: a disclaimer in another sentence of the same line does not excuse a promise, and one in its own sentence does');
  assert.ok(PROMISE.test('Routing by tier cuts cost 40-70% on a mixed workload.') && PROMISE.test('Applying this guide cuts API costs by 40 to 80 percent.') && PROMISE.test('Model routing saves roughly 60% of your API spend.') && !PROMISE.test('The example costs $0.80 against $0.18.'), 'control: the rule reads the promise in other words and not the example');
  const text = readRel('docs/readmes/MODEL_ROUTING.md');
  // the prices: the doc's table equals the ranges src/config/models.js computes per tier
  const models = require(path.join(ROOT, 'src', 'config', 'models.js'));
  const profile = models.resolveProfile({});
  const docRange = (tier) => { const m = text.match(new RegExp(`^\\| \`${tier}\` .*?\\$([\\d.]+)–\\$([\\d.]+) / MTok \\|`, 'm')); assert.ok(m, `the ${tier} row of the price table`); return { min: Number(m[1]), max: Number(m[2]) }; };
  for (const tier of ['fast', 'balanced', 'powerful']) assert.deepStrictEqual(docRange(tier), models.tierPriceRange(profile, tier), `the ${tier} price range of the table is what src/config/models.js computes`);
  // the example: the turns and tokens in ITS OWN rows, priced at the top of each range
  const row = (label) => { const m = text.match(new RegExp(`^\\| ${label} \\| ([^|]+) \\| ([\\d,]+)(?: each)? \\| \\*\\*\\$([\\d.]+)\\*\\* \\|`, 'm')); assert.ok(m, `the "${label}" row of the example`); return { turns: m[1].trim(), tokens: Number(m[2].replace(/,/g, '')), cost: m[3] }; };
  const powerful = docRange('powerful').max; const balanced = docRange('balanced').max; const fast = docRange('fast').max;
  const all = row('All powerful'); const mixed = row('Mixed routing');
  const allCost = (Number(all.turns) * all.tokens * powerful) / 1e6;
  const mix = mixed.turns.match(/(\d+) fast \+ (\d+) balanced \+ (\d+) powerful/);
  assert.ok(mix, 'the mixed row names its turns');
  const mixedCost = ((Number(mix[1]) * fast + Number(mix[2]) * balanced + Number(mix[3]) * powerful) * mixed.tokens) / 1e6;
  assert.deepStrictEqual([all.cost, mixed.cost], [allCost.toFixed(2), mixedCost.toFixed(2)], 'the example costs follow from its own turns, tokens and the top price of each tier');
  assert.ok(text.includes(`**~${Math.round(100 * (1 - mixedCost / allCost))}%**`), 'and so does the saving between them');
});

// ---------------------------------------------------------------------------
// 16. get_method_impact (and --callers): calls through a receiver are resolved only in Java, so the result is incomplete and is said to be.
const TRIGGER = /get_method_impact|--callers <(?:symbol|name)>/;
// a claim about what the call graph returns; a list of tool names that says "exactly those" (the `mcp.tools` row of config.md) is not one
const CLAIM = /\bprove|blast radius|transitively|every function that|every caller|all callers|\bexact(?:ly)? (?:the |which |all )?(?:callers?|call sites?|functions?|methods?)\b/i;
const HEDGE = /lower bound|\bapproximate\b|incomplete|only in Java|not resolved|nothing depends on this|not found in the call-graph/i;
const describesBlastRadius = (line, next = '') => TRIGGER.test(line) && CLAIM.test(`${line} ${next}`);
const isBareBlastRadiusClaim = (line, next = '') => describesBlastRadius(line, next) && !HEDGE.test(`${line} ${next}`);

test('16. the rule that finds an unhedged blast-radius claim flags the bare claims and passes the hedged ones and a list of tool names (controls)', () => {
  for (const bad of [
    '`get_method_impact` returns every function that transitively calls the symbol.',
    '`--callers <symbol>` prints the method-level blast radius.',
    '`get_method_impact` finds exactly the callers of a function.',
    '`get_method_impact` lists exact call sites for a method.',
    '`get_method_impact` proves nothing else depends on it.',
    'Use `get_method_impact` for all callers of a symbol.',
  ]) assert.ok(isBareBlastRadiusClaim(bad), `the rule must flag: ${bad}`);
  for (const ok of [
    '`get_method_impact` returns every function that calls the symbol; the list is incomplete.',
    '`get_method_impact` finds the blast radius, and a call through a receiver is resolved only in Java.',
    'A list of tool names advertises exactly those; `core` is `query_context`, `get_impact`, `get_method_impact` and four more.',
  ]) assert.ok(!isBareBlastRadiusClaim(ok), `the rule must pass: ${ok}`);
  assert.ok(isBareBlastRadiusClaim('`get_method_impact` lists every caller.', 'It is exact.') && !isBareBlastRadiusClaim('`get_method_impact` lists every caller.', 'The list is incomplete.'), 'the next line is part of the window');
});

test('16. the pages that describe the method-level blast radius say it is incomplete where they describe it, and say why', () => {
  const scope = (rel) => !/llms-full\.txt$/.test(rel); // every page that is not generated from src/ help text
  const seen = new Set(); const bare = []; let described = 0;
  for (const d of docs().filter((x) => scope(x.rel))) {
    const ls = d.text.split('\n');
    ls.forEach((line, i) => {
      const next = ls[i + 1] || '';
      if (!describesBlastRadius(line, next)) return;
      described++;
      if (isBareBlastRadiusClaim(line, next) && !seen.has(`${d.rel}:${i + 1}`)) { seen.add(`${d.rel}:${i + 1}`); bare.push(`${d.rel}:${i + 1}: ${line.trim().slice(0, 120)}`); }
    });
  }
  assert.ok(described >= 5, `control: the pages describe the blast radius in several places, found ${described}`);
  assert.deepStrictEqual(bare, [], `a call through a receiver is resolved only in Java (docs-vp/guide/callgraph-accuracy.md), so the result is incomplete:\n${bare.join('\n')}`);
  // the receiver claim and the false-positive caveat, pinned where they are made
  const live = linesMatching(/ground the symbols, lines and calls they can resolve/).find((h) => h.where.startsWith('README.md'));
  assert.ok(live && /only in Java, and only in part there/.test(live.line), 'the README live-loop sentence says a receiver call is resolved only in Java, and only in part there');
  const row = linesMatching(/What breaks if I change this\?/).find((h) => h.where.startsWith('docs-vp/guide/mcp.md'));
  assert.ok(row && /only in Java, and only in part there/.test(row.line) && /does not call the symbol/.test(row.line), 'the MCP guide row says it too, and that a function that does not call the symbol can be listed');
  const nope = linesMatching(/resolved with high precision/);
  assert.deepStrictEqual(nope.map((h) => h.where), [], `precision is measured per language (docs-vp/guide/callgraph-accuracy.md):\n${where(nope)}`);
});

// ---------------------------------------------------------------------------
// 17. A page that quotes the size of a tool's definitions says which counter it read. Two bases are in use and they differ by a third or
// more: `sigmap doctor` and `advise` print chars/4 ESTIMATES (278, 953, 2,561 for locate, core, all), and the API's own counter read
// 426 and 1,505 for locate and core (the study's figures). The protocol page is a pre-registration, left as written.
// What this cannot see: a figure whose profile word sits in another paragraph, a wrong figure that is labeled (18 pins the values), and a
// block that names both counters (it cannot tell which figure carries which label).
const SIZE_PROFILE = /\bcore\b|\blocate\b|all 22|22 tools|seven tools|two tools/i;
const SIZE_ESTIMATE_EXACT = /\b(?:278|953|2,?561)\b/;
const SIZE_K = /\b\d(?:\.\d)?k\b/i;
const SIZE_COUNTED = /\b(?:426|1,?505)\b/;
const NAMES_ESTIMATE = /chars\/4/i;
const NAMES_COUNTER = /API'?s? (?:own )?(?:token )?counter|API counter/i;
const unlabeledSizes = (text) => text.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\b\d(?:\.\d)?k\s*\(\s*\d[\d,]*\s*\)/g, ' ').split(/\n\s*\n/).filter((block) => {
  const sentences = block.replace(/\n(?!\s*[-*|])/g, ' ').split(/(?<=[.;])\s+|\n/);
  const about = (re) => sentences.some((s) => re.test(s) && SIZE_PROFILE.test(s) && /token|definition/i.test(block));
  const chars4 = NAMES_ESTIMATE.test(block); const api = NAMES_COUNTER.test(block);
  return (about(SIZE_ESTIMATE_EXACT) && !chars4) || (about(SIZE_COUNTED) && !api) || (about(SIZE_K) && !chars4 && !api);
});

test('17. the rule that finds an unlabeled tool-definition size flags the bad paragraphs and passes the labeled ones (controls)', () => {
  assert.strictEqual(unlabeledSizes('`core` is seven tools for about 0.9k tokens of definitions where all 22 cost about 2.5k.').length, 1);
  assert.strictEqual(unlabeledSizes('`locate` cuts the tool definitions from 1,505 tokens to 426 on every turn.').length, 1);
  assert.strictEqual(unlabeledSizes('The `locate` profile advertises two tools,\nabout 0.3k tokens of definitions.').length, 1, 'a profile word on the previous hard-wrapped line still counts');
  assert.strictEqual(unlabeledSizes('`core` advertises seven tools for about 1.0k tokens of definitions.').length, 1);
  assert.strictEqual(unlabeledSizes('`core` weighs 953 tokens of definitions, `locate` 278 (the API\'s own counter).').length, 1, 'an exact estimate carrying the other basis\'s label is flagged');
  assert.strictEqual(unlabeledSizes('`core` is about 0.9k tokens of definitions (a chars/4 estimate).').length, 0);
  assert.strictEqual(unlabeledSizes('`locate` cuts the tool definitions from 1,505 tokens to 426 on every turn, on the API\'s token counter.').length, 0);
  assert.strictEqual(unlabeledSizes('On the API\'s own counter `locate` is about 0.4k tokens of definitions and `core` about 1.5k.').length, 0, 'k-figures under the API-counter label are not mistaken for estimates');
  assert.strictEqual(unlabeledSizes('```\ntools, locate profile      278   (2 tools)\n```').length, 0, 'a fenced sample of tool output is not prose');
  assert.strictEqual(unlabeledSizes('The pooled estimate for `core` is -4% [-7%, -2%], and the placebo cost 5k.').length, 0, 'a statistical estimate is not a token count');
});

test('17. every tool-definition size a page quotes says whether it is a chars/4 estimate or the API\'s own count', () => {
  const bad = [];
  for (const d of docs()) {
    if (d.rel.endsWith('agent-study-protocol.md')) continue;
    for (const block of unlabeledSizes(d.text)) bad.push(`${d.rel}: ${block.replace(/\s+/g, ' ').trim().slice(0, 130)}`);
  }
  assert.deepStrictEqual(bad, [], `name the counter next to the figure (278 / 953 / 2,561 are chars/4 estimates; 426 / 1,505 are the API's counter):\n${bad.join('\n')}`);
});

// ---------------------------------------------------------------------------
// 18. The quoted values are the code's: the tool counts and the chars/4 sizes come from the profiles themselves.
test('18. the tool counts and the chars/4 sizes the pages quote are what src/mcp/profile.js computes', () => {
  const { resolveProfile } = require(path.join(ROOT, 'src', 'mcp', 'profile.js'));
  const p = Object.fromEntries(['locate', 'core', 'all'].map((n) => [n, resolveProfile({ mcp: { tools: n } })]));
  assert.deepStrictEqual([p.locate.names.length, p.core.names.length, p.all.names.length], [2, 7, 22], 'two, seven and 22 tools');
  const word = { 2: 'two', 7: 'seven', 22: '22' };
  const k = (n) => `${(n / 1000).toFixed(1)}k`;
  const [kAll, kCore, kLocate] = [k(p.all.tokens), k(p.core.tokens), k(p.locate.tokens)];
  for (const rel of ['README.md', 'docs/readmes/GETTING_STARTED.md']) {
    const t = readRel(rel);
    assert.ok(t.includes(`about ${kCore} tokens`) && t.includes(`about ${kLocate} (all 22: about ${kAll})`), `${rel} must quote the chars/4 sizes of core, locate and all 22 (${kCore}, ${kLocate}, ${kAll}) as resolveProfile computes them`);
    assert.ok(t.includes(`\`"core"\` is ${word[p.core.names.length]}`), `${rel} must say core is ${word[p.core.names.length]} tools`);
    assert.ok(t.includes(`\`"locate"\` is ${word[p.locate.names.length]}`) || t.includes(`${word[p.locate.names.length]} tools, \`query_context\` and \`get_lines\``), `${rel} must say locate is ${word[p.locate.names.length]} tools`);
  }
  const table = readRel('docs-vp/guide/mcp.md');
  assert.ok(table.includes(`| ~${kAll} |`) && table.includes(`| ~${kCore} |`) && table.includes(`| ~${kLocate} |`), `the profile table of the MCP guide must show ~${kAll}, ~${kCore} and ~${kLocate}`);
  assert.ok(table.includes(`about ${kAll} tokens for all 22`), 'and the paragraph above it');
  // the hand-kept samples that print these numbers
  const cli = readRel('docs-vp/guide/cli.md');
  const num = (n) => n.toLocaleString('en-US');
  assert.ok(cli.includes(`all (22 tools, ~${num(p.all.tokens)} tokens of definitions) · "mcp.tools": "core" would advertise 7 tools, ~${num(p.core.tokens)} tokens; "locate" 2 tools, ~${num(p.locate.tokens)} tokens`), 'the sample `doctor` line in cli.md must show what doctor prints');
  assert.ok(cli.includes(`tools, locate profile      ${num(p.locate.tokens)}`) && cli.includes(`tools, core profile        ${num(p.core.tokens)}`) && cli.includes(`tools, all               ${num(p.all.tokens)}`), 'the sample `advise` block in cli.md must show what advise prints');
  // the MCP guide's note on `core`: read_context(module=...) reads signatures under `full`, and returns the map only under `index` (what `sigmap --init` writes)
  const readModule = (strategy) => withProject({ 'src/auth/login.js': 'function hashPassword(password, salt) { return password + salt; }\nmodule.exports = { hashPassword };\n', 'gen-context.config.json': `${JSON.stringify({ srcDirs: ['src'], outputs: ['copilot'], strategy, mcp: { tools: 'core' } })}\n` }, (ctx) => { ctx.sigmap(); return ctx.mcp('read_context', { module: 'src/auth' }); }); // read_context reads the copilot file
  assert.ok(readModule('full').includes('function hashPassword(password, salt)'), 'control: under strategy full, read_context(module=...) returns the module\'s signatures');
  assert.ok(!readModule('index').includes('hashPassword'), 'under strategy index read_context(module=...) returns no signatures');
  assert.ok(/read_context\(module=\.\.\.\)`[^.]{0,120}under `index`[^.]{0,80}no signatures/.test(table), 'and the MCP guide says so where it points an agent at read_context(module=...)');
});

// ---------------------------------------------------------------------------
// 19. Links to the tool-profile section and the live-loop section use the headings' real slugs (they were renamed, and 12 links kept the old one).
test('19. every link to the MCP guide\'s tool-profile and live-loop sections uses the heading\'s slug', () => {
  const slug = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  const headings = readRel('docs-vp/guide/mcp.md').split('\n').filter((l) => /^#{2,4}\s/.test(l)).map((l) => slug(l.replace(/^#+\s+/, '')));
  const profiles = headings.find((h) => h.startsWith('tool-profiles'));
  const loop = headings.find((h) => h.startsWith('your-agent'));
  assert.ok(profiles && loop, `control: the MCP guide has a "Tool profiles" and a "Your agent's live loop" heading (${headings.filter((h) => /profiles|agent/.test(h)).join(', ')})`);
  const links = linesMatching(/#tool-profiles[a-z-]*/);
  assert.ok(links.length >= 10, `control: many pages link to it, found ${links.length}`);
  const bad = links.filter((h) => [...h.line.matchAll(/#(tool-profiles[a-z-]*)/g)].some((m) => m[1] !== profiles));
  assert.deepStrictEqual(bad.map((h) => h.where), [], `the heading's slug is #${profiles}:\n${where(bad)}`);
  const loopLinks = linesMatching(/#your-agent[a-z-]*/);
  assert.ok(loopLinks.length >= 1, 'control: a page links to the live-loop section');
  const badLoop = loopLinks.filter((h) => [...h.line.matchAll(/#(your-agent[a-z-]*)/g)].some((m) => m[1] !== loop));
  assert.deepStrictEqual(badLoop.map((h) => h.where), [], `the heading's slug is #${loop}:\n${where(badLoop)}`);
});

console.log(`\npublished-claims: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
