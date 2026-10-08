'use strict';

/**
 * Live overlay + per-file watcher (#926, closes #675).
 *
 * Two things are pinned here:
 *
 *  1. The overlay REPLACES. Before #926 the live cache was merged under "the
 *     entry with more signatures wins", so a rename, a removed symbol or a
 *     deleted file stayed in the index after `freshen()` / the notify hooks.
 *  2. The watcher patches only the files that changed — queries see them before
 *     any full regeneration — and a patched entry equals the regenerated one.
 *
 * The watcher tests start a real `--watch` process. They poll for outcomes with a
 * deadline rather than sleeping, and always kill what they start. They are skipped
 * where the platform has no recursive `fs.watch` (Linux, Node < 20).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');

const overlay = require('../../src/cache/overlay');
const store = require('../../src/retrieval/sig-index-store');
const { buildSigIndex } = require('../../src/retrieval/ranker');
const { freshen } = require('../../src/cache/freshen');
const handlers = require('../../src/mcp/handlers');
const indexState = require('../../src/analysis/index-state');
const { diagnose } = require('../../src/doctor/diagnose');
const ctxSource = require('../../src/judge/context-source');

const RECURSIVE_WATCH = !(process.platform === 'linux' && Number(process.versions.node.split('.')[0]) < 20);

let passed = 0;
let failed = 0;
let skipped = 0;
const queue = [];

function test(name, fn, opts = {}) { queue.push({ name, fn, opts }); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, what, timeoutMs = 15000, stepMs = 40) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try { last = fn(); if (last) return last; } catch (_) { /* not yet */ }
    await sleep(stepMs);
  }
  throw new Error(`timed out waiting for ${what}`);
}

function generate(dir) {
  const r = spawnSync(process.execPath, [GEN], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `generate failed: ${r.stderr}`);
}

function cli(dir, ...args) {
  const r = spawnSync(process.execPath, [GEN, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '' };
}

const dirs = [];
const watchers = [];

function mkProject(files, config) {
  // The real path: the CLI resolves its cwd, and a redaction message embeds the path it was given.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-live-')));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"live","version":"1.0.0"}\n');
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(Object.assign({ srcDirs: ['src'] }, config || {})));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  generate(dir);
  return dir;
}

function startWatcher(dir, env) {
  const child = spawn(process.execPath, [GEN, '--watch'], { cwd: dir, stdio: 'ignore', env: Object.assign({}, process.env, env || {}) });
  watchers.push(child);
  return child;
}

async function watcherReady(dir) {
  await waitFor(() => overlay.readLive(dir), 'the watcher to record live.json');
  await sleep(300); // let the OS finish registering the recursive watch
}

function stopWatcher(child) {
  try { child.kill('SIGKILL'); } catch (_) { /* gone */ }
}

const symbols = (dir, rel) => (buildSigIndex(dir).get(rel) || []).join('\n');

const A_V1 = 'function alphaOne() {}\nfunction alphaTwo() {}\nfunction alphaThree() {}\nmodule.exports = { alphaOne, alphaTwo, alphaThree };\n';
const B_V1 = 'function betaOnly() {}\nmodule.exports = { betaOnly };\n';

// ── 1. The overlay replaces (the defect under #675) ───────────────────────────

test('freshen: a file edited to drop symbols no longer lists them', async () => {
  const dir = mkProject({ 'src/a.js': A_V1, 'src/b.js': B_V1 });
  assert.ok(/alphaThree/.test(symbols(dir, 'src/a.js')), 'precondition: the base index lists alphaThree');
  await sleep(30);
  fs.writeFileSync(path.join(dir, 'src/a.js'), 'function alphaOne() {}\nfunction gammaRenamed() {}\nmodule.exports = { alphaOne, gammaRenamed };\n');
  assert.ok(freshen(dir, { force: true }) >= 1, 'freshen should record the edit');
  const now = symbols(dir, 'src/a.js');
  assert.ok(/gammaRenamed/.test(now), `the new name should be live:\n${now}`);
  assert.ok(!/alphaTwo|alphaThree/.test(now), `removed symbols must be gone:\n${now}`);
});

test('freshen: a same-count rename replaces the old symbol', async () => {
  const dir = mkProject({ 'src/a.js': A_V1, 'src/b.js': B_V1 });
  await sleep(30);
  fs.writeFileSync(path.join(dir, 'src/b.js'), 'function betaRenamed() {}\nmodule.exports = { betaRenamed };\n');
  freshen(dir, { force: true });
  const now = symbols(dir, 'src/b.js');
  assert.ok(/betaRenamed/.test(now), `the new name should be live:\n${now}`);
  assert.ok(!/betaOnly/.test(now), `the old name must be gone:\n${now}`);
});

test('notify_file_deleted removes a file the BASE index holds', () => {
  const dir = mkProject({ 'src/a.js': A_V1, 'src/b.js': B_V1 });
  assert.ok(buildSigIndex(dir).has('src/b.js'), 'precondition: b.js is in the base index');
  const msg = handlers.notifyFileDeleted({ path: 'src/b.js' }, dir);
  assert.ok(/Removed/.test(msg), msg);
  assert.ok(!buildSigIndex(dir).has('src/b.js'), 'b.js must be gone from the index');
  assert.ok(buildSigIndex(dir).has('src/a.js'), 'other files are untouched');
});

test('notify_symbol_added adds to a file without replacing its other symbols', () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  handlers.notifySymbolAdded({ signature: 'function quickHash(s)', file: 'src/a.js', line: 9 }, dir);
  const now = symbols(dir, 'src/a.js');
  assert.ok(/quickHash/.test(now), `the added symbol should be live:\n${now}`);
  assert.ok(/alphaOne/.test(now) && /alphaThree/.test(now), `the file's own symbols must survive:\n${now}`);
});

test('notify_file_created that yields no signatures leaves the index unchanged', () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  const msg = handlers.notifyFileCreated({ path: 'src/a.js', content: '// nothing left\n' }, dir);
  assert.ok(/unchanged/.test(msg), msg);
  // An empty extraction cannot tell "no signatures" from "a file this tier cannot read",
  // and a wrong removal is worse than a stale entry the next full run replaces.
  assert.ok(buildSigIndex(dir).has('src/a.js'), 'no tombstone from an empty extraction');
  handlers.notifyFileDeleted({ path: 'src/a.js' }, dir);
  assert.ok(!buildSigIndex(dir).has('src/a.js'), 'an explicit delete is the way to remove a file');
});

