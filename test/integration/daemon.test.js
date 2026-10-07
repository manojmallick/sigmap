'use strict';

/**
 * Integration tests for the detached watch daemon (D1, #447).
 *
 * `sigmap daemon start|stop|status` runs `--watch` as a background process,
 * tracked by a PID file under `.context/`. These tests exercise the full
 * lifecycle and always stop any process they start (finally-kill) so the suite
 * never leaves an orphaned watcher behind.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const GEN_CONTEXT = path.resolve(__dirname, '../../gen-context.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

function daemon(dir, ...args) {
  const res = spawnSync(process.execPath, [GEN_CONTEXT, 'daemon', ...args], {
    cwd: dir,
    encoding: 'utf8',
  });
  return { stdout: res.stdout || '', stderr: res.stderr || '', code: res.status };
}

function pidFilePath(dir) {
  return path.join(dir, '.context', 'daemon.pid');
}

function readPid(dir) {
  try {
    return parseInt(fs.readFileSync(pidFilePath(dir), 'utf8').trim(), 10);
  } catch (_) {
    return null;
  }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (err) { return err.code === 'EPERM'; }
}

/** Create a minimal project and always kill any daemon it spawned. */
function withProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-daemon-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'export function hello(name) { return name; }\n');
  try {
    fn(dir);
  } finally {
    const pid = readPid(dir);
    if (pid && alive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch (_) {} }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── status before start ──────────────────────────────────────────────────────

test('status reports "not running" and exits 1 before start', () => {
  withProject((dir) => {
    const r = daemon(dir, 'status');
    assert.strictEqual(r.code, 1, 'status should exit 1 when not running');
    assert.ok(/not running/.test(r.stdout), `expected "not running", got: ${r.stdout}`);
  });
});

// ── start → status → stop lifecycle ──────────────────────────────────────────

test('start launches a detached watcher, writes a live PID, and returns', () => {
  withProject((dir) => {
    const r = daemon(dir, 'start');
    assert.strictEqual(r.code, 0, `start should exit 0, got ${r.code}`);
    assert.ok(/daemon started/.test(r.stdout), `expected "daemon started", got: ${r.stdout}`);

    const pid = readPid(dir);
    assert.ok(Number.isInteger(pid) && pid > 0, 'pid file should hold a valid PID');
    assert.ok(alive(pid), 'the recorded PID should be a live process');

    const st = daemon(dir, 'status');
    assert.strictEqual(st.code, 0, 'status should exit 0 while running');
    assert.ok(new RegExp(`pid ${pid}`).test(st.stdout), `status should report pid ${pid}`);
  });
});

test('start is idempotent — a second start reports "already running", no new process', () => {
  withProject((dir) => {
    daemon(dir, 'start');
    const pid1 = readPid(dir);
    const r = daemon(dir, 'start');
    assert.ok(/already running/.test(r.stdout), `expected "already running", got: ${r.stdout}`);
    const pid2 = readPid(dir);
    assert.strictEqual(pid2, pid1, 'PID must not change on a repeat start');
  });
});

test('stop terminates the watcher and removes the PID file', () => {
  withProject((dir) => {
    daemon(dir, 'start');
    const pid = readPid(dir);
    const r = daemon(dir, 'stop');
    assert.strictEqual(r.code, 0, 'stop should exit 0');
    assert.ok(/daemon stopped/.test(r.stdout), `expected "daemon stopped", got: ${r.stdout}`);
    assert.ok(!fs.existsSync(pidFilePath(dir)), 'pid file should be removed after stop');
    // give the OS a moment to reap the signalled process
    const deadline = Date.now() + 3000;
    while (alive(pid) && Date.now() < deadline) { /* spin briefly */ }
    assert.ok(!alive(pid), 'the watcher process should be gone after stop');

    const st = daemon(dir, 'status');
    assert.strictEqual(st.code, 1, 'status should exit 1 after stop');
  });
});

// ── edge cases ───────────────────────────────────────────────────────────────

test('stop when nothing is running is a no-op ("not running")', () => {
  withProject((dir) => {
    const r = daemon(dir, 'stop');
    assert.ok(/not running/.test(r.stdout), `expected "not running", got: ${r.stdout}`);
  });
});

test('a stale PID file is cleaned up by status', () => {
  withProject((dir) => {
    fs.mkdirSync(path.join(dir, '.context'), { recursive: true });
    fs.writeFileSync(pidFilePath(dir), '999999\n'); // very unlikely to be a live PID
    const r = daemon(dir, 'status');
    assert.strictEqual(r.code, 1, 'stale pid → not running (exit 1)');
    assert.ok(!fs.existsSync(pidFilePath(dir)), 'stale pid file should be removed');
  });
});

test('unknown or missing subcommand prints usage and exits 1', () => {
  withProject((dir) => {
    const bad = daemon(dir, 'frobnicate');
    assert.strictEqual(bad.code, 1);
    assert.ok(/usage: sigmap daemon/.test(bad.stderr), `expected usage, got: ${bad.stderr}`);
    const none = daemon(dir);
    assert.strictEqual(none.code, 1);
    assert.ok(/usage: sigmap daemon/.test(none.stderr), `expected usage, got: ${none.stderr}`);
  });
});

test('--json emits a machine-readable status', () => {
  withProject((dir) => {
    const before = daemon(dir, 'status', '--json');
    const b = JSON.parse(before.stdout);
    assert.strictEqual(b.running, false, 'running:false before start');

    daemon(dir, 'start');
    const after = daemon(dir, 'status', '--json');
    const a = JSON.parse(after.stdout);
    assert.strictEqual(a.running, true, 'running:true after start');
    assert.strictEqual(a.pid, readPid(dir), 'json pid matches pid file');
    assert.ok(typeof a.logFile === 'string' && a.logFile.length > 0, 'json includes logFile');
  });
});

// ── exit codes and --json shapes, as documented (#918) ───────────────────────
// `status` exits 1 when nothing runs (human AND --json form); start / stop exit 0.
// The three subcommands print three different JSON shapes — only `status` has `running`.
//
// These pin the CLI's contract, not the watcher's lifetime, so they run against a
// stand-in process whose PID is in the pid file. The real watcher cannot be relied
// on to still be alive a few calls after `start`: on Linux with Node 18,
// `fs.watch(dir, { recursive: true })` throws ERR_FEATURE_UNAVAILABLE_ON_PLATFORM
// and the watcher exits right after its first generate (found by these tests in CI).
const { spawn } = require('child_process');

function withLiveStandIn(dir, fn) {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1e6)'], { stdio: 'ignore' });
  try {
    fs.mkdirSync(path.join(dir, '.context'), { recursive: true });
    fs.writeFileSync(pidFilePath(dir), `${child.pid}\n`);
    fn(child.pid);
  } finally {
    try { process.kill(child.pid, 'SIGKILL'); } catch (_) {}
  }
}

