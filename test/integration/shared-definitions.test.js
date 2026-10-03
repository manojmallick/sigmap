'use strict';

/**
 * The shared definitions stay shared (#848, closes #818).
 *
 * #762 unified the coverage definition and #773 unified the reduction baseline,
 * but neither landed a test that PINS the agreement — so a surface could grow
 * its own arithmetic again, which is how the original defect arose. Two copies
 * were already back when this file was written:
 *
 *   validate   Math.round((valCovered / valTotal) * 100) : 0
 *              agreed everywhere except an empty repo, where it read 0% and
 *              every other surface read 100%
 *   --ci       Math.round((index.size / fileList.length) * 100)
 *              not a ratio at all — the index holds entries the config no
 *              longer scopes, so the release gate reported 241% coverage in
 *              this repo and would have passed a threshold of 200%
 *
 * These guards are structural on purpose: a surface that recomputes the figure
 * fails here even when today's number happens to match.
 *
 * Run: node test/integration/shared-definitions.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const COV = require(path.join(ROOT, 'src', 'analysis', 'coverage-score'));
const USAGE_SRC = require(path.join(ROOT, 'src', 'tracking', 'usage-source'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const source = fs.readFileSync(GEN, 'utf8');
const CLI = source.slice(source.indexOf('// ═══ END SIGMAP BUNDLED MODULES ═══'));

/** A repo big enough that the budget drops files, so in-context < indexed. */
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-shared-'));
  const src = path.join(dir, 'src');
  fs.mkdirSync(src, { recursive: true });
  const line = 'function placeholder(a, b) { return a + b; }\n';
  for (let i = 0; i < 40; i++) {
    let c = '';
    while (c.length < 1500) c += line;
    fs.writeFileSync(path.join(src, `m${i}.js`), c);
  }
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'),
    JSON.stringify({ srcDirs: ['src'], maxTokens: 2000, autoMaxTokens: false, outputs: ['copilot'] }));
  execFileSync(process.execPath, [GEN], { cwd: dir, stdio: 'pipe' });
  return dir;
}

