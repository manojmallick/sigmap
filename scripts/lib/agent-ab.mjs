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
 *     is no grand total a renderer could print by accident. The one total,
 *     `totalTokens`, is a series on purpose: it says "derived, unweighted" in its
 *     label and its provenance, and it exists so the token view and the cost view
 *     can be read side by side (they can differ in sign).
 *   - "Did it save?" is answered per repetition and in two ways — the workload
 *     total and the typical task (`agent-ab-stats.mjs`) — and a saving counts only
 *     if it points the same way in every repetition.
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
import {
  BOOTSTRAP_ITERATIONS, BOOTSTRAP_SEED, CI_LEVEL,
  workloadChange, geometricChange, consistency,
} from './agent-ab-stats.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const models = require(path.join(ROOT, 'src/config/models.js'));

/** `without` = no SigMap; `with` = SigMap's generated context plus its MCP server. */
export const ARMS = Object.freeze(['without', 'with']);

/**
 * What the `with` arm is. `current` is what a first-time `sigmap --adapter claude` run hands an
 * agent (the generated section plus the MCP server on its default 22-tool profile). `lean` keeps the
 * same index and the same MCP server but hands the agent less on every turn: the 7-tool `core`
 * profile and a three-line section instead of the generated one. `index` is the setup the strategies
 * guide gives for an agent that reliably calls the lookup tools: `strategy: "index"` (an always-on map
 * of about a third the size, every signature still in the index) with the `core` profile, and the
 * section SigMap itself writes, nothing hand-written. A variant changes how much the agent is told,
 * never what the index holds, so they stay comparable on the same questions.
 */
export const SIGMAP_VARIANTS = Object.freeze({
  current: 'SigMap generated context + MCP server',
  lean: 'SigMap lean: 7-tool core MCP profile + a three-line section',
  index: 'SigMap index strategy + 7-tool core MCP profile (the docs\' setup for an agent that calls the tools)',
  skill: 'SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section',
  'skill-always': 'SigMap as one skill (sigmap-locate) whose description tells the agent to call it first on every where-is-it question, + the sigmap CLI: no MCP server, no always-on section',
  prefetch: 'SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call',
  locate: 'SigMap index strategy + a two-tool MCP profile (query_context and get_lines only): the tools the agents used, without the five they did not',
  'prefetch-hook': 'the real prefetch hook (`sigmap hooks install claude --prefetch`): Claude Code runs it on the prompt and adds SigMap\'s ranking as context; no MCP server, no standing section, nothing in the prompt we write (Claude Code with --session-auth only)',
  'hook-plain': 'PROTOTYPE of the prefetch hook: the same block printed as plain stdout instead of JSON additionalContext (Claude Code labels it "hook success:"); everything else as prefetch-hook',
  'hook-firm': 'PROTOTYPE of the prefetch hook: the same block under a header that says where to start ("start with them... search only if none fits") instead of "leads, not an answer"; everything else as prefetch-hook',
  'hook-brief': 'PROTOTYPE of the prefetch hook: the same ranking with at most ~2.5 KB of signatures instead of ~8 KB; everything else as prefetch-hook',
  placebo: 'NOT SigMap: a size-matched block of generic code-search guidance in the system prompt, no repository information, no tools added (the control for "is it SigMap or just prompt text?")',
  'skill-shipped': 'SigMap as the three skills `sigmap skills install --client claude` writes + the sigmap CLI: no MCP server, no always-on section',
});

/** The variants that run a UserPromptSubmit hook inside Claude Code: the shipped one and the prototype deliveries of stage B1. */
export const HOOK_VARIANTS = Object.freeze(['prefetch-hook', 'hook-plain', 'hook-firm', 'hook-brief']);
export const isHookVariant = (v) => HOOK_VARIANTS.includes(v);

/**
 * The variants that hand SigMap over as Claude Code skills. A skill costs the agent its name and
 * description on every turn and its body only when the agent calls it, so these arms carry no
 * appended section and no MCP tool definitions at all. Both arms of such a run keep the Skill tool
 * (and the agent's bundled skills), so they still differ only by what SigMap adds.
 */
