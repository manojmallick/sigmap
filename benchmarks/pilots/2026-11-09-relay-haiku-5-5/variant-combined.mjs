#!/usr/bin/env node
// One report for any folder of saved variant runs: each variant against its own same-invocation baseline. Offline, no key.
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/variant-combined.mjs <folder under session-auth> ["label"]
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/variant-combined.mjs unfamiliar "Haiku 5.5, SigMap's own source"
//
// Reads session-auth/<folder>/<variant>/<batch>/raw.json. For real cost, total tokens, tool calls and seconds: the whole-batch and
// typical-task change per repetition and pooled, with the 95% bootstrap interval; whether the file was found, and by which arm
// when only one found it; how the SigMap arm used SigMap; and turns. The estimators are scripts/lib/agent-ab-stats.mjs.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { workloadChange, geometricChange } from '../../../scripts/lib/agent-ab-stats.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const [folder, label = ''] = process.argv.slice(2);
if (!folder) { console.error('usage: variant-combined.mjs <folder under session-auth> ["label"]'); process.exit(2); }
const root = path.join(here, 'session-auth', folder);
if (!fs.existsSync(root)) { console.log(`no data saved yet (session-auth/${folder}/)`); process.exit(0); }
const key = (x) => `${x.repo}/${x.task}|${x.run}`;
const tot = (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite;
const metrics = [['real cost', (x) => x.cost.usd], ['total tokens', tot], ['tool calls', (x) => x.toolCalls.total], ['seconds', (x) => x.durationMs / 1000]];
const pct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const turns = (x) => x.toolCalls.total + 1;

for (const name of fs.readdirSync(root).filter((v) => fs.statSync(path.join(root, v)).isDirectory()).sort()) {
  const dir = path.join(root, name);
  let raw = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).flatMap((e) => require(path.join(dir, e.name, 'raw.json')));
  const bad = new Set(raw.filter((x) => !x.ok).map(key));
  if (bad.size) console.log(`note: ${name}: ${raw.filter((x) => !x.ok).length} failed run(s) (${[...bad].join(', ')}); that question x repetition is left out`);
  raw = raw.filter((x) => !bad.has(key(x)));
  const m = new Map(raw.map((x) => [`${key(x)}|${x.arm}`, x]));
  const keys = [...new Set(raw.map(key))].filter((k) => m.has(`${k}|with`) && m.has(`${k}|without`));
  const pairs = (fn, r) => keys.filter((k) => r === 0 || k.endsWith(`|${r}`)).map((k) => ({ without: fn(m.get(`${k}|without`)), with: fn(m.get(`${k}|with`)) }));
  const w = keys.map((k) => m.get(`${k}|with`)); const b = keys.map((k) => m.get(`${k}|without`));
  const qs = new Set(keys.map((k) => k.split('|')[0]));
  console.log(`\n==================== ${name}: ${qs.size} questions, ${keys.length} pairs${label ? ` (${label})` : ''} ====================`);
  const only = (a, c) => keys.filter((k) => m.get(`${k}|${a}`).pass && !m.get(`${k}|${c}`).pass).length;
  console.log(`found the file: SigMap ${w.filter((x) => x.pass).length}/${w.length}, baseline ${b.filter((x) => x.pass).length}/${b.length}; only SigMap found it in ${only('with', 'without')} pairs, only the baseline in ${only('without', 'with')}`);
  for (const [lab, fn] of metrics) {
    const cells = [1, 2].map((r) => { const ps = pairs(fn, r); if (!ps.length) return `R${r}: n/a`; const g = geometricChange(ps); return `R${r}: whole ${pct(workloadChange(ps).change)}, typical ${pct(g.change)} [${pct(g.lo)}, ${pct(g.hi)}]${g.inNoise ? ' ~' : ''}`; });
    const all = pairs(fn, 0); const g = geometricChange(all);
    console.log(`  ${lab.padEnd(13)} ${cells.join('   ')}   pooled(${all.length}): ${pct(g.change)} [${pct(g.lo)}, ${pct(g.hi)}]${g.inNoise ? ' ~' : ''}, SigMap lower in ${all.filter((p) => p.with < p.without).length}, higher in ${all.filter((p) => p.with > p.without).length}`);
  }
  console.log('  (~ = the interval includes zero)');
  console.log(`  baseline: ${mean(b.map((x) => x.toolCalls.total)).toFixed(1)} calls, ${(mean(b.map((x) => x.durationMs)) / 1000).toFixed(1)} s, ${Math.round(mean(b.map(tot)) / 1000)}k tokens, $${mean(b.map((x) => x.cost.usd)).toFixed(4)} a run; SigMap: ${mean(w.map((x) => x.toolCalls.total)).toFixed(1)} calls, ${(mean(w.map((x) => x.durationMs)) / 1000).toFixed(1)} s, ${Math.round(mean(w.map(tot)) / 1000)}k tokens, $${mean(w.map((x) => x.cost.usd)).toFixed(4)} a run`);
  console.log(`  turns: baseline ${mean(b.map(turns)).toFixed(2)}, SigMap ${mean(w.map(turns)).toFixed(2)} (${pct(mean(w.map(turns)) / mean(b.map(turns)) - 1)}); tokens per turn: baseline ${(mean(b.map(tot)) / mean(b.map(turns)) / 1000).toFixed(1)}k, SigMap ${(mean(w.map(tot)) / mean(w.map(turns)) / 1000).toFixed(1)}k`);
  const tally = {}; const btally = {};
  for (const x of w) for (const [t, n] of Object.entries(x.toolCalls.byTool || {})) tally[t.replace('mcp__sigmap__', 'sigmap:')] = (tally[t.replace('mcp__sigmap__', 'sigmap:')] || 0) + n;
  for (const x of b) for (const [t, n] of Object.entries(x.toolCalls.byTool || {})) btally[t] = (btally[t] || 0) + n;
  const usedMcp = w.filter((x) => Object.keys(x.toolCalls.byTool || {}).some((t) => /mcp__sigmap__/.test(t))).length;
  const usedCli = w.filter((x) => ((x.toolCalls.byCommand || {}).sigmap || 0) > 0).length;
  const usedSkill = w.filter((x) => ((x.toolCalls.byTool || {}).Skill || 0) > 0).length;
  console.log(`  SigMap arm used: an MCP tool in ${usedMcp} of ${w.length} runs, the CLI in ${usedCli}, a skill in ${usedSkill}`);
  console.log(`  tools, SigMap arm: ${JSON.stringify(tally)}`);
  console.log(`  tools, baseline:   ${JSON.stringify(btally)}`);
}
