'use strict';

/**
 * Test coverage by evidence: which test files exercise a given source file.
 * Shared by `--analyze` (its tested / untested column) and `plan` (the tests
 * to re-run after a change), so the two commands cannot disagree (#862).
 *
 * "Not covered" means no test file targets or loads the source file. A module
 * exercised only through the CLI is not detected, so the absence is not proof
 * that nothing tests it.
 *
 * A source file is covered when a test file
 *   name      — targets its stem (`findRelatedTests`: `foo.test.js`,
 *               `test_foo.py`, `FooTest.java`), or
 *   reference — loads it: a `require` / `import` that resolves to it, or
 *               its path built with `path.join` / `path.resolve`
 *               (`path.join(ROOT, 'src/x/y')`, `path.join(ROOT, 'src', 'x', 'y.js')`).
 *               A path a test merely mentions — a fixture map key such as
 *               `'src/auth.js': '…'` — is not a load.
 *
 * Name evidence alone misses every test named after a feature rather than a
 * file — `judge.test.js` exercising `judge-engine.js` — which is most of an
 * integration suite. Reference evidence is path-shaped, so it sees JS/TS
 * `require` / `import` and joined paths; a Python or JVM import by package
 * name is left to the naming rule.
 *
 * Each command used to keep its own heuristic, and they disagreed. `--analyze`
 * looked for the basename as a substring of the entries directly under `test/`,
 * so `fix` matched the directory `fixtures` and nothing one level down was
 * seen. `plan` asked whether a function name appeared as a token in any test.
 * Neither could say which test it meant.
 */

const fs = require('fs');
const path = require('path');
const { relatedTestsIndex } = require('../evidence/pack');
const { TEST_ROOTS } = require('./index-state');
const { CODE_EXTS } = require('./coverage-score');
const { isTestFile, isMockFile } = require('../util/file-class');

// Scaffolding under a test root: inputs and expected outputs, not tests. Matched
// as a prefix, so `fixtures-adversarial/` is recognised as well as `fixtures/`.
const NOT_TESTS_RE = /^(node_modules|_{0,2}(fixtures?|testdata|snapshots?|expected)(_{0,2}|[-_.].*))$/i;
const MAX_DEPTH = 8;
const MAX_BYTES = 512 * 1024;

// A path a test loads: the argument of require / import / from.
const LOAD_RE = /\b(?:require|import)\s*\(\s*(['"`])([^'"`\n]+)\1|\b(?:from|import)\s+(['"`])([^'"`\n]+)\3/g;
// A path it builds: `path.join(ROOT, 'src/x/y')` or `path.join(ROOT, 'src', 'x', 'y.js')`.
const JOIN_CALL_RE = /\b(?:join|resolve)\(([^()]*)\)/g;
const SEGMENT_ARG_RE = /^(['"`])([\w@./-]+)\1$/;

const _posix = (p) => String(p).replace(/\\/g, '/');

// Repo-relative, minus the code extension: the key both sides meet on.
function _key(rel) {
  const ext = path.posix.extname(rel);
  return ext && CODE_EXTS.has(ext.toLowerCase()) ? rel.slice(0, -ext.length) : rel;
}

// What one test file loads or builds, exactly as its source spells it.
function _pathsIn(src) {
  const out = [];
  let m;
  LOAD_RE.lastIndex = 0;
  while ((m = LOAD_RE.exec(src)) !== null) {
    const lit = m[2] || m[4];
    if (lit.includes('/')) out.push(lit);
  }
  JOIN_CALL_RE.lastIndex = 0;
  while ((m = JOIN_CALL_RE.exec(src)) !== null) {
    let run = [];
    const flush = () => {
      if (run.length > 1 || (run.length === 1 && run[0].includes('/'))) out.push(run.join('/'));
      run = [];
    };
    for (const arg of m[1].split(',')) {
      const lit = arg.trim().match(SEGMENT_ARG_RE);
      if (lit) run.push(lit[2]); else flush();
    }
    flush();
  }
  return out;
}

function _isTest(rel) {
  return CODE_EXTS.has(path.posix.extname(rel).toLowerCase()) && !isMockFile(rel);
}

function _walk(dir, rel, depth, exclude, out) {
  if (depth > MAX_DEPTH) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') || NOT_TESTS_RE.test(e.name) || exclude.has(e.name)) continue;
    const childRel = `${rel}/${e.name}`;
    if (e.isDirectory()) _walk(path.join(dir, e.name), childRel, depth + 1, exclude, out);
    else if (e.isFile() && _isTest(childRel)) out.push(childRel);
  }
}

/**
 * Index the repo's test files once, then look up the tests of each source file.
 *
 * @param {string} cwd
 * @param {object} [opts]
 * @param {string[]} [opts.files]   - files already known (repo-relative or
 *        absolute); the test files among them are added, so tests that sit
 *        beside their source are seen without a second walk
 * @param {string[]} [opts.exclude] - directory names to skip
 * @returns {{ testFiles: string[], testsFor: (relPath: string) => string[] }}
 */
function buildTestCoverageIndex(cwd, opts = {}) {
  const exclude = new Set(opts.exclude || []);
  const found = [];
  for (const root of TEST_ROOTS) _walk(path.join(cwd, root), root, 0, exclude, found);
  for (const f of opts.files || []) {
    const rel = _posix(path.isAbsolute(f) ? path.relative(cwd, f) : f);
    if (isTestFile(rel) && _isTest(rel) && !rel.split('/').some((seg) => NOT_TESTS_RE.test(seg))) found.push(rel);
  }
  const testFiles = [...new Set(found)].sort();

  const byName = relatedTestsIndex(testFiles);

  const byReference = new Map();
  const referencedBy = new Map();
  for (const test of testFiles) {
    let src;
    try {
      const abs = path.join(cwd, test);
      if (fs.statSync(abs).size > MAX_BYTES) continue;
      src = fs.readFileSync(abs, 'utf8');
    } catch (_) { continue; }
    const dir = path.posix.dirname(test);
    for (const lit of _pathsIn(src)) {
      const rel = path.posix.normalize(lit.startsWith('.') ? path.posix.join(dir, lit) : lit);
      if (rel.startsWith('..')) continue;                                // outside the repo
      const key = _key(rel);
      if (!byReference.has(key)) byReference.set(key, new Set());
      byReference.get(key).add(test);
      if (!referencedBy.has(test)) referencedBy.set(test, new Set());
      referencedBy.get(test).add(key);
    }
  }

  // Two source files can share a stem (`security/patterns.js`,
  // `extractors/patterns.js`), and the naming rule gives `patterns.test.js` to
  // both. When that test loads one of them and not the other, it is the test of
  // the one it loads.
  function loadsNamesake(test, key) {
    const base = path.posix.basename(key).toLowerCase();
    for (const k of referencedBy.get(test) || []) {
      if (k !== key && path.posix.basename(k).toLowerCase() === base) return true;
    }
    return false;
  }

  function testsFor(relPath) {
    const rel = _posix(relPath);
    if (isTestFile(rel)) return [];
    const key = _key(rel);
    const out = new Set(byName(rel).filter((t) => !loadsNamesake(t, key)));
    const keys = path.posix.basename(key) === 'index' ? [key, path.posix.dirname(key)] : [key];
    for (const k of keys) for (const t of byReference.get(k) || []) out.add(t);
    return [...out].sort();
  }

  return { testFiles, testsFor };
}

module.exports = { buildTestCoverageIndex };
