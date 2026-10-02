'use strict';

const { lineAt, withAnchor } = require('./line-anchor');
const { stripComments, maskCode, readBalanced } = require('./scan');
const { capWithNotice, capMembersWithNotice } = require('../util/truncate');

const MAX_CLASS_BODY_CHARS = 200000;
const MAX_MEMBERS_PER_CLASS = 120;
const MAX_SIGS_PER_FILE = 200;
const GRADLE_BLOCKS = new Set([
  'plugins', 'dependencies', 'repositories', 'subprojects', 'allprojects',
  'publishing', 'android', 'java', 'kotlin', 'sourceSets', 'configurations', 'buildscript',
]);
const DECL_KEYWORDS = /\b(?:class|interface|trait|enum|def|task|plugins|dependencies|repositories)\b/;

/** Extract anchored Groovy declarations and the structural surface of Gradle scripts. */
function extract(src, filePath) {
  if (!src || typeof src !== 'string') return [];
  const stripped = stripComments(src);
  const masked = maskCode(src);
  const sigs = [];
  const bodyEnd = (open) => {
    const close = readBalanced(masked, open, '{', '}', MAX_CLASS_BODY_CHARS);
    return close < 0 ? open : close;
  };
  const add = (text, start, end) => sigs.push(withAnchor(text, lineAt(stripped, start), lineAt(stripped, end)));

  const typeRe = /^[ \t]*(?:(?:@[A-Za-z_]\w*(?:\([^\n{}]*\))?|public|protected|private|abstract|final|static|sealed)\s+)*(class|interface|trait|enum)\s+(\w+)/gm;
  for (const match of stripped.matchAll(typeRe)) {
    const decl = match.index + match[0].indexOf(match[1]);
    const open = findBody(masked, match.index + match[0].length, 500, true);
    if (open < 0) { add(`${match[1]} ${match[2]}`, decl, decl); continue; }
    const close = bodyEnd(open);
    add(`${match[1]} ${match[2]}`, decl, close);
    const nested = blankNestedTypes(stripped.slice(open + 1, close), masked.slice(open + 1, close));
    const members = extractMethods(nested.text, nested.mask, open + 1, stripped, false);
    members.push(...extractConstructors(nested.text, nested.mask, open + 1, stripped, match[2]));
    const cappedMembers = capMembersWithNotice(members.map((text) => ({ text })), MAX_MEMBERS_PER_CLASS);
    for (const member of cappedMembers) sigs.push(member.text);
  }

  const topLevel = blankNestedTypes(stripped, masked);
  for (const method of extractMethods(topLevel.text, topLevel.mask, 0, stripped, true)) sigs.push(method);

  for (const closure of extractClosures(topLevel.text, topLevel.mask, stripped)) sigs.push(closure);

  // Gradle's useful surface is its named DSL blocks and task declarations, not
  // dependency coordinates (those belong to src/deps/inventory.js).
  if (String(filePath || '').toLowerCase().endsWith('.gradle')) {
    const dslRe = /^[ \t]*([A-Za-z_]\w*)\s*(\(([^\n{}]*)\))?\s*\{/gm;
    for (const match of stripped.matchAll(dslRe)) {
      const name = match[1];
      if (!GRADLE_BLOCKS.has(name)) continue;
      const start = match.index + match[0].indexOf(name);
      const open = masked.indexOf('{', match.index + match[0].length - 1);
      add(`${name} { }`, start, bodyEnd(open));
    }
    for (const match of stripped.matchAll(/^\s*tasks\.register\s*\(([^\n{}]*)\)\s*\{/gm)) {
      const open = masked.indexOf('{', match.index + match[0].length - 1);
      add(`tasks.register(${renderCallArgs(match[1])})`, match.index + match[0].indexOf('tasks'), bodyEnd(open));
    }
    for (const match of stripped.matchAll(/^\s*task\s+([A-Za-z_]\w*)\s*\(\s*type\s*:\s*([\w.]+)\s*\)\s*\{/gm)) {
      const open = masked.indexOf('{', match.index + match[0].length - 1);
      add(`task ${match[1]}(type: ${match[2]})`, match.index, bodyEnd(open));
    }
  }

  return capWithNotice([...new Set(sigs)], MAX_SIGS_PER_FILE, 'signatures');
}

function findBody(masked, from, cap, header = false) {
  for (let i = from; i < Math.min(masked.length, from + cap); i++) {
    if (masked[i] === '{') return i;
    if (masked[i] === '(' || masked[i] === '[' || masked[i] === '<') {
      const close = readBalanced(masked, i, masked[i], ({ '(': ')', '[': ']', '<': '>' })[masked[i]]);
      if (close >= 0) { i = close; continue; }
    }
    if (header && masked[i] === '\n') {
      const next = masked.indexOf('\n', i + 1);
      const nextLine = masked.slice(i + 1, next < 0 ? masked.length : next);
      if (!nextLine.trim() || DECL_KEYWORDS.test(nextLine)) return -1;
    }
    if (masked[i] === ';' || masked[i] === '=') return -1;
  }
  return -1;
}

function extractMethods(text, mask, offset, original, topLevel) {
  const out = [];
  const methodRe = /^[ \t]*(?:(?:public|protected|private|static|final|synchronized|abstract)\s+)*(?:def|[A-Za-z_][\w.$<>\[\]]*)\s+([A-Za-z_]\w*)\s*\(/gm;
  for (const match of text.matchAll(methodRe)) {
    if (/^\s*task\b/.test(match[0])) continue;
    if (/\b(?:private|protected)\b/.test(match[0])) continue;
    const open = mask.indexOf('(', match.index + match[0].length - 1);
    const close = readBalanced(mask, open);
    if (open < 0 || close < 0) continue;
    let cursor = close + 1;
    while (/[ \t]/.test(mask[cursor] || '')) cursor++;
    const returnMatch = /:\s*([A-Za-z_][\w.$<>\[\]]*)/.exec(text.slice(cursor, cursor + 200));
    const header = match[0].replace(/\s+/g, ' ').trim();
    const declaredType = /(?:^|\s)(def|[A-Za-z_][\w.$<>\[\]]*)\s+[A-Za-z_]\w*\s*\($/.exec(header);
    const returnType = returnMatch ? ` → ${returnMatch[1]}`
      : (declaredType && declaredType[1] !== 'def' ? ` → ${declaredType[1]}` : '');
    const openBody = mask.indexOf('{', close);
    const end = openBody >= 0 ? bodyEndAt(mask, openBody) : close;
    const indent = topLevel ? '' : '  ';
    out.push(withAnchor(`${indent}${match[1]}(${renderParams(text.slice(open + 1, close), mask.slice(open + 1, close))})${returnType}`, lineAt(original, offset + match.index), lineAt(original, offset + end)));
  }
  return out;
}

function extractClosures(text, mask, original) {
  const out = [];
  for (const match of text.matchAll(/^[ \t]*(?:def|[A-Za-z_][\w.$<>\[\]]*)\s+([A-Za-z_]\w*)\s*=\s*\{/gm)) {
    const open = mask.indexOf('{', match.index + match[0].length - 1);
    if (open < 0) continue;
    const close = bodyEndAt(mask, open);
    const arrow = text.indexOf('->', open + 1);
    const params = arrow >= 0 && arrow < close ? renderParams(text.slice(open + 1, arrow), mask.slice(open + 1, arrow)) : '';
    out.push(withAnchor(`  def ${match[1]} = { ${params}${params ? ' ' : ''}-> }`, lineAt(original, match.index), lineAt(original, close)));
  }
  return out;
}

function extractConstructors(text, mask, offset, original, typeName) {
  const out = [];
  const re = new RegExp(`^[ \\t]*${typeName}\\s*\\(`, 'gm');
  for (const match of text.matchAll(re)) {
    const open = mask.indexOf('(', match.index + match[0].length - 1);
    const close = readBalanced(mask, open);
    if (open < 0 || close < 0) continue;
    const body = mask.indexOf('{', close);
    const end = body >= 0 ? bodyEndAt(mask, body) : close;
    out.push(withAnchor(`  ${typeName}(${renderParams(text.slice(open + 1, close), mask.slice(open + 1, close))})`, lineAt(original, offset + match.index), lineAt(original, offset + end)));
  }
  return out;
}

function bodyEndAt(mask, open) {
  const close = readBalanced(mask, open, '{', '}', MAX_CLASS_BODY_CHARS);
  return close < 0 ? open : close;
}

function blankNestedTypes(text, mask) {
  const chars = text.split('');
  const masked = mask.split('');
  for (const match of text.matchAll(/^[ \t]*(?:class|interface|trait|enum)\s+\w+/gm)) {
    const open = findBody(mask, match.index + match[0].length, 500);
    if (open < 0) continue;
    const close = readBalanced(mask, open, '{', '}', MAX_CLASS_BODY_CHARS);
    for (let i = open; i <= (close < 0 ? mask.length - 1 : close); i++) {
      if (chars[i] !== '\n') chars[i] = ' ';
      if (masked[i] !== '\n') masked[i] = ' ';
    }
  }
  return { text: chars.join(''), mask: masked.join('') };
}

function renderParams(raw, masked) {
  const parts = splitParams(String(raw || ''), masked || maskCode(String(raw || '')));
  return parts.map((part) => {
    const withoutDefault = part.replace(/=(?!=).*$/, '').trim();
    const withoutAnnotations = withoutDefault.replace(/@[A-Za-z_]\w*(?:\([^)]*\))?\s*/g, '').trim();
    const name = withoutAnnotations.match(/([A-Za-z_]\w*)\s*$/);
    return name ? name[1] : withoutAnnotations;
  }).filter(Boolean).join(', ');
}

function splitParams(raw, masked) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < masked.length; i++) {
    if ('([{<'.includes(masked[i])) depth++;
    else if (')]}>' .includes(masked[i])) depth--;
    else if (masked[i] === ',' && depth === 0) {
      parts.push(raw.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(raw.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function renderCallArgs(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

module.exports = { extract };