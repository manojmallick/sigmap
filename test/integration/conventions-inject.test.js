'use strict';

/**
 * Integration tests for `sigmap conventions --inject` (Layer 3 — CLAUDE.md injection).
 *   renderConventionsBlock · injectConventions (append / replace / idempotent) · CLI
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { renderConventionsBlock, injectConventions, START, END } =
  require(path.join(ROOT, 'src/conventions/inject'));
const { extractConventions } = require(path.join(ROOT, 'src/conventions/extract'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

function withRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-inj-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const sampleResult = {
  fileNaming: { dominant: 'camelCase', dominantPct: 0.8, total: 5, tier: 'mostly',
    variants: [{ label: 'camelCase', count: 4, pct: 0.8 }, { label: 'kebab-case', count: 1, pct: 0.2 }] },
  exportStyle: { dominant: 'named', dominantPct: 1, total: 5, tier: 'consistent',
    variants: [{ label: 'named', count: 5, pct: 1 }] },
  testFramework: 'jest',
};

// ── renderConventionsBlock ──────────────────────────────────────────────────
test('renderConventionsBlock: wrapped in markers', () => {
  const b = renderConventionsBlock(sampleResult, '9.9.9');
  assert.ok(b.startsWith(START), 'starts with start marker');
  assert.ok(b.trimEnd().endsWith(END), 'ends with end marker');
});
test('renderConventionsBlock: lists conventions with samples + tier', () => {
  const b = renderConventionsBlock(sampleResult, '9.9.9');
  assert.ok(/File naming:\*\* camelCase \(80%/.test(b), 'file naming with pct');
  assert.ok(/Export style:\*\* named \(100%/.test(b), 'export style with pct');
  assert.ok(/Test framework:\*\* jest/.test(b), 'test framework');
  assert.ok(b.includes('v9.9.9'), 'version footer');
});
test('renderConventionsBlock: omits conventions with no samples', () => {
  const b = renderConventionsBlock({
    fileNaming: { dominant: null, dominantPct: 0, total: 0, tier: 'unknown', variants: [] },
    exportStyle: { dominant: 'named', dominantPct: 1, total: 3, tier: 'consistent',
      variants: [{ label: 'named', count: 3, pct: 1 }] },
    testFramework: null,
  });
  assert.ok(!/File naming/.test(b), 'no empty file-naming line');
  assert.ok(/Export style/.test(b), 'export style present');
  assert.ok(!/Test framework/.test(b), 'no null test framework line');
});

// ── injectConventions ───────────────────────────────────────────────────────
test('injectConventions: appends when no block present', () => {
  const block = renderConventionsBlock(sampleResult, '1.0.0');
  const out = injectConventions('# My Project\n\nIntro text.\n', block);
  assert.ok(out.includes('# My Project'), 'preserves existing content');
  assert.ok(out.includes(START) && out.includes(END), 'adds block');
});
test('injectConventions: empty existing → just the block', () => {
  const block = renderConventionsBlock(sampleResult, '1.0.0');
  const out = injectConventions('', block);
  assert.strictEqual(out, block + '\n');
});
test('injectConventions: replaces an existing block in place', () => {
  const oldBlock = renderConventionsBlock(sampleResult, '1.0.0');
  const withOld = injectConventions('# Doc\n\nbefore\n', oldBlock) + '\nafter the block\n';
  const newBlock = renderConventionsBlock({ ...sampleResult, testFramework: 'vitest' }, '2.0.0');
  const out = injectConventions(withOld, newBlock);
  assert.ok(out.includes('vitest'), 'has new content');
  assert.ok(!out.includes('jest'), 'old content gone');
  assert.ok(out.includes('after the block'), 'content after block preserved');
  assert.ok(out.includes('before'), 'content before block preserved');
  // exactly one block
  assert.strictEqual(out.split(START).length - 1, 1, 'exactly one start marker');
});
test('injectConventions: idempotent (running twice is byte-identical)', () => {
  const block = renderConventionsBlock(sampleResult, '1.0.0');
  const once = injectConventions('# Doc\n\nintro\n', block);
  const twice = injectConventions(once, renderConventionsBlock(sampleResult, '1.0.0'));
  assert.strictEqual(once, twice);
});

// ── CLI ─────────────────────────────────────────────────────────────────────
test('CLI: --inject creates/updates CLAUDE.md with the block', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'fooBar.js'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'bazQux.js'), 'export const b = 2;\n');
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Hand-written\n\nKeep me.\n');
    const res = spawnSync('node', [SCRIPT, 'conventions', '--inject'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    const out = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.ok(out.includes('# Hand-written'), 'preserves human content');
    assert.ok(out.includes(START) && out.includes(END), 'injects block');
    assert.ok(/Conventions \(auto-detected by SigMap\)/.test(out), 'has heading');
  });
});
test('CLI: --inject creates CLAUDE.md when absent and is idempotent', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'aaa.js'), 'export const a = 1;\n');
    const run = () => spawnSync('node', [SCRIPT, 'conventions', '--inject'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(run().status, 0);
    const first = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.strictEqual(run().status, 0);
    const second = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.strictEqual(first, second, 'idempotent across runs');
  });
});

console.log(`\nconventions-inject: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
