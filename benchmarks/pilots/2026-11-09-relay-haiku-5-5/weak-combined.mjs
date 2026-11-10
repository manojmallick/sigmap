#!/usr/bin/env node
// The weaker-model result (Claude Haiku 4.5 on the logged-in session): SigMap `index`, `lean` and `current` each against its own
// same-invocation baseline, over the same sample of questions. Offline, no key.
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/weak-combined.mjs
//
// Reads session-auth/weak/<variant>/<batch>/raw.json. The sample is the harness's own rule, fixed before any result: the first two
// question ids of each of the 8 repos (16 questions), 2 repetitions. Prints, for real cost, total tokens, tool calls and seconds, the
// typical-task change with its 95% bootstrap interval per repetition and pooled, whether the file was found, how the agent used
// SigMap, and the turn arithmetic (what the baseline's turns cost and how many SigMap would have to remove to break even).
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { workloadChange, geometricChange } from '../../../scripts/lib/agent-ab-stats.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, 'session-auth', 'weak');
const key = (x) => `${x.repo}/${x.task}|${x.run}`;
function loadVariant(v) {
  const dir = path.join(root, v);
  if (!fs.existsSync(dir)) return [];
  const raw = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).flatMap((e) => require(path.join(dir, e.name, 'raw.json')));
  const bad = new Set(raw.filter((x) => !x.ok).map(key));
  if (bad.size) console.log(`note: ${v}: ${raw.filter((x) => !x.ok).length} failed run(s) (${[...bad].join(', ')}); that question × repetition is left out of every comparison`);
  return raw.filter((x) => !bad.has(key(x)));
}
const sets = Object.fromEntries(['index', 'lean', 'current'].map((v) => [v, loadVariant(v)]).filter(([, s]) => s.length));
if (!Object.keys(sets).length) { console.log('no weaker-model data saved yet (session-auth/weak/)'); process.exit(0); }

const tot = (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite;
const metrics = [['real cost', (x) => x.cost.usd], ['total tokens', tot], ['tool calls', (x) => x.toolCalls.total], ['seconds', (x) => x.durationMs / 1000]];
const pct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const turns = (x) => x.toolCalls.total + 1;

for (const [name, raw] of Object.entries(sets)) {
  const by = (r) => new Map(raw.filter((x) => x.run === r).map((x) => [`${x.repo}/${x.task}|${x.arm}`, x]));
  const qs = [...new Set(raw.map((x) => `${x.repo}/${x.task}`))];
  const pairs = (fn, r) => qs.filter((q) => by(r).has(`${q}|with`) && by(r).has(`${q}|without`)).map((q) => ({ without: fn(by(r).get(`${q}|without`)), with: fn(by(r).get(`${q}|with`)) }));
  const w = raw.filter((x) => x.arm === 'with'); const b = raw.filter((x) => x.arm === 'without');
  console.log(`\n==================== ${name}: ${qs.length} questions, ${raw.length} runs (Haiku 4.5) ====================`);
  console.log(`found the file: SigMap ${w.filter((x) => x.pass).length}/${w.length}, baseline ${b.filter((x) => x.pass).length}/${b.length}`);
  for (const [label, fn] of metrics) {
    const cells = [1, 2].map((r) => { const ps = pairs(fn, r); const g = geometricChange(ps); return `R${r}: whole ${pct(workloadChange(ps).change)}, typical ${pct(g.change)} [${pct(g.lo)}, ${pct(g.hi)}]${g.inNoise ? ' ~' : ''}`; });
    const all = [1, 2].flatMap((r) => pairs(fn, r)); const g = geometricChange(all);
    const lower = all.filter((p) => p.with < p.without).length;
    console.log(`  ${label.padEnd(13)} ${cells.join('   ')}   pooled(${all.length}): ${pct(g.change)} [${pct(g.lo)}, ${pct(g.hi)}]${g.inNoise ? ' ~' : ''}, SigMap lower in ${lower}`);
  }
  console.log('  (~ = the interval includes zero)');
  const tb = mean(b.map(turns)); const tw = mean(w.map(turns));
  console.log(`  baseline: ${mean(b.map((x) => x.toolCalls.total)).toFixed(1)} calls, ${(mean(b.map((x) => x.durationMs)) / 1000).toFixed(0)} s, ${Math.round(mean(b.map(tot)) / 1000)}k tokens, $${mean(b.map((x) => x.cost.usd)).toFixed(3)} a run; SigMap: ${mean(w.map((x) => x.toolCalls.total)).toFixed(1)} calls, ${(mean(w.map((x) => x.durationMs)) / 1000).toFixed(0)} s, ${Math.round(mean(w.map(tot)) / 1000)}k tokens, $${mean(w.map((x) => x.cost.usd)).toFixed(3)} a run`);
  console.log(`  turns: baseline ${tb.toFixed(1)}, SigMap ${tw.toFixed(1)} (${pct(tw / tb - 1)}); tokens per turn: baseline ${(mean(b.map(tot)) / tb / 1000).toFixed(1)}k, SigMap ${(mean(w.map(tot)) / tw / 1000).toFixed(1)}k`);
  const tally = {};
  for (const x of w) for (const [t, n] of Object.entries(x.toolCalls.byTool || {})) tally[t.replace('mcp__sigmap__', 'sigmap:')] = (tally[t.replace('mcp__sigmap__', 'sigmap:')] || 0) + n;
  const ret = w.filter((x) => Object.keys(x.toolCalls.byTool || {}).some((t) => /query_context|read_context/.test(t))).length;
  console.log(`  SigMap arm tool use: ${JSON.stringify(tally)}; asked SigMap to retrieve in ${ret} of ${w.length} runs`);
}
