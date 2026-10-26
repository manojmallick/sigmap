'use strict';

/**
 * Import resolvers for the languages added to the import graph in #980: C/C++/Objective-C,
 * PHP, C#, Dart, Vue/Svelte/Astro, Lua and GDScript. `builder.js` builds `GRAPH_FAMILIES`
 * from `FAMILIES` and dispatches on extension, so a family listed here is walked, resolved
 * and reported as tracked by `--impact`, `get_impact`, `plan` and `doctor`.
 *
 * Each family is a section below with `name`, `EXTS` and either `extract(filePath, content,
 * fileSet, cwd, ctx)`, which returns graph keys, or (single-file components) `scriptOf`,
 * which returns the script the JS/TS resolver then reads. The rule every one keeps is
 * precision first: an import that cannot be resolved to exactly one file of the repository
 * yields no edge (an external package, a system header, a commented-out import, an ambiguous
 * name), and what a language does not count as an import is not an edge.
 *
 * One file and not one per language on purpose: this repository scores its own retrieval
 * against its own source, and every indexed file shifts that score (see the gate's comments),
 * so the footprint of a feature is part of its cost. Swift is in swift-modules.js: it names
 * modules, not files, and draws no file-level edge.
 *
 * Zero-dependency, bundle-safe.
 *
 * @module src/graph/import-resolvers
 */

const fs = require('fs');
const path = require('path');
const { graphKey } = require('./path-key');
const { stripComments, maskCode, readBalanced } = require('../extractors/scan');

// ── shared ───────────────────────────────────────────────────────────────────

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

// ── C / C++ / Objective-C ─────────────────────────────────────────────────

const c = (() => {
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
   * @module src/graph/import-resolvers (c)
   */


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

  return { name: 'C/C++/Objective-C', EXTS, extract };
})();

// ── PHP ───────────────────────────────────────────────────────────────────

