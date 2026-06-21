'use strict';

/**
 * Single source of benchmark truth (scripts/gen-benchmark-latest.mjs).
 * latest.json is derived from benchmarks/reports/ and gated for drift (H1).
 * Run: node test/integration/benchmark-latest.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts', 'gen-benchmark-latest.mjs');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

(async () => {
  const mod = await import('url').then((u) => import(u.pathToFileURL(SCRIPT).href));
  const { computeLatest, latestInSync } = mod;

  test('computeLatest mirrors the committed benchmark reports', () => {
    const matrix = require(path.join(ROOT, 'benchmarks/reports/benchmark-matrix.json')).metrics;
    const task = require(path.join(ROOT, 'benchmarks/reports/task-benchmark.json')).summary;
    const out = computeLatest(ROOT);
    const round3 = (n) => Math.round(n * 1000) / 1000;
    assert.strictEqual(out.metrics.hit_at_5, round3(matrix.avgHitAt5Pct / 100));
    assert.strictEqual(out.metrics.task_success_proxy_pct, task.correctPct);
    assert.strictEqual(out.metrics.prompts_per_task, task.avgPromptsWith);
    assert.strictEqual(out.repos_token, matrix.reposToken);
    assert.ok(/^sigmap-v\d+\.\d+-main$/.test(out.benchmark_id), out.benchmark_id);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(out.benchmark_date), out.benchmark_date);
  });

  test('benchmarks/latest.json is committed and in sync', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'benchmarks/latest.json')));
    assert.strictEqual(latestInSync(ROOT), true);
  });

  test('committed latest.json equals computeLatest output exactly', () => {
    const have = fs.readFileSync(path.join(ROOT, 'benchmarks/latest.json'), 'utf8');
    assert.strictEqual(have, JSON.stringify(computeLatest(ROOT), null, 2) + '\n');
  });

  test('version.json metrics match latest.json (single source of truth)', () => {
    const vj = require(path.join(ROOT, 'version.json'));
    const latest = computeLatest(ROOT);
    assert.deepStrictEqual(vj.metrics, latest.metrics);
    assert.strictEqual(vj.benchmark_id, latest.benchmark_id);
    assert.strictEqual(vj.benchmark_date, latest.benchmark_date);
  });

  test('CLI --check passes (exit 0) on the committed repo', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--check'], { cwd: ROOT, encoding: 'utf8' });
    assert.ok(/in sync/.test(out), out);
  });

  test('computeLatest is deterministic against a hermetic fixture', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-bench-'));
    try {
      fs.mkdirSync(path.join(dir, 'benchmarks', 'reports'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '9.9.9' }));
      fs.writeFileSync(path.join(dir, 'benchmarks/reports/benchmark-matrix.json'), JSON.stringify({
        generated: '2031-01-02T03:04:05.000Z',
        metrics: { reposToken: 7, reposRetrieval: 5, avgReductionPct: 90, avgHitAt5Pct: 80, taskPromptReductionPct: 30 },
      }));
      fs.writeFileSync(path.join(dir, 'benchmarks/reports/task-benchmark.json'), JSON.stringify({
        summary: { correctPct: 50, avgPromptsWith: 1.5, avgPromptsWithout: 3, hitAt5Without: 10 },
      }));
      fs.writeFileSync(path.join(dir, 'benchmarks/reports/token-reduction.json'), JSON.stringify({ timestamp: 'x' }));
      const out = computeLatest(dir);
      assert.strictEqual(out.benchmark_id, 'sigmap-v9.9-main');
      assert.strictEqual(out.benchmark_date, '2031-01-02');
      assert.strictEqual(out.metrics.hit_at_5, 0.8);
      assert.strictEqual(out.metrics.baseline_hit_at_5, 0.1);
      assert.strictEqual(out.metrics.retrieval_lift, 8); // 80 / 10
      assert.strictEqual(out.repos_token, 7);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  console.log(`\nbenchmark-latest: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
