#!/usr/bin/env node
'use strict';

/**
 * agent-ab.mjs — the pure half of the agent-level A/B harness (#955, closes #812).
 *
 * Every published efficiency figure is modeled; this is what makes one measured.
 * A real coding agent answers the same question with and without SigMap, and the
 * harness records what the agent actually did: tool calls, tokens per billing
 * category, cost, wall time, and whether the answer named the right file.
 *
 * This module holds everything that needs no process, file or network — task
 * selection, the prompt, answer scoring, statistics, the arm-integrity check,
 * the run schedule, aggregation and the report text — so the whole method is
 * testable offline against a stub runner. `agent-ab-arms.mjs` prepares the two
 * checkouts, `agent-ab-claude.mjs` drives the agent, and `run-agent-ab.mjs` is
 * the opt-in CLI.
 *
 * The #682 epic's correctness contract is enforced here, not described:
 *
 *   - Provenance on every figure (`agent-reported`, `table (asOf)`, `measured`).
 *   - Nothing is summed across classes: each metric is its own series, so there
 *     is no grand total a renderer could print by accident.
 *   - Unknown is unknown. A run with no usage contributes to a metric's `n`
 *     shortfall, never as a zero; a timed-out run is a failed run with unknown
 *     usage.
 *   - Token sums are per-request billing categories, never "context size".
 *   - The minimum run count is of COMPLETED runs, and the spend figure counts
 *     every run — a failed one was billed even though no series holds it.
 *
 * Zero dependencies. Node built-ins and src/config/models.js only.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const models = require(path.join(ROOT, 'src/config/models.js'));

/** `without` = no SigMap; `with` = SigMap's generated context plus its MCP server. */
export const ARMS = Object.freeze(['without', 'with']);

/** Fewer runs per arm than this is a smoke test, not a result. */
export const MIN_RUNS = 4;

/** hit@5 — the metric the retrieval corpora publish. */
export const TOP_K = 5;

export const DEFAULT_TASKS_PER_REPO = 1;

/**
 * What BOTH arms may do: read the checkout, nothing else — no edit, no web.
 * `Bash` is enabled but only through the BASH_ALLOW prefixes, because an agent
 * without SigMap searches with grep and SigMap's own generated section tells an
 * agent to run `sigmap ask` in the terminal. An arm with no shell would be handed
 * instructions it cannot follow.
 */
export const BUILTIN_TOOLS = Object.freeze(['Read', 'Grep', 'Glob', 'Bash']);

/** The only shell commands either arm may run: read-only, no network, no exec. */
export const BASH_ALLOW = Object.freeze(['grep', 'ls', 'cat', 'head', 'tail', 'wc']);

/** A tool whose presence in either arm would break the comparison. */
export const FORBIDDEN_TOOLS = Object.freeze([
  'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Task', 'Agent',
]);

export const SIGMAP_SERVER = 'sigmap';

/** The CLI the SigMap arm alone may run through Bash. */
export const SIGMAP_CLI = 'sigmap';

/** A run that proves an arm is not what the report says it is. Nothing is recorded. */
export class IntegrityError extends Error {}

// ── tasks ────────────────────────────────────────────────────────────────────

/**
 * The question set: the first `perRepo` tasks BY ID in each repo, repos in
 * manifest order. A rule, not a hand-pick, so the set cannot be cherry-picked
 * and is the same on every machine.
 *
 * @param {Array<{id:string, repo:string, query:string, expected_files:string[]}>} tasks
 * @param {string[]} repoNames manifest order
 * @param {{ perRepo?: number, only?: string[]|null }} [opts]
 * @returns {Array<{id:string, repo:string, query:string, expected_files:string[]}>}
 */
export function selectTasks(tasks, repoNames, opts = {}) {
  const perRepo = opts.perRepo === undefined ? DEFAULT_TASKS_PER_REPO : opts.perRepo;
  if (!Number.isInteger(perRepo) || perRepo < 1) throw new Error(`tasks per repo must be a positive integer, got ${perRepo}`);
  const only = opts.only && opts.only.length ? new Set(opts.only) : null;
  const out = [];
  for (const repo of repoNames) {
    if (only && !only.has(repo)) continue;
    const mine = tasks.filter((t) => t.repo === repo)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, perRepo);
    for (const t of mine) out.push({ id: t.id, repo: t.repo, query: t.query, expected_files: [...t.expected_files] });
  }
  return out;
}

