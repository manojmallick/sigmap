'use strict';

/**
 * `.context/` keeps itself out of git (#947).
 *
 * Published pages said `sigmap --init` gitignores `.context/`. Nothing did, so
 * `git add .` committed derived indexes, run telemetry and session records, and
 * since v8.75.0 the body-words cache. Every command that writes there now
 * leaves a `.context/.gitignore` holding `*`.
 *
 * Tests:
 *   process
 *   1.  a plain run, `ask`, and `--init` then a run each leave `.context/` out of `git status`
 *   2.  `git add .` stages nothing under `.context/`
 *   3.  `--version`, `--help` and `--init` create no `.context/`
 *   4.  an existing `.context/.gitignore` and the root `.gitignore` are left byte for byte
 *   chokepoints the exit hook cannot cover
 *   5.  the MCP server writes it per tool call, while it is still running
 *   6.  the session hook (which returns before `main()` registers anything) writes it
 *   7.  `--watch` writes it after the first run, before any exit (killed with SIGKILL)
 *   caches
 *   8.  creating it invalidates neither the knowledge-map nor the mined-expansions cache
 *   module
 *   9.  ensureSelfIgnore: created / present / absent / unwritable, never creates the directory
 *   doctor
 *   10. tracked files under `.context/` warn with the `git rm -r --cached` remedy
 *   11. ignored is ok; not ignored warns; no `.context/` or no git says nothing
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const ctxDir = require(path.join(ROOT, 'src', 'util', 'context-dir'));
const { diagnose } = require(path.join(ROOT, 'src', 'doctor', 'diagnose'));

// A developer's own global excludes must not decide what these tests see.
// Applied to this process too: the doctor tests call diagnose() in-process and it shells out to git.
const XDG = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-947-xdg-'));
Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', XDG_CONFIG_HOME: XDG,
  SIGMAP_NO_TRACK: '', CLAUDE_ENV_FILE: '', CLAUDE_PROJECT_DIR: '', SIGMAP_SESSION: '',
});
const ENV = Object.assign({}, process.env);

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'sigmap-947-'));
}

function git(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', env: ENV });
}

/** A git repo with two small source files and nothing generated. */
function repo() {
  const dir = tmp();
  git(dir, ['init', '-q', '.']);
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'herald.js'),
    'function announceArrival(cart, courier) { return courier.dispatch(cart.items); }\nmodule.exports = { announceArrival };\n');
  fs.writeFileSync(path.join(dir, 'src', 'ledger.js'),
    'function postEntry(book, amount) { book.rows.push({ amount }); return book; }\nmodule.exports = { postEntry };\n');
  return dir;
}

function cli(dir, args, opts = {}) {
  return spawnSync(process.execPath, [GEN, ...args], {
    cwd: dir, encoding: 'utf8', timeout: 60000, env: Object.assign({}, ENV, opts.env || {}), input: opts.input,
  });
}

/** Paths git would list as untracked-and-not-ignored. */
function untracked(dir) {
  return git(dir, ['status', '--porcelain', '-uall']).stdout.split('\n').filter(Boolean).map((l) => l.slice(3));
}
const underContext = (list) => list.filter((p) => p === '.context/' || p.startsWith('.context/'));
const isIgnored = (dir, rel) => git(dir, ['check-ignore', '--', rel]).status === 0;

// ── process ─────────────────────────────────────────────────────────────────

test('a plain run, and `--init` then a run, leave .context/ out of git status', () => {
  for (const [label, steps] of [
    ['plain run', [[]]],
    ['--init then run', [['--init'], []]],
    ['run then ask', [[], ['ask', 'where are cart arrivals announced']]],
  ]) {
    const dir = repo();
    for (const args of steps) {
      const r = cli(dir, args);
      assert.strictEqual(r.status, 0, `${label}: sigmap ${args.join(' ')} exited ${r.status}: ${r.stderr}`);
    }
    assert.ok(fs.existsSync(path.join(dir, '.context')), `${label}: .context/ was written`);
    assert.deepStrictEqual(underContext(untracked(dir)), [], `${label}: git status lists .context/`);
    assert.ok(isIgnored(dir, '.context/sig-index.json'), `${label}: sig-index.json is not ignored`);
    assert.ok(isIgnored(dir, '.context/body-words.json') || !fs.existsSync(path.join(dir, '.context', 'body-words.json')),
      `${label}: body-words.json is not ignored`);
  }
});

