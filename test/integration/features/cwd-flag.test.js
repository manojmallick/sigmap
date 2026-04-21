'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
const GEN = path.join(ROOT, 'gen-context.js');

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
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Issue #98: --cwd restricts file scanning to the given directory
test('--cwd restricts output to files in that directory only', () => {
  withTempDir((base) => {
    // Create two sibling directories with distinct files
    const subA = path.join(base, 'alpha');
    const subB = path.join(base, 'beta');
    fs.mkdirSync(subA);
    fs.mkdirSync(subB);

    fs.writeFileSync(path.join(subA, 'auth.ts'), `
export function loginUser(email: string, password: string): Promise<string> {
  return Promise.resolve('token');
}
export function logoutUser(token: string): void {}
`);
    fs.writeFileSync(path.join(subB, 'payments.ts'), `
export function chargeCard(amount: number, cardId: string): Promise<boolean> {
  return Promise.resolve(true);
}
`);

    const outFile = path.join(base, 'out.md');
    const res = spawnSync('node', [GEN, '--cwd', subA, '--output', outFile], {
      cwd: base,
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    assert.strictEqual(res.status, 0, `exit non-zero: ${res.stderr}`);
    assert.ok(fs.existsSync(outFile), 'output file should exist');

    const content = fs.readFileSync(outFile, 'utf8');
    // alpha/auth.ts functions must appear
    assert.ok(content.includes('loginUser') || content.includes('logoutUser'),
      'alpha/auth.ts signatures should be in output');
    // beta/payments.ts must NOT appear
    assert.ok(!content.includes('chargeCard'),
      `beta/payments.ts content should NOT be in output but found it:\n${content.slice(0, 500)}`);
  });
});

test('--cwd with non-existent path exits with error', () => {
  const res = spawnSync('node', [GEN, '--cwd', '/nonexistent/path/xyz'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 10000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.notStrictEqual(res.status, 0, 'should exit non-zero for missing dir');
  assert.ok(
    (res.stderr || '').includes('does not exist') || (res.stdout || '').includes('does not exist'),
    `should report directory does not exist; stderr: ${res.stderr}`
  );
});

test('--cwd without argument exits with error', () => {
  const res = spawnSync('node', [GEN, '--cwd'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 10000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.notStrictEqual(res.status, 0, 'should exit non-zero when --cwd has no value');
});

console.log('\n--- cwd-flag ---');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
