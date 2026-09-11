'use strict';

/**
 * Member and per-file caps across the extractor set (#576).
 *
 * #551 fixed three hard-coded caps in the Java extractor. The same silent
 * truncation remained everywhere else: measured on the cloned benchmark repos,
 * an 8-member cap hides 71% of Swift, 68% of PHP, 64% of Kotlin, 57% of Scala
 * and 43% of C# member surface — with no indication anything was dropped.
 *
 * These assert DISCLOSURE, not a raised ceiling. Silence is the defect an agent
 * cannot work around: a disclosed cap lets it ask for the rest, an undisclosed
 * one looks like a class that simply has eight methods. Raising the ceilings is
 * a separate decision with a measured index cost, tracked in #576.
 */

const assert = require('assert');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const N = 14;                         // comfortably past the old cap of 8
const rep = (f) => Array.from({ length: N }, (_, i) => f(i)).join('\n');

/** One fixture per language: a class with N members. */
const FIXTURES = {
  kotlin: `class C {\n${rep((i) => `    fun m${i}(a: Int): String { return "x" }`)}\n}`,
  swift:  `class C {\n${rep((i) => `    func m${i}(a: Int) -> String { return "x" }`)}\n}`,
  php:    `<?php\nclass C {\n${rep((i) => `    public function m${i}($a) { return 1; }`)}\n}`,
  scala:  `class C {\n${rep((i) => `  def m${i}(a: Int): String = "x"`)}\n}`,
  csharp: `public class C {\n${rep((i) => `    public string M${i}(int a) { return null; }`)}\n}`,
  dart:   `class C {\n${rep((i) => `  String m${i}(int a) { return "x"; }`)}\n}`,
  cpp:    `class C {\npublic:\n${rep((i) => `    int m${i}(int a);`)}\n};`,
};

// The disclosure marker is itself indented, so it must be excluded when
// counting real members — otherwise a capped class looks one member larger
// than it is, and the assertion below passes for the wrong reason.
const isMarker = (s) => /… \+\d+ more/.test(s);
const members = (sigs) => sigs.filter((s) => /^\s/.test(s) && !isMarker(s));

for (const [lang, src] of Object.entries(FIXTURES)) {
  test(`${lang}: a truncated class says so`, () => {
    const { extract } = require(`../../src/extractors/${lang}`);
    const sigs = extract(src);
    const got = members(sigs);
    assert.ok(got.length < N, `${lang} fixture must exceed the ceiling to test it`);
    assert.ok(sigs.some(isMarker),
      `${lang} dropped ${N - got.length} members with no marker — an agent cannot tell they exist`);
  });
}

test('every extractor discloses omissions instead of truncating silently', () => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.resolve(__dirname, '../../src/extractors');
  const silent = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    // A bare `.slice(0, N)` on members or sigs drops content with no marker.
    if (/return\s+(?:members|sigs)\.slice\(0,\s*\d+\)/.test(src)) silent.push(f);
  }
  assert.deepStrictEqual(silent, [],
    `these still truncate without a "… +N more" marker: ${silent.join(', ')}`);
});

test('the marker states how many members were dropped', () => {
  const { extract } = require('../../src/extractors/kotlin');
  const marker = extract(FIXTURES.kotlin).find(isMarker);
  assert.ok(marker, 'reaching the ceiling must append a disclosure marker');
  assert.ok(/\+\d+ more/.test(marker), `the marker must carry a count: ${marker}`);
});

test('a small class is unchanged — no marker, nothing dropped', () => {
  const { extract } = require('../../src/extractors/kotlin');
  const sigs = extract('class C {\n    fun only(a: Int): Int { return a }\n}');
  assert.ok(!sigs.some((s) => /more/.test(s)), 'no marker for a small class');
  assert.strictEqual(members(sigs).length, 1);
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
