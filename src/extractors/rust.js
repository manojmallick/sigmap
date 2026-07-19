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
  const docHints = buildDocHints(src);
  // Append the doc-comment hint after the anchor as `  # <hint>` — same
  // convention as the Python/JS extractors' doc hints.
  const hinted = (sig, name) => (docHints.has(name) ? `${sig}  # ${docHints.get(name)}` : sig);

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
    sigs.push(hinted(withAnchor(`pub struct ${m[1]}`, s, e), m[1]));
  }

  // Enums
  for (const m of stripped.matchAll(/^pub\s+enum\s+(\w+)(?:<[^{]*>)?/gm)) {
    const [s, e] = rangeFor(m.index, m.index + m[0].length);
    sigs.push(hinted(withAnchor(`pub enum ${m[1]}`, s, e), m[1]));
  }

  // Traits
  for (const m of stripped.matchAll(/^pub\s+trait\s+(\w+)(?:<[^{]*>)?/gm)) {
    const [s, e] = rangeFor(m.index, m.index + m[0].length);
    sigs.push(hinted(withAnchor(`pub trait ${m[1]}`, s, e), m[1]));
  }

  // impl blocks
  for (const m of stripped.matchAll(/^impl(?:<[^>]*>)?\s+(?:[\w:]+\s+for\s+)?(\w+)(?:<[^{]*>)?\s*\{/gm)) {
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    sigs.push(withAnchor(`impl ${m[1]}`, lineAt(stripped, m.index), lineAt(stripped, bodyStart + block.length)));
    for (const fn of extractMethods(block)) {
      sigs.push(hinted(withAnchor(`  ${fn.text}`, lineAt(stripped, bodyStart + fn.declIdx), lineAt(stripped, bodyStart + fn.endIdx)), fn.name));
    }
  }

  // Top-level pub fns — capture everything after ) up to { or ; for return type
  for (const m of stripped.matchAll(/^pub(?:\s+async)?\s+fn\s+(\w+)(?:<[^(]*>)?\s*\(([^)]*)\)([^{;]*)/gm)) {
    const asyncKw = m[0].includes('async') ? 'async ' : '';
    const retStr = extractReturnType(m[3]);
    const [s, e] = rangeFor(m.index, m.index + m[0].length);
    sigs.push(hinted(withAnchor(`pub ${asyncKw}fn ${m[1]}(${normalizeParams(m[2])})${retStr}`, s, e), m[1]));
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
      name: m[1],
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

// Rustdoc: the `///` block directly above a declaration → first prose
// sentence, 60-char cap. Runs on the ORIGINAL src (extract strips comments
// before matching). Attribute lines (`#[...]`) between the doc block and the
// declaration are tolerated.
function buildDocHints(src) {
  const hints = new Map();
  const re = /((?:^[ \t]*\/\/\/[^\n]*\n)+)(?:[ \t]*#\[[^\n]*\n)*[ \t]*pub(?:\s+async)?\s+(?:fn|struct|enum|trait)\s+(\w+)/gm;
  for (const m of src.matchAll(re)) {
    const hint = firstDocSentence(m[1]);
    if (hint && !hints.has(m[2])) hints.set(m[2], hint);
  }
  return hints;
}

// First prose line of a `///` block → first sentence, 60-char cap.
function firstDocSentence(block) {
  const line = String(block).split('\n')
    .map((l) => l.replace(/^[ \t]*\/\/\/\s?/, '').trim())
    .find((l) => l);
  if (!line) return '';
  return line.split(/[.!?]/)[0].trim().slice(0, 60);
}

module.exports = { extract };
