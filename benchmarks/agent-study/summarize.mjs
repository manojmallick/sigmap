#!/usr/bin/env node
// Every number in the study, from one table. Offline, no key.
//
//   node benchmarks/agent-study/summarize.mjs                                  # one row per run series: change against its own baseline
//   node benchmarks/agent-study/summarize.mjs --model claude-sonnet-5-5 --set unfamiliar
//   node benchmarks/agent-study/summarize.mjs --route api --variant prefetch
//   node benchmarks/agent-study/summarize.mjs --exclude-repos django,rails     # a sensitivity cut
//   node benchmarks/agent-study/summarize.mjs --set change --tasks c04,c05,c06,c09   # only these questions or tasks
//   node benchmarks/agent-study/summarize.mjs --study                          # the stet.sh study's columns: repetition 1 / repetition 2
//   node benchmarks/agent-study/summarize.mjs --runs path/to/runs.ndjson       # your own runs (same columns)
//
// data/runs.ndjson has one row per agent run (see README.md for the fields). A series is one invocation of the harness: one route
// (Claude Code or the Messages API), model, question set and SigMap setup, with both arms. Arms are paired by (repo, question,
// repetition); a pair with a failed run is dropped and counted, but a run stopped by the turn cap is a scored miss at the cost it incurred.
// "typical task" = the geometric mean of the per-pair ratios, with its 95% paired bootstrap interval (scripts/lib/agent-ab-stats.mjs,
// the stet.sh study's estimators); "whole batch" = total of one arm over total of the other. "~" = the interval includes zero.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { geometricChange, workloadChange } from '../../scripts/lib/agent-ab-stats.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const val = (name, dflt = null) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const file = val('--runs', path.join(here, 'data', 'runs.ndjson'));
const want = { route: val('--route'), model: val('--model'), set: val('--set'), variant: val('--variant'), series: val('--series') };
const dropRepos = new Set((val('--exclude-repos', '') || '').split(',').filter(Boolean));
const onlyTasks = new Set((val('--tasks', '') || '').split(',').filter(Boolean));
const STUDY = argv.includes('--study');

const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .filter((r) => Object.entries(want).every(([k, v]) => !v || r[k] === v) && !dropRepos.has(r.repo) && (!onlyTasks.size || onlyTasks.has(r.task)));

const tot = (r) => r.in + r.out + r.cacheRead + r.cacheWrite;
const pct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const cell = (g) => `${pct(g.change)} [${pct(g.lo)}, ${pct(g.hi)}]${g.inNoise ? ' ~' : ''}`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const key = (r) => `${r.repo}/${r.task}|${r.run}`;

/** Group rows into series (keeping the order they appear in) and pair the arms inside each. */
function series() {
  const by = new Map();
  for (const r of rows) { if (!by.has(r.series)) by.set(r.series, []); by.get(r.series).push(r); }
  const out = [];
  for (const [name, rs] of by) {
    const bad = new Set(rs.filter((r) => !r.ok).map(key));
    const ok = rs.filter((r) => !bad.has(key(r)));
    const m = new Map(ok.map((r) => [`${key(r)}|${r.arm}`, r]));
    const keys = [...new Set(ok.map(key))].filter((k) => m.has(`${k}|with`) && m.has(`${k}|without`));
    if (!keys.length) continue;
    const head = rs[0];
    out.push({ name, head, dropped: bad.size, keys, m, withRuns: keys.map((k) => m.get(`${k}|with`)), baseRuns: keys.map((k) => m.get(`${k}|without`)) });
  }
  return out;
}

const metrics = { cost: (r) => r.usd, tokens: tot, calls: (r) => r.calls, seconds: (r) => r.ms / 1000 };
const pairsOf = (s, fn, rep) => s.keys.filter((k) => !rep || k.endsWith(`|${rep}`)).map((k) => ({ without: fn(s.m.get(`${k}|without`)), with: fn(s.m.get(`${k}|with`)) }));
const label = (s) => `${s.head.route === 'api' ? 'Messages API' : 'Claude Code'} · ${s.head.model} · ${s.head.set}`;

const all = series();
if (!all.length) { console.log('no runs match'); process.exit(0); }

if (STUDY) {
  console.log('| run | what | tokens, whole batch R1 / R2 | tokens, typical task R1 / R2 | cost, whole batch R1 / R2 | cost, typical task R1 / R2 | cases with fewer tokens | saved tokens both times? |');
  console.log('|---|---|---:|---:|---:|---:|---:|---|');
  for (const s of all) {
    const two = (fn, how) => [1, 2].map((r) => { const ps = pairsOf(s, fn, r); return how === 'whole' ? workloadChange(ps).change : geometricChange(ps).change; });
    const f = (xs) => xs.map(pct).join(' / ');
    const tw = two(tot, 'whole'); const tt = two(tot, 'typical'); const cw = two(metrics.cost, 'whole'); const ct = two(metrics.cost, 'typical');
    const p = pairsOf(s, tot);
    console.log(`| ${label(s)} | \`${s.head.variant}\`, ${s.name} | ${f(tw)} | ${f(tt)} | ${f(cw)} | ${f(ct)} | ${p.filter((x) => x.with < x.without).length} of ${p.length} | ${[...tw, ...tt].every((v) => v < 0) ? 'yes' : 'no'} |`);
  }
  process.exit(0);
}

console.log('| run | SigMap setup | pairs | real cost | total tokens | tool calls | seconds | file found, or tests passed (baseline) | baseline a run |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---|');
for (const s of all) {
  const g = Object.fromEntries(Object.entries(metrics).map(([k, fn]) => [k, geometricChange(pairsOf(s, fn))]));
  const hit = (xs) => xs.filter((r) => r.pass).length;
  const caps = [...s.withRuns, ...s.baseRuns].filter((r) => r.limit).length;
  console.log(`| ${label(s)} | \`${s.head.variant}\` (${s.name}) | ${s.keys.length}${s.dropped ? ` (${s.dropped} dropped)` : ''} | **${cell(g.cost)}** | ${cell(g.tokens)} | ${cell(g.calls)} | ${cell(g.seconds)} | ${hit(s.withRuns)}/${s.withRuns.length} (${hit(s.baseRuns)}/${s.baseRuns.length})${s.head.set === 'change' ? ' tests' : ''}${caps ? ` · ${caps} hit a cap` : ''} | ${mean(s.baseRuns.map((r) => r.calls)).toFixed(1)} calls, $${mean(s.baseRuns.map((r) => r.usd)).toFixed(4)} |`);
}
const usd = rows.reduce((a, r) => a + (r.usd || 0), 0);
console.log(`\n${rows.length} runs, ${usd.toFixed(2)} USD by the agent's own count (Claude Code) or computed from usage x a price table (Messages API)${dropRepos.size ? `; repos left out: ${[...dropRepos].join(', ')}` : ''}`);
