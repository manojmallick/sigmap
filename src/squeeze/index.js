'use strict';

/**
 * Squeeze orchestrator (v7.0.0): classify → squeeze → reduction → decision.
 *
 * Always-on and silent: callers run `squeeze()` on pasted input, then use
 * `shouldPrompt()` to decide whether the reduction is worth interrupting for.
 * Everything is deterministic and offline; the symbol index for stack-trace
 * enrichment is passed through via `opts.symbolIndex`.
 */

const { classify } = require('./classify');
const { squeezeStackTrace } = require('./stacktrace');
const { squeezeCiLog } = require('./cilog');
const { squeezeJsonPayload } = require('./jsonpayload');

function estimateTokens(s) { return Math.ceil(String(s || '').length / 4); }

/**
 * @param {string} input
 * @param {object} [opts]  forwarded to the category squeezer (srcDirs, symbolIndex, …)
 * @returns {{ category, confidence, original, squeezed, rawTokens, squeezedTokens, reduction, kept, stripped, enriched, applies }}
 */
function squeeze(input, opts = {}) {
  const { category, confidence } = classify(input);
  const rawTokens = estimateTokens(input);
  const base = {
    category, confidence, original: input, squeezed: input,
    rawTokens, squeezedTokens: rawTokens, reduction: 0,
    kept: [], stripped: [], enriched: false, applies: false,
  };
  if (!category) return base;

  let r;
  if (category === 'stacktrace') r = squeezeStackTrace(input, opts);
  else if (category === 'cilog') r = squeezeCiLog(input, opts);
  else r = squeezeJsonPayload(input, opts);

  const squeezedTokens = estimateTokens(r.squeezed);
  const reduction = rawTokens > 0 ? (rawTokens - squeezedTokens) / rawTokens : 0;
  return {
    category, confidence,
    original: input, squeezed: r.squeezed,
    rawTokens, squeezedTokens,
    reduction: Math.max(0, Number(reduction.toFixed(4))),
    kept: r.kept || [], stripped: r.stripped || [], enriched: !!r.enriched,
    applies: squeezedTokens < rawTokens,
  };
}

/** True when the reduction clears the threshold (accepts 0–1 or 0–100). */
function shouldPrompt(reduction, threshold) {
  const t = threshold > 1 ? threshold / 100 : threshold;
  return reduction >= t;
}

/** A compact human summary of what squeeze would do (for the prompt). */
function formatSummary(result) {
  const pct = Math.round(result.reduction * 100);
  const lines = [
    `Input: ${result.rawTokens.toLocaleString()} tokens`,
    `Can reduce to ${result.squeezedTokens.toLocaleString()} tokens (${pct}% smaller):`,
  ];
  for (const k of result.kept) lines.push(`  ✓ Kept: ${k}`);
  for (const s of result.stripped) lines.push(`  ✗ Stripped: ${s}`);
  return lines.join('\n');
}

module.exports = { squeeze, shouldPrompt, formatSummary, estimateTokens };
