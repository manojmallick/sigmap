#!/usr/bin/env node
'use strict';

/**
 * Body-words parameter sweep — how the two constants of retrieval.bodyWords were chosen (#905).
 *
 *   node scripts/run-body-words-sweep.mjs                          # the grid, every corpus
 *   node scripts/run-body-words-sweep.mjs --only xrepo,hard        # some corpora
 *   node scripts/run-body-words-sweep.mjs --shares 0.05 --per-file 100,200
 *   node scripts/run-body-words-sweep.mjs --save                   # record benchmarks/reports/body-words-sweep.json
 *
 * For each setting of the share of files that may hold a word and the number of words a file keeps,
 * every task is ranked with that setting's body words and compared with plain: the tasks won and lost,
 * per corpus. A setting is read as a region, never as a peak. Picking the argmax of a sweep over a few
 * hundred tasks is how a benchmark gets overfitted, so the shipped values sit inside the flat part of
 * the grid, and the grid is recorded so that claim can be checked.
 *
 * Scored the way the arms are: one index and import graph per repository, `learned: false`. The honest
 * corpus is scored without an import graph, as its table is. Self-scored corpora and the JVM repos are
 * regenerated first by running the retrieval gate; the honest corpus reads its repositories' contexts as
 * they stand, so run the retrieval benchmark first for canonical ones.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { stamp } from './lib/report-stamp.mjs';
import { readSource } from './lib/corpus-vocabulary.mjs';
import { loadManifest, checkoutState, readTasks, withZeroConfigIndex, TASKS_REL } from './lib/xrepo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const runner = require(path.join(ROOT, 'src/eval/runner'));
const scorer = require(path.join(ROOT, 'src/eval/scorer'));
const { buildRankingGraph } = require(path.join(ROOT, 'src/graph/builder'));
const bodyWordsLib = require(path.join(ROOT, 'src/retrieval/body-words'));

// Where the corpora and the checkouts live: this checkout, unless a root is named (a test scores a throwaway repository).
const XREPO_DATA = process.env.SIGMAP_XREPO_DATA ? path.resolve(process.env.SIGMAP_XREPO_DATA) : ROOT;
const DATA = process.env.SIGMAP_RETRIEVAL_DATA ? path.resolve(process.env.SIGMAP_RETRIEVAL_DATA) : ROOT;
const REPORT = path.join(ROOT, 'benchmarks', 'reports', 'body-words-sweep.json');

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const list = (f, d) => { const v = val(f, null); return v ? v.split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0) : d; };
const SAVE = argv.includes('--save');
const SHARES = list('--shares', [0.02, 0.05, 0.10]);
const PER_FILE = list('--per-file', [50, 100, 200, 500, 5000]);
const ALL = ['xrepo', 'hard', 'mined', 'easy', 'jvm', 'honest'];
const ONLY = new Set((val('--only', ALL.join(',')) || '').split(',').filter((c) => ALL.includes(c)));

const settings = [];
for (const share of SHARES) for (const perFile of PER_FILE) settings.push({ share, perFile, id: `s${Math.round(share * 100)}-p${perFile}` });
const shipped = settings.find((s) => s.share === bodyWordsLib.DISTINCTIVE_SHARE && s.perFile === bodyWordsLib.PER_FILE);

const loadJsonl = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const asTasks = (rows) => rows.map((o) => ({ id: o.id, query: o.query, expected: o.expected_files || [] }));

const acc = {}; // corpus -> { tasks, plain, settings: { id -> { won, lost } } }

/** Score one repository's tasks under plain and under every setting; adds to the corpus's tally. */
function evaluate(corpus, index, dir, tasks, { graph }) {
  // Sources are read once and shared by every setting: a setting changes which words are kept, not the files.
  const cache = new Map();
  const read = (file) => {
    if (!cache.has(file)) cache.set(file, readSource(dir, file));
    return cache.get(file);
  };
  const ranksUnder = (bodyWords) => tasks.map((t) => {
    const ranked = runner.rank(t.query, index, 10, { cwd: dir, graph, learned: false, bodyWords }).map((x) => x.file);
    return scorer.hitAtK(ranked, t.expected, 5);
  });
  const plain = ranksUnder(undefined);
  const c = acc[corpus] || (acc[corpus] = { tasks: 0, plain: 0, settings: {} });
  c.tasks += tasks.length;
  c.plain += plain.reduce((a, b) => a + b, 0);
  for (const s of settings) {
    const hits = ranksUnder(bodyWordsLib.buildBodyWords(index, read, { share: s.share, perFile: s.perFile }));
    const m = c.settings[s.id] || (c.settings[s.id] = { won: 0, lost: 0 });
    hits.forEach((h, i) => { if (h && !plain[i]) m.won++; if (!h && plain[i]) m.lost++; });
  }
}

const graphOf = (dir) => { try { return buildRankingGraph(dir); } catch (_) { return null; } };

// ── the corpora ──────────────────────────────────────────────────────────────

