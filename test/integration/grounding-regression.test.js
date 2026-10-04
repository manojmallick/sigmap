'use strict';

/**
 * Grounding regression corpus (#673) — scripts/run-grounding-regression.mjs.
 * Deterministic, offline. Run: node test/integration/grounding-regression.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts', 'run-grounding-regression.mjs');
const BASELINE = path.join(ROOT, 'benchmarks', 'grounding-regression-baseline.json');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

(async () => {
  const g = await import(pathToFileURL(SCRIPT).href);
  const key = (kind, value) => `${kind}::${value}`;

  // ── Scoring ────────────────────────────────────────────────────────────────

  test('tally: a flagged fake is a TP, a flagged non-fake is an FP, an unflagged fake is an FN', () => {
    const t = g.tally(
      [key('file', 'ghost.js'), key('symbol', 'realFn')],
      [key('file', 'ghost.js'), key('import', 'ghost-pkg')],
      ['file', 'symbol', 'import']);
    assert.deepStrictEqual(t.file, { tp: 1, fp: 0, fn: 0 });
    assert.deepStrictEqual(t.symbol, { tp: 0, fp: 1, fn: 0 }, 'flagging a real claim is a false positive');
    assert.deepStrictEqual(t.import, { tp: 0, fp: 0, fn: 1 });
  });

  test('tally: good.md (no fakes) turns every flag into a false positive', () => {
    const t = g.tally([key('symbol', 'a'), key('symbol', 'b')], [], ['symbol']);
    assert.deepStrictEqual(t.symbol, { tp: 0, fp: 2, fn: 0 });
  });

  test('rates: no labelled fakes means recall is unmeasured (null), never a vacuous 100%', () => {
    const r = g.rates({ tp: 0, fp: 0, fn: 0 });
    assert.strictEqual(r.recall, null);
    assert.strictEqual(r.precision, 1, 'nothing was wrongly flagged');
  });

  test('rates: precision and recall from counts', () => {
    const r = g.rates({ tp: 3, fp: 1, fn: 1 });
    assert.strictEqual(r.precision, 0.75);
    assert.strictEqual(r.recall, 0.75);
  });

  // ── Corpus integrity ───────────────────────────────────────────────────────

  const fixtures = g.loadFixtures();

  test(`corpus spans at least ${g.MIN_LANGUAGES} languages`, () => {
    const langs = new Set(fixtures.map((f) => f.labels.language));
    assert.ok(langs.size >= g.MIN_LANGUAGES, `only ${langs.size}: ${[...langs]}`);
  });

  test('every fixture has a repo and labelled fakes', () => {
    for (const fx of fixtures) {
      assert.ok(fs.existsSync(path.join(fx.dir, 'repo')), `${fx.name}: missing repo/`);
      assert.ok(fx.labels.fake.length >= 4, `${fx.name}: too few planted fakes`);
      assert.ok(fx.labels.real.length >= 4, `${fx.name}: too few real labels`);
    }
  });

  // How a claim is actually written: a symbol is a backtick call (`name(`), anything
  // else a whole token. Plain substring matching would see the shadow fake `rank`
  // inside the real `rankFiles`, and inside the word "rank" in a heading.
  const escapeRe = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasClaim = (text, { kind, value }) => (kind === 'symbol'
    ? text.includes('`' + value + '(')
    : new RegExp(`(?<![\\w$])${escapeRe(value)}(?![\\w$])`).test(text));

  test('every planted fake appears in bad.md and never in good.md', () => {
    for (const fx of fixtures) {
      for (const f of fx.labels.fake) {
        assert.ok(hasClaim(fx.bad, f), `${fx.name}: fake ${f.value} is not in bad.md`);
        assert.ok(!hasClaim(fx.good, f), `${fx.name}: fake ${f.value} leaked into good.md`);
      }
    }
  });

  test('a labelled fake does not exist in its fixture repo (it would not be fake)', () => {
    for (const fx of fixtures) {
      for (const f of fx.labels.fake.filter((x) => x.kind === 'file')) {
        // `lib/index.js` is a wrong-directory fake: its basename legitimately exists, its path must not.
        assert.ok(!fs.existsSync(path.join(fx.dir, 'repo', f.value)), `${fx.name}: ${f.value} exists on disk`);
      }
    }
  });

  test('every real label appears in good.md or bad.md', () => {
    for (const fx of fixtures) {
      for (const r of fx.labels.real) {
        assert.ok(fx.good.includes(r.value) || fx.bad.includes(r.value), `${fx.name}: real ${r.value} is in neither answer`);
      }
    }
  });

  // ── End to end ─────────────────────────────────────────────────────────────

  const report = g.buildReport(fixtures.map(g.runFixture));

  test('verify never flags a real claim (precision 1 on every kind)', () => {
    for (const [kind, r] of Object.entries(report.engines.verify.kinds)) {
      assert.strictEqual(r.precision, 1, `verify/${kind} precision ${r.precision}`);
    }
  });

  test('every verify kind measures something (a labelled fake exists for it)', () => {
    for (const [kind, r] of Object.entries(report.engines.verify.kinds)) {
      assert.notStrictEqual(r.recall, null, `verify/${kind} has no labelled fakes`);
    }
  });

  test('the report carries no temp paths and is deterministic across runs', () => {
    const again = g.buildReport(fixtures.map(g.runFixture));
    assert.deepStrictEqual(again, report, 'two consecutive runs must be identical');
    assert.ok(!/sigmap-gfx|\/var\/|\/tmp\//.test(JSON.stringify(report)), 'a temp path leaked into the report');
  });

  test('the committed baseline passes against the current run', () => {
    const floors = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).floors;
    assert.deepStrictEqual(g.checkFloors(report, floors), []);
  });

  // ── The gate actually gates ────────────────────────────────────────────────

  test('checkFloors fails when a detector regresses below its floor', () => {
    const floors = g.floorsFrom(report);
    const worse = JSON.parse(JSON.stringify(report));
    worse.engines.verify.kinds.symbol.recall = 0.5;
    const fails = g.checkFloors(worse, floors);
    assert.ok(fails.some((f) => f.startsWith('verify/symbol: recall')), fails.join('; '));
  });

  test('checkFloors fails when precision drops (a real claim newly flagged)', () => {
    const floors = g.floorsFrom(report);
    const worse = JSON.parse(JSON.stringify(report));
    worse.engines.verify.kinds.file.precision = 0.9;
    assert.ok(g.checkFloors(worse, floors).some((f) => f.startsWith('verify/file: precision')));
  });

  test('checkFloors fails on a group that measures nothing', () => {
    const floors = g.floorsFrom(report);
    const empty = JSON.parse(JSON.stringify(report));
    empty.engines.verify.kinds.script.recall = null;
    assert.ok(g.checkFloors(empty, floors).some((f) => /verify\/script: no labelled fakes/.test(f)));
  });

  test('checkFloors fails when the corpus shrinks below the language floor', () => {
    const floors = g.floorsFrom(report);
    const small = JSON.parse(JSON.stringify(report));
    small.languages = small.languages.slice(0, 2);
    assert.ok(g.checkFloors(small, floors).some((f) => /language/.test(f)));
  });

  test('checkFloors fails when judge verdict accuracy drops', () => {
    const floors = g.floorsFrom(report);
    const worse = JSON.parse(JSON.stringify(report));
    worse.engines.judge.verdicts.accuracy = 0.1;
    assert.ok(g.checkFloors(worse, floors).some((f) => f.startsWith('judge/verdicts')));
  });

  console.log(`\ngrounding-regression: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
