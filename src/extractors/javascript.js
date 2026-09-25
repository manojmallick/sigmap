'use strict';

const { lineAt, withAnchor } = require('./line-anchor');
const { capWithNotice, capMembersWithNotice } = require('../util/truncate');
const { stripComments, maskCode, readBalanced } = require('./scan');
const { scanComponentMarkers, markersForClass, componentMembers } = require('./component-surface');

// Class bodies are scanned to this many characters — guard against
// pathological input only; the old 4KB window silently hid members (#576).
const MAX_CLASS_BODY_CHARS = 200000;

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
  // docHintFor[i] is the doc-comment hint for sigs[i] (top-level functions
  // only), appended after the anchor as `  # <hint>` — same convention as the
  // Python extractor's extractDocHint.
  const docHintFor = [];
  const returnHints = buildReturnHints(src);
  const docHints = buildDocHints(src);

  // stripComments is string-aware (a `//` inside a string literal survives);
  // maskCode additionally blanks string/template contents so every delimiter
  // found on it is structural. Both are length- and newline-preserving, so
  // offsets and line anchors align across all three views (#526).
  const stripped = stripComments(src);
  const masked = maskCode(src);

  // Full params for a declaration whose `(` sits at openIdx: depth-matched
  // close over masked text; TEXT sliced from stripped so string defaults keep
  // their real content. Falls back to first-`)` when unbalanced (cap hit).
  const paramsFrom = (openIdx) => {
    const closeIdx = readBalanced(masked, openIdx);
    if (closeIdx === -1) {
      const naive = stripped.indexOf(')', openIdx);
      return { params: stripped.slice(openIdx + 1, naive === -1 ? openIdx + 1 : naive), closeIdx: naive };
    }
    return { params: stripped.slice(openIdx + 1, closeIdx), closeIdx };
  };

  const blockEndIdx = (bodyStart) => bodyStart + extractBlock(masked, bodyStart).length;
  /**
   * Index of the `{` that opens a class body, scanning from just after the
   * class name, or -1 when there is none.
   *
   * Depth-aware so a call-expression superclass (`extends Mixin(Base)`) and a
   * generic argument list are stepped over rather than mistaken for the body.
   * Bounded, so a malformed class cannot walk the rest of the file.
   */
  const findClassBody = (from) => {
    let depth = 0;
    const limit = Math.min(masked.length, from + 600);
    for (let i = from; i < limit; i++) {
      const c = masked[i];
      if (c === '(' || c === '<' || c === '[') depth++;
      else if (c === ')' || c === '>' || c === ']') depth = Math.max(0, depth - 1);
      else if (c === '{' && depth === 0) return i;
      else if (c === ';' || c === '=') return -1;   // not a class declaration
    }
    return -1;
  };

  // End line for a function whose params close just before `matchEnd`.
  const fnEndLine = (matchEnd, startLn) => {
    const brace = masked.indexOf('{', matchEnd);
    return brace !== -1 ? lineAt(stripped, blockEndIdx(brace + 1)) : startLn;
  };

  // Classes
  //
  // The heritage clause is NOT matched by this regex, only the class name.
  // Trying to match it inline silently dropped whole classes: `extends
  // Mixin(LitElement)` — the idiomatic Lit/web-component composition — never
  // matched `extends [\w.]+` followed by `{`, and because the extends group
  // was optional the fallback failed too. On ing-bank/lion that was 111 of
  // 326 classes (34%) extracted as nothing at all: no class, no methods.
  // `findClassBody` walks to the body brace instead, so any superclass
  // expression works. Leading whitespace is allowed as well, which is what
  // makes the mixin-factory form (`superclass => class X extends superclass`)
  // reachable — its class sits indented on its own line.
  const classRegex = /^[ \t]*(export\s+(?:default\s+)?)?class\s+(\w+)\b/gm;
  // Web-component surface (#537) — gated on detection, see typescript.js.
  const compMarkers = scanComponentMarkers(stripped);
  for (const m of stripped.matchAll(classRegex)) {
    const prefix = m[1] ? m[1].trim() + ' ' : '';
    const bodyBrace = findClassBody(m.index + m[0].length);
    if (bodyBrace === -1) continue;
    const heritage = stripped.slice(m.index + m[0].length, bodyBrace)
      .replace(/\s+/g, ' ').trim().replace(/^extends\s+/, '');
    const bodyStart = bodyBrace + 1;
    const blockEnd = blockEndIdx(bodyStart);
    const marker = markersForClass(compMarkers.decorated, stripped, m.index, m[0]);
    const definedTag = compMarkers.defined.get(m[2]);
    const isComponent = !!(marker || definedTag);
    // A call-expression superclass is mixin composition — `extends
    // LocalizeMixin(LitElement)` states which behaviours a component gets and
    // is not recoverable from anywhere else, so it is always rendered. A plain
    // `extends Base` stays gated on component detection, keeping every other
    // repo's output byte-identical.
    const base = heritage && (isComponent || heritage.includes('(')) ? ` extends ${heritage}` : '';
    sigs.push(`${prefix}class ${m[2]}${base}`);
    const classStartLn = lineAt(stripped, m.index);
    anchors.push([classStartLn, lineAt(stripped, blockEnd)]);
    const block = stripped.slice(bodyStart, blockEnd);
    const maskedBlock = masked.slice(bodyStart, blockEnd);
    if (isComponent) {
      const tag = (marker && marker.tag) || definedTag;
      if (tag) { sigs.push(`  custom element <${tag}>`); anchors.push([classStartLn, classStartLn]); }
      else if (marker && marker.selector) { sigs.push(`  selector '${marker.selector}'`); anchors.push([classStartLn, classStartLn]); }
      for (const cm of componentMembers(block)) {
        sigs.push(`  ${cm.text}`);
        anchors.push([lineAt(stripped, bodyStart + cm.start), lineAt(stripped, bodyStart + cm.end)]);
      }
    }
    for (const meth of extractClassMembers(block, maskedBlock, returnHints)) {
      sigs.push(`  ${meth.text}`);
      anchors.push([lineAt(stripped, bodyStart + meth.start), lineAt(stripped, bodyStart + meth.end)]);
    }
  }

  // Exported named functions
  for (const m of stripped.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)\s*\(/gm)) {
    const asyncKw = /export\s+async/.test(m[0]) ? 'async ' : '';
    const retStr = formatReturnHint(returnHints.get(m[1]));
    const startLn = lineAt(stripped, m.index);
    const { params, closeIdx } = paramsFrom(m.index + m[0].length - 1);
    sigs.push(`export ${asyncKw}function ${m[1]}(${normalizeParams(params)})${retStr}`);
    docHintFor[sigs.length - 1] = docHints.get(m[1]);
    anchors.push([startLn, fnEndLine(closeIdx + 1, startLn)]);
  }

  // Exported arrow functions
  for (const m of stripped.matchAll(/^export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/gm)) {
    const { params, closeIdx } = paramsFrom(m.index + m[0].length - 1);
    if (closeIdx === -1 || !/^\s*=>/.test(masked.slice(closeIdx + 1, closeIdx + 40))) continue;
    const asyncKw = m[0].includes('async') ? 'async ' : '';
    const retStr = formatReturnHint(returnHints.get(m[1]));
    const startLn = lineAt(stripped, m.index);
    sigs.push(`export const ${m[1]} = ${asyncKw}(${normalizeParams(params)}) =>${retStr}`);
    docHintFor[sigs.length - 1] = docHints.get(m[1]);
    anchors.push([startLn, fnEndLine(closeIdx + 1, startLn)]);
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
  for (const m of stripped.matchAll(/^(?:async\s+)?function\s+(\w+)\s*\(/gm)) {
    const asyncKw = m[0].startsWith('async') ? 'async ' : '';
    const retStr = formatReturnHint(returnHints.get(m[1]));
    const startLn = lineAt(stripped, m.index);
    const { params, closeIdx } = paramsFrom(m.index + m[0].length - 1);
    sigs.push(`${asyncKw}function ${m[1]}(${normalizeParams(params)})${retStr}`);
    docHintFor[sigs.length - 1] = docHints.get(m[1]);
    anchors.push([startLn, fnEndLine(closeIdx + 1, startLn)]);
  }

  const withAnchors = sigs.map((s, i) => {
    const anchored = anchors[i] ? withAnchor(s, anchors[i][0], anchors[i][1]) : s;
    return docHintFor[i] ? `${anchored}  # ${docHintFor[i]}` : anchored;
  });
  return capWithNotice(withAnchors, 200, 'signatures');
}

function extractBlock(src, startIndex) {
  let depth = 1;
  let i = startIndex;
  const end = Math.min(src.length, startIndex + MAX_CLASS_BODY_CHARS);
  while (i < end && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(startIndex, i - 1);
}

const _CTRL_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'do', 'try', 'catch', 'finally', 'else', 'return']);