if (ONLY.has('xrepo')) {
  const manifest = loadManifest(XREPO_DATA);
  const tasksFile = path.join(XREPO_DATA, TASKS_REL);
  const all = fs.existsSync(tasksFile) ? readTasks(tasksFile) : [];
  for (const repo of manifest.repos) {
    const tasks = all.filter((t) => t.repo === repo.name);
    const state = checkoutState(XREPO_DATA, repo);
    if (!tasks.length || !state.present || !state.atPin) continue;
    withZeroConfigIndex(XREPO_DATA, repo, ({ dir, index }) => evaluate('xrepo', index, dir, asTasks(tasks), { graph: graphOf(dir) }));
  }
}

if (['hard', 'mined', 'easy', 'jvm'].some((c) => ONLY.has(c))) {
  // Regenerate this repository's index and the JVM repos' by running the gate that owns that preparation.
  spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'run-retrieval-gate.mjs')], { cwd: ROOT, stdio: 'ignore', env: Object.assign({}, process.env) });
  const own = runner.buildSigIndex(DATA);
  const ownGraph = graphOf(DATA);
  for (const [corpus, file] of [['hard', 'retrieval-hard'], ['mined', 'retrieval-mined'], ['easy', 'retrieval']]) {
    const f = path.join(DATA, 'benchmarks/tasks', `${file}.jsonl`);
    if (ONLY.has(corpus) && fs.existsSync(f)) evaluate(corpus, own, DATA, asTasks(loadJsonl(f)), { graph: ownGraph });
  }
  if (ONLY.has('jvm')) {
    for (const name of ['spring-petclinic', 'akka']) {
      const dir = path.join(DATA, 'benchmarks', 'repos', name);
      const f = path.join(DATA, 'benchmarks', 'tasks', `retrieval-jvm-${name}.jsonl`);
      if (fs.existsSync(dir) && fs.existsSync(f)) evaluate('jvm', runner.buildSigIndex(dir), dir, asTasks(loadJsonl(f)), { graph: graphOf(dir) });
    }
  }
}

if (ONLY.has('honest')) {
  const tasksDir = path.join(ROOT, 'benchmarks', 'tasks');
  for (const f of fs.readdirSync(tasksDir).filter((x) => x.endsWith('.jsonl')).sort()) {
    const name = f.replace('.jsonl', '');
    if (/^retrieval-(hard|mined|jvm|xrepo)/.test(name)) continue;
    const dir = name === 'retrieval' ? ROOT : path.join(ROOT, 'benchmarks', 'repos', name);
    if (!fs.existsSync(dir)) continue;
    const index = runner.buildSigIndex(dir);
    if (index.size) evaluate('honest', index, dir, asTasks(loadJsonl(path.join(tasksDir, f))), { graph: null });
  }
}

const corpora = ALL.filter((c) => acc[c]);
if (!corpora.length) {
  console.error('No corpus was scored.');
  process.exit(1);
}

// ── report ───────────────────────────────────────────────────────────────────

const net = (m) => m.won - m.lost;
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
console.log('\n  body words: tasks won and lost against plain, at each setting; a cell is net (won/lost)\n');
console.log(`    ${'setting'.padEnd(11)}${corpora.map((c) => `${c} ${acc[c].plain}/${acc[c].tasks}`.padStart(17)).join('')}   ${'all'.padStart(11)}`);
for (const s of settings) {
  const cells = corpora.map((c) => { const m = acc[c].settings[s.id]; return `${signed(net(m))} (${m.won}/${m.lost})`.padStart(17); });
  const won = corpora.reduce((n, c) => n + acc[c].settings[s.id].won, 0);
  const lost = corpora.reduce((n, c) => n + acc[c].settings[s.id].lost, 0);
  console.log(`    ${(s.id + (shipped && s.id === shipped.id ? ' *' : '')).padEnd(11)}${cells.join('')}   ${`${signed(won - lost)} (${won}/${lost})`.padStart(11)}`);
}
if (shipped) console.log(`\n    * the shipped setting: ${shipped.share * 100}% of the files, ${shipped.perFile} words a file`);

if (SAVE) {
  const grid = {};
  for (const s of settings) grid[s.id] = Object.fromEntries(corpora.map((c) => [c, acc[c].settings[s.id]]));
  const report = {
    benchmark: 'body-words-sweep',
    method: 'run-body-words-sweep.mjs: each task ranked with the setting\'s body words, against plain, one index and import graph per repository (the honest corpus without a graph)',
    shipped: { share: bodyWordsLib.DISTINCTIVE_SHARE, perFile: bodyWordsLib.PER_FILE },
    shares: SHARES,
    perFile: PER_FILE,
    plain: Object.fromEntries(corpora.map((c) => [c, { hits: acc[c].plain, tasks: acc[c].tasks }])),
    grid,
  };
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(stamp(report, ROOT), null, 2) + '\n');
  console.log(`\n  saved: ${path.relative(ROOT, REPORT)}`);
}
