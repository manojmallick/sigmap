'use strict';

/**
 * Whether `index` begins a statement on its line: at the start of a line, or behind a `;` or a
 * `}` and any blanks (`} export const a = 1`).
 *
 * The extractors asked this with a lookbehind, `(?<=[;}][ \t]*)`. V8 up to Node 22 tries it at
 * every position and walks back over the whole run of blanks, so a long string literal masked
 * to spaces costs time with the square of its length: excalidraw's 790 KB base64 file did not
 * finish on Node 22. Looking back from a match instead costs one short walk per `export`.
 *
 * @param {string} text
 * @param {number} index  where the match begins
 * @returns {boolean}
 */
function atStatementStart(text, index) {
  if (index <= 0) return true;
  const prev = text[index - 1];
  if (prev === '\n' || prev === '\r' || prev === '\u2028' || prev === '\u2029') return true;
  let i = index - 1;
  while (i >= 0 && (text[i] === ' ' || text[i] === '\t')) i--;
  return i >= 0 && (text[i] === ';' || text[i] === '}');
}

module.exports = { atStatementStart };
