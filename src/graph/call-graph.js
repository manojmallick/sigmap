'use strict';

/**
 * Method/caller-level call-graph (D4 v1, languages expanded in GR1).
 *
 * Builds symbol-level edges — which function calls which function — for JS/TS,
 * Python, Java, Go, and Rust. Deterministic, zero-dependency, regex +
 * brace/indent matching. Call sites are resolved with high precision: a call
 * resolves to a definition of that name in the *same file* first, then in a
 * *directly-imported* file (via the existing file-level import graph). Names
 * that resolve to no repo definition produce no edge — over-approximation
 * noise is avoided. Constructs that can't be parsed dependency-free are
 * skipped (less fidelity, never a parser dep).
 *
 * Symbol IDs are `relPath#symbolName` (forward-slashed, relative to cwd).
 *
 * @module src/graph/call-graph
 */

const fs = require('fs');
const path = require('path');
const { build } = require('./builder');
const { resolveGraphDirs, configuredSrcDirs } = require('./src-dirs');
const { maskCode } = require('../extractors/scan');

const JS_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const PY_EXTS = new Set(['.py', '.pyw']);
const JAVA_EXTS = new Set(['.java']);
const GO_EXTS = new Set(['.go']);
const RS_EXTS = new Set(['.rs']);
const KT_EXTS = new Set(['.kt', '.kts']);
const SCALA_EXTS = new Set(['.scala', '.sc']);

// Tokens that look like `name(` calls or definition headers but are language
// keywords, not user symbols — never treated as a call or a definition.
const NON_CALL = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof',
  'await', 'new', 'super', 'else', 'do', 'with', 'yield', 'void', 'delete',
  'in', 'of', 'case', 'throw', 'print', 'and', 'or', 'not', 'assert',
  'lambda', 'class', 'def', 'elif', 'except', 'finally', 'raise', 'import',
  'from', 'global', 'nonlocal', 'del', 'pass', 'async', 'require', 'constructor',
  'synchronized',
]);

const { graphKey } = require('./path-key');
function normalizePath(p) { return graphKey(p); }
function toRel(cwd, f) { return path.relative(cwd, f).replace(/\\/g, '/'); }
function symId(cwd, absFile, name) { return `${toRel(cwd, absFile)}#${name}`; }

// ── Length- and newline-preserving maskers ──────────────────────────────────
// Replace comment / string bodies with spaces so their braces, parens, and
// call-looking tokens never confuse structure detection. Offsets stay aligned.

function maskJs(src, opts) {
  return maskCode(src, opts);
}

// Rust: `//`, `/* */`, and `"..."` mask like JS, but a bare `'` is usually a
// lifetime (`'a`), not a string — masking to the "closing" quote would corrupt
// offsets. Only char literals (`'x'`, `'\n'`) are masked; lifetimes pass through.
function maskRust(src) {
  const out = src.split('');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { let j = i + 2; while (j < n && src[j] !== '\n') j++; blank(i, j); i = j; continue; }
    if (c === '/' && d === '*') { let j = i + 2; while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++; j = Math.min(n, j + 2); blank(i, j); i = j; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < n) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === '"') break; j++; }
      j = Math.min(n, j + 1); blank(i, j); i = j; continue;
    }
    if (c === "'") {
      if (d === '\\' && src[i + 3] === "'") { blank(i, i + 4); i += 4; continue; } // '\n'
      if (d !== undefined && src[i + 2] === "'") { blank(i, i + 3); i += 3; continue; } // 'x'
      i++; continue; // lifetime `'a` — leave untouched
    }
    i++;
  }
  return out.join('');
}

function maskPy(src) {
  const out = src.split('');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '#') { let j = i + 1; while (j < n && src[j] !== '\n') j++; blank(i, j); i = j; continue; }
    if (c === '"' || c === "'") {
      if (src.substr(i, 3) === c + c + c) {
        let j = i + 3; while (j < n && src.substr(j, 3) !== c + c + c) j++; j = Math.min(n, j + 3); blank(i, j); i = j; continue;
      }
      let j = i + 1; while (j < n) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === c || src[j] === '\n') break; j++; }
      j = Math.min(n, j + 1); blank(i, j); i = j; continue;
    }
    i++;
  }
  return out.join('');
}

// ── Balanced-delimiter matchers (operate on masked source) ───────────────────
function matchDelim(masked, openIdx, open, close) {
  let depth = 0;
  for (let i = openIdx; i < masked.length; i++) {
    if (masked[i] === open) depth++;
    else if (masked[i] === close) { depth--; if (depth === 0) return i; }
  }
  return masked.length - 1;
}

