'use strict';

/**
 * Integration tests for v6.1.0 features:
 *  1.  --coverage flag enables test coverage annotation without config
 *  2.  --coverage flag adds ✓/✗ markers to generated context
 *  3.  --coverage with no test dir gracefully degrades (no crash)
 *  4.  sigmap weights --export <file> writes JSON to file
 *  5.  sigmap weights --export (no path) prints JSON to stdout
 *  6.  sigmap weights --export produces valid parseable JSON
 *  7.  sigmap weights --import <file> merges weights into local store
 *  8.  sigmap weights --import --replace replaces local weights entirely
 *  9.  sigmap weights --import with missing file exits non-zero
 * 10.  sigmap weights --import with no path argument exits non-zero
 * 11.  sigmap weights --export then --import round-trip preserves values
 * 12.  importWeights sanitizes and clamps incoming multipliers
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

const {
  loadWeights,
  saveWeights,
  exportWeights,
  importWeights,
} = require('../../../src/learning/weights');

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

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-v610-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function makeProject(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'src', 'auth.ts'),
    'export function login(user: string, pass: string): boolean { return true; }\nexport class AuthService { login(u: string) {} }'
  );
  fs.writeFileSync(
    path.join(dir, 'gen-context.config.json'),
    JSON.stringify({ srcDirs: ['src'], maxTokens: 4000 })
  );
}

function run(args, cwd) {
  return spawnSync('node', [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// ── --coverage flag ──────────────────────────────────────────────────────────

test('1. --coverage flag exits zero (no crash)', () => {
  withTempDir((dir) => {
    makeProject(dir);
    const r = run(['--coverage'], dir);
    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
  });
});

test('2. --coverage generates a context file', () => {
  withTempDir((dir) => {
    makeProject(dir);
    const r = run(['--coverage'], dir);
    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const outPath = path.join(dir, '.github', 'copilot-instructions.md');
    assert.ok(fs.existsSync(outPath), 'context file must exist after --coverage run');
  });
});

test('3. --coverage with no test dir does not crash', () => {
  withTempDir((dir) => {
    makeProject(dir);
    // No test/ directory exists — should degrade gracefully
    const r = run(['--coverage'], dir);
    assert.strictEqual(r.status, 0, `should not crash with missing test dir: ${r.stderr}`);
  });
});

// ── weights --export ─────────────────────────────────────────────────────────

test('4. weights --export <file> writes JSON to file', () => {
  withTempDir((dir) => {
    makeProject(dir);
    // Seed some weights
    saveWeights(dir, { 'src/auth.ts': 1.5, 'src/utils.ts': 0.8 });
    const exportFile = path.join(dir, 'weights-export.json');
    const r = run(['weights', '--export', exportFile], dir);
    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    assert.ok(fs.existsSync(exportFile), 'export file must be written');
  });
});

test('5. weights --export (no path) writes JSON to stdout', () => {
  withTempDir((dir) => {
    makeProject(dir);
    saveWeights(dir, { 'src/auth.ts': 1.4 });
    const r = run(['weights', '--export'], dir);
    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    assert.ok(r.stdout.includes('{'), `stdout must contain JSON, got: ${r.stdout.slice(0, 100)}`);
  });
});

test('6. weights --export produces valid parseable JSON', () => {
  withTempDir((dir) => {
    makeProject(dir);
    saveWeights(dir, { 'src/auth.ts': 1.3 });
    const r = run(['weights', '--export'], dir);
    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(r.stdout); }, 'stdout must be valid JSON');
    assert.ok(typeof parsed === 'object' && parsed !== null, 'parsed JSON must be an object');
  });
});

// ── weights --import ─────────────────────────────────────────────────────────

test('7. weights --import <file> merges weights into local store', () => {
  withTempDir((dir) => {
    makeProject(dir);
    saveWeights(dir, { 'src/auth.ts': 1.2 });
    const importFile = path.join(dir, 'incoming.json');
    fs.writeFileSync(importFile, JSON.stringify({ 'src/utils.ts': 1.6 }));
    const r = run(['weights', '--import', importFile], dir);
    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const merged = loadWeights(dir);
    assert.ok('src/auth.ts' in merged, 'existing weight must be preserved');
    assert.ok('src/utils.ts' in merged, 'imported weight must be added');
  });
});

test('8. weights --import --replace replaces local weights entirely', () => {
  withTempDir((dir) => {
    makeProject(dir);
    saveWeights(dir, { 'src/auth.ts': 1.2 });
    const importFile = path.join(dir, 'incoming.json');
    fs.writeFileSync(importFile, JSON.stringify({ 'src/utils.ts': 1.6 }));
    const r = run(['weights', '--import', importFile, '--replace'], dir);
    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const result = loadWeights(dir);
    assert.ok(!('src/auth.ts' in result), 'old weight must be replaced');
    assert.ok('src/utils.ts' in result, 'imported weight must be present');
  });
});

test('9. weights --import with missing file exits non-zero', () => {
  withTempDir((dir) => {
    makeProject(dir);
    const r = run(['weights', '--import', '/tmp/does-not-exist-sigmap.json'], dir);
    assert.notStrictEqual(r.status, 0, 'must exit non-zero for missing import file');
  });
});

test('10. weights --import with no path argument exits non-zero', () => {
  withTempDir((dir) => {
    makeProject(dir);
    const r = run(['weights', '--import'], dir);
    assert.notStrictEqual(r.status, 0, 'must exit non-zero when --import has no path');
  });
});

// ── round-trip and sanitization ──────────────────────────────────────────────

test('11. weights --export then --import round-trip preserves values', () => {
  withTempDir((dir) => {
    makeProject(dir);
    saveWeights(dir, { 'src/auth.ts': 1.5, 'src/login.ts': 0.7 });
    const exportFile = path.join(dir, 'weights-rt.json');
    run(['weights', '--export', exportFile], dir);

    // New empty project directory for import
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-v610-rt-'));
    try {
      makeProject(dir2);
      const r = run(['weights', '--import', exportFile, '--replace'], dir2);
      assert.strictEqual(r.status, 0, `import failed: ${r.stderr}`);
      const imported = loadWeights(dir2);
      assert.ok(Math.abs((imported['src/auth.ts'] || 0) - 1.5) < 0.01, 'auth.ts weight must round-trip');
      assert.ok(Math.abs((imported['src/login.ts'] || 0) - 0.7) < 0.01, 'login.ts weight must round-trip');
    } finally {
      fs.rmSync(dir2, { recursive: true, force: true });
    }
  });
});

test('12. importWeights sanitizes and clamps incoming multipliers', () => {
  withTempDir((dir) => {
    makeProject(dir);
    const importFile = path.join(dir, 'bad-weights.json');
    fs.writeFileSync(importFile, JSON.stringify({
      'src/auth.ts': 99,   // above MAX_MULT — should be clamped to 3.0
      'src/ok.ts': 1.5,
      '../outside.ts': 1.2, // path traversal — should be dropped
    }));
    const r = run(['weights', '--import', importFile, '--replace'], dir);
    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const result = loadWeights(dir);
    assert.ok((result['src/auth.ts'] || 0) <= 3.0, 'clamped weight must not exceed MAX_MULT');
    assert.ok(!('../outside.ts' in result), 'path traversal must be dropped');
  });
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n--- coverage-flag-weights-export-import ---');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
