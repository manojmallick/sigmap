#!/usr/bin/env node
'use strict';

/**
 * run-head-to-head.mjs — SigMap, codebase-memory-mcp and code-review-graph on the same questions (#972).
 *
 *   node scripts/run-head-to-head.mjs --exploratory --out <dir> [--root <data root>] [--tasks 1-83]
 *                                     [--only gin,flask] [--tools codebase-memory-mcp,code-review-graph]
 *
 * For every task of the third-party (xrepo) corpus, SigMap's ranker and each rival's own documented
 * search command are asked the same question over the same pinned clone, and the answers are scored with
 * one scorer: hit@5 and MRR@10, at file level (scripts/lib/head-to-head.mjs says how nodes become files and
 * how every ambiguity is resolved in the rival's favour). A task whose expected files a rival has no
 * nodes for is `unsupported` for it and is reported apart, never counted as a miss.
 *
 * EXPLORATORY: the numbers of this mode are for reading Gate G1 (issue #972, plan step 8) and are NOT
 * published. It therefore writes only under --out, and refuses an --out inside this repository's
 * benchmarks/ directory. The published run is step 15, on the enlarged corpus.
 *
 * Isolation: rivals are never dependencies. They are downloaded to benchmarks/rivals/ (self-ignoring), checked
 * against the SHA-256 pinned in benchmarks/rivals.json before they are run, and run with a scratch HOME.
 *
 * Resumable: each repository's raw answers are kept in <out>/raw/<repo>.json; a repository with a file
 * there is not asked again (--force to redo).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { loadManifest, checkoutState, readTasks, withZeroConfigIndex, TASKS_REL } from './lib/xrepo.mjs';
import { loadRivals, rivalsDir, ensureCbm, ensureCrg } from './lib/rivals/fetch.mjs';
import { cbmAdapter, crgAdapter } from './lib/rivals/adapters.mjs';
import { runRivalsOnRepo } from './lib/head-to-head-run.mjs';
import { scoreRecords, compare, gateG1, costs, K, MRR_CUT } from './lib/head-to-head.mjs';

const { isTestFile, isMockFile, isGeneratedFile } = createRequire(import.meta.url)('../src/util/file-class.js');

const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { run } = require(path.join(CODE_ROOT, 'src/eval/runner'));

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };

function fail(msg) { console.error(`[head-to-head] ${msg}`); process.exit(1); }

if (!has('--exploratory')) fail('only --exploratory is implemented: the published head-to-head is plan step 15, on the enlarged corpus (#984)');
const outArg = val('--out', null);
if (!outArg) fail('--out <dir> is required (exploratory numbers are not written into the repository)');
const OUT = path.resolve(outArg);
const bench = path.join(CODE_ROOT, 'benchmarks') + path.sep;
if ((OUT + path.sep).startsWith(bench)) fail(`refusing to write exploratory numbers under ${bench}: they are not published (use a directory outside benchmarks/)`);

const DATA = path.resolve(val('--root', CODE_ROOT));
const [lo, hi] = val('--tasks', '1-83').split('-').map(Number);
const ONLY = val('--only', null) ? new Set(val('--only').split(',')) : null;
const TOOLS = new Set((val('--tools', 'codebase-memory-mcp,code-review-graph')).split(','));
const FORCE = has('--force');
const idNum = (id) => Number(String(id).replace(/^\D+/, ''));
const log = (m) => console.log(m);

const manifest = loadManifest(DATA);
const all = readTasks(path.join(DATA, TASKS_REL)).filter((t) => idNum(t.id) >= lo && idNum(t.id) <= hi);
const repos = manifest.repos.filter((r) => (!ONLY || ONLY.has(r.name)) && all.some((t) => t.repo === r.name));
fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true });

// ---- the rivals --------------------------------------------------------------------------------
const rivals = loadRivals();
const dir = rivalsDir();
const adapters = [];
const install = {};
if (TOOLS.has('codebase-memory-mcp')) {
  const r = await ensureCbm(rivals.tools['codebase-memory-mcp'], { dir });
  install['codebase-memory-mcp'] = { version: r.version, sha256: r.sha256, installMs: r.installMs, reused: r.reused };
  adapters.push(cbmAdapter({ bin: r.bin, home: path.join(dir, 'home', 'codebase-memory-mcp') }));
}
if (TOOLS.has('code-review-graph')) {
  const r = ensureCrg(rivals.tools['code-review-graph'], { dir });
  install['code-review-graph'] = { version: r.version, sha256: r.sha256, installMs: r.installMs, reused: r.reused, freeze: r.freeze.trim().split('\n') };
  adapters.push(crgAdapter({ bin: r.bin, home: path.join(dir, 'home', 'code-review-graph') }));
}
log(`[head-to-head] rivals: ${adapters.map((a) => a.id).join(', ')}; ${repos.length} repositories, tasks x${String(lo).padStart(3, '0')}-x${String(hi).padStart(3, '0')}`);

// ---- per repository ---------------------------------------------------------------------------
const records = [];
const perTool = Object.fromEntries(adapters.map((a) => [a.id, { installMs: install[a.id].installMs, index: [], tokens: [], errors: [] }]));
for (const repo of repos) {
  const st = checkoutState(DATA, repo);
  if (!st.present) { log(`  SKIP ${repo.name}: no checkout under ${path.join(DATA, 'benchmarks', 'repos')}`); continue; }
  const tasks = all.filter((t) => t.repo === repo.name);
  const rawFile = path.join(OUT, 'raw', `${repo.name}.json`);
  let raw = !FORCE && fs.existsSync(rawFile) ? JSON.parse(fs.readFileSync(rawFile, 'utf8')) : null;
  if (!raw) {
    log(`[${repo.name}] ${tasks.length} task(s)`);
    // SigMap: the xrepo gate's own zero-config index and ranker, over the same questions
    const sigmap = withZeroConfigIndex(DATA, repo, ({ dir: cdir, index }) => {
      const tmp = path.join(OUT, `.tasks-${repo.name}.jsonl`);
      fs.writeFileSync(tmp, tasks.map((t) => JSON.stringify({ id: t.id, query: t.query, expected_files: t.expected_files, repo: '.' })).join('\n') + '\n');
      const r = run(tmp, cdir, { topK: MRR_CUT, learned: false });
      fs.rmSync(tmp, { force: true });
      const byTask = {};
      for (const t of r.tasks) byTask[t.id] = { files: t.ranked };
      for (const t of tasks) byTask[t.id].reachable = t.expected_files.some((f) => index.has(f));
      return byTask;
    });
    const riv = runRivalsOnRepo({ dir: st.dir, tasks, adapters, log });
    raw = { repo: repo.name, sigmap, rivals: riv.byTool };
    fs.writeFileSync(rawFile, JSON.stringify(raw, null, 2) + '\n');
  } else log(`[${repo.name}] reused ${path.relative(process.cwd(), rawFile)}`);
  for (const t of tasks) {
    const rec = { id: t.id, repo: t.repo, split: t.split, expected: t.expected_files, sigmap: raw.sigmap[t.id], rivals: {} };
    for (const [tool, r] of Object.entries(raw.rivals)) rec.rivals[tool] = r.tasks[t.id];
    records.push(rec);
  }
  for (const [tool, r] of Object.entries(raw.rivals)) {
    if (!perTool[tool]) continue;
    if (r.index) perTool[tool].index.push(r.index);
    if (r.error) perTool[tool].errors.push({ repo: repo.name, error: r.error });
    for (const t of Object.values(r.tasks)) for (const a of Object.values(t.arms)) perTool[tool].tokens.push(a.tokens);
  }
}

// ---- score, compare, read G1 -------------------------------------------------------------------
const scored = scoreRecords(records, { derived: { '+src': (f) => !isTestFile(f) && !isMockFile(f) && !isGeneratedFile(f) } });
const summary = compare(scored);
const g1 = gateG1(scored);
const report = {
  kind: 'exploratory head-to-head (NOT published: plan step 8, Gate G1)',
  generated: new Date().toISOString(),
  scorer: { hitAt: K, mrrCut: MRR_CUT, level: 'file', note: 'one scorer for SigMap and every rival arm; ambiguities resolved in the rival\'s favour (suffix matches, best arm per task, and a +src variant of every arm that leaves out test, mock and generated files, which SigMap\'s own ranker demotes); unsupported tasks reported separately' },
  corpus: { tasks: records.length, ids: `x${String(lo).padStart(3, '0')}-x${String(hi).padStart(3, '0')}`, repos: repos.map((r) => r.name), file: TASKS_REL },
  rivals: Object.fromEntries(Object.entries(install).map(([k, v]) => [k, { ...v, readme: rivals.tools[k].readme, readOn: rivals.tools[k].readOn }])),
  costs: costs(perTool),
  errors: Object.fromEntries(Object.entries(perTool).map(([k, v]) => [k, v.errors])),
  summary,
  g1,
};
fs.writeFileSync(path.join(OUT, 'head-to-head-exploratory.json'), JSON.stringify(report, null, 2) + '\n');
log(`[head-to-head] wrote ${path.join(OUT, 'head-to-head-exploratory.json')}`);

const pct = (x) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
log('\nAll tasks (an unsupported or unreachable task counts as a miss):');
for (const [k, a] of Object.entries(summary.all)) log(`  ${k.padEnd(40)} hit@5 ${pct(a.hit5)} (${a.hits}/${a.n})  MRR@10 ${a.mrr === null ? 'n/a' : a.mrr.toFixed(3)}  95% ${pct(a.low)}-${pct(a.high)}`);
log('\nTasks both can index (the table Gate G1 reads):');
for (const [tool, b] of Object.entries(summary.bothIndexed)) {
  log(`  vs ${tool}: ${b.tasks} tasks; SigMap ${pct(b.sigmap.hit5)} (${b.sigmap.hits})`);
  for (const [arm, a] of Object.entries(b.arms)) log(`    ${arm.padEnd(10)} ${pct(a.hit5)} (${a.hits})  MRR ${a.mrr === null ? 'n/a' : a.mrr.toFixed(3)}`);
}
log(`\nGate G1: ${g1.decision}`);
if (g1.best) log(`  best rival arm ${g1.best.tool}/${g1.best.arm}: ${g1.best.leadPoints.toFixed(1)} points ${g1.best.leadPoints >= 0 ? 'ahead of' : 'behind'} SigMap on ${g1.best.tasks} tasks; rival-only wins ${g1.best.rivalOnlyWins.length}, in graph-blind repos ${g1.graphBlindShare === null ? 'n/a' : pct(g1.graphBlindShare)}`);
