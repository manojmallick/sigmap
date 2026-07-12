'use strict';

const { lineAt, withAnchor } = require('./line-anchor');

/**
 * Extract signatures from Scala source code.
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

  // Classes, traits, objects
  const typeRe = /^(?:case\s+)?(?:class|trait|object)\s+(\w+)(?:\[[\w, ]+\])?(?:[^{]*)\{/gm;
  for (const m of stripped.matchAll(typeRe)) {
    const kind = m[0].trimStart().startsWith('case class') ? 'case class' :
      m[0].trimStart().startsWith('trait') ? 'trait' :
      m[0].trimStart().startsWith('object') ? 'object' : 'class';
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    sigs.push(withAnchor(`${kind} ${m[1]}`, lineAt(stripped, m.index), lineAt(stripped, bodyStart + block.length)));
    for (const fn of extractMembers(block)) {
      sigs.push(withAnchor(`  ${fn.text}`, lineAt(stripped, bodyStart + fn.declIdx), lineAt(stripped, bodyStart + fn.endIdx)));
    }
  }

  // Top-level defs
  for (const m of stripped.matchAll(/^def\s+(\w+)(?:\[[\w, ]+\])?\s*(?:\(([^)]*)\))?(?:\s*:\s*([^=\n{]+))?/gm)) {
    if (m[1].startsWith('_')) continue;
    const params = m[2] ? `(${normalizeParams(m[2])})` : '';
    const ret = normalizeType(m[3]);
    const retStr = ret ? ` → ${ret}` : '';
    const line = lineAt(stripped, m.index);
    sigs.push(withAnchor(`def ${m[1]}${params}${retStr}`, line, line));
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
  for (const m of block.matchAll(/^\s+def\s+(\w+)(?:\[[\w, ]+\])?\s*(?:\(([^)]*)\))?(?:\s*:\s*([^=\n{]+))?/gm)) {
    if (m[1].startsWith('_')) continue;
    const params = m[2] ? `(${normalizeParams(m[2])})` : '';
    const ret = normalizeType(m[3]);
    const retStr = ret ? ` → ${ret}` : '';
    members.push({
      text: `def ${m[1]}${params}${retStr}`,
      declIdx: m.index + (m[0].length - m[0].trimStart().length),
      endIdx: m.index + m[0].length,
    });
  }
  return members.slice(0, 8);
}

function normalizeParams(params) {
  if (!params) return '';
  return params.trim()
    .split(',')
    .map((p) => p.trim().split(':')[0].trim())
    .filter(Boolean)
    .join(', ');
}

function normalizeType(type) {
  if (!type) return '';
  return type.trim().replace(/\s+/g, ' ').slice(0, 25);
}

module.exports = { extract };
