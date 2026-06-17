#!/usr/bin/env node
/**
 * SigMap LLM A/B hallucination ablation (IMPL.md §9) — the live runner.
 *
 * Runs a model twice per task — (A) no SigMap context, (B) with SigMap
 * grounding — pipes both outputs through the hallucination guard, and reports
 * the measured delta in flagged codebase-fact errors per 100 outputs.
 *
 * The pure harness lives in src/eval/llm-ablation.js (offline-testable). This
 * script only supplies the live model call + I/O, so the network touch is
 * confined to scripts/ (never the published library surface).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/run-llm-ablation.mjs
 *   ANTHROPIC_API_KEY=sk-... node scripts/run-llm-ablation.mjs --save --model claude-sonnet-4-6
 *
 * Without an API key it prints guidance and exits 0 (skip — never fails CI).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const { runAblation } = require(path.join(ROOT, 'src/eval/llm-ablation.js'));

const save = process.argv.includes('--save');
const modelIdx = process.argv.indexOf('--model');
const MODEL = modelIdx !== -1 && process.argv[modelIdx + 1] ? process.argv[modelIdx + 1] : 'claude-sonnet-4-6';
const API_KEY = process.env.ANTHROPIC_API_KEY;

function loadTasks() {
  const p = path.join(ROOT, 'benchmarks', 'llm-ablation-tasks.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')).tasks || []; } catch (_) { return []; }
}

/** Live model call → completion text. One network request per call. */
async function anthropicComplete(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content || []).map((b) => b.text || '').join('\n');
}

async function main() {
  const tasks = loadTasks();
  if (tasks.length === 0) {
    console.error('No tasks in benchmarks/llm-ablation-tasks.json.');
    process.exit(1);
  }

  if (!API_KEY) {
    console.log('SigMap LLM A/B ablation (IMPL §9)\n');
    console.log('  ⚠ ANTHROPIC_API_KEY not set — skipping the live run.');
    console.log(`  The harness is ready: ${tasks.length} tasks in benchmarks/llm-ablation-tasks.json.`);
    console.log('  Run live with:  ANTHROPIC_API_KEY=sk-... npm run benchmark:llm-ablation');
    process.exit(0);
  }

  console.log(`SigMap LLM A/B ablation — ${MODEL}, ${tasks.length} tasks (2 calls each)\n`);

  // Resolve all calls (the injected `complete` is async-aware via await below).
  const cache = new Map();
  const complete = (prompt) => cache.get(prompt);
  // Pre-fill the cache by running each prompt once (ungrounded + grounded are distinct strings).
  const { buildGrounding } = require(path.join(ROOT, 'src/eval/llm-ablation.js'));
  const grounding = buildGrounding(ROOT);
  for (const t of tasks) {
    const grounded = grounding ? `${grounding}\n\n---\n\n${t.prompt}` : t.prompt;
    for (const p of [t.prompt, grounded]) {
      if (!cache.has(p)) { process.stdout.write(`  · calling model (${t.id})…\n`); cache.set(p, await anthropicComplete(p)); }
    }
  }

  const result = runAblation(tasks, ROOT, complete, { grounding });
  const a = result.aggregate;

  console.log('\n  Task                  without  with');
  console.log('  ' + '─'.repeat(40));
  for (const r of result.tasks) {
    console.log(`  ${String(r.id).padEnd(20)} ${String(r.aFlagged).padStart(6)} ${String(r.bFlagged).padStart(5)}`);
  }
  console.log('  ' + '─'.repeat(40));
  console.log(`  flagged errors per 100 outputs:  without ${a.withoutPer100.toFixed(0)}  →  with ${a.withPer100.toFixed(0)}`);
  console.log(`  measured delta: ${a.delta} fewer flagged across ${a.n} tasks`);

  if (save) {
    const out = path.join(ROOT, 'benchmarks', 'reports', 'llm-ablation.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ benchmark: 'llm-ablation', model: MODEL, ...result }, null, 2));
    console.log(`\n  saved → benchmarks/reports/llm-ablation.json`);
  }
}

main().catch((e) => { console.error(`[llm-ablation] ${e.message}`); process.exit(1); });
