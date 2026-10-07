'use strict';

/**
 * Unit tests for the `gain` dashboard data layer (aggregate + pricing).
 * Zero-dependency, plain Node assertions. Run: node test/integration/gain.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { aggregate, bucketBy, parseSince, normalize } = require('../../src/tracking/aggregate');
const { resolvePrice } = require('../../src/tracking/pricing');
const { recordUsage, readGainLog, isTrackingEnabled } = require('../../src/tracking/logger');
const gt = require('../../src/format/gain-terminal');

const GEN_CONTEXT = path.resolve(__dirname, '../../gen-context.js');
const ROOT = path.resolve(__dirname, '..', '..');

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
  assert.ok(Math.abs(sonnet - 37500 * resolvePrice('claude-sonnet').perMtok / 1e6) < 1e-9);
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
test('resolvePrice: unknown model falls back to default, flagged', () => {
  const fb = resolvePrice('not-a-model');
  // The default key is an alias; the price reports the model it stands for.
  assert.strictEqual(fb.model, 'claude-sonnet-5-5');
  assert.strictEqual(fb.perMtok, 2);
  assert.strictEqual(fb.fallback, true);
  assert.strictEqual(fb.requested, 'not-a-model');
  const ok = resolvePrice('gpt-4o');
  assert.strictEqual(ok.perMtok, 2.5);
  assert.strictEqual(ok.fallback, false);
  assert.strictEqual(ok.requested, 'gpt-4o');
  // default path (no explicit model) is not a fallback
  assert.strictEqual(resolvePrice().fallback, false);
  assert.strictEqual(resolvePrice('').fallback, false);
});

test('resolvePrice: casing/whitespace are normalised, not flagged', () => {
  assert.strictEqual(resolvePrice(' GPT-4O ').model, 'gpt-4o');
  assert.strictEqual(resolvePrice(' GPT-4O ').fallback, false);
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

/** A project with a seeded gain log, so `gain` has something to price whatever ran before this test. */
function withSeededProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-gain-seed-'));
  try {
    recordUsage({ op: 'ask', baselineTokens: 5000, actualTokens: 200, durationMs: 12 }, dir);
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── #665: unknown --model must be visible, not silent ─────────────────────
// Seeded rather than run against the repo itself: the price line is only printed
// once a log exists, and the repo's own log is whatever earlier tests left behind
// (#918 — the test passed in the full suite and failed run on its own).
test('CLI: gain --model <typo> prints a stderr notice, keeps exit 0', () => {
  withSeededProject((dir) => {
    const r = spawnSync(process.execPath, [GEN_CONTEXT, 'gain', '--model', 'gpt4o'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(r.status, 0);
    assert.match(r.stderr, /unknown model 'gpt4o' — priced as claude-sonnet-5-5 \(\$2\/MTok\); see: sigmap gain --models/);
    // fallback pricing still applied — header shows the default model
    assert.match(r.stdout, /claude-sonnet-5-5 input @ \$2\/M as of \d{4}-\d{2}-\d{2}/);
  });
});

// ── #816: the figures say they are estimates, in the JSON too ──────────────
test('aggregate: carries a costBasis statement that says estimate and not billed', () => {
  const a = aggregate(sample, { model: 'claude-sonnet' });
  assert.match(a.costBasis, /^estimate/);
  assert.match(a.costBasis, /not billed usage/);
  assert.match(a.costBasis, /counterfactual/);
});

test('aggregate: costBasis is present on an empty log too', () => {
  assert.match(aggregate([], {}).costBasis, /^estimate/);
});

test('CLI: gain --json states the estimate beside the numbers it describes', () => {
  withSeededProject((dir) => {
    const r = spawnSync(process.execPath, [GEN_CONTEXT, 'gain', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    const agg = JSON.parse(r.stdout);
    assert.match(agg.costBasis, /^estimate/);
    assert.ok(agg.totals.count === 1 && agg.price.asOf, 'the figures and their price date are still there');
  });
});

test('CLI: gain (terminal) names the price date and calls the dollars an estimate', () => {
  withSeededProject((dir) => {
    const r = spawnSync(process.execPath, [GEN_CONTEXT, 'gain'], { cwd: dir, encoding: 'utf8' });
    assert.match(r.stdout, /Est\. money saved/);
    assert.match(r.stdout, /input @ \$[\d.]+\/M as of \d{4}-\d{2}-\d{2}/);
    assert.match(r.stdout, /estimated vs whole-file reads/);
  });
});

test('CLI: gain --model <valid> prints no notice', () => {
  const r = spawnSync(process.execPath, [GEN_CONTEXT, 'gain', '--model', 'gpt-4o'], { cwd: ROOT, encoding: 'utf8' });  assert.strictEqual(r.status, 0);
  assert.ok(!/unknown model/.test(r.stderr), `unexpected notice: ${r.stderr}`);
});

test('CLI: gain --models lists known pricing models', () => {
  const r = spawnSync(process.execPath, [GEN_CONTEXT, 'gain', '--models'], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  for (const m of ['claude-sonnet', 'gpt-4o', 'gemini-3.8-flash']) {
    assert.ok(r.stdout.includes(m), `missing ${m} in --models output`);
  }
});

console.log(`\ngain: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