test('a .context/ an older version wrote is ignored by the next command, whatever it is', () => {
  for (const args of [[], ['ask', 'where are cart arrivals announced'], ['doctor'], ['--health']]) {
    const dir = repo();
    assert.strictEqual(cli(dir, []).status, 0);
    // What an older version left: the directory, no ignore file.
    fs.rmSync(path.join(dir, '.context', '.gitignore'));
    assert.ok(underContext(untracked(dir)).length > 0, 'fixture: the stale .context/ shows up in git status');
    cli(dir, args);
    assert.deepStrictEqual(underContext(untracked(dir)), [], `sigmap ${args.join(' ')} left .context/ visible to git`);
  }
});

test('a command that creates .context/ outside generation (--dashboard) is covered at exit', () => {
  const dir = repo();
  assert.ok(!fs.existsSync(path.join(dir, '.context')), 'fixture starts without .context/');
  const r = cli(dir, ['--dashboard']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.context', 'dashboard.html')), '--dashboard wrote .context/dashboard.html');
  assert.deepStrictEqual(underContext(untracked(dir)), []);
  assert.ok(isIgnored(dir, '.context/dashboard.html'));
});

test('`git add .` stages nothing under .context/', () => {
  const dir = repo();
  assert.strictEqual(cli(dir, []).status, 0);
  assert.strictEqual(cli(dir, ['ask', 'where are cart arrivals announced']).status, 0);
  git(dir, ['add', '.']);
  const staged = git(dir, ['diff', '--cached', '--name-only']).stdout.split('\n').filter(Boolean);
  assert.deepStrictEqual(underContext(staged), []);
  assert.ok(staged.some((p) => p === 'src/herald.js'), 'the source files were staged, so the probe is real');
});

test('--version, --help and --init create no .context/', () => {
  for (const args of [['--version'], ['--help'], ['--init']]) {
    const dir = repo();
    const r = cli(dir, args);
    assert.strictEqual(r.status, 0, `sigmap ${args.join(' ')} exited ${r.status}`);
    assert.ok(!fs.existsSync(path.join(dir, '.context')), `sigmap ${args.join(' ')} created .context/`);
  }
});

test('an existing .context/.gitignore and the root .gitignore are left byte for byte', () => {
  const dir = repo();
  const rootIgnore = 'node_modules/\n*.log\n';
  const mine = '# mine\n*.tmp\n!sig-index.json\n';
  fs.writeFileSync(path.join(dir, '.gitignore'), rootIgnore);
  fs.mkdirSync(path.join(dir, '.context'));
  fs.writeFileSync(path.join(dir, '.context', '.gitignore'), mine);
  assert.strictEqual(cli(dir, []).status, 0);
  assert.strictEqual(cli(dir, ['ask', 'where are cart arrivals announced']).status, 0);
  assert.strictEqual(fs.readFileSync(path.join(dir, '.context', '.gitignore'), 'utf8'), mine);
  assert.strictEqual(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), rootIgnore);
});

// ── chokepoints the exit hook cannot cover ──────────────────────────────────

/** Send one tools/call, return once its response arrives — the server is still running. */
function mcpCallWhileAlive(dir, name, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [GEN, '--mcp'], { cwd: dir, env: ENV, stdio: ['pipe', 'pipe', 'ignore'] });
    let buf = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('no MCP response in 15 s')); }, 15000);
    child.stdout.on('data', (d) => {
      buf += d;
      if (!buf.includes('\n')) return;
      clearTimeout(timer);
      // The caller inspects the directory now; the process has not exited, so no exit hook has run.
      resolve({ response: JSON.parse(buf.split('\n')[0]), done: () => child.kill('SIGKILL') });
    });
    child.on('error', reject);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) + '\n');
  });
}

test('the MCP server writes it per tool call, while it is still running', async () => {
  const dir = repo();
  assert.ok(!fs.existsSync(path.join(dir, '.context')), 'fixture starts without .context/');
  const { response, done } = await mcpCallWhileAlive(dir, 'sigmap_notify_file_created', { path: 'src/herald.js' });
  try {
    assert.ok(response.result, `tool call failed: ${JSON.stringify(response)}`);
    assert.ok(fs.existsSync(path.join(dir, '.context', 'overlay.json')), 'the tool created .context/overlay.json');
    assert.ok(fs.existsSync(path.join(dir, '.context', '.gitignore')), '.context/.gitignore exists before the server exits');
    assert.deepStrictEqual(underContext(untracked(dir)), []);
  } finally { done(); }
});

