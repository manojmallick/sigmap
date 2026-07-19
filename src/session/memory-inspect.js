'use strict';

/**
 * memory-inspect.js — one view over SigMap's existing cross-session stores.
 * No new storage: reads the JSON/NDJSON files the session, notes, weights,
 * evidence, and tracking modules already own under `.context/`.
 */

const fs = require('fs');
const path = require('path');

/** store name → { file, kind } (kind drives the entry count). */
const STORES = {
  session: { file: 'session.json', kind: 'json' },
  notes: { file: 'notes.ndjson', kind: 'ndjson' },
  weights: { file: 'weights.json', kind: 'weights' },
  evidence: { file: 'evidence-pack.json', kind: 'json' },
  gain: { file: 'gain.ndjson', kind: 'ndjson' },
  usage: { file: 'usage.ndjson', kind: 'ndjson' },
};

/** Stores `clearMemory` may delete ('gain'/'usage' have their own reset flows). */
const CLEARABLE = ['session', 'notes', 'weights', 'evidence'];

function storePath(cwd, name) {
  return path.join(cwd, '.context', STORES[name].file);
}

function countEntries(kind, filePath) {
  try {
    if (kind === 'ndjson') {
      return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).length;
    }
    if (kind === 'weights') {
      const w = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Object.keys((w && w.files) || w || {}).length;
    }
    return 1; // json: a single snapshot object
  } catch (_) {
    return 0;
  }
}

/**
 * Describe every cross-session store.
 * @param {string} cwd
 * @returns {Array<{store:string, path:string, exists:boolean, entries:number, bytes:number, modified:string|null, clearable:boolean}>}
 */
function inspectMemory(cwd) {
  return Object.entries(STORES).map(([store, { file, kind }]) => {
    const p = storePath(cwd, store);
    let stat = null;
    try { stat = fs.statSync(p); } catch (_) {}
    return {
      store,
      path: path.join('.context', file),
      exists: !!stat,
      entries: stat ? countEntries(kind, p) : 0,
      bytes: stat ? stat.size : 0,
      modified: stat ? new Date(stat.mtimeMs).toISOString() : null,
      clearable: CLEARABLE.includes(store),
    };
  });
}

/**
 * Delete one clearable store (or 'all' clearable stores).
 * @param {string} cwd
 * @param {string} store - session|notes|weights|evidence|all
 * @returns {string[]} names of stores actually removed
 */
function clearMemory(cwd, store) {
  const targets = store === 'all' ? CLEARABLE : [store];
  for (const t of targets) {
    if (!CLEARABLE.includes(t)) {
      throw new Error(`unknown or protected store "${t}" — clearable: ${CLEARABLE.join(', ')}, all`);
    }
  }
  const removed = [];
  for (const t of targets) {
    try { fs.unlinkSync(storePath(cwd, t)); removed.push(t); } catch (_) {}
  }
  return removed;
}

module.exports = { inspectMemory, clearMemory, STORES, CLEARABLE };
