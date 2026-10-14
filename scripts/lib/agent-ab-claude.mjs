#!/usr/bin/env node
'use strict';

/**
 * agent-ab-claude.mjs — the Claude Code adapter of the agent-level A/B harness (#955).
 *
 * One headless `claude -p` run per call, read back from its `stream-json` event
 * stream. The runner contract the harness depends on is only `job → record`, so
 * another agent is a second file of this shape, not a change to the method.
 *
 * Isolation is the point of the argument list:
 *
 *   --bare                 no CLAUDE.md auto-discovery, hooks, auto-memory or
 *                          keychain. The operator's own global instructions
 *                          (which may well say "use sigmap") cannot reach the
 *                          no-SigMap arm. It authenticates with
 *                          ANTHROPIC_API_KEY only — that is the provider gate.
 *   --strict-mcp-config    MCP servers come from this call and nowhere else.
 *   --tools / --allowedTools / --permission-mode dontAsk
 *                          the read-only allowlist is the same in both arms
 *                          (Read, Grep, Glob and a Bash limited to a few
 *                          read-only commands); the SigMap arm alone adds the
 *                          `sigmap` CLI and its MCP server. A tool outside the
 *                          list is denied, never prompted for.
 *   the prompt on stdin    not in argv, so a variadic flag cannot swallow it.
 *
 * The stream format is the agent's, not ours, so everything read from it is
 * untrusted: a line that does not parse is counted, a count that is not a
 * finite non-negative number is dropped, and a run with no `result` event is a
 * failed run — never a zero.
 *
 * No shell: the binary is spawned with an argument array.
 *
 * Zero dependencies.
 */

import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { BUILTIN_TOOLS, BASH_ALLOW, SIGMAP_SERVER, SIGMAP_CLI, costFloor } from './agent-ab.mjs';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_BUDGET_USD = 1;
export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

// A run that prints more than this is not a question about where a file is.
const MAX_STDOUT_BYTES = 64 * 1024 * 1024;

// The context rides in ONE argv entry, and Linux refuses an entry over 128 KiB.
const MAX_CONTEXT_BYTES = 120 * 1024;

/**
 * The argument array for one run. The two arms differ ONLY by the SigMap
 * additions at the end, which is what the tests pin.
 *
 * @param {{ arm: 'without'|'with', model: string, budgetUsd: number, sigmapContext?: string, mcpConfig?: string }} p
 * @returns {string[]}
 */
export function buildArgs({ arm, model, budgetUsd, sigmapContext, mcpConfig }) {
  const allowed = [
    ...BUILTIN_TOOLS.filter((t) => t !== 'Bash'),
    ...BASH_ALLOW.map((c) => `Bash(${c}:*)`),
  ];
  if (arm === 'with') allowed.push(`Bash(${SIGMAP_CLI}:*)`, `mcp__${SIGMAP_SERVER}`);
  const args = [
    '-p', '--bare',
    '--output-format', 'stream-json', '--verbose',
    '--no-session-persistence',
    '--model', model,
    '--tools', BUILTIN_TOOLS.join(','),
    '--allowedTools', allowed.join(','),
    '--permission-mode', 'dontAsk',
    '--max-budget-usd', String(budgetUsd),
    '--strict-mcp-config',
  ];
  if (arm === 'with') {
    if (!sigmapContext || !mcpConfig) throw new Error('the SigMap arm needs its generated context and its MCP config');
    if (Buffer.byteLength(sigmapContext) > MAX_CONTEXT_BYTES) {
      throw new Error(`the generated context is ${Buffer.byteLength(sigmapContext)} bytes; one argument may not exceed ${MAX_CONTEXT_BYTES} (Linux caps it at 128 KiB)`);
    }
    args.push('--mcp-config', mcpConfig, '--append-system-prompt', sigmapContext);
  }
  return args;
}

/**
 * The environment a run sees: ours, minus the nested-session guard, and asking
 * the agent to keep provider credentials out of the subprocesses it starts. The
 * shell the arms get can read files, and a key in a child's environment is one
 * `grep` away on Linux. Best effort: the flag is the agent's to honour.
 */
