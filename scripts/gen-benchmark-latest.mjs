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
import { provenanceOf, classifySources } from './lib/report-stamp.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Every report this run read, name -> parsed content (null when absent).
 *
 * Derived rather than restated: the `source` field used to be a hand-written
 * string listing four reports while the generator read five, so the one field
 * whose job was provenance had the wrong provenance (#707).
 */
let READ = {};

function readReport(root, name) {
  const report = JSON.parse(readFileSync(join(root, 'benchmarks', 'reports', name), 'utf8'));
  READ[name] = report;
  return report;
}

/** Read a report that may not exist yet (returns null instead of throwing). */
function readReportOptional(root, name) {
  try { return readReport(root, name); } catch { READ[name] = null; return null; }
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
  READ = {};
  const matrixReport = readReport(root, 'benchmark-matrix.json');
  const matrix = matrixReport.metrics;
  const task = readReport(root, 'task-benchmark.json').summary;
  const tokenReport = readReport(root, 'token-reduction.json');
  const pkg = require(join(root, 'package.json'));

  const [maj, min] = String(pkg.version).split('.');
  // Date comes from the run timestamp in the report content (not file mtime).
  const generated = matrixReport.generated || tokenReport.timestamp || '';
  const benchmark_date = String(generated).slice(0, 10);

  const out = {
    benchmark_id: `sigmap-v${maj}.${min}-main`,
    benchmark_date,
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

  // Honest grep-agent baseline (v8.19 A1) — optional, present once
  // scripts/run-honest-benchmark.mjs --save has run. These are the only
  // baseline numbers surfaced on human-facing pages; the random baseline
  // stays above as data but is no longer quoted.
  const honest = readReportOptional(root, 'honest-baseline.json');
  if (honest && honest.summary) {
    out.metrics.grep_baseline_hit_at_5 = round(honest.summary.grepBaseline.hitAt5, 3);
    out.metrics.grep_lift = round(honest.summary.lift, 2);
    // The lift is SigMap-vs-grep on the HONEST corpus, so the hit@5 that
    // divides into it has to travel with it. Publishing `grep_lift` while the
    // only visible hit@5 came from the RETRIEVAL corpus is what made the
    // arithmetic fail to close on every public page (#707): 78.6/40.8 reads
    // 1.93, not the published 2.12 (= 86.4/40.8). Kept top-level so
    // version.json's `metrics` mirror is unaffected.
    out.honest = {
      sigmap_hit_at_5: round(honest.summary.sigmap.hitAt5, 3),
      grep_baseline_hit_at_5: round(honest.summary.grepBaseline.hitAt5, 3),
      lift: round(honest.summary.lift, 2),
      tasks: honest.summary.tasks,
      repos: honest.summary.repos,
    };
  }

  // Test-discovery (v8.5 C2) — optional, present once the benchmark has run.
  // Kept top-level (not under `metrics`) so version.json's metrics mirror is
  // unaffected and the hermetic gen-benchmark-latest fixture still resolves.
  const td = readReportOptional(root, 'test-discovery.json');
  if (td && td.metrics) {
    out.test_discovery = {
      repos: td.repos,
      pairs: td.pairs,
      f1: round(td.metrics.f1, 3),
      hit_at_1: round(td.metrics.hitAt1, 3),
    };
  }

  // Provenance, derived from what was actually read (#854). A figure carried
  // from an earlier release is now visible in the published snapshot instead of
  // being indistinguishable from one measured today.
  out.sources = {};
  for (const name of Object.keys(READ).sort()) {
    const prov = provenanceOf(READ[name]);
    out.sources[name] = READ[name]
      ? { version: prov.version, generated: prov.generated ? prov.generated.slice(0, 10) : null }
      : null;
  }

  // Refuse to assemble a snapshot from a report produced on a DIFFERENT release
  // line. `check:metrics` only ever verified latest.json against the SAVED
  // reports, so a stale one passed every gate: v8.49 published a
  // test-discovery F1 measured at v8.8.0 (#707).
  //
  // A report that predates stamping is a separate case and is NOT fatal: its
  // provenance is unknown, it is published as `version: null` so the snapshot
  // says so, and it is warned about. Refusing would mean this guard could not
  // land until every suite had re-run; inventing a version would fabricate the
  // fact being recorded.
  const { drifted, unstamped } = classifySources(READ, pkg.version);
  if (drifted.length) {
    const lines = drifted.map((x) => `  ${x.name}: measured at v${x.version} (${x.generated || 'date unknown'})`);
    throw new Error(
      `benchmarks/latest.json would mix releases — these reports were produced on another release line, not v${pkg.version}:\n`
      + lines.join('\n')
      + `\nRun \`npm run benchmark:all\` to regenerate every source, then regenerate latest.json.`
    );
  }
  if (unstamped.length) {
    console.warn(
      `WARNING: ${unstamped.length} source report(s) predate provenance stamping, so their release is unknown\n`
      + unstamped.map((x) => `  ${x.name}: generated ${x.generated || '(unknown)'}`).join('\n')
      + `\nPublished as "version": null. Run \`npm run benchmark:all\` to replace them with stamped runs.`
    );
  }

  return out;
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
  // A mixed-release snapshot is a refusal, not a crash: print the reason the
  // guard gives and exit 1, so CI output names the stale report (#854).
  // Computed once and reused — calling computeLatest twice printed the
  // unknown-provenance warning twice.
  let latest;
  try { latest = computeLatest(); } catch (err) {
    console.error('ERROR: ' + err.message);
    return 1;
  }
  if (check) {
    // A missing latest.json is "stale", not a crash — the original
    // latestInSync() guarded this and the single-compute refactor dropped it.
    let have = '';
    try { have = readFileSync(LATEST, 'utf8'); } catch { have = ''; }
    if (have === serialize(latest)) {
      console.log('✓ benchmarks/latest.json is in sync with benchmarks/reports/');
      return 0;
    }
    console.error('ERROR: benchmarks/latest.json is stale vs benchmarks/reports/.');
    console.error('Run `node scripts/gen-benchmark-latest.mjs` to regenerate, then commit it.');
    return 1;
  }
  writeFileSync(LATEST, serialize(latest));
  console.log('✓ wrote benchmarks/latest.json from benchmarks/reports/');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}
