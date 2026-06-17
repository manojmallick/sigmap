'use strict';

/**
 * Integration tests for `sigmap review-pr` (Gap 2, step 4).
 *   reviewPr: missing-tests / security-file / god-node / scope-drift · CLI (git diff)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { reviewPr } = require(path.join(ROOT, 'src/review/review-pr'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

// ── reviewPr (pure) ─────────────────────────────────────────────────────────
test('missing-tests: source changed without matching test', () => {
  const r = reviewPr([{ path: 'src/foo.js', status: 'M' }], process.cwd());
  assert.ok(r.findings.some((f) => f.type === 'missing-tests' && f.file === 'src/foo.js'));
});
test('no missing-tests when a matching test changed', () => {
  const r = reviewPr([
    { path: 'src/foo.js', status: 'M' },
    { path: 'test/foo.test.js', status: 'M' },
  ], process.cwd());
  assert.ok(!r.findings.some((f) => f.type === 'missing-tests'));
});
test('security-file: flags sensitive paths', () => {
  const r = reviewPr([
    { path: '.env', status: 'M' },
    { path: '.github/workflows/ci.yml', status: 'M' },
    { path: 'package.json', status: 'M' },
    { path: 'src/auth/login.js', status: 'M' },
  ], process.cwd());
  const sec = r.findings.filter((f) => f.type === 'security-file').map((f) => f.file);
  assert.ok(sec.includes('.env'));
  assert.ok(sec.includes('.github/workflows/ci.yml'));
  assert.ok(sec.includes('package.json'));
});
test('deletions are ignored for security + source checks', () => {
  const r = reviewPr([{ path: '.env', status: 'D' }, { path: 'src/foo.js', status: 'D' }], process.cwd());
  assert.ok(!r.findings.some((f) => f.type === 'security-file'));
  assert.ok(!r.findings.some((f) => f.type === 'missing-tests'));
});
test('scope-drift: too many top-level dirs', () => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f'].map((d) => ({ path: `${d}/x.js`, status: 'M' }));
  const r = reviewPr(files, process.cwd(), { scopeThreshold: 5 });
  assert.ok(r.findings.some((f) => f.type === 'scope-drift' && f.count === 6));
});
test('summary: byType + ok=false when findings present', () => {
  const r = reviewPr([{ path: '.env', status: 'M' }], process.cwd());
  assert.strictEqual(r.summary.ok, false);
  assert.strictEqual(r.summary.byType['security-file'], 1);
});
test('summary: ok=true when clean', () => {
  const r = reviewPr([
    { path: 'src/foo.js', status: 'M' },
    { path: 'src/foo.test.js', status: 'M' },
  ], process.cwd());
  assert.strictEqual(r.summary.ok, true);
  assert.strictEqual(r.findings.length, 0);
});

// ── CLI (real git repo) ─────────────────────────────────────────────────────
function withGitRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewpr-'));
  const g = (args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  try {
    g(['init', '-q']);
    g(['config', 'user.email', 't@t.t']);
    g(['config', 'user.name', 'T']);
    g(['commit', '--allow-empty', '-q', '-m', 'base']);
    fn(dir, g);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('CLI: review-pr --staged flags a sensitive file (exit 1)', () => {
  withGitRepo((dir, g) => {
    fs.writeFileSync(path.join(dir, '.env'), 'SECRET=1\n');
    g(['add', '.env']);
    const res = spawnSync('node', [SCRIPT, 'review-pr', '--staged'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1, res.stdout + res.stderr);
    assert.ok(/security file/.test(res.stdout), res.stdout);
  });
});
test('CLI: review-pr --staged clean (source + test) exits 0', () => {
  withGitRepo((dir, g) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'foo.js'), 'module.exports = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'foo.test.js'), 'require("./foo");\n');
    g(['add', '-A']);
    const res = spawnSync('node', [SCRIPT, 'review-pr', '--staged'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    assert.ok(/no findings/.test(res.stdout));
  });
});
test('CLI: review-pr --json emits the result', () => {
  withGitRepo((dir, g) => {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}\n');
    g(['add', '-A']);
    const res = spawnSync('node', [SCRIPT, 'review-pr', '--staged', '--json'], { cwd: dir, encoding: 'utf8' });
    const data = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.ok(data.summary);
    assert.ok(Array.isArray(data.findings));
  });
});

console.log(`\nreview-pr: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
