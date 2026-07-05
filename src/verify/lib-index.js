'use strict';

/**
 * Local-library signature index (v9.0 G5/D5 — the private-API grounding moat).
 *
 * Context7 knows only *public* library docs. SigMap can do something no
 * competitor can: index the signatures of the libraries **actually installed**
 * in `node_modules` and verify AI suggestions against repo + private +
 * installed-lib symbols. This module builds the installed-lib half.
 *
 * Two ecosystems, one index:
 *   - **JS/TS** — each **direct** dependency in `package.json` resolved under
 *     `node_modules/<dep>`; exports read from its TypeScript declaration entry
 *     (`types`/`typings`, else `index.d.ts`).
 *   - **Python** — each direct dependency in `requirements.txt`/`pyproject.toml`
 *     resolved in the project's venv `site-packages`; exports read from the
 *     package's `__init__.py`/`.pyi`. No Python runtime is spawned (North-Star #1).
 *
 * Pure, zero-dependency, deterministic: byte-stable given a fixed installed
 * tree. Bounded (per-file read cap + dep cap) and cached via
 * `src/cache/sig-cache.js` so repeat builds are near-free.
 */

const fs = require('fs');
const path = require('path');
const { loadCache, saveCache, getChangedFiles, updateCacheEntries } = require('../cache/sig-cache');

const MAX_DTS_BYTES = 512 * 1024; // per-file read cap
const MAX_DEPS = 1000;            // dep count cap
const DEP_KEYS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const VENV_DIRS = ['.venv', 'venv', 'env', '.env'];

/**
 * Extract exported symbol names from a `.d.ts` declaration file. Deterministic,
 * regex-based (declaration files are already normalized, so this is robust
 * without a full TS parser and stays zero-dependency).
 * @param {string} src
 * @returns {string[]} sorted unique exported names
 */
function extractDtsExports(src) {
  const names = new Set();
  if (!src) return [];

  // export [declare] [default] function|const|let|var|class|interface|type|enum|namespace Name
  const declRe = /\bexport\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum|namespace|module)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = declRe.exec(src)) !== null) names.add(m[1]);

  // export { a, b as c, default as d }
  const listRe = /\bexport\s*(?:type\s*)?\{([^}]*)\}/g;
  while ((m = listRe.exec(src)) !== null) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name) && name !== 'default') names.add(name);
    }
  }

  // export as namespace Name  /  export = Name
  const nsRe = /\bexport\s+as\s+namespace\s+([A-Za-z_$][\w$]*)/g;
  while ((m = nsRe.exec(src)) !== null) names.add(m[1]);
  const assignRe = /\bexport\s*=\s*([A-Za-z_$][\w$]*)/g;
  while ((m = assignRe.exec(src)) !== null) names.add(m[1]);

  return [...names].sort();
}

/** Read direct dependency names declared in the project's package.json. */
function directDeps(cwd) {
  const names = new Set();
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    for (const k of DEP_KEYS) {
      if (pkg[k] && typeof pkg[k] === 'object') {
        for (const n of Object.keys(pkg[k])) names.add(n);
      }
    }
  } catch (_) { /* no/invalid package.json → no deps */ }
  return [...names].sort();
}

/**
 * Resolve an installed dependency's version + entry `.d.ts` path.
 * @returns {{ version: string|null, dtsPath: string|null }|null} null if not installed
 */
function resolveEntry(cwd, dep) {
  const pkgDir = path.join(cwd, 'node_modules', dep);
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')); } catch (_) { return null; }
  const version = typeof pkg.version === 'string' ? pkg.version : null;

  const candidates = [];
  const typesField = pkg.types || pkg.typings;
  if (typeof typesField === 'string') {
    candidates.push(typesField);
    candidates.push(path.join(typesField, 'index.d.ts')); // typesField may be a dir
  }
  candidates.push('index.d.ts');
  if (typeof pkg.main === 'string') candidates.push(pkg.main.replace(/\.(js|cjs|mjs)$/, '.d.ts'));

  for (const c of candidates) {
    const p = path.join(pkgDir, c);
    try { if (fs.statSync(p).isFile()) return { version, dtsPath: p }; } catch (_) { /* next */ }
  }
  return { version, dtsPath: null }; // installed but untyped
}

// ── Python ──────────────────────────────────────────────────────────────────

/**
 * Extract exported symbol names from a Python module's `__init__.py`/`.pyi`.
 * Deterministic, regex-based, top-level only: `__all__`, `def`/`class`, public
 * module-level assignments, and `from … import …` re-exports (a package's
 * public API is largely re-exports). Private names (leading `_`) are skipped
 * unless listed in `__all__`.
 * @param {string} src
 * @returns {string[]} sorted unique exported names
 */