function lineAt(src, idx) {
  let line = 1;
  const end = Math.min(idx, src.length);
  for (let i = 0; i < end; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

// ── Definition extraction ────────────────────────────────────────────────────
// Each def: { name, line, bodyStart, bodyEnd } with char offsets into `masked`.

function jsDefs(masked) {
  const defs = [];
  const seen = new Set();
  const push = (name, headerIdx, bodyStart, bodyEnd) => {
    const key = name + ':' + bodyStart;
    if (NON_CALL.has(name) || seen.has(key)) return;
    seen.add(key);
    defs.push({ name, line: lineAt(masked, headerIdx), bodyStart, bodyEnd });
  };

  // Locate the `{` body (or `=>` expression) that follows a param list `)`.
  const bodyAfterParams = (closeParen) => {
    let k = closeParen + 1;
    // skip a `=>`, return-type annotations, and whitespace up to `{` or a statement end
    while (k < masked.length && masked[k] !== '{' && masked[k] !== ';' && masked[k] !== '\n') k++;
    if (masked[k] === '{') { const end = matchDelim(masked, k, '{', '}'); return { bodyStart: k, bodyEnd: end }; }
    return null; // no braced body (interface/abstract/overload signature) — skip
  };

  // 1) function declarations:  (async) function name(...) { ... }
  const reFn = /\b(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = reFn.exec(masked)) !== null) {
    const paren = masked.indexOf('(', m.index + m[0].length - 1);
    const close = matchDelim(masked, paren, '(', ')');
    const body = bodyAfterParams(close);
    if (body) push(m[1], m.index, body.bodyStart, body.bodyEnd);
  }

  // 2) arrow / function expressions:  const name = (...) => { }  |  = function(...) { }
  const reArrow = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b\s*\*?\s*[A-Za-z_$]*\s*)?\(/g;
  while ((m = reArrow.exec(masked)) !== null) {
    const paren = masked.indexOf('(', m.index + m[0].length - 1);
    const close = matchDelim(masked, paren, '(', ')');
    let k = close + 1;
    while (k < masked.length && /\s/.test(masked[k])) k++;
    if (masked[k] === '{') { push(m[1], m.index, k, matchDelim(masked, k, '{', '}')); continue; }
    if (masked[k] === '=' && masked[k + 1] === '>') {
      let j = k + 2; while (j < masked.length && /\s/.test(masked[j])) j++;
      if (masked[j] === '{') push(m[1], m.index, j, matchDelim(masked, j, '{', '}'));
      else { // single-expression arrow body → to end of statement
        let e = j; let d = 0;
        while (e < masked.length) { const ch = masked[e]; if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; else if ((ch === ';' || ch === '\n') && d <= 0) break; e++; }
        push(m[1], m.index, j, e);
      }
    }
  }

  // 3) class methods:  class X { name(...) { } }
  const reClass = /\bclass\s+[A-Za-z_$][\w$]*/g;
  while ((m = reClass.exec(masked)) !== null) {
    const brace = masked.indexOf('{', m.index);
    if (brace === -1) continue;
    const classEnd = matchDelim(masked, brace, '{', '}');
    const reMethod = /(?:^|\n)\s*(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+|abstract\s+|async\s+|get\s+|set\s+|\*\s*)*([A-Za-z_$][\w$]*)\s*\(/g;
    reMethod.lastIndex = brace;
    let mm;
    while ((mm = reMethod.exec(masked)) !== null && mm.index < classEnd) {
      const paren = masked.indexOf('(', mm.index + mm[0].length - 1);
      const close = matchDelim(masked, paren, '(', ')');
      const body = bodyAfterParams(close);
      if (body && body.bodyEnd <= classEnd) push(mm[1], mm.index, body.bodyStart, body.bodyEnd);
    }
  }

  return defs;
}

function pyDefs(masked) {
  const defs = [];
  const lines = masked.split('\n');
  // precompute char offset of each line start
  const offsets = [0];
  for (let i = 0; i < lines.length; i++) offsets.push(offsets[i] + lines[i].length + 1);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([ \t]*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/);
    if (!m) continue;
    const indent = m[1].length;
    let j = i + 1;
    for (; j < lines.length; j++) {
      const ln = lines[j];
      if (!ln.trim()) continue;                       // blank
      const ind = ln.match(/^[ \t]*/)[0].length;
      if (ind <= indent) break;                        // dedent → block ends
    }
    defs.push({ name: m[2], line: i + 1, bodyStart: offsets[i], bodyEnd: offsets[j] || masked.length });
  }
  return defs;
}

// Go:  func name(...) { }   |   func (r Recv) name(...) (T, error) { }
// The return list may itself be parenthesized, so scan past it to the body `{`.
function goDefs(masked) {
  const defs = [];
  const re = /(?:^|\n)func\s+(?:\([^)\n]*\)\s*)?([A-Za-z_]\w*)\s*\(/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    const paren = masked.indexOf('(', m.index + m[0].length - 1);
    const close = matchDelim(masked, paren, '(', ')');
    let k = close + 1;
    let depth = 0;
    while (k < masked.length) {
      const ch = masked[k];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === '{' && depth === 0) break;
      else if (ch === '\n' && depth === 0) { k = -1; break; } // no body on this header
      k++;
    }
    if (k === -1 || k >= masked.length) continue;
    defs.push({ name: m[1], line: lineAt(masked, m.index + 1), bodyStart: k, bodyEnd: matchDelim(masked, k, '{', '}') });
  }
  return defs;
}

// Java: methods + constructors with braced bodies. Statement-shaped matches
// (calls, control flow) are rejected because their `)` is followed by `;`,
// and keyword headers (`if`, `while`, …) fall to the NON_CALL guard.
// Words that can precede `name(` in a STATEMENT, so their presence means the
// line is not a method declaration.
const STMT_KEYWORDS = new Set([
  'return', 'throw', 'else', 'do', 'try', 'case', 'yield', 'assert', 'new',
  'if', 'while', 'for', 'switch', 'catch', 'synchronized', 'instanceof', 'await',
]);