test('an overlay entry older than the base index is ignored, and a full run prunes it', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  overlay.update(dir, (m) => m.set('src/a.js', { at: Date.now(), sigs: ['function stale()  :1-1'] }));
  assert.ok(/stale/.test(symbols(dir, 'src/a.js')), 'precondition: the overlay applies while newer than the base');
  await sleep(30);
  generate(dir);
  assert.ok(!/stale/.test(symbols(dir, 'src/a.js')), 'a later full run supersedes the entry');
  assert.strictEqual(overlay.load(dir).size, 0, 'and removes it from the store');
});

// ── 2. Overlay module ────────────────────────────────────────────────────────

test('overlay.apply: replace, delete, additive, empty and older entries', () => {
  const index = new Map([
    ['a.js', ['x', 'y', 'z']], ['b.js', ['p']], ['c.js', ['q']], ['d.js', ['r']], ['e.js', ['s']],
  ]);
  const entries = new Map([
    ['a.js', { at: 200, sigs: ['n'] }],                    // fewer: replaces
    ['b.js', { at: 200, deleted: true }],                  // removed
    ['c.js', { at: 200, sigs: ['q', 'new'], additive: true }], // union, deduped
    ['d.js', { at: 200, sigs: [] }],                       // empty and not a removal: no information
    ['e.js', { at: 50, sigs: ['old'] }],                   // older than the base: ignored
    ['f.js', { at: 200, sigs: ['fresh'] }],                // a file the base never had
  ]);
  const n = overlay.apply(index, entries, 100);
  assert.deepStrictEqual(index.get('a.js'), ['n']);
  assert.ok(!index.has('b.js'));
  assert.deepStrictEqual(index.get('c.js'), ['q', 'new']);
  assert.deepStrictEqual(index.get('d.js'), ['r']);
  assert.deepStrictEqual(index.get('e.js'), ['s']);
  assert.deepStrictEqual(index.get('f.js'), ['fresh']);
  assert.strictEqual(n, 4);
});

test('isCovered compares at whole-millisecond granularity', () => {
  const covered = new Map([['a.js', { at: 1000 }]]);
  const at = (mtime) => indexState.isCovered(covered, '/p', '/p/a.js', mtime);
  assert.strictEqual(at(1000.9), true, 'a write in the same millisecond as the stamp is covered');
  assert.strictEqual(at(999.5), true);
  assert.strictEqual(at(1001.1), false, 'a write after the stamp is not');
  assert.strictEqual(indexState.isCovered(covered, '/p', '/p/other.js', 1), false, 'a file with no entry is not');
  assert.strictEqual(indexState.isCovered(null, '/p', '/p/a.js', 1), false);
});

test('overlay.load tolerates a missing, corrupt or foreign store', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-live-'));
  dirs.push(dir);
  assert.strictEqual(overlay.load(dir).size, 0);
  fs.mkdirSync(path.join(dir, '.context'));
  fs.writeFileSync(overlay.overlayPath(dir), '{not json');
  assert.strictEqual(overlay.load(dir).size, 0);
  fs.writeFileSync(overlay.overlayPath(dir), JSON.stringify({ schema: 99, entries: { 'a.js': { at: 1, sigs: ['x'] } } }));
  assert.strictEqual(overlay.load(dir).size, 0, 'an unknown schema is not trusted');
  fs.writeFileSync(overlay.overlayPath(dir), JSON.stringify({ schema: 1, entries: { 'a.js': { at: 'x', sigs: ['x'] }, 'b.js': { at: 5, sigs: ['y'] } } }));
  assert.deepStrictEqual([...overlay.load(dir).keys()], ['b.js'], 'a malformed entry is dropped, a good one kept');
});

test('overlay.prune never creates the store and keeps newer entries', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-live-'));
  dirs.push(dir);
  assert.strictEqual(overlay.prune(dir, 1000), 0);
  assert.ok(!fs.existsSync(overlay.overlayPath(dir)), 'pruning an absent store must not create it');
  overlay.update(dir, (m) => { m.set('old.js', { at: 10, sigs: ['a'] }); m.set('new.js', { at: 2000, sigs: ['b'] }); });
  assert.strictEqual(overlay.prune(dir, 1000), 1);
  assert.deepStrictEqual([...overlay.load(dir).keys()], ['new.js']);
});

test('the index records when its run began, and the stamp reads without a full parse', () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  const data = JSON.parse(fs.readFileSync(store.indexPath(dir), 'utf8'));
  assert.ok(Number.isFinite(data.startedAt), 'startedAt is recorded');
  assert.ok(data.startedAt <= Date.parse(data.generated), 'a run begins before it finishes');
  assert.strictEqual(store.readIndexStamp(dir), data.startedAt);
  // An index written before startedAt existed still yields a stamp, from `generated`.
  delete data.startedAt;
  fs.writeFileSync(store.indexPath(dir), JSON.stringify(data));
  assert.strictEqual(store.readIndexStamp(dir), Date.parse(data.generated));
  assert.strictEqual(store.readIndexStamp(path.join(dir, 'nowhere')), null);
});

// ── 2b. Review findings: writers share one pipeline, and an entry only vouches for what it knows ──

test('an additive notify entry does not vouch for the rest of the file', async () => {
  const dir = mkProject({ 'src/a.js': 'function alphaOne() {}\nfunction alphaTwo() {}\nmodule.exports = { alphaOne, alphaTwo };\n' });
  await sleep(40);
  fs.writeFileSync(path.join(dir, 'src/a.js'), 'function alphaOne() {}\nfunction gammaNew() {}\nmodule.exports = { alphaOne, gammaNew };\n');
  handlers.notifySymbolAdded({ signature: 'function gammaNew()', file: 'src/a.js' }, dir);
  assert.ok(freshen(dir, { force: true }) >= 1, 'freshen must still re-read a file that only has an additive entry');
  const now = symbols(dir, 'src/a.js');
  assert.ok(!/alphaTwo/.test(now), `the removed symbol must be gone once freshen has read the file:\n${now}`);
  assert.ok(/gammaNew/.test(now) && /alphaOne/.test(now), now);
  const covered = overlay.load(dir);
  covered.set('src/other.js', { at: Date.now() + 5000, sigs: ['x'], additive: true });
  assert.strictEqual(indexState.isCovered(covered, dir, path.join(dir, 'src/other.js'), 1), false, 'an additive entry never covers a file');
});

