'use strict';

/**
 * Integration tests for `sigmap conventions` (Layer 3 — grounded codegen).
 *   classifyNaming · scoreConvention (tiers) · extractConventions · CLI
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { classifyNaming, scoreConvention, extractConventions } =
  require(path.join(ROOT, 'src/conventions/extract'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

function withRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── classifyNaming ──────────────────────────────────────────────────────────
test('classifyNaming: PascalCase', () => {
  assert.strictEqual(classifyNaming('UserService.ts'), 'PascalCase');
});
test('classifyNaming: camelCase', () => {
  assert.strictEqual(classifyNaming('userService.ts'), 'camelCase');
  assert.strictEqual(classifyNaming('loader.js'), 'camelCase'); // single lowercase word
});
test('classifyNaming: kebab-case', () => {
  assert.strictEqual(classifyNaming('user-service.ts'), 'kebab-case');
});
test('classifyNaming: snake_case', () => {
  assert.strictEqual(classifyNaming('user_service.py'), 'snake_case');
});
test('classifyNaming: strips compound suffix', () => {
  assert.strictEqual(classifyNaming('user-service.test.ts'), 'kebab-case');
});

// ── scoreConvention ─────────────────────────────────────────────────────────
test('scoreConvention: empty → unknown', () => {
  const r = scoreConvention([]);
  assert.strictEqual(r.tier, 'unknown');
  assert.strictEqual(r.dominant, null);
  assert.strictEqual(r.total, 0);
});
test('scoreConvention: consistent tier at >=90%', () => {
  const labels = Array(95).fill('camelCase').concat(Array(5).fill('kebab-case'));
  const r = scoreConvention(labels);
  assert.strictEqual(r.dominant, 'camelCase');
  assert.strictEqual(r.tier, 'consistent');
  assert.ok(Math.abs(r.dominantPct - 0.95) < 1e-9);
});
test('scoreConvention: mostly tier in [70,90)', () => {
  const r = scoreConvention(Array(8).fill('a').concat(Array(2).fill('b')));
  assert.strictEqual(r.tier, 'mostly');
});
test('scoreConvention: inconsistent tier below 70%', () => {
  const r = scoreConvention(Array(6).fill('a').concat(Array(4).fill('b')));
  assert.strictEqual(r.tier, 'inconsistent');
});
test('scoreConvention: ignores "other" samples', () => {
  const r = scoreConvention(['a', 'a', 'other', 'other']);
  assert.strictEqual(r.total, 2);
  assert.strictEqual(r.tier, 'consistent');
});

// ── extractConventions ──────────────────────────────────────────────────────
test('extractConventions: detects naming + export + framework', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'user-service.js'),
      'function a(){} module.exports = { a };\n');
    fs.writeFileSync(path.join(dir, 'src', 'auth-guard.js'),
      'export const b = 1;\n');
    fs.writeFileSync(path.join(dir, 'package.json'),
      JSON.stringify({ name: 't', devDependencies: { jest: '^29' } }));
    const files = [
      path.join(dir, 'src', 'user-service.js'),
      path.join(dir, 'src', 'auth-guard.js'),
    ];
    const r = extractConventions(dir, files);
    assert.strictEqual(r.fileNaming.dominant, 'kebab-case');
    assert.strictEqual(r.fileNaming.tier, 'consistent');
    assert.strictEqual(r.exportStyle.dominant, 'named');
    assert.strictEqual(r.testFramework, 'jest');
    assert.strictEqual(r.scannedFiles, 2);
  });
});
test('extractConventions: ignores non-scoped files', () => {
  withRepo((dir) => {
    const files = [path.join(dir, 'a.go'), path.join(dir, 'b.rs')];
    const r = extractConventions(dir, files);
    assert.strictEqual(r.scannedFiles, 0);
    assert.strictEqual(r.fileNaming.tier, 'unknown');
  });
});

// ── CLI ─────────────────────────────────────────────────────────────────────
test('CLI: conventions writes .context/conventions.json and reports', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'bazQux.js'), 'export const y = 2;\n');
    const res = spawnSync('node', [SCRIPT, 'conventions'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(/file naming/.test(res.stdout), 'prints report');
    const outPath = path.join(dir, '.context', 'conventions.json');
    assert.ok(fs.existsSync(outPath), 'writes conventions.json');
    const data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.strictEqual(data.fileNaming.dominant, 'camelCase');
  });
});
test('CLI: conventions --json emits machine output', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'aaa.js'), 'export const x = 1;\n');
    const res = spawnSync('node', [SCRIPT, 'conventions', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    const data = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.ok(data.fileNaming, 'has fileNaming');
    assert.deepStrictEqual(data.scope, ['typescript', 'javascript', 'python']);
  });
});

console.log(`\nconventions: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
