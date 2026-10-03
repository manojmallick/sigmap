'use strict';

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

/**
 * Extract signatures from C/C++ source code.
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src, filePath) {
  if (!src || typeof src !== 'string') return [];
  if (/^\s*@(?:interface|implementation|protocol)\b/m.test(src) || /^\s*#import\b/m.test(src)) {
    return require('./objc').extract(src, filePath);
  }
  const sigs = [];

  // stripComments is length- AND newline-preserving; the previous strip DELETED
  // comment text, so offsets no longer aligned with the masked surface the
  // balanced reader walks (#695).
  const stripped = stripComments(src);
  const masked = maskCode(src);

  // Classes and structs
  const classRe = /^(?:class|struct)\s+(\w+)(?:\s*:\s*(?:public|protected|private)\s+[\w:]+)?\s*\{/gm;
  for (const m of stripped.matchAll(classRe)) {
    const kind = m[0].trimStart().startsWith('class') ? 'class' : 'struct';
    sigs.push(`${kind} ${m[1]}`);
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    for (const meth of extractMembers(block, masked.slice(bodyStart, bodyStart + block.length))) sigs.push(`  ${meth}`);
  }

  // Top-level function declarations/definitions (not inside a class)
  for (const m of stripped.matchAll(/^(?!class|struct|if|for|while|switch)([\w:*&<> ]+?)\s+(\w+)\s*\(/gm)) {
    if (m[2].startsWith('_')) continue;
    const pr = readParams(stripped, masked, m.index + m[0].length - 1);
    if (!pr) continue;
    // Only a definition (body `{`) counts at top level, as before.
    const tail = masked.slice(pr.close + 1, pr.close + 40);
    if (!/^\s*(?:const\s*)?\{/.test(tail)) continue;
    const ret = normalizeType(m[1]);
    const retStr = ret ? ` → ${ret}` : '';
    sigs.push(`${m[2]}(${normalizeParams(pr.params)})${retStr}`);
  }

  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

/**
 * Balanced parameter read (#695). `\(([^)]*)\)` stopped at the first `)`, so
 * `int f(int a, int b = g(1, 2))` and a function-pointer parameter
 * `int (*cb)(int)` failed the whole declaration match and were DROPPED — the
 * symbol then became a fake-symbol false positive in `verify`.
 */
function readParams(stripped, masked, openIdx) {
  const close = readBalanced(masked, openIdx);
  if (close < 0) return null;
  return { params: stripped.slice(openIdx + 1, close), close };
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
  const methodRe = /^[ \t]+(?:virtual\s+|static\s+|inline\s+)?(?!private:|protected:|public:)([\w:*&<> ]+?)\s+(\w+)\s*\(/gm;
  for (const m of block.matchAll(methodRe)) {
    if (m[2].startsWith('_')) continue;
    const pr = readParams(block, maskedBlock, m.index + m[0].length - 1);
    if (!pr) continue;
    // Declarations end in `;` (optionally after const/override/= 0), as before.
    const tail = maskedBlock.slice(pr.close + 1, pr.close + 40);
    if (!/^\s*(?:const\s*)?(?:override\s*)?(?:=\s*0\s*)?;/.test(tail)) continue;
    const ret = normalizeType(m[1]);
    const retStr = ret ? ` → ${ret}` : '';
    members.push(`${m[2]}(${normalizeParams(pr.params)})${retStr}`);
  }
  return capWithNotice(members, MEMBER_LIMIT, 'members');
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
