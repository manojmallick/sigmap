'use strict';

/**
 * Objective-C / Objective-C++ Tier 2 Extractor (anchored regex)
 *
 * Extensions: .m, .mm (and .h when sniffed by cpp.js).
 * Target tier: 2 (anchored).
 *
 * Extracts:
 *   - @interface Foo : NSObject (with category / extension support)
 *   - @implementation Foo (and category implementation)
 *   - @protocol Fooing
 *   - Instance (-) and class (+) methods with balanced selector & argument types
 *   - @property declarations with attributes
 *   - C functions and static inline functions
 *   - typedef NS_ENUM, NS_OPTIONS, and typedef struct
 *   - C++ class / struct definitions in ObjC++ (.mm)
 *
 * Non-extraction:
 *   - Method bodies, ivar blocks (@private/@protected), #import, @synthesize.
 *
 * MATLAB fallback:
 *   - If no ObjC markers are detected, delegates to generic extractor.
 */

const { lineAt, withAnchor } = require('./line-anchor');
const { capWithNotice } = require('../util/truncate');
const { stripComments, maskCode, readBalanced } = require('./scan');

const MEMBER_LIMIT = 120;
const PER_FILE_LIMIT = 200;
// Method bodies are matched to this many characters. readBalanced's default
// 4KB window is a parameter-list ceiling; a real method body runs past it, and
// an unmatched body anchored the method to its first line (cpp parity, #576).
const MAX_BODY_CHARS = 200000;

// Suffix annotations to strip from method declarations
const METHOD_ATTR_RE = /\b(?:NS_SWIFT_NAME|NS_SWIFT_ASYNC_NAME|NS_DESIGNATED_INITIALIZER|NS_UNAVAILABLE|__attribute__\s*\(\([^)]*\)\)|API_AVAILABLE|API_DEPRECATED|API_UNAVAILABLE)\b(?:\s*\([^)]*\))?/g;

/**
 * Extract signatures from Objective-C / Objective-C++ source.
 * @param {string} src - Raw file content
 * @param {string} [filePath] - Optional file path
 * @returns {string[]} Array of signature strings
 */
