'use strict';

/**
 * Warm cache, honest first-run summary (#971).
 *
 * A second `sigmap` run with nothing changed cost as much as the first (warm 7.5 s against
 * cold 7.3 s on Django), and the first run graded a complete retrieval index "D (6%)" because
 * the budgeted context file held 181 of 3,014 files. Pinned here:
 *
 *   - Equivalence. A run that reads the cache writes what a run that does not write: the context
 *     file and the retrieval index, byte for byte (clock stamps aside), cold, warm, and after one
 *     file changed. A cache that is fast and wrong is worse than none.
 *   - It is a cache. A warm run extracts nothing, and a file whose size and modification time are
 *     unchanged is not read at all. A file edited within the same clock tick at the same size IS
 *     read (the racy rule), so a quick edit is never missed.
 *   - Invalidation. A change to an extractor, to the generator, to the Python interpreter, to the
 *     imports setting, a rename, a deletion, a corrupt or foreign cache file: each costs the
 *     re-extraction it should and no more, and the output still equals a run without the cache.
 *   - Git. `## recent changes` is kept per range and never outlives its commits: a new commit, a
 *     branch switch and a shallow clone all write what an uncached run writes.
 *   - The run summary names two populations (indexed, in context) and grades neither by the other.
 *
 * Run: node test/integration/warm-cache.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'gen-context.js');
const xc = require(path.join(ROOT, 'src/cache/extract-cache.js'));
const dirListing = require(path.join(ROOT, 'src/util/dir-listing.js'));
const { _walkNames } = require(path.join(ROOT, 'src/discovery/framework-detector.js'));
const { DEFAULTS } = require(path.join(ROOT, 'src/config/defaults.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; } catch (e) { console.log(`  FAIL  ${name}\n        ${e.stack.split('\n').slice(0, 4).join('\n        ')}`); failed++; }
}
const tmpDirs = [];
const mk = (prefix) => { const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))); tmpDirs.push(d); return d; };

// ── fixtures ──────────────────────────────────────────────────────────────────

// No python3 at all: a PATH holding only node and git, so every machine takes the regex tier. (A python3 that
// is there but fails is a different situation, tested on its own: its answers are not kept.)
const NOPY = mk('sigmap-warm-nopy-');
const whichGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
fs.symlinkSync(process.execPath, path.join(NOPY, 'node'));
fs.symlinkSync(whichGit, path.join(NOPY, 'git'));
const ENV_NO_PYTHON = Object.assign({}, process.env, { PATH: NOPY });
const HAVE_PYTHON = spawnSync('python3', ['--version']).status === 0;

const FILES = {
  'src/app.js': '/** The app: routes and the router. */\nfunction app(req, res) { return res; }\nclass Router { route(path) { return path; } }\nmodule.exports = { app, Router };\n',
  'src/util.ts': 'export function util(a: number): number { return a + 1; }\nexport interface Opts { n: number }\n',
  'src/service.py': 'import os\n\nclass Service:\n    def run(self, n):\n        """Run the service."""\n        # TODO: handle errors\n        return n\n\ndef helper(x):\n    return x\n',
  'src/main.go': 'package main\n\nfunc Main() int { return 1 }\n\ntype Server struct{}\n',
  'tests/test_app.py': 'def test_app():\n    assert True\n',
  'README.md': '# fixture\n',
};

const GIT_ENV = Object.assign({}, process.env, {
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
});
const git = (dir, args) => spawnSync('git', ['-C', dir, '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', env: GIT_ENV });
function commit(dir, msg) {
  git(dir, ['add', '-A']);
  const r = git(dir, ['commit', '-q', '-m', msg]);
  assert.strictEqual(r.status, 0, r.stderr);
}

