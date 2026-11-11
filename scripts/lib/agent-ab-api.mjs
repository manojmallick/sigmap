#!/usr/bin/env node
'use strict';

/**
 * agent-ab-api.mjs — an agent-level A/B runner that talks to the Messages API directly.
 *
 * The Claude Code runner (agent-ab-claude.mjs) is the harness's main route, but it needs an account that may bill Claude Code
 * requests: an API key whose credit answers plain /v1/messages calls can still be refused with "credit balance is too low" on
 * every request carrying Claude Code's `claude-code-20250219` beta. This runner needs nothing but the key. Same contract
 * (`job → record`), same questions, same read-only tools, same scoring, so `run-agent-ab.mjs --agent api` reports through the
 * same code.
 *
 * What differs, and must be read as a difference:
 *   - the agent is this loop, not Claude Code: a short neutral system prompt (about 150 tokens) and four tool definitions, so
 *     the prefix every turn re-reads is far smaller than Claude Code's (about 12k tokens). SigMap's per-turn addition is
 *     therefore a larger share of a turn here than it is in Claude Code.
 *   - cost is COMPUTED from the usage the API reports and a price table, not reported by the agent.
 *   - prompt caching is on: a breakpoint on the system prompt, the tool list and the newest message.
 *
 * Tools, both arms: Read, Grep, Glob (ripgrep, which honours .gitignore, so `.context/` stays out of a search as it does in
 * Claude Code), and Bash limited to the read-only commands of BASH_ALLOW with no shell: the command is split into words and run
 * directly, so a pipe, a redirect, a substitution or a glob is refused rather than interpreted. The SigMap arm adds the `sigmap`
 * CLI to that list and, for the MCP variants, the SigMap MCP server's tools, named `mcp__sigmap__<tool>` as Claude Code names
 * them. Every path must stay inside the checkout.
 *
 * Zero dependencies.
 */

import fs from 'fs';
import path from 'path';
import { spawn, execFile } from 'child_process';
import { BASH_ALLOW, SIGMAP_CLI, SIGMAP_SERVER } from './agent-ab.mjs';

export const API_VERSION = '2023-06-01';
export const DEFAULT_BASE_URL = 'https://api.anthropic.com';
export const MAX_TURNS = 25;
export const MAX_TOKENS = 4096;

export const SYSTEM_PROMPT = [
  'You answer questions about the source code of a repository checked out in the current working directory.',
  'You have read-only tools. Use them efficiently: do not read more than you need, and stop as soon as you can name the answer.',
  'Do not modify anything.',
].join(' ');

/**
 * Prices in USD per million tokens. The three Haiku/Sonnet/Opus 5.5-era figures the shipped table lists give the input price;
 * the rest follow the published multipliers (output 5x input, cache read 0.1x, cache write 1.25x for the 5-minute cache). Haiku 5.5
 * and Haiku 4.5 were checked against 2,700 Claude Code runs whose own reported cost these formulas reproduce exactly (Claude Code
 * writes the 1-hour cache at 2x; this runner writes the 5-minute one at 1.25x). Override with PRICE_IN_PER_MTOK /
 * PRICE_OUT_PER_MTOK when the table is out of date: the Console's usage page is the authority.
 */
