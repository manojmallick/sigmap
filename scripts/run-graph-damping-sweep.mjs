#!/usr/bin/env node
'use strict';

/**
 * Graph-boost damping sweep — the held-out measurement behind #935.
 *
 *   node scripts/run-graph-damping-sweep.mjs                      # every corpus, the whole rule family
 *   node scripts/run-graph-damping-sweep.mjs --only xrepo,mined   # some corpora
 *   node scripts/run-graph-damping-sweep.mjs --rules cap8,share1  # some rules
 *   node scripts/run-graph-damping-sweep.mjs --save               # record benchmarks/reports/graph-damping-sweep.json
 *
 * Every task is ranked five ways and its hit@5 recorded:
 *
 *   shipped   the graph the ranker is handed today (`buildRankingGraph`), undamped
 *   full      the complete graph over the detected roots (`buildFromCwd`), undamped
 *   <rule>    the complete graph with one damping rule of scripts/lib/graph-damping.mjs
 *
 * The comparison that decides is a rule against `shipped`: shipping a rule changes
 * `buildRankingGraph` to the detected roots AND turns the rule on, and that is the
 * whole difference a user would see. `full` is the control that shows what the
 * larger graph does without damping.
 *
 * A rule is then chosen on one half of xrepo (by repository) and of mined (by task)
 * and scored on the other half, on `hard`, `easy` and `jvm`, which tuning never
 * touches, and the two folds are swapped. The honest corpus is scored without an
 * import graph, as its table is, so no rule can move it: it is not run.
 *
 * Scored the way the arms are: one index and import graph per repository,
 * `learned: false`. Both rules and the shipped ranker are measured on the same
 * index in the same run, so the repository's own drift per commit cancels.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { stamp } from './lib/report-stamp.mjs';
import { loadManifest, checkoutState, readTasks, withZeroConfigIndex, TASKS_REL } from './lib/xrepo.mjs';
import { RULES, SPLIT_CORPORA, HELD_OUT_CORPORA, foldsOf, netOf, chooseRule } from './lib/graph-damping.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const runner = require(path.join(ROOT, 'src/eval/runner'));
const scorer = require(path.join(ROOT, 'src/eval/scorer'));
const { buildRankingGraph, buildFromCwd } = require(path.join(ROOT, 'src/graph/builder'));

const XREPO_DATA = process.env.SIGMAP_XREPO_DATA ? path.resolve(process.env.SIGMAP_XREPO_DATA) : ROOT;
const DATA = process.env.SIGMAP_RETRIEVAL_DATA ? path.resolve(process.env.SIGMAP_RETRIEVAL_DATA) : ROOT;
const REPORT = path.join(ROOT, 'benchmarks', 'reports', 'graph-damping-sweep.json');

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const SAVE = argv.includes('--save');
const ALL = ['xrepo', 'hard', 'mined', 'easy', 'jvm'];
const ONLY = new Set(val('--only', ALL.join(',')).split(',').filter((c) => ALL.includes(c)));
const wanted = new Set(val('--rules', RULES.map((r) => r.id).join(',')).split(','));
const rules = RULES.filter((r) => wanted.has(r.id));

const loadJsonl = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const asTasks = (rows) => rows.map((o) => ({ id: o.id, query: o.query, expected: o.expected_files || [] }));
const say = (s) => process.stderr.write(`  ${s}\n`);

/** Every scored task: { corpus, unit, id, shipped, full, rules: {id: 0|1} }. */
const rows = [];

function evaluate(corpus, unit, index, dir, tasks, graphs) {
  const hit = (t, opts) => scorer.hitAtK(
    runner.rank(t.query, index, 10, Object.assign({ cwd: dir, learned: false }, opts)).map((x) => x.file), t.expected, 5);
  for (const t of tasks) {
    const row = {
      corpus, unit, id: t.id,
      shipped: hit(t, { graph: graphs.shipped }),
      full: hit(t, { graph: graphs.full }),
      rules: {},
    };
    for (const r of rules) row.rules[r.id] = hit(t, { graph: graphs.full, graphDamping: r.damping });
    rows.push(row);
  }
}

