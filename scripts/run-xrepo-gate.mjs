#!/usr/bin/env node
/**
 * Labelled third-party retrieval gate (xrepo, #892).
 *
 *   node scripts/run-xrepo-gate.mjs                          # report only
 *   node scripts/run-xrepo-gate.mjs --gate --no-regress      # exit 1 below the floor / on regression
 *   node scripts/run-xrepo-gate.mjs --gate --require-repos   # also exit 1 if a repo is absent (CI)
 *   node scripts/run-xrepo-gate.mjs --save                   # record the baseline
 *   node scripts/run-xrepo-gate.mjs --per-task               # per-task ranks, and what moved vs the baseline
 *   node scripts/run-xrepo-gate.mjs --why                    # why every miss misses (#674): not indexed / penalty / ranking
 *   node scripts/run-xrepo-gate.mjs --signals                # each opt-in ranking signal against plain, task by task (#703); records nothing
 *   node scripts/run-xrepo-gate.mjs --only gin,tokio --json
 *
 * WHY: every other retrieval gate scores a corpus this project wrote or can
 * influence — `hard` against its own repo, `mined` from its own history. A
 * ranking regression on a repo we do not control therefore ships green (#805,
 * #807, #808 all did). This scores a human-labelled question -> expected-files
 * set across third-party repositories pinned to exact commits
 * (benchmarks/xrepo-repos.json), authored before any ranker run.
 *
 * ZERO-CONFIG: each repo is indexed the way a first-time user's `sigmap` run
 * indexes it — auto-detected srcDirs, no config file (the manifest's `srcDirs`
 * is a recorded detection gap, shown as cfg=srcDirs). A task whose every expected
 * file is missing from that index is UNREACHABLE: detection skipped its directory,
 * or the extractor emitted no signature for it. Unreachable tasks are measured
 * product gaps and stay in the baseline; the gate fails when a task that WAS
 * reachable becomes unreachable (the #805 shape), not on the gaps themselves.
 *
 * READ IT AS A BAND. Each task is worth 100/N points and the 95% interval over
 * N tasks is wide. The floor guards the level; per-repo no-regress guards
 * against change — both hold because the ranker is deterministic and every repo
 * is pinned, so a repo's hit count moves only when SigMap's code does.
 *
 * Reproducibility: `learned: false`, hermetic regeneration through
 * withSharedRepoContext (the checkout is left byte-identical), and the same
 * `run()` the other corpora use. Exits 0 when the repos are absent, so a fresh
 * checkout is never broken by it — unless --require-repos, which CI passes.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { band } from './lib/band.mjs';
import { loadManifest, checkoutState, readTasks, withZeroConfigIndex, TASKS_REL, BASELINE_REL } from './lib/xrepo.mjs';
import { staticProblems, repoProblems } from './lib/xrepo-hygiene.mjs';
import { rankOf, totals, decide, EPS, summarizeWhy, whyLabel } from './lib/xrepo-gate.mjs';
import { attributeTasks, formatGap, GAP_LABELS } from './lib/attribution.mjs';
import { docStats, queryTermsOf, termsOf } from './lib/corpus-vocabulary.mjs';
import { ARMS, compareArms, mergeArms, verdictOf } from './lib/signal-arms.mjs';
import { buildArmRankers } from './lib/signal-rankers.mjs';

const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.SIGMAP_XREPO_DATA ? path.resolve(process.env.SIGMAP_XREPO_DATA) : CODE_ROOT;
const require = createRequire(import.meta.url);
const { run, rank: rankQuery } = require(path.join(CODE_ROOT, 'src/eval/runner'));
const { buildFromCwd } = require(path.join(CODE_ROOT, 'src/graph/builder'));

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };

const GATE = has('--gate');
const NO_REGRESS = has('--no-regress');
const SAVE = has('--save');
const REQUIRE = has('--require-repos');
const AS_JSON = has('--json');
const PER_TASK = has('--per-task');
const WHY = has('--why');
const SIGNALS = has('--signals');
const ONLY = val('--only', null) ? new Set(val('--only', '').split(',')) : null;

// Overall hit@5 floor, enforced only on a COMPLETE run (every repo scored) —
// a subset is not comparable with the whole. First measured 40/83 = 48.2%, with
// a 95% interval of 37.8%-58.8%; 0.40 leaves 6 tasks of headroom. The floor guards
// against a collapse — a bug that indexes nothing, or demotes everything. The sharp
// check is per-repo no-regress below, which holds because the ranker is
// deterministic and every repo is pinned.
const MIN_XREPO = 0.40;
const MIN = parseFloat(val('--min', String(MIN_XREPO)));

const BASELINE = path.join(DATA, BASELINE_REL);
const pct = (n) => (n * 100).toFixed(1) + '%';

const manifest = loadManifest(DATA);
const tasksFile = path.join(DATA, TASKS_REL);
const allTasks = fs.existsSync(tasksFile) ? readTasks(tasksFile) : [];
const byRepo = new Map();
for (const t of allTasks) {
  if (!byRepo.has(t.repo)) byRepo.set(t.repo, []);
  byRepo.get(t.repo).push(t);
}

// Static integrity (shape, leaks, answer eligibility) needs no checkout, so it
// runs for every task on every machine — a labelling mistake cannot hide in a
// repo that happens to be absent.
const manifestNames = new Set(manifest.repos.map((r) => r.name));
const problems = [];
for (const t of allTasks) for (const p of staticProblems(t, manifestNames)) problems.push({ repo: t.repo, ...p });

/**
 * Rank every task under each opt-in signal, over the repo's one zero-config index
 * and graph (see signal-rankers.mjs for how each arm is built).
 */
