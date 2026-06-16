'use strict';

/**
 * Unit tests for the `gain` dashboard data layer (aggregate + pricing).
 * Zero-dependency, plain Node assertions. Run: node test/integration/gain.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { aggregate, bucketBy, parseSince, normalize } = require('../../src/tracking/aggregate');
const { resolvePrice } = require('../../src/tracking/pricing');
const { recordUsage, readGainLog, isTrackingEnabled } = require('../../src/tracking/logger');
const gt = require('../../src/format/gain-terminal');

const GEN_CONTEXT = path.resolve(__dirname, '../../gen-context.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

// ── normalize: tolerates both schemas ──────────────────────────────────────
test('normalize: new schema passes through', () => {
  const r = normalize({ ts: '2026-06-16T00:00:00Z', op: 'ask', baselineTokens: 1000, actualTokens: 100 });
  assert.strictEqual(r.saved, 900);
  assert.strictEqual(r.savedPct, 90);
  assert.strictEqual(r.op, 'ask');
});

test('normalize: legacy schema (rawTokens/finalTokens) maps correctly', () => {
  const r = normalize({ ts: '2026-06-16T00:00:00Z', rawTokens: 2000, finalTokens: 200, reductionPct: 90 });
  assert.strictEqual(r.baseline, 2000);
  assert.strictEqual(r.actual, 200);
  assert.strictEqual(r.saved, 1800);
  assert.strictEqual(r.op, 'generate'); // default when op missing
});

test('normalize: savedPct clamps to 0..100', () => {
  assert.strictEqual(normalize({ baselineTokens: 100, actualTokens: 0, savedPct: 150 }).savedPct, 100);
  assert.strictEqual(normalize({ baselineTokens: 0, actualTokens: 0, savedPct: -5 }).savedPct, 0);
});

// ── aggregate: totals + byOp ───────────────────────────────────────────────
const sample = [
  { ts: '2026-06-14T10:00:00Z', op: 'ask', baselineTokens: 10000, actualTokens: 1000 },
  { ts: '2026-06-15T10:00:00Z', op: 'ask', baselineTokens: 10000, actualTokens: 500 },
  { ts: '2026-06-15T11:00:00Z', op: 'mcp:get_map', baselineTokens: 20000, actualTokens: 1000 },
];

test('aggregate: totals sum correctly', () => {
  const a = aggregate(sample, { model: 'claude-sonnet' });
  assert.strictEqual(a.totals.count, 3);
  assert.strictEqual(a.totals.baseline, 40000);
  assert.strictEqual(a.totals.saved, 37500);
  assert.strictEqual(Math.round(a.totals.savedPct), 94);
});

test('aggregate: byOp sorted by saved desc + share sums ~100', () => {
  const a = aggregate(sample);
  assert.strictEqual(a.byOp[0].op, 'mcp:get_map'); // 19000 saved > 18500 ask
  const shareSum = a.byOp.reduce((s, o) => s + o.sharePct, 0);
  assert.ok(Math.abs(shareSum - 100) < 0.01, `share sum ${shareSum}`);
});

test('aggregate: usdSaved tracks the pricing model', () => {
  const sonnet = aggregate(sample, { model: 'claude-sonnet' }).totals.usdSaved;
  const opus = aggregate(sample, { model: 'claude-opus' }).totals.usdSaved;
  assert.ok(opus > sonnet, 'opus should cost more per token');
  assert.ok(Math.abs(sonnet - 37500 * 3 / 1e6) < 1e-9);
});

test('aggregate: top limits byOp rows', () => {
  const a = aggregate(sample, { top: 1 });
  assert.strictEqual(a.byOp.length, 1);
});

test('aggregate: empty log yields zeroed totals, no throw', () => {
  const a = aggregate([]);
  assert.strictEqual(a.totals.count, 0);
  assert.strictEqual(a.totals.savedPct, 0);
  assert.deepStrictEqual(a.byOp, []);
});

// ── buckets ────────────────────────────────────────────────────────────────
test('bucketBy: day groups by calendar day', () => {
  const b = bucketBy(sample.map(normalize), 'day');
  assert.strictEqual(b.length, 2);
  assert.strictEqual(b[0].key, '2026-06-14');
  assert.strictEqual(b[1].count, 2);
});

test('bucketBy: month groups by YYYY-MM', () => {
  const b = bucketBy(sample.map(normalize), 'month');
  assert.strictEqual(b.length, 1);
  assert.strictEqual(b[0].key, '2026-06');
});

// ── since ──────────────────────────────────────────────────────────────────
test('parseSince: relative + ISO', () => {
  const now = Date.parse('2026-06-16T00:00:00Z');
  assert.strictEqual(parseSince('7d', now).toISOString(), '2026-06-09T00:00:00.000Z');
  assert.strictEqual(parseSince(null, now), null);
  assert.ok(parseSince('2026-06-01', now) instanceof Date);
});

test('aggregate: --since filters records', () => {
  const now = Date.parse('2026-06-16T00:00:00Z');
  const a = aggregate(sample, { since: '1d', nowMs: now });
  assert.strictEqual(a.totals.count, 2); // only the two 06-15 records
});

// ── pricing ──────────────────────────────────────────────────────────────
test('resolvePrice: unknown model falls back to default', () => {
  assert.strictEqual(resolvePrice('not-a-model').model, 'claude-sonnet');
  assert.strictEqual(resolvePrice('gpt-4o').perMtok, 2.5);
});

// ── formatters ─────────────────────────────────────────────────────────────
test('humanTokens / fmtDuration / fmtUSD', () => {
  assert.strictEqual(gt.humanTokens(1500000), '1.5M');
  assert.strictEqual(gt.humanTokens(735), '735');
  assert.strictEqual(gt.fmtDuration(41), '41ms');
  assert.strictEqual(gt.fmtDuration(2500), '2.5s');
  assert.strictEqual(gt.fmtUSD(386.79), '$386.79');
});

// ── tracking gate (gain capture is default-on, opt-out only) ────────────────
test('isTrackingEnabled: default on, decoupled from config.tracking', () => {
  assert.strictEqual(isTrackingEnabled({}, []), true);
  assert.strictEqual(isTrackingEnabled({ tracking: false }, []), true); // legacy flag does NOT disable gain
  assert.strictEqual(isTrackingEnabled({ gainTracking: false }, []), false);
  assert.strictEqual(isTrackingEnabled({}, ['--no-track']), false);
});

test('recordUsage → readGainLog round-trips into gain.ndjson', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-gain-'));
  try {
    recordUsage({ op: 'ask', baselineTokens: 5000, actualTokens: 200, durationMs: 12, model: 'gpt-4o' }, dir);
    assert.ok(fs.existsSync(path.join(dir, '.context', 'gain.ndjson')), 'gain.ndjson written');
    const recs = readGainLog(dir);
    assert.strictEqual(recs.length, 1);
    assert.strictEqual(recs[0].op, 'ask');
    assert.strictEqual(recs[0].savedTokens, 4800);
    // privacy: record carries no file paths / source / query text
    const keys = Object.keys(recs[0]);
    assert.ok(!keys.some((k) => /path|file|query|source/i.test(k)), 'no leaky fields');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── real CLI capture: generate run feeds `sigmap gain` ──────────────────────
test('CLI: a real generate run is captured and surfaced by `gain --json`', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-gain-proj-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'a.js'),
      'function alpha(x){return x+1;}\nclass Beta{ go(){return 2;} }\nmodule.exports={alpha,Beta};\n');
    execFileSync(process.execPath, [GEN_CONTEXT], { cwd: dir, stdio: 'ignore' });
    const out = execFileSync(process.execPath, [GEN_CONTEXT, 'gain', '--json'], { cwd: dir, encoding: 'utf8' });
    const agg = JSON.parse(out);
    assert.ok(agg.totals.count >= 1, 'at least one captured op');
    assert.ok(agg.byOp.some((o) => o.op === 'generate'), 'generate op present');
    assert.ok(agg.totals.saved >= 0, 'saved is non-negative');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: --no-track suppresses gain capture', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-gain-off-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function a(){return 1;}\nmodule.exports={a};\n');
    execFileSync(process.execPath, [GEN_CONTEXT, '--no-track'], { cwd: dir, stdio: 'ignore' });
    assert.ok(!fs.existsSync(path.join(dir, '.context', 'gain.ndjson')), 'no gain log when --no-track');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\ngain: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
