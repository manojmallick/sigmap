'use strict';

/**
 * Hallucination Guard — deterministic core (Phase 1 MVP).
 *
 * Given the text of an AI answer, flag claims that do not match the repo:
 *   - fake-file   : a referenced path is not on disk
 *   - fake-import : a relative import does not resolve; a bare import is
 *                   absent from package.json deps (builtins allow-listed)
 *   - fake-symbol : a called function/class is absent from the symbol index
 *
 * No network, no LLM. Reuses SigMap primitives (buildSigIndex) but every
 * external dependency is injectable via `opts` so the core stays unit-testable.
 */

const fs = require('fs');
const path = require('path');
const parsers = require('./parsers');

const NODE_BUILTINS = new Set([
  'fs', 'path', 'os', 'util', 'events', 'stream', 'http', 'https', 'crypto',
  'child_process', 'url', 'querystring', 'assert', 'zlib', 'readline', 'net',
  'tls', 'dns', 'buffer', 'process', 'vm', 'module', 'console', 'timers',
  'string_decoder', 'perf_hooks', 'worker_threads', 'cluster', 'dgram', 'v8',
  'tty', 'repl', 'async_hooks', 'inspector', 'fs/promises', 'path/posix',
]);

const PY_BUILTINS = new Set([
  'os', 'sys', 're', 'json', 'math', 'typing', 'collections', 'itertools',
  'functools', 'datetime', 'pathlib', 'subprocess', 'abc', 'dataclasses',
  'enum', 'io', 'time', 'random', 'logging', 'argparse', 'unittest', 'asyncio',
  'copy', 'hashlib', 'threading', 'string', 'csv', 'glob', 'shutil', 'tempfile',
]);

const LANG_GLOBALS = new Set([
  // JS
  'console', 'require', 'module', 'exports', 'process', 'Object', 'Array',
  'String', 'Number', 'Boolean', 'Math', 'JSON', 'Date', 'Promise', 'Map',
  'Set', 'WeakMap', 'WeakSet', 'RegExp', 'Error', 'Symbol', 'parseInt',
  'parseFloat', 'isNaN', 'setTimeout', 'setInterval', 'clearTimeout', 'fetch',
  'Buffer', 'Function', 'eval', 'encodeURIComponent', 'decodeURIComponent',
  // Python
  'print', 'len', 'range', 'str', 'int', 'float', 'dict', 'list', 'tuple',
  'set', 'bool', 'open', 'enumerate', 'zip', 'map', 'filter', 'sorted',
  'sum', 'min', 'max', 'abs', 'isinstance', 'super', 'type', 'getattr',
  'setattr', 'hasattr',
]);

const REL_EXTS = ['', '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.json', '.py', '.r', '.R', '.vue'];
const REL_INDEX = ['index.js', 'index.ts', 'index.tsx', 'index.jsx', '__init__.py'];

/** Build the set of known symbol identifiers from the SigMap signature index. */
function buildSymbolSet(cwd) {
  const set = new Set();
  let fileKeys = [];
  try {
    const { buildSigIndex } = require('../retrieval/ranker');
    const idx = buildSigIndex(cwd);
    fileKeys = [...idx.keys()];
    for (const sigs of idx.values()) {
      for (const sig of sigs) {
        const cleaned = String(sig).replace(/\s*:\d+(?:-\d+)?\s*$/, '');
        const ids = cleaned.match(/[A-Za-z_$][\w$]*/g) || [];
        for (const id of ids) set.add(id);
      }
    }
  } catch (_) {}
  return { set, fileKeys };
}

/** Load declared dependency names from package.json. */
function loadDeps(cwd) {
  const deps = new Set();
  let hasPkg = false;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    hasPkg = true;
    for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      if (pkg[k] && typeof pkg[k] === 'object') {
        for (const name of Object.keys(pkg[k])) deps.add(name);
      }
    }
  } catch (_) {}
  return { deps, hasPkg };
}

