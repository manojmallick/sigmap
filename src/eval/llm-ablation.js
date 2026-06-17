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

/**
 * Build the SigMap grounding block for a repo — what we prepend to a task
 * prompt in arm B. Conventions (the house style) + the known-symbol list
 * (so the model can reference real names instead of guessing).
 * @param {string} cwd
 * @param {object} [opts]
 * @param {number} [opts.maxSymbols=80]
 * @returns {string}
 */
function buildGrounding(cwd, opts = {}) {
  const maxSymbols = opts.maxSymbols != null ? opts.maxSymbols : 80;
  const parts = [];

  try {
    const { extractConventions } = require('../conventions/extract');
    const { renderConventionsBlock } = require('../conventions/inject');
    const { loadConfig } = require('../config/loader');
    let files = [];
    try {
      const cfg = loadConfig(cwd);
      const { buildSigIndex } = require('../retrieval/ranker');
      files = [...buildSigIndex(cwd).keys()];
      void cfg;
    } catch (_) {}
    const conv = extractConventions(cwd, files);
    parts.push(renderConventionsBlock(conv));
  } catch (_) {}

  try {
    const { buildSymbolSet } = require('../verify/hallucination-guard');
    const { set } = buildSymbolSet(cwd);
    const names = [...set].slice(0, maxSymbols);
    if (names.length) parts.push(`## Known symbols (reference these exactly)\n${names.join(', ')}`);
  } catch (_) {}

  return parts.join('\n\n');
}

/**
 * Count flagged codebase-fact errors in an answer (the §9 metric).
 * @param {string} answerText
 * @param {string} cwd
 * @returns {number}
 */
function scoreAnswer(answerText, cwd) {
  try {
    const { summary } = verify(String(answerText || ''), cwd);
    return summary.total || 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Run the A/B ablation over a task corpus.
 * @param {Array<{id:string, prompt:string}>} tasks
 * @param {string} cwd
 * @param {(prompt:string, meta:object)=>string} complete injected model call
 * @param {object} [opts]
 * @param {string} [opts.grounding] precomputed grounding (else built from cwd)
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

    const aFlagged = scoreAnswer(outA, cwd);
    const bFlagged = scoreAnswer(outB, cwd);
    sumA += aFlagged;
    sumB += bFlagged;
    rows.push({ id: task.id, aFlagged, bFlagged });
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

module.exports = { buildGrounding, scoreAnswer, runAblation };
