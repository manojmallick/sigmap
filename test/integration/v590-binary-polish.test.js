'use strict';

/**
 * Integration tests for v5.9 — Binary Polish + Community Benchmark Submissions.
 * Verifies: version.json updated to 5.9.0, build-binary.mjs generates checksums,
 * verify-checksums.mjs script exists, sigmap bench --submit command works,
 * verify-binary.mjs covers the full v5.x workflow.
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const { spawnSync } = require('child_process');

const ROOT    = path.resolve(__dirname, '../..');
const GC      = path.join(ROOT, 'gen-context.js');

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

function readRoot(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function runGC(args, cwd) {
  return spawnSync('node', [GC, ...args], {
    cwd: cwd || ROOT,
    encoding: 'utf8',
    timeout: 15_000,
  });
}

console.log('\nv5.9 binary polish + community benchmark tests\n');

// ── version.json ──────────────────────────────────────────────────────────────

test('version.json: version is 5.9.0 or later', () => {
  const v = JSON.parse(readRoot('version.json'));
  const [major, minor] = v.version.split('.').map(Number);
  assert.ok(major > 5 || (major === 5 && minor >= 9), `expected >= 5.9.0, got ${v.version}`);
});

test('version.json: benchmark_id is sigmap-v5.9-main or later', () => {
  const v = JSON.parse(readRoot('version.json'));
  assert.ok(v.benchmark_id && /^sigmap-v\d+\.\d+-main/.test(v.benchmark_id),
    `expected sigmap-vX.Y-main format, got ${v.benchmark_id}`);
});

test('version.json: retains all canonical metrics fields', () => {
  const v = JSON.parse(readRoot('version.json'));
  const m = v.metrics;
  assert.ok(m, 'missing metrics block');
  assert.ok('hit_at_5' in m, 'missing hit_at_5');
  assert.ok('overall_token_reduction_pct' in m, 'missing overall_token_reduction_pct');
  assert.ok('retrieval_lift' in m, 'missing retrieval_lift');
});

// ── build-binary.mjs: checksum generation ────────────────────────────────────

test('build-binary.mjs: imports createHash from crypto', () => {
  const src = readRoot('scripts/build-binary.mjs');
  assert.ok(src.includes("createHash"), 'missing createHash import');
  assert.ok(src.includes("'crypto'") || src.includes('"crypto"'), 'missing crypto import');
});

test('build-binary.mjs: generates .sha256 file alongside binary', () => {
  const src = readRoot('scripts/build-binary.mjs');
  assert.ok(src.includes('.sha256'), 'missing .sha256 file write logic');
  assert.ok(src.includes('sha256'), 'missing sha256 variable');
});

test('build-binary.mjs: logs checksum path in output', () => {
  const src = readRoot('scripts/build-binary.mjs');
  assert.ok(src.includes('checksum written'), 'missing checksum written log message');
});

// ── verify-checksums.mjs: new script ─────────────────────────────────────────

test('verify-checksums.mjs: script exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'verify-checksums.mjs')),
    'scripts/verify-checksums.mjs not found');
});

test('verify-checksums.mjs: uses createHash from crypto', () => {
  const src = readRoot('scripts/verify-checksums.mjs');
  assert.ok(src.includes('createHash'), 'missing createHash');
  assert.ok(src.includes('sha256'), 'missing sha256 digest');
});

test('verify-checksums.mjs: exits 1 on mismatch (logic present)', () => {
  const src = readRoot('scripts/verify-checksums.mjs');
  assert.ok(src.includes('process.exit(1)'), 'missing exit 1 on mismatch');
  assert.ok(src.includes('MISMATCH'), 'missing MISMATCH error text');
});

test('verify-checksums.mjs: exits 0 on match (logic present)', () => {
  const src = readRoot('scripts/verify-checksums.mjs');
  assert.ok(src.includes('process.exit(0)'), 'missing exit 0 on match');
  assert.ok(src.includes('Checksum OK'), 'missing success message');
});

test('verify-checksums.mjs: handles missing binary gracefully', () => {
  const src = readRoot('scripts/verify-checksums.mjs');
  assert.ok(src.includes('binary not found'), 'missing binary not found error message');
});

test('verify-checksums.mjs: handles missing checksum file gracefully', () => {
  const src = readRoot('scripts/verify-checksums.mjs');
  assert.ok(src.includes('checksum file not found'), 'missing checksum file not found error message');
});

// ── verify-binary.mjs: extended with full v5.x workflow ──────────────────────

test('verify-binary.mjs: covers ask command (Test 6)', () => {
  const src = readRoot('scripts/verify-binary.mjs');
  assert.ok(src.includes("'ask'") || src.includes('"ask"'), 'missing ask test');
  assert.ok(src.includes('[6]'), 'missing test 6 label');
});

test('verify-binary.mjs: covers weights command (Test 7)', () => {
  const src = readRoot('scripts/verify-binary.mjs');
  assert.ok(src.includes("'weights'") || src.includes('"weights"'), 'missing weights test');
  assert.ok(src.includes('[7]'), 'missing test 7 label');
});

test('verify-binary.mjs: covers history command (Test 8)', () => {
  const src = readRoot('scripts/verify-binary.mjs');
  assert.ok(src.includes("'history'") || src.includes('"history"'), 'missing history test');
  assert.ok(src.includes('[8]'), 'missing test 8 label');
});

test('verify-binary.mjs: covers bench --submit (Test 9)', () => {
  const src = readRoot('scripts/verify-binary.mjs');
  assert.ok(src.includes("'bench'"), 'missing bench test');
  assert.ok(src.includes('[9]'), 'missing test 9 label');
});

test('verify-binary.mjs: covers bench --submit --json (Test 10)', () => {
  const src = readRoot('scripts/verify-binary.mjs');
  assert.ok(src.includes('[10]'), 'missing test 10 label');
  assert.ok(src.includes('--json'), 'missing --json flag in bench test');
});

// ── sigmap bench --submit CLI command ────────────────────────────────────────

test('gen-context.js: bench --submit command present', () => {
  const src = readRoot('gen-context.js');
  assert.ok(src.includes("args[0] === 'bench'"), "missing bench command dispatch");
  assert.ok(src.includes("--submit"), "missing --submit flag check");
});

test('gen-context.js: bench --submit reads version.json', () => {
  const src = readRoot('gen-context.js');
  assert.ok(src.includes('version.json'), 'missing version.json read in bench --submit');
});

test('gen-context.js: bench --submit outputs canonical metrics', () => {
  const src = readRoot('gen-context.js');
  assert.ok(src.includes('canonicalHitAt5'), 'missing canonicalHitAt5 field');
  assert.ok(src.includes('canonicalReduction'), 'missing canonicalReduction field');
});

test('gen-context.js: bench --submit --json produces valid JSON output', () => {
  const tmp = require('os').tmpdir();
  const fixtureDir = path.join(tmp, 'sigmap-bench-test-' + Date.now());
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, 'index.js'), 'function hello() {}\nmodule.exports = { hello };\n');
  fs.writeFileSync(path.join(fixtureDir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['.'], adapters: ['copilot'] }));

  const res = runGC(['bench', '--submit', '--json'], fixtureDir);
  fs.rmSync(fixtureDir, { recursive: true, force: true });

  assert.strictEqual(res.status, 0, `exit ${res.status}: ${res.stderr.slice(0, 200)}`);
  const data = JSON.parse(res.stdout);
  assert.ok(data.sigmapVersion, 'missing sigmapVersion in JSON output');
  assert.ok(data.benchmarkId, 'missing benchmarkId in JSON output');
  assert.ok(data.submittedAt, 'missing submittedAt in JSON output');
});

test('gen-context.js: bench --submit text output contains SigMap header', () => {
  const tmp = require('os').tmpdir();
  const fixtureDir = path.join(tmp, 'sigmap-bench-text-' + Date.now());
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, 'index.js'), 'function hello() {}\nmodule.exports = { hello };\n');
  fs.writeFileSync(path.join(fixtureDir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['.'], adapters: ['copilot'] }));

  const res = runGC(['bench', '--submit'], fixtureDir);
  fs.rmSync(fixtureDir, { recursive: true, force: true });

  assert.strictEqual(res.status, 0, `exit ${res.status}: ${res.stderr.slice(0, 200)}`);
  assert.ok(res.stdout.includes('SigMap') || res.stdout.includes('sigmap'), 'missing SigMap in output');
  assert.ok(/\d+\.\d+\.\d+/.test(res.stdout), 'missing version number in output');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
