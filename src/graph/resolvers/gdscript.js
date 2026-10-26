'use strict';

/**
 * GDScript `preload`, `load` and `extends` (#980).
 *
 * `preload("res://a/b.gd")` and `load("res://a/b.gd")` resolve from the Godot project
 * root, the nearest directory above the file that holds a `project.godot` (a repository
 * of demo projects has one per project), falling back to the repository root. A path
 * without `res://` is relative to the file. Only a path that is a script of the set is
 * an edge: a scene, an image or a sound is not a node of this graph.
 *
 * `extends "res://base.gd"` is the same. `extends Name` resolves when `Name` is declared
 * by a `class_name Name` in the same Godot project, which is how a script inherits from
 * another without a path; the engine's own classes (`extends Node`) match nothing.
 *
 * A path held in a variable or built by concatenation yields nothing.
 *
 * @module src/graph/resolvers/gdscript
 */

const path = require('path');
const { ancestorDirs, perBuild, readText, realPathOf, inSet, dirHas, graphKey } = require('./shared');

const EXTS = new Set(['.gd']);

function stripGd(src) { return src.replace(/(^|[^"'\\])#[^\n]*/g, '$1'); }

/** The Godot project directory of a file: the nearest above it with a project.godot. */
function projectRootOf(file, cwd) {
  for (const a of ancestorDirs(path.dirname(file), cwd)) if (dirHas(a, 'project.godot')) return a;
  return cwd ? path.resolve(cwd) : path.dirname(file);
}

const CLASS_NAME = /^[ \t]*class_name[ \t]+([A-Za-z_]\w*)/gm;

/** project root -> class_name -> keys declaring it. */
function classNames(fileSet, cwd, ctx) {
  return perBuild(fileSet, 'gd:classNames', () => {
    const idx = new Map();
    for (const k of fileSet) {
      if (!k.endsWith('.gd')) continue;
      const real = realPathOf(ctx, k);
      const text = stripGd(readText(real));
      const root = graphKey(projectRootOf(real, cwd));
      CLASS_NAME.lastIndex = 0;
      let m;
      while ((m = CLASS_NAME.exec(text)) !== null) {
        const key = root + '\u0000' + m[1];
        const a = idx.get(key);
        if (a) a.push(k); else idx.set(key, [k]);
      }
    }
    return idx;
  });
}

const LOAD = /\b(?:preload|load)[ \t]*\([ \t]*(['"])([^'"\n]+)\1/g;
const EXTENDS_PATH = /^[ \t]*extends[ \t]+(['"])([^'"\n]+)\1/gm;
const EXTENDS_NAME = /^[ \t]*(?:class_name[ \t]+\w+[ \t]+)?extends[ \t]+([A-Za-z_]\w*)/gm;

function fileFor(p, dir, root, fileSet) {
  if (p.startsWith('res://')) return inSet(fileSet, path.join(root, p.slice('res://'.length)));
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) return null;     // user://, http://, ...
  return inSet(fileSet, path.resolve(dir, p));
}

function extract(filePath, content, fileSet, cwd, ctx) {
  const text = stripGd(content);
  const dir = path.dirname(filePath);
  const root = projectRootOf(filePath, cwd);
  const self = graphKey(filePath);
  const out = [];
  let m;
  for (const re of [LOAD, EXTENDS_PATH]) {
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const k = fileFor(m[2], dir, root, fileSet);
      if (k && k !== self) out.push(k);
    }
  }
  EXTENDS_NAME.lastIndex = 0;
  const names = classNames(fileSet, cwd, ctx);
  while ((m = EXTENDS_NAME.exec(text)) !== null) {
    const hits = names.get(graphKey(root) + '\u0000' + m[1]);
    if (hits && hits.length === 1 && hits[0] !== self) out.push(hits[0]);
  }
  return out;
}

module.exports = { name: 'GDScript', EXTS, extract };