export function childEnv(base = process.env) {
  const env = Object.assign({}, base, { CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: '1' });
  delete env.CLAUDECODE;
  return env;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const str = (v) => (typeof v === 'string' && v ? v.slice(0, 200) : null);

/**
 * Read one run's `stream-json` output.
 *
 * Tool calls are the `tool_use` blocks of main-thread assistant messages, once
 * per block id. Usage is the `result` event's own total; if that is absent the
 * per-message usage is summed once per message id (the host repeats a message
 * across content blocks). A cache category not reported by EVERY message is
 * `null`; when only some omitted it, `cacheGaps` counts them.
 *
 * @param {string} text
 */
export function parseStream(text) {
  const out = {
    init: null,
    toolCalls: { total: 0, byTool: {}, byCommand: {} },
    usage: null, usageSource: 'unavailable', cacheGaps: 0,
    costUsd: null, turns: null,
    result: false, isError: false, subtype: null, answer: null,
    parseErrors: 0,
  };
  const seenTool = new Set();
  const seenMessage = new Set();
  const sum = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
  let messages = 0;
  let missingRead = 0;
  let missingWrite = 0;

  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let o;
    try { o = JSON.parse(t); } catch (_) { out.parseErrors++; continue; }
    if (!o || typeof o !== 'object') continue;

    if (o.type === 'system' && o.subtype === 'init') {
      out.init = {
        tools: Array.isArray(o.tools) ? o.tools.map(String) : null,
        mcpServers: Array.isArray(o.mcp_servers)
          ? o.mcp_servers.filter((s) => s && typeof s === 'object').map((s) => ({ name: String(s.name), status: str(s.status) }))
          : [],
        model: str(o.model),
        apiKeySource: str(o.apiKeySource),
      };
    } else if (o.type === 'assistant' && o.message && typeof o.message === 'object') {
      if (o.parent_tool_use_id) continue; // a sub-agent's own calls are not the main thread's
      for (const b of Array.isArray(o.message.content) ? o.message.content : []) {
        if (!b || b.type !== 'tool_use' || typeof b.name !== 'string') continue;
        if (typeof b.id === 'string') {
          if (seenTool.has(b.id)) continue;
          seenTool.add(b.id);
        }
        out.toolCalls.total++;
        out.toolCalls.byTool[b.name] = (out.toolCalls.byTool[b.name] || 0) + 1;
        // For a shell call, which command: how the SigMap arm used its CLI is a
        // finding in its own right, and `Bash` alone would hide it.
        const cmd = b.name === 'Bash' && b.input && typeof b.input.command === 'string'
          ? b.input.command.trim().split(/\s+/)[0].slice(0, 40) : null;
        if (cmd) out.toolCalls.byCommand[cmd] = (out.toolCalls.byCommand[cmd] || 0) + 1;
      }
      const u = o.message.usage;
      const id = typeof o.message.id === 'string' ? o.message.id : null;
      if (u && typeof u === 'object' && !(id && seenMessage.has(id))) {
        const inT = num(u.input_tokens);
        const outT = num(u.output_tokens);
        const cr = u.cache_read_input_tokens === undefined ? 0 : num(u.cache_read_input_tokens);
        const cw = u.cache_creation_input_tokens === undefined ? 0 : num(u.cache_creation_input_tokens);
        if (inT !== null && outT !== null && cr !== null && cw !== null) {
          if (id) seenMessage.add(id);
          messages++;
          if (u.cache_read_input_tokens === undefined) missingRead++;
          if (u.cache_creation_input_tokens === undefined) missingWrite++;
          sum.in += inT; sum.out += outT; sum.cacheRead += cr; sum.cacheWrite += cw;
        } else {
          out.parseErrors++;
        }
      }
    } else if (o.type === 'result') {
      out.result = true;
      out.isError = o.is_error === true || (typeof o.subtype === 'string' && o.subtype !== 'success');
      out.subtype = str(o.subtype);
      out.answer = typeof o.result === 'string' ? o.result : null;
      out.turns = num(o.num_turns);
      out.costUsd = num(o.total_cost_usd);
      const u = o.usage;
      if (u && typeof u === 'object' && num(u.input_tokens) !== null && num(u.output_tokens) !== null) {
        out.usage = {
          in: u.input_tokens,
          out: u.output_tokens,
          cacheRead: num(u.cache_read_input_tokens),
          cacheWrite: num(u.cache_creation_input_tokens),
        };
        out.usageSource = 'result';
      }
    }
  }

  if (!out.usage && messages > 0) {
    // A category some messages omitted is UNKNOWN, not the sum of the messages that
    // reported it: that sum is a floor, and in a lower-is-better series a floor
    // favours whichever arm's messages omit more. The gap is counted, so the
    // shortfall in `n` has a reason (the transcript parser keeps the partial sum
    // and counts the same gap, because its consumer renders a `≥`).
    const gap = (missing) => (missing > 0 && missing < messages ? missing : 0);
    out.usage = {
      in: sum.in,
      out: sum.out,
      cacheRead: missingRead > 0 ? null : sum.cacheRead,
      cacheWrite: missingWrite > 0 ? null : sum.cacheWrite,
    };
    out.cacheGaps = Math.max(gap(missingRead), gap(missingWrite));
    out.usageSource = 'messages';
  }
  return out;
}

