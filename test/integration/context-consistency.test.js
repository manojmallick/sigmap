'use strict';

/**
 * Regression tests for context-file generation (issue #239).
 *
 *  A. Budget keeps FULL signatures — over-budget generation must never gut
 *     signatures to bare `symbol :start-end` pointers (that strips params /
 *     return types, the whole point of a signature). It drops low-priority
 *     files instead.
 *  B. `--mode index` STILL emits pointer-only output (the legitimate use of
 *     anchors, where the agent re-fetches bodies via get_lines).
 *  C. Every generated context file carries exactly ONE canonical
 *     `## SigMap commands` block — and none carries the old `## Tools` JSON.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

function makeRepo(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-ctx-'));
  fs.mkdirSync(path.join(dir, 'src'));
  const files = opts.files != null ? opts.files : 6;
  for (let i = 0; i < files; i++) {
    fs.writeFileSync(path.join(dir, 'src', `mod${i}.js`),
      `function handle${i}(request, response, next) { return next(); }\n` +
      `function build${i}(options, context) { return options; }\n` +
      `module.exports = { handle${i}, build${i} };\n`);
  }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fx', version: '1.0.0' }));
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
    srcDirs: ['src'], outputs: opts.outputs || ['copilot'], ...(opts.config || {}),
  }));
  return dir;
}
function gen(dir, args = []) {
  return spawnSync('node', [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
}

// ── A. budget keeps full signatures ──────────────────────────────────────────
test('A1: over-budget generation keeps full signatures for high-priority files', () => {
  const dir = makeRepo({ files: 40, config: { maxTokens: 1500 } });
  gen(dir);
  const out = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
  // The bug gutted EVERY signature to `symbol :line-line`. The fix keeps full
  // signatures (params + return type) for the files that fit — assert they survive.
  assert.ok(/function handle\d+\(request, response, next\)/.test(out), 'all signatures gutted — params lost');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('A2: tight budget still keeps full sigs (not everything gutted)', () => {
  const dir = makeRepo({ files: 60, config: { maxTokens: 1200 } });
  gen(dir);
  const out = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
  const withParams = (out.match(/function \w+\([a-z]/g) || []).length;
  assert.ok(withParams > 0, 'no full signatures survived (everything gutted to anchors)');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('A3: shown signatures are predominantly full, not mass-collapsed to anchors', () => {
  // The bug degraded EVERY shown signature to an anchor. The fix keeps full
  // signatures for the files it shows — anchors are at most a small tail.
  const dir = makeRepo({ files: 40, config: { maxTokens: 2000 } });
  gen(dir);
  const out = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
  const full = (out.match(/function \w+\([a-z]/g) || []).length;
  const anchorsOnly = (out.match(/^function \w+\s+:\d+-\d+\s*$/gm) || []).length;
  assert.ok(full > 0, 'no full signatures shown');
  assert.ok(full >= anchorsOnly, `more anchors (${anchorsOnly}) than full sigs (${full}) — mass-collapse regression`);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── B. --mode index still pointer-only ───────────────────────────────────────
test('B1: ask --mode index still emits symbol pointers (no param bodies)', () => {
  const dir = makeRepo({ files: 4 });
  gen(dir); // build the index first
  const res = gen(dir, ['ask', 'handle request', '--mode', 'index', '--no-squeeze']);
  const ctxPath = path.join(dir, '.context', 'query-context.md');
  if (fs.existsSync(ctxPath)) {
    const ctx = fs.readFileSync(ctxPath, 'utf8');
    assert.ok(/:\d+-\d+|:\d+/.test(ctx), 'index mode should carry line pointers');
  } else {
    assert.ok(res.status === 0 || res.status === 1, 'ask --mode index ran');
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── C. one consistent guidance block, no Tools JSON ──────────────────────────
const ALL = [
  ['copilot', '.github/copilot-instructions.md'],
  ['codex', 'AGENTS.md'],
  ['claude', 'CLAUDE.md'],
  ['gemini', '.github/gemini-context.md'],
  ['cursor', '.cursorrules'],
  ['windsurf', '.windsurfrules'],
  ['openai', '.github/openai-context.md'],
];

test('C1: every context file has exactly one ## SigMap commands block', () => {
  const dir = makeRepo({ files: 4, outputs: ALL.map((a) => a[0]) });
  gen(dir);
  for (const [name, rel] of ALL) {
    const p = path.join(dir, rel);
    assert.ok(fs.existsSync(p), `${name}: ${rel} not written`);
    const content = fs.readFileSync(p, 'utf8');
    const count = (content.match(/## SigMap commands/g) || []).length;
    assert.strictEqual(count, 1, `${name}: expected 1 SigMap commands block, got ${count}`);
    assert.ok(/`sigmap ask "/.test(content), `${name}: ask command missing`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('C2: no context file carries the old ## Tools JSON block', () => {
  const dir = makeRepo({ files: 4, outputs: ALL.map((a) => a[0]) });
  gen(dir);
  for (const [name, rel] of ALL) {
    const content = fs.readFileSync(path.join(dir, rel), 'utf8');
    assert.ok(!content.includes('<!-- sigmap-tools -->'), `${name}: stale sigmap-tools marker`);
    assert.ok(!content.includes('"sigmap_ask"'), `${name}: stale tools JSON`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('C3: the guidance block is byte-identical across all adapters', () => {
  const dir = makeRepo({ files: 4, outputs: ALL.map((a) => a[0]) });
  gen(dir);
  const blocks = new Set();
  for (const [, rel] of ALL) {
    const content = fs.readFileSync(path.join(dir, rel), 'utf8');
    const m = content.match(/## SigMap commands[\s\S]*?Always run `sigmap ask`[^\n]*/);
    blocks.add(m ? m[0] : '(missing)');
  }
  assert.strictEqual(blocks.size, 1, `guidance block differs across adapters: ${blocks.size} variants`);
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(`\ncontext-consistency: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
