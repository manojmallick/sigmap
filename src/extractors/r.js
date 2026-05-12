'use strict';

/**
 * Extract signatures from R source code.
 *
 * Recognised constructs:
 *   - Function definitions: `name <- function(args)`, `name = function(args)`,
 *     `name <<- function(args)`
 *   - S4: setClass / setGeneric / setMethod
 *   - R6: `Name <- R6Class("Name", public = list(method = function(...)))`
 *   - S7: `Name <- new_class("Name", ...)` and `method(generic, Name) <- function(...)`
 *   - roxygen2 docstring hint (first non-tag `#'` line) appended as `  # hint`
 *
 * The extractor stays regex-only and zero-dependency. Output uses two-space
 * indentation for class members (matching python/typescript/scala fixtures).
 *
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Collect roxygen2 hints from the original source (before stripping `#`).
  const docHints = collectRoxygenHints(src);

  // Strip line comments for the rest of the parsing. R uses `#` comments and
  // roxygen2 `#'` is consumed alongside them — its content already lives in
  // docHints.
  const stripped = src.replace(/#.*$/gm, '');

  // Track byte ranges already accounted for by R6 / setClass blocks so the
  // top-level function regex doesn't re-emit their methods as bare functions.
  const consumedRanges = [];

  // ── R6 classes ────────────────────────────────────────────────────────────
  //   ClassName <- R6Class("ClassName", public = list(method = function(...)))
  //   ClassName <- R6::R6Class(...)
  const r6Re = /([\w.]+)\s*(?:<<-|<-|=)\s*(?:R6::)?R6Class\s*\(/g;
  let m;
  while ((m = r6Re.exec(stripped)) !== null && sigs.length < 30) {
    const name = m[1];
    if (name.startsWith('.')) continue;
    const openIdx = r6Re.lastIndex - 1;
    const body = readBalancedParens(stripped, openIdx);
    if (body === null) continue;
    const closeIdx = openIdx + body.length + 1;
    const classNameLit = readFirstStringArg(body) || name;
    sigs.push(`${name} <- R6Class("${classNameLit}")` + applyHint(docHints, name));
    for (const memberSig of extractListMethods(body, 8)) {
      sigs.push('  ' + memberSig);
      if (sigs.length >= 30) break;
    }
    consumedRanges.push([m.index, closeIdx]);
    r6Re.lastIndex = closeIdx;
  }

  // ── S7 classes ────────────────────────────────────────────────────────────
  //   ClassName <- new_class("ClassName", properties = list(...))
  const s7Classes = new Set();
  const s7Re = /([\w.]+)\s*(?:<<-|<-|=)\s*(?:S7::)?new_class\s*\(/g;
  while ((m = s7Re.exec(stripped)) !== null && sigs.length < 30) {
    const name = m[1];
    if (name.startsWith('.')) continue;
    const openIdx = s7Re.lastIndex - 1;
    const body = readBalancedParens(stripped, openIdx);
    if (body === null) continue;
    const closeIdx = openIdx + body.length + 1;
    const classNameLit = readFirstStringArg(body) || name;
    s7Classes.add(classNameLit);
    s7Classes.add(name);
    sigs.push(`${name} <- new_class("${classNameLit}")` + applyHint(docHints, name));
    consumedRanges.push([m.index, closeIdx]);
    s7Re.lastIndex = closeIdx;
  }

  // S7 method dispatch: `method(generic, ClassName) <- function(args)`
  const s7MethodRe = /^[ \t]*method\s*\(\s*([\w.]+)\s*,\s*([\w.]+)\s*\)\s*(?:<<-|<-|=)\s*function\s*\(/gm;
  while ((m = s7MethodRe.exec(stripped)) !== null && sigs.length < 30) {
    if (!s7Classes.has(m[2])) continue;
    const argsStart = s7MethodRe.lastIndex - 1;
    const args = readBalancedParens(stripped, argsStart);
    if (args === null) continue;
    sigs.push(`  method(${m[1]}, ${m[2]}) <- function(${normalizeParams(args)})`);
  }

  // ── Top-level function definitions ────────────────────────────────────────
  //   name <- function(args), name = function(args), name <<- function(args)
  // Skip matches whose position falls inside an R6/S7 class body — those have
  // already been emitted as indented members.
  const funcRe = /^(?:[ \t]*)([\w.]+)\s*(?:<<-|<-|=)\s*function\s*\(/gm;
  while ((m = funcRe.exec(stripped)) !== null && sigs.length < 30) {
    const name = m[1];
    if (name.startsWith('.')) continue;
    if (inAnyRange(m.index, consumedRanges)) continue;
    const argsStart = funcRe.lastIndex - 1;
    const args = readBalancedParens(stripped, argsStart);
    if (args === null) continue;
    sigs.push(`${name} <- function(${normalizeParams(args)})` + applyHint(docHints, name));
  }

  // ── S4 ────────────────────────────────────────────────────────────────────
  for (const sm of stripped.matchAll(/^[ \t]*setGeneric\s*\(\s*["']([\w.]+)["']/gm)) {
    if (sigs.length >= 30) break;
    sigs.push(`setGeneric("${sm[1]}")`);
  }
  for (const sm of stripped.matchAll(/^[ \t]*setMethod\s*\(\s*["']([\w.]+)["']\s*,\s*["']([\w.]+)["']/gm)) {
    if (sigs.length >= 30) break;
    sigs.push(`setMethod("${sm[1]}", "${sm[2]}")`);
  }
  for (const sm of stripped.matchAll(/^[ \t]*setClass\s*\(\s*["']([\w.]+)["']/gm)) {
    if (sigs.length >= 30) break;
    sigs.push(`setClass("${sm[1]}")`);
  }

  return sigs.slice(0, 30);
}

/**
 * Collect roxygen2 docstring hints from the original (uncommented) source.
 * Returns Map<symbolName, hint> where hint is the first @title line, else
 * @description, else the first non-tag content line. Trimmed to 60 chars,
 * trailing punctuation removed.
 */