export const SKILL_VARIANTS = Object.freeze({
  skill: Object.freeze(['sigmap-locate']),
  'skill-always': Object.freeze(['sigmap-locate']),
  'skill-shipped': Object.freeze(['sigmap-usage-maximizer', 'sigmap-task', 'sigmap-config-optimizer']),
});

/**
 * What the `prefetch` arm is told above the pre-ranked files. Deliberately not an instruction to do anything extra: `lean` and
 * `skill-always` showed that "ask SigMap first, then confirm" becomes a step ADDED to the agent's own search. This only says
 * what the list is and how far to trust it.
 */
export const PREFETCH_HEADER = [
  '## Files SigMap ranked for this question',
  'Before you started, SigMap ranked this repository\'s files against the question from its offline index (no model call). These are leads, not an answer: the right file is often but not always among them. Each signature carries a `:start-end` line anchor you can Read directly. If none fits, search as you normally would.',
].join('\n');

/** The pre-ranked block is capped: it is re-read on every later turn, and a hook that injects 10k tokens is not a saving. */
export const PREFETCH_MAX_BYTES = 8 * 1024;

/**
 * The `skill` variant's one SKILL.md. Written from what the earlier runs showed: an instruction to
 * "always ask SigMap first" made a strong agent do SigMap's step AND its own search (`lean`), so this
 * one says when NOT to use it, calls the ranking a lead to confirm, and tells the agent to stop once
 * a file is confirmed. The CLI it names is the one the arm has on PATH.
 */
export const LOCATE_SKILL = [
  '---',
  'name: sigmap-locate',
  'description: Find which files implement something in a large, unfamiliar repository using the offline SigMap index. Use when asked where code lives or which files handle a behaviour and no distinctive identifier is known. Skip it when the question names the file or symbol, or one Grep would answer.',
  '---',
  '',
  '# Locate code with SigMap',
  '',
  '1. Run `sigmap ask "<the question, in the user\'s words>"` once. It prints the five most likely files, ranked.',
  '2. Treat the ranking as leads, not an answer: the first file is often not the right one. Signatures with `:start-end` line anchors for the five files are in `.context/query-context.md`.',
  '3. Confirm before you name a file: `sigmap lines <file> :<line> --context 10`, or Read that range.',
  '4. If none of the five fits, Grep for a distinctive term from the question. Do not run `sigmap ask` more than twice.',
  '5. Answer as soon as one file is confirmed. Do not also search the whole repository to be sure.',
  '',
].join('\n');

/**
 * The lean arm's whole system-prompt addition (about 70 tokens). It names the MCP tool the arm
 * actually has, where the generated section names a terminal command the agent rarely ran, and it
 * calls the ranking a lead to confirm: on the labelled corpus the first-ranked file is right about
 * one time in three, so "answer from this" would be wrong about as often.
 */
export const LEAN_SECTION = [
  '## SigMap',
  'This repository is indexed by SigMap. Call the MCP tool `query_context` with the question first: it returns the most likely files with line anchors (`:start-end`).',
  'Treat the ranking as a lead, not an answer: read an anchored range with `get_lines` to confirm before you name a file.',
].join('\n');

/**
 * The `skill-always` variant's SKILL.md: the same procedure as LOCATE_SKILL under a description that asks to be called first.
 * Haiku 5.5 never called the optional `skill` (0 of 180 runs), so this is the version that tests the skill itself: what the
 * agent does, and what it costs, when it does follow it. The description is the only part that differs.
 */
