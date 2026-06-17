'use strict';

/**
 * Integration tests for `sigmap conventions --report` (Layer 3 — audit + trend).
 *   overallScore · scoreReport (delta vs prior) · snapshot · CLI (trend + history)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { scoreReport, snapshot, overallScore } = require(path.join(ROOT, 'src/conventions/report'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

function withRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-rep-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const result = (fnPct, fnTotal) => ({
  fileNaming: { dominant: 'camelCase', dominantPct: fnPct, total: fnTotal, tier: fnPct >= 0.9 ? 'consistent' : fnPct >= 0.7 ? 'mostly' : 'inconsistent', variants: [] },
  exportStyle: { dominant: 'named', dominantPct: 1, total: 10, tier: 'consistent', variants: [] },
  testFramework: 'jest',
});

// ── overallScore ────────────────────────────────────────────────────────────
test('overallScore: file-count-weighted mean', () => {
  // fileNaming 0.8 over 10, exportStyle 1.0 over 10 → (8 + 10)/20 = 0.9
  const s = overallScore(result(0.8, 10));
  assert.ok(Math.abs(s - 0.9) < 1e-9, `got ${s}`);
});
test('overallScore: 0 when no samples', () => {
  assert.strictEqual(overallScore({ fileNaming: { total: 0 }, exportStyle: { total: 0 } }), 0);
});

// ── scoreReport ─────────────────────────────────────────────────────────────
test('scoreReport: no prior → deltas null', () => {
  const r = scoreReport(result(0.8, 10), null);
  assert.strictEqual(r.scoreDelta, null);
  assert.strictEqual(r.prevScore, null);
  assert.ok(r.conventions.every((c) => c.delta === null));
});
test('scoreReport: delta vs prior snapshot', () => {
  const prior = snapshot(result(0.6, 10), '2026-01-01T00:00:00Z'); // score 0.8
  const r = scoreReport(result(0.8, 10), prior); // score 0.9
  assert.ok(Math.abs(r.scoreDelta - 0.1) < 1e-9, `scoreDelta ${r.scoreDelta}`);
  const fn = r.conventions.find((c) => c.key === 'fileNaming');
  assert.ok(Math.abs(fn.delta - 0.2) < 1e-9, `fileNaming delta ${fn.delta}`);
});
test('scoreReport: per-convention audit shape', () => {
  const r = scoreReport(result(0.95, 10), null);
  const fn = r.conventions.find((c) => c.key === 'fileNaming');
  assert.strictEqual(fn.dominant, 'camelCase');
  assert.strictEqual(fn.tier, 'consistent');
  assert.strictEqual(r.testFramework, 'jest');
});

// ── snapshot ────────────────────────────────────────────────────────────────
test('snapshot: compact persistable shape with score + ts', () => {
  const s = snapshot(result(0.8, 10), '2026-06-17T00:00:00Z');
  assert.strictEqual(s.ts, '2026-06-17T00:00:00Z');
  assert.strictEqual(s.fileNaming.dominant, 'camelCase');
  assert.ok(typeof s.score === 'number');
});

// ── CLI ─────────────────────────────────────────────────────────────────────
test('CLI: --report prints score + audit on first run', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'bazQux.js'), 'export const b = 2;\n');
    const res = spawnSync('node', [SCRIPT, 'conventions', '--report'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(/overall consistency/.test(res.stdout));
    assert.ok(/first run/.test(res.stdout));
    assert.ok(fs.existsSync(path.join(dir, '.context', 'conventions-history.ndjson')), 'writes history');
  });
});
test('CLI: --report shows a trend on the second run', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'bazQux.js'), 'export const b = 2;\n');
    const run = () => spawnSync('node', [SCRIPT, 'conventions', '--report'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(run().status, 0);
    // introduce drift
    fs.writeFileSync(path.join(dir, 'src', 'new-thing.js'), 'export const c = 3;\n');
    const res = run();
    assert.strictEqual(res.status, 0);
    assert.ok(/▼/.test(res.stdout), `expected a downward trend arrow:\n${res.stdout}`);
    const hist = fs.readFileSync(path.join(dir, '.context', 'conventions-history.ndjson'), 'utf8').split('\n').filter(Boolean);
    assert.strictEqual(hist.length, 2, 'two history entries');
  });
});
test('CLI: --report --json emits the structured report', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'aaa.js'), 'export const a = 1;\n');
    const res = spawnSync('node', [SCRIPT, 'conventions', '--report', '--json'], { cwd: dir, encoding: 'utf8' });
    const data = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.ok(typeof data.score === 'number');
    assert.ok(Array.isArray(data.conventions));
  });
});

console.log(`\nconventions-report: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