test('freshen finds a file that was moved with its mtime intact', async () => {
  const dir = mkProject({ 'src/a.js': A_V1, 'src/b.js': B_V1 });
  const past = (Date.now() - 60000) / 1000;
  fs.utimesSync(path.join(dir, 'src/b.js'), past, past); // as `git mv`, `cp -p` or a restore leave it
  await sleep(40);
  fs.renameSync(path.join(dir, 'src/b.js'), path.join(dir, 'src/b2.js'));
  assert.ok(fs.statSync(path.join(dir, 'src/b2.js')).mtimeMs < fs.statSync(path.join(dir, 'src/b2.js')).ctimeMs, 'precondition: the move left mtime behind ctime');
  assert.ok(freshen(dir, { force: true }) >= 1, 'the moved file is new to the index');
  assert.ok(buildSigIndex(dir).has('src/b2.js'), 'and now visible');
});

test('freshen and the notify hooks write the entry a full run would (secrets redacted, module doc kept)', async () => {
  const dir = mkProject({ 'src/s.js': 'function connect() {}\nmodule.exports = { connect };\n' }, { maxSigsPerFile: 3 });
  const doc = '/**\n * Opens the database connection.\n */\n';
  const body = (n) => `${doc}function connect${n}(url = "postgres://admin:hunter2pass@db.internal/app") { return url }\nfunction f1() {}\nfunction f2() {}\nfunction f3() {}\nfunction f4() {}\n`;
  await sleep(40);
  fs.writeFileSync(path.join(dir, 'src/s.js'), body(''));
  fs.writeFileSync(path.join(dir, 'src/n.js'), body('N'));
  assert.ok(freshen(dir, { force: true }) >= 1);
  handlers.notifyFileCreated({ path: 'src/n.js', content: body('N') }, dir);
  handlers.notifySymbolAdded({ signature: 'function leak(t = "ghp_abcdefghijklmnopqrstuvwxyz0123456789")', file: 'src/s.js' }, dir);

  const live = overlay.load(dir);
  const text = fs.readFileSync(overlay.overlayPath(dir), 'utf8');
  assert.ok(!/hunter2pass|ghp_abc/.test(text), 'no secret may reach overlay.json');
  const fromHooks = { 's.js': live.get('src/s.js'), 'n.js': live.get('src/n.js') };
  assert.ok(fromHooks['s.js'] && fromHooks['n.js']);
  assert.ok(fromHooks['n.js'].sigs.some((x) => /REDACTED/.test(x)), 'the notify entry is redacted');

  const n = fromHooks['n.js'].sigs.slice();
  const s = fromHooks['s.js'].sigs.slice();
  generate(dir); // same directory: the redaction text embeds the path
  const regenerated = store.readFullIndex(dir);
  assert.deepStrictEqual(n, regenerated.get('src/n.js'), 'notify_file_created == full run');
  // freshen's entry for s.js (before the additive symbol was added to it)
  assert.deepStrictEqual(s.filter((x) => !/leak/.test(x)).slice(0, regenerated.get('src/s.js').length), regenerated.get('src/s.js').slice(0, s.filter((x) => !/leak/.test(x)).length), 'freshen == full run');
  assert.ok(/Opens the database connection/.test(regenerated.get('src/s.js')[0]), 'the module-doc line leads the entry');
});

test('overlay.put keeps the newer entry; a non-string signature is not trusted', () => {
  const m = new Map([['a.js', { at: 200, sigs: ['new'] }]]);
  assert.strictEqual(overlay.put(m, 'a.js', { at: 100, sigs: ['old'] }), false, 'a slower writer must not overwrite a newer entry');
  assert.deepStrictEqual(m.get('a.js').sigs, ['new']);
  assert.strictEqual(overlay.put(m, 'a.js', { at: 300, sigs: ['newest'] }), true);
  assert.strictEqual(overlay.put(m, 'b.js', { at: 1, deleted: true }), true);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-live-'));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, '.context'));
  fs.writeFileSync(overlay.overlayPath(dir), JSON.stringify({ schema: 1, entries: { 'bad.js': { at: 5, sigs: ['ok', 7, null] }, 'good.js': { at: 5, sigs: ['ok'] } } }));
  assert.deepStrictEqual([...overlay.load(dir).keys()], ['good.js']);
});

test('watcher telemetry does not invalidate the knowledge-map cache', () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  const km = require('../../src/map/knowledge-map');
  const before = km.loadOrBuild(dir).builtFor;
  overlay.writeLive(dir, { pid: process.pid, patches: 3 }, { replace: true });
  fs.writeFileSync(path.join(dir, '.context', 'overlay.json.99.tmp'), '{}');
  assert.strictEqual(km.loadOrBuild(dir).builtFor, before, 'live.json and a write in flight are not index changes');
  overlay.update(dir, (m) => m.set('src/a.js', { at: Date.now(), sigs: ['function z()  :1-1'] }));
  assert.notStrictEqual(km.loadOrBuild(dir).builtFor, before, 'an overlay change IS an index change');
});

// ── 2c. Second review: what the writers must not do ──────────────────────────

test('notify_file_created indexes a file type only the generic tier knows, like a full run', () => {
  const zig = 'pub fn add(a: i32, b: i32) i32 {\n    return a + b;\n}\n';
  const dir = mkProject({ 'src/a.js': A_V1, 'src/add.zig': zig });
  const base = store.readFullIndex(dir).get('src/add.zig');
  assert.ok(base && base.length > 0, 'precondition: the full run lists the .zig file');
  handlers.notifyFileCreated({ path: 'src/add.zig' }, dir);
  assert.deepStrictEqual(overlay.load(dir).get('src/add.zig').sigs, base, 'the entry equals the full run\'s');
  assert.ok(buildSigIndex(dir).has('src/add.zig'), 'and the file stays in the index');
});

test('freshen and the notify tools honour .contextignore like a full run', async () => {
  const dir = mkProject({ 'src/a.js': A_V1, 'src/gen/b.js': B_V1 });
  fs.writeFileSync(path.join(dir, '.contextignore'), 'src/gen/\n');
  generate(dir);
  assert.ok(!buildSigIndex(dir).has('src/gen/b.js'), 'precondition: the full run omits the ignored file');
  await sleep(40);
  fs.writeFileSync(path.join(dir, 'src/gen/b.js'), 'function bravo2(x) {}\nmodule.exports = { bravo2 };\n');
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function real() {}\n');
  freshen(dir, { force: true });
  assert.ok(/excluded/.test(handlers.notifyFileCreated({ path: 'src/gen/b.js' }, dir)));
  assert.ok(/excluded/.test(handlers.notifySymbolAdded({ signature: 'function z()', file: 'src/gen/b.js' }, dir)));
  assert.ok(!buildSigIndex(dir).has('src/gen/b.js'), 'an ignored file is not resurrected');
  assert.ok(/real/.test(symbols(dir, 'src/a.js')), 'the rest is healed as usual');
});