// Types a Java class declares it implements or extends, with generic arguments
// stripped and any package qualifier dropped: `implements Foo<Bar, Baz>` yields
// ['Foo'], never 'Baz>'. Also records whether the class is a Spring bean and
// whether it is @Primary, which is what disambiguates several implementations.
function javaTypeDecl(masked) {
  const m = /(?:^|\n)[^\n]*?\bclass\s+([A-Za-z_$][\w$]*)([^{]*)\{/.exec(masked);
  if (!m) return null;
  const [, className, tail] = m;
  const supers = [];
  for (const kw of ['implements', 'extends']) {
    const k = new RegExp('\\b' + kw + '\\s+([^{]*?)(?=\\b(?:implements|extends)\\b|$)').exec(tail);
    if (!k) continue;
    let depth = 0;
    let cur = '';
    for (const ch of k[1]) {
      if (ch === '<') { depth++; continue; }
      if (ch === '>') { depth--; continue; }
      if (ch === ',' && depth === 0) { if (cur.trim()) supers.push(cur.trim()); cur = ''; continue; }
      if (depth === 0) cur += ch;
    }
    if (cur.trim()) supers.push(cur.trim());
  }
  const head = masked.slice(0, m.index + m[0].length);
  return {
    className,
    supers: supers.map((t) => t.split('.').pop().trim()).filter(Boolean),
    isBean: /@(Service|Component|Repository|Controller|RestController)\b/.test(head),
    isPrimary: /@Primary\b/.test(head),
  };
}

function javaDefs(masked) {
  const defs = [];
  const seen = new Set();
  const re = /(?:^|\n)[ \t]*((?:(?:public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\s+)*)(?:<[^>\n]{0,80}>\s*)?(?:[\w$][\w$.<>\[\],?\s]*?\s+)?([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    const name = m[2];
    if (NON_CALL.has(name)) continue;
    // `new Foo() { … }` anonymous classes are uses, not definitions.
    const before = masked.slice(Math.max(0, m.index), m.index + m[0].length - name.length - 1);
    if (/\bnew\s*$/.test(before)) continue;
    const paren = masked.indexOf('(', m.index + m[0].length - 1);
    const close = matchDelim(masked, paren, '(', ')');
    // skip `throws A, B` up to the body `{` (same line — multi-line headers are skipped)
    let k = close + 1;
    while (k < masked.length && masked[k] !== '{' && masked[k] !== ';' && masked[k] !== '\n' && masked[k] !== '=') k++;
    // A `;` here is an interface or abstract method DECLARATION. It owns no body,
    // so it emits no calls — but in Spring the declared interface is what callers
    // name, so without it as a node every controller→service edge has no target.
    // Recorded with an empty body range: can receive edges, never produces them.
    // `before` is everything between line start and the method name. A real
    // declaration has modifiers or a return type there (`void chargeCard(`);
    // a call statement has only whitespace (`identity(1);`) or a statement
    // keyword (`return helper(a);`) — neither may be read as a declaration,
    // or the call resolves to a phantom local def instead of the real target.
    const headWord = (before.match(/([A-Za-z_$][\w$]*)\s*$/) || [])[1];
    const isDecl = masked[k] === ';' && /\S/.test(before) && !STMT_KEYWORDS.has(headWord);
    if (masked[k] !== '{' && !isDecl) continue;
    const key = name + ':' + k;
    if (seen.has(key)) continue;
    seen.add(key);
    defs.push(isDecl
      ? { name, line: lineAt(masked, m.index + 1), bodyStart: k, bodyEnd: k }
      : { name, line: lineAt(masked, m.index + 1), bodyStart: k, bodyEnd: matchDelim(masked, k, '{', '}') });
  }
  return defs;
}

// Rust: fn name(...) { }  |  fn name<T>(...) -> T where … { }  — inside or
// outside impl/trait blocks. A `;` before the body brace (trait declaration)
// means no body: skipped.
function rustDefs(masked) {
  const defs = [];
  const re = /\bfn\s+([A-Za-z_]\w*)/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    let k = m.index + m[0].length;
    while (k < masked.length && /\s/.test(masked[k])) k++;
    if (masked[k] === '<') k = matchDelim(masked, k, '<', '>') + 1;
    while (k < masked.length && /\s/.test(masked[k])) k++;
    if (masked[k] !== '(') continue;
    const close = matchDelim(masked, k, '(', ')');
    // return type / where clause may span lines; stop at body `{` or decl `;`
    let b = close + 1;
    while (b < masked.length && masked[b] !== '{' && masked[b] !== ';') b++;
    if (masked[b] !== '{') continue;
    defs.push({ name: m[1], line: lineAt(masked, m.index), bodyStart: b, bodyEnd: matchDelim(masked, b, '{', '}') });
  }
  return defs;
}

// Pick the masker whose comment/string syntax matches the language.
// Java and Go share JS syntax (Go raw strings mask like template literals).
/**
 * Body range for a JVM-family member that may use either a brace body or an
 * expression body (`fun f() = expr` / `def f = expr`), which Java has not.
 * An expression body runs to the end of its line — enough to capture the calls
 * it makes, which is all the graph needs.
 * @returns {{bodyStart:number, bodyEnd:number}|null} null when neither form follows
 */
function jvmBodyRange(masked, from) {
  let k = from;
  while (k < masked.length && masked[k] !== '{' && masked[k] !== '=' && masked[k] !== '\n' && masked[k] !== ';') k++;
  if (masked[k] === '{') return { bodyStart: k, bodyEnd: matchDelim(masked, k, '{', '}') };
  if (masked[k] === '=') {
    // `= {` is still a brace body, just written with an assignment.
    let j = k + 1;
    while (j < masked.length && /\s/.test(masked[j])) j++;
    if (masked[j] === '{') return { bodyStart: j, bodyEnd: matchDelim(masked, j, '{', '}') };
    const eol = masked.indexOf('\n', k);
    return { bodyStart: k, bodyEnd: eol === -1 ? masked.length : eol };
  }
  return null; // abstract member or interface declaration
}

/**
 * Kotlin `fun` definitions, including extension functions (`fun Foo.bar()`,
 * recorded as `bar`) and expression bodies.
 */
function ktDefs(masked) {
  const defs = [];
  const seen = new Set();
  const re = /(?:^|\n)[ \t]*((?:(?:public|private|protected|internal|open|override|abstract|final|suspend|inline|operator|infix|tailrec|external|expect|actual|inner|companion)\s+)*)fun\s+(?:<[^>\n]{0,80}>\s*)?(?:[A-Za-z_][\w.<>]*\.)?([A-Za-z_][\w]*)\s*\(/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    const name = m[2];
    if (NON_CALL.has(name)) continue;
    const paren = masked.indexOf('(', m.index + m[0].length - 1);
    const close = matchDelim(masked, paren, '(', ')');
    if (close < 0) continue;
    const range = jvmBodyRange(masked, close + 1);
    const line = lineAt(masked, m.index + 1);
    const key = name + ':' + (range ? range.bodyStart : line);
    if (seen.has(key)) continue;
    seen.add(key);
    // An abstract/interface member owns no body: it can receive edges but
    // never produces them, the same treatment javaDefs gives declarations.
    defs.push(range ? { name, line, ...range } : { name, line, bodyStart: close, bodyEnd: close });
  }
  return defs;
}

/**
 * Scala `def` definitions. Handles parameterless members (`def foo: Int = 1`),
 * type parameters, and expression bodies.
 */
function scalaDefs(masked) {
  const defs = [];
  const seen = new Set();
  const re = /(?:^|\n)[ \t]*((?:(?:private|protected|override|implicit|final|lazy|sealed|abstract|inline)(?:\s*\[[^\]\n]{0,60}\])?\s+)*)def\s+([A-Za-z_][\w]*)\s*(?=[\[\(:=])/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    const name = m[2];
    if (NON_CALL.has(name)) continue;
    // Step past an optional type-parameter list, then an optional value list.
    let k = m.index + m[0].length;
    if (masked[k] === '[') { const e = matchDelim(masked, k, '[', ']'); if (e < 0) continue; k = e + 1; }
    while (masked[k] === '(') { const e = matchDelim(masked, k, '(', ')'); if (e < 0) break; k = e + 1; }
    const range = jvmBodyRange(masked, k);
    const line = lineAt(masked, m.index + 1);
    const key = name + ':' + (range ? range.bodyStart : line);
    if (seen.has(key)) continue;
    seen.add(key);
    defs.push(range ? { name, line, ...range } : { name, line, bodyStart: k, bodyEnd: k });
  }
  return defs;
}

function maskFor(filePath, src) {
  const ext = path.extname(filePath).toLowerCase();
  if (PY_EXTS.has(ext)) return maskPy(src);
  if (RS_EXTS.has(ext)) return maskRust(src);
  return maskJs(src, { js: JS_EXTS.has(ext) });
}

function extractDefs(filePath, src) {
  const ext = path.extname(filePath).toLowerCase();
  if (JS_EXTS.has(ext)) return jsDefs(maskJs(src, { js: true }));
  if (PY_EXTS.has(ext)) return pyDefs(maskPy(src));
  if (JAVA_EXTS.has(ext)) return javaDefs(maskJs(src));
  if (GO_EXTS.has(ext)) return goDefs(maskJs(src));
  if (RS_EXTS.has(ext)) return rustDefs(maskRust(src));
  if (KT_EXTS.has(ext)) return ktDefs(maskJs(src));
  if (SCALA_EXTS.has(ext)) return scalaDefs(maskJs(src));
  return null; // unsupported language
}

// Collect `name(` call tokens within [start,end) of masked source.
function callsInRange(masked, start, end) {
  const slice = masked.slice(start, end);
  const names = new Set();
  const re = /([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(slice)) !== null) {
    // skip a `.name(` method access — resolved separately via receiverCallsInRange
    const before = slice[m.index - 1];
    if (before === '.') continue;
    if (!NON_CALL.has(m[1])) names.add(m[1]);
  }
  return names;
}

// Collect `receiver.method(` pairs within [start,end). A chained or computed
// receiver (`a.b().c(`, `arr[0].c(`) is skipped: only a plain identifier can be
// looked up in the declaration map, and guessing is worse than no edge.
function receiverCallsInRange(masked, start, end) {
  const slice = masked.slice(start, end);
  const out = [];
  const re = /([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(slice)) !== null) {
    const before = slice[m.index - 1];
    if (before === '.' || before === ')' || before === ']') continue;
    if (NON_CALL.has(m[2])) continue;
    out.push({ receiver: m[1], method: m[2] });
  }
  return out;
}

// `private UserService userService;` / `UserService svc = new UserService();`
// / `for (OmsOrderItem item : list)` → { userService: 'UserService', … }.
// Declarations only: a bare assignment carries no type and is not inferred.
const DECL_RE = /(?:^|[;{}(,\n])\s*(?:(?:public|private|protected|static|final|volatile|transient)\s+)*([A-Z][\w$]*)(?:\s*<[^>;=(){}]*>)?(?:\s*\[\s*\])?\s+([a-z_$][\w$]*)\s*(?=[;=:)])/g;

function buildTypeMap(masked) {
  const map = new Map();
  let m;
  DECL_RE.lastIndex = 0;
  while ((m = DECL_RE.exec(masked)) !== null) {
    const [, type, name] = m;
    if (JVM_KEYWORDS.has(type) || JVM_KEYWORDS.has(name)) continue;
    if (!map.has(name)) map.set(name, type);   // first declaration wins — deterministic
  }
  return map;
}

// Type names that are never a user class, so never a resolvable receiver type.
const JVM_KEYWORDS = new Set([
  'return', 'new', 'if', 'else', 'for', 'while', 'switch', 'case', 'throw', 'catch',
  'String', 'Integer', 'Long', 'Boolean', 'Double', 'Float', 'Object', 'List', 'Map',
  'Set', 'Collection', 'Optional', 'Override', 'Autowired', 'Resource', 'Deprecated',
]);

// ── Public API ───────────────────────────────────────────────────────────────

// Walk depth from each srcDir root (not from cwd). A Maven module reaches
// `src/main/java/<group>/<artifact>/service/impl` nine directories down, so the
// previous ceiling of 8 never saw the classes that own the method bodies.
const DEFAULT_WALK_DEPTH = 12;

function _walk(dir, excludeSet, out, depth, maxDepth) {
  if (depth > (maxDepth === undefined ? DEFAULT_WALK_DEPTH : maxDepth)) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of entries) {
    if (excludeSet.has(e.name) || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) _walk(full, excludeSet, out, depth + 1, maxDepth);
    else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (JS_EXTS.has(ext) || PY_EXTS.has(ext) || JAVA_EXTS.has(ext) || GO_EXTS.has(ext)
        || RS_EXTS.has(ext) || KT_EXTS.has(ext) || SCALA_EXTS.has(ext)) out.push(full);
    }
  }
}

/**
 * Build the method-level call-graph for a project.
 *
 * @param {string} cwd
 * @param {object} [opts]
 * @param {string[]} [opts.srcDirs=['src','app','lib']]
 * @param {string[]} [opts.exclude]
 * @param {string[]} [opts.files]  explicit absolute file list (skips the walk)
 * @returns {{
 *   forward: Map<string,string[]>,   // callerId → calleeIds
 *   reverse: Map<string,string[]>,   // calleeId → callerIds
 *   defs:    Map<string,{file:string,name:string,line:number}>
 * }}
 */
function buildCallGraph(cwd, opts = {}) {
  let files = opts.files ? opts.files.map((f) => path.resolve(f)) : [];
  let srcDirs = opts.srcDirs;
  let exclude = opts.exclude;
  if (!opts.files) {
    // Same resolution as the dependency graph (#560, #934): explicit opts →
    // the project's own config → the source roots detection chose plus the
    // historical defaults. Without the last step this is empty on any repo
    // whose sources are not under src/app/lib — and so is `--callers`.
    if (srcDirs == null) {
      const dirs = resolveGraphDirs(cwd, ['src', 'app', 'lib']);
      srcDirs = dirs.srcDirs;
      if (exclude == null && dirs.exclude) exclude = dirs.exclude;
    }
  }
  const excludeSet = new Set(exclude || ['node_modules', '.git', 'dist', 'build', 'coverage', 'vendor']);
  if (!opts.files) {
    for (const sd of srcDirs) {
      const abs = path.resolve(cwd, sd);
      if (fs.existsSync(abs)) _walk(abs, excludeSet, files, 0, opts.maxDepth);
    }
    // Roots may nest (`.` beside `src`); a file is one node however often the
    // walk reached it.
    files = [...new Set(files)];
  }

  // File-level import graph (for precise call-site resolution). Keys normalized.
  let fileGraph;
  try { fileGraph = build(files, cwd); } catch (_) { fileGraph = { forward: new Map() }; }

  // Per-file definitions + name→file lookups.
  const perFileDefs = new Map();   // absFile → def[]
  const defsByName = new Map();     // absFile → Map<name, symbolId[]>
  const normToAbs = new Map();      // normalized abs → abs
  const defs = new Map();           // symbolId → {file,name,line}

  // JVM convention: a public type lives in a file of the same name. This is the
  // deterministic type→file mapping receiver resolution needs, with no AST.
  const fileByTypeName = new Map();   // 'UserService' → [absFile]
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (JAVA_EXTS.has(ext)) {
      const base = path.basename(f, path.extname(f));
      if (!fileByTypeName.has(base)) fileByTypeName.set(base, []);
      fileByTypeName.get(base).push(f);
    }
  }

  // interface/superclass name → implementing files, for the Spring hop below.
  const implsByType = new Map();     // 'PaymentService' → [{ file, isBean, isPrimary }]
  for (const f of files) {
    if (!JAVA_EXTS.has(path.extname(f).toLowerCase())) continue;
    let decl;
    try { decl = javaTypeDecl(maskJs(fs.readFileSync(f, 'utf8'))); } catch (_) { continue; }
    if (!decl) continue;
    for (const sup of decl.supers) {
      if (!implsByType.has(sup)) implsByType.set(sup, []);
      implsByType.get(sup).push({ file: f, isBean: decl.isBean, isPrimary: decl.isPrimary });
    }
  }

  /**
   * The single implementing file for a type, or null when it is ambiguous.
   * One implementation resolves outright; several resolve only via @Primary.
   * Anything still ambiguous yields no edge — polymorphism is not guessed.
   */
  const soleImpl = (typeName) => {
    const cands = implsByType.get(typeName) || [];
    if (cands.length === 1) return cands[0].file;
    const primary = cands.filter((c) => c.isPrimary);
    if (primary.length === 1) return primary[0].file;
    return null;
  };

  // #768: a zero here means "no edge was found", not "no caller exists". The
  // two systematic blind spots are counted while scanning so the formatter can
  // say which, instead of asserting a safety property the graph cannot support.
  let dynamicLoads = 0;
  for (const f of files) {
    normToAbs.set(normalizePath(path.resolve(f)), path.resolve(f));
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
    dynamicLoads += countDynamicLoads(src);
    const fileDefs = extractDefs(f, src);
    if (!fileDefs) continue;
    perFileDefs.set(f, fileDefs);
    const byName = new Map();
    for (const d of fileDefs) {
      const id = symId(cwd, f, d.name);
      defs.set(id, { file: toRel(cwd, f), name: d.name, line: d.line });
      if (!byName.has(d.name)) byName.set(d.name, []);
      byName.get(d.name).push(id);
    }
    defsByName.set(f, byName);
  }

  const forward = new Map();
  const reverse = new Map();
  // Additive: `forward`/`reverse` keep their existing shape, so every current
  // consumer is unaffected. Confidence is looked up by "from\u0000to".
  const edgeConfidence = new Map();
  const addEdge = (from, to, confidence) => {
    if (from === to) return;
    if (!forward.has(from)) forward.set(from, new Set());
    forward.get(from).add(to);
    if (!reverse.has(to)) reverse.set(to, new Set());
    reverse.get(to).add(from);
    if (confidence) {
      const k = from + '\u0000' + to;
      // A 'high' resolution never loses to a later 'medium' one.
      if (edgeConfidence.get(k) !== 'high') edgeConfidence.set(k, confidence);
    }
  };

  for (const [f, fileDefs] of perFileDefs.entries()) {
    const masked = maskFor(f, fs.readFileSync(f, 'utf8'));
    // resolution scope: this file's defs, then directly-imported files' defs
    const importedAbs = (fileGraph.forward.get(normalizePath(path.resolve(f))) || [])
      .map((nf) => normToAbs.get(nf)).filter(Boolean);
    // Go/Java: same-package symbols are visible with no import statement, and
    // a package is (in practice) a directory — extend the scope to same-dir
    // same-language siblings. Sorted for deterministic resolution order.
    const ext = path.extname(f).toLowerCase();
    if (GO_EXTS.has(ext) || JAVA_EXTS.has(ext)) {
      const siblings = [...perFileDefs.keys()]
        .filter((o) => o !== f && path.dirname(o) === path.dirname(f) && path.extname(o).toLowerCase() === ext)
        .sort();
      importedAbs.push(...siblings);
    }
    // Receiver types come from declarations anywhere in the file: fields are
    // declared outside any method body, locals inside one.
    const typeMap = JAVA_EXTS.has(ext) ? buildTypeMap(masked) : null;
    // Types reachable from this file, by name — imports first, then same-package
    // siblings, so an import always wins over a coincidental sibling name.
    const scopeByTypeName = new Map();
    if (typeMap) {
      for (const imp of importedAbs) {
        const base = path.basename(imp, path.extname(imp));
        if (!scopeByTypeName.has(base)) scopeByTypeName.set(base, imp);
      }
    }

    for (const d of fileDefs) {
      const callerId = symId(cwd, f, d.name);
      if (!forward.has(callerId)) forward.set(callerId, new Set()); // ensure node exists
      const callees = callsInRange(masked, d.bodyStart, d.bodyEnd);
      for (const nm of callees) {
        const local = (defsByName.get(f) || new Map()).get(nm);
        if (local && local.length) { for (const id of local) addEdge(callerId, id, 'high'); continue; }
        for (const imp of importedAbs) {
          const ids = (defsByName.get(imp) || new Map()).get(nm);
          if (ids && ids.length) { for (const id of ids) addEdge(callerId, id, 'high'); break; }
        }
      }

      // `receiver.method(` — resolve the receiver's declared type to a file.
      if (!typeMap) continue;
      for (const { receiver, method } of receiverCallsInRange(masked, d.bodyStart, d.bodyEnd)) {
        // A receiver that is itself a type name is a static call: `Foo.bar()`.
        const typeName = typeMap.get(receiver)
          || (fileByTypeName.has(receiver) ? receiver : null);
        if (!typeName) continue;                 // unknown receiver → no edge, never a guess

        let target = scopeByTypeName.get(typeName);
        let confidence = 'high';                 // typed receiver, resolved in scope
        if (!target) {
          const candidates = fileByTypeName.get(typeName) || [];
          if (candidates.length !== 1) continue; // ambiguous or absent → no edge
          target = candidates[0];
          confidence = 'medium';                 // type known, but not in this file's scope
        }
        const ids = (defsByName.get(target) || new Map()).get(method);
        if (ids && ids.length) for (const id of ids) addEdge(callerId, id, confidence);

        // Spring: the call names the interface, but the code that runs — and
        // that a reviewer changes — lives in the implementation. Both edges are
        // true, so both are recorded; without the second, blast radius on an
        // implementation is empty.
        const implFile = soleImpl(typeName);
        if (implFile && implFile !== target) {
          const implIds = (defsByName.get(implFile) || new Map()).get(method);
          if (implIds && implIds.length) for (const id of implIds) addEdge(callerId, id, confidence);
        }
      }
    }
  }

  const toArr = (mapOfSets) => {
    const out = new Map();
    for (const [k, set] of mapOfSets.entries()) out.set(k, [...set]);
    return out;
  };
  const scopeRoots = opts.files ? ['(explicit file list)'] : srcDirs;
  return {
    forward: toArr(forward), reverse: toArr(reverse), defs, edgeConfidence,
    scope: { roots: scopeRoots, files: files.length, dynamicLoads },
  };
}

