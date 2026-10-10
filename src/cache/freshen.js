'use strict';

/**
 * Read-time self-heal (IMPL.md Layer 1, "safety net" tier).
 *
 * Keeps the live overlay (cache/overlay.js) in line with the current source tree
 * so the index reflects on-disk reality even when no write hook was called.
 * Re-extracts files modified since the index was built (bounded to actual
 * session edits, not the whole tree) and records them as overlay entries.
 * buildSigIndex applies the overlay over the base index and an entry REPLACES
 * the file's base entry, so the next read is fresh — including a renamed or
 * removed symbol, which the old additive cache merge could never show (#926).
 *
 * Throttled per cwd. Skips entirely when there is no generated index to heal
 * (a cold repo should run `generate` or use the notify hooks). Deleted files are
 * not swept here (that is a stat per indexed file on every read): the watcher
 * and `notify_file_deleted` record those as they happen.
 *
 * Zero-dependency, bundle-safe (fs + dispatch + overlay).
 */

const fs = require('fs');
const path = require('path');
const overlay = require('./overlay');
const { readIndexStamp } = require('../retrieval/sig-index-store');
const { entryConfig, entrySigs } = require('./entry');
const { langFor } = require('../extractors/dispatch');
const { loadIgnorePatterns, matchesIgnore } = require('../util/ignore');
const { resolveGraphDirs } = require('../graph/src-dirs');

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
// A file time this far ahead of the clock cannot be ordered against any entry's stamp. The slack
// keeps whole-millisecond clocks and filesystem timestamp granularity from tripping the rule.
const FUTURE_SLACK_MS = 1000;
const _lastRun = new Map();

function _readConfig(cwd) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(cwd, 'gen-context.config.json'), 'utf8'));
    return cfg && typeof cfg === 'object' ? cfg : {};
  } catch (_) { return {}; }
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
 * Re-extract source files changed since the last generate.
 * @param {string} cwd
 * @param {{force?:boolean, now?:number}} [opts]
 * @returns {number} overlay entries written
 */
function freshen(cwd, opts = {}) {
  const now = opts.now != null ? opts.now : Date.now();
  if (!opts.force) {
    if (now - (_lastRun.get(cwd) || 0) < THROTTLE_MS) return 0;
  }
  _lastRun.set(cwd, now);

  try {
    // When the base index began: the retrieval index knows exactly (read from its
    // head, not parsed); a repo with only a context file falls back to that
    // file's mtime.
    const stamp = readIndexStamp(cwd);
    const base = Number.isFinite(stamp) ? stamp : _contextMtime(cwd);
    const entries = overlay.load(cwd);
    // Nothing to heal: no generated context AND no live overlay.
    if (base === 0 && entries.size === 0) return 0;

    const cfg = _readConfig(cwd);
    // A pin wins; without one, the roots detection chose (#934) — otherwise a
    // zero-config repo whose code sits in `django/` or `internal/` never has an
    // edit healed, and `ask` answers from the pre-edit index.
    const srcDirs = Array.isArray(cfg.srcDirs) && cfg.srcDirs.length
      ? cfg.srcDirs
      : resolveGraphDirs(cwd, DEFAULT_SRC_DIRS).srcDirs;
    const exclude = new Set([...DEFAULT_EXCLUDE, ...(Array.isArray(cfg.exclude) ? cfg.exclude : [])]);
    const maxDepth = Number.isFinite(cfg.maxDepth) ? cfg.maxDepth : 8;

    const walked = [];
    for (const d of srcDirs) {
      const abs = path.isAbsolute(d) ? d : path.join(cwd, d);
      if (fs.existsSync(abs)) _walk(abs, exclude, walked, 0, maxDepth);
    }
    // Roots may nest (`.` beside `src`); a file is healed once however often the
    // walk reached it.
    const files = [...new Set(walked)];

    // Candidates = files changed after the index began that the overlay has not
    // already described (an entry stamped at or after the change has). "Changed"
    // is the later of mtime and ctime: `mv`, `git mv` and `cp -p` keep a file's
    // mtime but move its ctime, and a moved file is new to the index.
    const stale = [];
    const ignore = loadIgnorePatterns(cwd); // the same filter a full run applies
    for (const f of files) {
      let changed;
      try { const st = fs.statSync(f); changed = Math.max(st.mtimeMs, st.ctimeMs); } catch (_) { continue; }
      if (changed <= base) continue;
      const key = overlay.relKey(cwd, f);
      if (!key || matchesIgnore(key, ignore)) continue;
      const have = entries.get(key);
      // An additive entry vouches only for the symbol it added, not the file.
      // A timestamp in the future (clock skew, a restored file) cannot be ordered
      // against any entry's stamp, so a whole-file entry that exists covers it —
      // otherwise it would be read again on every call. Whole-ms stamp vs a
      // fractional file time, hence the floor.
      if (have && !have.additive && (have.at >= Math.floor(changed) || changed > Date.now() + FUTURE_SLACK_MS)) continue;
      stale.push({ f, key });
    }
    if (stale.length === 0) return 0;

    const entryCfg = entryConfig(cwd);
    const fresh = [];
    for (const { f, key } of stale) {
      try {
        const at = Date.now(); // before the read: an edit during it stays uncovered
        const sigs = entrySigs(f, fs.readFileSync(f, 'utf8'), cwd, entryCfg);
        // An empty result is not recorded: this tier cannot tell a file with no
        // signatures from an extractor that failed, and a wrong removal is worse
        // than a stale entry the next full run replaces. A scanner that cannot
        // run throws and lands here too — nothing unredacted is ever stored.
        if (sigs.length > 0) fresh.push([key, { at, sigs }]);
      } catch (_) {}
    }
    if (fresh.length > 0) overlay.update(cwd, (m) => { for (const [k, e] of fresh) overlay.put(m, k, e); });
    return fresh.length;
  } catch (_) {
    return 0;
  }
}

module.exports = { freshen };