test('an entry stamped far in the future is not trusted, and does not block later edits', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  fs.mkdirSync(path.join(dir, '.context'), { recursive: true });
  fs.writeFileSync(overlay.overlayPath(dir), JSON.stringify({ schema: 1, entries: { 'src/a.js': { at: Date.now() + 3600000, sigs: ['function skewed()  :1-1'] } } }));
  assert.strictEqual(overlay.load(dir).size, 0, 'a clock step or a hand edit must not outlive every full run');
  assert.ok(!/skewed/.test(symbols(dir, 'src/a.js')));
  await sleep(40);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function later() {}\n');
  assert.ok(freshen(dir, { force: true }) >= 1);
  assert.ok(/later/.test(symbols(dir, 'src/a.js')));
});

test('notify_symbol_added does not make a whole-file entry claim edits it never read', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  await sleep(40);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function beta() {}\n');
  assert.ok(freshen(dir, { force: true }) >= 1); // a whole-file entry now exists
  await sleep(40);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function beta() {}\nfunction gamma() {}\n'); // an edit nobody has read
  handlers.notifySymbolAdded({ signature: 'function delta()', file: 'src/a.js', line: 9 }, dir);
  assert.ok(freshen(dir, { force: true }) >= 1, 'freshen must still read the file');
  assert.ok(/gamma/.test(symbols(dir, 'src/a.js')), 'the unread edit is picked up');
});

test('a secret in a module header comment is redacted, in the full run and in every writer', async () => {
  const header = '// Deploy helper. Uses key AKIAIOSFODNN7EXAMPLE and slack xoxb-123456789012-abcdefABCDEF for CI.\n';
  const dir = mkProject({ 'src/sec.js': header + 'function deploy() {}\nmodule.exports = { deploy };\n' });
  const base = fs.readFileSync(store.indexPath(dir), 'utf8');
  assert.ok(!/AKIAIOSFODNN7EXAMPLE|xoxb-1234/.test(base), 'the full run must not index a key from a header comment');
  await sleep(40);
  fs.writeFileSync(path.join(dir, 'src/sec.js'), header + 'function deploy() {}\nfunction more() {}\nmodule.exports = { deploy, more };\n');
  freshen(dir, { force: true });
  handlers.notifyFileCreated({ path: 'src/sec.js', content: header + 'function deploy() {}\nfunction again() {}\n' }, dir);
  assert.ok(fs.existsSync(overlay.overlayPath(dir)), 'precondition: an overlay was written');
  assert.ok(!/AKIAIOSFODNN7EXAMPLE|xoxb-1234/.test(fs.readFileSync(overlay.overlayPath(dir), 'utf8')), 'nor may the overlay');
});

test('the shared pipeline follows a local `extends` for maxSigsPerFile', () => {
  const dir = mkProject({ 'src/m.js': 'function a1() {}\nfunction a2() {}\nfunction a3() {}\nfunction a4() {}\n' });
  fs.writeFileSync(path.join(dir, 'base.json'), JSON.stringify({ maxSigsPerFile: 2 }));
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ extends: './base.json', srcDirs: ['src'] }));
  generate(dir);
  const full = store.readFullIndex(dir).get('src/m.js');
  assert.ok(full.length <= 3, `precondition: the cap from the base config applied (${full.length})`);
  const { entrySigs } = require('../../src/cache/entry');
  assert.deepStrictEqual(entrySigs(path.join(dir, 'src/m.js'), fs.readFileSync(path.join(dir, 'src/m.js'), 'utf8'), dir), full);
});

test('an overlay entry stamped in the same millisecond as a fractional base still applies', () => {
  const index = new Map([['a.js', ['old']]]);
  overlay.apply(index, new Map([['a.js', { at: 1000, sigs: ['new'] }]]), 1000.7);
  assert.deepStrictEqual(index.get('a.js'), ['new']);
});

test('the notify tools say so when the overlay cannot be written', () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  fs.mkdirSync(overlay.overlayPath(dir), { recursive: true }); // the store's path is a directory
  assert.ok(/could not write/.test(handlers.notifyFileCreated({ path: 'src/a.js', content: A_V1 + 'function x() {}\n' }, dir)));
  assert.ok(/could not write/.test(handlers.notifySymbolAdded({ signature: 'function z()', file: 'src/a.js' }, dir)));
  assert.ok(/could not write/.test(handlers.notifyFileDeleted({ path: 'src/a.js' }, dir)));
  assert.ok(/outside/.test(handlers.notifyFileCreated({ path: '../elsewhere.js', content: 'function q() {}' }, dir)));
});

test('an index of another schema has no usable stamp; a stale heartbeat is not a running watcher', () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  const data = JSON.parse(fs.readFileSync(store.indexPath(dir), 'utf8'));
  fs.writeFileSync(store.indexPath(dir), JSON.stringify(Object.assign({}, data, { schema: 2 })));
  assert.strictEqual(store.readIndexStamp(dir), null);
  overlay.writeLive(dir, { pid: process.pid, heartbeatAt: new Date(Date.now() - 600000).toISOString() }, { replace: true });
  assert.strictEqual(indexState.liveIndexState(dir).watcher.running, false, 'a live pid with no recent heartbeat is a reused pid');
  overlay.writeLive(dir, { heartbeatAt: new Date().toISOString() });
  assert.strictEqual(indexState.liveIndexState(dir).watcher.running, true);
});

test('gen-context.js defines each top-level function once', () => {
  // A scripted edit once duplicated a 447-line block; function declarations hoist, so the
  // last copy silently won and nothing else noticed.
  const text = fs.readFileSync(GEN, 'utf8');
  const core = text.slice(text.indexOf('// ═══ END SIGMAP BUNDLED MODULES ═══'));
  const seen = new Map();
  for (const m of core.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/gm)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  const dup = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
  assert.deepStrictEqual(dup, [], `duplicate top-level functions in the CLI core: ${dup}`);
});

// ── 3. Observability ─────────────────────────────────────────────────────────

test('status reports an unmeasured live index as unknown, never as zero', () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  const live = JSON.parse(cli(dir, 'status', '--json').stdout).live;
  assert.strictEqual(live.overlayDepth, 0);
  assert.strictEqual(live.watcher, null);
  assert.strictEqual(live.lastLatencyMs, null, 'an unmeasured latency is null, not 0');
  assert.ok(!/Live index/.test(cli(dir, 'status').out), 'with nothing to report, the text stays quiet');
});

