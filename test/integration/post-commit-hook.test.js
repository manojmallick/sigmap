'use strict';

/**
 * The post-commit hook `--setup` installs (#784, #918).
 *
 *   hook line   byte-identical to what every installed hook already holds
 *   installer   idempotent for a global (`sigmap` symlink) install, and never
 *               removes a line it did not write
 *   doctor      reports the hook: installed / missing / duplicated / stale /
 *               not executable / bypassed by core.hooksPath
 *   --setup     names the file it wrote
 *
 * Run: node test/integration/post-commit-hook.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const hook = require(path.join(ROOT, 'src/util/post-commit-hook'));
const { diagnose } = require(path.join(ROOT, 'src/doctor/diagnose'));

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }

const tmpDirs = [];
function tmpRepo({ git = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pch-'));
  tmpDirs.push(dir);
  if (git) execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}
const hookFile = (dir) => path.join(dir, '.git', 'hooks', 'post-commit');
const readHook = (dir) => fs.readFileSync(hookFile(dir), 'utf8');
const check = (dir, id = 'hook') => diagnose(dir).checks.find((c) => c.id === id);

/** A script that exists, standing in for an installed gen-context.js. */
function fakeScript(dir, name = 'gen-context.js') {
  const p = path.join(dir, name);
  fs.writeFileSync(p, '// stand-in\n');
  return p;
}

// ── the line itself ─────────────────────────────────────────────────────────
test('the hook line is byte-identical to the one every installed hook holds', () => {
  const script = '/opt/homebrew/bin/sigmap';
  assert.strictEqual(hook.hookLine(script), 'node "/opt/homebrew/bin/sigmap" --generate 2>/dev/null || true');
  assert.strictEqual(hook.HOOK_FLAG, '--generate');
});

test('a fresh install writes a shebang and the line, executable', () => {
  const dir = tmpRepo();
  const script = fakeScript(dir);
  const r = hook.installPostCommitHook(dir, script);
  assert.strictEqual(r.action, 'installed');
  assert.strictEqual(readHook(dir), `#!/bin/sh\nnode ${JSON.stringify(script)} --generate 2>/dev/null || true\n`);
  if (process.platform !== 'win32') assert.ok(fs.statSync(hookFile(dir)).mode & 0o100, 'hook must be executable');
});

test('a repo without .git/hooks is skipped, not created', () => {
  const dir = tmpRepo({ git: false });
  assert.deepStrictEqual(hook.installPostCommitHook(dir, fakeScript(dir)), { action: 'skipped', path: null });
  assert.ok(!fs.existsSync(path.join(dir, '.git')));
});

// ── idempotence (the global-install bug) ────────────────────────────────────
test('re-running setup for a global install (a `sigmap` symlink) does not add a second line', () => {
  if (process.platform === 'win32') return;
  const dir = tmpRepo();
  const real = fakeScript(dir);
  const bin = path.join(dir, 'bin'); fs.mkdirSync(bin);
  const link = path.join(bin, 'sigmap'); fs.symlinkSync(real, link);
  assert.strictEqual(hook.installPostCommitHook(dir, link).action, 'installed');
  const once = readHook(dir);
  assert.strictEqual(hook.installPostCommitHook(dir, link).action, 'unchanged');
  assert.strictEqual(readHook(dir), once, 'the second run must not touch the file');
  assert.strictEqual(once.split('\n').filter(hook.isOwnLine).length, 1);
});

test('re-running setup for a local gen-context.js install is a no-op', () => {
  const dir = tmpRepo();
  const script = fakeScript(dir);
  hook.installPostCommitHook(dir, script);
  const once = readHook(dir);
  assert.strictEqual(hook.installPostCommitHook(dir, script).action, 'unchanged');
  assert.strictEqual(readHook(dir), once);
});

test('copies left behind by the old installer collapse to one', () => {
  const dir = tmpRepo();
  const script = fakeScript(dir);
  const line = hook.hookLine(script);
  fs.writeFileSync(hookFile(dir), `#!/bin/sh\n${line}\n\n${line}\n\n${line}\n`, { mode: 0o755 });
  assert.strictEqual(hook.installPostCommitHook(dir, script).action, 'updated');
  assert.strictEqual(readHook(dir).split('\n').filter(hook.isOwnLine).length, 1);
});

