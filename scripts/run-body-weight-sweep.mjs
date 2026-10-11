#!/usr/bin/env node
'use strict';

/**
 * Body-word weight sweep — the held-out measurement behind #943.
 *
 *   node scripts/run-body-weight-sweep.mjs                        # every corpus, the whole family
 *   node scripts/run-body-weight-sweep.mjs --only xrepo,hard      # some corpora
 *   node scripts/run-body-weight-sweep.mjs --variants w0.3-count  # some variants
 *   node scripts/run-body-weight-sweep.mjs --save                 # record benchmarks/reports/body-weight-sweep.json
 *
 * `retrieval.bodyWords` is the one lever on the #674 frontier that is measured to help, and it
 * is opt-in because it costs `hard` a task: the guide's default rule asks for no net-negative
 * corpus. Body words ride the prose field's weight and lengthen the document for BM25's length
 * normalisation; the 90-cell sweep of #905 varied neither. This ranks every task five-ish ways
 * and applies the rule:
 *
 *   plain     the shipped default: no body words
 *   shipped   body words as `retrieval.bodyWords` shipped through v8.74: the prose field's weight
 *             and length (the control)
 *   <variant> body words in a field of their own, at a weight, counted into the length or not
 *
 * A variant is judged against `plain` — that is the difference a user would see on flipping the
 * default — by `judge()` in scripts/lib/body-weight.mjs. The family is fixed before the run, the
 * mildest qualifying variant is the one that would ship, and the cross-validation shows what a
 * choice made on one half of xrepo and mined, without seeing hard/easy/jvm/honest, would have
 * scored on the other half and on those.
 *
 * Scored the way the arms are: one index and import graph per repository, `learned: false`; the
 * honest corpus is scored without an import graph, as its table is. Plain, the control and every
 * variant are measured on the same index in the same run, so the repository's own drift per
 * commit cancels.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { stamp } from './lib/report-stamp.mjs';
import { readSource } from './lib/corpus-vocabulary.mjs';
import { loadManifest, checkoutState, readTasks, withZeroConfigIndex, TASKS_REL } from './lib/xrepo.mjs';
import { VARIANTS, SPLIT_CORPORA, HELD_OUT_CORPORA, XREPO_MIN_NET, foldsOf, netOf, judge, verdict, chooseOnTuning } from './lib/body-weight.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const runner = require(path.join(ROOT, 'src/eval/runner'));
const scorer = require(path.join(ROOT, 'src/eval/scorer'));
const { buildRankingGraph } = require(path.join(ROOT, 'src/graph/builder'));
const bodyWordsLib = require(path.join(ROOT, 'src/retrieval/body-words'));

const XREPO_DATA = process.env.SIGMAP_XREPO_DATA ? path.resolve(process.env.SIGMAP_XREPO_DATA) : ROOT;
const DATA = process.env.SIGMAP_RETRIEVAL_DATA ? path.resolve(process.env.SIGMAP_RETRIEVAL_DATA) : ROOT;
const REPORT = path.join(ROOT, 'benchmarks', 'reports', 'body-weight-sweep.json');

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const SAVE = argv.includes('--save');
const ALL = ['xrepo', 'hard', 'mined', 'easy', 'jvm', 'honest'];
const ONLY = new Set(val('--only', ALL.join(',')).split(',').filter((c) => ALL.includes(c)));
const wanted = new Set(val('--variants', VARIANTS.map((v) => v.id).join(',')).split(','));
const variants = VARIANTS.filter((v) => wanted.has(v.id));

const loadJsonl = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const asTasks = (rows) => rows.map((o) => ({ id: o.id, query: o.query, expected: o.expected_files || [] }));
const say = (s) => process.stderr.write(`  ${s}\n`);
const graphOf = (dir) => { try { return buildRankingGraph(dir); } catch (_) { return null; } };

/** Every scored task: { corpus, unit, id, plain, arms: {shipped, <variant>: 0|1} }. */
const rows = [];

function evaluate(corpus, unit, index, dir, tasks, graph) {
  const cache = new Map();
  const read = (file) => {
    if (!cache.has(file)) cache.set(file, readSource(dir, file));
    return cache.get(file);
  };
  const bodyWords = bodyWordsLib.buildBodyWords(index, read);
  const hit = (t, extra) => scorer.hitAtK(
    runner.rank(t.query, index, 10, Object.assign({ cwd: dir, graph, learned: false }, extra)).map((x) => x.file), t.expected, 5);
  for (const t of tasks) {
    const arms = { shipped: hit(t, { bodyWords, bodyField: 'prose' }) };
    for (const v of variants) arms[v.id] = hit(t, Object.assign({ bodyWords }, v.options));
    rows.push({ corpus, unit, id: t.id, plain: hit(t, {}), arms });
  }
}

