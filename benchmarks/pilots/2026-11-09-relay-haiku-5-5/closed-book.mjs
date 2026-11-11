#!/usr/bin/env node
// Closed book: how many of the 45 questions can a model answer with NO repository and NO tools, from what it already knows
// about these projects? Every repo in the study is a famous open-source framework, so a high rate here means the baseline agent
// is not searching so much as remembering, and there is little for any retrieval tool to add on these questions.
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/closed-book.mjs [model ...]      (default: claude-haiku-5-5 claude-haiku-4-5)
//
// Uses the logged-in Claude Code session (about $0.002 a question for Haiku 5.5, $0.01 for Haiku 4.5). The answer is scored with
// the harness's own scorer (hit@5 on the repository-relative paths named), against the same labelled files. Saves its records to
// closed-book.<model>.json next to this script.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { readTasks, TASKS_REL } = await import(`${ROOT}/scripts/lib/xrepo.mjs`);
const { scoreAnswer, TOP_K } = await import(`${ROOT}/scripts/lib/agent-ab.mjs`);

const IDS = {
  gin: ['x001', 'x002', 'x003', 'x004', 'x005'], flask: ['x032', 'x033', 'x034', 'x035', 'x036'],
  express: ['x037', 'x038', 'x039', 'x040'], fastify: ['x137', 'x138', 'x139', 'x140', 'x141', 'x142', 'x143', 'x144'],
  fastapi: ['x145', 'x146', 'x147', 'x148', 'x149', 'x150', 'x151', 'x152'], django: ['x027', 'x028', 'x029', 'x030', 'x031'],
  rails: ['x084', 'x085', 'x086', 'x087', 'x088'], laravel: ['x046', 'x047', 'x048', 'x049', 'x050'],
};
// TASKS_FILE=<jsonl> asks every question of another label file instead (the unfamiliar-code root's, say), PROJECT=<name> is
// what the prompt calls the project, and TAG=<word> goes into the saved file's name.
const corpus = readTasks(process.env.TASKS_FILE ? path.resolve(process.env.TASKS_FILE) : path.join(ROOT, TASKS_REL));
const tasks = process.env.TASKS_FILE ? corpus
  : Object.entries(IDS).flatMap(([repo, ids]) => ids.map((id) => corpus.find((t) => t.repo === repo && t.id === id)).filter(Boolean));
const PROJECT = process.env.PROJECT || null;
const TAG = process.env.TAG ? `${process.env.TAG}.` : '';
const models = process.argv.slice(2).length ? process.argv.slice(2) : ['claude-haiku-5-5', 'claude-haiku-4-5'];
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'closed-book-'));

const prompt = (t) => [
  `You are answering a question about the source code of the open-source project "${PROJECT || t.repo}". You have no tools and no copy of the code: answer from what you already know of the project.`,
  '',
  `Question: ${t.query}`,
  '',
  `Name the repository-relative path of each file that implements this, most relevant first (at most ${TOP_K}), one per line, in backticks. Then give one sentence on why.`,
].join('\n');

function run(model, t) {
  return new Promise((resolve) => {
    const args = ['-p', '--setting-sources', 'project', '--disable-slash-commands', '--no-session-persistence', '--model', model, '--tools', '', '--permission-mode', 'dontAsk', '--output-format', 'json', '--max-budget-usd', '0.3', '--strict-mcp-config'];
    const env = Object.assign({}, process.env, { CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: '1' }); delete env.CLAUDECODE;
    const p = spawn('claude', args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', () => {});
    const timer = setTimeout(() => p.kill('SIGKILL'), 120000);
    p.on('close', () => {
      clearTimeout(timer);
      let o = null; try { o = JSON.parse(out); } catch (_) { /* leave null */ }
      resolve({ ok: !!o && !o.is_error && typeof o.result === 'string', answer: o && typeof o.result === 'string' ? o.result : '', usd: o && Number.isFinite(o.total_cost_usd) ? o.total_cost_usd : null, turns: o ? o.num_turns : null });
    });
    p.stdin.end(prompt(t));
  });
}

for (const model of models) {
  const records = new Array(tasks.length); let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < tasks.length) { const i = next++; const t = tasks[i]; const r = await run(model, t); records[i] = Object.assign({ repo: t.repo, task: t.id }, r, r.ok ? scoreAnswer(r.answer, t.expected_files) : { pass: false, rank: null, named: [] }); }
  }));
  fs.writeFileSync(path.join(HERE, `closed-book.${TAG}${model}.json`), JSON.stringify(records, null, 1) + '\n');
  const ok = records.filter((r) => r.ok); const hit = ok.filter((r) => r.pass); const top1 = ok.filter((r) => r.rank === 1);
  console.log(`\n${model}: answered ${ok.length}/${records.length}; expected file in the five named: ${hit.length}/${ok.length} (${Math.round(100 * hit.length / Math.max(1, ok.length))}%); named first: ${top1.length}; cost $${records.reduce((s, r) => s + (r.usd || 0), 0).toFixed(3)}`);
  const by = {}; for (const r of ok) { by[r.repo] = by[r.repo] || [0, 0]; by[r.repo][1]++; if (r.pass) by[r.repo][0]++; }
  console.log('  by repo: ' + Object.entries(by).map(([k, v]) => `${k} ${v[0]}/${v[1]}`).join(', '));
}
