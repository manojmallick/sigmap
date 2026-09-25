#!/usr/bin/env node
/**
 * Source-root coverage gate — the regression guard for silent under-detection.
 *
 *   node scripts/run-source-root-gate.mjs           # run, print table
 *   node scripts/run-source-root-gate.mjs --json    # machine-readable
 *   node scripts/run-source-root-gate.mjs --save    # write the baseline
 *   node scripts/run-source-root-gate.mjs --gate    # exit 1 on regression
 *
 * WHY: source-root detection can silently return almost nothing and every
 * existing gate still passes. It happened — multi-module Gradle/Maven/sbt and
 * Kotlin Multiplatform layouts resolved to a handful of files for a long time
 * (okhttp 4 of 596, akka 29 of 2,651) and nothing noticed, because the gated
 * retrieval corpus is JavaScript and measures RANKING over an index it assumes
 * is populated. A ranker scores what it is given; it cannot report what
 * detection never handed it.
 *
 * This asserts the input side directly: for each cloned repo, how many source
 * files does detection actually reach, out of how many exist on disk.
 *
 * Two kinds of check, mirroring the call-graph gate:
 *   1. FLOOR — a per-repo minimum reach ratio. Catches a collapse (the okhttp
 *      shape) even if the committed baseline were regenerated while broken.
 *   2. BASELINE — indexed counts against committed numbers, to catch a
 *      narrower regression that stays above the floor.
 *
 * Offline and deterministic: no network, no LLM, no generate pass — detection
 * plus a directory walk. Exits 0 when the repos are absent, so a fresh
 * checkout is never broken by it.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { resolveSourceRoots } = require(path.join(ROOT, 'src/discovery/source-root-resolver.js'));

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const save = argv.includes('--save');
const gate = argv.includes('--gate');

// Overridable so the corpus can live elsewhere, and so the guard's own tests
// can exercise the absent-repos path without copying the source tree.
const REPOS_DIR = process.env.SIGMAP_BENCH_REPOS
  ? path.resolve(process.env.SIGMAP_BENCH_REPOS)
  : path.join(ROOT, 'benchmarks', 'repos');
const BASELINE = path.join(ROOT, 'benchmarks', 'source-root-baseline.json');

// Source extensions that count toward reach. Deliberately the languages whose
// layouts this gate exists to protect, plus the mainstream scripting ones, so
// a JS-only regression is caught too.
const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.java', '.kt', '.kts', '.scala', '.go', '.rs',
  '.rb', '.php', '.swift', '.dart', '.cs',
]);

// Never counted as "source present": vendored, generated or build output. A
// repo that vendors its dependencies would otherwise show an unreachably low
// ratio through no fault of detection.
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'build', 'dist', 'out', 'target', 'vendor',
  '.gradle', '.idea', 'coverage', '__pycache__', '.next', 'venv', '.venv',
]);

/**
 * The floor every repo must clear.
 *
 * Deliberately low, because the two checks do different jobs: the BASELINE
 * catches drift, and this catches a COLLAPSE even if the baseline were
 * recorded while already broken. Calibrated against the real failures it
 * exists to catch — pre-fix okhttp reached 1.1% and akka 2.3% — so 5% is
 * comfortably above both while leaving room for layouts that are legitimately
 * hard to reach.
 *
 * KNOWN BELOW-PAR (not a regression, recorded in the baseline so it cannot
 * worsen): kotlinx-coroutines sits at ~10%. It uses a flat Kotlin
 * Multiplatform layout — `<module>/<target>/src`, e.g.
 * `kotlinx-coroutines-core/common/src` — rather than the conventional
 * `src/<sourceSet>/<lang>` the v8.51.0 detection covers. Supporting it is a
 * separate change; this gate's job is to stop it silently getting worse.
 */
const MIN_REACH = 0.05;

/** Baseline tolerance — a repo may lose this fraction before it is a failure. */
const DROP_TOLERANCE = 0.10;

/**
 * Test-shaped paths. Detection deliberately excludes these, so counting them
 * as "present" would make every healthy repo look under-reached.
 */
function isTestPath(rel) {
  return /(^|\/)(tests?|spec|specs|__tests__|e2e|testFixtures|benchmarks?|examples?|samples?|integration-test)(\/|$)/i.test(rel)
    || /\.(test|spec)\.[a-z]+$/i.test(rel)
    || /(^|\/)[A-Za-z0-9_]+(Test|Tests|Spec|Specs)\.[a-z]+$/.test(rel);
}

/**
 * Collect source files into `into` as repo-relative paths.
 *
 * A Set, not a counter: roots can overlap (a module root plus one of its
 * source sets), and summing per-root counts double-counted those files —
 * which is why the first run reported reach ratios above 100%.
 */
function walkInto(dir, repoDir, into, depth = 0) {
  if (depth > 12) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      walkInto(full, repoDir, into, depth + 1);
    } else if (e.isFile() && CODE_EXTS.has(path.extname(e.name).toLowerCase())) {
      const rel = path.relative(repoDir, full).replace(/\\/g, '/');
      if (!isTestPath(rel)) into.add(rel);
    }
  }
}

