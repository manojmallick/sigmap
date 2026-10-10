'use strict';

/**
 * Dependency graph builder (v2.5).
 *
 * Builds a forward and reverse dependency graph by resolving import/require
 * statements across JS/TS, Python, Go, Rust, Java, Kotlin, and Ruby files.
 *
 * @module src/graph/builder
 */

const fs   = require('fs');
const path = require('path');

// Cross-platform node key. Delegates to the ONE shared definition so this graph
// and the call-graph cannot drift apart again (see src/graph/path-key.js).
const { graphKey } = require('./path-key');
const { resolveGraphDirs, configuredSrcDirs } = require('./src-dirs');
function normalizePath(p) {
  return graphKey(p);
}

// ---------------------------------------------------------------------------
// Language-specific import extractors
// ---------------------------------------------------------------------------

const JS_EXTS  = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const PY_EXTS  = new Set(['.py', '.pyw']);
const GO_EXTS  = new Set(['.go']);
const RS_EXTS  = new Set(['.rs']);
const JVM_EXTS = new Set(['.java', '.kt', '.kts', '.scala', '.sc']);
const RB_EXTS  = new Set(['.rb', '.rake']);
const R_EXTS   = new Set(['.r', '.R']);
const EX_EXTS  = new Set(['.ex', '.exs']);

// ---------------------------------------------------------------------------
// Per-build lookup tables
// ---------------------------------------------------------------------------
// Go, JVM and Elixir imports name a module, not a file, so each used to be
// resolved by scanning EVERY file in the set — normalising its path, twice for
// the JVM — per import: O(imports × files). Once the walk follows the detected
// roots a repo with a few thousand files spent most of its graph build inside
// path.normalize (akka: 24 of 30 s). These tables are built once per file set
// and answer the same questions by key, keeping the "first match in set order"
// the scans had, so the edge set does not change.

const _tables = new WeakMap();

function tablesFor(fileSet) {
  let t = _tables.get(fileSet);
  if (t && t.size === fileSet.size) return t;
  const files = [...fileSet];
  t = { size: fileSet.size, files, keys: files.map(normalizePath), byBase: null, byDir: null };
  _tables.set(fileSet, t);
  return t;
}

function _push(map, key, i) {
  const a = map.get(key);
  if (a) a.push(i); else map.set(key, [i]);
}

/** file name → indices of the files carrying it, in set order. */
function byBase(t) {
  if (!t.byBase) {
    t.byBase = new Map();
    t.keys.forEach((k, i) => _push(t.byBase, k.slice(k.lastIndexOf(path.sep) + 1), i));
  }
  return t.byBase;
}

/** directory component → indices of the files below one, in set order. */
function byDir(t) {
  if (!t.byDir) {
    t.byDir = new Map();
    t.keys.forEach((k, i) => {
      const parts = k.split(path.sep);
      parts.pop(); // the file name is not a directory
      for (const p of new Set(parts)) _push(t.byDir, p, i);
    });
  }
  return t.byDir;
}

/** First file (set order) whose key ends with `want` — a normalised relative tail. */
function firstEndingWith(t, want) {
  const cut = want.lastIndexOf(path.sep);
  if (cut === -1) {
    // No directory part, so the file-name bucket cannot narrow it: a bare
    // `Foo.java` is also the tail of `BarFoo.java`. Rare; scan.
    for (const k of t.keys) if (k.endsWith(want)) return k;
    return null;
  }
  const bucket = byBase(t).get(want.slice(cut + 1));
  if (!bucket) return null;
  for (const i of bucket) if (t.keys[i].endsWith(want)) return t.keys[i];
  return null;
}

/**
 * First file a Go import's last path segment names: `<suffix>.go`, or any file
 * below a directory called `<suffix>`.
 */
function firstGoMatch(t, suffix) {
  const a = byBase(t).get(suffix + '.go');
  const b = suffix ? byDir(t).get(suffix) : undefined;
  const i = Math.min(a ? a[0] : Infinity, b ? b[0] : Infinity);
  return i === Infinity ? null : t.keys[i];
}

