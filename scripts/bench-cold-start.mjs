#!/usr/bin/env node
// #1071, T4 (the north star): time from a cold start to the first `ask` answer must not be more than 10% slower than v8.87.0.
//
//   node scripts/bench-cold-start.mjs --repos <dir of clones> --only gin,express \
//        --arm baseline=<v8.87.0 checkout>:today --arm develop=.:today --arm flip=.:candidate-a [--runs 7] [--max-slowdown 0.10]
//
// An ARM is `name=<SigMap checkout>:<config>`; the first arm is the baseline. A config is `today` (no config file: what an existing project gets)
// or `candidate-a` (`strategy: "index"` + `mcp.tools: "locate"`). For every repository and arm, each run unpacks a fresh `git archive` copy
// (so SigMap has no index, no cache and no .context) and times the two commands a new user types, `node <checkout>/gen-context.js` and then
// `node <checkout>/gen-context.js ask "<query>"`, to the exit of the second (`ask` has no index to answer from before the first). Runs are taken in
// round-robin order, arm after arm, so a slow minute on the machine lands on every arm rather than on one; the first `--warmup` rounds are run
// and thrown away (the file cache and the CPU settle). Each later round gives one PAIR of times per arm and baseline; the verdict reads a 95%
// interval for the median of the paired ratios (see `compare`): "within" (upper end at or under the bar), "slower" (lower end over it) or
// "inconclusive" (the interval spans the bar: this laptop's noise, not SigMap, is what the runs show).
// What it measures: a cold SigMap on a warm file cache, through `node` (not `npx`, whose download is the network's time, not SigMap's).
// It refuses to time a run that did not answer: a non-zero exit or an empty answer is an error, never a fast run.
//
// Exit 0: every non-baseline arm is within the allowed slowdown on every repository. Exit 1: one is slower. Exit 3: none is slower, but at least
// one is inconclusive. Exit 2: could not measure.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const MAX_SLOWDOWN = 0.10;
export const CONFIGS = Object.freeze({ today: null, 'candidate-a': { strategy: 'index', mcp: { tools: 'locate' } } });
const DEFAULT_QUERY = 'where is the main entry point';

export const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** `name=<checkout>:<config>` -> { name, checkout, config }. The checkout may itself contain a colon-free path; the LAST colon splits the config. */
export function parseArm(spec) {
  const eq = spec.indexOf('=');
  if (eq < 1) throw new Error(`arm "${spec}" is not name=<checkout>:<config>`);
  const rest = spec.slice(eq + 1); const colon = rest.lastIndexOf(':');
  if (colon < 1) throw new Error(`arm "${spec}" has no :<config> (one of ${Object.keys(CONFIGS).join(', ')})`);
  const config = rest.slice(colon + 1);
  if (!Object.prototype.hasOwnProperty.call(CONFIGS, config)) throw new Error(`arm "${spec}": unknown config "${config}" (one of ${Object.keys(CONFIGS).join(', ')})`);
  return { name: spec.slice(0, eq), checkout: path.resolve(rest.slice(0, colon)), config };
}

/** 95% interval for the median of `xs`, by resampling them (10,000 draws, a fixed seed, so the same runs always give the same interval). */
export function bootstrapMedian(xs, draws = 10000, seed = 1) {
  if (xs.length === 1) return { lo: xs[0], hi: xs[0] };
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const meds = [];
  for (let d = 0; d < draws; d++) { const r = []; for (let i = 0; i < xs.length; i++) r.push(xs[Math.floor(rnd() * xs.length)]); meds.push(median(r)); }
  meds.sort((a, b) => a - b);
  return { lo: meds[Math.floor(0.025 * draws)], hi: meds[Math.ceil(0.975 * draws) - 1] };
}

/**
 * Compare each arm with the first. Round i of every arm ran back to back, so the ratio of an arm's round to the baseline's is a pair; the
 * verdict reads the interval of the median of those ratios, not two medians of noisy times:
 *   within        the interval's upper end is no more than the allowed slowdown
 *   slower        the interval's lower end is above it
 *   inconclusive  the interval spans the bar: these runs cannot say. More runs, or a quieter machine, is the answer, not a guess.
 * @param {Object<string, number[]>} times milliseconds per arm, in round order, baseline first
 * @returns {{ arm: string, medianMs: number, ratio: number|null, slowdown: number|null, lo: number|null, hi: number|null,
 *            verdict: 'baseline'|'within'|'slower'|'inconclusive', ok: boolean|null }[]}
 */
