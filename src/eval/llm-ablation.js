'use strict';

/**
 * LLM A/B hallucination ablation (IMPL.md §9) — the honest measurement.
 *
 * Runs a model twice per task — (A) no SigMap context, (B) with SigMap
 * grounding — pipes both outputs through the hallucination guard, and reports
 * the measured delta in flagged codebase-fact errors. The model call is
 * INJECTED (`complete(prompt) → text`), so the harness itself is pure and
 * offline-testable; the live model adapter lives in `scripts/run-llm-ablation.mjs`.
 * Zero-dependency, bundle-safe (no network here).
 */

const { verify } = require('../verify/hallucination-guard');

const path = require('path');

/** Strip a signature's trailing line anchor (` :12-20`) for prompt cleanliness. */
function _cleanSig(sig) {
  return String(sig).replace(/\s*:\d+(?:-\d+)?\s*$/, '').trim();
}

/**
 * Build the SigMap grounding block for a repo — what we prepend to a task
 * prompt in arm B. Conventions (the house style) + **exact signatures** grouped
 * by file (what `get_callee_signatures` returns), so the model references the
 * real surface instead of guessing — the actual product behavior, not a flat
 * name dump.
 * @param {string} cwd
 * @param {object} [opts]
 * @param {number} [opts.maxSignatures=150] cap on signature lines (bounds prompt size)
 * @returns {string}
 */
function buildGrounding(cwd, opts = {}) {
  const maxSignatures = opts.maxSignatures != null ? opts.maxSignatures : 150;
  const parts = [];

  let index = null;
  try {
    const { buildSigIndex } = require('../retrieval/ranker');
    index = buildSigIndex(cwd);
  } catch (_) {}

  try {
    const { extractConventions } = require('../conventions/extract');
    const { renderConventionsBlock } = require('../conventions/inject');
    const files = index ? [...index.keys()] : [];
    parts.push(renderConventionsBlock(extractConventions(cwd, files)));
  } catch (_) {}

  if (index) {
    const lines = ['## Exact signatures (use these — do not invent symbols or paths)'];
    let count = 0;
    for (const [file, sigs] of index) {
      if (count >= maxSignatures) break;
      const rel = path.relative(cwd, file).replace(/\\/g, '/');
      const clean = (sigs || []).map(_cleanSig).filter(Boolean);
      if (!clean.length) continue;
      lines.push(`### ${rel}`);
      for (const s of clean) {
        if (count >= maxSignatures) break;
        lines.push(s);
        count++;
      }
    }
    if (count > 0) parts.push(lines.join('\n'));
  }

  return parts.join('\n\n');
}

/**
 * Score an answer: flagged codebase-fact errors + the issue list (the §9 metric).
 * @param {string} answerText
 * @param {string} cwd
 * @returns {{ total: number, issues: object[] }}
 */
function scoreAnswerDetail(answerText, cwd) {
  try {
    const { issues, summary } = verify(String(answerText || ''), cwd);
    return { total: summary.total || 0, issues: issues || [] };
  } catch (_) {
    return { total: 0, issues: [] };
  }
}

/** Count flagged codebase-fact errors in an answer (the §9 metric). */
function scoreAnswer(answerText, cwd) {
  return scoreAnswerDetail(answerText, cwd).total;
}

/**
 * Run the A/B ablation over a task corpus.
 * @param {Array<{id:string, prompt:string}>} tasks
 * @param {string} cwd
 * @param {(prompt:string, meta:object)=>string} complete injected model call
 * @param {object} [opts]
 * @param {string} [opts.grounding] precomputed grounding (else built from cwd)
 * @param {boolean} [opts.collectIssues] attach `aIssues`/`bIssues` per task
 * @returns {{ tasks: object[], aggregate: object }}
 */
function runAblation(tasks, cwd, complete, opts = {}) {
  const grounding = opts.grounding != null ? opts.grounding : buildGrounding(cwd);
  const rows = [];
  let sumA = 0;
  let sumB = 0;

  for (const task of tasks || []) {
    const basePrompt = task.prompt || '';
    const groundedPrompt = grounding ? `${grounding}\n\n---\n\n${basePrompt}` : basePrompt;

    const outA = String(complete(basePrompt, { id: task.id, grounded: false }) || '');
    const outB = String(complete(groundedPrompt, { id: task.id, grounded: true }) || '');

    const a = scoreAnswerDetail(outA, cwd);
    const b = scoreAnswerDetail(outB, cwd);
    sumA += a.total;
    sumB += b.total;
    const row = { id: task.id, aFlagged: a.total, bFlagged: b.total };
    if (opts.collectIssues) { row.aIssues = a.issues; row.bIssues = b.issues; }
    rows.push(row);
  }

  const n = rows.length;
  const per100 = (sum) => (n > 0 ? (sum / n) * 100 : 0);
  return {
    tasks: rows,
    aggregate: {
      n,
      withoutFlagged: sumA,
      withFlagged: sumB,
      delta: sumA - sumB,
      withoutPer100: per100(sumA),
      withPer100: per100(sumB),
    },
  };
}

module.exports = { buildGrounding, scoreAnswer, scoreAnswerDetail, runAblation };
