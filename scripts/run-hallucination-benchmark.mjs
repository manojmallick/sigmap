#!/usr/bin/env node
/**
 * SigMap grounding benchmark — the offline GATE (IMPL.md §7/§9).
 *
 * Measures how much ground truth SigMap actually gives an agent, as a
 * callee-grounding ablation. NO LLM, no network, deterministic — so it runs in
 * CI and the number is reproducible.
 *
 *   universe  = every symbol DEFINED in the files SigMap is meant to index — the
 *               generator's own resolved scope (loadConfig srcDirs/exclude/maxDepth
 *               plus the shared per-repo override), minus the files its drop order
 *               classes as tests, mocks and generated code (#704)
 *   grounded  = symbols SigMap surfaces in its index (buildSigIndex) — i.e. the
 *               ones get_callee_signatures can return exact signatures for
 *   coverage  = grounded / universe
 *   baseline  = 0  (no SigMap → the agent guesses every reference)
 *
 * The universe and the index MUST describe one population. Before #704 the
 * universe came from a hard-coded srcDirs list while the index came from the
 * generator's resolver, so the ratio mixed two populations: clap measured 0/0
 * (only its facade crate's src/ was scanned) and okhttp's universe included
 * samples and build-logic the index never covers. A repo whose universe is
 * empty is UNMEASURED, never 0% and never silently averaged in.
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
 *   node scripts/run-hallucination-benchmark.mjs --gate     # exit 1 on an unmeasured repo or one below its floor
 *   node scripts/run-hallucination-benchmark.mjs --gate 50  # ... and if aggregate coverage < 50%
 *   node scripts/run-hallucination-benchmark.mjs --save-floors  # record per-repo floors from this run
 *
 * An unmeasured repo (empty universe) fails the run with or without --gate.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { loadOverrides, withSharedRepoContext } from './lib/shared-repo-context.mjs';
import { stamp } from './lib/report-stamp.mjs';
import { benchmarkRepoNames } from './lib/benchmark-repos.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPOS_DIR = path.join(ROOT, 'benchmarks', 'repos');
const REPORTS = path.join(ROOT, 'benchmarks', 'reports');
const GEN_CTX = path.join(ROOT, 'gen-context.js');

const { buildSigIndex } = require(path.join(ROOT, 'src/retrieval/ranker.js'));
const { extractFile, langFor } = require(path.join(ROOT, 'src/extractors/dispatch.js'));
const { loadConfig } = require(path.join(ROOT, 'src/config/loader.js'));
const { isTestFile, isMockFile, isGeneratedFile } = require(path.join(ROOT, 'src/util/file-class.js'));

const FLOORS_FILE = path.join(ROOT, 'benchmarks', 'grounding-floors.json');
/** Points of headroom a recorded floor sits below the measured coverage. */
const FLOOR_MARGIN_PCT = 5;

