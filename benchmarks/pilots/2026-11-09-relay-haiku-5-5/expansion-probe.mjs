#!/usr/bin/env node
// Does it help SigMap's ranking when a model first adds the words a programmer would have used?
//
//   SIGMAP_XREPO_DATA=<root> TAG=<word> node benchmarks/pilots/2026-11-09-relay-haiku-5-5/expansion-probe.mjs [model=claude-haiku-5-5]
//   SIGMAP_XREPO_DATA=<root> TAG=<word> node .../expansion-probe.mjs --offline      # re-score a saved expansion-probe.<TAG>.json
//
// SigMap ranks by matching words, and its own gate shows most misses are files that share no word with the question ("stop
// credentials from leaking" against a file that says `secretScan` and `redact`). A model cannot see the repository either, but
// it knows the vocabulary: asked with NO tools and NO code, it lists 8 to 12 words the implementing code would likely contain,
// and the question is ranked again with those words appended. Both rankings use `query_context`, the tool an agent calls.
//
// What this measures is the ranking only (first / top 3 / top 5 / top 10), not an agent run. It costs one small model call a
// question on the logged-in session; the words are saved so the scoring can be repeated offline.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.SIGMAP_XREPO_DATA ? path.resolve(process.env.SIGMAP_XREPO_DATA) : null;
if (!DATA) { console.error('set SIGMAP_XREPO_DATA to a data root (make-unfamiliar-root.mjs builds one)'); process.exit(2); }
const TAG = process.env.TAG || 'probe';
const OFFLINE = process.argv.includes('--offline');
const model = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'claude-haiku-5-5';
const saved = path.join(HERE, `expansion-probe.${TAG}.json`);
const require = createRequire(import.meta.url);
const { loadManifest, readTasks, TASKS_REL } = await import(`${ROOT}/scripts/lib/xrepo.mjs`);
const { prepareArm } = await import(`${ROOT}/scripts/lib/agent-ab-arms.mjs`);
const handlers = require(`${ROOT}/src/mcp/handlers.js`);

const manifest = loadManifest(DATA);
const tasks = readTasks(path.join(DATA, TASKS_REL));
// The agent leaves empty placeholder files (package.json, .env, ...) in the directory it starts in, and an empty package.json in
// the system temp directory breaks every Node script below it: give it a directory of its own.
const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expansion-cwd-'));
const ask = (q) => `A developer asks this about a codebase you cannot see: "${q}"\n\nList 8 to 12 lowercase words or identifier fragments that the code implementing it would likely contain in its file names, function names or comments: synonyms, and the technical terms a programmer would use. One line, comma-separated, nothing else.`;

function expand(q) {
  return new Promise((resolve) => {
    const args = ['-p', '--setting-sources', 'project', '--disable-slash-commands', '--no-session-persistence', '--model', model, '--tools', '', '--permission-mode', 'dontAsk', '--output-format', 'json', '--max-budget-usd', '0.2', '--strict-mcp-config'];
    const env = Object.assign({}, process.env, { CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: '1' }); delete env.CLAUDECODE;
    const p = spawn('claude', args, { cwd: emptyDir, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', () => {});
    const timer = setTimeout(() => p.kill('SIGKILL'), 90000);
    p.on('close', () => {
      clearTimeout(timer);
      let o = null; try { o = JSON.parse(out); } catch (_) { /* null */ }
      const text = o && !o.is_error && typeof o.result === 'string' ? o.result : '';
      // Words only: letters, digits, underscore; nothing that could be a path or a sentence.
      const words = [...new Set(text.toLowerCase().split(/[,\n]/).map((w) => w.trim().replace(/[^a-z0-9_ -]/g, '')).filter((w) => w && w.length <= 30 && w.split(/\s+/).length <= 2))].slice(0, 12);
      resolve({ words, usd: o && Number.isFinite(o.total_cost_usd) ? o.total_cost_usd : null });
    });
    p.stdin.end(ask(q));
  });
}

let records;
if (OFFLINE) {
  records = JSON.parse(fs.readFileSync(saved, 'utf8')).records;
} else {
  records = new Array(tasks.length); let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < tasks.length) { const i = next++; const r = await expand(tasks[i].query); records[i] = { id: tasks[i].id, repo: tasks[i].repo, words: r.words, usd: r.usd }; }
  }));
  fs.writeFileSync(saved, JSON.stringify({ model, prompt: ask('<question>'), records }, null, 1) + '\n');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'expansion-'));
process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* best effort */ } });
const arms = {};
for (const n of new Set(tasks.map((t) => t.repo))) arms[n] = prepareArm({ root: DATA, repo: manifest.repos.find((r) => r.name === n), arm: 'with', tmpRoot: tmp, codeRoot: ROOT, variant: 'index' });
const rankOf = (t, query) => {
  const txt = String(handlers.queryContext({ query, topK: 10 }, arms[t.repo].cwd));
  const got = [...txt.matchAll(/^\| (\d+) \| (\S+) \| ([\d.]+) \|/gm)].map((m) => m[2]);
  return got.findIndex((f) => t.expected_files.includes(f)) + 1;
};
const tally = () => ({ first: 0, top3: 0, top5: 0, top10: 0 });
const add = (s, r) => { if (r === 1) s.first++; if (r >= 1 && r <= 3) s.top3++; if (r >= 1 && r <= 5) s.top5++; if (r >= 1) s.top10++; };
const plain = tally(); const wide = tally(); let better = 0; let worse = 0; let empty = 0;
const byId = new Map(records.map((r) => [`${r.repo}/${r.id}`, r]));
for (const t of tasks) {
  const rec = byId.get(`${t.repo}/${t.id}`);
  const words = rec && Array.isArray(rec.words) ? rec.words : [];
  if (!words.length) empty++;
  const a = rankOf(t, t.query); const b = words.length ? rankOf(t, `${t.query} ${words.join(' ')}`) : a;
  add(plain, a); add(wide, b);
  const eff = (r) => (r === 0 ? 99 : r);
  if (eff(b) < eff(a)) better++; else if (eff(b) > eff(a)) worse++;
}
const n = tasks.length; const pct = (x) => `${x}/${n} (${Math.round(100 * x / n)}%)`;
console.log(`\n${n} questions (${TAG}), ranking by query_context; expansion words from ${OFFLINE ? 'the saved file' : model}${empty ? `; ${empty} question(s) got no words and keep their plain rank` : ''}`);
console.log(`  the question as asked:        first ${pct(plain.first)}, top 3 ${pct(plain.top3)}, top 5 ${pct(plain.top5)}, top 10 ${pct(plain.top10)}`);
console.log(`  + words a model would expect: first ${pct(wide.first)}, top 3 ${pct(wide.top3)}, top 5 ${pct(wide.top5)}, top 10 ${pct(wide.top10)}`);
console.log(`  expected file ranked higher in ${better} questions, lower in ${worse}, the same in ${n - better - worse}`);
if (!OFFLINE) console.log(`  cost of the expansions: $${records.reduce((s, r) => s + (r.usd || 0), 0).toFixed(3)}`);
