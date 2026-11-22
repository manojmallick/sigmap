'use strict';

const { lineAt, withAnchor } = require('./line-anchor');
const { capWithNotice, capMembersWithNotice } = require('../util/truncate');
const { stripComments, maskCode, readBalanced } = require('./scan');

// Ceilings sit above the default `maxSigsPerFile` so the configured budget
// governs output rather than a literal buried here, and omissions are disclosed
// — an undisclosed cap looks like a class that simply has eight methods (#576).
// Class bodies are scanned to this many characters. Real classes routinely
// run past the old 4KB scan window — truncating there silently hid every
// member after ~4000 chars AND anchored class end-lines short (#576). The
// ceiling only guards against pathological input (Java parity, #551).
const MAX_CLASS_BODY_CHARS = 200000;
const MEMBER_LIMIT = 120;
const PER_FILE_LIMIT = 200;

// Chars scanned past the params before giving up on a return type.
const RET_SCAN_CHARS = 400;

/**
 * Extract signatures from PHP source code.
 * Signatures carry `:start-end` line anchors (Surgical Context); the comment
 * strips below are newline-preserving so anchor lines match the original file.
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // stripComments is length- AND newline-preserving; the previous regex strip
  // DELETED comment text, so offsets no longer aligned with the masked surface
  // the balanced reader walks (#695). The `#` line-comment form PHP also
  // accepts is blanked separately, preserving length.
  const stripped = blankHashComments(stripComments(src));
  const masked = blankHashComments(maskCode(src));

  // Anchor range: scan past same-line trivia to a body `{` (range) else single line.
  const rangeFor = (declIdx, afterIdx) => {
    let k = afterIdx;
    while (k < stripped.length && /[ \tA-Za-z0-9_:?\\]/.test(stripped[k])) k++;
    if (stripped[k] === '{' || (stripped[k] === '\n' && stripped[k + 1] === '{')) {
      const open = stripped[k] === '{' ? k : k + 1;
      const end = open + 1 + extractBlock(stripped, open + 1).length;
      return [lineAt(stripped, declIdx), lineAt(stripped, end)];
    }
    const line = lineAt(stripped, declIdx);
    return [line, line];
  };

  // Classes, interfaces, traits and enums. A modifier (`abstract`, `final`, `readonly`, in any order and any number)
  // may lead the declaration; a parent or an interface may be namespaced (`\Foo\Bar`), an interface may extend
  // several, a class implement several across lines, and an enum carry a backing type (`enum Suit: string`).
  // The previous pattern took `abstract` alone and `\w+` for a parent, so `final class X extends \Foo\Y` and every
  // `readonly` class or `enum` listed nothing, and a file made of them was not in the index at all.
  const typeRe = /^(?:(?:abstract|final|readonly)\s+)*(class|interface|trait|enum)\s+(\w+)(?:\s*:\s*\w+)?(?:\s+extends\s+[\w\\]+(?:\s*,\s*[\w\\]+)*)?(?:\s+implements\s+[\w\\,\s]+?)?\s*\{/gm;
  for (const m of stripped.matchAll(typeRe)) {
    const kind = m[1];
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    sigs.push(withAnchor(`${kind} ${m[2]}`, lineAt(stripped, m.index), lineAt(stripped, bodyStart + block.length)));
    for (const meth of extractMembers(block, masked.slice(bodyStart, bodyStart + block.length))) {
      // The disclosure marker carries no offsets; anchor it at the class body.
      sigs.push(withAnchor(`  ${meth.text}`, lineAt(stripped, bodyStart + (meth.declIdx || 0)), lineAt(stripped, bodyStart + (meth.endIdx || 0))));
    }
  }

  // Top-level functions
  // `(?:<\?php\s+)?` lets a declaration share its line with the opening tag —
  // `<?php function f($a) {…}` previously yielded NOTHING at all (#696).
  for (const m of stripped.matchAll(/^(?:<\?php\s+|<\?=\s+)?function\s+(\w+)\s*\(/gm)) {
    const pr = readParams(stripped, masked, m.index + m[0].length - 1);
    if (!pr) continue;
    const rm = /^\s*:\s*([^\n{]+)/.exec(pr.after);
    const ret = normalizeType(rm ? rm[1] : '');
    const retStr = ret ? ` → ${ret}` : '';
    const declIdx = m.index + (m[0].startsWith('<?') ? m[0].length - m[0].replace(/^<\?(?:php|=)\s+/, '').length : 0);
    const [s, e] = rangeFor(declIdx, pr.end);
    sigs.push(withAnchor(`function ${m[1]}(${normalizeParams(pr.params)})${retStr}`, s, e));
  }

  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

/** Blank `#` line comments, preserving length and newlines. */
function blankHashComments(src) {
  return src.replace(/#[^\n]*/g, (m) => ' '.repeat(m.length));
}

/**
 * Resolve a declaration's parameter list with a BALANCED read (#695).
 *
 * `\(([^)]*)\)` stopped at the first `)`, so `function f($a = g(1, 2), $b)`
 * truncated to `function f($a = g(1, 2)` and a `)` inside a string default cut
 * the scan mid-literal.
 */
function readParams(stripped, masked, openIdx) {
  const close = readBalanced(masked, openIdx);
  if (close < 0) return null;
  let i = close + 1;
  const stop = Math.min(masked.length, i + RET_SCAN_CHARS);
  while (i < stop) {
    const ch = masked[i];
    if (ch === '{' || ch === ';' || ch === '\n') break;
    i++;
  }
  return { params: stripped.slice(openIdx + 1, close), after: stripped.slice(close + 1, i), end: i, close };
}

function extractBlock(src, startIndex) {
  let depth = 1, i = startIndex;
  const end = Math.min(src.length, startIndex + MAX_CLASS_BODY_CHARS);
  while (i < end && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(startIndex, i - 1);
}

function extractMembers(block, maskedBlock) {
  const members = [];
  const methodRe = /^[ \t]+(?:public|protected)\s+(?:static\s+)?function\s+(\w+)\s*\(/gm;
  for (const m of block.matchAll(methodRe)) {
    if (m[1].startsWith('_')) continue;
    const pr = readParams(block, maskedBlock, m.index + m[0].length - 1);
    if (!pr) continue;
    const isStatic = m[0].includes('static ') ? 'static ' : '';
    const rm = /^\s*:\s*([^\n{]+)/.exec(pr.after);
    const ret = normalizeType(rm ? rm[1] : '');
    const retStr = ret ? ` → ${ret}` : '';
    members.push({
      text: `${isStatic}function ${m[1]}(${normalizeParams(pr.params)})${retStr}`,
      declIdx: m.index + (m[0].length - m[0].trimStart().length),
      endIdx: pr.close + 1,
    });
  }
  return capMembersWithNotice(members, MEMBER_LIMIT);
}

function normalizeParams(params) {
  if (!params) return '';
  return params.trim().replace(/\s+/g, ' ');
}

function normalizeType(type) {
  if (!type) return '';
  return type.trim().replace(/[;\s]+$/g, '').replace(/\s+/g, ' ').slice(0, 25);
}

module.exports = { extract };
