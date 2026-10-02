'use strict';

/**
 * Extract import dependencies from Python and TypeScript/JavaScript files.
 * Returns compact dependency arrays for the dep-map section of the context output.
 */

const PYTHON_STDLIB = new Set([
  'os', 'sys', 're', 'json', 'time', 'threading', 'logging', 'typing',
  'dataclasses', 'datetime', 'uuid', 'pathlib', 'collections', 'functools',
  'itertools', 'math', 'random', 'string', 'struct', 'io', 'copy', 'pprint',
  'traceback', 'inspect', 'abc', 'enum', 'contextlib', 'weakref', 'gc',
  'socket', 'ssl', 'http', 'urllib', 'email', 'html', 'xml', 'csv', 'sqlite3',
  'argparse', 'subprocess', 'shutil', 'tempfile', 'glob', 'fnmatch', 'stat',
  'hashlib', 'hmac', 'base64', 'binascii', 'codecs', 'unicodedata', 'locale',
  'decimal', 'fractions', 'numbers', 'cmath', 'heapq', 'bisect', 'array',
  'queue', 'asyncio', 'concurrent', 'multiprocessing', 'signal', 'mmap',
  'builtins', 'warnings', 'operator', 'textwrap', 'difflib', 'readline',
]);

/**
 * Extract project-level import dependencies from Python source.
 * @param {string} src
 * @returns {string[]}
 */
function extractPythonDeps(src) {
  const deps = new Set();
  for (const m of src.matchAll(/^from\s+([\w.]+)\s+import/gm)) {
    const mod = m[1];
    const root = mod.replace(/^\.+/, '').split('.')[0];
    // Include relative imports and non-stdlib modules
    if (mod.startsWith('.') || (root && !PYTHON_STDLIB.has(root))) {
      deps.add(root || mod);
    }
  }
  for (const m of src.matchAll(/^import\s+([\w.]+)/gm)) {
    const root = m[1].split('.')[0];
    if (root && !PYTHON_STDLIB.has(root)) deps.add(root);
  }
  return [...deps].filter(Boolean).slice(0, 5);
}

/**
 * Extract relative import dependencies from TypeScript/JavaScript source.
 * @param {string} src
 * @returns {string[]}
 */
function extractTSDeps(src) {
  // Strip single-line comments to avoid matching commented-out imports
  const stripped = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const local = new Set();
  const pkgs = new Set();

  const add = (spec) => {
    if (!spec) return;
    if (spec.startsWith('.')) {
      // Normalise: '../store/authStore' -> store/authStore, './utils' -> utils
      const clean = spec.replace(/^\.\.\//, '').replace(/^\.\//, '').replace(/\.\w+$/, '');
      if (clean) local.add(clean);
      return;
    }
    if (spec.startsWith('/') || /^[a-z]+:/i.test(spec)) return; // absolute / url / node:
    // A bare specifier is an installed PACKAGE. These were dropped entirely,
    // so the dep map showed a JS project's internal wiring and never the
    // libraries it actually depends on — the reason "only npm projects list
    // their packages" read as false for this section.
    const parts = spec.split('/');
    const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    if (name) pkgs.add(name);
  };

  for (const m of stripped.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) add(m[1]);
  for (const m of stripped.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1]);
  for (const m of stripped.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) add(m[1]);
  for (const m of stripped.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1]);

  // Packages first: which libraries a file uses is the scarcer signal, and the
  // local wiring is already recoverable from the file tree.
  return [...pkgs, ...local].slice(0, 5);
}

/**
 * Extract project-level import dependencies from R source.
 * Captures `library(pkg)`, `require(pkg)`, `requireNamespace("pkg")`, and
 * `pkg::fn` references, skipping base packages.
 * @param {string} src
 * @returns {string[]}
 */
