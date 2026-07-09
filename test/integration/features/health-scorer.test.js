'use strict';

/**
 * Unit tests for the health scorer's pure core (composeHealth) and the
 * auditable `components` breakdown (v8.11).
 */

const assert = require('assert');
const { composeHealth } = require('../../../src/health/scorer');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++; }
}

const HEALTHY = {
  strategy: 'full',
  daysSinceRegen: 1,
  strategyFreshnessDays: null,
  tokenReductionPct: 92,
  overBudgetRuns: 0,
  totalRuns: 5,
  overBudgetStreak: 0,
  hasSource: true,
};

console.log('[health-scorer.test.js] composeHealth pure core\n');

test('healthy signals → 100 / A with no components', () => {
  const r = composeHealth(HEALTHY);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.grade, 'A');
  assert.strictEqual(r.components.length, 0);
});

test('score always equals 100 minus the sum of component penalties', () => {
  const r = composeHealth({ ...HEALTHY, daysSinceRegen: 12, tokenReductionPct: 10 });
  const sum = r.components.reduce((a, c) => a + c.penalty, 0);
  assert.strictEqual(r.score, Math.max(0, 100 - sum), `score ${r.score} != 100-${sum}`);
});

test('context never generated: null regen + source present → 45pt penalty (D)', () => {
  const r = composeHealth({ ...HEALTHY, daysSinceRegen: null });
  assert.strictEqual(r.score, 55);
  assert.strictEqual(r.grade, 'D');
  assert.ok(r.components.some((c) => c.id === 'not-generated'), 'expected not-generated component');
});

test('empty repo (no source) is NOT penalised for missing context', () => {
  const r = composeHealth({ ...HEALTHY, daysSinceRegen: null, hasSource: false });
  assert.strictEqual(r.score, 100, `empty repo should stay 100, got ${r.score}`);
  assert.ok(!r.components.some((c) => c.id === 'not-generated'));
});

test('staleness scales with age and caps at 30', () => {
  assert.strictEqual(composeHealth({ ...HEALTHY, daysSinceRegen: 8 }).score, 96); // 1d over → -4
  assert.strictEqual(composeHealth({ ...HEALTHY, daysSinceRegen: 100 }).score, 70); // capped -30
});

test('overBudgetStreak (previously dead metric) now costs 5pt at ≥3', () => {
  const r = composeHealth({ ...HEALTHY, overBudgetStreak: 4 });
  assert.strictEqual(r.score, 95);
  assert.ok(r.components.some((c) => c.id === 'over-budget-streak'));
});

test('low reduction penalised for full, ignored for hot-cold', () => {
  const full = composeHealth({ ...HEALTHY, tokenReductionPct: 10 });
  const hot = composeHealth({ ...HEALTHY, strategy: 'hot-cold', tokenReductionPct: 10 });
  assert.strictEqual(full.score, 80, 'full should lose 20');
  assert.strictEqual(hot.score, 100, 'hot-cold should not lose reduction points');
});

test('every component carries id, label, penalty>0, and a detail string', () => {
  const r = composeHealth({ ...HEALTHY, daysSinceRegen: 40, overBudgetRuns: 5, totalRuns: 5, overBudgetStreak: 6 });
  assert.ok(r.components.length >= 2);
  for (const c of r.components) {
    assert.ok(c.id && c.label && typeof c.detail === 'string', `bad component ${JSON.stringify(c)}`);
    assert.ok(c.penalty > 0, 'penalty must be positive');
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
