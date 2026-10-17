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

// ── Test 6: ask ───────────────────────────────────────────────────────────────

console.log('\n[6] ask (v5.x workflow)');
try {
  // Default (#966): the ranked files lead, then one summary line.
  const out = run(binary, ['ask', 'explain the main function'], TMPDIR);
  if (/ of \d+ files · .*tokens · sha256:[0-9a-f]{12} → \S+/.test(out)) {
    pass('ask printed the ranked files and a summary line');
  } else {
    fail('ask output missing the summary line', new Error(`output: ${out.slice(0, 200)}`));
  }
  // --verbose keeps the full header behind the same files.
  const full = run(binary, ['ask', 'explain the main function', '--verbose'], TMPDIR);
  if (full.includes('Intent') && full.includes('Context') && full.includes('sigmap ask')) {
    pass('ask --verbose printed the full header');
  } else {
    fail('ask --verbose output missing header fields', new Error(`output: ${full.slice(0, 200)}`));
  }
} catch (e) {
  fail('ask exited non-zero', e);
}

// ── Test 7: weights ───────────────────────────────────────────────────────────

console.log('\n[7] weights (v5.x workflow)');
try {
  run(binary, ['weights'], TMPDIR);
  pass('weights exited 0');
} catch (e) {
  fail('weights exited non-zero', e);
}

// ── Test 8: history ───────────────────────────────────────────────────────────

console.log('\n[8] history (v5.x workflow)');
try {
  run(binary, ['history'], TMPDIR);
  pass('history exited 0');
} catch (e) {
  fail('history exited non-zero', e);
}

// ── Test 9: bench --submit ────────────────────────────────────────────────────

console.log('\n[9] bench --submit (v5.9 community benchmarks)');
{
  // TMPDIR has no .context/benchmark-history.ndjson, so there is no local
  // metric to submit. Since v8.52.1 text mode exits 1 for exactly that case
  // (#764) — a green exit previously said "ready to paste" for a block
  // carrying nothing measured. The block is still printed, which is what this
  // smoke test is about, so assert on the OUTPUT and accept the non-zero exit.
  let out = '';
  try {
    out = run(binary, ['bench', '--submit'], TMPDIR);
  } catch (e) {
    out = (e && (e.stdout || e.message)) ? String(e.stdout || e.message) : '';
  }
  if (out.includes('SigMap') || out.includes('sigmap')) {
    pass('bench --submit produced output');
  } else {
    fail('bench --submit output missing expected content', new Error(`output: ${out.slice(0, 200)}`));
  }
}

// ── Test 10: bench --submit --json ───────────────────────────────────────────

console.log('\n[10] bench --submit --json (v5.9 machine-readable)');
try {
  const out = run(binary, ['bench', '--submit', '--json'], TMPDIR);
  const data = JSON.parse(out);
  if (data.sigmapVersion && data.benchmarkId) {
    pass(`bench --submit --json valid JSON (version: ${data.sigmapVersion})`);
  } else {
    fail('bench --submit --json missing required fields', new Error(`output: ${out.slice(0, 200)}`));
  }
} catch (e) {
  fail('bench --submit --json failed or produced invalid JSON', e);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n──────────────────────────────────────────────────────────────────────────`);
console.log(`  ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
