'use strict';

/**
 * scip-edges.mjs — caller-to-callee edges derived from a SCIP index (#976).
 *
 * The reference side of the call-graph accuracy benchmark. SCIP carries compiler-resolved
 * definition and reference occurrences; this reduces them to the unit `buildCallGraph` also
 * speaks: a directed edge `<file>#<bare name> -> <file>#<bare name>`. The rules are the ones
 * written down in benchmarks/CALLGRAPH_ACCURACY_PROTOCOL.md, section 2, and each function
 * below says which step it is.
 *
 * Dev-only. Nothing here ships in the npm package, and no runtime code depends on a SCIP
 * indexer. The wire reader is src/scip/reader.js, reused for its varint and field iterators.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { fields, packedVarints } = require('../../src/scip/reader.js');

const DEFINITION_ROLE = 0x1;
/** SymbolInformation.Kind values scip-typescript sets on `local N` symbols (scip.proto). */
const KIND_FUNCTION = 17;
const KIND_METHOD = 26;
/** Document.PositionEncoding (scip.proto). */
const ENC_UTF8 = 1;
const ENC_UTF32 = 3;

/** Descriptor names that make a method a constructor: scip-java and scip-typescript spell it so. */
const CONSTRUCTOR_NAMES = new Set(['<init>', '<constructor>']);
/** Receivers that mean "the object this method belongs to" (protocol section 2, step 6). */
const SELF_RECEIVER = /(?:^|[^\w$.])(?:this|self|cls|super)\s*$/;
const SUPER_CALL_RECEIVER = /(?:^|[^\w$.])super\s*\([^()]*\)\s*$/;
const IDENTIFIER = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;

/** The order that decides which site class an edge with several sites takes. */
export const SITE_ORDER = ['bare', 'self', 'receiver', 'qualified'];

// ── Symbol grammar ───────────────────────────────────────────────────────────

/**
 * Split a SCIP symbol into its package part and its descriptor string. The first four
 * space-separated fields are scheme, manager, package name and version; a doubled space inside
 * one is an escaped space. Everything after is descriptors, which may contain spaces.
 * @param {string} symbol
 * @returns {{ rest: string, restAt: number }}
 */
function splitSymbol(symbol) {
  let i = 0;
  for (let field = 0; field < 4; field++) {
    while (i < symbol.length) {
      if (symbol[i] === ' ') {
        if (symbol[i + 1] === ' ') { i += 2; continue; }
        i++;
        break;
      }
      i++;
    }
  }
  return { rest: symbol.slice(i), restAt: i };
}

const SIMPLE = /[A-Za-z0-9_+\-$]/;

/**
 * Parse a descriptor string into `{ name, suffix, end }` records, `end` being the offset in
 * the string just past the descriptor. Suffixes: `/` namespace, `#` type, `.` term, `:` meta,
 * `!` macro, `()` method, `[]` type parameter, `(param)` parameter. Returns null on anything
 * that is not the grammar, so a symbol this reader does not understand is ignored, not guessed.
 * @param {string} s
 * @returns {Array<{ name: string, suffix: string, end: number }>|null}
 */
export function parseDescriptors(s) {
  const out = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    if (s[i] === '[') {
      const j = s.indexOf(']', i);
      if (j < 0) return null;
      out.push({ name: s.slice(i + 1, j), suffix: '[]', end: j + 1 });
      i = j + 1;
      continue;
    }
    if (s[i] === '(') {
      const j = s.indexOf(')', i);
      if (j < 0) return null;
      out.push({ name: s.slice(i + 1, j), suffix: '(param)', end: j + 1 });
      i = j + 1;
      continue;
    }
    let name;
    if (s[i] === '`') {
      let j = i + 1;
      let text = '';
      while (j < n) {
        if (s[j] === '`') {
          if (s[j + 1] === '`') { text += '`'; j += 2; continue; }
          break;
        }
        text += s[j++];
      }
      if (j >= n) return null;
      name = text;
      i = j + 1;
    } else {
      let j = i;
      while (j < n && SIMPLE.test(s[j])) j++;
      if (j === i) return null;
      name = s.slice(i, j);
      i = j;
    }
    const c = s[i];
    if (c === '/' || c === '#' || c === '.' || c === ':' || c === '!') {
      out.push({ name, suffix: c, end: i + 1 });
      i++;
    } else if (c === '(') {
      const j = s.indexOf(')', i);
      if (j < 0 || s[j + 1] !== '.') return null;
      out.push({ name, suffix: '()', end: j + 2 });
      i = j + 2;
    } else {
      return null;
    }
  }
  return out;
}