test('a stale .context/ is fixed at startup, for a process that is killed before it can exit', async () => {
  const dir = repo();
  fs.mkdirSync(path.join(dir, '.context'));
  fs.writeFileSync(path.join(dir, '.context', 'sig-index.json'), '{}\n');
  assert.ok(underContext(untracked(dir)).length > 0, 'fixture: .context/ shows up in git status');
  // An MCP server that is never sent a call and never exits: neither the per-call hook nor the exit
  // listener can have run, so only the startup call can have written the file.
  const child = spawn(process.execPath, [GEN, '--mcp'], { cwd: dir, env: ENV, stdio: ['pipe', 'ignore', 'ignore'] });
  try {
    const file = path.join(dir, '.context', '.gitignore');
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(file) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    assert.ok(fs.existsSync(file), '.context/.gitignore did not appear while the server was idle');
    assert.deepStrictEqual(underContext(untracked(dir)), []);
  } finally {
    child.kill('SIGKILL');
  }
});

test('the session hook, which returns before main() registers anything, writes it', () => {
  const dir = repo();
  assert.ok(!fs.existsSync(path.join(dir, '.context')), 'fixture starts without .context/');
  const r = cli(dir, ['session', 'hook', 'SessionStart'], { input: JSON.stringify({ session_id: 'h947', cwd: dir, source: 'startup' }) });
  assert.strictEqual(r.status, 0);
  assert.ok(fs.existsSync(path.join(dir, '.context', 'sessions.ndjson')), 'the hook created the session store');
  assert.ok(fs.existsSync(path.join(dir, '.context', '.gitignore')), '.context/.gitignore exists');
  assert.deepStrictEqual(underContext(untracked(dir)), []);
});

