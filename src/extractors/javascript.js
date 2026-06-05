'use strict';

const { lineAt, withAnchor } = require('./line-anchor');

/**
 * Extract signatures from JavaScript source code.
 * Top-level declarations and class members carry a `:start-end` line anchor
 * (see line-anchor.js); kept parallel to `sigs` and applied once at return.
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];
  const anchors = [];
  const returnHints = buildReturnHints(src);

  // Block comments are blanked newline-by-newline (non-newline chars → spaces)
  // so character offsets AND line numbers stay exact for anchors.
  const stripped = src
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

  const blockEndIdx = (bodyStart) => bodyStart + extractBlock(stripped, bodyStart).length;
  // End line for a function whose match ends at `matchEnd` (before its body brace).
  const fnEndLine = (matchEnd, startLn) => {
    const brace = stripped.indexOf('{', matchEnd);
    return brace !== -1 ? lineAt(stripped, blockEndIdx(brace + 1)) : startLn;
  };

  // Classes
  const classRegex = /^(export\s+(?:default\s+)?)?class\s+(\w+)(?:\s+extends\s+[\w.]+)?\s*\{/gm;
  for (const m of stripped.matchAll(classRegex)) {
    const prefix = m[1] ? m[1].trim() + ' ' : '';
    const bodyStart = m.index + m[0].length;
    sigs.push(`${prefix}class ${m[2]}`);
    anchors.push([lineAt(stripped, m.index), lineAt(stripped, blockEndIdx(bodyStart))]);
    const block = extractBlock(stripped, bodyStart);
    for (const meth of extractClassMembers(block, returnHints)) {
      sigs.push(`  ${meth.text}`);
      anchors.push([lineAt(stripped, bodyStart + meth.start), lineAt(stripped, bodyStart + meth.end)]);
    }
  }

  // Exported named functions
  for (const m of stripped.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm)) {
    const asyncKw = /export\s+async/.test(m[0]) ? 'async ' : '';
    const retStr = formatReturnHint(returnHints.get(m[1]));
    const startLn = lineAt(stripped, m.index);
    sigs.push(`export ${asyncKw}function ${m[1]}(${normalizeParams(m[2])})${retStr}`);
    anchors.push([startLn, fnEndLine(m.index + m[0].length, startLn)]);
  }

  // Exported arrow functions
  for (const m of stripped.matchAll(/^export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/gm)) {
    const asyncKw = m[0].includes('async') ? 'async ' : '';
    const retStr = formatReturnHint(returnHints.get(m[1]));
    const startLn = lineAt(stripped, m.index);
    sigs.push(`export const ${m[1]} = ${asyncKw}(${normalizeParams(m[2])}) =>${retStr}`);
    anchors.push([startLn, fnEndLine(m.index + m[0].length, startLn)]);
  }

  // module.exports = { ... }
  const moduleExports = stripped.match(/^module\.exports\s*=\s*\{([^}]+)\}/m);
  if (moduleExports) {
    const names = moduleExports[1].split(',').map((s) => s.trim()).filter(Boolean);
    if (names.length > 0) {
      const startLn = lineAt(stripped, moduleExports.index);
      sigs.push(`module.exports = { ${names.join(', ')} }`);
      anchors.push([startLn, lineAt(stripped, moduleExports.index + moduleExports[0].length)]);
    }
  }

  // Top-level named functions (non-exported)
  for (const m of stripped.matchAll(/^(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm)) {
    const asyncKw = m[0].startsWith('async') ? 'async ' : '';
    const retStr = formatReturnHint(returnHints.get(m[1]));
    const startLn = lineAt(stripped, m.index);
    sigs.push(`${asyncKw}function ${m[1]}(${normalizeParams(m[2])})${retStr}`);
    anchors.push([startLn, fnEndLine(m.index + m[0].length, startLn)]);
  }

  return sigs
    .map((s, i) => (anchors[i] ? withAnchor(s, anchors[i][0], anchors[i][1]) : s))
    .slice(0, 25);
}

function extractBlock(src, startIndex) {
  let depth = 1;
  let i = startIndex;
  const end = Math.min(src.length, startIndex + 4000);
  while (i < end && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(startIndex, i - 1);
}

// Returns members as { text, start, end } where start/end are char offsets
// WITHIN `block` (end = the method's closing brace), so the caller can resolve
// per-method line anchors that span the method body.
function extractClassMembers(block, returnHints) {
  const members = [];
  for (const m of block.matchAll(/^\s+(?:static\s+|async\s+|get\s+|set\s+)*(\w+)\s*\(([^)]*)\)\s*\{/gm)) {
    if (/^_/.test(m[1])) continue;
    const bodyStart = m.index + m[0].length; // just past the opening brace
    const end = bodyStart + extractBlock(block, bodyStart).length;
    const start = m.index + (m[0].length - m[0].replace(/^\s+/, '').length);
    if (m[1] === 'constructor') { members.push({ text: `constructor(${normalizeParams(m[2])})`, start, end }); continue; }
    const isAsync = m[0].includes('async ') ? 'async ' : '';
    const isStatic = m[0].includes('static ') ? 'static ' : '';
    const retStr = formatReturnHint(returnHints.get(m[1]));
    members.push({ text: `${isStatic}${isAsync}${m[1]}(${normalizeParams(m[2])})${retStr}`, start, end });
  }
  return members.slice(0, 8);
}

function buildReturnHints(src) {
  const hints = new Map();
  for (const m of src.matchAll(/\/\*\*[\s\S]*?@returns?\s+\{([^}]+)\}[\s\S]*?\*\/\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g)) {
    hints.set(m[2], normalizeType(m[1]));
  }
  for (const m of src.matchAll(/\/\*\*[\s\S]*?@returns?\s+\{([^}]+)\}[\s\S]*?\*\/\s*export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/g)) {
    hints.set(m[2], normalizeType(m[1]));
  }
  for (const m of src.matchAll(/\/\*\*[\s\S]*?@returns?\s+\{([^}]+)\}[\s\S]*?\*\/\s*(?:static\s+|async\s+|get\s+|set\s+)*(\w+)\s*\(/g)) {
    hints.set(m[2], normalizeType(m[1]));
  }
  return hints;
}

function normalizeType(type) {
  if (!type) return '';
  return type.trim().replace(/\s+/g, ' ').slice(0, 25);
}

function formatReturnHint(type) {
  return type ? ` → ${type}` : '';
}

function normalizeParams(params) {
  if (!params) return '';
  return params.trim().replace(/\s+/g, ' ');
}

module.exports = { extract };
