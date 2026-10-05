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
 * Extract signatures from C# source code.
 * Signatures carry `:start-end` line anchors (Surgical Context); the comment
 * strip below is newline-preserving so anchor lines match the original file.
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // stripComments is length- AND newline-preserving; the previous regex strip
  // DELETED comment text, so offsets no longer aligned with the masked surface
  // the balanced reader walks (#695).
  const stripped = stripComments(src);
  const masked = maskCode(src);

  // Classes and interfaces. `partial` must sit immediately before the type
  // keyword, so it is one more optional token after the other modifiers; without
  // it every `partial` type — ubiquitous in WinForms, Blazor, EF and source
  // generators — extracted as nothing at all (#900).
  const typeRe = /^\s*(?:public\s+|internal\s+|protected\s+)?(?:abstract\s+|sealed\s+|static\s+)?(?:partial\s+)?(class|interface|enum|record|struct)\s+(\w+)(?:<[^{]*>)?(?:\s*:\s*[\w<>, .]+)?\s*\{/gm;
  for (const m of stripped.matchAll(typeRe)) {
    const declIdx = m.index + (m[0].length - m[0].trimStart().length);
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    sigs.push(withAnchor(`${m[1]} ${m[2]}`, lineAt(stripped, declIdx), lineAt(stripped, bodyStart + block.length)));
    // Members of a NESTED type belong to that type, not to this one.
    const scoped = blankNestedTypeBodies(block, masked.slice(bodyStart, bodyStart + block.length),
      /^[ \t]+(?:(?:public|internal|protected|private|abstract|sealed|static|partial)\s+)*(?:class|interface|enum|record|struct)\s+\w+/gm);
    for (const meth of extractMembers(scoped.block, scoped.masked, { implicitPublic: m[1] === 'interface' })) {
      // The disclosure marker carries no offsets; anchor it at the class body.
      sigs.push(withAnchor(`  ${meth.text}`, lineAt(stripped, bodyStart + (meth.declIdx || 0)), lineAt(stripped, bodyStart + (meth.endIdx || 0))));
    }
  }

  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

/**
 * Resolve a declaration's parameter list with a BALANCED read (#695).
 *
 * `\(([^)]*)\)` stopped at the first `)`, so a nested call or a
 * function-typed parameter truncated the list mid-type.
 */
function readParams(stripped, masked, openIdx) {
  const close = readBalanced(masked, openIdx);
  if (close < 0) return null;
  let i = close + 1;
  const stop = Math.min(masked.length, i + RET_SCAN_CHARS);
  while (i < stop) {
    const ch = masked[i];
    if (ch === '{' || ch === ';') break;
    if (ch === '(') { const c = readBalanced(masked, i); if (c < 0) break; i = c + 1; continue; }
    if (ch === '<') { const c = readBalanced(masked, i, '<', '>'); if (c < 0) { i++; continue; } i = c + 1; continue; }
    i++;
  }
  // `close` anchors a member to its DECLARATION line; `end` may run onto the
  // next line when the body brace sits there (C# style), which would widen the
  // anchor past the signature itself.
  return { params: stripped.slice(openIdx + 1, close), after: stripped.slice(close + 1, i), end: i, close };
}

/**
 * Blank the bodies of NESTED type declarations so their members are not also
 * attributed to the enclosing type (#741). Length- and newline-preserving, so
 * member offsets and line anchors still align with the original block.
 */
function blankNestedTypeBodies(block, maskedBlock, typeRe) {
  const b = block.split('');
  const mb = maskedBlock.split('');
  for (const m of block.matchAll(typeRe)) {
    let i = m.index + m[0].length;
    const stop = Math.min(maskedBlock.length, i + RET_SCAN_CHARS);
    let open = -1;
    while (i < stop) {
      const ch = maskedBlock[i];
      if (ch === '{') { open = i; break; }
      if (ch === '(') { const c = readBalanced(maskedBlock, i); if (c < 0) break; i = c + 1; continue; }
      if (ch === '<') { const c = readBalanced(maskedBlock, i, '<', '>'); if (c < 0) { i++; continue; } i = c + 1; continue; }
      if (ch === ';') break;
      i++;
    }
    if (open < 0) continue;
    const close = readBalanced(maskedBlock, open, '{', '}');
    const end = close < 0 ? maskedBlock.length : close + 1;
    for (let k = open; k < end && k < b.length; k++) {
      if (b[k] !== '\n') b[k] = ' ';
      if (mb[k] !== '\n') mb[k] = ' ';
    }
  }
  return { block: b.join(''), masked: mb.join('') };
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

function extractMembers(block, maskedBlock, opts = {}) {
  const members = [];
  // Interface members are IMPLICITLY public, so demanding an explicit modifier
  // matched none of them — `interface T` was reported with no members at all
  // (#741). Java already draws this distinction via the same option.
  const methodRe = opts.implicitPublic
    ? /^[ \t]+(?:(?:public|internal|protected|static|virtual|override|async|new)\s+)*([\w<>\[\]?., ]+?)\s+(\w+)\s*\(/gm
    : /^[ \t]+(?:public|internal|protected)\s+(?:static\s+|virtual\s+|override\s+|async\s+)*(?:where\s+\w+\s*:\s*[^\n]+\s+)?([\w<>\[\]?., ]+)\s+(\w+)\s*\(/gm;
  for (const m of block.matchAll(methodRe)) {
    const pr = readParams(block, maskedBlock, m.index + m[0].length - 1);
    if (!pr) continue;
    const ret = normalizeType(m[1]);
    const retStr = ret ? ` → ${ret}` : '';
    members.push({
      text: `${m[2]}(${normalizeParams(pr.params)})${retStr}`,
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
  return type.trim().replace(/\s+/g, ' ').slice(0, 30);
}

module.exports = { extract };