/**
 * Probe an absolute base path for a JS/TS module file in fileSet, trying the
 * usual extension and index-file candidates.
 * @param {string} base - absolute path (no extension) to probe
 * @param {Set<string>} fileSet
 * @returns {string|null}
 */
function probeJs(base, fileSet) {
  const candidates = [
    base,
    base + '.ts', base + '.tsx',
    base + '.js', base + '.jsx', base + '.mjs', base + '.cjs',
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
    path.join(base, 'index.js'), path.join(base, 'index.jsx'),
  ];
  for (const c of candidates) {
    const normC = normalizePath(c);
    if (fileSet.has(normC)) return normC;
  }
  return null;
}

/**
 * Resolve a JS/TS relative import string to an absolute path in fileSet.
 * @param {string} dir - directory of the importing file
 * @param {string} importStr - raw import string (e.g. './utils', '../store')
 * @param {Set<string>} fileSet
 * @returns {string|null}
 */
function resolveJsPath(dir, importStr, fileSet) {
  return probeJs(path.resolve(dir, importStr), fileSet);
}

/**
 * Strip comments and trailing commas so a tsconfig/jsconfig (JSONC) parses.
 * Deliberately conservative — leaves string contents alone.
 */
function stripJsonc(src) {
  let out = '';
  let inStr = false, quote = '', inLine = false, inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === '\n') { inLine = false; out += c; } continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) { out += c; if (c === '\\') { out += (n || ''); i++; } else if (c === quote) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; quote = c; out += c; continue; }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    out += c;
  }
  // remove trailing commas before } or ]
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Load the JS/TS path-alias map from tsconfig.json / jsconfig.json.
 * Resolves `compilerOptions.paths` and `baseUrl` into absolute target bases so
 * bare/aliased imports (e.g. `@/utils`, `components/Button`) can be resolved to
 * on-disk files. Returns null when no config or no aliasing is configured.
 *
 * @param {string} cwd
 * @returns {{ baseUrl: string|null, entries: Array<{prefix:string,wildcard:boolean,targets:string[]}> }|null}
 */
function loadAliasMap(cwd) {
  if (!cwd) return null;
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    let json;
    try { json = JSON.parse(stripJsonc(fs.readFileSync(path.join(cwd, name), 'utf8'))); }
    catch (_) { continue; }
    const co = (json && json.compilerOptions) || {};
    const baseUrl = co.baseUrl ? path.resolve(cwd, co.baseUrl) : null;
    const base = baseUrl || cwd;
    const entries = [];
    for (const [pattern, targets] of Object.entries(co.paths || {})) {
      const wildcard = pattern.includes('*');
      const prefix = pattern.replace(/\*.*$/, '');
      const tgs = (Array.isArray(targets) ? targets : [])
        .map((t) => path.resolve(base, String(t).replace(/\*.*$/, '')));
      if (tgs.length) entries.push({ prefix, wildcard, targets: tgs });
    }
    if (baseUrl || entries.length) return { baseUrl, entries };
    return null;
  }
  return null;
}

/**
 * Resolve a non-relative JS/TS import specifier through the alias map.
 * @param {string} spec - e.g. '@/utils', '@app/Button', 'components/Nav'
 * @param {object|null} aliasMap - from loadAliasMap
 * @param {Set<string>} fileSet
 * @returns {string|null}
 */
function resolveAlias(spec, aliasMap, fileSet) {
  if (!aliasMap) return null;
  for (const e of aliasMap.entries) {
    if (e.wildcard) {
      if (spec.startsWith(e.prefix)) {
        const rest = spec.slice(e.prefix.length);
        for (const t of e.targets) {
          const r = probeJs(rest ? path.join(t, rest) : t, fileSet);
          if (r) return r;
        }
      }
    } else if (spec === e.prefix) {
      for (const t of e.targets) {
        const r = probeJs(t, fileSet);
        if (r) return r;
      }
    }
  }
  // Bare import resolved from baseUrl (tsconfig baseUrl without an explicit alias).
  if (aliasMap.baseUrl) {
    const r = probeJs(path.join(aliasMap.baseUrl, spec), fileSet);
    if (r) return r;
  }
  return null;
}

