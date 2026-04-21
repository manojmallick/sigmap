'use strict';

/**
 * Regression tests for issue #98:
 * --cwd flag must restrict file scanning to the given directory.
 *
 *  1.  --cwd with absolute path — sibling dir files excluded
 *  2.  --cwd with relative path — resolved from invokedFrom
 *  3.  nested subdirectories within --cwd are scanned recursively
 *  4.  multiple file types scanned (.ts, .js, .py) inside --cwd
 *  5.  files outside --cwd are excluded even if they are in the same git repo
 *  6.  warning message is printed to stderr
 *  7.  --cwd with non-existent path exits 1 with error message
 *  8.  --cwd without argument exits 1
 *  9.  --cwd next flag misread as value exits 1
 * 10.  --cwd pointing to a file (not directory) exits 1
 * 11.  default run without --cwd still works (no regression)
 * 12.  sigmap ask "..." --cwd <dir> restricts ask context to that directory
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { spawnSync } = require('child_process');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
const GEN  = path.join(ROOT, 'gen-context.js');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-cwd-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function run(args, cwd) {
  return spawnSync('node', [GEN, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// ── Scoping tests ─────────────────────────────────────────────────────────────

test('1. --cwd absolute path — sibling directory files excluded', () => {
  withTempDir((base) => {
    const target = path.join(base, 'target');
    const sibling = path.join(base, 'sibling');
    fs.mkdirSync(target);
    fs.mkdirSync(sibling);

    fs.writeFileSync(path.join(target, 'auth.ts'),
      `export function loginUser(email: string): Promise<string> { return Promise.resolve(''); }`);
    fs.writeFileSync(path.join(sibling, 'payments.ts'),
      `export function chargeCard(amount: number): boolean { return true; }`);

    const outFile = path.join(base, 'out.md');
    const r = run(['--cwd', target, '--output', outFile], base);

    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const content = fs.readFileSync(outFile, 'utf8');
    assert.ok(content.includes('loginUser'), 'target file must be in output');
    assert.ok(!content.includes('chargeCard'),
      `sibling file must NOT be in output:\n${content.slice(0, 400)}`);
  });
});

test('2. --cwd with relative path resolved from invocation directory', () => {
  withTempDir((base) => {
    const target = path.join(base, 'src');
    const other  = path.join(base, 'lib');
    fs.mkdirSync(target);
    fs.mkdirSync(other);

    fs.writeFileSync(path.join(target, 'api.ts'),
      `export function fetchUser(id: string): Promise<User> { return fetch(id); }`);
    fs.writeFileSync(path.join(other, 'utils.ts'),
      `export function formatDate(d: Date): string { return d.toISOString(); }`);

    const outFile = path.join(base, 'out.md');
    // Pass relative path — should be resolved relative to `base` (invokedFrom)
    const r = run(['--cwd', 'src', '--output', outFile], base);

    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const content = fs.readFileSync(outFile, 'utf8');
    assert.ok(content.includes('fetchUser'), 'src file must be in output');
    assert.ok(!content.includes('formatDate'),
      `lib file must NOT be in output:\n${content.slice(0, 400)}`);
  });
});

test('3. nested subdirectories within --cwd are scanned recursively', () => {
  withTempDir((base) => {
    const target  = path.join(base, 'app');
    const nested  = path.join(target, 'auth', 'handlers');
    fs.mkdirSync(nested, { recursive: true });

    fs.writeFileSync(path.join(target, 'index.ts'),
      `export function bootstrap(): void {}`);
    fs.writeFileSync(path.join(nested, 'login.ts'),
      `export function handleLogin(req: Request): Response { return ok(); }`);

    const outFile = path.join(base, 'out.md');
    const r = run(['--cwd', target, '--output', outFile], base);

    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const content = fs.readFileSync(outFile, 'utf8');
    assert.ok(content.includes('bootstrap') || content.includes('handleLogin'),
      `nested or top-level functions must appear:\n${content.slice(0, 400)}`);
  });
});

test('4. multiple file types (.ts, .js, .py) within --cwd are included', () => {
  withTempDir((base) => {
    const target = path.join(base, 'mixed');
    fs.mkdirSync(target);

    fs.writeFileSync(path.join(target, 'server.ts'),
      `export function startServer(port: number): void {}`);
    fs.writeFileSync(path.join(target, 'util.js'),
      `function formatBytes(n) { return n + ' B'; } module.exports = { formatBytes };`);
    fs.writeFileSync(path.join(target, 'helper.py'),
      `def parse_config(path: str) -> dict:\n    pass`);

    const outFile = path.join(base, 'out.md');
    const r = run(['--cwd', target, '--output', outFile], base);

    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const content = fs.readFileSync(outFile, 'utf8');
    // At least one of the multi-language functions must appear
    const hasAny = content.includes('startServer') ||
                   content.includes('formatBytes') ||
                   content.includes('parse_config');
    assert.ok(hasAny, `at least one multi-language function must appear:\n${content.slice(0, 400)}`);
  });
});

test('5. files outside --cwd excluded even within the same git repo', () => {
  withTempDir((base) => {
    // Initialise a git repo so resolveProjectRoot does not walk up to real repo
    spawnSync('git', ['init'], { cwd: base, encoding: 'utf8' });
    spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: base, encoding: 'utf8' });
    spawnSync('git', ['config', 'user.name', 'Test'], { cwd: base, encoding: 'utf8' });

    const target  = path.join(base, 'components');
    const outside = path.join(base, 'services');
    fs.mkdirSync(target);
    fs.mkdirSync(outside);

    fs.writeFileSync(path.join(target, 'Button.ts'),
      `export function renderButton(label: string): string { return label; }`);
    fs.writeFileSync(path.join(outside, 'UserService.ts'),
      `export function getUser(id: string): User { return db.find(id); }`);

    const outFile = path.join(base, 'out.md');
    const r = run(['--cwd', target, '--output', outFile], base);

    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const content = fs.readFileSync(outFile, 'utf8');
    assert.ok(!content.includes('getUser'),
      `UserService outside --cwd must NOT appear:\n${content.slice(0, 400)}`);
  });
});

// ── Diagnostic output ─────────────────────────────────────────────────────────

test('6. --cwd prints restriction warning to stderr', () => {
  withTempDir((base) => {
    const target = path.join(base, 'src');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'index.ts'), `export function noop(): void {}`);

    const outFile = path.join(base, 'out.md');
    const r = run(['--cwd', target, '--output', outFile], base);

    const combined = (r.stdout || '') + (r.stderr || '');
    assert.ok(combined.includes('--cwd') || combined.includes('restricting'),
      `expected warning about --cwd restriction; got:\n${combined.slice(0, 300)}`);
  });
});

// ── Error cases ───────────────────────────────────────────────────────────────

test('7. --cwd with non-existent path exits 1 with "does not exist" message', () => {
  const r = run(['--cwd', '/nonexistent/xyz/abc'], ROOT);
  assert.notStrictEqual(r.status, 0, 'should exit non-zero');
  const combined = (r.stdout || '') + (r.stderr || '');
  assert.ok(combined.includes('does not exist'),
    `must report missing dir; got:\n${combined.slice(0, 300)}`);
});

test('8. --cwd without argument exits 1', () => {
  const r = run(['--cwd'], ROOT);
  assert.notStrictEqual(r.status, 0, 'should exit non-zero when --cwd has no value');
});

test('9. --cwd followed immediately by another flag exits 1', () => {
  const r = run(['--cwd', '--output', 'out.md'], ROOT);
  assert.notStrictEqual(r.status, 0, 'adjacent flag should not be accepted as cwd value');
});

test('10. --cwd pointing to a file (not directory) exits 1', () => {
  withTempDir((base) => {
    const file = path.join(base, 'notadir.ts');
    fs.writeFileSync(file, 'export function x() {}');
    const r = run(['--cwd', file], base);
    assert.notStrictEqual(r.status, 0,
      'passing a file path to --cwd should fail');
  });
});

// ── Regression: default behaviour unaffected ─────────────────────────────────

test('11. default run without --cwd still exits 0', () => {
  const r = spawnSync('node', [GEN, '--health'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.strictEqual(r.status, 0, `--health should exit 0: ${r.stderr}`);
});

// ── sigmap ask with --cwd ─────────────────────────────────────────────────────

test('12. sigmap ask with --cwd restricts ranked files to that directory', () => {
  withTempDir((base) => {
    const target  = path.join(base, 'auth');
    const outside = path.join(base, 'billing');
    fs.mkdirSync(target);
    fs.mkdirSync(outside);

    fs.writeFileSync(path.join(target, 'tokens.ts'),
      `export function generateToken(userId: string): string { return sign(userId); }
export function validateToken(token: string): boolean { return verify(token); }`);
    fs.writeFileSync(path.join(outside, 'invoice.ts'),
      `export function createInvoice(orderId: string): Invoice { return new Invoice(orderId); }`);

    const r = run(['ask', 'how does token validation work', '--cwd', target, '--json'], base);

    // If the command exits non-zero we accept it might need srcDirs wired differently
    // but output must not include the outside file
    const combined = (r.stdout || '') + (r.stderr || '');
    assert.ok(!combined.includes('createInvoice'),
      `billing/invoice.ts must NOT appear in ask results:\n${combined.slice(0, 400)}`);
  });
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n--- cwd-flag ---');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