/**
 * What a symbol is, for the benchmark (protocol section 2, step 2).
 *
 *   function     last descriptor is a method and the one before it is not a type
 *   method       last descriptor is a method and the one before it is a type
 *   class        last descriptor is a type
 *   constructor  a method named `<init>` or `<constructor>`; `owner` is its class's symbol
 *
 * `kind` is SymbolInformation.kind, used only for a `local N` symbol, which has no descriptors.
 * @param {string} symbol
 * @param {number} [kind]
 * @returns {{ cls: 'function'|'method'|'class'|'constructor', owner?: string }|null}
 */
export function classifySymbol(symbol, kind = 0) {
  if (symbol.startsWith('local ')) {
    return kind === KIND_FUNCTION || kind === KIND_METHOD ? { cls: 'function' } : null;
  }
  const { rest, restAt } = splitSymbol(symbol);
  const d = parseDescriptors(rest);
  if (!d || !d.length) return null;
  const last = d[d.length - 1];
  const prev = d[d.length - 2];
  if (last.suffix === '#') return { cls: 'class' };
  if (last.suffix !== '()') return null;
  if (CONSTRUCTOR_NAMES.has(last.name)) {
    return prev && prev.suffix === '#' ? { cls: 'constructor', owner: symbol.slice(0, restAt + prev.end) } : null;
  }
  return { cls: prev && prev.suffix === '#' ? 'method' : 'function' };
}

// ── Reading an index ─────────────────────────────────────────────────────────

/**
 * Read a SCIP index into what the derivation needs. Occurrences are reduced as they are read:
 * a definition is kept when it can be a caller or a callee, a reference is kept when its symbol
 * is callable or a class. Everything else (parameters, properties, imports, types) is the
 * bulk of an index and is dropped here, so a large repository fits in memory.
 *
 * @param {Buffer} buf
 * @returns {{
 *   tool: string,
 *   documents: Map<string, { encoding: number, defs: Array<object>, refs: Array<object> }>,
 * }}
 */
