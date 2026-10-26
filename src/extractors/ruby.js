'use strict';

const { capWithNotice } = require('../util/truncate');
const { readBalanced } = require('./scan');
const { withAnchor } = require('./line-anchor');

// Ceiling sits above the default `maxSigsPerFile` so the configured budget
// governs output rather than a literal buried here, and omissions are disclosed (#576).
const PER_FILE_LIMIT = 200;

/**
 * Extract signatures from Ruby source code.
 *
 * Classes and modules are found at any indentation and listed by the name the
 * source gives them (`class BadRequest`, not `ActionController::BadRequest`:
 * the symbol lookups downstream read the name after `class`, as they do for
 * the Python and Java extractors); every `def` is listed under the innermost
 * class or module that owns it (#981). Two classes of one name in different
 * namespaces stay two entries. Ownership comes from block depth: the source is
 * masked (comments, strings, heredocs, regexps, %-literals) and `end` is
 * matched against the keywords that open a block.
 *
 * Every signature carries the `:start-end` lines of its definition (#975): the
 * line of the `class` / `module` / `def` keyword and the line of the `end` that
 * the same depth count closes it with. A class reopened elsewhere is one entry,
 * anchored to its first opening; an endless `def f = x` ends on its own line.
 *
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];

  const { plain, code } = maskRuby(src);
  const owners = scanOwners(plain, code);

  const sigs = [];
  for (const o of owners) {
    if (o.kind) sigs.push(withAnchor(`${o.kind} ${o.name}`, o.start, o.end));
    for (const m of o.members) sigs.push(withAnchor(m.text, m.start, m.end));
  }
  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

// ── Masking ──────────────────────────────────────────────────────────────────

const OPEN_FOR = { '(': ')', '[': ']', '{': '}', '<': '>' };

/**
 * Length- AND newline-preserving masks (a deleting strip would desynchronise
 * the offsets the balanced reader walks, #695).
 *
 * `plain` has comments blanked and strings kept: the text parameters are read
 * from. `code` also blanks string, heredoc, regexp and %-literal contents and
 * `=begin`/`=end` blocks, so every keyword left in it is structural.
 */
