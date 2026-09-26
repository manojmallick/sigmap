#!/usr/bin/env node
'use strict';

/**
 * shared-repo-context.mjs — one hermetic regeneration primitive for every
 * benchmark suite that reads `benchmarks/repos/*`.
 *
 * The repos under `benchmarks/repos/` are SHARED state. `run-honest-benchmark`
 * never regenerates — it reads each repo's context AS-IS via
 * `src/eval/runner.js buildSigIndex`. So any suite that regenerates a repo and
 * leaves the result on disk silently decides what every later suite measures.
 * That is the #522 cross-suite skew, and it regressed (#706) because the
 * previous fixes each covered only part of the artifact set:
 *
 *   - #522 restored `gen-context.config.json` but not the generated context.
 *   - #480 added `snapshotArtifacts`/`restoreArtifacts` for the markdown
 *     adapters, but omitted `.context/` — the directory holding
 *     `sig-index.json`, which is precisely what `ranker.buildSigIndex` reads
 *     (src/retrieval/ranker.js -> sig-index-store.readFullIndex). A
 *     "hermetic" call therefore still left a rewritten retrieval index behind.
 *
 * This module is the single source of truth for both halves: the full artifact
 * set (adapters + config + `.context/`) and the shared per-repo config
 * overrides. A suite that regenerates through `withSharedRepoContext` leaves
 * the repo byte-identical, so suite execution order cannot move a published
 * number.
 *
 * Zero-dependency. Node built-ins only.
 */

import fs from 'fs';
import path from 'path';

/**
 * Every path a `gen-context` run can write inside a target repo.
 *
 * Files are captured as bytes; `.context` is a directory and is captured as a
 * recursive tree. Anything added to the generator's output set belongs here —
 * an omission here is invisible until a benchmark number drifts.
 */
export const CONTEXT_ARTIFACTS = [
  '.github/copilot-instructions.md', 'CLAUDE.md', 'AGENTS.md', 'GEMINI.md',
  '.cursorrules', '.windsurfrules', 'llm.txt', 'llm-full.txt', 'llms.txt',
  'gen-context.config.json',
];

/** Generated directories captured whole, not file-by-file. */
export const CONTEXT_DIRS = ['.context'];

/** Recursively read a directory into a Map<relPath, Buffer>, or null if absent. */
function snapshotDir(absDir) {
  if (!fs.existsSync(absDir)) return null;
  const out = new Map();
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const r = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) walk(abs, r);
      else if (entry.isFile()) out.set(r, fs.readFileSync(abs));
    }
  };
  walk(absDir, '');
  return out;
}

/** Replace `absDir` with the captured tree (or remove it if there was none). */
function restoreDir(absDir, tree) {
  try {
    fs.rmSync(absDir, { recursive: true, force: true });
    if (tree === null) return;
    for (const [rel, bytes] of tree) {
      const abs = path.join(absDir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, bytes);
    }
  } catch (_) { /* best-effort restore */ }
}

/**
 * Capture every context artifact in a repo.
 * @param {string} repoDir
 * @returns {{ files: Map<string, Buffer|null>, dirs: Map<string, Map|null> }}
 */
export function snapshotArtifacts(repoDir) {
  const files = new Map();
  for (const rel of CONTEXT_ARTIFACTS) {
    const p = path.join(repoDir, rel);
    files.set(rel, fs.existsSync(p) ? fs.readFileSync(p) : null);
  }
  const dirs = new Map();
  for (const rel of CONTEXT_DIRS) dirs.set(rel, snapshotDir(path.join(repoDir, rel)));
  return { files, dirs };
}

/**
 * Restore a snapshot taken by {@link snapshotArtifacts}, byte-exactly.
 * @param {string} repoDir
 * @param {{ files: Map, dirs: Map }} snap
 */
export function restoreArtifacts(repoDir, snap) {
  for (const [rel, bytes] of snap.files) {
    const p = path.join(repoDir, rel);
    try {
      if (bytes === null) {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } else {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, bytes);
      }
    } catch (_) { /* best-effort restore */ }
  }
  for (const [rel, tree] of snap.dirs) restoreDir(path.join(repoDir, rel), tree);
}

/**
 * The shared per-repo config overrides — the single source of truth for how
 * each benchmark repo is configured (#522).
 * @param {string} root repository root
 * @returns {Record<string, object>}
 */
export function loadOverrides(root) {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'benchmarks', 'config-overrides.json'), 'utf8'));
}

/**
 * Regenerate a shared benchmark repo, measure it, and leave it byte-identical.
 *
 * The caller supplies `generate` (whatever invocation that suite needs) and
 * `measure` (reads the freshly generated artifacts). Both run with the shared
 * override applied; everything is restored afterwards, including on throw.
 *
 * @template T
 * @param {string} repoDir
 * @param {object} opts
 * @param {object} [opts.override]  per-repo config to apply during generation
 * @param {() => void} opts.generate
 * @param {() => T} opts.measure
 * @returns {T}
 */
export function withSharedRepoContext(repoDir, { override, generate, measure }) {
  const snap = snapshotArtifacts(repoDir);
  try {
    if (override) {
      fs.writeFileSync(
        path.join(repoDir, 'gen-context.config.json'),
        JSON.stringify(override, null, 2) + '\n');
    }
    generate();
    return measure();
  } finally {
    restoreArtifacts(repoDir, snap);
  }
}