/**
 * Resolve an R `source(...)` argument to an absolute path in fileSet.
 * Tries the dir-relative path first, then a cwd-relative path so that
 * `source("R/helpers.R")` resolves from the project root.
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveRPath(dir, importStr, fileSet, cwd) {
  const tried = new Set();
  const bases = [path.resolve(dir, importStr)];
  if (cwd) bases.push(path.resolve(cwd, importStr));
  for (const base of bases) {
    for (const c of [base, base + '.R', base + '.r']) {
      const normC = normalizePath(c);
      if (tried.has(normC)) continue;
      tried.add(normC);
      // Check both original and normalized paths (tests may pass non-normalized fileSet)
      if (fileSet.has(c)) return c;
      if (fileSet.has(normC)) return normC;
    }
  }
  return null;
}

/**
 * Extract absolute dependency paths from a single file.
 * @param {string} filePath - absolute path to the file
 * @param {string} content  - file source content
 * @param {Set<string>} fileSet - set of all known absolute file paths
 * @param {string}  [cwd]   - project root, used to resolve R `source("R/...")` calls
 * @param {{ rPackage?: string, rLocalDefs?: Map<string,string> }} [ctx]
 *        Optional cross-file context. When present and the file is R, a
 *        `localPkg::fn` reference (where `localPkg` matches `rPackage`) is
 *        resolved to the file in `rLocalDefs` that defines `fn`.
 * @returns {string[]} resolved absolute paths this file imports
 */
