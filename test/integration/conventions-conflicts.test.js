'use strict';

/**
 * Integration tests for `sigmap conventions --conflicts` (Layer 3).
 *   scoreConvention examples · toNamingStyle · renameSuggestion · analyzeConflicts · CLI
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { scoreConvention, extractConventions } = require(path.join(ROOT, 'src/conventions/extract'));
const { analyzeConflicts, toNamingStyle, renameSuggestion } =
  require(path.join(ROOT, 'src/conventions/conflicts'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

function withRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-conf-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── scoreConvention examples (backward compatible) ──────────────────────────
test('scoreConvention: no refs → no examples key', () => {
  const r = scoreConvention(['a', 'a', 'b']);
  assert.strictEqual(r.variants[0].examples, undefined);
});
test('scoreConvention: refs → up to 3 examples per variant', () => {
  const labels = ['a', 'a', 'a', 'a', 'b'];
  const refs = ['a1', 'a2', 'a3', 'a4', 'b1'];
  const r = scoreConvention(labels, refs);
  const a = r.variants.find((v) => v.label === 'a');
  assert.deepStrictEqual(a.examples, ['a1', 'a2', 'a3']); // capped at 3
  const b = r.variants.find((v) => v.label === 'b');
  assert.deepStrictEqual(b.examples, ['b1']);
});

// ── toNamingStyle ───────────────────────────────────────────────────────────
test('toNamingStyle: kebab → camelCase', () => {
  assert.strictEqual(toNamingStyle('user-service', 'camelCase'), 'userService');
});
test('toNamingStyle: snake → PascalCase', () => {
  assert.strictEqual(toNamingStyle('user_service', 'PascalCase'), 'UserService');
});
test('toNamingStyle: camel → kebab-case', () => {
  assert.strictEqual(toNamingStyle('userService', 'kebab-case'), 'user-service');
});
test('toNamingStyle: camel → snake_case', () => {
  assert.strictEqual(toNamingStyle('fooBarBaz', 'snake_case'), 'foo_bar_baz');
});

// ── renameSuggestion ────────────────────────────────────────────────────────
test('renameSuggestion: preserves extension', () => {
  assert.deepStrictEqual(renameSuggestion('user-service.ts', 'camelCase'),
    { from: 'user-service.ts', to: 'userService.ts' });
});
test('renameSuggestion: preserves compound suffix', () => {
  assert.deepStrictEqual(renameSuggestion('user-service.test.ts', 'camelCase'),
    { from: 'user-service.test.ts', to: 'userService.test.ts' });
});

// ── analyzeConflicts ────────────────────────────────────────────────────────
test('analyzeConflicts: consistent repo → no conflicts', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'bazQux.js'), 'export const b = 2;\n');
    const r = analyzeConflicts(extractConventions(dir, [
      path.join(dir, 'src', 'fooBar.js'), path.join(dir, 'src', 'bazQux.js'),
    ]));
    assert.strictEqual(r.hasConflicts, false);
    assert.strictEqual(r.conventions.length, 0);
  });
});
test('analyzeConflicts: mixed naming → conflict with breakdown + renames', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    // 2 camelCase (dominant) + 1 kebab-case minority
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'bazQux.js'), 'export const b = 2;\n');
    fs.writeFileSync(path.join(dir, 'src', 'user-service.js'), 'export const c = 3;\n');
    const files = ['fooBar.js', 'bazQux.js', 'user-service.js'].map((f) => path.join(dir, 'src', f));
    const r = analyzeConflicts(extractConventions(dir, files));
    assert.strictEqual(r.hasConflicts, true);
    const naming = r.conventions.find((c) => c.key === 'fileNaming');
    assert.ok(naming, 'fileNaming conflict present');
    assert.strictEqual(naming.dominant, 'camelCase');
    assert.ok(naming.variants.length >= 2, 'multiple variants');
    const kebab = naming.variants.find((v) => v.pattern === 'kebab-case');
    assert.ok(kebab.examples.includes('user-service.js'), 'carries example file');
    // rename suggestion moves the minority file to the dominant style
    assert.deepStrictEqual(naming.renames.find((x) => x.from === 'user-service.js'),
      { from: 'user-service.js', to: 'userService.js' });
  });
});
test('analyzeConflicts: export-style conflict has no rename suggestions', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    // consistent kebab naming, but mixed export style
    fs.writeFileSync(path.join(dir, 'src', 'aa.js'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'bb.js'), 'export default function () {}\n');
    const files = ['aa.js', 'bb.js'].map((f) => path.join(dir, 'src', f));
    const r = analyzeConflicts(extractConventions(dir, files));
    const exp = r.conventions.find((c) => c.key === 'exportStyle');
    assert.ok(exp, 'exportStyle conflict present');
    assert.strictEqual(exp.renames.length, 0, 'no renames for export style');
  });
});

// ── CLI ─────────────────────────────────────────────────────────────────────
test('CLI: --conflicts prints breakdown for a mixed repo', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'bazQux.js'), 'export const b = 2;\n');
    fs.writeFileSync(path.join(dir, 'src', 'user-service.js'), 'export const c = 3;\n');
    const res = spawnSync('node', [SCRIPT, 'conventions', '--conflicts'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(/file naming/.test(res.stdout), 'shows convention');
    assert.ok(/rename to match camelCase/.test(res.stdout), 'shows rename block');
    assert.ok(/user-service\.js\s+→\s+userService\.js/.test(res.stdout), 'shows rename arrow');
  });
});
test('CLI: --conflicts --json emits structured object', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'user-service.js'), 'export const c = 3;\n');
    const res = spawnSync('node', [SCRIPT, 'conventions', '--conflicts', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    const data = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.strictEqual(typeof data.hasConflicts, 'boolean');
    assert.ok(Array.isArray(data.conventions));
  });
});
test('CLI: --conflicts on consistent repo says no conflicts', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'bazQux.js'), 'export const b = 2;\n');
    const res = spawnSync('node', [SCRIPT, 'conventions', '--conflicts'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(/no conflicts/.test(res.stdout), 'reports no conflicts');
  });
});

console.log(`\nconventions-conflicts: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