test('status exits 1 when not running and 0 when running, in both output forms', () => {
  withProject((dir) => {
    assert.strictEqual(daemon(dir, 'status').code, 1);
    assert.strictEqual(daemon(dir, 'status', '--json').code, 1, '--json must keep the exit code');
    withLiveStandIn(dir, (pid) => {
      const human = daemon(dir, 'status');
      assert.strictEqual(human.code, 0);
      assert.ok(new RegExp(`pid ${pid}`).test(human.stdout), human.stdout);
      assert.strictEqual(daemon(dir, 'status', '--json').code, 0);
      assert.strictEqual(daemon(dir, 'stop').code, 0);
    });
    assert.strictEqual(daemon(dir, 'status').code, 1, 'status exits 1 once stopped');
    assert.strictEqual(daemon(dir, 'stop').code, 0, 'stop is a no-op when nothing runs');
  });
});

test('start exits 0 and prints its result, whatever becomes of the watcher', () => {
  withProject((dir) => {
    const r = daemon(dir, 'start');
    assert.strictEqual(r.code, 0, r.stderr);
    assert.ok(/daemon started \(pid \d+\)/.test(r.stdout), r.stdout);
  });
});

test('--json shapes: start and stop print { status, pid }, only status prints { running }', () => {
  withProject((dir) => {
    const started = JSON.parse(daemon(dir, 'start', '--json').stdout);
    assert.strictEqual(started.status, 'started');
    assert.ok(Number.isInteger(started.pid) && typeof started.logFile === 'string');
    assert.ok(!('running' in started));
  });
  withProject((dir) => {
    withLiveStandIn(dir, (pid) => {
      const again = JSON.parse(daemon(dir, 'start', '--json').stdout);
      assert.strictEqual(again.status, 'already');
      assert.strictEqual(again.pid, pid);
      const st = JSON.parse(daemon(dir, 'status', '--json').stdout);
      assert.deepStrictEqual(Object.keys(st).sort(), ['logFile', 'pid', 'pidFile', 'running']);
      assert.strictEqual(st.running, true);
      const stopped = JSON.parse(daemon(dir, 'stop', '--json').stdout);
      assert.strictEqual(stopped.status, 'stopped');
      assert.strictEqual(stopped.pid, pid);
      assert.ok(!('running' in stopped));
    });
    assert.strictEqual(JSON.parse(daemon(dir, 'stop', '--json').stdout).status, 'not-running');
    const idle = JSON.parse(daemon(dir, 'status', '--json').stdout);
    assert.strictEqual(idle.running, false);
    assert.deepStrictEqual(Object.keys(idle).sort(), ['logFile', 'pid', 'pidFile', 'running']);
  });
});

test('the help row and the quick reference both state the exit code (#918)', () => {
  const row = require(path.resolve(__dirname, '../../src/cli/command-table')).USAGE
    .find((r) => r.argv === 'daemon start|stop|status');
  assert.ok(/status exits 1 when not running/.test(row.desc), row.desc);
  const cli = fs.readFileSync(path.resolve(__dirname, '../../docs-vp/guide/cli.md'), 'utf8');
  const quickRef = cli.split('\n').find((l) => l.startsWith('| `daemon start\\|stop\\|status`'));
  assert.ok(quickRef && /exits 1 when not running/.test(quickRef), quickRef);
});

console.log('');
console.log(`daemon: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