export function compare(times, maxSlowdown = MAX_SLOWDOWN) {
  const names = Object.keys(times); const base = times[names[0]];
  return names.map((arm, i) => {
    const m = median(times[arm]);
    if (i === 0) return { arm, medianMs: m, ratio: null, slowdown: null, lo: null, hi: null, verdict: 'baseline', ok: null };
    if (times[arm].length !== base.length) throw new Error(`arm ${arm} has ${times[arm].length} runs, the baseline ${base.length}`);
    const ratios = times[arm].map((t, j) => t / base[j]);
    const ratio = median(ratios); const { lo, hi } = bootstrapMedian(ratios);
    // The tolerance is for floating point only: 110 / 100 - 1 is 0.10000000000000009, and exactly 10% slower must pass.
    const eps = 1e-9;
    const verdict = hi - 1 <= maxSlowdown + eps ? 'within' : lo - 1 > maxSlowdown + eps ? 'slower' : 'inconclusive';
    return { arm, medianMs: m, ratio, slowdown: ratio - 1, lo, hi, verdict, ok: verdict === 'within' ? true : verdict === 'slower' ? false : null };
  });
}

const TIME_BIN = '/usr/bin/time';

/** CPU seconds (user + system) from the `real/user/sys` lines `time -p` prints on stderr, or null when they are not there. */
export function parseTimeP(stderr) {
  const last = (re) => { const all = [...String(stderr || '').matchAll(re)]; return all.length ? Number(all[all.length - 1][1]) : null; };
  const user = last(/^user\s+([0-9]+(?:\.[0-9]+)?)\s*$/gm); const sys = last(/^sys\s+([0-9]+(?:\.[0-9]+)?)\s*$/gm);
  return user === null || sys === null ? null : user + sys;
}

/** One timed cold run, as `{ wall, cpu }` in milliseconds (`cpu` is null unless `cpu: true`). Throws when SigMap did not answer. */
export function coldRunDetail({ repoDir, arm, query, cpu = false }) {
  if (cpu && !fs.existsSync(TIME_BIN)) throw new Error(`--metric cpu needs ${TIME_BIN} (POSIX \`time -p\`), which is not here`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-cold-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-codexhome-'));
  try {
    const tar = execFileSync('git', ['-C', repoDir, 'archive', 'HEAD'], { maxBuffer: 1 << 30 });
    const u = spawnSync('tar', ['-x', '-C', dir], { input: tar });
    if (u.status !== 0) throw new Error(`cannot unpack ${repoDir}`);
    const cfg = CONFIGS[arm.config];
    if (cfg) fs.writeFileSync(path.join(dir, 'gen-context.config.json'), `${JSON.stringify(cfg, null, 2)}\n`);
    // `ask` has nothing to answer from until the index exists ("no context file found, run sigmap first"), so a cold start is the two commands
    // a new user types: generate, then ask. Both are inside the timed window.
    const env = { ...process.env, CODEX_HOME: home, NO_COLOR: '1' };
    const script = path.join(arm.checkout, 'gen-context.js');
    const sigmap = (args) => (cpu
      ? spawnSync(TIME_BIN, ['-p', process.execPath, script, ...args], { cwd: dir, encoding: 'utf8', env, maxBuffer: 1 << 26 })
      : spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8', env, maxBuffer: 1 << 26 }));
    const t0 = process.hrtime.bigint();
    const gen = sigmap([]);
    if (gen.status !== 0) throw new Error(`${arm.name}: generating the index exited ${gen.status} in ${repoDir}: ${(gen.stderr || '').slice(-300)}`);
    const r = sigmap(['ask', query]);
    const wall = Number(process.hrtime.bigint() - t0) / 1e6;
    if (r.status !== 0) throw new Error(`${arm.name}: \`ask\` exited ${r.status} in ${repoDir}: ${(r.stderr || '').slice(-300)}`);
    if (!/\S/.test(r.stdout || '')) throw new Error(`${arm.name}: \`ask\` printed nothing in ${repoDir}; a run that did not answer is not a fast run`);
    if (!cpu) return { wall, cpu: null };
    const a = parseTimeP(gen.stderr); const b = parseTimeP(r.stderr);
    if (a === null || b === null) throw new Error(`${arm.name}: \`time -p\` printed no user/sys lines in ${repoDir}, so there is no CPU time to compare`);
    return { wall, cpu: (a + b) * 1000 };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true });
  }
}

/** One timed cold run in milliseconds: wall-clock, or CPU time (user + system of both commands) with `metric: 'cpu'`. */
export function coldRun({ metric = 'wall', ...rest }) {
  const d = coldRunDetail({ ...rest, cpu: metric === 'cpu' });
  return metric === 'cpu' ? d.cpu : d.wall;
}

