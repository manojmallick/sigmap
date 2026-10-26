'use strict';

/**
 * Call-graph accuracy harness (#976): `scripts/run-callgraph-accuracy.mjs`, the SCIP edge
 * derivation in `scripts/lib/scip-edges.mjs` and the arithmetic in
 * `scripts/lib/callgraph-accuracy.mjs`.
 *
 * The harness compares SigMap's call graph with caller-to-callee edges derived from a SCIP
 * index. What is pinned here is the part that has to be right for the numbers to mean
 * anything: what a symbol is (function, method, class, constructor), what a call is, which
 * definition a call belongs to, that a `local N` symbol never crosses a file, that a graph edge
 * outside the comparison universe is not scored, that an interval is reproducible, and that the
 * protocol committed before the run is the one the harness reads and the prose quotes. Indexes
 * are built in the test from a small protobuf encoder, so each case has a known answer. One
 * end-to-end case runs the real indexers over a few lines of TypeScript and Python, and skips
 * (loudly) where they are not installed: set SIGMAP_SCIP_INDEXERS to the directory
 * `run-callgraph-accuracy.mjs --setup-indexers` filled.
 *
 * Run: node test/integration/callgraph-accuracy.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const RUNNER = path.join(ROOT, 'scripts/run-callgraph-accuracy.mjs');

let passed = 0;
let failed = 0;
let skipped = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}
function skip(name, why) {
  console.log(`  SKIP  ${name} (${why})`);
  skipped++;
}

const tmpDirs = [];
function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

// ── a SCIP encoder, enough for the fields the reader reads ───────────────────

function varint(n) {
  const out = [];
  let v = BigInt(n);
  while (v >= 0x80n) { out.push(Number(v & 0x7fn) | 0x80); v >>= 7n; }
  out.push(Number(v));
  return Buffer.from(out);
}
const tag = (field, wire) => varint((field << 3) | wire);
const vi = (field, n) => Buffer.concat([tag(field, 0), varint(n)]);
const ld = (field, buf) => Buffer.concat([tag(field, 2), varint(buf.length), buf]);
const str = (field, s) => ld(field, Buffer.from(s, 'utf8'));
const packed = (field, nums) => ld(field, Buffer.concat(nums.map(varint)));
const none = Buffer.alloc(0);

function occurrence({ range, symbol, roles = 0, enclosing, typed }) {
  // `typed` writes the ranges the way scip-go does since the schema deprecated the packed form
  const msg = (r, single, multi) => (r.length === 3
    ? ld(single, Buffer.concat(r.map((n, i) => vi(i + 1, n))))
    : ld(multi, Buffer.concat(r.map((n, i) => vi(i + 1, n)))));
  const ranges = typed === 'only'
    ? [msg(range, 8, 9), enclosing ? msg(enclosing, 10, 11) : none]
    : typed === 'both-disagree'
      ? [packed(1, [9, 9, 9]), msg(range, 8, 9), enclosing ? packed(7, [9, 9, 9, 9]) : none, enclosing ? msg(enclosing, 10, 11) : none]
      : [packed(1, range), enclosing ? packed(7, enclosing) : none];
  return Buffer.concat([...ranges, str(2, symbol), roles ? vi(3, roles) : none]);
}
function information({ symbol, kind }) {
  return Buffer.concat([str(1, symbol), kind ? vi(5, kind) : none]);
}
function document({ rel, occurrences = [], symbols = [], encoding }) {
  return Buffer.concat([str(1, rel), ...occurrences.map((o) => ld(2, occurrence(o))), ...symbols.map((s) => ld(3, information(s))), encoding ? vi(6, encoding) : none]);
}
function scipIndex(documents, tool = ['test-indexer', '1.0.0']) {
  return Buffer.concat([ld(1, ld(2, Buffer.concat([str(1, tool[0]), str(2, tool[1])]))), ...documents.map((d) => ld(2, document(d)))]);
}

/** A TypeScript-style symbol: `scip-typescript npm . . \`file\`/descriptors`. */
const S = (file, desc) => `scip-typescript npm . . \`${file}\`/${desc}`;

/**
 * Build an index and its sources from a compact description. A definition is placed where its
 * name first appears on its line; a reference where the `text` appears for the `nth` time.
 *   files: { 'a.ts': { lines: [...], defs: [{ sym, line, name, enc: [l0,c0,l1,c1], kind }], refs: [{ sym, line, text, nth }] } }
 */
function build(files, { encoding, typed } = {}) {
  const documents = [];
  const sources = {};
  for (const [rel, f] of Object.entries(files)) {
    sources[rel] = f.lines.join('\n');
    const occurrences = [];
    const symbols = [];
    const place = (line, text, nth = 0) => {
      let at = -1;
      for (let i = 0; i <= nth; i++) at = f.lines[line].indexOf(text, at + 1);
      assert.ok(at >= 0, `${rel}:${line} has no ${nth + 1}th "${text}"`);
      return [line, at, at + text.length];
    };
    for (const d of f.defs || []) {
      occurrences.push({ range: place(d.line, d.name, d.nth), symbol: d.sym, roles: 1, enclosing: d.enc });
      if (d.kind) symbols.push({ symbol: d.sym, kind: d.kind });
    }
    for (const r of f.refs || []) occurrences.push({ range: place(r.line, r.text, r.nth), symbol: r.sym });
    documents.push({ rel, occurrences: occurrences.map((o) => ({ ...o, typed })), symbols, encoding });
  }
  return { buf: scipIndex(documents), read: (rel) => (rel in sources ? sources[rel] : null) };
}

// ── the tests ────────────────────────────────────────────────────────────────

