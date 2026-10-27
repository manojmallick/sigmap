'use strict';

/**
 * #1007 — `sigmap verify` must not read "checked and clean" when the symbol
 * check did not run.
 *
 * In a repository that has never been indexed the symbol set is empty, so the
 * fake-symbol pass is skipped (`summary.checks.symbols === false`). The human
 * report used to say "✓ no hallucinations detected" anyway, and said nothing
 * at all when a different claim failed.
 *
 *   1. un-indexed, every other claim clean → names the skipped check, no unqualified verdict
 *   2. un-indexed, another claim fails     → the failure is reported AND the skip is named
 *   3. indexed                             → the same repo, same answer: the fake symbol is found, no skip note
 *   4. --json and the exit code are unchanged by the skip note
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-verify-skip-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'util.js'), 'function summarize(a) { return a; }\nmodule.exports = { summarize };\n');
  fs.writeFileSync(path.join(dir, 'clean.md'), 'Then call `authorize()` to finish.\n');
  fs.writeFileSync(path.join(dir, 'broken.md'), 'Edit `src/ghost.js`, then call `authorize()` to finish.\n');
  return dir;
}

function verify(dir, answer, extra = []) {
  return spawnSync('node', [SCRIPT, 'verify', path.join(dir, answer), '--cwd', dir, ...extra], { cwd: ROOT, encoding: 'utf8' });
}

const unindexed = makeRepo();
const indexed = makeRepo();
spawnSync('node', [SCRIPT, '--cwd', indexed], { cwd: ROOT, encoding: 'utf8' });

test('un-indexed repo, other claims clean: the skipped symbol check is named', () => {
  const res = verify(unindexed, 'clean.md');
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/symbol check skipped/.test(res.stdout), `expected a skip note, got:\n${res.stdout}`);
  assert.ok(!/no hallucinations detected/.test(res.stdout), `must not claim an unqualified clean verdict:\n${res.stdout}`);
  assert.ok(!/✓/.test(res.stdout), `no green mark when a claim class was not checked:\n${res.stdout}`);
});

test('un-indexed repo, another claim fails: the failure and the skipped check are both reported', () => {
  const res = verify(unindexed, 'broken.md');
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.ok(/src\/ghost\.js/.test(res.stdout), 'reports the fake file');
  assert.ok(/symbol check skipped/.test(res.stdout), `expected a skip note, got:\n${res.stdout}`);
});

test('indexed repo: the fabricated function is reported and there is no skip note', () => {
  const res = verify(indexed, 'clean.md');
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.ok(/\[Fake symbol\].*authorize/.test(res.stdout), `expected the fake symbol:\n${res.stdout}`);
  assert.ok(!/symbol check skipped/.test(res.stdout), 'an index exists, so nothing was skipped');
});

test('indexed repo, nothing fabricated: the verdict line is unchanged', () => {
  fs.writeFileSync(path.join(indexed, 'real.md'), 'Then call `summarize()` to finish.\n');
  const res = verify(indexed, 'real.md');
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/✓ real\.md — no hallucinations detected \(\d+ symbols indexed\)/.test(res.stdout), res.stdout);
  assert.ok(!/skipped/.test(res.stdout));
});

test('--json still reports checks.symbols=false and the skip note is not mixed into it', () => {
  const res = verify(unindexed, 'clean.md', ['--json']);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  const lines = res.stdout.trim().split('\n').filter((l) => !l.startsWith('[sigmap] --cwd'));
  assert.strictEqual(lines.length, 1, `--json prints a single document:\n${res.stdout}`);
  const obj = JSON.parse(lines[0]);
  assert.strictEqual(obj.summary.checks.symbols, false);
  assert.strictEqual(obj.summary.clean, true);
});

for (const d of [unindexed, indexed]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }

console.log(`\nverify-skipped-symbol-check: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