test('a watcher that has not yet seen a save reports its latency as unknown', () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  // This process stands in for a live watcher that has recorded nothing yet.
  overlay.writeLive(dir, { pid: process.pid, startedAt: new Date().toISOString(), incremental: true, settleMs: 5000, patches: 0, regens: 0 }, { replace: true });
  const live = JSON.parse(cli(dir, 'status', '--json').stdout).live;
  assert.strictEqual(live.watcher.running, true);
  assert.strictEqual(live.lastLatencyMs, null, 'no save seen yet → unknown, not 0');
  assert.ok(/save → index latency unknown/.test(cli(dir, 'status').out));
  const row = diagnose(dir).checks.find((c) => c.id === 'live');
  assert.ok(row && /not measured yet/.test(row.detail), `doctor says so too: ${JSON.stringify(row)}`);
});

test('status and doctor count a file the overlay covers as live, not stale', async () => {
  const dir = mkProject({ 'src/a.js': A_V1, 'src/b.js': B_V1 });
  await sleep(30);
  fs.writeFileSync(path.join(dir, 'src/b.js'), 'function betaRenamed() {}\nmodule.exports = { betaRenamed };\n');
  const before = JSON.parse(cli(dir, 'status', '--json').stdout);
  assert.strictEqual(before.changedSinceIndex, 1, 'an unpatched edit is stale');
  freshen(dir, { force: true });
  const after = JSON.parse(cli(dir, 'status', '--json').stdout);
  assert.strictEqual(after.changedSinceIndex, 0, 'once the overlay describes it, it is not stale');
  assert.strictEqual(after.live.overlayDepth, 1);
  assert.ok(/1 file in the live overlay/.test(cli(dir, 'status').out));

  const checks = diagnose(dir).checks;
  const fresh = checks.find((c) => c.id === 'freshness');
  assert.ok(fresh && fresh.status === 'ok', `freshness should be ok: ${JSON.stringify(fresh)}`);
  const liveCheck = checks.find((c) => c.id === 'live');
  assert.ok(liveCheck && liveCheck.status === 'warn' && /overlay/.test(liveCheck.detail),
    `with no watcher the written files lag: ${JSON.stringify(liveCheck)}`);
});

test('doctor adds no live row to a repo that never used the overlay', () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  assert.ok(!diagnose(dir).checks.some((c) => c.id === 'live'));
});

test('the ask staleness warning does not fire for a file the overlay covers', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  const ctxFile = ctxSource.resolveContextFile(dir);
  const cfg = { srcDirs: ['src'] };
  await sleep(30);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function late() {}\n');
  assert.strictEqual(ctxSource.contextStaleness(ctxFile, dir, cfg).stale, true, 'precondition: the edit makes the context stale');
  freshen(dir, { force: true });
  const ranked = ctxSource.contextStaleness(ctxFile, dir, cfg, { honorOverlay: true });
  assert.ok(ranked === null || ranked.stale === false, `a reader that ranks through the index sees the overlay: ${JSON.stringify(ranked)}`);
  // ... but a reader of the WRITTEN file does not, so for it the file is still stale.
  assert.strictEqual(ctxSource.contextStaleness(ctxFile, dir, cfg).stale, true, 'the written file has not been regenerated');
});

test('judge and read_context still call a covered-but-unwritten edit stale; ask and the search tools do not', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  await sleep(40);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function brandNew() {}\n');
  freshen(dir, { force: true });
  fs.writeFileSync(path.join(dir, 'r.md'), 'The new function `brandNew()` lives in src/a.js\n');
  const judged = JSON.parse(cli(dir, 'judge', '--response', 'r.md', '--json').stdout);
  assert.strictEqual(judged.context.stale, true, `judge scores the written file: ${JSON.stringify(judged.context)}`);
  assert.ok(/⚠/.test(handlers.readContext({}, dir).slice(0, 400)), 'read_context serves the written file, so it carries the banner');
  assert.ok(!/⚠/.test(handlers.searchSignatures({ query: 'brandNew' }, dir).slice(0, 400)), 'search_signatures ranks through the overlay');
  assert.ok(/brandNew/.test(handlers.searchSignatures({ query: 'brandNew' }, dir)));
  assert.ok(!/stale ground/.test(cli(dir, 'ask', 'where is brandNew defined').out), '`ask` ranks through the overlay, so it does not warn');
});

test('a file with a timestamp in the future is read once, not on every freshen', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 });
  await sleep(40);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function skew() {}\n');
  const future = (Date.now() + 86400000) / 1000;
  fs.utimesSync(path.join(dir, 'src/a.js'), future, future);
  assert.ok(freshen(dir, { force: true }) >= 1);
  assert.strictEqual(freshen(dir, { force: true }), 0, 'no entry can be stamped later than now, so a future mtime must not look perpetually uncovered');
});

// ── 4. The watcher ───────────────────────────────────────────────────────────

const WATCH = { watchDebounce: 80, watchSettleMs: 600000 };

