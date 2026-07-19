'use strict';

const { lineAt, withAnchor } = require('./line-anchor');

/**
 * Extract signatures from Go source code.
 * Signatures carry `:start-end` line anchors (Surgical Context); the comment
 * strip below is newline-preserving so anchor lines match the original file.
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];
  const docHints = buildDocHints(src);
  // Append the godoc hint after the anchor as `  # <hint>` — same convention
  // as the Python/JS extractors' doc hints.
  const hinted = (sig, name) => (docHints.has(name) ? `${sig}  # ${docHints.get(name)}` : sig);

  const stripped = src
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '));

  // Index of the closing brace for a block opened just before startIndex.
  const blockEndIdx = (startIndex) => startIndex + extractBlock(stripped, startIndex).length;

  // Structs
  for (const m of stripped.matchAll(/^type\s+(\w+)\s+struct\s*\{/gm)) {
    const end = blockEndIdx(m.index + m[0].length);
    sigs.push(hinted(withAnchor(`type ${m[1]} struct`, lineAt(stripped, m.index), lineAt(stripped, end)), m[1]));
  }

  // Interfaces
  for (const m of stripped.matchAll(/^type\s+(\w+)\s+interface\s*\{/gm)) {
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    sigs.push(hinted(withAnchor(`type ${m[1]} interface`, lineAt(stripped, m.index), lineAt(stripped, bodyStart + block.length)), m[1]));
    for (const meth of extractInterfaceMethods(block)) {
      sigs.push(withAnchor(`  ${meth.text}`, lineAt(stripped, bodyStart + meth.declIdx), lineAt(stripped, bodyStart + meth.endIdx)));
    }
  }

  // Functions and methods — capture return type between ) and {
  for (const m of stripped.matchAll(/^func\s+(?:\((\w+)\s+[\w*]+\)\s+)?(\w+)\s*\(([^)]*)\)([^{]*)\{/gm)) {
    const receiver = m[1] ? `(${m[1]}) ` : '';
    const retType = m[4] ? m[4].trim().replace(/\s+/g, ' ') : '';
    const retStr = retType ? ` → ${retType.slice(0, 30)}` : '';
    const end = blockEndIdx(m.index + m[0].length);
    sigs.push(hinted(withAnchor(`func ${receiver}${m[2]}(${normalizeParams(m[3])})${retStr}`, lineAt(stripped, m.index), lineAt(stripped, end)), m[2]));
  }

  return sigs.slice(0, 25);
}

function extractBlock(src, startIndex) {
  let depth = 1, i = startIndex;
  const end = Math.min(src.length, startIndex + 2000);
  while (i < end && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(startIndex, i - 1);
}

function extractInterfaceMethods(block) {
  const methods = [];
  for (const m of block.matchAll(/^\s+(\w+)\s*\(([^)]*)\)([^\n]*)/gm)) {
    const retType = m[3] ? m[3].trim().replace(/\s+/g, ' ') : '';
    const retStr = retType ? ` → ${retType.slice(0, 30)}` : '';
    methods.push({
      text: `${m[1]}(${normalizeParams(m[2])})${retStr}`,
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

// Godoc: the `//` comment block directly above a top-level func/type/method
// declaration → first prose sentence, 60-char cap. Runs on the ORIGINAL src
// (extract strips comments before matching). Compiler directives (`//go:...`)
// carry no prose and are skipped.
function buildDocHints(src) {
  const hints = new Map();
  const re = /((?:^\/\/[^\n]*\n)+)(?:func\s+(?:\(\w+\s+[\w*]+\)\s+)?(\w+)\s*\(|type\s+(\w+)\s+(?:struct|interface)\b)/gm;
  for (const m of src.matchAll(re)) {
    const name = m[2] || m[3];
    const hint = firstDocSentence(m[1]);
    if (hint && !hints.has(name)) hints.set(name, hint);
  }
  return hints;
}

// First non-directive prose line of a `//` block → first sentence, 60-char cap.
function firstDocSentence(block) {
  const line = String(block).split('\n')
    .map((l) => l.replace(/^\/\/\s?/, '').trim())
    .find((l) => l && !l.startsWith('go:') && !l.startsWith('nolint'));
  if (!line) return '';
  return line.split(/[.!?]/)[0].trim().slice(0, 60);
}

module.exports = { extract };
