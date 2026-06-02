'use strict';

/**
 * Line-anchor helpers for Surgical Context (v6.11.0).
 *
 * Signatures carry their source location as a `:start-end` suffix so an agent
 * can read the exact lines instead of re-opening the whole file. The anchor is
 * a plain string suffix, which keeps the existing `string[]` signature contract
 * intact — ranker, adapters, and CLAUDE.md render it for free.
 */

/**
 * 1-based line number of character index `idx` within `src`.
 * Counts newlines in the prefix, so it stays correct as long as the source
 * being indexed preserves every newline (see the newline-preserving comment
 * strips in the extractors).
 *
 * @param {string} src
 * @param {number} idx
 * @returns {number}
 */
function lineAt(src, idx) {
  let line = 1;
  const end = Math.min(idx, src.length);
  for (let i = 0; i < end; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
}

/**
 * Render an anchor suffix: `  :start-end`.
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
function anchor(start, end) {
  return `  :${start}-${end}`;
}

/**
 * Append a line anchor to a signature string.
 * @param {string} sig
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
function withAnchor(sig, start, end) {
  return `${sig}${anchor(start, end)}`;
}

module.exports = { lineAt, anchor, withAnchor };
