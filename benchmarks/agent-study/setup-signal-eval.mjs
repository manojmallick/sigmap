#!/usr/bin/env node
// Free, offline once the clones exist: does anything SigMap can compute for a repository, with no model call, say how much a setup saves?
// Stage I of the study. The plan, the single primary test and its bar were committed before any feature was computed:
// docs-vp/guide/agent-study-protocol.md ("Stage I: can an offline signal say which setup suits a repository?").
//
//   node benchmarks/agent-study/setup-signal-eval.mjs --root <dir> --fetch   # build the data root from the recorded question files and clone each
//                                                                            # repository at its pinned commit (needs network, no key)
//   node benchmarks/agent-study/setup-signal-eval.mjs --root <dir>           # features and outcome, then the test
//   ... --json                                                                # the same as one object
//
// Features, per repository, on its own held-out questions (the 222 the agent was asked), no model call:
//   lead5      the share whose expected file is among the first five that `query_context` returns (the index arm, as the A/B prepares it)
//   grep5      the share whose expected file is among the first five of the honest benchmark's single-shot grep scan, on the pristine checkout
//   headroom   lead5 - grep5
//   files      the files the grep scan visited (a size control; the study found size does not predict)
// Outcome, per repository and setup (index, prefetch, locate): the typical-task change against the repository's own baseline, Messages API, Haiku 5.5,
// the `heldout` set, pairs formed and failed runs dropped exactly as summarize.mjs does, by geometricChange, for real cost, time and total tokens.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DATA_DIR = path.join(HERE, 'data');
const require = createRequire(import.meta.url);
const { geometricChange, makeRng } = await import(`${ROOT}/scripts/lib/agent-ab-stats.mjs`);

const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DATA = val('--root', null) ? path.resolve(val('--root', '')) : null;
const FETCH = argv.includes('--fetch');
const AS_JSON = argv.includes('--json');
if (!DATA) { console.error('usage: setup-signal-eval.mjs --root <dir> [--fetch] [--json]'); process.exit(2); }

const SET = 'heldout', ROUTE = 'api', MODEL = 'claude-haiku-5-5';
const SETUPS = ['index', 'prefetch', 'locate'];
const BOOT = 10000, SEED = 1;
const BAR = { rho: -0.5 };

const readJsonl = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

// ---- the outcome: recorded runs, paired as summarize.mjs pairs them ---------------------------------------------------------------------
const runs = readJsonl(path.join(DATA_DIR, 'runs.ndjson')).filter((r) => r.set === SET && r.route === ROUTE && r.model === MODEL && SETUPS.includes(r.variant));
const tot = (r) => r.in + r.out + r.cacheRead + r.cacheWrite;
const METRICS = { cost: (r) => r.usd, time: (r) => r.ms, tokens: tot };
const keyOf = (r) => `${r.repo}/${r.task}|${r.run}`;
const bySeries = new Map();
for (const r of runs) { if (!bySeries.has(r.series)) bySeries.set(r.series, []); bySeries.get(r.series).push(r); }
const outcome = {}; // setup -> metric -> repo -> { change, lo, hi, cls, pairs }
const outcomeRepos = new Set();
for (const rs of bySeries.values()) {
  const setup = rs[0].variant;
  const bad = new Set(rs.filter((r) => !r.ok).map(keyOf));
  const ok = rs.filter((r) => !bad.has(keyOf(r)));
  const m = new Map(ok.map((r) => [`${keyOf(r)}|${r.arm}`, r]));
  const keys = [...new Set(ok.map(keyOf))].filter((k) => m.has(`${k}|with`) && m.has(`${k}|without`));
  const byRepo = new Map();
  for (const k of keys) { const repo = m.get(`${k}|with`).repo; if (!byRepo.has(repo)) byRepo.set(repo, []); byRepo.get(repo).push(k); }
  for (const [metric, fn] of Object.entries(METRICS)) {
    for (const [repo, ks] of byRepo) {
      const g = geometricChange(ks.map((k) => ({ without: fn(m.get(`${k}|without`)), with: fn(m.get(`${k}|with`)) })));
      outcome[setup] = outcome[setup] || {}; outcome[setup][metric] = outcome[setup][metric] || {};
      outcome[setup][metric][repo] = { change: g.change, lo: g.lo, hi: g.hi, pairs: ks.length, cls: g.hi < 0 ? 'saves' : g.lo > 0 ? 'costs' : 'none' };
      if (setup === 'index') outcomeRepos.add(repo);
    }
  }
}

