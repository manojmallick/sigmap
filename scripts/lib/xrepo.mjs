#!/usr/bin/env node
'use strict';

/**
 * xrepo.mjs — the xrepo manifest and checkout state, shared by the fetch
 * script, the gate, the corpus checker and the tests.
 *
 * The manifest (benchmarks/xrepo-repos.json) is the single source of truth for
 * which third-party repositories the labelled corpus is written against and
 * which commit each is pinned to. Zero-dependency; Node built-ins only.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync, execFileSync } from 'child_process';
import { createRequire } from 'module';
import { withSharedRepoContext } from './shared-repo-context.mjs';

const require = createRequire(import.meta.url);

// The generator and the ranker always come from THIS checkout; the manifest,
// the labelled tasks, the baseline and the pinned repos resolve against a data
// root (this checkout by default), which is what lets a test run the real gate
// against a throwaway tree.
export const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const MANIFEST_REL = 'benchmarks/xrepo-repos.json';
export const TASKS_REL = 'benchmarks/tasks/retrieval-xrepo.jsonl';
export const BASELINE_REL = 'benchmarks/xrepo-baseline.json';

/** The parsed manifest. Throws on a missing or malformed file — it is committed. */
export function loadManifest(root) {
  const m = JSON.parse(fs.readFileSync(path.join(root, MANIFEST_REL), 'utf8'));
  if (!m || !Array.isArray(m.repos)) throw new Error(`${MANIFEST_REL}: "repos" must be an array`);
  return m;
}

/** Absolute checkout directory for a manifest entry. */
export function repoDir(root, name) {
  return path.join(root, 'benchmarks', 'repos', name);
}

/** Run git in `dir` with an argument ARRAY (never a shell string). */
export function git(dir, args) {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

/** The commit a checkout is at, or null when `dir` is not a git checkout. */
export function headOf(dir) {
  if (!fs.existsSync(path.join(dir, '.git'))) return null;
  const r = git(dir, ['rev-parse', 'HEAD']);
  return r.ok ? r.out : null;
}

/**
 * Where a manifest entry's checkout stands.
 * @returns {{ dir: string, present: boolean, head: string|null, atPin: boolean }}
 */
export function checkoutState(root, repo) {
  const dir = repoDir(root, repo.name);
  const head = headOf(dir);
  return { dir, present: head !== null, head, atPin: head === repo.commit };
}

let shimDir = null;

/**
 * The environment generation runs in: `python3` is shadowed by a shim that fails
 * at once, so every machine extracts Python with the pure-Node regex extractor.
 *
 * The default Python extractor shells out to the host's `python3` AST, once per
 * file. That makes a committed number depend on which Python is installed — a
 * syntax newer than the host's fails to parse and silently falls back, file by
 * file — and costs minutes on a repo the size of Django (about 2,900 spawns).
 * It is the ONLY host tool the default extraction path consults; the
 * TypeScript, LSP and SCIP tiers are opt-in and off.
 */
export function zeroConfigEnv() {
  if (!shimDir) {
    shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-nopython-'));
    fs.writeFileSync(path.join(shimDir, 'python3'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    process.on('exit', () => { try { fs.rmSync(shimDir, { recursive: true, force: true }); } catch (_) { /* best effort */ } });
  }
  return Object.assign({}, process.env, { PATH: shimDir + path.delimiter + (process.env.PATH || '') });
}

/**
 * Index a checkout the way a first-time user's `sigmap` run does, hand the
 * ranker's signature index to `fn`, and leave the checkout byte-identical.
 *
 * Zero-config on purpose: any `gen-context.config.json` another suite left in
 * the checkout is removed for the run, because a config that happens to exist
 * is exactly how a default-detection bug (#805) hid behind gin's `srcDirs: ["."]`
 * override. The only config applied is the manifest's own `srcDirs`, which is a
 * recorded detection gap rather than a tuning knob.
 *
 * @template T
 * @param {string} root data root holding benchmarks/repos
 * @param {{name:string, srcDirs?:string[]}} repo manifest entry
 * @param {(ctx: {dir:string, index:Map<string,string[]>}) => T} fn
 * @returns {T}
 */
export function withZeroConfigIndex(root, repo, fn) {
  const dir = repoDir(root, repo.name);
  const { buildSigIndex } = require(path.join(CODE_ROOT, 'src/retrieval/ranker'));
  return withSharedRepoContext(dir, {
    generate() {
      const cfg = path.join(dir, 'gen-context.config.json');
      if (repo.srcDirs) fs.writeFileSync(cfg, JSON.stringify({ srcDirs: repo.srcDirs }, null, 2) + '\n');
      else fs.rmSync(cfg, { force: true });
      execFileSync(process.execPath, [path.join(CODE_ROOT, 'gen-context.js')], { cwd: dir, stdio: 'ignore', env: zeroConfigEnv() });
    },
    measure: () => fn({ dir, index: buildSigIndex(dir) }),
  });
}

/** Tasks from a JSONL file, with the 1-based line each came from. */
export function readTasks(file) {
  return fs.readFileSync(file, 'utf8').split('\n').map((line, i) => ({ line: i + 1, text: line.trim() }))
    .filter((l) => l.text)
    .map((l) => Object.assign(JSON.parse(l.text), { _line: l.line }));
}
