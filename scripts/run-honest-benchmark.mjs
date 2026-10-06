#!/usr/bin/env node
'use strict';

/**
 * run-honest-benchmark.mjs — SigMap ranker vs an honest grep-agent baseline.
 *
 * The task-benchmark's published baseline is random file selection
 * (min(1, 5/fileCount)) — nobody works that way. This benchmark scores the
 * production ranker against what an agent's grep loop actually does: scan the
 * whole repo for the query's terms and rank files by term coverage, then
 * occurrence count. Same task corpus (benchmarks/tasks/*.jsonl), same scorer
 * (src/eval/scorer.js), single-shot for both sides.
 *
 * The baseline is implemented internally (pure Node fs scan — no ripgrep, no
 * child processes) so the benchmark is zero-dependency and deterministic.
 * Directories skipped mirror ripgrep defaults: VCS/vendor dirs plus top-level
 * directory patterns from the scanned repo's .gitignore.
 *
 * SigMap's side reads each repo's committed context output via
 * src/eval/runner.js — run scripts/run-retrieval-benchmark.mjs first if a
 * repo's context file is missing.
 *
 *   node scripts/run-honest-benchmark.mjs           # print comparison table
 *   node scripts/run-honest-benchmark.mjs --save    # also write benchmarks/reports/honest-baseline.json
 *   node scripts/run-honest-benchmark.mjs --json    # print report JSON to stdout
 *   node scripts/run-honest-benchmark.mjs --autopsy # where SigMap and grep disagree, and what grep's score counts (#905)
 *   node scripts/run-honest-benchmark.mjs --signals # each opt-in ranking signal against plain on these tasks (#703); with --json, adds `signals`
 *   node scripts/run-honest-benchmark.mjs --autopsy --save  # also record benchmarks/reports/honest-autopsy.json
 *
 * No LLM API. All metrics are retrieval-rank math.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { stamp } from './lib/report-stamp.mjs';
import { grepRank, sigmapOutputs } from './lib/grep-baseline.mjs';
import { attributeTasks, summarizeWhy, whyLabel, rankOf, formatGap, GAP_LABELS } from './lib/attribution.mjs';
import { docStats, queryTermsOf, termsOf } from './lib/corpus-vocabulary.mjs';
import { crossTab, hitCounts, pollutedPlaces } from './lib/autopsy.mjs';
import { ARMS, compareArms, mergeArms, verdictOf } from './lib/signal-arms.mjs';
import { buildArmRankers } from './lib/signal-rankers.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TASKS_DIR = path.join(ROOT, 'benchmarks', 'tasks');
const REPOS_DIR = path.join(ROOT, 'benchmarks', 'repos');
const REPORT_PATH = path.join(ROOT, 'benchmarks', 'reports', 'honest-baseline.json');

const SAVE = process.argv.includes('--save');
const JSON_OUT = process.argv.includes('--json');
const AUTOPSY = process.argv.includes('--autopsy');
const SIGNALS = process.argv.includes('--signals');
const AUTOPSY_REPORT_PATH = path.join(ROOT, 'benchmarks', 'reports', 'honest-autopsy.json');

const runner = require(path.join(ROOT, 'src', 'eval', 'runner.js'));
const scorer = require(path.join(ROOT, 'src', 'eval', 'scorer.js'));
const { sizeBucket } = require(path.join(ROOT, 'src', 'eval', 'corpus.js'));

const round = (n, d = 3) => Math.round(Number(n) * 10 ** d) / 10 ** d;
const norm = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '');

function loadTasks(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// ── run ──────────────────────────────────────────────────────────────────────
const taskFiles = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.jsonl')).sort();
const perRepo = [];
const skipped = [];
let nTasks = 0;
const totals = { sigHit: 0, grepHit: 0, sigMrr: 0, grepMrr: 0 };
const autopsyRecords = []; // --autopsy: one per task
const armParts = []; // --signals: one per repo
let armFellBack = [];
let polluted = { places: 0, polluted: 0 };

// A3: per-split (easy/hard) and per-repo-size-bucket accumulators.
const newAcc = () => ({ n: 0, sigHit: 0, grepHit: 0, sigMrr: 0, grepMrr: 0 });
const splits = { easy: newAcc(), hard: newAcc() };
const buckets = { small: newAcc(), medium: newAcc(), large: newAcc() };
const accAdd = (acc, sigH, grepH, sigRr, grepRr) => {
  acc.n++; acc.sigHit += sigH; acc.grepHit += grepH; acc.sigMrr += sigRr; acc.grepMrr += grepRr;
};
const accSummary = (acc) => (acc.n === 0 ? null : {
  tasks: acc.n,
  sigmap: { hitAt5: round(acc.sigHit / acc.n), mrr: round(acc.sigMrr / acc.n) },
  grepBaseline: { hitAt5: round(acc.grepHit / acc.n), mrr: round(acc.grepMrr / acc.n) },
});

for (const f of taskFiles) {
  const name = f.replace('.jsonl', '');
  const repoPath = name === 'retrieval' ? ROOT : path.join(REPOS_DIR, name);
  if (!fs.existsSync(repoPath)) { skipped.push({ repo: name, reason: 'repo not cloned' }); continue; }

  const sigIndex = runner.buildSigIndex(repoPath);
  if (!sigIndex || sigIndex.size === 0) {
    skipped.push({ repo: name, reason: 'no context output — run scripts/run-retrieval-benchmark.mjs' });
    continue;
  }

  const tasks = loadTasks(path.join(TASKS_DIR, f));
  const { ranked: grepRanked, filesScanned } = grepRank(repoPath, tasks);

  if (AUTOPSY) {
    // The same question asked three ways: where SigMap ranks each answer (over its whole index, the
    // way the honest side ranks), where the published grep scan does, and where the scan does with the
    // files SigMap itself wrote left out of it — those hold every identifier in the repository.
    const isSigmapFile = sigmapOutputs(repoPath);
    const { ranked: cleanRanked } = grepRank(repoPath, tasks, { skipFile: isSigmapFile });
    const { docFreq, docCount } = docStats(sigIndex, repoPath);
    const attributed = attributeTasks({
      tasks: tasks.map((t) => ({ id: t.id, query: t.query, expected: t.expected_files || [] })),
      indexed: new Set(sigIndex.keys()),
      rankFull: (q) => runner.rank(q, sigIndex, sigIndex.size)
        .map((r) => ({ file: r.file, score: r.score, penalty: r.signals && typeof r.signals.penalty === 'number' ? r.signals.penalty : 1 })),
      queryTerms: queryTermsOf,
      termsOf: termsOf(sigIndex, repoPath),
      docFreq,
      docCount,
    });
    for (const a of attributed) {
      const t = tasks.find((x) => x.id === a.id);
      autopsyRecords.push({
        repo: name, id: a.id, split: t.split === 'hard' ? 'hard' : 'easy', query: a.query, expected: a.expected,
        sigRank: a.rank, grepRank: rankOf(grepRanked.get(a.id) || [], a.expected), cleanGrepRank: rankOf(cleanRanked.get(a.id) || [], a.expected),
        cls: a.cls, bucket: a.bucket, gap: a.gap, gapClass: a.gapClass,
      });
    }
    const p = pollutedPlaces(tasks.map((t) => ({ top5: (grepRanked.get(t.id) || []).slice(0, 5) })), isSigmapFile);
    polluted = { places: polluted.places + p.places, polluted: polluted.polluted + p.polluted };
  }

  if (SIGNALS) {
    // SigMap is scored here without an import graph (see the loop below), so the arms are built
    // the same way: plain is the table's own ranking, and the two arms about the graph are left out.
    const { rankers, fellBack } = buildArmRankers({ index: sigIndex, dir: repoPath, graph: null, rankQuery: runner.rank });
    armParts.push({ repo: name, arms: compareArms({ tasks: tasks.map((t) => ({ id: t.id, query: t.query, expected_files: t.expected_files || [] })), rankers }) });
    for (const f of fellBack) armFellBack.push(`${name}: ${f}`);
  }

  const bucket = sizeBucket(filesScanned);
  const row = { repo: name, tasks: tasks.length, sigHit: 0, grepHit: 0 };
  for (const t of tasks) {
    const expected = t.expected_files || [];
    const split = t.split === 'hard' ? 'hard' : 'easy';
    const sig = runner.rank(t.query, sigIndex, 10).map((r) => r.file);
    const grep = grepRanked.get(t.id) || [];
    const sigH = scorer.hitAtK(sig, expected, 5);
    const grepH = scorer.hitAtK(grep, expected, 5);
    const sigRr = scorer.reciprocalRank(sig, expected);
    const grepRr = scorer.reciprocalRank(grep, expected);
    row.sigHit += sigH;
    row.grepHit += grepH;
    totals.sigHit += sigH ? 1 : 0;
    totals.grepHit += grepH ? 1 : 0;
    totals.sigMrr += sigRr;
    totals.grepMrr += grepRr;
    accAdd(splits[split], sigH, grepH, sigRr, grepRr);
    accAdd(buckets[bucket], sigH, grepH, sigRr, grepRr);
    nTasks++;
  }
  perRepo.push({
    repo: name,
    tasks: tasks.length,
    bucket,
    // The 'retrieval' task set scores against the LIVE SigMap repo (ROOT), so
    // its context — and this row — legitimately drifts with every release.
    // Labeled so cross-release comparisons never mistake it for harness
    // instability (#522).
    ...(repoPath === ROOT ? { selfRepo: true } : {}),
    sigmapHitAt5: round(row.sigHit / tasks.length),
    grepHitAt5: round(row.grepHit / tasks.length),
  });
}

if (nTasks === 0) {
  console.error('No tasks scored — clone benchmark repos and generate context first.');
  process.exit(1);
}

const sigHitAt5 = totals.sigHit / nTasks;
const grepHitAt5 = totals.grepHit / nTasks;
const report = {
  generated: new Date().toISOString(),
  methodology: {
    corpus: 'benchmarks/tasks/*.jsonl',
    scorer: 'src/eval/scorer.js hitAtK/reciprocalRank, k=5',
    sigmap: 'src/eval/runner.js buildSigIndex + rank over committed context output',
    baseline: 'internal single-shot grep-agent: whole-repo term scan, ranked by distinct-term coverage then occurrences; skips VCS/vendor dirs + top-level .gitignore dirs; files ≤1MB, non-binary',
    note: 'Single-shot floor for agentic grep — a live agent iterates above this at the cost of extra turns and tokens.',
  },
  summary: {
    tasks: nTasks,
    repos: perRepo.length,
    sigmap: { hitAt5: round(sigHitAt5), mrr: round(totals.sigMrr / nTasks) },
    grepBaseline: { hitAt5: round(grepHitAt5), mrr: round(totals.grepMrr / nTasks) },
    lift: round(grepHitAt5 > 0 ? sigHitAt5 / grepHitAt5 : 0, 2),
    deltaPts: round((sigHitAt5 - grepHitAt5) * 100, 1),
    splits: { easy: accSummary(splits.easy), hard: accSummary(splits.hard) },
    buckets: {
      small: accSummary(buckets.small),
      medium: accSummary(buckets.medium),
      large: accSummary(buckets.large),
    },
  },
  repos: perRepo,
  skipped,
};

const signalsMerged = SIGNALS && armParts.length ? mergeArms(armParts) : null;
if (signalsMerged && signalsMerged.plain.hits !== totals.sigHit) {
  console.error(`\n  --signals disagrees with the table: the plain arm scored ${signalsMerged.plain.hits} and the table ${totals.sigHit}`);
  process.exit(1);
}

if (JSON_OUT) {
  // The saved report is never touched by `--signals`: it is added to what is printed, not to what is kept.
  console.log(JSON.stringify(signalsMerged ? { ...report, signals: { arms: signalsMerged, fellBack: armFellBack } } : report, null, 2));
} else {
  const pct = (v) => `${(v * 100).toFixed(0)}%`.padStart(5);
  console.log('\n  repo                 tasks  SigMap  grep-agent');
  console.log('  -------------------- -----  ------  ----------');
  for (const r of perRepo) {
    console.log(`  ${(r.repo + (r.selfRepo ? '*' : '')).padEnd(20)} ${String(r.tasks).padStart(5)}  ${pct(r.sigmapHitAt5)}  ${pct(r.grepHitAt5).padStart(9)}`);
  }
  const s = report.summary;
  console.log(`\n  SigMap        hit@5 ${(s.sigmap.hitAt5 * 100).toFixed(1)}%   MRR ${s.sigmap.mrr.toFixed(3)}`);
  console.log(`  grep baseline hit@5 ${(s.grepBaseline.hitAt5 * 100).toFixed(1)}%   MRR ${s.grepBaseline.mrr.toFixed(3)}`);
  console.log(`  honest lift   ${s.lift}×  (+${s.deltaPts}pt over ${s.tasks} tasks, ${s.repos} repos)`);
  const line = (label, a) => a && console.log(
    `  ${label.padEnd(13)} hit@5 ${(a.sigmap.hitAt5 * 100).toFixed(1)}%  MRR ${a.sigmap.mrr.toFixed(3)}  vs grep ${(a.grepBaseline.hitAt5 * 100).toFixed(1)}%  (${a.tasks} tasks)`);
  line('split easy', s.splits.easy);
  line('split hard', s.splits.hard);
  line('repos small', s.buckets.small);
  line('repos medium', s.buckets.medium);
  line('repos large', s.buckets.large);
  if (perRepo.some((r) => r.selfRepo)) {
    console.log('  * self-repo task set — scored against the live SigMap repo; drifts with development by design');
  }
  for (const sk of skipped) console.log(`  [skipped] ${sk.repo}: ${sk.reason}`);
}

if (signalsMerged && !JSON_OUT) {
  console.log('\n  signal arms on these tasks, scored without an import graph like the table above; a signal is judged by the tasks it wins and loses against plain\n');
  console.log(`    ${'arm'.padEnd(24)} ${'hit@5'.padStart(15)}   ${'MRR'.padStart(5)}   against plain`);
  for (const a of ARMS) {
    const m = signalsMerged[a.id];
    if (!m) continue;
    console.log(`    ${a.label.padEnd(24)} ${`${m.hits}/${m.tasks} ${(100 * m.hits / m.tasks).toFixed(1)}%`.padStart(15)}   ${m.mrr.toFixed(3)}   ${a.id === 'plain' ? '' : verdictOf(m)}`);
  }
  for (const f of armFellBack) console.log(`    NOT RUN: ${f}`);
}

if (AUTOPSY && !JSON_OUT) {
  // The autopsy's own hit counts must be the table's, or it is describing another ranking.
  const counted = hitCounts(autopsyRecords);
  if (counted.sigmap !== totals.sigHit || counted.grep !== totals.grepHit) {
    console.error(`\n  --autopsy disagrees with the table: SigMap ${counted.sigmap} vs ${totals.sigHit}, grep ${counted.grep} vs ${totals.grepHit}`);
    process.exit(1);
  }
  const pc = (n, d) => `${((100 * n) / d).toFixed(1)}%`;
  console.log('\n  autopsy: where SigMap and a whole-file grep scan disagree');
  console.log(`\n    grep, as published                            ${counted.grep}/${counted.tasks} = ${pc(counted.grep, counted.tasks)}   (SigMap ${counted.sigmap}/${counted.tasks} = ${pc(counted.sigmap, counted.tasks)}, lift ${(counted.sigmap / counted.grep).toFixed(2)}x)`);
  console.log(`    grep, SigMap's own files left out of the scan   ${counted.cleanGrep}/${counted.tasks} = ${pc(counted.cleanGrep, counted.tasks)}   (lift ${(counted.sigmap / counted.cleanGrep).toFixed(2)}x)`);
  console.log(`    SigMap's output files held ${polluted.polluted} of the ${polluted.places} top-5 places in the published scan (.context/, copilot-instructions.md, ...): not answers, and they push answers out`);

  const missed = autopsyRecords.filter((r) => r.cls !== 'hit');
  const why = summarizeWhy(autopsyRecords.map((r) => ({ cls: r.cls, bucket: r.bucket })));
  console.log(`\n    SigMap's ${missed.length} miss(es) on this corpus, by class:`);
  for (const [label, n] of why.rows) if (n) console.log(`      ${label.padEnd(40)} ${String(n).padStart(3)}`);

  const show = (label, recs) => {
    const x = crossTab(recs);
    console.log(`    ${label.padEnd(26)} both hit ${String(x.both.length).padStart(3)} · only SigMap ${String(x.sigmapOnly.length).padStart(3)} · only grep ${String(x.grepOnly.length).padStart(3)} · neither ${String(x.neither.length).padStart(3)}`);
    return x;
  };
  console.log('\n    against the scan without SigMap\'s own files:');
  show(`every task (${autopsyRecords.length})`, autopsyRecords);
  const hardRecs = autopsyRecords.filter((r) => r.split === 'hard');
  const hardX = show(`hard split (${hardRecs.length})`, hardRecs);

  const grepOnly = crossTab(autopsyRecords).grepOnly;
  console.log(`\n    tasks grep finds and SigMap does not (${grepOnly.length}):`);
  for (const r of grepOnly) {
    const evidence = r.gap ? `${GAP_LABELS[r.gapClass]} — ${formatGap(r.gap)}` : 'the answer is not in the index';
    console.log(`      ${(r.repo + '/' + r.id).padEnd(24)} ${r.split.padEnd(5)} SigMap ${whyLabel({ cls: r.cls, bucket: r.bucket }).padEnd(38)} grep rank ${r.cleanGrepRank}  ${evidence}`);
  }
  if (!grepOnly.length) console.log('      none');
  const hardOnly = hardX.grepOnly.length;
  console.log(`\n    hard split: grep finds ${hardOnly} task(s) SigMap does not and SigMap finds ${hardX.sigmapOnly.length} grep does not.`);

  if (SAVE) {
    // The figures the guide quotes. The grep scan walks the working tree for the self-repo task set, so
    // they depend on the layout the clones sit in — record them from the layout the published report uses.
    const counts = (recs) => { const x = crossTab(recs); return { both: x.both.length, sigmapOnly: x.sigmapOnly.length, grepOnly: x.grepOnly.length, neither: x.neither.length }; };
    const autopsyReport = {
      benchmark: 'honest-autopsy',
      method: 'run-honest-benchmark.mjs --autopsy: SigMap scored without an import graph, against the published grep scan and against the same scan with the files SigMap itself writes left out',
      tasks: counted.tasks,
      sigmapHits: counted.sigmap,
      grepHits: { published: counted.grep, withoutSigmapFiles: counted.cleanGrep },
      sigmapFilesInGrepTop5: polluted,
      sigmapMisses: Object.fromEntries(why.rows.filter(([, n]) => n)),
      againstScanWithoutSigmapFiles: { allTasks: counts(autopsyRecords), hardSplit: counts(hardRecs) },
      grepOnlyTasks: grepOnly.map((r) => ({ task: `${r.repo}/${r.id}`, split: r.split, sigmap: whyLabel({ cls: r.cls, bucket: r.bucket }), grepRank: r.cleanGrepRank })),
    };
    fs.writeFileSync(AUTOPSY_REPORT_PATH, JSON.stringify(stamp(autopsyReport, ROOT), null, 2) + '\n');
    console.log(`\n  saved → ${path.relative(ROOT, AUTOPSY_REPORT_PATH)}`);
  }
}

if (SAVE) {
  fs.writeFileSync(REPORT_PATH, JSON.stringify(stamp(report, ROOT), null, 2) + '\n');
  console.log(`\n  saved → ${path.relative(ROOT, REPORT_PATH)}`);
}