/**
 * Turn a parsed stream plus process facts into the record the harness consumes.
 * A run is `ok` only when a successful `result` event carried an answer.
 */
export function toRecord(parsed, { wallMs, cwds, model, timedOut, code }) {
  let error = null;
  if (timedOut) error = 'timeout';
  else if (!parsed.result) error = code ? `no result event (exit ${code})` : 'no result event';
  else if (parsed.isError) error = parsed.subtype ? `agent error: ${parsed.subtype}` : 'agent error';
  else if (typeof parsed.answer !== 'string') error = 'result carried no answer';
  const ok = error === null;

  let cost = { usd: null, source: 'unavailable' };
  if (parsed.costUsd !== null) cost = { usd: parsed.costUsd, source: 'agent-reported' };
  else if (parsed.usage) {
    const floor = costFloor(parsed.usage.in, model);
    if (floor !== null) cost = { usd: floor, source: 'table' };
  }

  return {
    ok,
    error,
    answer: ok ? parsed.answer : '',
    cwds: cwds || [],
    init: parsed.init,
    toolCalls: parsed.result || parsed.toolCalls.total ? parsed.toolCalls : null,
    usage: parsed.usage,
    usageSource: parsed.usageSource,
    cacheGaps: parsed.cacheGaps,
    cost,
    turns: parsed.turns,
    durationMs: wallMs,
    parseErrors: parsed.parseErrors,
  };
}

/**
 * Spawn the agent with the prompt on stdin. Never rejects: a spawn failure comes
 * back as `spawnError`, a hang as `timedOut`.
 */
export function runClaude({ bin, args, prompt, cwd, env, timeoutMs }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let overflow = false;
    let settled = false;
    let timer = null;

    const finish = (extra) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Object.assign({ stdout, stderr, code: null, timedOut, overflow, spawnError: null, wallMs: Date.now() - started }, extra));
    };

    let child;
    try {
      child = spawn(bin, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      finish({ spawnError: e.message });
      return;
    }
    timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      stdout += d;
      if (stdout.length > MAX_STDOUT_BYTES) { overflow = true; child.kill('SIGKILL'); }
    });
    child.stderr.on('data', (d) => { if (stderr.length < 64 * 1024) stderr += d; });
    child.on('error', (e) => finish({ spawnError: e.message }));
    child.on('close', (code) => finish({ code }));
    child.stdin.on('error', () => { /* the child exited before reading its prompt */ });
    child.stdin.end(prompt);
  });
}

/** The agent's own version string, or `null` when it cannot be asked. */
export function agentVersion(bin, env) {
  try {
    const r = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15000, env });
    if (r.status !== 0) return null;
    return (r.stdout || '').trim().split('\n')[0].slice(0, 80) || null;
  } catch (_) {
    return null;
  }
}

/**
 * The runner `runPlan` calls: resolve the prepared checkout for the job's repo
 * and arm, run the agent in it, return a record. A process that cannot be started
 * at all is an environment error and throws, so a missing binary cannot be
 * mistaken for forty failed runs.
 *
 * @param {object} p
 * @param {string} p.bin
 * @param {string} p.model
 * @param {number} p.budgetUsd
 * @param {number} p.timeoutMs
 * @param {object} [p.env]
 * @param {(repo:string, arm:string) => {cwd:string, cwds:string[], sigmapContext?:string, mcpConfig?:string, binDir?:string}} p.arms
 */
export function makeRunner({ bin, model, budgetUsd, timeoutMs, env, arms }) {
  const runEnv = env || childEnv();
  return async (job) => {
    const arm = arms(job.task.repo, job.arm);
    const args = buildArgs({ arm: job.arm, model, budgetUsd, sigmapContext: arm.sigmapContext, mcpConfig: arm.mcpConfig });
    // The SigMap arm alone gets `sigmap` on PATH, and it is THIS checkout's.
    const env2 = arm.binDir ? Object.assign({}, runEnv, { PATH: arm.binDir + path.delimiter + (runEnv.PATH || '') }) : runEnv;
    const r = await runClaude({ bin, args, prompt: job.prompt, cwd: arm.cwd, env: env2, timeoutMs });
    if (r.spawnError) throw new Error(`cannot start "${bin}": ${r.spawnError}`);
    const record = toRecord(parseStream(r.stdout), { wallMs: r.wallMs, cwds: arm.cwds, model, timedOut: r.timedOut, code: r.code });
    if (!record.ok && r.overflow) record.error = 'output too large';
    if (!record.ok && !record.init && r.stderr) record.stderr = r.stderr.trim().split('\n').slice(-3).join(' | ').slice(0, 300);
    return record;
  };
}
