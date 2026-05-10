'use strict';

/**
 * Extract signatures from R source code.
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Strip line comments. R uses # comments. Roxygen2 (#') comments are
  // stripped along with regular ones; Phase 2 may parse them.
  const stripped = src.replace(/#.*$/gm, '');

  // Function definitions:
  //   name <- function(args) { ... }
  //   name = function(args) { ... }
  //   name <<- function(args) { ... }
  // Args may span multiple lines and contain default values, so we need to
  // match a balanced parenthesis group rather than a single line.
  const funcRe = /^(?:[ \t]*)([\w.]+)\s*(?:<<-|<-|=)\s*function\s*\(/gm;
  let m;
  while ((m = funcRe.exec(stripped)) !== null) {
    const name = m[1];
    if (name.startsWith('.')) continue; // private convention
    const argsStart = funcRe.lastIndex;
    const args = readBalancedParens(stripped, argsStart - 1);
    if (args === null) continue;
    sigs.push(`${name} <- function(${normalizeParams(args)})`);
  }

  // S4 setMethod / setGeneric:
  //   setGeneric("name", function(args) standardGeneric("name"))
  //   setMethod("name", "ClassName", function(args) { ... })
  for (const sm of stripped.matchAll(/^[ \t]*setGeneric\s*\(\s*["']([\w.]+)["']/gm)) {
    sigs.push(`setGeneric("${sm[1]}")`);
  }
  for (const sm of stripped.matchAll(/^[ \t]*setMethod\s*\(\s*["']([\w.]+)["']\s*,\s*["']([\w.]+)["']/gm)) {
    sigs.push(`setMethod("${sm[1]}", "${sm[2]}")`);
  }

  // S4 class definitions:
  //   setClass("Name", representation(...), ...)
  for (const sm of stripped.matchAll(/^[ \t]*setClass\s*\(\s*["']([\w.]+)["']/gm)) {
    sigs.push(`setClass("${sm[1]}")`);
  }

  return sigs.slice(0, 30);
}

/**
 * Read a parenthesis-balanced substring starting at the position of the
 * opening '(' character, returning the inner content (without the outer
 * parens). Returns null if no matching close paren is found within `cap`
 * characters, which guards against runaway scans on malformed input.
 */
function readBalancedParens(src, openIdx, cap = 4096) {
  if (src[openIdx] !== '(') return null;
  let depth = 1;
  let i = openIdx + 1;
  const end = Math.min(src.length, openIdx + cap);
  let inString = null; // null | '"' | "'"
  while (i < end) {
    const ch = src[i];
    if (inString) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inString) inString = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = ch; i++; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
    i++;
  }
  return null;
}

/**
 * Compress whitespace inside a parameter list, collapse multi-line default
 * expressions onto a single line, and trim. The goal is one-line readable
 * signatures, not a faithful AST.
 *
 * String literals are protected so that commas/equals inside default values
 * like sep = "," don't get respaced.
 */
function normalizeParams(raw) {
  const tokens = [];
  let buf = '';
  let inString = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      buf += ch;
      if (ch === '\\' && i + 1 < raw.length) { buf += raw[i + 1]; i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = ch; buf += ch; continue; }
    buf += ch;
  }
  // Now buf === raw with strings preserved character-for-character.
  // Walk again: collapse non-string runs of whitespace, normalize ', ' and ' = '.
  let out = '';
  inString = null;
  for (let i = 0; i < buf.length; i++) {
    const ch = buf[i];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < buf.length) { out += buf[i + 1]; i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = ch; out += ch; continue; }
    if (/\s/.test(ch)) {
      if (out.length && !/\s$/.test(out)) out += ' ';
      continue;
    }
    if (ch === ',') {
      out = out.replace(/\s+$/, '') + ', ';
      continue;
    }
    if (ch === '=') {
      out = out.replace(/\s+$/, '') + ' = ';
      continue;
    }
    out += ch;
  }
  return out.trim();
}

module.exports = { extract };
