'use strict';

/**
 * Terse signature encoder (D7).
 *
 * Deterministic compaction of signature lines for the generated context —
 * opt-in via `--terse` / `terse: true`. Every transform is a fixed string
 * rewrite (no heuristics, no LLM), so terse output stays byte-stable.
 *
 * The line anchor (`  :start-end`) and everything after it (Python/R doc
 * hints) are preserved byte-exactly: `parseAnchor`, `get_lines`, and the
 * evidence pack keep working on terse output. Symbol extraction is safe too —
 * `extractName` in src/extractors/prdiff.js already recognizes `fn <name>`.
 */

/** First `  :start[-end]` anchor token (two-space prefix, as emitted by line-anchor.js). */
const ANCHOR_RE = /\s{2}:\d+(?:-\d+)?(?=\s|$)/;

/**
 * Split a signature into the compactable text and the byte-preserved suffix
 * (anchor + any trailing doc hint).
 * @param {string} sig
 * @returns {{ text: string, suffix: string }}
 */
function splitAnchor(sig) {
  const s = String(sig);
  const m = ANCHOR_RE.exec(s);
  if (!m) return { text: s, suffix: '' };
  return { text: s.slice(0, m.index), suffix: s.slice(m.index) };
}

/**
 * Compact one signature line. Leading whitespace (member indentation) is kept.
 * @param {string} sig
 * @returns {string}
 */
function encodeTerseSig(sig) {
  const { text, suffix } = splitAnchor(sig);
  let t = text
    .replace(/\basync function\b/g, 'async fn')
    .replace(/\bfunction\b/g, 'fn')
    .replace(/\s+→\s+/g, '→')
    .replace(/,\s+/g, ',')
    .replace(/\s+=\s+/g, '=')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/(\S)\s{2,}(?=\S)/g, '$1 ')
    .replace(/^module\.exports=/, 'exports=');
  return t + suffix;
}

/**
 * Compact an array of signature lines.
 * @param {string[]} sigs
 * @returns {string[]}
 */
function encodeTerseSigs(sigs) {
  return (sigs || []).map(encodeTerseSig);
}

/** Estimated tokens of joined signature lines (same chars/4 rule as elsewhere). */
function _tokens(sigs) {
  return Math.ceil(sigs.join('\n').length / 4);
}

/**
 * Measure the real reduction terse encoding buys over a set of signature
 * lists — the D7 "measure first" gate. Never quote a number this didn't produce.
 * @param {string[][]} sigsList one string[] per file
 * @returns {{ beforeTokens: number, afterTokens: number, reductionPct: number }}
 */
function measureTerse(sigsList) {
  let beforeTokens = 0;
  let afterTokens = 0;
  for (const sigs of sigsList || []) {
    if (!sigs || !sigs.length) continue;
    beforeTokens += _tokens(sigs);
    afterTokens += _tokens(encodeTerseSigs(sigs));
  }
  const reductionPct = beforeTokens > 0
    ? Math.round(((beforeTokens - afterTokens) / beforeTokens) * 1000) / 10
    : 0;
  return { beforeTokens, afterTokens, reductionPct };
}

module.exports = { encodeTerseSig, encodeTerseSigs, measureTerse, splitAnchor };
