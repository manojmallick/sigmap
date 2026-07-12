'use strict';

const { lineAt, withAnchor } = require('./line-anchor');

/**
 * Extract signatures from Rust source code.
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

  // Anchor range for a declaration at declIdx whose header ends at afterIdx:
  // if a `{` body follows, range to its closing brace; else single-line.
  const rangeFor = (declIdx, afterIdx) => {
    let k = afterIdx;
    while (k < stripped.length && /[ \t]/.test(stripped[k])) k++;
    if (stripped[k] === '{') {
      const end = k + 1 + extractBlock(stripped, k + 1).length;
      return [lineAt(stripped, declIdx), lineAt(stripped, end)];
    }
    const line = lineAt(stripped, declIdx);
    return [line, line];
  };

  // Structs
  for (const m of stripped.matchAll(/^pub\s+struct\s+(\w+)(?:<[^{]*>)?/gm)) {
    const [s, e] = rangeFor(m.index, m.index + m[0].length);
    sigs.push(withAnchor(`pub struct ${m[1]}`, s, e));
  }

  // Enums
  for (const m of stripped.matchAll(/^pub\s+enum\s+(\w+)(?:<[^{]*>)?/gm)) {
    const [s, e] = rangeFor(m.index, m.index + m[0].length);
    sigs.push(withAnchor(`pub enum ${m[1]}`, s, e));
  }

  // Traits
  for (const m of stripped.matchAll(/^pub\s+trait\s+(\w+)(?:<[^{]*>)?/gm)) {
    const [s, e] = rangeFor(m.index, m.index + m[0].length);
    sigs.push(withAnchor(`pub trait ${m[1]}`, s, e));
  }

  // impl blocks
  for (const m of stripped.matchAll(/^impl(?:<[^>]*>)?\s+(?:[\w:]+\s+for\s+)?(\w+)(?:<[^{]*>)?\s*\{/gm)) {
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    sigs.push(withAnchor(`impl ${m[1]}`, lineAt(stripped, m.index), lineAt(stripped, bodyStart + block.length)));
    for (const fn of extractMethods(block)) {
      sigs.push(withAnchor(`  ${fn.text}`, lineAt(stripped, bodyStart + fn.declIdx), lineAt(stripped, bodyStart + fn.endIdx)));
    }
  }

  // Top-level pub fns — capture everything after ) up to { or ; for return type
  for (const m of stripped.matchAll(/^pub(?:\s+async)?\s+fn\s+(\w+)(?:<[^(]*>)?\s*\(([^)]*)\)([^{;]*)/gm)) {
    const asyncKw = m[0].includes('async') ? 'async ' : '';
    const retStr = extractReturnType(m[3]);
    const [s, e] = rangeFor(m.index, m.index + m[0].length);
    sigs.push(withAnchor(`pub ${asyncKw}fn ${m[1]}(${normalizeParams(m[2])})${retStr}`, s, e));
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

function extractMethods(block) {
  const methods = [];
  for (const m of block.matchAll(/^\s+pub(?:\s+async)?\s+fn\s+(\w+)(?:<[^(]*>)?\s*\(([^)]*)\)([^{;]*)/gm)) {
    const asyncKw = m[0].includes('async') ? 'async ' : '';
    const retStr = extractReturnType(m[3]);
    methods.push({
      text: `pub ${asyncKw}fn ${m[1]}(${normalizeParams(m[2])})${retStr}`,
      declIdx: m.index + (m[0].length - m[0].trimStart().length),
      endIdx: m.index + m[0].length,
    });
  }
  return methods.slice(0, 8);
}

function normalizeParams(params) {
  if (!params) return '';
  return params.trim().replace(/\s+/g, ' ');
}

function extractReturnType(afterParen) {
  if (!afterParen) return '';
  const m = afterParen.match(/->\s*([^{;]+)/);
  if (!m) return '';
  const rt = m[1].trim().replace(/\s+/g, ' ');
  return ` → ${rt.length > 30 ? rt.slice(0, 27) + '...' : rt}`;
}

module.exports = { extract };