function project(files = FILES, config = {}) {
  const dir = mk('sigmap-warm-');
  git(dir, ['init', '-q', '-b', 'main']);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  setConfig(dir, config);
  return dir;
}
function setConfig(dir, config) {
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(Object.assign({ srcDirs: ['src'] }, config)));
}
let lastSummary = '';
/** One run with --verbose; returns the exit state and what the cache did. */
function run(dir, opts = {}) {
  const r = spawnSync(process.execPath, [opts.cli || CLI, '--verbose'], { cwd: dir, encoding: 'utf8', env: opts.env || ENV_NO_PYTHON });
  assert.strictEqual(r.status, 0, r.stderr);
  const m = /extraction cache: (\d+) hit\(s\), (\d+) extracted \((\d+) entries loaded\)/.exec(r.stderr);
  lastSummary = r.stderr.split('\n').filter((l) => /^ (Files scanned|Symbols found|Token reduction|Indexed|In context)/.test(l)).join('\n');
  return { stderr: r.stderr, hits: m ? Number(m[1]) : null, extracted: m ? Number(m[2]) : null, entries: m ? Number(m[3]) : null };
}
/** What a run wrote, with the clock taken out. */
function outputs(dir) {
  const ctx = fs.readFileSync(path.join(dir, '.github/copilot-instructions.md'), 'utf8').split('\n').filter((l) => !/Updated:/.test(l)).join('\n');
  const idx = JSON.parse(fs.readFileSync(path.join(dir, '.context/sig-index.json'), 'utf8'));
  delete idx.generated; delete idx.startedAt;
  return { ctx, idx: JSON.stringify(idx), sum: lastSummary };
}
function assertSame(a, b, what) {
  assert.ok(a.ctx === b.ctx, `${what}: the context file differs`);
  assert.ok(a.idx === b.idx, `${what}: the retrieval index differs`);
  // The run summary too: token counts, file counts and the two coverage lines come from the cached facts.
  assert.strictEqual(a.sum, b.sum, `${what}: the run summary differs`);
}
/** The same tree through a run that does not touch the cache. */
function reference(dir, config = {}, env) {
  const cacheFile = path.join(dir, '.context/extract-cache.json');
  const held = fs.existsSync(cacheFile) ? fs.readFileSync(cacheFile) : null;
  setConfig(dir, Object.assign({}, config, { extractCache: false }));
  run(dir, { env });
  const out = outputs(dir);
  setConfig(dir, config);
  // A cache-off run leaves the cache file as it found it.
  if (held) assert.ok(held.equals(fs.readFileSync(cacheFile)), 'a cache-off run changed the cache file');
  return out;
}
/** Preload that logs fs.readFileSync of fixture sources, fs.readdirSync paths and git spawns to a file. */
function probe(dir) {
  const base = mk('sigmap-warm-pre-');
  const file = path.join(base, 'probe.js');
  const log = path.join(base, 'probe.log');
  fs.writeFileSync(file, `
const fs = require('fs'), cp = require('child_process');
const dir = ${JSON.stringify(dir)}, log = ${JSON.stringify(log)};
const put = (l) => { try { fs.appendFileSync(log, l + '\\n'); } catch (_) {} };
const rf = fs.readFileSync;
fs.readFileSync = function (p, ...a) { if (typeof p === 'string' && p.startsWith(dir) && /[\\\\/](src|tests)[\\\\/][^\\\\/]+\\.(js|ts|py|go)$/.test(p)) put('read ' + p); return rf.call(this, p, ...a); };
const rd = fs.readdirSync;
fs.readdirSync = function (p, ...a) { if (typeof p === 'string' && p.startsWith(dir)) put('list ' + p); return rd.call(this, p, ...a); };
for (const k of ['execFileSync', 'spawnSync']) { const f = cp[k]; cp[k] = function (c, args, ...r) { if (c === 'git') put('git ' + (args || []).join(' ')); return f.call(this, c, args, ...r); }; }
`);
  return {
    env: (env) => Object.assign({}, env, { NODE_OPTIONS: `--require=${file}` }),
    lines: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []),
    reset: () => fs.rmSync(log, { force: true }),
  };
}
const cacheOfFile = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const cacheOf = (dir) => cacheOfFile(path.join(dir, '.context/extract-cache.json'));
const hourAgo = () => new Date(Date.now() - 3600 * 1000);
function backdate(dir) {
  const t = hourAgo();
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === '.git' || e.name === '.context') continue; const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else fs.utimesSync(f, t, t); } };
  walk(dir);
}
/** The generator and its sources, copied, so a test may change an extractor. */
function copyCode() {
  const dir = mk('sigmap-warm-code-');
  fs.copyFileSync(CLI, path.join(dir, 'gen-context.js'));
  fs.cpSync(path.join(ROOT, 'src'), path.join(dir, 'src'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'packages'), path.join(dir, 'packages'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'));
  return path.join(dir, 'gen-context.js');
}

// ── equivalence ───────────────────────────────────────────────────────────────

test('cold, warm and a run without the cache write the same context file and index', () => {
  const dir = project();
  backdate(dir);
  const off = reference(dir);
  const cold = run(dir);
  assert.strictEqual(cold.hits, 0, 'the first run starts empty');
  assert.ok(cold.extracted > 0);
  assertSame(outputs(dir), off, 'cold');
  const warm = run(dir);
  assert.strictEqual(warm.extracted, 0, `a warm run extracts nothing: ${warm.stderr}`);
  assert.ok(warm.hits > 0);
  assertSame(outputs(dir), off, 'warm');
  assertSame(outputs(dir), (run(dir), outputs(dir)), 'warm again');
});

test('one changed file: the rest is served from the cache and the output equals an uncached run', () => {
  const dir = project();
  backdate(dir);
  run(dir);
  fs.appendFileSync(path.join(dir, 'src/service.py'), 'def added(a):\n    return a\n');
  const warm = run(dir);
  assert.strictEqual(warm.extracted, 1, `only the changed file is extracted: ${warm.stderr}`);
  assertSame(outputs(dir), reference(dir), 'one changed file');
  assert.ok(/def added/.test(outputs(dir).idx), 'the new function is in the index');
});

if (HAVE_PYTHON) {
  test('with python3 on PATH the warm header keeps the toolchain a cold run names', () => {
    const dir = project();
    backdate(dir);
    run(dir, { env: process.env });
    const cold = outputs(dir);
    run(dir, { env: process.env });
    assertSame(outputs(dir), cold, 'warm vs cold with python3');
    assertSame(cold, reference(dir, {}, process.env), 'cold with python3 vs no cache');
    assert.ok(/toolchain=python@\d/.test(cold.ctx), 'the AST tier names itself in the header');
  });
}

// ── it is a cache ─────────────────────────────────────────────────────────────

/**
 * A dozen files with the same symbols, six of them spread over many lines (named so they sort first), so a
 * tight budget has to choose by signal per line: with the right line counts the dense ones win, and with
 * equal ones the alphabet would.
 */
function crowded() {
  const files = {};
  for (let i = 0; i < 6; i++) {
    const fns = Array.from({ length: 6 }, (_, j) => `function f${i}x${j}(a, b) { return a + b + ${j}; }\n`);
    files[`src/a${i}.js`] = fns.join('// filler line\n'.repeat(8));
    files[`src/z${i}.js`] = fns.join('');
  }
  return files;
}

test('a file whose size and modification time are unchanged is not read by a warm run', () => {
  for (const [label, files, config] of [['a small project', FILES, {}], ['a project over its budget', crowded(), { maxTokens: 750, autoMaxTokens: false }]]) {
    const dir = project(files, config);
    backdate(dir);
    const pr = probe(dir);
    const env = pr.env(ENV_NO_PYTHON);
    run(dir, { env });
    const coldReads = pr.lines().filter((l) => l.startsWith('read '));
    assert.ok(coldReads.length >= 4, `${label}: the probe sees the cold run read the sources: ${coldReads.length}`);
    pr.reset();
    run(dir, { env });
    const warmReads = pr.lines().filter((l) => l.startsWith('read '));
    assert.deepStrictEqual(warmReads, [], `${label}: a warm run read: ${warmReads.join(', ')}`);
  }
});

test('a tight budget keeps the same files cold, warm and with no cache (line counts and token counts come from the cache)', () => {
  const dir = project(crowded(), { maxTokens: 750, autoMaxTokens: false });
  backdate(dir); // equal modification times: the budget then orders by signal per line
  const off = reference(dir, { maxTokens: 750, autoMaxTokens: false });
  run(dir);
  const cold = outputs(dir);
  run(dir);
  const warm = outputs(dir);
  assertSame(cold, off, 'cold, tight budget');
  assertSame(warm, off, 'warm, tight budget');
  assert.ok(/Token reduction: \d+%/.test(warm.sum), warm.sum);
  const kept = (warm.ctx.match(/^### src\/[az]\d\.js/gm) || []).length;
  assert.ok(kept > 0 && kept < 12, `the budget kept ${kept} of 12 files: the fixture must make the budget choose`);
});

test('a file edited within the same clock tick at the same size is not missed (the racy rule)', () => {
  const dir = project({ 'src/a.js': 'function aaa() {}\n', 'src/b.js': 'function bbb() {}\n' });
  const t = new Date(Date.now() - 600000);
  const file = path.join(dir, 'src/a.js');
  fs.utimesSync(file, t, t);
  run(dir);
  // Say the cache entry was written 1 s after the file's modification time, however long the run took:
  // an edit now, at the same size, with the same time restored, is exactly the case the margin exists for.
  const cacheFile = path.join(dir, '.context/extract-cache.json');
  const c = cacheOfFile(cacheFile);
  for (const e of Object.values(c.files)) if (e.m) e.w = e.m + 1000;
  fs.writeFileSync(cacheFile, JSON.stringify(c));
  fs.writeFileSync(file, 'function ccc() {}\n'); // same size
  fs.utimesSync(file, t, t); // same modification time
  assert.strictEqual(fs.statSync(file).size, 'function aaa() {}\n'.length);
  const second = run(dir);
  const out = outputs(dir);
  assert.ok(/function ccc/.test(out.idx) && !/function aaa/.test(out.idx), `the edit was missed: ${out.idx}`);
  assert.strictEqual(second.extracted, 1, second.stderr);
});

test('an entry is trusted by its stat only when the file is older than the entry by the racy margin', () => {
  const fp = 'f'.repeat(40);
  const dir = mk('sigmap-warm-unit-');
  const c = xc.open(dir, fp);
  const written = Date.now();
  c.set('a.js', 'h', { s: ['f()'], l: 1 }, { size: 3, mtimeMs: written - 10000 });
  c.set('b.js', 'h', { s: ['f()'], l: 1 }, { size: 3, mtimeMs: written - 100 });
  assert.ok(c.save());
  const d = xc.open(dir, fp);
  assert.ok(d.peek('a.js', { size: 3, mtimeMs: written - 10000 }), 'older than the margin: trusted');
  assert.strictEqual(d.peek('a.js', { size: 4, mtimeMs: written - 10000 }), undefined, 'size moved');
  assert.strictEqual(d.peek('a.js', { size: 3, mtimeMs: written - 9000 }), undefined, 'time moved');
  assert.strictEqual(d.peek('b.js', { size: 3, mtimeMs: written - 100 }), undefined, 'within the margin of the write: read it');
  assert.strictEqual(d.peek('c.js', { size: 3, mtimeMs: 1 }), undefined, 'unknown file');
});

test('the standalone bundle, with no src/ beside it, caches and writes the same output', () => {
  const lone = mk('sigmap-warm-lone-');
  fs.copyFileSync(CLI, path.join(lone, 'gen-context.js'));
  const script = path.join(lone, 'gen-context.js');
  const dir = project();
  backdate(dir);
  run(dir, { cli: script });
  const cold = outputs(dir);
  const warm = run(dir, { cli: script });
  assert.strictEqual(warm.extracted, 0, warm.stderr);
  assertSame(outputs(dir), cold, 'standalone warm vs cold');
  assertSame(cold, reference(dir), 'standalone cold vs the source tree without the cache');
});

test('an entry without the fact a consumer reads is not served by its stat', () => {
  const dir = mk('sigmap-warm-unit-');
  const fp = xc.fingerprint({ version: '1' });
  const c = xc.open(dir, fp);
  const old = Date.now() - 10000;
  c.set('a.js', 'h', { s: ['f()'] }, { size: 3, mtimeMs: old }); // signatures, no line count
  c.set('b.js', 'h', { s: ['f()'], l: 1, g: '' }, { size: 3, mtimeMs: old });
  c.save();
  const d = xc.open(dir, fp);
  assert.strictEqual(d.peek('a.js', { size: 3, mtimeMs: old }), undefined, 'no line count: read the file once and complete the entry');
  assert.ok(d.peek('b.js', { size: 3, mtimeMs: old }));
  assert.ok(d.peek('b.js', { size: 3, mtimeMs: old }, 'g'), 'an empty module-doc line is still a fact');
  assert.strictEqual(d.peek('a.js', { size: 3, mtimeMs: old }, 'g'), undefined);
  assert.ok(d.fresh('a.js', { size: 3, mtimeMs: old }), 'but the stat still says the signatures are good, which is all a prefetch asks');
});

// ── invalidation ──────────────────────────────────────────────────────────────

test('a changed extractor discards the cache; a changed generator does too', () => {
  const script = copyCode();
  const dir = project();
  backdate(dir);
  const env = ENV_NO_PYTHON;
  run(dir, { cli: script, env });
  assert.strictEqual(run(dir, { cli: script, env }).extracted, 0);
  fs.appendFileSync(path.join(path.dirname(script), 'src/extractors/generic.js'), '\n// changed\n');
  const afterExtractor = run(dir, { cli: script, env });
  assert.strictEqual(afterExtractor.hits, 0, `an extractor change must invalidate: ${afterExtractor.stderr}`);
  assert.strictEqual(run(dir, { cli: script, env }).extracted, 0, 'and the cache is rebuilt');
  fs.appendFileSync(script, '\n// changed\n');
  assert.strictEqual(run(dir, { cli: script, env }).hits, 0, 'a change to the generator itself must invalidate');
});

test('the imports setting changes what is derived, so it changes the key', () => {
  const dir = project();
  backdate(dir);
  run(dir);
  assert.strictEqual(run(dir).extracted, 0);
  setConfig(dir, { depMap: false });
  const afterDepMap = run(dir);
  assert.strictEqual(afterDepMap.hits, 0, afterDepMap.stderr);
  assertSame(outputs(dir), reference(dir, { depMap: false }), 'depMap off');
  assert.ok(!/service\.py ← /.test(outputs(dir).ctx), 'no imports are listed with depMap off');
});

test('a setting the cache does not depend on leaves it alone', () => {
  const dir = project();
  backdate(dir);
  run(dir);
  setConfig(dir, { maxSigsPerFile: 3 });
  const second = run(dir);
  assert.strictEqual(second.extracted, 0, `maxSigsPerFile is applied after extraction: ${second.stderr}`);
  assertSame(outputs(dir), reference(dir, { maxSigsPerFile: 3 }), 'maxSigsPerFile 3');
});

test('the extraction ceiling is part of the key: raising it past 1000 re-extracts', () => {
  const dir = project();
  backdate(dir);
  run(dir);
  setConfig(dir, { maxIndexSigsPerFile: 1500 });
  const raised = run(dir);
  assert.strictEqual(raised.hits, 0, `a longer extraction is a different list: ${raised.stderr}`);
  assertSame(outputs(dir), reference(dir, { maxIndexSigsPerFile: 1500 }), 'ceiling raised');
});

if (HAVE_PYTHON) {
  test('a different python3 (the AST tier against the regex tier) discards the cache', () => {
    const dir = project();
    backdate(dir);
    run(dir, { env: ENV_NO_PYTHON });
    assert.strictEqual(run(dir, { env: ENV_NO_PYTHON }).extracted, 0);
    const switched = run(dir, { env: process.env });
    assert.strictEqual(switched.hits, 0, switched.stderr);
    assertSame(outputs(dir), reference(dir, {}, process.env), 'after switching to python3');
  });
}

test('a renamed file and a deleted file leave the cache; the output follows', () => {
  const dir = project();
  backdate(dir);
  run(dir);
  assert.ok('src/util.ts' in cacheOf(dir).files);
  fs.renameSync(path.join(dir, 'src/util.ts'), path.join(dir, 'src/helpers.ts'));
  const renamed = run(dir);
  assert.strictEqual(renamed.extracted, 1, renamed.stderr);
  const files = cacheOf(dir).files;
  assert.ok('src/helpers.ts' in files && !('src/util.ts' in files), 'the old path is gone from the cache');
  assertSame(outputs(dir), reference(dir), 'after a rename');
  assert.ok(!/src\/util\.ts/.test(outputs(dir).idx) && /src\/helpers\.ts/.test(outputs(dir).idx));
  fs.rmSync(path.join(dir, 'src/helpers.ts'));
  const deleted = run(dir);
  assert.strictEqual(deleted.extracted, 0);
  assert.ok(!('src/helpers.ts' in cacheOf(dir).files));
  assertSame(outputs(dir), reference(dir), 'after a deletion');
});

test('a corrupt, foreign or truncated cache file is the same as none', () => {
  const dir = project();
  backdate(dir);
  run(dir);
  const file = path.join(dir, '.context/extract-cache.json');
  for (const bad of ['{not json', '', JSON.stringify({ schema: 1, fingerprint: 'x', files: {} }), JSON.stringify({ schema: xc.SCHEMA, fingerprint: 'other', files: { 'src/app.js': { s: ['evil()'] } } }), '[]', 'null']) {
    fs.writeFileSync(file, bad);
    const r = run(dir);
    assert.strictEqual(r.hits, 0, `served from a bad cache file ${JSON.stringify(bad.slice(0, 30))}: ${r.stderr}`);
    assert.ok(!/evil/.test(outputs(dir).idx));
    assert.strictEqual(cacheOf(dir).schema, xc.SCHEMA, 'and it is rewritten');
  }
  assertSame(outputs(dir), reference(dir), 'after bad cache files');
});

test('extractCache:false writes no cache file, and a tier whose answer is not in the file does not use one', () => {
  const off = project(FILES, { extractCache: false });
  run(off);
  assert.ok(!fs.existsSync(path.join(off, '.context/extract-cache.json')));
  for (const exactness of [{ typescript: true }, { lsp: true }, { scip: true }]) {
    const dir = project(FILES, { exactness });
    run(dir);
    assert.ok(!fs.existsSync(path.join(dir, '.context/extract-cache.json')), `exactness ${JSON.stringify(exactness)} must not be cached`);
  }
  assert.strictEqual(DEFAULTS.extractCache, true);
});

test('the cache lives in the self-ignoring .context directory', () => {
  const dir = project();
  run(dir);
  assert.ok(fs.existsSync(path.join(dir, '.context/.gitignore')));
  assert.ok(!/extract-cache/.test(git(dir, ['status', '--porcelain']).stdout), 'the cache file is not offered to git');
});

if (HAVE_PYTHON) {
  test('a python3 that is there and fails is not remembered: the next run asks again', () => {
    const realPy = spawnSync('sh', ['-c', 'command -v python3'], { encoding: 'utf8' }).stdout.trim();
    const shim = mk('sigmap-warm-flaky-');
    const flag = path.join(shim, 'broken');
    fs.writeFileSync(path.join(shim, 'python3'), `#!/bin/sh\nif [ -f ${JSON.stringify(flag)} ]; then exit 1; fi\nexec ${JSON.stringify(realPy)} "$@"\n`, { mode: 0o755 });
    const env = Object.assign({}, process.env, { PATH: shim + path.delimiter + process.env.PATH });
    const dir = project();
    backdate(dir);
    fs.writeFileSync(flag, '');
    run(dir, { env }); // python3 fails: the regex tier answers
    assert.ok(!('src/service.py' in cacheOf(dir).files), 'the regex tier\'s answer to a failure is not kept');
    assert.ok(!('t:tests/test_app.py' in cacheOf(dir).files), 'nor is a test file\'s');
    fs.rmSync(flag); // the same python3 file, now working
    const second = run(dir, { env });
    assert.ok(second.extracted >= 1, second.stderr);
    assertSame(outputs(dir), reference(dir, {}, env), 'after python3 recovered');
    assert.ok(/toolchain=python@\d/.test(outputs(dir).ctx), 'the AST tier names itself again');
    assert.ok('src/service.py' in cacheOf(dir).files, 'and its answer is kept');
  });

  test('what picks the Python a version-manager shim runs is part of the key', () => {
    const dir = project();
    backdate(dir);
    const env = (extra) => Object.assign({}, process.env, extra);
    run(dir, { env: env({ PYENV_VERSION: '3.8.0' }) });
    assert.strictEqual(run(dir, { env: env({ PYENV_VERSION: '3.8.0' }) }).extracted, 0, 'the same selection is a warm run');
    const switched = run(dir, { env: env({ PYENV_VERSION: '3.12.0' }) });
    assert.strictEqual(switched.hits, 0, `another selected version re-extracts: ${switched.stderr}`);
    run(dir, { env: env({ PYENV_VERSION: '3.12.0' }) });
    fs.writeFileSync(path.join(dir, '.python-version'), '3.11.1\n');
    assert.strictEqual(run(dir, { env: env({ PYENV_VERSION: '3.12.0' }) }).hits, 0, 'a .python-version file is part of the key too');
  });

  test('the toolchain header survives a warm run when Python only lives in the test roots', () => {
    const dir = project({ 'src/app.js': FILES['src/app.js'], 'tests/test_a.py': 'def test_a():\n    assert True\n' });
    backdate(dir);
    run(dir, { env: process.env });
    const cold = outputs(dir);
    assert.ok(/toolchain=python@\d/.test(cold.ctx), 'a cold run names the AST tier that served the test file');
    const warm = run(dir, { env: process.env });
    assert.strictEqual(warm.extracted, 0, warm.stderr);
    assertSame(outputs(dir), cold, 'warm, python only in tests');
    assertSame(outputs(dir), reference(dir, {}, process.env), 'against no cache');
  });
}

test('a credential never reaches the cache file, and the redaction notice is said on every run', () => {
  const secretFile = '// Connection helper. Uses key AKIAIOSFODNN7EXAMPLE for the region.\nfunction connect(token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789", region) { return token; }\nmodule.exports = { connect };\n';
  const dir = project({ 'src/conn.js': secretFile, 'src/ok.js': 'function fine() {}\n' });
  backdate(dir);
  const off = reference(dir);
  const cold = run(dir);
  const raw = fs.readFileSync(path.join(dir, '.context/extract-cache.json'), 'utf8');
  assert.ok(!/ghp_abcdefghijklmnop|AKIAIOSFODNN7EXAMPLE/.test(raw), 'the cache file holds a credential');
  assert.ok(/secrets redacted in src\/conn\.js/.test(cold.stderr), 'the cold run says it redacted');
  const warm = run(dir);
  assert.strictEqual(warm.extracted, 0);
  assert.ok(/secrets redacted in src\/conn\.js/.test(warm.stderr), `and so does a warm run: ${warm.stderr}`);
  assertSame(outputs(dir), off, 'redaction, warm vs no cache');
  assert.ok(!/ghp_abcdefghijklmnop|AKIAIOSFODNN7EXAMPLE/.test(outputs(dir).ctx + outputs(dir).idx));
  // The redaction message names the file by path: a repository moved after the first run gets its own path.
  const moved = mk('sigmap-warm-moved-');
  fs.rmSync(moved, { recursive: true, force: true });
  fs.cpSync(dir, moved, { recursive: true });
  run(moved);
  assert.ok(outputs(moved).ctx.includes(moved) && !outputs(moved).ctx.includes(dir), 'the cached redaction message follows the repository');
  // Switching the scanner off is a different answer, not a cached one.
  setConfig(dir, { secretScan: false });
  const unscanned = run(dir);
  assert.strictEqual(unscanned.hits, 0, unscanned.stderr);
  assertSame(outputs(dir), reference(dir, { secretScan: false }), 'secretScan off');
});

test('the summary does not claim a budgeted context file for the strategies that have none', () => {
  for (const strategy of ['index', 'per-module', 'hot-cold']) {
    const dir = project(crowded(), { strategy });
    const r = spawnSync(process.execPath, [CLI], { cwd: dir, encoding: 'utf8', env: ENV_NO_PYTHON });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(/ Indexed {8}: 12 of 12 files with symbols/.test(r.stderr), `${strategy}: ${r.stderr}`);
    assert.ok(!/ In context {5}: \d+ of \d+ source files/.test(r.stderr), `${strategy} prints a budgeted-file figure it does not have: ${r.stderr}`);
    if (strategy !== 'index') assert.ok(new RegExp(` In context {5}: split by strategy "${strategy}"`).test(r.stderr), `${strategy}: ${r.stderr}`);
  }
});

test('the test files are cached under their own keys and a report run keeps them', () => {
  const dir = project();
  backdate(dir);
  run(dir);
  assert.ok('t:tests/test_app.py' in cacheOf(dir).files, 'a test file is cached');
  const r = spawnSync(process.execPath, [CLI, '--report'], { cwd: dir, encoding: 'utf8', env: ENV_NO_PYTHON });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok('t:tests/test_app.py' in cacheOf(dir).files, 'a report run, which collects no test entries, does not drop them');
  assert.strictEqual(run(dir).extracted, 0);
});

// ── the cache module ──────────────────────────────────────────────────────────

test('the fingerprint changes with every input it names', () => {
  const base = { version: '1', sources: 's', core: 'c', readLimit: 1000, depMap: true, secretScan: true, python: 'p' };
  const fp = xc.fingerprint(base);
  assert.strictEqual(xc.fingerprint(Object.assign({}, base)), fp, 'stable');
  for (const [k, v] of [['version', '2'], ['sources', 't'], ['core', 'd'], ['readLimit', 1001], ['depMap', false], ['secretScan', false], ['python', 'q']]) {
    assert.notStrictEqual(xc.fingerprint(Object.assign({}, base, { [k]: v })), fp, `${k} must be part of the key`);
  }
});

test('save writes exactly what the run saw and nothing when nothing changed', () => {
  const dir = mk('sigmap-warm-unit-');
  const fp = xc.fingerprint({ version: '1' });
  let c = xc.open(dir, fp);
  c.set('a.js', 'h1', { s: ['a()'] }, { size: 1, mtimeMs: 1 });
  c.set('b.js', 'h2', { s: ['b()'] }, { size: 1, mtimeMs: 1 });
  c.set('t:x.py', 'h3', { s: ['x()'] }, { size: 1, mtimeMs: 1 });
  assert.strictEqual(c.save(), true);
  const file = path.join(dir, xc.CACHE_REL);
  const first = fs.readFileSync(file);
  c = xc.open(dir, fp);
  assert.strictEqual(c.loaded, 3);
  assert.ok(c.get('a.js', 'h1'));
  assert.strictEqual(c.get('b.js', 'other'), undefined, 'a different hash is a miss');
  c.keep('t:');
  assert.strictEqual(c.save(), true, 'b.js was replaced by nothing: it is dropped');
  assert.deepStrictEqual(Object.keys(cacheOfFile(file).files).sort(), ['a.js', 't:x.py']);
  c = xc.open(dir, fp);
  c.get('a.js', 'h1'); c.keep('t:');
  assert.strictEqual(c.save(), false, 'nothing changed: nothing written');
  assert.notStrictEqual(first.length, 0);
});

test('a memo is given back for its key only, and only the memos a run used are kept', () => {
  const dir = mk('sigmap-warm-unit-');
  const fp = xc.fingerprint({ version: '1' });
  let c = xc.open(dir, fp);
  c.memoSet('recent:10', 'sha1', ['a']);
  c.memoSet('changes', 'sha1|sha0', { names: ['a'] });
  c.save();
  c = xc.open(dir, fp);
  assert.deepStrictEqual(c.memoGet('recent:10', 'sha1'), ['a']);
  assert.strictEqual(c.memoGet('recent:10', 'sha2'), undefined, 'another HEAD');
  c.save();
  const kept = cacheOfFile(path.join(dir, xc.CACHE_REL)).memo;
  assert.deepStrictEqual(Object.keys(kept), ['recent:10'], 'the memo this run did not ask for is dropped');
});

test('two writers never leave a half-written cache behind', () => {
  const dir = mk('sigmap-warm-unit-');
  const fp = xc.fingerprint({ version: '1' });
  const a = xc.open(dir, fp);
  const b = xc.open(dir, fp);
  a.set('a.js', 'h', { s: ['a()'] }, { size: 1, mtimeMs: 1 });
  b.set('b.js', 'h', { s: ['b()'] }, { size: 1, mtimeMs: 1 });
  a.save(); b.save();
  JSON.parse(fs.readFileSync(path.join(dir, xc.CACHE_REL), 'utf8'));
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, '.context')).filter((n) => n.endsWith('.tmp')), []);
});

// ── git ───────────────────────────────────────────────────────────────────────

test('recent changes follow the commits: new commit, branch switch, shallow clone', () => {
  const dir = project();
  commit(dir, 'initial');
  fs.appendFileSync(path.join(dir, 'src/app.js'), 'function added1() {}\n');
  commit(dir, 'second');
  fs.appendFileSync(path.join(dir, 'src/service.py'), 'def added2(a):\n    return a\n');
  commit(dir, 'third');
  backdate(dir);
  run(dir);
  const first = outputs(dir);
  assert.ok(/## recent changes \(main@[0-9a-f]+\)/.test(first.ctx), 'the section exists');
  assert.ok(/\+added1/.test(first.ctx) && /\+added2|added2/.test(first.ctx), first.ctx);
  assertSame(first, reference(dir), 'first');
  run(dir);
  assertSame(outputs(dir), first, 'warm, same HEAD');
  assert.ok(cacheOf(dir).memo.changes, 'the git answer is kept');

  fs.appendFileSync(path.join(dir, 'src/main.go'), '\nfunc Added3() {}\n');
  commit(dir, 'fourth');
  run(dir);
  assert.ok(/Added3/.test(outputs(dir).ctx), 'a new commit shows up');
  assertSame(outputs(dir), reference(dir), 'after a new commit');

  git(dir, ['checkout', '-q', '-b', 'feature']);
  run(dir);
  assert.ok(/## recent changes \(feature@/.test(outputs(dir).ctx), 'the same commit on another branch is named for the branch');
  assertSame(outputs(dir), reference(dir), 'after a branch switch');

  const shallow = mk('sigmap-warm-shallow-');
  fs.rmSync(shallow, { recursive: true, force: true });
  const cl = spawnSync('git', ['clone', '-q', '--depth', '1', `file://${dir}`, shallow], { encoding: 'utf8', env: GIT_ENV });
  assert.strictEqual(cl.status, 0, cl.stderr);
  setConfig(shallow, {});
  run(shallow); run(shallow);
  assertSame(outputs(shallow), reference(shallow), 'shallow clone');
});

test('a .gitattributes change alters how git renders a diff, so it changes the cached answer', () => {
  // The change sits more than three lines below `def run`, so git names the enclosing function in the
  // hunk header, and which function it names depends on the language driver the attributes select.
  const dir = project({ 'src/service.py': 'class Service:\n    def run(self, n):\n        a0 = 0\n        a1 = 1\n        a2 = 2\n        a3 = 3\n        a4 = 4\n        a5 = 5\n        a6 = 6\n        a7 = 7\n        a8 = 8\n        a9 = 9\n        return n\n' });
  commit(dir, 'initial');
  fs.writeFileSync(path.join(dir, 'src/service.py'), 'class Service:\n    def run(self, n):\n        a0 = 0\n        a1 = 1\n        a2 = 2\n        a3 = 3\n        a4 = 4\n        a5 = 5\n        a6 = 6\n        a7 = 7\n        a8 = 8\n        a9 = 10\n        return n\n');
  commit(dir, 'change the end of run');
  backdate(dir);
  run(dir);
  const plain = outputs(dir);
  assert.ok(/~Service/.test(plain.ctx), `git names the class without a language driver: ${plain.ctx.split('## recent changes')[1]}`);
  fs.writeFileSync(path.join(dir, '.gitattributes'), '*.py diff=python\n');
  run(dir);
  const withDriver = outputs(dir);
  assert.ok(/~run/.test(withDriver.ctx), `git names the method with the python driver: ${withDriver.ctx.split('## recent changes')[1]}`);
  assertSame(withDriver, reference(dir), 'after adding .gitattributes');
});

test('a rewritten history (same length, different commits) is not served from the old answer', () => {
  const dir = project();
  commit(dir, 'initial');
  fs.appendFileSync(path.join(dir, 'src/app.js'), 'function one() {}\n');
  commit(dir, 'second');
  backdate(dir);
  run(dir);
  git(dir, ['reset', '-q', '--hard', 'HEAD~1']);
  fs.appendFileSync(path.join(dir, 'src/app.js'), 'function other() {}\n');
  commit(dir, 'second, differently');
  backdate(dir);
  run(dir);
  assert.ok(/other/.test(outputs(dir).ctx) && !/\+one\b/.test(outputs(dir).ctx.split('## recent changes')[1] || ''), 'the amended commit shows');
  assertSame(outputs(dir), reference(dir), 'after a history rewrite');
});

test('deepening a shallow clone with HEAD where it was is noticed (the hot-file ordering depends on the history it reaches)', () => {
  const files = crowded();
  const origin = project(files);
  commit(origin, 'initial');
  for (let i = 1; i <= 14; i++) {
    fs.appendFileSync(path.join(origin, Object.keys(files)[i % 12]), `function later${i}() {}\n`);
    commit(origin, `change ${i}`);
  }
  const shallow = mk('sigmap-warm-deepen-');
  fs.rmSync(shallow, { recursive: true, force: true });
  const cl = spawnSync('git', ['clone', '-q', '--depth', '2', `file://${origin}`, shallow], { encoding: 'utf8', env: GIT_ENV });
  assert.strictEqual(cl.status, 0, cl.stderr);
  const config = { maxTokens: 750, autoMaxTokens: false, hotCommits: 3 };
  setConfig(shallow, config);
  backdate(shallow);
  run(shallow);
  assertSame(outputs(shallow), reference(shallow, config), 'depth 2');
  const dp = spawnSync('git', ['-C', shallow, 'fetch', '-q', '--deepen', '20'], { encoding: 'utf8', env: GIT_ENV });
  assert.strictEqual(dp.status, 0, dp.stderr);
  backdate(shallow);
  run(shallow);
  assertSame(outputs(shallow), reference(shallow, config), 'after fetch --deepen, HEAD unchanged');
});

test('a warm run in a depth-1 clone asks git a handful of questions, not one per ancestor', () => {
  const origin = project();
  commit(origin, 'initial');
  fs.appendFileSync(path.join(origin, 'src/app.js'), 'function more() {}\n');
  commit(origin, 'second');
  const shallow = mk('sigmap-warm-depth1-');
  fs.rmSync(shallow, { recursive: true, force: true });
  assert.strictEqual(spawnSync('git', ['clone', '-q', '--depth', '1', `file://${origin}`, shallow], { encoding: 'utf8', env: GIT_ENV }).status, 0);
  setConfig(shallow, {});
  backdate(shallow);
  const pr = probe(shallow);
  const env = pr.env(ENV_NO_PYTHON);
  run(shallow, { env });
  pr.reset();
  run(shallow, { env });
  const gits = pr.lines().filter((l) => l.startsWith('git '));
  assert.ok(!gits.some((l) => /rev-parse --verify/.test(l)), `an ancestor was probed: ${gits.join(' | ')}`);
  assert.ok(gits.length <= 6, `a warm run asked git ${gits.length} questions: ${gits.join(' | ')}`);
  assert.ok(!gits.some((l) => /^git diff /.test(l)), 'and no diff at all');
});

// ── shared directory listing, framework detector ─────────────────────────────

test('directory listings are shared inside a run and nowhere else', () => {
  const dir = mk('sigmap-warm-dirs-');
  fs.mkdirSync(path.join(dir, 'a'));
  fs.writeFileSync(path.join(dir, 'a/x.txt'), '');
  const names = (l) => l.map((e) => e.name);
  assert.deepStrictEqual(names(dirListing.list(dir)), ['a']);
  fs.writeFileSync(path.join(dir, 'b.txt'), '');
  assert.deepStrictEqual(names(dirListing.list(dir)).sort(), ['a', 'b.txt'], 'outside a run every call lists again');
  dirListing.begin();
  try {
    const one = dirListing.list(dir);
    fs.writeFileSync(path.join(dir, 'c.txt'), '');
    const two = dirListing.list(dir);
    const first = names(one);
    assert.deepStrictEqual(names(two), first, 'inside a run the first listing is kept');
    assert.notStrictEqual(two, one, 'each caller gets its own array');
    two.sort((x, y) => y.name.localeCompare(x.name));
    two.length = 0;
    assert.deepStrictEqual(names(dirListing.list(dir)), first, 'a caller sorting or emptying its listing does not change the next one');
    assert.throws(() => dirListing.list(path.join(dir, 'missing')), /ENOENT/);
    assert.throws(() => dirListing.list(path.join(dir, 'missing')), /ENOENT/, 'and says so every time');
  } finally { dirListing.end(); }
  assert.ok(names(dirListing.list(dir)).includes('c.txt'), 'after the run it lists again');
});

test('a run lists the source directory once for the walkers that share it', () => {
  const dir = project(crowded());
  backdate(dir);
  const pr = probe(dir);
  const env = pr.env(ENV_NO_PYTHON);
  run(dir, { env });
  pr.reset();
  run(dir, { env });
  const listed = pr.lines().filter((l) => l === `list ${path.join(dir, 'src')}`).length;
  // the file walker and the coverage walker share one listing; the config detection (before the run) lists it too
  assert.ok(listed <= 3, `src was listed ${listed} times`);
});

test('several runs at once leave a whole cache file and no temporary one', () => {
  const dir = project();
  backdate(dir);
  const sh = `"${process.execPath}" "${CLI}" >/dev/null 2>&1 & "${process.execPath}" "${CLI}" >/dev/null 2>&1 & "${process.execPath}" "${CLI}" >/dev/null 2>&1 & wait`;
  spawnSync('/bin/sh', ['-c', sh], { cwd: dir, env: ENV_NO_PYTHON });
  cacheOf(dir); // parses
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, '.context')).filter((n) => n.endsWith('.tmp')), []);
  run(dir);
  assertSame(outputs(dir), reference(dir), 'after concurrent runs');
});