export function readScipIndex(buf) {
  let tool = '';
  const documents = new Map();
  const classes = new Map(); // symbol -> classification, so a symbol is parsed once
  const classOf = (symbol, kind) => {
    if (symbol.startsWith('local ')) return classifySymbol(symbol, kind);
    if (!classes.has(symbol)) classes.set(symbol, classifySymbol(symbol));
    return classes.get(symbol);
  };

  for (const [f, v] of fields(buf)) {
    if (f === 1) {
      for (const [mf, mv] of fields(v)) {
        if (mf !== 2) continue;
        let name = '';
        let version = '';
        for (const [tf, tv] of fields(mv)) {
          if (tf === 1) name = tv.toString('utf8');
          if (tf === 2) version = tv.toString('utf8');
        }
        tool = version ? `${name}@${version}` : name;
      }
      continue;
    }
    if (f !== 2) continue;

    let rel = '';
    let encoding = 0;
    const occurrences = [];
    const kinds = new Map();
    for (const [df, dv] of fields(v)) {
      if (df === 1) rel = dv.toString('utf8');
      else if (df === 6) encoding = dv;
      else if (df === 3) {
        let symbol = '';
        let kind = 0;
        for (const [sf, sv] of fields(dv)) {
          if (sf === 1) symbol = sv.toString('utf8');
          if (sf === 5) kind = sv;
        }
        if (symbol && kind) kinds.set(symbol, kind);
      } else if (df === 2) {
        let range = null;
        let typedRange = null;
        let symbol = '';
        let roles = 0;
        let enclosing = null;
        let typedEnclosing = null;
        for (const [of, ov] of fields(dv)) {
          if (of === 1) range = Buffer.isBuffer(ov) ? packedVarints(ov) : [ov];
          else if (of === 2) symbol = ov.toString('utf8');
          else if (of === 3) roles = ov;
          else if (of === 7) enclosing = Buffer.isBuffer(ov) ? packedVarints(ov) : [ov];
          else if (of === 8 || of === 9) typedRange = typed(ov, of === 9);
          else if (of === 10 || of === 11) typedEnclosing = typed(ov, of === 11);
        }
        // The typed forms take precedence over the deprecated packed ones (scip.proto, Occurrence).
        range = typedRange || range;
        enclosing = typedEnclosing || enclosing;
        if (range && symbol) occurrences.push({ range, symbol, roles, enclosing });
      }
    }
    if (!rel) continue;

    const defs = [];
    const refs = [];
    for (const o of occurrences) {
      const info = classOf(o.symbol, kinds.get(o.symbol) || 0);
      if (!info) continue;
      const [l0, c0, l1, c1] = normRange(o.range);
      if (o.roles & DEFINITION_ROLE) {
        // A single-line identifier range is the name; anything else is not a definition we can name.
        if (l0 !== l1) continue;
        defs.push({ symbol: o.symbol, cls: info.cls, owner: info.owner || null, line: l0, c0, c1, enclosing: o.enclosing ? normRange(o.enclosing) : null });
      } else if (l0 === l1) {
        refs.push({ symbol: o.symbol, line: l0, c0, c1 });
      }
    }
    documents.set(rel.replace(/\\/g, '/'), { encoding, defs, refs });
  }
  return { tool, documents };
}

/**
 * A typed range message: SingleLineRange { line, start_character, end_character } or
 * MultiLineRange { start_line, start_character, end_line, end_character }. Written by scip-go
 * since the schema deprecated the packed `range`; every field is a varint and a missing one is 0.
 */
function typed(buf, multi) {
  const v = [0, 0, 0, 0];
  for (const [f, x] of fields(buf)) if (f >= 1 && f <= (multi ? 4 : 3)) v[f - 1] = x;
  return multi ? v : v.slice(0, 3);
}

/** `[line, from, to]` and `[line, from, line2, to]` are both valid SCIP ranges. */
export function normRange(r) {
  return r.length >= 4 ? [r[0], r[1], r[2], r[3]] : [r[0], r[1], r[0], r[2]];
}

// ── Source positions ─────────────────────────────────────────────────────────

/** A source split on every line terminator SCIP indexers split on. */
export function splitLines(text) {
  return text.split(/\r\n|\n|\r/);
}

/** An index into the JS string `line` for a column in the index's position encoding. */
function colIndex(line, col, encoding) {
  if (encoding === ENC_UTF8) {
    // The common case first: a pure-ASCII line needs no conversion.
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7f]*$/.test(line)) return col;
    return Buffer.from(line, 'utf8').subarray(0, col).toString('utf8').length;
  }
  if (encoding === ENC_UTF32) {
    let units = 0;
    let seen = 0;
    for (const ch of line) {
      if (seen >= col) break;
      units += ch.length;
      seen++;
    }
    return units;
  }
  return col; // UTF-16, which is also what an unspecified encoding means for the JS-based indexers
}

/**
 * The call test and the site class of one reference (protocol section 2, steps 4 and 6).
 * @param {string} line  the source line the reference is on
 * @param {number} from  index of the first character of the identifier
 * @param {number} to    index just past the identifier
 * @returns {{ call: boolean, dot: boolean, self: boolean }}
 */