function main(argv) {
  const all = (n) => argv.flatMap((a, i) => (a === n && argv[i + 1] ? [argv[i + 1]] : []));
  const val = (n, d) => { const v = all(n); return v.length ? v[v.length - 1] : d; };
  const arms = all('--arm').map(parseArm);
  if (arms.length < 2) { console.error('need at least two --arm name=<checkout>:<config> (the first is the baseline)'); process.exit(2); }
  for (const a of arms) if (!fs.existsSync(path.join(a.checkout, 'gen-context.js'))) { console.error(`arm ${a.name}: no gen-context.js in ${a.checkout}`); process.exit(2); }
  const reposDir = path.resolve(val('--repos', path.join(ROOT, 'benchmarks', 'repos')));
  const names = (val('--only', '') || '').split(',').filter(Boolean);
  if (!names.length) { console.error('--only <repo,repo>: which clones under --repos to time'); process.exit(2); }
  const runs = Number(val('--runs', 15)); const warmup = Number(val('--warmup', 2)); const max = Number(val('--max-slowdown', MAX_SLOWDOWN)); const query = val('--query', DEFAULT_QUERY);
  const metric = val('--metric', 'wall');
  if (metric !== 'wall' && metric !== 'cpu') { console.error('--metric is wall or cpu'); process.exit(2); }
  const report = []; let slower = false; let inconclusive = false;
  for (const name of names) {
    const repoDir = path.join(reposDir, name);
    if (!fs.existsSync(path.join(repoDir, '.git'))) { console.error(`no clone at ${repoDir}`); process.exit(2); }
    const files = execFileSync('git', ['-C', repoDir, 'ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean).length;
    const times = Object.fromEntries(arms.map((a) => [a.name, []]));
    const walls = Object.fromEntries(arms.map((a) => [a.name, []]));
    for (let i = 0; i < warmup + runs; i++) for (const a of arms) {
      const d = coldRunDetail({ repoDir, arm: a, query, cpu: metric === 'cpu' });
      if (i >= warmup) { times[a.name].push(metric === 'cpu' ? d.cpu : d.wall); walls[a.name].push(d.wall); }
    }
    const rows = compare(times, max);
    if (rows.some((r) => r.verdict === 'slower')) slower = true;
    if (rows.some((r) => r.verdict === 'inconclusive')) inconclusive = true;
    report.push({ repo: name, files, runs, warmup, metric, times, walls, rows });
  }
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify({ query, runs, warmup, metric, maxSlowdown: max, arms, report }, null, 1)}\n`);
  else {
    console.log(`cold start to the first \`ask\` answer; metric ${metric === 'cpu' ? 'CPU time (user + system of both commands)' : 'wall-clock'}; ${runs} interleaved rounds after ${warmup} discarded; query "${query}"; allowed slowdown vs the first arm ${(max * 100).toFixed(0)}%`);
    for (const a of arms) console.log(`  arm ${a.name}: ${a.checkout} (${a.config})`);
    for (const r of report) {
      console.log(`\n${r.repo} (${r.files} files)`);
      for (const x of r.rows) {
        const spread = `${(Math.min(...r.times[x.arm]) / 1000).toFixed(1)}-${(Math.max(...r.times[x.arm]) / 1000).toFixed(1)} s`;
        const pct = (v) => `${v - 1 >= 0 ? '+' : ''}${((v - 1) * 100).toFixed(1)}%`;
        const tail = x.verdict === 'baseline' ? 'baseline' : `paired median ${pct(x.ratio)}, 95% interval [${pct(x.lo)}, ${pct(x.hi)}]  ${{ within: 'WITHIN THE BAR', slower: 'SLOWER THAN THE BAR', inconclusive: 'INCONCLUSIVE (the interval spans the bar)' }[x.verdict]}`;
        const wall = r.metric === 'cpu' ? `; wall median ${(median(r.walls[x.arm]) / 1000).toFixed(2)} s, range ${(Math.min(...r.walls[x.arm]) / 1000).toFixed(1)}-${(Math.max(...r.walls[x.arm]) / 1000).toFixed(1)} s` : '';
        console.log(`  ${x.arm.padEnd(10)} median ${(x.medianMs / 1000).toFixed(2).padStart(6)} s ${r.metric === 'cpu' ? 'CPU' : 'wall'} (runs ${spread}${wall})  ${tail}`);
      }
    }
  }
  process.exit(slower ? 1 : inconclusive ? 3 : 0);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main(process.argv.slice(2));