// ── the corpora ──────────────────────────────────────────────────────────────

if (ONLY.has('xrepo')) {
  const manifest = loadManifest(XREPO_DATA);
  const tasksFile = path.join(XREPO_DATA, TASKS_REL);
  const all = fs.existsSync(tasksFile) ? readTasks(tasksFile) : [];
  for (const repo of manifest.repos) {
    const tasks = all.filter((t) => t.repo === repo.name);
    const state = checkoutState(XREPO_DATA, repo);
    if (!tasks.length || !state.present || !state.atPin) continue;
    say(`xrepo ${repo.name}`);
    withZeroConfigIndex(XREPO_DATA, repo, ({ dir, index }) => evaluate('xrepo', repo.name, index, dir, asTasks(tasks), graphOf(dir)));
  }
}

if (['hard', 'mined', 'easy', 'jvm'].some((c) => ONLY.has(c))) {
  // Regenerate this repository's index and the JVM repos' by running the gate that owns that preparation.
  spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'run-retrieval-gate.mjs')], { cwd: ROOT, stdio: 'ignore', env: Object.assign({}, process.env) });
  const own = runner.buildSigIndex(DATA);
  const ownGraph = graphOf(DATA);
  for (const [corpus, file] of [['hard', 'retrieval-hard'], ['mined', 'retrieval-mined'], ['easy', 'retrieval']]) {
    const f = path.join(DATA, 'benchmarks/tasks', `${file}.jsonl`);
    if (ONLY.has(corpus) && fs.existsSync(f)) {
      say(corpus);
      evaluate(corpus, 'self', own, DATA, asTasks(loadJsonl(f)), ownGraph);
    }
  }
  if (ONLY.has('jvm')) {
    for (const name of ['spring-petclinic', 'akka']) {
      const dir = path.join(DATA, 'benchmarks', 'repos', name);
      const f = path.join(DATA, 'benchmarks', 'tasks', `retrieval-jvm-${name}.jsonl`);
      if (fs.existsSync(dir) && fs.existsSync(f)) {
        say(`jvm ${name}`);
        evaluate('jvm', name, runner.buildSigIndex(dir), dir, asTasks(loadJsonl(f)), graphOf(dir));
      }
    }
  }
}

if (ONLY.has('honest')) {
  const tasksDir = path.join(ROOT, 'benchmarks', 'tasks');
  for (const f of fs.readdirSync(tasksDir).filter((x) => x.endsWith('.jsonl')).sort()) {
    const name = f.replace('.jsonl', '');
    if (/^retrieval-(hard|mined|jvm|xrepo)/.test(name)) continue;
    const dir = name === 'retrieval' ? ROOT : path.join(ROOT, 'benchmarks', 'repos', name);
    if (!fs.existsSync(dir)) continue;
    const index = runner.buildSigIndex(dir);
    if (index.size) {
      say(`honest ${name}`);
      evaluate('honest', name, index, dir, asTasks(loadJsonl(path.join(tasksDir, f))), null);
    }
  }
}

const corpora = ALL.filter((c) => rows.some((r) => r.corpus === c));
if (!corpora.length) {
  console.error('No corpus was scored.');
  process.exit(1);
}

// ── arithmetic ───────────────────────────────────────────────────────────────

const sum = (rs, f) => rs.reduce((n, r) => n + f(r), 0);
const byCorpus = Object.fromEntries(corpora.map((c) => [c, rows.filter((r) => r.corpus === c)]));

// Folds: xrepo by repository, mined by task id.
const foldOf = new Map();
for (const c of SPLIT_CORPORA) {
  if (!byCorpus[c]) continue;
  const units = [...new Set(byCorpus[c].map((r) => (c === 'xrepo' ? r.unit : r.id)))];
  for (const [u, f] of foldsOf(units)) foldOf.set(`${c}:${u}`, f);
}
const foldFor = (c, r) => foldOf.get(`${c}:${c === 'xrepo' ? r.unit : r.id}`);

const armIds = ['shipped', ...variants.map((v) => v.id)];
const verdictAll = verdict(byCorpus, variants.map((v) => v.id), foldFor);
const control = judge(byCorpus, 'shipped', foldFor);

