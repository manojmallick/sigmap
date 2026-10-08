'use strict';

/**
 * Session capture (#922): the writers that feed `.context/sessions.ndjson`.
 *
 *   recordTranscript   parse a Claude Code transcript → one cumulative `usage` event
 *   recordFromJson     the generic fallback for any agent that can report its own usage
 *   recordCi           an `agent: "ci"` record for a pipeline run
 *   handleHook         the Claude Code SessionStart / Stop / SessionEnd handler
 *
 * `handleHook` is the only code that runs inside a host agent's lifecycle, so it
 * is built to be harmless: it never throws, never exits non-zero (the caller
 * exits 0 unconditionally), and bounds its own work with a deadline rather than
 * a timer — a synchronous parse cannot be interrupted by one. Each thing it
 * records is attempted on its own: a usage event that cannot be written (a
 * hostile transcript field, a full disk) never costs the session its `end`.
 *
 * Zero dependencies.
 */

const fs = require('fs');
const path = require('path');
const store = require('./store');
const { parseTranscript } = require('./claude-transcript');
const { tryGit } = require('../util/git');

const HOOK_EVENTS = ['SessionStart', 'Stop', 'SessionEnd'];

function _branch(cwd) {
  return store.cleanStr(tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }), 120);
}

/**
 * Parse a Claude Code transcript and append a cumulative `usage` event.
 * The transcript is untrusted; only an absolute `*.jsonl` regular file is read.
 *
 * @param {string} cwd
 * @param {string} id          agent-prefixed session id
 * @param {string} file        absolute transcript path
 * @param {{ deadlineMs?: number, skipIfUnchanged?: boolean }} [opts]
 * @returns {{ event: object|null, skipped?: boolean, error?: string, parsed?: object }}
 */
function recordTranscript(cwd, id, file, opts = {}) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || !/\.jsonl$/i.test(file)) {
    return { event: null, error: 'transcript must be an absolute path to a .jsonl file' };
  }
  if (opts.skipIfUnchanged) {
    // Stop fires after every turn: don't re-parse a transcript that has not grown.
    try {
      const st = fs.statSync(file);
      const prev = st.isFile() ? store.readSessions(cwd).sessions.find((s) => s.id === id) : null;
      if (prev && prev.offset === st.size && !prev.partial && st.size > 0) return { event: null, skipped: true };
    } catch (_) { /* fall through to a real parse */ }
  }
  const parsed = parseTranscript(file, { deadlineMs: opts.deadlineMs });
  const ev = {
    kind: 'usage', id, source: parsed.source, model: parsed.model,
    offset: parsed.offset, size: parsed.size, partial: parsed.partial,
    parseErrors: parsed.parseErrors, messages: parsed.messages, coverage: 'main',
  };
  if (parsed.usage) ev.usage = parsed.usage;
  if (parsed.models) ev.models = parsed.models;
  if (parsed.firstTs) ev.firstTs = parsed.firstTs;
  if (parsed.skippedSidechain) ev.skippedSidechain = parsed.skippedSidechain;
  if (parsed.cacheGaps) ev.cacheGaps = parsed.cacheGaps;
  if (parsed.error) ev.note = store.cleanStr(String(parsed.error), 60);
  return { event: store.appendEvent(cwd, ev), parsed };
}

function _count(v, name, optional) {
  if (v === undefined || v === null) {
    if (optional) return null;
    throw new Error(`usage.${name} is required`);
  }
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`usage.${name} must be a non-negative number`);
  return v;
}

/**
 * Record a session an agent reported itself (`session log --from-json`).
 * Expected shape: `{ id, agent?, model?, branch?, startedAt?, endedAt?, source?,
 * usage: { in, out, cacheRead?, cacheWrite? } }`. `in` and `out` are required.
 * A cache category the agent did not report is stored as `null` — unknown — and
 * rendered as n/a: it is NOT recorded as 0, which would claim the agent used none.
 * `source` may be `agent-reported` (default) or `estimate`.
 */
function recordFromJson(cwd, obj, opts = {}) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('expected a JSON object');
  if (typeof obj.id !== 'string' || !obj.id.trim()) throw new Error('"id" is required');
  const agent = store.cleanStr(obj.agent, 20) || 'agent';
  const id = store.sessionId(agent, obj.id);
  const u = obj.usage;
  if (!u || typeof u !== 'object') throw new Error('"usage" is required: { in, out, cacheRead?, cacheWrite? }');
  const usage = {
    in: _count(u.in, 'in'), out: _count(u.out, 'out'),
    cacheRead: _count(u.cacheRead, 'cacheRead', true), cacheWrite: _count(u.cacheWrite, 'cacheWrite', true),
  };
  const source = obj.source === 'estimate' ? 'estimate' : 'agent-reported';
  const startedAt = store.cleanIso(obj.startedAt) || new Date().toISOString();
  const endedAt = store.cleanIso(obj.endedAt) || startedAt;
  const branch = typeof obj.branch === 'string' ? store.cleanStr(obj.branch, 120) : _branch(cwd);
  const model = store.cleanStr(obj.model, 80) || 'unknown';
  store.appendEvent(cwd, { kind: 'start', id, ts: startedAt, agent, branch });
  store.appendEvent(cwd, { kind: 'usage', id, ts: endedAt, source, model, usage, offset: 0 });
  store.appendEvent(cwd, { kind: 'end', id, ts: endedAt, reason: 'reported' });
  store.maybeCompact(cwd, opts.config);
  return { id, source };
}

