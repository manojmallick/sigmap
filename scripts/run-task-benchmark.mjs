#!/usr/bin/env node
/**
 * SigMap task benchmark — prompt-reduction model derived from retrieval tiers
 *
 * Reads retrieval.json + quality.json, applies a prompt-weight model:
 *
 *   Correct  (rank-1 hit)   → 1.0 prompts  (right file surfaces immediately)
 *   Partial  (rank 2–5 hit) → 2.0 prompts  (partial context, user re-asks)
 *   Wrong    (not top-5)    → 3.0 prompts  (wrong context, user iterates)
 *
 * Applies same model to the random baseline (13.7% avg hit → mostly Wrong).
 * Combines with dark-symbol hallucination-risk proxy from quality.json.
 *
 * No LLM API. All numbers are retrieval-rank math on 80 empirical tasks.
 *
 * Usage:
 *   node scripts/run-task-benchmark.mjs
 *   node scripts/run-task-benchmark.mjs --save
 *   node scripts/run-task-benchmark.mjs --json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const REPORTS   = path.join(ROOT, 'benchmarks', 'reports');

const SAVE     = process.argv.includes('--save');
const JSON_OUT = process.argv.includes('--json');

// ---------------------------------------------------------------------------
// Prompt-weight model
// ---------------------------------------------------------------------------
const W = { correct: 1.0, partial: 2.0, wrong: 3.0 };

function promptsFromTiers(correctFrac, partialFrac, wrongFrac) {
  return correctFrac * W.correct + partialFrac * W.partial + wrongFrac * W.wrong;
}

// ---------------------------------------------------------------------------
// Load source reports
// ---------------------------------------------------------------------------
const retrieval = JSON.parse(fs.readFileSync(path.join(REPORTS, 'retrieval.json'), 'utf8'));
const quality   = JSON.parse(fs.readFileSync(path.join(REPORTS, 'quality.json'),   'utf8'));

// Index quality by repo name
const qualityByRepo = {};
for (const r of quality.repos) qualityByRepo[r.repo] = r;

// ---------------------------------------------------------------------------
// Per-repo computation
// ---------------------------------------------------------------------------
const repoResults = [];

for (const repo of retrieval.repos) {
  const tasks   = repo.tasks;
  const correct = repo.tiers.correct / tasks;
  const partial = repo.tiers.partial / tasks;
  const wrong   = repo.tiers.wrong   / tasks;

  // SigMap prompts
  const promptsWith = promptsFromTiers(correct, partial, wrong);

  // Random baseline prompts
  // random baseline = P(any of 5 random selections hits) ≈ min(1, 5/fileCount)
  // At random: almost no rank-1 hits, rare partial, mostly wrong
  // P(rank-1 random) = 1/fileCount; P(rank 2-5 random) = rand - 1/fileCount
  const rand         = repo.randomBaseline;
  const randCorrect  = Math.min(rand, 1 / repo.fileCount);
  const randPartial  = Math.max(0, rand - randCorrect);
  const randWrong    = 1 - rand;
  const promptsWithout = promptsFromTiers(randCorrect, randPartial, randWrong);

  const reduction = (promptsWithout - promptsWith) / promptsWithout;

  // Quality / hallucination proxy
  const q = qualityByRepo[repo.repo] || null;
  const grounded      = q ? (q.groundedSymbols || 0) : null;
  const dark          = q ? (q.darkSymbols     || 0) : null;
  const hallucinationRisk = q ? dark / (grounded + dark) : null;

  repoResults.push({
    repo:              repo.repo,
    fileCount:         repo.fileCount,
    tasks,
    // Retrieval quality tiers (%)
    correctPct:        +(correct * 100).toFixed(1),
    partialPct:        +(partial * 100).toFixed(1),
    wrongPct:          +(wrong   * 100).toFixed(1),
    // Prompt model
    promptsWith:       +promptsWith.toFixed(2),
    promptsWithout:    +promptsWithout.toFixed(2),
    reductionPct:      +(reduction * 100).toFixed(1),
    // Hallucination risk proxy
    groundedSymbols:   grounded,
    darkSymbols:       dark,
    hallucinationRiskPct: hallucinationRisk !== null ? +(hallucinationRisk * 100).toFixed(1) : null,
  });
}

// ---------------------------------------------------------------------------
// Aggregate summary
// ---------------------------------------------------------------------------
const totalTasks   = retrieval.repos.reduce((s, r) => s + r.tasks, 0);
const totalCorrect = retrieval.repos.reduce((s, r) => s + r.tiers.correct, 0);
const totalPartial = retrieval.repos.reduce((s, r) => s + r.tiers.partial, 0);
const totalWrong   = retrieval.repos.reduce((s, r) => s + r.tiers.wrong,   0);

const aggCorrect = totalCorrect / totalTasks;
const aggPartial = totalPartial / totalTasks;
const aggWrong   = totalWrong   / totalTasks;

const aggPromptsWith    = promptsFromTiers(aggCorrect, aggPartial, aggWrong);
const avgRandBaseline   = retrieval.repos.reduce((s, r) => s + r.randomBaseline, 0) / retrieval.repos.length;
const aggPromptsWithout = promptsFromTiers(
  Math.min(avgRandBaseline, 1 / 50),   // ~avg 1/fileCount across repos
  Math.max(0, avgRandBaseline - 1/50),
  1 - avgRandBaseline
);
const aggReduction = (aggPromptsWithout - aggPromptsWith) / aggPromptsWithout;

const totalGrounded = quality.repos.reduce((s, r) => s + (r.groundedSymbols || 0), 0);
const totalDark     = quality.repos.reduce((s, r) => s + (r.darkSymbols     || 0), 0);
const aggHallucinationRisk = totalDark / (totalGrounded + totalDark);

// Avg improvement (SigMap / random hit@5 ratio)
const avgImprovement = retrieval.repos.reduce((s, r) => s + r.improvement, 0) / retrieval.repos.length;

const summary = {
  totalRepos:             retrieval.repos.length,
  totalTasks,
  // Tiers
  correctTotal:           totalCorrect,
  partialTotal:           totalPartial,
  wrongTotal:             totalWrong,
  correctPct:             +(aggCorrect * 100).toFixed(1),
  partialPct:             +(aggPartial * 100).toFixed(1),
  wrongPct:               +(aggWrong   * 100).toFixed(1),
  // Prompt model
  avgPromptsWith:         +aggPromptsWith.toFixed(2),
  avgPromptsWithout:      +aggPromptsWithout.toFixed(2),
  avgReductionPct:        +(aggReduction * 100).toFixed(1),
  // Hit rate
  hitAt5Without:          +(avgRandBaseline * 100).toFixed(1),
  hitAt5With:             +(retrieval.repos.reduce((s, r) => s + r.hitAt5, 0) / retrieval.repos.length * 100).toFixed(1),
  avgImprovement:         +avgImprovement.toFixed(1),
  // Hallucination risk
  totalGroundedSymbols:   totalGrounded,
  totalDarkSymbols:       totalDark,
  hallucinationRiskPct:   +(aggHallucinationRisk * 100).toFixed(1),
};

const report = {
  generated: new Date().toISOString(),
  methodology: {
    promptWeights:    W,
    source:           'retrieval.json + quality.json',
    tasks:            totalTasks,
    repos:            retrieval.repos.length,
    note: 'Prompt counts are model-derived proxies from retrieval tiers, not measured LLM sessions. Hallucination risk = darkSymbols/(grounded+dark) — symbols unreachable to AI without SigMap.',
  },
  summary,
  repos: repoResults,
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
if (SAVE) {
  const outPath = path.join(REPORTS, 'task-benchmark.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.error(`[task-benchmark] saved → ${outPath}`);
}

if (JSON_OUT) {
  process.stdout.write(JSON.stringify(report, null, 2));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Terminal report
// ---------------------------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

console.log('\n── SigMap Task Benchmark ──────────────────────────────────────────────────\n');
console.log(`  Prompts to answer (avg across ${totalTasks} tasks, ${retrieval.repos.length} repos)`);
console.log(`  Without SigMap :  ${aggPromptsWithout.toFixed(2)} prompts  (random baseline, ${(avgRandBaseline*100).toFixed(1)}% hit@5)`);
console.log(`  With    SigMap :  ${aggPromptsWith.toFixed(2)} prompts  (${(aggCorrect*100).toFixed(0)}% rank-1, ${(aggPartial*100).toFixed(0)}% rank 2-5, ${(aggWrong*100).toFixed(0)}% miss)`);
console.log(`  Reduction      :  ${(aggReduction*100).toFixed(0)}%`);

console.log('\n  Answer quality tiers (SigMap)\n');
const barWidth = 30;
function bar(frac, char) {
  const n = Math.round(frac * barWidth);
  return char.repeat(n) + '░'.repeat(barWidth - n);
}
console.log(`  Correct  ${rpad((aggCorrect*100).toFixed(1)+'%', 6)}  [${bar(aggCorrect, '█')}]  ${totalCorrect}/${totalTasks} tasks`);
console.log(`  Partial  ${rpad((aggPartial*100).toFixed(1)+'%', 6)}  [${bar(aggPartial, '▒')}]  ${totalPartial}/${totalTasks} tasks`);
console.log(`  Wrong    ${rpad((aggWrong  *100).toFixed(1)+'%', 6)}  [${bar(aggWrong,   '░')}]  ${totalWrong}/${totalTasks} tasks`);

console.log('\n  Before / After — hit@5 per repo\n');
console.log(`  ${pad('Repo', 20)} ${rpad('Random', 8)} ${rpad('SigMap', 8)} ${rpad('Lift', 8)}`);
console.log(`  ${'─'.repeat(20)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)}`);
for (const r of retrieval.repos) {
  const lift = r.randomBaseline > 0 ? (r.hitAt5 / r.randomBaseline).toFixed(1)+'×' : '—';
  console.log(`  ${pad(r.repo, 20)} ${rpad((r.randomBaseline*100).toFixed(1)+'%', 8)} ${rpad((r.hitAt5*100).toFixed(0)+'%', 8)} ${rpad(lift, 8)}`);
}

console.log('\n  Hallucination risk proxy (dark symbols)\n');
console.log(`  Without SigMap: ${(aggHallucinationRisk*100).toFixed(0)}% of codebase symbols hidden from AI`);
console.log(`  With    SigMap: ${(100 - aggHallucinationRisk*100).toFixed(0)}% of indexed symbols grounded in signatures`);
console.log(`  (${totalGrounded.toLocaleString()} grounded, ${totalDark.toLocaleString()} dark — across ${quality.repos.length} repos)\n`);
console.log('──────────────────────────────────────────────────────────────────────────\n');
if (SAVE) console.log(`  Report saved → benchmarks/reports/task-benchmark.json\n`);

// Append to benchmark history
{
  const histPath = path.join(ROOT, '.context', 'benchmark-history.ndjson');
  try {
    fs.mkdirSync(path.dirname(histPath), { recursive: true });
    let version = 'unknown';
    try { version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || 'unknown'; } catch (_) {}
    fs.appendFileSync(histPath, JSON.stringify({
      ts: new Date().toISOString(),
      type: 'task',
      version,
      hitAt5With: summary.hitAt5With,
      hitAt5Without: summary.hitAt5Without,
      avgReductionPct: summary.avgReductionPct,
      repos: retrieval.repos.length,
      tasks: totalTasks,
    }) + '\n', 'utf8');
  } catch (_) {}
}
