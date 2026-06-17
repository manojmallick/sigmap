'use strict';

/**
 * Integration tests for `sigmap conventions --update` (Layer 3 — incremental rescan).
 *   changedSince · planUpdate · CLI (initial / up-to-date / rescan)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { changedSince, planUpdate } = require(path.join(ROOT, 'src/conventions/update'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

function withRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-upd-'));
  try { fs.mkdirSync(path.join(dir, 'src')); fn(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// Set a file's mtime deterministically (avoids same-ms flakiness).
function setMtime(p, ms) { const s = ms / 1000; fs.utimesSync(p, s, s); }

// ── changedSince ────────────────────────────────────────────────────────────
test('changedSince: only files newer than the threshold', () => {
  withRepo((dir) => {
    const a = path.join(dir, 'src', 'a.js'); const b = path.join(dir, 'src', 'b.js');
    fs.writeFileSync(a, '1'); fs.writeFileSync(b, '2');
    setMtime(a, 1000); setMtime(b, 5000);
    assert.deepStrictEqual(changedSince([a, b], 3000), [b]);
    assert.deepStrictEqual(changedSince([a, b], 6000), []);
  });
});

// ── planUpdate ──────────────────────────────────────────────────────────────
test('planUpdate: stale when no snapshot exists', () => {
  withRepo((dir) => {
    const a = path.join(dir, 'src', 'a.js'); fs.writeFileSync(a, '1');
    const plan = planUpdate(dir, [a], path.join(dir, '.context', 'conventions.json'));
    assert.strictEqual(plan.snapshotExists, false);
    assert.strictEqual(plan.stale, true);
  });
});
test('planUpdate: not stale when all files predate the snapshot', () => {
  withRepo((dir) => {
    const a = path.join(dir, 'src', 'a.js'); fs.writeFileSync(a, '1'); setMtime(a, 1000);
    const snap = path.join(dir, 'snap.json'); fs.writeFileSync(snap, '{}'); setMtime(snap, 5000);
    const plan = planUpdate(dir, [a], snap);
    assert.strictEqual(plan.stale, false);
    assert.deepStrictEqual(plan.changed, []);
  });
});
test('planUpdate: stale when a file is newer than the snapshot', () => {
  withRepo((dir) => {
    const a = path.join(dir, 'src', 'a.js'); fs.writeFileSync(a, '1'); setMtime(a, 9000);
    const snap = path.join(dir, 'snap.json'); fs.writeFileSync(snap, '{}'); setMtime(snap, 5000);
    const plan = planUpdate(dir, [a], snap);
    assert.strictEqual(plan.stale, true);
    assert.deepStrictEqual(plan.changed, [a]);
  });
});

// ── CLI ─────────────────────────────────────────────────────────────────────
test('CLI: first --update does the initial scan and writes the snapshot', () => {
  withRepo((dir) => {
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const a=1;\n');
    const res = spawnSync('node', [SCRIPT, 'conventions', '--update'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(/initial scan/.test(res.stdout));
    assert.ok(fs.existsSync(path.join(dir, '.context', 'conventions.json')));
  });
});
test('CLI: second --update with no changes reports up to date', () => {
  withRepo((dir) => {
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const a=1;\n');
    const run = () => spawnSync('node', [SCRIPT, 'conventions', '--update'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(run().status, 0);
    const res = run();
    assert.ok(/up to date/.test(res.stdout), res.stdout);
  });
});
test('CLI: --update rescans after a file changes', () => {
  withRepo((dir) => {
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const a=1;\n');
    spawnSync('node', [SCRIPT, 'conventions', '--update'], { cwd: dir, encoding: 'utf8' });
    // make a new file strictly newer than the snapshot
    const snap = path.join(dir, '.context', 'conventions.json');
    const newer = fs.statSync(snap).mtimeMs + 5000;
    const nf = path.join(dir, 'src', 'bazQux.js');
    fs.writeFileSync(nf, 'export const b=2;\n'); setMtime(nf, newer);
    const res = spawnSync('node', [SCRIPT, 'conventions', '--update'], { cwd: dir, encoding: 'utf8' });
    assert.ok(/rescanned/.test(res.stdout), res.stdout);
  });
});
test('CLI: --update --json emits the result', () => {
  withRepo((dir) => {
    fs.writeFileSync(path.join(dir, 'src', 'aaa.js'), 'export const a=1;\n');
    const res = spawnSync('node', [SCRIPT, 'conventions', '--update', '--json'], { cwd: dir, encoding: 'utf8' });
    const data = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.strictEqual(typeof data.stale, 'boolean');
    assert.strictEqual(typeof data.scanned, 'number');
  });
});

console.log(`\nconventions-update: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
