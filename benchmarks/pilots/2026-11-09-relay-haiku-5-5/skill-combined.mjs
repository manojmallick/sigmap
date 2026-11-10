#!/usr/bin/env node
// SigMap handed over as Claude Code skills (`skill`: one hand-written sigmap-locate; `skill-shipped`: the three skills
// `sigmap skills install --client claude` writes), each against its own same-invocation baseline, on the real Haiku 5.5 on the
// logged-in session. Offline, no key.
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/skill-combined.mjs
//
// Reads session-auth/skill/<variant>/<batch>/raw.json. Same sample and estimators as weak-combined.mjs (45 questions x 2
// repetitions, typical-task change with a 95% bootstrap interval), plus the one thing a skill adds to the question: whether the
// agent ever called it. Both arms of a skill run carry the Skill tool and the agent's bundled skills, so the baseline here is not
// the baseline of the index / lean / current runs.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { workloadChange, geometricChange } from '../../../scripts/lib/agent-ab-stats.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, 'session-auth', 'skill');
const key = (x) => `${x.repo}/${x.task}|${x.run}`;
function loadVariant(v) {
  const dir = path.join(root, v);
  if (!fs.existsSync(dir)) return [];
  const raw = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).flatMap((e) => require(path.join(dir, e.name, 'raw.json')));
  const bad = new Set(raw.filter((x) => !x.ok).map(key));
  if (bad.size) console.log(`note: ${v}: ${raw.filter((x) => !x.ok).length} failed run(s) (${[...bad].join(', ')}); that question x repetition is left out of every comparison`);
  return raw.filter((x) => !bad.has(key(x)));
}
const sets = Object.fromEntries(['skill', 'skill-rep2', 'skill-always', 'skill-shipped'].map((v) => [v, loadVariant(v)]).filter(([, s]) => s.length));
if (!Object.keys(sets).length) { console.log('no skill-variant data saved yet (session-auth/skill/)'); process.exit(0); }

