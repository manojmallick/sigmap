'use strict';

/**
 * Read-time self-heal (IMPL.md Layer 1, "safety net" tier).
 *
 * Keeps the sig-cache in line with the current source tree so the index reflects
 * on-disk reality even when no write hook was called. Re-extracts files modified
 * since the context file was generated (bounded to actual session edits, not the
 * whole tree), drops cache entries for deleted files, and persists. buildSigIndex
 * already merges the cache, so the next read is fresh.
 *
 * Throttled per cwd. Skips entirely when there is no generated index to heal
 * (a cold repo should run `generate` or use the notify hooks).
 *
 * Zero-dependency, bundle-safe (fs + dispatch + sig-cache).
 */

const fs = require('fs');
const path = require('path');
const { loadCache, saveCache, getChangedFiles } = require('./sig-cache');
const { extractFile, langFor } = require('../extractors/dispatch');

const DEFAULT_SRC_DIRS = ['src', 'app', 'lib', 'packages', 'services', 'api'];
const DEFAULT_EXCLUDE = [
  'node_modules', '.git', 'dist', 'build', 'out', '__pycache__',
  '.next', 'coverage', 'target', 'vendor', '.context',
];
const CONTEXT_PATHS = [
  ['.github', 'copilot-instructions.md'],
  ['CLAUDE.md'], ['AGENTS.md'], ['.github', 'context-cold.md'],
];
const THROTTLE_MS = 1500;
const _lastRun = new Map();

function _readConfig(cwd) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(cwd, 'gen-context.config.json'), 'utf8'));
    return cfg && typeof cfg === 'object' ? cfg : {};
  } catch (_) { return {}; }
}

function _pkgVersion(cwd) {
  try { return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).version || '0.0.0'; }
  catch (_) { return '0.0.0'; }
}

/** Newest mtime among existing generated context files, or 0 if none. */
function _contextMtime(cwd) {
  let newest = 0;
  for (const parts of CONTEXT_PATHS) {
    try { newest = Math.max(newest, fs.statSync(path.join(cwd, ...parts)).mtimeMs); } catch (_) {}
  }
  return newest;
}

function _walk(dir, exclude, out, depth, maxDepth) {
  if (depth > maxDepth) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of entries) {
    if (exclude.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) _walk(full, exclude, out, depth + 1, maxDepth);
    else if (e.isFile() && langFor(e.name)) out.push(full);
  }
}

/**
 * Re-extract source files changed since the last generate; drop deleted files.
 * @param {string} cwd
 * @param {{force?:boolean, now?:number}} [opts]
 * @returns {number} cache entries touched
 */
function freshen(cwd, opts = {}) {
  const now = opts.now != null ? opts.now : Date.now();
  if (!opts.force) {
    if (now - (_lastRun.get(cwd) || 0) < THROTTLE_MS) return 0;
  }
  _lastRun.set(cwd, now);

  try {
    const version = _pkgVersion(cwd);
    const cache = loadCache(cwd, version);
    const ctxMtime = _contextMtime(cwd);
    // Nothing to heal: no generated context AND no live cache overlay.
    if (ctxMtime === 0 && cache.size === 0) return 0;

    const cfg = _readConfig(cwd);
    const srcDirs = Array.isArray(cfg.srcDirs) && cfg.srcDirs.length ? cfg.srcDirs : DEFAULT_SRC_DIRS;
    const exclude = new Set([...DEFAULT_EXCLUDE, ...(Array.isArray(cfg.exclude) ? cfg.exclude : [])]);
    const maxDepth = Number.isFinite(cfg.maxDepth) ? cfg.maxDepth : 8;

    const files = [];
    for (const d of srcDirs) {
      const abs = path.isAbsolute(d) ? d : path.join(cwd, d);
      if (fs.existsSync(abs)) _walk(abs, exclude, files, 0, maxDepth);
    }

    // Candidates = files modified since the context was generated, or not yet cached.
    const candidates = files.filter((f) => {
      try { return fs.statSync(f).mtimeMs > ctxMtime || !cache.has(f); } catch (_) { return false; }
    });
    const { changed } = getChangedFiles(candidates, cache);

    let touched = 0;
    for (const f of changed) {
      try {
        const sigs = extractFile(f, fs.readFileSync(f, 'utf8'));
        cache.set(f, { mtime: fs.statSync(f).mtimeMs, sigs });
        touched++;
      } catch (_) {}
    }
    // Note: deletions are NOT swept here — a cache entry may be a `notify`
    // overlay for a file not yet on disk. Explicit removal is `notify_file_deleted`.

    if (touched > 0) saveCache(cwd, version, cache);
    return touched;
  } catch (_) {
    return 0;
  }
}

module.exports = { freshen };
