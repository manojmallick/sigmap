#!/usr/bin/env node
/**
 * SigMap grounding benchmark — the offline GATE (IMPL.md §7/§9).
 *
 * Measures how much ground truth SigMap actually gives an agent, as a
 * callee-grounding ablation. NO LLM, no network, deterministic — so it runs in
 * CI and the number is reproducible.
 *
 *   universe  = every symbol DEFINED in a repo's source (bundle-safe extractFile)
 *   grounded  = symbols SigMap surfaces in its index (buildSigIndex) — i.e. the
 *               ones get_callee_signatures can return exact signatures for
 *   coverage  = grounded / universe
 *   baseline  = 0  (no SigMap → the agent guesses every reference)
 *
 * Hallucination-risk proxy = fraction of references the agent must guess:
 *   without SigMap ≈ 100%   ·   with SigMap ≈ (1 − coverage)
 *
 * This is a ground-truth-availability proxy, NOT a measured LLM hallucination
 * rate. The true LLM A/B ablation (run a model with/without context, count
 * verify-ai-output flags) is a follow-up that requires an API key + network.
 *
 * Usage:
 *   node scripts/run-hallucination-benchmark.mjs            # per-repo + aggregate table
 *   node scripts/run-hallucination-benchmark.mjs --save     # also write benchmarks/reports/hallucination.json
 *   node scripts/run-hallucination-benchmark.mjs --gate 50  # exit 1 if aggregate coverage < 50%
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPOS_DIR = path.join(ROOT, 'benchmarks', 'repos');
const REPORTS = path.join(ROOT, 'benchmarks', 'reports');
const GEN_CTX = path.join(ROOT, 'gen-context.js');

const { buildSigIndex } = require(path.join(ROOT, 'src/retrieval/ranker.js'));
const { extractFile, langFor } = require(path.join(ROOT, 'src/extractors/dispatch.js'));

const DEFAULT_SRC_DIRS = ['src', 'app', 'lib', 'packages', 'services', 'api', 'lng', 'R'];
const EXCLUDE = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '__pycache__',
  '.next', 'coverage', 'target', 'vendor', '.context', 'test', 'tests', '__tests__',
]);

/** Defining symbol name from a signature line (same rule as the MCP handler). */
function defName(sig) {
  const cleaned = String(sig).replace(/\s*:\d+(?:-\d+)?\s*$/, '');
  const m = cleaned.match(/\b(?:async\s+function|function|class|def|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/)
    || cleaned.match(/([A-Za-z_$][\w$]*)\s*\(/);
  return m ? m[1] : null;
}

function _walk(dir, out, depth) {
  if (depth > 8) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of entries) {
    if (EXCLUDE.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) _walk(full, out, depth + 1);
    else if (e.isFile() && langFor(e.name)) out.push(full);
  }
}

function _srcDirs(repoDir) {
  let dirs = DEFAULT_SRC_DIRS;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(repoDir, 'gen-context.config.json'), 'utf8'));
    if (Array.isArray(cfg.srcDirs) && cfg.srcDirs.length) dirs = cfg.srcDirs;
  } catch (_) {}
  return dirs;
}

/** Every symbol defined across a repo's source — the universe an agent may reference. */
function definedNames(repoDir) {
  const files = [];
  for (const d of _srcDirs(repoDir)) {
    const abs = path.join(repoDir, d);
    if (fs.existsSync(abs)) _walk(abs, files, 0);
  }
  // Fallback: if no known srcDir, scan the repo root (shallow).
  if (files.length === 0) _walk(repoDir, files, 0);
  const names = new Set();
  for (const f of files) {
    try {
      for (const sig of extractFile(f, fs.readFileSync(f, 'utf8'))) {
        const n = defName(sig);
        if (n) names.add(n);
      }
    } catch (_) {}
  }
  return names;
}

/** Symbols SigMap surfaces in its index (resolvable by get_callee_signatures). */
function indexedNames(repoDir) {
  const names = new Set();
  try {
    for (const sigs of buildSigIndex(repoDir).values()) {
      for (const sig of sigs) { const n = defName(sig); if (n) names.add(n); }
    }
  } catch (_) {}
  return names;
}

/**
 * Grounding coverage for one repo.
 * @returns {{ total:number, grounded:number, dark:number, coverage:number }}
 */
export function measureGrounding(repoDir) {
  const universe = definedNames(repoDir);
  const indexed = indexedNames(repoDir);
  let grounded = 0;
  for (const n of universe) if (indexed.has(n)) grounded++;
  const total = universe.size;
  return {
    total,
    grounded,
    dark: total - grounded,
    coverage: total > 0 ? grounded / total : 0,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function main() {
  const save = process.argv.includes('--save');
  const gateIdx = process.argv.indexOf('--gate');
  const gateThreshold = gateIdx !== -1 && process.argv[gateIdx + 1] ? parseFloat(process.argv[gateIdx + 1]) : null;

  let repos = [];
  try {
    repos = fs.readdirSync(REPOS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (_) {}
  if (repos.length === 0) {
    console.error('No corpus repos in benchmarks/repos. Clone them first (see run-benchmark-matrix.mjs).');
    process.exit(1);
  }

  console.log('SigMap grounding benchmark (offline callee-grounding ablation)\n');
  const rows = [];
  let tTotal = 0, tGrounded = 0;
  for (const repo of repos) {
    const dir = path.join(REPOS_DIR, repo);
    // Ensure an index exists (re-generate, like the quality benchmark).
    spawnSync(process.execPath, [GEN_CTX], { cwd: dir, stdio: 'ignore' });
    const m = measureGrounding(dir);
    rows.push({ repo, ...m });
    tTotal += m.total; tGrounded += m.grounded;
    console.log(`  ${repo.padEnd(22)} ${String(m.grounded).padStart(6)}/${String(m.total).padEnd(6)} grounded  ${(m.coverage * 100).toFixed(1)}%`);
  }
  const aggCoverage = tTotal > 0 ? tGrounded / tTotal : 0;
  const aggPct = (aggCoverage * 100).toFixed(1);
  console.log('  ' + '─'.repeat(50));
  console.log(`  AGGREGATE              ${String(tGrounded).padStart(6)}/${String(tTotal).padEnd(6)} grounded  ${aggPct}%`);
  console.log(`\n  Ground-truth availability: ${aggPct}% with SigMap  vs  0% without (every reference guessed).`);
  console.log('  (Proxy for hallucination risk — not a measured LLM rate. LLM A/B ablation: follow-up.)');

  if (save) {
    fs.mkdirSync(REPORTS, { recursive: true });
    fs.writeFileSync(path.join(REPORTS, 'hallucination.json'),
      JSON.stringify({ benchmark: 'grounding-coverage', repos: rows, aggregate: { total: tTotal, grounded: tGrounded, coverage: aggCoverage } }, null, 2));
    console.log(`\n  saved → benchmarks/reports/hallucination.json`);
  }

  if (gateThreshold != null) {
    if (aggCoverage * 100 < gateThreshold) {
      console.error(`\n  GATE FAIL: grounding coverage ${aggPct}% < ${gateThreshold}%`);
      process.exit(1);
    }
    console.log(`\n  GATE PASS: grounding coverage ${aggPct}% ≥ ${gateThreshold}%`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
