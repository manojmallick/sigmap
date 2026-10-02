'use strict';

/**
 * PowerShell extractor (Tier 2, Issue #840).
 *
 * Supported extensions: .ps1, .psm1, .psd1
 *
 * Architecture:
 *   - Local length- and newline-preserving maskPs() scanner for PowerShell comments
 *     (# and <# ... #>) and strings ('single', "double", and here-strings).
 *   - Balanced parameter and block depth scanning via readBalanced.
 *   - Signatures carry Surgical Context line anchors (:start-end).
 *   - Member and file caps with visible disclosure (capWithNotice / capMembersWithNotice).
 *
 * Internal/public convention:
 *   PowerShell has no script-scope private keyword. If an export list
 *   (Export-ModuleMember or FunctionsToExport) exists in the file, functions not
 *   listed are treated as internal and omitted. If no export list is present,
 *   all functions are emitted.
 */

const { lineAt, withAnchor } = require('./line-anchor');
const { capWithNotice, capMembersWithNotice } = require('../util/truncate');
const { readBalanced } = require('./scan');

const PER_FILE_LIMIT = 200;
const MEMBER_LIMIT = 120;
const MAX_CLASS_BODY_CHARS = 200000;

/**
 * Single-pass, length- and newline-preserving mask for PowerShell syntax.
 *
 * Priority order (per implementation guide):
 *   1. <# ... #> block comments (nestable in practice — depth tracked)
 *   2. # to end of line (only outside strings)
 *   3. @" ... "@ and @' ... '@ here-strings (terminator must be at line start)
 *   4. 'single' quoted strings (doubled '' escapes)
 *   5. "double" quoted strings (backtick ` is escape, NOT backslash)
 *
 * Blanked bytes become spaces; all \n are strictly preserved.
 *
 * @param {string} src
 * @returns {string} masked source of identical length and newline count
 */