test('watcher: a save is visible to queries before any regeneration', async () => {
  const dir = mkProject({ 'src/a.js': A_V1, 'src/b.js': B_V1 }, WATCH);
  const ctxFile = ctxSource.resolveContextFile(dir);
  const w = startWatcher(dir);
  await watcherReady(dir); // --watch generates once at startup, so the baseline is taken after it
  const ctxBefore = fs.statSync(ctxFile).mtimeMs;
  fs.writeFileSync(path.join(dir, 'src/a.js'), 'function alphaOne() {}\nfunction gammaRenamed() {}\nmodule.exports = { alphaOne, gammaRenamed };\n');
  fs.rmSync(path.join(dir, 'src/b.js'));
  fs.writeFileSync(path.join(dir, 'src/c.js'), 'function newCee() {}\nmodule.exports = { newCee };\n');
  await waitFor(() => {
    const idx = buildSigIndex(dir);
    return (idx.get('src/a.js') || []).some((s) => s.includes('gammaRenamed')) && !idx.has('src/b.js') && idx.has('src/c.js');
  }, 'the patched files to be visible');
  assert.ok(!/alphaTwo|alphaThree/.test(symbols(dir, 'src/a.js')), 'removed symbols are gone');
  const live = overlay.readLive(dir);
  assert.ok(live.patches >= 1, 'a patch was recorded');
  assert.strictEqual(live.regens, 0, 'no full regeneration ran');
  assert.strictEqual(live.lastLatencyPath, 'patch');
  assert.ok(Number.isFinite(live.lastLatencyMs) && live.lastLatencyMs >= 0, 'the save → index latency was measured');
  assert.strictEqual(fs.statSync(ctxFile).mtimeMs, ctxBefore, 'the written context file was not rewritten');
  const st = JSON.parse(cli(dir, 'status', '--json').stdout).live;
  assert.strictEqual(st.watcher.running, true);
  assert.ok(st.overlayDepth >= 3, `status shows the overlay depth: ${st.overlayDepth}`);
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: a patched entry equals the entry a full run writes for the same file', async () => {
  const dir = mkProject({
    'src/doc.js': '/**\n * Rate limiter for the public API.\n */\nfunction limit() {}\nmodule.exports = { limit };\n',
    'src/secret.js': 'function connect() {}\nmodule.exports = { connect };\n',
    'src/many.js': 'function f1() {}\nfunction f2() {}\n',
  }, Object.assign({ maxSigsPerFile: 3 }, WATCH));
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.writeFileSync(path.join(dir, 'src/doc.js'), '/**\n * Rate limiter for the public API, per client.\n */\nfunction limit() {}\nfunction reset() {}\nmodule.exports = { limit, reset };\n');
  fs.writeFileSync(path.join(dir, 'src/secret.js'), 'function connect(url = "postgres://admin:hunter2pass@db.internal/app") { return url }\nmodule.exports = { connect };\n');
  fs.writeFileSync(path.join(dir, 'src/many.js'), 'function f1() {}\nfunction f2() {}\nfunction f3() {}\nfunction f4() {}\nfunction f5() {}\nfunction f6() {}\n');
  const rels = ['src/doc.js', 'src/secret.js', 'src/many.js'];
  await waitFor(() => {
    const e = overlay.load(dir);
    return rels.every((r) => e.has(r));
  }, 'all three files to be patched');
  stopWatcher(w);
  await sleep(150);
  const patched = {};
  for (const [rel, e] of overlay.load(dir)) patched[rel] = e.sigs;
  assert.ok(patched['src/doc.js'][0].startsWith('//') || /Rate limiter/.test(patched['src/doc.js'][0]), `module doc leads the patched entry: ${patched['src/doc.js'][0]}`);
  assert.ok(patched['src/secret.js'].some((s) => /REDACTED/.test(s)), 'the secret was redacted in the patch');
  assert.strictEqual(patched['src/many.js'].length <= 4, true, 'maxSigsPerFile is honoured by the patch');

  generate(dir); // a full run over the same tree, same directory (the redaction text embeds the path)
  const regenerated = store.readFullIndex(dir);
  for (const rel of rels) {
    assert.deepStrictEqual(patched[rel], regenerated.get(rel), `${rel}: patch must equal the regenerated entry`);
  }
}, { needsWatch: true });

test('watcher: after a quiet window one regeneration converges to the full-run index', async () => {
  const dir = mkProject({ 'src/a.js': A_V1, 'src/b.js': B_V1 }, { watchDebounce: 80, watchSettleMs: 700 });
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.writeFileSync(path.join(dir, 'src/a.js'), 'function alphaOne() {}\nfunction gammaRenamed() {}\nmodule.exports = { alphaOne, gammaRenamed };\n');
  await waitFor(() => overlay.readLive(dir).patches >= 1, 'the patch');
  await waitFor(() => overlay.readLive(dir).regens >= 1, 'the settle regeneration', 20000);
  await waitFor(() => overlay.load(dir).size === 0, 'the superseded entries to be pruned');
  stopWatcher(w);
  await sleep(150);
  const live = overlay.readLive(dir);
  assert.ok(live.lastRegenMs >= 0 && live.lastRegenAt, 'the regeneration was recorded');
  const watched = store.readFullIndex(dir);
  generate(dir);
  const fresh = store.readFullIndex(dir);
  assert.deepStrictEqual([...watched.keys()].sort(), [...fresh.keys()].sort(), 'same files');
  for (const [rel, sigs] of fresh) assert.deepStrictEqual(watched.get(rel), sigs, `${rel} converged`);
}, { needsWatch: true });

test('watcher: its own output under a root srcDir does not retrigger it', async () => {
  // Before #926 one edit here caused a regeneration every cycle, forever: the
  // regeneration wrote CLAUDE.md / .context/, which woke the watcher again.
  const dir = mkProject({ 'a.js': A_V1 }, { srcDirs: ['.'], watchDebounce: 80, watchSettleMs: 500 });
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.appendFileSync(path.join(dir, 'a.js'), 'function again() {}\n');
  await waitFor(() => overlay.readLive(dir).regens >= 1, 'the settle regeneration', 20000);
  await sleep(2500); // five more settle windows: a loop would have run again by now
  const live = overlay.readLive(dir);
  stopWatcher(w);
  assert.ok(live.patches >= 1 && live.patches <= 2, `one edit, at most two patches if the event split across a debounce window (got ${live.patches})`);
  assert.strictEqual(live.regens, 1, `and one regeneration (got ${live.regens})`);
}, { needsWatch: true });

test('watcher: a temp file that comes and goes leaves no overlay entry', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 }, WATCH);
  const w = startWatcher(dir);
  await watcherReady(dir);
  for (let i = 0; i < 3; i++) {
    fs.writeFileSync(path.join(dir, `src/.a.js.swp${i}`), 'x');
    fs.rmSync(path.join(dir, `src/.a.js.swp${i}`));
  }
  await sleep(800);
  const keys = [...overlay.load(dir).keys()];
  assert.deepStrictEqual(keys, [], `an editor's temp file was never indexed, so nothing is recorded: ${keys}`);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function real() {}\n');
  await waitFor(() => overlay.readLive(dir).patches >= 1, 'a real edit to patch afterwards');
  stopWatcher(w);
}, { needsWatch: true });

// A directory event names the directory, not its files. Each direction is tested on its own:
// a rename inside the tree reports BOTH paths, and either defence alone would mask the other.
function sibling(files) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-live-out-')));
  dirs.push(d);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
    fs.writeFileSync(path.join(d, rel), text);
  }
  return d;
}

