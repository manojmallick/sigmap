'use strict';

const { lineAt, withAnchor } = require('./line-anchor');

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

  const stripped = src
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '));

  // Classes and interfaces
  const typeRe = /^\s*(?:public\s+|internal\s+|protected\s+)?(?:abstract\s+|sealed\s+|static\s+)?(class|interface|enum|record|struct)\s+(\w+)(?:<[^{]*>)?(?:\s*:\s*[\w<>, .]+)?\s*\{/gm;
  for (const m of stripped.matchAll(typeRe)) {
    const declIdx = m.index + (m[0].length - m[0].trimStart().length);
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    sigs.push(withAnchor(`${m[1]} ${m[2]}`, lineAt(stripped, declIdx), lineAt(stripped, bodyStart + block.length)));
    for (const meth of extractMembers(block)) {
      sigs.push(withAnchor(`  ${meth.text}`, lineAt(stripped, bodyStart + meth.declIdx), lineAt(stripped, bodyStart + meth.endIdx)));
    }
  }

  return sigs.slice(0, 25);
}

function extractBlock(src, startIndex) {
  let depth = 1, i = startIndex;
  const end = Math.min(src.length, startIndex + 5000);
  while (i < end && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(startIndex, i - 1);
}

function extractMembers(block) {
  const members = [];
  const methodRe = /^\s+(?:public|internal|protected)\s+(?:static\s+|virtual\s+|override\s+|async\s+)*(?:where\s+\w+\s*:\s*[^\n]+\s+)?([\w<>\[\]?., ]+)\s+(\w+)\s*\(([^)]*)\)/gm;
  for (const m of block.matchAll(methodRe)) {
    const ret = normalizeType(m[1]);
    const retStr = ret ? ` → ${ret}` : '';
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
  return params.trim().replace(/\s+/g, ' ');
}

function normalizeType(type) {
  if (!type) return '';
  return type.trim().replace(/\s+/g, ' ').slice(0, 30);
}

module.exports = { extract };