function maskPs(src) {
  if (!src || typeof src !== 'string') return '';
  const out = src.split('');
  const n = src.length;
  const blank = (from, to) => {
    for (let k = from; k < to; k++) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };

  let i = 0;
  while (i < n) {
    const c = src[i];
    const d = i + 1 < n ? src[i + 1] : '';

    // 1. Block comments: <# ... #> (nestable)
    if (c === '<' && d === '#') {
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (src[j] === '<' && src[j + 1] === '#') {
          depth++;
          j += 2;
        } else if (src[j] === '#' && src[j + 1] === '>') {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      blank(i, j);
      i = j;
      continue;
    }

    // 2. Here-strings: @"\r?\n ... \r?\n"@ or @'\r?\n ... \r?\n'@
    // Opening delimiter must be followed by newline (optional whitespace allowed before \n).
    if (c === '@' && (d === '"' || d === '\'')) {
      const quote = d;
      let k = i + 2;
      while (k < n && (src[k] === ' ' || src[k] === '\t' || src[k] === '\r')) k++;
      if (k < n && src[k] === '\n') {
        let j = k + 1;
        let closed = false;
        while (j < n) {
          // Terminator occurs at the beginning of a line (column 0, or right after \n)
          if ((j === 0 || src[j - 1] === '\n') && src[j] === quote && j + 1 < n && src[j + 1] === '@') {
            j += 2;
            closed = true;
            break;
          }
          j++;
        }
        blank(i, j);
        i = j;
        continue;
      }
    }

    // 3. Single-quoted strings: 'text' (escape is doubled '')
    if (c === '\'') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\'') {
          if (j + 1 < n && src[j + 1] === '\'') {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      blank(i, j);
      i = j;
      continue;
    }

    // 4. Double-quoted strings: "text" (escape is ` or doubled "")
    if (c === '"') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '`') {
          j += 2;
          continue;
        }
        if (src[j] === '"') {
          if (j + 1 < n && src[j + 1] === '"') {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      blank(i, j);
      i = j;
      continue;
    }

    // 5. Line comments: # ... (outside strings and block comments)
    if (c === '#') {
      let j = i + 1;
      while (j < n && src[j] !== '\n') j++;
      blank(i, j);
      i = j;
      continue;
    }

    i++;
  }

  return out.join('');
}

/**
 * Extract signatures from PowerShell source code (.ps1, .psm1, .psd1).
 *
 * @param {string} src - Raw file content
 * @param {string} [filePath] - File path (optional)
 * @returns {string[]} Array of signature strings
 */
function extract(src, filePath) {
  if (!src || typeof src !== 'string') return [];

  const ext = typeof filePath === 'string'
    ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
    : '';

  // .psd1 Module Manifest metadata extraction
  if (ext === '.psd1') {
    return extractManifest(src);
  }

  const masked = maskPs(src);
  const docHints = collectDocHints(src);
  const exportSet = collectExportedFunctions(src, masked);

  const sigs = [];

  // 1. PS5 Classes
  const classRe = /^[ \t]*class\s+([A-Za-z_]\w*)(?:\s*:\s*[A-Za-z_]\w*)?\s*\{/gm;
  const classRanges = [];
  for (const m of masked.matchAll(classRe)) {
    const declStart = m.index + (m[0].length - m[0].trimStart().length);
    const openBrace = m.index + m[0].length - 1;
    const closeBrace = readBalanced(masked, openBrace, '{', '}', MAX_CLASS_BODY_CHARS);
    const endIdx = closeBrace >= 0 ? closeBrace : openBrace;
    classRanges.push([openBrace, endIdx]);

    const className = m[1];
    sigs.push(withAnchor(`class ${className}`, lineAt(src, declStart), lineAt(src, endIdx)));

    const classBody = src.slice(openBrace + 1, endIdx);
    const classMasked = masked.slice(openBrace + 1, endIdx);
    const members = extractClassMembers(classBody, classMasked, openBrace + 1, src, className);
    for (const mem of members) {
      sigs.push(mem);
    }
  }

  // 2. Enums
  const enumRe = /^[ \t]*enum\s+([A-Za-z_]\w*)(?:\s*:\s*\w+)?\s*\{/gm;
  for (const m of masked.matchAll(enumRe)) {
    const declStart = m.index + (m[0].length - m[0].trimStart().length);
    const openBrace = m.index + m[0].length - 1;
    const closeBrace = readBalanced(masked, openBrace, '{', '}', 10000);
    const endIdx = closeBrace >= 0 ? closeBrace : openBrace;
    sigs.push(withAnchor(`enum ${m[1]}`, lineAt(src, declStart), lineAt(src, endIdx)));
  }

  // 3. Functions, Filters, and Workflows
  const fnRe = /^[ \t]*(?:(?:\[[^\]]+\]\s*)*)(function|filter|workflow)\s+([A-Za-z0-9_:-]+)/gim;
  for (const m of masked.matchAll(fnRe)) {
    // Skip if inside a class body
    if (classRanges.some(([start, end]) => m.index > start && m.index < end)) {
      continue;
    }

    const keyword = m[1].toLowerCase();
    const rawName = m[2];

    // If an export list is present, skip unexported functions (internal convention)
    if (exportSet && !exportSet.has(rawName.toLowerCase())) {
      continue;
    }

    const declStart = m.index + (m[0].length - m[0].trimStart().length);

    // Look for body {
    const afterNameIdx = m.index + m[0].length;
    let openBrace = -1;
    for (let k = afterNameIdx; k < Math.min(masked.length, afterNameIdx + 2000); k++) {
      if (masked[k] === '{') {
        openBrace = k;
        break;
      }
    }

    const closeBrace = openBrace >= 0
      ? readBalanced(masked, openBrace, '{', '}', MAX_CLASS_BODY_CHARS)
      : -1;
    const endIdx = closeBrace >= 0 ? closeBrace : (openBrace >= 0 ? openBrace : declStart);

    // Check for inline parameters: function name($a, $b)
    let params = null;
    let openParen = -1;
    for (let k = afterNameIdx; k < (openBrace >= 0 ? openBrace : masked.length); k++) {
      if (masked[k] === '(') {
        openParen = k;
        break;
      }
    }

    if (openParen >= 0) {
      const closeParen = readBalanced(masked, openParen, '(', ')', 4000);
      if (closeParen >= 0) {
        params = parseParams(src.slice(openParen + 1, closeParen), masked.slice(openParen + 1, closeParen));
      }
    }

    // If no inline params, check for param(...) block inside body
    let bodySlice = '';
    let bodyMasked = '';
    if (openBrace >= 0) {
      const bodyEnd = closeBrace >= 0 ? closeBrace : Math.min(masked.length, openBrace + 4000);
      bodySlice = src.slice(openBrace + 1, bodyEnd);
      bodyMasked = masked.slice(openBrace + 1, bodyEnd);
    }

    if (params === null && openBrace >= 0) {
      const paramMatch = bodyMasked.match(/\bparam\s*\(/i);
      if (paramMatch) {
        const pOpen = paramMatch.index + paramMatch[0].length - 1;
        const pClose = readBalanced(bodyMasked, pOpen, '(', ')', 8000);
        if (pClose >= 0) {
          params = parseParams(bodySlice.slice(pOpen + 1, pClose), bodyMasked.slice(pOpen + 1, pClose));
        }
      }
    }

    // Default to empty params () if none defined
    const paramStr = params !== null ? params.join(', ') : '';

    // Advanced function attribute: [CmdletBinding()]
    const headerPrefix = src.slice(Math.max(0, m.index - 300), m.index);
    const bodyPrefix = bodySlice.slice(0, 1000);
    const hasCmdletBinding = /\[CmdletBinding\b/i.test(headerPrefix) || /\[CmdletBinding\b/i.test(bodyPrefix);

    // Return type hint: [OutputType([Type])] or [OutputType('Type')]
    let returnType = '';
    const otMatch = (headerPrefix + '\n' + bodyPrefix).match(/\[OutputType\s*\(\s*(?:\[\s*([\w.]+)\s*\]|['"]([^'"]+)['"])/i);
    if (otMatch) {
      returnType = otMatch[1] || otMatch[2] || '';
    }

    // Build signature string
    let sig = `${keyword} ${rawName}(${paramStr})`;
    if (hasCmdletBinding) sig += ' [CmdletBinding]';
    if (returnType) sig += ` → ${returnType}`;

    const anchored = withAnchor(sig, lineAt(src, declStart), lineAt(src, endIdx));

    // Doc hint from .SYNOPSIS
    const hint = docHints.get(rawName) || findBodySynopsis(bodySlice);
    const withHint = hint ? `${anchored}  # ${hint}` : anchored;

    sigs.push(withHint);
  }

  // 4. Module member exports: Export-ModuleMember -Function a, b
  const exportRe = /^[ \t]*Export-ModuleMember\s+(?:-Function\s+)?([^\r\n;#]+)/gim;
  for (const m of src.matchAll(exportRe)) {
    // Skip if commented out on masked surface
    if (masked[m.index] === ' ') continue;

    const declStart = m.index + (m[0].length - m[0].trimStart().length);
    const declEnd = m.index + m[0].trimEnd().length;

    // Normalise: Export-ModuleMember -Function a, b -> Export-ModuleMember a, b
    const rawArgs = m[1].trim();
    // Strip trailing other flags like -Variable, -Alias if present
    const cleanArgs = rawArgs.replace(/-[A-Za-z]+\b.*$/, '').trim();
    if (cleanArgs) {
      const text = `Export-ModuleMember ${cleanArgs.replace(/\s+/g, ' ')}`;
      sigs.push(withAnchor(text, lineAt(src, declStart), lineAt(src, declEnd)));
    }
  }

  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

/**
 * Extract PS5 class constructors and methods.
 */
function extractClassMembers(body, maskedBody, offset, src, className) {
  const members = [];

  // Match method/constructor declarations:
  //   [Type] Method($a)
  //   Method($a)
  //   static [Type] Method($a)
  //   ClassName($a)   (Constructor)
  const memberRe = /^[ \t]*(hidden\s+)?(static\s+)?(?:\[\s*([\w.\[\]]+)\s*\]\s+)?([A-Za-z_]\w*)\s*\(/gm;

  for (const m of maskedBody.matchAll(memberRe)) {
    const isHidden = Boolean(m[1]);
    if (isHidden) continue; // Skip private/hidden members

    const isStatic = Boolean(m[2]);
    const declaredType = m[3] || '';
    const name = m[4];

    // Keywords to ignore
    if (/^(if|elseif|else|while|for|foreach|switch|until|trap|catch)$/i.test(name)) {
      continue;
    }

    const declStart = offset + m.index + (m[0].length - m[0].trimStart().length);
    const openParen = m.index + m[0].length - 1;
    const closeParen = readBalanced(maskedBody, openParen, '(', ')', 2000);
    if (closeParen < 0) continue;

    // Find opening { of method body
    let openBrace = -1;
    for (let k = closeParen + 1; k < Math.min(maskedBody.length, closeParen + 500); k++) {
      if (maskedBody[k] === '{') {
        openBrace = k;
        break;
      }
    }
    const closeBrace = openBrace >= 0
      ? readBalanced(maskedBody, openBrace, '{', '}', MAX_CLASS_BODY_CHARS)
      : -1;
    const endIdx = offset + (closeBrace >= 0 ? closeBrace : closeParen);

    const paramList = parseParams(
      body.slice(openParen + 1, closeParen),
      maskedBody.slice(openParen + 1, closeParen)
    );
    const paramStr = paramList.join(', ');

    let sigText = '';
    if (name === className) {
      // Constructor
      sigText = `  ${name}(${paramStr})`;
    } else {
      const typePrefix = declaredType ? `[${declaredType}] ` : '';
      const staticPrefix = isStatic ? 'static ' : '';
      sigText = `  ${staticPrefix}${typePrefix}${name}(${paramStr})`;
    }

    members.push({
      text: withAnchor(sigText, lineAt(src, declStart), lineAt(src, endIdx)),
      declStart,
      endIdx,
    });
  }

  const capped = capMembersWithNotice(members, MEMBER_LIMIT, 'methods');
  return capped.map((m) => m.text);
}

/**
 * Parse balanced parameters into clean names.
 * Strips $, [Type], default expressions, and splatting (@).
 */
function parseParams(paramText, maskedText) {
  if (!paramText || !paramText.trim()) return [];

  const chunks = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < maskedText.length; i++) {
    const ch = maskedText[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      chunks.push(paramText.slice(start, i));
      start = i + 1;
    }
  }
  chunks.push(paramText.slice(start));

  const names = [];
  for (const chunk of chunks) {
    const name = extractParamName(chunk);
    if (name) names.push(name);
  }

  return names;
}

/**
 * Extract a single parameter variable name from a parameter declaration chunk.
 * E.g.: `[Parameter(Mandatory = $true)] [string]$FilePath = 'default'` -> `FilePath`
 */
function extractParamName(chunk) {
  if (!chunk || !chunk.trim()) return '';

  // 1. Strip default expression (= ...) outside brackets/parens
  let depth = 0;
  let eqIdx = -1;
  for (let i = 0; i < chunk.length; i++) {
    const ch = chunk[i];
    if (ch === '[' || ch === '(' || ch === '{') depth++;
    else if (ch === ']' || ch === ')' || ch === '}') depth--;
    else if (ch === '=' && depth === 0) {
      eqIdx = i;
      break;
    }
  }
  const beforeEq = eqIdx >= 0 ? chunk.slice(0, eqIdx) : chunk;

  // 2. Strip all bracketed sections [...] (attributes and type annotations)
  let stripped = '';
  let bDepth = 0;
  for (let i = 0; i < beforeEq.length; i++) {
    const ch = beforeEq[i];
    if (ch === '[') bDepth++;
    else if (ch === ']') {
      if (bDepth > 0) bDepth--;
    } else if (bDepth === 0) {
      stripped += ch;
    }
  }

  // 3. Extract the variable name ($Name or ${Name})
  const varMatch = stripped.match(/\$(?:\{([^}]+)\}|([A-Za-z0-9_:-]+))/);
  if (varMatch) {
    const varName = varMatch[1] || varMatch[2];
    return varName.replace(/^[A-Za-z0-9_]+:/, '');
  }

  // 4. Fallback for splatting (@Name) or bare identifier
  const splatMatch = stripped.match(/@([A-Za-z0-9_:-]+)/);
  if (splatMatch) {
    return splatMatch[1];
  }

  const bare = stripped.trim().replace(/^[\$@]/, '');
  return /^[A-Za-z0-9_:-]+$/.test(bare) ? bare : '';
}

/**
 * Extract manifest entries for .psd1 files.
 * Keys: ModuleVersion, RootModule, FunctionsToExport
 */
function extractManifest(src) {
  const sigs = [];
  const targetKeys = ['RootModule', 'ModuleVersion', 'FunctionsToExport'];

  for (const key of targetKeys) {
    const re = new RegExp(`^[ \\t]*${key}\\s*=\\s*([^\r\n#;]+)`, 'gim');
    const m = re.exec(src);
    if (m) {
      const declStart = m.index + (m[0].length - m[0].trimStart().length);
      const declEnd = m.index + m[0].trimEnd().length;
      const rawVal = m[1].trim();
      const cleanVal = rawVal.replace(/\s+/g, ' ');
      sigs.push(withAnchor(`${key} = ${cleanVal}`, lineAt(src, declStart), lineAt(src, declEnd)));
    }
  }

  return sigs;
}

/**
 * Collect exported function names if an export list exists in the file.
 * Returns null if no export list is found (meaning: emit all functions).
 */
function collectExportedFunctions(src, masked) {
  let exportSet = null;

  // 1. Export-ModuleMember -Function a, b
  const emmRe = /^[ \t]*Export-ModuleMember\s+(?:-Function\s+)?([^\r\n;#]+)/gim;
  for (const m of src.matchAll(emmRe)) {
    if (masked[m.index] === ' ') continue;
    const args = m[1].replace(/-[A-Za-z]+\b.*$/, '').trim();
    if (args) {
      if (!exportSet) exportSet = new Set();
      const parts = args.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
      for (const p of parts) if (p) exportSet.add(p);
    }
  }

  // 2. FunctionsToExport = @('a', 'b')
  const fteRe = /^[ \t]*FunctionsToExport\s*=\s*(?:@\(([^)]*)\)|['"]([^'"]+)['"])/gim;
  for (const m of src.matchAll(fteRe)) {
    if (masked[m.index] === ' ') continue;
    const raw = m[1] || m[2] || '';
    if (raw) {
      if (!exportSet) exportSet = new Set();
      const parts = raw.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
      for (const p of parts) if (p) exportSet.add(p);
    }
  }

  return exportSet;
}

/**
 * Collect doc hints from <# .SYNOPSIS ... #> comments before function declarations.
 */
function collectDocHints(src) {
  const hints = new Map();
  const re = /(<#[\s\S]*?#>)\s*(?:\[[^\]]+\]\s*)*(?:function|filter|workflow)\s+([A-Za-z0-9_:-]+)/gi;

  for (const m of src.matchAll(re)) {
    const comment = m[1];
    const fnName = m[2];
    const hint = extractSynopsis(comment);
    if (hint && !hints.has(fnName)) {
      hints.set(fnName, hint);
    }
  }

  return hints;
}

/**
 * Extract synopsis inside a function's body if defined there.
 */
function findBodySynopsis(bodySlice) {
  const m = bodySlice.match(/<#([\s\S]*?)#>/);
  if (!m) return '';
  return extractSynopsis(m[0]);
}

/**
 * Parse the first sentence of .SYNOPSIS from a comment block, capped at 60 chars.
 */
function extractSynopsis(commentBlock) {
  const m = commentBlock.match(/\.SYNOPSIS\s+([\s\S]*?)(?=\r?\n\s*\.[A-Z]+|\s*#>)/i);
  if (!m) return '';

  const lines = m[1].split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('.'));

  if (lines.length === 0) return '';
  const firstLine = lines[0];
  const sentence = firstLine.split(/[.!?]/)[0].trim();
  return (sentence || firstLine).slice(0, 60);
}

module.exports = { extract, maskPs };
