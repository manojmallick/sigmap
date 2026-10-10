#!/usr/bin/env node
'use strict';

/**
 * Repo-mined expansion A/B — the measure gate for retrieval.minedExpansions (B2, #649).
 *
 *   node scripts/run-mined-expansions-benchmark.mjs            # run, print table
 *   node scripts/run-mined-expansions-benchmark.mjs --json     # machine-readable
 *   node scripts/run-mined-expansions-benchmark.mjs --save     # write benchmarks/reports/mined-expansions.json
 *
 * Runs the same tasks as the retrieval harness through the FULL ranker
 * (`src/retrieval/ranker.js` rank()) in two arms per repo:
 *   A — baseline                    rank(q, idx, { cwd, graph })
 *   B — + mined expansions          rank(q, idx, { cwd, graph, expansions })
 * and reports hit@5 + MRR for both arms + the delta. The headline BM25
 * benchmark is untouched; this is the only legitimate source for the mined
 * expansions' number. Flip the default only if arm B ≥ arm A here — and read
 * MRR alongside hit@5 (the hit@5-only trap is documented in bm25.js).
 *
 * Requires cached benchmark repos with generated context (run the retrieval
 * benchmark first, or gen-context per repo); repos without either are skipped
 * and reported.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPOS_DIR = path.join(ROOT, 'benchmarks', 'repos');
const TASKS_DIR = path.join(ROOT, 'benchmarks', 'tasks');
const OUT = path.join(ROOT, 'benchmarks', 'reports', 'mined-expansions.json');

const JSON_OUT = process.argv.includes('--json');
const SAVE = process.argv.includes('--save');

const { rank, buildSigIndex } = require(path.join(ROOT, 'src/retrieval/ranker.js'));
const { buildRankingGraph } = require(path.join(ROOT, 'src/graph/builder.js'));
const { mineExpansions } = require(path.join(ROOT, 'src/retrieval/mined-expansions.js'));

function loadTasks(repo) {
  const p = path.join(TASKS_DIR, `${repo}.jsonl`);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const norm = (x) => String(x).replace(/\\/g, '/');

function hitAt5(ranked, expected) {
  const top5 = ranked.slice(0, 5).map((r) => norm(r.file));
  return expected.some((e) => top5.some((f) => f === norm(e) || f.endsWith('/' + norm(e)))) ? 1 : 0;
}

function reciprocalRank(ranked, expected) {
  for (let i = 0; i < ranked.length; i++) {
    const f = norm(ranked[i].file);
    if (expected.some((e) => f === norm(e) || f.endsWith('/' + norm(e)))) return 1 / (i + 1);
  }
  return 0;
}

// Corpus → directory mapping (mirrors the retrieval gate): the self-repo
// corpora — `retrieval` (easy), `retrieval-hard` (the leak-free split, B2's
// actual target), `retrieval-mined` — score against THIS repo's own context
// and drift with development by design; `retrieval-jvm-<name>` maps to the
// cached repo `<name>`; everything else maps 1:1.
function repoDirFor(corpus) {
  if (corpus === 'retrieval' || corpus === 'retrieval-hard' || corpus === 'retrieval-mined') return ROOT;
  const jvm = /^retrieval-jvm-(.+)$/.exec(corpus);
  if (jvm) return path.join(REPOS_DIR, jvm[1]);
  return path.join(REPOS_DIR, corpus);
}

const repos = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.jsonl')).map((f) => f.replace(/\.jsonl$/, '')).sort();
const perRepo = [];
const skipped = [];
let tasksA = 0, hitsA = 0, hitsB = 0, mrrA = 0, mrrB = 0;

for (const repo of repos) {
  const dir = repoDirFor(repo);
  if (!fs.existsSync(dir)) { skipped.push({ repo, reason: 'repo not cloned' }); continue; }
  const tasks = loadTasks(repo);
  if (!tasks.length) { skipped.push({ repo, reason: 'no tasks' }); continue; }
  let index;
  try { index = buildSigIndex(dir); } catch { index = new Map(); }
  if (!index || index.size === 0) { skipped.push({ repo, reason: 'no context (run retrieval benchmark first)' }); continue; }

  let graph = null;
  try { graph = buildRankingGraph(dir); } catch { /* optional */ }
  let expansions = null;
  let minedTokens = 0;
  try {
    const mined = mineExpansions(index);
    expansions = mined.expansions;
    minedTokens = Object.keys(expansions).length;
  } catch { /* optional */ }

  let a = 0, b = 0, ra = 0, rb = 0;
  for (const t of tasks) {
    const expected = t.expected_files || t.expected || [];
    const rankedA = rank(t.query, index, { topK: 10, cwd: dir, graph });
    const rankedB = rank(t.query, index, { topK: 10, cwd: dir, graph, expansions });
    a += hitAt5(rankedA, expected);
    b += hitAt5(rankedB, expected);
    ra += reciprocalRank(rankedA, expected);
    rb += reciprocalRank(rankedB, expected);
  }
  tasksA += tasks.length; hitsA += a; hitsB += b; mrrA += ra; mrrB += rb;
  perRepo.push({ repo, tasks: tasks.length, minedTokens, hitA: a, hitB: b, delta: b - a });
}

const pct = (h) => (tasksA ? Math.round((h / tasksA) * 1000) / 10 : 0);
const mrr = (r) => (tasksA ? Math.round((r / tasksA) * 1000) / 1000 : 0);
const result = {
  benchmark: 'mined-expansions-ab',
  arms: { A: 'rank baseline', B: 'rank + repo-mined query expansion' },
  tasks: tasksA,
  hitAt5A: pct(hitsA),
  hitAt5B: pct(hitsB),
  mrrA: mrr(mrrA),
  mrrB: mrr(mrrB),
  deltaTasks: hitsB - hitsA,
  perRepo,
  skipped,
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('Mined expansions A/B (full rank(); headline BM25 harness untouched)');
  console.log('  note        : reads each repo\'s context AS-IS — run the retrieval benchmark first for canonical contexts');
  console.log(`  tasks       : ${tasksA} across ${perRepo.length} repos (${skipped.length} skipped)`);
  console.log(`  arm A hit@5 : ${result.hitAt5A}%  MRR ${result.mrrA}  (baseline)`);
  console.log(`  arm B hit@5 : ${result.hitAt5B}%  MRR ${result.mrrB}  (+ mined expansions)`);
  console.log(`  delta       : ${hitsB - hitsA >= 0 ? '+' : ''}${hitsB - hitsA} task(s)`);
  const moved = perRepo.filter((r) => r.delta !== 0);
  if (moved.length) {
    console.log('  moved repos :');
    for (const r of moved) console.log(`    ${r.repo}: ${r.hitA}/${r.tasks} → ${r.hitB}/${r.tasks} (${r.delta > 0 ? '+' : ''}${r.delta}, ${r.minedTokens} mined tokens)`);
  } else {
    console.log('  moved repos : none — arms identical on every repo');
  }
  if (skipped.length) console.log('  skipped     : ' + skipped.map((s) => `${s.repo} (${s.reason})`).join(', '));
}

if (SAVE) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
  if (!JSON_OUT) console.log(`  saved       : ${path.relative(ROOT, OUT)}`);
}