/**
 * Collapse the symbol-level call-graph to FILE-level bidirectional edges for
 * the ranker's neighbor boost (opt-in via `retrieval.callGraphBoost`). A file
 * whose functions call into — or are called by — another file gets an edge in
 * both directions. Keys are `path.resolve`-form absolute paths (matching the
 * ranker's lookups); entries and neighbor lists are sorted for determinism.
 *
 * @param {string} cwd
 * @param {object} [opts] { graph } to inject a prebuilt call graph (tests)
 * @returns {{ forward: Map<string,string[]> }}
 */
function buildCallFileGraph(cwd, opts = {}) {
  const graph = opts.graph || buildCallGraph(cwd, opts);
  const edges = new Map(); // absFile → Set<absFile>
  const add = (a, b) => {
    if (a === b) return;
    if (!edges.has(a)) edges.set(a, new Set());
    edges.get(a).add(b);
  };
  for (const [callerId, calleeIds] of graph.forward.entries()) {
    const callerDef = graph.defs.get(callerId);
    if (!callerDef) continue;
    for (const calleeId of calleeIds) {
      const calleeDef = graph.defs.get(calleeId);
      if (!calleeDef || calleeDef.file === callerDef.file) continue;
      // Keyed through graphKey so the file-level call graph shares ONE key space
      // with the import graph. Previously this kept case while builder.js
      // lowercased, so a lookup correct for one silently missed on the other.
      const a = graphKey(path.resolve(cwd, callerDef.file));
      const b = graphKey(path.resolve(cwd, calleeDef.file));
      add(a, b);
      add(b, a);
    }
  }
  const forward = new Map();
  for (const k of [...edges.keys()].sort()) forward.set(k, [...edges.get(k)].sort());
  return { forward };
}