export function classifySite(line, from, to) {
  let after = line.slice(to).trimStart();
  if (after[0] === '<') {
    let depth = 0;
    let k = 0;
    for (; k < after.length; k++) {
      if (after[k] === '<') depth++;
      else if (after[k] === '>') { depth--; if (depth === 0) break; }
    }
    // Type arguments hold no operators: `a < b && c > (d)` is a comparison, not `a<...>(d)`.
    const typeArgs = depth === 0 && k < after.length ? after.slice(0, k + 1) : null;
    after = typeArgs && !/[()&|;]/.test(typeArgs) ? after.slice(k + 1).trimStart() : '';
  }
  const call = after[0] === '(';

  const before = line.slice(0, from).replace(/\s+$/, '');
  const dot = /(?<!\.)\.$/.test(before) || /\?\.$/.test(before);
  const receiver = before.replace(/\??\.$/, '');
  const self = dot && (SELF_RECEIVER.test(receiver) || SUPER_CALL_RECEIVER.test(receiver));
  return { call, dot, self };
}

// ── Reference edges ──────────────────────────────────────────────────────────

const CALLER_KINDS = new Set(['function', 'method', 'constructor']);
/** Call sites kept per edge, for the diagnostics that ask whether every one is invisible to the graph. */
const MAX_SITES = 8;

/** Does the range `enc` ([l0, c0, l1, c1]) contain the position (line, col)? */
export function contains(enc, line, col) {
  if (line < enc[0] || line > enc[2]) return false;
  if (line === enc[0] && col < enc[1]) return false;
  if (line === enc[2] && col > enc[3]) return false;
  return true;
}

/**
 * Is range `a` nested deeper than `b`? Both contain the same position, so they are nested:
 * the inner one starts later, or starts together and ends sooner.
 */
function deeper(a, b) {
  if (a[0] !== b[0]) return a[0] > b[0];
  if (a[1] !== b[1]) return a[1] > b[1];
  if (a[2] !== b[2]) return a[2] < b[2];
  return a[3] < b[3];
}

/**
 * The key a symbol is looked up by. A `local N` symbol is only unique within its document
 * (scip.proto), so two files' `local 5` must not meet.
 */
function symbolKey(rel, symbol) {
  return symbol.startsWith('local ') ? `${rel}\u0000${symbol}` : symbol;
}

/**
 * Derive the reference edges of an index (protocol section 2).
 *
 * @param {{ documents: Map<string, object> }} index  from readScipIndex
 * @param {(rel: string) => string|null} readSource  the text of a document, or null
 * @returns {{
 *   edges: Map<string, { callerFile, callerName, calleeFile, calleeName, kind, site, sites: Array<[line, col]>, siteCount }>,
 *   nodeKinds: Map<string, string>,   every node the index defines as a callable or class, by kind
 *   callerNodes: Set<string>,         the nodes that have a body range, so can be a caller
 *   nodeRanges: Map<string, object>,  where each node is defined and the body ranges it has, for the nesting diagnostic
 *   documents: Set<string>,
 *   counts: { edges: number, nonCall: number, topLevel: number, external: number, selfEdges: number, sourceMissing: number, rangeMismatch: number },
 * }}
 */
