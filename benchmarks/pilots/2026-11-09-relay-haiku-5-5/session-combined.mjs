#!/usr/bin/env node
// Re-derives the session-auth result (real Claude Haiku 5.5 on the logged-in session, SigMap `index` variant against no SigMap)
// from the saved raw records. Offline, no key.
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/session-combined.mjs
//
// Reads session-auth/index-first5/*/raw.json and session-auth/index-rest/*/raw.json: the 30 labelled questions of gin, flask,
// express, fastify and fastapi, 2 repetitions, SigMap and baseline in the same invocation. Prints, for real cost, total tokens,
// tool calls and seconds: the per-repetition workload total and typical task (with the bootstrap interval), the pooled estimate
// over all 60 pairs, the cases where SigMap was cheaper, a per-repo view, the noise, whether the file was found, and how the
// agent used SigMap's tools.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { workloadChange, geometricChange } from '../../../scripts/lib/agent-ab-stats.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const load = (sub) => fs.readdirSync(path.join(here, 'session-auth', sub), { withFileTypes: true })
  .filter((e) => e.isDirectory()).sort((a, b) => (a.name < b.name ? -1 : 1))
  .flatMap((e) => require(path.join(here, 'session-auth', sub, e.name, 'raw.json')));
const raw = [...load('index-first5'), ...load('index-rest')];

const tot = (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite;
const cost = (x) => x.cost.usd;
const calls = (x) => x.toolCalls.total;
const secs = (x) => x.durationMs / 1000;
const q = (x) => `${x.repo}/${x.task}`;
const qs = [...new Set(raw.map(q))];
const find = (k, r, a) => raw.find((x) => q(x) === k && x.run === r && x.arm === a);
const pct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const pairs = (fn, set) => set.flatMap((k) => [1, 2].map((r) => ({ q: k, r, without: fn(find(k, r, 'without')), with: fn(find(k, r, 'with')) })));

console.log(`runs ${raw.length}, failed ${raw.filter((x) => !x.ok).length}, questions ${qs.length}; cost source: ${[...new Set(raw.map((x) => x.cost.source))].join(', ')}`);
const found = (a) => `${raw.filter((x) => x.arm === a && x.pass).length}/${raw.filter((x) => x.arm === a).length}`;
let better = 0; let worse = 0;
for (const k of qs) {
  for (const r of [1, 2]) {
    const w = find(k, r, 'with').pass; const b = find(k, r, 'without').pass;
    if (w && !b) better++; else if (b && !w) worse++;
  }
}
console.log(`found the file: SigMap ${found('with')}, baseline ${found('without')}; paired better/worse: ${better}/${worse}`);

for (const [label, fn] of [['REAL COST (USD)', cost], ['total tokens', tot], ['tool calls', calls], ['seconds', secs]]) {
  console.log(`\n${label}`);
  for (const r of [1, 2]) {
    const ps = pairs(fn, qs).filter((p) => p.r === r);
    const g = geometricChange(ps);
    console.log(`  R${r}: workload ${pct(workloadChange(ps).change).padStart(5)}, typical ${pct(g.change).padStart(5)} [${pct(g.lo)}, ${pct(g.hi)}] ${g.inNoise ? 'inside the noise' : 'OUTSIDE the noise'}`);
  }
  const all = pairs(fn, qs);
  const g = geometricChange(all);
  const cheaper = all.filter((p) => p.with < p.without).length;
  const dearer = all.filter((p) => p.with > p.without).length;
  console.log(`  both repetitions pooled (${all.length} pairs): workload ${pct(workloadChange(all).change)}, typical ${pct(g.change)} [${pct(g.lo)}, ${pct(g.hi)}] ${g.inNoise ? 'inside the noise' : 'OUTSIDE the noise'}; SigMap lower in ${cheaper}, higher in ${dearer}, equal in ${all.length - cheaper - dearer}`);
}

console.log('\nREAL COST by repo, pooled over its questions and both repetitions (workload / typical)');
for (const repo of [...new Set(raw.map((x) => x.repo))]) {
  const ks = qs.filter((k) => k.startsWith(`${repo}/`));
  const ps = pairs(cost, ks);
  const g = geometricChange(ps);
  console.log(`  ${repo.padEnd(8)} ${String(ks.length).padStart(2)} questions  ${pct(workloadChange(ps).change).padStart(5)} / ${pct(g.change).padStart(5)} [${pct(g.lo)}, ${pct(g.hi)}]`);
}

const lr = pairs(cost, qs).map((p) => Math.log(p.with / p.without));
const mean = lr.reduce((a, b) => a + b) / lr.length;
const sd = Math.sqrt(lr.reduce((s, x) => s + (x - mean) ** 2, 0) / (lr.length - 1));
console.log(`\nnoise (real cost): sd of the paired log-ratio ${sd.toFixed(2)} (one pair typically off by a factor of ${Math.exp(sd).toFixed(1)}); paired runs for a 95% interval of about ±10%: ${Math.ceil((1.96 * sd / Math.log(1.1)) ** 2)}, of about ±5%: ${Math.ceil((1.96 * sd / Math.log(1.05)) ** 2)}`);
const swing = qs.map((k) => { const a = cost(find(k, 1, 'without')); const b = cost(find(k, 2, 'without')); return Math.max(a, b) / Math.min(a, b); }).sort((a, b) => a - b);
console.log(`baseline cost, same question, repetition 1 against 2 (larger over smaller): median ${swing[Math.floor(swing.length / 2)].toFixed(2)}x, worst ${swing[swing.length - 1].toFixed(2)}x`);

const m = (a, f) => { const xs = raw.filter((x) => x.arm === a); return xs.reduce((s, x) => s + f(x), 0) / xs.length; };
console.log(`\nmean per run: tool calls SigMap ${m('with', calls).toFixed(1)} / baseline ${m('without', calls).toFixed(1)}; seconds ${m('with', secs).toFixed(1)} / ${m('without', secs).toFixed(1)}; cost $${m('with', cost).toFixed(4)} / $${m('without', cost).toFixed(4)}; tokens ${Math.round(m('with', tot) / 1000)}k / ${Math.round(m('without', tot) / 1000)}k`);
const tally = (arm, rename) => {
  const o = {};
  for (const x of raw.filter((y) => y.arm === arm)) for (const [t, n] of Object.entries(x.toolCalls.byTool || {})) o[rename(t)] = (o[rename(t)] || 0) + n;
  return o;
};
const used = raw.filter((x) => x.arm === 'with' && Object.keys(x.toolCalls.byTool || {}).some((t) => /query_context|read_context/.test(t))).length;
console.log(`SigMap arm tool use over ${raw.filter((x) => x.arm === 'with').length} runs: ${JSON.stringify(tally('with', (t) => t.replace('mcp__sigmap__', 'sigmap:')))}; runs that asked SigMap to retrieve (query_context or read_context): ${used}`);
console.log(`baseline tool use over ${raw.filter((x) => x.arm === 'without').length} runs: ${JSON.stringify(tally('without', (t) => t))}`);
console.log(`total real cost of these ${raw.length} runs: $${raw.reduce((s, x) => s + cost(x), 0).toFixed(3)}`);