/**
 * The prompt, byte-identical in both arms. It carries the question and the
 * answer format and nothing else: no expected file, no mention of SigMap.
 */
export function buildPrompt(task) {
  return [
    'You are answering a question about the source code of an open-source project checked out in the current directory.',
    '',
    `Question: ${task.query}`,
    '',
    `Name the repository-relative path of each file that implements this, most relevant first (at most ${TOP_K}), `
      + 'one per line, in backticks. Then give one sentence on why. Do not modify anything.',
  ].join('\n');
}

// ── scoring ──────────────────────────────────────────────────────────────────

// A path-looking token: dotted segments joined by `/`, ending in an extension. A
// trailing `:123` or `:12-30` line anchor is not part of it.
const PATH_RE = /[\w@~+.-]+(?:\/[\w@~+.-]+)*\.[A-Za-z0-9]{1,10}/g;
const PATH_CHAR = /[\w/.@~+-]/;

/**
 * The distinct repository-relative paths an answer names, in order of first
 * mention. An absolute path inside one of `cwds` (the agent's tools report
 * them) is made relative first.
 *
 * An expected file is also found by its literal text, which covers a path with
 * a space or a character the token pattern does not take — but only at a token
 * boundary, so `src/binding/form.go` never counts as `binding/form.go`.
 *
 * @param {string} answer
 * @param {{ cwds?: string[], expected?: string[] }} [opts]
 * @returns {string[]}
 */
export function extractPaths(answer, opts = {}) {
  let text = String(answer || '').replace(/\\/g, '/');
  const prefixes = (opts.cwds || []).map((c) => String(c).replace(/\\/g, '/').replace(/\/+$/, '')).filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const p of prefixes) text = text.split(`${p}/`).join('');

  const found = [];
  for (const m of text.matchAll(PATH_RE)) found.push({ at: m.index, path: m[0].replace(/^(?:\.\/)+/, '') });
  for (const e of opts.expected || []) {
    if (found.some((f) => f.path === e)) continue;
    for (let at = text.indexOf(e); at !== -1; at = text.indexOf(e, at + 1)) {
      const before = text[at - 1];
      const after = text[at + e.length];
      if ((before && PATH_CHAR.test(before)) || (after && /\w/.test(after))) continue;
      found.push({ at, path: e });
      break;
    }
  }
  found.sort((a, b) => a.at - b.at);
  const seen = new Set();
  const out = [];
  for (const f of found) if (!seen.has(f.path)) { seen.add(f.path); out.push(f.path); }
  return out;
}

/**
 * hit@k for one answer: does one of the first `k` distinct named paths equal an
 * expected file? The same definition `src/eval/scorer.js` uses for retrieval, so
 * the two kinds of number are comparable.
 *
 * @returns {{ pass: boolean, rank: number|null, named: string[] }}
 */
export function scoreAnswer(answer, expected, opts = {}) {
  const k = opts.k || TOP_K;
  const named = extractPaths(answer, { cwds: opts.cwds, expected }).slice(0, k);
  const i = named.findIndex((p) => expected.includes(p));
  return { pass: i !== -1, rank: i === -1 ? null : i + 1, named };
}

// ── statistics ───────────────────────────────────────────────────────────────

const finite = (xs) => (xs || []).filter((x) => typeof x === 'number' && Number.isFinite(x));