function collectRoxygenHints(src) {
  const hints = new Map();
  const lines = src.split('\n');
  let block = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#'/.test(line)) {
      block.push(line.replace(/^\s*#'\s?/, ''));
      continue;
    }
    if (block.length > 0) {
      const m = line.match(/^[ \t]*([\w.]+)\s*(?:<<-|<-|=)\s*(?:R6::)?R6Class\b/)
             || line.match(/^[ \t]*([\w.]+)\s*(?:<<-|<-|=)\s*(?:S7::)?new_class\b/)
             || line.match(/^[ \t]*([\w.]+)\s*(?:<<-|<-|=)\s*function\b/);
      if (m) {
        const name = m[1];
        let hint = pickRoxygenLine(block, '@title')
                || pickRoxygenLine(block, '@description')
                || pickRoxygenLine(block, null);
        if (hint) {
          hint = hint.replace(/\s+/g, ' ').trim().slice(0, 60).replace(/[.,;:!?]+$/, '').trim();
          if (hint) hints.set(name, hint);
        }
      }
      block = [];
    }
  }
  return hints;
}

function pickRoxygenLine(block, tag) {
  for (const raw of block) {
    const b = raw.trim();
    if (!b) continue;
    if (tag) {
      if (b.startsWith(tag)) {
        const rest = b.slice(tag.length).trim();
        if (rest) return rest;
      }
    } else if (!b.startsWith('@')) {
      return b;
    }
  }
  return null;
}

function applyHint(hints, name) {
  const h = hints.get(name);
  return h ? `  # ${h}` : '';
}

/**
 * Extract method-like entries from the body of an R6/S7 list(...) argument.
 * Matches `name = function(args)` at any indentation. Caps at `cap` entries.
 */
function extractListMethods(body, cap) {
  const out = [];
  const re = /(?:^|[\n,])\s*([\w.]+)\s*=\s*function\s*\(/g;
  let m;
  while ((m = re.exec(body)) !== null && out.length < cap) {
    const name = m[1];
    if (name.startsWith('.')) continue;
    const argsStart = re.lastIndex - 1;
    const args = readBalancedParens(body, argsStart);
    if (args === null) continue;
    out.push(`${name} <- function(${normalizeParams(args)})`);
  }
  return out;
}

function inAnyRange(pos, ranges) {
  for (const [s, e] of ranges) {
    if (pos >= s && pos < e) return true;
  }
  return false;
}

/** Extract the first quoted string from a comma-separated argument body. */
function readFirstStringArg(body) {
  const m = body.match(/^\s*["']([\w.]+)["']/);
  return m ? m[1] : null;
}

/**
 * Read a parenthesis-balanced substring starting at the position of the
 * opening '(' character, returning the inner content (without the outer
 * parens). Returns null if no matching close paren is found within `cap`
 * characters, which guards against runaway scans on malformed input.
 */
function readBalancedParens(src, openIdx, cap = 16384) {
  if (src[openIdx] !== '(') return null;
  let depth = 1;
  let i = openIdx + 1;
  const end = Math.min(src.length, openIdx + cap);
  let inString = null;
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
 * expressions onto a single line, and trim. String literals are protected so
 * that commas/equals inside default values like `sep = ","` don't get respaced.
 */
function normalizeParams(raw) {
  let out = '';
  let inString = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < raw.length) { out += raw[i + 1]; i++; continue; }
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
