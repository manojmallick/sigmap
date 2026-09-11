'use strict';

/**
 * Member and per-file caps across the extractor set (#576).
 *
 * #551 fixed three hard-coded caps in the Java extractor that hid 85% of the
 * API surface. The same pattern remained everywhere else. Measured on the
 * cloned benchmark repos, a silent 8-member cap was hiding 71% of Swift, 68%
 * of PHP, 64% of Kotlin, 57% of Scala and 43% of C# member surface.
 *
 * Silence is the aggravating part: a disclosed cap lets an agent ask for more,
 * an undisclosed one looks like a class that simply has eight methods.
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

const members = (sigs) => sigs.filter((s) => /^\s/.test(s));

for (const [lang, src] of Object.entries(FIXTURES)) {
  test(`${lang}: a class with ${N} members is not truncated to 8`, () => {
    const { extract } = require(`../../src/extractors/${lang}`);
    const got = members(extract(src));
    assert.ok(got.length > 8,
      `${lang} returned ${got.length} members — the old cap was 8`);
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

test('a class past the ceiling reports how many were dropped', () => {
  const { extract } = require('../../src/extractors/kotlin');
  const huge = `class C {\n${Array.from({ length: 200 }, (_, i) => `    fun m${i}(): Int { return 1 }`).join('\n')}\n}`;
  const marker = extract(huge).find((s) => /\+\d+ more/.test(s));
  assert.ok(marker, 'reaching the ceiling must append a disclosure marker');
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