function scoreSignals({ tasks, index, dir, graph }) {
  const { rankers, fellBack, stats } = buildArmRankers({ index, dir, graph, rankQuery });
  return { arms: compareArms({ tasks, rankers }), fellBack, stats };
}

/** Score one repo's tasks against its pinned, zero-config-indexed checkout. */
function scoreRepo(repo, tasks) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-xrepo-'));
  try {
    const file = path.join(tmp, 'tasks.jsonl');
    fs.writeFileSync(file, tasks.map((t) => JSON.stringify({ id: t.id, query: t.query, expected_files: t.expected_files, repo: '.' })).join('\n') + '\n');
    return withZeroConfigIndex(DATA, repo, ({ dir, index }) => {
      const found = repoProblems({ tasks, index, dir }).map((p) => ({ repo: repo.name, ...p }));
      const r = run(file, dir, { topK: 5, learned: false });
      const ranks = {};
      for (const t of r.tasks) ranks[t.id] = rankOf(t.ranked, t.expected);
      // A task is UNREACHABLE when every expected file is missing from the index:
      // detection skipped its directory, or the extractor emitted no signature for
      // it. That is a measured product gap, not a corpus defect, so it stays in the
      // corpus and is recorded in the baseline; the gate fails only when a task
      // that was reachable becomes unreachable. A missing file or a copied phrase
      // IS a corpus defect and fails outright.
      const unindexed = found.filter((p) => p.kind === 'unindexed');
      const unreachable = tasks
        .filter((t) => t.expected_files.every((f) => unindexed.some((p) => p.id === t.id && p.file === f)))
        .map((t) => t.id);

      // --why: rank each question against the WHOLE index, not just the top 5, so
      // a miss can be placed — absent, buried by a penalty, or merely too low.
      // The graph is built exactly as `run()` builds it, so the ranking is the one
      // the table above scored.
      let graph = null;
      if (WHY || SIGNALS) {
        try { graph = buildFromCwd(dir); } catch (_) { /* run() tolerates this too */ }
      }
      let why = null;
      if (WHY) {
        const { docFreq, docCount } = docStats(index, dir);
        const attributed = attributeTasks({
          tasks: tasks.map((t) => ({ id: t.id, query: t.query, expected: t.expected_files })),
          indexed: new Set(index.keys()),
          rankFull: (q) => rankQuery(q, index, index.size, { cwd: dir, graph, learned: false })
            .map((x) => ({ file: x.file, score: x.score, penalty: x.signals && typeof x.signals.penalty === 'number' ? x.signals.penalty : 1 })),
          queryTerms: queryTermsOf,
          termsOf: termsOf(index, dir),
          docFreq,
          docCount,
        });
        why = {};
        for (const { id, query, expected, ...attribution } of attributed) why[id] = attribution;
      }
      const row = {
        repo: repo.name, language: repo.language, layout: repo.layout, config: repo.srcDirs ? 'srcDirs' : 'auto',
        tasks: r.tasks.length, hits: r.tasks.filter((t) => t.hit5).length,
        hitAt5: r.metrics.hitAt5, mrr: r.metrics.mrr, precisionAt5: r.metrics.precisionAt5,
        unindexed: unreachable.length, unreachable, ranks,
      };
      // Only when asked for: the default report and `--json` shape stay as they were.
      if (why) row.why = why;
      if (SIGNALS) {
        row.signals = scoreSignals({ tasks, index, dir, graph });
        // The plain arm IS the gate's ranking; if it scores differently the arms measure something else.
        if (row.signals.arms.plain.hits !== row.hits) {
          throw new Error(`${repo.name}: the plain arm scored ${row.signals.arms.plain.hits} hits and the gate ${row.hits}`);
        }
      }
      return { row, found: found.filter((p) => p.kind !== 'unindexed') };
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const rows = [];
const offPin = [];
const absentRepos = [];
for (const repo of manifest.repos) {
  const tasks = byRepo.get(repo.name) || [];
  if (!tasks.length) continue;
  if (ONLY && !ONLY.has(repo.name)) continue;
  const state = checkoutState(DATA, repo);
  if (!state.present) { absentRepos.push(repo.name); continue; }
  if (!state.atPin) { offPin.push(repo.name); continue; }
  const { row, found } = scoreRepo(repo, tasks);
  rows.push(row);
  problems.push(...found);
}

const expectedRepos = manifest.repos.filter((r) => (byRepo.get(r.name) || []).length && (!ONLY || ONLY.has(r.name))).map((r) => r.name);
const prior = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null;
const overall = totals(rows);

if (!rows.length && !REQUIRE && !AS_JSON) {
  console.log('\n[xrepo] no pinned checkouts present — skipped. Fetch them with: node scripts/fetch-xrepo-repos.mjs\n');
  if (offPin.length) console.log(`  off-pin: ${offPin.join(', ')}\n`);
}

const { reasons, complete } = decide({ rows, expectedRepos, offPin, prior, min: MIN, noRegress: NO_REGRESS, requireRepos: REQUIRE, problems });
const whySummary = WHY ? summarizeWhy(rows.flatMap((r) => Object.values(r.why || {}))) : null;
const signalsReport = SIGNALS && rows.length ? {
  arms: mergeArms(rows.map((r) => ({ repo: r.repo, arms: r.signals.arms }))),
  fellBack: Object.fromEntries(rows.filter((r) => r.signals.fellBack.length).map((r) => [r.repo, r.signals.fellBack])),
  added: {
    routeSigs: rows.reduce((n, r) => n + (r.signals.stats.routeSigs || 0), 0),
    minedTokens: rows.reduce((n, r) => n + (r.signals.stats.minedTokens || 0), 0),
    bodyWords: rows.reduce((n, r) => n + (r.signals.stats.bodyWords || 0), 0),
    bodyFiles: rows.reduce((n, r) => n + (r.signals.stats.bodyFiles || 0), 0),
  },
} : null;

if (AS_JSON) {
  console.log(JSON.stringify({ overall, band: band(overall.hits, overall.tasks), complete, rows, absent: absentRepos, offPin, reasons, why: whySummary || undefined, signals: signalsReport || undefined }, null, 2));
} else if (rows.length) {
  console.log('\n[sigmap] xrepo — labelled third-party retrieval (zero-config)\n');
  console.log('  repo                  lang              cfg      tasks   hit@5     MRR    P@5   unreachable');
  console.log('  ' + '-'.repeat(86));
  for (const r of rows) {
    const p = prior && prior.repos && prior.repos[r.repo];
    const delta = p && p.tasks === r.tasks ? (r.hits === p.hits ? '' : `  (${r.hits - p.hits > 0 ? '+' : ''}${r.hits - p.hits} vs baseline)`) : '';
    console.log(`  ${r.repo.padEnd(21)} ${r.language.padEnd(17)} ${r.config.padEnd(7)} ${String(r.tasks).padStart(5)}   ${pct(r.hitAt5).padStart(6)}   ${r.mrr.toFixed(3)}  ${pct(r.precisionAt5).padStart(6)}   ${String(r.unindexed).padStart(6)}${delta}`);
  }
  console.log('  ' + '-'.repeat(86));
  console.log(`  ${'overall'.padEnd(21)} ${(rows.length + ' repos').padEnd(17)} ${''.padEnd(7)} ${String(overall.tasks).padStart(5)}   ${pct(overall.hitAt5).padStart(6)}   ${overall.mrr.toFixed(3)}  ${pct(overall.precisionAt5).padStart(6)}`);
  console.log(`\n  ${overall.hits}/${overall.tasks} tasks hit · 1 task = ${(100 / overall.tasks).toFixed(1)}pp · 95% interval ${band(overall.hits, overall.tasks)}`);
  console.log('  Read it as a band, not a point: the level is uncertain by about that much,');
  console.log('  while a drop in any repo\'s hit count is a real change (deterministic ranker, pinned repos).');
  const minHits = Math.ceil(MIN * overall.tasks - EPS);
  console.log(`\n  floor ${pct(MIN)}  ·  ${Math.max(0, overall.hits - minHits)} task(s) of headroom${complete ? '' : '  ·  not enforced: incomplete run'}`);
  if (absentRepos.length) console.log(`  absent: ${absentRepos.join(', ')} (node scripts/fetch-xrepo-repos.mjs)`);
  if (offPin.length) console.log(`  off-pin (not scored): ${offPin.join(', ')}`);

  if (PER_TASK) {
    console.log('\n  per task (rank within the top 5; - = miss; U = unreachable, no expected file is in the zero-config index; * = moved vs baseline)\n');
    for (const r of rows) {
      const p = prior && prior.repos && prior.repos[r.repo];
      for (const [id, rank] of Object.entries(r.ranks)) {
        const was = p && p.ranks ? p.ranks[id] : undefined;
        const moved = was !== undefined && was !== rank ? `  * was ${was === null ? '-' : was}` : '';
        const q = (byRepo.get(r.repo).find((t) => t.id === id) || {}).query || '';
        const mark = r.unreachable.includes(id) ? 'U' : rank === null ? '-' : String(rank);
        console.log(`  ${id}  ${r.repo.padEnd(20)} ${mark.padStart(2)}  ${q.slice(0, 64)}${moved}`);
      }
    }
  }

  if (WHY) {
    // The fix for a miss depends on why it misses: an unindexed file needs
    // detection or an extractor, a penalised one a classifier, and only a
    // ranking miss needs ranking work — the kind that trades one split for another.
    console.log(`\n  why the ${whySummary.misses} misses miss  (${whySummary.hits} of ${whySummary.tasks} hit)\n`);
    for (const [label, n] of whySummary.rows) console.log(`    ${label.padEnd(40)} ${String(n).padStart(3)}`);
    // Whether the answer's own words could have served a question that shares none with the
    // index entry: a distinctive word only the source holds is vocabulary a body index would
    // add; common words cannot tell the file apart; no word at all is a paraphrase.
    const noToken = rows.flatMap((r) => Object.values(r.why || {})).filter((a) => a.cls === 'no-overlap' && a.gapClass);
    const noTokenAt = (k) => noToken.filter((a) => a.gapClass === k).length;
    console.log(`\n    of the ${noToken.length} no-token misses, the answer holds: a distinctive word only in its source ${noTokenAt('distinctive')} · only common words ${noTokenAt('common-only')} · no word of the question ${noTokenAt('nowhere')}`);
    console.log('\n  per miss  (rank = best expected file in the WHOLE ranking; "without" = its rank were the path penalty undone)\n');
    for (const r of rows) {
      for (const [id, a] of Object.entries(r.why || {})) {
        if (a.cls === 'hit') continue;
        const detail = a.cls === 'unindexed' ? 'the answer is not in the index'
          : a.cls === 'no-overlap' ? 'the answer scores zero for this question'
          : a.cls === 'penalty' ? `rank ${a.rank}, rank ${a.withoutPenalty} without the ${a.penalty} penalty`
          : `rank ${a.rank}`;
        const evidence = a.gap ? ` — ${GAP_LABELS[a.gapClass]} — ${formatGap(a.gap)}` : '';
        console.log(`  ${id}  ${r.repo.padEnd(20)} ${whyLabel(a).padEnd(40)} ${detail}${evidence}`);
      }
    }
  }

  if (signalsReport) {
    // A signal is judged by the tasks it wins and loses against plain, never by a
    // difference of rates: one task is worth about a point, and a signal that wins as
    // many as it loses has moved the answers around, not improved them.
    console.log('\n  signal arms  (zero-config, one index and graph per repo; measured here, never recorded)\n');
    console.log(`    ${'arm'.padEnd(24)} ${'hit@5'.padStart(15)}   ${'MRR'.padStart(5)}   against plain`);
    for (const a of ARMS) {
      const m = signalsReport.arms[a.id];
      if (!m) continue;
      console.log(`    ${a.label.padEnd(24)} ${`${m.hits}/${m.tasks} ${pct(m.hits / m.tasks)}`.padStart(15)}   ${m.mrr.toFixed(3)}   ${a.id === 'plain' ? '' : verdictOf(m)}`);
    }
    const shift = (m, id) => { const mv = m.moves.find((x) => x.id === id); return mv ? ` (${mv.from === null ? '-' : mv.from} → ${mv.to === null ? '-' : mv.to})` : ''; };
    for (const a of ARMS.slice(1)) {
      const m = signalsReport.arms[a.id];
      if (!m || (!m.gained.length && !m.lost.length)) continue;
      console.log(`\n    ${a.label}`);
      if (m.gained.length) console.log(`      won   ${m.gained.map((id) => id + shift(m, id)).join(', ')}`);
      if (m.lost.length) console.log(`      lost  ${m.lost.map((id) => id + shift(m, id)).join(', ')}`);
    }
    console.log(`\n    cost: surface enrichment adds ${signalsReport.added.routeSigs} pseudo-signatures to the index; mined expansions hold ${signalsReport.added.minedTokens} tokens; body words add ${signalsReport.added.bodyWords} words over ${signalsReport.added.bodyFiles} files`);
    for (const [repo, ids] of Object.entries(signalsReport.fellBack)) console.log(`    NOT RUN on ${repo}: ${ids.join(', ')} could not be built, so those arms equal plain there`);
  }
}

if (SAVE) {
  // Merge, never replace: a save from a machine that lacks some repos must not
  // erase their recorded baselines. Repos that left the corpus are pruned.
  const repos = {};
  for (const n of expectedRepos) if (prior && prior.repos && prior.repos[n]) repos[n] = prior.repos[n];
  if (!ONLY) for (const n of Object.keys(repos)) if (!(byRepo.get(n) || []).length) delete repos[n];
  for (const r of rows) {
    repos[r.repo] = { language: r.language, tasks: r.tasks, hits: r.hits, hitAt5: r.hitAt5, mrr: r.mrr, precisionAt5: r.precisionAt5, unreachable: r.unreachable, ranks: r.ranks };
  }
  const merged = Object.fromEntries(Object.entries(repos).sort(([a], [b]) => (a < b ? -1 : 1)));
  fs.writeFileSync(BASELINE, JSON.stringify({ overall: totals(Object.values(merged)), repos: merged, recordedBy: 'run-xrepo-gate.mjs' }, null, 2) + '\n');
  if (!AS_JSON) console.log(`\n[xrepo] baseline saved → ${path.relative(DATA, BASELINE)}`);
}

if (!GATE) {
  if (!AS_JSON && rows.length) console.log('\n[xrepo] report only (pass --gate to enforce)\n');
  process.exit(0);
}
if (reasons.length > 0) {
  console.error('\n[xrepo] FAIL');
  for (const r of reasons) console.error('  ✗ ' + r);
  console.error('');
  process.exit(1);
}
if (!AS_JSON) console.log('\n[xrepo] PASS\n');
