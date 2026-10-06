#!/usr/bin/env node
/**
 * Retrieval quality benchmark + regression gate.
 *
 *   node scripts/run-retrieval-gate.mjs             # report only
 *   node scripts/run-retrieval-gate.mjs --gate      # exit 1 below the floor
 *   node scripts/run-retrieval-gate.mjs --gate --no-regress
 *   node scripts/run-retrieval-gate.mjs --save      # record a new baseline
 *   node scripts/run-retrieval-gate.mjs --min 0.55  # override the floor
 *   node scripts/run-retrieval-gate.mjs --why       # why every miss misses, per split (#905)
 *   node scripts/run-retrieval-gate.mjs --per-task  # every task's class and rank, one line each
 *   node scripts/run-retrieval-gate.mjs --why --json  # the same as one JSON document on stdout
 *   node scripts/run-retrieval-gate.mjs --signals   # each opt-in ranking signal against plain, task by task (#703)
 *
 * `--why` places each miss of every split in exactly one class (the classifier
 * `xrepo --why` uses) and says whether the answer's own words could have served the
 * question. A baseline saved with `--save` carries that account beside the number.
 *
 * KNOWN BIAS: tasks h031+ were authored after module-doc prose was indexed,
 * so their phrasing shares the header's CONCEPTS even where the verbatim-ngram
 * check passes. They score ~20pp above the tasks written before that (81.7% vs
 * 61.1%). Treat the absolute number as optimistic relative to a real user's
 * queries; the gate's job is detecting REGRESSION, which is unaffected.
 *
 * The gate is scored on `retrieval-hard.jsonl` — the leak-free split. The easy
 * corpus is reported for context but NEVER gated: 11 of its 20 queries contain
 * the answer's own filename, so it measures index coverage far more than it
 * measures ranking, and it moves ~3x further than reality for any given change.
 *
 * Reproducibility: run with `learned: false` so a developer's local
 * .context/weights.json cannot change the numbers CI sees. The retrieval index
 * (.context/sig-index.json) is gitignored, so a fresh checkout is regenerated
 * before scoring.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, } from 'child_process';
import { createRequire } from 'module';
import { band } from './lib/band.mjs';
import { attributeTasks, summarizeWhy, reachable, whyLabel, formatGap, GAP_LABELS, DISTINCTIVE_SHARE } from './lib/attribution.mjs';
import { isTestAnswer } from './lib/xrepo-hygiene.mjs';
import { docStats, queryTermsOf, termsOf } from './lib/corpus-vocabulary.mjs';
import { ARMS, compareArms, mergeArms, verdictOf } from './lib/signal-arms.mjs';
import { buildArmRankers } from './lib/signal-rankers.mjs';
import { writeAll } from './lib/write-sync.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);

// Where the corpora, the baseline and the benchmark clones live: the checkout itself,
// unless SIGMAP_RETRIEVAL_DATA names another root — which is how a test scores a
// throwaway repository without touching this one. The code is always this checkout's.
const DATA = process.env.SIGMAP_RETRIEVAL_DATA ? resolve(process.env.SIGMAP_RETRIEVAL_DATA) : ROOT;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };

const GATE = has('--gate');
const NO_REGRESS = has('--no-regress');
const SAVE = has('--save');
const WHY = has('--why');
const PER_TASK = has('--per-task');
const SIGNALS = has('--signals');
const AS_JSON = has('--json');
// `--json` keeps stdout for the one JSON document; the human report goes to stderr.
if (AS_JSON) console.log = console.error;
const MIN = parseFloat(val('--min', '0.70'));
// The mined corpus is smaller and genuinely harder — no author bias propping it up.
// Floor set below the whole sensitivity band measured on the ORIGINAL 23-task
// corpus (53.3%-73.1% across defensible miner parameters) so the gate catches
// genuine regression rather than firing on corpus-parameter noise. The corpus was
// re-mined at 60 tasks once generated outputs stopped being labelled as answers
// (#883) and scores 61.7% on pristine develop; the parameter sweep was not
// repeated, so the floor is kept as it was — 7 tasks of headroom.
const MIN_MINED = parseFloat(val('--min-mined', '0.50'));
const BASELINE = join(DATA, 'benchmarks', 'retrieval-baseline.json');
const EPS = 1e-9;

// Always regenerate, never reuse. The index is gitignored and every benchmark
// suite regenerates repo contexts, so an index left by an earlier suite — or by
// a working tree that has since changed — silently shifts this score. Reusing it
// is how `hard` read 75.6% and 76.7% for the same commit on the same machine.
// Regeneration costs a second and makes the number reproducible.
execFileSync(process.execPath, [join(ROOT, 'gen-context.js')], { cwd: DATA, stdio: 'ignore' });

const { run, rank: rankQuery, loadTasks, buildSigIndex } = require(join(ROOT, 'src/eval/runner'));
const { queryLeakage } = require(join(ROOT, 'src/eval/corpus'));
const { buildFromCwd } = require(join(ROOT, 'src/graph/builder'));

/** What `--why` attributes: one entry per corpus scored this run. */
const corpora = [];

