'use strict';

/**
 * Detached watch daemon (D1).
 *
 * Runs the existing `--watch` mode as a background process so the index stays
 * fresh without holding a terminal. State lives under `.context/` (consistent
 * with session/usage): `daemon.pid` records the watcher's PID, `daemon.log`
 * captures its output.
 *
 * Zero-dependency and shell-free: the watcher is launched with
 * `spawn(process.execPath, [gen-context.js, '--watch'], { detached: true })` —
 * an arguments array, never a shell command string.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

module.exports = { start, stop, status, pidFile, logFile, isAlive, readPid };

function daemonDir(cwd) {
  return path.join(cwd, '.context');
}

function pidFile(cwd) {
  return path.join(daemonDir(cwd), 'daemon.pid');
}

function logFile(cwd) {
  return path.join(daemonDir(cwd), 'daemon.log');
}

/** True if a process with this PID exists (signal 0 probes without killing). */
function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = the process exists but is owned by another user — treat as alive.
    return err.code === 'EPERM';
  }
}

/** Read the recorded PID, or null if the file is missing/unparseable. */
function readPid(cwd) {
  try {
    const raw = fs.readFileSync(pidFile(cwd), 'utf8').trim();
    const pid = parseInt(raw, 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (_) {
    return null;
  }
}

function removePidFile(cwd) {
  try {
    fs.unlinkSync(pidFile(cwd));
  } catch (_) {}
}

/**
 * @returns {{ running: boolean, pid: number|null, pidFile: string, logFile: string }}
 */
function status(cwd) {
  const pid = readPid(cwd);
  const running = pid != null && isAlive(pid);
  // A recorded-but-dead PID is stale — clean it up so the state stays truthful.
  if (pid != null && !running) removePidFile(cwd);
  return { running, pid: running ? pid : null, pidFile: pidFile(cwd), logFile: logFile(cwd) };
}

/**
 * Launch a detached `--watch` process. Idempotent: if one is already running
 * this is a no-op that reports the existing PID.
 *
 * @param {string} cwd
 * @param {{ scriptPath: string }} opts - path to gen-context.js (the CLI entry)
 * @returns {{ status: 'started'|'already', pid: number, logFile: string }}
 */
function start(cwd, opts = {}) {
  const scriptPath = opts.scriptPath;
  if (!scriptPath) throw new Error('daemon.start requires opts.scriptPath');

  const current = status(cwd);
  if (current.running) {
    return { status: 'already', pid: current.pid, logFile: logFile(cwd) };
  }

  fs.mkdirSync(daemonDir(cwd), { recursive: true });
  const out = fs.openSync(logFile(cwd), 'a');
  try {
    const child = spawn(process.execPath, [scriptPath, '--watch'], {
      cwd,
      detached: true,
      stdio: ['ignore', out, out],
    });
    child.unref();
    fs.writeFileSync(pidFile(cwd), String(child.pid) + '\n');
    return { status: 'started', pid: child.pid, logFile: logFile(cwd) };
  } finally {
    try { fs.closeSync(out); } catch (_) {}
  }
}

/**
 * Stop the running watcher (SIGTERM) and clear its PID file.
 *
 * @returns {{ status: 'stopped'|'not-running'|'stale', pid?: number }}
 */
function stop(cwd) {
  const pid = readPid(cwd);
  if (pid == null) return { status: 'not-running' };
  if (!isAlive(pid)) {
    removePidFile(cwd);
    return { status: 'stale', pid };
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch (_) {}
  removePidFile(cwd);
  return { status: 'stopped', pid };
}
