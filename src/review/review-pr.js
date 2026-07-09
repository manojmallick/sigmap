'use strict';

/**
 * review-pr (IMPL.md §6 step 4 — last guard stage of the `create` pipeline).
 *
 * Audits a diff for drift and side effects after a PR is opened: scope drift,
 * edits to high-fan-in "god-node" files, source changes without matching tests,
 * and changes to security-sensitive files. Pure (takes a changed-file list),
 * zero-dependency, bundle-safe; reuses the impact graph for blast radius.
 */

const fs = require('fs');
const path = require('path');
const { analyzeImpact } = require('../graph/impact');
const { PATTERNS } = require('../security/patterns');

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

  // 2a. Sensitive-path heuristic — flags files whose PATH looks security-relevant
  // (.env, auth/, lockfiles, workflows, key material). This is a path heuristic,
  // NOT a content scan: it flags touching the path regardless of what changed,
  // and cannot see a secret hidden in an innocently-named file. `basis` records
  // that honestly so consumers don't mistake it for a content check.
  for (const f of live) {
    if (SECURITY_PATTERNS.some((re) => re.test(f.path))) {
      findings.push({ type: 'security-file', file: f.path, severity: 'warn', basis: 'path-heuristic' });
    }
  }

  // 2b. Real secret scan — read each changed file's CONTENT and match known
  // secret patterns. This is the actual security check (content, not filename):
  // it catches a hardcoded key in a file the path heuristic would never flag.
  const readFile = opts.readFile || ((p) => fs.readFileSync(path.resolve(cwd, p), 'utf8'));
  for (const f of live) {
    let content;
    try { content = readFile(f.path); } catch (_) { continue; } // absent/unreadable → skip
    if (typeof content !== 'string' || content.length > 2_000_000) continue; // skip huge/binary
    for (const pat of PATTERNS) {
      if (pat.regex.test(content)) {
        findings.push({ type: 'secret-detected', file: f.path, secret: pat.name, severity: 'high', basis: 'content-scan' });
        break; // one hit is enough to flag the file
      }
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
