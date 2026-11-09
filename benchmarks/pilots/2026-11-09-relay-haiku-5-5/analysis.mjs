#!/usr/bin/env node
// Re-derives the pilot's diagnostic numbers from full-40runs/raw.json. Offline.
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/analysis.mjs
//
//   1. How much of SigMap's extra tokens is a fixed cost per question and how much is extra tool calls
//      (least squares: extra tokens = fixed + per_call × extra calls, over the 20 paired cases).
//   2. The same comparison with tokens weighted the way Anthropic prices them (input 1, output 5, cache read 0.1,
//      cache write 1.25). The relay reported no cache writes and served a small share of input from cache, so the
//      unweighted totals probably overstate what the real API would bill. An estimate, not a bill.
//   3. How the SigMap arm used its tools.
//   4. A MODELLED estimate of the lean variant on these 40 runs: subtract, from every SigMap run, the static prompt the
//      lean arm no longer re-sends on each turn. It assumes the agent behaves exactly as it did (same calls), so it is
//      arithmetic and not a measurement; the one question where lean was measured (lean-gin-4runs) came out better
//      than the model says, but that is one case.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { workloadChange, geometricChange } from '../../../scripts/lib/agent-ab-stats.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const raw = require(path.join(here, 'full-40runs', 'raw.json'));

const key = (x) => `${x.repo}/${x.task} R${x.run}`;
const by = {};
for (const x of raw) (by[key(x)] = by[key(x)] || {})[x.arm] = x;
const pairs = Object.values(by);
const total = (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite;
const priced = (x) => x.usage.in + 5 * x.usage.out + 0.1 * x.usage.cacheRead + 1.25 * x.usage.cacheWrite;
const pct = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;

const xs = pairs.map((p) => p.with.toolCalls.total - p.without.toolCalls.total);
const ys = pairs.map((p) => total(p.with) - total(p.without));
const n = xs.length;
const mx = xs.reduce((a, b) => a + b) / n;
const my = ys.reduce((a, b) => a + b) / n;
const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
const fixed = my - slope * mx;
const ssRes = ys.reduce((s, y, i) => s + (y - (fixed + slope * xs[i])) ** 2, 0);
const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
console.log(`1. extra tokens ≈ ${Math.round(fixed / 1000)}k fixed + ${Math.round(slope / 1000)}k per extra tool call (R² ${(1 - ssRes / ssTot).toFixed(2)}, n=${n})`);

for (const run of [1, 2]) {
  const ps = pairs.filter((p) => p.with.run === run);
  const w = ps.reduce((s, p) => s + priced(p.with), 0) / ps.reduce((s, p) => s + priced(p.without), 0) - 1;
  const logs = ps.map((p) => Math.log(priced(p.with) / priced(p.without)));
  console.log(`2. Anthropic-style weights, repetition ${run}: workload ${pct(w)}, typical task ${pct(Math.exp(logs.reduce((a, b) => a + b) / logs.length) - 1)}`);
}
for (const arm of ['without', 'with']) {
  const xs2 = raw.filter((x) => x.arm === arm);
  const i = xs2.reduce((s, x) => s + x.usage.in, 0);
  const c = xs2.reduce((s, x) => s + x.usage.cacheRead, 0);
  console.log(`   ${arm.padEnd(8)} input served from cache: ${(c / (i + c) * 100).toFixed(0)}%; cache-write tokens reported: ${xs2.reduce((s, x) => s + x.usage.cacheWrite, 0)}`);
}

const withs = raw.filter((x) => x.arm === 'with');
const per = (tool) => (withs.reduce((s, x) => s + ((x.toolCalls.byTool || {})[`mcp__sigmap__${tool}`] || 0), 0) / withs.length).toFixed(1);
console.log(`3. SigMap runs calling query_context at all: ${withs.filter((x) => (x.toolCalls.byTool || {}).mcp__sigmap__query_context).length} of ${withs.length}; per run: get_lines ${per('get_lines')}, search_signatures ${per('search_signatures')}, query_context ${per('query_context')}; ${(withs.reduce((s, x) => s + x.toolCalls.total, 0) / withs.length).toFixed(1)} tool calls in all`);

// 4. Modelled lean: current arm minus the static tokens per turn that lean drops (arm-audit.mjs: 22 tool definitions plus the
//    generated section, about 4315 tokens; the 7-tool profile plus the three-line section, about 1028). Not a measurement.
const TAX = 4315 - 1028;
const leanTokens = (x) => Math.max(total(x) - TAX * (x.toolCalls.total + 1), 0.2 * total(x));
for (const run of [1, 2]) {
  const ps = pairs.filter((p) => p.with.run === run);
  const cur = ps.map((p) => ({ without: total(p.without), with: total(p.with) }));
  const prj = ps.map((p) => ({ without: total(p.without), with: leanTokens(p.with) }));
  const show = (label, a) => {
    const g = geometricChange(a);
    console.log(`4. ${label} repetition ${run}: workload ${pct(workloadChange(a).change)}, typical task ${pct(g.change)} [${pct(g.lo)}, ${pct(g.hi)}]`);
  };
  show('measured current ', cur);
  show('MODELLED lean    ', prj);
}
