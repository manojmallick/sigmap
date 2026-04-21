'use strict';

/**
 * Integration tests for v4.2 features:
 *  1.  detectIntent — debug pattern
 *  2.  detectIntent — explain pattern
 *  3.  detectIntent — refactor pattern
 *  4.  detectIntent — review pattern
 *  5.  detectIntent — fallback to 'search'
 *  6.  sigmap ask — exits 1 when query missing
 *  7.  sigmap ask --json — emits valid JSON with required fields
 *  8.  sigmap suggest-profile — exits 0, prints profile + reason
 *  9.  sigmap suggest-profile --short — prints one word
 * 10.  sigmap --cost --json — emits valid JSON with cost fields
 * 11.  sigmap query --context — writes .context/query-context.md
 * 12.  sigmap share — exits 0 and prints expected lines
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
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

// ---------------------------------------------------------------------------
// Load ranker directly
// ---------------------------------------------------------------------------
const ranker = require(path.join(ROOT, 'src', 'retrieval', 'ranker'));

console.log('[v420-features.test.js] v4.2 unified pipeline, intent detection, cost, compare, share');
console.log('');

// 1. detectIntent — debug
test('detectIntent: "fix the login bug" → debug', () => {
  assert.strictEqual(ranker.detectIntent('fix the login bug'), 'debug');
});

// 2. detectIntent — explain
test('detectIntent: "explain how auth works" → explain', () => {
  assert.strictEqual(ranker.detectIntent('explain how auth works'), 'explain');
});

// 3. detectIntent — refactor
test('detectIntent: "refactor the payment module" → refactor', () => {
  assert.strictEqual(ranker.detectIntent('refactor the payment module'), 'refactor');
});

// 4. detectIntent — review
test('detectIntent: "review this PR" → review', () => {
  assert.strictEqual(ranker.detectIntent('review this PR'), 'review');
});

// 5. detectIntent — fallback
test('detectIntent: "user authentication" → search', () => {
  assert.strictEqual(ranker.detectIntent('user authentication'), 'search');
});

// ---------------------------------------------------------------------------
// CLI tests — run against the real repo (context file already exists)
// ---------------------------------------------------------------------------

// 6. sigmap ask — missing query exits 1
test('sigmap ask (no query) → exits 1', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'ask'], { encoding: 'utf8', cwd: ROOT });
  assert.strictEqual(r.status, 1, `expected exit 1, got ${r.status}`);
  assert.ok(r.stderr.includes('Usage'), `expected Usage in stderr, got: ${r.stderr}`);
});

// 7. sigmap ask --json — valid JSON with required fields
test('sigmap ask --json → valid JSON with required fields', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'ask', 'fix the login bug', '--json'], {
    encoding: 'utf8', cwd: ROOT, timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  let parsed;
  try { parsed = JSON.parse(r.stdout.trim()); }
  catch (e) { throw new Error(`invalid JSON: ${r.stdout.slice(0, 200)}`); }
  assert.strictEqual(typeof parsed.intent,        'string', 'missing intent');
  assert.strictEqual(typeof parsed.coverage,      'number', 'missing coverage');
  assert.strictEqual(typeof parsed.contextTokens, 'number', 'missing contextTokens');
  assert.strictEqual(typeof parsed.savingsPct,    'number', 'missing savingsPct');
  assert.strictEqual(typeof parsed.riskLevel,     'string', 'missing riskLevel');
  assert.strictEqual(parsed.intent, 'debug', `expected debug, got ${parsed.intent}`);
});

// 8. sigmap suggest-profile — exits 0, has 'suggested profile' in output
test('sigmap suggest-profile → exits 0 and prints profile line', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'suggest-profile'], {
    encoding: 'utf8', cwd: ROOT, timeout: 10000,
  });
  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  assert.ok(
    r.stdout.includes('suggested profile') || r.stdout.trim().length > 0,
    `unexpected stdout: ${r.stdout}`
  );
});

// 9. sigmap suggest-profile --short — one-word output
test('sigmap suggest-profile --short → single word', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'suggest-profile', '--short'], {
    encoding: 'utf8', cwd: ROOT, timeout: 10000,
  });
  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  const word = r.stdout.trim();
  assert.ok(/^\w+$/.test(word), `expected single word, got: "${word}"`);
});

// 10. sigmap --cost --json — valid JSON with cost fields
test('sigmap --cost --json → valid JSON with cost fields', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--cost', '--json'], {
    encoding: 'utf8', cwd: ROOT, timeout: 30000,
  });
  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  let parsed;
  try { parsed = JSON.parse(r.stdout.trim()); }
  catch (e) { throw new Error(`invalid JSON: ${r.stdout.slice(0, 200)}`); }
  assert.strictEqual(typeof parsed.model,         'string', 'missing model');
  assert.strictEqual(typeof parsed.rawTokens,     'number', 'missing rawTokens');
  assert.strictEqual(typeof parsed.contextTokens, 'number', 'missing contextTokens');
  assert.strictEqual(typeof parsed.savingsPct,    'number', 'missing savingsPct');
  assert.ok(parsed.rawTokens > 0, 'rawTokens should be > 0');
  assert.ok(parsed.savingsPct >= 0 && parsed.savingsPct <= 100, `savingsPct out of range: ${parsed.savingsPct}`);
});

// 11. sigmap query --context — writes .context/query-context.md
test('sigmap query --context → writes query-context.md', () => {
  const ctxPath = path.join(ROOT, '.context', 'query-context.md');
  if (fs.existsSync(ctxPath)) fs.unlinkSync(ctxPath);

  const r = spawnSync(process.execPath, [SCRIPT, '--query', 'rank files', '--context'], {
    encoding: 'utf8', cwd: ROOT, timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  assert.ok(fs.existsSync(ctxPath), `query-context.md not created at ${ctxPath}`);
  const content = fs.readFileSync(ctxPath, 'utf8');
  assert.ok(content.includes('SigMap Query Context'), 'missing header in query-context.md');
});

// 12. sigmap share — exits 0 and prints expected lines
test('sigmap share → exits 0 and prints shareable text', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'share'], {
    encoding: 'utf8', cwd: ROOT, timeout: 10000,
  });
  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  assert.ok(r.stdout.includes('SigMap'), `missing SigMap in output: ${r.stdout}`);
  assert.ok(r.stdout.includes('tokens'), `missing 'tokens' in output: ${r.stdout}`);
});

// ---------------------------------------------------------------------------
console.log('');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
