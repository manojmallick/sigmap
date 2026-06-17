'use strict';

/**
 * Grounding benchmark (the GATE) — scripts/run-hallucination-benchmark.mjs.
 * Deterministic, offline. Run: node test/integration/hallucination-benchmark.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const SCRIPT = path.join(ROOT, 'scripts', 'run-hallucination-benchmark.mjs');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

function withRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbench-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'a.js'),
      'function alpha(x){ return x; }\nclass Beta { go(){ return 2; } }\nmodule.exports = { alpha, Beta };\n');
    fs.writeFileSync(path.join(dir, 'src', 'b.js'),
      'function helper(y){ return y * 2; }\nmodule.exports = { helper };\n');
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

(async () => {
  const { measureGrounding } = await import('url').then((u) => import(u.pathToFileURL(SCRIPT).href));

  test('baseline: no index → 0% coverage (every symbol dark)', () => {
    withRepo((dir) => {
      const m = measureGrounding(dir);
      assert.ok(m.total > 0, 'should find defined symbols');
      assert.strictEqual(m.grounded, 0, 'nothing grounded without an index');
      assert.strictEqual(m.coverage, 0);
      assert.strictEqual(m.dark, m.total);
    });
  });

  test('with SigMap: generated index grounds the symbols (ablation holds)', () => {
    withRepo((dir) => {
      execFileSync(process.execPath, [GEN], { cwd: dir, stdio: 'ignore' });
      const m = measureGrounding(dir);
      assert.ok(m.total > 0);
      assert.ok(m.grounded > 0, 'symbols should be grounded after generate');
      assert.ok(m.coverage > 0.5, `coverage should be high for a small repo, got ${m.coverage}`);
      assert.ok(m.dark < m.total, 'fewer dark symbols with SigMap');
    });
  });

  test('measureGrounding shape is stable', () => {
    withRepo((dir) => {
      const m = measureGrounding(dir);
      for (const k of ['total', 'grounded', 'dark', 'coverage']) {
        assert.ok(typeof m[k] === 'number', `${k} should be a number`);
      }
      assert.strictEqual(m.grounded + m.dark, m.total, 'grounded + dark = total');
    });
  });

  console.log(`\nhallucination-benchmark: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
