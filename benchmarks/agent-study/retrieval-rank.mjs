#!/usr/bin/env node
// Free, offline: where does SigMap's own ranking put the expected file, on any data root's questions?
//
//   node benchmarks/agent-study/retrieval-rank.mjs                  # the study's 45 famous-framework questions, 8 repos
//   SIGMAP_XREPO_DATA=<root> node benchmarks/agent-study/retrieval-rank.mjs   # every question of that root
//   ... retrieval-rank.mjs --misses      # also list each question whose first result is wrong, and what was returned
//
// It prepares the SigMap arm exactly as the A/B does (index strategy, core profile) and asks the MCP tool `query_context`,
// the one an agent calls. Reported: first / top 3 / top 5 / top 10, and what kind of file took the first place when the
// expected file did not. No model call.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = process.env.SIGMAP_XREPO_DATA ? path.resolve(process.env.SIGMAP_XREPO_DATA) : ROOT;
const require = createRequire(import.meta.url);
const { loadManifest, readTasks, TASKS_REL } = await import(`${ROOT}/scripts/lib/xrepo.mjs`);
const { prepareArm } = await import(`${ROOT}/scripts/lib/agent-ab-arms.mjs`);
const handlers = require(`${ROOT}/src/mcp/handlers.js`);
const { isTestFile, isDocsFile } = require(`${ROOT}/src/util/file-class.js`);

const PILOT = {
  gin: ['x001', 'x002', 'x003', 'x004', 'x005'], flask: ['x032', 'x033', 'x034', 'x035', 'x036'],
  express: ['x037', 'x038', 'x039', 'x040'], fastify: ['x137', 'x138', 'x139', 'x140', 'x141', 'x142', 'x143', 'x144'],
  fastapi: ['x145', 'x146', 'x147', 'x148', 'x149', 'x150', 'x151', 'x152'], django: ['x027', 'x028', 'x029', 'x030', 'x031'],
  rails: ['x084', 'x085', 'x086', 'x087', 'x088'], laravel: ['x046', 'x047', 'x048', 'x049', 'x050'],
};
const manifest = loadManifest(DATA);
const corpus = readTasks(path.join(DATA, TASKS_REL));
const tasks = DATA === ROOT ? corpus.filter((t) => PILOT[t.repo] && PILOT[t.repo].includes(t.id)) : corpus;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'retrieval-rank-'));
process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* best effort */ } });
const arms = {};
for (const n of new Set(tasks.map((t) => t.repo))) arms[n] = prepareArm({ root: DATA, repo: manifest.repos.find((r) => r.name === n), arm: 'with', tmpRoot: tmp, codeRoot: ROOT, variant: 'index' });

const kind = (f) => (isTestFile(f) ? 'test' : (isDocsFile(f) || /\.(md|mdx|rst|txt)$/i.test(f)) ? 'docs/prose' : /(^|\/)(examples?|samples?|docs_src|demo|benchmarks?)\//i.test(f) ? 'example' : 'source');
const showMisses = process.argv.includes('--misses');
const tally = { first: 0, top3: 0, top5: 0, top10: 0 }; const firstKind = {}; const byRepo = {};
for (const t of tasks) {
  const txt = String(handlers.queryContext({ query: t.query, topK: 10 }, arms[t.repo].cwd));
  const got = [...txt.matchAll(/^\| (\d+) \| (\S+) \| ([\d.]+) \|/gm)].map((m) => m[2]);
  const rank = got.findIndex((f) => t.expected_files.includes(f)) + 1;
  byRepo[t.repo] = byRepo[t.repo] || { n: 0, first: 0, top5: 0 }; byRepo[t.repo].n++;
  if (rank === 1) { tally.first++; byRepo[t.repo].first++; }
  if (rank >= 1 && rank <= 3) tally.top3++;
  if (rank >= 1 && rank <= 5) { tally.top5++; byRepo[t.repo].top5++; }
  if (rank >= 1) tally.top10++;
  if (rank !== 1) {
    firstKind[kind(got[0] || '(nothing)')] = (firstKind[kind(got[0] || '(nothing)')] || 0) + 1;
    if (showMisses) console.log(`[${t.repo}/${t.id}] expected at rank ${rank || '>10'}: ${t.expected_files.join(', ')}\n     Q: ${String(t.query).slice(0, 110)}\n     returned: ${got.slice(0, 3).map((f) => `${f} (${kind(f)})`).join(' | ')}`);
  }
}
const pct = (n) => `${n}/${tasks.length} (${Math.round(100 * n / tasks.length)}%)`;
console.log(`\n${tasks.length} questions: expected file first ${pct(tally.first)}, in the top 3 ${pct(tally.top3)}, top 5 ${pct(tally.top5)}, top 10 ${pct(tally.top10)}`);
console.log(`by repo (first / top 5 of n): ${Object.entries(byRepo).map(([k, v]) => `${k} ${v.first}/${v.top5} of ${v.n}`).join(', ')}`);
console.log(`when the first result was wrong, it was: ${Object.entries(firstKind).map(([k, n]) => `${k} ${n}`).join(', ')}`);
