#!/usr/bin/env node
// Free, offline: what each SigMap context strategy injects on the pilot's five repos, and whether retrieval changes.
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/strategy-audit.mjs
//
// Needs the pinned checkouts (npm run fetch:xrepo -- --only gin,flask,express,fastify,fastapi). No model call, no key.
// For each strategy (full, index, per-module, hot-cold) it regenerates the SigMap arm and prints the always-on section
// in estimated tokens (bytes / 4) per repo, and how often `query_context` puts the expected file first / in the top 5
// over all 30 labelled questions. The pinned checkouts hold ONE commit, so hot-cold's "recently changed" set is every
// file: its number here is an artefact of the harness, not a property of the strategy.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const require = createRequire(import.meta.url);
const { loadManifest, readTasks, TASKS_REL, zeroConfigEnv } = await import(`${ROOT}/scripts/lib/xrepo.mjs`);
const { prepareArm } = await import(`${ROOT}/scripts/lib/agent-ab-arms.mjs`);
const { findManagedSection } = require(`${ROOT}/src/util/managed-section.js`);
const handlers = require(`${ROOT}/src/mcp/handlers.js`);

const names = ['gin', 'flask', 'express', 'fastify', 'fastapi'];
const manifest = loadManifest(ROOT);
const corpus = readTasks(path.join(ROOT, TASKS_REL));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'strategy-audit-'));
const tok = (s) => Math.round(Buffer.byteLength(s) / 4);
const arms = {};
for (const n of names) arms[n] = prepareArm({ root: ROOT, repo: manifest.repos.find((r) => r.name === n), arm: 'with', tmpRoot: tmp, codeRoot: ROOT });
const commits = (cwd) => { try { return execFileSync('git', ['-C', cwd, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (_) { return '?'; } };
console.log(`commits in the pinned checkouts: ${names.map((n) => `${n}=${commits(arms[n].cwd)}`).join('  ')}`);
console.log(`\nstrategy      always-on section, tokens (${names.join(' ')})   mean | first / top 5 of 30`);
for (const strategy of ['full', 'index', 'per-module', 'hot-cold']) {
  const sizes = []; let t1 = 0; let t5 = 0; let N = 0;
  for (const n of names) {
    const cwd = arms[n].cwd;
    const cfg = path.join(cwd, 'gen-context.config.json');
    const base = fs.existsSync(cfg) ? JSON.parse(fs.readFileSync(cfg, 'utf8')) : {};
    fs.writeFileSync(cfg, JSON.stringify(Object.assign({}, base, { strategy }), null, 2));
    fs.rmSync(path.join(cwd, '.context'), { recursive: true, force: true });
    execFileSync(process.execPath, [`${ROOT}/gen-context.js`, '--adapter', 'claude'], { cwd, env: zeroConfigEnv(), stdio: ['ignore', 'ignore', 'pipe'] });
    const md = fs.readFileSync(path.join(cwd, 'CLAUDE.md'), 'utf8');
    const sec = findManagedSection(md);
    sizes.push(sec ? tok(md.slice(sec.index).trim()) : 0);
    for (const t of corpus.filter((x) => x.repo === n)) {
      const txt = String(handlers.queryContext({ query: t.query, topK: 5 }, cwd));
      const files = [...txt.matchAll(/^\| (\d+) \| (\S+) \| ([\d.]+) \|/gm)].map((m) => m[2]);
      N++;
      if (files[0] && t.expected_files.includes(files[0])) t1++;
      if (files.some((f) => t.expected_files.includes(f))) t5++;
    }
  }
  console.log(strategy.padEnd(13), sizes.map((x) => String(x).padStart(6)).join(' '), '   ', String(Math.round(sizes.reduce((a, b) => a + b) / sizes.length)).padStart(6), '|', `${t1}/${N}  ${t5}/${N}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
