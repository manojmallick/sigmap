'use strict';

/**
 * Integration tests for the init Creation-workflow block (IMPL §6.2 2f).
 *   renderCreationWorkflowBlock · injectCreationWorkflow · CLI (--init)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { renderCreationWorkflowBlock, injectCreationWorkflow, START, END } =
  require(path.join(ROOT, 'src/init/creation-workflow'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

function withRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'init-cw-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── renderCreationWorkflowBlock ─────────────────────────────────────────────
test('render: marker-wrapped, names the 4 stages + create', () => {
  const b = renderCreationWorkflowBlock();
  assert.ok(b.startsWith(START) && b.trimEnd().endsWith(END), 'wrapped in markers');
  for (const cmd of ['scaffold', 'verify-plan', 'verify-ai-output', 'review-pr', 'sigmap create']) {
    assert.ok(b.includes(cmd), `mentions ${cmd}`);
  }
});

// ── injectCreationWorkflow ──────────────────────────────────────────────────
test('inject: appends when absent, preserves existing content', () => {
  const out = injectCreationWorkflow('# Doc\n\nintro\n', renderCreationWorkflowBlock());
  assert.ok(out.includes('# Doc'), 'preserves content');
  assert.ok(out.includes(START) && out.includes(END), 'adds block');
});
test('inject: empty input → just the block', () => {
  const block = renderCreationWorkflowBlock();
  assert.strictEqual(injectCreationWorkflow('', block), block + '\n');
});
test('inject: replaces an existing block in place (idempotent)', () => {
  const block = renderCreationWorkflowBlock();
  const once = injectCreationWorkflow('# Doc\n\nbefore\n', block) + '\nafter\n';
  const twice = injectCreationWorkflow(once, block);
  assert.ok(twice.includes('before') && twice.includes('after'), 'surrounding content kept');
  assert.strictEqual(twice.split(START).length - 1, 1, 'exactly one block');
  // running again is byte-identical
  assert.strictEqual(injectCreationWorkflow(twice, block), twice);
});

// ── CLI (--init) ────────────────────────────────────────────────────────────
test('CLI: --init injects the block into an existing CLAUDE.md', () => {
  withRepo((dir) => {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Hand-written\n\nKeep me.\n');
    const res = spawnSync('node', [SCRIPT, '--init'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    const out = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.ok(out.includes('# Hand-written'), 'preserves human content');
    assert.ok(out.includes('## Creation workflow (SigMap)'), 'adds the block');
    assert.ok(out.includes(START) && out.includes(END));
  });
});
test('CLI: --init creates CLAUDE.md when absent and still writes config', () => {
  withRepo((dir) => {
    const res = spawnSync('node', [SCRIPT, '--init'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')), 'CLAUDE.md created');
    assert.ok(/Creation workflow/.test(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8')));
    // --init still does its config job
    assert.ok(fs.existsSync(path.join(dir, 'gen-context.config.json')), 'config written');
  });
});
test('CLI: --init is idempotent (second run byte-identical)', () => {
  withRepo((dir) => {
    const run = () => spawnSync('node', [SCRIPT, '--init'], { cwd: dir, encoding: 'utf8' });
    run();
    const first = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    run();
    const second = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.strictEqual(first, second, 'CLAUDE.md stable across --init runs');
  });
});

console.log(`\ninit-creation-workflow: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
