'use strict';

/**
 * Guards two escapes found auditing the #578 disclosure work (#582, #583, #584):
 *
 *   1. `vue.js` was registered in dispatch but unreachable — `.vue` maps to
 *      `vue_sfc`. Disclosure was added to a module that never runs, while the
 *      live handler kept truncating silently.
 *   2. Four reachable extractors (.tsx/.properties/.toml/.md) still cut output
 *      with a bare `slice()`. They are exactly the languages with no fixture,
 *      which is why no test could observe it.
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

const MARKER = /…\s*\+\d+\s+more/;

// ── Reachability ───────────────────────────────────────────────────────────

test('every registered extractor is reachable via langFor', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/extractors/dispatch.js'), 'utf8');
  const registered = [...src.matchAll(/^ {2}([a-z_0-9]+):\s*require\(/gm)].map((m) => m[1]);
  assert.ok(registered.length > 20, `expected many registered extractors, got ${registered.length}`);

  // Probe langFor empirically rather than re-deriving its logic: every
  // extension it maps, plus the extensionless names it special-cases.
  const probes = [
    ...[...src.matchAll(/'(\.[a-z0-9]+)'/g)].map((m) => `probe${m[1]}`),
    'Dockerfile', 'Containerfile', 'Makefile', 'CMakeLists.txt',
  ];
  const resolved = new Set(probes.map((f) => dispatch.langFor(f)).filter(Boolean));
  resolved.add('generic'); // programmatic fallback, never name-resolved

  const dead = registered.filter((n) => !resolved.has(n));
  assert.deepStrictEqual(dead, [],
    `extractor module(s) registered but unreachable by any filename: ${dead.join(', ')}`);
});

test('.vue resolves to the SFC extractor and still extracts', () => {
  assert.strictEqual(dispatch.langFor('App.vue'), 'vue_sfc');
  const fixture = path.join(ROOT, 'test/fixtures/vue.vue');
  const sigs = dispatch.extractFile('vue.vue', fs.readFileSync(fixture, 'utf8'));
  assert.ok(sigs.length > 0, '.vue extraction returned nothing');
});

// ── Disclosure on the four previously-silent extractors ────────────────────

const OVERFLOW = 80;
const cases = [
  ['x.tsx', 'import React from "react";\n' + Array.from({ length: OVERFLOW },
    (_, i) => `export function Comp${i}(p: { a: string }) { return <div/>; }`).join('\n')],
  ['x.properties', Array.from({ length: OVERFLOW }, (_, i) => `key.number${i}=value`).join('\n')],
  ['x.toml', Array.from({ length: OVERFLOW }, (_, i) => `[section${i}]\nkey = "v"`).join('\n')],
  ['x.md', Array.from({ length: OVERFLOW }, (_, i) => `## Heading ${i}`).join('\n\n')],
];

for (const [file, src] of cases) {
  test(`${file} discloses what its ceiling dropped`, () => {
    const sigs = dispatch.extractFile(file, src) || [];
    assert.ok(sigs.length > 0, `${file} extracted nothing — the extractor is broken, not capped`);
    assert.ok(MARKER.test(sigs.join('\n')),
      `${file} truncated to ${sigs.length} signatures with no "… +N more" marker`);
  });
}

// ── r.js: inner caps must not defeat the disclosing cap ────────────────────

test('r.js reports the true overflow, not the collection cap', () => {
  const r = require(path.join(ROOT, 'src/extractors/r'));
  const sigs = r.extract(Array.from({ length: OVERFLOW },
    (_, i) => `fn${i} <- function(a, b) { a }`).join('\n'));
  const marker = sigs.find((s) => MARKER.test(s));
  assert.ok(marker, `80 R functions produced ${sigs.length} signatures with no marker`);
  // 80 functions, ceiling 30 → 50 hidden. An inner break that stops collection
  // early makes this read "+1 more", which is the bug.
  const n = Number(marker.match(/\+(\d+)/)[1]);
  assert.strictEqual(n, 50, `marker says +${n} more; 50 signatures are actually hidden`);
});

test('r.js stays silent when nothing is dropped', () => {
  const r = require(path.join(ROOT, 'src/extractors/r'));
  const sigs = r.extract(Array.from({ length: 30 },
    (_, i) => `fn${i} <- function(a) { a }`).join('\n'));
  assert.strictEqual(sigs.length, 30);
  assert.ok(!MARKER.test(sigs.join('\n')), 'emitted a marker with nothing hidden');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