// ── never removes a line it did not write ───────────────────────────────────
test('updating keeps the team\'s own lines, including one that runs a gen-context.js of its own', () => {
  const dir = tmpRepo();
  const script = fakeScript(dir);
  fs.writeFileSync(hookFile(dir), [
    '#!/bin/sh',
    'echo "before"',
    'node scripts/gen-context.js --my-own-flag',
    'node "/old/install/gen-context.js" --generate 2>/dev/null || true',
    'echo "regenerating gen-context.js docs"',
    'echo "after"',
    '',
  ].join('\n'), { mode: 0o755 });
  assert.strictEqual(hook.installPostCommitHook(dir, script).action, 'updated');
  assert.strictEqual(readHook(dir), [
    '#!/bin/sh',
    'echo "before"',
    'node scripts/gen-context.js --my-own-flag',
    hook.hookLine(script),
    'echo "regenerating gen-context.js docs"',
    'echo "after"',
    '',
  ].join('\n'), 'SigMap\'s line is replaced in place; nothing else moves');
});

test('installing into a hook that has no SigMap line appends and keeps every existing line', () => {
  const dir = tmpRepo();
  const script = fakeScript(dir);
  fs.writeFileSync(hookFile(dir), '#!/bin/sh\necho mine\nnode scripts/gen-context.js --custom\n', { mode: 0o755 });
  assert.strictEqual(hook.installPostCommitHook(dir, script).action, 'installed');
  const text = readHook(dir);
  assert.ok(text.startsWith('#!/bin/sh\necho mine\nnode scripts/gen-context.js --custom\n'), text);
  assert.ok(text.trimEnd().endsWith(hook.hookLine(script)), text);
});

test('isOwnLine: the shapes SigMap has written, and none of the look-alikes', () => {
  for (const own of [
    'node "/usr/local/lib/node_modules/sigmap/gen-context.js" --generate 2>/dev/null || true',
    'node "/opt/homebrew/bin/sigmap" --generate 2>/dev/null || true',
    'node /opt/homebrew/bin/sigmap --generate 2>/dev/null || true',
    'node "$(git rev-parse --show-toplevel)/gen-context.js" --generate 2>/dev/null || true', // the original form
    'node "C:\\\\tools\\\\sigmap\\\\gen-context.js" --generate 2>/dev/null || true',
  ]) assert.strictEqual(hook.isOwnLine(own), true, own);
  for (const other of [
    'node scripts/gen-context.js --my-own-flag',
    'node scripts/gen-context.js',
    'echo "gen-context.js --generate"',
    'node tools/build.js --generate',
    '# node "/x/gen-context.js" --generate',
    'node "/x/mysigmap-wrapper.js" --generate',
    '',
  ]) assert.strictEqual(hook.isOwnLine(other), false, other);
});

// ── doctor ──────────────────────────────────────────────────────────────────
test('doctor: no hook → warn with the remediation', () => {
  const c = check(tmpRepo());
  assert.strictEqual(c.status, 'warn');
  assert.ok(/no post-commit hook/.test(c.detail), c.detail);
  assert.ok(/sigmap --setup/.test(c.fix), c.fix);
});

test('doctor: a hook that does not run SigMap says so', () => {
  const dir = tmpRepo();
  fs.writeFileSync(hookFile(dir), '#!/bin/sh\necho hi\n', { mode: 0o755 });
  const c = check(dir);
  assert.strictEqual(c.status, 'warn');
  assert.ok(/exists but does not run SigMap/.test(c.detail), c.detail);
});

test('doctor: an installed hook is ok and names the script it runs', () => {
  const dir = tmpRepo();
  const script = fakeScript(dir);
  hook.installPostCommitHook(dir, script);
  const c = check(dir);
  assert.strictEqual(c.status, 'ok', c.detail);
  assert.ok(c.detail.includes('gen-context.js'), c.detail);
});

test('doctor: a hook pointing at a deleted install is stale', () => {
  const dir = tmpRepo();
  const script = fakeScript(dir);
  hook.installPostCommitHook(dir, script);
  fs.unlinkSync(script);
  const c = check(dir);
  assert.strictEqual(c.status, 'warn');
  assert.ok(/no longer exists/.test(c.detail), c.detail);
  assert.ok(/sigmap --setup/.test(c.fix));
});

