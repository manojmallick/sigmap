'use strict';

/**
 * Shared tokenizer-grade scanning core (G4 increment 1, #526).
 *
 * Hand-rolled string/comment state + delimiter depth — generalizes the
 * masking in src/graph/call-graph.js (maskJs) and the balanced reader in the
 * R extractor. NOT a parser, NOT tree-sitter: three small, deterministic,
 * zero-dependency passes that let extractors find real declaration
 * boundaries instead of truncating at the first `)`.
 *
 * All transforms are length- and newline-preserving, so character offsets
 * and line anchors computed on the output align 1:1 with the input.
 */

/**
 * Words after which a `/` begins a regular expression rather than dividing.
 * An identifier-shaped token anywhere else is an operand, so a `/` after it is
 * division.
 */
const REGEX_AFTER_WORD = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await',
]);

/**
 * End (exclusive, flags included) of the regular-expression literal that opens
 * at `i`, or -1 when it is not one. A literal cannot span lines, so a `/` with
 * no closing `/` before the newline — a closing JSX tag, a division in a
 * sentence — is not a regex. Honours `\` escapes and `[...]` classes, where an
 * unescaped `/` does not close the literal.
 */
function regexEnd(src, i) {
  const n = src.length;
  let j = i + 1;
  let inClass = false;
  while (j < n) {
    const ch = src[j];
    if (ch === '\n') return -1;
    if (ch === '\\') { j += 2; continue; }
    if (inClass) { if (ch === ']') inClass = false; }
    else if (ch === '[') inClass = true;
    else if (ch === '/') {
      j++;
      while (j < n && /[a-z]/i.test(src[j])) j++;
      return j;
    }
    j++;
  }
  return -1;
}

/**
 * Advance the JS/TS tokenizer one token past `i`, for anything that is not a
 * comment, string or template: a regular-expression literal, a word, or a
 * punctuator. Returns where it ends and whether the token just read is a value
 * (so a following `/` divides). One step shared by `scan` and `exprEnd`, so the
 * main loop and a `${ }` expression can never disagree about what is a regex.
 */
function jsToken(src, i, operand) {
  const c = src[i];
  if (c === '/' && !operand && src[i - 1] !== '<') {
    const j = regexEnd(src, i);
    if (j !== -1) return { end: j, operand: true, regex: true };
  }
  if (/[A-Za-z0-9_$]/.test(c)) {
    let j = i + 1;
    while (j < src.length && /[\w$]/.test(src[j])) j++;
    let operand = !REGEX_AFTER_WORD.has(src.slice(i, j));
    if (!operand) {
      // `o.in / 2`: after a `.` a keyword-shaped word is a property name, so a value
      let k = i - 1;
      while (k >= 0 && /\s/.test(src[k])) k--;
      if (src[k] === '.' && src[k - 1] !== '.') operand = true;
    }
    return { end: j, operand };
  }
  if (c === ')' || c === ']') return { end: i + 1, operand: true };
  if ((c === '+' || c === '-') && src[i + 1] === c) return { end: i + 2, operand }; // ++ / -- keep the state
  return { end: i + 1, operand: /\s/.test(c) ? operand : false };
}

/**
 * End (exclusive) of the template literal opening at `i`. A `${ ... }` inside
 * it holds ANY expression — including strings, comments and further template
 * literals — so a backtick there does not close the outer template.
 */
function templateEnd(src, i) {
  const n = src.length;
  let j = i + 1;
  while (j < n) {
    const ch = src[j];
    if (ch === '\\') { j += 2; continue; }
    if (ch === '`') return j + 1;
    if (ch === '$' && src[j + 1] === '{') { j = exprEnd(src, j + 2); continue; }
    j++;
  }
  return n;
}

/** End (exclusive) of a `${` expression whose body starts at `j`: just past its matching `}`. */
function exprEnd(src, j) {
  const n = src.length;
  let depth = 1;
  let operand = false;
  while (j < n) {
    const ch = src[j];
    if (ch === '`') { j = templateEnd(src, j); operand = true; continue; }
    if (ch === '"' || ch === "'") {
      let k = j + 1;
      while (k < n) { if (src[k] === '\\') { k += 2; continue; } if (src[k] === ch || src[k] === '\n') break; k++; }
      j = Math.min(n, k + 1); operand = true; continue;
    }
    if (ch === '/' && src[j + 1] === '/') { while (j < n && src[j] !== '\n') j++; continue; }
    if (ch === '/' && src[j + 1] === '*') { const k = src.indexOf('*/', j + 2); j = k === -1 ? n : k + 2; continue; }
    if (ch === '{') { depth++; operand = false; j++; continue; }
    if (ch === '}') { depth--; if (depth === 0) return j + 1; operand = false; j++; continue; }
    const t = jsToken(src, j, operand);
    j = t.end; operand = t.operand;
  }
  return n;
}

