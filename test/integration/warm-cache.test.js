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

// python3 shadowed by a shim that fails at once, so every machine takes the regex tier.
const SHIM = mk('sigmap-warm-shim-');
fs.writeFileSync(path.join(SHIM, 'python3'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
const ENV_NO_PYTHON = Object.assign({}, process.env, { PATH: SHIM + path.delimiter + process.env.PATH });
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
/** One run with --verbose; returns the exit state and what the cache did. */
function run(dir, opts = {}) {
  const r = spawnSync(process.execPath, [opts.cli || CLI, '--verbose'], { cwd: dir, encoding: 'utf8', env: opts.env || ENV_NO_PYTHON });
  assert.strictEqual(r.status, 0, r.stderr);
  const m = /extraction cache: (\d+) hit\(s\), (\d+) extracted \((\d+) entries on disk\)/.exec(r.stderr);
  return { stderr: r.stderr, hits: m ? Number(m[1]) : null, extracted: m ? Number(m[2]) : null, entries: m ? Number(m[3]) : null };
}
/** What a run wrote, with the clock taken out. */
function outputs(dir) {
  const ctx = fs.readFileSync(path.join(dir, '.github/copilot-instructions.md'), 'utf8').split('\n').filter((l) => !/Updated:/.test(l)).join('\n');
  const idx = JSON.parse(fs.readFileSync(path.join(dir, '.context/sig-index.json'), 'utf8'));
  delete idx.generated; delete idx.startedAt;
  return { ctx, idx: JSON.stringify(idx) };
}
function assertSame(a, b, what) {
  assert.ok(a.ctx === b.ctx, `${what}: the context file differs`);
  assert.ok(a.idx === b.idx, `${what}: the retrieval index differs`);
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

test('a file whose size and modification time are unchanged is not read by a warm run', () => {
  const dir = project();
  backdate(dir);
  const preload = path.join(mk('sigmap-warm-pre-'), 'reads.js');
  const log = path.join(path.dirname(preload), 'reads.log');
  fs.writeFileSync(preload, `const fs=require('fs');const orig=fs.readFileSync;fs.readFileSync=function(p,...a){try{if(typeof p==='string'&&/[\\\\/](src|tests)[\\\\/][^\\\\/]+\\.(js|ts|py|go)$/.test(p)&&p.startsWith(${JSON.stringify(dir)}))fs.appendFileSync(${JSON.stringify(log)},p+'\\n')}catch(_){}return orig.call(this,p,...a)};`);
  const env = Object.assign({}, ENV_NO_PYTHON, { NODE_OPTIONS: `--require=${preload}` });
  run(dir, { env });
  const coldReads = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : [];
  assert.ok(coldReads.length >= 4, `the probe sees the cold run read the sources: ${coldReads.length}`);
  fs.rmSync(log, { force: true });
  run(dir, { env });
  const warmReads = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : [];
  assert.deepStrictEqual(warmReads, [], `a warm run read: ${warmReads.join(', ')}`);
});

test('a file edited within the same clock tick at the same size is not missed (the racy rule)', () => {
  const dir = project({ 'src/a.js': 'function aaa() {}\n', 'src/b.js': 'function bbb() {}\n' });
  const t = new Date();
  const file = path.join(dir, 'src/a.js');
  fs.utimesSync(file, t, t);
  run(dir);
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
  const base = { version: '1', sources: 's', core: 'c', readLimit: 1000, depMap: true, python: 'p' };
  const fp = xc.fingerprint(base);
  assert.strictEqual(xc.fingerprint(Object.assign({}, base)), fp, 'stable');
  for (const [k, v] of [['version', '2'], ['sources', 't'], ['core', 'd'], ['readLimit', 1001], ['depMap', false], ['python', 'q']]) {
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
    assert.deepStrictEqual(names(two), names(one), 'inside a run the first listing is kept');
    two.sort((x, y) => y.name.localeCompare(x.name));
    assert.deepStrictEqual(names(dirListing.list(dir)), names(one), 'a caller sorting its listing does not reorder the next one');
    assert.throws(() => dirListing.list(path.join(dir, 'missing')), /ENOENT/);
    assert.throws(() => dirListing.list(path.join(dir, 'missing')), /ENOENT/, 'and says so every time');
  } finally { dirListing.end(); }
  assert.ok(names(dirListing.list(dir)).includes('c.txt'), 'after the run it lists again');
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
