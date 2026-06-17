'use strict';

/**
 * Integration tests for `sigmap conventions --fix` (Layer 3 — rename checklist).
 *   buildFixList: full-path renames / empty cases · CLI
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { buildFixList } = require(path.join(ROOT, 'src/conventions/fix'));
const { extractConventions } = require(path.join(ROOT, 'src/conventions/extract'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

function withRepo(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-fix-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'src', f), c);
    fn(dir, Object.keys(files).map((f) => path.join(dir, 'src', f)));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── buildFixList ────────────────────────────────────────────────────────────
test('lists every non-matching file with full from→to paths', () => {
  withRepo({
    'fooBar.js': 'export const a=1;\n', 'bazQux.js': 'export const b=2;\n', 'aaa.js': 'export const e=5;\n',
    'user-service.js': 'export const c=3;\n', 'data_store.js': 'export const d=4;\n',
  }, (dir, files) => {
    const conv = extractConventions(dir, files); // camelCase dominant (3 of 5)
    const r = buildFixList(dir, files, conv);
    assert.strictEqual(r.dominant, 'camelCase');
    assert.strictEqual(r.count, 2, 'two non-matching files');
    const froms = r.renames.map((x) => x.from).sort();
    assert.deepStrictEqual(froms, ['src/data_store.js', 'src/user-service.js']);
    const us = r.renames.find((x) => x.from === 'src/user-service.js');
    assert.strictEqual(us.to, 'src/userService.js', 'full-path rename to dominant style');
    assert.strictEqual(us.fromStyle, 'kebab-case');
  });
});
test('empty when every file already matches', () => {
  withRepo({ 'fooBar.js': 'export const a=1;\n', 'bazQux.js': 'export const b=2;\n' }, (dir, files) => {
    const r = buildFixList(dir, files, extractConventions(dir, files));
    assert.strictEqual(r.count, 0);
    assert.deepStrictEqual(r.renames, []);
  });
});
test('empty when there is no dominant convention', () => {
  const r = buildFixList(process.cwd(), [], { fileNaming: { dominant: null } });
  assert.strictEqual(r.dominant, null);
  assert.strictEqual(r.count, 0);
});
test('skips test files', () => {
  withRepo({
    'fooBar.js': 'export const a=1;\n', 'bazQux.js': 'export const b=2;\n',
    'some-thing.test.js': 'test()\n',
  }, (dir, files) => {
    const r = buildFixList(dir, files, extractConventions(dir, files));
    assert.ok(!r.renames.some((x) => /\.test\./.test(x.from)), 'no test files in the checklist');
  });
});

// ── CLI ─────────────────────────────────────────────────────────────────────
test('CLI: --fix prints a checkbox checklist for a mixed repo', () => {
  withRepo({
    'fooBar.js': 'export const a=1;\n', 'bazQux.js': 'export const b=2;\n', 'quux.js': 'export const e=5;\n',
    'user-service.js': 'export const c=3;\n',
  }, (dir) => {
    const res = spawnSync('node', [SCRIPT, 'conventions', '--fix'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(/to rename to camelCase/.test(res.stdout));
    assert.ok(/- \[ \] src\/user-service\.js\s+→\s+src\/userService\.js/.test(res.stdout), res.stdout);
  });
});
test('CLI: --fix on a clean repo says no fixes needed', () => {
  withRepo({ 'fooBar.js': 'export const a=1;\n', 'bazQux.js': 'export const b=2;\n' }, (dir) => {
    const res = spawnSync('node', [SCRIPT, 'conventions', '--fix'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0);
    assert.ok(/no fixes needed/.test(res.stdout));
  });
});
test('CLI: --fix --json emits the list', () => {
  withRepo({ 'fooBar.js': 'export const a=1;\n', 'bazQux.js': 'export const b=2;\n', 'cc.js': 'export const e=5;\n', 'a-b.js': 'export const c=3;\n' }, (dir) => {
    const res = spawnSync('node', [SCRIPT, 'conventions', '--fix', '--json'], { cwd: dir, encoding: 'utf8' });
    const data = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.ok(Array.isArray(data.renames));
    assert.strictEqual(typeof data.count, 'number');
  });
});

console.log(`\nconventions-fix: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
