#!/usr/bin/env node
// What the agent did first, from the ordered tool calls the harness records: descriptive, no estimator.
//
//   node benchmarks/agent-study/trace-analysis.mjs hook=runs/hook prompt=runs/prompt [--arm with|without]
//
// Each argument is label=<folder of batches>, a folder holding <batch>/raw.json as run-remaining.sh writes it. A "ranked file" is a
// file the delivery named: the hook's own output (`hooks[].files`) or the ranking the harness put in the prompt (`ranked`). Only runs of
// the SigMap arm have one; the baseline arm is shown for its first-call mix.
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const arm = (() => { const i = argv.indexOf('--arm'); return i >= 0 ? argv[i + 1] : 'with'; })();
const series = argv.filter((a, i) => /^[^=-][^=]*=/.test(a) && argv[i - 1] !== '--arm').map((a) => [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]);
if (!series.length) { console.error('usage: trace-analysis.mjs label=<folder> [label=<folder> ...] [--arm with|without]'); process.exit(2); }

const norm = (p) => String(p).replace(/^\.\//, '');
const tool = (k) => k.split(':')[0];
const arg = (k) => (k.includes(':') ? k.slice(k.indexOf(':') + 1) : '');
const SEARCH = new Set(['Grep', 'Glob', 'Bash']);

function load(dir) {
  const rows = [];
  for (const b of fs.readdirSync(dir)) {
    const f = path.join(dir, b, 'raw.json');
    if (fs.existsSync(f)) rows.push(...JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  return rows.filter((r) => r.arm === arm && r.toolCalls && Array.isArray(r.toolCalls.sequence));
}

function describe(rows) {
  const m = { runs: rows.length, withRanking: 0, firstRead: 0, firstGrep: 0, firstGlob: 0, firstBash: 0, readRanked: 0, readTop: 0, firstIsTop: 0, searchBeforeRanked: 0, callsBeforeRanked: [], calls: [] };
  for (const r of rows) {
    const seq = r.toolCalls.sequence;
    const ranked = ((r.hooks || []).find((h) => h && h.event === 'UserPromptSubmit') || {}).files || r.ranked || [];
    m.calls.push(r.toolCalls.total);
    if (ranked.length) m.withRanking++;
    const first = seq[0] ? tool(seq[0]) : null;
    if (first === 'Read') m.firstRead++; else if (first === 'Grep') m.firstGrep++; else if (first === 'Glob') m.firstGlob++; else if (first === 'Bash') m.firstBash++;
    if (!ranked.length) continue;
    const set = new Set(ranked.map(norm));
    const at = seq.findIndex((k) => tool(k) === 'Read' && set.has(norm(arg(k))));
    if (seq[0] && tool(seq[0]) === 'Read' && norm(arg(seq[0])) === norm(ranked[0])) m.firstIsTop++;
    if (at >= 0) {
      m.readRanked++; m.callsBeforeRanked.push(at);
      if (seq.slice(0, at).some((k) => SEARCH.has(tool(k)))) m.searchBeforeRanked++;
    }
    if (seq.some((k) => tool(k) === 'Read' && norm(arg(k)) === norm(ranked[0]))) m.readTop++;
  }
  return m;
}

const pc = (n, d) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : '—');
const mean = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '—');
console.log(`Arm: ${arm}. A "ranked file" is one the delivery named. Descriptive only.\n`);
console.log('| series | runs | first call Read · Grep · Glob · Bash | read a ranked file | read the top-ranked file | first call = Read of the top-ranked | searched before reading a ranked file | calls before the first ranked read | calls per run |');
console.log('|---|---:|---|---:|---:|---:|---:|---:|---:|');
for (const [label, dir] of series) {
  const m = describe(load(dir));
  const n = m.runs;
  console.log(`| ${label} | ${n} | ${[m.firstRead, m.firstGrep, m.firstGlob, m.firstBash].map((x) => Math.round((100 * x) / (n || 1)) + '%').join(' · ')} | ${pc(m.readRanked, m.withRanking)} | ${pc(m.readTop, m.withRanking)} | ${pc(m.firstIsTop, m.withRanking)} | ${pc(m.searchBeforeRanked, m.readRanked)} | ${mean(m.callsBeforeRanked)} | ${mean(m.calls)} |`);
}