// ---- the data root: the recorded manifests and questions for the repositories the outcome covers -------------------------------------------
const manifests = ['heldout-repos.json', 'heldout2-repos.json'].flatMap((f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')).repos);
const repos = [...outcomeRepos].sort().map((n) => manifests.find((r) => r.name === n)).filter(Boolean);
if (repos.length !== outcomeRepos.size) { console.error(`a repository of the outcome is in neither manifest: ${[...outcomeRepos].filter((n) => !repos.some((r) => r.name === n)).join(', ')}`); process.exit(1); }
const qmap = new Map();
for (const q of ['heldout-questions.jsonl', 'heldout2-questions.jsonl'].flatMap((f) => readJsonl(path.join(DATA_DIR, f)))) qmap.set(`${q.repo}|${q.id}`, q);
const questions = [...qmap.values()].filter((q) => outcomeRepos.has(q.repo));

const git = (cwd, args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1', GIT_TERMINAL_PROMPT: '0' } });
const repoPath = (name) => path.join(DATA, 'benchmarks', 'repos', name);
fs.mkdirSync(path.join(DATA, 'benchmarks', 'tasks'), { recursive: true });
fs.mkdirSync(path.join(DATA, 'benchmarks', 'repos'), { recursive: true });
fs.writeFileSync(path.join(DATA, 'benchmarks', 'xrepo-repos.json'), JSON.stringify({ _comment: 'Stage I data root, built by setup-signal-eval.mjs from the recorded manifests', repos }, null, 2) + '\n');
fs.writeFileSync(path.join(DATA, 'benchmarks', 'tasks', 'retrieval-xrepo.jsonl'), questions.map((q) => JSON.stringify(q)).join('\n') + '\n');
if (FETCH) {
  for (const r of repos) {
    const dir = repoPath(r.name);
    if (fs.existsSync(path.join(dir, '.git')) && git(dir, ['rev-parse', 'HEAD']).stdout.trim() === r.commit) { console.error(`have ${r.name}`); continue; }
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    for (const a of [['init', '-q'], ['remote', 'add', 'origin', r.url], ['fetch', '-q', '--depth', '1', 'origin', r.commit], ['checkout', '-q', 'FETCH_HEAD']]) {
      const o = git(dir, a); if (o.status !== 0) { console.error(`${r.name}: git ${a[0]} failed: ${(o.stderr || '').trim().slice(0, 200)}`); process.exit(1); }
    }
    console.error(`cloned ${r.name} at ${r.commit.slice(0, 8)}`);
  }
}
for (const r of repos) if (!fs.existsSync(path.join(repoPath(r.name), '.git'))) { console.error(`${r.name} is not cloned under ${DATA}; run with --fetch`); process.exit(1); }

// ---- the features, offline ----------------------------------------------------------------------------------------------------------------
const { prepareArm } = await import(`${ROOT}/scripts/lib/agent-ab-arms.mjs`);
const { grepRank } = await import(`${ROOT}/scripts/lib/grep-baseline.mjs`);
const handlers = require(`${ROOT}/src/mcp/handlers.js`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-signal-'));
process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* best effort */ } });

const features = [];
for (const repo of repos) {
  const qs = questions.filter((q) => q.repo === repo.name);
  const { ranked, filesScanned } = grepRank(repoPath(repo.name), qs.map((q) => ({ id: q.id, query: q.query })));
  const arm = prepareArm({ root: DATA, repo, arm: 'with', tmpRoot: tmp, codeRoot: ROOT, variant: 'index' });
  let lead = 0, grep = 0;
  for (const q of qs) {
    const txt = String(handlers.queryContext({ query: q.query, topK: 10 }, arm.cwd));
    const got = [...txt.matchAll(/^\| (\d+) \| (\S+) \| ([\d.]+) \|/gm)].map((m) => m[2]);
    const r = got.findIndex((f) => q.expected_files.includes(f)) + 1;
    if (r >= 1 && r <= 5) lead++;
    const g = (ranked.get(q.id) || []).findIndex((f) => q.expected_files.includes(f)) + 1;
    if (g >= 1 && g <= 5) grep++;
  }
  fs.rmSync(arm.cwd, { recursive: true, force: true });
  const n = qs.length;
  features.push({ repo: repo.name, language: repo.language, n, lead5: lead / n, grep5: grep / n, headroom: (lead - grep) / n, files: filesScanned });
  console.error(`${repo.name}: lead5 ${lead}/${n}, grep5 ${grep}/${n}`);
}

// ---- the test --------------------------------------------------------------------------------------------------------------------------------
function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; }
  return r;
}
function pearson(x, y) {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx === 0 || syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy);
}
const spearman = (x, y) => pearson(ranks(x), ranks(y));
function rhoWithCi(x, y) {
  const rho = spearman(x, y); const rng = makeRng(SEED); const n = x.length; const draws = [];
  for (let b = 0; b < BOOT; b++) {
    const xs = new Array(n), ys = new Array(n);
    for (let i = 0; i < n; i++) { const k = Math.floor(rng() * n); xs[i] = x[k]; ys[i] = y[k]; }
    const d = spearman(xs, ys); if (!Number.isNaN(d)) draws.push(d);
  }
  draws.sort((a, b) => a - b);
  return { rho, lo: draws[Math.floor(0.025 * draws.length)], hi: draws[Math.min(draws.length - 1, Math.ceil(0.975 * draws.length) - 1)], used: draws.length };
}

