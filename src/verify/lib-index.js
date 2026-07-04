'use strict';

/**
 * Local-library signature index (v9.0 G5/D5 — the private-API grounding moat).
 *
 * Context7 knows only *public* library docs. SigMap can do something no
 * competitor can: index the signatures of the libraries **actually installed**
 * in `node_modules` and verify AI suggestions against repo + private +
 * installed-lib symbols. This module builds the installed-lib half.
 *
 * For each **direct** dependency declared in `package.json`, it locates the
 * package under `node_modules/<dep>`, reads its version (D8 version pinning),
 * and extracts the exported symbol names from its TypeScript declaration entry
 * (`types`/`typings`, else `index.d.ts`). Pure, zero-dependency, deterministic:
 * byte-stable given a fixed installed tree. Bounded (per-file read cap + dep
 * cap) and cached via `src/cache/sig-cache.js` so repeat builds are near-free.
 */

const fs = require('fs');
const path = require('path');
const { loadCache, saveCache, getChangedFiles, updateCacheEntries } = require('../cache/sig-cache');

const MAX_DTS_BYTES = 512 * 1024; // per-file read cap
const MAX_DEPS = 1000;            // dep count cap
const DEP_KEYS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

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
  const deps = directDeps(cwd).slice(0, MAX_DEPS);

  const entries = [];
  for (const dep of deps) {
    const r = resolveEntry(cwd, dep);
    if (r) entries.push({ dep, version: r.version, dtsPath: r.dtsPath });
  }

  const cache = useCache ? loadCache(cwd, version) : new Map();
  const dtsFiles = entries.filter((e) => e.dtsPath).map((e) => e.dtsPath);
  const { unchanged } = getChangedFiles(dtsFiles, cache);
  const unchangedSet = new Set(unchanged);

  const symbols = new Set();
  const libraries = [];
  const fresh = [];

  for (const e of entries) {
    let names;
    if (!e.dtsPath) {
      names = [];
    } else if (unchangedSet.has(e.dtsPath) && cache.get(e.dtsPath)) {
      names = cache.get(e.dtsPath).sigs || [];
    } else {
      let src = '';
      try {
        if (fs.statSync(e.dtsPath).size <= MAX_DTS_BYTES) src = fs.readFileSync(e.dtsPath, 'utf8');
      } catch (_) { /* unreadable → empty */ }
      names = extractDtsExports(src);
      fresh.push({ file: e.dtsPath, sigs: names });
    }
    for (const n of names) symbols.add(n);
    libraries.push({ name: e.dep, version: e.version, symbols: names.length, typed: !!e.dtsPath });
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

module.exports = { buildLibraryIndex, extractDtsExports, directDeps, resolveEntry, formatVersionPins };
