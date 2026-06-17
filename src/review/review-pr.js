'use strict';

/**
 * review-pr (IMPL.md §6 step 4 — last guard stage of the `create` pipeline).
 *
 * Audits a diff for drift and side effects after a PR is opened: scope drift,
 * edits to high-fan-in "god-node" files, source changes without matching tests,
 * and changes to security-sensitive files. Pure (takes a changed-file list),
 * zero-dependency, bundle-safe; reuses the impact graph for blast radius.
 */

const path = require('path');
const { analyzeImpact } = require('../graph/impact');

const SECURITY_PATTERNS = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)(secrets?|credentials?)(\/|\.|$)/i,
  /(^|\/)auth(\/|\.|-)/i,
  /(^|\/)package(-lock)?\.json$/,
  /(^|\/)(yarn\.lock|pnpm-lock\.yaml)$/,
  /(^|\/)\.github\/workflows\//,
  /(^|\/)Dockerfile/i,
  /\.(pem|key|crt|p12)$/i,
];

const SRC_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.rb', '.php']);
const GOD_NODE_THRESHOLD = 15; // transitive dependents → high-fan-in "god node"
const SCOPE_DIR_THRESHOLD = 5; // distinct top-level dirs → scope drift

function isTestFile(p) {
  return /\.(test|spec)\.[jt]sx?$|(^|\/)test_|_test\.(py|go)$|(^|\/)(tests?|__tests__|spec)\//.test(p);
}
function isSource(p) {
  return SRC_EXTS.has(path.extname(p).toLowerCase()) && !isTestFile(p);
}

/**
 * Audit a changed-file list.
 * @param {Array<{path:string,status:string}>|string[]} changedFiles
 * @param {string} cwd
 * @param {object} [opts]
 * @param {number} [opts.godNodeThreshold=15]
 * @param {number} [opts.scopeThreshold=5]
 * @returns {{ findings: object[], blast: object[], summary: object }}
 */
function reviewPr(changedFiles, cwd, opts = {}) {
  const godThreshold = opts.godNodeThreshold != null ? opts.godNodeThreshold : GOD_NODE_THRESHOLD;
  const scopeThreshold = opts.scopeThreshold != null ? opts.scopeThreshold : SCOPE_DIR_THRESHOLD;
  const files = (changedFiles || []).map((f) => (typeof f === 'string' ? { path: f, status: 'M' } : f));

  const findings = [];
  const paths = files.map((f) => f.path);
  const live = files.filter((f) => f.status !== 'D');
  const srcChanged = live.filter((f) => isSource(f.path)).map((f) => f.path);
  const testChanged = paths.filter(isTestFile);

  // 1. Missing tests: a changed source file with no matching changed test file.
  for (const s of srcChanged) {
    const stem = path.basename(s).replace(/\.[^.]+$/, '');
    const covered = testChanged.some((t) => path.basename(t).includes(stem));
    if (!covered) findings.push({ type: 'missing-tests', file: s, severity: 'warn' });
  }

  // 2. Security-sensitive files.
  for (const f of live) {
    if (SECURITY_PATTERNS.some((re) => re.test(f.path))) {
      findings.push({ type: 'security-file', file: f.path, severity: 'warn' });
    }
  }

  // 3. God-node edits (high blast radius).
  const blast = [];
  if (srcChanged.length) {
    let impacts = [];
    try { impacts = analyzeImpact(srcChanged, cwd, {}); } catch (_) { impacts = []; }
    for (const { file, impact } of impacts) {
      blast.push({ file, totalImpact: impact.totalImpact });
      if (impact.totalImpact > godThreshold) {
        findings.push({ type: 'god-node', file, count: impact.totalImpact, severity: 'warn' });
      }
    }
    blast.sort((a, b) => b.totalImpact - a.totalImpact);
  }

  // 4. Scope drift: distinct top-level directories touched.
  const dirs = [...new Set(paths.map((p) => (p.includes('/') ? p.split('/')[0] : '.')))];
  if (dirs.length > scopeThreshold) {
    findings.push({ type: 'scope-drift', dirs, count: dirs.length, threshold: scopeThreshold, severity: 'warn' });
  }

  const byType = findings.reduce((a, f) => { a[f.type] = (a[f.type] || 0) + 1; return a; }, {});
  return {
    findings,
    blast,
    summary: {
      filesChanged: files.length,
      sourceChanged: srcChanged.length,
      testsChanged: testChanged.length,
      findings: findings.length,
      byType,
      ok: findings.length === 0,
    },
  };
}

module.exports = { reviewPr, SECURITY_PATTERNS, GOD_NODE_THRESHOLD, SCOPE_DIR_THRESHOLD };
