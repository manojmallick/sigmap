'use strict';

/**
 * Convention incremental rescan (IMPL.md §4 — `conventions --update`).
 *
 * Avoids recomputing the conventions snapshot when nothing changed: compare the
 * source files' mtimes to the stored `.context/conventions.json` and only flag a
 * rescan when the snapshot is missing or some file is newer. Pure (fs reads
 * only), zero-dependency, bundle-safe.
 */

const fs = require('fs');

/**
 * Source files modified after a reference time.
 * @param {string[]} files absolute paths
 * @param {number} sinceMs epoch ms threshold
 * @returns {string[]}
 */
function changedSince(files, sinceMs) {
  const out = [];
  for (const f of files || []) {
    try { if (fs.statSync(f).mtimeMs > sinceMs) out.push(f); } catch (_) {}
  }
  return out;
}

/**
 * Decide whether the conventions snapshot needs a rescan.
 * @param {string} cwd repo root (unused but kept for signature symmetry)
 * @param {string[]} files absolute source paths
 * @param {string} snapshotPath path to the stored conventions.json
 * @returns {{ snapshotExists: boolean, stale: boolean, changed: string[] }}
 */
function planUpdate(cwd, files, snapshotPath) {
  let snapshotMs = null;
  try { snapshotMs = fs.statSync(snapshotPath).mtimeMs; } catch (_) {}
  const snapshotExists = snapshotMs != null;
  if (!snapshotExists) {
    return { snapshotExists: false, stale: true, changed: [] };
  }
  const changed = changedSince(files, snapshotMs);
  return { snapshotExists: true, stale: changed.length > 0, changed };
}

module.exports = { changedSince, planUpdate };