/**
 * One pass over `src` that finds comments, strings and — when `opts.regex` —
 * regular-expression literals, and blanks what the caller asks for.
 *
 * `opts.regex` is for JavaScript and TypeScript only. A regex body is code the
 * tokenizer must step over: its braces, parens and quotes are not structure, and
 * a `//` inside it (`/\//g`) is not a comment. Left unmasked, one `{` in a regex
 * unbalances every block scan after it, so a function's `:start-end` anchor ran
 * to the wrong line (#874). Other languages never enable it: a `/` there is
 * division or a comment, and guessing otherwise would mis-mask real code.
 *
 * Whether a `/` opens a regex depends on the token before it. After a value (an
 * identifier, number, string, `)` or `]`) it divides; after an operator, an
 * opening bracket, `,` `;` `{` `}` or one of REGEX_AFTER_WORD it starts a regex.
 *
 * @param {string} src
 * @param {{ js?: boolean, strings?: boolean, regexes?: boolean }} opts
 *        strings/regexes: blank their contents (otherwise they are only skipped)
 */
function scan(src, opts) {
  const out = src.split('');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  const js = !!opts.js;
  let i = 0; const n = src.length;
  let operand = false; // the previous significant token is a value, so `/` divides
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { let j = i + 2; while (j < n && src[j] !== '\n') j++; blank(i, j); i = j; continue; }
    if (c === '/' && d === '*') { let j = i + 2; while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++; j = Math.min(n, j + 2); blank(i, j); i = j; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j;
      if (js && c === '`') j = templateEnd(src, i);
      else {
        j = i + 1;
        while (j < n) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === c) break; if (c !== '`' && src[j] === '\n') break; j++; }
        j = Math.min(n, j + 1);
      }
      if (opts.strings) blank(i, j);
      i = j; operand = true; continue;
    }
    if (js) {
      const t = jsToken(src, i, operand);
      if (t.regex && opts.regexes) blank(i, t.end);
      i = t.end; operand = t.operand; continue;
    }
    i++;
  }
  return out.join('');
}

/**
 * Blank comments only — string-aware, so `//` or `/*` INSIDE a string
 * literal survives (the naive regex strip corrupted e.g. `url = "https://x"`).
 * Comment bytes become spaces; newlines and everything else are preserved.
 * @param {string} src
 * @param {{ js?: boolean }} [opts] js: JS/TS only — step over regex literals and
 *        nested template literals so a `//` inside one is not read as a comment
 * @returns {string} same length, comments blanked
 */
function stripComments(src, opts = {}) {
  return scan(src, { js: opts.js });
}

/**
 * Blank comments AND string/template contents (quotes included) — the
 * boundary-scanning surface: delimiters found here are always structural.
 * With `opts.js` (JS/TS only) regular-expression literals are blanked too, and a
 * template literal may nest another inside a `${ }`.
 * @param {string} src
 * @param {{ js?: boolean }} [opts]
 * @returns {string} same length, comments + strings blanked
 */
function maskCode(src, opts = {}) {
  return scan(src, { js: opts.js, strings: true, regexes: true });
}

/**
 * Index of the delimiter that closes the one open at `openIdx`, matched by
 * depth over MASKED text (strings/comments already blanked, so every
 * delimiter seen is structural). -1 when unbalanced within the cap.
 * @param {string} masked  output of maskCode
 * @param {number} openIdx index of the opening delimiter
 * @param {string} [open='(']
 * @param {string} [close=')']
 * @param {number} [cap=4000] scan ceiling in chars
 * @returns {number}
 */
function readBalanced(masked, openIdx, open = '(', close = ')', cap = 4000) {
  if (masked[openIdx] !== open) return -1;
  let depth = 1;
  const end = Math.min(masked.length, openIdx + cap);
  for (let i = openIdx + 1; i < end; i++) {
    const ch = masked[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

module.exports = { stripComments, maskCode, readBalanced };