test('doctor: the original `$(git rev-parse --show-toplevel)` form resolves against the repo', () => {
  const dir = tmpRepo();
  fakeScript(dir);
  fs.writeFileSync(hookFile(dir), '#!/bin/sh\nnode "$(git rev-parse --show-toplevel)/gen-context.js" --generate 2>/dev/null || true\n', { mode: 0o755 });
  assert.strictEqual(check(dir).status, 'ok');
  fs.unlinkSync(path.join(dir, 'gen-context.js'));
  assert.strictEqual(check(dir).status, 'warn');
});

test('doctor: a hook installed twice runs twice per commit', () => {
  const dir = tmpRepo();
  const script = fakeScript(dir);
  const line = hook.hookLine(script);
  fs.writeFileSync(hookFile(dir), `#!/bin/sh\n${line}\n${line}\n`, { mode: 0o755 });
  const c = check(dir);
  assert.strictEqual(c.status, 'warn');
  assert.ok(/2 times per commit/.test(c.detail), c.detail);
});

test('doctor: a hook git will not run (no executable bit) is a warning', () => {
  if (process.platform === 'win32') return;
  const dir = tmpRepo();
  hook.installPostCommitHook(dir, fakeScript(dir));
  fs.chmodSync(hookFile(dir), 0o644);
  const c = check(dir);
  assert.strictEqual(c.status, 'warn');
  assert.ok(/not executable/.test(c.detail) && /chmod \+x/.test(c.fix), `${c.detail} / ${c.fix}`);
});

test('doctor: core.hooksPath moves where git looks, so .git/hooks is bypassed', () => {
  const dir = tmpRepo();
  hook.installPostCommitHook(dir, fakeScript(dir));
  execFileSync('git', ['config', 'core.hooksPath', '.husky'], { cwd: dir });
  const c = check(dir);
  assert.strictEqual(c.status, 'warn');
  assert.ok(/core\.hooksPath is \.husky/.test(c.detail), c.detail);
});

test('doctor: outside a git repository there is no hook check to fail', () => {
  assert.strictEqual(check(tmpRepo({ git: false })), undefined);
});

// ── the CLI: --setup names the file ─────────────────────────────────────────
/** Run `--setup` (which stays alive to watch) until it has reported on the hook, then stop it. */
function runSetup(dir, entry) {
  return new Promise((resolve) => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pch-home-'));
    tmpDirs.push(home);
    const p = spawn(process.execPath, [entry, '--setup'], {
      cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, HOME: home, USERPROFILE: home },
    });
    let out = '';
    let finished = false;
    const done = () => { if (finished) return; finished = true; p.kill('SIGKILL'); resolve(out); };
    const on = (d) => { out += d; if (/\[sigmap\][^\n]*post-commit[^\n]*\n/.test(out) || /hooks not found/.test(out)) setTimeout(done, 150); };
    p.stdout.on('data', on); p.stderr.on('data', on);
    setTimeout(done, 30000);
  });
}

test('CLI: --setup names the hook it wrote, and says so when it is already there', async () => {
  const dir = tmpRepo();
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function a() {}\nmodule.exports = { a };\n');
  const first = await runSetup(dir, GEN);
  assert.ok(/\[sigmap\] installed \.git\/hooks\/post-commit/.test(first), first);
  const second = await runSetup(dir, GEN);
  assert.ok(/\[sigmap\] post-commit hook already installed \(\.git\/hooks\/post-commit\)/.test(second), second);
  assert.strictEqual(readHook(dir).split('\n').filter(hook.isOwnLine).length, 1, 'setup twice must leave one line');
});

test('CLI: --setup warns when core.hooksPath would bypass the hook it just wrote', async () => {
  const dir = tmpRepo();
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function a() {}\nmodule.exports = { a };\n');
  execFileSync('git', ['config', 'core.hooksPath', '.husky'], { cwd: dir });
  const out = await runSetup(dir, GEN);
  assert.ok(/warning: core\.hooksPath is set to \.husky/.test(out), out);
});

(async () => {
  for (const { name, fn } of queue) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
  }
  for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\npost-commit-hook: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
