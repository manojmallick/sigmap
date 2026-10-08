'use strict';

/**
 * Live overlay (#926): what changed since the last full index, applied at read time.
 *
 * WHY THIS EXISTS
 * ---------------
 * The retrieval index (`.context/sig-index.json`) is rewritten only by a full
 * `generate`. Between two runs the code keeps changing, and three writers tried
 * to keep queries honest — the MCP notify hooks, the read-time `freshen`, and
 * (now) the watcher. They wrote into `.sigmap-cache.json`, which the reader then
 * MERGED with the index under "the entry with more signatures wins". So an edit
 * could only ever add: rename a function, drop one, or delete a file and the
 * stale entry won, because the old list was as long or longer. Reproduced on
 * v8.71.0: after `freshen()` a renamed symbol was still listed and its new name
 * was not.
 *
 * This store is the authoritative half of that arrangement. An entry says "as of
 * `at`, this file contributes exactly these signatures" (or: nothing, it is gone),
 * and it REPLACES the base entry for as long as it is newer than the base index.
 * Once a full run starts after `at`, the base has seen the change and the entry
 * is simply ignored — no invalidation protocol, no version stamp to disagree about.
 *
 * It is a separate file from `.sigmap-cache.json` on purpose: that cache is
 * version-stamped by SigMap's own VERSION when `generate` writes it and by the
 * PROJECT's package.json version when the hooks write it, so two writers busted
 * each other's entries. This store has no stamp to bust.
 *
 * Entry shapes (keys are repo-relative, forward slashes):
 *   { at, sigs: string[] }                 replace the file's signatures
 *   { at, deleted: true }                  the file contributes nothing now
 *   { at, sigs: string[], additive: true } add these to whatever the file has
 *
 * Zero-dependency, bundle-safe (fs + path only).
 */

const fs = require('fs');
const path = require('path');

const DIR = '.context';
const OVERLAY_FILE = 'overlay.json';
const LIVE_FILE = 'live.json';
const SCHEMA = 1;

// An entry stamped further ahead than this is not a clock error SigMap can reason
// about (an NTP step backwards, a VM resume, a hand-edited file): it would outlive
// every full run and shadow the fresh base entry, so it is not trusted.
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

function overlayPath(cwd) { return path.join(cwd, DIR, OVERLAY_FILE); }
function livePath(cwd) { return path.join(cwd, DIR, LIVE_FILE); }

/** Repo-relative key with forward slashes, or null for a path outside `cwd`. */
function relKey(cwd, p) {
  const rel = path.relative(cwd, path.resolve(cwd, p)).replace(/\\/g, '/');
  return !rel || rel.startsWith('..') ? null : rel;
}

/** Write-then-rename so a concurrent reader never sees half a file. */
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw err;
  }
}

function _valid(e) {
  return !!e && typeof e === 'object' && Number.isFinite(e.at)
    && (e.deleted === true || (Array.isArray(e.sigs) && e.sigs.every((s) => typeof s === 'string')));
}

/**
 * Every overlay entry, or an empty Map when the store is absent or unreadable.
 * @param {string} cwd
 * @returns {Map<string, {at:number, sigs?:string[], deleted?:boolean, additive?:boolean}>}
 */
function load(cwd) {
  const out = new Map();
  try {
    const data = JSON.parse(fs.readFileSync(overlayPath(cwd), 'utf8'));
    if (!data || data.schema !== SCHEMA || !data.entries || typeof data.entries !== 'object') return out;
    const horizon = Date.now() + MAX_FUTURE_SKEW_MS;
    for (const [rel, e] of Object.entries(data.entries)) if (_valid(e) && e.at <= horizon) out.set(rel, e);
  } catch (_) { /* absent or corrupt → nothing is overlaid, the base index stands */ }
  return out;
}

function _save(cwd, entries) {
  writeAtomic(overlayPath(cwd), JSON.stringify({ schema: SCHEMA, entries: Object.fromEntries(entries) }));
}