const crossValidation = [0, 1].map((tune) => {
  const inFold = (r) => SPLIT_CORPORA.includes(r.corpus) && foldFor(r.corpus, r) === tune;
  const heldFold = (r) => SPLIT_CORPORA.includes(r.corpus) && foldFor(r.corpus, r) !== tune;
  const tuning = rows.filter(inFold);
  const pick = chooseOnTuning(tuning, variants.map((v) => v.id));
  const at = (rs) => (pick ? netOf(rs, pick.id) : 0);
  return {
    tuneFold: tune,
    tuningTasks: tuning.length,
    heldTasks: rows.filter(heldFold).length,
    chosen: pick ? pick.id : null,
    tuningNet: pick ? pick.net : 0,
    heldOut: Object.fromEntries([
      ...SPLIT_CORPORA.filter((c) => byCorpus[c]).map((c) => [c, at(rows.filter((r) => r.corpus === c && heldFold(r)))]),
      ...HELD_OUT_CORPORA.concat('honest').filter((c) => byCorpus[c]).map((c) => [c, at(byCorpus[c])]),
    ]),
  };
});

// ── report ───────────────────────────────────────────────────────────────────

const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
const W = 15;
const wonLost = (rs, armId) => ({
  won: rs.filter((r) => r.arms[armId] && !r.plain).length,
  lost: rs.filter((r) => !r.arms[armId] && r.plain).length,
});
const cellOf = (rs, armId) => { const { won, lost } = wonLost(rs, armId); return `${signed(won - lost)} (${won}/${lost})`; };

console.log('\n  body-word weight: net hits against plain (won/lost); `shipped` is retrieval.bodyWords as it shipped through v8.74\n');
console.log(`    ${'variant'.padEnd(13)}${corpora.map((c) => `${c} ${sum(byCorpus[c], (r) => r.plain)}/${byCorpus[c].length}`.padStart(W)).join('')}${'all'.padStart(W)}   rule`);
for (const id of armIds) {
  const j = id === 'shipped' ? control : verdictAll.judged[id];
  const cells = corpora.map((c) => cellOf(byCorpus[c], id).padStart(W));
  console.log(`    ${id.padEnd(13)}${cells.join('')}${cellOf(rows, id).padStart(W)}   ${j.meets ? 'MEETS' : j.failures[0]}`);
}
console.log(`\n  the rule: xrepo >= +${XREPO_MIN_NET}, no corpus net-negative, neither half of xrepo or mined net-negative`);
console.log(`  mildest variant that meets it: ${verdictAll.choice === null ? 'none — the default stays off' : verdictAll.choice}`);

console.log('\n  chosen on one half (xrepo by repository, mined by task), scored on the other half and on the corpora never tuned on\n');
for (const cv of crossValidation) {
  const held = Object.entries(cv.heldOut).map(([k, v]) => `${k} ${signed(v)}`).join('  ');
  console.log(`    tune fold ${cv.tuneFold} (${cv.tuningTasks} tasks): ${cv.chosen === null ? 'no variant beats plain without losing a tuned corpus' : `${cv.chosen} (${signed(cv.tuningNet)} on tuning)`}`);
  console.log(`      held out (${cv.heldTasks} tasks): ${held}`);
}

if (SAVE) {
  const tally = (armId) => Object.fromEntries(corpora.map((c) => {
    const rs = byCorpus[c];
    const won = rs.filter((r) => r.arms[armId] && !r.plain).map((r) => `${r.unit}/${r.id}`);
    const lost = rs.filter((r) => !r.arms[armId] && r.plain).map((r) => `${r.unit}/${r.id}`);
    return [c, { hits: sum(rs, (r) => r.arms[armId]), won: won.length, lost: lost.length, flipped: { won, lost } }];
  }));
  const grid = {};
  for (const v of variants) {
    const j = verdictAll.judged[v.id];
    grid[v.id] = { options: v.options, corpora: tally(v.id), meets: j.meets, failures: j.failures, halves: j.halves };
  }
  const report = {
    benchmark: 'body-weight-sweep',
    method: 'run-body-weight-sweep.mjs: each task ranked with no body words (plain), with body words as they ship (shipped) and with each weighting of a field of their own; a variant is judged against plain by the guide\'s default rule applied to the whole table and to each half of xrepo and mined; chosen-on-one-half readings are cross-validation only (the honest corpus is scored without an import graph)',
    rule: { xrepoMinNet: XREPO_MIN_NET, noNegativeCorpus: true, noNegativeHalf: true },
    plain: Object.fromEntries(corpora.map((c) => [c, { hits: sum(byCorpus[c], (r) => r.plain), tasks: byCorpus[c].length }])),
    folds: Object.fromEntries([...foldOf.entries()]),
    shipped: { corpora: tally('shipped'), meets: control.meets, failures: control.failures, halves: control.halves },
    grid,
    verdict: { choice: verdictAll.choice },
    crossValidation,
  };
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(stamp(report, ROOT), null, 2) + '\n');
  console.log(`\n  saved: ${path.relative(ROOT, REPORT)}`);
}