test('the framework detector lists the tree once and finds what the per-name walk found', () => {
  const dir = mk('sigmap-warm-fw-');
  const mkf = (rel) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), ''); };
  for (const rel of ['manage.py', 'a/b/pom.xml', 'a/b/c/deep.txt', 'a/b/c/d/too-deep.txt', 'x/Package.swift', 'x/y.xcodeproj/p.pbxproj', 'node_modules/n/index.js']) mkf(rel);
  // The walk this replaced: one search per name, stopping at the first match.
  const walkFind = (d, name, depth) => {
    if (depth <= 0) return false;
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === name) return true;
        if (e.isDirectory() && depth > 1 && walkFind(path.join(d, e.name), name, depth - 1)) return true;
      }
    } catch (_) { /* unreadable */ }
    return false;
  };
  for (const depth of [1, 2, 3, 4]) {
    const set = _walkNames(dir, depth);
    for (const name of ['manage.py', 'pom.xml', 'deep.txt', 'too-deep.txt', 'Package.swift', 'y.xcodeproj', 'p.pbxproj', 'index.js', 'missing', 'a', 'd']) {
      assert.strictEqual(set.has(name), walkFind(dir, name, depth), `depth ${depth}, ${name}`);
    }
  }
});

// ── the run summary ───────────────────────────────────────────────────────────

