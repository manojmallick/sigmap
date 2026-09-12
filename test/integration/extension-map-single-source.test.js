'use strict';

/**
 * Extractor resolution has one source of truth (#591).
 *
 * Three places decided which extractor module to load, and two had drifted:
 * `src/eval/analyzer.js` carried a dead duplicate `.vue` key, and the
 * `--diagnose-extractors` map still pointed at `vue.js` after that module was
 * deleted. That drift is how an unreachable extractor survived unnoticed
 * (#582), and how `.gd` went un-diagnosed despite having both a fixture and a
 * recorded expected output.
 *
 * Not every extension map is a resolution map. `language-detector.js` maps
 * `.tsx → typescript` for language *statistics* and `dashboard.js` keeps short
 * display *labels*; both are correct for their purpose and must stay separate,
 * so this test pins that distinction rather than demanding one global map.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const dispatch = require(path.join(ROOT, 'src/extractors/dispatch'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('dispatch exports the resolution map', () => {
  assert.strictEqual(typeof dispatch.EXT_MAP, 'object');
  assert.ok(Object.keys(dispatch.EXT_MAP).length > 30,
    `expected a full extension map, got ${Object.keys(dispatch.EXT_MAP).length} entries`);
  assert.strictEqual(dispatch.EXT_MAP['.tsx'], 'typescript_react');
  assert.strictEqual(dispatch.EXT_MAP['.vue'], 'vue_sfc');
});

test('no duplicate keys in the resolution map', () => {
  // A duplicate key is silent in JS — last wins — which is exactly how the
  // dead `.vue` entry in analyzer.js hid behind a live one.
  const src = read('src/extractors/dispatch.js');
  const block = src.slice(src.indexOf('const EXT_MAP = {'), src.indexOf('};', src.indexOf('const EXT_MAP = {')));
  const keys = [...block.matchAll(/'(\.[A-Za-z0-9]+)'\s*:/g)].map((m) => m[1]);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepStrictEqual([...new Set(dupes)], [], `duplicate extension key(s): ${dupes.join(', ')}`);
});

test('analyzer.js resolves through the dispatcher, not its own map', () => {
  const src = read('src/eval/analyzer.js');
  assert.ok(/require\(['"]\.\.\/extractors\/dispatch['"]\)/.test(src),
    'analyzer.js does not require the dispatcher');
  assert.ok(!/const\s+EXT_MAP\s*=\s*\{/.test(src),
    'analyzer.js declares its own extension map again');
});

test('--diagnose-extractors resolves through the dispatcher', () => {
  const src = read('gen-context.js');
  const i = src.indexOf("if (args.includes('--diagnose-extractors'))");
  assert.ok(i > 0, '--diagnose-extractors block not found');
  const block = src.slice(i, i + 3000);
  assert.ok(/langFor/.test(block), '--diagnose-extractors does not use langFor');
  assert.ok(!/const\s+EXT_TO_LANG\s*=\s*\{/.test(block),
    '--diagnose-extractors declares its own extension map again');
});

test('every fixture resolves, including .gd which the old map omitted', () => {
  // gdscript had a fixture and an expected file but was absent from the
  // hand-maintained diagnose map, so it was never actually diagnosed.
  assert.strictEqual(dispatch.langFor('gdscript.gd'), 'gdscript');
  const unresolved = fs.readdirSync(path.join(ROOT, 'test', 'fixtures'))
    .filter((f) => !fs.statSync(path.join(ROOT, 'test', 'fixtures', f)).isDirectory())
    .filter((f) => !dispatch.langFor(f));
  assert.deepStrictEqual(unresolved, [], `fixture(s) the dispatcher cannot resolve: ${unresolved.join(', ')}`);
});

test('labelling maps stay separate from resolution, by design', () => {
  // language-detector counts languages: TSX *is* TypeScript for that purpose.
  // If someone "deduplicates" it into the resolution map, language stats break.
  const detector = require(path.join(ROOT, 'src/discovery/language-detector.js'));
  const src = read('src/discovery/language-detector.js');
  assert.ok(/'\.tsx':\s*'typescript'/.test(src),
    'language-detector should map .tsx to typescript for language statistics');
  assert.strictEqual(dispatch.EXT_MAP['.tsx'], 'typescript_react',
    'resolution must still map .tsx to the React extractor');
  assert.ok(detector, 'language-detector should load');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
