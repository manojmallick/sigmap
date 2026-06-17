'use strict';

/**
 * Convention extraction (IMPL.md Layer 3 — grounded code generation).
 *
 * Detects a repo's dominant coding conventions so generated code matches the
 * house style instead of drifting (Cause 4: naming/convention drift). This
 * first slice covers TS/JS/Python and three conventions: file naming, export
 * style, and test framework. `scoreConvention` is the reusable consistency
 * primitive that Gap 1 (scaffold confidence) will also build on.
 *
 * Zero dependencies, bundle-safe (fs + path only).
 */

const fs = require('fs');
const path = require('path');

const JS_TS_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const PY_EXTS = new Set(['.py']);
const SCOPED_EXTS = new Set([...JS_TS_EXTS, ...PY_EXTS]);

// Consistency tiers (IMPL.md §5.1): a convention is only safe to enforce when
// it is actually consistent.
const TIER_CONSISTENT = 0.9;
const TIER_MOSTLY = 0.7;

/**
 * Classify a file's base name (without extension) into a naming style.
 * @param {string} basename a file basename, e.g. "user-service.ts"
 * @returns {'PascalCase'|'camelCase'|'kebab-case'|'snake_case'|'other'}
 */
function classifyNaming(basename) {
  let stem = String(basename || '');
  const dot = stem.indexOf('.');
  if (dot > 0) stem = stem.slice(0, dot); // strip ext + compound suffix (.test, .d)
  if (!stem) return 'other';
  if (/[-]/.test(stem) && /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(stem)) return 'kebab-case';
  if (/[_]/.test(stem) && /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(stem)) return 'snake_case';
  if (/^[A-Z][A-Za-z0-9]*$/.test(stem) && /[a-z]/.test(stem)) return 'PascalCase';
  if (/^[a-z][A-Za-z0-9]*$/.test(stem) && /[A-Z]/.test(stem)) return 'camelCase';
  if (/^[a-z][a-z0-9]*$/.test(stem)) return 'camelCase'; // single lowercase word
  return 'other';
}

/**
 * Score a set of categorical observations into a dominant convention plus its
 * consistency tier. The reusable primitive (IMPL.md §5.2).
 * @param {string[]} labels observed category for each sample (e.g. naming styles)
 * @returns {{ dominant: string|null, dominantPct: number, total: number,
 *             variants: Array<{label:string, count:number, pct:number}>,
 *             tier: 'consistent'|'mostly'|'inconsistent'|'unknown' }}
 */
function scoreConvention(labels) {
  const list = (labels || []).filter((l) => l != null && l !== 'other');
  const total = list.length;
  if (total === 0) {
    return { dominant: null, dominantPct: 0, total: 0, variants: [], tier: 'unknown' };
  }
  const counts = new Map();
  for (const l of list) counts.set(l, (counts.get(l) || 0) + 1);
  const variants = [...counts.entries()]
    .map(([label, count]) => ({ label, count, pct: count / total }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const top = variants[0];
  let tier = 'inconsistent';
  if (top.pct >= TIER_CONSISTENT) tier = 'consistent';
  else if (top.pct >= TIER_MOSTLY) tier = 'mostly';
  return {
    dominant: top.label,
    dominantPct: top.pct,
    total,
    variants,
    tier,
  };
}

/** Detect JS/TS export style for a single file's source. */
function _jsExportStyle(src) {
  const s = String(src || '');
  if (/\bexport\s+default\b/.test(s) || /\bmodule\.exports\s*=\s*(?:function|class|\{?\s*[A-Za-z_$])/.test(s)) {
    // module.exports = { a, b } reads as named; only treat bare assignment as default.
    if (/\bexport\s+default\b/.test(s)) return 'default';
    if (/\bmodule\.exports\s*=\s*\{/.test(s)) return 'named';
    return 'default';
  }
  if (/\bexport\s+(?:const|let|var|function|class|async\s+function|\{|type|interface|enum)\b/.test(s)
    || /\bmodule\.exports\s*=\s*\{/.test(s) || /\bexports\.[A-Za-z_$]/.test(s)) {
    return 'named';
  }
  return 'other';
}

/** Detect the test framework in use from manifests + source heuristics. */
function _detectTestFramework(cwd, files) {
  const deps = {};
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    Object.assign(deps, pkg.dependencies, pkg.devDependencies);
  } catch (_) {}
  for (const fw of ['vitest', 'jest', 'mocha', 'ava', 'jasmine']) {
    if (deps[fw]) return fw;
  }
  // Python: pytest in requirements / pyproject.
  for (const manifest of ['requirements.txt', 'requirements-dev.txt', 'pyproject.toml', 'setup.cfg']) {
    try {
      const raw = fs.readFileSync(path.join(cwd, manifest), 'utf8');
      if (/\bpytest\b/.test(raw)) return 'pytest';
      if (/\bunittest\b/.test(raw)) return 'unittest';
    } catch (_) {}
  }
  // Fallback: infer from test file contents.
  for (const f of files) {
    if (!/\.(test|spec)\.[jt]sx?$|(^|\/)test_|_test\.py$/.test(f)) continue;
    let src = '';
    try { src = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
    if (/\bvi\.(fn|mock|spyOn)\b|from ['"]vitest['"]/.test(src)) return 'vitest';
    if (/\bjest\.(fn|mock|spyOn)\b/.test(src)) return 'jest';
    if (/\bimport pytest\b|@pytest\./.test(src)) return 'pytest';
    if (/\bdescribe\(|\bit\(/.test(src)) return 'mocha/jest-style';
  }
  return null;
}

/**
 * Extract repo coding conventions for the scoped languages (TS/JS/Python).
 * @param {string} cwd repo root
 * @param {string[]} files absolute paths to source files (e.g. from buildFileList)
 * @returns {{ fileNaming: object, exportStyle: object, testFramework: string|null,
 *             scope: string[], scannedFiles: number }}
 */
function extractConventions(cwd, files) {
  const scoped = (files || []).filter((f) => SCOPED_EXTS.has(path.extname(f).toLowerCase()));
  const namingLabels = [];
  const exportLabels = [];
  for (const f of scoped) {
    const base = path.basename(f);
    // Skip test files for the naming convention (they have their own naming).
    if (!/\.(test|spec)\.[jt]sx?$|(^|\/)test_|_test\.py$/.test(f)) {
      namingLabels.push(classifyNaming(base));
    }
    if (JS_TS_EXTS.has(path.extname(f).toLowerCase())) {
      let src = '';
      try { src = fs.readFileSync(f, 'utf8'); } catch (_) {}
      exportLabels.push(_jsExportStyle(src));
    }
  }
  return {
    fileNaming: scoreConvention(namingLabels),
    exportStyle: scoreConvention(exportLabels),
    testFramework: _detectTestFramework(cwd, scoped),
    scope: ['typescript', 'javascript', 'python'],
    scannedFiles: scoped.length,
  };
}

module.exports = { classifyNaming, scoreConvention, extractConventions };