test('the summary names the index and the context file separately and grades neither by the other', () => {
  const many = {};
  for (let i = 0; i < 12; i++) many[`src/m${i}.js`] = Array.from({ length: 6 }, (_, j) => `function m${i}f${j}(a, b) { return a + b + ${j}; }\n`).join('');
  const dir = project(many, { maxTokens: 150, autoMaxTokens: false });
  const r = spawnSync(process.execPath, [CLI], { cwd: dir, encoding: 'utf8', env: ENV_NO_PYTHON });
  assert.strictEqual(r.status, 0, r.stderr);
  const indexed = / Indexed {8}: (\d+) of (\d+) files with symbols \((\d+)%\)/.exec(r.stderr);
  assert.ok(indexed, r.stderr);
  assert.strictEqual(indexed[1], '12');
  assert.strictEqual(indexed[2], '12');
  assert.strictEqual(indexed[3], '100');
  const inContext = / In context {5}: (\d+) of (\d+) source files \((\d+)%\)/.exec(r.stderr);
  assert.ok(inContext, r.stderr);
  assert.ok(Number(inContext[1]) < 12, 'the budget kept only part of the files');
  assert.ok(!/ Coverage {7}:/.test(r.stderr), 'no bare Coverage line for a run that has an index');
  assert.ok(!/\b[A-D] \(\d+%\)/.test(r.stderr), `no letter grade on either population: ${r.stderr}`);
  assert.ok(/tip: .*stay indexed/.test(r.stderr), 'a small context view says the rest is still indexed');
  const sym = / Symbols found {2}: ([\d,]+)/.exec(r.stderr);
  assert.strictEqual(sym[1], '72', 'symbols are counted over every file, not only the part that fit the budget');
  const idx = JSON.parse(fs.readFileSync(path.join(dir, '.context/sig-index.json'), 'utf8'));
  assert.strictEqual(Object.keys(idx.files).length, 12, 'and the index really holds all twelve');
});

test('every default is documented (the cache setting included)', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs-vp/guide/config.md'), 'utf8');
  assert.ok(/\| `extractCache` \| `boolean` \| `true` \|/.test(doc));
  assert.ok(/### extractCache/.test(doc));
});

for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
console.log(`\nwarm-cache: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
