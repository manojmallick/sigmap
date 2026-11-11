#!/usr/bin/env node
// One table for the runs made through the Messages API directly (--agent api): every model, question set and SigMap setup against
// its own baseline. Offline, no key.
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/api-summary.mjs            # markdown table
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/api-summary.mjs --study    # the same runs in the stet.sh study's columns (repetition 1 / repetition 2)
//
// Reads api-key/<model>/<set>/<variant>/<batch>/raw.json. Typical-task change (geometric mean of the per-pair ratios) pooled over
// all repetitions with its 95% bootstrap interval, the way variant-combined.mjs reports it; a run stopped by the turn or budget cap
// is a scored miss at the cost it incurred, never a dropped pair. "~" = the interval includes zero.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { geometricChange, workloadChange } from '../../../scripts/lib/agent-ab-stats.mjs';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'api-key');
const key = (x) => `${x.repo}/${x.task}|${x.run}`;
const tot = (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite;
const metrics = [(x) => x.cost.usd, tot, (x) => x.toolCalls.total, (x) => x.durationMs / 1000];
const pct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const cell = (g) => `${pct(g.change)} [${pct(g.lo)}, ${pct(g.hi)}]${g.inNoise ? ' ~' : ''}`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const STUDY = process.argv.includes('--study');
const studyRows = [];
const rows = [];
let spend = 0; let runs = 0;

/** One row in the study's columns: whole-batch and typical-task change per repetition for tokens and cost, cases with fewer tokens, and whether tokens fell in both repetitions. */
function studyRow(label, set, variant, raw, keys, m) {
  const per = (fn, r) => keys.filter((k) => k.endsWith(`|${r}`)).map((k) => ({ without: fn(m.get(`${k}|without`)), with: fn(m.get(`${k}|with`)) }));
  const two = (fn, how) => [1, 2].map((r) => { const ps = per(fn, r); return how === 'whole' ? workloadChange(ps).change : geometricChange(ps).change; }).map(pct).join(' / ');
  const fell = [1, 2].flatMap((r) => [workloadChange(per(tot, r)).change, geometricChange(per(tot, r)).change]).every((v) => v < 0);
  const all = keys.map((k) => ({ without: tot(m.get(`${k}|without`)), with: tot(m.get(`${k}|with`)) }));
  const lower = all.filter((p) => p.with < p.without).length;
  const both = fell;
  return `| ${label} | \`${variant}\`, ${set} | ${two(tot, 'whole')} | ${two(tot, 'typical')} | ${two((x) => x.cost.usd, 'whole')} | ${two((x) => x.cost.usd, 'typical')} | ${lower} of ${all.length} | ${both ? 'yes' : 'no'} |`;
}
for (const model of fs.existsSync(root) ? fs.readdirSync(root).sort() : []) {
  for (const set of ['unfamiliar', 'famous']) {
    for (const variant of ['index', 'prefetch']) {
      const dir = path.join(root, model, set, variant);
      if (!fs.existsSync(dir)) continue;
      let raw = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'raw.json'))).flatMap((e) => require(path.join(dir, e.name, 'raw.json')));
      spend += raw.reduce((s, x) => s + ((x.cost && x.cost.usd) || 0), 0); runs += raw.length;
      const bad = new Set(raw.filter((x) => !x.ok).map(key));
      raw = raw.filter((x) => !bad.has(key(x)));
      const m = new Map(raw.map((x) => [`${key(x)}|${x.arm}`, x]));
      const keys = [...new Set(raw.map(key))].filter((k) => m.has(`${k}|with`) && m.has(`${k}|without`));
      if (!keys.length) continue;
      const w = keys.map((k) => m.get(`${k}|with`)); const b = keys.map((k) => m.get(`${k}|without`));
      const g = metrics.map((fn) => geometricChange(keys.map((k) => ({ without: fn(m.get(`${k}|without`)), with: fn(m.get(`${k}|with`)) }))));
      const lim = (xs) => xs.filter((x) => x.limit).length;
      if (STUDY) studyRows.push(studyRow(`${model}, API agent`, set, variant, raw, keys, m));
      rows.push({ model, set, variant, pairs: keys.length, dropped: bad.size, g, found: `${w.filter((x) => x.pass).length}/${w.length} (${b.filter((x) => x.pass).length}/${b.length})`, base: `${mean(b.map((x) => x.toolCalls.total)).toFixed(1)} calls, $${mean(b.map((x) => x.cost.usd)).toFixed(4)}`, limits: lim(w) + lim(b) });
    }
  }
}
if (STUDY) {
  // the Claude Code runs of the same questions (Haiku 5.5 on the logged-in session), for the same columns
  const cc = path.join(path.dirname(fileURLToPath(import.meta.url)), 'session-auth');
  for (const [folder, set] of [['final-unfam', 'unfamiliar'], ['final-famous', 'famous']]) {
    for (const variant of ['index', 'prefetch']) {
      const dir = path.join(cc, folder, variant);
      if (!fs.existsSync(dir)) continue;
      let raw = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'raw.json'))).flatMap((e) => require(path.join(dir, e.name, 'raw.json')));
      const bad = new Set(raw.filter((x) => !x.ok).map(key)); raw = raw.filter((x) => !bad.has(key(x)));
      const m = new Map(raw.map((x) => [`${key(x)}|${x.arm}`, x]));
      const keys = [...new Set(raw.map(key))].filter((k) => m.has(`${k}|with`) && m.has(`${k}|without`));
      studyRows.unshift(studyRow('claude-haiku-5-5, Claude Code', set, variant, raw, keys, m));
    }
  }
  console.log('| SigMap run | what | tokens, whole batch R1 / R2 | tokens, typical task R1 / R2 | cost, whole batch R1 / R2 | cost, typical task R1 / R2 | cases with fewer tokens | saved tokens both times? |');
  console.log('|---|---|---:|---:|---:|---:|---:|---|');
  for (const r of studyRows) console.log(r);
  process.exit(0);
}
console.log('| model | questions | SigMap setup | pairs | real cost | total tokens | tool calls | seconds | file found (baseline) | baseline a run |');
console.log('|---|---|---|---:|---:|---:|---:|---:|---:|---|');
for (const r of rows) console.log(`| ${r.model} | ${r.set} | \`${r.variant}\` | ${r.pairs}${r.dropped ? ` (${r.dropped} dropped)` : ''} | **${cell(r.g[0])}** | ${cell(r.g[1])} | ${cell(r.g[2])} | ${cell(r.g[3])} | ${r.found}${r.limits ? ` · ${r.limits} run(s) hit the turn cap` : ''} | ${r.base} |`);
console.log(`\n${runs} runs, computed spend $${spend.toFixed(2)} (usage × price table; the Console's usage page is the authority)`);
