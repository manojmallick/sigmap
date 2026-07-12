#!/usr/bin/env node
'use strict';

/**
 * Call-graph ranking boost A/B — the measure gate for retrieval.callGraphBoost.
 *
 *   node scripts/run-callgraph-boost-benchmark.mjs            # run, print table
 *   node scripts/run-callgraph-boost-benchmark.mjs --json     # machine-readable
 *   node scripts/run-callgraph-boost-benchmark.mjs --save     # write benchmarks/reports/callgraph-boost.json
 *
 * Runs the same tasks as the retrieval harness through the FULL ranker
 * (`src/retrieval/ranker.js` rank()) in two arms per repo:
 *   A — import graph only            rank(q, idx, { cwd, graph })
 *   B — import graph + call graph    rank(q, idx, { cwd, graph, callGraph })
 * and reports hit@5 for both arms + the delta. The headline BM25 benchmark
 * is untouched; this is the only legitimate source for the boost's number.
 * Flip the default only if arm B ≥ arm A here.
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
const OUT = path.join(ROOT, 'benchmarks', 'reports', 'callgraph-boost.json');

const JSON_OUT = process.argv.includes('--json');
const SAVE = process.argv.includes('--save');

const { rank, buildSigIndex } = require(path.join(ROOT, 'src/retrieval/ranker.js'));
const { buildFromCwd } = require(path.join(ROOT, 'src/graph/builder.js'));
const { buildCallFileGraph } = require(path.join(ROOT, 'src/graph/call-graph.js'));

function loadTasks(repo) {
  const p = path.join(TASKS_DIR, `${repo}.jsonl`);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function hitAt5(ranked, expected) {
  const norm = (x) => String(x).replace(/\\/g, '/');
  const top5 = ranked.slice(0, 5).map((r) => norm(r.file));
  return expected.some((e) => top5.some((f) => f === norm(e) || f.endsWith('/' + norm(e)))) ? 1 : 0;
}

const repos = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.jsonl')).map((f) => f.replace(/\.jsonl$/, '')).sort();
const perRepo = [];
const skipped = [];
let tasksA = 0, hitsA = 0, hitsB = 0;

for (const repo of repos) {
  const dir = path.join(REPOS_DIR, repo);
  if (!fs.existsSync(dir)) { skipped.push({ repo, reason: 'repo not cloned' }); continue; }
  const tasks = loadTasks(repo);
  if (!tasks.length) { skipped.push({ repo, reason: 'no tasks' }); continue; }
  let index;
  try { index = buildSigIndex(dir); } catch { index = new Map(); }
  if (!index || index.size === 0) { skipped.push({ repo, reason: 'no context (run retrieval benchmark first)' }); continue; }

  let graph = null;
  try { graph = buildFromCwd(dir); } catch { /* optional */ }
  let callGraph = null;
  try { callGraph = buildCallFileGraph(dir); } catch { /* optional */ }
  const callEdges = callGraph ? callGraph.forward.size : 0;

  let a = 0, b = 0;
  for (const t of tasks) {
    const expected = t.expected_files || t.expected || [];
    a += hitAt5(rank(t.query, index, { topK: 10, cwd: dir, graph }), expected);
    b += hitAt5(rank(t.query, index, { topK: 10, cwd: dir, graph, callGraph }), expected);
  }
  tasksA += tasks.length; hitsA += a; hitsB += b;
  perRepo.push({ repo, tasks: tasks.length, callEdges, hitA: a, hitB: b, delta: b - a });
}

const pct = (h) => (tasksA ? Math.round((h / tasksA) * 1000) / 10 : 0);
const result = {
  benchmark: 'callgraph-boost-ab',
  arms: { A: 'rank + import graph', B: 'rank + import graph + call graph' },
  tasks: tasksA,
  hitAt5A: pct(hitsA),
  hitAt5B: pct(hitsB),
  deltaTasks: hitsB - hitsA,
  perRepo,
  skipped,
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('Call-graph ranking boost A/B (full rank(); headline BM25 harness untouched)');
  console.log('  note        : reads each repo\'s context AS-IS — run the retrieval benchmark first for canonical contexts (#480)');
  console.log(`  tasks       : ${tasksA} across ${perRepo.length} repos (${skipped.length} skipped)`);
  console.log(`  arm A hit@5 : ${result.hitAt5A}%  (import graph)`);
  console.log(`  arm B hit@5 : ${result.hitAt5B}%  (+ call graph)`);
  console.log(`  delta       : ${hitsB - hitsA >= 0 ? '+' : ''}${hitsB - hitsA} task(s)`);
  const moved = perRepo.filter((r) => r.delta !== 0);
  if (moved.length) {
    console.log('  moved repos :');
    for (const r of moved) console.log(`    ${r.repo}: ${r.hitA}/${r.tasks} → ${r.hitB}/${r.tasks} (${r.delta > 0 ? '+' : ''}${r.delta}, ${r.callEdges} call-edge files)`);
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