function score(file, split) {
  corpora.push({ split, cwd: DATA, file: join(DATA, 'benchmarks/tasks', file) });
  const m = run(join('benchmarks/tasks', file), DATA, { topK: 5, learned: false }).metrics;
  return { hitAt5: m.hitAt5, mrr: m.mrr, precisionAt5: m.precisionAt5, tasks: m.tasks };
}

/** The hard split is worthless if it ever starts leaking — verify every run. */
function assertLeakFree(file) {
  const tasks = readFileSync(join(DATA, 'benchmarks/tasks', file), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const leaking = tasks.filter((t) => !queryLeakage(t.query, t.expected_files).clean);
  return { total: tasks.length, leaking: leaking.map((t) => t.id) };
}

/**
 * A JVM corpus, mined from the cloned repos' own history and scored against
 * them. Every other corpus here is 100% JavaScript, which is why the v8.30
 * data-holder penalty — a ranking change aimed squarely at generated Java
 * entities — measured +0.0pp and had to be checked by hand (#575).
 *
 * Skipped, not failed, when the repos are absent: they are gitignored, so a
 * fresh checkout has no history to score against.
 */
function scoreJvm() {
  const repos = ['spring-petclinic', 'akka'];
  let tasks = 0, hits = 0, rr = 0, prec = 0;
  const present = [];
  // Regenerate each index here rather than trusting whatever is on disk. The
  // repo contexts are shared with the other benchmark suites, so a repo last
  // generated by a different suite — or with a different config — scores
  // differently. That is the #522 cross-suite skew, and it made this gate read
  // -7.8pp on a change that moves nothing. `config-overrides.json` is the single
  // source of truth for how each repo is configured.
  const overridesFile = join(DATA, 'benchmarks', 'config-overrides.json');
  const overrides = existsSync(overridesFile) ? JSON.parse(readFileSync(overridesFile, 'utf8')) : {};
  for (const name of repos) {
    const repo = join(DATA, 'benchmarks', 'repos', name);
    const file = join(DATA, 'benchmarks', 'tasks', `retrieval-jvm-${name}.jsonl`);
    if (!existsSync(repo) || !existsSync(file)) continue;
    if (overrides[name]) {
      writeFileSync(join(repo, 'gen-context.config.json'), JSON.stringify(overrides[name], null, 2) + '\n');
    }
    try {
      execFileSync(process.execPath, [join(ROOT, 'gen-context.js')], { cwd: repo, stdio: 'ignore' });
    } catch { continue; }
    if (!existsSync(join(repo, '.context', 'sig-index.json'))) continue;
    const m = run(file, repo, { topK: 5, learned: false }).metrics;
    corpora.push({ split: 'jvm', repo: name, cwd: repo, file });
    present.push(name);
    tasks += m.tasks;
    hits += m.hitAt5 * m.tasks;
    rr += m.mrr * m.tasks;
    prec += m.precisionAt5 * m.tasks;
  }
  if (!tasks) return null;
  return { hitAt5: hits / tasks, mrr: rr / tasks, precisionAt5: prec / tasks, tasks, repos: present };
}

const hard = score('retrieval-hard.jsonl', 'hard');
const jvm = scoreJvm();
const easy = score('retrieval.jsonl', 'easy');
const mined = score('retrieval-mined.jsonl', 'mined');
const leak = assertLeakFree('retrieval-hard.jsonl');
const leakMined = assertLeakFree('retrieval-mined.jsonl');

const pct = (n) => (n * 100).toFixed(1) + '%';
console.log('\n[sigmap] retrieval quality\n');
console.log('  corpus            tasks   hit@5     MRR     P@5');
console.log('  ' + '-'.repeat(48));
console.log(`  hard (gated)      ${String(hard.tasks).padStart(5)}   ${pct(hard.hitAt5).padStart(6)}   ${hard.mrr.toFixed(3)}   ${pct(hard.precisionAt5).padStart(6)}`);
console.log(`  mined (gated)     ${String(mined.tasks).padStart(5)}   ${pct(mined.hitAt5).padStart(6)}   ${mined.mrr.toFixed(3)}   ${pct(mined.precisionAt5).padStart(6)}`);
console.log(`  easy (reference)  ${String(easy.tasks).padStart(5)}   ${pct(easy.hitAt5).padStart(6)}   ${easy.mrr.toFixed(3)}   ${pct(easy.precisionAt5).padStart(6)}`);
if (jvm) {
  console.log(`  jvm (gated)       ${String(jvm.tasks).padStart(5)}   ${pct(jvm.hitAt5).padStart(6)}   ${jvm.mrr.toFixed(3)}   ${pct(jvm.precisionAt5).padStart(6)}`);
} else {
  console.log('  jvm               repos not cloned — skipped');
}
console.log('\n  mined = commit subjects + the files that commit touched. Nobody tuning');
console.log('  the ranker wrote them, so it is the only unbiased number here.');
console.log('  It is also SMALL: 1 task = ' + (100 / mined.tasks).toFixed(1) + 'pp, and the 95% interval over '
  + mined.tasks + ' tasks is ' + band(Math.round(mined.hitAt5 * mined.tasks), mined.tasks) + '.');
console.log('  Read it as a band, not a point.');

const prior = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
if (prior && prior.hard) {
  const dm2 = prior.mined ? mined.hitAt5 - prior.mined.hitAt5 : 0;
  const d = hard.hitAt5 - prior.hard.hitAt5;
  const dm = hard.mrr - prior.hard.mrr;
  const dj = (jvm && prior.jvm) ? jvm.hitAt5 - prior.jvm.hitAt5 : null;
  console.log(`\n  vs baseline       hard ${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}pp   mined ${dm2 >= 0 ? '+' : ''}${(dm2 * 100).toFixed(1)}pp   MRR ${dm >= 0 ? '+' : ''}${dm.toFixed(3)}`
    + (dj === null ? '' : `   jvm ${dj >= 0 ? '+' : ''}${(dj * 100).toFixed(1)}pp`));
}

// ── why every miss misses (#905) ─────────────────────────────────────────────
//
// Each task is ranked against the WHOLE index, not just the top 5, so a miss can be
// placed: absent, buried by a penalty, sharing no word with the question, or merely
// too low. The ranking is the one `run()` scored above, so the hits must agree with
// the table; if they do not, this report is wrong and says so rather than print.

const SPLITS = ['hard', 'mined', 'easy', 'jvm'];
const metricsOf = { hard, mined, easy, jvm };

// The index and import graph of each repository a corpus scores, built once and shared by
// the splits that score the same one (`hard`, `mined` and `easy` all score this checkout).
const prepared = new Map();
function prepare(cwd) {
  if (!prepared.has(cwd)) {
    const index = buildSigIndex(cwd);
    let graph = null;
    try { graph = buildFromCwd(cwd); } catch (_) { /* run() tolerates this too */ }
    prepared.set(cwd, { index, graph, indexed: new Set(index.keys()) });
  }
  return prepared.get(cwd);
}

const docStatsMemo = new Map();
function docStatsOf(cwd) {
  if (!docStatsMemo.has(cwd)) docStatsMemo.set(cwd, docStats(prepare(cwd).index, cwd));
  return docStatsMemo.get(cwd);
}

function attributeAll() {
  const bySplit = {};
  for (const c of corpora) {
    const { index, graph, indexed } = prepare(c.cwd);
    const { docFreq, docCount } = docStatsOf(c.cwd);
    const rows = attributeTasks({
      tasks: loadTasks(c.file),
      indexed,
      rankFull: (q) => rankQuery(q, index, index.size, { cwd: c.cwd, graph, learned: false })
        .map((x) => ({ file: x.file, score: x.score, penalty: x.signals && typeof x.signals.penalty === 'number' ? x.signals.penalty : 1 })),
      queryTerms: queryTermsOf,
      termsOf: termsOf(index, c.cwd),
      docFreq,
      docCount,
    });
    for (const r of rows) (bySplit[c.split] ||= []).push(c.repo ? { ...r, repo: c.repo } : r);
  }
  return bySplit;
}

/** What a baseline records beside a split's number: what its misses are made of. */
function whyRecord(rows) {
  const s = summarizeWhy(rows);
  const r = reachable(rows);
  const noToken = rows.filter((a) => a.cls === 'no-overlap' && a.gapClass);
  const count = (k) => noToken.filter((a) => a.gapClass === k).length;
  return {
    hits: s.hits,
    misses: Object.fromEntries(s.rows),
    reachable: r.reachable,
    reachableHits: r.hits,
    noTokenWords: { distinctive: count('distinctive'), commonOnly: count('common-only'), nowhere: count('nowhere'), inIndex: count('in-index') },
    answerIsTest: rows.filter((a) => a.expected.length && a.expected.every((f) => isTestAnswer(f))).length,
  };
}

const NEED_WHY = WHY || PER_TASK || AS_JSON || SAVE;
const attributed = NEED_WHY ? attributeAll() : null;
const records = attributed ? Object.fromEntries(SPLITS.filter((s) => attributed[s]).map((s) => [s, whyRecord(attributed[s])])) : null;

const disagreements = [];
if (records) {
  for (const s of Object.keys(records)) {
    const m = metricsOf[s];
    const gateHits = Math.round(m.hitAt5 * m.tasks);
    if (records[s].hits !== gateHits || attributed[s].length !== m.tasks) {
      disagreements.push(`${s}: the gate scored ${gateHits}/${m.tasks}, the attribution ${records[s].hits}/${attributed[s].length}`);
    }
  }
}

if (records && (WHY || PER_TASK)) {
  const cols = SPLITS.filter((s) => records[s]);
  const W = 9;
  const LABEL = 54;
  const rule = '  ' + '-'.repeat(LABEL + 4 + W * cols.length);
  const line = (label, cells) => console.log(`    ${label.padEnd(LABEL)}${cells.map((c) => String(c).padStart(W)).join('')}`);
  const rate = (n, d) => (d ? pct(n / d) : '—');

  if (WHY) {
    console.log(`\n  why the misses miss${' '.repeat(LABEL - 15)}${cols.map((c) => c.padStart(W)).join('')}`);
    console.log(rule);
    for (const label of Object.keys(records[cols[0]].misses)) line(label, cols.map((c) => records[c].misses[label]));
    console.log(rule);
    line('hits / tasks', cols.map((c) => `${records[c].hits}/${attributed[c].length}`));
    line('hit rate, every task', cols.map((c) => rate(records[c].hits, attributed[c].length)));
    line('hit rate, tasks a token can reach', cols.map((c) => rate(records[c].reachableHits, records[c].reachable)));
    line('  those tasks', cols.map((c) => `${records[c].reachable}/${attributed[c].length}`));
    line('of the no-token misses, the answer holds:', cols.map(() => ''));
    line('  a distinctive word only in its source', cols.map((c) => records[c].noTokenWords.distinctive));
    line('  only common words in its source', cols.map((c) => records[c].noTokenWords.commonOnly));
    line('  no word of the question at all', cols.map((c) => records[c].noTokenWords.nowhere));
    line('tasks whose only answer is test code', cols.map((c) => records[c].answerIsTest));
    console.log('\n  reachable = the answer is indexed and shares a word with the question; a task outside');
    console.log('  that set cannot be won by any method that matches words, so the rate over the set is');
    console.log('  the figure a ranking change can move. A distinctive word is one held by no more than');
    console.log(`  ${DISTINCTIVE_SHARE * 100}% of the indexed files: vocabulary a whole-file scan can use and a signature index`);
    console.log('  lacks. Common words (import, not, use) cannot tell the answer apart; no word is a paraphrase.');

    for (const s of cols) {
      const misses = attributed[s].filter((a) => a.cls !== 'hit');
      console.log(`\n  ${s}: ${misses.length} miss(es)`);
      for (const a of misses) {
        const where = a.repo ? `${a.repo}/${a.id}` : a.id;
        const evidence = a.cls === 'unindexed' ? 'the answer is not in the index'
          : a.gap ? `${GAP_LABELS[a.gapClass]} — ${formatGap(a.gap)}`
            : 'the answer scores zero for this question';
        console.log(`    ${where.padEnd(24)} ${whyLabel(a).padEnd(38)} ${a.rank ? `rank ${String(a.rank).padStart(4)}` : '         '}  ${evidence}`);
      }
    }
  }

  if (PER_TASK) {
    console.log('\n  per task  (split, id, class, rank of the best answer in the WHOLE ranking)');
    for (const s of cols) {
      for (const a of attributed[s]) {
        const where = a.repo ? `${a.repo}/${a.id}` : a.id;
        console.log(`    ${s.padEnd(6)} ${where.padEnd(24)} ${whyLabel(a).padEnd(38)} ${a.rank ? String(a.rank).padStart(4) : '   -'}`);
      }
    }
  }
}

// ── signal arms (#703) ───────────────────────────────────────────────────────
//
// Each opt-in ranking signal against the shipped ranker, task by task, on every split.
// The plain arm is the ranking `run()` scored, so its hits must agree with the table.

const armsOf = new Map(); // cwd -> the arm rankers of one repository, built once
function armsFor(cwd) {
  if (!armsOf.has(cwd)) {
    const { index, graph } = prepare(cwd);
    armsOf.set(cwd, buildArmRankers({ index, dir: cwd, graph, rankQuery }));
  }
  return armsOf.get(cwd);
}

/** What the arms add to an index, summed over repositories. */
function addedBy(statsList) {
  const sum = (k) => statsList.reduce((n, st) => n + (st[k] || 0), 0);
  return { routeSigs: sum('routeSigs'), minedTokens: sum('minedTokens'), bodyWords: sum('bodyWords'), bodyFiles: sum('bodyFiles') };
}

function signalsAll() {
  const parts = {};
  for (const c of corpora) {
    const { rankers, fellBack, stats } = armsFor(c.cwd);
    const tasks = loadTasks(c.file).map((t) => ({ id: t.id, query: t.query, expected_files: t.expected }));
    (parts[c.split] ||= []).push({ repo: c.repo || c.split, arms: compareArms({ tasks, rankers }), fellBack, stats });
  }
  return Object.fromEntries(Object.entries(parts).map(([split, list]) => [split, {
    arms: mergeArms(list.map((p) => ({ repo: p.repo, arms: p.arms }))),
    fellBack: list.filter((p) => p.fellBack.length).map((p) => `${p.repo}: ${p.fellBack.join(', ')}`),
    added: addedBy(list.map((p) => p.stats)),
  }]));
}

const signals = SIGNALS ? signalsAll() : null;
if (signals) {
  for (const s of Object.keys(signals)) {
    const m = metricsOf[s];
    if (signals[s].arms.plain.hits !== Math.round(m.hitAt5 * m.tasks)) {
      disagreements.push(`${s}: the gate scored ${Math.round(m.hitAt5 * m.tasks)}/${m.tasks}, the plain arm ${signals[s].arms.plain.hits}`);
    }
  }
}

if (signals && !disagreements.length) {
  const cols = SPLITS.filter((s) => signals[s]);
  const W = 13;
  const cell = (m, plain) => (m === plain ? `${m.hits}/${m.tasks}` : `${m.gained.length - m.lost.length >= 0 ? '+' : ''}${m.gained.length - m.lost.length} (${m.gained.length}/${m.lost.length})`);
  console.log('\n  signal arms: each opt-in signal against plain; a cell is net tasks (won/lost)');
  console.log(`    ${'arm'.padEnd(24)}${cols.map((c) => c.padStart(W)).join('')}`);
  for (const a of ARMS) {
    console.log(`    ${a.label.padEnd(24)}${cols.map((c) => cell(signals[c].arms[a.id], signals[c].arms.plain).padStart(W)).join('')}`);
  }
  for (const a of ARMS.slice(1)) {
    const touched = cols.filter((c) => signals[c].arms[a.id].gained.length || signals[c].arms[a.id].lost.length);
    if (!touched.length) continue;
    console.log(`\n    ${a.label}`);
    for (const c of touched) {
      const m = signals[c].arms[a.id];
      const shift = (id) => { const mv = m.moves.find((x) => x.id === id); return mv ? ` (${mv.from === null ? '-' : mv.from} → ${mv.to === null ? '-' : mv.to})` : ''; };
      if (m.gained.length) console.log(`      ${c.padEnd(6)} won   ${m.gained.map((id) => id + shift(id)).join(', ')}`);
      if (m.lost.length) console.log(`      ${c.padEnd(6)} lost  ${m.lost.map((id) => id + shift(id)).join(', ')}`);
    }
  }
  // Each repository once: `hard`, `mined` and `easy` all score this checkout.
  const added = addedBy([...armsOf.values()].map((a) => a.stats));
  console.log(`\n    cost: surface enrichment adds ${added.routeSigs} pseudo-signatures; mined expansions hold ${added.minedTokens} tokens; body words add ${added.bodyWords} words over ${added.bodyFiles} files (each repository counted once)`);
  for (const c of cols) for (const f of signals[c].fellBack) console.log(`    NOT RUN on ${c}/${f}: those arms equal plain there`);
}

if (SAVE) {
  const prev = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  // Keep a previously recorded jvm baseline when the repos are not cloned, so a
  // save from a machine without them does not silently erase the gate.
  const jvmOut = jvm || prev.jvm || undefined;
  // The account of each split's misses is recorded beside its number, so the page
  // that quotes it can be held to what was measured.
  const withWhy = (s, m) => (records && records[s] ? { ...m, why: records[s] } : m);
  writeFileSync(BASELINE, JSON.stringify({
    hard: withWhy('hard', hard), mined: withWhy('mined', mined), easy: withWhy('easy', easy),
    ...(jvmOut ? { jvm: jvm ? withWhy('jvm', jvm) : jvmOut } : {}),
    recordedBy: 'run-retrieval-gate.mjs',
  }, null, 2) + '\n');
  console.log(`\n[retrieval-gate] baseline saved → ${BASELINE.replace(ROOT + '/', '').replace(DATA + '/', '')}`);
}

const reasons = [];
if (leakMined.leaking.length > 0) {
  reasons.push(`mined split leaks basename tokens in ${leakMined.leaking.length} task(s)`);
}
if (mined.hitAt5 < MIN_MINED - EPS) {
  reasons.push(`mined hit@5 ${pct(mined.hitAt5)} below floor ${pct(MIN_MINED)}`);
}
if (NO_REGRESS && prior && prior.mined && mined.hitAt5 < prior.mined.hitAt5 - EPS) {
  reasons.push(`mined hit@5 regressed ${pct(prior.mined.hitAt5)} -> ${pct(mined.hitAt5)}`);
}
if (leak.leaking.length > 0) {
  reasons.push(`hard split leaks basename tokens in ${leak.leaking.length} task(s): ${leak.leaking.join(', ')}`);
}
// The JVM corpus is scored only when the repos are cloned, so it can never fail
// a fresh checkout — but when it IS measured, a regression counts like any other.
if (NO_REGRESS && prior && prior.jvm && jvm && jvm.hitAt5 < prior.jvm.hitAt5 - EPS) {
  reasons.push(`jvm hit@5 regressed ${pct(prior.jvm.hitAt5)} -> ${pct(jvm.hitAt5)}`);
}
if (hard.hitAt5 < MIN - EPS) {
  reasons.push(`hard hit@5 ${pct(hard.hitAt5)} below floor ${pct(MIN)}`);
}
// The hard corpus targets THIS repo's own source, so its score moves whenever
// the indexed file set changes — BM25 statistics shift with every added or
// edited document. Measured in CI: a branch adding one two-assertion test file
// and nothing else scored 75.6% -> 74.4%; a branch additionally touching 20
// extractor files scored 72.2%, with its ranking behaviour provably unchanged
// (every ceiling restored to its original value produced the identical number).
//
// A check that fires on a no-op cannot distinguish a regression from ordinary
// development, so `hard` is held to its absolute FLOOR rather than to the
// previous run. Real protection is retained elsewhere: the floor below, plus
// no-regress on `mined` and on `jvm` — and `jvm` scores against other repos
// entirely, so it is free of this feedback loop.
if (NO_REGRESS && prior && prior.hard && hard.hitAt5 < prior.hard.hitAt5 - EPS) {
  console.log(`\n  note: hard ${pct(prior.hard.hitAt5)} → ${pct(hard.hitAt5)}`
    + ' — reported, not enforced: hard scores against this repo, so the number moves'
    + '\n        with the indexed file set. The floor below is the enforced check.');
}

// One task is worth 100/N points. Compute headroom in TASKS, not in
// percentage points — float division of a k/N ratio rounds the answer off by one.
const perTask = 100 / hard.tasks;
const hits = Math.round(hard.hitAt5 * hard.tasks);
const minHits = Math.ceil(MIN * hard.tasks - EPS);
console.log(`\n  floor ${pct(MIN)}  ·  ${hits}/${hard.tasks} tasks pass  ·  1 task = ${perTask.toFixed(1)}pp  ·  ${Math.max(0, hits - minHits)} task(s) of headroom`);

if (disagreements.length) {
  console.error('\n[retrieval-gate] the attribution contradicts the gate, so it is not reported:');
  for (const d of disagreements) console.error('  ✗ ' + d);
  process.exit(1);
}
if (AS_JSON) {
  const splits = {};
  for (const s of Object.keys(records)) {
    splits[s] = {
      metrics: metricsOf[s],
      why: records[s],
      perTask: attributed[s].map((a) => ({ id: a.id, ...(a.repo ? { repo: a.repo } : {}), class: whyLabel(a), rank: a.rank, ...(a.gapClass ? { gapClass: a.gapClass } : {}) })),
      ...(signals && signals[s] ? { signals: signals[s] } : {}),
    };
  }
  // Synchronous on purpose: this process exits right after, and an exit cuts off a piped write.
  writeAll(1, JSON.stringify({ splits }, null, 2) + '\n');
}

if (!GATE) {
  console.log('\n[retrieval-gate] report only (pass --gate to enforce)\n');
  process.exit(0);
}
if (reasons.length > 0) {
  console.error('\n[retrieval-gate] FAIL');
  for (const r of reasons) console.error('  ✗ ' + r);
  console.error('');
  process.exit(1);
}
console.log('\n[retrieval-gate] PASS\n');