/** Median of the finite numbers in `xs`; `null` when there are none. */
export function median(xs) {
  const v = finite(xs).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Sample standard deviation; `null` when there are none, `0` for a single value
 * (which is a measurement with no spread information, and `n` says so).
 */
export function stdev(xs) {
  const v = finite(xs);
  if (!v.length) return null;
  if (v.length === 1) return 0;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
}

/**
 * `{ n, median, min, max, stdev }` over the finite values, or `null` when none
 * was reported. `n` is how many runs REPORTED the metric — a shortfall against
 * the run count is visible, never filled with zeros.
 */
export function summarize(xs) {
  const v = finite(xs);
  if (!v.length) return null;
  return { n: v.length, median: median(v), min: Math.min(...v), max: Math.max(...v), stdev: stdev(v) };
}

// ── cost ─────────────────────────────────────────────────────────────────────

/** The date the shipped price table was checked against the vendor's pages. */
export const PRICE_AS_OF = models.resolveProfile().asOf;

/**
 * The input-priced floor of a run, or `null` when the model has no verified
 * price. Only uncached input is priced (the profile carries no output or cache
 * price), so this is a floor — the same contract `sigmap --report --sessions`
 * states.
 */
export function costFloor(inTokens, model) {
  if (typeof inTokens !== 'number' || !Number.isFinite(inTokens)) return null;
  const hit = models.lookup(models.resolveProfile(), model);
  if (!hit || hit.model.inputPerMtok == null) return null;
  return (inTokens * hit.model.inputPerMtok) / 1e6;
}

// ── arm integrity ────────────────────────────────────────────────────────────

/**
 * Verify an arm from the run's OWN init event, not from what was requested: the
 * no-SigMap arm must hold no sigmap server or tool, the SigMap arm must hold the
 * server connected, and neither may hold a tool that breaks the comparison.
 *
 * @param {{ tools?: string[], mcpServers?: Array<{name:string,status?:string}> }|null} init
 * @param {'without'|'with'} arm
 * @returns {{ ok: boolean, problems: string[], builtins: string[] }}
 */
export function checkIntegrity(init, arm) {
  if (!init || !Array.isArray(init.tools)) {
    return { ok: false, builtins: [], problems: ['the run reported no init event with a tool list, so the arm cannot be verified'] };
  }
  const problems = [];
  const tools = init.tools.map(String);
  const builtins = tools.filter((t) => !t.startsWith('mcp__')).sort();
  const mcp = tools.filter((t) => t.startsWith('mcp__'));
  const prefix = `mcp__${SIGMAP_SERVER}__`;
  const servers = Array.isArray(init.mcpServers) ? init.mcpServers : [];

  for (const t of builtins) if (FORBIDDEN_TOOLS.includes(t)) problems.push(`the forbidden tool "${t}" is enabled`);
  const foreign = mcp.filter((t) => !t.startsWith(prefix));
  if (foreign.length) problems.push(`unexpected MCP tools: ${foreign.join(', ')}`);
  const otherServers = servers.filter((s) => s && s.name !== SIGMAP_SERVER).map((s) => s.name);
  if (otherServers.length) problems.push(`unexpected MCP servers: ${otherServers.join(', ')}`);

  const sigmap = servers.find((s) => s && s.name === SIGMAP_SERVER);
  const sigmapTools = mcp.filter((t) => t.startsWith(prefix));
  if (arm === 'without') {
    if (sigmap || sigmapTools.length) problems.push('the no-SigMap arm has the sigmap MCP server');
  } else {
    if (!sigmap || sigmap.status !== 'connected') {
      problems.push(`the SigMap arm's sigmap server is ${sigmap ? `"${sigmap.status}"` : 'absent'}, not connected`);
    }
    if (!sigmapTools.length) problems.push('the SigMap arm lists no sigmap tool');
  }
  return { ok: problems.length === 0, problems, builtins };
}

// ── the run schedule ─────────────────────────────────────────────────────────

/**
 * Run every task `runs` times per arm, arms interleaved and counterbalanced
 * (without→with on odd runs, with→without on even), so cache warmth and drift
 * fall on both arms alike.
 *
 * A run whose own init event contradicts its arm aborts the whole plan: a number
 * from a contaminated arm is worse than no number. So do several failed runs in a
 * row — that is a broken setup (a bad key, a missing model), not a hard question,
 * and every further run would spend budget to learn nothing.
 *
 * @param {object} p
 * @param {Array} p.tasks
 * @param {number} p.runs
 * @param {(job:{task:object, arm:string, run:number, prompt:string}) => Promise<object>} p.runner
 * @param {(entry:object) => void} [p.onRun]
 * @param {number} [p.maxConsecutiveFailures]
 * @returns {Promise<Array<{task:object, arm:string, run:number, record:object}>>}
 */
export async function runPlan({ tasks, runs, runner, onRun, maxConsecutiveFailures = 3 }) {
  const out = [];
  const builtinsByArm = {};
  let streak = 0;
  for (const task of tasks) {
    const prompt = buildPrompt(task);
    for (let run = 1; run <= runs; run++) {
      const order = run % 2 === 1 ? ARMS : [...ARMS].reverse();
      for (const arm of order) {
        const record = await runner({ task, arm, run, prompt });
        if (record.init || record.ok) {
          const chk = checkIntegrity(record.init, arm);
          if (!chk.ok) {
            throw new IntegrityError(`${task.repo}/${task.id} run ${run} (${arm}): ${chk.problems.join('; ')}`);
          }
          builtinsByArm[arm] = chk.builtins.join(',');
          const other = builtinsByArm[arm === 'with' ? 'without' : 'with'];
          if (other !== undefined && other !== builtinsByArm[arm]) {
            throw new IntegrityError(`the arms hold different built-in tools (without: [${builtinsByArm.without}], with: [${builtinsByArm.with}])`);
          }
        }
        const score = record.ok ? scoreAnswer(record.answer, task.expected_files, { cwds: record.cwds })
          : { pass: false, rank: null, named: [] };
        const entry = { task, arm, run, record: Object.assign({}, record, { score }) };
        out.push(entry);
        if (onRun) onRun(entry);
        if (record.ok) streak = 0;
        else if (++streak >= maxConsecutiveFailures) {
          throw new Error(`stopped after ${streak} consecutive failed runs (last: ${record.error}${record.stderr ? ` — ${record.stderr}` : ''}); nothing is recorded`);
        }
      }
    }
  }
  return out;
}

// ── aggregation ──────────────────────────────────────────────────────────────

/**
 * The series a report carries, each with its own provenance. Lower is better for
 * every one of them.
 */
export const METRICS = Object.freeze([
  { key: 'toolCalls', label: 'Tool calls', unit: 'calls', provenance: 'agent-reported (main-thread tool_use blocks)', pick: (r) => r.toolCalls && r.toolCalls.total },
  { key: 'in', label: 'Input tokens (uncached)', unit: 'tokens', provenance: 'agent-reported', pick: (r) => r.usage && r.usage.in },
  { key: 'out', label: 'Output tokens', unit: 'tokens', provenance: 'agent-reported', pick: (r) => r.usage && r.usage.out },
  { key: 'cacheRead', label: 'Cache-read tokens', unit: 'tokens', provenance: 'agent-reported', pick: (r) => r.usage && r.usage.cacheRead },
  { key: 'cacheWrite', label: 'Cache-write tokens', unit: 'tokens', provenance: 'agent-reported', pick: (r) => r.usage && r.usage.cacheWrite },
  { key: 'costUsd', label: 'Cost', unit: 'usd', provenance: 'agent-reported (the agent\'s own total_cost_usd)', pick: (r) => (r.cost && r.cost.source === 'agent-reported' ? r.cost.usd : null) },
  { key: 'costFloorUsd', label: 'Cost floor', unit: 'usd', provenance: `table (as of ${PRICE_AS_OF}): uncached input only, a floor`, pick: (r) => (r.cost && r.cost.source === 'table' ? r.cost.usd : null) },
  { key: 'durationMs', label: 'Wall time', unit: 'ms', provenance: 'measured (wall clock of the agent process)', pick: (r) => r.durationMs },
]);

const EMPTY_SPEND = Object.freeze({ runs: 0, agentReportedUsd: null, agentReportedRuns: 0, floorUsd: null, floorRuns: 0, unknownRuns: 0 });

/**
 * What a set of runs cost, counted over EVERY run — completed or not. A timed-out
 * or errored run was still billed, and the series above leave it out on purpose
 * (its usage is partial, so it is not a sample of what a completed run costs);
 * this is the figure that says what the plan spent.
 *
 * One sum per provenance class — the agent's own `total_cost_usd`, and the table
 * floor (uncached input only) for a run that reported none — and a count of runs
 * with neither. The classes are never added to each other.
 *
 * @param {Array<{cost?: {usd: number|null, source: string}}>} records
 */
export function spendOf(records) {
  const s = { runs: 0, agentReportedUsd: null, agentReportedRuns: 0, floorUsd: null, floorRuns: 0, unknownRuns: 0 };
  for (const r of records) {
    s.runs++;
    const c = r && r.cost;
    const usd = c && typeof c.usd === 'number' && Number.isFinite(c.usd) && c.usd >= 0 ? c.usd : null;
    if (usd !== null && c.source === 'agent-reported') { s.agentReportedUsd = (s.agentReportedUsd || 0) + usd; s.agentReportedRuns++; }
    else if (usd !== null && c.source === 'table') { s.floorUsd = (s.floorUsd || 0) + usd; s.floorRuns++; }
    else s.unknownRuns++;
  }
  return s;
}

/** Field-wise sum of spends — within a class only, so no class is ever blended. */
function addSpend(list) {
  const out = Object.assign({}, EMPTY_SPEND);
  for (const s of list) {
    out.runs += s.runs;
    out.agentReportedRuns += s.agentReportedRuns;
    out.floorRuns += s.floorRuns;
    out.unknownRuns += s.unknownRuns;
    if (s.agentReportedUsd !== null) out.agentReportedUsd = (out.agentReportedUsd || 0) + s.agentReportedUsd;
    if (s.floorUsd !== null) out.floorUsd = (out.floorUsd || 0) + s.floorUsd;
  }
  return out;
}

/**
 * One cell per (task, arm): pass count and, per metric, the summary over the
 * runs that completed AND reported it. `spend` is the exception: it covers every
 * run, with `failed` the part of it that came from runs that did not complete.
 */
export function buildCells(entries, tasks) {
  const cells = [];
  for (const task of tasks) {
    for (const arm of ARMS) {
      const mine = entries.filter((e) => e.task.id === task.id && e.task.repo === task.repo && e.arm === arm);
      if (!mine.length) continue;
      const done = mine.filter((e) => e.record.ok);
      const metrics = {};
      for (const m of METRICS) metrics[m.key] = summarize(done.map((e) => m.pick(e.record)));
      cells.push({
        task: task.id,
        repo: task.repo,
        arm,
        runs: mine.length,
        completed: done.length,
        pass: mine.filter((e) => e.record.score.pass).length,
        errors: [...new Set(mine.filter((e) => !e.record.ok).map((e) => e.record.error || 'failed'))].sort(),
        named: mine.map((e) => e.record.score.named),
        // Completed runs whose cache figure was dropped because some of their
        // messages omitted it — the reason an `n=` is short on a cache series.
        cacheGapRuns: done.filter((e) => e.record.cacheGaps > 0).length,
        spend: { all: spendOf(mine.map((e) => e.record)), failed: spendOf(mine.filter((e) => !e.record.ok).map((e) => e.record)) },
        metrics,
      });
    }
  }
  return cells;
}

/**
 * Paired rollup of a set of cells: per metric, the median of per-task medians in
 * each arm, and over tasks measured in BOTH arms the median paired delta and
 * with-fewer / tie / with-more counts. Never a pooled mean.
 */
function rollupCells(cells) {
  const byTask = new Map();
  for (const c of cells) {
    const k = `${c.repo}/${c.task}`;
    if (!byTask.has(k)) byTask.set(k, {});
    byTask.get(k)[c.arm] = c;
  }
  const pairs = [...byTask.values()];
  const metrics = {};
  for (const m of METRICS) {
    const a = []; const b = []; const deltas = [];
    for (const p of pairs) {
      const x = p.without && p.without.metrics[m.key];
      const y = p.with && p.with.metrics[m.key];
      if (x) a.push(x.median);
      if (y) b.push(y.median);
      if (x && y) deltas.push(y.median - x.median);
    }
    metrics[m.key] = {
      without: median(a), with: median(b), tasks: deltas.length,
      medianDelta: median(deltas),
      fewer: deltas.filter((d) => d < 0).length,
      ties: deltas.filter((d) => d === 0).length,
      more: deltas.filter((d) => d > 0).length,
    };
  }
  const sum = (arm, f) => cells.filter((c) => c.arm === arm).reduce((s, c) => s + c[f], 0);
  const spendOfArm = (arm, part) => addSpend(cells.filter((c) => c.arm === arm).map((c) => c.spend[part]));
  return {
    tasks: pairs.length,
    pass: { without: { pass: sum('without', 'pass'), runs: sum('without', 'runs') }, with: { pass: sum('with', 'pass'), runs: sum('with', 'runs') } },
    failedRuns: { without: sum('without', 'runs') - sum('without', 'completed'), with: sum('with', 'runs') - sum('with', 'completed') },
    cacheGapRuns: sum('without', 'cacheGapRuns') + sum('with', 'cacheGapRuns'),
    spend: {
      without: { all: spendOfArm('without', 'all'), failed: spendOfArm('without', 'failed') },
      with: { all: spendOfArm('with', 'all'), failed: spendOfArm('with', 'failed') },
    },
    metrics,
  };
}

/** Per-repo rollups (manifest order of first appearance) plus one over every cell. */
export function rollup(cells) {
  const repos = [];
  for (const c of cells) if (!repos.includes(c.repo)) repos.push(c.repo);
  return {
    repos: repos.map((repo) => Object.assign({ repo }, rollupCells(cells.filter((c) => c.repo === repo)))),
    total: rollupCells(cells),
  };
}

/**
 * Why a report may or may not be published as a result. The minimum counts
 * COMPLETED runs: fewer than MIN_RUNS requested per arm is a smoke test, and so
 * is a plan that asked for enough but lost some — a cell whose median rests on
 * three runs is below the method's own minimum, however many were requested.
 * (Request more than MIN_RUNS to leave room for a failed run.)
 */
export function publishability({ runs, cells }) {
  const reasons = [];
  if (runs < MIN_RUNS) reasons.push(`${runs} run${runs === 1 ? '' : 's'} per arm (the minimum is ${MIN_RUNS})`);
  const empty = cells.filter((c) => c.completed === 0).length;
  if (empty) reasons.push(`${empty} cell${empty === 1 ? '' : 's'} with no completed run`);
  // With too few requested every cell is short, and the line above already says so.
  if (runs >= MIN_RUNS) {
    const short = cells.filter((c) => c.completed > 0 && c.completed < MIN_RUNS);
    if (short.length) {
      const named = short.slice(0, 5).map((c) => `${c.repo}/${c.task} ${c.arm} ${c.completed} of ${c.runs}`);
      const more = short.length > named.length ? `, +${short.length - named.length} more` : '';
      reasons.push(`${short.length} cell${short.length === 1 ? '' : 's'} with fewer than ${MIN_RUNS} completed runs (${named.join(', ')}${more})`);
    }
  }
  return { publishable: reasons.length === 0, reasons };
}

/** The caveats every report carries: there is no unlabelled headline. */
export const CAVEATS = Object.freeze([
  'One agent, one model, one date. The result says nothing about another agent or model.',
  'The questions ask where code lives, so this measures localisation, not edit or generation quality.',
  'Pass is hit@5 on the paths the answer names (the retrieval corpora\'s own definition), not a human judgement.',
  'Tasks are the first K by id per repo — a rule, not a random sample. N is small and one task is worth 1/N: read it as a band, not a point.',
  'Token figures are per-request billing categories summed over the run. They are not the size of the context.',
  'The SigMap arm adds SigMap\'s generated section to the system prompt, so its input and cache figures include that cost.',
  'Cost is the agent\'s own account. Prompt caching makes it depend on run order; arms are interleaved and counterbalanced to spread that, not to remove it.',
  'The self repo is excluded: its tree holds its own answer key and its own generated context.',
]);

/**
 * Assemble the report object.
 *
 * @param {object} p
 * @param {Array} p.entries output of runPlan
 * @param {Array} p.tasks
 * @param {object} p.method agent, agentVersion, model, runs, budgetUsd, timeoutMs, tasksPerRepo, date
 */
export function buildReport({ entries, tasks, method }) {
  const cells = buildCells(entries, tasks);
  const pub = publishability({ runs: method.runs, cells });
  return {
    schema: 1,
    kind: 'agent-ab',
    method: Object.assign({}, method, {
      arms: { without: 'no SigMap', with: 'SigMap generated context + MCP server' },
      tools: [...BUILTIN_TOOLS],
      corpus: 'benchmarks/tasks/retrieval-xrepo.jsonl',
      selection: `first ${method.tasksPerRepo} task(s) by id per repo`,
      passDefinition: `hit@${TOP_K} on the repository-relative paths the answer names`,
      priceAsOf: PRICE_AS_OF,
      publishable: pub.publishable,
      notPublishableBecause: pub.reasons,
    }),
    caveats: [...CAVEATS],
    cells,
    ...rollup(cells),
  };
}

// ── rendering ────────────────────────────────────────────────────────────────

const NA = 'n/a';

function fmt(unit, v, floor) {
  if (v === null || v === undefined || Number.isNaN(v)) return NA;
  if (unit === 'usd') return `${floor ? '≥ ' : ''}$${v.toFixed(v < 1 ? 4 : 2)}`;
  if (unit === 'ms') return v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(1)} s`;
  return Math.round(v).toLocaleString('en-US');
}

function fmtDelta(unit, v) {
  if (v === null || v === undefined) return NA;
  if (v === 0) return '0';
  return `${v > 0 ? '+' : '−'}${fmt(unit, Math.abs(v))}`;
}

const mdTable = (head, rows) => [
  `| ${head.join(' | ')} |`,
  `| ${head.map((_, i) => (i === 0 ? '---' : '---:')).join(' | ')} |`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
].join('\n');

/** The report as Markdown. Pure: the same object always renders the same text. */
export function renderMarkdown(report) {
  const m = report.method;
  const floorOf = (key) => key === 'costFloorUsd';
  const lines = [];
  lines.push('# Agent-level A/B — measured tool calls, tokens and cost');
  lines.push('');
  lines.push(`**${m.agent} ${m.agentVersion || '(version unknown)'} · ${m.model} · ${m.date} · ${m.runs} run${m.runs === 1 ? '' : 's'} per arm · `
    + `${m.publishable ? 'publishable' : `NOT PUBLISHABLE — ${m.notPublishableBecause.join('; ')}`}**`);
  lines.push('');
  lines.push(`- Arms: **without** = ${m.arms.without}; **with** = ${m.arms.with}.`);
  lines.push(`- Both arms: the same prompt, model, tool allowlist (${m.tools.join(', ')}), per-run budget cap $${m.budgetUsd} and timeout ${Math.round(m.timeoutMs / 1000)} s; run in a clean copy of the commit pinned in \`benchmarks/xrepo-repos.json\`.`);
  lines.push(`- Questions: ${m.selection} of \`${m.corpus}\`. Pass = ${m.passDefinition}.`);
  lines.push('- Statistics: the median over runs per task per arm; the repo row is the median over tasks, with the paired per-task delta (with − without) and how many tasks the SigMap arm used fewer / the same / more.');
  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  for (const c of report.caveats) lines.push(`- ${c}`);
  lines.push('');

  const passRow = (r) => [
    r.repo || 'all', String(r.tasks),
    `${r.pass.without.pass}/${r.pass.without.runs}`, `${r.pass.with.pass}/${r.pass.with.runs}`,
    `${r.failedRuns.without} / ${r.failedRuns.with}`,
  ];
  lines.push('## Outcome');
  lines.push('');
  lines.push(mdTable(['repo', 'tasks', 'pass without', 'pass with', 'failed runs (without / with)'],
    [...report.repos.map(passRow), passRow(report.total)]));
  lines.push('');

  for (const metric of METRICS) {
    const rows = [...report.repos, Object.assign({ repo: 'all' }, report.total)].map((r) => {
      const x = r.metrics[metric.key];
      const f = floorOf(metric.key);
      return [
        r.repo, fmt(metric.unit, x.without, f), fmt(metric.unit, x.with, f), fmtDelta(metric.unit, x.medianDelta),
        x.tasks ? `${x.fewer} / ${x.ties} / ${x.more}` : NA,
      ];
    });
    if (rows.every((r) => r[1] === NA && r[2] === NA)) continue;
    lines.push(`## ${metric.label}`);
    lines.push('');
    lines.push(`Provenance: ${metric.provenance}. Median per task, then median over tasks.`);
    lines.push('');
    lines.push(mdTable(['repo', 'without', 'with', 'Δ median', 'tasks fewer / tie / more'], rows));
    lines.push('');
  }

  // What the plan spent. The medians above leave a failed run out; this does not.
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const fmtSpend = (s, none) => {
    if (!s.runs) return none;
    const parts = [];
    if (s.agentReportedRuns) parts.push(`${fmt('usd', s.agentReportedUsd)} (${plural(s.agentReportedRuns, 'run')})`);
    if (s.floorRuns) parts.push(`${fmt('usd', s.floorUsd, true)} floor (${plural(s.floorRuns, 'run')})`);
    if (s.unknownRuns) parts.push(`${plural(s.unknownRuns, 'run')} unreported`);
    return parts.join(' · ');
  };
  const spendRows = [...report.repos, Object.assign({ repo: 'all' }, report.total)].map((r) => [
    r.repo,
    fmtSpend(r.spend.without.all, NA), fmtSpend(r.spend.with.all, NA),
    fmtSpend(r.spend.without.failed, 'none'), fmtSpend(r.spend.with.failed, 'none'),
  ]);
  if (report.total.spend.without.all.agentReportedRuns + report.total.spend.with.all.agentReportedRuns
      + report.total.spend.without.all.floorRuns + report.total.spend.with.all.floorRuns > 0) {
    lines.push('## Spend');
    lines.push('');
    lines.push(`Provenance: agent-reported (the agent's own \`total_cost_usd\`), or the table floor (as of ${m.priceAsOf}: uncached input only) for a run that reported none. `
      + 'Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.');
    lines.push('');
    lines.push(mdTable(['repo', 'without', 'with', 'of which failed runs, without', 'of which failed runs, with'], spendRows));
    lines.push('');
  }

  lines.push('## Per task');
  lines.push('');
  const cellRow = (c) => {
    const cell = (key) => {
      const s = c.metrics[key];
      if (!s) return NA;
      const metric = METRICS.find((x) => x.key === key);
      const f = floorOf(key);
      return `${fmt(metric.unit, s.median, f)} [${fmt(metric.unit, s.min)}–${fmt(metric.unit, s.max)}]${s.n < c.runs ? ` n=${s.n}` : ''}`;
    };
    return [`${c.repo}/${c.task}`, c.arm, `${c.pass}/${c.runs}`, cell('toolCalls'), cell('in'), cell('out'), cell('cacheRead'), cell('cacheWrite'), cell('costUsd') === NA ? cell('costFloorUsd') : cell('costUsd'), cell('durationMs')];
  };
  lines.push('Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.'
    + (report.total.cacheGapRuns > 0
      ? ` ${plural(report.total.cacheGapRuns, 'completed run')} dropped a cache figure because some of ${report.total.cacheGapRuns === 1 ? 'its' : 'their'} messages omitted that category.`
      : ''));
  lines.push('');
  lines.push(mdTable(['task', 'arm', 'pass', 'tool calls', 'input', 'output', 'cache read', 'cache write', 'cost', 'time'], report.cells.map(cellRow)));
  lines.push('');
  return lines.join('\n');
}