export function deriveReferenceEdges(index, readSource) {
  const counts = { edges: 0, nonCall: 0, topLevel: 0, external: 0, selfEdges: 0, sourceMissing: 0, rangeMismatch: 0 };
  const lineCache = new Map();
  const linesOf = (rel) => {
    if (!lineCache.has(rel)) {
      const text = readSource(rel);
      lineCache.set(rel, text == null ? null : splitLines(text));
    }
    return lineCache.get(rel);
  };

  // Pass 1: every definition's name, from the source at its range; symbol -> definition.
  const rels = [...index.documents.keys()].sort();
  const defOf = new Map();
  const callersByDoc = new Map();
  const nodeKinds = new Map();
  const callerNodes = new Set();
  const nodeRanges = new Map(); // node id -> { defs: [[line, col]], enclosing: [range] }, in index units
  const nodeRank = { function: 0, method: 1, constructor: 2, class: 3 };
  for (const rel of rels) {
    const doc = index.documents.get(rel);
    const lines = linesOf(rel);
    if (!lines) { counts.sourceMissing++; continue; }
    for (const d of doc.defs) {
      const line = lines[d.line];
      if (line === undefined) { counts.rangeMismatch++; continue; }
      const name = line.slice(colIndex(line, d.c0, doc.encoding), colIndex(line, d.c1, doc.encoding));
      if (!IDENTIFIER.test(name)) { counts.rangeMismatch++; continue; }
      const def = { rel, name, cls: d.cls, owner: d.owner };
      const key = symbolKey(rel, d.symbol);
      if (!defOf.has(key)) defOf.set(key, def);
      const kind = d.cls === 'class' ? 'constructor' : d.cls;
      const id = `${rel}#${name}`;
      if (!nodeKinds.has(id) || nodeRank[kind] < nodeRank[nodeKinds.get(id)]) nodeKinds.set(id, kind);
      if (!nodeRanges.has(id)) nodeRanges.set(id, { defs: [], enclosing: [] });
      nodeRanges.get(id).defs.push([d.line, d.c0]);
      if (CALLER_KINDS.has(d.cls) && d.enclosing) nodeRanges.get(id).enclosing.push(d.enclosing);
      if (CALLER_KINDS.has(d.cls) && d.enclosing) {
        if (!callersByDoc.has(rel)) callersByDoc.set(rel, []);
        callersByDoc.get(rel).push({ name, enclosing: d.enclosing });
        callerNodes.add(id);
      }
    }
  }

  // Pass 2: every reference that is a call to a callable or a class defined in the index.
  const edges = new Map();
  for (const rel of rels) {
    const doc = index.documents.get(rel);
    const lines = linesOf(rel);
    if (!lines) continue;
    const callers = callersByDoc.get(rel) || [];
    for (const r of doc.refs) {
      let target = defOf.get(symbolKey(rel, r.symbol));
      if (!target) { counts.external++; continue; }
      // A constructor call is an edge to its class: both the class and its constructor
      // symbol can be referenced at one `new Foo(`, and they must be one edge.
      if (target.cls === 'constructor') target = defOf.get(target.owner);
      if (!target) { counts.external++; continue; }

      const line = lines[r.line];
      if (line === undefined) { counts.rangeMismatch++; continue; }
      const from = colIndex(line, r.c0, doc.encoding);
      const to = colIndex(line, r.c1, doc.encoding);
      if (!IDENTIFIER.test(line.slice(from, to))) { counts.rangeMismatch++; continue; }

      const site = classifySite(line, from, to);
      if (!site.call) { counts.nonCall++; continue; }

      let caller = null;
      for (const c of callers) {
        if (!contains(c.enclosing, r.line, r.c0)) continue;
        if (!caller || deeper(c.enclosing, caller.enclosing)) caller = c;
      }
      if (!caller) { counts.topLevel++; continue; }

      const callerId = `${rel}#${caller.name}`;
      const calleeId = `${target.rel}#${target.name}`;
      if (callerId === calleeId) { counts.selfEdges++; continue; }

      const kind = target.cls === 'class' ? 'constructor' : target.cls;
      const siteClass = kind === 'method'
        ? (site.dot ? (site.self ? 'self' : 'receiver') : 'bare')
        : (site.dot ? 'qualified' : 'bare');
      const key = `${callerId}\u0000${calleeId}`;
      const known = edges.get(key);
      if (known) {
        if (SITE_ORDER.indexOf(siteClass) < SITE_ORDER.indexOf(known.site)) known.site = siteClass;
        if (known.sites.length < MAX_SITES) known.sites.push([r.line, from]);
        known.siteCount++;
        continue;
      }
      edges.set(key, { callerFile: rel, callerName: caller.name, calleeFile: target.rel, calleeName: target.name, kind, site: siteClass, sites: [[r.line, from]], siteCount: 1 });
    }
  }
  counts.edges = edges.size;
  return { edges, nodeKinds, callerNodes, nodeRanges, documents: new Set(rels), counts };
}