function maskRuby(src) {
  const n = src.length;
  const plain = src.split('');
  const code = src.split('');
  const blank = (arr, from, to) => { for (let k = from; k < to && k < n; k++) if (arr[k] !== '\n') arr[k] = ' '; };
  const blankBoth = (from, to) => { blank(plain, from, to); blank(code, from, to); };
  const lineEnd = (from) => { const e = src.indexOf('\n', from); return e === -1 ? n : e; };

  // The last non-blank character of `code` before `i`, and the word it ends
  // with, to tell a value position (`x = /re/`) from an operator (`a / b`).
  const prevSig = (i) => {
    let k = i - 1;
    while (k >= 0 && (code[k] === ' ' || code[k] === '\t')) k--;
    if (k < 0 || code[k] === '\n') return { ch: '', word: '', gap: false };
    let w = k;
    while (w >= 0 && /\w/.test(code[w])) w--;
    return { ch: code[k], word: code.slice(w + 1, k + 1).join(''), gap: k < i - 1 };
  };
  const VALUE_AFTER = new Set(['=', '(', ',', '[', '{', ';', ':', '!', '&', '|', '?', '~', '+', '-', '*', '<', '>', '^', '%', '']);
  const VALUE_WORDS = new Set(['when', 'if', 'unless', 'and', 'or', 'not', 'return', 'then', 'elsif', 'while', 'until', 'puts', 'in', 'case']);
  const inValuePosition = (i) => {
    const p = prevSig(i);
    return VALUE_AFTER.has(p.ch) || VALUE_WORDS.has(p.word);
  };

  // Double-quoted (and backtick) strings: `#{...}` may nest quotes and braces.
  const skipInterp = (i) => {
    let depth = 1;
    while (i < n && depth > 0) {
      const c = src[i];
      if (c === '$' && /[^\w\s]/.test(src[i + 1] || ' ')) { i += 2; continue; } // $` $' $" are globals
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '"' || c === '`') { i = skipDq(i + 1, c); continue; }
      else if (c === "'") { i = skipSq(i + 1); continue; }
      i++;
    }
    return i;
  };
  const skipDq = (i, q) => {
    while (i < n && src[i] !== q) {
      if (src[i] === '\\') i += 2;
      else if (src[i] === '#' && src[i + 1] === '{') i = skipInterp(i + 2);
      else i++;
    }
    return i + 1;
  };
  const skipSq = (i) => {
    while (i < n && src[i] !== "'") i += src[i] === '\\' ? 2 : 1;
    return i + 1;
  };

  const heredocs = []; // pending on the current line: { id, indented, raw }
  let i = 0;
  while (i < n) {
    const c = src[i];
    const atLineStart = i === 0 || src[i - 1] === '\n';

    if (atLineStart) {
      if (src.startsWith('=begin', i) && /[\s]|$/.test(src[i + 6] || '\n')) {
        const m = /^=end\b[^\n]*/m.exec(src.slice(i));
        const stop = m ? i + m.index + m[0].length : n;
        blankBoth(i, stop);
        i = stop;
        continue;
      }
      if (src.startsWith('__END__', i) && (i + 7 >= n || src[i + 7] === '\n' || src[i + 7] === '\r')) {
        blankBoth(i, n);
        break;
      }
    }

    if (c === '\n' && heredocs.length) {
      // The bodies start on the next line and run to each terminator in turn.
      let pos = i + 1;
      for (const h of heredocs) {
        while (pos < n) {
          const e = lineEnd(pos);
          const text = src.slice(pos, e).replace(/\r$/, '');
          blank(code, pos, e);
          const done = (h.indented ? text.trim() : text) === h.id;
          pos = Math.min(n, e + 1);
          if (done) break;
        }
      }
      heredocs.length = 0;
      i = pos;
      continue;
    }

    if (c === '$' && /[^\w\s]/.test(src[i + 1] || ' ')) {
      // A special global (`$'`, `$"`, `\$\``, `$/`, `$;`) is not the start of a string.
      i += 2;
      continue;
    }

    if (c === '#') {
      const e = lineEnd(i);
      blankBoth(i, e);
      i = e;
      continue;
    }
    if (c === "'") {
      const e = skipSq(i + 1);
      blank(code, i + 1, e - 1);
      i = e;
      continue;
    }
    if (c === '"' || c === '`') {
      const e = skipDq(i + 1, c);
      blank(code, i + 1, e - 1);
      i = e;
      continue;
    }
    if (c === '<' && src[i + 1] === '<') {
      const m = /^<<([~-]?)(["'`]?)([A-Za-z_]\w*)\2/.exec(src.slice(i, i + 80));
      const before = code.slice(Math.max(0, i - 60), i).join('');
      const lineStartText = code.slice(src.lastIndexOf('\n', i - 1) + 1, i).join('');
      const isClassSelf = /^\s*class\s*$/.test(lineStartText);
      const squiggly = m && (m[1] === '~' || m[1] === '-');
      const bare = m && !m[1] && !m[2] && /^[A-Z_][A-Z0-9_]*$/.test(m[3]);
      if (m && !isClassSelf && !/\w$/.test(before) && (squiggly || (bare && inValuePosition(i)))) {
        heredocs.push({ id: m[3], indented: !!m[1] });
        i += m[0].length;
        continue;
      }
      i += 2;
      continue;
    }
    if (c === '%') {
      const m = /^%([qQwWiIrsx]?)([(\[{<|!\/^~@#$&*+=;,.:?-])/.exec(src.slice(i, i + 3));
      const p = prevSig(i);
      // `%w[a b]`, `%{...}`, `%(...)`: after an operator, or as a call's argument (`assert_dom_equal %{<a/>}`).
      const literal = m && (m[1] || OPEN_FOR[m[2]]) && (inValuePosition(i) || (p.gap && /\w/.test(p.ch)));
      if (literal) {
        const open = m[2];
        const close = OPEN_FOR[open] || open;
        let j = i + m[0].length;
        let depth = 1;
        while (j < n && depth > 0) {
          if (src[j] === '\\') { j += 2; continue; }
          if (OPEN_FOR[open] && src[j] === open) depth++;
          else if (src[j] === close) depth--;
          j++;
        }
        blank(code, i + m[0].length, j - 1);
        i = j;
        continue;
      }
      i++;
      continue;
    }
    // `:/` is the operator symbol (`calculate(:/, other)`, `send(:/, x)`), not the start of a regexp;
    // `::/` cannot occur, so a single `:` before the slash is enough to tell.
    if (c === '/' && inValuePosition(i) && !(src[i - 1] === ':' && src[i - 2] !== ':')) {
      // Where a value is expected `/` cannot be division, so this is a regexp
      // literal. Under /x it may span lines (Rails' CONTENT_TYPE_PARSER does),
      // and a `/` inside a [...] class does not close it.
      let j = i + 1;
      let inClass = false;
      const stop = Math.min(n, i + 4000);
      for (; j < stop; j++) {
        const ch = src[j];
        if (ch === '\\') { j++; continue; }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) break;
      }
      if (src[j] === '/' && j < stop) {
        blank(code, i + 1, j);
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return { plain: plain.join(''), code: code.join('') };
}

// ── Structure ────────────────────────────────────────────────────────────────

// Keywords that open or close a block. Not preceded by `.`/`:`/`@`/`$` (a
// method call, symbol or variable), not a hash key (`if: 1`) and not the name
// in `def end` / `def begin`.
const KEYWORD = /(?<![\w.:@$])(?<!\bdef\s+)(class|module|def|if|unless|while|until|case|for|begin|do|end)(?![\w?!]|:(?!:))/g;

// `before` is the text ahead of an `if`/`unless`/`while`/`until` on its line.
// The keyword opens a block at the start of a statement or an assignment's
// right-hand side; anywhere else it is a modifier (`x if y`, `return if y`).
const OPENS_AFTER = /(?:^|[;(\[{|,]|(?:^|[^=!<>~])=|[-+*/%|&^]=|\|\|=|&&=|<<=|>>=|<<|&&|\|\||=>|\b(?:then|else|do|begin|ensure|and|or|not))$/;
function opensBlock(before) {
  const t = before.trimEnd();
  return !ENDS_IN_SYMBOL.test(t) && OPENS_AFTER.test(t);
}
// A symbol literal is a finished value even when it ends in `=` (`alias_method :a, :[]= unless x`,
// `attr_writer :b= if y`): what follows it is a modifier, not an assignment's right-hand side.
const ENDS_IN_SYMBOL = /(?:^|[^:\w]):(?:\[\]=?|[A-Za-z_\u0080-\uFFFF][\w\u0080-\uFFFF]*[?!=]?)$/;

// Identifiers may be non-ASCII (Sidekiq defines `def ❤`).
const METHOD_NAME = /^(?:(self|[A-Za-z_]\w*)\.)?([A-Za-z_\u0080-\uFFFF][\w\u0080-\uFFFF]*[?!=]?|\[\]=?|<=>|===?|=~|!=|!~|\*\*|<<|>>|<=|>=|[+\-*/%<>!~^&|]@?|`)/;

/**
 * Walk the masked source and return the owners in the order they open:
 * `{ kind, name, full, start, end, members }` (`name` as written, `full` the lexical
 * path that tells two same-named classes apart, `start`/`end` the 1-based lines of its
 * first opening), with the owner-less top-level defs last as `{ kind: null, members }`.
 * A member is `{ text, start, end }`.
 */
function scanOwners(plain, code) {
  const owners = [];
  const byKey = new Map();
  const root = { kind: null, name: '', full: '', members: [] };
  // { type: 'class'|'module'|'sclass'|'def'|'block', owner?, self?, claims?: {start,end} to close with `end` }
  const frames = [];

  const ownerFrame = () => {
    for (let k = frames.length - 1; k >= 0; k--) {
      if (frames[k].type === 'class' || frames[k].type === 'module' || frames[k].type === 'sclass') return frames[k];
    }
    return null;
  };
  const namedFrame = () => {
    for (let k = frames.length - 1; k >= 0; k--) {
      if (frames[k].type === 'class' || frames[k].type === 'module') return frames[k];
    }
    return null;
  };
  const open = (kind, full, name, line) => {
    const key = `${kind} ${full}`;
    let o = byKey.get(key);
    if (!o) { o = { kind, name, full, start: line, end: line, members: [] }; byKey.set(key, o); owners.push(o); o.fresh = true; }
    return o;
  };

  let lineStart = 0;
  let lineNo = 1;
  while (lineStart <= code.length) {
    let lineEnd = code.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = code.length;
    const text = code.slice(lineStart, lineEnd);
    let loopDo = false;

    KEYWORD.lastIndex = 0;
    let m;
    while ((m = KEYWORD.exec(text)) !== null) {
      const kw = m[1];
      const col = m.index;
      const abs = lineStart + col;

      if (kw === 'end') {
        const closed = frames.pop();
        if (closed && closed.claims) closed.claims.end = lineNo;
      } else if (kw === 'class' || kw === 'module') {
        const rest = text.slice(col + kw.length);
        const sc = kw === 'class' ? /^\s*<<\s*(\w+)/.exec(rest) : null;
        const nm = sc ? null : /^\s+(::)?([A-Z]\w*(?:::[A-Z]\w*)*)/.exec(rest);
        if (!sc && !nm) continue;
        const parent = namedFrame();
        if (sc) {
          frames.push({ type: 'sclass', owner: parent ? parent.owner : null, self: sc[1] === 'self' });
        } else {
          const full = nm[1] || !parent ? nm[2] : `${parent.owner.full}::${nm[2]}`;
          const o = open(kw, full, nm[2], lineNo);
          // Only the first opening of a class is anchored; later ones add members under it.
          const claims = o.fresh ? o : null;
          o.fresh = false;
          frames.push({ type: kw, owner: o, claims });
        }
      } else if (kw === 'def') {
        const rest = code.slice(abs + 3, abs + 3 + 120);
        const lead = /^\s+/.exec(rest);
        const nm = lead && METHOD_NAME.exec(rest.slice(lead[0].length));
        // A def whose name this scan cannot read still opens a block that an `end`
        // will close, so it must be counted or the owner is popped too early.
        if (!nm) { frames.push({ type: 'def' }); continue; }
        const nameStart = abs + 3 + lead[0].length;
        const afterName = nameStart + nm[0].length;
        let paramsEnd = afterName;
        let params = '';
        let k = afterName;
        while (code[k] === ' ' || code[k] === '\t') k++;
        if (code[k] === '(') {
          const close = readBalanced(code, k);
          if (close >= 0) {
            params = `(${normalizeParams(plain.slice(k + 1, close))})`;
            paramsEnd = close + 1;
          }
        }
        // `def name(args) = expr` has no `end` to wait for.
        let e = paramsEnd;
        while (code[e] === ' ' || code[e] === '\t') e++;
        const endless = code[e] === '=' && !/[=~>]/.test(code[e + 1] || '');
        const member = { text: '', start: lineNo, end: lineNo };
        if (!endless) frames.push({ type: 'def', claims: member });

        const bare = nm[2];
        if (bare.startsWith('_')) continue;
        const ownerF = ownerFrame();
        const owner = ownerF ? ownerF.owner : null;
        const singleton = nm[1] ? `${nm[1]}.` : (ownerF && ownerF.type === 'sclass' && ownerF.self ? 'self.' : '');
        const ls = code.lastIndexOf('\n', abs - 1) + 1;
        member.text = `${owner ? '  ' : ''}def ${singleton}${bare}${params}${extractReturnHint(plain, ls)}`;
        (owner || root).members.push(member);
      } else if (kw === 'if' || kw === 'unless' || kw === 'while' || kw === 'until') {
        if (opensBlock(text.slice(0, col))) {
          frames.push({ type: 'block' });
          if (kw === 'while' || kw === 'until') loopDo = true;
        }
      } else if (kw === 'for') {
        frames.push({ type: 'block' });
        loopDo = true;
      } else if (kw === 'case' || kw === 'begin') {
        frames.push({ type: 'block' });
      } else if (kw === 'do') {
        if (loopDo) loopDo = false;
        else frames.push({ type: 'block' });
      }
    }
    lineStart = lineEnd + 1;
    lineNo++;
  }

  // A block the depth count never closed (input that stops early, or a construct the masking
  // misread) runs to the last line of the file; the empty piece after a final newline is not a line.
  const lastLine = code.endsWith('\n') ? lineNo - 2 : lineNo - 1;
  for (const f of frames) {
    if (f.claims) f.claims.end = Math.max(f.claims.start, lastLine);
  }

  return owners.concat(root.members.length ? [root] : []);
}

function normalizeParams(params) {
  if (!params) return '';
  return params.trim().replace(/\s+/g, ' ');
}

function extractReturnHint(stripped, index) {
  const start = Math.max(0, index - 180);
  const before = stripped.slice(start, index);
  const m = before.match(/sig\s*\{[\s\S]*?returns\(([^)]+)\)[\s\S]*?\}\s*$/);
  if (!m) return '';
  const type = m[1].trim().replace(/\s+/g, ' ').slice(0, 25);
  return type ? ` → ${type}` : '';
}

module.exports = { extract };
