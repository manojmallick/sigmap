'use strict';

/**
 * Balanced-scanner migration for the last seven extractors (#695, #696).
 *
 * Kotlin and Scala went first; swift, dart, rust, csharp, php, ruby and cpp
 * follow here, which empties `test/adversarial-defects.json`. Every one had the
 * same root defect — `\(([^)]*)\)` stops at the FIRST `)` — but it surfaced
 * three different ways:
 *
 *   corrupted  swift rendered `func f(cb) → Int, n: Int) -> Int`
 *   truncated  csharp lost the closing paren; php cut mid string-literal
 *   dropped    cpp lost whole declarations, which then became fake-symbol
 *              false positives in `verify`
 *
 * Two language-specific traps the migration had to handle:
 *
 *   - a DELETING comment strip desynchronises offsets from the masked surface
 *     the balanced reader walks, so every extractor had to move to the
 *     length-preserving `stripComments`
 *   - Rust LIFETIMES (`&'db`, `<'_>`) open a char literal as far as `maskCode`
 *     is concerned, which dropped 208 signatures on rust-analyzer until they
 *     were blanked on the mask surface
 *
 * Run: node test/integration/remaining-scanners.test.js
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const { extractFile } = require(path.join(ROOT, 'src', 'extractors', 'dispatch'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const bare = (sigs) => sigs.map((s) => s.replace(/\s+:\d+-\d+$/, ''));
const one = (file, src) => {
  const out = bare(extractFile(file, src));
  return out[out.length - 1];
};

// ── swift ────────────────────────────────────────────────────────────────────

test('swift: a closure parameter no longer truncates the list', () => {
  const got = one('a.swift', 'class C {\n    func f(cb: (Int) -> Int, n: Int) -> Int {\n        return cb(n)\n    }\n}\n');
  assert.strictEqual(got, '  func f(cb, n) → Int',
    'previously `func f(cb) → Int, n: Int) -> Int` — structurally malformed');
});

test('swift: a nested call in a default does not invent a parameter', () => {
  const got = one('a.swift', 'class C {\n    func f(a: Int = g(1, 2), b: Int = h(3)) -> Int {\n        return a\n    }\n}\n');
  assert.strictEqual(got, '  func f(a, b) → Int');
});

// ── rust ─────────────────────────────────────────────────────────────────────

test('rust: a closure type keeps ONE return notation', () => {
  const got = one('a.rs', 'pub fn f(a: i32, b: Box<dyn Fn(i32) -> i32>) -> i32 {\n    1\n}\n');
  assert.strictEqual(got, 'pub fn f(a: i32, b: Box<dyn Fn(i32) -> i32>) → i32',
    'the `->`→`→` substitution used to fire on the CLOSURE arrow, stating the return type twice');
});

test('rust: a lifetime does not drop the declaration', () => {
  const got = one('a.rs', 'impl S {\n    pub fn f(&self, db: &\'db dyn Db) -> Option<u32> {\n        None\n    }\n}\n');
  assert.strictEqual(got, "  pub fn f(&self, db: &'db dyn Db) → Option<u32>",
    'lifetimes read as char literals to maskCode — 208 lost signatures on rust-analyzer');
});

test('rust: an elided lifetime is handled too', () => {
  const got = one('a.rs', 'pub fn f(p: AnchoredPath<\'_>) -> Option<u32> {\n    None\n}\n');
  assert.strictEqual(got, "pub fn f(p: AnchoredPath<'_>) → Option<u32>");
});

test('rust: a real char literal is still a char literal', () => {
  const got = one('a.rs', 'pub fn f(c: char) -> bool {\n    c == \'x\'\n}\n');
  assert.strictEqual(got, 'pub fn f(c: char) → bool');
});

// ── csharp ───────────────────────────────────────────────────────────────────

test('csharp: the closing paren survives a nested default', () => {
  const got = one('a.cs', 'class C {\n    public int F(int a, int b = G(1, 2)) {\n        return 0;\n    }\n}\n');
  assert.strictEqual(got, '  F(int a, int b = G(1, 2)) → int',
    'previously lost the closing paren — visibly unbalanced');
});

// ── php ──────────────────────────────────────────────────────────────────────

test('php: a nested default keeps every parameter', () => {
  const got = one('a.php', '<?php\nclass C {\n    public function f($a = g(1, 2), $b = [1, 2]) {\n        return $a;\n    }\n}\n');
  assert.strictEqual(got, '  function f($a = g(1, 2), $b = [1, 2])');
});

test('php: a `)` inside a string default does not cut the scan', () => {
  const got = one('a.php', '<?php\nclass C {\n    public function f($sep = ")") {\n        return $sep;\n    }\n}\n');
  assert.strictEqual(got, '  function f($sep = ")")');
});

test('php: a declaration on the <?php line extracts (#696)', () => {
  const out = extractFile('a.php', '<?php function f($a) { return 1; }');
  assert.deepStrictEqual(bare(out), ['function f($a)'],
    'the same-line form used to yield nothing at all');
  assert.ok(/:1-1$/.test(out[0]), `anchor must stay on line 1, got "${out[0]}"`);
});

// ── ruby ─────────────────────────────────────────────────────────────────────

test('ruby: a nested default keeps the keyword argument', () => {
  const got = one('a.rb', 'def f(a = g(1, 2), b: h(3))\n  a\nend\n');
  assert.strictEqual(got, 'def f(a = g(1, 2), b: h(3))');
});

test('ruby: a `)` inside a string default does not cut the scan', () => {
  const got = one('a.rb', 'def f(sep = ")")\n  sep\nend\n');
  assert.strictEqual(got, 'def f(sep = ")")');
});

// ── cpp ──────────────────────────────────────────────────────────────────────

test('cpp: a nested default no longer drops the declaration', () => {
  const got = one('a.cpp', 'int f(int a, int b = g(1, 2)) {\n    return 0;\n}\n');
  assert.strictEqual(got, 'f(int a, int b = g(1, 2)) → int',
    'the whole declaration used to vanish — a fake-symbol false positive in verify');
});

test('cpp: a function-pointer parameter no longer drops the declaration', () => {
  const got = one('a.cpp', 'int f(int (*cb)(int), int n) {\n    return cb(n);\n}\n');
  assert.strictEqual(got, 'f(int (*cb)(int), int n) → int');
});

test('cpp: a prototype is listed, since a header is a declaration surface (#975)', () => {
  // Before #975 only definitions were reported. A header declares its API with prototypes, so they are listed now,
  // each with the anchor of its declaration; a forward declaration of a class still is not (extractor tests).
  const out = bare(extractFile('a.cpp', 'int f(int a);\n'));
  assert.deepStrictEqual(out, ['f(int a) → int'], `got ${JSON.stringify(out)}`);
});

// ── dart ─────────────────────────────────────────────────────────────────────

test('dart: named-parameter groups are kept, not deleted', () => {
  const got = one('a.dart', 'class C {\n  int f(int a, {int b = 2, int Function(int)? cb}) {\n    return a;\n  }\n}\n');
  assert.strictEqual(got, '  f(int a, {int b, int Function(int)? cb}) → int',
    'the group used to be deleted wholesale — real API surface');
});

test('dart: an optional-positional group is kept', () => {
  const got = one('a.dart', 'class C {\n  int f(int a, [int b = 2]) {\n    return a;\n  }\n}\n');
  assert.strictEqual(got, '  f(int a, [int b]) → int');
});

// ── python ───────────────────────────────────────────────────────────────────

test('python: the keyword-only `*` marker is emitted', () => {
  const fs = require('fs');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'py-kw-'));
  try {
    const f = path.join(dir, 't.py');
    fs.writeFileSync(f, 'def f(a, *, b=2, **kw):\n    return a\n');
    const got = bare(extractFile(f, fs.readFileSync(f, 'utf8')))[0];
    // Only the AST tier reaches this; the regex fallback drops the declaration.
    if (!got) { console.log('        (skip — python3 unavailable, regex tier active)'); return; }
    assert.ok(/\(a, \*, b=/.test(got),
      `keyword-only marker missing: "${got}" — a caller cannot tell b is keyword-only`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── the ledger is empty ──────────────────────────────────────────────────────

test('every language in the adversarial ledger is now clean', () => {
  const ledger = require(path.join(ROOT, 'test', 'adversarial-defects.json'));
  const dirty = Object.entries(ledger.languages)
    .filter(([, e]) => e.defects.length)
    .map(([l, e]) => `${l} (${e.defects.length})`);
  assert.deepStrictEqual(dirty, [],
    `still carrying defects: ${dirty.join(', ')} — clear them or explain why they remain`);
});

console.log(`\n  remaining-scanners: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
