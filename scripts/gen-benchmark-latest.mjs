#!/usr/bin/env node
'use strict';

/**
 * gen-benchmark-latest.mjs — single source of benchmark truth (Trust Hygiene H1).
 *
 * Derives `benchmarks/latest.json` from the committed benchmark reports
 * (`benchmarks/reports/*.json`) — the actual measured output. Every public
 * number (version.json, README, llms.txt) reads from latest.json, so the docs
 * can never silently diverge from the benchmarks.
 *
 *   node scripts/gen-benchmark-latest.mjs          # write benchmarks/latest.json
 *   node scripts/gen-benchmark-latest.mjs --check   # exit 1 if latest.json is stale
 *
 * Zero dependencies. Wired into prepublishOnly so a stale file blocks publish.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

function readReport(root, name) {
  return JSON.parse(readFileSync(join(root, 'benchmarks', 'reports', name), 'utf8'));
}

/** Round to `d` decimal places (deterministic). */
function round(n, d = 1) {
  const f = 10 ** d;
  return Math.round(Number(n) * f) / f;
}

/**
 * Compute the canonical benchmark object from the committed reports.
 * @param {string} [root]
 * @returns {object}
 */
export function computeLatest(root = ROOT) {
  const matrixReport = readReport(root, 'benchmark-matrix.json');
  const matrix = matrixReport.metrics;
  const task = readReport(root, 'task-benchmark.json').summary;
  const tokenReport = readReport(root, 'token-reduction.json');
  const pkg = require(join(root, 'package.json'));

  const [maj, min] = String(pkg.version).split('.');
  // Date comes from the run timestamp in the report content (not file mtime).
  const generated = matrixReport.generated || tokenReport.timestamp || '';
  const benchmark_date = String(generated).slice(0, 10);

  return {
    benchmark_id: `sigmap-v${maj}.${min}-main`,
    benchmark_date,
    source: 'benchmarks/reports/{benchmark-matrix,task-benchmark,token-reduction}.json',
    repos_token: matrix.reposToken,
    repos_retrieval: matrix.reposRetrieval,
    metrics: {
      hit_at_5: round(matrix.avgHitAt5Pct / 100, 3),
      baseline_hit_at_5: round(task.hitAt5Without / 100, 3),
      retrieval_lift: round(matrix.avgHitAt5Pct / task.hitAt5Without, 1),
      overall_token_reduction_pct: round(matrix.avgReductionPct, 1),
      task_success_proxy_pct: round(task.correctPct, 1),
      prompts_per_task: round(task.avgPromptsWith, 2),
      baseline_prompts_per_task: round(task.avgPromptsWithout, 2),
      prompt_reduction_pct: round(matrix.taskPromptReductionPct, 1),
      graph_boosted_hit_at_5: round(matrix.avgHitAt5Pct / 100, 3),
    },
  };
}

const LATEST = join(ROOT, 'benchmarks', 'latest.json');
const serialize = (obj) => JSON.stringify(obj, null, 2) + '\n';

/**
 * Whether benchmarks/latest.json matches what the reports would produce.
 * @param {string} [root]
 * @returns {boolean}
 */
export function latestInSync(root = ROOT) {
  let have = '';
  try { have = readFileSync(join(root, 'benchmarks', 'latest.json'), 'utf8'); } catch { have = ''; }
  return have === serialize(computeLatest(root));
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function main() {
  const check = process.argv.includes('--check');
  if (check) {
    if (latestInSync()) {
      console.log('✓ benchmarks/latest.json is in sync with benchmarks/reports/');
      return 0;
    }
    console.error('ERROR: benchmarks/latest.json is stale vs benchmarks/reports/.');
    console.error('Run `node scripts/gen-benchmark-latest.mjs` to regenerate, then commit it.');
    return 1;
  }
  writeFileSync(LATEST, serialize(computeLatest()));
  console.log('✓ wrote benchmarks/latest.json from benchmarks/reports/');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}