const php = (() => {
  /**
   * PHP imports (#980): `use Ns\Class;` and literal `require` / `include`.
   *
   * A `use` names a class, not a file, so it goes through the autoloader the project
   * declares. `composer.json` `autoload` and `autoload-dev` `psr-4` map a namespace
   * prefix to one or more directories, and PSR-4 tries every prefix that matches, so
   * `Illuminate\Support\Str` is looked for under `Illuminate\Support\` first and under
   * `Illuminate\` after it (Laravel maps the first to four directories). When no PSR-4
   * path holds a file of the set, a class declared in the set under that exact
   * namespace and name is used instead (a layout with no mapping, or a package whose
   * own `composer.json` is not the root one). Two files declaring one name are
   * ambiguous and yield nothing.
   *
   * Only top-level `use` statements of classes, interfaces, traits and enums are
   * imports: `use function` and `use const` name no file (their clause does not parse as a
   * class name), `use ($x)` on a closure and
   * a trait `use` inside a class body are indented and not matched. A class used by its
   * fully qualified name with no `use` is not an import and is not an edge.
   *
   * `require` / `include` with a literal path resolve next to the file, or relative to
   * the project root; `__DIR__ . '/x.php'` and `dirname(__FILE__) . '/x.php'` are the
   * file's directory. A path built from a variable yields nothing.
   *
   * @module src/graph/import-resolvers (php)
   */


  const EXTS = new Set(['.php']);

  // ── composer.json ────────────────────────────────────────────────────────────

  const _composer = new Map(); // composer.json path -> { mtimeMs, map }

  /** `{ prefix: 'Illuminate\\Support\\', dirs: [abs...] }[]`, longest prefix first. */
  function psr4(cwd) {
    if (!cwd) return [];
    const file = path.join(cwd, 'composer.json');
    let st;
    try { st = fs.statSync(file); } catch (_) { return []; }
    const known = _composer.get(file);
    if (known && known.mtimeMs === st.mtimeMs) return known.map;

    let json = null;
    try { json = JSON.parse(readText(file)); } catch (_) { json = null; }
    const map = [];
    for (const section of ['autoload', 'autoload-dev']) {
      const table = json && json[section] && json[section]['psr-4'];
      if (!table || typeof table !== 'object') continue;
      for (const [prefix, target] of Object.entries(table)) {
        const dirs = (Array.isArray(target) ? target : [target])
          .filter((d) => typeof d === 'string')
          .map((d) => path.resolve(cwd, d));
        const p = prefix === '' ? '' : (prefix.endsWith('\\') ? prefix : prefix + '\\');
        map.push({ prefix: p, dirs });
      }
    }
    map.sort((a, b) => b.prefix.length - a.prefix.length);
    _composer.set(file, { mtimeMs: st.mtimeMs, map });
    return map;
  }

  // ── a name -> file index, for what PSR-4 does not reach ──────────────────────

  const DECL = /^[ \t]*(?:(?:abstract|final|readonly)[ \t]+)*(?:class|interface|trait|enum)[ \t]+([A-Za-z_]\w*)/gm;
  const NS = /^[ \t]*namespace[ \t]+([A-Za-z_][\w\\]*)[ \t]*[;{]/gm;

  function declaredIn(text) {
    const out = [];
    const spans = [];
    NS.lastIndex = 0;
    let m;
    while ((m = NS.exec(text)) !== null) spans.push({ at: m.index, name: m[1] });
    DECL.lastIndex = 0;
    while ((m = DECL.exec(text)) !== null) {
      let ns = '';
      for (const s of spans) if (s.at <= m.index) ns = s.name;
      out.push((ns ? ns + '\\' : '') + m[1]);
    }
    return out;
  }

  /** lowercased fully qualified name -> keys declaring it. */
  function classIndex(fileSet, ctx) {
    return perBuild(fileSet, 'php:classes', () => {
      const idx = new Map();
      for (const k of fileSet) {
        if (!k.endsWith('.php')) continue;
        const text = stripComments(readText(realPathOf(ctx, k)));
        for (const fq of declaredIn(text)) {
          const l = fq.toLowerCase();
          const a = idx.get(l);
          if (a) a.push(k); else idx.set(l, [k]);
        }
      }
      return idx;
    });
  }

  function resolveClass(fq, fileSet, cwd, ctx) {
    const name = fq.replace(/^\\/, '');
    if (!name) return null;
    for (const { prefix, dirs } of psr4(cwd)) {
      if (!name.startsWith(prefix)) continue;
      const rest = name.slice(prefix.length).replace(/\\/g, path.sep);
      if (!rest) continue;
      for (const d of dirs) {
        const k = inSet(fileSet, path.join(d, rest + '.php'));
        if (k) return k;
      }
    }
    const hits = classIndex(fileSet, ctx).get(name.toLowerCase());
    return hits && hits.length === 1 ? hits[0] : null;
  }

  // ── use statements ───────────────────────────────────────────────────────────

  /** Split on commas that are not inside braces. */
  function topLevelCommas(s) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of s) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }

  /** The fully qualified class names one `use` clause imports. */
  function namesIn(clause) {
    const out = [];
    for (const item of topLevelCommas(clause)) {
      const t = item.trim();
      const group = /^\\?([A-Za-z_][\w\\]*)\\\{([^}]*)\}$/.exec(t.replace(/\s+/g, ' '));
      if (group) {
        for (const sub of group[2].split(',')) {
          const s = sub.trim().replace(/\s+as\s+\w+$/i, '');
          if (/^(function|const)\s/.test(s) || !s) continue;
          out.push(group[1] + '\\' + s);
        }
        continue;
      }
      const plain = /^\\?([A-Za-z_][\w\\]*)(?:\s+as\s+\w+)?$/.exec(t.replace(/\s+/g, ' '));
      if (plain) out.push(plain[1]);
    }
    return out;
  }

  const USE = /^use[ \t]+([^;]+);/gm;
  const INCLUDE = /\b(?:require|include)(?:_once)?[ \t]*\(?[ \t]*(?:(__DIR__|dirname[ \t]*\([ \t]*__FILE__[ \t]*\))[ \t]*\.[ \t]*)?(['"])([^'"$\n]+)\2/g;

  function extract(filePath, content, fileSet, cwd, ctx) {
    const text = stripComments(content);
    const out = [];
    let m;

    USE.lastIndex = 0;
    while ((m = USE.exec(text)) !== null) {
      for (const fq of namesIn(m[1])) {
        const hit = resolveClass(fq, fileSet, cwd, ctx);
        if (hit) out.push(hit);
      }
    }

    const dir = path.dirname(filePath);
    INCLUDE.lastIndex = 0;
    while ((m = INCLUDE.exec(text)) !== null) {
      const lit = m[3];
      const bases = m[1] || lit.startsWith('./') || lit.startsWith('../') ? [dir] : [dir, cwd].filter(Boolean);
      for (const b of bases) {
        const k = inSet(fileSet, path.resolve(b, lit.replace(/^\/(?=[^/])/, m[1] ? '' : '/')));
        if (k) { out.push(k); break; }
      }
    }
    return out.filter((k) => k !== graphKey(filePath));
  }

  return { name: 'PHP', EXTS, extract };
})();

// ── C# ────────────────────────────────────────────────────────────────────

const csharp = (() => {
  /**
   * C# `using` directives (#980).
   *
   * A `using` names a namespace, and a namespace is many files, so resolving it to all
   * of them would link every file of `Serilog` to every other. An edge A -> B is drawn
   * only when A imports a namespace in which B declares a top-level type AND A mentions
   * that type's name as an identifier. A `partial` type declared across several files
   * links to all of its parts. `using static N.T;` and `using Alias = N.T;` name a type
   * directly and link to the files declaring it.
   *
   * The index (namespace -> top-level type name -> files) is built once per build from
   * the C# files of the set. Block `namespace N { }`, nested blocks and file-scoped
   * `namespace N;` are read, with strings and comments blanked first so a brace inside
   * either does not move the depth.
   *
   * `global using` applies to every file of the same project (the directory holding the
   * nearest `.csproj` above it). Types in the file's own namespace need no `using`; they
   * are implicit dependencies, not imports, and are not edges. A namespace that is not
   * declared in the set (`System.*`, a NuGet package) matches nothing.
   *
   * @module src/graph/import-resolvers (csharp)
   */


  const EXTS = new Set(['.cs']);

  const NS_OPEN = /\bnamespace\s+([A-Za-z_][\w.]*)\s*([;{])/y;

  /**
   * Declarations of a file: `{ ns, type }` for each top-level type, and every namespace
   * it declares. Walks the masked text once, tracking brace depth.
   */
  function scanDeclarations(masked) {
    const types = [];
    const nss = new Set();
    const stack = []; // block namespaces: { name, depth }
    let fileScoped = '';
    let depth = 0;
    const n = masked.length;
    for (let i = 0; i < n; i++) {
      const ch = masked[i];
      if (ch === '{') { depth++; continue; }
      if (ch === '}') {
        depth--;
        while (stack.length && stack[stack.length - 1].depth > depth) stack.pop();
        continue;
      }
      if (ch === 'n' && masked.startsWith('namespace', i) && /\W/.test(masked[i - 1] || ' ')) {
        NS_OPEN.lastIndex = i;
        const m = NS_OPEN.exec(masked);
        if (m) {
          const outer = stack.length ? stack[stack.length - 1].name : fileScoped;
          const full = outer ? outer + '.' + m[1] : m[1];
          nss.add(full);
          if (m[2] === ';') fileScoped = full;
          else { stack.push({ name: full, depth: depth + 1 }); }
          i += m[0].length - 1;
          if (m[2] === '{') depth++;
          continue;
        }
      }
      if (/[cseird]/.test(ch) && /\W/.test(masked[i - 1] || ' ')) {
        const kw = /^(?:class|struct|interface|enum|record(?:\s+(?:class|struct))?|delegate\s+[^\s(;{]+(?:\s*<[^>]*>)?)\s+([A-Za-z_]\w*)/.exec(masked.slice(i, i + 160));
        if (kw) {
          const ns = stack.length ? stack[stack.length - 1].name : fileScoped;
          const onTop = stack.length ? depth === stack[stack.length - 1].depth : depth === 0;
          if (ns && onTop) types.push({ ns, type: kw[1] });
          i += kw[0].length - 1;
        }
      }
    }
    return { types, nss };
  }

  /** Does a directory hold a `.csproj`? One listing per directory per process. */
  const _csproj = new Map();
  function hasCsproj(dir) {
    if (!_csproj.has(dir)) {
      let names = [];
      try { names = fs.readdirSync(dir); } catch (_) { /* unreadable: no project here */ }
      _csproj.set(dir, names.some((x) => x.endsWith('.csproj')));
    }
    return _csproj.get(dir);
  }

  /** Directory of the nearest `.csproj` above a file; '' when there is none. */
  function projectDirOf(file, cwd) {
    for (const a of ancestorDirs(path.dirname(file), cwd)) if (hasCsproj(a)) return a;
    return '';
  }

  /** { ns: Map<lcNamespace, Map<type, Set<key>>>, globals: Map<project dir, Set<lcNamespace>> } */
  function indexFor(fileSet, cwd, ctx) {
    return perBuild(fileSet, 'cs:index', () => {
      const ns = new Map();
      const globals = new Map(); // project dir -> Set<namespace>
      for (const k of fileSet) {
        if (!k.endsWith('.cs')) continue;
        const real = realPathOf(ctx, k);
        const masked = maskCode(readText(real));
        const { types } = scanDeclarations(masked);
        for (const { ns: n, type } of types) {
          const key = n.toLowerCase();
          if (!ns.has(key)) ns.set(key, new Map());
          const byType = ns.get(key);
          if (!byType.has(type)) byType.set(type, new Set());
          byType.get(type).add(k);
        }
        const g = /^[ \t]*global[ \t]+using[ \t]+(?!static\b)(?:\w+[ \t]*=[ \t]*)?([A-Za-z_][\w.]*)[ \t]*;/gm;
        let m;
        while ((m = g.exec(masked)) !== null) {
          const p = projectDirOf(real, cwd);
          if (!globals.has(p)) globals.set(p, new Set());
          globals.get(p).add(m[1].toLowerCase());
        }
      }
      return { ns, globals };
    });
  }

  const USING = /^[ \t]*(global[ \t]+)?using[ \t]+(static[ \t]+)?(?:([A-Za-z_]\w*)[ \t]*=[ \t]*)?([A-Za-z_][\w.]*)(?:<[^;>]*>)?[ \t]*;/gm;

  function extract(filePath, content, fileSet, cwd, ctx) {
    const idx = indexFor(fileSet, cwd, ctx);
    const self = graphKey(filePath);
    const masked = maskCode(content);

    const imported = new Set();   // namespaces whose types the file may use
    const direct = [];            // [namespace, type] named outright
    let m;
    USING.lastIndex = 0;
    while ((m = USING.exec(masked)) !== null) {
      const name = m[4];
      if (m[2] || m[3]) {                       // using static N.T;  using A = N.T;
        const dot = name.lastIndexOf('.');
        if (dot > 0) direct.push([name.slice(0, dot).toLowerCase(), name.slice(dot + 1)]);
      } else {
        imported.add(name.toLowerCase());
      }
    }
    const proj = projectDirOf(filePath, cwd);
    for (const g of idx.globals.get(proj) || []) imported.add(g);

    const out = new Set();
    for (const [n, t] of direct) {
      const files = idx.ns.get(n) && idx.ns.get(n).get(t);
      if (files) for (const f of files) if (f !== self) out.add(f);
    }
    if (imported.size) {
      const ids = new Set(masked.match(/[A-Za-z_]\w*/g) || []);
      for (const n of imported) {
        const byType = idx.ns.get(n);
        if (!byType) continue;
        for (const [type, files] of byType) {
          if (!ids.has(type)) continue;
          for (const f of files) if (f !== self) out.add(f);
        }
      }
    }
    return [...out];
  }

  return { name: 'C#', EXTS, extract };
})();

// ── Dart ──────────────────────────────────────────────────────────────────

const dart = (() => {
  /**
   * Dart `import`, `export` and `part` (#980).
   *
   * `import 'x.dart'`, `export 'x.dart'` and `part 'x.g.dart'` resolve next to the file;
   * `part of 'x.dart'` points back at the library. `package:name/path.dart` resolves
   * through the packages the repository itself holds: a package is a directory with a
   * `pubspec.yaml`, its name is that file's `name:`, and its code is under `lib/`. So in
   * a monorepo `package:flutter_riverpod/x.dart` reaches `packages/flutter_riverpod/lib/x.dart`.
   * `dart:` libraries and packages that are not in the repository (`package:flutter/...`,
   * `package:test/...`) miss the set and yield nothing.
   *
   * A conditional import (`import 'a.dart' if (dart.library.io) 'a_io.dart';`) is one
   * statement with several possible targets; every one that is a file of the set is an
   * edge, because any of them can be the file that is compiled in.
   *
   * @module src/graph/import-resolvers (dart)
   */


  const EXTS = new Set(['.dart']);

  /** package name -> lib directory, for every pubspec.yaml above any file of the set. */
  function packages(fileSet, cwd, ctx) {
    return perBuild(fileSet, 'dart:packages', () => {
      const roots = new Set();
      const seen = new Set();
      for (const k of fileSet) {
        if (!k.endsWith('.dart')) continue;
        // a key is lowercased; the directories to look in are spelled as they are on disk
        for (const a of ancestorDirs(path.dirname(realPathOf(ctx, k)), cwd)) {
          if (seen.has(a)) break;       // everything above it was already visited
          seen.add(a);
          if (dirHas(a, 'pubspec.yaml')) roots.add(a);
        }
      }
      const byName = new Map();
      for (const root of roots) {
        const m = /^name:[ \t]*['"]?([A-Za-z_][\w]*)['"]?[ \t]*$/m.exec(readText(path.join(root, 'pubspec.yaml')));
        if (m && !byName.has(m[1])) byName.set(m[1], path.join(root, 'lib'));
      }
      return byName;
    });
  }

  // A directive runs to its `;` and may hold conditional URIs after the first one.
  const DIRECTIVE = /^[ \t]*(import|export|part[ \t]+of|part)[ \t]+((?:'[^'\n]*'|"[^"\n]*")[^;]*);/gm;
  const URI = /(?:'([^'\n]*)'|"([^"\n]*)")/g;

  function extract(filePath, content, fileSet, cwd, ctx) {
    const text = stripComments(content);
    const dir = path.dirname(filePath);
    const self = graphKey(filePath);
    const out = [];
    let m;
    DIRECTIVE.lastIndex = 0;
    while ((m = DIRECTIVE.exec(text)) !== null) {
      const uris = [];
      URI.lastIndex = 0;
      let u;
      while ((u = URI.exec(m[2])) !== null) uris.push(u[1] !== undefined ? u[1] : u[2]);
      // `show` / `hide` / `as` clauses name symbols, not files, so only strings are read; a
      // string after `if (...)` is a conditional target, but a bare `show 'x'` cannot occur.
      for (const uri of uris) {
        let k = null;
        if (uri.startsWith('package:')) {
          const rest = uri.slice('package:'.length);
          const slash = rest.indexOf('/');
          if (slash < 0) continue;
          const lib = packages(fileSet, cwd, ctx).get(rest.slice(0, slash));
          if (lib) k = inSet(fileSet, path.join(lib, rest.slice(slash + 1)));
        } else if (!/^[a-z][a-z0-9+.-]*:/i.test(uri)) {     // dart:, http:, ... are not files of the set
          k = inSet(fileSet, path.resolve(dir, uri));
        }
        if (k && k !== self) out.push(k);
      }
    }
    return out;
  }

  return { name: 'Dart', EXTS, extract };
})();

// ── Vue / Svelte / Astro ──────────────────────────────────────────────────

const sfc = (() => {
  /**
   * Single-file components: Vue, Svelte, Astro (#980).
   *
   * The imports of these files are ordinary ES imports; they sit in a `<script>` block
   * (Vue, Svelte) or in the frontmatter fence and `<script>` tags (Astro). This module
   * only finds that code. The graph builder resolves it with the same JS/TS resolver as
   * any other script, so relative paths, `tsconfig` aliases and extension-less
   * specifiers behave exactly as they do in a `.ts` file.
   *
   * Template markup, `<style>` blocks and component tags are not read: a tag
   * `<Child />` is an import only through the `import Child from './Child.vue'` that
   * names it, which is in the script. The extension stays in the specifier: a bundler
   * does not guess that `./Child` means `Child.vue` unless it is configured to, so
   * neither does the graph.
   *
   * @module src/graph/import-resolvers (sfc)
   */

  const EXTS = new Set(['.vue', '.svelte', '.astro']);

  const SCRIPT = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  const FENCE = /^\uFEFF?\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

  /**
   * The script source of a component file: every `<script>` body, and for Astro the
   * frontmatter before them. Returned as one string; import statements are line based.
   * @param {string} ext   '.vue' | '.svelte' | '.astro'
   * @param {string} content
   * @returns {string}
   */
  function scriptOf(ext, content) {
    const parts = [];
    let body = content;
    if (ext === '.astro') {
      const f = FENCE.exec(content);
      if (f) { parts.push(f[1]); body = content.slice(f[0].length); }
    }
    SCRIPT.lastIndex = 0;
    let m;
    while ((m = SCRIPT.exec(body)) !== null) parts.push(m[1]);
    return parts.join('\n');
  }

  return { name: 'Vue/Svelte/Astro', EXTS, scriptOf };
})();

// ── Lua ───────────────────────────────────────────────────────────────────

const lua = (() => {
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
   * @module src/graph/import-resolvers (lua)
   */


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

  return { name: 'Lua', EXTS, extract };
})();

// ── GDScript ──────────────────────────────────────────────────────────────

const gdscript = (() => {
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
   * @module src/graph/import-resolvers (gdscript)
   */


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

  return { name: 'GDScript', EXTS, extract };
})();

// ── the list ─────────────────────────────────────────────────────────────────

const FAMILIES = [c, php, csharp, dart, sfc, lua, gdscript];

/** extension -> family module */
const BY_EXT = new Map();
for (const f of FAMILIES) for (const e of f.EXTS) BY_EXT.set(e, f);

module.exports = { FAMILIES, BY_EXT, sfc, ancestorDirs, stripComments, maskCode, readBalanced };
