#!/usr/bin/env node
'use strict';

/**
 * Signal arms across every corpus — the measurement behind the opt-in signals' verdicts (#703).
 *
 *   node scripts/run-signal-verdicts.mjs          # run both gates' arms and print one table
 *   node scripts/run-signal-verdicts.mjs --save   # also record benchmarks/reports/signal-arms.json
 *   node scripts/run-signal-verdicts.mjs --only xrepo --save   # re-score one corpus, keep the others as recorded
 *
 * Each opt-in ranking signal is scored against the shipped ranker, task by task, on the
 * labelled third-party corpus (`run-xrepo-gate.mjs --signals`), on this repository's own
 * splits and the JVM repos (`run-retrieval-gate.mjs --signals`) and on the honest corpus the
 * published headline is measured on (`run-honest-benchmark.mjs --signals`, scored without an
 * import graph, as its table is). A cell is the net number of tasks the signal wins over plain,
 * with won/lost beside it: a signal that wins as many as it loses has moved the answers around,
 * not improved them. An arm that does not apply to a corpus shows a dash.
 *
 * It records measurements and never a decision — what to do with a signal is argued from this
 * table in docs-vp/guide/retrieval-benchmark.md, which a test holds to the saved report.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { stamp } from './lib/report-stamp.mjs';
import { ARMS, totalsOf, mergeReport } from './lib/signal-arms.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = path.join(ROOT, 'benchmarks', 'reports', 'signal-arms.json');
const SAVE = process.argv.includes('--save');
const CORPORA = ['xrepo', 'hard', 'mined', 'easy', 'jvm', 'honest'];
const onlyAt = process.argv.indexOf('--only');
const ONLY = onlyAt === -1 ? [] : String(process.argv[onlyAt + 1] || '').split(',').filter(Boolean);
for (const name of ONLY) {
  if (!CORPORA.includes(name)) { console.error(`--only: unknown corpus "${name}" (one of ${CORPORA.join(', ')})`); process.exit(2); }
}
const wants = (name) => !ONLY.length || ONLY.includes(name);
let PRIOR = null;
if (ONLY.length && SAVE) {
  try { PRIOR = JSON.parse(fs.readFileSync(REPORT, 'utf8')); } catch (_) { /* reported below */ }
  if (!PRIOR) { console.error('--only --save updates a saved report, and there is none: record all corpora first.'); process.exit(1); }
}

/** Run a gate with `--signals --json` and parse the one document it writes to stdout. */
function gateJson(script) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), '--signals', '--json'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28,
  });
  if (r.status !== 0) throw new Error(`${script} exited ${r.status}: ${(r.stderr || '').slice(-600)}`);
  return JSON.parse(r.stdout);
}

const round = (n) => Math.round(n * 1000) / 1000;

/** What a corpus's arms record: counts and the tasks behind them, never a verdict. */
function summarize(arms) {
  return Object.fromEntries(Object.entries(arms).map(([id, a]) => [id, {
    hits: a.hits,
    tasks: a.tasks,
    mrr: round(a.mrr),
    gained: a.gained,
    lost: a.lost,
    moved: a.moves.length,
  }]));
}

const corpora = {};
if (wants('xrepo')) {
  const xrepo = gateJson('run-xrepo-gate.mjs');
  if (xrepo.signals) corpora.xrepo = summarize(xrepo.signals.arms);
}
if (['hard', 'mined', 'easy', 'jvm'].some(wants)) {
  const own = gateJson('run-retrieval-gate.mjs');
  for (const split of ['hard', 'mined', 'easy', 'jvm']) {
    const s = wants(split) && own.splits && own.splits[split] && own.splits[split].signals;
    if (s) corpora[split] = summarize(s.arms);
  }
}
// The honest corpus needs the benchmark clones and exits non-zero without them; the rest of the table stands without it.
if (wants('honest')) {
  try {
    const honest = gateJson('run-honest-benchmark.mjs');
    if (honest.signals) corpora.honest = summarize(honest.signals.arms);
  } catch (e) {
    console.error(`  note: the honest corpus was not scored (${String(e.message).split('\n')[0].slice(0, 120)})`);
  }
}
if (!Object.keys(corpora).length) {
  console.error('No corpus was scored — fetch the xrepo checkouts (node scripts/fetch-xrepo-repos.mjs) and clone the benchmark repos.');
  process.exit(1);
}

// Totals over every corpus scored, per arm.
const total = totalsOf(corpora);

const names = Object.keys(corpora);
const W = 12;
const has = (arm) => Object.values(corpora).some((c) => c[arm]);
const cell = (a, plain) => (!a ? '—' : a === plain ? `${a.hits}/${a.tasks}` : `${a.gained.length - a.lost.length >= 0 ? '+' : ''}${a.gained.length - a.lost.length} (${a.gained.length}/${a.lost.length})`);
console.log('\n  signal arms across every corpus; a cell is net tasks (won/lost) against plain\n');
console.log(`    ${'arm'.padEnd(26)}${[...names, 'all'].map((n) => n.padStart(W)).join('')}`);
for (const a of ARMS) {
  if (!has(a.id)) continue;
  const cells = names.map((n) => cell(corpora[n][a.id], corpora[n].plain));
  const all = total[a.id];
  const allCell = a.id === 'plain' ? `${all.hits}/${all.tasks}` : `${all.gained - all.lost >= 0 ? '+' : ''}${all.gained - all.lost} (${all.gained}/${all.lost})`;
  console.log(`    ${a.label.padEnd(26)}${[...cells, allCell].map((c) => c.padStart(W)).join('')}`);
}
console.log(`\n    ranks moved (tasks whose rank changed, in the top 10 on either side):`);
for (const a of ARMS.slice(1)) if (has(a.id)) console.log(`      ${a.label.padEnd(26)} ${String(total[a.id].moved).padStart(4)} of ${total[a.id].tasks}`);

if (SAVE) {
  // A whole recording replaces the file. With --only, the corpora named are re-scored and the others stay as recorded:
  // the ones scored against this repository's own source move with the checkout they are run in (a control on untouched
  // develop already reads differently from the saved report), so a change that moves one corpus must not rewrite them all.
  const now = stamp({}, ROOT);
  const merged = mergeReport(PRIOR, corpora, now);
  const report = {
    benchmark: 'signal-arms',
    method: 'each opt-in ranking signal against the shipped ranker, task by task; run-xrepo-gate.mjs --signals and run-retrieval-gate.mjs --signals',
    arms: Object.fromEntries(ARMS.map((a) => [a.id, a.label])),
    corpora: merged.corpora,
    total: merged.total,
    ...(ONLY.length ? { recorded: merged.recorded } : {}),
  };
  report.version = now.version;
  report.generated = now.generated;
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
  console.log(`\n  saved: ${path.relative(ROOT, REPORT)}${ONLY.length ? ` (re-scored: ${ONLY.join(', ')}; the others as recorded)` : ''}`);
}
