#!/usr/bin/env node
'use strict';

/**
 * run-perf-benchmark.mjs — what a re-run costs, and whether it writes the same thing (#971).
 *
 *   node scripts/run-perf-benchmark.mjs                       # cost on Django, printed
 *   node scripts/run-perf-benchmark.mjs --save                # + benchmarks/reports/perf.json
 *   node scripts/run-perf-benchmark.mjs --gate                # exit 1 above the thresholds
 *   node scripts/run-perf-benchmark.mjs --equivalence         # warm == cold == cache-off, every clone under benchmarks/repos
 *   node scripts/run-perf-benchmark.mjs --repos django,flask --runs 5 --baseline origin/develop
 *   node scripts/run-perf-benchmark.mjs --root /path/with/benchmarks/repos
 *
 * Cost mode, per repository and per Python situation (`python3` on PATH, or not — the AST
 * tier and the regex fallback have very different first runs):
 *
 *   baseline       the generator at --baseline (default: the merge base with origin/develop),
 *                  i.e. what a second run cost before the cache: the same as the first
 *   cold           this tree, empty `.context/`
 *   warm           this tree, immediately again, nothing changed
 *   warm-one-file  this tree, one source file changed (a newline appended)
 *
 * Every figure is CPU time (user + sys) of the child, the median of --runs runs, with the machine
 * and its load average beside it. The ratios are warm / cold, and warm / baseline. Cost is
 * report-only unless --gate is given; --equivalence is a hard failure.
 *
 * The rival figures in the report are what their READMEs claim, at a pinned commit, on their
 * machines and repositories. They were not run here and are labelled that way.
 *
 * Zero-dependency; Node built-ins only.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { CODE_ROOT, loadManifest, repoDir, checkoutState } from './lib/xrepo.mjs';
import {
  tempDir, copyRepo, resetCopy, runOnce, readOutputs, diffOutputs, writeConfig,
  pickEditableFile, touchContent, median, noPythonEnv,
} from './lib/warm-cache.mjs';

const ROOT = CODE_ROOT;
const REPORT = path.join(ROOT, 'benchmarks', 'reports', 'perf.json');
const SCRIPT = path.join(ROOT, 'gen-context.js');

/** The thresholds the issue sets, for Django. */
export const THRESHOLDS = Object.freeze({ warmOverCold: 0.25, oneFileCpuSeconds: 2 });

/** What the rivals' own READMEs say about speed, verbatim, at the commit the compare page pins. */
export const RIVAL_CLAIMS = Object.freeze([
  {
    tool: 'code-review-graph',
    source: 'https://github.com/tirth8205/code-review-graph/blob/d72e8fbf7ef571b668c26a4222a284bf7792e7a1/README.md',
    read: '2026-10-18',
    claim: 'a cold build of a ~3,000-file repository took about 40 seconds',
    claimOnDjango: 'On a ~3,000-file project (django) a two-file edit re-indexes in about 2.5 seconds on the path the hooks use, of which ~1.4 s is process start-up; a no-op update costs only that start-up',
  },
  {
    tool: 'codebase-memory-mcp',
    source: 'https://github.com/DeusData/codebase-memory-mcp/blob/354ccecbe612a9fdb624396a6738fa87f2617434/README.md',
    read: '2026-10-18',
    claim: 'Linux kernel (28M LOC, 75K files) in 3 minutes',
  },
]);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };

function pythonVersion() {
  const r = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || r.stderr).trim().replace(/^Python /, '') : null;
}

function git(args, cwd = ROOT) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** The generator at a git ref, written to a temp dir (the bundle runs on its own). */
function baselineScript(ref) {
  const sha = git(['rev-parse', '--verify', `${ref}^{commit}`]);
  if (!sha) return null;
  const r = spawnSync('git', ['show', `${sha}:gen-context.js`], { cwd: ROOT, maxBuffer: 1 << 27 });
  if (r.status !== 0) return null;
  const dir = tempDir('sigmap-baseline-');
  const file = path.join(dir, 'gen-context.js');
  fs.writeFileSync(file, r.stdout);
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* best effort */ } });
  return { file, sha };
}

function machine() {
  const cpus = os.cpus();
  return {
    platform: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    cpus: cpus.length,
    cpuModel: cpus[0] ? cpus[0].model : null,
    memoryGiB: Math.round(os.totalmem() / (1 << 30)),
    node: process.version,
  };
}

const sample = (n, fn) => Array.from({ length: n }, fn);