/** Default file-existence check: resolve a referenced path against cwd. */
function defaultFileExists(cwd, ref) {
  const clean = ref.replace(/^\.\//, '');
  for (const c of [path.resolve(cwd, clean), path.resolve(cwd, ref)]) {
    try {
      if (fs.existsSync(c)) return true;
    } catch (_) {}
  }
  return false;
}

/** Default relative-import resolver: fs candidates + basename match in index. */
function defaultRelativeResolvable(cwd, mod, fileBasenames) {
  const base = path.resolve(cwd, mod);
  for (const e of REL_EXTS) {
    try {
      if (fs.existsSync(base + e)) return true;
    } catch (_) {}
  }
  for (const idx of REL_INDEX) {
    try {
      if (fs.existsSync(path.join(base, idx))) return true;
    } catch (_) {}
  }
  // Fall back to basename match against the indexed file set (the answer's
  // import is relative to a file we cannot know, so a name match is enough
  // to avoid false positives).
  const wantBase = path.basename(mod).replace(/\.[^.]+$/, '').toLowerCase();
  return fileBasenames.has(wantBase);
}

/**
 * Verify an AI answer against the repository.
 *
 * @param {string} answerText
 * @param {string} cwd
 * @param {object} [opts]
 * @param {Set<string>} [opts.symbolSet]      override known symbols
 * @param {Set<string>} [opts.deps]           override package deps
 * @param {boolean}     [opts.hasPkg]         whether a package.json exists
 * @param {(ref: string) => boolean} [opts.fileExists]          override file check
 * @param {(mod: string) => boolean} [opts.relativeResolvable]  override rel-import check
 * @returns {{ issues: object[], summary: object }}
 */
function verify(answerText, cwd, opts = {}) {
  let symbolSet = opts.symbolSet;
  let fileBasenames = opts.fileBasenames;
  if (!symbolSet) {
    const built = buildSymbolSet(cwd);
    symbolSet = built.set;
    fileBasenames = new Set(built.fileKeys.map(
      (k) => path.basename(k).replace(/\.[^.]+$/, '').toLowerCase()
    ));
  }
  if (!fileBasenames) fileBasenames = new Set();

  let deps = opts.deps;
  let hasPkg = opts.hasPkg;
  if (!deps) {
    const loaded = loadDeps(cwd);
    deps = loaded.deps;
    if (hasPkg === undefined) hasPkg = loaded.hasPkg;
  }

  const fileExists = opts.fileExists || ((ref) => defaultFileExists(cwd, ref));
  const relativeResolvable = opts.relativeResolvable
    || ((mod) => defaultRelativeResolvable(cwd, mod, fileBasenames));

  const issues = [];
  const dedupe = new Set();
  const add = (issue) => {
    const key = `${issue.type}::${issue.value}`;
    if (dedupe.has(key)) return;
    dedupe.add(key);
    issues.push(issue);
  };

  // 1. fake-file
  for (const { path: p, line } of parsers.extractFilePaths(answerText)) {
    if (!fileExists(p)) {
      add({ type: 'fake-file', value: p, line, message: `File not found on disk: ${p}` });
    }
  }

  // 2. fake-import
  for (const imp of parsers.extractImports(answerText)) {
    if (imp.relative) {
      if (!relativeResolvable(imp.module)) {
        add({ type: 'fake-import', value: imp.module, line: imp.line, message: `Import does not resolve: ${imp.module}` });
      }
      continue;
    }
    // Bare module — only verifiable for JS when a package.json exists.
    const top = imp.module.split('/')[0];
    if (imp.kind === 'js') {
      if (!hasPkg) continue;
      if (NODE_BUILTINS.has(imp.module) || NODE_BUILTINS.has(top)) continue;
      if (top.startsWith('@')) {
        const scoped = imp.module.split('/').slice(0, 2).join('/');
        if (deps.has(scoped) || deps.has(imp.module)) continue;
      } else if (deps.has(top) || deps.has(imp.module)) {
        continue;
      }
      add({ type: 'fake-import', value: imp.module, line: imp.line, message: `Package not in dependencies: ${imp.module}` });
    }
    // Python bare imports: stdlib is unbounded offline — skip to keep precision.
  }

  // 3. fake-symbol
  if (symbolSet.size > 0) {
    for (const { name, line } of parsers.extractSymbols(answerText)) {
      if (symbolSet.has(name)) continue;
      if (LANG_GLOBALS.has(name) || NODE_BUILTINS.has(name) || PY_BUILTINS.has(name)) continue;
      add({ type: 'fake-symbol', value: name, line, message: `Symbol not found in repo index: ${name}()` });
    }
  }

  issues.sort((a, b) => a.line - b.line);

  const byType = { 'fake-file': 0, 'fake-import': 0, 'fake-symbol': 0 };
  for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1;

  const summary = {
    total: issues.length,
    byType,
    clean: issues.length === 0,
    symbolsIndexed: symbolSet.size,
  };

  return { issues, summary };
}

module.exports = { verify, buildSymbolSet, loadDeps };
