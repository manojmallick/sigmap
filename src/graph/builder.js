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

// Normalize paths for cross-platform consistency (Windows uses backslashes, Unix uses forward slashes)
// Use lowercase to enable case-insensitive lookups on case-sensitive Windows filesystems
function normalizePath(p) {
  return path.normalize(p).toLowerCase();
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

/**
 * Resolve a JS/TS relative import string to an absolute path in fileSet.
 * @param {string} dir - directory of the importing file
 * @param {string} importStr - raw import string (e.g. './utils', '../store')
 * @param {Set<string>} fileSet
 * @returns {string|null}
 */
function resolveJsPath(dir, importStr, fileSet) {
  const base = path.resolve(dir, importStr);
  const candidates = [
    base,
    base + '.ts', base + '.tsx',
    base + '.js', base + '.jsx', base + '.mjs', base + '.cjs',
    path.join(base, 'index.ts'),
    path.join(base, 'index.js'),
  ];
  for (const c of candidates) {
    const normC = normalizePath(c);
    if (fileSet.has(normC)) return normC;
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
    const stripped = content
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // ES imports:   import ... from './foo'  or  import './side-effect'
    const reEs = /(?:^|[\r\n])\s*import\s+(?:[^'";\r\n]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = reEs.exec(stripped)) !== null) {
      const r = resolveJsPath(dir, m[1], fileSet);
      if (r) found.push(r);
    }
    // CommonJS: require('./foo')
    const reCjs = /\brequire\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
    while ((m = reCjs.exec(stripped)) !== null) {
      const r = resolveJsPath(dir, m[1], fileSet);
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

    // Absolute imports: from package.module import ... (infer from project structure)
    const reAbs = /^[ \t]*from\s+([\w.]+)\s+import/gm;
    while ((m = reAbs.exec(content)) !== null) {
      const modulePath = m[1].replace(/\./g, '/');
      const candidates = [
        path.join(dir, modulePath + '.py'),
        path.join(dir, modulePath, '__init__.py'),
        path.resolve(dir, '..', modulePath + '.py'),
        path.resolve(dir, '..', modulePath, '__init__.py'),
      ];
      for (const c of candidates) {
        const normC = normalizePath(c);
        if (fileSet.has(normC)) {
          found.push(normC);
          break;
        }
      }
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

    for (const imp of imports) {
      const suffix = imp.split('/').pop();
      for (const f of fileSet) {
        const normF = normalizePath(f);
        if (normF.endsWith(path.sep + suffix + '.go') ||
            normF.includes(path.sep + suffix + path.sep)) {
          found.push(normF);
          break;
        }
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
      for (const jvmExt of ['.java', '.kt', '.kts', '.scala', '.sc']) {
        for (const f of fileSet) {
          const normF = normalizePath(f);
          if (normF.endsWith(normalizePath(asPath + jvmExt))) { found.push(normF); break; }
        }
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
        const normTarget = target ? normalizePath(target) : null;
        const normFilePath = normalizePath(filePath);
        if (normTarget && normTarget !== normFilePath && fileSet.has(normTarget)) found.push(normTarget);
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
 * @returns {{ forward: Map<string,string[]>, reverse: Map<string,string[]> }}
 */
function build(files, cwd, ctx) {
  const fileSet = new Set(files.map((f) => path.resolve(f)));
  // Create a normalized version for cross-platform case-insensitive lookups
  const fileSetNormalized = new Set([...fileSet].map(normalizePath));
  const forward = new Map();
  const reverse = new Map();

  // Initialise every known file in both maps (ensures isolated files appear)
  // Store using normalized paths for Windows compatibility
  for (const f of fileSet) {
    const normF = normalizePath(f);
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
    const deps = extractFileDeps(filePath, content, fileSetNormalized, cwd, ctx);
    if (deps.length > 0) {
      forward.set(normFilePath, deps);
      for (const dep of deps) {
        if (!reverse.has(dep)) reverse.set(dep, []);
        reverse.get(dep).push(normFilePath);
      }
    }
  }

  return { forward, reverse };
}

/**
 * Build a dependency graph scoped to a single cwd by walking all JS/TS/Py/Go
 * files under srcDirs. Useful for the MCP tool handler.
 *
 * @param {string} cwd
 * @param {object} [opts]
 * @param {string[]} [opts.srcDirs]
 * @param {string[]} [opts.exclude]
 * @returns {{ forward: Map<string,string[]>, reverse: Map<string,string[]> }}
 */
function buildFromCwd(cwd, opts) {
  // R-package layouts use `R/` and `inst/`; Shiny apps put helpers in `R/`.
  // The existence check below makes these no-ops in non-R projects.
  const { srcDirs = ['src', 'app', 'lib', 'R', 'inst'], exclude = ['node_modules', '.git', 'dist', 'build'] } = opts || {};
  const excludeSet = new Set(exclude);

  function walkDir(dir, depth) {
    if (depth > 8) return [];
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return []; }
    const out = [];
    for (const e of entries) {
      if (excludeSet.has(e.name) || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        out.push(...walkDir(full, depth + 1));
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (JS_EXTS.has(ext) || PY_EXTS.has(ext) || GO_EXTS.has(ext) ||
            RS_EXTS.has(ext) || JVM_EXTS.has(ext) || RB_EXTS.has(ext) ||
            R_EXTS.has(ext)) {
          out.push(full);
        }
      }
    }
    return out;
  }

  const files = [];
  for (const sd of srcDirs) {
    const absDir = path.resolve(cwd, sd);
    if (fs.existsSync(absDir)) files.push(...walkDir(absDir, 0));
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

module.exports = { build, buildFromCwd, extractFileDeps, normalizePath };