test('watcher: a new directory is handled by one full run', async () => {
  // An EMPTY directory leaves no file event to fall back on, whatever the platform
  // reports for the contents of a directory that arrives with files in it.
  const dir = mkProject({ 'src/keep.js': B_V1 }, WATCH);
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.mkdirSync(path.join(dir, 'src/newdir'));
  await waitFor(() => overlay.readLive(dir).regens >= 1, 'a directory event to be handled by a full run', 30000);
  assert.strictEqual(overlay.readLive(dir).patches, 0, 'nothing was patched: there was no file');
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: a directory moved INTO the tree is indexed', async () => {
  const dir = mkProject({ 'src/keep.js': B_V1 }, WATCH);
  const outside = sibling({ 'pkg3/m.js': 'function arrived() {}\nmodule.exports = { arrived };\n' });
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.renameSync(path.join(outside, 'pkg3'), path.join(dir, 'src/pkg3'));
  // Whether the platform reports the directory or the files inside it, the result must be the same.
  await waitFor(() => buildSigIndex(dir).has('src/pkg3/m.js'), 'the moved-in directory to be indexed', 30000);
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: a directory moved OUT of the tree leaves the index', async () => {
  const dir = mkProject({ 'src/pkg/m.js': 'function leaving() {}\nmodule.exports = { leaving };\n', 'src/keep.js': B_V1 }, WATCH);
  const outside = sibling({});
  assert.ok(buildSigIndex(dir).has('src/pkg/m.js'), 'precondition');
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.renameSync(path.join(dir, 'src/pkg'), path.join(outside, 'pkg'));
  await waitFor(() => !buildSigIndex(dir).has('src/pkg/m.js'), 'the removed directory to leave the index', 30000);
  assert.ok(buildSigIndex(dir).has('src/keep.js'), 'the rest of the index is intact');
  assert.ok(overlay.readLive(dir).regens >= 1, 'handled by a full run');
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: a directory renamed inside the tree is re-indexed', async () => {
  const dir = mkProject({ 'src/pkg/m.js': 'function inPkg() {}\nmodule.exports = { inPkg };\n', 'src/keep.js': B_V1 }, WATCH);
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.renameSync(path.join(dir, 'src/pkg'), path.join(dir, 'src/pkg2'));
  await waitFor(() => { const i = buildSigIndex(dir); return i.has('src/pkg2/m.js') && !i.has('src/pkg/m.js'); }, 'the renamed directory to be re-indexed', 30000);
  assert.ok(buildSigIndex(dir).has('src/keep.js'), 'the rest of the index is intact');
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: an event that changes nothing does not cancel the quiet-window regeneration', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 }, { watchDebounce: 80, watchSettleMs: 2500 });
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function patched() {}\n');
  await waitFor(() => overlay.readLive(dir).patches >= 1, 'the patch');
  for (let i = 0; i < 3; i++) { // an editor's temp file: wakes the debounce, patches nothing
    fs.writeFileSync(path.join(dir, `src/.churn${i}`), 'x');
    fs.rmSync(path.join(dir, `src/.churn${i}`));
    await sleep(120);
  }
  await waitFor(() => overlay.readLive(dir).regens >= 1, 'the armed regeneration to still run', 25000);
  await waitFor(() => overlay.load(dir).size === 0, 'the overlay to fold back into the index');
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: a srcDir outside the project root is handled by a full run, as before', async () => {
  const shared = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-live-shared-'));
  dirs.push(shared);
  fs.writeFileSync(path.join(shared, 's.js'), 'function sharedOne() {}\nmodule.exports = { sharedOne };\n');
  const rel = '../' + path.basename(shared);
  const dir = mkProject({ 'src/a.js': A_V1 }, Object.assign({ srcDirs: ['src', rel] }, WATCH));
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.appendFileSync(path.join(shared, 's.js'), 'function sharedTwo() {}\n');
  await waitFor(() => overlay.readLive(dir).regens >= 1, 'a regeneration for the outside srcDir', 30000);
  assert.strictEqual(overlay.readLive(dir).lastLatencyPath, 'regen');
  assert.strictEqual(overlay.readLive(dir).patches, 0, 'such files never reach the retrieval index, so nothing is patched');
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: a symlink is not indexed, as a full run does not index it', async () => {
  if (process.platform === 'win32') return;
  const dir = mkProject({ 'src/a.js': A_V1 }, WATCH);
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.symlinkSync(path.join(dir, 'src/a.js'), path.join(dir, 'src/link.js'));
  await sleep(500);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function real() {}\n');
  await waitFor(() => overlay.readLive(dir).patches >= 1, 'a real edit to patch');
  const keys = [...overlay.load(dir).keys()];
  assert.ok(keys.includes('src/a.js'), `the real file is patched: ${keys}`);
  assert.ok(!keys.includes('src/link.js'), `the symlink is not: ${keys}`);
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: a patch that cannot be written falls back to a full run', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 }, WATCH);
  fs.mkdirSync(overlay.overlayPath(dir), { recursive: true }); // the store's path is a directory: writes fail
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function viaFallback() {}\n');
  await waitFor(() => overlay.readLive(dir).regens >= 1, 'the fallback regeneration', 30000);
  stopWatcher(w);
  const live = overlay.readLive(dir);
  assert.strictEqual(live.patches, 0, 'a patch that did not land is not reported as one');
  assert.strictEqual(live.lastLatencyPath, 'regen');
  assert.ok(/viaFallback/.test(symbols(dir, 'src/a.js')), 'the full run indexed the change');
}, { needsWatch: true });

