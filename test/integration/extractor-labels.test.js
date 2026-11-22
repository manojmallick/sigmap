'use strict';

/**
 * #1075: the hand-labelled acceptance gate for a language extractor (scripts/lib/extractor-labels.mjs).
 *
 *   1. every label file in test/labels/ is enforced here, so a new extractor with a label cannot land below the gate;
 *   2. THE GATE IS REAL: deliberately wrong extractors fail it (one that prints nothing, one that prints every line, one that lists only the
 *      first declaration, and the naive one that matches `func|def NAME` in raw text without masking comments and strings);
 *   3. a label that cannot fail is rejected (too few names, a weaker recall bar, a probe with nothing to find or nothing to avoid);
 *   4. CONTRIBUTING.md tells a contributor to write the labels by hand.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; } catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}

(async () => {
  const lib = await import('../../scripts/lib/extractor-labels.mjs');
  const { extractFile } = require('../../src/extractors/dispatch');
  const real = (source, file) => extractFile(file, source);
  const labelOf = (lang) => JSON.parse(fs.readFileSync(path.join(ROOT, 'test/labels', `${lang}.json`), 'utf8'));
  const sourceOf = (label) => fs.readFileSync(path.join(ROOT, label.fixture), 'utf8');
  const langs = fs.readdirSync(path.join(ROOT, 'test/labels')).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

  // ---- 1. the real extractors pass their labels ---------------------------------------------------------------------------
  for (const lang of langs) {
    await test(`the ${lang} extractor passes its hand-written labels`, () => {
      const label = labelOf(lang);
      const r = lib.scoreLabels(real, label, sourceOf(label));
      assert.deepStrictEqual(r.problems, [], 'the label itself must be sound');
      assert.ok(r.ok, `recall ${r.recall}, missing ${r.missing.join(', ')}, probes ${JSON.stringify(r.probes.filter((p) => !p.ok))}`);
    });
  }
  await test('there are labels for at least two languages (the gate is not an empty loop)', () => assert.ok(langs.length >= 2, langs.join(',')));

  // ---- 2. deliberately wrong extractors fail ------------------------------------------------------------------------------
  const wrong = {
    'prints nothing': () => [],
    'prints every non-blank line (bodies, comments and strings included)': (src) => src.split('\n').filter((l) => l.trim()),
    'lists only the first declaration': (src) => { const m = /\b(?:func|def)\s+(\w+)/.exec(src); return m ? [m[0]] : []; },
    'is a naive regex over raw text (no masking of comments and strings)': (src) => [...src.matchAll(/\b(?:func|def|class|type)\s+(?:\([^)]*\)\s*)?(\w+)/g)].map((m) => m[0]),
  };
  for (const lang of langs) {
    const label = labelOf(lang);
    for (const [name, fn] of Object.entries(wrong)) {
      await test(`${lang}: an extractor that ${name} fails the gate`, () => {
        const r = lib.scoreLabels((src) => fn(src), label, sourceOf(label));
        assert.strictEqual(r.ok, false, `it passed: recall ${r.recall}, probes ${JSON.stringify(r.probes)}`);
      });
    }
  }
  await test('the naive extractor fails for the reason the probes exist: it lists a declaration that sits in a comment or a string', () => {
    const label = labelOf('go');
    const r = lib.scoreLabels((src) => [...src.matchAll(/\b(?:func|type)\s+(?:\([^)]*\)\s*)?(\w+)/g)].map((m) => m[0]), label, sourceOf(label));
    assert.ok(r.recall >= 0.5, 'it finds most real declarations');
    assert.ok(r.probes.some((p) => p.leaked.length), 'and it leaks decoys');
  });

  // ---- 3. a label that cannot fail is rejected ----------------------------------------------------------------------------
  const good = () => JSON.parse(JSON.stringify(labelOf('go')));
  await test('a label with fewer than 5 distinct names is rejected', () => {
    const l = good(); l.defines = ['A', 'B', 'A', 'C', 'D'];
    assert.ok(lib.validateLabel(l).some((p) => /at least 5 distinct/.test(p)));
  });
  await test('a recall bar weaker than 95% is rejected, a stricter one is allowed', () => {
    const l = good(); l.minRecall = 0.5;
    assert.ok(lib.validateLabel(l).some((p) => /not weaker/.test(p)));
    l.minRecall = 1;
    assert.deepStrictEqual(lib.validateLabel(l), []);
  });
  await test('a probe needs something to find and something to avoid, both present in its source', () => {
    let l = good(); l.probes[0].mustContain = [];
    assert.ok(lib.validateLabel(l).some((p) => /mustContain.*empty/.test(p)));
    l = good(); l.probes[0].mustNotContain = [];
    assert.ok(lib.validateLabel(l).some((p) => /mustNotContain.*empty/.test(p)));
    l = good(); l.probes[0].mustNotContain = ['NotInTheSource'];
    assert.ok(lib.validateLabel(l).some((p) => /does not appear in its source/.test(p)));
    l = good(); l.probes = [];
    assert.ok(lib.validateLabel(l).some((p) => /at least one probe/.test(p)));
  });
  await test('an unsound label fails the gate even for a perfect extractor', () => {
    const l = good(); l.probes = [];
    const label = l;
    const r = lib.scoreLabels(real, label, sourceOf(label));
    assert.strictEqual(r.ok, false);
  });
  await test('an honest label is needed: names the fixture does not define drop recall below the bar', () => {
    const l = good(); l.defines = [...l.defines, 'Invented1', 'Invented2', 'Invented3'];
    assert.strictEqual(lib.scoreLabels(real, l, sourceOf(l)).ok, false);
  });
  await test('names are matched as whole words: a prefix is not a hit', () => {
    const l = { fixture: 'x.go', defines: ['Get', 'Put', 'Del', 'Run', 'Fetch'], probes: [{ file: 'p.go', source: 'func Real() {}\n// func Ghost() {}\n', mustContain: ['Real'], mustNotContain: ['Ghost'] }] };
    const r = lib.scoreLabels((src) => (src.includes('Real') ? ['func Real()'] : ['func GetUser()', 'func PutAll()', 'func DelAll()', 'func Runner()', 'func FetchAll()']), l, 'x');
    assert.strictEqual(r.recall, 0);
  });

  // synthetic label: 20 names, one probe; the "extractor" lists the first K names for the fixture and the probe's real declaration only if asked
  const synthLabel = () => ({ fixture: 'x.go', defines: Array.from({ length: 20 }, (_, i) => `Name${String.fromCharCode(65 + i)}x`), probes: [{ file: 'p.go', source: 'func Real() {}\n// func Ghost() {}\n', mustContain: ['Real'], mustNotContain: ['Ghost'] }] });
  const synthExtract = (label, k, probeLists) => (src, file) => (file === 'p.go' ? (probeLists ? ['func Real()'] : []) : label.defines.slice(0, k).map((n) => `func ${n}()`));
  await test('the recall bar is exact: 19 of 20 (95%) passes, 18 of 20 (90%) does not', () => {
    const l = synthLabel();
    assert.strictEqual(lib.scoreLabels(synthExtract(l, 19, true), l, 'x').ok, true);
    assert.strictEqual(lib.scoreLabels(synthExtract(l, 18, true), l, 'x').ok, false);
  });
  await test('a probe fails on its own when the real declaration is not listed, even if the fixture recall is perfect', () => {
    const l = synthLabel();
    const r = lib.scoreLabels(synthExtract(l, 20, false), l, 'x');
    assert.strictEqual(r.recall, 1);
    assert.strictEqual(r.ok, false);
    assert.deepStrictEqual(r.probes[0].absent, ['Real']);
  });

  // ---- 4. the CLI and CONTRIBUTING ----------------------------------------------------------------------------------------
  await test('the CLI exits 0 for the real extractors, 2 for a language without a label file', () => {
    const run = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-extractor-labels.mjs'), ...a], { encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(run().status, 0, run().stdout);
    const none = run('no-such-language');
    assert.strictEqual(none.status, 2);
    assert.match(none.stderr, /write test\/labels\/no-such-language\.json by hand/);
  });
  await test('CONTRIBUTING.md tells a contributor to write the labels by hand, and not to generate them', () => {
    const c = fs.readFileSync(path.join(ROOT, 'CONTRIBUTING.md'), 'utf8');
    assert.match(c, /test\/labels\/\{language\}\.json/);
    assert.match(c, /by hand/);
    assert.match(c, /scripts\/check-extractor-labels\.mjs/);
  });

  console.log(`\nextractor-labels: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
