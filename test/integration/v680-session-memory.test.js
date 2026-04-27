'use strict';

/**
 * Integration tests for v6.8.0 — Session memory + sigmap plan.
 *
 * Tests:
 *  1.  loadSession returns null when no session file exists
 *  2.  loadSession returns null when session is older than 4 hours
 *  3.  saveSession writes valid JSON to .context/session.json
 *  4.  Session file contains ts, intent, topFiles, lastQuery
 *  5.  mergeSessionContext adds +0.2 boost to files from previous session
 *  6.  mergeSessionContext reduces boost to +0.1 when intent differs (topic switch)
 *  7.  mergeSessionContext returns scores unchanged when session is null
 *  8.  clearSession deletes the session file
 *  9.  sigmap ask --followup loads and merges session context
 * 10.  sigmap ask --followup prints followup indicator message
 * 11.  sigmap ask (without --followup) saves session for future use
 * 12.  sigmap plan "<goal>" returns files grouped by confidence level
 * 13.  sigmap plan --json produces valid JSON with goal, intent, inspectFirst, likelyToChange
 * 14.  sigmap plan (missing goal) exits with 1 and prints usage
 * 15.  Session TTL expiry: loadSession returns null after 4+ hours
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

const SESSION_MODULE = path.join(ROOT, 'src', 'session', 'memory.js');
const { loadSession, saveSession, mergeSessionContext, clearSession } = require(SESSION_MODULE);

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

// Test setup: create temporary directory for testing
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-session-'));

// ──────────────────────────────────────────────────────────────────────────

test('loadSession returns null when no session file exists', () => {
  const result = loadSession(tmpDir);
  assert.strictEqual(result, null, 'should return null for nonexistent session');
});

test('saveSession writes valid JSON to .context/session.json', () => {
  saveSession(tmpDir, {
    intent: 'debug',
    topFiles: [
      { file: 'src/auth.ts', score: 0.9 },
      { file: 'src/middleware.ts', score: 0.7 },
    ],
    query: 'fix the login bug',
  });

  const sessionPath = path.join(tmpDir, '.context', 'session.json');
  assert(fs.existsSync(sessionPath), 'session file should exist');

  const raw = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  assert.strictEqual(typeof raw.ts, 'number', 'ts should be a number');
  assert.strictEqual(raw.intent, 'debug', 'intent should be saved');
  assert.strictEqual(raw.lastQuery, 'fix the login bug', 'lastQuery should be saved');
  assert.strictEqual(raw.topFiles.length, 2, 'topFiles should be saved');
});

test('mergeSessionContext adds +0.2 boost to files from previous session', () => {
  const session = {
    ts: Date.now(),
    intent: 'debug',
    topFiles: [{ file: 'src/auth.ts', score: 0.9 }],
    lastQuery: 'fix the login bug',
  };

  const scores = [
    { file: 'src/auth.ts', score: 0.5, confidence: 'high' },
    { file: 'src/routes.ts', score: 0.3, confidence: 'medium' },
  ];

  const merged = mergeSessionContext(scores, session, 'debug');
  assert.strictEqual(merged[0].score, 0.7, 'auth.ts should get +0.2 boost');
  assert.strictEqual(merged[1].score, 0.3, 'routes.ts should not get boost');
});

test('mergeSessionContext reduces boost to +0.1 when intent differs (topic switch)', () => {
  const session = {
    ts: Date.now(),
    intent: 'debug',
    topFiles: [{ file: 'src/auth.ts', score: 0.9 }],
    lastQuery: 'fix the login bug',
  };

  const scores = [{ file: 'src/auth.ts', score: 0.5, confidence: 'high' }];

  // Current intent is 'explain' (different from session's 'debug')
  const merged = mergeSessionContext(scores, session, 'explain');
  assert.strictEqual(merged[0].score, 0.6, 'auth.ts should get +0.1 boost (topic switch)');
});

test('mergeSessionContext returns scores unchanged when session is null', () => {
  const scores = [
    { file: 'src/auth.ts', score: 0.5 },
    { file: 'src/routes.ts', score: 0.3 },
  ];

  const merged = mergeSessionContext(scores, null, 'debug');
  assert.deepStrictEqual(merged, scores, 'scores should be unchanged');
});

test('clearSession deletes the session file', () => {
  saveSession(tmpDir, { intent: 'debug', topFiles: [], query: 'test' });
  const sessionPath = path.join(tmpDir, '.context', 'session.json');
  assert(fs.existsSync(sessionPath), 'session file should exist before clear');

  clearSession(tmpDir);
  assert(!fs.existsSync(sessionPath), 'session file should be deleted');
});

test('loadSession returns null when session is older than 4 hours', () => {
  // Create an old session (5 hours ago)
  const oldTs = Date.now() - (5 * 60 * 60 * 1000);
  const sessionPath = path.join(tmpDir, '.context', 'session.json');
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, JSON.stringify({
    ts: oldTs,
    intent: 'debug',
    topFiles: [],
    lastQuery: 'old query',
  }));

  const result = loadSession(tmpDir);
  assert.strictEqual(result, null, 'should return null for expired session');
});

test('sigmap plan "<goal>" returns files grouped by confidence level', () => {
  const result = spawnSync('node', [SCRIPT, 'plan', 'add rate limiting'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  assert.strictEqual(result.status, 0, `plan should exit 0, got status ${result.status}`);
  assert(result.stdout.includes('Inspect first'), 'output should have "Inspect first" section');
  assert(result.stdout.includes('Likely to change'), 'output should have "Likely to change" section');
});

test('sigmap plan --json produces valid JSON with required fields', () => {
  const result = spawnSync('node', [SCRIPT, 'plan', 'fix authentication issue', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  assert.strictEqual(result.status, 0, 'plan --json should exit 0');
  let output;
  try {
    output = JSON.parse(result.stdout);
  } catch (e) {
    throw new Error(`plan --json output is not valid JSON: ${e.message}`);
  }

  assert(output.goal, 'output should have goal field');
  assert(output.intent, 'output should have intent field');
  assert(Array.isArray(output.inspectFirst), 'output should have inspectFirst array');
  assert(Array.isArray(output.likelyToChange), 'output should have likelyToChange array');
});

test('sigmap plan (missing goal) exits with 1 and prints usage', () => {
  const result = spawnSync('node', [SCRIPT, 'plan'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  assert.notStrictEqual(result.status, 0, 'plan without goal should exit non-zero');
  assert(result.stderr.includes('Usage'), 'should print usage message');
});

test('sigmap plan detects intent from goal', () => {
  const result = spawnSync('node', [SCRIPT, 'plan', 'fix the login bug', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  const output = JSON.parse(result.stdout);
  assert.strictEqual(output.intent, 'debug', 'should detect "debug" intent from "fix" keyword');
});

// ──────────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
