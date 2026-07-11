'use strict';

/**
 * PR Evidence Report (v9.0 G3).
 *
 * A single, branded, deterministic Markdown artifact for code review: for each
 * changed file it folds together the signature context, blast radius (direct /
 * transitive importers, impacted tests + routes), cross-language related tests,
 * a risk label, and the `review-pr` findings (scope drift, god-node edits,
 * missing tests, security-sensitive files). Posted as a PR comment, it answers
 * "what changed, what it touches, and what to test" — without an LLM.
 *
 * Built entirely from shipped zero-dep modules (reviewPr, graph/impact,
 * evidence/pack, extractors/dispatch). Carries NO wall-clock timestamp, so the
 * report is byte-stable given a fixed tree — diff-friendly as a comment.
 */

const fs = require('fs');
const path = require('path');
const { reviewPr } = require('./review-pr');

/**
 * Build the structured PR evidence for a changed-file list.
 * @param {Array<{path:string,status?:string}>|string[]} changedFiles
 * @param {string} cwd
 * @param {object} [opts]
 * @param {number} [opts.depth=2]   blast-radius BFS depth
 * @param {string} [opts.scope]     label for the diff scope (e.g. "vs main")
 * @returns {{ scope:string, files:object[], review:object }}
 */
function buildPrEvidence(changedFiles, cwd, opts = {}) {
  const files = (changedFiles || []).map((f) =>
    typeof f === 'string' ? { path: f, status: 'M' } : { path: f.path, status: f.status || 'M' });

  const review = reviewPr(files, cwd, opts);

  let riskLabelFor = () => 'source';
  let findRelatedTests = () => [];
  try { ({ riskLabelFor, findRelatedTests } = require('../evidence/pack')); } catch (_) { /* defaults */ }
  const { extractFile, langFor } = require('../extractors/dispatch');

  let allFiles = [];
  try { const { buildSigIndex } = require('../retrieval/ranker'); allFiles = [...buildSigIndex(cwd).keys()]; } catch (_) { /* no index */ }

  const depth = Number.isFinite(opts.depth) ? opts.depth : 2;
  const srcPaths = files.filter((f) => f.status !== 'D' && langFor(f.path)).map((f) => f.path);
  let impactByFile = new Map();
  try {
    const { analyzeImpact } = require('../graph/impact');
    impactByFile = new Map(analyzeImpact(srcPaths, cwd, { depth }).map((r) => [r.file, r.impact]));
  } catch (_) { /* graph optional */ }

  // GR2: method-level blast radius per changed file (reviewPr already computed
  // it when the call graph resolved — reuse, don't rebuild the graph).
  const methodBlastByFile = new Map(
    (review.methodBlast && review.methodBlast.files || []).map((m) => [m.file, m])
  );

  const fileReports = files.map((f) => {
    const deleted = f.status === 'D';
    let signatures = [];
    if (!deleted && langFor(f.path)) {
      try { signatures = extractFile(f.path, fs.readFileSync(path.resolve(cwd, f.path), 'utf8')); } catch (_) { /* unreadable */ }
    }
    const impact = impactByFile.get(f.path) || null;
    return {
      methodBlast: methodBlastByFile.get(f.path.replace(/\\/g, '/')) || null,
      path: f.path,
      status: f.status,
      riskLabel: riskLabelFor(f.path),
      signatures,
      blast: impact ? {
        total: impact.totalImpact,
        direct: impact.direct || [],
        transitive: (impact.transitive || []).length,
        tests: impact.tests || [],
        routes: impact.routes || [],
      } : null,
      relatedTests: deleted ? [] : findRelatedTests(f.path, allFiles),
    };
  });

  return { scope: opts.scope || 'diff', files: fileReports, review };
}

const STATUS_LABEL = { M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'copied' };

