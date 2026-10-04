#!/usr/bin/env node
/**
 * SigMap grounding regression corpus — MEASURED grounding accuracy (#673, J5).
 *
 * `benchmark:grounding` reports how much ground truth SigMap makes available;
 * `benchmark:verify` proves the detectors on one synthetic repo. Neither says
 * how accurate grounding is on answers whose truth is known. This does:
 *
 *   benchmarks/tasks/grounding-fixtures/<lang>/
 *     repo/         a small checked-in source tree (so CI and third parties need no clone)
 *     good.md       an answer in which every claim is real
 *     bad.md        the same shape with labelled, planted fakes
 *     labels.json   { fake: [{kind, value}], real: [{kind, value}] }
 *
 * Each fixture repo is copied to a temp dir, indexed by the real generator, and
 * both engines run over both answers:
 *
 *   verify  flags fake files / symbols / imports / npm scripts
 *   judge   reports claims its context and repo index do not ground, and a
 *           pass/fail verdict per answer
 *
 * A flagged value that is not a labelled fake is a false positive — good.md
 * contains only real claims, and bad.md's non-planted claims are real too.
 *
 * NO LLM, no network, deterministic: two runs are byte-identical (minus the
 * `generated` stamp), which `--gate` relies on.
 *
 * Usage:
 *   node scripts/run-grounding-regression.mjs                 # per-engine, per-kind table
 *   node scripts/run-grounding-regression.mjs --save          # write benchmarks/reports/grounding-regression.json
 *   node scripts/run-grounding-regression.mjs --gate          # exit 1 below a recorded floor
 *   node scripts/run-grounding-regression.mjs --record-floors # record floors from this run
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { stamp } from './lib/report-stamp.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(ROOT, 'benchmarks', 'tasks', 'grounding-fixtures');
const REPORTS = path.join(ROOT, 'benchmarks', 'reports');
const BASELINE = path.join(ROOT, 'benchmarks', 'grounding-regression-baseline.json');
const GEN_CTX = path.join(ROOT, 'gen-context.js');

const { verify } = require(path.join(ROOT, 'src/verify/hallucination-guard.js'));
const { judge } = require(path.join(ROOT, 'src/judge/judge-engine.js'));
const { resolveContextFile } = require(path.join(ROOT, 'src/judge/context-source.js'));

/** Claim kinds, in report order. `script` is a verify-only kind. */
export const KINDS = ['file', 'symbol', 'import', 'script'];
const JUDGE_KINDS = ['file', 'symbol', 'import'];
/** The corpus must span at least this many languages (#673). */
export const MIN_LANGUAGES = 5;

const VERIFY_KIND = {
  'fake-file': 'file', 'fake-test-file': 'file', 'fake-symbol': 'symbol',
  'fake-import': 'import', 'fake-npm-script': 'script',
};

const round4 = (n) => (n === null ? null : Math.round(n * 10000) / 10000);

// ── Pure scoring (unit-testable) ─────────────────────────────────────────────

/** Empty tally for a kind. */
const zero = () => ({ tp: 0, fp: 0, fn: 0 });

/**
 * Tally one answer's flagged claims against its labelled fakes.
 * @param {Iterable<string>} flagged  `kind::value` keys the engine flagged
 * @param {Iterable<string>} fakes    `kind::value` keys labelled fake (empty for good.md)
 * @param {string[]} kinds            kinds this engine can see
 * @returns {Record<string,{tp:number,fp:number,fn:number}>}
 */
export function tally(flagged, fakes, kinds) {
  const out = {};
  for (const k of kinds) out[k] = zero();
  const f = new Set(flagged);
  const fake = new Set(fakes);
  for (const key of f) {
    const kind = key.split('::')[0];
    if (!out[kind]) continue;
    if (fake.has(key)) out[kind].tp++; else out[kind].fp++;
  }
  for (const key of fake) {
    const kind = key.split('::')[0];
    if (out[kind] && !f.has(key)) out[kind].fn++;
  }
  return out;
}

/** Add tallies kind-by-kind. */
export function addTallies(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] || zero(); const y = b[k] || zero();
    out[k] = { tp: x.tp + y.tp, fp: x.fp + y.fp, fn: x.fn + y.fn };
  }
  return out;
}

/**
 * Precision and recall from a tally.
 * Precision over no flags is 1 (nothing was wrongly flagged); recall over no
 * labelled fakes is null — unmeasured, never a vacuous 100%.
 */