/** One repository, one Python situation: the four arms. */
function measure(srcDir, name, env, runs, base) {
  const dir = tempDir(`sigmap-perf-${name}-`);
  try {
    copyRepo(srcDir, dir);
    resetCopy(dir);
    const clean = () => { resetCopy(dir); };
    const cpu = (r) => (r.status === 0 ? r.cpu : null);
    const arms = {};
    const loadBefore = os.loadavg()[0];

    if (base) {
      arms.baseline = sample(runs, () => { clean(); return runOnce(dir, base.file, { env }); });
    }
    const cold = [];
    const warm = [];
    const warmOne = [];
    let edited = null;
    for (let i = 0; i < runs; i++) {
      clean();
      cold.push(runOnce(dir, SCRIPT, { env }));
      warm.push(runOnce(dir, SCRIPT, { env }));
      edited = edited || pickEditableFile(dir);
      touchContent(dir, edited);
      warmOne.push(runOnce(dir, SCRIPT, { env }));
    }
    arms.cold = cold;
    arms.warm = warm;
    arms.warmOneFile = warmOne;

    const out = {};
    for (const [k, rs] of Object.entries(arms)) {
      out[k] = { cpu: rs.map(cpu), wall: rs.map((r) => r.wall), medianCpu: median(rs.map(cpu)), medianWall: median(rs.map((r) => r.wall)) };
    }
    out.changedFile = edited;
    out.ratios = {
      warmOverCold: out.cold.medianCpu ? out.warm.medianCpu / out.cold.medianCpu : null,
      warmOneFileOverCold: out.cold.medianCpu ? out.warmOneFile.medianCpu / out.cold.medianCpu : null,
      warmOverBaseline: out.baseline && out.baseline.medianCpu ? out.warm.medianCpu / out.baseline.medianCpu : null,
      coldOverBaseline: out.baseline && out.baseline.medianCpu ? out.cold.medianCpu / out.baseline.medianCpu : null,
    };
    out.loadAverage = { before: loadBefore, after: os.loadavg()[0] };
    return out;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * warm == cold == cache off, for one repository, with and without a changed file.
 *
 * Both worlds run the same sequence from the same pristine tree: run, run again, change one
 * file, run. The runs are compared step by step, because a run's own output can be its next
 * run's input (a repository whose source roots include `.github` reads the context file it
 * wrote), so "the second run" is only comparable to another second run.
 */
function equivalence(repo, srcDir, env) {
  const dir = tempDir(`sigmap-eq-${repo.name}-`);
  try {
    copyRepo(srcDir, dir);
    let edited = null;
    let editedStat = null;
    const sequence = (extractCache) => {
      resetCopy(dir);
      // The reset rewrites the file the other world changed, with a new modification time, and the
      // budget keeps the newest files: put the time back so both worlds start from the same tree.
      if (editedStat) fs.utimesSync(path.join(dir, edited), editedStat.atimeMs / 1000, editedStat.mtimeMs / 1000);
      writeConfig(dir, { ...(repo.srcDirs ? { srcDirs: repo.srcDirs } : {}), extractCache });
      const steps = [];
      const step = (label) => {
        const r = runOnce(dir, SCRIPT, { env });
        steps.push({ label, ok: r.status === 0, out: readOutputs(dir) });
      };
      step('first run');
      step('second run');
      edited = edited || pickEditableFile(dir);
      editedStat = editedStat || fs.statSync(path.join(dir, edited));
      touchContent(dir, edited);
      step(`after changing ${edited}`);
      return steps;
    };
    const off = sequence(false);
    const on = sequence(true);
    const failures = [];
    for (let i = 0; i < off.length; i++) {
      if (!off[i].ok || !on[i].ok) { failures.push(`${on[i].label}: a run exited non-zero`); continue; }
      const d = diffOutputs(off[i].out, on[i].out);
      if (d) failures.push(`${on[i].label} (cache on, against cache off): ${d}`);
    }
    return { repo: repo.name, failures, editedFile: edited };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function fmt(n, unit = 's') { return n === null || n === undefined ? 'n/a' : `${n.toFixed(2)}${unit}`; }
function pct(n) { return n === null || n === undefined ? 'n/a' : `${(n * 100).toFixed(0)}%`; }

const dataRoot = path.resolve(opt('--root', ROOT));
const manifest = loadManifest(dataRoot);

/**
 * Every git checkout under benchmarks/repos, with the source roots its suite configures: the
 * xrepo manifest's (`srcDirs` where detection cannot reach the code) or the honest benchmark's
 * overrides. Everything else runs zero-config, as a first-time user's run does.
 */
function pinnedClones() {
  const dir = path.join(dataRoot, 'benchmarks', 'repos');
  let overrides = {};
  try { overrides = JSON.parse(fs.readFileSync(path.join(dataRoot, 'benchmarks', 'config-overrides.json'), 'utf8')); } catch (_) { /* none */ }
  let names = [];
  // `isDirectory()` of a Dirent is false for a symlink, which is how a worktree shares the clones.
  const isDir = (name) => { try { return fs.statSync(path.join(dir, name)).isDirectory(); } catch (_) { return false; } };
  try { names = fs.readdirSync(dir).filter((n) => isDir(n) && fs.existsSync(path.join(dir, n, '.git'))).sort(); } catch (_) { /* none */ }
  return names.map((name) => {
    const entry = manifest.repos.find((r) => r.name === name);
    const srcDirs = (entry && entry.srcDirs) || (overrides[name] && overrides[name].srcDirs) || undefined;
    return { name, srcDirs, dir: path.join(dir, name) };
  });
}

if (flag('--equivalence')) {
  const only = opt('--repos', '').split(',').filter(Boolean);
  let bad = 0;
  let ran = 0;
  for (const repo of pinnedClones()) {
    if (only.length && !only.includes(repo.name)) continue;
    ran++;
    const res = equivalence(repo, repo.dir, noPythonEnv());
    if (res.failures.length) {
      bad++;
      console.log(`[warm-cache] FAIL ${repo.name}`);
      for (const f of res.failures) console.log(`    ${f}`);
    } else {
      console.log(`[warm-cache] ok   ${repo.name} (warm == cold == cache off; one changed file: ${res.editedFile})`);
    }
  }
  if (ran === 0) { console.log('[warm-cache] SKIP — no clones under benchmarks/repos to compare. Run `node scripts/fetch-xrepo-repos.mjs`.'); process.exit(0); }
  console.log(`[warm-cache] ${ran - bad}/${ran} repositories equivalent`);
  process.exit(bad ? 1 : 0);
}

// ---- cost mode ---------------------------------------------------------------------------
const names = opt('--repos', 'django').split(',').filter(Boolean);
const runs = Math.max(1, Number(opt('--runs', '3')) || 3);
const baseRef = opt('--baseline', 'origin/develop');
const mergeBase = git(['merge-base', 'HEAD', baseRef]);
const base = mergeBase ? baselineScript(mergeBase) : null;
const py = pythonVersion();
const report = {
  generated: new Date().toISOString(),
  sigmapVersion: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
  commit: git(['rev-parse', 'HEAD']),
  baseline: base ? { ref: baseRef, commit: base.sha } : null,
  machine: { ...machine(), python3: py },
  method: 'CPU time (user + sys) of the generator process tree, from the shell `times` builtin; the median of `runs` runs; each run on a fresh copy reset with git clean. Wall time is recorded but is not the figure. `baseline` is the generator at the merge base, which re-extracted everything on every run. A cache-off run of this tree is not the baseline: the tree also carries changes that make every run cheaper.',
  runs,
  thresholds: THRESHOLDS,
  rivals: { note: 'what each README says, at the pinned commit, on its own machine and repository; not run here', claims: RIVAL_CLAIMS },
  repos: [],
};

let breached = 0;
for (const name of names) {
  const repo = manifest.repos.find((r) => r.name === name) || { name };
  const srcDir = repoDir(dataRoot, name);
  if (!fs.existsSync(srcDir)) { console.log(`[perf] SKIP ${name} — no checkout at ${srcDir}`); continue; }
  const entry = { name, commit: checkoutState(dataRoot, repo).head, situations: {} };
  const situations = [];
  if (py) situations.push(['python3-present', process.env]);
  situations.push(['python3-absent', noPythonEnv()]);
  for (const [label, env] of situations) {
    console.log(`[perf] ${name} · ${label} · ${runs} run(s) per arm ...`);
    const r = measure(srcDir, name, env, runs, base);
    entry.situations[label] = r;
    console.log(`        baseline ${fmt(r.baseline && r.baseline.medianCpu)} · cold ${fmt(r.cold.medianCpu)} · warm ${fmt(r.warm.medianCpu)} (${pct(r.ratios.warmOverCold)} of cold, ${pct(r.ratios.warmOverBaseline)} of baseline) · one file changed ${fmt(r.warmOneFile.medianCpu)}   load ${r.loadAverage.before.toFixed(1)} → ${r.loadAverage.after.toFixed(1)} on ${os.cpus().length} cpus`);
    if (name === 'django') {
      if (r.ratios.warmOverCold > THRESHOLDS.warmOverCold) { breached++; console.log(`        ABOVE threshold: warm is ${pct(r.ratios.warmOverCold)} of cold (limit ${pct(THRESHOLDS.warmOverCold)})`); }
      if (r.warmOneFile.medianCpu > THRESHOLDS.oneFileCpuSeconds) { breached++; console.log(`        ABOVE threshold: one changed file costs ${fmt(r.warmOneFile.medianCpu)} (limit ${THRESHOLDS.oneFileCpuSeconds}s)`); }
    }
  }
  report.repos.push(entry);
}

if (flag('--save')) {
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
  console.log(`[perf] wrote ${path.relative(ROOT, REPORT)}`);
}
if (flag('--gate') && breached) process.exit(1);