// Resolve a user-supplied symbol (bare name or full `file#name` id) to ids.
function _resolveSymbol(symbol, defs) {
  if (defs.has(symbol)) return [symbol];
  const ids = [];
  for (const id of defs.keys()) if (id.slice(id.indexOf('#') + 1) === symbol) ids.push(id);
  return ids;
}

// BFS over a graph map from seed ids up to maxDepth (0 = unlimited).
function _bfs(seedIds, graph, maxDepth) {
  const direct = new Set();
  const transitive = new Set();
  const visited = new Set(seedIds);
  let frontier = [];
  for (const s of seedIds) for (const nb of (graph.get(s) || [])) if (!visited.has(nb)) { direct.add(nb); visited.add(nb); frontier.push(nb); }
  let depth = 1;
  while (frontier.length && (maxDepth === 0 || depth < maxDepth)) {
    const next = [];
    for (const node of frontier) for (const nb of (graph.get(node) || [])) if (!visited.has(nb)) { transitive.add(nb); visited.add(nb); next.push(nb); }
    frontier = next; depth++;
  }
  return { direct: [...direct], transitive: [...transitive] };
}

/**
 * Method-level blast radius: everything that (transitively) calls `symbol`.
 *
 * @param {string} symbol  bare name or `file#name`
 * @param {string} cwd
 * @param {object} [opts]  { depth=0, ...buildCallGraph opts }
 * @returns {{ symbol:string, resolved:string[], direct:string[], transitive:string[], total:number, unresolved:boolean }}
 */