test('--watch writes it after the first run, before any exit (killed with SIGKILL)', async () => {
  const dir = repo();
  const child = spawn(process.execPath, [GEN, '--watch'], { cwd: dir, env: ENV, stdio: 'ignore' });
  try {
    const file = path.join(dir, '.context', '.gitignore');
    const deadline = Date.now() + 30000;
    while (!fs.existsSync(file) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    assert.ok(fs.existsSync(file), '.context/.gitignore did not appear while --watch was running');
    assert.deepStrictEqual(underContext(untracked(dir)), []);
  } finally {
    child.kill('SIGKILL');
  }
});

// ── caches ──────────────────────────────────────────────────────────────────

test('creating it invalidates neither the knowledge-map nor the mined-expansions cache', () => {
  const km = require(path.join(ROOT, 'src', 'map', 'knowledge-map'));
  const mined = require(path.join(ROOT, 'src', 'retrieval', 'mined-expansions'));
  // One fixture per cache: each scan also counts the other cache's file, so running both in one
  // directory would move a key for a reason that has nothing to do with the ignore file.
  for (const [label, cacheName, load] of [
    ['knowledge-map', 'knowledge-map.json', (d) => km.loadOrBuild(d)],
    ['mined-expansions', 'mined-expansions.json', (d) => mined.loadOrMine(d)],
  ]) {
    const dir = repo();
    fs.mkdirSync(path.join(dir, '.context'));
    // Something for the scan to take the newest mtime of, older than the file about to appear.
    const seed = path.join(dir, '.context', 'sig-index.json');
    fs.writeFileSync(seed, JSON.stringify({ schema: 1, files: {} }));
    const past = new Date(Date.now() - 60000);
    fs.utimesSync(seed, past, past);

    const cacheFile = path.join(dir, '.context', cacheName);
    const first = load(dir);
    assert.ok(fs.existsSync(cacheFile), `${label}: cache was written`);
    const before = fs.readFileSync(cacheFile, 'utf8');
    assert.ok(Math.abs(first.builtFor - past.getTime()) < 5, `${label}: keyed on the seed's mtime, not on the cache itself`);

    assert.strictEqual(ctxDir.ensureSelfIgnore(dir), 'created');

    const second = load(dir);
    assert.strictEqual(second.builtFor, first.builtFor, `${label}: cache key moved when .context/.gitignore appeared`);
    assert.strictEqual(fs.readFileSync(cacheFile, 'utf8'), before, `${label}: cache was rewritten`);
  }
});

// ── module ──────────────────────────────────────────────────────────────────

test('ensureSelfIgnore: created, present, absent — and it never creates the directory', () => {
  const dir = tmp();
  assert.strictEqual(ctxDir.ensureSelfIgnore(dir), 'absent');
  assert.ok(!fs.existsSync(path.join(dir, '.context')), 'it created the directory');

  fs.mkdirSync(path.join(dir, '.context'));
  assert.strictEqual(ctxDir.ensureSelfIgnore(dir), 'created');
  const file = path.join(dir, '.context', '.gitignore');
  const body = fs.readFileSync(file, 'utf8');
  assert.ok(/^\*$/m.test(body), 'holds the catch-all pattern');
  assert.strictEqual(ctxDir.ensureSelfIgnore(dir), 'present');
  assert.strictEqual(fs.readFileSync(file, 'utf8'), body, 'second call rewrote it');

  // `.context` that is a file, not a directory: nothing to do, nothing thrown.
  const odd = tmp();
  fs.writeFileSync(path.join(odd, '.context'), 'not a directory');
  assert.strictEqual(ctxDir.ensureSelfIgnore(odd), 'absent');
  assert.strictEqual(ctxDir.ensureSelfIgnore(path.join(dir, 'does', 'not', 'exist')), 'absent');
});

test('ensureSelfIgnore reports unwritable instead of throwing', () => {
  if (process.platform === 'win32' || (process.getuid && process.getuid() === 0)) return; // modes do not bind root
  const dir = tmp();
  fs.mkdirSync(path.join(dir, '.context'));
  fs.chmodSync(path.join(dir, '.context'), 0o555);
  try {
    assert.strictEqual(ctxDir.ensureSelfIgnore(dir), 'unwritable');
  } finally {
    fs.chmodSync(path.join(dir, '.context'), 0o755);
  }
});

// ── doctor ──────────────────────────────────────────────────────────────────

const stateCheck = (dir) => diagnose(dir).checks.find((c) => c.id === 'context-git');

test('doctor: tracked files under .context/ warn with the git rm --cached remedy', () => {
  const dir = repo();
  fs.mkdirSync(path.join(dir, '.context'));
  fs.writeFileSync(path.join(dir, '.context', 'sig-index.json'), '{}\n');
  fs.writeFileSync(path.join(dir, '.context', 'usage.json'), '{}\n');
  // Committed under an earlier version; -f because the directory now ignores itself.
  git(dir, ['add', '-f', '.context/sig-index.json', '.context/usage.json']);
  const c = stateCheck(dir);
  assert.ok(c, 'check present');
  assert.strictEqual(c.status, 'warn');
  assert.ok(/2 file\(s\) under \.context\/ are tracked/.test(c.detail), c.detail);
  assert.ok(/git rm -r --cached \.context/.test(c.fix), c.fix);
});

test('doctor: ignored is ok, not ignored warns, nothing to commit says nothing', () => {
  const ignored = repo();
  fs.mkdirSync(path.join(ignored, '.context'));
  ctxDir.ensureSelfIgnore(ignored);
  assert.strictEqual(stateCheck(ignored).status, 'ok');

  const open = repo();
  fs.mkdirSync(path.join(open, '.context'));
  fs.writeFileSync(path.join(open, '.context', 'sig-index.json'), '{}\n');
  const w = stateCheck(open);
  assert.strictEqual(w.status, 'warn');
  assert.ok(/not ignored/.test(w.detail), w.detail);

  const none = repo();
  assert.strictEqual(stateCheck(none), undefined, 'no .context/ → no check');

  const noGit = tmp();
  fs.mkdirSync(path.join(noGit, '.context'));
  assert.strictEqual(stateCheck(noGit), undefined, 'not a git repository → no check');
});

// ── runner ──────────────────────────────────────────────────────────────────

(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of cases) {
    try { await t.fn(); console.log(`  PASS  ${t.name}`); passed++; }
    catch (err) { console.log(`  FAIL  ${t.name}: ${err.message}`); failed++; }
  }
  try { fs.rmSync(XDG, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
