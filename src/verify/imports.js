'use strict';

/**
 * Local import resolution and named-import validity (J3 · D1, #909).
 *
 * `verify` has always asked of an import "does this module exist?" — for a JS
 * path, a JS package, a relative file. This module answers it for the
 * languages whose imports the repo alone can decide, and asks one question
 * more: of a name taken from a module the repo owns, "does that module have it?"
 *
 *   Python  a dotted import whose first segment is a repo package or module
 *           resolves to a file or a package — or it does not
 *   Go      an import under a go.mod module path names a directory holding
 *           Go files — or it does not
 *   JS/TS   a name imported from a relative module that resolves to ONE file
 *           occurs in that file
 *   Python  likewise, for `from pkg.mod import name`
 *
 * Every answer is one of three: `resolved`, `unresolved`, `unknown`. Only
 * `unresolved` is ever a finding. A standard-library import is `resolved`, a
 * third-party one `unknown` (or `resolved` when a manifest names it), and a
 * layout this module cannot read is `unknown` — a false "fake import" costs
 * more than a missed one, so every doubt is an `unknown`.
 *
 * Deterministic, offline, zero dependencies. Reads the index keys it is given
 * and, where an empty file leaves no index entry (`__init__.py`), the disk.
 */

const fs = require('fs');
const path = require('path');
const { PY_STDLIB, GO_STDLIB } = require('./globals');

const PY_STDLIB_SET = new Set(PY_STDLIB);
const GO_STDLIB_SET = new Set(GO_STDLIB);

const JS_EXTS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'];
const JS_FILE_RE = /\.(?:[mc]?[jt]sx?)$/;
const MAX_TEXT_BYTES = 1500000; // a module read to look for a name
const MAX_DIR_PROBES = 2000;    // directories probed for a base-less relative import
const MAX_GO_DIRS = 500;        // Go directories climbed looking for a go.mod

