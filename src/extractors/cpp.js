'use strict';

const { capWithNotice, capMembersWithNotice } = require('../util/truncate');
const { stripComments, maskCode } = require('./scan');
const { withAnchor } = require('./line-anchor');

// Ceilings sit above the default `maxSigsPerFile` so the configured budget
// governs output rather than a literal buried here, and omissions are disclosed
// — an undisclosed cap looks like a class that simply has eight methods (#576).
const MEMBER_LIMIT = 120;
const PER_FILE_LIMIT = 200;
// Past this a file is generated or data, not a declaration surface worth scanning.
const MAX_SOURCE = 4 * 1024 * 1024;
const MAX_PARAMS = 200;
const MAX_RETURN = 30;

/**
 * Extract signatures from C/C++ source code (Tier 2, #975).
 *
 * The source is masked (comments, strings and preprocessor lines blanked, every
 * newline kept), cut into tokens, and read one declaration at a time: namespaces
 * and `extern "C"` blocks are transparent, a class, struct or union lists the
 * functions it declares or defines under it, and a function is listed whether it
 * has a body or only a prototype (a header is a declaration surface). Each
 * signature carries the `:start-end` lines of its declaration, from its first
 * token (a `template <...>` header included) to the `;` or the closing `}`.
 *
 * What it does not do is expand macros or resolve names, so it is a reading of
 * the text and not of the program: a function a macro writes is not listed, an
 * `#if` that opens a brace in one branch and not in another can swallow the rest
 * of the file, and a statement it cannot place is skipped rather than guessed.
 *
 * @param {string} src - Raw file content
 * @param {string} [filePath]
 * @returns {string[]} Array of signature strings
 */
