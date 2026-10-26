'use strict';

/**
 * Lua `require` (#980).
 *
 * `require("a.b")`, `require "a.b"` and `pcall(require, "a.b")` name a module whose file
 * is `a/b.lua` or `a/b/init.lua` under a root Lua searches (`package.path`). The roots
 * are not declared in the repository, so they are tried the way projects lay them out:
 * every directory from the requiring file up to the project root, and under each of
 * them the directory itself, `lua/`, `src/` and `lib/`. That finds `lua/plenary/job.lua`
 * for `require "plenary.job"` from a test, a plugin or another module. A module that is
 * not in the repository (`require "vim"`, a rock) misses the set and yields nothing.
 *
 * `dofile("x.lua")` and `loadfile("x.lua")` with a literal path resolve next to the file
 * or from the project root. A module name built at run time yields nothing.
 *
 * @module src/graph/resolvers/lua
 */

const path = require('path');
const { ancestorDirs, inSet, graphKey } = require('./shared');

const EXTS = new Set(['.lua']);

const ROOTS = ['', 'lua', 'src', 'lib'];

/** Blank `--[[ ]]` / `--[==[ ]==]` blocks and `--` line comments, keeping newlines. */
function stripLua(src) {
  return src
    .replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/--[^\n]*/g, '');
}

const REQUIRE = /(?:^|[^\w.:])require[ \t]*\(?[ \t]*(['"])([^'"\n]+)\1/g;
const PCALL = /\bpcall[ \t]*\([ \t]*require[ \t]*,[ \t]*(['"])([^'"\n]+)\1/g;
const FILE = /\b(?:dofile|loadfile)[ \t]*\([ \t]*(['"])([^'"\n]+\.lua)\1/g;

function moduleFile(name, dir, fileSet, cwd) {
  if (!/^[\w.\-]+$/.test(name)) return null;
  const rel = name.replace(/\./g, path.sep);
  for (const a of ancestorDirs(dir, cwd)) {
    for (const r of ROOTS) {
      const k = inSet(fileSet, path.resolve(a, r, rel + '.lua')) || inSet(fileSet, path.resolve(a, r, rel, 'init.lua'));
      if (k) return k;
    }
  }
  return null;
}

function extract(filePath, content, fileSet, cwd) {
  const text = stripLua(content);
  const dir = path.dirname(filePath);
  const self = graphKey(filePath);
  const out = [];
  let m;
  for (const re of [REQUIRE, PCALL]) {
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const k = moduleFile(m[2], dir, fileSet, cwd);
      if (k && k !== self) out.push(k);
    }
  }
  FILE.lastIndex = 0;
  while ((m = FILE.exec(text)) !== null) {
    const k = inSet(fileSet, path.resolve(dir, m[2])) || (cwd && inSet(fileSet, path.resolve(cwd, m[2])));
    if (k && k !== self) out.push(k);
  }
  return out;
}

module.exports = { name: 'Lua', EXTS, extract };