export function rates({ tp, fp, fn }) {
  return {
    tp, fp, fn,
    precision: round4(tp + fp === 0 ? 1 : tp / (tp + fp)),
    recall: round4(tp + fn === 0 ? null : tp / (tp + fn)),
  };
}

/**
 * Compare a run to recorded floors. Pure.
 * A floor with no measured counterpart (no labelled fakes for that kind) fails:
 * a group that measures nothing cannot hold a floor.
 *
 * @param {object} report  the saved report shape
 * @param {object} floors  baseline `floors`
 * @returns {string[]} failure messages, empty when the gate passes
 */
export function checkFloors(report, floors) {
  const fails = [];
  if (report.languages.length < (floors.minLanguages || MIN_LANGUAGES)) {
    fails.push(`corpus covers ${report.languages.length} language(s), floor is ${floors.minLanguages || MIN_LANGUAGES}`);
  }
  for (const engine of ['verify', 'judge']) {
    for (const [kind, want] of Object.entries((floors[engine] || {}).kinds || {})) {
      const got = report.engines[engine].kinds[kind];
      if (!got) { fails.push(`${engine}/${kind}: not measured`); continue; }
      if (got.recall === null) { fails.push(`${engine}/${kind}: no labelled fakes — recall unmeasured`); continue; }
      if (got.precision < want.precision) fails.push(`${engine}/${kind}: precision ${got.precision} < floor ${want.precision}`);
      if (got.recall < want.recall) fails.push(`${engine}/${kind}: recall ${got.recall} < floor ${want.recall}`);
    }
  }
  const acc = report.engines.judge.verdicts.accuracy;
  const accFloor = (floors.judge || {}).verdictAccuracy;
  if (accFloor !== undefined && acc < accFloor) fails.push(`judge/verdicts: accuracy ${acc} < floor ${accFloor}`);
  return fails;
}

/** Floors equal to what a run measured — the corpus is deterministic, so no margin. */
export function floorsFrom(report) {
  const mk = (engine) => {
    const kinds = {};
    for (const [k, r] of Object.entries(report.engines[engine].kinds)) {
      if (r.recall === null) continue;
      kinds[k] = { precision: r.precision, recall: r.recall };
    }
    return kinds;
  };
  return {
    minLanguages: MIN_LANGUAGES,
    verify: { kinds: mk('verify') },
    judge: { kinds: mk('judge'), verdictAccuracy: report.engines.judge.verdicts.accuracy },
  };
}

// ── Fixture execution ────────────────────────────────────────────────────────

/** @returns {Array<{name:string, dir:string, good:string, bad:string, labels:object}>} */
export function loadFixtures(dir = FIXTURES) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort()
    .map((name) => {
      const d = path.join(dir, name);
      return {
        name,
        dir: d,
        good: fs.readFileSync(path.join(d, 'good.md'), 'utf8'),
        bad: fs.readFileSync(path.join(d, 'bad.md'), 'utf8'),
        labels: JSON.parse(fs.readFileSync(path.join(d, 'labels.json'), 'utf8')),
      };
    });
}

const keyOf = (c) => `${c.kind}::${c.value}`;

/** What verify flags in an answer, as `kind::value` keys. */
function verifyFlags(answer, cwd) {
  const { issues } = verify(answer, cwd);
  return issues.map((i) => `${VERIFY_KIND[i.type] || 'other'}::${i.value}`);
}

/** What judge leaves ungrounded in an answer, and its verdict. */
function judgeFlags(answer, context, cwd) {
  const r = judge(answer, context, { cwd });
  return { flags: r.claims.ungrounded.map(keyOf), verdict: r.verdict };
}

/**
 * Index one fixture's repo with the real generator, in a temp copy, and score
 * both engines over both answers. The temp dir never appears in the result.
 */