function extract(src, filePath) {
  if (!src || typeof src !== 'string') return [];
  if (!src.trim()) return [];

  const stripped = stripComments(src);
  const masked = maskCode(src);
  const top = topLevelSurface(masked);

  // Check whether file has any Objective-C markers.
  // If not, delegate to generic extractor so MATLAB .m files are preserved.
  if (!hasObjCMarkers(stripped)) {
    try {
      return require('./generic').extract(src);
    } catch (_) {
      return [];
    }
  }

  const sigs = [];

  // 1. Scan @interface, @protocol, @implementation blocks
  // The optional `<...>` after the name is a lightweight-generics parameter
  // list (`@interface Box<ObjectType> : NSObject`) or a protocol list.
  const containerRe = /^[ \t]*@(interface|protocol|implementation)\s+([A-Za-z0-9_]+)(?:[ \t]*<[^>\n]*>)?(?:[ \t]*\(([A-Za-z0-9_]*)\))?(?:[ \t]*:[ \t]*([A-Za-z0-9_]+))?(?:[ \t]*<[^>]*>)?/gm;

  for (const m of stripped.matchAll(containerRe)) {
    const declIdx = m.index + (m[0].length - m[0].trimStart().length);
    const kind = m[1];
    const name = m[2];
    const category = m[3];
    const superclass = m[4];

    // A forward declaration (`@protocol FooDelegate;`, `@protocol A, B;`) opens
    // no block. Read as a container it ran to the NEXT container's `@end` and
    // re-emitted that container's members under the wrong name.
    if (/^[ \t]*[;,]/.test(masked.slice(m.index + m[0].length, m.index + m[0].length + 40))) continue;

    // Find closing @end on masked surface
    const endMatch = findAtEnd(masked, declIdx + m[0].length);
    if (!endMatch) continue;

    const blockStart = declIdx + m[0].length;
    const blockEnd = endMatch.index;
    const endLine = lineAt(stripped, blockEnd);
    const startLine = lineAt(stripped, declIdx);

    // Build container signature
    let header = `@${kind} ${name}`;
    if (category !== undefined) {
      header += ` (${category})`;
    } else if (superclass) {
      header += ` : ${superclass}`;
    }

    sigs.push(withAnchor(header, startLine, endLine));

    // Extract members inside this container
    const blockStripped = stripped.slice(blockStart, blockEnd);
    const blockMasked = masked.slice(blockStart, blockEnd);
    const blockTop = top.slice(blockStart, blockEnd);
    const members = extractMembers(blockStripped, blockMasked, blockTop, stripped, blockStart, kind === 'implementation');

    for (const mem of members) {
      sigs.push(mem);
    }
  }

  // 2. Scan typedef NS_ENUM / NS_OPTIONS / typedef struct
  extractEnumsAndStructs(stripped, masked, sigs);

  // 3. Scan top-level C functions / static inline definitions
  extractCFunctions(stripped, masked, top, sigs);

  // 4. In ObjC++ (.mm, and a header cpp.js delegated here), scan C++ classes / structs
  if (filePath && /\.(?:mm|h|hh|hpp)$/i.test(filePath)) {
    extractCppClasses(stripped, masked, sigs);
  }

  if (sigs.length === 0) {
    try {
      return require('./generic').extract(src);
    } catch (_) {
      return [];
    }
  }

  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

/**
 * Fast detection of Objective-C markers in source text.
 */
function hasObjCMarkers(stripped) {
  return /@(interface|implementation|protocol|property|synthesize|dynamic|end)\b|#import\b|NS_ENUM\b|NS_OPTIONS\b/.test(stripped);
}

/**
 * Locate matching `@end` keyword on masked surface.
 */
function findAtEnd(masked, startIdx) {
  const atEndRe = /^[ \t]*@end\b/gm;
  atEndRe.lastIndex = startIdx;
  const m = atEndRe.exec(masked);
  if (!m) return null;
  return { index: m.index };
}

/**
 * Blank the interior of every `{...}` block, keeping the outermost braces —
 * what remains is the declaration surface. A method or C function can only
 * START at brace depth 0, so scanning this instead of the raw text is what
 * stops `x = a - b;` or `return CGRectMake(...)` inside a body from reading as
 * a method or a function prototype. Length- and newline-preserving.
 *
 * Depth has to survive real code, where braces do not always pair up textually:
 *   - `#if` / `#else` branches are alternatives, each opening its own `if (...) {`
 *     for one shared `}`. Every branch restarts from the depth at the `#if`.
 *   - `#define` bodies are skipped — a macro may hold half a block.
 *   - `extern "C" {` and `namespace x {` only group declarations: transparent.
 *   - Depth resets at a container keyword and at a method head in column 0.
 *     Neither can occur inside a block, so whatever imbalance is left costs one
 *     method its end line rather than every member after it.
 * @param {string} masked - output of maskCode
 * @returns {string}
 */
function topLevelSurface(masked) {
  const out = masked.split('');
  const n = masked.length;
  const branchDepth = [];
  let depth = 0;
  let lineHead = true;
  for (let i = 0; i < n; i++) {
    const ch = masked[i];
    if (ch === '\n') { lineHead = true; continue; }
    if (ch === ' ' || ch === '\t') continue;

    if (lineHead) {
      lineHead = false;
      if (ch === '#') {
        const dir = /^#[ \t]*(if|ifdef|ifndef|elif|else|endif)\b/.exec(masked.slice(i, i + 16));
        if (dir) {
          if (dir[1] === 'endif') branchDepth.pop();
          else if (dir[1] === 'else' || dir[1] === 'elif') {
            if (branchDepth.length) depth = branchDepth[branchDepth.length - 1];
          } else branchDepth.push(depth);
        }
        // Blank the directive's logical line, continuations included: a macro
        // body is not a declaration, whatever depth it sits at.
        for (; i < n; i++) {
          if (masked[i] === '\n') {
            if (masked[i - 1] !== '\\') break;
          } else out[i] = ' ';
        }
        lineHead = true;
        continue;
      }
      if (ch === '@' && /^@(?:end\b|(?:interface|implementation|protocol)\s+\w)/.test(masked.slice(i, i + 20))) depth = 0;
      else if ((ch === '-' || ch === '+') && (i === 0 || masked[i - 1] === '\n') && /^[-+][ \t]*\(/.test(masked.slice(i, i + 8))) depth = 0;
    }

    if (ch === '{') {
      if (depth === 0 && /\b(?:extern|namespace(?:[ \t]+[\w:]+)?)\s*$/.test(masked.slice(Math.max(0, i - 80), i))) continue;
      if (depth > 0) out[i] = ' ';
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
      if (depth > 0) out[i] = ' ';
    } else if (depth > 0) {
      out[i] = ' ';
    }
  }
  return out.join('');
}

/**
 * Extract members inside an @interface, @protocol, or @implementation block.
 * A member starts at the head of a line on the top-level surface, so an ivar
 * block and the bodies of methods and C helpers are never scanned for members.
 */
function extractMembers(blockStripped, blockMasked, blockTop, fullStripped, offset, isImpl) {
  const members = [];
  const heads = [];
  for (const m of blockTop.matchAll(/^[ \t]*([-+]|@property\b)/gm)) {
    heads.push({ idx: m.index + m[0].length - m[1].length, isProp: m[1] === '@property' });
  }
  let resumeAt = 0;

  for (let h = 0; h < heads.length; h++) {
    const i = heads[h].idx;
    if (i < resumeAt) continue;

    const result = heads[h].isProp
      ? parseProperty(blockStripped, blockMasked, i)
      : parseMethod(blockStripped, blockMasked, i, isImpl, blockTop);
    if (!result) continue;

    // Every head is at depth 0, so a body that reaches the next one was closed
    // by a brace that is not its own — keep the start line, drop the bad end.
    const next = h + 1 < heads.length ? heads[h + 1].idx : Infinity;
    const endIdx = result.endIdx < next ? result.endIdx : result.bodyIdx;

    const startL = lineAt(fullStripped, offset + i);
    const endL = lineAt(fullStripped, offset + endIdx);
    members.push(withAnchor(`  ${result.sig}`, startL, endL));
    resumeAt = endIdx + 1;
  }

  return capWithNotice(members, MEMBER_LIMIT, 'methods');
}

/**
 * Parse an `@property (...) Type name;` declaration.
 */
function parseProperty(stripped, masked, startIdx) {
  let i = startIdx + '@property'.length;
  const n = stripped.length;

  while (i < n && /[ \t]/.test(stripped[i])) i++;
  if (i >= n) return null;

  let attrs = '';
  if (stripped[i] === '(') {
    const closeParen = readBalanced(masked, i, '(', ')');
    if (closeParen < 0) return null;
    attrs = stripped.slice(i, closeParen + 1).replace(/\s+/g, ' ');
    i = closeParen + 1;
  }

  // Find terminating `;`
  let semi = i;
  while (semi < n && stripped[semi] !== ';' && stripped[semi] !== '\n' && stripped[semi] !== '@') {
    semi++;
  }
  if (semi >= n || stripped[semi] !== ';') return null;

  let rest = stripped.slice(i, semi).replace(METHOD_ATTR_RE, '').trim().replace(/\s+/g, ' ');
  if (!rest) return null;

  const sig = attrs ? `@property ${attrs} ${rest}` : `@property ${rest}`;
  return { sig, endIdx: semi };
}

/**
 * Parse a class (+) or instance (-) method.
 */
function parseMethod(stripped, masked, startIdx, isImpl, top) {
  const kind = stripped[startIdx]; // '-' or '+'
  let i = startIdx + 1;
  const n = stripped.length;

  while (i < n && /[ \t\n]/.test(stripped[i])) i++;
  if (i >= n) return null;

  let returnType = '';
  if (stripped[i] === '(') {
    const closeParen = readBalanced(masked, i, '(', ')');
    if (closeParen < 0) return null;
    returnType = stripped.slice(i, closeParen + 1).replace(/\s+/g, ' ');
    i = closeParen + 1;
  }

  while (i < n && /[ \t\n]/.test(stripped[i])) i++;
  if (i >= n) return null;

  // Read first identifier
  let identStart = i;
  while (i < n && /[A-Za-z0-9_]/.test(stripped[i])) i++;
  const firstIdent = stripped.slice(identStart, i);
  if (!firstIdent) return null;

  while (i < n && /[ \t]/.test(stripped[i])) i++;

  let selectorParts = [];

  if (i < n && stripped[i] === ':') {
    // Method WITH arguments
    i++; // consume ':'
    while (i < n && /[ \t\n]/.test(stripped[i])) i++;

    let argType = '';
    if (i < n && stripped[i] === '(') {
      const closeParen = readBalanced(masked, i, '(', ')');
      if (closeParen < 0) return null;
      argType = stripped.slice(i, closeParen + 1).replace(/\s+/g, ' ');
      i = closeParen + 1;
    }

    while (i < n && /[ \t\n]/.test(stripped[i])) i++;

    let argNameStart = i;
    while (i < n && /[A-Za-z0-9_]/.test(stripped[i])) i++;
    const argName = stripped.slice(argNameStart, i);

    selectorParts.push(`${firstIdent}:${argType}${argName}`);

    // Read subsequent arguments if any
    while (i < n) {
      while (i < n && /[ \t\n]/.test(stripped[i])) i++;
      if (i >= n || stripped[i] === ';' || stripped[i] === '{' || stripped[i] === '@') break;

      let nextIdentStart = i;
      while (i < n && /[A-Za-z0-9_]/.test(stripped[i])) i++;
      const nextIdent = stripped.slice(nextIdentStart, i);
      if (!nextIdent) break;

      while (i < n && /[ \t]/.test(stripped[i])) i++;
      if (i >= n || stripped[i] !== ':') {
        // Not followed by ':', so it's a trailing attribute / macro
        break;
      }

      i++; // consume ':'
      while (i < n && /[ \t\n]/.test(stripped[i])) i++;

      let nextArgType = '';
      if (i < n && stripped[i] === '(') {
        const closeParen = readBalanced(masked, i, '(', ')');
        if (closeParen < 0) return null;
        nextArgType = stripped.slice(i, closeParen + 1).replace(/\s+/g, ' ');
        i = closeParen + 1;
      }

      while (i < n && /[ \t\n]/.test(stripped[i])) i++;

      let nextArgNameStart = i;
      while (i < n && /[A-Za-z0-9_]/.test(stripped[i])) i++;
      const nextArgName = stripped.slice(nextArgNameStart, i);

      selectorParts.push(`${nextIdent}:${nextArgType}${nextArgName}`);
    }
  } else {
    // 0-argument method
    selectorParts.push(firstIdent);
  }

  // Find termination: `;` for declaration or `{ ... }` for definition
  let endIdx = -1;
  let bodyIdx = -1;
  while (i < n && stripped[i] !== ';' && stripped[i] !== '{' && stripped[i] !== '@') {
    if (stripped[i] === '(') {
      const close = readBalanced(masked, i, '(', ')');
      if (close > 0) { i = close + 1; continue; }
    }
    i++;
  }

  if (i >= n || stripped[i] === '@') return null;

  // A definition may legally carry a `;` before its body: `- (void)run;\n{ ... }`.
  if (isImpl && stripped[i] === ';') {
    let k = i + 1;
    while (k < n && /\s/.test(masked[k])) k++;
    if (masked[k] === '{') i = k;
  }

  if (stripped[i] === ';') {
    endIdx = i;
  } else if (stripped[i] === '{') {
    // On the top-level surface the body interior is blank, so the next `}` is
    // this body's own — with no scan ceiling, and correct across `#if` branches.
    const closeBrace = top ? top.indexOf('}', i + 1) : readBalanced(masked, i, '{', '}', MAX_BODY_CHARS);
    bodyIdx = i;
    endIdx = closeBrace > 0 ? closeBrace : i;
  } else {
    return null;
  }

  const selectorStr = selectorParts.join(' ').trim();
  if (!selectorStr) return null;

  const sig = returnType ? `${kind} ${returnType}${selectorStr}` : `${kind} ${selectorStr}`;
  return { sig, endIdx, bodyIdx: bodyIdx < 0 ? endIdx : bodyIdx };
}

/**
 * Extract typedef NS_ENUM, NS_OPTIONS, and typedef struct.
 */
function extractEnumsAndStructs(stripped, masked, sigs) {
  const enumRe = /^[ \t]*typedef[ \t]+(NS_ENUM|NS_OPTIONS)[ \t]*\([ \t]*([A-Za-z0-9_]+)[ \t]*,[ \t]*([A-Za-z0-9_]+)[ \t]*\)[ \t]*\{/gm;
  for (const m of stripped.matchAll(enumRe)) {
    const declIdx = m.index + (m[0].length - m[0].trimStart().length);
    const macro = m[1];
    const type = m[2];
    const name = m[3];
    const openBrace = m.index + m[0].length - 1;
    const closeBrace = readBalanced(masked, openBrace, '{', '}');
    const endLine = closeBrace > 0 ? lineAt(stripped, closeBrace) : lineAt(stripped, declIdx);
    const startLine = lineAt(stripped, declIdx);

    sigs.push(withAnchor(`typedef ${macro}(${type}, ${name})`, startLine, endLine));
  }

  const structRe = /^[ \t]*typedef[ \t]+struct[ \t]+([A-Za-z0-9_]+)?\s*\{/gm;
  for (const m of stripped.matchAll(structRe)) {
    const declIdx = m.index + (m[0].length - m[0].trimStart().length);
    const openBrace = m.index + m[0].length - 1;
    const closeBrace = readBalanced(masked, openBrace, '{', '}');
    if (closeBrace < 0) continue;

    // Scan after `}` for name
    let after = closeBrace + 1;
    while (after < stripped.length && /[ \t\n]/.test(stripped[after])) after++;
    const nameMatch = stripped.slice(after, after + 100).match(/^([A-Za-z0-9_]+)\s*;/);
    const structName = nameMatch ? nameMatch[1] : (m[1] || 'struct');
    const startLine = lineAt(stripped, declIdx);
    const endLine = lineAt(stripped, closeBrace);

    sigs.push(withAnchor(`typedef struct ${structName}`, startLine, endLine));
  }
}

/**
 * Extract top-level C functions and static inline functions. Matched on the
 * top-level surface: inside a body, `return CGRectMake(0, 0, w, h);` has the
 * same `type name(...);` shape as a prototype.
 */
function extractCFunctions(stripped, masked, top, sigs) {
  const funcRe = /^[ \t]*(static[ \t]+inline[ \t]+|static[ \t]+|extern[ \t]+)?([A-Za-z0-9_]+(?:[ \t]+[A-Za-z0-9_]+)*[ \t*&]+)\s*([A-Za-z0-9_]+)[ \t]*\(/gm;

  for (const m of top.matchAll(funcRe)) {
    const declIdx = m.index + (m[0].length - m[0].trimStart().length);
    const modifier = m[1] || '';
    const rawType = m[2].trim();
    const name = m[3];

    // Filter out ObjC keywords, typedefs, or control flow
    if (name.startsWith('_') || /^(if|for|while|switch|return|sizeof|typedef|class|struct|case|NS_ENUM|NS_OPTIONS)$/.test(name)) continue;
    if (rawType.startsWith('typedef') || /^@(interface|implementation|protocol)/.test(rawType)) continue;

    const openParen = m.index + m[0].length - 1;
    const closeParen = readBalanced(masked, openParen, '(', ')');
    if (closeParen < 0) continue;

    // Must be followed by a function body `{` or `;`
    let k = closeParen + 1;
    while (k < masked.length && /[ \t\n]/.test(masked[k])) k++;
    if (k >= masked.length) continue;

    let returnPrefix = modifier ? `${modifier}${rawType}` : rawType;
    returnPrefix = returnPrefix.replace(/\s+/g, ' ').trim();
    if (!returnPrefix.endsWith('*') && !returnPrefix.endsWith('&')) {
      returnPrefix += ' ';
    }

    if (masked[k] === '{') {
      const closeBrace = top.indexOf('}', k + 1);
      const startLine = lineAt(stripped, declIdx);
      const endLine = closeBrace > 0 ? lineAt(stripped, closeBrace) : startLine;
      const params = stripped.slice(openParen + 1, closeParen).trim().replace(/\s+/g, ' ');
      sigs.push(withAnchor(`${returnPrefix}${name}(${params})`, startLine, endLine));
    } else if (masked[k] === ';') {
      const startLine = lineAt(stripped, declIdx);
      const endLine = lineAt(stripped, k);
      const params = stripped.slice(openParen + 1, closeParen).trim().replace(/\s+/g, ' ');
      sigs.push(withAnchor(`${returnPrefix}${name}(${params})`, startLine, endLine));
    }
  }
}

/**
 * Extract C++ classes and structs in ObjC++ (.mm files).
 */
function extractCppClasses(stripped, masked, sigs) {
  const cppClassRe = /^[ \t]*(?:template\s*<[^>]*>\s*)?(class|struct)\s+([A-Za-z0-9_]+)(?:\s*:\s*[^{]+)?\s*\{/gm;
  for (const m of stripped.matchAll(cppClassRe)) {
    const declIdx = m.index + (m[0].length - m[0].trimStart().length);
    const kind = m[1];
    const name = m[2];
    const openBrace = m.index + m[0].length - 1;
    const closeBrace = readBalanced(masked, openBrace, '{', '}');
    const startLine = lineAt(stripped, declIdx);
    const endLine = closeBrace > 0 ? lineAt(stripped, closeBrace) : startLine;

    sigs.push(withAnchor(`${kind} ${name}`, startLine, endLine));
  }
}

module.exports = {
  extract,
  hasObjCMarkers,
  topLevelSurface,
  parseMethod,
  parseProperty,
  MEMBER_LIMIT,
  PER_FILE_LIMIT,
};
