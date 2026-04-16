'use strict';

/**
 * Integration tests for v5.2 features:
 *  1.  weights store normalizes paths and omits baseline multipliers
 *  2.  weights store clamps multipliers on load/save
 *  3.  weights store applies decay before mutation
 *  4.  ranker learned weights affect ordering only when cwd is supplied
 *  5.  ranker empty-query fallback ignores learned weights
 *  6.  sigmap learn --good writes learned weights
 *  7.  sigmap learn with only invalid paths exits non-zero
 *  8.  sigmap weights prints friendly empty state and JSON returns {}
 *  9.  sigmap judge --learn boosts files on strongly grounded context
 * 10.  sigmap judge without --learn leaves weights untouched
 * 11.  sigmap judge --learn no-op band reports skipped learning
 * 12.  learned weights change --query ranking in a temp project
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

const {
  loadWeights,
  saveWeights,
  updateWeights,
  resetWeights,
} = require('../../src/learning/weights');
const { rank } = require('../../src/retrieval/ranker');

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

function makeProject(prefix = 'sigmap-v520-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
    srcDirs: ['src'],
    maxTokens: 4000,
  }));
  return dir;
}

console.log('[v520-features.test.js] v5.2 learning engine');
console.log('');

test('weights: normalizes paths and omits baseline multipliers', () => {
  const dir = makeProject();
  fs.writeFileSync(path.join(dir, 'src', 'auth.js'), 'function loginUser() {}\n');

  saveWeights(dir, {
    './src/auth.js': 1.25,
    'src/ignored.js': 1.0,
  });

  const loaded = loadWeights(dir);
  assert.deepStrictEqual(loaded, { 'src/auth.js': 1.25 });
  const raw = JSON.parse(fs.readFileSync(path.join(dir, '.context', 'weights.json'), 'utf8'));
  assert.deepStrictEqual(raw, { 'src/auth.js': 1.25 });

  fs.rmSync(dir, { recursive: true });
});

test('weights: clamps multipliers on load/save', () => {
  const dir = makeProject();
  fs.writeFileSync(path.join(dir, 'src', 'auth.js'), 'function loginUser() {}\n');
  fs.writeFileSync(path.join(dir, 'src', 'legacy.js'), 'function legacyFlow() {}\n');

  saveWeights(dir, {
    'src/auth.js': 99,
    'src/legacy.js': 0.01,
  });

  const loaded = loadWeights(dir);
  assert.strictEqual(loaded['src/auth.js'], 3);
  assert.strictEqual(loaded['src/legacy.js'], 0.3);

  fs.rmSync(dir, { recursive: true });
});

test('weights: applies decay before mutation', () => {
  const dir = makeProject();
  fs.writeFileSync(path.join(dir, 'src', 'auth.js'), 'function loginUser() {}\n');

  saveWeights(dir, { 'src/auth.js': 2.0 });
  updateWeights(dir, { goodFiles: ['src/auth.js'], goodAmount: 0.15 });

  const loaded = loadWeights(dir);
  assert.strictEqual(loaded['src/auth.js'], 2.05);

  fs.rmSync(dir, { recursive: true });
});

test('ranker: learned weights affect ordering only when cwd is supplied', () => {
  const dir = makeProject();
  const index = new Map([
    ['src/alpha.js', ['function loginUser()']],
    ['src/beta.js', ['function loginUser()']],
  ]);

  saveWeights(dir, { 'src/beta.js': 1.5 });
  const withoutCwd = rank('login user', index, { topK: 2 });
  const withCwd = rank('login user', index, { topK: 2, cwd: dir });

  assert.strictEqual(withoutCwd[0].file, 'src/alpha.js');
  assert.strictEqual(withCwd[0].file, 'src/beta.js');

  fs.rmSync(dir, { recursive: true });
});

test('ranker: empty-query fallback ignores learned weights', () => {
  const dir = makeProject();
  const index = new Map([
    ['src/alpha.js', ['a', 'b', 'c']],
    ['src/beta.js', ['a']],
  ]);

  saveWeights(dir, { 'src/beta.js': 3.0 });
  const results = rank('the and', index, { topK: 2, cwd: dir });
  assert.strictEqual(results[0].file, 'src/alpha.js');

  fs.rmSync(dir, { recursive: true });
});

test('sigmap learn --good writes learned weights', () => {
  const dir = makeProject();
  fs.writeFileSync(path.join(dir, 'src', 'auth.js'), 'function loginUser() {}\nmodule.exports = { loginUser };\n');
  const r = spawnSync(process.execPath, [SCRIPT, 'learn', '--good', 'src/auth.js'], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
  });

  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  const parsed = JSON.parse(fs.readFileSync(path.join(dir, '.context', 'weights.json'), 'utf8'));
  assert.strictEqual(parsed['src/auth.js'], 1.15);

  fs.rmSync(dir, { recursive: true });
});

test('sigmap learn with only invalid paths exits non-zero', () => {
  const dir = makeProject();
  const r = spawnSync(process.execPath, [SCRIPT, 'learn', '--good', '../outside.js'], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
  });

  assert.strictEqual(r.status, 1, `expected exit 1, got ${r.status}`);
  assert.ok(r.stderr.includes('No valid files') || r.stderr.includes('outside the repo'));

  fs.rmSync(dir, { recursive: true });
});

test('sigmap weights prints friendly empty state and JSON returns {}', () => {
  const dir = makeProject();
  let r = spawnSync(process.execPath, [SCRIPT, 'weights'], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  assert.ok(r.stdout.includes('No learned weights yet'));

  r = spawnSync(process.execPath, [SCRIPT, 'weights', '--json'], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  assert.deepStrictEqual(JSON.parse(r.stdout.trim()), {});

  fs.rmSync(dir, { recursive: true });
});

test('sigmap judge --learn boosts files on strongly grounded context', () => {
  const dir = makeProject();
  const authFile = path.join(dir, 'src', 'auth.js');
  fs.writeFileSync(authFile, 'function loginUser() {}\nfunction validateToken() {}\n');
  const response = path.join(dir, 'response.txt');
  const context = path.join(dir, 'context.md');
  fs.writeFileSync(response, 'loginUser validateToken');
  fs.writeFileSync(context, [
    '# SigMap Query Context',
    '',
    '## src/auth.js',
    '```',
    'function loginUser()',
    'function validateToken()',
    '```',
    '',
  ].join('\n'));

  const r = spawnSync(process.execPath, [SCRIPT, 'judge', '--response', response, '--context', context, '--learn', '--json'], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
  });

  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  const parsed = JSON.parse(r.stdout.trim());
  assert.ok(parsed.learning, 'missing learning object');
  assert.strictEqual(parsed.learning.applied, true);
  assert.strictEqual(parsed.learning.action, 'boost');
  assert.strictEqual(loadWeights(dir)['src/auth.js'], 1.05);

  fs.rmSync(dir, { recursive: true });
});

test('sigmap judge without --learn leaves weights untouched', () => {
  const dir = makeProject();
  fs.writeFileSync(path.join(dir, 'src', 'auth.js'), 'function loginUser() {}\n');
  const response = path.join(dir, 'response.txt');
  const context = path.join(dir, 'context.md');
  fs.writeFileSync(response, 'loginUser handles auth flow');
  fs.writeFileSync(context, [
    '# SigMap Query Context',
    '',
    '## src/auth.js',
    '```',
    'function loginUser()',
    '```',
    '',
  ].join('\n'));

  const r = spawnSync(process.execPath, [SCRIPT, 'judge', '--response', response, '--context', context, '--json'], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
  });

  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  assert.deepStrictEqual(loadWeights(dir), {});

  fs.rmSync(dir, { recursive: true });
});

test('sigmap judge --learn no-op band reports skipped learning', () => {
  const dir = makeProject();
  fs.writeFileSync(path.join(dir, 'src', 'auth.js'), 'function loginUser() {}\nfunction validateToken() {}\n');
  const response = path.join(dir, 'response.txt');
  const context = path.join(dir, 'context.md');
  fs.writeFileSync(response, 'loginUser validateToken weather sunny');
  fs.writeFileSync(context, [
    '# SigMap Query Context',
    '',
    '## src/auth.js',
    '```',
    'function loginUser()',
    'function validateToken()',
    '```',
    '',
  ].join('\n'));

  const r = spawnSync(process.execPath, [SCRIPT, 'judge', '--response', response, '--context', context, '--learn', '--json'], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
  });

  assert.strictEqual(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  const parsed = JSON.parse(r.stdout.trim());
  assert.ok(parsed.learning, 'missing learning object');
  assert.strictEqual(parsed.learning.applied, false);
  assert.ok(parsed.learning.reason.includes('no-op band'));
  assert.deepStrictEqual(loadWeights(dir), {});

  fs.rmSync(dir, { recursive: true });
});

test('learned weights change --query ranking in a temp project', () => {
  const dir = makeProject();
  fs.writeFileSync(path.join(dir, 'src', 'alpha.js'), 'function loginUser() {}\nmodule.exports = { loginUser };\n');
  fs.writeFileSync(path.join(dir, 'src', 'beta.js'), 'function loginUser() {}\nmodule.exports = { loginUser };\n');

  let r = spawnSync(process.execPath, [SCRIPT], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `generate exit ${r.status}\nstderr: ${r.stderr}`);

  r = spawnSync(process.execPath, [SCRIPT, '--query', 'login user', '--json'], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `query exit ${r.status}\nstderr: ${r.stderr}`);
  let parsed = JSON.parse(r.stdout.trim());
  assert.strictEqual(parsed.results[0].file, 'src/alpha.js');

  r = spawnSync(process.execPath, [SCRIPT, 'learn', '--good', 'src/beta.js'], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `learn exit ${r.status}\nstderr: ${r.stderr}`);

  r = spawnSync(process.execPath, [SCRIPT, '--query', 'login user', '--json'], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
  });
  assert.strictEqual(r.status, 0, `query exit ${r.status}\nstderr: ${r.stderr}`);
  parsed = JSON.parse(r.stdout.trim());
  assert.strictEqual(parsed.results[0].file, 'src/beta.js');

  fs.rmSync(dir, { recursive: true });
});

try { resetWeights(ROOT); } catch (_) {}

console.log('');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
