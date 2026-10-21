'use strict';

/**
 * One listing of a directory per run (#971).
 *
 * A generate run walks the same directories several times, each walker with its own rules: the file
 * collector, the test collector, the manifest finder, the coverage count. Each asked the filesystem again
 * (9,116 listings of 3,532 directories on Django), and a listing is the dearest call a warm run still
 * makes. Inside a run (`begin()` ... `end()`) the first listing of a directory is kept and the others
 * are served from it; outside one, every call goes to the filesystem as it always did.
 *
 * What a run may not see change is the set of entries of a directory it has already listed. Everything
 * a run writes is a context or index file, never a source file, and the walkers that read a listing
 * after the outputs are written (the coverage count) only count source files.
 *
 * Callers get their own array each time, so sorting it in place is safe.
 *
 * Zero-dependency, bundle-safe.
 */

const fs = require('fs');

let memo = null;

/** Start sharing listings (and forget any from a previous run). */
function begin() { memo = new Map(); }

/** Stop sharing; every listing goes to the filesystem again. */
function end() { memo = null; }

/**
 * `fs.readdirSync(dir, { withFileTypes: true })`, shared within a run. Throws what readdirSync throws,
 * for a directory that cannot be read, every time it is asked.
 *
 * @param {string} dir
 * @returns {fs.Dirent[]}
 */
function list(dir) {
  if (!memo) return fs.readdirSync(dir, { withFileTypes: true });
  let held = memo.get(dir);
  if (held === undefined) {
    try { held = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { held = err; }
    memo.set(dir, held);
  }
  if (held instanceof Error) throw held;
  return held.slice();
}

module.exports = { begin, end, list };