function extractFileDeps(filePath, content, fileSet, cwd, ctx) {
  const ext = path.extname(filePath).toLowerCase();
  const dir = path.dirname(filePath);
  const found = [];

  // ── JS / TS ───────────────────────────────────────────────────────────────
  if (JS_EXTS.has(ext)) {
    const aliasMap = ctx && ctx.aliasMap;
    // Resolve any specifier: relative → dir-relative; otherwise via tsconfig/
    // jsconfig path aliases + baseUrl. Bare npm packages (react, lodash) fall
    // through to null because they are not in fileSet, so no false edges.
    const resolveSpec = (spec) => spec.startsWith('.')
      ? resolveJsPath(dir, spec, fileSet)
      : resolveAlias(spec, aliasMap, fileSet);

    const stripped = content
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    let m;
    // ES imports:  import ... from 'x'  |  import 'x'  |  export ... from 'x'
    const reEs = /(?:^|[\r\n])\s*(?:import|export)\s+(?:[^'";\r\n]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    while ((m = reEs.exec(stripped)) !== null) {
      const r = resolveSpec(m[1]);
      if (r) found.push(r);
    }
    // CommonJS require('x') and dynamic import('x').
    const reCall = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = reCall.exec(stripped)) !== null) {
      const r = resolveSpec(m[1]);
      if (r) found.push(r);
    }
  }

  // ── Python ────────────────────────────────────────────────────────────────
  if (PY_EXTS.has(ext)) {
    // from .module import ...  /  from ..pkg import ...
    const re = /^[ \t]*from\s+(\.+[\w.]*)\s+import/gm;
    let m;
    while ((m = re.exec(content)) !== null) {
      const dotCount = (m[1].match(/^\.+/) || [''])[0].length;
      const modPart  = m[1].slice(dotCount).replace(/\./g, '/');
      let base = dir;
      for (let i = 1; i < dotCount; i++) base = path.dirname(base);
      const candidate = modPart
        ? path.join(base, modPart + '.py')
        : null;
      if (candidate) {
        const normC = normalizePath(candidate);
        if (fileSet.has(normC)) found.push(normC);
      }
    }

    // Absolute imports: from package.module import ... (infer from project
    // structure). The module is resolved against EVERY ancestor of the
    // importing file up to the project root, nearest first — any of them can
    // be the source root on sys.path (src/ layouts, pytest rootdir). The old
    // dir + one-parent probe silently dropped edges for files nested two or
    // more directories below the source root (#532), and a false "zero
    // importers" from get_impact is exactly the signal that says a change is
    // safe to make.
    const reAbs = /^[ \t]*from\s+([\w.]+)\s+import/gm;
    while ((m = reAbs.exec(content)) !== null) {
      const modulePath = m[1].replace(/\./g, '/');
      const normCwd = normalizePath(path.resolve(cwd));
      let base = dir;
      let hit = null;
      for (let depth = 0; depth < 16 && !hit; depth++) {
        for (const c of [path.join(base, modulePath + '.py'), path.join(base, modulePath, '__init__.py')]) {
          const normC = normalizePath(c);
          if (fileSet.has(normC)) { hit = normC; break; }
        }
        if (normalizePath(base) === normCwd) break;
        const parent = path.dirname(base);
        if (parent === base) break;
        base = parent;
      }
      if (hit) found.push(hit);
    }
  }

  // ── Go ────────────────────────────────────────────────────────────────────
  // Go uses module paths, not relative file paths — we match same-module paths
  // by checking if any known file's relative path matches the imported suffix.
  if (GO_EXTS.has(ext)) {
    const re = /import\s*\(\s*([\s\S]*?)\s*\)/g;
    const reInline = /import\s+"([^"]+)"/g;
    const imports = [];
    let m;
    while ((m = re.exec(content)) !== null) {
      for (const imp of m[1].matchAll(/"([^"]+)"/g)) imports.push(imp[1]);
    }
    while ((m = reInline.exec(content)) !== null) imports.push(m[1]);

    if (imports.length > 0) {
      const t = tablesFor(fileSet);
      for (const imp of imports) {
        const hit = firstGoMatch(t, imp.split('/').pop());
        if (hit) found.push(hit);
      }
    }
  }

  // ── Rust ──────────────────────────────────────────────────────────────────
  // Match `mod foo;` and `use crate::foo::bar` — resolve to sibling .rs files
  if (RS_EXTS.has(ext)) {
    const reMod = /^\s*(?:pub\s+)?mod\s+(\w+)\s*;/gm;
    let m;
    while ((m = reMod.exec(content)) !== null) {
      const candidate = path.join(dir, m[1] + '.rs');
      const normC = normalizePath(candidate);
      if (fileSet.has(normC)) found.push(normC);
      // Also try mod/mod.rs
      const candidate2 = path.join(dir, m[1], 'mod.rs');
      const normC2 = normalizePath(candidate2);
      if (fileSet.has(normC2)) found.push(normC2);
    }
  }

  // ── Java / Kotlin / Scala ─────────────────────────────────────────────────
  // Match same-project import statements by matching package-relative paths
  if (JVM_EXTS.has(ext)) {
    const re = /^\s*import\s+([\w.]+)\s*;?/gm;
    let m;
    while ((m = re.exec(content)) !== null) {
      // Convert com.example.utils.StringHelper → com/example/utils/StringHelper.java
      const asPath = m[1].replace(/\./g, path.sep);
      const t = tablesFor(fileSet);
      for (const jvmExt of ['.java', '.kt', '.kts', '.scala', '.sc']) {
        const hit = firstEndingWith(t, normalizePath(asPath + jvmExt));
        if (hit) found.push(hit);
      }
    }
  }

  // ── Ruby ──────────────────────────────────────────────────────────────────
  if (RB_EXTS.has(ext)) {
    const re = /^\s*require_relative\s+['"]([^'"]+)['"]/gm;
    let m;
    while ((m = re.exec(content)) !== null) {
      const base = path.resolve(dir, m[1]);
      const candidate  = base.endsWith('.rb') ? base : base + '.rb';
      const normC = normalizePath(candidate);
      if (fileSet.has(normC)) found.push(normC);
    }
  }

  // ── Elixir ────────────────────────────────────────────────────────────────
  // Module references (`alias A.B`, `import A.B`, `use A.B`, `require A.B`)
  // resolve to repo files by the lib/ snake_case convention: A.B.C →
  // .../b/c.ex, longest suffix first. External modules miss fileSet, so no
  // false edges (#538).
  if (EX_EXTS.has(ext)) {
    const stripped = content.replace(/#[^\n]*/g, '');
    const snake = (seg) => seg.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    const re = /^\s*(?:alias|import|use|require)\s+([A-Z][\w.]*)/gm;
    let m;
    while ((m = re.exec(stripped)) !== null) {
      const segs = m[1].split('.').map(snake);
      const suffixes = [];
      if (segs.length >= 2) suffixes.push(segs.slice(-2).join('/') + '.ex');
      suffixes.push(segs[segs.length - 1] + '.ex');
      let hit = null;
      const t = tablesFor(fileSet);
      for (const suf of suffixes) {
        const bucket = byBase(t).get(suf.slice(suf.lastIndexOf('/') + 1)) || [];
        for (const i of bucket) {
          if (t.files[i] === filePath) continue;
          if (t.keys[i].endsWith('/' + suf)) { hit = t.files[i]; break; }
        }
        if (hit) break;
      }
      if (hit) found.push(hit);
    }
  }

  // ── R ─────────────────────────────────────────────────────────────────────
  // R doesn't have JS-style relative imports inside packages — files in R/ are
  // auto-sourced in alphabetical order. We emit edges for:
  //   1. Explicit `source("path/file.R")` calls (common in Shiny / scripts).
  //   2. `localPkg::fn` references where `localPkg` matches the project's
  //      own DESCRIPTION#Package — resolved via the symbol→file map in ctx.
  // `library(pkg)` / external `pkg::fn` calls are not graph edges.
  if (R_EXTS.has(ext)) {
    const stripped = content.replace(/#.*$/gm, '');
    const reSrc = /(?:^|[^\w.])source\s*\(\s*["']([^"']+)["']/g;
    let m;
    while ((m = reSrc.exec(stripped)) !== null) {
      const r = resolveRPath(dir, m[1], fileSet, cwd);
      if (r) found.push(r);
    }
    if (ctx && ctx.rPackage && ctx.rLocalDefs && ctx.rLocalDefs.size > 0) {
      const pkg = ctx.rPackage;
      // Match `pkg::fn` or `pkg:::fn`. The `::` form needs to be the local
      // package — references to other packages are external.
      const reNs = new RegExp(`\\b${escapeRegex(pkg)}:::?([A-Za-z][\\w.]*)`, 'g');
      while ((m = reNs.exec(stripped)) !== null) {
        const target = ctx.rLocalDefs.get(m[1]);
        if (!target) continue;
        const normTarget = normalizePath(target);
        const normFilePath = normalizePath(filePath);
        if (normTarget === normFilePath) continue;
        // Check both original and normalized paths (tests may pass non-normalized fileSet)
        if (fileSet.has(target)) {
          found.push(target);
        } else if (fileSet.has(normTarget)) {
          found.push(normTarget);
        }
      }
    }
  }

  return [...new Set(found)];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a forward and reverse dependency graph for all given files.
 *
 * @param {string[]} files - absolute file paths to analyze
 * @param {string}   cwd   - project root (used only for error reporting)
 * @param {{ rPackage?: string, rLocalDefs?: Map<string,string> }} [ctx]
 *        Optional cross-file context for namespace-aware resolution. Built
 *        automatically by `buildFromCwd` when DESCRIPTION + NAMESPACE exist.
 * @returns {{ forward: Map<string,string[]>, reverse: Map<string,string[]>,
 *             realPaths: Map<string,string> }}
 */
function build(files, cwd, ctx) {
  const fileSet = new Set(files.map((f) => path.resolve(f)));
  // Create a normalized version for cross-platform case-insensitive lookups
  const fileSetNormalized = new Set([...fileSet].map(normalizePath));
  // Resolve the JS/TS path-alias map once (tsconfig/jsconfig paths + baseUrl),
  // unless a caller supplied one explicitly via ctx.
  const aliasMap = (ctx && 'aliasMap' in ctx) ? ctx.aliasMap : loadAliasMap(cwd);
  const effectiveCtx = Object.assign({}, ctx, { aliasMap });
  const forward = new Map();
  const reverse = new Map();

  // Node keys are lowercased for case-insensitive matching, which loses the
  // real spelling every display surface needs. Keep the original-case path
  // alongside so renderers can recover it (see src/graph/path-key displayPath).
  const realPaths = new Map();

  // Initialise every known file in both maps (ensures isolated files appear)
  // Store using normalized paths for Windows compatibility
  for (const f of fileSet) {
    const normF = normalizePath(f);
    if (!realPaths.has(normF)) realPaths.set(normF, f);
    if (!forward.has(normF)) forward.set(normF, []);
    if (!reverse.has(normF)) reverse.set(normF, []);
  }

  for (const filePath of fileSet) {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
      continue;
    }

    const normFilePath = normalizePath(filePath);
    const deps = extractFileDeps(filePath, content, fileSetNormalized, cwd, effectiveCtx);
    if (deps.length > 0) {
      forward.set(normFilePath, deps);
      for (const dep of deps) {
        if (!reverse.has(dep)) reverse.set(dep, []);
        reverse.get(dep).push(normFilePath);
      }
    }
  }

  return { forward, reverse, realPaths };
}

// Directory names assumed when neither the caller nor the project config says
// otherwise. A Maven/Gradle module (`mall-portal/`, `service-api/`) matches none
// of them, which is why the config is consulted first.
const DEFAULT_SRC_DIRS = ['src', 'app', 'lib', 'R', 'inst'];

// Walk depth measured from EACH srcDir root, not from cwd — so this is not the
// same quantity as the extractor's cwd-relative `maxDepth` and must not be read
// from it. A standard Maven tree reaches `src/main/java/<group>/<artifact>/…`
// nine directories below its module root, so the previous ceiling of 8 silently
// dropped the deepest packages (on macrozheng/mall: every `service/impl/` class).
const DEFAULT_WALK_DEPTH = 12;

/**
 * Source directories declared in the project's own config, or null when there
 * is no readable config. See src-dirs.js for why this does not go through
 * `loadConfig`.
 */
function _configuredSrcDirs(cwd) {
  return configuredSrcDirs(cwd);
}

/**
 * Build a dependency graph scoped to a single cwd by walking all JS/TS/Py/Go
 * files under srcDirs. Useful for the MCP tool handler.
 *
 * srcDirs resolution order: explicit `opts.srcDirs` → `gen-context.config.json`
 * → the source roots detection chose, plus DEFAULT_SRC_DIRS (src-dirs.js). The
 * config step keeps the graph from being empty on a Maven/Gradle layout; the
 * detection step does the same for every repo that has no config at all, which
 * is most of them (django/, packages/*, internal/, a flat Go module).
 *
 * @param {string} cwd
 * @param {object} [opts]
 * @param {string[]} [opts.srcDirs]
 * @param {string[]} [opts.exclude]
 * @param {number}   [opts.maxDepth] - walk depth from each srcDir root
 * @returns {{ forward: Map<string,string[]>, reverse: Map<string,string[]>,
 *             realPaths: Map<string,string> }}
 */
function buildFromCwd(cwd, opts) {
  // R-package layouts use `R/` and `inst/`; Shiny apps put helpers in `R/`.
  // The existence check below makes these no-ops in non-R projects.
  const o = opts || {};
  const maxDepth = o.maxDepth === undefined ? DEFAULT_WALK_DEPTH : o.maxDepth;
  let { srcDirs, exclude } = o;
  if (srcDirs === undefined) {
    const dirs = resolveGraphDirs(cwd, DEFAULT_SRC_DIRS);
    srcDirs = dirs.srcDirs;
    if (exclude === undefined && dirs.exclude) exclude = dirs.exclude;
  }
  if (exclude === undefined) exclude = ['node_modules', '.git', 'dist', 'build'];
  const excludeSet = new Set(exclude);

  // Collects into one shared array. Returning a list per directory and
  // spreading it into the parent (`push(...walkDir())`) passes every path as a
  // call argument, which overflows the stack past ~125k files (#855).
  function walkDir(dir, depth, out) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (excludeSet.has(e.name) || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walkDir(full, depth + 1, out);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (JS_EXTS.has(ext) || PY_EXTS.has(ext) || GO_EXTS.has(ext) ||
            RS_EXTS.has(ext) || JVM_EXTS.has(ext) || RB_EXTS.has(ext) ||
            R_EXTS.has(ext) || EX_EXTS.has(ext)) {
          out.push(full);
        }
      }
    }
  }

  const files = [];
  for (const sd of srcDirs) {
    const absDir = path.resolve(cwd, sd);
    if (fs.existsSync(absDir)) walkDir(absDir, 0, files);
  }
  // Also include root-level entry files (R: app.R/server.R/ui.R/global.R for Shiny)
  for (const rootFile of ['gen-context.js', 'index.js', 'main.js', 'app.js',
                          'app.R', 'server.R', 'ui.R', 'global.R']) {
    const abs = path.resolve(cwd, rootFile);
    if (fs.existsSync(abs)) files.push(abs);
  }

  // Build R namespace context if this looks like an R package.
  let ctx;
  try {
    const { readDescription, collectLocalDefs } = require('../discovery/r-manifest');
    const desc = readDescription(cwd);
    if (desc && desc.package) {
      const rFiles = files.filter((f) => R_EXTS.has(path.extname(f).toLowerCase()));
      if (rFiles.length > 0) {
        ctx = { rPackage: desc.package, rLocalDefs: collectLocalDefs(rFiles) };
      }
    }
  } catch (_) { /* manifest module missing or read failed — proceed without ctx */ }

  return build(files, cwd, ctx);
}

