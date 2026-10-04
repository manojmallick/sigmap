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

  // ── #704: one population, loud failure on an empty one, per-repo floors ──

  const bench = await import('url').then((u) => import(u.pathToFileURL(SCRIPT).href));

  test('universe is the generator\'s scope: configured srcDirs only, tests and samples excluded', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbench-scope-'));
    try {
      fs.mkdirSync(path.join(dir, 'core'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'samples'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['core'] }));
      fs.writeFileSync(path.join(dir, 'core', 'a.js'), 'function inScope(x){ return x; }\nmodule.exports = { inScope };\n');
      // A test file inside srcDirs: the generator's drop order classes it out, so it is not "dark".
      fs.writeFileSync(path.join(dir, 'core', 'a.test.js'), 'function onlyInTest(x){ return x; }\n');
      // Code outside srcDirs: the index never covers it, so it must not be in the universe.
      fs.writeFileSync(path.join(dir, 'samples', 's.js'), 'function onlyInSamples(x){ return x; }\n');
      const m = bench.measureGrounding(dir);
      assert.strictEqual(m.status, 'measured');
      assert.strictEqual(m.total, 1, `universe should be exactly the in-scope symbol, got ${m.total}`);
      assert.strictEqual(m.files, 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('empty universe is UNMEASURED, with null coverage — never 0%', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbench-empty-'));
    try {
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'src', 'lib.js'), '// facade: no definitions\n');
      const m = bench.measureGrounding(dir);
      assert.strictEqual(m.status, 'unmeasured');
      assert.strictEqual(m.total, 0);
      assert.strictEqual(m.coverage, null);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  const row = (repo, grounded, total) => ({
    repo, status: total > 0 ? 'measured' : 'unmeasured', total, grounded,
    coverage: total > 0 ? grounded / total : null,
  });

  test('judgeRows: an unmeasured repo is reported and excluded from the aggregate', () => {
    const v = bench.judgeRows([row('a', 9, 10), row('clap', 0, 0)], { a: 0.8 });
    assert.deepStrictEqual(v.unmeasured, ['clap']);
    assert.strictEqual(v.total, 10, 'aggregate counts measured repos only');
    assert.strictEqual(v.aggregate, 0.9);
  });

  test('judgeRows: a repo under its own floor fails even when the aggregate is healthy', () => {
    const v = bench.judgeRows([row('big', 990, 1000), row('small', 1, 10)], { big: 0.9, small: 0.5 });
    assert.ok(v.aggregate > 0.9, 'the aggregate hides the regression');
    assert.deepStrictEqual(v.belowFloor.map((b) => b.repo), ['small']);
  });

  test('judgeRows: a measured repo with no recorded floor is flagged', () => {
    const v = bench.judgeRows([row('new-repo', 5, 10)], {});
    assert.deepStrictEqual(v.unfloored, ['new-repo']);
  });

  test('judgeRows: aggregate floor applies only when given', () => {
    assert.strictEqual(bench.judgeRows([row('a', 5, 10)], { a: 0.1 }).aggBelow, false);
    assert.strictEqual(bench.judgeRows([row('a', 5, 10)], { a: 0.1 }, 0.6).aggBelow, true);
  });

  test('floorsFrom: records measured coverage less the margin, skipping unmeasured repos', () => {
    const f = bench.floorsFrom([row('a', 93, 100), row('clap', 0, 0), row('b', 2, 100)]);
    assert.strictEqual(f.a, 0.88);
    assert.strictEqual(f.b, 0, 'a floor never goes negative');
    assert.ok(!('clap' in f), 'an unmeasured repo records no floor');
  });

  console.log(`\nhallucination-benchmark: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