/** Files reachable from the detected roots, and files present in the repo. */
function measure(repoDir) {
  const { roots, isJvmMultiModule } = resolveSourceRoots(repoDir, { exclude: [...SKIP_DIRS] });
  const reachedSet = new Set();
  for (const r of roots) {
    walkInto(path.join(repoDir, r.split('/').join(path.sep)), repoDir, reachedSet);
  }
  const presentSet = new Set();
  walkInto(repoDir, repoDir, presentSet);
  const reached = reachedSet.size;
  const present = presentSet.size;
  return {
    roots: roots.length,
    reached,
    present,
    ratio: present > 0 ? Number((reached / present).toFixed(3)) : 0,
    jvmMultiModule: !!isJvmMultiModule,
  };
}

function listRepos() {
  try {
    return fs.readdirSync(REPOS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch (_) { return []; }
}

const repos = listRepos();
if (repos.length === 0) {
  console.log('[source-root] repos not cloned — gate skipped');
  process.exit(0);
}

const rows = [];
for (const name of repos) {
  const dir = path.join(REPOS_DIR, name);
  let m;
  try { m = measure(dir); } catch (err) {
    rows.push({ repo: name, error: err.message });
    continue;
  }
  // A repo with almost no source of the tracked kinds tells us nothing.
  if (m.present < 20) continue;
  rows.push({ repo: name, ...m });
}

if (save) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    generated_note: 'Deterministic source-root reach per cloned repo. Regenerate with --save.',
    min_reach: MIN_REACH,
    repos: rows.map(({ repo, roots, reached, present, ratio, jvmMultiModule }) =>
      ({ repo, roots, reached, present, ratio, jvmMultiModule })),
  }, null, 2) + '\n', 'utf8');
  console.log(`[source-root] baseline written — ${rows.length} repos → ${path.relative(ROOT, BASELINE)}`);
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify({ repos: rows }, null, 2));
  process.exit(0);
}

// ── Human table ────────────────────────────────────────────────────────────
console.log('');
console.log('  repo                     roots   reached / present    reach   layout');
console.log('  ' + '─'.repeat(74));
for (const r of rows) {
  if (r.error) { console.log(`  ${r.repo.padEnd(24)} ERROR ${r.error}`); continue; }
  const layout = r.jvmMultiModule ? 'jvm-multi' : '';
  const flag = r.ratio < MIN_REACH ? '  ⚠ below floor' : '';
  console.log(
    `  ${r.repo.padEnd(24)} ${String(r.roots).padStart(4)}   `
    + `${String(r.reached).padStart(6)} / ${String(r.present).padEnd(7)}  `
    + `${(r.ratio * 100).toFixed(1).padStart(5)}%   ${layout}${flag}`,
  );
}
console.log('');

if (!gate) {
  console.log(`  floor ${(MIN_REACH * 100).toFixed(0)}%  ·  run with --gate to enforce, --save to record a baseline`);
  console.log('');
  process.exit(0);
}

// ── Gate ───────────────────────────────────────────────────────────────────
const failures = [];

// 1. Floor — catches a collapse even against a baseline recorded while broken.
for (const r of rows) {
  if (r.error) { failures.push(`${r.repo}: ${r.error}`); continue; }
  if (r.ratio < MIN_REACH) {
    failures.push(`${r.repo}: reach ${(r.ratio * 100).toFixed(1)}% is below the ${(MIN_REACH * 100).toFixed(0)}% floor `
      + `(${r.reached} of ${r.present} files, ${r.roots} root(s))`);
  }
}

// 2. Baseline — catches a narrower regression that stays above the floor.
let baseline = null;
try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (_) { /* absent */ }
if (baseline && Array.isArray(baseline.repos)) {
  const prior = new Map(baseline.repos.map((r) => [r.repo, r]));
  for (const r of rows) {
    const was = prior.get(r.repo);
    if (!was || r.error) continue;
    const floor = Math.floor(was.reached * (1 - DROP_TOLERANCE));
    if (r.reached < floor) {
      failures.push(`${r.repo}: reached ${r.reached} files, baseline ${was.reached} `
        + `(more than ${(DROP_TOLERANCE * 100).toFixed(0)}% below)`);
    }
  }
} else {
  console.log('[source-root] no committed baseline — floor check only. Record one with --save.');
}

if (failures.length) {
  console.error('[source-root] FAIL');
  for (const f of failures) console.error(`  ${f}`);
  console.error('');
  console.error('  Source-root detection reaches fewer files than it should. This is the');
  console.error('  failure class where every other gate still passes: the ranker scores');
  console.error('  what it is given and cannot report what detection never handed it.');
  process.exit(1);
}

console.log(`[source-root] PASS — ${rows.length} repos, all above the ${(MIN_REACH * 100).toFixed(0)}% floor`);
process.exit(0);