/**
 * The graph the RANKER is handed. Deliberately the walk `buildFromCwd` did
 * before #934: the project's pinned srcDirs, else the conventional names.
 *
 * Why not the detected roots. The neighbour boost adds 0.40 per importing seed
 * with no bound, and was calibrated on graphs of a few hundred files. Over the
 * whole Django graph (2,971 files) one module that 180 matching files import
 * collects +72 on a base score of 12 and the answer falls out of the top 5.
 * Measured on xrepo that is net zero hits (+3 / -3) with django 3 -> 1, and the
 * damping that fixes it moves the published self-corpus numbers — a measured
 * change of its own (#935). Until then ranking, the benchmarks that score it
 * and the product that ships it all see the same graph they always did, and
 * only the surfaces that report a blast radius see the real one.
 *
 * @param {string} cwd
 * @param {object} [opts] as buildFromCwd; an explicit `srcDirs` still wins
 */
function buildRankingGraph(cwd, opts) {
  const o = opts || {};
  if (o.srcDirs !== undefined) return buildFromCwd(cwd, o);
  return buildFromCwd(cwd, Object.assign({}, o, { srcDirs: configuredSrcDirs(cwd) || DEFAULT_SRC_DIRS }));
}

module.exports = { build, buildFromCwd, buildRankingGraph, extractFileDeps, normalizePath, loadAliasMap, resolveAlias, _configuredSrcDirs, DEFAULT_SRC_DIRS, DEFAULT_WALK_DEPTH };