const tot = (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite;
const metrics = [['real cost', (x) => x.cost.usd], ['total tokens', tot], ['tool calls', (x) => x.toolCalls.total], ['seconds', (x) => x.durationMs / 1000]];
const pct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const turns = (x) => x.toolCalls.total + 1;
const used = (x, tool) => (x.toolCalls.byTool || {})[tool] || 0;

for (const [name, raw] of Object.entries(sets)) {
  const by = (r) => new Map(raw.filter((x) => x.run === r).map((x) => [`${x.repo}/${x.task}|${x.arm}`, x]));
  const qs = [...new Set(raw.map((x) => `${x.repo}/${x.task}`))];
  const pairs = (fn, r) => qs.filter((q) => by(r).has(`${q}|with`) && by(r).has(`${q}|without`)).map((q) => ({ without: fn(by(r).get(`${q}|without`)), with: fn(by(r).get(`${q}|with`)) }));
  const w = raw.filter((x) => x.arm === 'with'); const b = raw.filter((x) => x.arm === 'without');
  console.log(`\n==================== ${name}: ${qs.length} questions, ${raw.length} runs (Haiku 5.5) ====================`);
  console.log(`found the file: SigMap ${w.filter((x) => x.pass).length}/${w.length}, baseline ${b.filter((x) => x.pass).length}/${b.length}`);
  for (const [label, fn] of metrics) {
    const cells = [1, 2].map((r) => { const ps = pairs(fn, r); const g = geometricChange(ps); return `R${r}: whole ${pct(workloadChange(ps).change)}, typical ${pct(g.change)} [${pct(g.lo)}, ${pct(g.hi)}]${g.inNoise ? ' ~' : ''}`; });
    const all = [1, 2].flatMap((r) => pairs(fn, r)); const g = geometricChange(all);
    const lower = all.filter((p) => p.with < p.without).length; const higher = all.filter((p) => p.with > p.without).length;
    console.log(`  ${label.padEnd(13)} ${cells.join('   ')}   pooled(${all.length}): ${pct(g.change)} [${pct(g.lo)}, ${pct(g.hi)}]${g.inNoise ? ' ~' : ''}, SigMap lower in ${lower}, higher in ${higher}`);
  }
  console.log('  (~ = the interval includes zero)');
  console.log(`  baseline: ${mean(b.map((x) => x.toolCalls.total)).toFixed(1)} calls, ${(mean(b.map((x) => x.durationMs)) / 1000).toFixed(1)} s, ${Math.round(mean(b.map(tot)) / 1000)}k tokens, $${mean(b.map((x) => x.cost.usd)).toFixed(4)} a run; SigMap: ${mean(w.map((x) => x.toolCalls.total)).toFixed(1)} calls, ${(mean(w.map((x) => x.durationMs)) / 1000).toFixed(1)} s, ${Math.round(mean(w.map(tot)) / 1000)}k tokens, $${mean(w.map((x) => x.cost.usd)).toFixed(4)} a run`);
  console.log(`  turns: baseline ${mean(b.map(turns)).toFixed(2)}, SigMap ${mean(w.map(turns)).toFixed(2)}; tokens per turn: baseline ${(mean(b.map(tot)) / mean(b.map(turns)) / 1000).toFixed(1)}k, SigMap ${(mean(w.map(tot)) / mean(w.map(turns)) / 1000).toFixed(1)}k`);
  const skillRuns = w.filter((x) => used(x, 'Skill') > 0); const cliRuns = w.filter((x) => ((x.toolCalls.byCommand || {}).sigmap || 0) > 0);
  const baseSkill = b.filter((x) => used(x, 'Skill') > 0);
  console.log(`  did the agent use SigMap? called the Skill tool in ${skillRuns.length} of ${w.length} SigMap runs (${baseSkill.length} of ${b.length} baseline runs called it for a bundled skill); ran the sigmap CLI in ${cliRuns.length}`);
  const tally = {};
  for (const x of w) for (const [t, n] of Object.entries(x.toolCalls.byTool || {})) tally[t] = (tally[t] || 0) + n;
  console.log(`  SigMap arm tool use: ${JSON.stringify(tally)}`);
  if (cliRuns.length) {
    const withUse = pairs((x) => x, 1).concat(pairs((x) => x, 2)).filter((p) => ((p.with.toolCalls.byCommand || {}).sigmap || 0) > 0);
    const gc = geometricChange(withUse.map((p) => ({ without: p.without.cost.usd, with: p.with.cost.usd })));
    const found = withUse.filter((p) => p.with.pass).length;
    console.log(`  in the ${withUse.length} pairs where SigMap ran the CLI: cost ${pct(gc.change)} [${pct(gc.lo)}, ${pct(gc.hi)}]${gc.inNoise ? ' ~' : ''}; file found ${found}/${withUse.length}`);
  }
}

// The same `skill` configuration was run twice (fresh runs, same plan): the two together, and how far apart they were.
if (sets.skill && sets['skill-rep2']) {
  const pairsOf = (raw, fn) => {
    const m = new Map(raw.map((x) => [`${x.repo}/${x.task}|${x.run}|${x.arm}`, x]));
    return [...new Set(raw.map(key))].filter((k) => m.has(`${k}|with`) && m.has(`${k}|without`)).map((k) => ({ without: fn(m.get(`${k}|without`)), with: fn(m.get(`${k}|with`)) }));
  };
  console.log('\n==================== skill, both runs of the same configuration (a noise check) ====================');
  for (const [label, fn] of metrics) {
    const one = geometricChange(pairsOf(sets.skill, fn)); const two = geometricChange(pairsOf(sets['skill-rep2'], fn));
    const both = geometricChange([...pairsOf(sets.skill, fn), ...pairsOf(sets['skill-rep2'], fn)]);
    console.log(`  ${label.padEnd(13)} run 1 ${pct(one.change)} [${pct(one.lo)}, ${pct(one.hi)}]${one.inNoise ? ' ~' : ''}   run 2 ${pct(two.change)} [${pct(two.lo)}, ${pct(two.hi)}]${two.inNoise ? ' ~' : ''}   together(${both.n}): ${pct(both.change)} [${pct(both.lo)}, ${pct(both.hi)}]${both.inNoise ? ' ~' : ''}`);
  }
}
