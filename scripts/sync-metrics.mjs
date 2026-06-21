#!/usr/bin/env node
'use strict';

/**
 * sync-metrics.mjs — every public benchmark number reads from one file (H1).
 *
 * `benchmarks/latest.json` is the single source of truth (generated from the
 * benchmark reports by scripts/gen-benchmark-latest.mjs). This script pushes it
 * into the human-facing surfaces so a hand-typed metric can never drift:
 *   - version.json   : benchmark_id, benchmark_date, metrics
 *   - README.md      : numbers inside <!--SM:KEY-->…<!--/SM:KEY--> markers
 *
 *   node scripts/sync-metrics.mjs          # write version.json + README.md
 *   node scripts/sync-metrics.mjs --check   # exit 1 if either is stale
 *
 * Zero dependencies. Wired into prepublishOnly so a stale value blocks publish.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { computeLatest } from './gen-benchmark-latest.mjs';
import { deriveLanguages } from './lib/source-meta.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const pct = (n, d = 1) => `${Number(n).toFixed(d)}%`;

// ── version.json ──────────────────────────────────────────────────────────────
/** Expected version.json text with benchmark fields synced from latest.json. */
export function expectedVersionJson(root = ROOT) {
  const latest = computeLatest(root);
  const vj = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'));
  vj.benchmark_date = latest.benchmark_date;
  vj.benchmark_id = latest.benchmark_id;
  vj.metrics = latest.metrics;
  return JSON.stringify(vj, null, 2) + '\n';
}

// ── README.md ─────────────────────────────────────────────────────────────────
/** Map of marker KEY → rendered replacement text. */
export function renderTokens(root = ROOT) {
  const latest = computeLatest(root);
  const m = latest.metrics;
  const languages = deriveLanguages(root).length;

  const bullets = [
    `- **${pct(m.hit_at_5 * 100)} hit@5** — right file found in top 5 results (vs ${pct(m.baseline_hit_at_5 * 100)} baseline)`,
    `- **${pct(m.overall_token_reduction_pct)} token reduction** — average across ${latest.repos_token} real repos`,
    `- **${pct(m.task_success_proxy_pct)} task success rate** — up from 10% without context`,
    `- **${m.prompts_per_task} prompts per task** — down from ${m.baseline_prompts_per_task} (${pct(m.prompt_reduction_pct)} fewer retries)`,
  ].join('\n');

  // The fenced code block, rendered whole (markers sit *outside* the fence so
  // they stay invisible in rendered markdown).
  const block = [
    '```',
    `Benchmark : ${latest.benchmark_id} (${latest.repos_token} repositories, including R language)`,
    `Date      : ${latest.benchmark_date}`,
    '',
    `Hit@5          : ${pct(m.hit_at_5 * 100)}   (baseline ${pct(m.baseline_hit_at_5 * 100)}  — ${Number(m.retrieval_lift).toFixed(1)}× lift)`,
    `Token reduction: ${pct(m.overall_token_reduction_pct)}   (across ${latest.repos_token} repos)`,
    `Prompt reduction : ${pct(m.prompt_reduction_pct)} (${m.baseline_prompts_per_task} → ${m.prompts_per_task} prompts per task)`,
    `Task success   : ${pct(m.task_success_proxy_pct)}   (baseline 10%)`,
    `Repos tested   : ${latest.repos_token} (JavaScript, Python, Go, Rust, Java, R, C++, C#, Dart, Swift, Ruby, PHP, Scala, Kotlin, and more)`,
    '```',
  ].join('\n');

  return {
    whyMetrics: `\n${bullets}\n`,
    benchmarkBlock: `\n${block}\n`,
    hitWhole: `${Math.round(m.hit_at_5 * 100)}%`,
    languages: String(languages),
  };
}

/** Apply marker tokens to README text. Returns the updated text. */
export function applyTokens(text, tokens) {
  let out = text;
  for (const [key, value] of Object.entries(tokens)) {
    const re = new RegExp(`(<!--SM:${key}-->)[\\s\\S]*?(<!--/SM:${key}-->)`, 'g');
    if (!re.test(out)) throw new Error(`README marker missing: <!--SM:${key}-->`);
    out = out.replace(re, `$1${value}$2`);
  }
  return out;
}

export function expectedReadme(root = ROOT) {
  const text = readFileSync(join(root, 'README.md'), 'utf8');
  return applyTokens(text, renderTokens(root));
}

// ── drift ─────────────────────────────────────────────────────────────────────
/** @returns {string[]} list of out-of-sync surface names ([] = clean) */
export function findDrift(root = ROOT) {
  const out = [];
  if (readFileSync(join(root, 'version.json'), 'utf8') !== expectedVersionJson(root)) out.push('version.json');
  if (readFileSync(join(root, 'README.md'), 'utf8') !== expectedReadme(root)) out.push('README.md');
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function main() {
  const check = process.argv.includes('--check');
  if (check) {
    const drift = findDrift();
    if (drift.length === 0) {
      console.log('✓ version.json + README.md metrics in sync with benchmarks/latest.json');
      return 0;
    }
    console.error(`ERROR: stale metrics in: ${drift.join(', ')}`);
    console.error('Run `node scripts/sync-metrics.mjs` to sync them from benchmarks/latest.json, then commit.');
    return 1;
  }
  writeFileSync(join(ROOT, 'version.json'), expectedVersionJson());
  writeFileSync(join(ROOT, 'README.md'), expectedReadme());
  console.log('✓ synced version.json + README.md from benchmarks/latest.json');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}
