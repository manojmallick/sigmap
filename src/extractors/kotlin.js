'use strict';

const { lineAt, withAnchor } = require('./line-anchor');
const { capWithNotice, capMembersWithNotice } = require('../util/truncate');

// Ceilings sit above the default `maxSigsPerFile` so the configured budget
// governs output rather than a literal buried here, and omissions are disclosed
// — an undisclosed cap looks like a class that simply has eight methods (#576).
const MEMBER_LIMIT = 120;
const PER_FILE_LIMIT = 200;

/**
 * Extract signatures from Kotlin source code.
 * Signatures carry `:start-end` line anchors (Surgical Context); the comment
 * strip below is newline-preserving so anchor lines match the original file.
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  const stripped = src
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '));

  // Anchor range: scan past same-line modifiers to a body `{` (range) else single line.
  const rangeFor = (declIdx, afterIdx) => {
    let k = afterIdx;
    while (k < stripped.length && /[ \tA-Za-z0-9_]/.test(stripped[k])) k++;
    if (stripped[k] === '{') {
      const end = k + 1 + extractBlock(stripped, k + 1).length;
      return [lineAt(stripped, declIdx), lineAt(stripped, end)];
    }
    const line = lineAt(stripped, declIdx);
    return [line, line];
  };

  // Classes, objects, interfaces
  for (const m of stripped.matchAll(/^(?:public\s+|internal\s+)?(?:data\s+|sealed\s+|abstract\s+|open\s+)?(class|object|interface)\s+(\w+)(?:[^{]*)\{/gm)) {
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    sigs.push(withAnchor(`${m[1]} ${m[2]}`, lineAt(stripped, m.index), lineAt(stripped, bodyStart + block.length)));
    for (const meth of extractMembers(block)) {
      // The disclosure marker carries no offsets; anchor it at the class body.
      sigs.push(withAnchor(`  ${meth.text}`, lineAt(stripped, bodyStart + (meth.declIdx || 0)), lineAt(stripped, bodyStart + (meth.endIdx || 0))));
    }
  }

  // Top-level functions — capture `: RetType` after params
  for (const m of stripped.matchAll(/^(?:public\s+|internal\s+)?(?:suspend\s+)?fun\s+(\w+)\s*(?:<[^(]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^\n{=]+))?/gm)) {
    const suspend = m[0].includes('suspend') ? 'suspend ' : '';
    const retType = m[3] ? m[3].trim().replace(/\s+/g, ' ') : '';
    const retStr = retType ? ` → ${retType.slice(0, 25)}` : '';
    const [s, e] = rangeFor(m.index, m.index + m[0].length);
    sigs.push(withAnchor(`${suspend}fun ${m[1]}(${normalizeParams(m[2])})${retStr}`, s, e));
  }

  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

function extractBlock(src, startIndex) {
  let depth = 1, i = startIndex;
  const end = Math.min(src.length, startIndex + 4000);
  while (i < end && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(startIndex, i - 1);
}

function extractMembers(block) {
  const members = [];
  for (const m of block.matchAll(/^\s+(?:public\s+|internal\s+|override\s+)?(?:suspend\s+)?fun\s+(\w+)\s*(?:<[^(]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^\n{=]+))?/gm)) {
    if (m[1].startsWith('_')) continue;
    const suspend = m[0].includes('suspend') ? 'suspend ' : '';
    const retType = m[3] ? m[3].trim().replace(/\s+/g, ' ') : '';
    const retStr = retType ? ` → ${retType.slice(0, 25)}` : '';
    members.push({
      text: `${suspend}fun ${m[1]}(${normalizeParams(m[2])})${retStr}`,
      declIdx: m.index + (m[0].length - m[0].trimStart().length),
      endIdx: m.index + m[0].length,
    });
  }
  return capMembersWithNotice(members, MEMBER_LIMIT);
}

function normalizeParams(params) {
  if (!params) return '';
  return params.trim()
    .split(',')
    .map((p) => p.trim().split(':')[0].trim())
    .filter(Boolean)
    .join(', ');
}

module.exports = { extract };
