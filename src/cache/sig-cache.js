'use strict';

/**
 * Incremental extraction cache (v6.1).
 *
 * Stores extracted signatures keyed by file path + mtime so only
 * modified files are re-extracted on subsequent runs.
 *
 * Cache file: .sigmap-cache.json in cwd (gitignored).
 * Format:
 *   { sigmapVersion: string, entries: { [absPath]: { mtime: number, sigs: string[] } } }
 */

const fs   = require('fs');
const path = require('path');

const CACHE_FILE = '.sigmap-cache.json';

function cachePath(cwd) {
  return path.join(cwd, CACHE_FILE);
}

/**
 * Load the cache from disk.
 * Returns a Map<absPath, { mtime: number, sigs: string[] }>.
 * Returns an empty Map if cache is absent, corrupt, or from a different version.
 *
 * @param {string} cwd
 * @param {string} currentVersion - sigmap VERSION constant
 * @returns {Map<string, { mtime: number, sigs: string[] }>}
 */
function loadCache(cwd, currentVersion) {
  try {
    const raw = fs.readFileSync(cachePath(cwd), 'utf8');
    const data = JSON.parse(raw);
    // Bust cache on version change to avoid stale sig formats
    if (data.sigmapVersion !== currentVersion) return new Map();
    return new Map(Object.entries(data.entries || {}));
  } catch (_) {
    return new Map();
  }
}

/**
 * Persist the cache to disk.
 *
 * @param {string} cwd
 * @param {string} currentVersion
 * @param {Map<string, { mtime: number, sigs: string[] }>} cache
 */
function saveCache(cwd, currentVersion, cache) {
  try {
    const data = {
      sigmapVersion: currentVersion,
      entries: Object.fromEntries(cache),
    };
    fs.writeFileSync(cachePath(cwd), JSON.stringify(data), 'utf8');
  } catch (_) {
    // Non-fatal: cache save failure just means a full re-extract next run
  }
}

/**
 * Given a list of absolute file paths, return only those whose mtime
 * differs from the cached value (or that are not cached at all).
 *
 * @param {string[]} files - absolute paths
 * @param {Map<string, { mtime: number, sigs: string[] }>} cache
 * @returns {{ changed: string[], unchanged: string[] }}
 */
function getChangedFiles(files, cache) {
  const changed = [];
  const unchanged = [];
  for (const f of files) {
    try {
      const mtime = fs.statSync(f).mtimeMs;
      const cached = cache.get(f);
      if (!cached || cached.mtime !== mtime) {
        changed.push(f);
      } else {
        unchanged.push(f);
      }
    } catch (_) {
      changed.push(f); // file unreadable → treat as changed
    }
  }
  return { changed, unchanged };
}

/**
 * Update cache entries for a batch of files after fresh extraction.
 *
 * @param {Map<string, { mtime: number, sigs: string[] }>} cache
 * @param {{ file: string, sigs: string[] }[]} extracted - freshly extracted results
 */
function updateCacheEntries(cache, extracted) {
  for (const { file, sigs } of extracted) {
    try {
      const mtime = fs.statSync(file).mtimeMs;
      cache.set(file, { mtime, sigs });
    } catch (_) {}
  }
}

module.exports = { loadCache, saveCache, getChangedFiles, updateCacheEntries };
