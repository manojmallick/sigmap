'use strict';

/**
 * C / C++ / Objective-C includes (#980).
 *
 * `#include "x.h"` and `#import "x.h"` are searched the way a compiler searches them:
 * next to the including file first, then the include roots. `#include <x.h>` skips
 * the first step (it is not searched next to the file) and an angle-bracket header
 * that is not in the repository (`<stdio.h>`, `<vector>`) misses the file set and
 * yields no edge, so system headers need no list. Header-only libraries include their
 * own headers with angle brackets (`<spdlog/common.h>`); those resolve through the
 * roots exactly like a quoted one.
 *
 * Include roots, in order, for every directory from the including file up to the project
 * root. A quoted include tries the directory itself, its `include/` and its `src/`. An
 * angle-bracket include tries only `include/`, and the project root itself and its `src/`
 * when the path has a directory part (`<proj/x.h>`), so a repository file that happens to be
 * called `string.h` never answers `<string.h>`. If no root hits, a path with a directory part
 * (`uv/unix.h`) resolves when exactly one file of the repository ends with it; two candidates
 * are ambiguous and yield nothing.
 *
 * An include inside a comment is not an include (comments are blanked first), and an
 * include under `#if` still counts: the edge says "can include", the same
 * over-approximation the other languages' resolvers make.
 *
 * @module src/graph/resolvers/c
 */

const path = require('path');
const { ancestorDirs, perBuild, inSet, graphKey, stripComments } = require('./shared');

const EXTS = new Set([
  '.c', '.h', '.cc', '.cpp', '.cxx', '.c++', '.hh', '.hpp', '.hxx', '.h++',
  '.inl', '.ipp', '.tpp', '.m', '.mm',
]);

const QUOTED_SUBS = ['', 'include', 'src'];

/** file name -> keys carrying it, for the unique-suffix step. */
function byName(fileSet) {
  return perBuild(fileSet, 'c:byName', () => {
    const m = new Map();
    for (const k of fileSet) {
      const base = k.slice(k.lastIndexOf(path.sep) + 1);
      const a = m.get(base);
      if (a) a.push(k); else m.set(base, [k]);
    }
    return m;
  });
}

function resolve(spec, quoted, dir, selfKey, fileSet, cwd) {
  if (!spec || path.isAbsolute(spec)) return null;
  const rel = spec.replace(/\\/g, '/');
  if (rel.split('/').includes('..') && !quoted) return null; // an angle include never climbs

  const root = cwd ? graphKey(path.resolve(cwd)) : null;
  const slashed = rel.includes('/');
  for (const a of ancestorDirs(dir, cwd)) {
    const atRoot = root !== null && graphKey(a) === root;
    const subs = quoted ? QUOTED_SUBS : (slashed && atRoot ? QUOTED_SUBS : ['include']);
    for (const sub of subs) {
      const k = inSet(fileSet, path.resolve(a, sub, rel));
      if (k && k !== selfKey) return k;
    }
  }
  if (slashed) {
    const tail = graphKey(rel);
    const cands = (byName(fileSet).get(path.basename(tail)) || []).filter((k) => k !== selfKey && k.endsWith(path.sep + tail));
    if (cands.length === 1) return cands[0];
  }
  return null;
}

const RE = /^[ \t]*#[ \t]*(?:include|import)[ \t]*(?:"([^"\n]+)"|<([^>\n]+)>)/gm;

/**
 * @param {string} filePath  absolute path
 * @param {string} content
 * @param {Set<string>} fileSet  graph keys
 * @param {string} [cwd]
 * @returns {string[]} keys of the files this one includes
 */
function extract(filePath, content, fileSet, cwd) {
  const text = stripComments(content);
  const dir = path.dirname(filePath);
  const self = graphKey(filePath);
  const out = [];
  RE.lastIndex = 0;
  let m;
  while ((m = RE.exec(text)) !== null) {
    const quoted = m[1] !== undefined;
    const hit = resolve((quoted ? m[1] : m[2]).trim(), quoted, dir, self, fileSet, cwd);
    if (hit) out.push(hit);
  }
  return out;
}

module.exports = { name: 'C/C++/Objective-C', EXTS, extract };
