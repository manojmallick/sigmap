#!/usr/bin/env node
// Free, offline: how good is SigMap's `query_context` on every labelled question of the pilot's five repos?
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/retrieval-audit.mjs
//
// Needs the pinned checkouts (npm run fetch:xrepo -- --only gin,flask,express,fastify,fastapi).
// No model call, no key. It prints, over all 30 labelled questions of gin, flask, express, fastify and fastapi:
//   1. how often the expected file is first / in the top 3 / 5 / 10 of what the MCP tool returns
//   2. whether a score-margin rule ("the top file is clearly ahead") can tell a right top-1 from a wrong one:
//      the ranker's own `confidence` is a relative tier within the results, so it cannot
//   3. the same hit rates with each opt-in ranking setting, and with `bodyWords` (on by default) turned off
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const require = createRequire(import.meta.url);
const { loadManifest, readTasks, TASKS_REL } = await import(`${ROOT}/scripts/lib/xrepo.mjs`);
const { prepareArm } = await import(`${ROOT}/scripts/lib/agent-ab-arms.mjs`);
const handlers = require(`${ROOT}/src/mcp/handlers.js`);

const names = ['gin', 'flask', 'express', 'fastify', 'fastapi'];
const manifest = loadManifest(ROOT);
const corpus = readTasks(path.join(ROOT, TASKS_REL));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'retrieval-audit-'));
const arms = {};
for (const n of names) arms[n] = prepareArm({ root: ROOT, repo: manifest.repos.find((r) => r.name === n), arm: 'with', tmpRoot: tmp, codeRoot: ROOT });

/** The ranked table `query_context` returns, as [{file, score}]. */
function ask(n, query, topK) {
  const txt = String(handlers.queryContext({ query, topK }, arms[n].cwd));
  return [...txt.matchAll(/^\| (\d+) \| (\S+) \| ([\d.]+) \|/gm)].map((m) => ({ file: m[2], score: Number(m[3]) }));
}
const tasks = names.flatMap((n) => corpus.filter((t) => t.repo === n).map((t) => Object.assign({ n }, t)));

function rates(retrieval) {
  let t1 = 0; let t3 = 0; let t5 = 0; let t10 = 0;
  for (const n of names) {
    const cfg = path.join(arms[n].cwd, 'gen-context.config.json');
    const base = fs.existsSync(cfg) ? JSON.parse(fs.readFileSync(cfg, 'utf8')) : {};
    fs.writeFileSync(cfg, JSON.stringify(Object.assign({}, base, { retrieval }), null, 2));
    for (const t of tasks.filter((x) => x.n === n)) {
      const files = ask(n, t.query, 10).map((r) => r.file);
      const pos = files.findIndex((f) => t.expected_files.includes(f));
      if (pos === 0) t1++;
      if (pos !== -1 && pos < 3) t3++;
      if (pos !== -1 && pos < 5) t5++;
      if (pos !== -1) t10++;
    }
    fs.writeFileSync(cfg, JSON.stringify(base, null, 2));
  }
  return { t1, t3, t5, t10 };
}

const N = tasks.length;
const d = rates({});
console.log(`1. ${N} labelled questions, default settings: first ${d.t1} (${Math.round(d.t1 / N * 100)}%), top 3 ${d.t3}, top 5 ${d.t5} (${Math.round(d.t5 / N * 100)}%), top 10 ${d.t10}`);

const rows = tasks.map((t) => {
  const r = ask(t.n, t.query, 5);
  return { ok: r.length > 1 && t.expected_files.includes(r[0].file), ratio: r.length > 1 ? r[0].score / r[1].score : 0 };
}).filter((x) => x.ratio > 0);
console.log('\n2. "top file is clearly ahead" when top1/top2 >= R:   fires on   top-1 right when it fires');
for (const R of [1.05, 1.15, 1.30, 1.50]) {
  const f = rows.filter((x) => x.ratio >= R);
  const ok = f.filter((x) => x.ok).length;
  console.log(`   R=${R.toFixed(2)}`.padEnd(46), `${f.length}/${rows.length}`.padEnd(10), f.length ? `${ok}/${f.length} (${Math.round(ok / f.length * 100)}%)` : '-');
}

console.log('\n3. setting'.padEnd(34), 'first   top 3   top 5   top 10');
const settings = {
  'default': {},
  '+callGraphBoost': { callGraphBoost: true },
  '+centralityBlend (deprecated)': { centralityBlend: true },
  '+surfaceEnrichment (deprecated)': { surfaceEnrichment: true },
  '+minedExpansions': { minedExpansions: true },
  'bodyWords off': { bodyWords: false },
  'all four opt-ins on': { callGraphBoost: true, centralityBlend: true, surfaceEnrichment: true, minedExpansions: true },
};
for (const [label, retrieval] of Object.entries(settings)) {
  const r = label === 'default' ? d : rates(retrieval);
  const p = (x) => `${x}/${N}`.padEnd(8);
  console.log(`   ${label}`.padEnd(34), p(r.t1), p(r.t3), p(r.t5), p(r.t10));
}
fs.rmSync(tmp, { recursive: true, force: true });
