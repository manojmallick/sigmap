#!/usr/bin/env node
'use strict';

/**
 * warm-cache.mjs — running `gen-context.js` on a throwaway copy of a repository and
 * comparing what it writes, shared by `run-perf-benchmark.mjs`, the determinism gate
 * and the tests of the extraction cache (#971).
 *
 * Two things are measured here, and kept apart on purpose:
 *
 *   - Equivalence: a run that reads the cache writes exactly what a run that does not
 *     write. The outputs compared are the generated context file and the retrieval
 *     index, minus the two places a clock goes (the `Updated:` stamp, the index's
 *     `generated` / `startedAt`).
 *   - Cost: the CPU time (user + sys) of the child, by the shell's own `times` builtin,
 *     so no measuring tool has to be installed. CPU time is not wall time: it does not
 *     grow when the machine is busy waiting, but it is not immune to contention either,
 *     so the load average is recorded beside every figure.
 *
 * Zero-dependency; Node built-ins only.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

/** Outputs the default run writes, repo-relative. */
export const CONTEXT_FILE = '.github/copilot-instructions.md';
export const INDEX_FILE = '.context/sig-index.json';

/** A throwaway directory under the OS temp dir. */
export function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Copy a repository (its `.git` included: the run reads history) to `dest`. */
export function copyRepo(src, dest) {
  // A clone that is itself a symlink (a worktree borrowing shared clones) is copied as the directory it names.
  fs.cpSync(fs.realpathSync(src), dest, { recursive: true, verbatimSymlinks: true });
}

/**
 * Put a checkout back to what it was: untracked files (the run's outputs, `.context/`) gone,
 * tracked files as committed. Only for a throwaway copy.
 */
export function resetCopy(dir) {
  spawnSync('git', ['-C', dir, 'clean', '-fdxq'], { stdio: 'ignore' });
  spawnSync('git', ['-C', dir, 'checkout', '-q', '--', '.'], { stdio: 'ignore' });
}

/**
 * An environment with no python3 on PATH: a directory holding only node and git. (A shim that
 * fails is not "no python3": a python3 that is there and fails gives the regex tier's answer for
 * one run, and the extraction cache does not keep it.)
 */
export function noPythonEnv() {
  const dir = tempDir('sigmap-nopy-');
  const find = (name) => {
    for (const d of String(process.env.PATH || '').split(path.delimiter)) {
      const f = path.join(d, name);
      try { if (fs.statSync(f).isFile()) return f; } catch (_) { /* not here */ }
    }
    return null;
  };
  fs.symlinkSync(process.execPath, path.join(dir, 'node'));
  const git = find('git');
  if (git) fs.symlinkSync(git, path.join(dir, 'git'));
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* best effort */ } });
  return Object.assign({}, process.env, { PATH: dir });
}

/** Parse the second line of the shell's `times` ("0m1.200s 0m0.400s") into seconds. */
export function parseTimes(text) {
  const lines = String(text).trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  const parts = [...last.matchAll(/(\d+)m([\d.]+)s/g)].map((m) => Number(m[1]) * 60 + Number(m[2]));
  if (parts.length < 2) return null;
  return parts[0] + parts[1];
}

/**
 * Run the generator once in `dir` and report what it cost.
 *
 * @param {string} dir      the repository copy (cwd of the run)
 * @param {string} script   absolute path of the gen-context.js to run
 * @param {object} [opts]
 * @param {object} [opts.env]  environment of the child (default: this process's)
 * @param {string[]} [opts.args]  extra arguments
 * @returns {{ status: number|null, cpu: number|null, wall: number, stderr: string, load: number }}
 */
export function runOnce(dir, script, opts = {}) {
  const t0 = Date.now();
  const load = os.loadavg()[0];
  // The shell runs the generator, then prints the CPU time its children used.
  const r = spawnSync('/bin/sh', ['-c', '"$0" "$@" >/dev/null 2>&1 </dev/null; echo "$?" >&3; times >&3', process.execPath, script, ...(opts.args || [])], {
    cwd: dir,
    env: opts.env || process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'ignore', 'pipe'],
    maxBuffer: 1 << 24,
  });
  const out = String(r.output && r.output[3] ? r.output[3] : '');
  const lines = out.trim().split('\n');
  const code = Number(lines[0]);
  return {
    status: Number.isFinite(code) ? code : r.status,
    cpu: parseTimes(lines.slice(1).join('\n')),
    wall: (Date.now() - t0) / 1000,
    load,
  };
}

/** Run once and keep stderr (the run summary), for a test that reads it. */
export function runCapture(dir, script, opts = {}) {
  const r = spawnSync(process.execPath, [script, ...(opts.args || [])], {
    cwd: dir, env: opts.env || process.env, encoding: 'utf8', maxBuffer: 1 << 26,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/**
 * What a run wrote, with the clock taken out: the context file and the retrieval index.
 * @returns {{ context: string|null, index: string|null }}
 */
export function readOutputs(dir) {
  const read = (rel) => { try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch (_) { return null; } };
  const ctx = read(CONTEXT_FILE);
  const idx = read(INDEX_FILE);
  let index = null;
  if (idx !== null) {
    const j = JSON.parse(idx);
    delete j.generated;
    delete j.startedAt;
    index = JSON.stringify(j);
  }
  return {
    context: ctx === null ? null : ctx.split('\n').filter((l) => !/Updated:/.test(l)).join('\n'),
    index,
  };
}

/** The first difference between two outputs, or null when they are identical. */
export function diffOutputs(a, b) {
  for (const key of ['context', 'index']) {
    if (a[key] === b[key]) continue;
    if (a[key] === null || b[key] === null) return `${key}: one side was not written`;
    const x = a[key];
    const y = b[key];
    let i = 0;
    while (i < x.length && i < y.length && x[i] === y[i]) i++;
    return `${key} differs at byte ${i} (lengths ${x.length} and ${y.length}): ${JSON.stringify(x.slice(Math.max(0, i - 40), i + 60))} vs ${JSON.stringify(y.slice(Math.max(0, i - 40), i + 60))}`;
  }
  return null;
}

/** Write the config a run reads, or remove it when `config` is null. */
export function writeConfig(dir, config) {
  const file = path.join(dir, 'gen-context.config.json');
  if (config === null) fs.rmSync(file, { force: true });
  else fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
}

/**
 * The first tracked source file whose edit changes nothing but its content hash: appends one
 * newline. Picks the file from the retrieval index so it is one the run really reads.
 */
export function pickEditableFile(dir) {
  const idx = JSON.parse(fs.readFileSync(path.join(dir, INDEX_FILE), 'utf8'));
  const names = Object.keys(idx.files).sort();
  const skip = /(^|\/)(tests?|spec|__tests__|\.[^/]*)\//;
  const code = /\.(js|mjs|cjs|ts|tsx|jsx|py|go|rs|java|kt|rb|php|cs|swift|c|cc|cpp|h|hpp|scala|ex|lua|dart)$/;
  const usable = (n) => !skip.test(n) && !n.startsWith('.') && fs.existsSync(path.join(dir, n));
  return names.find((n) => code.test(n) && usable(n)) || names.find(usable) || names[0];
}

/** Append a newline to a file (its signatures do not change, its hash does). */
export function touchContent(dir, rel) {
  fs.appendFileSync(path.join(dir, rel), '\n');
}

/** The median of a list of numbers. */
export function median(xs) {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
