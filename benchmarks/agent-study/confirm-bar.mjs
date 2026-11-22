#!/usr/bin/env node
// Apply a PRE-REGISTERED bar to a run file and print one verdict per clause. The bar is the code below, committed and hashed before the runs
// it judges exist, so the analysis cannot be chosen after the data is seen.
//
//   node benchmarks/agent-study/to-runs.mjs <runs dir> --route claude-code --model claude-haiku-5-5 > mine.ndjson
//   node benchmarks/agent-study/confirm-bar.mjs --runs mine.ndjson --variant locate [--set heldout] [--json]
//
// Exit 0: every clause met. Exit 1: at least one not met (the output says which). Exit 2: nothing to judge.
//
// Pairing, the drop rule, the per-repository typical-task change and the pooled interval are summarize.mjs's (`--by-repo`): a pair with a failed
// run is dropped, the repository is the unit, the pooled figure is the geometric mean of the per-repository ratios with an interval from
// resampling REPOSITORIES (10,000 draws, seed 1).
//
// The bar (#1071, confirmatory run of the `locate` setup in Claude Code on unseen repositories):
//   B1 cost         the upper bound of the pooled cost interval is below +5%
//   B2 spread       at most 15% of repositories are classed "costs more" (their own interval lies entirely above zero)
//   B3 file found   the file found, pooled over runs, is no more than 5 points lower than with no SigMap
//   B4 uptake       SigMap was called (an MCP call or a `sigmap` command) in at least half of the SigMap-arm runs
// Reported, not decisive: the repositories whose point estimate is above +15% (with few questions a repository's own estimate is noisy; the
// issue text said "no repository above +15%", read here by its interval class in B2 so that noise alone cannot fail a real saving).
import fs from 'fs';
import { geometricChange } from '../../scripts/lib/agent-ab-stats.mjs';

export const BAR = Object.freeze({ poolHiBelow: 0.05, maxCostsShare: 0.15, foundPointsAtLeast: -5, uptakeAtLeast: 0.5, repoPointFlag: 0.15 });

const rngOf = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const key = (r) => `${r.repo}/${r.task}|${r.run}`;

/**
 * @param {object[]} rows  rows of the study's table (to-runs.mjs output), any series
 * @param {{ variant: string, set?: string }} sel
 * @returns {object|null} the judgement, or null when there is nothing to judge
 */