test('watcher: a .contextignore edited while watching applies from the next change', async () => {
  const dir = mkProject({ 'src/a.js': A_V1, 'src/gen/keep.js': B_V1 }, WATCH);
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.writeFileSync(path.join(dir, '.contextignore'), 'src/gen/\n');
  fs.writeFileSync(path.join(dir, 'src/gen/g.js'), 'function generated() {}\nmodule.exports = { generated };\n');
  await sleep(700);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function real() {}\n');
  await waitFor(() => overlay.readLive(dir).patches >= 1, 'a real edit to patch');
  const keys = [...overlay.load(dir).keys()];
  assert.ok(!keys.some((k) => k.startsWith('src/gen/')), `an ignored path must not be patched: ${keys}`);
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: a watched root that is moved away is handled by a full run', async () => {
  // Moving the root away delivers ONLY the root's own event (no file inside it is
  // reported), so there is nothing to patch and nothing to tombstone.
  const dir = mkProject({ 'src/a.js': A_V1, 'src/b.js': B_V1 }, WATCH);
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.renameSync(path.join(dir, 'src'), path.join(dir, 'src_old'));
  await waitFor(() => { const i = buildSigIndex(dir); return !i.has('src/a.js') && !i.has('src/b.js'); }, 'the index to drop a root that no longer exists', 30000);
  assert.ok(overlay.readLive(dir).regens >= 1, 'a full run handled it');
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: a watched root that is replaced leaves no stale file behind', async () => {
  const dir = mkProject({ 'src/a.js': A_V1, 'src/b.js': B_V1 }, WATCH);
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.renameSync(path.join(dir, 'src'), path.join(dir, 'src_old'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function rebuilt() {}\n');
  // Whether the platform reports the files or only the root, the result must be the same.
  await waitFor(() => { const i = buildSigIndex(dir); return /rebuilt/.test((i.get('src/a.js') || []).join()) && !i.has('src/b.js'); }, 'the rebuilt root to be re-indexed', 30000);
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: legacy mode with a root srcDir and sigCache does not retrigger itself', async () => {
  const dir = mkProject({ 'a.js': A_V1 }, { srcDirs: ['.'], watchIncremental: false, sigCache: true, watchDebounce: 80 });
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.appendFileSync(path.join(dir, 'a.js'), 'function once() {}\n');
  await waitFor(() => overlay.readLive(dir).regens >= 1, 'the regeneration for one edit', 30000);
  await sleep(2500);
  const regens = overlay.readLive(dir).regens;
  stopWatcher(w);
  assert.ok(regens <= 2, `one edit must not keep regenerating (got ${regens}); the cache file SigMap writes is not a source change`);
}, { needsWatch: true });

test('watcher: an unreadable .contextignore does not kill it', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 }, WATCH);
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.mkdirSync(path.join(dir, '.contextignore')); // reading it now fails with EISDIR
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function survives() {}\n');
  await waitFor(() => overlay.readLive(dir).patches >= 1, 'the edit to be patched anyway');
  let alive = true;
  try { process.kill(w.pid, 0); } catch (_) { alive = false; }
  assert.ok(alive, 'the watcher must still be running');
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: it keeps a heartbeat, so a reused pid cannot pass for a live watcher', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 }, WATCH);
  const w = startWatcher(dir, { SIGMAP_WATCH_HEARTBEAT_MS: '300' });
  await watcherReady(dir);
  const first = overlay.readLive(dir).heartbeatAt;
  await waitFor(() => overlay.readLive(dir).heartbeatAt !== first, 'the heartbeat to advance', 15000);
  assert.strictEqual(indexState.liveIndexState(dir).watcher.running, true);
  stopWatcher(w);
}, { needsWatch: true });

test('watcher: a burst larger than the patch limit falls back to one full run', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 }, { watchDebounce: 600, watchSettleMs: 600000 });
  const w = startWatcher(dir);
  await watcherReady(dir);
  for (let i = 0; i < 300; i++) fs.writeFileSync(path.join(dir, `src/gen${i}.js`), `function burst${i}() {}\nmodule.exports = { burst${i} };\n`);
  await waitFor(() => overlay.readLive(dir).regens >= 1, 'the fallback regeneration', 30000);
  stopWatcher(w);
  const live = overlay.readLive(dir);
  assert.strictEqual(live.lastLatencyPath, 'regen');
  assert.strictEqual(live.patches, 0, 'a burst is not patched file by file');
  assert.ok(buildSigIndex(dir).has('src/gen299.js'), 'and the regeneration indexed the new files');
}, { needsWatch: true });

test('watcher: watchIncremental:false keeps the previous regenerate-per-change behaviour', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 }, { watchDebounce: 80, watchIncremental: false });
  const w = startWatcher(dir);
  await watcherReady(dir);
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function viaRegen() {}\n');
  await waitFor(() => overlay.readLive(dir).regens >= 1, 'a full regeneration', 20000);
  stopWatcher(w);
  const live = overlay.readLive(dir);
  assert.strictEqual(live.lastLatencyPath, 'regen');
  assert.strictEqual(live.patches, 0, 'nothing was patched');
  assert.ok(!fs.existsSync(overlay.overlayPath(dir)), 'no overlay was written');
  assert.ok(/viaRegen/.test(symbols(dir, 'src/a.js')), 'the base index has the change');
}, { needsWatch: true });

test('watcher: events for excluded, ignored or too-deep paths wake nothing', async () => {
  const dir = mkProject({ 'src/a.js': A_V1 }, Object.assign({ maxDepth: 1 }, WATCH));
  fs.writeFileSync(path.join(dir, '.contextignore'), 'src/skipme/\n');
  // The directories exist before the watch starts: a NEW directory inside the
  // depth cap is a directory event, which is handled by a full run (see below).
  for (const d of ['src/node_modules/pkg', 'src/skipme', 'src/x/y/z']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  const w = startWatcher(dir);
  await watcherReady(dir);
  const put = (rel, text) => fs.writeFileSync(path.join(dir, rel), text);
  put('src/node_modules/pkg/index.js', 'function vendored() {}\nmodule.exports = { vendored };\n');
  put('src/skipme/hidden.js', 'function hidden() {}\nmodule.exports = { hidden };\n');
  put('src/x/y/z/deep.js', 'function tooDeep() {}\nmodule.exports = { tooDeep };\n');
  await sleep(700);
  assert.strictEqual(overlay.readLive(dir).patches, 0, 'an excluded, ignored or too-deep path must not be patched');
  assert.strictEqual(overlay.readLive(dir).regens, 0, 'nor regenerate');
  fs.writeFileSync(path.join(dir, 'src/a.js'), A_V1 + 'function real() {}\n');
  await waitFor(() => overlay.readLive(dir).patches >= 1, 'a real edit to patch afterwards (the watcher is alive)');
  assert.ok(!buildSigIndex(dir).has('src/node_modules/pkg/index.js'));
  // A late event cannot hide behind the fixed sleep above: whatever was delivered
  // by now is in the store, and only the real edit may be.
  assert.deepStrictEqual([...overlay.load(dir).keys()], ['src/a.js'], 'nothing excluded, ignored or too deep was recorded');
  stopWatcher(w);
}, { needsWatch: true });

// ── runner ───────────────────────────────────────────────────────────────────

function cleanupAll() {
  for (const w of watchers.splice(0)) stopWatcher(w);
  for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }
}
process.on('exit', cleanupAll);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanupAll(); process.exit(130); });

(async () => {
  for (const t of queue) {
    if (t.opts.needsWatch && !RECURSIVE_WATCH) {
      console.log(`  SKIP  ${t.name} (no recursive fs.watch on this platform)`);
      skipped++;
      continue;
    }
    try {
      await t.fn();
      console.log(`  PASS  ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`  FAIL  ${t.name}: ${err && err.message}`);
      failed++;
    } finally {
      for (const w of watchers.splice(0)) stopWatcher(w);
    }
  }
  for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\nlive-overlay: ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
  process.exit(failed > 0 ? 1 : 0);
})();