// Returns members as { text, start, end } where start/end are char offsets
// WITHIN `block` (end = the method's closing brace), so the caller can resolve
// per-method line anchors that span the method body. `maskedBlock` is the
// same-offset maskCode slice used for balanced-delimiter scanning.
function extractClassMembers(block, maskedBlock, returnHints) {
  const members = [];
  for (const m of maskedBlock.matchAll(/^\s+(?:static\s+|async\s+|get\s+|set\s+)*(\w+)\s*\(/gm)) {
    if (/^_/.test(m[1])) continue;
    if (_CTRL_KEYWORDS.has(m[1])) continue;
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = readBalanced(maskedBlock, openIdx);
    if (closeIdx === -1) continue;
    const braceMatch = maskedBlock.slice(closeIdx + 1, closeIdx + 40).match(/^\s*\{/);
    if (!braceMatch) continue;
    const params = block.slice(openIdx + 1, closeIdx);
    const bodyStart = closeIdx + 1 + braceMatch[0].length; // just past the opening brace
    const end = bodyStart + extractBlock(maskedBlock, bodyStart).length;
    const start = m.index + (m[0].length - m[0].replace(/^\s+/, '').length);
    if (m[1] === 'constructor') { members.push({ text: `constructor(${normalizeParams(params)})`, start, end }); continue; }
    const isAsync = m[0].includes('async ') ? 'async ' : '';
    const isStatic = m[0].includes('static ') ? 'static ' : '';
    const retStr = formatReturnHint(returnHints.get(m[1]));
    members.push({ text: `${isStatic}${isAsync}${m[1]}(${normalizeParams(params)})${retStr}`, start, end });
  }
  return capMembersWithNotice(members, 120, 'methods');
}

// One linear pass over well-formed docblocks. The previous three matchAll
// passes used `\/\*\*[\s\S]*?@returns?...[\s\S]*?\*\/` — lazy gaps free to
// scan ACROSS comment boundaries, so every docblock without a matching
// declaration tail walked toward end-of-file: O(n²) on docblock-dense files,
// measured at 93.6% of a full 15s self-generate (#615). The docblock-bounded
// shape below is the one buildDocHints already uses, which profiles at ~0%.
const RETURN_TAG = /@returns?\s+\{([^}]+)\}/;
const RETURN_DECLS = [
  /\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/y,
  /\s*export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/y,
  /\s*(?:static\s+|async\s+|get\s+|set\s+)*(\w+)\s*\(/y,
];

function buildReturnHints(src) {
  const hints = new Map();
  for (const block of src.matchAll(/\/\*\*(?:[^*]|\*(?!\/))*\*\//g)) {
    const tag = RETURN_TAG.exec(block[0]);
    if (!tag) continue;
    const end = block.index + block[0].length;
    for (const decl of RETURN_DECLS) {
      decl.lastIndex = end;
      const m = decl.exec(src);
      if (m) hints.set(m[1], normalizeType(tag[1]));
    }
  }
  return hints;
}

// First prose sentence of the JSDoc block immediately preceding a top-level
// function (same three shapes as buildReturnHints). Mirrors the Python
// extractor's extractDocHint: first sentence only, 60-char cap.
function buildDocHints(src) {
  const hints = new Map();
  // Body may not contain `*/` — otherwise a failed adjacency check would let
  // the match expand across a whole function to the next comment block and
  // misattribute the hint.
  const patterns = [
    /\/\*\*((?:[^*]|\*(?!\/))*)\*\/\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,
    /\/\*\*((?:[^*]|\*(?!\/))*)\*\/\s*export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
  ];
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      const hint = firstDocSentence(m[1]);
      if (hint && !hints.has(m[2])) hints.set(m[2], hint);
    }
  }
  return hints;
}

// First non-tag prose line of a JSDoc body → first sentence, 60-char cap.
function firstDocSentence(body) {
  const line = String(body).split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .find((l) => l && !l.startsWith('@'));
  if (!line) return '';
  return line.split(/[.!?]/)[0].trim().slice(0, 60);
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
