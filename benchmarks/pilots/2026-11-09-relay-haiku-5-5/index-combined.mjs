#!/usr/bin/env node
// Re-derives the combined `index` result from the saved raw records. Offline, no key.
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/index-combined.mjs
//
// Reads index-gin-4runs/ (gin/x001) and index-5questions/*/ (the other five questions the relay's allowance covered),
// each of which holds an `index` arm and a baseline from the SAME invocation, and the earlier `current` arm from
// full-40runs/. Prints per-question tokens, the per-repetition workload total and typical task for `index` and for
// `current` on the same questions, whether the file was found, and tool calls.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { workloadChange, geometricChange } from '../../../scripts/lib/agent-ab-stats.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => require(path.join(here, rel));
const dirs = fs.readdirSync(path.join(here, 'index-5questions'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
const idx = [...read('index-gin-4runs/raw.json'), ...dirs.flatMap((d) => read(`index-5questions/${d}/raw.json`))];
const cur = read('full-40runs/raw.json');

const tot = (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite;
const pct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const qOf = (x) => `${x.repo}/${x.task}`;
const qs = [...new Set(idx.map(qOf))];
const find = (set, q, run, arm) => set.find((x) => qOf(x) === q && x.run === run && x.arm === arm);
console.log(`questions: ${qs.length} (${qs.join(', ')}); runs: ${idx.length}; failed: ${idx.filter((x) => !x.ok).length}`);

console.log('\nper question, total tokens R1/R2 and change against the arm\'s own same-run baseline');
for (const q of qs) {
  const k = (set, arm) => [1, 2].map((r) => find(set, q, r, arm));
  const fmt = (xs) => xs.map((x) => `${Math.round(tot(x) / 1000)}k`).join('/');
  const chg = (w, b) => [0, 1].map((i) => pct(tot(w[i]) / tot(b[i]) - 1)).join('/');
  const bi = k(idx, 'without'); const wi = k(idx, 'with'); const bc = k(cur, 'without'); const wc = k(cur, 'with');
  console.log(q.padEnd(14), 'baseline', fmt(bi).padEnd(9), '| current', fmt(wc).padEnd(9), chg(wc, bc).padEnd(11), '| index', fmt(wi).padEnd(9), chg(wi, bi).padEnd(11), `calls index ${wi.map((x) => x.toolCalls.total).join('/')} baseline ${bi.map((x) => x.toolCalls.total).join('/')}`);
}

console.log('\nper repetition over the same questions');
for (const run of [1, 2]) {
  for (const [label, set] of [['INDEX  ', idx], ['CURRENT', cur]]) {
    const ps = qs.map((q) => ({ without: tot(find(set, q, run, 'without')), with: tot(find(set, q, run, 'with')) }));
    const g = geometricChange(ps);
    console.log(`R${run} ${label} workload ${pct(workloadChange(ps).change).padStart(5)}, typical task ${pct(g.change).padStart(5)} [${pct(g.lo)}, ${pct(g.hi)}] ${g.inNoise ? 'inside the noise' : 'OUTSIDE the noise'}`);
  }
}
const pooled = (set) => { const ps = qs.flatMap((q) => [1, 2].map((r) => ({ without: tot(find(set, q, r, 'without')), with: tot(find(set, q, r, 'with')) }))); return workloadChange(ps).change; };
console.log(`both repetitions pooled: INDEX workload ${pct(pooled(idx))}, CURRENT workload ${pct(pooled(cur))}`);

const found = (set, arm, only) => { const xs = set.filter((x) => x.arm === arm && (!only || only.includes(qOf(x)))); return `${xs.filter((x) => x.pass).length}/${xs.length}`; };
console.log(`\nfound the file: index ${found(idx, 'with')} (its baselines ${found(idx, 'without')}); current on the same questions ${found(cur, 'with', qs)} (baselines ${found(cur, 'without', qs)})`);
const mean = (set, arm, f) => { const xs = set.filter((x) => x.arm === arm); return xs.reduce((s, x) => s + f(x), 0) / xs.length; };
console.log(`mean tool calls: index ${mean(idx, 'with', (x) => x.toolCalls.total).toFixed(1)}, its baselines ${mean(idx, 'without', (x) => x.toolCalls.total).toFixed(1)}`);
const sp = {}; for (const x of idx.filter((y) => y.arm === 'with')) for (const [t, n] of Object.entries(x.toolCalls.byTool || {})) sp[t.replace('mcp__sigmap__', '')] = (sp[t.replace('mcp__sigmap__', '')] || 0) + n;
console.log(`index arm tool use over ${idx.filter((x) => x.arm === 'with').length} runs: ${JSON.stringify(sp)}`);
console.log(`raw tokens in these ${idx.length} runs: ${idx.reduce((s, x) => s + tot(x), 0)}`);

// Noise and power. The paired log-ratio of SigMap's arm to its same-run baseline, one per question and repetition.
const lr = [];
for (const q of qs) for (const r of [1, 2]) lr.push(Math.log(tot(find(idx, q, r, 'with')) / tot(find(idx, q, r, 'without'))));
const mean2 = lr.reduce((a, b) => a + b) / lr.length;
const sd = Math.sqrt(lr.reduce((s, x) => s + (x - mean2) ** 2, 0) / (lr.length - 1));
const se = sd / Math.sqrt(lr.length);
console.log(`\nnoise: sd of the paired log-ratio ${sd.toFixed(2)} (one pair is typically off by a factor of ${Math.exp(sd).toFixed(1)}); ${lr.length} pairs give a pooled interval of ${pct(Math.exp(mean2 - 1.96 * se) - 1)} to ${pct(Math.exp(mean2 + 1.96 * se) - 1)}`);
for (const hw of [0.2, 0.1]) {
  const n = Math.ceil((1.96 * sd / Math.log(1 + hw)) ** 2);
  console.log(`paired runs for a 95% interval of about ±${hw * 100}%: ${n} (${Math.ceil(n / 2)} questions × 2 repetitions)`);
}
const n20 = 20; const half = 1.96 * sd / Math.sqrt(n20);
console.log(`with all 10 pilot questions (${n20} pairs) the interval would still be about ${pct(Math.exp(mean2 - half) - 1)} to ${pct(Math.exp(mean2 + half) - 1)}`);
console.log(`baseline, same question, repetition 1 against 2 (larger over smaller): ${qs.map((q) => { const a = tot(find(idx, q, 1, 'without')); const b = tot(find(idx, q, 2, 'without')); return (Math.max(a, b) / Math.min(a, b)).toFixed(1) + '×'; }).join(', ')}`);

// The saving list: every paired case (question × repetition), for the `index` arm and the earlier `current` arm, with the change
// against that repetition's own baseline and whether this repetition's baseline was the more expensive of its two (a spike).
// If savings arrive when the baseline spikes and costs when it is lucky, the pattern is noise and not an effect.
const list = (label, set, questions) => {
  const rows = [];
  for (const q of questions) {
    const b = [1, 2].map((r) => tot(find(set, q, r, 'without')));
    for (const r of [1, 2]) {
      const w = tot(find(set, q, r, 'with'));
      rows.push({ q, r, change: w / b[r - 1] - 1, with: w, base: b[r - 1], spike: b[r - 1] > b[2 - r] });
    }
  }
  const saved = rows.filter((x) => x.change < -0.005).sort((a, b) => a.change - b.change);
  const more = rows.filter((x) => x.change >= -0.005);
  console.log(`\nsaving list, ${label}: fewer tokens in ${saved.length} of ${rows.length} cases`);
  for (const x of saved) console.log(`  ${x.q} R${x.r}  ${pct(x.change).padStart(5)}  (${Math.round(x.with / 1000)}k against a ${Math.round(x.base / 1000)}k baseline${x.spike ? ', the costlier of its two baseline repetitions' : ''})`);
  const sp = saved.filter((x) => x.spike).length;
  const lucky = more.filter((x) => !x.spike && x.change > 0.5).length;
  console.log(`  ${sp} of these ${saved.length} savings came in the baseline's costlier repetition; of the ${more.length} cases that cost more, ${more.filter((x) => x.change > 0.5).length} cost over 50% more and ${lucky} of those came in the baseline's cheaper repetition`);
};
list('index (docs\' setup)', idx, qs);
list('current (the old default), same six questions', cur, qs);
list('current, all ten pilot questions', cur, [...new Set(cur.map(qOf))]);