function methodImpact(symbol, cwd, opts = {}) {
  const graph = opts.graph || buildCallGraph(cwd, opts);
  const ids = _resolveSymbol(symbol, graph.defs);
  const scope = graph.scope || null;
  if (ids.length === 0) return { symbol, resolved: [], direct: [], transitive: [], total: 0, unresolved: true, scope };
  const { direct, transitive } = _bfs(ids, graph.reverse, opts.depth || 0);
  return { symbol, resolved: ids, direct, transitive, total: direct.length + transitive.length, unresolved: false, scope };
}

/**
 * Module loads the import graph cannot follow, per file.
 *
 * Two forms, both common in this codebase: a `require()` whose argument is not
 * a static string literal, and the bundle-safe wrappers (`requireSourceOrBundled`,
 * `__require`) that take a literal but are invisible to a resolver looking for
 * `require`/`import`. Each one is a caller edge that may exist and was not seen.
 */
function countDynamicLoads(src) {
  if (!src) return 0;
  let n = 0;
  const dynamicRequire = /\brequire\s*\(\s*(?!['"`])/g;
  const wrappers = /\b(?:requireSourceOrBundled|__require)\s*\(/g;
  while (dynamicRequire.exec(src)) n++;
  while (wrappers.exec(src)) n++;
  return n;
}

/**
 * What `symbol` (transitively) calls.
 * @returns {{ symbol:string, resolved:string[], direct:string[], transitive:string[], total:number, unresolved:boolean }}
 */
function methodCallees(symbol, cwd, opts = {}) {
  const graph = opts.graph || buildCallGraph(cwd, opts);
  const ids = _resolveSymbol(symbol, graph.defs);
  const scope = graph.scope || null;
  if (ids.length === 0) return { symbol, resolved: [], direct: [], transitive: [], total: 0, unresolved: true, scope };
  const { direct, transitive } = _bfs(ids, graph.forward, opts.depth || 0);
  return { symbol, resolved: ids, direct, transitive, total: direct.length + transitive.length, unresolved: false, scope };
}

// ── Formatters ───────────────────────────────────────────────────────────────
/**
 * What the search actually covered, as a human clause (#768).
 *
 * `--callers` printed `zero method blast radius` — an affirmative safety claim
 * — for symbols that are demonstrably called, because the graph walks srcDirs
 * only and cannot follow dynamic module loads. It could not distinguish "no
 * caller exists" from "no edge was found here", and that is precisely the
 * claim a developer leans on before changing a signature. `--impact` already
 * labels itself a lower bound; this brings the stronger claim into line.
 */
function _scopeClause(scope) {
  if (!scope) return 'lower bound — out-of-scope and dynamically-loaded callers are not resolved';
  const roots = (scope.roots || []).join(', ') || 'the configured source roots';
  const parts = [`searched ${roots}`];
  if (scope.files) parts.push(`${scope.files} file(s)`);
  let clause = `lower bound — ${parts.join(', ')}`;
  if (scope.dynamicLoads > 0) {
    clause += `; ${scope.dynamicLoads} dynamic module load(s) could not be followed`;
  }
  return clause;
}

function formatCallGraph(result, kind) {
  const verb = kind === 'callees' ? 'calls' : 'callers of';
  const lines = [`## ${kind === 'callees' ? 'Callees' : 'Callers'}: \`${result.symbol}\``, ''];
  if (result.unresolved) { lines.push('_symbol not found in the call-graph._'); return lines.join('\n'); }
  const qualifier = _scopeClause(result.scope);
  if (result.total === 0) {
    lines.push(kind === 'callees'
      ? `_no repo-defined callee found (${qualifier})._`
      : `_no caller found (${qualifier})._`);
    return lines.join('\n');
  }
  lines.push(`**Total ${verb}:** ${result.total} _(${qualifier})_`, '');
  if (result.direct.length) { lines.push(`### Direct`); for (const id of result.direct) lines.push(`- \`${id}\``); lines.push(''); }
  if (result.transitive.length) { lines.push(`### Transitive`); for (const id of result.transitive) lines.push(`- \`${id}\``); lines.push(''); }
  return lines.join('\n');
}

function formatCallGraphJSON(result, kind) {
  return {
    symbol: result.symbol,
    kind: kind === 'callees' ? 'callees' : 'callers',
    resolved: result.resolved,
    direct: result.direct,
    transitive: result.transitive,
    total: result.total,
    unresolved: result.unresolved,
    // The same qualification the human output carries, so a machine consumer
    // cannot read an unqualified zero either (#768).
    lowerBound: true,
    scope: result.scope || null,
  };
}

/**
 * `buildCallFileGraph` as the RANKER's opt-in call-neighbour boost has always
 * seen it: the project's pinned srcDirs, else `src app lib`. The detected roots
 * are for the blast-radius surfaces; what ranking is handed waits on #935 (see
 * `buildRankingGraph` in builder.js for the measurement).
 */
function buildRankingCallFileGraph(cwd, opts = {}) {
  if (opts.srcDirs != null || opts.files) return buildCallFileGraph(cwd, opts);
  return buildCallFileGraph(cwd, Object.assign({}, opts, { srcDirs: configuredSrcDirs(cwd) || ['src', 'app', 'lib'] }));
}

module.exports = {
  buildCallGraph, buildTypeMap, receiverCallsInRange, javaTypeDecl, DEFAULT_WALK_DEPTH, buildCallFileGraph, buildRankingCallFileGraph, methodImpact, methodCallees,
  formatCallGraph, formatCallGraphJSON,
  extractDefs, maskJs, maskPy, maskRust,
};
