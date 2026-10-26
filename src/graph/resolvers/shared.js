'use strict';

/**
 * Helpers the per-language import resolvers share (#980).
 *
 * A resolver turns one file's text into the graph keys of the repository files it
 * imports. The contract every one keeps is precision first: an import that cannot
 * be resolved to exactly one file of the set yields no edge, never a guessed one,
 * and a name that is external (a system header, a package, a virtual module) misses
 * the set and so yields nothing.
 *
 * Zero-dependency, pure, bundle-safe.
 *
 * @module src/graph/resolvers/shared
 */

const fs = require('fs');
const path = require('path');
const { graphKey } = require('../path-key');
// The extractors' string-aware comment stripper and masker, reached through this module so the
// resolvers depend on one shared helper and not each on the extractors' scanner.
const { stripComments, maskCode, readBalanced } = require('../../extractors/scan');

/** Walk bound for any search up a directory chain. */
const MAX_UP = 24;

/**
 * Directories from `dir` up to and including `cwd`, nearest first. When `dir` is
 * not below `cwd` the chain still ends (at the filesystem root, or after MAX_UP).
 * @param {string} dir
 * @param {string} [cwd]
 * @returns {string[]} absolute directories
 */
function ancestorDirs(dir, cwd) {
  const out = [];
  const stop = cwd ? graphKey(path.resolve(cwd)) : null;
  let d = path.resolve(dir);
  for (let i = 0; i < MAX_UP; i++) {
    out.push(d);
    if (stop && graphKey(d) === stop) break;
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return out;
}

const _memo = new WeakMap();

/**
 * Build something once per file set. The set the graph hands a resolver is made
 * once per build, so keying on it gives one index per build with no plumbing.
 * @template T
 * @param {Set<string>} fileSet
 * @param {string} name
 * @param {() => T} make
 * @returns {T}
 */
function perBuild(fileSet, name, make) {
  let m = _memo.get(fileSet);
  if (!m) { m = new Map(); _memo.set(fileSet, m); }
  if (!m.has(name)) m.set(name, make());
  return m.get(name);
}

/** The text of a file, or '' when it cannot be read. */
function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; }
}

/** A graph key's real path: the build's own map when it has one, else the key. */
function realPathOf(ctx, key) {
  return (ctx && ctx.realPaths && ctx.realPaths.get(key)) || key;
}

/** True when `abs` is a file of the set; returns its key, else null. */
function inSet(fileSet, abs) {
  const k = graphKey(abs);
  return fileSet.has(k) ? k : null;
}

/** Cache a directory-existence probe: one stat per directory per process. */
const _exists = new Map();
function dirHas(dir, name) {
  const k = dir + '\u0000' + name;
  if (!_exists.has(k)) {
    let ok = false;
    try { ok = fs.existsSync(path.join(dir, name)); } catch (_) { ok = false; }
    _exists.set(k, ok);
  }
  return _exists.get(k);
}

module.exports = { ancestorDirs, perBuild, readText, realPathOf, inSet, dirHas, graphKey, stripComments, maskCode, readBalanced };
