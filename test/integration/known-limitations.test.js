'use strict';

/**
 * KNOWN_LIMITATIONS.md + README extraction-honesty tier label (G1, #520).
 * Guards that the honesty page exists, states the tiers/caps/gaps, and that
 * its quoted counts never drift from version.json or the actual extractors.
 * Run: node test/integration/known-limitations.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOC = fs.existsSync(path.join(ROOT, 'KNOWN_LIMITATIONS.md'))
  ? fs.readFileSync(path.join(ROOT, 'KNOWN_LIMITATIONS.md'), 'utf8') : '';
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const versionJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

test('KNOWN_LIMITATIONS.md exists and names all three tiers', () => {
  assert.ok(DOC.length > 0, 'KNOWN_LIMITATIONS.md missing');
  assert.ok(/1 — AST/.test(DOC), 'Tier 1 (AST) missing');
  assert.ok(/2 — anchored regex/.test(DOC), 'Tier 2 (anchored regex) missing');
  assert.ok(/3 — pattern\/heuristic/.test(DOC), 'Tier 3 (pattern/heuristic) missing');
});

test('doc states the three truncation limits, each number the code\'s, and the nested-paren gap', () => {
  const { DEFAULTS } = require('../../src/config/defaults');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert.ok(DOC.includes(`first ${DEFAULTS.maxSigsPerFile} signatures of a file`), 'the context-file limit is missing or not the default');
  assert.ok(DOC.includes(`up to ${DEFAULTS.maxIndexSigsPerFile} signatures of a file`), 'the index limit is missing or not the default');
  assert.ok(DOC.includes('`maxIndexSigsPerFile`') && DOC.includes('`maxSigsPerFile`'), 'the two settings are not named');
  // the extractors\' own ceilings, which the index cannot exceed: 200 a file, 120 a class
  assert.ok(/200 signatures a file and 120 members a class/.test(DOC), 'the extractors\' own limits are missing');
  for (const rel of ['src/extractors/python.js', 'src/extractors/go.js', 'src/extractors/rust.js']) {
    assert.ok(/PER_FILE_LIMIT = 200;/.test(read(rel)) && /MEMBER_LIMIT = 120;/.test(read(rel)), `${rel} no longer has the 200 / 120 the doc quotes`);
  }
  assert.ok(/MAX_SIGS = 200\b/.test(read('src/extractors/python_ast.py')), 'the Python AST tier no longer stops at 200');
  assert.ok(!/8 members per class/.test(DOC), 'the stale "8 members per class" is back');
  assert.ok(/first `\)`/.test(DOC), 'nested-paren gap missing');
});

test('doc states the verify implication (fake-symbol at medium confidence)', () => {
  assert.ok(DOC.includes('fake-symbol'), 'fake-symbol implication missing');
  assert.ok(/medium confidence/.test(DOC), 'medium-confidence framing missing');
  assert.ok(/false positive/.test(DOC), 'conservative false-positive framing missing');
});

test('doc counts match version.json (drift guard)', () => {
  const m = DOC.match(/(\d+) extractor modules covering (\d+) languages/);
  assert.ok(m, 'counts line missing from doc');
  assert.strictEqual(Number(m[1]), versionJson.extractors, `doc says ${m[1]} extractors, version.json says ${versionJson.extractors}`);
  assert.strictEqual(Number(m[2]), versionJson.languages, `doc says ${m[2]} languages, version.json says ${versionJson.languages}`);
});

test('Tier-2 anchored-language count matches the extractors that use withAnchor', () => {
  const dir = path.join(ROOT, 'src', 'extractors');
  const anchored = fs.readdirSync(dir).filter((f) =>
    f.endsWith('.js') && f !== 'line-anchor.js' &&
    fs.readFileSync(path.join(dir, f), 'utf8').includes('withAnchor'));
  const m = DOC.match(/C# \((\d+)\)/);
  assert.ok(m, 'Tier-2 count missing from doc');
  assert.strictEqual(Number(m[1]), anchored.length,
    `doc says ${m[1]} anchored languages, code has ${anchored.length}: ${anchored.join(', ')}`);
});

test('README carries the tier label and links KNOWN_LIMITATIONS.md', () => {
  assert.ok(README.includes('### Extraction honesty'), 'README tier-label section missing');
  assert.ok(README.includes('](KNOWN_LIMITATIONS.md)'), 'README link to KNOWN_LIMITATIONS.md missing');
  assert.ok(/25 signatures\/file/.test(README), 'README caps summary missing');
  assert.ok(/up to 200 in the retrieval index/.test(README) && /120 members\/class/.test(README), 'README caps summary is stale');
});

console.log(`\n  known-limitations: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
