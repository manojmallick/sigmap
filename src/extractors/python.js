'use strict';

const path = require('path');
const { lineAt } = require('./line-anchor');

/**
 * 1-based line of the last source line belonging to a top-level (indent 0)
 * def/class body that starts at `startLine` (1-based). Trailing blank lines
 * are excluded.
 * @param {string[]} srcLines
 * @param {number} startLine
 * @returns {number}
 */
function pyBlockEnd(srcLines, startLine) {
  let end = startLine;
  for (let i = startLine; i < srcLines.length; i++) {
    const line = srcLines[i];
    if (line.trim() === '') continue;
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent === 0) break;
    end = i + 1;
  }
  return end;
}

/**
 * Try to extract signatures using the native Python AST extractor.
 * Returns null if Python3 is unavailable or the script returns empty results.
 * @param {string} filePath - Absolute path to the Python file
 * @returns {string[]|null}
 */
function tryNativeExtract(filePath) {
  try {
    const { execFileSync } = require('child_process');
    const scriptPath = path.join(__dirname, 'python_ast.py');
    const result = execFileSync('python3', [scriptPath, filePath], {
      timeout: 5000,
      encoding: 'utf8',
    });
    const sigs = JSON.parse(result.trim());
    if (Array.isArray(sigs) && sigs.length > 0) return sigs;
  } catch (_) {}
  return null;
}

/**
 * Extract signatures from Python source code.
 * When a real file path is provided, tries the native Python AST extractor first
 * (more accurate for multiline signatures, stacked decorators, and type annotations).
 * Falls back to the regex approach if Python3 is unavailable or returns no results.
 * @param {string} src - Raw file content
 * @param {string} [filePath] - Optional absolute path to the source file
 * @returns {string[]} Array of signature strings
 */
function extract(src, filePath) {
  // Prefer native AST extractor when a real file path is available
  if (filePath && typeof filePath === 'string') {
    const native = tryNativeExtract(filePath);
    if (native) return native;
  }
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // noComments: strip only # comments, keep docstrings (needed for @decorator detection)
  const noComments = src.replace(/#.*$/gm, '');
  // stripped: also strip docstrings (safe for regex matching). Docstrings are
  // blanked newline-by-newline (non-newline chars → spaces) so character
  // offsets and line numbers stay exact for line anchors.
  const stripped = noComments
    .replace(/"""[\s\S]*?"""/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/'''[\s\S]*?'''/g, (m) => m.replace(/[^\n]/g, ' '));
  const srcLines = src.split('\n');

  // Classes
  for (const m of stripped.matchAll(/^class\s+(\w+)(?:\s*\(([^)]*)\))?\s*:/gm)) {
    const className = m[1];
    const baseName = m[2] ? m[2].trim() : '';
    const bodyStart = m.index + m[0].length;
    const clsStart = lineAt(stripped, m.index);
    const clsAnchor = `  :${clsStart}-${pyBlockEnd(srcLines, clsStart)}`;

    // Try @dataclass collapse
    const dcFields = tryExtractDataclassFields(stripped, m.index);
    if (dcFields !== null) {
      sigs.push(`@dataclass ${className}(${dcFields})${clsAnchor}`);
      continue;
    }

    // Try BaseModel/BaseSettings collapse
    if (/(BaseModel|BaseSettings)/.test(baseName)) {
      const bmFields = tryExtractBaseModelFields(stripped, bodyStart);
      if (bmFields) {
        sigs.push(`class ${className}(${baseName}) ${bmFields}${clsAnchor}`);
        continue;
      }
    }

    const baseStr = baseName ? `(${baseName})` : '';
    sigs.push(`class ${className}${baseStr}${clsAnchor}`);

    // Class-level ALL_CAPS constants
    for (const c of extractClassConstants(stripped, bodyStart)) {
      sigs.push(`  ${c}`);
    }

    // Methods
    const methods = extractClassMethods(stripped, bodyStart);
    for (const meth of methods) sigs.push(`  ${meth}`);
  }

  // Top-level functions
  for (const m of stripped.matchAll(/^((?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*[^:]+)?)\s*:/gm)) {
    if (/^_/.test(m[2])) continue;
    const asyncKw = m[1].trimStart().startsWith('async') ? 'async ' : '';
    const params = normalizeParams(m[3]);
    const retType = extractReturnType(m[1] + ':');
    const retStr = retType ? ` → ${retType}` : '';
    const hint = extractDocHint(src, m[2], m[0]);
    const hintStr = hint ? `  # ${hint}` : '';
    const fnStart = lineAt(stripped, m.index);
    const fnAnchor = `  :${fnStart}-${pyBlockEnd(srcLines, fnStart)}`;
    sigs.push(`${asyncKw}def ${m[2]}(${params})${retStr}${fnAnchor}${hintStr}`);
  }

  // FastAPI router endpoints: @router.METHOD("path") + async def name(...)
  const lines = noComments.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const decLine = lines[i].trim();
    const rm = decLine.match(/^@\w+\.(get|post|put|patch|delete|head)\s*\(\s*['"]([^'"]+)['"]/);
    if (!rm) continue;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const fl = lines[j].trim();
      const fm = fl.match(/^(?:async\s+)?def\s+(\w+)/);
      if (fm) { const rs = j + 1; sigs.push(`${rm[1].toUpperCase()} ${rm[2]}  →  ${fm[1]}()  :${rs}-${pyBlockEnd(srcLines, rs)}`); break; }
      if (fl && !fl.startsWith('@') && !fl.startsWith('#')) break;
    }
  }

  return sigs.slice(0, 30);
}

