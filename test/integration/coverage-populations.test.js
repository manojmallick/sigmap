'use strict';

/**
 * One coverage primitive, explicitly named populations (#762).
 *
 * Four surfaces printed a coverage percentage for one repo and no two agreed:
 *
 *   validate   98% (175/179)
 *   doctor     100% of source files in context (grade A)
 *   --health   100% (170/170)
 *   --report   54% (91/170)
 *
 * They were not in conflict about a fact — they were measuring DIFFERENT
 * populations through the same primitive, and none of them said which.
 * `doctor` was the sharpest case: it fed `coverageScore` the retrieval index
 * and then printed "of source files in context", so it claimed 100% in-context
 * while the very run that built that context reported 54%. Two directly
 * contradictory statements about one artifact.
 *
 * Differing numbers are fine. Unlabelled ones are not. These tests pin both
 * halves: every figure names its population, and the two surfaces that claim
 * to measure the SAME population must produce the same number.
 *
 * Run: node test/integration/coverage-populations.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

/** A repo big enough that the budget genuinely drops files, so in-context < indexed. */
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-cov-'));
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
function figure(out) {
  const m = out.match(PARSE);
  return m ? { population: m[1], pct: +m[2], included: +m[3], total: +m[4] } : null;
}

// ── every surface names its population ──────────────────────────────────────

const SURFACES = [
  ['validate', ['validate'],  'indexed'],
  ['doctor',   ['doctor'],    'in-context'],
  ['--health', ['--health'],  'readable'],
  ['--report', ['--report'],  'in-context'],
];

for (const [name, args, expected] of SURFACES) {
  test(`${name}: prints a labelled population with numerator and denominator`, () => {
    const dir = makeRepo();
    try {
      const f = figure(run(dir, args));
      assert.ok(f, `${name} printed no labelled coverage figure — a bare percentage is the defect`);
      assert.strictEqual(f.population, expected,
        `${name} should report the "${expected}" population, got "${f.population}"`);
      assert.ok(f.total > 0, `${name} printed a denominator of 0`);
      assert.ok(f.included <= f.total,
        `${name}: ${f.included}/${f.total} — numerator exceeds denominator`);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

// ── the contradiction this issue is about ───────────────────────────────────

test('doctor and --report agree — they claim the SAME population', () => {
  // Before #762: doctor said 100% "of source files in context" while --report
  // said 54% included, about the same artifact, in the same repo, same run.
  const dir = makeRepo();
  try {
    const d = figure(run(dir, ['doctor']));
    const r = figure(run(dir, ['--report']));
    assert.ok(d && r, 'both surfaces must print a labelled figure');
    assert.strictEqual(d.population, r.population, 'both should claim in-context');
    assert.strictEqual(d.pct, r.pct,
      `doctor says ${d.pct}% and --report says ${r.pct}% about the same context file`);
    assert.strictEqual(d.included, r.included, 'numerators disagree');
    assert.strictEqual(d.total, r.total, 'denominators disagree');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('doctor no longer calls the retrieval index "in context"', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'doctor', 'diagnose.js'), 'utf8');
  // Check CODE, not comments — the comment above the fix quotes the old string
  // deliberately, to record what was wrong with it.
  const code = src.split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  assert.ok(!/of source files in context/.test(code),
    'the unlabelled "of source files in context" output string is the original defect');
  assert.ok(/inContextFiles\(cwd\)/.test(code),
    'doctor must measure the context file, not buildSigIndex');
  // Scope to the COVERAGE block: doctor legitimately uses buildSigIndex
  // elsewhere for the index-size diagnostic, which is a different question.
  // Slice from the ORIGINAL source — the section markers are themselves
  // comments, so `code` above has already stripped them.
  const from = src.indexOf('// 6. Coverage');
  const to = src.indexOf('// 7.', from);
  assert.ok(from !== -1 && to !== -1, 'coverage block not found in diagnose.js');
  assert.ok(!/buildSigIndex/.test(src.slice(from, to)),
    'the coverage figure still comes from the retrieval index');
});

test('in-context is a subset of indexed when the budget drops files', () => {
  // The populations are genuinely different; the fix is labelling, not merging.
  const dir = makeRepo();
  try {
    const inCtx = figure(run(dir, ['--report']));
    const idx = figure(run(dir, ['validate']));
    assert.ok(inCtx && idx);
    assert.ok(inCtx.pct <= idx.pct,
      `in-context ${inCtx.pct}% should not exceed indexed ${idx.pct}% — the budget only removes`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── the primitive itself ────────────────────────────────────────────────────

test('formatCoverage refuses an unknown population', () => {
  const { formatCoverage } = require(path.join(ROOT, 'src', 'analysis', 'coverage-score'));
  assert.throws(() => formatCoverage({ score: 50, grade: 'C', included: 1, total: 2 }, 'made-up'),
    /unknown coverage population/);
});

test('inContextFiles reads the context file, not the index', () => {
  const { inContextFiles } = require(path.join(ROOT, 'src', 'analysis', 'coverage-score'));
  const dir = makeRepo();
  try {
    const files = inContextFiles(dir);
    assert.ok(files.length > 0, 'no files parsed from the generated context');
    assert.ok(files.every((f) => path.isAbsolute(f.filePath)), 'entries must be absolute paths');
    const ctx = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
    const sections = [...ctx.matchAll(/^### /gm)].length;
    assert.strictEqual(files.length, sections,
      `parsed ${files.length} files but the context file has ${sections} sections`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── a file is counted once, however many source roots reach it (#918) ──────────
test('overlapping srcDirs count a file once — one file is "1 of 1", not "2 of 2"', () => {
  const { coverageScore } = require(path.join(ROOT, 'src', 'analysis', 'coverage-score'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-cov-dup-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function a() {}\n');
    const entries = [{ filePath: path.join(dir, 'src', 'a.js'), sigs: ['function a()'] }];
    // what `--monorepo` hands every package: `.` contains the other three roots
    const overlapping = coverageScore(dir, entries, { srcDirs: ['src', 'lib', 'app', '.'] });
    assert.strictEqual(overlapping.total, 1, `counted ${overlapping.total} files for one file on disk`);
    assert.strictEqual(overlapping.included, 1);
    assert.strictEqual(overlapping.dropped, 0);
    const plain = coverageScore(dir, entries, { srcDirs: ['src'] });
    assert.deepStrictEqual([overlapping.total, overlapping.included, overlapping.score],
      [plain.total, plain.included, plain.score], 'overlap must not change the figures');
    // listing the same root twice is the same mistake
    assert.strictEqual(coverageScore(dir, entries, { srcDirs: ['src', 'src'] }).total, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

console.log(`\n  coverage-populations: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
