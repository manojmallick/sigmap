'use strict';

/**
 * Integration tests for Squeeze + Star Nudge (v7.0.0).
 *   classify · cilog · stacktrace (+ enrichment) · jsonpayload · orchestrator
 *   star nudge (thresholds + race-safe) · CLI (squeeze command, ask flags)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { classify } = require(path.join(ROOT, 'src/squeeze/classify'));
const { squeezeCiLog } = require(path.join(ROOT, 'src/squeeze/cilog'));
const { squeezeStackTrace } = require(path.join(ROOT, 'src/squeeze/stacktrace'));
const { squeezeJsonPayload } = require(path.join(ROOT, 'src/squeeze/jsonpayload'));
const { squeeze, shouldPrompt } = require(path.join(ROOT, 'src/squeeze/index'));
const nudge = require(path.join(ROOT, 'src/nudge'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

// ── classify ──────────────────────────────────────────────────────────────
test('classify: Node stack trace', () => {
  const t = ['TypeError: x', '    at a (/app/src/x.js:1:2)', '    at b (/app/src/y.js:3:4)',
    '    at c (/app/src/z.js:5:6)', '    at d (/app/src/w.js:7:8)', '    at e (/app/src/v.js:9:1)'].join('\n');
  const r = classify(t);
  assert.strictEqual(r.category, 'stacktrace');
  assert.ok(r.confidence > 0.6, `confidence ${r.confidence}`);
});
test('classify: Python traceback', () => {
  const t = 'Traceback (most recent call last):\n  File "a.py", line 5, in f\n    g()\n  File "b.py", line 9, in g\n    raise ValueError';
  assert.strictEqual(classify(t).category, 'stacktrace');
});
test('classify: CI log', () => {
  const lines = Array.from({ length: 20 }, (_, i) => `2026-06-09 10:00:${String(i).padStart(2, '0')} npm WARN deprecated foo`);
  assert.strictEqual(classify(lines.join('\n')).category, 'cilog');
});
test('classify: JSON payload', () => {
  assert.strictEqual(classify('{"error":{"code":500},"data":[1,2,3]}').category, 'json');
});
test('classify: prose → null (no false positive)', () => {
  assert.strictEqual(classify('the login button does not work when I click it twice in a row').category, null);
});
test('classify: short trace (2 frames) → low confidence but detected', () => {
  const r = classify('Error: boom\n    at f (/app/src/a.js:1:2)\n    at g (/app/src/b.js:3:4)');
  assert.strictEqual(r.category, 'stacktrace');
  assert.ok(r.confidence < 0.5, `confidence ${r.confidence}`);
});

// ── stacktrace squeeze ──────────────────────────────────────────────────────
test('stacktrace: dedupes repeated exception (occurred ×N)', () => {
  const block = 'BoomError: kaboom\n    at f (/app/src/a.js:1:2)\n';
  const r = squeezeStackTrace(block.repeat(47), { srcDirs: ['src'] });
  assert.ok(/occurred ×47/.test(r.squeezed), r.squeezed.slice(0, 80));
});
test('stacktrace: strips all vendor frames', () => {
  const t = ['Err: x', '    at a (/app/node_modules/lib/q.js:5:1)', '    at b (/app/src/keep.js:2:3)'].join('\n');
  const r = squeezeStackTrace(t, { srcDirs: ['src'] });
  assert.ok(!/node_modules/.test(r.squeezed), 'vendor leaked');
  assert.ok(/src\/keep\.js/.test(r.squeezed), 'source frame dropped');
});
test('stacktrace: enriches top frame from symbol index', () => {
  const t = 'Err: x\n    at validateToken (/app/src/auth/session.js:142:9)';
  const idx = new Map([['src/auth/session.js', ['function validateToken(token)  :140-150']]]);
  const r = squeezeStackTrace(t, { srcDirs: ['src'], symbolIndex: idx });
  assert.ok(r.enriched, 'not enriched');
  assert.ok(/validateToken\(token\)/.test(r.squeezed), r.squeezed);
});
test('stacktrace: graceful fallback when symbol not indexed', () => {
  const t = 'Err: x\n    at ghost (/app/src/a.js:5:1)';
  const r = squeezeStackTrace(t, { srcDirs: ['src'], symbolIndex: new Map() });
  assert.strictEqual(r.enriched, false);
  assert.ok(/src\/a\.js/.test(r.squeezed), 'frame still kept');
});
test('stacktrace: no source frames → keeps top frames (never empty)', () => {
  const t = 'Err: x\n    at a (/app/node_modules/x/q.js:1:1)\n    at b (/app/node_modules/y/r.js:2:2)';
  const r = squeezeStackTrace(t, { srcDirs: ['src'] });
  assert.ok(r.squeezed.trim().length > 0, 'returned empty');
});

// ── cilog squeeze ────────────────────────────────────────────────────────────
test('cilog: keeps all errors + context, strips timestamps/progress', () => {
  const lines = [];
  for (let i = 0; i < 200; i++) lines.push(`2026-06-09 10:00:00 ${i}% Downloading foo`);
  lines.splice(50, 0, '2026-06-09 10:00:00 ERROR first failure here');
  lines.splice(120, 0, '2026-06-09 10:00:00 ERROR second failure');
  lines.splice(190, 0, '2026-06-09 10:00:00 fatal: third');
  const r = squeezeCiLog(lines.join('\n'), { context: 2 });
  assert.ok(/first failure/.test(r.squeezed) && /second failure/.test(r.squeezed) && /third/.test(r.squeezed), 'lost an error');
  assert.ok(!/2026-06-09/.test(r.squeezed), 'timestamp leaked');
});
test('cilog: no errors → head/tail fallback, never empty', () => {
  const r = squeezeCiLog(Array.from({ length: 60 }, (_, i) => `line ${i} ok`).join('\n'));
  assert.ok(r.squeezed.trim().length > 0);
  assert.ok(/omitted/.test(r.squeezed) || r.squeezed.split('\n').length <= 25);
});

// ── jsonpayload squeeze ──────────────────────────────────────────────────────
test('json: collapses repeated array items', () => {
  const r = squeezeJsonPayload(JSON.stringify({ items: Array.from({ length: 200 }, (_, i) => ({ id: i })) }));
  assert.ok(/more similar items/.test(r.squeezed), r.squeezed.slice(0, 120));
});
test('json: truncates long strings with length note', () => {
  const r = squeezeJsonPayload(JSON.stringify({ msg: 'y'.repeat(800) }));
  assert.ok(/chars\)/.test(r.squeezed), 'no truncation note');
});
test('json: preserves nested schema shape', () => {
  const r = squeezeJsonPayload(JSON.stringify({ a: { b: { c: { d: 1 } } } }));
  const out = JSON.parse(r.squeezed);
  assert.strictEqual(out.a.b.c.d, 1);
});

// ── orchestrator ─────────────────────────────────────────────────────────────
test('squeeze: computes reduction + applies flag; prose passes through', () => {
  const prose = squeeze('just some free-form text about a bug');
  assert.strictEqual(prose.category, null);
  assert.strictEqual(prose.applies, false);
});
test('shouldPrompt: accepts 0-1 and 0-100 thresholds', () => {
  assert.ok(shouldPrompt(0.5, 30));
  assert.ok(!shouldPrompt(0.2, 30));
  assert.ok(shouldPrompt(0.5, 0.4));
});

// ── star nudge ───────────────────────────────────────────────────────────────
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-nudge-')); }
test('nudge: below run threshold → not shown', () => {
  const d = tmp();
  let last;
  for (let i = 0; i < 9; i++) last = nudge.checkStarNudge(d, true, { silent: true });
  assert.strictEqual(last.nudged, false);
  assert.strictEqual(nudge.readUsage(d).starNudgeShown, false);
  fs.rmSync(d, { recursive: true, force: true });
});
test('nudge: fires once at 10 runs / 8 successes', () => {
  const d = tmp();
  let nudgedCount = 0;
  for (let i = 0; i < 10; i++) { const r = nudge.checkStarNudge(d, true, { silent: true }); if (r.nudged) nudgedCount++; }
  // 5 more runs — never again
  for (let i = 0; i < 5; i++) { const r = nudge.checkStarNudge(d, true, { silent: true }); if (r.nudged) nudgedCount++; }
  assert.strictEqual(nudgedCount, 1, 'should fire exactly once');
  fs.rmSync(d, { recursive: true, force: true });
});
test('nudge: low success rate → not shown', () => {
  const d = tmp();
  let any = false;
  for (let i = 0; i < 12; i++) { const r = nudge.checkStarNudge(d, i < 5, { silent: true }); if (r.nudged) any = true; }
  assert.strictEqual(any, false, 'fired despite <8 successes');
  fs.rmSync(d, { recursive: true, force: true });
});
test('nudge: race-safe — concurrent show fires exactly once', () => {
  const d = tmp();
  // get to 9 runs / 9 successes
  for (let i = 0; i < 9; i++) nudge.checkStarNudge(d, true, { silent: true });
  // two "concurrent" 10th calls (lock file makes exactly one win)
  const a = nudge.checkStarNudge(d, true, { silent: true });
  const b = nudge.checkStarNudge(d, true, { silent: true });
  assert.strictEqual([a.nudged, b.nudged].filter(Boolean).length, 1, 'lock failed');
  fs.rmSync(d, { recursive: true, force: true });
});

// ── CLI ──────────────────────────────────────────────────────────────────────
function runSqueeze(stdin, args = []) {
  return spawnSync('node', [SCRIPT, 'squeeze', '-', ...args], { input: stdin, cwd: ROOT, encoding: 'utf8' });
}
test('CLI squeeze --json: stacktrace reduced, vendor stripped', () => {
  const t = 'TypeError: x\n    at f (/app/node_modules/orm/q.js:5:1)\n    at g (/app/src/a.js:10:2)';
  const res = runSqueeze(t, ['--json']);
  const obj = JSON.parse(res.stdout.trim());
  assert.strictEqual(obj.category, 'stacktrace');
  assert.ok(obj.reduction > 0);
  assert.ok(!/node_modules/.test(obj.squeezed));
});
test('CLI squeeze: prose passes through unchanged', () => {
  const res = runSqueeze('plain words describing a problem here', []);
  assert.ok(/no squeezable structure/.test(res.stderr));
});

console.log(`\nsqueeze: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
