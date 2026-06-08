'use strict';

/**
 * Parsers for the Hallucination Guard (verify-ai-output).
 *
 * Extract the verifiable claims an AI answer makes about a codebase:
 *   - file paths it references
 *   - import / require statements it shows
 *   - function / class symbols it calls
 *   - fenced code blocks (so callers can scope checks to code vs prose)
 *
 * Everything here is deterministic and offline — pure string analysis.
 */

// Extensions we are confident name a source/code/config file (no slash required).
const KNOWN_CODE_EXT = new Set([
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'py', 'pyw', 'rb', 'go', 'rs',
  'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'r',
  'vue', 'svelte', 'css', 'scss', 'less', 'html', 'json', 'yml', 'yaml',
  'toml', 'xml', 'sql', 'graphql', 'gql', 'proto', 'tf', 'md', 'sh',
  'gd', 'gdscript',
]);

/**
 * Extract fenced code blocks.
 * @param {string} text
 * @returns {{ lang: string, content: string, line: number }[]}
 */
function extractCodeBlocks(text) {
  const blocks = [];
  const lines = text.split('\n');
  let inBlock = false;
  let lang = '';
  let buf = [];
  let startLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^```(\w*)/);
    if (m) {
      if (!inBlock) {
        inBlock = true;
        lang = m[1] || '';
        buf = [];
        startLine = i + 2; // first content line (1-based)
      } else {
        blocks.push({ lang, content: buf.join('\n'), line: startLine });
        inBlock = false;
      }
      continue;
    }
    if (inBlock) buf.push(lines[i]);
  }
  return blocks;
}

/**
 * Extract file-path references (deduped, first-seen line kept).
 * A token counts as a path when it has a `.<letter…>` extension AND
 * either contains a `/` or carries a known code/config extension.
 * @param {string} text
 * @returns {{ path: string, line: number }[]}
 */
function extractFilePaths(text) {
  const lines = text.split('\n');
  const seen = new Map();
  const re = /(?:^|[\s`"'(\[<])([A-Za-z0-9_][\w./-]*\.[A-Za-z][A-Za-z0-9]*)/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(line)) !== null) {
      const p = m[1];
      if (/^https?:/i.test(p)) continue;
      const ext = (p.split('.').pop() || '').toLowerCase();
      const hasSlash = p.includes('/');
      if (!hasSlash && !KNOWN_CODE_EXT.has(ext)) continue;
      if (!seen.has(p)) seen.set(p, i + 1);
    }
  }
  return [...seen.entries()].map(([p, line]) => ({ path: p, line }));
}

/**
 * Extract import / require statements.
 * @param {string} text
 * @returns {{ module: string, kind: 'js'|'py', relative: boolean, line: number, raw: string }[]}
 */
function extractImports(text) {
  const lines = text.split('\n');
  const out = [];
  const push = (module, kind, line, raw) => {
    if (!module) return;
    out.push({ module, kind, relative: /^[./]/.test(module), line, raw: raw.trim() });
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    // JS/TS: import ... from 'x'  |  export ... from 'x'
    if ((m = line.match(/\b(?:import|export)\b[^'"]*\bfrom\s*['"]([^'"]+)['"]/))) {
      push(m[1], 'js', i + 1, line);
    } else if ((m = line.match(/\bimport\s*['"]([^'"]+)['"]/))) {
      // side-effect import 'x'
      push(m[1], 'js', i + 1, line);
    }
    // require('x') / dynamic import('x') — may co-occur, scan separately
    const reqRe = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let r;
    while ((r = reqRe.exec(line)) !== null) push(r[1], 'js', i + 1, line);

    // TS: import X = require('mod')
    if ((m = line.match(/\bimport\s+[A-Za-z_$][\w$]*\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/))) {
      push(m[1], 'js', i + 1, line);
    }

    // Python: from x import y  |  import x
    if ((m = line.match(/^\s*from\s+([.\w]+)\s+import\b/))) {
      push(m[1], 'py', i + 1, line);
    } else if ((m = line.match(/^\s*import\s+([A-Za-z_][\w.]*)/))) {
      push(m[1], 'py', i + 1, line);
    }
  }

  // Multi-line JS/TS imports, e.g.
  //   import {
  //     A as B,
  //   } from './mod';
  // The per-line pass above misses these because `from '…'` sits on a later
  // line. Trigger only when the opening line has no quote and no `from` yet,
  // then gather forward until the source string appears.
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i];
    if (!/^\s*(?:import|export)\b/.test(start)) continue;
    if (/['"]/.test(start) || /\bfrom\b/.test(start)) continue; // single-line, already handled
    let joined = start;
    for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
      joined += ' ' + lines[j];
      const fm = joined.match(/\bfrom\s*['"]([^'"]+)['"]/);
      if (fm) { push(fm[1], 'js', i + 1, start.trim()); break; }
      if (/['"]/.test(lines[j]) && !/\bfrom\b/.test(joined)) break; // a string that isn't a source — bail
    }
  }
  return out;
}

/**
 * Extract npm/pnpm/yarn script invocations (`npm run <name>`).
 * Only the explicit `run` form is matched, to avoid confusing package-manager
 * subcommands (`yarn add`, `pnpm install`) with script names.
 * @param {string} text
 * @returns {{ name: string, line: number }[]}
 */
function extractNpmScripts(text) {
  const lines = text.split('\n');
  const out = [];
  const seen = new Set();
  const re = /\b(?:npm|pnpm|yarn)\s+run(?:-script)?\s+([A-Za-z0-9:_-]+)/g;
  for (let i = 0; i < lines.length; i++) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(lines[i])) !== null) {
      const name = m[1];
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({ name, line: i + 1 });
    }
  }
  return out;
}

/**
 * Extract function/class symbol references that look like calls.
 * Restricted to backtick-wrapped calls (`foo(...)`) for high precision.
 * @param {string} text
 * @returns {{ name: string, line: number }[]}
 */
function extractSymbols(text) {
  const lines = text.split('\n');
  const out = [];
  const seen = new Set();
  const re = /`([A-Za-z_$][\w$]*)\s*\([^`]*\)`/g;
  for (let i = 0; i < lines.length; i++) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(lines[i])) !== null) {
      const name = m[1];
      const key = name + '@' + (i + 1);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, line: i + 1 });
    }
  }
  return out;
}

module.exports = {
  extractCodeBlocks,
  extractFilePaths,
  extractImports,
  extractSymbols,
  extractNpmScripts,
};
