'use strict';

/**
 * grep-scan.js — the single-shot grep the honest benchmark compares SigMap with, for `sigmap advise`.
 *
 * The same scan as scripts/lib/grep-baseline.mjs (`grepRank`), which is not in the published package, so `advise` cannot import it. Pure Node
 * fs, no ripgrep and no child process, deterministic: it ranks files by how many distinct query terms they hold, then by occurrences.
 * test/integration/advise.test.js pins that the two give identical rankings on a fixture, so a change to one that is not made to the other
 * fails there.
 *
 * It leaves out every file SigMap itself wrote (`sigmapOutputs`): a person grepping their code does not see them, and they hold every
 * identifier in the project, so counting them would hand grep an answer key it never had.
 */

const fs = require('fs');
const path = require('path');
const { STOP } = require('../retrieval/bm25');

// Dirs a grep agent never scans (ripgrep skips VCS + honors .gitignore).
const SKIP_DIRS = new Set(['.git', '.hg', '.svn', 'node_modules', 'vendor', 'dist', 'build', 'target', 'out', 'coverage', '.next', '__pycache__', '.venv', 'venv', '.tox']);
const MAX_FILE_BYTES = 1024 * 1024; // grep-realistic cap; skips lockfile giants

const norm = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '');

/** Significant literal query terms: no stemming; grep matches literals. */
function terms(query) {
  return [...new Set(String(query).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)))];
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
  } catch (_) { /* no .gitignore: nothing to skip */ }
  return dirs;
}

function countOccurrences(haystack, needle) {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) { n++; i = haystack.indexOf(needle, i + needle.length); }
  return n;
}

/**
 * Every file SigMap itself writes into a repository: each adapter's output and the `.context/` directory.
 * @param {string} repoPath
 * @returns {(relPath:string)=>boolean} true for a file SigMap wrote
 */
function sigmapOutputs(repoPath) {
  const written = new Set();
  try {
    const adapters = require('../../packages/adapters');
    for (const name of adapters.listAdapters()) {
      try {
        const out = adapters.getAdapter(name).outputPath(repoPath);
        if (typeof out === 'string') written.add(String(path.isAbsolute(out) ? path.relative(repoPath, out) : out).replace(/\\/g, '/'));
      } catch (_) { /* an adapter without a file output writes nothing here */ }
    }
  } catch (_) { /* adapters unavailable: only .context/ is skipped */ }
  return (rel) => rel === '.context' || rel.startsWith('.context/') || written.has(rel);
}

/**
 * Scan a repo once and rank files for every task's term set.
 * @param {string} repoPath
 * @param {Array<{id: string, query: string}>} tasks
 * @param {{ skipFile?: ((rel: string) => boolean) | null, maxFiles?: number }} [opts]
 *   `skipFile(relPath)` leaves a file out of the scan; `maxFiles` stops a scan of an enormous tree (the result then says it was truncated)
 * @returns {{ ranked: Map<string, string[]>, filesScanned: number, truncated: boolean }} id to its top-10 relative paths
 */
function grepRank(repoPath, tasks, opts = {}) {
  const skipFile = opts.skipFile || null;
  const maxFiles = Number.isInteger(opts.maxFiles) && opts.maxFiles > 0 ? opts.maxFiles : Infinity;
  const perTask = new Map(tasks.map((t) => [t.id, new Map()])); // id to file to {cover, occ}
  const termSets = tasks.map((t) => ({ id: t.id, terms: terms(t.query) }));
  const ignored = gitignoreDirs(repoPath);
  let filesScanned = 0;
  let truncated = false;

  const walk = (dir) => {
    if (truncated) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name)); // deterministic order
    for (const e of entries) {
      if (truncated) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || ignored.has(e.name)) continue;
        walk(full);
        continue;
      }
      if (!e.isFile()) continue;
      const rel = norm(path.relative(repoPath, full));
      if (rel === '.context/extract-cache.json') continue;
      if (skipFile && skipFile(rel)) continue;
      if (filesScanned >= maxFiles) { truncated = true; return; }
      filesScanned++;
      let buf;
      try {
        if (fs.statSync(full).size > MAX_FILE_BYTES) continue;
        buf = fs.readFileSync(full);
      } catch (_) { continue; }
      if (buf.subarray(0, 8192).includes(0)) continue; // binary
      const text = buf.toString('utf8').toLowerCase();

      const termCount = new Map(); // term to occurrences in this file (shared across tasks)
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
  return { ranked, filesScanned, truncated };
}

module.exports = { grepRank, sigmapOutputs, terms, SKIP_DIRS, MAX_FILE_BYTES };
