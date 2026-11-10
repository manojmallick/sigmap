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
// agent used SigMap's tools. If session-auth/lean/ exists it also reports the `lean` variant over the same questions and sets it
// against `index`, each against its own same-invocation baseline and the two directly.
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

// A failed run (a timeout, say) has unknown usage and cost: that question × repetition, both arms, is left out of every comparison,
// and the note says which. The harness already records the failure; this only keeps the comparisons to complete pairs.
function complete(set, label) {
  const key = (x) => `${x.repo}/${x.task}|${x.run}`;
  const bad = new Set(set.filter((x) => !x.ok).map(key));
  if (bad.size) console.log(`note: ${label}: ${set.filter((x) => !x.ok).length} failed run(s) (${[...bad].join(', ')}); that question × repetition is left out of every comparison below`);
  return set.filter((x) => !bad.has(key(x)));
}

function analyse(label, raw) {
console.log(`\n==================== ${label} ====================`);
const tot = (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite;
const cost = (x) => x.cost.usd;
const calls = (x) => x.toolCalls.total;
const secs = (x) => x.durationMs / 1000;
const q = (x) => `${x.repo}/${x.task}`;
const qs = [...new Set(raw.map(q))];
const find = (k, r, a) => raw.find((x) => q(x) === k && x.run === r && x.arm === a);
const pct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const pairs = (fn, set) => set.flatMap((k) => [1, 2].filter((r) => find(k, r, 'with') && find(k, r, 'without')).map((r) => ({ q: k, r, without: fn(find(k, r, 'without')), with: fn(find(k, r, 'with')) })));

console.log(`runs ${raw.length}, failed ${raw.filter((x) => !x.ok).length}, questions ${qs.length}; cost source: ${[...new Set(raw.map((x) => x.cost.source))].join(', ')}`);
const found = (a) => `${raw.filter((x) => x.arm === a && x.pass).length}/${raw.filter((x) => x.arm === a).length}`;
let better = 0; let worse = 0;
for (const k of qs) {
  for (const r of [1, 2]) {
    const wr = find(k, r, 'with'); const br = find(k, r, 'without');
    if (!wr || !br) continue;
    if (wr.pass && !br.pass) better++; else if (br.pass && !wr.pass) worse++;
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
const swing = qs.filter((k) => find(k, 1, 'without') && find(k, 2, 'without')).map((k) => { const a = cost(find(k, 1, 'without')); const b = cost(find(k, 2, 'without')); return Math.max(a, b) / Math.min(a, b); }).sort((a, b) => a - b);
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
}

const small = complete([...load('index-first5'), ...load('index-rest')], 'index, small repos');
const large = fs.existsSync(path.join(here, 'session-auth', 'index-large')) ? complete(load('index-large'), 'index, large repos') : [];
analyse('30 questions on small and medium repos (gin, flask, express, fastify, fastapi)', small);
if (large.length) {
  analyse('15 questions on large repos (django, rails, laravel)', large);
  analyse('all 45 questions', [...small, ...large]);
}

// `lean` over the same 45 questions, and against `index`.
function headToHead(index, lean) {
  console.log('\n==================== lean against index, same questions and repetitions ====================');
  const key = (x) => `${x.repo}/${x.task}|${x.run}`;
  const mapOf = (set, arm) => new Map(set.filter((x) => x.arm === arm).map((x) => [key(x), x]));
  const iw = mapOf(index, 'with'); const ib = mapOf(index, 'without'); const lw = mapOf(lean, 'with'); const lb = mapOf(lean, 'without');
  const keys = [...iw.keys()].filter((k) => lw.has(k) && ib.has(k) && lb.has(k));
  const metrics = [['real cost', (x) => x.cost.usd], ['total tokens', (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite], ['tool calls', (x) => x.toolCalls.total], ['seconds', (x) => x.durationMs / 1000]];
  const p = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
  console.log(`${keys.length} paired cases (question × repetition)`);
  for (const [label, fn] of metrics) {
    const gi = geometricChange(keys.map((k) => ({ without: fn(ib.get(k)), with: fn(iw.get(k)) })));
    const gl = geometricChange(keys.map((k) => ({ without: fn(lb.get(k)), with: fn(lw.get(k)) })));
    const gd = geometricChange(keys.map((k) => ({ without: fn(iw.get(k)), with: fn(lw.get(k)) })));
    console.log(`  ${label.padEnd(13)} index vs its baseline ${p(gi.change)} [${p(gi.lo)}, ${p(gi.hi)}]; lean vs its baseline ${p(gl.change)} [${p(gl.lo)}, ${p(gl.hi)}]; lean against index directly ${p(gd.change)} [${p(gd.lo)}, ${p(gd.hi)}] ${gd.inNoise ? 'inside the noise' : 'OUTSIDE the noise'}`);
  }
}
const leanRuns = fs.existsSync(path.join(here, 'session-auth', 'lean')) ? complete(load('lean'), 'lean') : [];
if (leanRuns.length) {
  analyse('lean: all 45 questions', leanRuns);
  headToHead([...small, ...large], leanRuns);
}

// The three variants side by side, once `current` has been run too: each against its own same-invocation baseline, and against `index`.
function threeWay(sets) {
  console.log('\n==================== index, lean and current side by side (45 questions, 2 repetitions) ====================');
  const key = (x) => `${x.repo}/${x.task}|${x.run}`;
  const mapOf = (set, arm) => new Map(set.filter((x) => x.arm === arm).map((x) => [key(x), x]));
  const m = Object.fromEntries(Object.entries(sets).map(([n, set]) => [n, { w: mapOf(set, 'with'), b: mapOf(set, 'without'), all: set }]));
  const keys = [...m.index.w.keys()].filter((k) => Object.values(m).every((v) => v.w.has(k) && v.b.has(k)));
  const p = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
  const metrics = [['real cost', (x) => x.cost.usd], ['total tokens', (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite], ['tool calls', (x) => x.toolCalls.total], ['seconds', (x) => x.durationMs / 1000]];
  console.log(`${keys.length} paired cases per variant. Each column: SigMap arm against ITS OWN baseline from the same invocation, typical task with the 95% interval.`);
  console.log(`${''.padEnd(13)}${Object.keys(m).map((n) => n.padEnd(26)).join('')}`);
  for (const [label, fn] of metrics) {
    const cells = Object.entries(m).map(([, v]) => { const g = geometricChange(keys.map((k) => ({ without: fn(v.b.get(k)), with: fn(v.w.get(k)) }))); return `${p(g.change)} [${p(g.lo)}, ${p(g.hi)}]${g.inNoise ? ' ~' : ''}`.padEnd(26); });
    console.log(`${label.padEnd(13)}${cells.join('')}`);
  }
  console.log('(~ = the interval includes zero: inside the noise)');
  for (const [a, b] of [['lean', 'index'], ['current', 'index']]) {
    const parts = metrics.map(([label, fn]) => { const g = geometricChange(keys.map((k) => ({ without: fn(m[b].w.get(k)), with: fn(m[a].w.get(k)) }))); return `${label} ${p(g.change)} [${p(g.lo)}, ${p(g.hi)}]`; });
    console.log(`${a} against ${b} directly: ${parts.join('; ')}`);
  }
  for (const [n, v] of Object.entries(m)) {
    const w = v.all.filter((x) => x.arm === 'with');
    const ret = w.filter((x) => Object.keys(x.toolCalls.byTool || {}).some((t) => /query_context|read_context/.test(t))).length;
    const fnd = `${w.filter((x) => x.pass).length}/${w.length}`;
    const cheaper = keys.filter((k) => v.w.get(k).cost.usd < v.b.get(k).cost.usd).length;
    console.log(`${n.padEnd(8)} found ${fnd}; asked SigMap to retrieve in ${ret} of ${w.length} runs; cheaper than its baseline in ${cheaper} of ${keys.length} pairs`);
  }
}
const currentRuns = fs.existsSync(path.join(here, 'session-auth', 'current')) ? complete(load('current'), 'current') : [];
if (currentRuns.length) {
  analyse('current (the old default): all 45 questions', currentRuns);
  threeWay({ index: [...small, ...large], lean: leanRuns, current: currentRuns });
}

// The result in the stet.sh study's own format, over the cases every setup completed, so the rows rest on identical questions.
function studyFormat(sets) {
  console.log('\n==================== in the stet.sh study\'s format ====================');
  const key = (x) => `${x.repo}/${x.task}|${x.run}`;
  const maps = Object.fromEntries(Object.entries(sets).map(([n, set]) => [n, { w: new Map(set.filter((x) => x.arm === 'with').map((x) => [key(x), x])), b: new Map(set.filter((x) => x.arm === 'without').map((x) => [key(x), x])) }]));
  const keys = [...maps.index.w.keys()].filter((k) => Object.values(maps).every((v) => v.w.has(k) && v.b.has(k)));
  const p = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))}%`;
  const tokens = (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite;
  const dollars = (x) => x.cost.usd;
  console.log(`${keys.length} paired cases (question × repetition); change = SigMap arm against its own baseline, negative = SigMap used less`);
  console.log('setup     tokens workload R1/R2   tokens typical R1/R2   cost workload R1/R2   cost typical R1/R2   fewer tokens   fewer cost   saved tokens in both?');
  for (const [name, v] of Object.entries(maps)) {
    const cell = (fn, kind) => [1, 2].map((r) => {
      const ps = keys.filter((k) => k.endsWith(`|${r}`)).map((k) => ({ without: fn(v.b.get(k)), with: fn(v.w.get(k)) }));
      return p(kind === 'workload' ? workloadChange(ps).change : geometricChange(ps).change);
    }).join(' / ');
    const wl = [1, 2].map((r) => workloadChange(keys.filter((k) => k.endsWith(`|${r}`)).map((k) => ({ without: tokens(v.b.get(k)), with: tokens(v.w.get(k)) }))).change);
    const fewerT = keys.filter((k) => tokens(v.w.get(k)) < tokens(v.b.get(k))).length;
    const fewerC = keys.filter((k) => dollars(v.w.get(k)) < dollars(v.b.get(k))).length;
    console.log(`${name.padEnd(9)} ${cell(tokens, 'workload').padEnd(23)} ${cell(tokens, 'typical').padEnd(22)} ${cell(dollars, 'workload').padEnd(21)} ${cell(dollars, 'typical').padEnd(20)} ${`${fewerT} of ${keys.length}`.padEnd(14)} ${`${fewerC} of ${keys.length}`.padEnd(12)} ${wl.every((x) => x < 0) ? 'yes' : 'no'}`);
  }
}
if (currentRuns.length) studyFormat({ index: [...small, ...large], lean: leanRuns, current: currentRuns });
