'use strict';

// Every shipped parser needs corpus tasks or a recorded exemption (#701).

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const { langFor, LANGUAGES } = require(path.join(ROOT, 'src/extractors/dispatch'));
const TASKS_DIR = path.join(ROOT, 'benchmarks/tasks');
const COVERAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/corpus-coverage.json'), 'utf8'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}

// Tasks per parser key, derived from what each task's expected files are.
function tally(tasksDir) {
  const counts = {};
  for (const f of fs.readdirSync(tasksDir).filter((n) => n.endsWith('.jsonl'))) {
    for (const line of fs.readFileSync(path.join(tasksDir, f), 'utf8').split('\n').filter(Boolean)) {
      const langs = new Set((JSON.parse(line).expected_files || []).map((e) => langFor(e)).filter(Boolean));
      for (const l of langs) counts[l] = (counts[l] || 0) + 1;
    }
  }
  return counts;
}

// Everything wrong with an exemptions file. Pure, so the guard itself is
// testable with data that has the failures in it.
function gaps({ all, counts, rules, answers }) {
  const out = [];
  const exempt = rules.exempt || {};
  const open = rules.knownGaps || {};
  const min = rules.minTasks;
  for (const l of all) {
    const n = counts[l] || 0;
    if (exempt[l] && open[l]) out.push(`${l} is both exempt and a known gap`);
    if (exempt[l]) continue;
    if (n >= min && open[l]) out.push(`${l} now has ${n} labelled tasks — remove it from knownGaps`);
    if (n < min && !open[l]) out.push(`${l} has ${n} labelled task(s) (< ${min}) and no recorded exemption or known gap`);
  }
  for (const [kind, table] of [['exempt', exempt], ['knownGaps', open]]) {
    for (const [l, reason] of Object.entries(table)) {
      if (!all.includes(l)) out.push(`${kind}.${l} names no parser key — stale entry`);
      if (typeof reason !== 'string' || reason.trim().length < 20) out.push(`${kind}.${l} needs a real reason`);
    }
  }
  for (const l of Object.keys(exempt)) {
    if (answers.has(l)) out.push(`${l} is an answer language and cannot be exempt — it is a known gap or it needs a corpus`);
  }
  return out;
}

(async () => {
  const { ANSWER_LANGUAGES } = await import('../../scripts/lib/xrepo-hygiene.mjs');
  const counts = tally(TASKS_DIR);

  await test('every extractor language is covered by a corpus, exempt, or a recorded known gap', () => {
    const f = gaps({ all: LANGUAGES, counts, rules: COVERAGE, answers: ANSWER_LANGUAGES });
    assert.deepStrictEqual(f, [], `findings:\n  ${f.join('\n  ')}`);
  });

  await test('the four languages #701 reported have a corpus now: Elixir, Astro, Lua and GDScript', () => {
    for (const l of ['elixir', 'astro', 'lua', 'gdscript']) {
      assert.ok((counts[l] || 0) >= COVERAGE.minTasks, `${l} has ${counts[l] || 0} labelled task(s)`);
      assert.ok(!COVERAGE.knownGaps[l] && !COVERAGE.exempt[l], `${l} must not be listed as a gap or exemption`);
    }
  });

  await test('the guard fails for an extractor with no corpus and no exemption', () => {
    const f = gaps({ all: ['go', 'brandnew'], counts: { go: 5 }, rules: { minTasks: 3, exempt: {}, knownGaps: {} }, answers: new Set(['go']) });
    assert.deepStrictEqual(f, ['brandnew has 0 labelled task(s) (< 3) and no recorded exemption or known gap']);
  });

  await test('the guard is a ratchet: a gap that closed must leave the list', () => {
    const f = gaps({ all: ['go'], counts: { go: 4 }, rules: { minTasks: 3, exempt: {}, knownGaps: { go: 'was uncovered, long enough reason' } }, answers: new Set(['go']) });
    assert.deepStrictEqual(f, ['go now has 4 labelled tasks — remove it from knownGaps']);
  });

  await test('the guard rejects stale entries, empty reasons, and an answer language hidden as exempt', () => {
    const f = gaps({ all: ['go', 'sql'], counts: { go: 5 },
      rules: { minTasks: 3, exempt: { go: 'a perfectly long reason here', nosuch: 'a perfectly long reason here', sql: 'short' }, knownGaps: {} },
      answers: new Set(['go']) });
    assert.ok(f.some((x) => /nosuch names no parser key/.test(x)), f.join('|'));
    assert.ok(f.some((x) => /sql needs a real reason/.test(x)), f.join('|'));
    assert.ok(f.some((x) => /go is an answer language and cannot be exempt/.test(x)), f.join('|'));
  });

  await test('only config, markup and scripting languages are exempt', () => {
    for (const l of Object.keys(COVERAGE.exempt)) assert.ok(!ANSWER_LANGUAGES.has(l), `${l} is an answer language`);
  });

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
