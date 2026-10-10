'use strict';

/**
 * Hop-1 graph-boost damping (#935): the ranker option and the held-out selection.
 *
 * The option bounds how much a file may ACCUMULATE from the import graph and is
 * absent by default, so shipping it changes nothing until a rule is switched on.
 * These tests pin what a rule may and may not do, with a hand-built graph and
 * index (no repository, no network):
 *
 *   - absent or empty `graphDamping` is byte-identical to the undamped ranker
 *   - the first bonus is never damped, so a rule cannot hide a neighbour
 *   - each rule bounds accumulation and nothing else
 *   - the selection picks on one half, ties go to the milder rule, and a flat
 *     table chooses nothing
 *
 * Run: node test/integration/graph-damping.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const { rank, GRAPH_BOOST_AMOUNTS } = require(path.join(ROOT, 'src/retrieval/ranker'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}

// ── a hand-built repository ──────────────────────────────────────────────────
//
// `core.js` matches the query and is imported by SEEDS other matching files, so
// it takes one hop-1 bonus per importing seed: the accumulation a rule bounds.

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const CWD = path.join(path.sep, 'repo');
const SEEDS = 30;
const abs = (rel) => path.join(CWD, rel);

function fixture() {
  const index = new Map();
  index.set('src/core.js', ['function schedulerCore(task)  :1-5']);
  const forward = new Map();
  const reverse = new Map();
  const link = (from, to) => {
    const f = abs(from).toLowerCase();
    const t = abs(to).toLowerCase();
    if (!forward.has(f)) forward.set(f, []);
    forward.get(f).push(t);
    if (!reverse.has(t)) reverse.set(t, new Set());
    reverse.get(t).add(f);
  };
  for (let i = 0; i < SEEDS; i++) {
    const seed = `src/user${String(i).padStart(2, '0')}.js`;
    index.set(seed, [`function schedulerUser${i}(task)  :1-5`]);
    link(seed, 'src/core.js');
  }
  // Padding keeps `core.js` (SEEDS importers) under the 20%-of-graph hub cutoff.
  for (let i = 0; i < 200; i++) index.set(`src/pad${i}.js`, [`function unrelated${i}()  :1-1`]);
  for (const file of index.keys()) {
    const k = abs(file).toLowerCase();
    if (!forward.has(k)) forward.set(k, []);
    if (!reverse.has(k)) reverse.set(k, new Set());
  }
  return { index, graph: { forward, reverse } };
}

const QUERY = 'scheduler task';
const run = (damping) => {
  const { index, graph } = fixture();
  const out = rank(QUERY, index, { topK: 400, cwd: CWD, graph, learned: false, graphDamping: damping, includeZeroScore: true });
  return new Map(out.map((r) => [r.file, r]));
};
const boostOf = (res, file) => (res.get(file).signals.graphBoost || 0);

(async () => {
  const HOP1 = GRAPH_BOOST_AMOUNTS.hop1;
  const { RULES, chooseRule, netOf, foldsOf } = await import('../../scripts/lib/graph-damping.mjs');

  // ── the ranker option ──────────────────────────────────────────────────────

  await test('the fixture reaches the graph boost: core.js takes one bonus per importing seed', () => {
    const r = run(undefined);
    assert.ok(boostOf(r, 'src/core.js') >= SEEDS * HOP1 - 1e-9, `core.js boost ${boostOf(r, 'src/core.js')}`);
  });

  await test('no option, an empty option and an unknown key are byte-identical', () => {
    const plain = [...run(undefined).entries()].map(([f, r]) => [f, r.score, r.signals.graphBoost]);
    for (const d of [{}, null, { unknownKnob: 3 }]) {
      assert.deepStrictEqual([...run(d).entries()].map(([f, r]) => [f, r.score, r.signals.graphBoost]), plain);
    }
  });

  await test('maxBonuses bounds accumulation, and a file below the bound is untouched', () => {
    const capped = boostOf(run({ maxBonuses: 8 }), 'src/core.js');
    assert.ok(Math.abs(capped - 8 * HOP1) < 1e-9, `core.js must take exactly 8 hop-1 bonuses, took ${capped / HOP1}`);
    assert.strictEqual(boostOf(run({ maxBonuses: SEEDS + 5 }), 'src/core.js'), boostOf(run(undefined), 'src/core.js'));
  });

  await test('the first bonus is never damped, even under the strictest rule', () => {
    for (const d of [{ maxBonuses: 1 }, { maxShare: 0 }, { decay: 0 }]) {
      const r = run(d);
      assert.ok(boostOf(r, 'src/core.js') >= HOP1 - 1e-9, `${JSON.stringify(d)}: core.js lost its designed bonus`);
    }
  });

  await test('maxShare bounds the total bonus to a share of the file\'s own score', () => {
    const undamped = run(undefined).get('src/core.js');
    const base = undamped.score - boostOf(run(undefined), 'src/core.js');
    const r = run({ maxShare: 0.5 });
    const bonuses = Math.round(boostOf(r, 'src/core.js') / HOP1);
    assert.ok(bonuses >= 1, 'the first bonus is free');
    assert.ok(bonuses === 1 || bonuses * HOP1 <= 0.5 * base + 1e-9, `${bonuses} bonuses exceed half of ${base}`);
    assert.ok(boostOf(r, 'src/core.js') < boostOf(run(undefined), 'src/core.js'));
  });

  await test('decay makes each further bonus smaller, so the total saturates', () => {
    const total = boostOf(run({ decay: 0.5 }), 'src/core.js');
    assert.ok(total <= HOP1 / (1 - 0.5) + 1e-9, `decayed total ${total} passes its limit ${HOP1 / (1 - 0.5)}`);
    assert.ok(total > HOP1, 'the later bonuses still add something');
  });

  await test('a damping rule never gives a file a score it did not have, and never reorders by name', () => {
    const plain = run(undefined);
    for (const rule of RULES) {
      const r = run(rule.damping);
      for (const [file, res] of r) assert.ok(res.score <= plain.get(file).score + 1e-9, `${rule.id}: ${file} rose`);
    }
  });

  // ── the family and the selection ───────────────────────────────────────────

  await test('rule ids are unique and every rule sets at least one knob', () => {
    assert.strictEqual(new Set(RULES.map((r) => r.id)).size, RULES.length);
    for (const r of RULES) assert.ok(Object.keys(r.damping).length > 0, `${r.id} has no knob`);
  });

  await test('folds deal sorted units alternately, whatever order they arrive in', () => {
    const a = foldsOf(['d', 'b', 'a', 'c']);
    const b = foldsOf(['a', 'b', 'c', 'd']);
    assert.deepStrictEqual([...a.entries()].sort(), [...b.entries()].sort());
    assert.deepStrictEqual([...b.values()], [0, 1, 0, 1]);
  });

  await test('chooseRule picks the best net, breaks ties toward the milder rule, and a flat table picks nothing', () => {
    const cells = [{ shipped: 10, rules: { once: 10, cap24: 11, cap16: 12, cap8: 12, cap4: 9 } }];
    assert.deepStrictEqual(chooseRule(cells, ['once', 'cap24', 'cap16', 'cap8', 'cap4']), { id: 'cap16', net: 2 });
    assert.strictEqual(chooseRule([{ shipped: 10, rules: { once: 10, cap8: 10 } }], ['once', 'cap8']), null);
    assert.strictEqual(chooseRule([{ shipped: 10, rules: { once: 9, cap8: 8 } }], ['once', 'cap8']), null);
    assert.strictEqual(netOf(cells, 'cap4'), -1);
  });

  // ── the recorded measurement and the guide that reports it ────────────────

  const REPORT = 'benchmarks/reports/graph-damping-sweep.json';
  const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
  const cell = (won, lost) => `${signed(won - lost)} (${won}/${lost})`;
  const guideSection = () => {
    const guide = read('docs-vp/guide/retrieval-benchmark.md');
    const at = guide.indexOf('\n### Calibrating the neighbour boost (#935)\n');
    assert.ok(at !== -1, 'the guide has no "Calibrating the neighbour boost (#935)" section');
    const next = guide.indexOf('\n### ', at + 10);
    return guide.slice(at, next === -1 ? undefined : next);
  };

  await test('the report holds exactly the declared rule family, each scored on every corpus', () => {
    const report = JSON.parse(read(REPORT));
    assert.deepStrictEqual(Object.keys(report.grid), RULES.map((r) => r.id));
    for (const r of RULES) {
      assert.deepStrictEqual(report.grid[r.id].damping, r.damping, `${r.id}: the report records another rule than the code declares`);
      assert.deepStrictEqual(Object.keys(report.grid[r.id].corpora).sort(), ['easy', 'hard', 'jvm', 'mined', 'xrepo']);
    }
  });

  await test('no recorded rule meets the guide\'s default rule, so nothing is switched on (#935)', () => {
    // The rule the guide states: default only when xrepo wins at least 5 more than it loses and no corpus is net-negative.
    const report = JSON.parse(read(REPORT));
    for (const [id, g] of Object.entries(report.grid)) {
      const nets = Object.fromEntries(Object.entries(g.corpora).map(([c, v]) => [c, v.won - v.lost]));
      const meets = nets.xrepo >= 5 && Object.values(nets).every((n) => n >= 0);
      assert.ok(!meets, `${id} meets the default rule (${JSON.stringify(nets)}): decide it, then change buildRankingGraph and this test together`);
    }
  });

  await test('the ranker is still handed the pre-#934 graph and no config switches a rule on', () => {
    const builder = read('src/graph/builder.js');
    assert.ok(/function buildRankingGraph[\s\S]*configuredSrcDirs\(cwd\) \|\| DEFAULT_SRC_DIRS/.test(builder));
    for (const rel of ['src/mcp/handlers.js', 'src/eval/runner.js', 'src/config/defaults.js']) {
      assert.ok(!/graphDamping/.test(read(rel)), `${rel} must not switch a damping rule on`);
    }
  });

  await test('the guide\'s table is the saved report, row for row', () => {
    const report = JSON.parse(read(REPORT));
    const lines = guideSection().split('\n');
    const i = lines.findIndex((l) => l.startsWith('| Rule'));
    assert.ok(i !== -1, 'the results table is missing');
    const rows = [];
    for (let j = i + 2; j < lines.length && lines[j].startsWith('|'); j++) {
      rows.push(lines[j].split('|').slice(1, -1).map((c) => c.trim().replace(/\*\*/g, '').replace(/`/g, '')));
    }
    const order = ['xrepo', 'hard', 'mined', 'easy', 'jvm'];
    const FULL = 'complete graph, no rule';
    assert.deepStrictEqual(rows.map((r) => r[0]), [FULL, ...RULES.map((r) => r.id)], 'the control, then every rule of the family in order');
    for (const row of rows) {
      const g = row[0] === FULL ? report.full : report.grid[row[0]];
      let won = 0;
      let lost = 0;
      order.forEach((c, k) => {
        assert.strictEqual(row[k + 1], cell(g.corpora[c].won, g.corpora[c].lost), `${row[0]} on ${c}`);
        won += g.corpora[c].won;
        lost += g.corpora[c].lost;
      });
      assert.strictEqual(row[6], cell(won, lost), `${row[0]} over every corpus`);
    }
  });

  await test('the guide names the rule each fold chose, and what the held-out half read', () => {
    const report = JSON.parse(read(REPORT));
    const text = guideSection();
    for (const cv of report.crossValidation) {
      const want = cv.chosen === null ? 'no rule' : `\`${cv.chosen}\``;
      assert.ok(text.includes(want), `the guide does not name fold ${cv.tuneFold}'s choice (${want})`);
    }
  });

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
