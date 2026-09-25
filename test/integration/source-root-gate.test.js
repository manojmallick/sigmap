'use strict';

/**
 * Source-root coverage gate.
 *
 * The gate itself scores the cloned benchmark repos and skips when they are
 * absent — which is every CI run, since `benchmarks/repos/` is gitignored.
 * These tests cover it hermetically, so the guard that protects detection is
 * not itself unprotected.
 *
 * The failure class both exist for: detection silently reaches almost nothing,
 * every other gate still passes, and nobody notices. It happened twice —
 * the CI extractor was inert through a whole release, and multi-module JVM
 * layouts indexed 4 files of 596 for far longer.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const GATE = path.join(ROOT, 'scripts', 'run-source-root-gate.mjs');
const BASELINE = path.join(ROOT, 'benchmarks', 'source-root-baseline.json');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/** Run the gate with `benchmarks/repos` pointed at a throwaway tree. */
function runGate(args, cwd) {
  const res = require('child_process').spawnSync('node', [GATE, ...args], {
    cwd: cwd || ROOT, encoding: 'utf8',
  });
  return { status: res.status, out: (res.stdout || '') + (res.stderr || '') };
}

test('the gate script is valid and self-describing', () => {
  const src = fs.readFileSync(GATE, 'utf8');
  assert.ok(/--gate/.test(src) && /--save/.test(src) && /--json/.test(src),
    'gate must document its three modes');
  // The rationale must survive refactors — it is the reason the file exists.
  assert.ok(/cannot report what/i.test(src),
    'the gate must state why existing gates do not catch this');
});

test('a committed baseline exists and is well-formed', () => {
  const b = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  assert.ok(Array.isArray(b.repos) && b.repos.length > 10,
    `expected a real baseline, got ${b.repos && b.repos.length} repos`);
  for (const r of b.repos) {
    assert.ok(r.repo, 'every row needs a repo name');
    assert.ok(Number.isInteger(r.reached) && r.reached >= 0, `${r.repo}: bad reached`);
    assert.ok(Number.isInteger(r.present) && r.present > 0, `${r.repo}: bad present`);
    assert.ok(r.reached <= r.present,
      `${r.repo}: reached ${r.reached} exceeds present ${r.present} — double counting`);
  }
});

test('the baseline records the JVM layouts this gate exists to protect', () => {
  const b = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const byName = new Map(b.repos.map((r) => [r.repo, r]));
  // okhttp reached 1 file before v8.51.0; akka 28. If either is anywhere near
  // that again, the fix has been reverted.
  const okhttp = byName.get('okhttp');
  if (okhttp) {
    assert.ok(okhttp.reached > 100,
      `okhttp baseline recorded at ${okhttp.reached} files — recorded while broken?`);
  }
  const akka = byName.get('akka');
  if (akka) {
    assert.ok(akka.reached > 100,
      `akka baseline recorded at ${akka.reached} files — recorded while broken?`);
  }
});

test('the gate exits 0 when the benchmark repos are absent', () => {
  // Every CI run hits this path — benchmarks/repos is gitignored — so a fresh
  // checkout must never break on it.
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-norepos-'));
  try {
    const res = require('child_process').spawnSync('node', [GATE, '--gate'], {
      cwd: ROOT, encoding: 'utf8',
      env: Object.assign({}, process.env, { SIGMAP_BENCH_REPOS: empty }),
    });
    assert.strictEqual(res.status, 0,
      `gate must skip, not fail, without repos:\n${res.stdout}${res.stderr}`);
    assert.ok(/repos not cloned|gate skipped/i.test(res.stdout || ''),
      `gate did not announce the skip:\n${res.stdout}`);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test('the gate fails when a repo collapses below the floor', () => {
  // The whole point: a layout that reaches almost nothing must fail loudly.
  // Built as a JVM multi-module tree whose source sits where detection can
  // see it, then measured against a baseline claiming far more.
  const corpus = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-corpus-'));
  try {
    const repo = path.join(corpus, 'tinylib');
    // 40 source files, but all buried where nothing will claim them as a root.
    const buried = path.join(repo, 'nested', 'deeply', 'hidden', 'away', 'code');
    fs.mkdirSync(buried, { recursive: true });
    for (let i = 0; i < 40; i++) {
      fs.writeFileSync(path.join(buried, `F${i}.kt`), `class F${i} { fun go(): Int = 1 }\n`);
    }
    const res = require('child_process').spawnSync('node', [GATE, '--gate'], {
      cwd: ROOT, encoding: 'utf8',
      env: Object.assign({}, process.env, { SIGMAP_BENCH_REPOS: corpus }),
    });
    const out = (res.stdout || '') + (res.stderr || '');
    assert.strictEqual(res.status, 1, `gate should have failed on a collapsed repo:\n${out}`);
    assert.ok(/below the .* floor/i.test(out), `gate did not name the floor breach:\n${out}`);
  } finally {
    fs.rmSync(corpus, { recursive: true, force: true });
  }
});

test('the gate passes on the current tree', () => {
  // Skips cleanly when repos are absent; asserts PASS when they are present.
  const { status, out } = runGate(['--gate']);
  assert.strictEqual(status, 0, `gate failed on the current tree:\n${out}`);
  assert.ok(/PASS|gate skipped/.test(out), out);
});

test('--json emits parseable output', () => {
  const { status, out } = runGate(['--json']);
  assert.strictEqual(status, 0);
  if (/gate skipped/.test(out)) return; // repos absent
  const parsed = JSON.parse(out);
  assert.ok(Array.isArray(parsed.repos), 'json mode must emit a repos array');
});

test('npm exposes the gate as a validate script', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['validate:source-roots'], 'validate:source-roots is not wired');
  assert.ok(/--gate/.test(pkg.scripts['validate:source-roots']),
    'the validate script must enforce, not just report');
});

console.log('');
console.log(`source-root-gate: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
