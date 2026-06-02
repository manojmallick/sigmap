'use strict';

const { lineAt, withAnchor } = require('./line-anchor');

/**
 * Extract signatures from TypeScript source code.
 * Top-level declarations carry a `:start-end` line anchor (see line-anchor.js);
 * indented members do not.
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];
  // anchors[i] is [start, end] for a top-level sig, or null for an indented member.
  // Kept parallel to `sigs` so existing push/mutation logic stays untouched;
  // anchors are applied once at return.
  const anchors = [];

  // Strip comments to simplify matching. Block comments are blanked
  // newline-by-newline (non-newline chars → spaces) so character offsets AND
  // line numbers stay exact. Line comments preserve their trailing newline.
  const stripped = src
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

  // Index of the closing brace for a block whose body starts at bodyStart.
  const blockEndIdx = (bodyStart) => bodyStart + extractBlock(stripped, bodyStart).length;

  // Exported interfaces
  for (const m of stripped.matchAll(/^export\s+interface\s+(\w+)(?:<[^{]*>)?\s*(?:extends\s+[^{]+)?\{/gm)) {
    const bodyStart = m.index + m[0].length;
    sigs.push(`export interface ${m[1]}`);
    anchors.push([lineAt(stripped, m.index), lineAt(stripped, blockEndIdx(bodyStart))]);
    // Collect members
    const block = extractBlock(stripped, bodyStart);
    const members = extractInterfaceMembers(block);
    for (const mem of members) { sigs.push(`  ${mem}`); anchors.push(null); }
  }

  // Exported type aliases
  for (const m of stripped.matchAll(/^export\s+type\s+(\w+)(?:<[^=]*>)?\s*=/gm)) {
    sigs.push(`export type ${m[1]}`);
    anchors.push([lineAt(stripped, m.index), lineAt(stripped, m.index + m[0].length)]);
  }

  // Exported enums
  for (const m of stripped.matchAll(/^export\s+(?:const\s+)?enum\s+(\w+)\s*\{/gm)) {
    const bodyStart = m.index + m[0].length;
    sigs.push(`export enum ${m[1]}`);
    anchors.push([lineAt(stripped, m.index), lineAt(stripped, blockEndIdx(bodyStart))]);
  }

  // Classes (exported and internal)
  const classRegex = /^(export\s+)?(abstract\s+)?class\s+(\w+)(?:<[^{]*>)?(?:\s+extends\s+[\w<>, .]+)?(?:\s+implements\s+[\w<> ,]+)?\s*\{/gm;
  for (const m of stripped.matchAll(classRegex)) {
    const prefix = m[1] ? 'export ' : '';
    const abs = m[2] ? 'abstract ' : '';
    const bodyStart = m.index + m[0].length;
    sigs.push(`${prefix}${abs}class ${m[3]}`);
    anchors.push([lineAt(stripped, m.index), lineAt(stripped, blockEndIdx(bodyStart))]);
    const block = extractBlock(stripped, bodyStart);
    const methods = extractClassMembers(block);
    for (const meth of methods) { sigs.push(`  ${meth}`); anchors.push(null); }
  }

  // Exported top-level functions (not methods)
  for (const m of stripped.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^(]*>)?\s*\(([^)]*)\)(?:\s*:\s*[^{]+)?\s*\{/gm)) {
    const asyncKw = /export\s+async/.test(m[0]) ? 'async ' : '';
    const params = normalizeParams(m[2]);
    const retMatch = m[0].match(/\)\s*:\s*([^{]+)\s*\{/);
    const retType = retMatch ? retMatch[1].trim().replace(/\s+/g, ' ').slice(0, 30) : '';
    const retStr = retType ? ` → ${retType}` : '';
    const bodyStart = m.index + m[0].length;
    sigs.push(`export ${asyncKw}function ${m[1]}(${params})${retStr}`);
    anchors.push([lineAt(stripped, m.index), lineAt(stripped, blockEndIdx(bodyStart))]);

    // Hooks: capture compact return object shape for use* functions.
    if (m[1].startsWith('use')) {
      const body = stripped.slice(bodyStart, bodyStart + 800);
      const ret = body.match(/return\s*\{([^}]{1,260})\}/);
      if (ret) {
        const keys = ret[1]
          .split(',')
          .map((s) => s.trim().split(':')[0].split('(')[0].trim())
          .filter(Boolean)
          .slice(0, 8);
        if (keys.length) {
          sigs[sigs.length - 1] += ` → { ${keys.join(', ')} }`;
        }
      }
    }
  }

  // Exported arrow functions / const functions
  for (const m of stripped.matchAll(/^export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*[^=>{]+)?\s*=>/gm)) {
    const asyncKw = /=\s*async\s+/.test(m[0]) ? 'async ' : '';
    const params = normalizeParams(m[2]);
    sigs.push(`export const ${m[1]} = ${asyncKw}(${params}) =>`);
    const bodyStart = stripped.indexOf('{', m.index + m[0].length);
    const endLn = bodyStart !== -1
      ? lineAt(stripped, blockEndIdx(bodyStart + 1))
      : lineAt(stripped, m.index + m[0].length);
    anchors.push([lineAt(stripped, m.index), endLn]);

    // Hooks: capture compact return object shape for use* functions.
    if (m[1].startsWith('use')) {
      if (bodyStart !== -1) {
        const body = stripped.slice(bodyStart, bodyStart + 800);
        const ret = body.match(/return\s*\{([^}]{1,260})\}/);
        if (ret) {
          const keys = ret[1]
            .split(',')
            .map((s) => s.trim().split(':')[0].split('(')[0].trim())
            .filter(Boolean)
            .slice(0, 8);
          if (keys.length) {
            sigs[sigs.length - 1] += ` → { ${keys.join(', ')} }`;
          }
        }
      }
    }
  }

  // Zustand stores: export const useXxxStore = create<State>()(...)
  for (const m of stripped.matchAll(/^export\s+const\s+(use\w+Store)\s*=\s*create(?:<[^>]*>)?\s*\(/gm)) {
    const stateType = m[0].match(/create<([\w]+)>/)?.[1] || '';
    const startLn = lineAt(stripped, m.index);
    sigs.push(`export const ${m[1]} = create<${stateType}>(...)`);
    anchors.push([startLn, startLn]);
    const ifaceRe = new RegExp(`interface\\s+${stateType}\\s*\\{([\\s\\S]*?)\\}`);
    const ifm = stripped.match(ifaceRe);
    if (ifm) {
      for (const fm of ifm[1].matchAll(/^\s+(\w+)\s*(?:\([^)]*\))?\s*:/gm)) { sigs.push(`  ${fm[1]}`); anchors.push(null); }
    }
  }

  // API client objects: const xxxApi = { method: async () => {} }
  for (const m of stripped.matchAll(/^(?:export\s+default\s+|const\s+)(\w*[Aa]pi\w*)\s*=\s*\{/gm)) {
    const bodyStart = m.index + m[0].length;
    const block = extractBlock(stripped, bodyStart);
    const methods = [...block.matchAll(/^\s+(\w+)\s*:\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>/gm)].map(mm => mm[1]);
    if (methods.length) {
      sigs.push(`${m[1]}: { ${methods.join(', ')} }`);
      anchors.push([lineAt(stripped, m.index), lineAt(stripped, bodyStart + block.length)]);
    }
  }

  return sigs
    .map((s, i) => (anchors[i] ? withAnchor(s, anchors[i][0], anchors[i][1]) : s))
    .slice(0, 35);
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

function extractInterfaceMembers(block) {
  const members = [];
  for (const m of block.matchAll(/^\s+(readonly\s+)?(\w+)(\??):\s*([^;]+);/gm)) {
    const readonly = m[1] ? 'readonly ' : '';
    const optional = m[3] ? '?' : '';
    const typeStr = m[4].trim().replace(/\s+/g, ' ').slice(0, 35);
    members.push(`${readonly}${m[2]}${optional}: ${typeStr}`);
  }
  for (const m of block.matchAll(/^\s+(\w+)\s*(?:<[^(]*>)?\s*\(([^)]*)\)\s*:/gm)) {
    members.push(`${m[1]}(${normalizeParams(m[2])})`);
  }
  return members.slice(0, 8);
}

const _CTRL_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'do', 'try', 'catch', 'finally', 'else', 'return']);

function extractClassMembers(block) {
  const members = [];
  // Public methods (skip private/protected/_ prefixed and control-flow keywords)
  const methodRe = /^\s+(?:public\s+|static\s+|async\s+|override\s+)*(\w+)\s*(?:<[^(]*>)?\s*\(([^)]*)\)(?:\s*:\s*[^{;]+)?\s*\{/gm;
  for (const m of block.matchAll(methodRe)) {
    if (_CTRL_KEYWORDS.has(m[1])) continue;
    if (/^(private|protected|_)/.test(m[1])) continue;
    if (m[1] === 'constructor') { members.push(`constructor(${normalizeParams(m[2])})`); continue; }
    const isAsync = m[0].includes('async ') ? 'async ' : '';
    const isStatic = m[0].includes('static ') ? 'static ' : '';
    const retMatch = m[0].match(/\)\s*:\s*([^{;]+)\s*\{/);
    const retType = retMatch ? retMatch[1].trim().replace(/\s+/g, ' ').slice(0, 20) : '';
    const retStr = retType ? ` → ${retType}` : '';
    members.push(`${isStatic}${isAsync}${m[1]}(${normalizeParams(m[2])})${retStr}`);
  }
  return members.slice(0, 8);
}

function normalizeParams(params) {
  if (!params) return '';
  return params.trim().replace(/\s+/g, ' ').replace(/:[^,)]+/g, '').trim();
}

module.exports = { extract };
