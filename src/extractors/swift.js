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

// Chars scanned past the params for a `-> Return` before giving up.
const RET_SCAN_CHARS = 400;

/**
 * Extract signatures from Swift source code.
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

  // Anchor range: scan past same-line modifiers to a body `{` (range) else single line.
  const rangeFor = (declIdx, afterIdx) => {
    let k = afterIdx;
    while (k < stripped.length && /[ \tA-Za-z0-9_>-]/.test(stripped[k])) k++;
    if (stripped[k] === '{') {
      const end = k + 1 + extractBlock(stripped, k + 1).length;
      return [lineAt(stripped, declIdx), lineAt(stripped, end)];
    }
    const line = lineAt(stripped, declIdx);
    return [line, line];
  };

  // Classes, structs, protocols, enums. The inheritance clause admits `@` so an
  // attributed conformance — `: @unchecked Sendable`, `: @retroactive Equatable`,
  // both routine in Swift 5.5+ concurrency code — does not make the whole type
  // extract as nothing (#900).
  const typeRe = /^[ \t]*(?:public\s+|internal\s+|open\s+|private\s+|fileprivate\s+)?(?:final\s+)?(class|struct|protocol|enum|actor)\s+(\w+)(?:<[^{]*>)?(?:\s*:\s*[\w, <>.@]+)?\s*\{/gm;
  for (const m of stripped.matchAll(typeRe)) {
    const declIdx = m.index + (m[0].length - m[0].trimStart().length);
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    sigs.push(withAnchor(`${m[1]} ${m[2]}`, lineAt(stripped, declIdx), lineAt(stripped, bodyStart + block.length)));
    // Members of a NESTED type belong to that type. Finding nested types at all
    // (the anchor fix above) is what makes this necessary — without it the same
    // method is emitted under both owners, as it was in kotlin/scala (#738).
    const scoped = blankNestedTypeBodies(block, masked.slice(bodyStart, bodyStart + block.length),
      /^[ \t]+(?:(?:public|internal|open|private|fileprivate|final)\s+)*(?:class|struct|protocol|enum|actor)\s+\w+/gm);
    for (const fn of extractMembers(scoped.block, scoped.masked)) {
      // The disclosure marker carries no offsets; anchor it at the class body.
      sigs.push(withAnchor(`  ${fn.text}`, lineAt(stripped, bodyStart + (fn.declIdx || 0)), lineAt(stripped, bodyStart + (fn.endIdx || 0))));
    }
  }

  // Top-level public functions — capture everything after ) to end of line for arrow type
  for (const m of stripped.matchAll(/^(?:public\s+|internal\s+)?(?:static\s+)?(?:async\s+)?func\s+(\w+)(?:<[^(]*>)?\s*\(/gm)) {
    const asyncKw = m[0].includes('async') ? 'async ' : '';
    const pr = readParams(stripped, masked, m.index + m[0].length - 1);
    if (!pr) continue;
    const retStr = extractArrowType(pr.after);
    const [s, e] = rangeFor(m.index, pr.end);
    sigs.push(withAnchor(`${asyncKw}func ${m[1]}(${normalizeParams(pr.params)})${retStr}`, s, e));
  }

  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

/**
 * Resolve a `func` declaration's parameter list with a BALANCED read (#695).
 *
 * `\(([^)]*)\)` stopped at the first `)`, so a closure-typed parameter —
 * `cb: (Int) -> Int` — closed the list early. The arrow substitution then fired
 * inside the closure type and the remainder of the real parameter list was
 * appended as prose: `func f(cb) → Int, n: Int) -> Int`, structurally malformed.
 */
function readParams(stripped, masked, openIdx) {
  const close = readBalanced(masked, openIdx);
  if (close < 0) return null;
  // Arrow segment: to the body `{` or end of line, jumping balanced groups so a
  // closure return type survives.
  let i = close + 1;
  const stop = Math.min(masked.length, i + RET_SCAN_CHARS);
  while (i < stop) {
    const ch = masked[i];
    if (ch === '{' || ch === '\n') break;
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
 * attributed to the enclosing type (#741). Length- and newline-preserving.
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
      if (ch === '\n' && !maskedBlock.slice(i + 1, maskedBlock.indexOf('\n', i + 1) + 1 || stop).trim()) break;
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

function extractMembers(block, maskedBlock) {
  const members = [];
  for (const m of block.matchAll(/^[ \t]+(?:public\s+|internal\s+|open\s+)?(?:static\s+|class\s+)?(?:mutating\s+)?(?:async\s+)?func\s+(\w+)(?:<[^(]*>)?\s*\(/gm)) {
    if (m[1].startsWith('_')) continue;
    const asyncKw = m[0].includes('async') ? 'async ' : '';
    const pr = readParams(block, maskedBlock, m.index + m[0].length - 1);
    if (!pr) continue;
    const retStr = extractArrowType(pr.after);
    members.push({
      text: `${asyncKw}func ${m[1]}(${normalizeParams(pr.params)})${retStr}`,
      declIdx: m.index + (m[0].length - m[0].trimStart().length),
      endIdx: pr.end,
    });
  }
  return capMembersWithNotice(members, MEMBER_LIMIT);
}

/**
 * Parameter NAMES only, `: Type` and `= default` dropped.
 *
 * Depth- and string-aware: the old `split(',')` + `split(':')[0]` turned
 * `a: Int = g(1, 2)` into the two params `a` and `2` (#695).
 */
function normalizeParams(params) {
  if (!params || !params.trim()) return '';
  const names = [];
  let depth = 0, quote = null, seg = '';
  const flush = () => {
    const name = seg.split(/[:=]/)[0].trim().replace(/\s+/g, ' ');
    if (name) names.push(name);
    seg = '';
  };
  for (let i = 0; i < params.length; i++) {
    const ch = params[i];
    if (quote) { if (ch === '\\') { i++; continue; } if (ch === quote) quote = null; continue; }
    if (ch === '"') { quote = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; continue; }
    // `->` is a function-type arrow, not a generic close.
    if (ch === '<') { depth++; continue; }
    if (ch === '>') { if (params[i - 1] !== '-') depth--; continue; }
    if (ch === ',' && depth === 0) { flush(); continue; }
    if (depth === 0) seg += ch;
  }
  flush();
  return names.join(', ');
}

function extractArrowType(str) {
  if (!str) return '';
  const m = str.match(/->\s*([^\n{]+)/);
  if (!m) return '';
  const rt = m[1].trim().replace(/\s+/g, ' ');
  return ` → ${rt.length > 25 ? rt.slice(0, 22) + '...' : rt}`;
}

module.exports = { extract };