function extractClassMethods(stripped, startIndex) {
  const methods = [];
  const lines = stripped.slice(startIndex).split('\n');
  for (const line of lines) {
    if (line.trim() === '') continue;
    const indent = line.match(/^(\s+)/);
    if (!indent) break;
    const m = line.match(/^\s+(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/);
    if (m) {
      if (m[1].startsWith('__') && m[1] !== '__init__') continue;
      if (m[1].startsWith('_') && !m[1].startsWith('__')) continue;
      const asyncKw = line.trimStart().startsWith('async') ? 'async ' : '';
      const params = normalizeParams(m[2]).replace(/^self,?\s*/, '').replace(/^cls,?\s*/, '');
      const retType = m[3] ? m[3].trim().replace(/Optional\[([^\]]+)\]/, '$1|None').slice(0, 30) : '';
      const retStr = retType ? ` → ${retType}` : '';
      methods.push(`${asyncKw}def ${m[1]}(${params})${retStr}`);
    }
  }
  return methods.slice(0, 8);
}

function tryExtractDataclassFields(stripped, classIndex) {
  const before = stripped.slice(Math.max(0, classIndex - 120), classIndex);
  if (!/@dataclass/.test(before)) return null;
  const lines = stripped.slice(classIndex).split('\n');
  const fields = [];
  for (const line of lines.slice(1)) {
    if (line.trim() === '') continue;
    if (!line.match(/^\s+/)) break;
    const f = line.match(/^\s+(\w+)\s*:\s*([^=\n]+?)(?:\s*=.*)?$/);
    if (!f) break;
    const isOptional = f[2].includes('Optional') || /=\s*None/.test(line);
    fields.push(isOptional ? `${f[1]}?` : f[1]);
  }
  return fields.length ? fields.join(', ') : null;
}

function tryExtractBaseModelFields(stripped, bodyStart) {
  const lines = stripped.slice(bodyStart, bodyStart + 800).split('\n');
  const fields = [];
  let foundFirst = false;
  for (const line of lines) {
    if (line.trim() === '') continue;
    if (foundFirst && !/^\s/.test(line)) break;
    if (!line.match(/^\s{4}\w/)) continue;
    foundFirst = true;
    const f = line.match(/^\s{4}(\w+)\s*(?::\s*([^=\n]+?))?(?:\s*=\s*(.*))?$/);
    if (!f || f[1].startsWith('_') || f[1] === 'class' || f[1] === 'def') continue;
    const isOptional = (f[2] || '').includes('Optional') || f[3] !== undefined;
    fields.push(isOptional ? `${f[1]}?` : `${f[1]}*`);
  }
  return fields.length ? `{${fields.slice(0, 6).join(', ')}}` : null;
}

function extractClassConstants(stripped, startIndex) {
  const lines = stripped.slice(startIndex).split('\n');
  const consts = [];
  for (const line of lines) {
    if (!line.match(/^\s+/)) break;
    const c = line.match(/^\s+([A-Z][A-Z0-9_]{2,})\s*=\s*(.+)/);
    if (!c) continue;
    let val = c[2].trim();
    const items = (val.match(/"([^"]+)"/g) || val.match(/'([^']+)'/g) || []);
    if (items.length > 3) val = `[${items[0].replace(/['"]/g, '')}..${items[items.length - 1].replace(/['"]/g, '')}]`;
    if (val.length > 40) val = val.slice(0, 37) + '...';
    consts.push(`${c[1]}=${val}`);
  }
  return consts.slice(0, 3);
}

function extractReturnType(sigLine) {
  const m = sigLine.match(/->\s*([^:]+):/);
  if (!m) return '';
  let rt = m[1].trim();
  rt = rt.replace(/Optional\[([^\]]+)\]/, '$1|None');
  return rt.length > 30 ? rt.slice(0, 27) + '...' : rt;
}

function normalizeParams(params) {
  if (!params) return '';
  return params.trim()
    .split(',')
    .map((p) => {
      const part = p.trim();
      if (!part) return '';
      const stars = part.match(/^(\*{1,2})/)?.[1] || '';
      const rest = part.slice(stars.length);
      const eqIdx = rest.indexOf('=');
      const noDefault = eqIdx !== -1 ? rest.slice(0, eqIdx).trim() : rest.trim();
      const clean = noDefault
        .replace(/Optional\[([^\]]+)\]/, '$1?')
        .replace(/Union\[([^\]]+),\s*None\]/, '$1?');
      return stars + clean;
    })
    .filter((p) => p && p !== 'self' && p !== 'cls')
    .join(', ');
}

function extractDocHint(src, fnName, fnSigLine) {
  if (!src || !fnName || !fnSigLine) return '';
  const escSig = fnSigLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escSig.replace(/\s+/g, '\\s+')}`, 'm');
  const pos = src.search(re);
  if (pos === -1) return '';
  const afterSig = src.slice(pos + fnSigLine.length, pos + fnSigLine.length + 600);

  // Find first non-empty line after function signature indentation
  const m = afterSig.match(/^\s*\n\s*(?:[rubfRUBF]{0,2})?("""|''')([\s\S]*?)\1/m);
  if (!m) return '';

  const firstLine = m[2]
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!firstLine) return '';

  const sentence = firstLine.split(/[.!?]/)[0].trim();
  return sentence.slice(0, 60);
}

module.exports = { extract, tryNativeExtract };
