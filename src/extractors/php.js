'use strict';

const { lineAt, withAnchor } = require('./line-anchor');

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

  const stripped = src
    .replace(/\/\/.*$/gm, '')
    .replace(/#.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '));

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

  // Classes and interfaces
  const typeRe = /^(?:abstract\s+)?(?:class|interface|trait)\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w, ]+)?\s*\{/gm;
  for (const m of stripped.matchAll(typeRe)) {
    const kind = m[0].trimStart().startsWith('interface') ? 'interface' :
      m[0].trimStart().startsWith('trait') ? 'trait' : 'class';
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    sigs.push(withAnchor(`${kind} ${m[1]}`, lineAt(stripped, m.index), lineAt(stripped, bodyStart + block.length)));
    for (const meth of extractMembers(block)) {
      sigs.push(withAnchor(`  ${meth.text}`, lineAt(stripped, bodyStart + meth.declIdx), lineAt(stripped, bodyStart + meth.endIdx)));
    }
  }

  // Top-level functions
  for (const m of stripped.matchAll(/^function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^\n{]+))?/gm)) {
    const ret = normalizeType(m[3]);
    const retStr = ret ? ` → ${ret}` : '';
    const [s, e] = rangeFor(m.index, m.index + m[0].length);
    sigs.push(withAnchor(`function ${m[1]}(${normalizeParams(m[2])})${retStr}`, s, e));
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
  const methodRe = /^\s+(?:public|protected)\s+(?:static\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^\n{]+))?/gm;
  for (const m of block.matchAll(methodRe)) {
    if (m[1].startsWith('_')) continue;
    const isStatic = m[0].includes('static ') ? 'static ' : '';
    const ret = normalizeType(m[3]);
    const retStr = ret ? ` → ${ret}` : '';
    members.push({
      text: `${isStatic}function ${m[1]}(${normalizeParams(m[2])})${retStr}`,
      declIdx: m.index + (m[0].length - m[0].trimStart().length),
      endIdx: m.index + m[0].length,
    });
  }
  return members.slice(0, 8);
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