function extractPyExports(src) {
  const names = new Set();
  if (!src) return [];

  // __all__ = [ 'a', 'b', ... ]  (authoritative when present; keeps privates)
  const allMatch = src.match(/^__all__\s*[:+]?=\s*[\[(]([\s\S]*?)[\])]/m);
  if (allMatch) {
    for (const m of allMatch[1].matchAll(/['"]([A-Za-z_]\w*)['"]/g)) names.add(m[1]);
  }

  // top-level def / class (column 0)
  for (const m of src.matchAll(/^(?:async\s+)?def\s+([A-Za-z_]\w*)/gm)) if (!m[1].startsWith('_')) names.add(m[1]);
  for (const m of src.matchAll(/^class\s+([A-Za-z_]\w*)/gm)) if (!m[1].startsWith('_')) names.add(m[1]);

  // top-level public assignments: NAME = …  /  NAME: type = …  (not ==, +=, etc.)
  for (const m of src.matchAll(/^([A-Za-z_]\w*)\s*(?::[^=\n]+)?=(?!=)/gm)) {
    if (!m[1].startsWith('_')) names.add(m[1]);
  }

  // re-exports: from .mod import Name, Other as Alias
  for (const m of src.matchAll(/^from\s+[^\n]+?\s+import\s+([^\n#]+)/gm)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/[()]/g, '').split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_]\w*$/.test(name) && !name.startsWith('_')) names.add(name);
    }
  }

  return [...names].sort();
}

/** Read direct Python dependency names from requirements.txt + pyproject.toml. */
function pythonDirectDeps(cwd) {
  const names = new Set();
  try {
    const req = fs.readFileSync(path.join(cwd, 'requirements.txt'), 'utf8');
    for (const line of req.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('-')) continue;
      const m = t.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/);
      if (m) names.add(m[1]);
    }
  } catch (_) { /* none */ }
  try {
    const py = fs.readFileSync(path.join(cwd, 'pyproject.toml'), 'utf8');
    // PEP 621: [project] dependencies = ["foo>=1", "bar"]
    const projDeps = py.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m);
    if (projDeps) for (const m of projDeps[1].matchAll(/['"]([A-Za-z0-9][A-Za-z0-9._-]*)/g)) names.add(m[1]);
    // Poetry: [tool.poetry.dependencies]\n foo = "^1"
    const poetry = py.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)/);
    if (poetry) for (const m of poetry[1].matchAll(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*=/gm)) {
      if (m[1] !== 'python') names.add(m[1]);
    }
  } catch (_) { /* none */ }
  return [...names].sort();
}

/** Locate the project's venv `site-packages` directories (no Python runtime). */
function findSitePackages(cwd) {
  const out = [];
  for (const v of VENV_DIRS) {
    const base = path.join(cwd, v);
    const libDir = path.join(base, 'lib'); // POSIX: <venv>/lib/pythonX.Y/site-packages
    let pyDirs = [];
    try { pyDirs = fs.readdirSync(libDir).filter((d) => /^python\d/.test(d)).sort(); } catch (_) { /* none */ }
    for (const py of pyDirs) {
      const sp = path.join(libDir, py, 'site-packages');
      try { if (fs.statSync(sp).isDirectory()) out.push(sp); } catch (_) { /* next */ }
    }
    const winSp = path.join(base, 'Lib', 'site-packages'); // Windows
    try { if (fs.statSync(winSp).isDirectory()) out.push(winSp); } catch (_) { /* next */ }
  }
  return out;
}

/** PEP 503 name normalization (case-insensitive, `-`/`_`/`.` collapsed). */
function normalizePy(name) {
  return String(name).toLowerCase().replace(/[-_.]+/g, '-');
}

/** Find an installed distribution's version from its `*.dist-info`/`*.egg-info`. */
function findPyVersion(sitePkgsDir, dep) {
  const norm = normalizePy(dep);
  let entries;
  try { entries = fs.readdirSync(sitePkgsDir); } catch (_) { return null; }
  for (const e of entries.sort()) {
    const m = e.match(/^(.+?)-(\d[^-]*)\.(?:dist-info|egg-info)$/);
    if (m && normalizePy(m[1]) === norm) return m[2];
  }
  return null;
}

/**
 * Resolve a Python dependency to its installed module entry file + version.
 * @returns {{ version: string|null, sourcePath: string|null }|null} null if not installed
 */
function resolvePyEntry(sitePkgsDirs, dep) {
  const candidates = [...new Set([dep, dep.replace(/-/g, '_'), dep.toLowerCase(), dep.toLowerCase().replace(/-/g, '_')])];
  for (const sp of sitePkgsDirs) {
    const version = findPyVersion(sp, dep);
    for (const cand of candidates) {
      for (const entry of ['__init__.pyi', '__init__.py']) { // package
        const p = path.join(sp, cand, entry);
        try { if (fs.statSync(p).isFile()) return { version, sourcePath: p }; } catch (_) { /* next */ }
      }
      for (const ext of ['.pyi', '.py']) { // single-module
        const p = path.join(sp, cand + ext);
        try { if (fs.statSync(p).isFile()) return { version, sourcePath: p }; } catch (_) { /* next */ }
      }
    }
  }
  return null;
}

/**
 * Build the installed-library signature index for `cwd`.
 *
 * @param {string} cwd
 * @param {object} [opts]
 * @param {string} [opts.version='0']  sigmap version, for cache busting
 * @param {boolean} [opts.cache=true]  use the on-disk sig-cache
 * @returns {{ symbols: Set<string>, libraries: Array<{name,version,symbols,typed}>, count: number }}
 */
function buildLibraryIndex(cwd, opts = {}) {
  const version = opts.version || '0';
  const useCache = opts.cache !== false;

  // Collect entries from both ecosystems; each carries its extractor kind.
  const entries = []; // { name, version, sourcePath, kind: 'dts'|'py' }
  for (const dep of directDeps(cwd).slice(0, MAX_DEPS)) {
    const r = resolveEntry(cwd, dep);
    if (r) entries.push({ name: dep, version: r.version, sourcePath: r.dtsPath, kind: 'dts' });
  }
  const sitePkgs = findSitePackages(cwd);
  if (sitePkgs.length) {
    for (const dep of pythonDirectDeps(cwd).slice(0, MAX_DEPS)) {
      const r = resolvePyEntry(sitePkgs, dep);
      if (r) entries.push({ name: dep, version: r.version, sourcePath: r.sourcePath, kind: 'py' });
    }
  }

  const cache = useCache ? loadCache(cwd, version) : new Map();
  const files = entries.filter((e) => e.sourcePath).map((e) => e.sourcePath);
  const { unchanged } = getChangedFiles(files, cache);
  const unchangedSet = new Set(unchanged);

  const symbols = new Set();
  const libraries = [];
  const fresh = [];

  for (const e of entries) {
    let names;
    if (!e.sourcePath) {
      names = [];
    } else if (unchangedSet.has(e.sourcePath) && cache.get(e.sourcePath)) {
      names = cache.get(e.sourcePath).sigs || [];
    } else {
      let src = '';
      try {
        if (fs.statSync(e.sourcePath).size <= MAX_DTS_BYTES) src = fs.readFileSync(e.sourcePath, 'utf8');
      } catch (_) { /* unreadable → empty */ }
      names = e.kind === 'py' ? extractPyExports(src) : extractDtsExports(src);
      fresh.push({ file: e.sourcePath, sigs: names });
    }
    for (const n of names) symbols.add(n);
    libraries.push({ name: e.name, version: e.version, symbols: names.length, typed: !!e.sourcePath });
  }

  if (useCache && fresh.length) {
    updateCacheEntries(cache, fresh);
    saveCache(cwd, version, cache);
  }

  libraries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { symbols, libraries, count: symbols.size };
}

/** D8: render `name@version` pins for the typed/installed libraries. */
function formatVersionPins(libraries) {
  return (libraries || [])
    .filter((l) => l.version)
    .map((l) => `${l.name}@${l.version}`);
}

/**
 * D8: collect `name@version` pins for direct dependencies — versions only, no
 * symbol extraction, no cache. Cheap enough to run on every context build so
 * the generated header can ground against what is actually installed (JS +
 * Python). Deterministic: sorted, then capped.
 * @param {string} cwd
 * @param {object} [opts]
 * @param {number} [opts.limit=40] max pins returned (after sort)
 * @returns {{ pins: string[], total: number }} pins capped to limit; total = all resolved
 */
function collectVersionPins(cwd, opts = {}) {
  const limit = Number.isInteger(opts.limit) && opts.limit >= 0 ? opts.limit : 40;
  const pins = [];
  for (const dep of directDeps(cwd).slice(0, MAX_DEPS)) {
    const r = resolveEntry(cwd, dep);
    if (r && r.version) pins.push(`${dep}@${r.version}`);
  }
  const sitePkgs = findSitePackages(cwd);
  if (sitePkgs.length) {
    for (const dep of pythonDirectDeps(cwd).slice(0, MAX_DEPS)) {
      const r = resolvePyEntry(sitePkgs, dep);
      if (r && r.version) pins.push(`${dep}@${r.version}`);
    }
  }
  pins.sort();
  return { pins: limit ? pins.slice(0, limit) : pins, total: pins.length };
}

module.exports = {
  buildLibraryIndex, extractDtsExports, directDeps, resolveEntry, formatVersionPins,
  collectVersionPins,
  extractPyExports, pythonDirectDeps, findSitePackages, resolvePyEntry,
};
