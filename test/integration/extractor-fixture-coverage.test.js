'use strict';

/**
 * Every user-facing extractor must have a fixture (#588).
 *
 * This is the gap that let #583 ship: `markdown`, `properties` and `toml` had
 * no fixture, so no test could observe their output, and all three shipped
 * undisclosed truncation caps through a release that claimed otherwise. A
 * missing fixture is not a cosmetic hole — it is an extractor nobody can see.
 *
 * The guard is deliberately structural: it derives the language list from the
 * same source `version.json` counts come from, so adding an extractor without
 * a fixture fails here rather than being noticed two releases later.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const FIXTURES = path.join(ROOT, 'test', 'fixtures');
const EXPECTED = path.join(ROOT, 'test', 'expected');
const dispatch = require(path.join(ROOT, 'src/extractors/dispatch'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

// source-meta is ESM; mirror its helper list rather than import it here, and
// assert below that the two stay in step.
const HELPERS = new Set([
  'line-anchor', 'deps', 'coverage', 'patterns', 'python_ast', 'scan',
  'python_dataclass', 'todos', 'prdiff', 'dispatch', 'generic',
]);

const langs = fs.readdirSync(path.join(ROOT, 'src', 'extractors'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => f.replace(/\.js$/, ''))
  .filter((n) => !HELPERS.has(n))
  .sort();

/** Map each fixture file to the language it exercises, via the real dispatcher. */
function fixtureLangs() {
  const out = new Map();
  for (const name of fs.readdirSync(FIXTURES)) {
    const full = path.join(FIXTURES, name);
    if (fs.statSync(full).isDirectory()) continue;
    const lang = dispatch.langFor(name);
    if (lang) out.set(lang, name);
  }
  return out;
}

test('the mirrored helper list matches scripts/lib/source-meta.mjs', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/lib/source-meta.mjs'), 'utf8');
  const block = src.match(/EXTRACTOR_HELPERS = new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(block, 'EXTRACTOR_HELPERS not found in source-meta.mjs');
  const actual = new Set([...block[1].matchAll(/'([a-z_-]+)'/g)].map((m) => m[1]));
  assert.deepStrictEqual([...actual].sort(), [...HELPERS].sort(),
    'helper list drifted — update this test to match source-meta.mjs');
});

test('every language extractor has a fixture', () => {
  const covered = fixtureLangs();
  const missing = langs.filter((l) => !covered.has(l));
  assert.deepStrictEqual(missing, [],
    `extractor(s) with no fixture in test/fixtures: ${missing.join(', ')}`);
});

test('every fixture extracts at least one signature', () => {
  const empty = [];
  for (const [lang, name] of fixtureLangs()) {
    const src = fs.readFileSync(path.join(FIXTURES, name), 'utf8');
    const sigs = dispatch.extractFile(name, src) || [];
    if (sigs.length === 0) empty.push(`${lang} (${name})`);
  }
  assert.deepStrictEqual(empty, [],
    `fixture(s) produced no signatures — the extractor is broken or the fixture does not match it: ${empty.join(', ')}`);
});

test('every fixture has a recorded expected output', () => {
  const missing = [];
  for (const [lang] of fixtureLangs()) {
    if (!fs.existsSync(path.join(EXPECTED, `${lang}.txt`))) missing.push(lang);
  }
  assert.deepStrictEqual(missing, [],
    `missing test/expected/<lang>.txt for: ${missing.join(', ')} — --diagnose-extractors silently SKIPs these`);
});

test('no orphaned expected file without a live extractor', () => {
  const orphans = fs.readdirSync(EXPECTED)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => f.replace(/\.txt$/, ''))
    .filter((lang) => !langs.includes(lang));
  assert.deepStrictEqual(orphans, [],
    `expected file(s) for extractor(s) that no longer exist: ${orphans.join(', ')}`);
});

test('--diagnose-extractors passes with no SKIPs', () => {
  const out = execFileSync('node', [path.join(ROOT, 'gen-context.js'), '--diagnose-extractors'],
    { cwd: ROOT, encoding: 'utf8' });
  assert.ok(!/\bSKIP\b/.test(out), `--diagnose-extractors reported a SKIP:\n${out.split('\n').filter((l) => /SKIP/.test(l)).join('\n')}`);
  assert.ok(/\b0 failed\b/.test(out), `--diagnose-extractors reported failures:\n${out.slice(-400)}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