/**
 * Read-modify-write the store in one step. The function receives the live Map.
 * A failure to write is swallowed: the overlay is an accelerator, never a
 * correctness dependency — the next full run supersedes whatever was lost.
 *
 * @param {string} cwd
 * @param {(entries: Map) => void} fn
 * @returns {boolean} whether the store was written
 */
function update(cwd, fn) {
  try {
    const entries = load(cwd);
    fn(entries);
    _save(cwd, entries);
    return true;
  } catch (_) { return false; }
}

/**
 * Record one entry unless the store already holds a NEWER one for the file. Two
 * writers can race (the watcher, the MCP server's freshen); the later `at` is
 * the better description of the file, so a slow writer must not overwrite it.
 *
 * @returns {boolean} whether the entry was recorded
 */
function put(entries, rel, entry) {
  const cur = entries.get(rel);
  if (cur && cur.at > entry.at) return false;
  entries.set(rel, entry);
  return true;
}

/**
 * Apply the overlay to an index, in place. Entries not newer than the base are
 * skipped — a full run has already seen them.
 *
 * @param {Map<string,string[]>} index
 * @param {Map} entries
 * @param {number|null} baseMs - when the base index began; null/0 → every entry is newer
 * @returns {number} entries applied
 */
function apply(index, entries, baseMs) {
  // `at` is whole milliseconds and a base derived from a file mtime is fractional.
  const since = Number.isFinite(baseMs) ? Math.floor(baseMs) : 0;
  let applied = 0;
  for (const [rel, e] of entries) {
    if (e.at < since) continue;
    if (e.deleted) { if (index.delete(rel)) applied++; continue; }
    if (!e.sigs || e.sigs.length === 0) continue;
    if (e.additive) {
      const have = index.get(rel) || [];
      const merged = have.slice();
      for (const s of e.sigs) if (!merged.includes(s)) merged.push(s);
      index.set(rel, merged);
    } else {
      index.set(rel, e.sigs);
    }
    applied++;
  }
  return applied;
}

/** Entries that are still newer than the base — the overlay's live depth. */
function pending(entries, baseMs) {
  const since = Number.isFinite(baseMs) ? Math.floor(baseMs) : 0;
  const out = new Map();
  for (const [rel, e] of entries) if (e.at >= since) out.set(rel, e);
  return out;
}

/**
 * Drop entries a full run has superseded. Called after a full generate, with the
 * instant that run began.
 * @returns {number} entries removed
 */
function prune(cwd, baseMs) {
  let removed = 0;
  // Nothing superseded → leave the store (and its mtime) alone, and never create it.
  let any = false;
  for (const e of load(cwd).values()) if (e.at < baseMs) { any = true; break; }
  if (!any) return 0;
  update(cwd, (entries) => {
    for (const [rel, e] of [...entries]) {
      if (e.at < baseMs) { entries.delete(rel); removed++; }
    }
  });
  return removed;
}

// ── Live telemetry (.context/live.json) ──────────────────────────────────────
// Facts only the watcher can measure. Written by the watcher process alone;
// everything derivable (overlay depth, staleness) is computed at read time so it
// can never disagree with the overlay it describes.

/** @returns {object|null} the recorded watcher telemetry, or null when none */
function readLive(cwd) {
  try {
    const data = JSON.parse(fs.readFileSync(livePath(cwd), 'utf8'));
    return data && data.schema === SCHEMA ? data : null;
  } catch (_) { return null; }
}

/**
 * Merge `patch` into the telemetry and persist it (`opts.replace` starts from
 * nothing — a fresh watcher must not inherit a dead one's numbers). Never throws.
 */
function writeLive(cwd, patch, opts = {}) {
  try {
    const cur = opts.replace ? {} : (readLive(cwd) || {});
    writeAtomic(livePath(cwd), JSON.stringify(Object.assign({}, cur, patch, { schema: SCHEMA })));
    return true;
  } catch (_) { return false; }
}

module.exports = {
  SCHEMA, overlayPath, livePath, relKey,
  load, update, put, apply, pending, prune,
  readLive, writeLive,
};
