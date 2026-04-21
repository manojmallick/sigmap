'use strict';

/**
 * Integration tests for v5.0 features:
 *  1.  judge engine — grounded response scores ≥ 0.25
 *  2.  judge engine — unrelated response scores 0
 *  3.  judge engine — verdict:pass on grounded response
 *  4.  judge engine — verdict:fail on unrelated response
 *  5.  sigmap judge --response --context --json → valid JSON with score/verdict/reasons
 *  6.  sigmap judge --response --context → exits 0 (grounded)
 *  7.  sigmap judge --response --context --threshold 0.99 → exits 1 (ungrounded at high threshold)
 *  8.  sigmap judge missing args → exits 1
 *  9.  config extends local file — maxTokens overridden from base
 * 10.  config extends local file — user value overrides base
 * 11.  sigmap history --json → valid JSON array
 * 12.  sigmap history → exits 0 (even with no log entries)
 */

const assert = require('assert');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const { spawnSync } = require('child_process');

const ROOT   = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

console.log('[v500-features.test.js] v5.0 judge engine, config extends, history sparklines');
console.log('');

// ── Unit tests for judge engine ──────────────────────────────────────────────

const { groundedness, judge } = require('../../../src/judge/judge-engine');

// 1. grounded response scores ≥ 0.25
test('judge: grounded response scores ≥ 0.25', () => {
  const response = 'The rank function sorts files by relevance score using token overlap.';
  const context  = 'function rank(query, sigIndex) sorts results by score using tokenized query tokens';
  const score = groundedness(response, context);
  assert.ok(score >= 0.25, `expected score >= 0.25, got ${score}`);
});

// 2. unrelated response scores 0 (or very low)
test('judge: unrelated response scores ≤ 0.1', () => {
  const response = 'The weather in Paris today is sunny and warm.';
  const context  = 'function rank(query, sigIndex) { return sorted; } function buildSigIndex(cwd)';
  const score = groundedness(response, context);
  assert.ok(score <= 0.1, `expected score <= 0.1, got ${score}`);
});

// 3. verdict:pass on grounded
test('judge: verdict:pass on grounded response', () => {
  const response = 'The rank function sorts files by relevance score and token overlap.';
  const context  = 'function rank(query, sigIndex) sorts results by relevance score using tokens';
  const { verdict } = judge(response, context, { threshold: 0.25 });
  assert.strictEqual(verdict, 'pass', `expected pass, got ${verdict}`);
});

// 4. verdict:fail on unrelated response
test('judge: verdict:fail on unrelated response', () => {
  const response = 'The weather in Paris today is sunny and warm.';
  const context  = 'function rank(query, sigIndex) { return sorted; } function buildSigIndex(cwd)';
  const { verdict } = judge(response, context, { threshold: 0.25 });
  assert.strictEqual(verdict, 'fail', `expected fail, got ${verdict}`);
});

// ── CLI tests ─────────────────────────────────────────────────────────────────

// Create temp files for CLI tests
const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-judge-'));
const respFile = path.join(tmpDir, 'response.txt');
const ctxFile  = path.join(tmpDir, 'context.txt');
const unrelFile = path.join(tmpDir, 'unrelated.txt');

fs.writeFileSync(respFile,  'The rank function sorts files by relevance score and token overlap.');
fs.writeFileSync(ctxFile,   'function rank(query, sigIndex) sorts results by relevance score using tokens');
fs.writeFileSync(unrelFile, 'The weather in Paris today is sunny and warm.');

// 5. sigmap judge --json → valid JSON
test('sigmap judge --json → valid JSON with score/verdict/reasons', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'judge', '--response', respFile, '--context', ctxFile, '--json'], {
    encoding: 'utf8', cwd: ROOT, timeout: 15000,
  });
  let parsed;
  try { parsed = JSON.parse(r.stdout.trim()); }
  catch (e) { throw new Error(`invalid JSON: ${r.stdout.slice(0, 200)}`); }
  assert.ok('score'   in parsed, 'missing score');
  assert.ok('verdict' in parsed, 'missing verdict');
  assert.ok('reasons' in parsed, 'missing reasons');
  assert.ok(Array.isArray(parsed.reasons), 'reasons not array');
  assert.strictEqual(typeof parsed.score, 'number', 'score not a number');
});

// 6. sigmap judge → exits 0 (grounded)
test('sigmap judge → exits 0 on grounded response', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'judge', '--response', respFile, '--context', ctxFile], {
    encoding: 'utf8', cwd: ROOT, timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `expected exit 0, got ${r.status}\n${r.stderr}`);
});

// 7. sigmap judge --threshold 0.99 → exits 1
test('sigmap judge --threshold 0.99 → exits 1 on high threshold', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'judge', '--response', unrelFile, '--context', ctxFile, '--threshold', '0.99', '--json'], {
    encoding: 'utf8', cwd: ROOT, timeout: 15000,
  });
  assert.strictEqual(r.status, 1, `expected exit 1, got ${r.status}`);
  const parsed = JSON.parse(r.stdout.trim());
  assert.strictEqual(parsed.verdict, 'fail', `expected fail, got ${parsed.verdict}`);
});

// 8. sigmap judge missing args → exits 1
test('sigmap judge missing --response → exits 1', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'judge', '--context', ctxFile], {
    encoding: 'utf8', cwd: ROOT, timeout: 15000,
  });
  assert.strictEqual(r.status, 1, `expected exit 1, got ${r.status}`);
});

// ── config extends tests ──────────────────────────────────────────────────────

const { loadConfig } = require('../../../src/config/loader');
const extendsTmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-ext-'));

// 9. extends local file — maxTokens from base
test('config extends: maxTokens overridden from base config', () => {
  const basePath = path.join(extendsTmpDir, 'base.json');
  fs.writeFileSync(basePath, JSON.stringify({ maxTokens: 9999 }));
  fs.writeFileSync(path.join(extendsTmpDir, 'gen-context.config.json'),
    JSON.stringify({ extends: basePath }));
  const cfg = loadConfig(extendsTmpDir);
  assert.strictEqual(cfg.maxTokens, 9999, `expected 9999, got ${cfg.maxTokens}`);
});

// 10. user config overrides base
test('config extends: user value overrides base config', () => {
  const basePath = path.join(extendsTmpDir, 'base2.json');
  fs.writeFileSync(basePath, JSON.stringify({ maxTokens: 9999 }));
  fs.writeFileSync(path.join(extendsTmpDir, 'gen-context.config.json'),
    JSON.stringify({ extends: basePath, maxTokens: 1234 }));
  const cfg = loadConfig(extendsTmpDir);
  assert.strictEqual(cfg.maxTokens, 1234, `expected 1234 (user override), got ${cfg.maxTokens}`);
});

// ── sigmap history tests ──────────────────────────────────────────────────────

// 11. sigmap history --json → valid JSON array
test('sigmap history --json → valid JSON array', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'history', '--json'], {
    encoding: 'utf8', cwd: ROOT, timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `exit ${r.status}\n${r.stderr}`);
  let parsed;
  try { parsed = JSON.parse(r.stdout.trim()); }
  catch (e) { throw new Error(`invalid JSON: ${r.stdout.slice(0, 200)}`); }
  assert.ok(Array.isArray(parsed), 'expected JSON array');
});

// 12. sigmap history → exits 0
test('sigmap history → exits 0', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'history'], {
    encoding: 'utf8', cwd: ROOT, timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `exit ${r.status}\n${r.stderr}`);
});

// Cleanup
try {
  fs.rmSync(tmpDir, { recursive: true });
  fs.rmSync(extendsTmpDir, { recursive: true });
} catch (_) {}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
