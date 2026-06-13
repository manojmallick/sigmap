'use strict';

/**
 * Regression tests for prdiff.extractName — the symbol-name extractor behind the
 * "## changes" block. The old regex was unanchored and optional-keyword, so it
 * mishandled JS forms (`export class X`, `const x = () =>`) and could emit a
 * 2-char fragment like `is` (seen as a phantom `+is ~is` in AGENTS.md).
 */

const assert = require('assert');
const path = require('path');
const { extractName, diffSignatures } = require(path.resolve(__dirname, '../../..', 'src/extractors/prdiff'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

const CASES = [
  // declared forms (+ trailing :anchor and → return-type)
  ['function isTestPath(p)  :28-28', 'isTestPath'],
  ['export function format(context, opts = {}) → string  :25-40', 'format'],
  ['async function fetchWithTimeout(url)  :72-80', 'fetchWithTimeout'],
  ['export class UserRepository  :18-36', 'UserRepository'],
  ['def extract  :268-338', 'extract'],
  ['interface Options', 'Options'],
  // const / arrow forms
  ['const closestMatch = (a) =>  :10-20', 'closestMatch'],
  ['let counter = 0', 'counter'],
  // call / member form
  ['get_lines(file, start, end)', 'get_lines'],
  // genuine short name is kept (not a fragment)
  ['function is(x)', 'is'],
  ['is  :140-150', 'is'],
  // non-symbol lines → empty (no guessing)
  ['module.exports = { verify, isTestPath }  :219-219', ''],
  ['module.exports = { extract }  :131-131', ''],
  ['export { a, b } from "./m"', ''],
  ['export * from "./m"', ''],
  ['h1 sigmap-core', ''],
  ['', ''],
];

for (const [input, expected] of CASES) {
  test(`extractName(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`, () => {
    assert.strictEqual(extractName(input), expected);
  });
}

test('extractName never returns a strict substring fragment of the real symbol', () => {
  for (const sig of ['function isTestPath(p)', 'export class IsThingy', 'const isReady = () =>']) {
    const n = extractName(sig);
    assert.ok(n.length > 2 || n === '', `got short fragment ${JSON.stringify(n)} from ${JSON.stringify(sig)}`);
  }
});

test('diffSignatures attributes added/removed/modified by clean names', () => {
  const base = ['export class UserRepo  :1-9', 'function isTestPath(p)  :20-22'];
  const curr = ['export class UserRepo  :1-12', 'function loadScripts(c)  :30-40'];
  const { added, removed, modified } = diffSignatures(base, curr);
  assert.deepStrictEqual(modified, ['UserRepo'], 'UserRepo changed → modified');
  assert.ok(added.some((s) => extractName(s) === 'loadScripts'));
  assert.ok(removed.some((s) => extractName(s) === 'isTestPath'));
  // No phantom 2-char names leak in.
  assert.ok(![...added, ...removed].some((s) => extractName(s) === 'is'), 'phantom "is" leaked');
});

console.log(`\nprdiff-names: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