export const PRICE_PER_MTOK = Object.freeze({
  'claude-haiku-5-5': { in: 0.1, out: 0.5 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-5-5': { in: 2, out: 10 },
  'claude-opus-5-5': { in: 4, out: 20 },
});

/** @returns {{in:number,out:number,source:string}|null} */
export function priceFor(model, env = process.env) {
  const i = Number(env.PRICE_IN_PER_MTOK); const o = Number(env.PRICE_OUT_PER_MTOK);
  if (Number.isFinite(i) && i > 0 && Number.isFinite(o) && o > 0) return { in: i, out: o, source: 'PRICE_IN_PER_MTOK / PRICE_OUT_PER_MTOK' };
  const p = PRICE_PER_MTOK[String(model).replace(/\./g, '-')];
  return p ? { in: p.in, out: p.out, source: 'built-in table' } : null;
}

/** USD for one set of usage numbers, or null when the model has no price. */
export function costOf(usage, model, env = process.env) {
  const p = priceFor(model, env);
  if (!p) return null;
  const perTok = (x) => x / 1e6;
  return usage.in * perTok(p.in) + usage.out * perTok(p.out) + usage.cacheRead * perTok(p.in * 0.1) + usage.cacheWrite * perTok(p.in * 1.25);
}

// ── tools ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const OUT_CAP = 12000;
const cap = (s, n = OUT_CAP) => (s.length > n ? `${s.slice(0, n)}\n… (output cut at ${n} characters)` : s);

export const TOOL_DEFS = Object.freeze([
  { name: 'Read', description: 'Read a file, with line numbers. Use offset and limit to read a range.', input_schema: { type: 'object', properties: { file_path: { type: 'string', description: 'Path relative to the repository root.' }, offset: { type: 'integer', description: 'First line to read (1-based).' }, limit: { type: 'integer', description: 'Number of lines.' } }, required: ['file_path'] } },
  { name: 'Grep', description: 'Search file contents with a regular expression (ripgrep). Returns path:line:text.', input_schema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string', description: 'Directory or file to search; default the repository root.' }, glob: { type: 'string', description: 'Only files matching this glob, e.g. *.go.' }, case_insensitive: { type: 'boolean' } }, required: ['pattern'] } },
  { name: 'Glob', description: 'List files whose path matches a glob pattern, e.g. **/*.py.', input_schema: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } },
  { name: 'Bash', description: `Run one read-only command (${BASH_ALLOW.join(', ')}). No pipes, redirects, substitutions or wildcards.`, input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
]);

/** Split a command line into words, honouring single and double quotes; null when it uses shell syntax this runner will not run. */
export function splitCommand(line) {
  const words = []; let cur = ''; let q = null; let has = false;
  for (const ch of String(line)) {
    if (q) { if (ch === q) q = null; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
    if (/\s/.test(ch)) { if (has || cur) { words.push(cur); cur = ''; has = false; } continue; }
    if (/[|&;<>$`(){}*?\\]/.test(ch)) return null;
    cur += ch; has = true;
  }
  if (q) return null;
  if (has || cur) words.push(cur);
  return words;
}

function inside(root, p) {
  const abs = path.resolve(root, p || '.');
  let real = abs;
  try { real = fs.realpathSync(abs); } catch (_) { /* not there yet: judged by its spelling */ }
  const base = fs.realpathSync(root);
  if (real !== base && !real.startsWith(base + path.sep)) throw new Error(`path outside the repository: ${p}`);
  return abs;
}

const run = (file, args, opts) => new Promise((resolve) => {
  execFile(file, args, { maxBuffer: 8 * 1024 * 1024, timeout: 30000, encoding: 'utf8', ...opts }, (err, stdout, stderr) => resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: stdout || '', stderr: stderr || '', err }));
});

/** Run one built-in tool in `cwd`. Returns { text, isError }. */
export async function runBuiltin(name, input, { cwd, withSigmap = false, binDir = null }) {
  const i = input && typeof input === 'object' ? input : {};
  try {
    if (name === 'Read') {
      const file = inside(cwd, i.file_path);
      const st = fs.statSync(file);
      if (!st.isFile()) return { text: `not a file: ${i.file_path}`, isError: true };
      const buf = fs.readFileSync(file);
      if (buf.subarray(0, 4096).includes(0)) return { text: `binary file: ${i.file_path}`, isError: true };
      const lines = buf.toString('utf8').split('\n');
      const from = Math.max(1, Number.isInteger(i.offset) ? i.offset : 1);
      const n = Math.min(2000, Number.isInteger(i.limit) && i.limit > 0 ? i.limit : 2000);
      const slice = lines.slice(from - 1, from - 1 + n);
      return { text: cap(slice.map((l, k) => `${String(from + k).padStart(6)}\t${l.length > 2000 ? `${l.slice(0, 2000)}…` : l}`).join('\n'), 40000) || '(empty)', isError: false };
    }
    if (name === 'Grep') {
      if (typeof i.pattern !== 'string' || !i.pattern) return { text: 'pattern is required', isError: true };
      const target = path.relative(cwd, inside(cwd, i.path)) || '.';
      const args = ['-n', '--no-heading', '--color', 'never', '--max-columns', '300', '--max-count', '50'];
      if (i.case_insensitive) args.push('-i');
      if (typeof i.glob === 'string' && i.glob) args.push('--glob', i.glob);
      args.push('-e', i.pattern, '--', target);
      const r = await run('rg', args, { cwd });
      if (r.code === 1 && !r.stdout) return { text: 'No matches found', isError: false };
      if (r.code > 1) return { text: cap(r.stderr || 'grep failed'), isError: true };
      return { text: cap(r.stdout.split('\n').slice(0, 250).join('\n')), isError: false };
    }
    if (name === 'Glob') {
      if (typeof i.pattern !== 'string' || !i.pattern) return { text: 'pattern is required', isError: true };
      const r = await run('rg', ['--files', '--glob', i.pattern, '--color', 'never'], { cwd });
      if (r.code > 1) return { text: cap(r.stderr || 'glob failed'), isError: true };
      const files = r.stdout.split('\n').filter(Boolean).sort();
      return { text: files.length ? cap(files.slice(0, 250).join('\n') + (files.length > 250 ? `\n… ${files.length - 250} more` : '')) : 'No files matched', isError: false };
    }
    if (name === 'Bash') {
      const words = splitCommand(i.command);
      if (!words || !words.length) return { text: 'refused: one plain command only (no pipes, redirects, substitutions, wildcards or quotes left open)', isError: true };
      const allowed = new Set(BASH_ALLOW); if (withSigmap) allowed.add(SIGMAP_CLI);
      if (!allowed.has(words[0])) return { text: `refused: "${words[0]}" is not allowed here (allowed: ${[...allowed].join(', ')})`, isError: true };
      const base = fs.realpathSync(cwd);
      for (const w of words.slice(1)) {
        if (w.split('/').includes('..')) return { text: 'refused: ".." in a path', isError: true };
        if (w.startsWith('/') && !w.startsWith(base + path.sep) && w !== base) return { text: 'refused: absolute path outside the repository', isError: true };
      }
      const env = Object.assign({}, process.env); delete env.ANTHROPIC_API_KEY; delete env.BENCH_ANTHROPIC_KEY;
      if (binDir) env.PATH = binDir + path.delimiter + (env.PATH || '');
      const r = await run(words[0], words.slice(1), { cwd, env, timeout: 20000 });
      return { text: cap((r.stdout + (r.stderr ? `\n${r.stderr}` : '')).trim() || `(exit ${r.code}, no output)`), isError: r.code !== 0 };
    }
    return { text: `unknown tool: ${name}`, isError: true };
  } catch (e) {
    return { text: String(e && e.message ? e.message : e), isError: true };
  }
}

// ── the SigMap MCP server, as a tool source ───────────────────────────────────────────────────────────────────────

/** A minimal MCP client over stdio: initialize, list the tools, call them. One per run, closed at the end. */
export class McpClient {
  constructor(spec, cwd) {
    this.spec = spec; this.cwd = cwd; this.next = 1; this.pending = new Map(); this.buf = '';
  }

  async start() {
    this.proc = spawn(this.spec.command, this.spec.args || [], { cwd: this.cwd, stdio: ['pipe', 'pipe', 'ignore'], env: (() => { const e = Object.assign({}, process.env); delete e.ANTHROPIC_API_KEY; delete e.BENCH_ANTHROPIC_KEY; return e; })() });
    this.proc.stdout.on('data', (d) => {
      this.buf += d;
      let k;
      while ((k = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, k); this.buf = this.buf.slice(k + 1);
        let m; try { m = JSON.parse(line); } catch (_) { continue; }
        if (m && m.id !== undefined && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); clearTimeout(p.timer); p.resolve(m); }
      }
    });
    this.proc.on('exit', () => { for (const p of this.pending.values()) { clearTimeout(p.timer); p.resolve({ error: { message: 'the MCP server exited' } }); } this.pending.clear(); });
    const init = await this.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'agent-ab-api', version: '1' } });
    if (init.error) throw new Error(`MCP initialize failed: ${init.error.message}`);
    this.proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    const list = await this.request('tools/list', {});
    if (list.error || !list.result || !Array.isArray(list.result.tools)) throw new Error('MCP tools/list failed');
    this.tools = list.result.tools;
    return this;
  }

  request(method, params, timeoutMs = 60000) {
    const id = this.next++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.pending.delete(id); resolve({ error: { message: `MCP ${method} timed out` } }); }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  async call(name, args) {
    const r = await this.request('tools/call', { name, arguments: args && typeof args === 'object' ? args : {} });
    if (r.error) return { text: String(r.error.message), isError: true };
    const parts = (r.result && Array.isArray(r.result.content) ? r.result.content : []).map((c) => (c && typeof c.text === 'string' ? c.text : '')).join('\n');
    return { text: cap(parts || '(no output)'), isError: !!(r.result && r.result.isError) };
  }

  close() { try { this.proc.stdin.end(); this.proc.kill(); } catch (_) { /* gone */ } }
}

// ── the Messages API ──────────────────────────────────────────────────────────────────────────────────────────────

async function post({ baseUrl, apiKey, body, timeoutMs, fetchImpl }) {
  let last = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
    let res;
    try {
      res = await fetchImpl(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': API_VERSION, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) { last = { status: 0, error: `network: ${e && e.message ? e.message : e}` }; continue; }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch (_) { /* not json */ }
    if (res.ok && json) return { ok: true, json };
    last = { status: res.status, error: json && json.error ? `${json.error.type}: ${String(json.error.message).slice(0, 200)}` : text.slice(0, 200) };
    if (![429, 500, 502, 503, 504, 529].includes(res.status)) break;
  }
  return { ok: false, ...last };
}

/**
 * The runner: `(job) => record`, the contract run-agent-ab.mjs and runPlan share.
 *
 * @param {object} p
 * @param {string} p.apiKey
 * @param {string} p.model
 * @param {number} p.budgetUsd - stop a run whose computed cost passes this
 * @param {number} p.timeoutMs - the whole run
 * @param {(repo:string, arm:string) => {cwd:string, cwds:string[], sigmapContext?:string, mcpConfig?:string, binDir?:string}} p.arms
 * @param {((job:object, arm:object) => string)|null} [p.prefetch] the pre-ranked block for a question, put after it in the user turn
 */
export function makeApiRunner({ apiKey, model, budgetUsd, timeoutMs, arms, prefetch = null, baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch, maxTurns = MAX_TURNS, env = process.env }) {
  return async (job) => {
    const started = Date.now();
    const arm = arms(job.task.repo, job.arm);
    const withArm = job.arm === 'with';
    const usage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
    const byTool = {}; const byCommand = {}; let total = 0; let turns = 0; let answer = ''; let error = null; let mcp = null; let initInfo = null; let limit = null; let lastText = '';
    const record = (extra) => {
      const usd = costOf(usage, model, env);
      return Object.assign({
        ok: error === null, error, answer: error === null ? answer : '', cwds: arm.cwds || [],
        init: initInfo,
        toolCalls: { total, byTool, byCommand }, usage, usageSource: 'api', cacheGaps: 0,
        cost: usd === null ? { usd: null, source: 'unavailable' } : { usd, source: 'computed' },
        turns, durationMs: Date.now() - started, parseErrors: 0, limit,
      }, extra);
    };
    try {
      let mcpTools = [];
      if (withArm && arm.mcpConfig) {
        const spec = JSON.parse(arm.mcpConfig).mcpServers[SIGMAP_SERVER];
        mcp = await new McpClient(spec, arm.cwd).start();
        mcpTools = mcp.tools.map((t) => ({ name: `mcp__${SIGMAP_SERVER}__${t.name}`, description: t.description || '', input_schema: t.inputSchema && typeof t.inputSchema === 'object' ? t.inputSchema : { type: 'object', properties: {} }, _mcp: t.name }));
      }
      const defs = [...TOOL_DEFS, ...mcpTools.map(({ _mcp, ...d }) => d)];
      const init = { tools: [...TOOL_DEFS.map((t) => t.name), ...mcpTools.map((t) => t.name)], mcpServers: mcp ? [{ name: SIGMAP_SERVER, status: 'connected' }] : [], skills: null, model, apiKeySource: 'ANTHROPIC_API_KEY' };
      const system = [{ type: 'text', text: withArm && arm.sigmapContext && !prefetch ? `${SYSTEM_PROMPT}\n\n${arm.sigmapContext}` : SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }];
      const tools = defs.map((d, k) => (k === defs.length - 1 ? { ...d, cache_control: { type: 'ephemeral' } } : d));
      const first = withArm && prefetch ? `${job.prompt}\n\n${prefetch(job, arm)}` : job.prompt;
      const messages = [{ role: 'user', content: [{ type: 'text', text: first }] }];
      initInfo = init;

      for (; turns < maxTurns;) {
        if (Date.now() - started > timeoutMs) { error = 'timeout'; break; }
        const r = await post({ baseUrl, apiKey, body: { model, max_tokens: MAX_TOKENS, system, tools, messages }, timeoutMs: Math.max(5000, timeoutMs - (Date.now() - started)), fetchImpl });
        turns++;
        if (!r.ok) { error = `api ${r.status || 'error'}: ${r.error}`; break; }
        const u = r.json.usage || {};
        usage.in += u.input_tokens || 0; usage.out += u.output_tokens || 0;
        usage.cacheRead += u.cache_read_input_tokens || 0; usage.cacheWrite += u.cache_creation_input_tokens || 0;
        const content = Array.isArray(r.json.content) ? r.json.content : [];
        const said = content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n').trim();
        if (said) lastText = said;
        messages.push({ role: 'assistant', content });
        const uses = content.filter((b) => b && b.type === 'tool_use');
        if (r.json.stop_reason !== 'tool_use' || !uses.length) {
          answer = content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n').trim();
          if (!answer) error = `no answer (stop_reason ${r.json.stop_reason})`;
          break;
        }
        const results = [];
        for (const b of uses) {
          total++; byTool[b.name] = (byTool[b.name] || 0) + 1;
          let out;
          const m = mcpTools.find((t) => t.name === b.name);
          if (m) out = await mcp.call(m._mcp, b.input);
          else {
            if (b.name === 'Bash') { const w = splitCommand(b.input && b.input.command); const c = w && w[0]; if (c) byCommand[c] = (byCommand[c] || 0) + 1; }
            out = await runBuiltin(b.name, b.input, { cwd: arm.cwd, withSigmap: withArm, binDir: arm.binDir });
          }
          results.push({ type: 'tool_result', tool_use_id: b.id, content: out.text, ...(out.isError ? { is_error: true } : {}) });
        }
        // One breakpoint on the newest message: the earlier ones are dropped so the request never holds more than four.
        for (const msg of messages) if (msg.role === 'user') for (const blk of msg.content) if (blk && blk.cache_control) delete blk.cache_control;
        results[results.length - 1].cache_control = { type: 'ephemeral' };
        messages.push({ role: 'user', content: results });
        const usd = costOf(usage, model, env);
        if (usd !== null && usd > budgetUsd) { limit = `budget: $${usd.toFixed(4)} passed the per-run cap of $${budgetUsd}`; answer = lastText; break; }
      }
      // Not an error: dropping the pair would drop exactly the questions a weak agent cannot finish, and flatter it. The run is
      // scored on whatever it had said (usually nothing that names a file), so it counts as a miss at the cost it incurred.
      if (error === null && !answer && !limit && turns >= maxTurns) { limit = `turn limit (${maxTurns}) reached`; answer = lastText; }
      return record({});
    } catch (e) {
      error = `runner: ${e && e.message ? e.message : e}`;
      return record({});
    } finally {
      if (mcp) mcp.close();
    }
  };
}

/** One tiny Messages API call, for a pre-flight check of a key. */
export async function pingKey({ apiKey, model, baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch }) {
  const r = await post({ baseUrl, apiKey, body: { model, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with the single word: ok' }] }, timeoutMs: 30000, fetchImpl });
  return r.ok ? { ok: true } : { ok: false, error: `${r.status || 'network'} ${r.error}` };
}