const graphsOf = (dir) => {
  let shipped = null;
  let full = null;
  try { shipped = buildRankingGraph(dir); } catch (_) { /* optional */ }
  try { full = buildFromCwd(dir); } catch (_) { /* optional */ }
  return { shipped, full };
};

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
    withZeroConfigIndex(XREPO_DATA, repo, ({ dir, index }) => evaluate('xrepo', repo.name, index, dir, asTasks(tasks), graphsOf(dir)));
  }
}

if (['hard', 'mined', 'easy', 'jvm'].some((c) => ONLY.has(c))) {
  // Regenerate this repository's index and the JVM repos' by running the gate that owns that preparation.
  spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'run-retrieval-gate.mjs')], { cwd: ROOT, stdio: 'ignore', env: Object.assign({}, process.env) });
  const own = runner.buildSigIndex(DATA);
  const ownGraphs = graphsOf(DATA);
  for (const [corpus, file] of [['hard', 'retrieval-hard'], ['mined', 'retrieval-mined'], ['easy', 'retrieval']]) {
    const f = path.join(DATA, 'benchmarks/tasks', `${file}.jsonl`);
    if (ONLY.has(corpus) && fs.existsSync(f)) {
      say(corpus);
      evaluate(corpus, 'self', own, DATA, asTasks(loadJsonl(f)), ownGraphs);
    }
  }
  if (ONLY.has('jvm')) {
    for (const name of ['spring-petclinic', 'akka']) {
      const dir = path.join(DATA, 'benchmarks', 'repos', name);
      const f = path.join(DATA, 'benchmarks', 'tasks', `retrieval-jvm-${name}.jsonl`);
      if (fs.existsSync(dir) && fs.existsSync(f)) {
        say(`jvm ${name}`);
        evaluate('jvm', name, runner.buildSigIndex(dir), dir, asTasks(loadJsonl(f)), graphsOf(dir));
      }
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
/** One cell over a set of tasks, in the shape graph-damping.mjs reasons about. */
const cellOf = (rs) => ({
  tasks: rs.length,
  shipped: sum(rs, (r) => r.shipped),
  full: sum(rs, (r) => r.full),
  rules: Object.fromEntries(rules.map((x) => [x.id, sum(rs, (r) => r.rules[x.id])])),
});
const byCorpus = Object.fromEntries(corpora.map((c) => [c, rows.filter((r) => r.corpus === c)]));

// Folds: xrepo by repository, mined by task id.
const foldOf = new Map();
for (const c of SPLIT_CORPORA) {
  if (!byCorpus[c]) continue;
  const units = [...new Set(byCorpus[c].map((r) => (c === 'xrepo' ? r.unit : r.id)))];
  for (const [u, f] of foldsOf(units)) foldOf.set(`${c}:${u}`, f);
}
const foldFor = (r) => foldOf.get(`${r.corpus}:${r.corpus === 'xrepo' ? r.unit : r.id}`);
const splitRows = rows.filter((r) => SPLIT_CORPORA.includes(r.corpus));

const crossValidation = [0, 1].map((tune) => {
  const tuning = splitRows.filter((r) => foldFor(r) === tune);
  const held = splitRows.filter((r) => foldFor(r) !== tune);
  const pick = chooseRule([cellOf(tuning)], rules.map((r) => r.id));
  const out = { tuneFold: tune, tuningTasks: tuning.length, heldTasks: held.length, chosen: pick ? pick.id : null, tuningNet: pick ? pick.net : 0 };
  const at = (rs) => (pick ? netOf([cellOf(rs)], pick.id) : 0);
  out.heldOut = {
    xrepo: at(held.filter((r) => r.corpus === 'xrepo')),
    mined: at(held.filter((r) => r.corpus === 'mined')),
    // Never tuned on: scored whole.
    ...Object.fromEntries(HELD_OUT_CORPORA.filter((c) => byCorpus[c]).map((c) => [c, at(byCorpus[c])])),
  };
  out.heldOutFullGraphNet = {
    xrepo: netOfFull(held.filter((r) => r.corpus === 'xrepo')),
    mined: netOfFull(held.filter((r) => r.corpus === 'mined')),
  };
  return out;
});
function netOfFull(rs) { return sum(rs, (r) => r.full - r.shipped); }

// ── report ───────────────────────────────────────────────────────────────────

const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
const W = 15;
console.log('\n  hop-1 graph-boost damping: net hits against the shipped ranker (won/lost); the complete graph is rows "full" and the rules\n');
console.log(`    ${'rule'.padEnd(13)}${corpora.map((c) => `${c} ${sum(byCorpus[c], (r) => r.shipped)}/${byCorpus[c].length}`.padStart(W)).join('')}${'all'.padStart(W)}`);
const line = (id, f) => {
  const cells = corpora.map((c) => {
    const rs = byCorpus[c];
    const won = rs.filter((r) => f(r) && !r.shipped).length;
    const lost = rs.filter((r) => !f(r) && r.shipped).length;
    return `${signed(won - lost)} (${won}/${lost})`.padStart(W);
  });
  const won = rows.filter((r) => f(r) && !r.shipped).length;
  const lost = rows.filter((r) => !f(r) && r.shipped).length;
  console.log(`    ${id.padEnd(13)}${cells.join('')}${`${signed(won - lost)} (${won}/${lost})`.padStart(W)}`);
};
line('full', (r) => r.full);
for (const r of rules) line(r.id, (row) => row.rules[r.id]);

console.log('\n  chosen on one half, scored on the other (xrepo by repository, mined by task); hard, easy and jvm are never tuned on\n');
for (const cv of crossValidation) {
  const held = Object.entries(cv.heldOut).map(([k, v]) => `${k} ${signed(v)}`).join('  ');
  console.log(`    tune fold ${cv.tuneFold} (${cv.tuningTasks} tasks): ${cv.chosen === null ? 'no rule beats shipped — change nothing' : `${cv.chosen} (${signed(cv.tuningNet)} on tuning)`}`);
  console.log(`      held out (${cv.heldTasks} tasks): ${held}      the complete graph undamped: xrepo ${signed(cv.heldOutFullGraphNet.xrepo)}  mined ${signed(cv.heldOutFullGraphNet.mined)}`);
}

if (SAVE) {
  const grid = {};
  const tally = (pick) => Object.fromEntries(corpora.map((c) => {
    const rs = byCorpus[c];
    const won = rs.filter((r) => pick(r) && !r.shipped).map((r) => `${r.unit}/${r.id}`);
    const lost = rs.filter((r) => !pick(r) && r.shipped).map((r) => `${r.unit}/${r.id}`);
    return [c, { hits: sum(rs, (r) => (pick(r) ? 1 : 0)), won: won.length, lost: lost.length, flipped: { won, lost } }];
  }));
  for (const r of rules) grid[r.id] = { damping: r.damping, corpora: tally((row) => row.rules[r.id]) };
  const report = {
    benchmark: 'graph-damping-sweep',
    method: 'run-graph-damping-sweep.mjs: each task ranked with the shipped graph, the complete graph, and the complete graph under each damping rule; a rule is chosen on one half of xrepo (by repository) and mined (by task) and scored on the other half and on hard, easy and jvm; honest is scored without an import graph and cannot move',
    plain: Object.fromEntries(corpora.map((c) => [c, { shipped: sum(byCorpus[c], (r) => r.shipped), full: sum(byCorpus[c], (r) => r.full), tasks: byCorpus[c].length }])),
    folds: Object.fromEntries([...foldOf.entries()].map(([k, v]) => [k, v])),
    full: { corpora: tally((row) => row.full) },
    grid,
    crossValidation,
  };
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(stamp(report, ROOT), null, 2) + '\n');
  console.log(`\n  saved: ${path.relative(ROOT, REPORT)}`);
}
