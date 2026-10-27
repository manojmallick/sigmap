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
 *     (`types`/`typings`, `exports` types, `typesVersions`, else `index.d.ts`; or
 *     `node_modules/@types/<dep>` when the package ships none), and followed through
 *     the relative `export * from` barrels that most large libraries are made of (#990).
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
const MAX_PARTS = 400;            // declaration files read for one library (barrels included)
const MAX_DTS_FILE_BYTES = 4 * 1024 * 1024;  // one declaration file (valibot's is 630 KB, @types/node's larger)
const MAX_PARTS_BYTES = 16 * 1024 * 1024;    // total bytes read for one library
// `typesVersions` keys are TypeScript version ranges. A fixed assumption keeps the
// answer the same on every machine, instead of depending on whichever compiler is installed.
const ASSUMED_TS = [5, 9];
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

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (_) { return false; }
}

/** `foo.js` → `foo.d.ts`, `foo.mjs` → `foo.d.mts`, `foo.cjs` → `foo.d.cts` (how TypeScript pairs them). */
function declarationOf(rel) {
  const m = rel.match(/^(.*)\.(js|mjs|cjs)$/);
  if (!m) return rel;
  return `${m[1]}.d.${m[2] === 'js' ? 'ts' : m[2].replace('js', 'ts')}`;
}

/** Whether a `typesVersions` range key applies to the compiler version assumed above. */
function rangeApplies(range) {
  if (range === '*') return true;
  const m = String(range).trim().match(/^>=?\s*(\d+)\.(\d+)/);
  if (!m) return false;
  const [maj, min] = [Number(m[1]), Number(m[2])];
  return maj < ASSUMED_TS[0] || (maj === ASSUMED_TS[0] && min <= ASSUMED_TS[1]);
}

/**
 * Where `typesVersions` sends a package-relative path: the first range that applies
 * and has a pattern matching it, as TypeScript does. The path itself when none does.
 */