export function runFixture(fx) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `sigmap-gfx-${fx.name}-`));
  try {
    fs.cpSync(path.join(fx.dir, 'repo'), tmp, { recursive: true });
    const gen = spawnSync(process.execPath, [GEN_CTX], { cwd: tmp, stdio: 'ignore' });
    if (gen.status !== 0) throw new Error(`${fx.name}: gen-context exited ${gen.status}`);
    const ctxFile = resolveContextFile(tmp);
    if (!ctxFile) throw new Error(`${fx.name}: generator produced no context file`);
    const context = fs.readFileSync(ctxFile, 'utf8');

    const fakes = fx.labels.fake.map(keyOf);
    const vGood = verifyFlags(fx.good, tmp);
    const vBad = verifyFlags(fx.bad, tmp);
    const jGood = judgeFlags(fx.good, context, tmp);
    const jBad = judgeFlags(fx.bad, context, tmp);

    return {
      name: fx.name,
      language: fx.labels.language,
      fakes: fakes.length,
      verify: addTallies(tally(vGood, [], KINDS), tally(vBad, fakes, KINDS)),
      judge: addTallies(tally(jGood.flags, [], JUDGE_KINDS), tally(jBad.flags, fakes, JUDGE_KINDS)),
      verdicts: { good: jGood.verdict, bad: jBad.verdict },
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Fold per-fixture results into the report body. */
export function buildReport(results) {
  const engines = {};
  for (const engine of ['verify', 'judge']) {
    const kinds = {};
    for (const k of engine === 'verify' ? KINDS : JUDGE_KINDS) {
      const t = results.reduce((acc, r) => addTallies(acc, { [k]: r[engine][k] || zero() }), {});
      kinds[k] = rates(t[k] || zero());
    }
    engines[engine] = { kinds };
  }
  const correct = results.reduce((n, r) => n + (r.verdicts.good === 'pass') + (r.verdicts.bad === 'fail'), 0);
  const total = results.length * 2;
  engines.judge.verdicts = { correct, total, accuracy: round4(total ? correct / total : null) };
  return {
    benchmark: 'grounding-regression',
    languages: results.map((r) => r.language),
    fixtures: results.map((r) => ({
      name: r.name,
      language: r.language,
      labelledFakes: r.fakes,
      verify: Object.fromEntries(Object.entries(r.verify).map(([k, t]) => [k, rates(t)])),
      judge: Object.fromEntries(Object.entries(r.judge).map(([k, t]) => [k, rates(t)])),
      verdicts: r.verdicts,
    })),
    engines,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const pct = (n) => (n === null ? 'n/a' : (n * 100).toFixed(1) + '%');

function printTable(report) {
  console.log('SigMap grounding regression corpus (labelled good/bad fixtures, offline)\n');
  console.log(`  fixtures: ${report.fixtures.length}  languages: ${report.languages.join(', ')}\n`);
  console.log('  engine  kind     TP   FP   FN  precision  recall');
  for (const [engine, body] of Object.entries(report.engines)) {
    for (const [kind, r] of Object.entries(body.kinds)) {
      console.log(`  ${engine.padEnd(6)}  ${kind.padEnd(7)} ${String(r.tp).padStart(3)}  ${String(r.fp).padStart(3)}  ${String(r.fn).padStart(3)}  ${pct(r.precision).padStart(9)}  ${pct(r.recall).padStart(6)}`);
    }
  }
  const v = report.engines.judge.verdicts;
  console.log(`\n  judge verdicts: ${v.correct}/${v.total} correct (good → pass, bad → fail)  ${pct(v.accuracy)}`);
}

function main() {
  const argv = process.argv.slice(2);
  const fixtures = loadFixtures();
  if (fixtures.length === 0) { console.error(`No fixtures in ${path.relative(ROOT, FIXTURES)}`); process.exit(1); }

  const report = buildReport(fixtures.map(runFixture));
  printTable(report);

  if (argv.includes('--save')) {
    fs.mkdirSync(REPORTS, { recursive: true });
    fs.writeFileSync(path.join(REPORTS, 'grounding-regression.json'),
      JSON.stringify(stamp(report, ROOT), null, 2) + '\n');
    console.log('\n  saved → benchmarks/reports/grounding-regression.json');
  }

  if (argv.includes('--record-floors')) {
    fs.writeFileSync(BASELINE, JSON.stringify({
      recordedBy: 'run-grounding-regression.mjs',
      note: 'Floors equal the measured value: the corpus is deterministic, so any drop is a regression. Re-record deliberately with --record-floors after adding fixtures.',
      floors: floorsFrom(report),
    }, null, 2) + '\n');
    console.log('\n  floors → benchmarks/grounding-regression-baseline.json');
    return;
  }

  if (argv.includes('--gate')) {
    let floors;
    try { floors = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).floors; } catch (_) {
      console.error('\n  GATE FAIL: no recorded floors (run --record-floors)');
      process.exit(1);
    }
    const fails = checkFloors(report, floors);
    if (fails.length) {
      for (const f of fails) console.error(`  GATE FAIL: ${f}`);
      process.exit(1);
    }
    console.log('\n  GATE PASS: every detector group at or above its floor');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