/** Render the branded, deterministic "PR Evidence Report" Markdown. */
function formatPrEvidenceMarkdown(evidence, opts = {}) {
  const L = [];
  const s = evidence.review.summary;
  const maxSigs = Number.isFinite(opts.maxSignatures) ? opts.maxSignatures : 30;

  L.push('## 🔍 PR Evidence Report');
  L.push('');
  L.push(
    `**${s.filesChanged} file(s) changed** — ${s.sourceChanged} source, ${s.testsChanged} test · ` +
    (s.ok ? '✅ no review findings' : `⚠️ ${s.findings} finding(s)`) +
    ` · scope: ${evidence.scope}`
  );
  L.push('');

  if (!s.ok) {
    L.push('### Review findings');
    for (const f of evidence.review.findings) {
      if (f.type === 'missing-tests') L.push(`- ⚠️ **missing tests** — \`${f.file}\` changed with no matching test`);
      else if (f.type === 'security-file') L.push(`- ⚠️ **sensitive path touched** (path heuristic, not a content scan) — \`${f.file}\``);
      else if (f.type === 'secret-detected') L.push(`- 🔑 **secret detected** (${f.secret}) — \`${f.file}\``);
      else if (f.type === 'god-node') L.push(`- ⚠️ **god node** — \`${f.file}\` → ${f.count} dependents (high blast radius)`);
      else if (f.type === 'method-blast') L.push(`- ⚠️ **method blast radius ${f.tier}** — \`${f.file}\` → ${f.functions} function(s) transitively call into this change (score ${f.score}/100)`);
      else if (f.type === 'scope-drift') L.push(`- ⚠️ **scope drift** — ${f.count} top-level dirs touched (${f.dirs.join(', ')})`);
    }
    L.push('');
  }

  L.push('### Changed files');
  for (const f of evidence.files) {
    const st = STATUS_LABEL[f.status] || f.status;
    L.push(`#### \`${f.path}\`  _(${st} · risk: ${f.riskLabel})_`);
    if (f.status === 'D') { L.push('_deleted_', ''); continue; }

    if (f.blast) {
      L.push(
        `**Blast radius:** ${f.blast.total} file(s) impacted — ${f.blast.direct.length} direct, ${f.blast.transitive} transitive` +
        (f.blast.tests.length ? `, ${f.blast.tests.length} test(s)` : '') +
        (f.blast.routes.length ? `, ${f.blast.routes.length} route(s)` : '')
      );
      if (f.blast.tests.length) L.push(`Tests to run: ${f.blast.tests.slice(0, 8).map((t) => '`' + t + '`').join(', ')}`);
    } else {
      L.push('**Blast radius:** _(not in dependency graph — new or leaf file)_');
    }
    if (f.methodBlast && (f.methodBlast.directCallers + f.methodBlast.transitiveCallers) > 0) {
      const mb = f.methodBlast;
      const total = mb.directCallers + mb.transitiveCallers;
      L.push(
        `**Method blast radius:** ${total} function(s) impacted (score ${mb.score}/100, ${mb.tier}) — ` +
        mb.impactedFunctions.slice(0, 6).map((id) => '`' + id + '`').join(', ') +
        (total > 6 ? ` +${total - 6} more` : '')
      );
    }
    if (f.relatedTests.length) L.push(`Related tests: ${f.relatedTests.slice(0, 8).map((t) => '`' + t + '`').join(', ')}`);

    if (f.signatures.length) {
      L.push('```');
      for (const sig of f.signatures.slice(0, maxSigs)) L.push(sig);
      if (f.signatures.length > maxSigs) L.push(`… +${f.signatures.length - maxSigs} more`);
      L.push('```');
    }
    L.push('');
  }

  L.push('---');
  L.push('_Deterministic PR Evidence Report — generated by [SigMap](https://sigmap.io). No LLM; byte-stable given a fixed tree._');
  return L.join('\n');
}

module.exports = { buildPrEvidence, formatPrEvidenceMarkdown };