export const LOCATE_SKILL_ALWAYS = LOCATE_SKILL.replace(/^description: .*$/m,
  'description: Use this FIRST, before any Grep, Glob or Read, for every question about which files implement something or where code lives in this repository. It ranks the likely files from the offline SigMap index.');

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
 * @param {{ perRepo?: number, only?: string[]|null, ids?: string[]|null }} [opts] `ids` picks exactly those task ids
 *   (every repo's matches, in id order) and replaces the first-K rule; a targeted re-run, not a sample
 * @returns {Array<{id:string, repo:string, query:string, expected_files:string[]}>}
 */
export function selectTasks(tasks, repoNames, opts = {}) {
  const perRepo = opts.perRepo === undefined ? DEFAULT_TASKS_PER_REPO : opts.perRepo;
  if (!Number.isInteger(perRepo) || perRepo < 1) throw new Error(`tasks per repo must be a positive integer, got ${perRepo}`);
  const only = opts.only && opts.only.length ? new Set(opts.only) : null;
  const ids = opts.ids && opts.ids.length ? new Set(opts.ids) : null;
  const out = [];
  for (const repo of repoNames) {
    if (only && !only.has(repo)) continue;
    const sorted = tasks.filter((t) => t.repo === repo)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const mine = ids ? sorted.filter((t) => ids.has(t.id)) : sorted.slice(0, perRepo);
    for (const t of mine) out.push({ id: t.id, repo: t.repo, query: t.query, expected_files: [...t.expected_files], ...(t.hidden ? { hidden: t.hidden, kind: 'change' } : {}) });
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

/**
 * The question-style prompt (`--prompt-style question`): what a person types, the question and nothing else. The instructions that
 * `buildPrompt` wraps around it ride in the system prompt instead (ANSWER_FRAMING, the same in both arms), so a hook that ranks the
 * submitted prompt ranks the question, as the harness's `prefetch` does, and not fifty words of boilerplate with it.
 *
 * The question ends with a one-token reference no two runs share. On Claude Code a repeated opening prompt is read from the prompt
 * cache, which flatters any arm that adds question-specific text (the study found `prefetch` at -8% on a question's first ask and
 * -28% on its repeat); with the reference every run is a first ask, and the system prompt and tools stay shared, as in a real session.
 * The token is a letter and hex digits, so it matches nothing in a ranking.
 */
export const ANSWER_FRAMING = [
  'You are answering questions about the source code of an open-source project checked out in the current directory. Each message is one such question.',
  `Name the repository-relative path of each file that implements what the question asks about, most relevant first (at most ${TOP_K}), `
    + 'one per line, in backticks. Then give one sentence on why. Do not modify anything.',
].join(' ');

export function questionPrompt(task, nonce = `q${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`) {
  return `${task.query} [${nonce}]`;
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
 * A skill variant has no MCP server in either arm; instead the SigMap arm must list exactly its
 * skills in the init event and the no-SigMap arm none of them, and both must hold the Skill tool.
 *
 * @param {{ tools?: string[], mcpServers?: Array<{name:string,status?:string}>, skills?: string[]|null }|null} init
 * @param {'without'|'with'} arm
 * @param {{ variant?: string }} [opts]
 * @returns {{ ok: boolean, problems: string[], builtins: string[] }}
 */
/**
 * The `prefetch-hook` run is only a measurement of the hook if the hook ran in the SigMap arm, exactly once and successfully with
 * something to say, and did not run at all in the baseline. Both are read from the hook events in the run's own stream.
 */
export function hookProblems(hooks, arm) {
  if (!Array.isArray(hooks)) return ['the run reported no hook events, so it cannot be checked that the hook ran (or did not)'];
  const mine = hooks.filter((h) => h && h.event === 'UserPromptSubmit');
  if (arm === 'without') return hooks.length ? [`the no-SigMap arm ran a hook (${hooks.map((h) => h.event).join(', ')})`] : [];
  if (mine.length !== 1) return [`the SigMap arm should run its UserPromptSubmit hook once; it ran it ${mine.length} times`];
  const h = mine[0];
  if (h.outcome !== 'success' || h.exitCode !== 0) return [`the prefetch hook did not succeed (outcome ${h.outcome}, exit ${h.exitCode})`];
  if (!(h.bytes > 0)) return ['the prefetch hook ran and added nothing to the prompt'];
  return [];
}

export function checkIntegrity(init, arm, opts = {}) {
  // A change task lets the agent edit, so Edit and Write are expected in BOTH arms; every other forbidden tool stays forbidden.
  const forbidden = opts.change ? FORBIDDEN_TOOLS.filter((t) => t !== 'Edit' && t !== 'Write') : FORBIDDEN_TOOLS;
  if (!init || !Array.isArray(init.tools)) {
    return { ok: false, builtins: [], problems: ['the run reported no init event with a tool list, so the arm cannot be verified'] };
  }
  const problems = [];
  const tools = init.tools.map(String);
  const builtins = tools.filter((t) => !t.startsWith('mcp__')).sort();
  const mcp = tools.filter((t) => t.startsWith('mcp__'));
  const prefix = `mcp__${SIGMAP_SERVER}__`;
  const servers = Array.isArray(init.mcpServers) ? init.mcpServers : [];

  for (const t of builtins) if (forbidden.includes(t)) problems.push(`the forbidden tool "${t}" is enabled`);
  const foreign = mcp.filter((t) => !t.startsWith(prefix));
  if (foreign.length) problems.push(`unexpected MCP tools: ${foreign.join(', ')}`);
  const otherServers = servers.filter((s) => s && s.name !== SIGMAP_SERVER).map((s) => s.name);
  if (otherServers.length) problems.push(`unexpected MCP servers: ${otherServers.join(', ')}`);

  const sigmap = servers.find((s) => s && s.name === SIGMAP_SERVER);
  const sigmapTools = mcp.filter((t) => t.startsWith(prefix));
  if (opts.variant === 'prefetch' || opts.variant === 'placebo' || isHookVariant(opts.variant)) {
    // The ranking (or the placebo text) is already in the prompt; neither arm has an MCP server, so one in either arm is a contaminated run.
    if (sigmap || sigmapTools.length) problems.push(`the ${opts.variant} variant holds the sigmap MCP server in the ${arm === 'with' ? 'SigMap' : 'no-SigMap'} arm`);
    if (isHookVariant(opts.variant)) problems.push(...hookProblems(opts.hooks, arm));
    return { ok: problems.length === 0, problems, builtins };
  }
  const wanted = SKILL_VARIANTS[opts.variant];
  if (wanted) {
    if (sigmap || sigmapTools.length) problems.push(`a skill variant (${opts.variant}) holds the sigmap MCP server in the ${arm === 'with' ? 'SigMap' : 'no-SigMap'} arm`);
    if (!builtins.includes('Skill')) problems.push('the Skill tool is not enabled, so the skill cannot be called');
    const have = Array.isArray(init.skills) ? init.skills.map(String) : null;
    if (!have) problems.push('the run reported no skill list, so the skill arm cannot be verified');
    else if (arm === 'with') {
      const missing = wanted.filter((n) => !have.includes(n));
      if (missing.length) problems.push(`the SigMap arm does not list its skill(s): ${missing.join(', ')}`);
    } else {
      const leaked = wanted.filter((n) => have.includes(n));
      if (leaked.length) problems.push(`the no-SigMap arm lists the SigMap skill(s): ${leaked.join(', ')}`);
    }
    return { ok: problems.length === 0, problems, builtins };
  }
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
 * @param {(task:object, run:{run:number, arm:string}) => string} [p.promptFor] the prompt of a run (default: the locate prompt, the same for every run of a task)
 * @param {(record:object, task:object) => Promise<{pass:boolean}>|{pass:boolean}} [p.scoreRun] scores a finished run (default: hit@5 on the files named)
 * @param {boolean} [p.change] the tasks are change tasks: the agent may edit
 * @param {string} [p.variant] the SigMap variant, so a skill variant is checked for its skills and not for an MCP server
 * @returns {Promise<Array<{task:object, arm:string, run:number, record:object}>>}
 */
export async function runPlan({ tasks, runs, runner, onRun, maxConsecutiveFailures = 3, variant, promptFor = buildPrompt, scoreRun = null, change = false }) {
  const out = [];
  const builtinsByArm = {};
  let streak = 0;
  for (const task of tasks) {
    for (let run = 1; run <= runs; run++) {
      const order = run % 2 === 1 ? ARMS : [...ARMS].reverse();
      for (const arm of order) {
        const prompt = promptFor(task, { run, arm });
        const record = await runner({ task, arm, run, prompt });
        if (record.init || record.ok) {
          const chk = checkIntegrity(record.init, arm, { variant, change, hooks: record.hooks });
          if (!chk.ok) {
            throw new IntegrityError(`${task.repo}/${task.id} run ${run} (${arm}): ${chk.problems.join('; ')}`);
          }
          builtinsByArm[arm] = chk.builtins.join(',');
          const other = builtinsByArm[arm === 'with' ? 'without' : 'with'];
          if (other !== undefined && other !== builtinsByArm[arm]) {
            throw new IntegrityError(`the arms hold different built-in tools (without: [${builtinsByArm.without}], with: [${builtinsByArm.with}])`);
          }
        }
        const score = record.ok ? (scoreRun ? await scoreRun(record, task) : scoreAnswer(record.answer, task.expected_files, { cwds: record.cwds }))
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
  {
    key: 'totalTokens', label: 'Total tokens (derived)', unit: 'tokens',
    provenance: 'derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view',
    // Unknown stays unknown: one category the run did not report makes the sum
    // unknown, never the sum of the categories that did report.
    pick: (r) => {
      const u = r.usage;
      if (!u) return null;
      const parts = [u.in, u.out, u.cacheRead, u.cacheWrite];
      return parts.every((x) => Number.isFinite(x)) ? parts.reduce((a, b) => a + b, 0) : null;
    },
  },
  { key: 'costUsd', label: 'Cost', unit: 'usd', provenance: 'agent-reported (the agent\'s own total_cost_usd), or computed from the API\'s usage and a price table when the run went through the Messages API directly', pick: (r) => (r.cost && (r.cost.source === 'agent-reported' || r.cost.source === 'computed') ? r.cost.usd : null) },
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
    if (usd !== null && (c.source === 'agent-reported' || c.source === 'computed')) { s.agentReportedUsd = (s.agentReportedUsd || 0) + usd; s.agentReportedRuns++; }
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
 * "Did SigMap's arm use less?" answered per repetition and in two ways.
 *
 * A repetition is one pass over every task in both arms (run index r). Within it,
 * a task is a PAIR only when both arms completed that run and reported the metric:
 * a failed or silent run drops its pair, it is never a zero. Per metric and per
 * repetition this returns the workload-total change and the typical-task change
 * with its bootstrap interval (see `agent-ab-stats.mjs`), and across repetitions a
 * verdict — fewer / more in every repetition, or mixed. A saving that appears in
 * one repetition and reverses in the next is not a saving.
 *
 * The same tasks are repeated, so repetitions measure consistency, not
 * generalisation to other tasks.
 *
 * For hit@5 it counts, per repetition, the pairs where the SigMap arm found the
 * file and the other did not (better), the reverse (worse) and the rest (tie).
 * Localisation only: this harness cannot grade an edit.
 *
 * @param {Array} entries output of runPlan
 * @param {Array} tasks
 */
export function repetitionEstimates(entries, tasks) {
  const done = new Map();
  const runSet = new Set();
  for (const e of entries) {
    runSet.add(e.run);
    if (e.record.ok) done.set(`${e.task.repo}/${e.task.id}|${e.arm}|${e.run}`, e.record);
  }
  const runs = [...runSet].sort((a, b) => a - b);
  const keys = tasks.map((t) => `${t.repo}/${t.id}`);
  const at = (key, arm, run) => done.get(`${key}|${arm}|${run}`);

  const metrics = {};
  for (const m of METRICS) {
    const reps = runs.map((run) => {
      const pairs = [];
      for (const k of keys) {
        const x = at(k, 'without', run);
        const y = at(k, 'with', run);
        if (!x || !y) continue;
        const a = m.pick(x);
        const b = m.pick(y);
        if (Number.isFinite(a) && Number.isFinite(b)) pairs.push({ without: a, with: b });
      }
      return { run, workload: workloadChange(pairs), typical: geometricChange(pairs) };
    });
    // Nothing estimable in any repetition (not reported, or a zero baseline): no row.
    if (reps.every((r) => r.workload.change === null && r.typical.change === null)) { metrics[m.key] = null; continue; }
    const typical = consistency(reps.map((r) => r.typical.change));
    const measured = reps.filter((r) => r.typical.change !== null);
    // Outside the noise: a one-sided verdict AND, in every repetition, an interval
    // that excludes zero on that same side. `null` when there is no such verdict —
    // which already needs 2+ measurable repetitions, so none is checked again here.
    const outsideNoise = typical === null || typical === 'mixed' || typical === 'unchanged' ? null
      : measured.every((r) => r.typical.lo !== null
        && (typical === 'fewer-every-repetition' ? r.typical.hi < 0 : r.typical.lo > 0));
    metrics[m.key] = { reps, workload: consistency(reps.map((r) => r.workload.change)), typical, typicalOutsideNoise: outsideNoise };
  }

  const outcomeReps = runs.map((run) => {
    let better = 0; let worse = 0; let ties = 0;
    for (const k of keys) {
      const x = at(k, 'without', run);
      const y = at(k, 'with', run);
      if (!x || !y) continue;
      if (y.score.pass && !x.score.pass) better++;
      else if (x.score.pass && !y.score.pass) worse++;
      else ties++;
    }
    return { run, tasks: better + worse + ties, better, worse, ties };
  });
  const sum = (f) => outcomeReps.reduce((s, r) => s + r[f], 0);

  return {
    runs,
    taskCount: tasks.length,
    bootstrap: { iterations: BOOTSTRAP_ITERATIONS, seed: BOOTSTRAP_SEED, level: CI_LEVEL },
    metrics,
    outcome: { reps: outcomeReps, total: { tasks: sum('tasks'), better: sum('better'), worse: sum('worse'), ties: sum('ties') } },
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
  'Repetitions reuse the same tasks, so they measure consistency, not generalisation to other tasks.',
  'The workload total is dominated by the largest tasks; the typical-task estimate gives every task equal weight. The two can disagree in sign on the same runs, and neither is a correction of the other.',
  'A typical-task interval that includes zero (†) is inside the noise: the runs cannot tell that change from none.',
  'Total tokens is a derived, unweighted sum of the four billing categories, so a cache read counts like a fresh token. Read Cost for the priced view: a token change and a cost change can differ in sign.',
]);

/** Added to a report produced with `--agent api`. */
export const API_AGENT_CAVEAT = 'Direct Messages API agent (scripts/lib/agent-ab-api.mjs), not Claude Code: a short neutral system prompt (about 150 tokens) and four read-only tools, so the prefix each turn re-reads is far smaller than Claude Code\'s and SigMap\'s per-turn addition is a larger share of a turn. Cost is computed from the usage the API reports and a price table (the Console\'s usage page is the authority), with 5-minute prompt caching. Not comparable cell by cell with Claude Code runs.';

/** Added to a report whose SigMap arm is a skill variant. */
export const SKILL_CAVEAT = 'Skill variant: both arms run with skills enabled (the Skill tool, and the agent\'s own bundled skills listed in the prompt, about 2k tokens), which the earlier no-skill runs did not have, so these figures are against this run\'s own baseline and not comparable cell by cell with the index, lean or current runs. The SigMap arm adds only its skill file(s) and the sigmap CLI: no MCP server and no appended section.';

/** Added to a report produced with `--session-auth`. */
export const SESSION_CAVEAT = 'Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account\'s plan.';

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
      variant: method.variant || 'current',
      arms: { without: 'no SigMap', with: SIGMAP_VARIANTS[method.variant || 'current'] || SIGMAP_VARIANTS.current },
      tools: [...BUILTIN_TOOLS],
      corpus: method.corpus || 'benchmarks/tasks/retrieval-xrepo.jsonl',
      selection: method.taskIds && method.taskIds.length ? `the task id(s) ${method.taskIds.join(', ')}` : `first ${method.tasksPerRepo} task(s) by id per repo`,
      passDefinition: method.passDefinition || `hit@${TOP_K} on the repository-relative paths the answer names`,
      priceAsOf: PRICE_AS_OF,
      publishable: pub.publishable,
      notPublishableBecause: pub.reasons,
    }),
    caveats: [...CAVEATS, ...(method.auth === 'session' ? [SESSION_CAVEAT] : []), ...(SKILL_VARIANTS[method.variant] ? [SKILL_CAVEAT] : []), ...(method.runner === 'api' ? [API_AGENT_CAVEAT] : [])],
    cells,
    ...rollup(cells),
    repetitions: repetitionEstimates(entries, tasks),
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

/** A fractional change as a signed whole percent: -0.254 → `−25%`; below half a percent → `0%`. */
function fmtChange(c) {
  if (c === null || c === undefined || Number.isNaN(c)) return NA;
  const r = Math.round(Math.abs(c) * 100);
  return r === 0 ? '0%' : `${c > 0 ? '+' : '−'}${r}%`;
}

const VERDICT = Object.freeze({
  'fewer-every-repetition': 'fewer in every repetition',
  'more-every-repetition': 'more in every repetition',
  unchanged: 'unchanged',
  mixed: 'mixed',
});

/** The repetition section: workload total, typical task, and the hit@5 outcome — one column per repetition. */
function renderRepetitions(rp) {
  const lines = [];
  const runCols = rp.runs.map((r) => `R${r}`);
  const shown = METRICS.filter((m) => rp.metrics[m.key]);
  lines.push('## Repetitions — workload total vs typical task');
  lines.push('');
  lines.push(`Each repetition (${runCols.join(', ') || 'none'}) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; \`n=\` marks fewer than all ${rp.taskCount}. `
    + 'A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.');
  lines.push('');

  if (shown.length) {
    lines.push('### Workload total');
    lines.push('');
    lines.push('Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.');
    lines.push('');
    lines.push(mdTable(['metric', ...runCols, 'verdict'], shown.map((m) => {
      const x = rp.metrics[m.key];
      return [m.label, ...x.reps.map((r) => `${fmtChange(r.workload.change)}${r.workload.n < rp.taskCount && r.workload.n > 0 ? ` n=${r.workload.n}` : ''}`),
        x.workload ? VERDICT[x.workload] : NA];
    })));
    lines.push('');

    lines.push('### Typical task');
    lines.push('');
    lines.push(`The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a ${Math.round(rp.bootstrap.level * 100)}% paired-bootstrap interval `
      + `(${rp.bootstrap.iterations.toLocaleString('en-US')} resamples, seed ${rp.bootstrap.seed}). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.`);
    lines.push('');
    lines.push(mdTable(['metric', ...runCols, 'verdict'], shown.map((m) => {
      const x = rp.metrics[m.key];
      const cell = (r) => {
        const t = r.typical;
        if (t.change === null) return NA;
        const ci = t.lo === null ? '' : ` [${fmtChange(t.lo)}, ${fmtChange(t.hi)}]`;
        const short = t.n < rp.taskCount ? ` n=${t.n}` : '';
        return `${fmtChange(t.change)}${ci}${t.inNoise ? ' †' : ''}${short}`;
      };
      const noise = x.typicalOutsideNoise === true ? ', outside the noise' : x.typicalOutsideNoise === false ? ', within the noise' : '';
      const verdict = x.typical ? `${VERDICT[x.typical]}${noise}` : NA;
      return [m.label, ...x.reps.map(cell), verdict];
    })));
    lines.push('');
  } else {
    lines.push('No metric was reported by both arms in any repetition, so there is nothing to estimate.');
    lines.push('');
  }

  lines.push('### Outcome (hit@5), by repetition');
  lines.push('');
  lines.push('Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.');
  lines.push('');
  const orow = (label, o) => [label, String(o.tasks), String(o.better), String(o.worse), String(o.ties)];
  lines.push(mdTable(['repetition', 'paired tasks', 'better', 'worse', 'tie'],
    [...rp.outcome.reps.map((r) => orow(`R${r.run}`, r)), orow('all', rp.outcome.total)]));
  lines.push('');
  return lines;
}

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
  lines.push('- Repetitions: each run index is one repetition, reported on its own in two ways — the workload total and the typical task (paired geometric mean, with a bootstrap interval) — and a saving counts only if it points the same way in every repetition.');
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

  if (report.repetitions) lines.push(...renderRepetitions(report.repetitions));

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
