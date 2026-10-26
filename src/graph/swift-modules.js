'use strict';

/**
 * Swift, at module level (#980).
 *
 * `import Alamofire` names a module, and a module is a SwiftPM target: many files, with
 * no way to tell from the import which of them are used. Linking the importing file to
 * any one of them, or to all, would invent file-level edges, so Swift contributes none
 * to the import graph (`.swift` stays outside `GRAPH_EXTS`, and a blast-radius query on a
 * Swift file still says file-level imports are not tracked).
 *
 * What is known, and is not invented, is the module structure: a `Package.swift` declares
 * targets and each owns a directory (`Sources/<name>` by default, a `path:` when given,
 * `Tests/<name>` for a test target). From that, for a Swift file: the target it belongs to,
 * and the files in OTHER targets that `import` that target. That is the module-level blast
 * radius, a superset of the true one, and it is reported as such.
 *
 * A project with no `Package.swift` (an Xcode project) has no module structure here and
 * answers nothing.
 *
 * @module src/graph/swift-modules
 */

const fs = require('fs');
const path = require('path');
const { maskCode, readBalanced, stripComments } = require('./import-resolvers');

const SKIP = new Set(['.git', 'node_modules', '.build', 'Pods', 'Carthage', 'DerivedData', 'build', 'dist', '.swiftpm']);
const MAX_FILES = 50000;
const MAX_DEPTH = 12;

/** Every file under `root` for which `want(name)` holds, as absolute paths. */
function walk(root, want) {
  const out = [];
  const go = (dir, depth) => {
    if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) go(full, depth + 1);
      else if (e.isFile() && want(e.name)) out.push(full);
    }
  };
  go(root, 0);
  return out;
}

const KINDS = ['target', 'executableTarget', 'testTarget', 'macro', 'plugin'];
const CALL = new RegExp(`\\.(${KINDS.join('|')})\\s*\\(`, 'g');

/** The targets one Package.swift declares: `{ name, kind, dir }` with `dir` absolute. */
function targetsOf(packageFile) {
  let src;
  try { src = fs.readFileSync(packageFile, 'utf8'); } catch (_) { return []; }
  const root = path.dirname(packageFile);
  const masked = maskCode(src);
  const text = stripComments(src);
  const out = [];
  CALL.lastIndex = 0;
  let m;
  while ((m = CALL.exec(masked)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = readBalanced(masked, open, '(', ')', 8000);
    if (close < 0) continue;
    const args = text.slice(open + 1, close);
    const name = /\bname\s*:\s*"([^"]+)"/.exec(args);
    if (!name) continue;
    const given = /\bpath\s*:\s*"([^"]+)"/.exec(args);
    const kind = m[1];
    const rel = given ? given[1] : path.join(kind === 'testTarget' ? 'Tests' : 'Sources', name[1]);
    const dir = path.resolve(root, rel);
    if (fs.existsSync(dir)) out.push({ name: name[1], kind, dir });
  }
  return out;
}

/** All targets under `cwd`, from every Package.swift found. */
function targetsUnder(cwd) {
  const out = [];
  for (const f of walk(cwd, (n) => n === 'Package.swift')) out.push(...targetsOf(f));
  return out;
}

const IMPORT = /^[ \t]*(?:@\w+(?:\([^)]*\))?[ \t]+)*import[ \t]+(?:(?:typealias|struct|class|enum|protocol|let|var|func)[ \t]+)?([A-Za-z_]\w*)/gm;

/** The module names a Swift source imports. */
function importedModules(content) {
  const text = stripComments(content);
  const out = new Set();
  IMPORT.lastIndex = 0;
  let m;
  while ((m = IMPORT.exec(text)) !== null) out.add(m[1]);
  return out;
}

/** The target whose directory holds `file` (the deepest, when targets nest). */
function targetOf(targets, file) {
  let best = null;
  for (const t of targets) {
    const rel = path.relative(t.dir, file);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel) && (!best || t.dir.length > best.dir.length)) best = t;
  }
  return best;
}

/**
 * The module-level view of a Swift file.
 * @param {string} cwd
 * @param {string} file  absolute path of a `.swift` file
 * @returns {{ module: string, kind: string, dir: string, importers: string[] }|null}
 *          null when `cwd` has no Package.swift target that owns the file
 */
function moduleImpact(cwd, file) {
  const targets = targetsUnder(cwd);
  const mine = targetOf(targets, file);
  if (!mine) return null;
  const importers = [];
  for (const f of walk(cwd, (n) => n.endsWith('.swift'))) {
    if (f === file) continue;
    const t = targetOf(targets, f);
    if (t && t.name === mine.name) continue;
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
    if (importedModules(text).has(mine.name)) importers.push(path.relative(cwd, f).replace(/\\/g, '/'));
  }
  importers.sort();
  return { module: mine.name, kind: mine.kind, dir: path.relative(cwd, mine.dir).replace(/\\/g, '/'), importers };
}

/** Every `.swift` file the module view walks under `cwd`, repo-relative. */
function swiftFiles(cwd) {
  return walk(cwd, (n) => n.endsWith('.swift')).map((f) => path.relative(cwd, f).replace(/\\/g, '/')).sort();
}

module.exports = { moduleImpact, swiftFiles, importedModules, targetsOf };
