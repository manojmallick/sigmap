'use strict';

/**
 * Honest grep-agent baseline (v8.19 A1/A2, #495).
 * The published lift must come from the measured grep-agent comparison
 * (benchmarks/reports/honest-baseline.json), and the random baseline /
 * unsourced "10% without" claims must stay off every human surface.
 * Run: node test/integration/honest-baseline.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

(async () => {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/reports/honest-baseline.json'), 'utf8'));
  const latest = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/latest.json'), 'utf8'));
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
  const llmsFull = fs.readFileSync(path.join(ROOT, 'llms-full.txt'), 'utf8');

  test('honest-baseline report has both sides, lift, and per-repo rows', () => {
    const s = report.summary;
    assert.ok(s.tasks >= 100, `tasks=${s.tasks}`);
    assert.ok(s.repos >= 15, `repos=${s.repos}`);
    assert.ok(s.sigmap.hitAt5 > 0 && s.sigmap.hitAt5 <= 1, `sigmap hitAt5=${s.sigmap.hitAt5}`);
    assert.ok(s.grepBaseline.hitAt5 > 0 && s.grepBaseline.hitAt5 < s.sigmap.hitAt5,
      `grep baseline ${s.grepBaseline.hitAt5} must sit below sigmap ${s.sigmap.hitAt5}`);
    assert.ok(s.lift > 1 && s.lift < 5, `lift=${s.lift} must be honest (1–5×), not random-baseline scale`);
    assert.ok(Array.isArray(report.repos) && report.repos.length === s.repos);
  });

  test('latest.json grep metrics derive from the report, not hand-typed', () => {
    const round = (n, d) => Math.round(Number(n) * 10 ** d) / 10 ** d;
    assert.strictEqual(latest.metrics.grep_baseline_hit_at_5, round(report.summary.grepBaseline.hitAt5, 3));
    assert.strictEqual(latest.metrics.grep_lift, round(report.summary.lift, 2));
  });

  test('version.json mirrors the grep metrics (single source of truth)', () => {
    assert.strictEqual(version.metrics.grep_baseline_hit_at_5, latest.metrics.grep_baseline_hit_at_5);
    assert.strictEqual(version.metrics.grep_lift, latest.metrics.grep_lift);
  });

  test('README quotes the grep baseline and labels task success as proxy', () => {
    assert.ok(/grep baseline|grep-agent baseline/.test(readme), 'README missing grep-baseline clause');
    assert.ok(/task-success proxy|proxy — modeled/.test(readme), 'README missing proxy label');
  });

  test('random-baseline lift retired from all human surfaces', () => {
    for (const [name, src] of [['README.md', readme], ['llms.txt', llms], ['llms-full.txt', llmsFull]]) {
      assert.ok(!/6\.4×|6\.4x/.test(src), `${name} still shows the 6.4× random-baseline lift`);
      assert.ok(!/13\.6%/.test(src), `${name} still shows the 13.6% random baseline`);
      assert.ok(!/vs 10% without|baseline 10%|up from 10%/.test(src), `${name} still shows the unsourced 10% claim`);
    }
  });

  test('llms surfaces quote the measured grep lift', () => {
    const liftStr = `${Number(latest.metrics.grep_lift).toFixed(2)}× lift`;
    assert.ok(llms.includes(liftStr) || llmsFull.includes(liftStr), `llms files missing "${liftStr}"`);
  });

  test('benchmark script is zero-dep — no child processes, no shell', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/run-honest-benchmark.mjs'), 'utf8');
    assert.ok(!/child_process|execSync|execFileSync|spawnSync|shell:\s*true/.test(src),
      'honest benchmark must not spawn processes');
  });

  console.log(`\n  honest-baseline: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
