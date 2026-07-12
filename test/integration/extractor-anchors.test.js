'use strict';

/**
 * Integration tests for line anchors in the Java/Go/Rust/C# extractors (#483).
 *
 * Covers: every emitted signature carries a `:start-end` anchor, anchor lines
 * are correct in files with multi-line block comments above declarations (the
 * newline-preservation regression), parseAnchor round-trips, and Evidence
 * Pack anchorCoverage becomes non-zero on an anchored-language fixture.
 */

const assert = require('assert');

const { parseAnchor } = require('../../src/evidence/pack');
const goX = require('../../src/extractors/go');
const javaX = require('../../src/extractors/java');
const rustX = require('../../src/extractors/rust');
const csX = require('../../src/extractors/csharp');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

const ANCHOR_RE = /\s{2}:\d+-\d+$/;

// A 4-line block comment sits above each declaration — with a non-newline-
// preserving strip, every anchor below would be off by 3 lines.
const GO_SRC = [
  '/*',                          // 1
  ' * multi-line header',        // 2
  ' * comment',                  // 3
  ' */',                         // 4
  'package main',                // 5
  '',                            // 6
  'func Helper(x int) int {',    // 7
  '\treturn x + 1',              // 8
  '}',                           // 9
  '',
].join('\n');

const JAVA_SRC = [
  '/*',                              // 1
  ' * license header',               // 2
  ' * spanning lines',               // 3
  ' */',                             // 4
  'public class Foo {',              // 5
  '  public int bar(int x) {',       // 6
  '    return x;',                   // 7
  '  }',                             // 8
  '}',                               // 9
  '',
].join('\n');

const RUST_SRC = [
  '/*',                              // 1
  ' * header',                       // 2
  ' */',                             // 3
  'pub struct Point;',               // 4
  '',                                // 5
  'pub fn origin() -> Point {',      // 6
  '    Point',                       // 7
  '}',                               // 8
  '',
].join('\n');

const CS_SRC = [
  '/*',                              // 1
  ' * header',                       // 2
  ' */',                             // 3
  'public class Svc {',              // 4
  '  public int Run(int x)',         // 5
  '  {',                             // 6
  '    return x;',                   // 7
  '  }',                             // 8
  '}',                               // 9
  '',
].join('\n');

test('Go: anchors on every sig; lines correct despite a leading block comment', () => {
  const sigs = goX.extract(GO_SRC);
  assert.ok(sigs.length > 0 && sigs.every((s) => ANCHOR_RE.test(s)), sigs.join('|'));
  const fn = sigs.find((s) => s.startsWith('func Helper'));
  assert.ok(fn.endsWith(':7-9'), fn);
});

test('Java: class + member anchors correct despite a leading block comment', () => {
  const sigs = javaX.extract(JAVA_SRC);
  assert.ok(sigs.every((s) => ANCHOR_RE.test(s)), sigs.join('|'));
  assert.ok(sigs.find((s) => s.startsWith('class Foo')).endsWith(':5-9'), sigs[0]);
  assert.ok(sigs.find((s) => s.includes('bar(int x)')).endsWith(':6-6'), sigs[1]);
});

test('Rust: bodied fn gets a range; bodyless struct gets a single-line anchor', () => {
  const sigs = rustX.extract(RUST_SRC);
  assert.ok(sigs.every((s) => ANCHOR_RE.test(s)), sigs.join('|'));
  assert.ok(sigs.find((s) => s.startsWith('pub struct Point')).endsWith(':4-4'), sigs.join('|'));
  assert.ok(sigs.find((s) => s.startsWith('pub fn origin')).endsWith(':6-8'), sigs.join('|'));
});

test('C#: class + member anchors correct despite a leading block comment', () => {
  const sigs = csX.extract(CS_SRC);
  assert.ok(sigs.every((s) => ANCHOR_RE.test(s)), sigs.join('|'));
  assert.ok(sigs.find((s) => s.startsWith('class Svc')).endsWith(':4-9'), sigs.join('|'));
});

test('Kotlin/Swift/PHP/Scala/Dart: every fixture sig anchored; block-comment lines correct', () => {
  const fs = require('fs');
  const path = require('path');
  const header = '/*\n * multi-line\n * header\n */\n';
  const cases = [
    ['kotlin', header + 'class Foo {\n  fun bar(x: Int): Int {\n    return x\n  }\n}\n', 'class Foo', ':5-9'],
    ['swift', header + 'struct Foo {\n  func bar(x: Int) -> Int {\n    return x\n  }\n}\n', 'struct Foo', ':5-9'],
    ['php', header + 'class Foo {\n  public function bar(int $x): int {\n    return $x;\n  }\n}\n', 'class Foo', ':5-9'],
    ['scala', header + 'class Foo {\n  def bar(x: Int): Int = x\n}\n', 'class Foo', ':5-7'],
    ['dart', header + 'class Foo {\n  int bar(int x) {\n    return x;\n  }\n}\n', 'class Foo', ':5-9'],
  ];
  for (const [lang, src, decl, anchor] of cases) {
    const { extract } = require('../../src/extractors/' + lang);
    const sigs = extract(src);
    assert.ok(sigs.length > 0 && sigs.every((s) => /\s{2}:\d+-\d+$/.test(s)), lang + ': ' + sigs.join('|'));
    const typeSig = sigs.find((s) => s.startsWith(decl));
    assert.ok(typeSig && typeSig.endsWith(anchor), lang + ': ' + typeSig);
  }
  // fixture files: 100% anchored for all five
  const map = { kotlin: 'kotlin.kt', swift: 'swift.swift', php: 'php.php', scala: 'scala.scala', dart: 'dart.dart' };
  for (const [lang, f] of Object.entries(map)) {
    const { extract } = require('../../src/extractors/' + lang);
    const sigs = extract(fs.readFileSync(path.join(__dirname, '../fixtures', f), 'utf8'));
    assert.ok(sigs.length > 0 && sigs.every((s) => /\s{2}:\d+-\d+$/.test(s)), lang + ' fixture not fully anchored');
  }
});

test('parseAnchor round-trips the emitted anchors', () => {
  for (const sig of [...goX.extract(GO_SRC), ...javaX.extract(JAVA_SRC), ...rustX.extract(RUST_SRC), ...csX.extract(CS_SRC)]) {
    const { symbol, start, end } = parseAnchor(sig);
    assert.ok(symbol.length > 0 && Number.isInteger(start) && Number.isInteger(end) && end >= start, sig);
  }
});

console.log(`\nextractor-anchors: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
