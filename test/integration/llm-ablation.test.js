'use strict';

/**
 * Integration tests for the LLM A/B ablation harness (IMPL §9).
 *   buildGrounding · scoreAnswer · runAblation (injected completer) · script skip
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts', 'run-llm-ablation.mjs');
const { buildGrounding, scoreAnswer, runAblation } = require(path.join(ROOT, 'src/eval/llm-ablation'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

// A repo with one real symbol + a generated index, so verify() can flag fakes.
function withRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ablation-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'core.js'),
      'function realCoreFn(x){ return x; }\nmodule.exports = { realCoreFn };\n');
    execFileSync(process.execPath, [path.join(ROOT, 'gen-context.js')], { cwd: dir, stdio: 'ignore' });
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── buildGrounding ──────────────────────────────────────────────────────────
test('buildGrounding: non-empty, includes conventions + known symbols', () => {
  withRepo((dir) => {
    const g = buildGrounding(dir);
    assert.ok(g.length > 0, 'grounding is non-empty');
    assert.ok(/Conventions/.test(g), 'has conventions block');
    assert.ok(/realCoreFn/.test(g), 'lists the real symbol');
  });
});

// ── scoreAnswer ─────────────────────────────────────────────────────────────
test('scoreAnswer: flags a fake symbol, clears a real one', () => {
  withRepo((dir) => {
    const fake = scoreAnswer('Call `totallyFakeSymbol(...)` in `src/ghost.js`.', dir);
    const real = scoreAnswer('Use `realCoreFn(...)`.', dir);
    assert.ok(fake > 0, `fake answer should flag, got ${fake}`);
    assert.ok(fake > real, `fake (${fake}) should flag more than real (${real})`);
  });
});

// ── runAblation ─────────────────────────────────────────────────────────────
test('runAblation: injected completer; aggregate has the A/B shape', () => {
  withRepo((dir) => {
    const tasks = [{ id: 't1', prompt: 'write code' }];
    // completer ignores grounding, always real → both arms clean
    const complete = () => 'Use `realCoreFn(...)`.';
    const r = runAblation(tasks, dir, complete);
    assert.strictEqual(r.tasks.length, 1);
    for (const k of ['n', 'withoutFlagged', 'withFlagged', 'delta', 'withoutPer100', 'withPer100']) {
      assert.ok(k in r.aggregate, `aggregate has ${k}`);
    }
    assert.strictEqual(r.aggregate.n, 1);
  });
});
test('runAblation: grounding reduces flagged errors (delta > 0)', () => {
  withRepo((dir) => {
    const tasks = [{ id: 't1', prompt: 'P1' }, { id: 't2', prompt: 'P2' }];
    // Hallucinate ONLY when the prompt lacks the grounding marker (a known symbol).
    const complete = (prompt) => (/realCoreFn/.test(prompt)
      ? 'Use `realCoreFn(...)`.'                       // grounded → real
      : 'Call `madeUpSymbolXyz(...)` in `src/none.js`.'); // ungrounded → 2 fakes
    const r = runAblation(tasks, dir, complete);
    assert.ok(r.aggregate.withoutFlagged > 0, 'ungrounded arm flags errors');
    assert.strictEqual(r.aggregate.withFlagged, 0, 'grounded arm is clean');
    assert.ok(r.aggregate.delta > 0, `delta should be positive, got ${r.aggregate.delta}`);
  });
});
test('runAblation: calls completer twice per task (ungrounded + grounded)', () => {
  withRepo((dir) => {
    let calls = 0;
    const complete = () => { calls++; return 'Use `realCoreFn(...)`.'; };
    runAblation([{ id: 'a', prompt: 'x' }, { id: 'b', prompt: 'y' }], dir, complete, { grounding: 'G' });
    assert.strictEqual(calls, 4, 'two tasks × two arms = 4 calls');
  });
});

// ── script (skip path) ──────────────────────────────────────────────────────
test('script: exits 0 with guidance when ANTHROPIC_API_KEY is absent', () => {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  const res = spawnSync('node', [SCRIPT], { cwd: ROOT, encoding: 'utf8', env });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(/ANTHROPIC_API_KEY not set/.test(res.stdout), 'prints skip guidance');
  assert.ok(/harness is ready/.test(res.stdout));
});

console.log(`\nllm-ablation: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
