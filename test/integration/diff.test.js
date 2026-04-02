'use strict';

/**
 * Integration tests for --diff and --diff --staged flags.
 * Validates v1.3 diff-mode context generation.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpRepo(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cf-diff-${name}-`));
  execSync('git init -b main', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });
  return dir;
}

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commit(dir, msg) {
  execSync('git add -A', { cwd: dir, stdio: 'ignore' });
  execSync(`git commit -m "${msg}"`, { cwd: dir, stdio: 'ignore' });
}

function stageFile(dir, rel) {
  execSync(`git add "${rel}"`, { cwd: dir, stdio: 'ignore' });
}

function runDiff(dir, extraArgs = '') {
  const script = path.resolve(__dirname, '../../gen-context.js');
  return spawnSync('node', [script, '--diff', ...extraArgs.split(' ').filter(Boolean)], {
    cwd: dir, encoding: 'utf8',
  });
}

function writeConfig(dir, config) {
  writeFile(dir, 'gen-context.config.json', JSON.stringify(config, null, 2));
}

function readOutput(dir) {
  return fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('--diff: only generates context for changed files (not all files)', () => {
  const dir = makeTmpRepo('diff-1');

  writeFile(dir, 'src/unchanged.js', 'function stableFunction(x) { return x; }');
  writeFile(dir, 'src/changed.js', 'function originalFn(x) { return x; }');
  commit(dir, 'initial');

  writeConfig(dir, { srcDirs: ['src'] });
  commit(dir, 'add config');

  // Modify only one file (uncommitted)
  writeFile(dir, 'src/changed.js', 'function updatedFn(x, y) { return x + y; }');

  const result = runDiff(dir);
  assert.strictEqual(result.status, 0, `Process exited with ${result.status}: ${result.stderr}`);

  const output = readOutput(dir);
  assert.ok(output.includes('updatedFn'), 'Output must include changed file signature');
  assert.ok(!output.includes('stableFunction'), 'Output must NOT include unchanged file signature');
});

test('--diff --staged: only includes staged files, not unstaged', () => {
  const dir = makeTmpRepo('diff-staged-1');

  writeFile(dir, 'src/alpha.js', 'function alphaFn() {}');
  writeFile(dir, 'src/beta.js', 'function betaFn() {}');
  commit(dir, 'initial');

  writeConfig(dir, { srcDirs: ['src'] });
  commit(dir, 'add config');

  // Modify both files but only stage one
  writeFile(dir, 'src/alpha.js', 'function alphaFnV2(x) { return x; }');
  writeFile(dir, 'src/beta.js', 'function betaFnV2(y) { return y; }');
  stageFile(dir, 'src/alpha.js');
  // beta.js is modified but NOT staged

  const result = runDiff(dir, '--staged');
  assert.strictEqual(result.status, 0, `Process exited with ${result.status}: ${result.stderr}`);

  const output = readOutput(dir);
  assert.ok(output.includes('alphaFnV2'), 'Output must include staged file signature');
  assert.ok(!output.includes('betaFnV2'), 'Output must NOT include unstaged file signature');
});

test('--diff: falls back to full generate when no diff files found', () => {
  const dir = makeTmpRepo('diff-fallback-1');

  writeFile(dir, 'src/index.js', 'function mainEntry(opts) {}');
  commit(dir, 'initial');

  writeConfig(dir, { srcDirs: ['src'] });
  commit(dir, 'add config');

  // No uncommitted changes — diff should be empty, expect fallback
  const result = runDiff(dir);
  assert.strictEqual(result.status, 0, `Process exited with ${result.status}: ${result.stderr}`);

  // Output exists and contains the full codebase signatures (fallback)
  const output = readOutput(dir);
  assert.ok(output.includes('mainEntry'), 'Fallback output must include existing signatures');
  assert.ok(result.stderr.includes('no changed files') || result.stderr.includes('running full generate') || output.includes('mainEntry'),
    'Should warn about fallback or still produce valid output');
});

test('--diff: falls back to full generate when outside a git repo', () => {
  // Create a plain temp directory — NOT a git repo
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-diff-nogit-'));
  writeFile(dir, 'src/index.js', 'function helperFn(data) { return data; }');
  writeConfig(dir, { srcDirs: ['src'] });

  const result = runDiff(dir);
  assert.strictEqual(result.status, 0, `Process exited with ${result.status}: ${result.stderr}`);

  // The fallback full generate should have produced output
  const outputPath = path.join(dir, '.github', 'copilot-instructions.md');
  assert.ok(fs.existsSync(outputPath), 'Output file must exist after fallback');
});

test('--diff: changed file outside srcDirs triggers full-generate fallback', () => {
  const dir = makeTmpRepo('diff-outside-1');

  writeFile(dir, 'src/core.js', 'function coreLogic(v) {}');
  commit(dir, 'initial');

  writeConfig(dir, { srcDirs: ['src'] });
  commit(dir, 'add config');

  // Modify file outside srcDirs
  writeFile(dir, 'scripts/deploy.sh', '#!/bin/sh\necho "deploying"');

  const result = runDiff(dir);
  assert.strictEqual(result.status, 0, `Process exited with ${result.status}: ${result.stderr}`);

  // Should have fallen back — output exists
  const outputPath = path.join(dir, '.github', 'copilot-instructions.md');
  assert.ok(fs.existsSync(outputPath), 'Output must exist after fallback');
});

test('--diff: multiple changed files all appear in output', () => {
  const dir = makeTmpRepo('diff-multi-1');

  writeFile(dir, 'src/a.js', 'function aOriginal() {}');
  writeFile(dir, 'src/b.js', 'function bOriginal() {}');
  writeFile(dir, 'src/c.js', 'function cOriginal() {}');
  commit(dir, 'initial');

  writeConfig(dir, { srcDirs: ['src'] });
  commit(dir, 'add config');

  // Modify all three
  writeFile(dir, 'src/a.js', 'function aUpdated(x) {}');
  writeFile(dir, 'src/b.js', 'function bUpdated(y) {}');
  writeFile(dir, 'src/c.js', 'function cUpdated(z) {}');

  const result = runDiff(dir);
  assert.strictEqual(result.status, 0, `Process exited with ${result.status}: ${result.stderr}`);

  const output = readOutput(dir);
  assert.ok(output.includes('aUpdated'), 'Output must include a.js signature');
  assert.ok(output.includes('bUpdated'), 'Output must include b.js signature');
  assert.ok(output.includes('cUpdated'), 'Output must include c.js signature');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('');
console.log('diff mode:');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