function extractRDeps(src) {
  const deps = new Set();
  // Strip line comments so commented-out library() calls don't match.
  const stripped = (src || '').replace(/#.*$/gm, '');
  for (const m of stripped.matchAll(/\b(?:library|require)\s*\(\s*["']?([\w.]+)["']?\s*\)/g)) {
    if (m[1] && !R_BASE_PKGS.has(m[1])) deps.add(m[1]);
  }
  for (const m of stripped.matchAll(/\brequireNamespace\s*\(\s*["']([\w.]+)["']/g)) {
    if (m[1] && !R_BASE_PKGS.has(m[1])) deps.add(m[1]);
  }
  for (const m of stripped.matchAll(/\b([A-Za-z][\w.]*)::[A-Za-z]/g)) {
    if (m[1] && !R_BASE_PKGS.has(m[1])) deps.add(m[1]);
  }
  return [...deps].slice(0, 5);
}

/**
 * Extract Lua require() module dependencies.
 * Captures `require "mod"` and `require("mod")`, returning compact module
 * names as they appear in source.
 * @param {string} src
 * @returns {string[]}
 */
function extractLuaDeps(src) {
  const deps = new Set();
  const stripped = stripLuaComments(src || '');
  for (const m of stripped.matchAll(/\brequire\s*(?:\(\s*)?["']([A-Za-z0-9_.\/-]+)["']\s*\)?/g)) {
    if (m[1]) deps.add(m[1]);
  }
  return [...deps].slice(0, 5);
}

/**
 * Extract Elixir module dependencies: `alias A.B`, `import A.B`, `use A.B`,
 * `require A.B` — module names for repo-local resolution (#538).
 * @param {string} src
 * @returns {string[]}
 */
function extractElixirDeps(src) {
  const deps = new Set();
  const stripped = String(src || '').replace(/#[^\n]*/g, '');
  for (const m of stripped.matchAll(/^\s*(?:alias|import|use|require)\s+([A-Z][\w.]*)/gm)) {
    deps.add(m[1]);
  }
  return [...deps].slice(0, 5);
}

function stripLuaComments(src) {
  return String(src || '')
    .replace(/--\[\[[\s\S]*?\]\]/g, '')
    .replace(/--.*$/gm, '');
}

/**
 * Build reverse dependency map from forward map.
 * @param {Map<string, string[]>} forwardMap
 * @returns {Map<string, string[]>}
 */
function buildReverseDepMap(forwardMap) {
  const reverse = new Map();
  if (!forwardMap || typeof forwardMap.entries !== 'function') return reverse;
  for (const [file, deps] of forwardMap.entries()) {
    if (!Array.isArray(deps)) continue;
    for (const dep of deps) {
      if (!reverse.has(dep)) reverse.set(dep, []);
      reverse.get(dep).push(file);
    }
  }
  return reverse;
}

/** `java.*`/`javax.*` are the platform, not a dependency worth mapping. */
const JAVA_PLATFORM = /^(?:java|javax|jdk|sun|com\.sun)\./;

/**
 * Extract third-party package dependencies from Java/Kotlin source.
 *
 * There was no Java extractor at all, so a file importing jackson or Spring
 * produced an empty dep row while the POM beside it declared both. The import
 * is reduced to its PACKAGE (the class name dropped) so it lines up with the
 * groupId shape a reader sees in `sigmap deps`.
 *
 * @param {string} src
 * @returns {string[]}
 */
function extractJavaDeps(src) {
  const deps = new Set();
  for (const m of src.matchAll(/^\s*import\s+(static\s+)?([\w.]+)(?:\.\*)?\s*;?/gm)) {
    const isStatic = Boolean(m[1]);
    const full = m[2];
    if (JAVA_PLATFORM.test(full)) continue;
    const segs = full.split('.');
    // A static import ends in a MEMBER (`assertEquals`), which may be lowercase
    // and so would not be popped by the class rule below. Drop it first.
    if (isStatic && segs.length > 2) segs.pop();
    // Then drop the trailing Class name(s).
    while (segs.length > 2 && /^[A-Z]/.test(segs[segs.length - 1])) segs.pop();
    const pkg = segs.join('.');
    if (pkg && pkg.includes('.')) deps.add(pkg);
  }
  return [...deps].slice(0, 5);
}

module.exports = { extractPythonDeps, extractTSDeps, extractJavaDeps, extractRDeps, extractLuaDeps, extractElixirDeps, buildReverseDepMap };