function extract(src, filePath) {
  if (!src || typeof src !== 'string') return [];
  // stripComments is length- AND newline-preserving; the previous strip DELETED
  // comment text, so offsets no longer aligned with the masked surface the
  // balanced reader walks (#695).
  const stripped = stripComments(src);

  // `.h` is shared with Objective-C. Sniffed on the comment-stripped text: a
  // C++ header that only MENTIONS `@interface` in a comment is still C++.
  if (/^\s*@(?:interface|implementation|protocol)\b/m.test(stripped) || /^\s*#import\b/m.test(stripped)) {
    return require('./objc').extract(src, filePath);
  }
  if (src.length > MAX_SOURCE) return [];

  const toks = tokenize(maskCode(blankDirectives(src)));
  const nodes = [];
  new Reader(toks, stripped).block(0, toks.length, { out: nodes, cls: null });

  const sigs = [];
  render(nodes, 0, sigs);
  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

// ── Output ───────────────────────────────────────────────────────────────────

function render(nodes, depth, sigs) {
  const pad = '  '.repeat(depth);
  const lines = [];
  for (const n of nodes) {
    if (n.kind === 'func') {
      if (/^_/.test(n.name.split('::').pop())) continue; // underscore names are left out on purpose
      lines.push({ text: `${pad}${n.name}(${n.params})${n.ret ? ` → ${n.ret}` : ''}`, n });
    } else {
      lines.push({ text: `${pad}${n.keyword} ${n.name}`, n });
    }
  }
  for (const l of lines) {
    sigs.push(withAnchor(l.text, l.n.start, l.n.end));
    if (l.n.members) {
      const inner = [];
      render(l.n.members, depth + 1, inner);
      // a class body that holds only nested classes still lists them; the cap counts lines
      for (const m of capMembersWithNotice(inner.map((t) => ({ text: t })), MEMBER_LIMIT, 'members')) sigs.push(m.text);
    }
  }
}

// ── Masking and tokens ───────────────────────────────────────────────────────

/**
 * Blank every preprocessor line (with its backslash continuations), keeping the newlines. Done on the raw
 * text, before the masking: an unquoted apostrophe in `#error don't` would otherwise open a character
 * literal that runs into the code below it.
 */
function blankDirectives(text) {
  const out = text.split('');
  const n = text.length;
  let i = 0;
  while (i < n) {
    let e = text.indexOf('\n', i);
    if (e < 0) e = n;
    let j = i;
    while (j < e && (text[j] === ' ' || text[j] === '\t')) j++;
    if (text[j] === '#') {
      for (;;) {
        for (let q = i; q < e; q++) out[q] = ' ';
        let b = e - 1;
        if (b >= i && text[b] === '\r') b--;
        if (b >= i && text[b] === '\\' && e < n) { i = e + 1; e = text.indexOf('\n', i); if (e < 0) e = n; continue; }
        break;
      }
    }
    i = e + 1;
  }
  return out.join('');
}

const isIdStart = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36 || c > 127;
const isIdPart = (c) => isIdStart(c) || (c >= 48 && c <= 57);
const isDigit = (c) => c >= 48 && c <= 57;

/** Tokens: `{ t: 'id'|'num'|'str'|'p', v, line, i, end }` (`i`/`end` are offsets into the masked text). */
function tokenize(m) {
  const toks = [];
  const n = m.length;
  let line = 1;
  let i = 0;
  while (i < n) {
    const c = m.charCodeAt(i);
    if (c === 10) { line++; i++; continue; }
    if (c === 32 || c === 9 || c === 13 || c === 12 || c === 11) { i++; continue; }
    if (isIdStart(c)) {
      let j = i + 1;
      while (j < n && isIdPart(m.charCodeAt(j))) j++;
      toks.push({ t: 'id', v: m.slice(i, j), line, i, end: j });
      i = j;
      continue;
    }
    if (isDigit(c)) {
      let j = i + 1;
      while (j < n && (isIdPart(m.charCodeAt(j)) || m[j] === '.' || m[j] === "'")) j++;
      toks.push({ t: 'num', v: m.slice(i, j), line, i, end: j });
      i = j;
      continue;
    }
    if (c === 34 || c === 39) {
      // the masked literal keeps its quotes and blanks the inside, so the next same quote closes it
      let j = i + 1;
      const startLine = line;
      while (j < n && m.charCodeAt(j) !== c) { if (m.charCodeAt(j) === 10) line++; j++; }
      toks.push({ t: 'str', v: '"', line: startLine, i, end: j + 1 });
      i = j + 1;
      continue;
    }
    const two = m.slice(i, i + 2);
    if (two === '::' || two === '->') { toks.push({ t: 'p', v: two, line, i, end: i + 2 }); i += 2; continue; }
    if (m.startsWith('...', i)) { toks.push({ t: 'p', v: '...', line, i, end: i + 3 }); i += 3; continue; }
    toks.push({ t: 'p', v: m[i], line, i, end: i + 1 });
    i++;
  }
  return toks;
}

/** For every `(`, `[` and `{`, the index of its closer (and the other way round); -1 when unmatched. */
function pairBrackets(toks) {
  const pair = new Int32Array(toks.length).fill(-1);
  const CLOSE = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  for (let i = 0; i < toks.length; i++) {
    const v = toks[i].v;
    if (toks[i].t !== 'p') continue;
    if (CLOSE[v]) { stack.push(i); continue; }
    if (v === ')' || v === ']' || v === '}') {
      // a closer that does not match the innermost opener closes the openers an `#if` left open
      let k = stack.length - 1;
      while (k >= 0 && CLOSE[toks[stack[k]].v] !== v) k--;
      if (k < 0) continue;
      const open = stack[k];
      stack.length = k;
      pair[open] = i;
      pair[i] = open;
    }
  }
  return pair;
}

// ── The reader ───────────────────────────────────────────────────────────────

const SKIPPED_SPECIFIERS = new Set([
  'static', 'inline', 'virtual', 'constexpr', 'consteval', 'constinit', 'extern', 'explicit', 'mutable',
  'register', 'thread_local', '__inline', '__inline__', '__forceinline', '_Noreturn', '__extension__',
]);
const ATTRIBUTE_CALLS = new Set(['__attribute__', '__declspec', 'alignas', '_Alignas', '__asm__', '__asm', 'asm']);
const NOT_A_FUNCTION = new Set([
  'if', 'for', 'while', 'switch', 'return', 'sizeof', 'alignof', 'decltype', 'typeof', '__typeof__', 'static_assert',
  '_Static_assert', 'defined', 'catch', 'throw', 'new', 'delete', 'case', 'else', 'do', 'noexcept', 'requires', '_Generic',
  'typeid', 'co_return', 'co_await', 'co_yield', 'using', 'namespace', 'typedef',
]);
const DECL_KEYWORDS = new Set(['class', 'struct', 'union', 'enum', 'namespace', 'template', 'typedef', 'extern', 'inline', 'static', 'using', 'friend', 'virtual', 'constexpr']);
const ACCESS = new Set(['public', 'private', 'protected']);
const TYPE_PARENS = new Set(['decltype', 'typeof', '__typeof__', '_Atomic', 'typename']);
const TAIL_WORDS = new Set(['const', 'volatile', 'noexcept', 'override', 'final', 'throw', 'mutable', 'try']);
// An export or attribute macro: upper case with an underscore (`UV_EXTERN`, `ABSL_MUST_USE_RESULT`).
// `FILE` or `DWORD` is a type and is kept.
const isMacroName = (v) => /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(v);
const TYPE_WORDS = new Set(['unsigned', 'signed', 'long', 'short', 'int', 'char', 'float', 'double', 'bool', 'void', 'auto', 'wchar_t', 'char8_t', 'char16_t', 'char32_t', '_Bool', '_Complex']);
const ELABORATED = new Set(['struct', 'union', 'enum', 'class', 'typename']);

/**
 * Whether the tokens in front of a name read as a type that ends in a name of its own (`int count`,
 * `std::vector<int>* items`): a variable that a macro call annotates, not a return type.
 */
function endsInDeclarator(toks) {
  const t = toks.filter((x) => !(x.t === 'id' && (SKIPPED_SPECIFIERS.has(x.v) || x.v === 'const' || x.v === 'volatile' || isMacroName(x.v))));
  const last = t[t.length - 1];
  const prev = t[t.length - 2];
  if (!last || !prev || last.t !== 'id' || TYPE_WORDS.has(last.v)) return false;
  if (prev.t === 'id') return !ELABORATED.has(prev.v);
  return prev.v === '*' || prev.v === '&' || prev.v === '&&' || prev.v === '>';
}

class Reader {
  constructor(toks, stripped) {
    this.toks = toks;
    this.src = stripped;
    this.pair = pairBrackets(toks);
  }

  /** Read declarations from token `i` up to `end` (exclusive) into `ctx.out`. */
  block(i, end, ctx) {
    const { toks } = this;
    while (i < end) {
      const t = toks[i];
      if (t.v === ';' || t.v === '}' || t.v === ')' || t.v === ']') { i++; continue; }
      if (t.t === 'id' && ACCESS.has(t.v) && toks[i + 1] && toks[i + 1].v === ':') { i += 2; continue; }
      const next = this.statement(i, end, ctx);
      i = next > i ? next : i + 1;
    }
  }

  /** The token index just past a `<...>` group opening at `open`, or -1 when it does not close before `end`. */
  angles(open, end) {
    const { toks, pair } = this;
    let depth = 0;
    for (let k = open; k < end; k++) {
      const v = toks[k].v;
      if (toks[k].t === 'p') {
        if (v === '<') depth++;
        else if (v === '>') { depth--; if (depth === 0) return k + 1; }
        else if (v === '(' || v === '[' || v === '{') { if (pair[k] < 0) return -1; k = pair[k]; }
        else if (v === ';' || v === '}') return -1;
      }
    }
    return -1;
  }

  /** Index of the first token of the declaration proper, past specifiers, attributes and annotation macros. */
  prefix(j, end) {
    const { toks, pair } = this;
    for (;;) {
      const t = toks[j];
      if (!t || j >= end) return j;
      if (t.t === 'id' && SKIPPED_SPECIFIERS.has(t.v)) { j++; continue; }
      if (t.v === '[' && toks[j + 1] && toks[j + 1].v === '[') { if (pair[j] < 0) return j; j = pair[j] + 1; continue; }
      if (t.t === 'id' && ATTRIBUTE_CALLS.has(t.v) && toks[j + 1] && toks[j + 1].v === '(') {
        if (pair[j + 1] < 0) return j;
        j = pair[j + 1] + 1;
        continue;
      }
      if (t.t === 'id' && isMacroName(t.v)) {
        // `ABSL_NAMESPACE_BEGIN class Foo`, `UV_EXTERN struct x {`: a macro in front of a declaration keyword
        let k = j + 1;
        if (toks[k] && toks[k].v === '(' && pair[k] >= 0) k = pair[k] + 1;
        if (toks[k] && toks[k].t === 'id' && DECL_KEYWORDS.has(toks[k].v)) { j = k; continue; }
      }
      return j;
    }
  }

  /** Read one statement starting at `i`; returns the index to continue from. */
  statement(i, end, ctx) {
    const { toks, pair } = this;
    let j = i;

    // A macro written as a statement of its own (`SPDLOG_NAMESPACE_BEGIN`, `UV_PRIVATE_REQ_TYPES`) has
    // no `;`, so it would run into the declaration below it and pull its first line up. One line apart
    // it is an attribute (`UV_EXTERN` above its return type); a blank line or more apart it is its own.
    const lead = toks[i];
    if (lead.t === 'id' && isMacroName(lead.v) && toks[i + 1] && toks[i + 1].v !== '(' && toks[i + 1].line - lead.line >= 2) return i + 1;

    // template <...> headers, however many
    while (toks[j] && toks[j].v === 'template' && toks[j + 1] && toks[j + 1].v === '<') {
      const after = this.angles(j + 1, end);
      if (after < 0) return this.skip(j, end);
      j = after;
    }

    // `extern "C" {`: the masking blanks the string, quotes included, so the brace follows `extern` directly
    if (toks[j] && toks[j].v === 'extern') {
      const open = toks[j + 1] && toks[j + 1].t === 'str' ? j + 2 : j + 1;
      if (toks[open] && toks[open].v === '{') {
        const close = pair[open];
        this.block(open + 1, close < 0 ? end : close, ctx);
        return close < 0 ? end : close + 1;
      }
    }

    const first = toks[j];
    if (!first) return end;
    if (first.v === 'friend' || first.v === 'using' || first.v === 'static_assert' || first.v === '_Static_assert') return this.skip(j, end);
    if (first.v === 'typedef') return this.typedef(i, j, end, ctx);
    if (first.v === '{') return pair[j] < 0 ? end : pair[j] + 1; // a block a macro left behind

    if (first.v === 'namespace' || (first.v === 'inline' && toks[j + 1] && toks[j + 1].v === 'namespace')) {
      let k = j + (first.v === 'inline' ? 2 : 1);
      while (k < end && toks[k].v !== '{' && toks[k].v !== ';' && toks[k].v !== '=') k++;
      if (toks[k] && toks[k].v === '{') {
        const close = pair[k];
        this.block(k + 1, close < 0 ? end : close, ctx);
        return close < 0 ? end : close + 1;
      }
      return this.skip(j, end);
    }

    const p = this.prefix(j, end);
    const head = toks[p];
    if (!head) return end;
    if (head.v === 'class' || head.v === 'struct' || head.v === 'union') {
      const r = this.record(i, p, end, ctx);
      if (r >= 0) return r;
    } else if (head.v === 'enum') {
      const r = this.enumeration(i, p, end, ctx);
      if (r >= 0) return r;
    } else if (head.v === 'namespace') {
      return this.statement(p, end, ctx);
    }
    return this.declaration(i, p, end, ctx);
  }

  /** Skip a statement we do not list: to its `;`, or past its `{...}` body. */
  skip(i, end) {
    const { toks, pair } = this;
    let sawEquals = false;
    for (let k = i; k < end; k++) {
      const v = toks[k].v;
      if (toks[k].t !== 'p') continue;
      if (v === ';') return k + 1;
      if (v === '=') sawEquals = true;
      else if (v === '(' || v === '[') { if (pair[k] >= 0) k = pair[k]; }
      else if (v === '{') {
        if (pair[k] < 0) return end;
        k = pair[k];
        if (sawEquals) continue;
        return toks[k + 1] && toks[k + 1].v === ';' ? k + 2 : k + 1;
      } else if (v === '}') return k;
    }
    return end;
  }

  /** `typedef`: a named struct/union/enum is listed, everything else is skipped. */
  typedef(i, j, end, ctx) {
    const { toks } = this;
    const k = this.prefix(j + 1, end);
    const kw = toks[k] && toks[k].v;
    if (kw === 'struct' || kw === 'union' || kw === 'class') { const r = this.record(i, k, end, ctx); if (r >= 0) return r; }
    if (kw === 'enum') { const r = this.enumeration(i, k, end, ctx); if (r >= 0) return r; }
    return this.skip(j, end);
  }

  /** The head of a class, struct or union at `p`. Returns the index after it, or -1 when it is not a definition. */
  record(i, p, end, ctx) {
    const { toks, pair } = this;
    const keyword = toks[p].v;
    let k = p + 1;
    const names = [];
    let stop = -1; // where the name ends: the base clause, `final` or the brace
    for (; k < end; k++) {
      const t = toks[k];
      if (t.t === 'p') {
        if (t.v === '{') break;
        if (t.v === ';') return this.skip(i, end);
        // past the `:` a comma separates base classes; before it, one means this is not a class head
        if (t.v === '=' || t.v === '}' || t.v === ')' || (t.v === ',' && stop < 0)) return -1;
        if (t.v === '[' && toks[k + 1] && toks[k + 1].v === '[') { if (pair[k] < 0) return -1; k = pair[k]; continue; }
        if (t.v === '(') {
          const prev = toks[k - 1];
          // an attribute or annotation call (`__attribute__((packed))`, `ABSL_DEPRECATED("x")`) is not the name
          if (prev && prev.t === 'id' && (ATTRIBUTE_CALLS.has(prev.v) || isMacroName(prev.v)) && pair[k] >= 0) {
            if (names[names.length - 1] === prev) names.pop();
            k = pair[k];
            continue;
          }
          return -1;
        }
        if (t.v === '<') { const after = this.angles(k, end); if (after < 0) return -1; k = after - 1; continue; }
        if (t.v === ':' && stop < 0) { stop = k; continue; }
        continue;
      }
      if (stop >= 0) continue;
      if (t.t === 'id' && (t.v === 'final' || t.v === 'sealed')) { stop = k; continue; }
      if (t.t === 'id' && !ATTRIBUTE_CALLS.has(t.v)) names.push(t);
    }
    if (k >= end || toks[k].v !== '{') return -1;
    const open = k;
    const close = pair[open];
    const nameTok = names.filter((t) => !isMacroName(t.v)).pop() || names.pop();
    const lastLine = close < 0 ? toks[end - 1].line : toks[close].line;
    if (!nameTok) return this.afterDeclarators(close < 0 ? end : close + 1, end);
    const node = { kind: 'class', keyword, name: nameTok.v, start: toks[i].line, end: lastLine, members: [] };
    ctx.out.push(node);
    this.block(open + 1, close < 0 ? end : close, { out: node.members, cls: node });
    return this.afterDeclarators(close < 0 ? end : close + 1, end);
  }

  /** `enum`, `enum class`, `enum struct`. */
  enumeration(i, p, end, ctx) {
    const { toks, pair } = this;
    let k = p + 1;
    let scoped = false;
    if (toks[k] && (toks[k].v === 'class' || toks[k].v === 'struct')) { scoped = true; k++; }
    const names = [];
    let stop = false;
    for (; k < end; k++) {
      const t = toks[k];
      if (t.t === 'p') {
        if (t.v === '{') break;
        if (t.v === ';') return this.skip(i, end);
        if (t.v === '=' || t.v === '}' || t.v === ',' || t.v === ')') return -1;
        if (t.v === '(') {
          const prev = toks[k - 1];
          if (prev && prev.t === 'id' && (ATTRIBUTE_CALLS.has(prev.v) || isMacroName(prev.v)) && pair[k] >= 0) { if (names[names.length - 1] === prev) names.pop(); k = pair[k]; continue; }
          return -1;
        }
        if (t.v === ':') stop = true;
        continue;
      }
      if (!stop && t.t === 'id' && !ATTRIBUTE_CALLS.has(t.v)) names.push(t);
    }
    if (k >= end || toks[k].v !== '{') return -1;
    const close = pair[k];
    const nameTok = names.filter((t) => !isMacroName(t.v)).pop() || names.pop();
    if (nameTok) {
      ctx.out.push({ kind: 'enum', keyword: scoped ? 'enum class' : 'enum', name: nameTok.v, start: toks[i].line, end: close < 0 ? toks[end - 1].line : toks[close].line });
    }
    return this.afterDeclarators(close < 0 ? end : close + 1, end);
  }

  /** After a `}` that closed a type: declarators (`} x, *y;`) up to the `;`. */
  afterDeclarators(k, end) {
    const { toks, pair } = this;
    for (; k < end; k++) {
      const v = toks[k].v;
      if (v === ';') return k + 1;
      if (toks[k].t === 'p' && (v === '(' || v === '[' || v === '{') && pair[k] >= 0) { k = pair[k]; continue; }
      if (toks[k].t === 'p' && (v === '}' || v === ')')) return k;
      if (toks[k].t === 'id' && DECL_KEYWORDS.has(toks[k].v) && v !== 'static') return k; // a statement began without a `;`
    }
    return end;
  }

  /**
   * What follows a parameter list: cv-qualifiers, `noexcept`, `override`, a trailing return type, an
   * initialiser list, `= 0`, `= default`, `= delete`. Returns { body: index of `{` or -1, end: index
   * of the last token of the declaration, next: where to continue } or null when what follows is not
   * the end of a declarator (so the `(` was not the function's).
   */
  tail(p, end) {
    const { toks, pair } = this;
    for (let guard = 0; p < end && guard < 400; guard++) {
      const t = toks[p];
      const v = t.v;
      if (v === ';') return { body: -1, last: p, next: p + 1 };
      if (v === '{') {
        const c = pair[p];
        const last = c < 0 ? end - 1 : c;
        return { body: p, last, next: last + 1 + (toks[last + 1] && toks[last + 1].v === ';' ? 1 : 0) };
      }
      if (v === '=') {
        const w = toks[p + 1];
        if (w && (w.v === '0' || w.v === 'default' || w.v === 'delete') && toks[p + 2] && toks[p + 2].v === ';') return { body: -1, last: p + 2, next: p + 3 };
        return null;
      }
      if (v === ':') return this.initializers(p + 1, end);
      if (v === '->') {
        // trailing return type: up to the body, `;` or `= 0`
        let k = p + 1;
        while (k < end && toks[k].v !== '{' && toks[k].v !== ';' && toks[k].v !== '=') {
          if (toks[k].t === 'p' && (toks[k].v === '(' || toks[k].v === '[') && pair[k] >= 0) k = pair[k];
          k++;
        }
        p = k;
        continue;
      }
      if (v === '&' || v === '&&') { p++; continue; }
      if (t.t === 'id' && (TAIL_WORDS.has(v) || isMacroName(v) || ATTRIBUTE_CALLS.has(v))) {
        p++;
        if (toks[p] && toks[p].v === '(' && pair[p] >= 0) p = pair[p] + 1;
        continue;
      }
      if (t.t === 'id' && v === 'requires') { while (p < end && toks[p].v !== '{' && toks[p].v !== ';') p++; continue; }
      if (v === '[' && toks[p + 1] && toks[p + 1].v === '[' && pair[p] >= 0) { p = pair[p] + 1; continue; }
      return null;
    }
    return null;
  }

  /** A constructor's initialiser list, up to the body. `p` is the first token after the `:`. */
  initializers(p, end) {
    const { toks, pair } = this;
    for (let k = p; k < end; k++) {
      const t = toks[k];
      if (t.t !== 'p') continue;
      if (t.v === '(' || t.v === '[') { if (pair[k] < 0) return null; k = pair[k]; continue; }
      if (t.v === '{') {
        const prev = toks[k - 1];
        // `member{0}` and `Base<T>{}` initialise; the brace after `)` or `}` is the body
        if (prev && (prev.t === 'id' || prev.v === '>') ) { if (pair[k] < 0) return null; k = pair[k]; continue; }
        const c = pair[k];
        const last = c < 0 ? end - 1 : c;
        return { body: k, last, next: last + 1 + (toks[last + 1] && toks[last + 1].v === ';' ? 1 : 0) };
      }
      if (t.v === ';') return null;
    }
    return null;
  }

  /** The declaration starting at statement token `i`, whose meaningful part starts at `p`. */
  declaration(i, p, end, ctx) {
    const { toks, pair } = this;
    const cands = [];
    let k = p;
    for (; k < end; k++) {
      const t = toks[k];
      if (t.t === 'id' && t.v === 'operator') {
        // `operator<<`, `operator bool` run to the `(`; for `operator()` that is the name's own `(`, which is
        // rejected as a candidate (a `(` follows it) before its real parameter list is read
        let q = k + 1;
        while (q < end && toks[q].v !== '(' && toks[q].v !== ';' && toks[q].v !== '{') q++;
        k = q - 1;
        continue;
      }
      if (t.t === 'p') {
        const v = t.v;
        if (v === ';') return k + 1;
        if (v === '}') return k;
        if (v === '{') return this.skip(p, end); // a body or initialiser with no declarator we recognise
        if (v === '=') return this.skip(p, end);
        if (v === '[') { if (pair[k] >= 0) k = pair[k]; continue; }
        if (v === '<') { const after = this.angles(k, end); if (after > 0) k = after - 1; continue; }
        if (v === '(') {
          const close = pair[k];
          if (close < 0) return this.skip(p, end);
          const nameEnd = k - 1;
          const prev = toks[nameEnd];
          // `operator()` is a name, and its parameter list is the next group
          if (prev && prev.v === ')' && toks[nameEnd - 1] && toks[nameEnd - 1].v === '(' && toks[nameEnd - 2] && toks[nameEnd - 2].v === 'operator') {
            cands.push({ open: k, close, nameStart: nameEnd - 2 });
          } else if (prev && prev.v === ')' && pair[nameEnd] === nameEnd - 2 && toks[nameEnd - 1].t === 'id' && toks[nameEnd - 3] && (toks[nameEnd - 3].t === 'id' || toks[nameEnd - 3].v === '>' || toks[nameEnd - 3].v === '*' || toks[nameEnd - 3].v === '&')) {
            // `result_type (min)() { ... }`: the parentheses keep a function-like macro named `min` from expanding
            cands.push({ open: k, close, nameStart: nameEnd - 1, parenthesised: true });
          } else if (prev && prev.t === 'id' && !NOT_A_FUNCTION.has(prev.v) && !ATTRIBUTE_CALLS.has(prev.v)) {
            cands.push({ open: k, close, nameStart: nameEnd });
          } else if (prev && prev.t === 'p' && toks[this.operatorStart(nameEnd)] && toks[this.operatorStart(nameEnd)].v === 'operator') {
            cands.push({ open: k, close, nameStart: this.operatorStart(nameEnd) });
          }
          const cand = cands[cands.length - 1];
          if (cand && cand.open === k) {
            const tl = this.tail(close + 1, end);
            if (tl) {
              const fn = this.function(i, p, cand, tl, ctx);
              if (fn) return tl.next;
              return tl.next > k ? tl.next : this.skip(p, end);
            }
          }
          k = close;
          continue;
        }
      }
    }
    return end;
  }

  /** Index of the `operator` token that starts the operator name ending at `last`, or -1. */
  operatorStart(last) {
    const { toks } = this;
    for (let q = last; q >= 0 && q > last - 6; q--) {
      if (toks[q].t === 'id' && toks[q].v === 'operator') return q;
      if (toks[q].t === 'p' && (toks[q].v === ';' || toks[q].v === '{' || toks[q].v === '}')) return -1;
    }
    return -1;
  }

  /** Try to list the function whose parameter list is `cand`; returns the node or null. */
  function(i, p, cand, tl, ctx) {
    const { toks, pair, src } = this;
    let ns = cand.nameStart;
    // a conversion operator names a type: `operator bool`, `operator const char*`
    if (toks[ns].v !== 'operator' && toks[ns - 1] && toks[ns - 1].v === 'operator') ns--;
    let nameFrom = ns;
    // `~Foo`
    if (toks[nameFrom - 1] && toks[nameFrom - 1].v === '~') nameFrom--;
    // `A::B::name`, `A<T>::name`
    while (toks[nameFrom - 1] && toks[nameFrom - 1].v === '::') {
      let q = nameFrom - 2;
      if (toks[q] && toks[q].v === '>') {
        let depth = 0;
        while (q >= p) { if (toks[q].v === '>') depth++; else if (toks[q].v === '<') { depth--; if (depth === 0) break; } q--; }
        q--;
      }
      if (q < p || !toks[q] || toks[q].t !== 'id') break;
      nameFrom = q;
    }
    // the written name, without template arguments in the qualifier
    const nameText = cand.parenthesised ? toks[nameFrom].v : this.nameText(nameFrom, cand.open);
    if (!nameText) return null;
    const bare = nameText.split('::').pop();
    const isOperator = /^operator\b/.test(bare);
    if (!isOperator && NOT_A_FUNCTION.has(bare)) return null;

    // what stands before the name: the return type, plus specifiers. An annotation macro called with
    // arguments (`ABSL_DEPRECATED("x") void f();`) is not part of the type and is dropped.
    const before = [];
    let wrapped = null; // the argument tokens of the one macro call that was dropped: `CJSON_PUBLIC(const char *) name(`
    let calls = 0;
    for (let q = p; q < nameFrom - (cand.parenthesised ? 1 : 0); q++) {
      const t = toks[q];
      if (t.t === 'id' && isMacroName(t.v) && toks[q + 1] && toks[q + 1].v === '(' && pair[q + 1] >= 0) {
        calls++;
        wrapped = toks.slice(q + 2, pair[q + 1]);
        q = pair[q + 1];
        continue;
      }
      before.push(t);
    }
    // Any other parenthesis there is a macro call with no `;` that ran into this declaration
    // (`DECLARE(foo) TEST(a, b) { ... }`), except where a type itself has one (`decltype(x)`).
    for (let q = 0; q < before.length; q++) {
      if (before[q].v !== '(') continue;
      const prev = before[q - 1];
      if (!(prev && prev.t === 'id' && (TYPE_PARENS.has(prev.v) || ATTRIBUTE_CALLS.has(prev.v)))) return null;
    }
    const qualified = nameText.includes('::');
    const cls = ctx.cls;
    const parts = nameText.split('::');
    const isCtorLike = bare === (cls && cls.name) || /^~/.test(bare)
      || (qualified && (parts[parts.length - 2] === bare || parts[parts.length - 2] === bare.replace(/^~/, '')))
      || (isOperator && /^operator\s+[A-Za-z_]/.test(bare) && !/^operator\s*(new|delete)\b/.test(bare));
    // `int count GUARDED_BY(mu_);` is a variable and its annotation. A name in capitals after a type that ends in a
    // name of its own is that, not a function (`UTC()` after `time_zone` is one).
    if (!isOperator && !/[a-z]/.test(bare) && endsInDeclarator(before)) return null;
    const typeTokens = before.filter((t) => !(t.t === 'id' && (SKIPPED_SPECIFIERS.has(t.v) || isMacroName(t.v))) && !(t.v === '>' || t.v === '<'));
    // Where the type is the macro itself, the name is an ordinary one: `CJSON_PUBLIC(const char *) cJSON_Version(void)`
    // wraps it in a call, `EMITTER_MANIP GetFlowType() const` is a macro that stands for it. A name in capitals
    // (`TEST(a, b) {`, `DECLARE(x);`) is a macro, not a function.
    let macroType = null;
    if (typeTokens.length === 0 && /[a-z]/.test(bare)) {
      const bareMacro = before.filter((t) => t.t === 'id' && isMacroName(t.v)).pop();
      if (calls === 1 && wrapped.length && wrapped.every((t) => t.t === 'id' || t.v === '*' || t.v === '&' || t.v === '::')) {
        macroType = collapse(src.slice(wrapped[0].i, wrapped[wrapped.length - 1].end));
      } else if (calls === 0 && bareMacro) {
        macroType = bareMacro.v;
      }
    }
    if (!isCtorLike && typeTokens.length === 0 && macroType === null) return null;     // `TEST(a, b) {`, `DECLARE(x);`: a macro, not a function
    if (isCtorLike && !cls && !qualified && !/^~/.test(bare)) return null;
    if (!cls && !qualified && !isCtorLike && this.looksLikeInitialiser(cand.open, cand.close)) return null;
    if (!cls && !qualified && isCtorLike) return null;

    const ret = isCtorLike ? '' : macroType !== null ? (macroType.length > MAX_RETURN ? macroType.slice(0, MAX_RETURN) : macroType) : this.returnType(before);
    const params = collapse(src.slice(toks[cand.open].end, toks[cand.close].i));
    ctx.out.push({
      kind: 'func', name: nameText, params: params.length > MAX_PARAMS ? `${params.slice(0, MAX_PARAMS - 1)}…` : params, ret,
      start: toks[i].line, end: toks[tl.last].line,
    });
    return true;
  }

  /**
   * `Foo x(1, 2);` initialises a variable; the parentheses of a function hold parameters. A literal is
   * evidence of the first only as a direct argument: `char name[16]` (an array bound) and `int n = 5`
   * (a default argument) are parameters.
   */
  looksLikeInitialiser(open, close) {
    const { toks, pair, src } = this;
    let defaulted = false;
    let from = toks[open].end;
    // the masking blanks a string away, so a quote is looked for in the text between the argument's tokens
    const quoted = (to) => !defaulted && /["']/.test(src.slice(from, to));
    for (let q = open + 1; q < close; q++) {
      const t = toks[q];
      if (t.t === 'p') {
        if ((t.v === '[' || t.v === '(') && pair[q] >= 0) { q = pair[q]; continue; }
        if (t.v === ',') { if (quoted(t.i)) return true; defaulted = false; from = t.end; }
        else if (t.v === '=') defaulted = true;
        else if (t.v === '.' && !defaulted) return true;
      } else if ((t.t === 'num' || t.t === 'str') && !defaulted) return true;
    }
    return quoted(toks[close].i);
  }

  /** The name as written, joined without spaces (`Foo::bar`, `~Foo`, `operator==`, `operator()`). */
  nameText(from, open) {
    const { toks } = this;
    let text = '';
    let angleDepth = 0;
    for (let q = from; q < open; q++) {
      const t = toks[q];
      if (t.v === '<' && toks[q - 1] && toks[q - 1].v !== 'operator' && !/operator/.test(text)) { angleDepth++; continue; }
      if (t.v === '>' && angleDepth > 0) { angleDepth--; continue; }
      if (angleDepth > 0) continue;
      if (t.t === 'id' && (/operator$/.test(text) || /\w$/.test(text))) text += ` ${t.v}`;
      else text += t.v;
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  /** The return type, as written, minus specifiers, attributes and annotation macros. */
  returnType(before) {
    const { src } = this;
    const keep = before.filter((t) => !(t.t === 'id' && (SKIPPED_SPECIFIERS.has(t.v) || isMacroName(t.v))));
    // attribute groups inside the span: `[[nodiscard]]`, `__attribute__((x))`
    const kept = [];
    for (let q = 0; q < keep.length; q++) {
      const t = keep[q];
      if (t.v === '[' && keep[q + 1] && keep[q + 1].v === '[') { while (q < keep.length && !(keep[q].v === ']' && keep[q + 1] && keep[q + 1].v === ']')) q++; q++; continue; }
      if (t.t === 'id' && ATTRIBUTE_CALLS.has(t.v) && keep[q + 1] && keep[q + 1].v === '(') {
        let depth = 0;
        q++;
        for (; q < keep.length; q++) { if (keep[q].v === '(') depth++; else if (keep[q].v === ')') { depth--; if (depth === 0) break; } }
        continue;
      }
      kept.push(t);
    }
    if (!kept.length) return '';
    const text = collapse(src.slice(kept[0].i, kept[kept.length - 1].end));
    return text.length > MAX_RETURN ? text.slice(0, MAX_RETURN) : text;
  }
}

function collapse(s) {
  return s.replace(/\s+/g, ' ').trim();
}

module.exports = { extract };
