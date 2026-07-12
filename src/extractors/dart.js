'use strict';

const { lineAt, withAnchor } = require('./line-anchor');

/**
 * Extract signatures from Dart source code.
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

  // Anchor range: scan past same-line trivia (`async`, `=>` stops) to a body `{`.
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

  // Classes and abstract classes
  for (const m of stripped.matchAll(/^(?:abstract\s+)?class\s+(\w+)(?:<[^{]*>)?(?:\s+extends\s+[\w<>, ]+)?(?:\s+(?:implements|with|on)\s+[\w<>, ]+)?\s*\{/gm)) {
    const abs = m[0].trimStart().startsWith('abstract') ? 'abstract ' : '';
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    sigs.push(withAnchor(`${abs}class ${m[1]}`, lineAt(stripped, m.index), lineAt(stripped, bodyStart + block.length)));
    for (const meth of extractMembers(block)) {
      sigs.push(withAnchor(`  ${meth.text}`, lineAt(stripped, bodyStart + meth.declIdx), lineAt(stripped, bodyStart + meth.endIdx)));
    }
  }

  // Top-level functions — capture return type (prefix before name) and show as suffix
  for (const m of stripped.matchAll(/^((?:Future<[\w<>?,\s]*>|[\w<>?]+))\s+(\w+)\s*\(([^)]*)\)/gm)) {
    if (m[2].startsWith('_')) continue;
    const retStr = (m[1] && m[1] !== 'void') ? ` → ${m[1].replace(/\s+/g, '').slice(0, 25)}` : '';
    const [s, e] = rangeFor(m.index, m.index + m[0].length);
    sigs.push(withAnchor(`${m[2]}(${normalizeParams(m[3])})${retStr}`, s, e));
  }

  return sigs.slice(0, 25);
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
  for (const m of block.matchAll(/^\s+(?:@override\s+)?(?:@\w+\s+)*((?:Future<[\w<>?,\s]*>|[\w<>?]+))\s+(\w+)\s*\(([^)]*)\)/gm)) {
    if (m[2].startsWith('_')) continue;
    const retStr = (m[1] && m[1] !== 'void') ? ` → ${m[1].replace(/\s+/g, '').slice(0, 25)}` : '';
    members.push({
      text: `${m[2]}(${normalizeParams(m[3])})${retStr}`,
      declIdx: m.index + (m[0].length - m[0].trimStart().length),
      endIdx: m.index + m[0].length,
    });
  }
  return members.slice(0, 8);
}

function normalizeParams(params) {
  if (!params) return '';
  return params.trim().replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
}

module.exports = { extract };