export function judge(rows, sel) {
  const want = rows.filter((r) => r.variant === sel.variant && (!sel.set || r.set === sel.set));
  const bySeries = new Map();
  for (const r of want) { if (!bySeries.has(r.series)) bySeries.set(r.series, []); bySeries.get(r.series).push(r); }
  const pairs = []; let dropped = 0;
  for (const rs of bySeries.values()) {
    const bad = new Set(rs.filter((r) => !r.ok).map(key));
    dropped += bad.size;
    const m = new Map(rs.filter((r) => !bad.has(key(r))).map((r) => [`${key(r)}|${r.arm}`, r]));
    for (const k of new Set(rs.filter((r) => !bad.has(key(r))).map(key))) if (m.has(`${k}|with`) && m.has(`${k}|without`)) pairs.push({ w: m.get(`${k}|with`), b: m.get(`${k}|without`) });
  }
  if (!pairs.length) return null;

  const byRepo = new Map();
  for (const p of pairs) { if (!byRepo.has(p.w.repo)) byRepo.set(p.w.repo, []); byRepo.get(p.w.repo).push(p); }
  const repos = [...byRepo].map(([repo, ps]) => {
    const g = geometricChange(ps.map((p) => ({ without: p.b.usd, with: p.w.usd })));
    return { repo, pairs: ps.length, change: g.change, lo: g.lo, hi: g.hi, cls: g.hi != null && g.hi < 0 ? 'saves' : g.lo != null && g.lo > 0 ? 'costs' : 'none', logr: Math.log(1 + g.change) };
  });
  if (repos.length < 2) return null;
  const rand = rngOf(1); const boots = [];
  for (let b = 0; b < 10000; b++) { let s = 0; for (let i = 0; i < repos.length; i++) s += repos[Math.floor(rand() * repos.length)].logr; boots.push(s / repos.length); }
  boots.sort((x, y) => x - y);
  const pooled = { change: Math.exp(mean(repos.map((r) => r.logr))) - 1, lo: Math.exp(boots[Math.floor(0.025 * boots.length)]) - 1, hi: Math.exp(boots[Math.floor(0.975 * boots.length)]) - 1 };

  const foundW = pairs.filter((p) => p.w.pass).length; const foundB = pairs.filter((p) => p.b.pass).length;
  const foundDiff = 100 * (foundW - foundB) / pairs.length;
  const uptake = pairs.filter((p) => (p.w.mcp || 0) + (p.w.cli || 0) > 0).length / pairs.length;
  const costs = repos.filter((r) => r.cls === 'costs').length;
  const clauses = [
    { id: 'B1', name: 'upper bound of the pooled cost interval below +5%', value: pooled.hi, ok: pooled.hi < BAR.poolHiBelow },
    { id: 'B2', name: `at most ${BAR.maxCostsShare * 100}% of repositories cost more (interval above zero)`, value: costs / repos.length, ok: costs <= BAR.maxCostsShare * repos.length },
    { id: 'B3', name: 'file found no more than 5 points below the no-SigMap arm', value: foundDiff, ok: foundDiff >= BAR.foundPointsAtLeast },
    { id: 'B4', name: 'SigMap used in at least half of the SigMap-arm runs', value: uptake, ok: uptake >= BAR.uptakeAtLeast },
  ];
  return {
    variant: sel.variant, pairs: pairs.length, dropped, repositories: repos.length, pooled, foundWith: foundW, foundWithout: foundB, foundDiffPoints: foundDiff, uptake,
    repos: repos.map(({ logr, ...r }) => r).sort((a, b) => b.change - a.change),
    flaggedAbove15: repos.filter((r) => r.change > BAR.repoPointFlag).map((r) => r.repo),
    clauses, met: clauses.every((c) => c.ok),
  };
}

const pct = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const argv = process.argv.slice(2);
  const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const file = val('--runs', null); const variant = val('--variant', null);
  if (!file || !variant) { console.error('usage: confirm-bar.mjs --runs <ndjson> --variant <v> [--set <s>] [--json]'); process.exit(2); }
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const j = judge(rows, { variant, set: val('--set', null) });
  if (!j) { console.error('nothing to judge: no complete pairs in at least two repositories'); process.exit(2); }
  if (argv.includes('--json')) { process.stdout.write(`${JSON.stringify(j, null, 1)}\n`); process.exit(j.met ? 0 : 1); }
  console.log(`${j.variant}: ${j.pairs} pairs in ${j.repositories} repositories (${j.dropped} dropped)`);
  console.log(`pooled cost change ${pct(j.pooled.change)} [${pct(j.pooled.lo)}, ${pct(j.pooled.hi)}]; file found ${j.foundWith} vs ${j.foundWithout} (${j.foundDiffPoints >= 0 ? '+' : ''}${j.foundDiffPoints.toFixed(1)} points); uptake ${(j.uptake * 100).toFixed(0)}%`);
  for (const c of j.clauses) console.log(`  ${c.ok ? 'met    ' : 'NOT MET'} ${c.id} ${c.name}  (${c.id === 'B1' ? pct(c.value) : c.id === 'B3' ? c.value.toFixed(1) : `${(c.value * 100).toFixed(0)}%`})`);
  console.log(`reported: repositories above +15% on the point estimate: ${j.flaggedAbove15.join(', ') || 'none'}`);
  console.log(j.met ? 'BAR MET' : 'BAR NOT MET');
  process.exit(j.met ? 0 : 1);
}
