#!/usr/bin/env node
// Free, offline audit of the SigMap arm of the agent A/B: no model call, no key.
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/arm-audit.mjs [repo,repo,...]
//
// Needs the pinned checkouts (npm run fetch:xrepo -- --only gin,flask,express,fastify,fastapi).
// For the first 2 questions of each repo (the pilot's selection) it prints:
//   - what the agent is handed on every turn: the MCP tool definitions (all 22 tools, and the 7-tool "core"
//     profile) and the generated section appended to the system prompt, in estimated tokens (bytes / 4)
//   - whether the section lists the files that answer the questions
//   - where the expected file lands in SigMap's own ranking, and whether the MCP `query_context` tool,
//     the one the agent called, returned it in its top 5
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const require = createRequire(import.meta.url);
const { loadManifest, readTasks, TASKS_REL } = await import(`${ROOT}/scripts/lib/xrepo.mjs`);
const { prepareArm } = await import(`${ROOT}/scripts/lib/agent-ab-arms.mjs`);
const { selectTasks } = await import(`${ROOT}/scripts/lib/agent-ab.mjs`);
const core = require(`${ROOT}/packages/core/index.js`);
const handlers = require(`${ROOT}/src/mcp/handlers.js`);

const names = (process.argv[2] || 'gin,flask,express,fastify,fastapi').split(',');
const tok = (s) => Math.round(Buffer.byteLength(s) / 4);
const manifest = loadManifest(ROOT);
const tasks = selectTasks(readTasks(path.join(ROOT, TASKS_REL)), names, { perRepo: 2 });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arm-audit-'));

const init = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'audit', version: '1' } } }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }];
const r = spawnSync(process.execPath, [`${ROOT}/gen-context.js`, '--mcp'], { cwd: ROOT, input: `${init.map((m) => JSON.stringify(m)).join('\n')}\n`, encoding: 'utf8', timeout: 30000 });
let tools = [];
for (const l of r.stdout.split('\n')) { try { const m = JSON.parse(l); if (m.id === 2) tools = m.result.tools; } catch (_) { /* not a response */ } }
const CORE = ['query_context', 'read_context', 'get_callee_signatures', 'get_lines', 'get_impact', 'get_method_impact', 'verify_suggestion'];
console.log(`MCP tool definitions, sent every turn: ${tools.length} tools ≈ ${tok(JSON.stringify(tools))} tokens; the 7-tool "core" profile ≈ ${tok(JSON.stringify(tools.filter((t) => CORE.includes(t.name))))}`);

let hit = 0; let inTop5 = 0; const rows = [];
for (const n of names) {
  const arm = prepareArm({ root: ROOT, repo: manifest.repos.find((x) => x.name === n), arm: 'with', tmpRoot: tmp });
  const listed = (arm.sigmapContext.match(/^### .+$/gm) || []).map((l) => l.slice(4));
  const omitted = (arm.sigmapContext.match(/(\d+) file\(s\) omitted/) || [])[1] || '0';
  const idx = core.buildSigIndex(arm.cwd);
  console.log(`\n${n}: section ≈ ${tok(arm.sigmapContext)} tokens, lists ${listed.length} of ${idx.size} files (${omitted} omitted); ${listed.filter((f) => /^(examples?|docs?|test|tests)\//.test(f)).length} of those are examples/docs/tests`);
  for (const t of tasks.filter((x) => x.repo === n)) {
    const ranked = core.rank(t.query, idx, { topK: 10 }).map((x) => x.file);
    const pos = ranked.findIndex((f) => t.expected_files.includes(f));
    const qc = String(handlers.queryContext({ query: t.query, topK: 5 }, arm.cwd));
    const inSection = t.expected_files.some((e) => listed.includes(e));
    const got = t.expected_files.some((e) => qc.includes(e));
    if (pos !== -1 && pos < 5) hit++;
    if (got) inTop5++;
    rows.push(t);
    console.log(`  ${t.id}  expected ${t.expected_files[0]}: in section ${inSection ? 'yes' : 'NO '} | basic ranker ${pos === -1 ? 'not in top 10' : `rank ${pos + 1}`} | query_context(5) ${got ? 'returns it' : 'MISSES it'} (~${tok(qc)} tokens)`);
  }
}
console.log(`\nbasic ranker hit@5: ${hit}/${rows.length}; MCP query_context(topK=5) returned the expected file: ${inTop5}/${rows.length}`);
fs.rmSync(tmp, { recursive: true, force: true });