const FEATS = ['headroom', 'lead5', 'grep5', 'files'];
const corr = {}; // feature -> setup -> metric -> { rho, lo, hi }
for (const f of FEATS) for (const s of SETUPS) for (const m of Object.keys(METRICS)) {
  const xs = features.map((r) => r[f]); const ys = features.map((r) => Math.log(1 + outcome[s][m][r.repo].change));
  ((corr[f] = corr[f] || {})[s] = corr[f][s] || {})[m] = rhoWithCi(xs, ys);
}
const P = corr.headroom.prefetch.cost;
const passes = P.rho <= BAR.rho && P.hi < 0;

const result = { repositories: features.length, questions: questions.length, features, outcome, primary: { feature: 'headroom', setup: 'prefetch', measure: 'cost', ...P, bar: `rho <= ${BAR.rho} and the 95% interval entirely below zero`, passes }, correlations: corr };
if (AS_JSON) { console.log(JSON.stringify(result, null, 1)); process.exit(0); }

const pc = (v) => (v === null || v === undefined ? ' n/a' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`);
const f2 = (v) => (Number.isNaN(v) ? ' n/a' : v.toFixed(2));
console.log(`Stage I: ${features.length} repositories, ${questions.length} questions, outcome ${ROUTE} · ${MODEL} · ${SET}\n`);
console.log('| repository | language | n | lead5 | grep5 | headroom | files | cost index | cost prefetch | cost locate | time prefetch | tokens prefetch |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of features) {
  const o = (s, m) => `${pc(outcome[s][m][r.repo].change)}${outcome[s][m][r.repo].cls === 'saves' ? ' S' : outcome[s][m][r.repo].cls === 'costs' ? ' C' : ''}`;
  console.log(`| ${r.repo} | ${r.language} | ${r.n} | ${Math.round(r.lead5 * 100)}% | ${Math.round(r.grep5 * 100)}% | ${Math.round(r.headroom * 100)}% | ${r.files} | ${o('index', 'cost')} | ${o('prefetch', 'cost')} | ${o('locate', 'cost')} | ${o('prefetch', 'time')} | ${o('prefetch', 'tokens')} |`);
}
console.log('\n(S = the setup saves on that repository, C = it costs more, by the 95% interval; a blank is no clear change)\n');
console.log(`PRIMARY (the only test with a bar): Spearman rho between headroom and the change in real cost of prefetch, n = ${features.length}:`);
console.log(`  rho ${f2(P.rho)}  95% interval [${f2(P.lo)}, ${f2(P.hi)}]  (${P.used} of ${BOOT} resamples usable)`);
console.log(`  bar: rho <= ${BAR.rho} and the interval entirely below zero  ->  ${passes ? 'PASSES' : 'DOES NOT PASS'}\n`);
console.log('Secondary, reported with no bar (rho [95% interval]; a negative rho means a bigger saving as the feature grows):\n');
console.log('| feature | measure | index | prefetch | locate |');
console.log('|---|---|---:|---:|---:|');
for (const f of FEATS) for (const m of Object.keys(METRICS)) {
  const c = (s) => { const v = corr[f][s][m]; return `${f2(v.rho)} [${f2(v.lo)}, ${f2(v.hi)}]`; };
  console.log(`| ${f}${f === 'headroom' && m === 'cost' ? ' (primary row: prefetch)' : ''} | ${m} | ${c('index')} | ${c('prefetch')} | ${c('locate')} |`);
}
console.log(`\nWhat follows (decided before the run): ${passes ? 'sigmap advise may say "likely to save" or "uncertain" for the hook, from a headroom cut chosen by leave-one-out, and must print the cut, the evidence and how often it was wrong.' : 'sigmap advise prints the facts and makes no call, and says that no offline signal predicted the saving on these repositories.'}`);
