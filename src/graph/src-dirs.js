'use strict';

/**
 * Which directories a graph walk starts from (#934).
 *
 * The import graph, the call graph and the live-overlay freshen each carried
 * their own hard-coded directory list (`src app lib …`), so on any repo without
 * a `srcDirs` pin they walked a different set of files than the index — and on
 * a repo whose code sits in `django/`, `packages/*`, `internal/` or the repo
 * root itself, none at all. This is the one answer they all ask instead.
 *
 * Resolution order, same as the index's own:
 *
 *   1. `gen-context.config.json` `srcDirs`        — the project's own pin
 *   2. the source roots detection chose           — what `generate` walks
 *      PLUS the conventional defaults the caller passes (union, so no repo ends
 *      up with a smaller walk than it had before detection was consulted)
 *
 * An explicit `opts.srcDirs` from a caller is resolved by the caller and never
 * reaches here.
 *
 * Reads the config file directly rather than through `loadConfig`, which can
 * fetch `extends` over the network and spawn a child process — neither belongs
 * inside a graph build. Detection failing for any reason degrades to the
 * caller's defaults; it never throws into a graph build.
 *
 * Zero-dependency, bundle-safe.
 */

const fs = require('fs');
const path = require('path');

// Never source, whatever a project's own `exclude` says: a config that lists
// only `["dist"]` still must not send a walk into node_modules or .git.
const ALWAYS_EXCLUDED = ['node_modules', '.git'];

function readConfig(cwd) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(cwd, 'gen-context.config.json'), 'utf8'));
    return cfg && typeof cfg === 'object' ? cfg : null;
  } catch (_) { return null; /* absent or unparsable — the caller falls back */ }
}

/**
 * Source directories pinned in the project's own config, or null.
 * @param {string} cwd
 * @returns {string[]|null}
 */
function configuredSrcDirs(cwd) {
  const cfg = readConfig(cwd);
  return cfg && Array.isArray(cfg.srcDirs) && cfg.srcDirs.length > 0 ? cfg.srcDirs : null;
}

/**
 * The exclude list the index walks with: the project's own `exclude` when it
 * sets one (the loader replaces the default array, not merges it), else the
 * shipped default. Always keeps node_modules and .git out.
 */
function excludeList(cfg) {
  let base;
  if (cfg && Array.isArray(cfg.exclude)) base = cfg.exclude;
  else base = require('../config/defaults').DEFAULTS.exclude;
  return [...new Set([...ALWAYS_EXCLUDED, ...base])];
}

// Detection walks the tree and asks git which directories changed recently —
// tens of milliseconds on a small repo, a few hundred on a large one — and a
// long-lived process (the MCP server, `watch`) asks on every read. A repo's
// roots do not change between two reads seconds apart, so one answer is reused
// briefly. The config file is NOT cached: a pin added a moment ago must win.
const DETECT_TTL_MS = 10000;
const _detected = new Map();

function detectedRoots(cwd, exclude) {
  const key = cwd + '\0' + exclude.join('\n');
  const now = Date.now();
  const hit = _detected.get(key);
  if (hit && now - hit.at < DETECT_TTL_MS) return hit.roots;

  let roots = [];
  try {
    const { resolveSourceRoots } = require('../discovery/source-root-resolver');
    const result = resolveSourceRoots(cwd, { exclude });
    if (Array.isArray(result.roots)) roots = result.roots;
  } catch (_) { /* degrade to the caller's defaults */ }
  _detected.set(key, { at: now, roots });
  return roots;
}

/** Forget remembered detections — for tests that change a layout in place. */
function clearDetectionCache() { _detected.clear(); }

// Repo-relative, forward-slashed, no leading `./` or trailing `/` — the form
// two spellings of one directory compare equal in.
const norm = (d) => String(d).replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/+$/, '') || '.';

/** Order-preserving union; a directory spelled twice is kept once. */
function mergeDirs(first, second) {
  const seen = new Set();
  const out = [];
  for (const d of [...first, ...second]) {
    const key = norm(d);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

/**
 * Resolve the directories a graph walk starts from.
 *
 * @param {string}   cwd
 * @param {string[]} defaults  the conventional names the caller always tried
 * @returns {{ srcDirs: string[], exclude: string[]|null, source: 'config'|'detected' }}
 *   `exclude` is null for a pinned config — the caller keeps its own legacy
 *   list there, so a pinned repo's graph is exactly what it was. It is the
 *   index's list when the dirs came from detection, because a detected root can
 *   be `.` (a flat Go module) and a walk from there must skip build output.
 */
function resolveGraphDirs(cwd, defaults) {
  const pinned = configuredSrcDirs(cwd);
  if (pinned) return { srcDirs: pinned, exclude: null, source: 'config' };

  const exclude = excludeList(readConfig(cwd));
  return {
    srcDirs: mergeDirs(detectedRoots(cwd, exclude), defaults || []),
    exclude,
    source: 'detected',
  };
}

module.exports = { resolveGraphDirs, configuredSrcDirs, mergeDirs, clearDetectionCache, ALWAYS_EXCLUDED };
