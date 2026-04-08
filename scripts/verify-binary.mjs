#!/usr/bin/env node
/**
 * verify-binary.mjs — Phase A: smoke-test the built sigmap binary
 *
 * Verifies that the binary for the current platform:
 *   1. Prints a version string and exits 0
 *   2. Prints help and exits 0
 *   3. Generates context (no args) on a fixture repo and produces output
 *   4. Runs --health on the fixture repo and exits 0
 *   5. Runs --report on the fixture repo and exits 0
 *
 * Usage:
 *   node scripts/verify-binary.mjs
 */

import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { arch, platform, tmpdir } from 'os';
import { fileURLToPath } from 'url';

const ROOT    = fileURLToPath(new URL('..', import.meta.url));
const DIST    = join(ROOT, 'dist');
const FIXTURE = join(ROOT, 'test', 'fixtures', 'binary-smoke');

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label, err) {
  console.error(`  ✗ ${label}`);
  if (err) console.error(`    ${err.message || err}`);
  failed++;
}

function run(binary, args, cwd) {
  return execFileSync(binary, args, { cwd, encoding: 'utf8', timeout: 30_000 });
}

// ── Locate binary ─────────────────────────────────────────────────────────────

function binaryName() {
  const plat = platform();
  const cpu  = arch();
  const ext  = plat === 'win32' ? '.exe' : '';
  return `sigmap-${plat}-${cpu}${ext}`;
}

const name   = binaryName();
const binary = join(DIST, name);

console.log(`\n── verify-binary: ${name} ────────────────────────────────────────────────`);

if (!existsSync(binary)) {
  console.error(`\nERROR: binary not found at ${binary}`);
  console.error('Run  node scripts/build-binary.mjs  first.\n');
  process.exit(1);
}

if (!existsSync(FIXTURE)) {
  console.error(`\nERROR: fixture not found at ${FIXTURE}`);
  console.error('Expected: test/fixtures/binary-smoke/\n');
  process.exit(1);
}

// Copy fixture to a temp dir outside the repo so sigmap's project-root detection
// doesn't walk up to the worktree .git and use the wrong root.
const TMPDIR = mkdtempSync(join(tmpdir(), 'sigmap-smoke-'));
cpSync(FIXTURE, TMPDIR, { recursive: true });
process.on('exit', () => { try { rmSync(TMPDIR, { recursive: true, force: true }); } catch (_) {} });
console.log(`  (temp fixture: ${TMPDIR})`);

// ── Test 1: --version ─────────────────────────────────────────────────────────

console.log('\n[1] --version');
try {
  const out = run(binary, ['--version']);
  if (/\d+\.\d+\.\d+/.test(out)) {
    pass(`version string present: ${out.trim()}`);
  } else {
    fail('version string missing or malformed', new Error(`output: ${out}`));
  }
} catch (e) {
  fail('--version exited non-zero', e);
}

// ── Test 2: --help ────────────────────────────────────────────────────────────

console.log('\n[2] --help');
try {
  const out = run(binary, ['--help']);
  if (out.includes('generate') || out.includes('sigmap') || out.includes('Usage')) {
    pass('help output looks valid');
  } else {
    fail('help output missing expected content', new Error(`output: ${out.slice(0, 200)}`));
  }
} catch (e) {
  fail('--help exited non-zero', e);
}

// ── Test 3: generate ──────────────────────────────────────────────────────────

console.log('\n[3] generate (no args — default behaviour)');
try {
  run(binary, [], TMPDIR);
  const outputFile = join(TMPDIR, '.github', 'copilot-instructions.md');
  if (existsSync(outputFile)) {
    const content = readFileSync(outputFile, 'utf8');
    if (content.length > 50) {
      pass(`context file created (${content.length} bytes)`);
    } else {
      fail('context file exists but appears empty', new Error(`length: ${content.length}`));
    }
  } else {
    fail('context file not created after generate', new Error(`expected: ${outputFile}`));
  }
} catch (e) {
  fail('generate exited non-zero', e);
}

// ── Test 4: health ────────────────────────────────────────────────────────────

console.log('\n[4] --health (fixture repo)');
try {
  const out = run(binary, ['--health'], TMPDIR);
  if (out.trim().length > 0) {
    pass('--health exited 0 and produced output');
  } else {
    fail('--health exited 0 but produced no output', new Error('empty output'));
  }
} catch (e) {
  fail('health exited non-zero', e);
}

// ── Test 5: report ────────────────────────────────────────────────────────────

console.log('\n[5] --report (fixture repo)');
try {
  const out = run(binary, ['--report'], TMPDIR);
  pass('--report exited 0');
} catch (e) {
  fail('report exited non-zero', e);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n──────────────────────────────────────────────────────────────────────────`);
console.log(`  ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