(async () => {
  const edges = await import('../../scripts/lib/scip-edges.mjs');
  const lib = await import('../../scripts/lib/callgraph-accuracy.mjs');
  const runner = await import('../../scripts/run-callgraph-accuracy.mjs');

  const derive = (spec, opts) => {
    const { buf, read } = build(spec, opts);
    return edges.deriveReferenceEdges(edges.readScipIndex(buf), read);
  };
  const listing = (ref) => [...ref.edges.values()].map((e) => `${e.kind}/${e.site} ${e.callerFile}#${e.callerName}->${e.calleeFile}#${e.calleeName}`).sort();

  // ── what a symbol is ───────────────────────────────────────────────────────

  await test('a symbol is a function, a method, a class or a constructor by its last descriptors, never by SymbolInformation.kind', () => {
    const c = (s, kind) => { const r = edges.classifySymbol(s, kind); return r && r.cls; };
    assert.strictEqual(c(S('src/a.ts', 'helper().')), 'function');
    assert.strictEqual(c(S('a.ts', 'Repo#save().')), 'method');
    assert.strictEqual(c(S('a.ts', 'Repo#')), 'class');
    // scip-python gives a function nested in a function full descriptors: it is NOT a method
    assert.strictEqual(c('scip-python python click 0 `src.click.utils`/safecall().wrapper().'), 'function');
    assert.strictEqual(c('scip-python python click 0 `src.click.utils`/LazyFile#open().'), 'method');
    assert.strictEqual(c('scip-python python click 0 `src.click.utils`/LazyFile#'), 'class');
    // a method named like a constructor is one, and knows its class
    const ts = edges.classifySymbol(S('a.ts', 'Repo#`<constructor>`().'));
    assert.deepStrictEqual(ts, { cls: 'constructor', owner: S('a.ts', 'Repo#') });
    const java = edges.classifySymbol('scip-java maven com.google.code.gson/gson 2.11 com/google/gson/Gson#`<init>`().');
    assert.strictEqual(java.cls, 'constructor');
    assert.strictEqual(java.owner, 'scip-java maven com.google.code.gson/gson 2.11 com/google/gson/Gson#');
    // an overload disambiguator belongs to the method descriptor
    assert.strictEqual(c('scip-java maven g/a 1 com/google/gson/Gson#toJson(+1).'), 'method');
    // properties, parameters, meta and garbage are nothing
    assert.strictEqual(c(S('a.ts', 'port.')), null);
    assert.strictEqual(c(S('a.ts', 'run().(store)')), null);
    assert.strictEqual(c(S('a.ts', 'buildFromCwd0:')), null);
    assert.strictEqual(c('not a symbol'), null);
    assert.strictEqual(c(S('a.ts', 'broken(')), null);
  });

  await test('a local symbol has no descriptors, so only its kind can make it a function', () => {
    assert.strictEqual(edges.classifySymbol('local 5', 17).cls, 'function');
    assert.strictEqual(edges.classifySymbol('local 5', 26).cls, 'function');
    assert.strictEqual(edges.classifySymbol('local 5', 8), null, 'a constant is not callable');
    assert.strictEqual(edges.classifySymbol('local 5', 0), null);
  });

  await test('descriptors parse escaped names, doubled backticks and the package part with an escaped space', () => {
    const d = edges.parseDescriptors('src/`weird``name.ts`/f().');
    assert.deepStrictEqual(d.map((x) => [x.name, x.suffix]), [['src', '/'], ['weird`name.ts', '/'], ['f', '()']]);
    const c = edges.classifySymbol('scip-x mgr my  pkg 1.0 `a.ts`/go().');
    assert.strictEqual(c && c.cls, 'function', 'a doubled space in a package field is one escaped space, not a separator');
  });

  // ── what a call is ─────────────────────────────────────────────────────────

  await test('a reference is a call only when a "(" follows, after any balanced type arguments', () => {
    const site = (line, text) => { const i = line.indexOf(text); return edges.classifySite(line, i, i + text.length); };
    assert.strictEqual(site('  helper(3);', 'helper').call, true);
    assert.strictEqual(site('  helper (3);', 'helper').call, true);
    assert.strictEqual(site('  [1].map(helper);', 'helper').call, false, 'a function passed as a value');
    assert.strictEqual(site('  const f = helper;', 'helper').call, false);
    assert.strictEqual(site('  g<number>(1);', 'g').call, true, 'type arguments before the parenthesis');
    assert.strictEqual(site('  new Map<string, Foo<T>>(x);', 'Map').call, true, 'nested type arguments');
    assert.strictEqual(site('  if (a < b && c > (d)) {}', 'a').call, false, 'a comparison is not type arguments');
    assert.strictEqual(site('  return render;', 'render').call, false);
  });

  await test('a call through "this", "self", "cls" or "super" is self; through any other receiver it is a receiver call; without a dot it is bare', () => {
    const site = (line, text) => { const i = line.lastIndexOf(text); return edges.classifySite(line, i, i + text.length); };
    for (const l of ['this.log(x)', 'self.log(x)', 'cls.log(x)', 'super.log(x)', 'super().log(x)', 'super(Child, self).log(x)', 'x = this?.log(x)']) {
      const s = site(`  ${l}`, 'log');
      assert.ok(s.dot && s.self, l);
    }
    for (const l of ['store.log(x)', 'this.repo.log(x)', 'self.repo.log(x)', 'a.b().log(x)', 'items[0].log(x)', 'thisx.log(x)', 'myself.log(x)']) {
      const s = site(`  ${l}`, 'log');
      assert.ok(s.dot && !s.self, l);
    }
    const bare = site('  log(x)', 'log');
    assert.ok(!bare.dot && !bare.self);
    assert.ok(!site('  foo(...log(x))', 'log').dot, 'a spread is not a member access');
    const chained = site('      .log(x)', 'log');
    assert.ok(chained.dot && !chained.self, 'a call continued on the next line is a receiver call');
  });

  // ── reference edges ────────────────────────────────────────────────────────

  const FN = 17;
  await test('edges: bare, self, receiver and qualified calls, a constructor, and everything that is not an edge', () => {
    const ref = derive({
      'a.ts': {
        lines: [
          'function helper(x) { return x; }',                  // 0
          'class Repo {',                                      // 1
          '  save() { this.log(); helper(1); }',              // 2
          '  log() { helper(2); }',                            // 3
          '}',                                                 // 4
          'function make() { return new Repo(); }',            // 5
          'helper(9);',                                        // 6  top level
          'function use(s) { s.put(); a.helper(3); [1].map(helper); external(); }', // 7
          'class Store { put() {} }',                          // 8
        ],
        defs: [
          { sym: S('a.ts', 'helper().'), line: 0, name: 'helper', enc: [0, 0, 0, 32] },
          { sym: S('a.ts', 'Repo#'), line: 1, name: 'Repo', enc: [1, 0, 4, 1] },
          { sym: S('a.ts', 'Repo#save().'), line: 2, name: 'save', enc: [2, 2, 2, 38] },
          { sym: S('a.ts', 'Repo#log().'), line: 3, name: 'log', enc: [3, 2, 3, 24] },
          { sym: S('a.ts', 'make().'), line: 5, name: 'make', enc: [5, 0, 5, 38] },
          { sym: S('a.ts', 'use().'), line: 7, name: 'use', enc: [7, 0, 7, 70] },
          { sym: S('a.ts', 'Store#put().'), line: 8, name: 'put', enc: [8, 14, 8, 22] },
        ],
        refs: [
          { sym: S('a.ts', 'Repo#log().'), line: 2, text: 'log' },
          { sym: S('a.ts', 'helper().'), line: 2, text: 'helper' },
          { sym: S('a.ts', 'helper().'), line: 3, text: 'helper' },
          { sym: S('a.ts', 'Repo#'), line: 5, text: 'Repo' },
          { sym: S('a.ts', 'helper().'), line: 6, text: 'helper' },
          { sym: S('a.ts', 'Store#put().'), line: 7, text: 'put' },
          { sym: S('a.ts', 'helper().'), line: 7, text: 'helper', nth: 0 },
          { sym: S('a.ts', 'helper().'), line: 7, text: 'helper', nth: 1 },
          { sym: S('lib/other.ts', 'external().'), line: 7, text: 'external' },
        ],
      },
    });
    assert.deepStrictEqual(listing(ref), [
      'constructor/bare a.ts#make->a.ts#Repo',
      'function/bare a.ts#log->a.ts#helper',
      'function/bare a.ts#save->a.ts#helper',
      'function/qualified a.ts#use->a.ts#helper',
      'method/receiver a.ts#use->a.ts#put',
      'method/self a.ts#save->a.ts#log',
    ]);
    assert.strictEqual(ref.counts.topLevel, 1, 'helper(9) at module level has no caller');
    assert.strictEqual(ref.counts.nonCall, 1, 'the callback reference');
    assert.strictEqual(ref.counts.external, 1, 'a symbol the index does not define');
  });

  await test('a class and its constructor referenced at one "new" are one edge, to the class, not to a node called "constructor"', () => {
    const ref = derive({
      'a.ts': {
        lines: ['class Repo { constructor() {} }', 'function make() { return new Repo(); }'],
        defs: [
          { sym: S('a.ts', 'Repo#'), line: 0, name: 'Repo', enc: [0, 0, 0, 31] },
          { sym: S('a.ts', 'Repo#`<constructor>`().'), line: 0, name: 'constructor', enc: [0, 13, 0, 29] },
          { sym: S('a.ts', 'make().'), line: 1, name: 'make', enc: [1, 0, 1, 38] },
        ],
        refs: [
          { sym: S('a.ts', 'Repo#'), line: 1, text: 'Repo' },
          { sym: S('a.ts', 'Repo#`<constructor>`().'), line: 1, text: 'Repo' },
        ],
      },
    });
    assert.deepStrictEqual(listing(ref), ['constructor/bare a.ts#make->a.ts#Repo']);
    // and a constructor referenced alone (no class reference at the site) still lands on the class
    const alone = derive({
      'a.ts': {
        lines: ['class Repo { constructor() {} }', 'function make() { return new Repo(); }'],
        defs: [
          { sym: S('a.ts', 'Repo#'), line: 0, name: 'Repo', enc: [0, 0, 0, 31] },
          { sym: S('a.ts', 'Repo#`<constructor>`().'), line: 0, name: 'constructor', enc: [0, 13, 0, 29] },
          { sym: S('a.ts', 'make().'), line: 1, name: 'make', enc: [1, 0, 1, 38] },
        ],
        refs: [{ sym: S('a.ts', 'Repo#`<constructor>`().'), line: 1, text: 'Repo' }],
      },
    });
    assert.deepStrictEqual(listing(alone), ['constructor/bare a.ts#make->a.ts#Repo']);
  });

  await test('the caller is the innermost callable whose range holds the call, not the outer one', () => {
    const ref = derive({
      'a.py': {
        lines: ['def helper(): pass', 'def outer():', '    def inner():', '        helper()', '    inner()'],
        defs: [
          { sym: 'scip-python python p 0 `a`/helper().', line: 0, name: 'helper', enc: [0, 0, 0, 18] },
          { sym: 'scip-python python p 0 `a`/outer().', line: 1, name: 'outer', enc: [1, 0, 4, 11] },
          { sym: 'scip-python python p 0 `a`/outer().inner().', line: 2, name: 'inner', enc: [2, 4, 3, 16] },
        ],
        refs: [
          { sym: 'scip-python python p 0 `a`/helper().', line: 3, text: 'helper' },
          { sym: 'scip-python python p 0 `a`/outer().inner().', line: 4, text: 'inner' },
        ],
      },
    });
    assert.deepStrictEqual(listing(ref), ['function/bare a.py#inner->a.py#helper', 'function/bare a.py#outer->a.py#inner']);
  });

  await test('two nested ranges that cover the same lines still pick the one that starts later', () => {
    const ref = derive({
      'a.js': {
        lines: ['const a = () => { const b = () => { target(); }; };', 'function target() {}'],
        defs: [
          { sym: S('a.js', 'a().'), line: 0, name: 'a', enc: [0, 0, 0, 51] },
          { sym: S('a.js', 'b().'), line: 0, name: 'b', enc: [0, 22, 0, 49] },
          { sym: S('a.js', 'target().'), line: 1, name: 'target', enc: [1, 0, 1, 19] },
        ],
        refs: [{ sym: S('a.js', 'target().'), line: 0, text: 'target' }],
      },
    });
    assert.deepStrictEqual(listing(ref), ['function/bare a.js#b->a.js#target']);
  });

  await test('a local symbol is local to its file: two files that each define their own "local 1" never meet', () => {
    const ref = derive({
      'a.ts': {
        lines: ['function a() { const loc = () => {}; }', 'function x() { loc(); }'],
        defs: [
          { sym: 'local 1', line: 0, name: 'loc', kind: FN, enc: [0, 15, 0, 35] },
          { sym: S('a.ts', 'a().'), line: 0, name: 'a', enc: [0, 0, 0, 38] },
          { sym: S('a.ts', 'x().'), line: 1, name: 'x', enc: [1, 0, 1, 23] },
        ],
        refs: [{ sym: 'local 1', line: 1, text: 'loc' }],
      },
      'b.ts': {
        lines: ['function b() { const other = () => {}; }', 'function y() { other(); }'],
        defs: [
          { sym: 'local 1', line: 0, name: 'other', kind: FN, enc: [0, 15, 0, 38] },
          { sym: S('b.ts', 'b().'), line: 0, name: 'b', enc: [0, 0, 0, 41] },
          { sym: S('b.ts', 'y().'), line: 1, name: 'y', enc: [1, 0, 1, 25] },
        ],
        refs: [{ sym: 'local 1', line: 1, text: 'other' }],
      },
    });
    // a global lookup by symbol string would send y() to a.ts#loc, the first "local 1" it saw
    assert.deepStrictEqual(listing(ref), ['function/bare a.ts#x->a.ts#loc', 'function/bare b.ts#y->b.ts#other']);
  });

  await test('a local symbol with no kind, or whose only definition is in another file, is not an edge and not a crash', () => {
    const ref = derive({
      'a.ts': {
        lines: ['function a() { const loc = () => {}; }'],
        defs: [{ sym: 'local 1', line: 0, name: 'loc', kind: FN, enc: [0, 15, 0, 35] }, { sym: S('a.ts', 'a().'), line: 0, name: 'a', enc: [0, 0, 0, 38] }],
      },
      'b.ts': {
        lines: ['function y() { loc(); }'],
        defs: [{ sym: S('b.ts', 'y().'), line: 0, name: 'y', enc: [0, 0, 0, 23] }],
        refs: [{ sym: 'local 1', line: 0, text: 'loc' }],
      },
    });
    assert.strictEqual(ref.edges.size, 0);
  });

  await test('an edge with several sites takes the first site class in the order bare, self, receiver, qualified', () => {
    const spec = (lines) => ({
      'a.ts': {
        lines,
        defs: [
          { sym: S('a.ts', 'T#run().'), line: 0, name: 'run', enc: [0, 0, 0, 20] },
          { sym: S('a.ts', 'use().'), line: 1, name: 'use', enc: [1, 0, 1, 60] },
        ],
        refs: [
          { sym: S('a.ts', 'T#run().'), line: 1, text: 'run', nth: 0 },
          { sym: S('a.ts', 'T#run().'), line: 1, text: 'run', nth: 1 },
        ],
      },
    });
    assert.deepStrictEqual(listing(derive(spec(['function run() {}', 'function use() { x.run(); this.run(); }']))), ['method/self a.ts#use->a.ts#run']);
    assert.deepStrictEqual(listing(derive(spec(['function run() {}', 'function use() { x.run(); run(); }']))), ['method/bare a.ts#use->a.ts#run']);
  });

  await test('columns in UTF-8 and UTF-32 position encodings are read as characters, so a line with non-ASCII text before the call still resolves', () => {
    // 'é' is two UTF-8 bytes, so the byte columns are one more than the character columns after it.
    const line = "function use() { const é = 'é'; helper(); }";
    const utf8 = (s) => Buffer.byteLength(s, 'utf8');
    const col = (s) => utf8(line.slice(0, line.indexOf(s)));
    const buf = scipIndex([{
      rel: 'a.ts',
      encoding: 1,
      occurrences: [
        { range: [0, col('helper'), col('helper') + 6], symbol: S('a.ts', 'helper().') },
        { range: [1, 9, 15], symbol: S('a.ts', 'helper().'), roles: 1, enclosing: [1, 0, 1, 20] },
        { range: [0, 9, 12], symbol: S('a.ts', 'use().'), roles: 1, enclosing: [0, 0, 0, utf8(line)] },
      ],
    }]);
    const src = `${line}\nfunction helper() {}`;
    const ref = edges.deriveReferenceEdges(edges.readScipIndex(buf), (rel) => (rel === 'a.ts' ? src : null));
    assert.deepStrictEqual(listing(ref), ['function/bare a.ts#use->a.ts#helper']);
    assert.strictEqual(ref.counts.rangeMismatch, 0);
  });

  await test('typed ranges (scip-go) read the same as packed ones, and win when both are present', () => {
    const spec = {
      'a.go': {
        lines: ['func helper() {}', 'func use() {', '\thelper()', '}'],
        defs: [
          { sym: 'scip-go gomod m . `m`/helper().', line: 0, name: 'helper', enc: [0, 0, 0, 16] },
          { sym: 'scip-go gomod m . `m`/use().', line: 1, name: 'use', enc: [1, 0, 3, 1] },
        ],
        refs: [{ sym: 'scip-go gomod m . `m`/helper().', line: 2, text: 'helper' }],
      },
    };
    const packedList = listing(derive(spec));
    assert.deepStrictEqual(packedList, ['function/bare a.go#use->a.go#helper']);
    assert.deepStrictEqual(listing(derive(spec, { typed: 'only' })), packedList, 'single- and multi-line typed ranges');
    assert.deepStrictEqual(listing(derive(spec, { typed: 'both-disagree' })), packedList, 'the typed range wins over a conflicting packed one');
  });

  await test('a range that does not hold an identifier is counted, not guessed', () => {
    const buf = scipIndex([{
      rel: 'a.ts',
      occurrences: [
        { range: [0, 0, 6], symbol: S('a.ts', 'helper().'), roles: 1, enclosing: [0, 0, 0, 10] },
        { range: [1, 3, 5], symbol: S('a.ts', 'helper().') },
      ],
    }]);
    const ref = edges.deriveReferenceEdges(edges.readScipIndex(buf), () => 'helper()\n  = (3)');
    assert.strictEqual(ref.counts.rangeMismatch, 1);
    assert.strictEqual(ref.edges.size, 0);
  });

  // ── matching ───────────────────────────────────────────────────────────────

  const graphOf = (list, defsList) => {
    const forward = new Map();
    for (const [a, b] of list) { if (!forward.has(a)) forward.set(a, []); forward.get(a).push(b); }
    const defs = new Map();
    for (const id of defsList) { const [file, name] = id.split('#'); defs.set(id, { file, name, line: 1 }); }
    return { forward, defs };
  };
  const refOf = (list, extra = {}) => {
    const map = new Map();
    for (const [a, b, kind, site] of list) {
      const [callerFile, callerName] = a.split('#');
      const [calleeFile, calleeName] = b.split('#');
      map.set(`${a}\u0000${b}`, { callerFile, callerName, calleeFile, calleeName, kind, site, sites: [], siteCount: 1 });
    }
    return { edges: map, nodeKinds: new Map(), callerNodes: new Set(), documents: new Set(['a.py', 'b.py', 'c.py']), counts: {}, ...extra };
  };

  await test('precision and recall are counted inside the universe: files the graph walked AND the index holds', () => {
    const graph = graphOf([
      ['a.py#f', 'a.py#g'],            // right
      ['a.py#f', 'b.py#h'],            // wrong
      ['a.py#f', 'z.py#out'],          // callee file is not an indexed document: not scored
      ['z.py#q', 'a.py#g'],            // caller file is not an indexed document: not scored
    ], ['a.py#f', 'a.py#g', 'b.py#h', 'z.py#out', 'z.py#q']);
    const ref = refOf([
      ['a.py#f', 'a.py#g', 'function', 'bare'],
      ['a.py#g', 'b.py#h', 'function', 'bare'],     // missed
      ['c.py#k', 'a.py#g', 'function', 'bare'],     // c.py has no definitions in the graph: outside U
    ]);
    const r = lib.compareRepo(graph, ref);
    const total = [...r.clusters.values()].reduce((a, c) => { for (const [k, v] of Object.entries(c)) a[k] = (a[k] || 0) + v; return a; }, {});
    assert.strictEqual(total.ref, 2, 'reference edges in U');
    assert.strictEqual(total.tp, 1);
    assert.strictEqual(total.graph, 2, 'graph edges in U');
    assert.strictEqual(r.scope.referenceEdges, 3);
    assert.strictEqual(r.scope.referenceEdgesInU, 2);
    assert.strictEqual(r.scope.scopeInclusiveRecall, 1 / 3);
    assert.deepStrictEqual(r.scope.referenceEdgesOutsideU, { callerNotWalked: 1, calleeNotWalked: 0 });
    assert.strictEqual(r.scope.graphEdges, 4);
    assert.strictEqual(r.scope.graphEdgesInU, 2);
  });

  await test('a right edge takes the reference edge\'s kind; a wrong one takes its callee\'s kind in the index, or "unknown"', () => {
    const graph = graphOf([
      ['a.py#f', 'a.py#g'],            // right, a method edge
      ['a.py#f', 'b.py#h'],            // wrong; h is a function in the index
      ['a.py#f', 'b.py#nope'],         // wrong; the index has no such callable
    ], ['a.py#f', 'a.py#g', 'b.py#h', 'b.py#nope']);
    const ref = refOf([['a.py#f', 'a.py#g', 'method', 'self']], {
      nodeKinds: new Map([['a.py#g', 'method'], ['b.py#h', 'function']]),
      callerNodes: new Set(['a.py#f']),
    });
    const r = lib.compareRepo(graph, ref);
    const total = [...r.clusters.values()].reduce((a, c) => { for (const [k, v] of Object.entries(c)) a[k] = (a[k] || 0) + v; return a; }, {});
    assert.strictEqual(total['graph:method'], 1);
    assert.strictEqual(total['graph:function'], 1);
    assert.strictEqual(total['graph:unknown'], 1);
    assert.strictEqual(total['tp:method'], 1);
    assert.strictEqual(total['ref:method/no-bare'], 1, 'a self call counts for the threshold row');
    assert.deepStrictEqual(r.diagnostics.wrongEdgesByReason, { 'both-in-index': 1, 'callee-not-in-index': 1 });
  });

  await test('the registered threshold statistic counts method edges with a self or receiver site, and not a bare one', () => {
    const graph = graphOf([['a.py#f', 'a.py#bare'], ['a.py#f', 'a.py#viaSelf']], ['a.py#f', 'a.py#bare', 'a.py#viaSelf', 'a.py#viaRecv', 'a.py#fn']);
    const ref = refOf([
      ['a.py#f', 'a.py#bare', 'method', 'bare'],        // found, but a bare call: not in the statistic
      ['a.py#f', 'a.py#viaSelf', 'method', 'self'],     // found, counts
      ['a.py#f', 'a.py#viaRecv', 'method', 'receiver'], // missed, counts
      ['a.py#f', 'a.py#fn', 'function', 'qualified'],   // not a method: never in the statistic
    ]);
    const total = [...lib.compareRepo(graph, ref).clusters.values()].reduce((a, c) => { for (const [k, v] of Object.entries(c)) a[k] = (a[k] || 0) + v; return a; }, {});
    assert.strictEqual(total['ref:method/no-bare'], 2);
    assert.strictEqual(total['tp:method/no-bare'], 1);
    assert.strictEqual(total['ref:method/bare'], 1);
    assert.strictEqual(total['ref:function/qualified'], 1);
    const table = lib.tableOf([lib.compareRepo(graph, ref).clusters], lib.loadProtocol(ROOT));
    assert.strictEqual(table.receiverOnly.value, 0.5);
    assert.strictEqual(table.receiverOnly.n, 2);
  });

  await test('precision over judgeable edges leaves out an edge whose caller or callee the index cannot name, and keeps the registered precision as it was', () => {
    const graph = graphOf([
      ['a.py#f', 'a.py#g'],        // right
      ['a.py#f', 'b.py#h'],        // wrong, both endpoints named by the index: counts against the graph
      ['a.py#f', 'b.py#local'],    // callee not in the index (a function-local callable): unjudged
      ['a.py#anon', 'b.py#h'],     // caller not in the index: unjudged
    ], ['a.py#f', 'a.py#g', 'a.py#anon', 'b.py#h', 'b.py#local']);
    const ref = refOf([['a.py#f', 'a.py#g', 'function', 'bare']], {
      nodeKinds: new Map([['a.py#g', 'function'], ['b.py#h', 'function']]),
      callerNodes: new Set(['a.py#f']),
    });
    const r = lib.compareRepo(graph, ref);
    const table = lib.tableOf([r.clusters], lib.loadProtocol(ROOT));
    const all = table.rows.find((x) => x.label === 'all edges');
    const judged = table.rows.find((x) => x.label === 'judgeable edges');
    assert.strictEqual(all.precision.n, 4);
    assert.strictEqual(all.precision.value, 1 / 4, 'the registered precision still counts every graph edge in U');
    assert.strictEqual(judged.precision.n, 2);
    assert.strictEqual(judged.precision.value, 1 / 2);
    assert.strictEqual(judged.recall, null, 'a diagnostic row has no recall');
    assert.deepStrictEqual(r.diagnostics.wrongEdgesByReason, { 'both-in-index': 1, 'callee-not-in-index': 1, 'caller-not-in-index': 1 });
  });

  await test('a missed edge is attributed: no node for the caller or callee, a call the graph\'s masker hides, or a call it did not see', () => {
    const graph = graphOf([], ['a.py#f', 'a.py#g', 'b.py#h']);          // no caller-less/callee-less nodes: a.py#nocaller and b.py#nocallee are absent
    const edge = (a, b, sites) => {
      const [callerFile, callerName] = a.split('#');
      const [calleeFile, calleeName] = b.split('#');
      return [`${a}\u0000${b}`, { callerFile, callerName, calleeFile, calleeName, kind: 'function', site: 'bare', sites, siteCount: sites.length }];
    };
    const ref = refOf([], {
      edges: new Map([
        edge('a.py#nocaller', 'a.py#g', [[0, 0]]),
        edge('a.py#f', 'b.py#nocallee', [[0, 0]]),
        edge('a.py#f', 'a.py#g', [[1, 4]]),       // site 1:4 is inside a template literal in the source below
        edge('a.py#f', 'b.py#h', [[0, 0]]),       // cross-file, visible
        edge('a.py#g', 'a.py#f', [[0, 0], [1, 4]]), // same file, one visible and one hidden site: not "every site masked"
      ]),
      documents: new Set(['a.py', 'b.py']),
    });
    const sources = { 'a.py': 'x\n  `${g()}`', 'b.py': 'g()\n  `${g()}`' };
    // a masker that blanks the template literal, as the graph's own does
    const mask = (file, src) => src.replace(/`[^`]*`/g, (m) => m.replace(/[^\n]/g, ' '));
    const r = lib.compareRepo(graph, ref, { readSource: (f) => sources[f], mask });
    // the graph in this test has defs for a.py#f, a.py#g and b.py#h only
    assert.deepStrictEqual(r.diagnostics.missedByReason, {
      'function/bare': {
        'caller-not-a-graph-node': 1,
        'callee-not-a-graph-node': 1,
        'every-call-site-masked-by-graph': 1,
        'call-not-linked-cross-file': 1,
        'call-not-seen-same-file': 1,
      },
    });
    const noCtx = lib.compareRepo(graph, ref);
    assert.strictEqual(noCtx.diagnostics.missedByReason['function/bare']['every-call-site-masked-by-graph'], undefined, 'without a masker the question is not asked');
  });

  await test('a wrong edge whose callee is declared inside its caller is told apart from one that is not', () => {
    const graph = graphOf([['a.py#outer', 'a.py#decorator'], ['a.py#outer', 'a.py#elsewhere']], ['a.py#outer', 'a.py#decorator', 'a.py#elsewhere']);
    const ref = refOf([], {
      nodeKinds: new Map([['a.py#outer', 'function'], ['a.py#decorator', 'function'], ['a.py#elsewhere', 'function']]),
      callerNodes: new Set(['a.py#outer', 'a.py#decorator', 'a.py#elsewhere']),
      nodeRanges: new Map([
        ['a.py#outer', { defs: [[1, 4]], enclosing: [[1, 0, 9, 0]] }],
        ['a.py#decorator', { defs: [[3, 8]], enclosing: [[3, 4, 6, 0]] }],      // inside outer's range
        ['a.py#elsewhere', { defs: [[20, 4]], enclosing: [[20, 0, 22, 0]] }],   // outside it
      ]),
    });
    const r = lib.compareRepo(graph, ref);
    assert.deepStrictEqual(r.diagnostics.wrongEdgesByReason, { 'callee-declared-inside-caller': 1, 'both-in-index': 1 });
  });

  await test('the file level collapses to undirected pairs and ignores same-file edges', () => {
    const graph = graphOf([['a.py#f', 'b.py#h'], ['a.py#f', 'a.py#g']], ['a.py#f', 'a.py#g', 'b.py#h']);
    const ref = refOf([['b.py#h', 'a.py#f', 'function', 'bare'], ['a.py#f', 'a.py#g', 'function', 'bare']]);
    const r = lib.compareRepo(graph, ref);
    assert.deepStrictEqual(r.fileLevel, { referencePairs: 1, graphPairs: 1, found: 1 });
  });

  // ── intervals, the threshold, the predictions ──────────────────────────────

  await test('the bootstrap is reproducible, brackets the point estimate and says nothing when there is nothing to divide', () => {
    const clusters = [];
    for (let i = 0; i < 60; i++) clusters.push({ ref: 10, tp: i % 3 === 0 ? 2 : 8 });
    const ratios = [{ id: 'r', num: 'tp', den: 'ref' }, { id: 'none', num: 'tp', den: 'absent' }];
    const a = lib.intervals(clusters, ratios, { resamples: 400, seed: 976 });
    const b = lib.intervals(clusters, ratios, { resamples: 400, seed: 976 });
    assert.deepStrictEqual(a, b, 'same seed, same interval');
    assert.ok(a.r.lo < a.r.value && a.r.value < a.r.hi, `${a.r.lo} ${a.r.value} ${a.r.hi}`);
    assert.ok(a.r.hi - a.r.lo > 0, 'not degenerate');
    assert.strictEqual(a.r.n, 600);
    assert.deepStrictEqual([a.none.value, a.none.lo, a.none.hi], [null, null, null]);
    const c = lib.intervals(clusters, ratios, { resamples: 400, seed: 1 });
    assert.notDeepStrictEqual(c.r, a.r, 'another seed gives another interval');
    const single = lib.intervals([{ ref: 10, tp: 5 }], ratios, { resamples: 50, seed: 976 });
    assert.strictEqual(single.r.lo, 0.5, 'one cluster cannot vary');
  });

  await test('the threshold is strict, needs 100 reference edges, and reads the committed value', () => {
    const protocol = lib.loadProtocol(ROOT);
    assert.strictEqual(protocol.threshold.value, 0.7);
    const table = (value, n) => ({ receiverOnly: { value, lo: value, hi: value, n } });
    assert.strictEqual(lib.thresholdVerdict(table(0.5, 99), protocol).status, 'insufficient-sample');
    assert.strictEqual(lib.thresholdVerdict(table(0.5, 100), protocol).status, 'spike-warranted');
    assert.strictEqual(lib.thresholdVerdict(table(0.69, 5000), protocol).status, 'spike-warranted');
    assert.strictEqual(lib.thresholdVerdict(table(0.7, 5000), protocol).status, 'above-threshold');
    assert.strictEqual(lib.thresholdVerdict(table(null, 0), protocol).status, 'insufficient-sample');
  });

  await test('the registered predictions are judged from the tables, and a cell with too few edges is not testable', () => {
    const protocol = lib.loadProtocol(ROOT);
    const cell = (value, n = 500) => ({ value, lo: value, hi: value, n, small: n < 100 });
    const mk = (over) => ({
      rows: [
        { label: 'all edges', recall: cell(0.3), precision: cell(over.precision) },
        { label: 'function', recall: cell(0.7), precision: cell(0.7) },
        { label: 'method', recall: cell(0.05), precision: cell(0.5) },
        { label: 'constructor', recall: cell(over.ctor, over.ctorN), precision: cell(0.5) },
      ],
      sites: [{ label: 'function/bare', recall: cell(over.bare), precision: null }],
      receiverOnly: cell(over.recv),
    });
    const tables = {
      typescript: mk({ precision: 0.6, ctor: 0.0, ctorN: 500, bare: 0.8, recv: 0.04 }),
      python: mk({ precision: 0.95, ctor: 0.2, ctorN: 500, bare: 0.8, recv: 0.04 }),
    };
    const p = lib.checkPredictions(tables, protocol);
    assert.strictEqual(p.P1.status, 'held');
    assert.strictEqual(p.P2.status, 'held');
    assert.strictEqual(p.P3.status, 'missed', 'python precision 95% is above the registered band');
    assert.strictEqual(p.P4.status, 'missed', 'python constructor recall 20% is above the registered 10%');
    assert.strictEqual(p.P5.status, 'not-testable', 'no java group was measured');
    tables.python = mk({ precision: 0.6, ctor: 0.2, ctorN: 5, bare: 0.8, recv: 0.5 });
    const q = lib.checkPredictions(tables, protocol);
    assert.strictEqual(q.P4.status, 'held', 'the python constructor cell has 5 edges and is not judged');
    assert.strictEqual(q.P1.status, 'missed', 'python receiver-only recall 50% breaks "below 15%"');
  });

  // ── the protocol ───────────────────────────────────────────────────────────

  await test('the protocol pins every repository to the commit the other manifests pin, and pins indexers it can install', () => {
    const protocol = lib.loadProtocol(ROOT);
    const xrepo = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/xrepo-repos.json'), 'utf8')).repos.map((r) => [r.name, r]));
    const bench = fs.readFileSync(path.join(ROOT, 'scripts/run-benchmark.mjs'), 'utf8');
    const seen = [];
    for (const [group, repos] of Object.entries(protocol.repos)) {
      assert.ok(repos.length >= 2, `${group} has fewer than two repositories`);
      for (const r of repos) {
        seen.push(r.name);
        assert.match(r.commit, /^[0-9a-f]{40}$/, `${r.name}: not a full commit`);
        const pinned = xrepo[r.name] ? xrepo[r.name].commit : (bench.match(new RegExp(`name: '${r.name}'[\\s\\S]*?commit: '([0-9a-f]{40})'`)) || [])[1];
        assert.strictEqual(r.commit, pinned, `${r.name}: the protocol and the corpus manifests disagree`);
      }
    }
    assert.strictEqual(new Set(seen).size, seen.length, 'a repository is listed twice');
    for (const dev of ['sigmap', 'click']) assert.ok(!seen.includes(dev), `${dev} was used to develop the deriver and must not be measured`);
    for (const group of Object.keys(protocol.repos)) {
      const key = group === 'javascript' ? 'typescript' : group;
      assert.ok(protocol.indexers[key], `${group} has no indexer`);
    }
    for (const i of Object.values(protocol.indexers).filter((x) => x.wave === 1)) assert.match(i.version, /^\d+\.\d+\.\d+$/, `${i.package} is not pinned`);
    assert.deepStrictEqual([protocol.bootstrap.resamples, protocol.bootstrap.seed, protocol.minSample, protocol.threshold.value], [2000, 976, 100, 0.7]);
  });

  await test('the prose protocol quotes the numbers the harness reads and names every registered repository', () => {
    const protocol = lib.loadProtocol(ROOT);
    const prose = fs.readFileSync(path.join(ROOT, 'benchmarks/CALLGRAPH_ACCURACY_PROTOCOL.md'), 'utf8');
    for (const s of ['0.70', '2000 resamples, seed 976', '100 edges', '@sourcegraph/scip-typescript` 0.5.2', '@sourcegraph/scip-python` 0.6.8', '## 10. Deviation log']) {
      assert.ok(prose.includes(s), `the prose protocol does not say "${s}"`);
    }
    for (const repos of Object.values(protocol.repos)) for (const r of repos) assert.ok(prose.includes(r.name), `${r.name} is not in the prose protocol`);
    for (const p of protocol.predictions) assert.ok(prose.includes(`**${p.id}.**`), `${p.id} is not in the prose protocol`);
  });

  await test('protocolState: an untracked or edited protocol file is not "committed"; a committed one is, with its hash', () => {
    const repo = tmp('sigmap-cgacc-proto-');
    const git = (...a) => spawnSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
    git('init', '-q');
    put(path.join(repo, lib.PROTOCOL_REL), '{"a":1}\n');
    const first = lib.protocolState(repo);
    assert.strictEqual(first.committed, false, 'untracked');
    assert.strictEqual(first.commit, null);
    git('add', lib.PROTOCOL_REL);
    git('commit', '-q', '-m', 'protocol');
    const second = lib.protocolState(repo);
    assert.strictEqual(second.committed, true);
    assert.match(second.commit, /^[0-9a-f]{40}$/);
    assert.match(second.sha256, /^[0-9a-f]{64}$/);
    put(path.join(repo, lib.PROTOCOL_REL), '{"a":2}\n');
    const third = lib.protocolState(repo);
    assert.strictEqual(third.committed, false, 'edited after the commit');
    assert.notStrictEqual(third.sha256, second.sha256);
  });

  // ── the runner ─────────────────────────────────────────────────────────────

  // The runner reads SIGMAP_SCIP_INDEXERS; these cases are about the run WITHOUT indexers.
  const noIndexers = { ...process.env, SIGMAP_SCIP_INDEXERS: '' };

  await test('the project file an indexer needs: a valid allowJs config for JavaScript, the repository\'s own for TypeScript, nothing for Python', () => {
    const protocol = lib.loadProtocol(ROOT);
    const js = tmp('sigmap-cgacc-prep-');
    put(path.join(js, 'tsconfig.json'), 'a sentence, not a config');
    assert.strictEqual(runner.prepareProject('javascript', js, protocol), null);
    const written = JSON.parse(fs.readFileSync(path.join(js, 'tsconfig.json'), 'utf8'));
    assert.strictEqual(written.compilerOptions.allowJs, true, 'an existing tsconfig.json is replaced by the registered one');
    assert.deepStrictEqual(written, protocol.typescriptProject.javascriptConfig);
    const ts = tmp('sigmap-cgacc-prep-');
    assert.match(runner.prepareProject('typescript', ts, protocol), /no root tsconfig/);
    put(path.join(ts, 'tsconfig.json'), '{}');
    assert.strictEqual(runner.prepareProject('typescript', ts, protocol), null);
    const py = tmp('sigmap-cgacc-prep-');
    assert.strictEqual(runner.prepareProject('python', py, protocol), null, 'a Python repository needs no tsconfig.json');
    assert.ok(!fs.existsSync(path.join(py, 'tsconfig.json')));
  });

  await test('an indexer failure is reported with its first lines, not only the stack at the end', () => {
    const text = ['error: no files got indexed', ...Array.from({ length: 20 }, (_, i) => `    at frame ${i}`), 'Node.js v25'].join('\n');
    const out = runner.excerpt(text);
    assert.ok(out.startsWith('error: no files got indexed'));
    assert.ok(out.includes('Node.js v25') && out.includes('...'));
    assert.ok(out.length < 400);
  });

  await test('the report is saved where the docs and the generator look for it', () => {
    assert.strictEqual(runner.REPORT_REL, 'benchmarks/reports/callgraph-accuracy.json');
    assert.ok(lib.SAMPLE_CAP > 0);
  });

  await test('the runner reports every repository unmeasured, with the reason, when there are no indexers; and --save refuses', () => {
    const work = tmp('sigmap-cgacc-work-');
    const r = spawnSync(process.execPath, [RUNNER, '--work', work, '--repos', path.join(work, 'none'), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26, env: noIndexers });
    assert.strictEqual(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout);
    const protocol = lib.loadProtocol(ROOT);
    const all = Object.entries(protocol.repos).flatMap(([g, rs]) => rs.map((x) => `${g}/${x.name}`));
    assert.deepStrictEqual(Object.keys(report.unmeasured).sort(), all.sort());
    for (const why of Object.values(report.unmeasured)) assert.ok(why.length > 10, 'a bare "unmeasured" says nothing');
    assert.ok(Object.values(report.unmeasured).some((w) => /--indexers/.test(w)));
    assert.deepStrictEqual(report.groups, {}, 'nothing measured, nothing pooled');
    const out = path.join(work, 'report.json');
    const s = spawnSync(process.execPath, [RUNNER, '--work', work, '--repos', path.join(work, 'none'), '--only', 'flask', '--save', '--out', out], { encoding: 'utf8', maxBuffer: 1 << 26, env: noIndexers });
    assert.strictEqual(s.status, 1);
    assert.ok(/not saved: a partial run/.test(s.stderr), s.stderr);
    assert.ok(!fs.existsSync(out), 'a refused save wrote a file');
  });

  await test('a wave-2 language is reported unmeasured with its reason, not skipped silently', () => {
    const work = tmp('sigmap-cgacc-work-');
    const r = spawnSync(process.execPath, [RUNNER, '--work', work, '--repos', path.join(work, 'none'), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26, env: noIndexers });
    const report = JSON.parse(r.stdout);
    assert.ok(report.unmeasured['go/gin'] && report.unmeasured['java/gson']);
    assert.ok(report.repos.go.gin.status === 'unmeasured' && report.repos.java.gson.status === 'unmeasured');
  });

  // ── the real indexers, end to end ──────────────────────────────────────────

  const indexers = process.env.SIGMAP_SCIP_INDEXERS;
  const installed = (pkg) => {
    try { return JSON.parse(fs.readFileSync(path.join(indexers, 'node_modules', pkg, 'package.json'), 'utf8')).version; } catch { return null; }
  };
  const protocol = lib.loadProtocol(ROOT);
  const ready = indexers && installed('@sourcegraph/scip-typescript') === protocol.indexers.typescript.version && installed('@sourcegraph/scip-python') === protocol.indexers.python.version;
  if (!ready) {
    skip('real scip-typescript on a TypeScript fixture', 'set SIGMAP_SCIP_INDEXERS to a directory made by --setup-indexers');
    skip('real scip-python on a Python fixture', 'set SIGMAP_SCIP_INDEXERS to a directory made by --setup-indexers');
  } else {
    const bin = (name) => path.join(indexers, 'node_modules', '.bin', name);
    const scoped = (cwd, program, argv) => spawnSync(program, argv, { cwd, encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, TMPDIR: tmp('sigmap-cgacc-idx-') } });

    await test('real scip-typescript: methods through this/receivers, a static call, an interface call and a constructor are reference edges; the call graph finds only the function edges', () => {
      const dir = tmp('sigmap-cgacc-ts-');
      put(path.join(dir, 'tsconfig.json'), '{"compilerOptions":{"strict":true,"module":"commonjs","target":"es2020","noEmit":true},"include":["src/*.ts"]}\n');
      put(path.join(dir, 'src/a.ts'), [
        'export function helper(x: number): number {', '  return x + 1;', '}',
        'export class Repo {', '  constructor(private name: string) {}', '  save(item: string): void {', '    this.log(item);', '  }',
        '  log(msg: string): void {', '    helper(1);', '  }', '  static create(): Repo {', "    return new Repo('x');", '  }', '}',
        'export interface Store {', '  put(k: string): void;', '}', '',
      ].join('\n'));
      put(path.join(dir, 'src/b.ts'), [
        "import { Repo, helper } from './a';", "import * as a from './a';", "import type { Store } from './a';", '',
        'export function run(store: Store) {', "  const r = new Repo('n');", "  r.save('i');", '  Repo.create();', '  a.helper(2);', '  helper(3);',
        "  store.put('k');", '  [1].map(helper);', '}', 'const top = helper(5);', '',
      ].join('\n'));
      const scip = path.join(dir, 'out.scip');
      const idx = scoped(dir, bin('scip-typescript'), ['index', '--no-progress-bar', '--output', scip]);
      assert.strictEqual(idx.status, 0, idx.stderr);
      const index = edges.readScipIndex(fs.readFileSync(scip));
      const ref = edges.deriveReferenceEdges(index, (rel) => fs.readFileSync(path.join(dir, rel), 'utf8'));
      assert.deepStrictEqual(listing(ref), [
        'constructor/bare src/a.ts#create->src/a.ts#Repo',
        'constructor/bare src/b.ts#run->src/a.ts#Repo',
        'function/bare src/a.ts#log->src/a.ts#helper',
        'function/bare src/b.ts#run->src/a.ts#helper',
        'method/receiver src/b.ts#run->src/a.ts#create',
        'method/receiver src/b.ts#run->src/a.ts#put',
        'method/receiver src/b.ts#run->src/a.ts#save',
        'method/self src/a.ts#save->src/a.ts#log',
      ]);
      assert.strictEqual(ref.counts.topLevel, 1);
      assert.ok(ref.counts.nonCall >= 1, 'imports, types and the callback are not calls');
      const { buildCallGraph } = require(path.join(ROOT, 'src/graph/call-graph.js'));
      const r = lib.compareRepo(buildCallGraph(dir), ref);
      const total = [...r.clusters.values()].reduce((acc, c) => { for (const [k, v] of Object.entries(c)) acc[k] = (acc[k] || 0) + v; return acc; }, {});
      assert.strictEqual(total.ref, 8);
      assert.strictEqual(total.tp, 2, 'the two bare function calls, and nothing through a receiver');
      assert.strictEqual(total['tp:method/no-bare'] || 0, 0);
    });

    await test('real scip-python: nested functions, self, receiver and constructor edges; an untyped parameter\'s call is unresolved', () => {
      const dir = tmp('sigmap-cgacc-py-');
      put(path.join(dir, 'src/m.py'), [
        'def helper(x):', '    return x + 1', '', '', 'class Repo:', '    def __init__(self, name):', '        self.name = name', '',
        '    def save(self, item):', '        self.log(item)', '', '    def log(self, msg):', '        helper(1)', '', '    @staticmethod',
        '    def create():', "        return Repo('x')", '', '', 'class Child(Repo):', '    def save(self, item):', '        super().save(item)', '',
      ].join('\n'));
      put(path.join(dir, 'src/n.py'), [
        'import m', 'from m import Repo, helper', '', '', 'def run(store):', "    r = Repo('n')", "    r.save('i')", '    Repo.create()', '    m.helper(2)',
        '    helper(3)', "    store.put('k')", '    list(map(helper, [1]))', '', '    def inner():', '        helper(9)', '', '    inner()', '', '', 'top = helper(5)', '',
      ].join('\n'));
      const scip = path.join(dir, 'out.scip');
      const idx = scoped(dir, bin('scip-python'), ['index', '.', '--project-name', 'fx', '--project-version', '0', '--output', scip, '--quiet']);
      assert.strictEqual(idx.status, 0, idx.stderr);
      const ref = edges.deriveReferenceEdges(edges.readScipIndex(fs.readFileSync(scip)), (rel) => fs.readFileSync(path.join(dir, rel), 'utf8'));
      assert.deepStrictEqual(listing(ref), [
        'constructor/bare src/m.py#create->src/m.py#Repo',
        'constructor/bare src/n.py#run->src/m.py#Repo',
        'function/bare src/m.py#log->src/m.py#helper',
        'function/bare src/n.py#inner->src/m.py#helper',
        'function/bare src/n.py#run->src/m.py#helper',
        'function/bare src/n.py#run->src/n.py#inner',
        'method/receiver src/n.py#run->src/m.py#create',
        'method/receiver src/n.py#run->src/m.py#save',
        'method/self src/m.py#save->src/m.py#log',
      ]);
      assert.strictEqual(ref.counts.selfEdges, 1, 'Child.save calling super().save() is a node calling itself');
    });
  }

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
  process.exit(failed > 0 ? 1 : 0);
})();
