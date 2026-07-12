#!/usr/bin/env node
'use strict';

/**
 * Route surface-enrichment A/B — the measure gate for retrieval.surfaceEnrichment.
 *
 *   node scripts/run-surface-enrichment-benchmark.mjs            # run, print table
 *   node scripts/run-surface-enrichment-benchmark.mjs --json     # machine-readable
 *   node scripts/run-surface-enrichment-benchmark.mjs --save     # write benchmarks/reports/surface-enrichment.json
 *
 * Two arms per repo through the FULL ranker:
 *   A — plain index                 rank(q, index, { cwd, graph })
 *   B — route-enriched index        rank(q, enriched, { cwd, graph })
 * The headline BM25 harness is untouched; this is the only legitimate source
 * for the enrichment's number. Flip the default only if arm B ≥ arm A here.
 * Note: the 90-task corpus is file-discovery-flavored — route-worded tasks
 * would stress this harder; a +0 here is honest, not a failure.
 *
 * Reads contexts AS-IS — run the retrieval benchmark first for canonical state (#480).
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
const OUT = path.join(ROOT, 'benchmarks', 'reports', 'surface-enrichment.json');

const JSON_OUT = process.argv.includes('--json');
const SAVE = process.argv.includes('--save');

const { rank, buildSigIndex } = require(path.join(ROOT, 'src/retrieval/ranker.js'));
const { buildFromCwd } = require(path.join(ROOT, 'src/graph/builder.js'));
const { enrichWithSurfaces } = require(path.join(ROOT, 'src/retrieval/enrich-from-maps.js'));

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
let tasksTotal = 0, hitsA = 0, hitsB = 0;

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

  const enriched = new Map([...index.entries()].map(([k, v]) => [k, [...v]]));
  let routeSigs = 0;
  try { routeSigs = enrichWithSurfaces(enriched, dir); } catch { /* optional */ }

  let a = 0, b = 0;
  for (const t of tasks) {
    const expected = t.expected_files || t.expected || [];
    a += hitAt5(rank(t.query, index, { topK: 10, cwd: dir, graph }), expected);
    b += hitAt5(rank(t.query, enriched, { topK: 10, cwd: dir, graph }), expected);
  }
  tasksTotal += tasks.length; hitsA += a; hitsB += b;
  perRepo.push({ repo, tasks: tasks.length, routeSigs, hitA: a, hitB: b, delta: b - a });
}

const pct = (h) => (tasksTotal ? Math.round((h / tasksTotal) * 1000) / 10 : 0);
const result = {
  benchmark: 'surface-enrichment-ab',
  arms: { A: 'rank + plain index', B: 'rank + route-enriched index' },
  tasks: tasksTotal,
  hitAt5A: pct(hitsA),
  hitAt5B: pct(hitsB),
  deltaTasks: hitsB - hitsA,
  routeSigsTotal: perRepo.reduce((n, r) => n + r.routeSigs, 0),
  perRepo,
  skipped,
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('Route surface-enrichment A/B (full rank(); headline BM25 harness untouched)');
  console.log('  note        : reads contexts AS-IS — run the retrieval benchmark first (#480)');
  console.log(`  tasks       : ${tasksTotal} across ${perRepo.length} repos (${skipped.length} skipped)`);
  console.log(`  route sigs  : ${result.routeSigsTotal} pseudo-signatures added in arm B`);
  console.log(`  arm A hit@5 : ${result.hitAt5A}%  (plain index)`);
  console.log(`  arm B hit@5 : ${result.hitAt5B}%  (+ route enrichment)`);
  console.log(`  delta       : ${hitsB - hitsA >= 0 ? '+' : ''}${hitsB - hitsA} task(s)`);
  const moved = perRepo.filter((r) => r.delta !== 0);
  console.log(moved.length
    ? '  moved repos : ' + moved.map((r) => `${r.repo} (${r.delta > 0 ? '+' : ''}${r.delta})`).join(', ')
    : '  moved repos : none — arms identical on every repo');
  if (skipped.length) console.log('  skipped     : ' + skipped.map((s) => `${s.repo} (${s.reason})`).join(', '));
}

if (SAVE) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
  if (!JSON_OUT) console.log(`  saved       : ${path.relative(ROOT, OUT)}`);
}