/** Defining symbol name from a signature line (same rule as the MCP handler). */
function defName(sig) {
  const cleaned = String(sig).replace(/\s*:\d+(?:-\d+)?\s*$/, '');
  const m = cleaned.match(/\b(?:async\s+function|function|class|def|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/)
    || cleaned.match(/([A-Za-z_$][\w$]*)\s*\(/);
  return m ? m[1] : null;
}

/**
 * The generator's file walk: name-based excludes, bounded depth, sorted. Kept
 * in step with gen-context.js `walkDir` so the universe is the population the
 * generator actually scans, not a second opinion about it.
 */
function _walk(dir, exclude, maxDepth, out, depth) {
  if (depth > maxDepth) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (exclude.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) _walk(full, exclude, maxDepth, out, depth + 1);
    else if (e.isFile() && langFor(e.name)) out.push(full);
  }
}

/**
 * The files a repo's universe is drawn from: the generator's resolved scope,
 * less the categories its token-budget drop order removes first. Counting a
 * test or sample symbol as "dark" would blame the index for a policy choice.
 * @returns {string[]} absolute paths
 */
function scopeFiles(repoDir) {
  const cfg = loadConfig(repoDir);
  const found = [];
  for (const d of cfg.srcDirs || []) {
    const abs = path.join(repoDir, d);
    if (fs.existsSync(abs)) _walk(abs, cfg.exclude || [], cfg.maxDepth, found, 0);
  }
  const files = [...new Set(found)];
  return files.filter((f) => {
    const rel = path.relative(repoDir, f);
    return !isTestFile(rel) && !isMockFile(rel) && !isGeneratedFile(rel);
  });
}

/** Every symbol defined across a repo's in-scope source — the universe an agent may reference. */
function definedNames(repoDir) {
  const names = new Set();
  const files = scopeFiles(repoDir);
  for (const f of files) {
    try {
      for (const sig of extractFile(f, fs.readFileSync(f, 'utf8'))) {
        const n = defName(sig);
        if (n) names.add(n);
      }
    } catch (_) {}
  }
  return { names, files: files.length };
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

// ── Hermeticity (#480, #706) ────────────────────────────────────────────────
// This benchmark regenerates each repo's context, and left behind that context
// skews any later suite that reads it (the callgraph A/B measured 32.2% instead
// of ~87% when a plain-config regen was left on disk). Snapshot every context
// artifact before the regen and restore it byte-exactly after measuring, so
// running this suite leaves the shared benchmark repos untouched. Since #704 the
// regen uses the shared per-repo override (the same one the retrieval harness
// applies), so what it indexes is what it measures.
//
// The snapshot/restore primitive now lives in scripts/lib/shared-repo-context.mjs
// so every suite uses ONE artifact set. The local copy here omitted `.context/`
// — the directory holding `sig-index.json`, which is what the ranker actually
// reads — so a "hermetic" call still rewrote the retrieval index (#706).

export {
  CONTEXT_ARTIFACTS, CONTEXT_DIRS, snapshotArtifacts, restoreArtifacts,
} from './lib/shared-repo-context.mjs';

/**
 * Regenerate, measure, and restore — the repo's context artifacts are
 * byte-identical before and after this call. The shared per-repo override is
 * applied for BOTH the regeneration and the scope the universe is read from, so
 * the two cannot disagree about what is in scope.
 * @param {string} repoDir
 * @returns {ReturnType<typeof measureGrounding>}
 */
export function measureGroundingHermetic(repoDir) {
  const override = loadOverrides(ROOT)[path.basename(repoDir)];
  return withSharedRepoContext(repoDir, {
    override,
    generate: () => { spawnSync(process.execPath, [GEN_CTX], { cwd: repoDir, stdio: 'ignore' }); },
    measure: () => measureGrounding(repoDir),
  });
}

/**
 * Grounding coverage for one repo.
 *
 * `status` is `unmeasured` when the universe is empty. The ratio is then
 * undefined — `coverage` is null, never 0 — so an empty population cannot pass
 * for a measurement (clap read 0/0 and printed as a normal row, #704).
 * @returns {{ status:'measured'|'unmeasured', files:number, total:number,
 *             grounded:number, dark:number, coverage:number|null }}
 */
export function measureGrounding(repoDir) {
  const { names: universe, files } = definedNames(repoDir);
  const indexed = indexedNames(repoDir);
  let grounded = 0;
  for (const n of universe) if (indexed.has(n)) grounded++;
  const total = universe.size;
  return {
    status: total > 0 ? 'measured' : 'unmeasured',
    files,
    total,
    grounded,
    dark: total - grounded,
    coverage: total > 0 ? grounded / total : null,
  };
}

/**
 * Judge a set of per-repo rows. Pure — no I/O — so the policy is unit-testable.
 *
 * - `unmeasured`: rows with an empty universe; always a failure.
 * - `unfloored` : measured rows with no recorded floor (a new repo must record one).
 * - `belowFloor`: measured rows under their own floor — averaged away by the
 *                 aggregate, which is why each repo is gated individually.
 * - `aggregate` is computed over MEASURED rows only.
 *
 * @param {Array<{repo:string,status:string,total:number,grounded:number,coverage:number|null}>} rows
 * @param {Record<string, number>} floors repo -> minimum coverage (0..1)
 * @param {number|null} [aggMin]           optional aggregate floor (0..1)
 */
export function judgeRows(rows, floors, aggMin = null) {
  const measured = rows.filter((r) => r.status === 'measured');
  const total = measured.reduce((n, r) => n + r.total, 0);
  const grounded = measured.reduce((n, r) => n + r.grounded, 0);
  const aggregate = total > 0 ? grounded / total : null;
  const unmeasured = rows.filter((r) => r.status !== 'measured').map((r) => r.repo);
  const unfloored = measured.filter((r) => floors[r.repo] === undefined).map((r) => r.repo);
  const belowFloor = measured
    .filter((r) => floors[r.repo] !== undefined && r.coverage < floors[r.repo])
    .map((r) => ({ repo: r.repo, coverage: r.coverage, floor: floors[r.repo] }));
  const aggBelow = aggMin != null && (aggregate === null || aggregate < aggMin);
  return { total, grounded, aggregate, unmeasured, unfloored, belowFloor, aggBelow };
}

/** Floors recorded from a run: measured coverage less the margin, to the whole percent. */
export function floorsFrom(rows) {
  const floors = {};
  for (const r of rows) {
    if (r.status !== 'measured') continue;
    floors[r.repo] = Math.max(0, Math.floor(r.coverage * 100 - FLOOR_MARGIN_PCT)) / 100;
  }
  return floors;
}

function readFloors() {
  try { return JSON.parse(fs.readFileSync(FLOORS_FILE, 'utf8')).repos || {}; } catch (_) { return {}; }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const pct = (c) => (c * 100).toFixed(1) + '%';

function main() {
  const save = process.argv.includes('--save');
  const saveFloors = process.argv.includes('--save-floors');
  const gate = process.argv.includes('--gate');
  const gateIdx = process.argv.indexOf('--gate');
  const aggArg = gateIdx !== -1 ? parseFloat(process.argv[gateIdx + 1]) : NaN;
  const aggMin = Number.isFinite(aggArg) ? aggArg / 100 : null;

  let repos = [];
  try {
    repos = benchmarkRepoNames(REPOS_DIR, ROOT);
  } catch (_) {}
  if (repos.length === 0) {
    console.error('No corpus repos in benchmarks/repos. Clone them first (see run-benchmark-matrix.mjs).');
    process.exit(1);
  }

  console.log('SigMap grounding benchmark (offline callee-grounding ablation)\n');
  const rows = [];
  for (const repo of repos) {
    // Regenerate + measure hermetically: context artifacts restored after (#480).
    const m = measureGroundingHermetic(path.join(REPOS_DIR, repo));
    rows.push({ repo, ...m });
    const detail = m.status === 'measured'
      ? `${String(m.grounded).padStart(6)}/${String(m.total).padEnd(6)} grounded  ${pct(m.coverage)}`
      : `UNMEASURED  (0 symbols across ${m.files} in-scope file(s))`;
    console.log(`  ${repo.padEnd(22)} ${detail}`);
  }

  const floors = readFloors();
  const verdict = judgeRows(rows, floors, aggMin);
  const aggPct = verdict.aggregate === null ? 'n/a' : pct(verdict.aggregate);
  console.log('  ' + '─'.repeat(50));
  console.log(`  AGGREGATE              ${String(verdict.grounded).padStart(6)}/${String(verdict.total).padEnd(6)} grounded  ${aggPct}  (measured repos only)`);
  console.log(`\n  Ground-truth availability: ${aggPct} with SigMap  vs  0% without (every reference guessed).`);
  console.log('  (Proxy for hallucination risk — not a measured LLM rate. LLM A/B ablation: follow-up.)');

  if (save) {
    fs.mkdirSync(REPORTS, { recursive: true });
    const report = stamp({
      benchmark: 'grounding-coverage',
      repos: rows,
      aggregate: { total: verdict.total, grounded: verdict.grounded, coverage: verdict.aggregate },
    }, ROOT);
    fs.writeFileSync(path.join(REPORTS, 'hallucination.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`\n  saved → benchmarks/reports/hallucination.json`);
  }

  if (saveFloors) {
    fs.writeFileSync(FLOORS_FILE, JSON.stringify({
      note: `Per-repo minimum grounding coverage, recorded ${FLOOR_MARGIN_PCT} points below the measured value. Re-record with: node scripts/run-hallucination-benchmark.mjs --save-floors`,
      repos: floorsFrom(rows),
    }, null, 2) + '\n');
    console.log(`\n  floors → benchmarks/grounding-floors.json`);
  }

  // An empty universe is a failed measurement, not a result — with or without --gate.
  let failed = false;
  if (verdict.unmeasured.length) {
    failed = true;
    console.error(`\n  FAIL: unmeasured repo(s) — empty universe: ${verdict.unmeasured.join(', ')}`);
  }
  if (gate && !saveFloors) {
    for (const r of verdict.unfloored) { failed = true; console.error(`  GATE FAIL: ${r} has no recorded floor (run --save-floors)`); }
    for (const b of verdict.belowFloor) { failed = true; console.error(`  GATE FAIL: ${b.repo} ${pct(b.coverage)} < floor ${pct(b.floor)}`); }
    if (verdict.aggBelow) { failed = true; console.error(`  GATE FAIL: aggregate ${aggPct} < ${(aggMin * 100).toFixed(1)}%`); }
    if (!failed) console.log(`\n  GATE PASS: ${rows.length} repos at or above their floors`);
  }
  if (failed) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
