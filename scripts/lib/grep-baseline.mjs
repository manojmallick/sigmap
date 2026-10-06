#!/usr/bin/env node
'use strict';

/**
 * grep-baseline.mjs — the single-shot grep-agent the honest benchmark compares SigMap with.
 *
 * Moved out of run-honest-benchmark.mjs (#905) so the autopsy can ask the same
 * question of a miss — would a whole-file term scan have found this answer? — with
 * the same scan. The scan itself is unchanged: pure Node fs, no ripgrep, no child
 * processes, deterministic. It ranks files by how many distinct query terms they
 * hold, then by occurrences.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { STOP } = require(path.join(CODE_ROOT, 'src', 'retrieval', 'bm25.js'));

// Dirs a grep agent never scans (ripgrep skips VCS + honors .gitignore).
const SKIP_DIRS = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'vendor', 'dist', 'build', 'target',
  'out', 'coverage', '.next', '__pycache__', '.venv', 'venv', '.tox',
]);
const MAX_FILE_BYTES = 1024 * 1024; // grep-realistic cap; skips lockfile giants

const norm = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '');

/** Significant literal query terms — no stemming; grep matches literals. */
function terms(query) {
  return [...new Set(
    String(query).toLowerCase().split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP.has(w))
  )];
}

/** Top-level directory patterns from a repo's .gitignore (simple names only). */
function gitignoreDirs(repoPath) {
  const dirs = new Set();
  try {
    const src = fs.readFileSync(path.join(repoPath, '.gitignore'), 'utf8');
    for (const raw of src.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('!')) continue;
      const m = line.match(/^\/?([A-Za-z0-9._-]+)\/?$/);
      if (m) dirs.add(m[1]);
    }
  } catch (_) { /* no .gitignore — nothing to skip */ }
  return dirs;
}

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack, needle) {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) { n++; i = haystack.indexOf(needle, i + needle.length); }
  return n;
}

/**
 * Scan a repo once and rank files for every task's term set. `skipFile(relPath)` leaves a file
 * out of the scan (default: none — what the published baseline does).
 * @returns {{ ranked: Map<string, string[]>, filesScanned: number }}
 *   ranked: task id → top-10 relative file paths; filesScanned: repo size
 *   basis for the A3 bucket (files the scan visited — NOT the budget-capped
 *   context index, which measures maxTokens rather than the repo).
 */
function grepRank(repoPath, tasks, { skipFile = null } = {}) {
  const perTask = new Map(tasks.map((t) => [t.id, new Map()])); // id → file → {cover, occ}
  const termSets = tasks.map((t) => ({ id: t.id, terms: terms(t.query) }));
  const ignored = gitignoreDirs(repoPath);
  let filesScanned = 0;

  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name)); // deterministic order
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || ignored.has(e.name)) continue;
        walk(full);
        continue;
      }
      if (!e.isFile()) continue;
      if (skipFile && skipFile(norm(path.relative(repoPath, full)))) continue;
      filesScanned++;
      let buf;
      try {
        if (fs.statSync(full).size > MAX_FILE_BYTES) continue;
        buf = fs.readFileSync(full);
      } catch (_) { continue; }
      if (buf.subarray(0, 8192).includes(0)) continue; // binary
      const text = buf.toString('utf8').toLowerCase();
      const rel = norm(path.relative(repoPath, full));

      const termCount = new Map(); // term → occurrences in this file (shared across tasks)
      for (const { id, terms: ts } of termSets) {
        let cover = 0, occ = 0;
        for (const t of ts) {
          if (!termCount.has(t)) termCount.set(t, countOccurrences(text, t));
          const c = termCount.get(t);
          if (c > 0) { cover++; occ += c; }
        }
        if (cover > 0) perTask.get(id).set(rel, { cover, occ });
      }
    }
  };
  walk(repoPath);

  const ranked = new Map();
  for (const [id, fileScores] of perTask) {
    ranked.set(id, [...fileScores.entries()]
      .sort((a, b) => b[1].cover - a[1].cover || b[1].occ - a[1].occ || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([file]) => file));
  }
  return { ranked, filesScanned };
}

export { SKIP_DIRS, MAX_FILE_BYTES, terms, gitignoreDirs, grepRank };

/**
 * Every file SigMap itself writes into a repository: each adapter's output and the `.context/`
 * directory. A grep over a benchmark clone that has been indexed matches these first — they hold
 * every identifier in the repository — so they are not what a person grepping the code would see.
 *
 * @param {string} repoPath
 * @returns {(relPath:string)=>boolean} true for a file SigMap wrote
 */
export function sigmapOutputs(repoPath) {
  const adapters = require(path.join(CODE_ROOT, 'packages', 'adapters'));
  const written = new Set();
  for (const name of adapters.listAdapters()) {
    try {
      const out = adapters.getAdapter(name).outputPath(repoPath);
      if (typeof out === 'string') written.add(String(path.isAbsolute(out) ? path.relative(repoPath, out) : out).replace(/\\/g, '/'));
    } catch (_) { /* an adapter without a file output writes nothing here */ }
  }
  return (rel) => rel === '.context' || rel.startsWith('.context/') || written.has(rel);
}
