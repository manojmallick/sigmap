'use strict';

/**
 * Integration tests for `sigmap conventions --ci` (Layer 3 — CI gate).
 *   ciGate: min threshold / regression / reasons · CLI exit codes
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { ciGate, DEFAULT_MIN } = require(path.join(ROOT, 'src/conventions/ci'));
const { snapshot } = require(path.join(ROOT, 'src/conventions/report'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

// conventions result with a given file-naming consistency (export style fixed at 100%).
const result = (fnPct) => ({
  fileNaming: { dominant: 'camelCase', dominantPct: fnPct, total: 10, tier: 'x', variants: [] },
  exportStyle: { dominant: 'named', dominantPct: 1, total: 10, tier: 'consistent', variants: [] },
  testFramework: 'jest',
});

// ── ciGate ──────────────────────────────────────────────────────────────────
test('passes when score >= default min', () => {
  // fileNaming 0.8 + export 1.0 weighted → 0.9 ≥ 0.70
  const g = ciGate(result(0.8));
  assert.strictEqual(g.ok, true);
  assert.strictEqual(g.min, DEFAULT_MIN);
  assert.strictEqual(g.reasons.length, 0);
});
test('fails when score < min, with a reason', () => {
  const g = ciGate(result(0.8), { min: 0.95 }); // 0.9 < 0.95
  assert.strictEqual(g.ok, false);
  assert.ok(g.reasons.some((r) => /below min/.test(r)));
});
test('--min override is honored', () => {
  const g = ciGate(result(0.2), { min: 0.5 }); // weighted (0.2*10+1*10)/20 = 0.6 ≥ 0.5
  assert.strictEqual(g.ok, true);
});
test('no-regress: fails when score dropped vs prior', () => {
  const prior = snapshot(result(0.9), '2026-01-01T00:00:00Z'); // score 0.95
  const g = ciGate(result(0.7), { min: 0.5, noRegress: true }, prior); // score 0.85 < 0.95
  assert.strictEqual(g.regressed, true);
  assert.strictEqual(g.ok, false);
  assert.ok(g.reasons.some((r) => /dropped/.test(r)));
});
test('no-regress: passes when no prior (best-effort)', () => {
  const g = ciGate(result(0.8), { min: 0.5, noRegress: true }, null);
  assert.strictEqual(g.ok, true);
  assert.strictEqual(g.regressed, false);
});
test('no-regress: passes when score improved', () => {
  const prior = snapshot(result(0.6), '2026-01-01T00:00:00Z'); // score 0.8
  const g = ciGate(result(0.9), { min: 0.5, noRegress: true }, prior); // score 0.95 > 0.8
  assert.strictEqual(g.regressed, false);
  assert.strictEqual(g.ok, true);
});

// ── CLI ─────────────────────────────────────────────────────────────────────
function withRepo(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-ci-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'src', f), c);
    fn(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('CLI: consistent repo passes (exit 0)', () => {
  withRepo({ 'fooBar.js': 'export const a=1;\n', 'bazQux.js': 'export const b=2;\n' }, (dir) => {
    const res = spawnSync('node', [SCRIPT, 'conventions', '--ci'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    assert.ok(/PASS/.test(res.stdout));
  });
});
test('CLI: --min 0.99 fails a mixed repo (exit 1)', () => {
  withRepo({ 'fooBar.js': 'export const a=1;\n', 'new-thing.js': 'export const b=2;\n' }, (dir) => {
    const res = spawnSync('node', [SCRIPT, 'conventions', '--ci', '--min', '0.99'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1);
    assert.ok(/FAIL/.test(res.stdout));
  });
});
test('CLI: --ci --json emits the gate result', () => {
  withRepo({ 'aaa.js': 'export const a=1;\n' }, (dir) => {
    const res = spawnSync('node', [SCRIPT, 'conventions', '--ci', '--json'], { cwd: dir, encoding: 'utf8' });
    const data = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.strictEqual(typeof data.ok, 'boolean');
    assert.strictEqual(typeof data.score, 'number');
  });
});
test('CLI: --ci does not write a history snapshot (read-only)', () => {
  withRepo({ 'aaa.js': 'export const a=1;\n' }, (dir) => {
    spawnSync('node', [SCRIPT, 'conventions', '--ci'], { cwd: dir, encoding: 'utf8' });
    assert.ok(!fs.existsSync(path.join(dir, '.context', 'conventions-history.ndjson')), 'ci is read-only');
  });
});

console.log(`\nconventions-ci: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
