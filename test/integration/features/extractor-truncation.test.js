'use strict';

/**
 * Extractor caps now disclose truncation instead of silently dropping the tail
 * of large files (P3). Verifies the shared helper and the JS/TS extractors.
 */

const assert = require('assert');
const { capWithNotice, capMembersWithNotice } = require('../../../src/util/truncate');
const jsExtract = require('../../../src/extractors/javascript').extract;
const tsExtract = require('../../../src/extractors/typescript').extract;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++; }
}

console.log('[extractor-truncation.test.js] visible caps\n');

test('capWithNotice: under limit is unchanged', () => {
  assert.deepStrictEqual(capWithNotice(['a', 'b'], 5, 'signatures'), ['a', 'b']);
});

test('capWithNotice: over limit keeps N and appends a marker', () => {
  const r = capWithNotice(['a', 'b', 'c', 'd'], 2, 'signatures');
  assert.deepStrictEqual(r, ['a', 'b', '… +2 more signatures']);
});

test('capMembersWithNotice: appends a member-shaped marker', () => {
  const members = Array.from({ length: 12 }, (_, i) => ({ text: `m${i}()`, start: 0, end: 0 }));
  const r = capMembersWithNotice(members, 8, 'methods');
  assert.strictEqual(r.length, 9);
  assert.strictEqual(r[8].text, '… +4 more methods');
});

test('JS extractor: a class with >8 methods discloses the drop', () => {
  const methods = Array.from({ length: 12 }, (_, i) => `  method${i}(a) { return a; }`).join('\n');
  const src = `class Big {\n${methods}\n}\n`;
  const sigs = jsExtract(src);
  assert.ok(sigs.some((s) => /\+\d+ more methods/.test(s)), `expected a truncation marker, got:\n${sigs.join('\n')}`);
  // still capped at 8 real methods + 1 marker (+ the class line)
  assert.ok(sigs.filter((s) => /method\d+\(/.test(s)).length === 8, 'should keep exactly 8 methods');
});

test('JS extractor: a small class is NOT annotated', () => {
  const sigs = jsExtract('class Small {\n  a() {}\n  b() {}\n}\n');
  assert.ok(!sigs.some((s) => /more methods/.test(s)), 'no marker for a small class');
});

test('TS extractor: an interface with >8 members discloses the drop', () => {
  const members = Array.from({ length: 11 }, (_, i) => `  field${i}: string;`).join('\n');
  const src = `export interface Big {\n${members}\n}\n`;
  const sigs = tsExtract(src);
  assert.ok(sigs.some((s) => /\+\d+ more members/.test(s)), `expected a members marker, got:\n${sigs.join('\n')}`);
});

test('TS extractor: a class with >8 methods discloses the drop', () => {
  const methods = Array.from({ length: 12 }, (_, i) => `  method${i}(a: number): number { return a; }`).join('\n');
  const sigs = tsExtract(`export class Big {\n${methods}\n}\n`);
  assert.ok(sigs.some((s) => /\+\d+ more methods/.test(s)), `expected a methods marker, got:\n${sigs.join('\n')}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