const norm = (p) => String(p).replace(/\\/g, '/');
const dirnameOf = (key) => (key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '');
const stripExt = (key) => key.replace(/\.[^./]+$/, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when `text` mentions `name` as a whole identifier. */
function mentions(text, name) {
  return new RegExp('(?<![\\w$])' + escapeRe(name) + '(?![\\w$])').test(text);
}

/**
 * The shared, lazily-filled context one `verify()` call resolves against.
 * @param {string} cwd
 * @param {Iterable<string>} fileKeys  the indexed files (repo-relative or absolute)
 */
function buildImportContext(cwd, fileKeys) {
  let keys = null;
  let keySet = null;
  const load = () => {
    keys = [];
    for (const k of fileKeys || []) {
      const rel = norm(path.isAbsolute(k) ? path.relative(cwd, k) : k).replace(/^\.\//, '');
      if (rel && !rel.startsWith('..')) keys.push(rel);
    }
    keySet = new Set(keys);
  };
  const exists = new Map();
  const texts = new Map();
  return {
    cwd,
    _py: null,
    _go: null,
    _jsByStem: null,
    // Normalised lazily: an answer with no Python or Go import never pays for it.
    get keys() { if (!keys) load(); return keys; },
    get keySet() { if (!keySet) load(); return keySet; },
    /** An indexed file, or one on disk. */
    exists(rel) {
      if (this.keySet.has(rel)) return true;
      if (!exists.has(rel)) {
        let ok = false;
        try { ok = fs.existsSync(path.join(cwd, rel)); } catch (_) {}
        exists.set(rel, ok);
      }
      return exists.get(rel);
    },
    /** A regular file (an extension-less path may name a directory). */
    isFile(rel) {
      if (this.keySet.has(rel)) return true;
      try { return fs.statSync(path.join(cwd, rel)).isFile(); } catch (_) { return false; }
    },
    readText(rel) {
      if (!texts.has(rel)) {
        let text = '';
        try {
          const abs = path.join(cwd, rel);
          if (fs.statSync(abs).size <= MAX_TEXT_BYTES) text = fs.readFileSync(abs, 'utf8');
        } catch (_) {}
        texts.set(rel, text);
      }
      return texts.get(rel);
    },
  };
}

// ── Python ──────────────────────────────────────────────────────────────────

/**
 * Index the repo's Python: which names are importable at top level (and from
 * which root), and every segment-aligned suffix of every module path.
 *
 * A top-level package is the highest directory in an unbroken chain of
 * `__init__.py` — checked on disk, because an empty `__init__.py` carries no
 * signature and so never reaches the index.
 */
function pyIndex(ctx) {
  if (ctx._py) return ctx._py;
  const tops = new Map();     // 'app' -> Set(roots)  e.g. {'src'}
  const suffixes = new Set(); // 'src/app/config', 'app/config', 'config'
  const dirs = new Set();
  const inits = new Map();
  const hasInit = (dir) => {
    if (!inits.has(dir)) inits.set(dir, ctx.exists((dir ? dir + '/' : '') + '__init__.py'));
    return inits.get(dir);
  };
  let count = 0;
  for (const key of ctx.keys) {
    if (!/\.pyi?$/.test(key)) continue;
    count++;
    const parts = key.replace(/\.pyi?$/, '').split('/');
    const file = parts.pop();
    const modParts = file === '__init__' ? parts : parts.concat(file);
    for (let i = 0; i < modParts.length; i++) suffixes.add(modParts.slice(i).join('/'));
    for (let i = 0; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
    let d = parts.length;
    while (d > 0 && hasInit(parts.slice(0, d).join('/'))) d--;
    const top = d < parts.length ? parts[d] : (file === '__init__' ? null : file);
    if (top) {
      if (!tops.has(top)) tops.set(top, new Set());
      tops.get(top).add(parts.slice(0, d).join('/'));
    }
  }
  ctx._py = { count, tops, suffixes, dirs: [...dirs].sort() };
  return ctx._py;
}

/** `import a.b.c` / `from a.b import x` — the module path, absolute. */
function resolvePyModule(ctx, dotted) {
  const py = pyIndex(ctx);
  const segs = dotted.split('.');
  const roots = py.tops.get(segs[0]);
  if (!roots) {
    return PY_STDLIB_SET.has(segs[0]) ? { status: 'resolved', via: 'stdlib' } : { status: 'unknown' };
  }
  const rel = segs.join('/');
  for (const root of roots) {
    const base = (root ? root + '/' : '') + rel;
    for (const cand of [base + '.py', base + '.pyi', base + '/__init__.py', base + '/__init__.pyi']) {
      if (ctx.exists(cand)) return { status: 'resolved', via: 'repo', file: cand };
    }
  }
  // A repo package that shadows a stdlib name (`queue/`, `types/`) is not
  // evidence the answer's `queue.Queue` is fake.
  if (PY_STDLIB_SET.has(segs[0])) return { status: 'unknown' };
  return { status: 'unresolved' };
}

/** `from .x.y import z` / `from ..x import z` — relative to a file we cannot know. */
function resolvePyRelative(ctx, module) {
  const rest = module.replace(/^\.+/, '');
  if (!rest) return { status: 'resolved', via: 'package' };
  const py = pyIndex(ctx);
  if (py.count === 0) return { status: 'unknown' };
  const suffix = rest.split('.').join('/');
  if (py.suffixes.has(suffix)) return { status: 'resolved', via: 'repo' };
  // A module with no signature (constants only) is not in the index — probe the
  // directories that hold Python before calling it missing.
  let probes = 0;
  for (const dir of py.dirs) {
    if (++probes > MAX_DIR_PROBES) return { status: 'unknown' };
    const base = (dir ? dir + '/' : '') + suffix;
    if (ctx.exists(base + '.py') || ctx.exists(base + '.pyi') || ctx.exists(base + '/__init__.py')) {
      return { status: 'resolved', via: 'repo' };
    }
  }
  return { status: 'unresolved' };
}

/** The one file a Python import names, or null when it is not exactly one. */
function pyModuleFile(ctx, imp) {
  if (!imp.relative) {
    const r = resolvePyModule(ctx, imp.module);
    return r.status === 'resolved' && r.file ? r.file : null;
  }
  const rest = imp.module.replace(/^\.+/, '');
  if (!rest) return null;
  const suffix = rest.split('.').join('/');
  const hits = [];
  for (const key of ctx.keys) {
    if (!/\.pyi?$/.test(key)) continue;
    const parts = key.replace(/\.pyi?$/, '').split('/');
    if (parts[parts.length - 1] === '__init__') parts.pop();
    const mod = parts.join('/');
    if (mod === suffix || mod.endsWith('/' + suffix)) hits.push(key);
  }
  return hits.length === 1 ? hits[0] : null;
}

// ── Go ──────────────────────────────────────────────────────────────────────

/** Parse a go.mod: the module path, and every module it requires. */
function parseGoMod(text) {
  const mod = text.match(/^\s*module\s+"?([^\s"]+)"?/m);
  if (!mod) return null;
  const requires = [];
  let inBlock = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (inBlock) {
      if (line.startsWith(')')) { inBlock = false; continue; }
      const m = line.match(/^(\S+)\s+v/);
      if (m) requires.push(m[1]);
      continue;
    }
    if (/^require\s*\(/.test(line)) { inBlock = true; continue; }
    const one = line.match(/^require\s+(\S+)\s+v/);
    if (one) requires.push(one[1]);
  }
  return { module: mod[1], requires };
}

/** Every go.mod the repo's Go files sit under (the repo root and nested modules). */
function goModules(ctx) {
  if (ctx._go) return ctx._go;
  const modules = [];
  const tried = new Set();
  const tryRoot = (root) => {
    if (tried.has(root)) return;
    tried.add(root);
    const file = (root ? root + '/' : '') + 'go.mod';
    if (!ctx.exists(file)) return;
    const parsed = parseGoMod(ctx.readText(file));
    if (parsed) modules.push({ root, module: parsed.module, requires: parsed.requires });
  };
  tryRoot('');
  const dirs = new Set();
  for (const key of ctx.keys) if (key.endsWith('.go')) dirs.add(dirnameOf(key));
  let probed = 0;
  for (const dir of [...dirs].sort()) {
    if (++probed > MAX_GO_DIRS) break;
    for (let d = dir; d; d = dirnameOf(d)) tryRoot(d);
  }
  ctx._go = modules;
  return ctx._go;
}

function dirHasGo(ctx, dir) {
  for (const key of ctx.keys) if (key.endsWith('.go') && dirnameOf(key) === dir) return true;
  try {
    return fs.readdirSync(path.join(ctx.cwd, dir)).some((f) => f.endsWith('.go'));
  } catch (_) {
    return false;
  }
}

/** A Go import path: local to a module, standard library, required, or unknown. */
function resolveGoImport(ctx, importPath) {
  let best = null;
  for (const m of goModules(ctx)) {
    if (importPath === m.module || importPath.startsWith(m.module + '/')) {
      if (!best || m.module.length > best.module.length) best = m;
    }
  }
  if (best) {
    const rel = importPath === best.module ? '' : importPath.slice(best.module.length + 1);
    const dir = [best.root, rel].filter(Boolean).join('/');
    return dirHasGo(ctx, dir) ? { status: 'resolved', via: 'repo' } : { status: 'unresolved' };
  }
  if (GO_STDLIB_SET.has(importPath.split('/')[0])) return { status: 'resolved', via: 'stdlib' };
  for (const m of goModules(ctx)) {
    if (m.requires.some((r) => importPath === r || importPath.startsWith(r + '/'))) {
      return { status: 'resolved', via: 'go.mod' };
    }
  }
  return { status: 'unknown' };
}

// ── JS / TS ─────────────────────────────────────────────────────────────────

function jsByStem(ctx) {
  if (ctx._jsByStem) return ctx._jsByStem;
  const map = new Map();
  for (const key of ctx.keys) {
    if (!JS_FILE_RE.test(key)) continue;
    const stem = path.posix.basename(key).replace(/\.[^.]+$/, '').toLowerCase();
    if (!map.has(stem)) map.set(stem, []);
    map.get(stem).push(key);
  }
  ctx._jsByStem = map;
  return map;
}

/**
 * The one file a relative JS/TS import names, or null when it is not exactly
 * one. The answer's import is relative to a file we cannot know, so it is read
 * from the repo root first, then by module name — and only when that is unique.
 */
function jsModuleFile(ctx, module) {
  const base = path.posix.normalize(norm(module));
  if (!base.startsWith('..')) {
    for (const ext of [''].concat(JS_EXTS)) if (ctx.isFile(base + ext) && JS_FILE_RE.test(base + ext)) return base + ext;
    for (const ext of JS_EXTS) if (ctx.isFile(`${base}/index${ext}`)) return `${base}/index${ext}`;
  }
  const stem = path.posix.basename(module).replace(/\.[^.]+$/, '').toLowerCase();
  const cands = jsByStem(ctx).get(stem) || [];
  if (cands.length === 1) return cands[0];
  if (cands.length > 1) {
    const tail = stripExt(module.replace(/^(?:\.{1,2}\/)+/, ''));
    const narrowed = cands.filter((k) => stripExt(k) === tail || stripExt(k).endsWith('/' + tail));
    if (narrowed.length === 1) return narrowed[0];
  }
  return null;
}

// A module that re-exports wholesale, or builds its exports at run time, has
// names the text does not show — never a finding.
const JS_DYNAMIC_EXPORT_RE = /\bexport\s*\*|\bmodule\.exports\s*=\s*require\s*\(|\bObject\.assign\s*\(\s*(?:module\.)?exports\b|__exportStar|\bexports\s*\[/;
const PY_DYNAMIC_EXPORT_RE = /^\s*from\s+[.\w]+\s+import\s+\*|^\s*def\s+__getattr__\s*\(|\bglobals\s*\(\s*\)\s*\[|\bimportlib\b|\b__import__\s*\(/m;

// ── Public ──────────────────────────────────────────────────────────────────

/**
 * Whether an import names something that exists.
 * @param {{ module: string, kind: string, relative: boolean }} imp
 * @param {object} ctx  from buildImportContext
 * @returns {{ status: 'resolved'|'unresolved'|'unknown', via?: string, file?: string }}
 */
function classifyImport(imp, ctx) {
  if (imp.kind === 'py') return imp.relative ? resolvePyRelative(ctx, imp.module) : resolvePyModule(ctx, imp.module);
  if (imp.kind === 'go') return resolveGoImport(ctx, imp.module);
  return { status: 'unknown' };
}

/**
 * The names an import takes by name that its module does not have — only when
 * the module is a repo file that resolves uniquely and cannot re-export.
 * @returns {{ file: string, missing: string[] } | null}
 */
function missingNames(imp, ctx) {
  if (!imp.names || imp.names.length === 0) return null;
  if (imp.kind === 'js') {
    if (!imp.relative) return null;
    const file = jsModuleFile(ctx, imp.module);
    if (!file || !JS_FILE_RE.test(file)) return null;
    const text = ctx.readText(file);
    if (!text || JS_DYNAMIC_EXPORT_RE.test(text)) return null;
    const missing = imp.names.filter((n) => !mentions(text, n));
    return missing.length ? { file, missing } : null;
  }
  if (imp.kind === 'py') {
    const file = pyModuleFile(ctx, imp);
    if (!file) return null;
    const text = ctx.readText(file);
    if (PY_DYNAMIC_EXPORT_RE.test(text)) return null;
    const pkgDir = /(?:^|\/)__init__\.pyi?$/.test(file) ? file.replace(/\/?__init__\.pyi?$/, '') : null;
    const submodule = (n) => pkgDir !== null && [`${n}.py`, `${n}.pyi`, `${n}/__init__.py`]
      .some((tail) => ctx.exists((pkgDir ? pkgDir + '/' : '') + tail));
    const missing = imp.names.filter((n) => !mentions(text, n) && !submodule(n));
    return missing.length ? { file, missing } : null;
  }
  return null;
}

module.exports = {
  buildImportContext,
  classifyImport,
  missingNames,
  parseGoMod,
};