const run = (dir, args) => {
  try { return execFileSync(process.execPath, [GEN, ...args], { cwd: dir, encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { return (e.stdout || '') + (e.stderr || ''); }
};

// `<population> <pct>% (<inc>/<total> <noun>)`
const PARSE = /\b(in-context|indexed|readable)\s+(\d+)%\s+\((\d+)\/(\d+)\s/;
const figure = (out) => {
  const m = out.match(PARSE);
  return m ? { population: m[1], pct: +m[2], included: +m[3], total: +m[4] } : null;
};

console.log('[shared-definitions.test.js] one coverage ratio, one reduction baseline (#848)');
console.log('');

// ── coverage: one ratio, named populations ──────────────────────────────────

test('the file-coverage ratio is defined in exactly one place', () => {
  // `(a / b) * 100` in the CLI core is a coverage/ratio figure unless it is the
  // `1 - x/y` reduction form (covered separately below). Only the token-budget
  // share is a legitimately different quantity computed here.
  const ALLOWED = ['Math.round((hardCap / totalSigTokens) * 100)'];
  const re = /Math\.round\(\(\s*(?!1 -)([^)]*?)\s*\/\s*([^)]*?)\s*\)\s*\* 100\)/g;
  const found = [...CLI.matchAll(re)].map((m) => m[0]).filter((x) => !ALLOWED.includes(x));
  assert.deepStrictEqual(found, [],
    `a surface computes its own ratio instead of calling coveragePct/indexedCoverage: ${found.join(' | ')}`);
});

test('every coverage surface requires the shared primitive', () => {
  const SURFACES = [
    ['doctor', fs.readFileSync(path.join(ROOT, 'src', 'doctor', 'diagnose.js'), 'utf8')],
    ['the CLI surfaces (validate, --ci, --health, --report)', CLI],
  ];
  for (const [label, text] of SURFACES) {
    assert.ok(/analysis\/coverage-score/.test(text),
      `${label} must obtain its figure from src/analysis/coverage-score.js`);
  }
  for (const fn of ['coveragePct', 'indexedCoverage', 'coverageScore', 'formatCoverage']) {
    assert.strictEqual(typeof COV[fn], 'function', `the primitive must export ${fn}`);
  }
});

test('the empty-population convention has one answer', () => {
  // validate answered 0% here while coverageScore answered 100% — one repo,
  // two contradictory statements about whether anything was left uncovered.
  assert.strictEqual(COV.coveragePct(0, 0), 100, 'nothing in scope means nothing uncovered');
  assert.strictEqual(COV.indexedCoverage(new Set(), []).score, 100,
    'indexedCoverage must share the convention, not re-decide it');
  assert.strictEqual(COV.coverageScore(fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-empty-')), [], { srcDirs: ['nope'] }).score, 100,
    'coverageScore must share the convention too');
});

test('indexedCoverage is an intersection, so it cannot exceed 100%', () => {
  // The formula it replaced could: the index holds out-of-scope entries, so
  // `index.size / fileList.length` reported 241% through the --ci gate.
  const indexed = new Set(['a', 'b', 'c', 'x', 'y', 'z']);   // 3 of these are out of scope
  const cov = COV.indexedCoverage(indexed, ['a', 'b', 'c']);
  assert.strictEqual(cov.score, 100);
  assert.strictEqual(cov.included, 3);
  assert.strictEqual(cov.total, 3, 'the denominator is the in-scope list, not the index');
});

test('all five coverage surfaces print a labelled population', () => {
  const dir = makeRepo();
  try {
    for (const [label, args, expected] of [
      ['validate', ['validate'], 'indexed'],
      ['doctor',   ['doctor'],   'in-context'],
      ['--health', ['--health'], 'readable'],
      ['--report', ['--report'], 'in-context'],
      ['--ci',     ['--ci'],     'indexed'],
    ]) {
      const f = figure(run(dir, args));
      assert.ok(f, `${label} printed no labelled coverage figure — a bare percentage is the defect`);
      assert.strictEqual(f.population, expected,
        `${label} should report "${expected}", got "${f.population}"`);
      assert.ok(f.included <= f.total,
        `${label}: ${f.included}/${f.total} — a numerator past its denominator means it is not an intersection`);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('surfaces claiming the same population report the same figure', () => {
  const dir = makeRepo();
  try {
    for (const [a, b] of [[['doctor'], ['--report']], [['validate'], ['--ci']]]) {
      const x = figure(run(dir, a));
      const y = figure(run(dir, b));
      assert.ok(x && y, `${a[0]} and ${b[0]} must both print a labelled figure`);
      assert.strictEqual(x.population, y.population,
        `${a[0]} claims "${x.population}" and ${b[0]} claims "${y.population}"`);
      assert.deepStrictEqual(
        { pct: x.pct, included: x.included, total: x.total },
        { pct: y.pct, included: y.included, total: y.total },
        `${a[0]} and ${b[0]} disagree about the same population in the same repo`);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the --ci gate measures the same thing it gates on', () => {
  const dir = makeRepo();
  try {
    const human = figure(run(dir, ['--ci']));
    const json = JSON.parse(run(dir, ['--ci', '--json']).trim().split('\n').pop());
    assert.ok(human, '--ci must name its population');
    assert.strictEqual(json.coverage, human.pct,
      '--ci --json and --ci printed different coverage for one run');
    assert.ok(json.coverage <= 100,
      `--ci gated on ${json.coverage}% — a threshold cannot mean anything above 100%`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── reduction: one baseline, named windows ──────────────────────────────────

test('the reduction average is defined in exactly one place', () => {
  const walk = (d, out = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f, out);
      else if (f.endsWith('.js')) out.push(f);
    }
    return out;
  };
  const texts = walk(path.join(ROOT, 'src'))
    .filter((f) => !f.endsWith(path.join('tracking', 'usage-source.js')))
    .map((f) => [path.relative(ROOT, f), fs.readFileSync(f, 'utf8')]);
  texts.push(['gen-context.js (CLI core)', CLI]);
  const offenders = [];
  for (const [label, text] of texts) {
    text.split('\n').forEach((l, i) => {
      if (/reductionPct/.test(l) && /reduce\(|\/\s*\w+\.length/.test(l) && !/^\s*(\/\/|\*)/.test(l)) {
        offenders.push(`${label}:${i + 1}`);
      }
    });
  }
  assert.deepStrictEqual(offenders, [],
    `only summarizeRuns may average a reduction figure: ${offenders.join(', ')}`);
});

test('summarizeRuns owns the baseline and says when it has none', () => {
  assert.strictEqual(USAGE_SRC.summarizeRuns([]).avgReductionPct, null,
    'an empty window must read as unknown, not 0% — zero is a measurement');
  const s = USAGE_SRC.summarizeRuns([
    { rawTokens: 1000, finalTokens: 100, reductionPct: 90 },
    { rawTokens: 1000, finalTokens: 200, reductionPct: 80 },
  ]);
  assert.strictEqual(s.totalRuns, 2);
  assert.strictEqual(s.avgReductionPct, 85);
  assert.strictEqual(s.rawTokens, 2000, 'the baseline is the raw-token total, not a guess');
});

test('every reduction surface reads through the shared source', () => {
  // #773: three surfaces looked empty because they read the one store nobody
  // fills. The read path is shared now; this pins that it stays shared.
  const scorer = fs.readFileSync(path.join(ROOT, 'src', 'health', 'scorer.js'), 'utf8');
  assert.ok(/usage-source/.test(scorer), '--health must read run history through usage-source');
  const dash = fs.readFileSync(path.join(ROOT, 'src', 'format', 'dashboard.js'), 'utf8');
  assert.ok(/usage-source/.test(dash), 'the dashboard must read run history through usage-source');
  assert.ok(/usage-source/.test(CLI), 'the CLI surfaces must read run history through usage-source');
  for (const fn of ['readRuns', 'summarizeRuns', 'describeSource']) {
    assert.strictEqual(typeof USAGE_SRC[fn], 'function', `usage-source must export ${fn}`);
  }
});

console.log('');
console.log(`  shared-definitions: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