function applyTypesVersions(pkg, rel) {
  const tv = pkg && pkg.typesVersions;
  if (!tv || typeof tv !== 'object') return [rel];
  const want = rel.replace(/^\.\//, '');
  for (const range of Object.keys(tv)) {
    if (!rangeApplies(range) || !tv[range] || typeof tv[range] !== 'object') continue;
    const out = [];
    for (const pattern of Object.keys(tv[range])) {
      const targets = [].concat(tv[range][pattern]).filter((t) => typeof t === 'string');
      const star = pattern.indexOf('*');
      let captured = null;
      if (star === -1) {
        if (pattern.replace(/^\.\//, '') === want) captured = '';
      } else {
        const pre = pattern.slice(0, star).replace(/^\.\//, '');
        const post = pattern.slice(star + 1);
        if (want.startsWith(pre) && want.endsWith(post) && want.length >= pre.length + post.length) {
          captured = want.slice(pre.length, want.length - post.length);
        }
      }
      if (captured === null) continue;
      for (const t of targets) out.push(t.replace('*', captured));
    }
    if (out.length) return out;
  }
  return [rel];
}

/** The declaration (or, failing that, JS) paths a package.json `exports` map names for `subpath` ('.' is the root). */
function exportsEntries(pkg, subpath = '.') {
  const ex = pkg && pkg.exports;
  if (!ex) return [];
  const out = [];
  const visit = (node, depth) => {
    if (node == null || depth > 6) return;
    if (typeof node === 'string') { out.push(node); return; }
    if (Array.isArray(node)) { for (const n of node) visit(n, depth + 1); return; }
    if (typeof node !== 'object') return;
    if ('types' in node) visit(node.types, depth + 1); // the `types` condition leads
    for (const k of Object.keys(node)) {
      if (k === 'types' || (k.startsWith('.') && k !== '.')) continue; // a subpath, not the root
      visit(node[k], depth + 1);
    }
  };
  const subpathMap = typeof ex === 'object' && !Array.isArray(ex) && Object.keys(ex).some((k) => k.startsWith('.'));
  if (subpathMap) visit(ex[subpath], 0);
  else if (subpath === '.') visit(ex, 0);
  return out;
}

/** `@scope/name` → `@types/scope__name`; `name` → `@types/name`. */
function typesPackageName(dep) {
  return dep.startsWith('@') ? `@types/${dep.slice(1).replace('/', '__')}` : `@types/${dep}`;
}

/** Candidate declaration paths inside one package directory, best first. */
function entryCandidates(pkg) {
  const out = [];
  const typesField = pkg.types || pkg.typings;
  if (typeof typesField === 'string') {
    out.push(...applyTypesVersions(pkg, typesField));
    out.push(path.join(typesField, 'index.d.ts')); // typesField may be a dir
  }
  for (const e of exportsEntries(pkg)) out.push(/\.d\.[cm]?ts$/.test(e) ? e : declarationOf(e));
  out.push(...applyTypesVersions(pkg, 'index.d.ts'));
  if (typeof pkg.main === 'string') out.push(declarationOf(pkg.main), pkg.main.replace(/\.(js|cjs|mjs)$/, '.d.ts'));
  return out;
}

function firstExisting(pkgDir, candidates) {
  for (const c of candidates) {
    const p = path.join(pkgDir, c);
    if (isFile(p) && p.startsWith(pkgDir)) return p;
  }
  return null;
}

/**
 * Resolve an installed dependency's version + entry `.d.ts` path.
 *
 * The package's own types come first — `types`/`typings`, the `exports` map's
 * `types` condition, `typesVersions`, `index.d.ts`, `main` — and then
 * `node_modules/@types/<dep>`, which is where an untyped package's declarations live.
 *
 * @returns {{ version: string|null, dtsPath: string|null, pkgDir: string, via: string|null }|null} null if not installed
 */
function resolveEntry(cwd, dep) {
  const pkgDir = path.join(cwd, 'node_modules', dep);
  const pkg = readJson(path.join(pkgDir, 'package.json'));
  if (!pkg) return null;
  const version = typeof pkg.version === 'string' ? pkg.version : null;

  const own = firstExisting(pkgDir, entryCandidates(pkg));
  if (own) return { version, dtsPath: own, pkgDir, via: 'package' };

  const typesDir = path.join(cwd, 'node_modules', typesPackageName(dep));
  const typesPkg = readJson(path.join(typesDir, 'package.json'));
  if (typesPkg) {
    const theirs = firstExisting(typesDir, entryCandidates(typesPkg));
    if (theirs) return { version, dtsPath: theirs, pkgDir: typesDir, via: '@types' };
  }
  return { version, dtsPath: null, pkgDir, via: null }; // installed but untyped
}

/**
 * Where a relative re-export specifier lands on disk, inside `root`, or null.
 * `./x.js` and `./x.ts` are the declaration `./x.d.ts` (or `.d.cts`/`.d.mts`, in
 * the family of the file that names it); `./x` is `x.d.ts` or `x/index.d.ts`.
 */
function resolveReexport(fromFile, spec, root) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const fam = (fromFile.match(/\.d\.([cm]?ts)$/) || [null, 'ts'])[1];
  const stemmed = base.match(/^(.*)\.(?:js|mjs|cjs|ts|mts|cts)$/);
  let cands;
  if (/\.d\.[cm]?ts$/.test(base)) cands = [base];
  else if (stemmed) cands = [`${stemmed[1]}.d.${fam}`, `${stemmed[1]}.d.ts`, `${stemmed[1]}.d.mts`, `${stemmed[1]}.d.cts`];
  else cands = [`${base}.d.${fam}`, `${base}.d.ts`, `${base}.d.mts`, `${base}.d.cts`, path.join(base, `index.d.${fam}`), path.join(base, 'index.d.ts')];
  for (const c of cands) {
    if (c.startsWith(root + path.sep) && isFile(c)) return c;
  }
  return null;
}

/**
 * Where a bare re-export specifier lands: another installed package (`export * from
 * "types-ramda"`) or a subpath of the package itself (`export * from 'zustand/vanilla'`),
 * found the way Node finds them — up the node_modules chain from the file naming it.
 * @returns {{ file: string, root: string }|null}
 */
function resolveBare(fromFile, spec) {
  const parts = spec.split('/');
  const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const sub = spec.slice(name.length).replace(/^\//, '');
  let dir = path.dirname(fromFile);
  for (let i = 0; i < 24; i++) {
    const pkgDir = path.join(dir, 'node_modules', name);
    const pkg = readJson(path.join(pkgDir, 'package.json'));
    if (pkg) {
      let cands;
      if (!sub) cands = entryCandidates(pkg);
      else {
        cands = exportsEntries(pkg, './' + sub).map((e) => (/\.d\.[cm]?ts$/.test(e) ? e : declarationOf(e)));
        cands.push(`${sub}.d.ts`, path.join(sub, 'index.d.ts'), declarationOf(sub));
      }
      const file = firstExisting(pkgDir, cands);
      return file ? { file, root: pkgDir } : null;
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

const EXPORT_STAR_RE = /\bexport\s*\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s*)?from\s*(['"])([^'"\r\n]+)\2/g;

/**
 * Every exported name of a library: its entry declaration file and the relative
 * `export * from` files behind it. A barrel (`export * from './external'`) holds no
 * names of its own, which is how zod and rxjs read as empty before (#990).
 *
 * `unread` counts what could not be enumerated — a re-export whose file is not there,
 * the read caps, and an `export =` whose members are not listed — so a caller can say
 * the list is partial instead of treating it as the whole.
 *
 * @returns {{ names: string[], parts: Array<[string, number]>, unread: number }}
 */
function readDtsClosure(entryPath, root) {
  const names = new Set();
  const parts = [];
  const seen = new Set();
  const queue = [{ file: entryPath, root }];
  let unread = 0;
  let bytes = 0;
  while (queue.length) {
    const { file, root: pkgRoot } = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    if (parts.length >= MAX_PARTS || bytes >= MAX_PARTS_BYTES) { unread++; continue; }
    let src = '';
    let mtime = 0;
    try {
      const st = fs.statSync(file);
      mtime = st.mtimeMs;
      if (st.size > MAX_DTS_FILE_BYTES) { unread++; parts.push([file, mtime]); continue; }
      src = fs.readFileSync(file, 'utf8');
    } catch (_) { unread++; continue; }
    bytes += src.length;
    parts.push([file, mtime]);
    for (const n of extractDtsExports(src)) names.add(n);
    // `export = X` makes X's members the module's names, and X is a namespace or interface
    // whose members this extractor does not enumerate: the list is a floor, not the whole.
    if (/\bexport\s*=\s*[A-Za-z_$]/.test(src)) unread++;
    let m;
    EXPORT_STAR_RE.lastIndex = 0;
    while ((m = EXPORT_STAR_RE.exec(src)) !== null) {
      if (m[1]) names.add(m[1]); // export * as ns from '…'
      if (m[1]) continue; // its members are reached as ns.x, which is not a named import
      const spec = m[3];
      if (spec.startsWith('.')) {
        const target = resolveReexport(file, spec, pkgRoot);
        if (target) queue.push({ file: target, root: pkgRoot }); else unread++;
      } else {
        const target = resolveBare(file, spec);
        if (target) queue.push(target); else unread++;
      }
    }
  }
  return { names: [...names].sort(), parts, unread };
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
 * @returns {{ symbols: Set<string>, libraries: Array<{name,version,symbols,typed,partial}>, count: number }}
 *   `partial` is present (true) only when a re-export behind the entry could not be read, so `symbols` is a floor
 */
function buildLibraryIndex(cwd, opts = {}) {
  const version = opts.version || '0';
  const useCache = opts.cache !== false;

  // Collect entries from both ecosystems; each carries its extractor kind.
  const entries = []; // { name, version, sourcePath, kind: 'dts'|'py' }
  for (const dep of directDeps(cwd).slice(0, MAX_DEPS)) {
    const r = resolveEntry(cwd, dep);
    if (r) entries.push({ name: dep, version: r.version, sourcePath: r.dtsPath, pkgDir: r.pkgDir, kind: 'dts' });
  }
  const sitePkgs = findSitePackages(cwd);
  if (sitePkgs.length) {
    for (const dep of pythonDirectDeps(cwd).slice(0, MAX_DEPS)) {
      const r = resolvePyEntry(sitePkgs, dep);
      if (r) entries.push({ name: dep, version: r.version, sourcePath: r.sourcePath, kind: 'py' });
    }
  }

  const cache = useCache ? loadCache(cwd, version) : new Map();
  const files = entries.filter((e) => e.sourcePath && e.kind === 'py').map((e) => e.sourcePath);
  const { unchanged } = getChangedFiles(files, cache);
  const unchangedSet = new Set(unchanged);
  const mtimeOf = (p) => { try { return fs.statSync(p).mtimeMs; } catch (_) { return null; } };
  // A declaration entry is valid while every file it was read from is unchanged: a
  // barrel's names live in its children, so the entry file's own mtime says nothing (#990).
  const partsCurrent = (c, p) => !!c && Array.isArray(c.parts) && c.mtime === mtimeOf(p)
    && c.parts.every(([f, m]) => mtimeOf(f) === m);

  const symbols = new Set();
  const libraries = [];
  const fresh = [];

  let dirty = false;
  for (const e of entries) {
    let names;
    let unread = 0;
    if (!e.sourcePath) {
      names = [];
    } else if (e.kind === 'dts') {
      const hit = cache.get(e.sourcePath);
      if (useCache && partsCurrent(hit, e.sourcePath)) {
        names = hit.sigs || [];
        unread = hit.unread || 0;
      } else {
        const closure = readDtsClosure(e.sourcePath, e.pkgDir);
        names = closure.names;
        unread = closure.unread;
        cache.set(e.sourcePath, { mtime: mtimeOf(e.sourcePath), sigs: names, parts: closure.parts, unread });
        dirty = true;
      }
    } else if (unchangedSet.has(e.sourcePath) && cache.get(e.sourcePath)) {
      names = cache.get(e.sourcePath).sigs || [];
    } else {
      let src = '';
      try {
        if (fs.statSync(e.sourcePath).size <= MAX_DTS_BYTES) src = fs.readFileSync(e.sourcePath, 'utf8');
      } catch (_) { /* unreadable → empty */ }
      names = extractPyExports(src);
      fresh.push({ file: e.sourcePath, sigs: names });
    }
    for (const n of names) symbols.add(n);
    libraries.push({ name: e.name, version: e.version, symbols: names.length, typed: !!e.sourcePath, ...(unread > 0 ? { partial: true } : {}) });
  }

  if (useCache && (fresh.length || dirty)) {
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
  buildLibraryIndex, extractDtsExports, directDeps, resolveEntry, readDtsClosure, formatVersionPins,
  collectVersionPins,
  extractPyExports, pythonDirectDeps, findSitePackages, resolvePyEntry,
};
