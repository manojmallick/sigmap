#!/usr/bin/env node

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SAVE = process.argv.includes('--save');
const SKIP_CLONE = process.argv.includes('--skip-clone');
const JSON_SUMMARY = process.argv.includes('--json');

function runStep(name, script, args = []) {
  const startedAt = Date.now();
  process.stderr.write(`\n[matrix] ${name} ...\n`);

  const result = spawnSync('node', [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  const durationMs = Date.now() - startedAt;
  const ok = result.status === 0;

  if (!ok) {
    process.stderr.write(`[matrix] ${name} failed (exit ${result.status})\n`);
    if (result.stdout) process.stderr.write(result.stdout.slice(-4000));
    if (result.stderr) process.stderr.write(result.stderr.slice(-4000));
  } else {
    process.stderr.write(`[matrix] ${name} done (${(durationMs / 1000).toFixed(1)}s)\n`);
  }

  return {
    name,
    script,
    args,
    status: result.status,
    ok,
    durationMs,
    stdoutTail: (result.stdout || '').slice(-1200),
    stderrTail: (result.stderr || '').slice(-1200),
  };
}

function readJson(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (_) {
    return null;
  }
}

const commonArgs = SAVE ? ['--save'] : [];

const steps = [
  runStep(
    'token-reduction benchmark',
    path.join('scripts', 'run-benchmark.mjs'),
    [...commonArgs, ...(SKIP_CLONE ? ['--skip-clone'] : [])]
  ),
  runStep(
    'retrieval benchmark',
    path.join('scripts', 'run-retrieval-benchmark.mjs'),
    commonArgs
  ),
  runStep(
    'quality benchmark',
    path.join('scripts', 'run-quality-benchmark.mjs'),
    commonArgs
  ),
  runStep(
    'task benchmark',
    path.join('scripts', 'run-task-benchmark.mjs'),
    commonArgs
  ),
];

const success = steps.every((s) => s.ok);

const token = readJson(path.join('benchmarks', 'reports', 'token-reduction.json'));
const retrieval = readJson(path.join('benchmarks', 'reports', 'retrieval.json'));
const quality = readJson(path.join('benchmarks', 'reports', 'quality.json'));
const task = readJson(path.join('benchmarks', 'reports', 'task-benchmark.json'));

const summary = {
  generated: new Date().toISOString(),
  success,
  steps,
  metrics: {
    reposToken: token?.repos?.length ?? null,
    reposRetrieval: retrieval?.repos?.length ?? null,
    avgReductionPct: token?.repos
      ? +(token.repos.reduce((s, r) => s + (r.reductionPct || 0), 0) / Math.max(token.repos.length, 1)).toFixed(1)
      : null,
    avgHitAt5Pct: retrieval
      ? +(retrieval.repos.reduce((s, r) => s + (r.hitAt5 || 0), 0) / Math.max(retrieval.repos.length, 1) * 100).toFixed(1)
      : null,
    taskPromptReductionPct: task?.summary?.avgReductionPct ?? null,
    gpt4oOverflowRepos: quality?.repos
      ? quality.repos.filter((r) => (r.rawTokens || 0) > 128000).length
      : null,
  },
};

if (SAVE) {
  const outPath = path.join(ROOT, 'benchmarks', 'reports', 'benchmark-matrix.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
  process.stderr.write(`[matrix] saved -> ${outPath}\n`);
}

if (JSON_SUMMARY) {
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} else {
  process.stdout.write('\n=== Benchmark Matrix Summary ===\n');
  process.stdout.write(`success: ${summary.success}\n`);
  process.stdout.write(`token repos: ${summary.metrics.reposToken ?? 'n/a'}\n`);
  process.stdout.write(`retrieval repos: ${summary.metrics.reposRetrieval ?? 'n/a'}\n`);
  process.stdout.write(`avg token reduction: ${summary.metrics.avgReductionPct ?? 'n/a'}%\n`);
  process.stdout.write(`avg retrieval hit@5: ${summary.metrics.avgHitAt5Pct ?? 'n/a'}%\n`);
  process.stdout.write(`task prompt reduction: ${summary.metrics.taskPromptReductionPct ?? 'n/a'}%\n`);
  process.stdout.write(`GPT-4o overflow repos (raw): ${summary.metrics.gpt4oOverflowRepos ?? 'n/a'}\n`);
}

process.exit(success ? 0 : 1);