const CI_ENVS = [
  { name: 'github-actions', test: 'GITHUB_ACTIONS', id: (e) => [e.GITHUB_RUN_ID, e.GITHUB_RUN_ATTEMPT].filter(Boolean).join('-'), branch: 'GITHUB_REF_NAME' },
  { name: 'gitlab-ci', test: 'GITLAB_CI', id: (e) => e.CI_PIPELINE_ID, branch: 'CI_COMMIT_REF_NAME' },
  { name: 'circleci', test: 'CIRCLECI', id: (e) => e.CIRCLE_WORKFLOW_ID, branch: 'CIRCLE_BRANCH' },
  { name: 'buildkite', test: 'BUILDKITE', id: (e) => e.BUILDKITE_BUILD_ID, branch: 'BUILDKITE_BRANCH' },
];

/**
 * Append an `agent: "ci"` record for this pipeline run. Usage is `unavailable`
 * unless `usage` is supplied (a CI job has no transcript to measure).
 */
function recordCi(cwd, opts = {}) {
  const env = opts.env || process.env;
  const hit = CI_ENVS.find((c) => env[c.test]);
  const runner = hit ? hit.name : 'ci';
  const rawId = (hit && hit.id(env)) || opts.id || Date.now().toString(36);
  const id = store.sessionId('ci', rawId);
  const branch = (hit && store.cleanStr(env[hit.branch], 120)) || _branch(cwd);
  const ts = new Date().toISOString();
  store.appendEvent(cwd, { kind: 'start', id, ts, agent: 'ci', branch, ci: true, runner });
  if (opts.usage) {
    store.appendEvent(cwd, { kind: 'usage', id, ts, source: 'agent-reported', model: 'unknown', usage: opts.usage, offset: 0 });
  } else {
    store.appendEvent(cwd, { kind: 'usage', id, ts, source: 'unavailable', model: 'unknown', offset: 0, note: 'ci run: no usage surface' });
  }
  store.appendEvent(cwd, { kind: 'end', id, ts, reason: 'ci' });
  store.maybeCompact(cwd, opts.config);
  return { id, runner };
}

/** Run one step of the handler; a failure is noted and the next step still runs. */
function _attempt(out, label, fn) {
  try {
    return fn();
  } catch (e) {
    if (!out.error) out.error = `${label}: ${e && e.message ? e.message : String(e)}`;
    return undefined;
  }
}

/**
 * Handle one Claude Code hook invocation. NEVER throws.
 *
 * Reads only the documented common payload fields (`session_id`,
 * `transcript_path`) plus `source` / `reason`, and writes:
 *   SessionStart → a `start` event, `export SIGMAP_SESSION=<id>` into
 *                  $CLAUDE_ENV_FILE (so later `sigmap ask` calls join the session),
 *                  and the warm-start summary as `additionalContext`
 *   Stop         → a cumulative `usage` event (skipped when the transcript is unchanged)
 *   SessionEnd   → the final `usage` event, then an `end` event, then retention
 *
 * It never writes the summary into a file: the block is rebuilt at generation
 * time only (single-writer rule).
 *
 * @returns {{ stdout: string|null, id: string|null, actions: string[], error?: string }}
 */
function handleHook(event, payload, cwd, opts = {}) {
  const out = { stdout: null, id: null, actions: [] };
  try {
    if (!HOOK_EVENTS.includes(event)) return out;
    if (!payload || typeof payload !== 'object' || typeof payload.session_id !== 'string' || !payload.session_id) return out;
    const id = store.sessionId('claude-code', payload.session_id);
    out.id = id;
    const env = opts.env || process.env;
    const config = opts.config || {};

    if (event === 'SessionStart') {
      _attempt(out, 'start', () => {
        store.appendEvent(cwd, {
          kind: 'start', id, agent: 'claude-code', branch: _branch(cwd),
          startSource: store.cleanStr(payload.source, 20) || undefined,
        });
        out.actions.push('start');
      });
      const envFile = env.CLAUDE_ENV_FILE;
      if (typeof envFile === 'string' && envFile) {
        _attempt(out, 'env', () => { fs.appendFileSync(envFile, `export SIGMAP_SESSION=${id}\n`); out.actions.push('env'); });
      }
      _attempt(out, 'summary', () => {
        const { buildSummary } = require('./summary');
        const sum = buildSummary(cwd, { config, exclude: id, now: opts.now });
        if (sum && sum.text) {
          out.stdout = JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: sum.text } });
          out.actions.push('summary');
        }
      });
      return out;
    }

    const tp = payload.transcript_path;
    const r = _attempt(out, 'usage', () => recordTranscript(cwd, id, tp, {
      deadlineMs: opts.deadlineMs, skipIfUnchanged: event === 'Stop',
    })) || { event: null };
    out.actions.push(r.skipped ? 'unchanged' : r.event ? 'usage' : 'no-usage');
    if (r.error && !out.error) out.error = r.error;
    if (event === 'Stop') return out;

    // SessionEnd: the end is recorded whatever became of the usage.
    _attempt(out, 'end', () => {
      store.appendEvent(cwd, { kind: 'end', id, reason: store.cleanStr(payload.reason, 40) || undefined });
      out.actions.push('end');
    });
    const c = store.maybeCompact(cwd, config, { now: opts.now });
    if (c && c.action === 'compacted') out.actions.push('compact');
  } catch (e) {
    out.error = e && e.message ? e.message : String(e);
  }
  return out;
}

module.exports = { HOOK_EVENTS, recordTranscript, recordFromJson, recordCi, handleHook };
