#!/usr/bin/env node
/**
 * Agent-level A/B: the same question, with and without SigMap, against a real
 * coding agent — measured tool calls, tokens and cost (#955, closes #812).
 *
 *   node scripts/run-agent-ab.mjs --dry-run                     # the plan, the run count, the worst-case spend; spawns nothing
 *   ANTHROPIC_API_KEY=sk-... node scripts/run-agent-ab.mjs      # report only
 *   ANTHROPIC_API_KEY=sk-... node scripts/run-agent-ab.mjs --save
 *   ANTHROPIC_API_KEY=sk-... node scripts/run-agent-ab.mjs --repos gin,flask --tasks-per-repo 2 --runs 6
 *
 * WHY: every published efficiency number is modeled (task_success_proxy_pct,
 * prompts_per_task, savings = baseline - emitted at chars/4). The one measured
 * agent-side figure, benchmark:llm-ablation, is a tool-less single completion.
 * Nothing had watched an agent with tools do the same work with and without
 * SigMap, so no tool-call, token or cost claim had been observed end to end.
 *
 * METHOD (the numbers are only as good as these):
 *   - Questions: the labelled third-party xrepo corpus; the first K tasks by id
 *     per repo. A rule, not a hand-pick. The self repo is excluded — its tree
 *     holds its own answer key and its own generated context.
 *   - Arms: a throwaway copy of the pinned clone, hard-reset and cleaned, per
 *     arm — resolved through any symlink first, so an arm is always its own real
 *     directory and the shared clone is never reset, cleaned or written. Both
 *     get the identical prompt, model, read-only tool allowlist
 *     (Read, Grep, Glob, and a Bash limited to grep/ls/cat/head/tail/wc), budget
 *     cap and timeout. Only the SigMap arm gets SigMap's generated CLAUDE.md
 *     section (system prompt), the `sigmap` CLI and its MCP server.
 *   - Agent: Claude Code with --bare, so the operator's own CLAUDE.md, hooks
 *     and memory cannot reach the no-SigMap arm. --bare is ANTHROPIC_API_KEY-only.
 *   - Integrity: each run's own init event must match its arm, or the plan
 *     aborts and records nothing.
 *   - Statistics: median over the COMPLETED runs per arm per task, arms
 *     interleaved and counterbalanced; spread reported; per-repo rows are paired
 *     per task. A cell with fewer than 4 completed runs makes the report NOT
 *     PUBLISHABLE, however many were requested — ask for more than 4 to leave
 *     room for a failed run. The spend section counts every run, failed or not.
 *   - Provenance on every figure; unknown is n/a, never 0.
 *
 * Opt-in: not in the default suite, not in CI. Without a key it prints guidance
 * and exits 0, like benchmark:llm-ablation. It costs real money: --dry-run
 * first, and --max-budget-usd caps each run. POSIX only: the SigMap arm's
 * `sigmap` is a sh shim. Each arm is a full copy of a clone (instant on APFS,
 * a real copy elsewhere), so --repos keeps a first run small.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadManifest, checkoutState, readTasks, TASKS_REL } from './lib/xrepo.mjs';
import {
  ARMS, MIN_RUNS, DEFAULT_TASKS_PER_REPO, IntegrityError, SIGMAP_VARIANTS, SKILL_VARIANTS,
  selectTasks, runPlan, buildReport, renderMarkdown,
} from './lib/agent-ab.mjs';
import { prepareArm, probeMcp, probeCli, prefetchContext, assertArmHygiene } from './lib/agent-ab-arms.mjs';
import { makeApiRunner, priceFor } from './lib/agent-ab-api.mjs';
import { changePrompt } from './lib/agent-ab-change.mjs';
import {
  DEFAULT_MODEL, DEFAULT_BUDGET_USD, DEFAULT_TIMEOUT_MS, makeRunner, agentVersion, childEnv,
} from './lib/agent-ab-claude.mjs';
import { stamp } from './lib/report-stamp.mjs';
import { writeAll } from './lib/write-sync.mjs';

const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.SIGMAP_XREPO_DATA ? path.resolve(process.env.SIGMAP_XREPO_DATA) : CODE_ROOT;

const argv = process.argv.slice(2);
const KNOWN = new Set([
  '--repos', '--tasks-per-repo', '--runs', '--model', '--max-budget-usd', '--timeout-ms', '--claude',
  '--dry-run', '--save', '--allow-unpublishable', '--json', '--raw-out', '--out-dir', '--max-consecutive-failures', '--sigmap-variant', '--task-ids', '--session-auth', '--agent', '--change',
]);
const say = (s) => process.stderr.write(`${s}\n`);
const fail = (s, code = 1) => { say(`[agent-ab] ${s}`); process.exit(code); };

for (const a of argv) if (a.startsWith('--') && !KNOWN.has(a)) fail(`unknown flag ${a}`, 2);
const has = (f) => argv.includes(f);
// Every flag read through `val` takes a value. One given without — `--runs --save`, or
// as the last argument — is an error, never the default: `--model --save` would
// otherwise spend money on a model nobody chose.
const val = (f, d) => {
  const i = argv.indexOf(f);
  if (i === -1) return d;
  const next = argv[i + 1];
  if (next === undefined || next === '' || next.startsWith('--')) fail(`${f} needs a value`, 2);
  return next;
};
const intArg = (f, d) => {
  const v = val(f, null);
  if (v === null) return d;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) fail(`${f} must be a positive integer, got "${v}"`, 2);
  return n;
};
const numArg = (f, d) => {
  const v = val(f, null);
  if (v === null) return d;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) fail(`${f} must be a positive number, got "${v}"`, 2);
  return n;
};

const DRY = has('--dry-run');
const SAVE = has('--save');
const AS_JSON = has('--json');
const RUNS = intArg('--runs', MIN_RUNS);
const PER_REPO = intArg('--tasks-per-repo', DEFAULT_TASKS_PER_REPO);
const MODEL = val('--model', DEFAULT_MODEL);
const BUDGET = numArg('--max-budget-usd', DEFAULT_BUDGET_USD);
const TIMEOUT = intArg('--timeout-ms', DEFAULT_TIMEOUT_MS);
const BIN = val('--claude', 'claude');
const ONLY = val('--repos', null);
const OUT_DIR = val('--out-dir', path.join(CODE_ROOT, 'benchmarks', 'reports'));
const RAW_OUT = val('--raw-out', null);
const MAX_FAILS = intArg('--max-consecutive-failures', 3);
const TASK_IDS = val('--task-ids', null) ? val('--task-ids', null).split(',').map((x) => x.trim()).filter(Boolean) : null;
const SESSION_AUTH = has('--session-auth');
const VARIANT = val('--sigmap-variant', 'current');
if (!Object.prototype.hasOwnProperty.call(SIGMAP_VARIANTS, VARIANT)) {
  fail(`--sigmap-variant must be one of: ${Object.keys(SIGMAP_VARIANTS).join(', ')} (got "${VARIANT}")`, 2);
}
const AGENT = val('--agent', 'claude');
if (AGENT !== 'claude' && AGENT !== 'api') fail('--agent must be claude (Claude Code, the default) or api (the Messages API directly), got "' + AGENT + '"', 2);
const API_AGENT = AGENT === 'api';
// --change: the tasks are merged bug fixes (scripts/build-change-tasks.mjs); the agent edits a checkout and its patch is graded by hidden tests.
const CHANGE = has('--change');
if (CHANGE && !API_AGENT) fail('--change needs --agent api: the change tools (Edit, Write, RunTest) are the direct API agent\'s', 2);
if (API_AGENT && SESSION_AUTH) fail('--agent api uses ANTHROPIC_API_KEY; --session-auth is the Claude Code login', 2);
const SKILL_RUN = Object.prototype.hasOwnProperty.call(SKILL_VARIANTS, VARIANT);
if (API_AGENT && SKILL_RUN) fail('--sigmap-variant ' + VARIANT + ' hands SigMap over as Claude Code skills, which the direct API agent does not have', 2);
if (SKILL_RUN && !SESSION_AUTH) fail(`--sigmap-variant ${VARIANT} hands SigMap over as skills, and --bare turns skills off: add --session-auth`, 2);

function selectRepos(manifest, tasks) {
  const wanted = ONLY ? ONLY.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const known = new Set(manifest.repos.map((r) => r.name));
  for (const w of wanted || []) if (!known.has(w)) fail(`--repos: "${w}" is not in benchmarks/xrepo-repos.json`, 2);
  const present = [];
  const skipped = [];
  for (const r of manifest.repos) {
    if (wanted && !wanted.includes(r.name)) continue;
    if (!tasks.some((t) => t.repo === r.name)) continue;
    const st = checkoutState(DATA, r);
    if (st.present && st.atPin) present.push(r);
    else skipped.push({ name: r.name, why: st.present ? 'not at its pinned commit' : 'not fetched' });
  }
  return { present, skipped };
}

function printPlan(plan) {
  const lines = [
    `SigMap agent-level A/B (#812)${DRY ? ' — dry run' : ''}`,
    '',
    API_AGENT
      ? '  agent     the Messages API directly (scripts/lib/agent-ab-api.mjs, not Claude Code), model ' + MODEL + '; cost computed from usage x ' + (priceFor(MODEL) ? 'the ' + priceFor(MODEL).source + ' ($' + priceFor(MODEL).in + ' in / $' + priceFor(MODEL).out + ' out per Mtok)' : 'a price this model does not have: cost will be n/a')
      : `  agent     claude (${SESSION_AUTH ? 'the logged-in session, no API key; ~40k tokens of cached prefix' : '--bare'}), model ${MODEL}`,
    `  repos     ${plan.repos.length}${plan.skipped.length ? ` (${plan.skipped.length} skipped: ${plan.skipped.map((s) => `${s.name} ${s.why}`).join(', ')})` : ''}`,
    ...(CHANGE ? ['  mode      change tasks: the agent edits a checkout of the code before a merged fix; the patch is graded by the fix\'s own tests, which it never sees'] : []),
    `  tasks     ${plan.tasks} (${TASK_IDS ? `task id(s) ${TASK_IDS.join(', ')}` : `first ${PER_REPO} per repo, by id`})`,
    `  runs      ${RUNS} per arm × ${ARMS.length} arms = ${plan.agentRuns} agent runs${RUNS < MIN_RUNS ? `  (below the ${MIN_RUNS} a result needs: NOT PUBLISHABLE)` : ''}`,
    `  budget    <= $${BUDGET} per run -> <= $${(plan.agentRuns * BUDGET).toFixed(2)} worst case; timeout ${Math.round(TIMEOUT / 1000)} s per run`,
    `  arms      without = no SigMap · with = ${VARIANT === 'current' ? 'generated CLAUDE.md section + sigmap CLI + MCP server' : SIGMAP_VARIANTS[VARIANT]} (variant: ${VARIANT}); identical prompt, model, ${CHANGE ? 'tools (the change tools included)' : 'read-only tools'}`,
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const manifest = loadManifest(DATA);
  const corpus = readTasks(path.join(DATA, TASKS_REL));
  const { present, skipped } = selectRepos(manifest, corpus);
  if (TASK_IDS) {
    const known = new Set(corpus.map((t) => t.id));
    for (const id of TASK_IDS) if (!known.has(id)) fail(`--task-ids: "${id}" is not a task id in benchmarks/tasks/retrieval-xrepo.jsonl`, 2);
  }
  const tasks = selectTasks(corpus, present.map((r) => r.name), { perRepo: PER_REPO, ids: TASK_IDS });
  if (!tasks.length) fail(TASK_IDS ? `no task to run: none of ${TASK_IDS.join(', ')} is in a repo with a pinned checkout (npm run fetch:xrepo)` : 'no task to run: no pinned checkout is present (npm run fetch:xrepo)', 2);

  // Only the repositories a selected task is in are copied and checked; a run of one task does not prepare the others.
  const used = present.filter((r) => tasks.some((t) => t.repo === r.name));
  const plan = { repos: used, skipped, tasks: tasks.length, agentRuns: tasks.length * RUNS * ARMS.length };
  if (DRY) { writeAll(1, printPlan(plan)); return; }

  if (!SESSION_AUTH && !process.env.ANTHROPIC_API_KEY) {
    writeAll(1, `${printPlan(plan)}\n  ⚠ ANTHROPIC_API_KEY is not set — skipping the live run.\n`
      + '  Claude Code runs with --bare so the operator\'s own instructions cannot reach the no-SigMap arm, and --bare\n'
      + '  authenticates with the API key only. With no key, `--session-auth` runs the same plan on the logged-in\n  session (it counts against that account\'s plan).\n\n'
      + '  Preview without spending:  npm run benchmark:agent-ab -- --dry-run\n'
      + '  Run live:                  ANTHROPIC_API_KEY=sk-... npm run benchmark:agent-ab -- --save\n');
    return;
  }
  if (SAVE && RUNS < MIN_RUNS && !has('--allow-unpublishable')) {
    fail(`--save with ${RUNS} run(s) per arm would write a report below the ${MIN_RUNS} a result needs; pass --allow-unpublishable to keep a smoke test`, 2);
  }

  if (process.platform === 'win32') fail('the harness is POSIX only: the SigMap arm\'s `sigmap` is a sh shim', 2);

  say(printPlan(plan));
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-agent-ab-'));
  process.on('exit', () => { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* best effort */ } });
  // An interrupt must not leave a copy of every repo behind: exiting runs the handler above.
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));

  const prepared = {};
  for (const repo of used) {
    prepared[repo.name] = {};
    for (const arm of ARMS) {
      say(`  preparing ${repo.name} (${arm})`);
      prepared[repo.name][arm] = prepareArm({ root: DATA, repo, arm, tmpRoot, codeRoot: CODE_ROOT, variant: VARIANT, sessionAuth: SESSION_AUTH });
    }
    try { assertArmHygiene({ without: prepared[repo.name].without.cwd, with: prepared[repo.name].with.cwd, label: repo.name }); } catch (e) { fail(e.message); }
    if (SKILL_RUN || VARIANT === 'prefetch') {
      const probe = probeCli({ cwd: prepared[repo.name].with.cwd, binDir: prepared[repo.name].with.binDir });
      if (!probe.ok) fail(`${repo.name}: the SigMap arm's sigmap CLI does not answer (${probe.error})`);
    } else {
      const probe = probeMcp({ cwd: prepared[repo.name].with.cwd, codeRoot: CODE_ROOT });
      if (!probe.ok) fail(`${repo.name}: the SigMap arm's MCP server does not answer (${probe.error})`);
    }
    // A change run gets a checkout of its own per run (below); these were prepared to prove the arms are sound.
    if (CHANGE) for (const arm of ARMS) fs.rmSync(prepared[repo.name][arm].cwd, { recursive: true, force: true });
  }
  const armFor = CHANGE ? (repoName, armName) => {
    const repo = used.find((r) => r.name === repoName);
    const jobRoot = fs.mkdtempSync(path.join(tmpRoot, 'job-'));
    const a = prepareArm({ root: DATA, repo, arm: armName, tmpRoot: jobRoot, codeRoot: CODE_ROOT, variant: VARIANT, sessionAuth: false });
    return Object.assign(a, { dispose: () => fs.rmSync(jobRoot, { recursive: true, force: true }) });
  } : (repoName, armName) => prepared[repoName][armName];

  const env = childEnv();
  const prefetched = new Map();
  const version = API_AGENT ? 'direct Messages API' : agentVersion(BIN, env);
  // One `sigmap ask` per question, cached: both repetitions of a question get the same pre-ranked text.
  const prefetchFor = VARIANT === 'prefetch' ? (job, arm) => {
    const k = `${job.task.repo}/${job.task.id}`;
    if (!prefetched.has(k)) prefetched.set(k, prefetchContext({ cwd: arm.cwd, binDir: arm.binDir, query: job.task.query }));
    return prefetched.get(k);
  } : null;
  const runner = API_AGENT
    ? makeApiRunner({ apiKey: process.env.ANTHROPIC_API_KEY, baseUrl: process.env.ANTHROPIC_BASE_URL || undefined, model: MODEL, budgetUsd: BUDGET, timeoutMs: TIMEOUT, arms: armFor, prefetch: prefetchFor, change: CHANGE })
    : makeRunner({ bin: BIN, model: MODEL, budgetUsd: BUDGET, timeoutMs: TIMEOUT, env, arms: (repo, arm) => prepared[repo][arm], bare: !SESSION_AUTH, skills: SKILL_RUN, prefetch: prefetchFor });

  let n = 0;
  const entries = await runPlan({
    tasks, runs: RUNS, runner, maxConsecutiveFailures: MAX_FAILS, variant: VARIANT,
    ...(CHANGE ? { change: true, promptFor: changePrompt, scoreRun: (record) => (record.grade ? { pass: record.grade.pass, rank: null, named: [], why: record.grade.why } : { pass: false, rank: null, named: [] }) } : {}),
    onRun: ({ task, arm, run, record }) => {
      n++;
      const c = record.cost && record.cost.usd !== null ? `${record.cost.source === 'table' ? '≥' : ''}$${record.cost.usd.toFixed(4)}` : 'cost n/a';
      say(`  [${n}/${plan.agentRuns}] ${task.repo}/${task.id} run ${run} ${arm.padEnd(7)} `
        + `${record.ok ? (record.score.pass ? 'pass' : `miss${record.score.why ? ` (${record.score.why})` : ''}`) : `FAIL ${record.error}`}`
        + `${record.toolCalls ? `  ${record.toolCalls.total} tool calls` : ''}  ${c}  ${(record.durationMs / 1000).toFixed(1)} s`);
    },
  });

  const method = {
    agent: API_AGENT ? 'anthropic-messages-api' : 'claude-code',
    agentVersion: version,
    model: MODEL,
    runs: RUNS,
    variant: VARIANT,
    auth: SESSION_AUTH ? 'session' : 'api-key',
    runner: AGENT,
    taskIds: TASK_IDS,
    ...(CHANGE ? { corpus: 'benchmarks/tasks/retrieval-xrepo.jsonl of a change-task data root (scripts/build-change-tasks.mjs)', passDefinition: 'the fix\'s hidden tests pass on the agent\'s patch' } : {}),
    tasksPerRepo: PER_REPO,
    budgetUsd: BUDGET,
    timeoutMs: TIMEOUT,
    date: new Date().toISOString().slice(0, 10),
    repos: used.map((r) => ({ name: r.name, commit: r.commit })),
    skippedRepos: skipped,
  };
  const report = stamp(buildReport({ entries, tasks, method }), CODE_ROOT);

  if (RAW_OUT) {
    const raw = entries.map(({ task, arm, run, record }) => ({
      repo: task.repo, task: task.id, arm, run, ok: record.ok, error: record.error, pass: record.score.pass,
      named: record.score.named, toolCalls: record.toolCalls, usage: record.usage, usageSource: record.usageSource,
      cacheGaps: record.cacheGaps, cost: record.cost, limit: record.limit || null, why: record.score.why || null, patch: record.grade ? record.grade.patch : null,
      turns: record.turns, durationMs: record.durationMs, answer: record.answer,
    }));
    fs.writeFileSync(RAW_OUT, `${JSON.stringify(raw, null, 2)}\n`);
  }
  if (SAVE) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'agent-ab.json'), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT_DIR, 'agent-ab.md'), `${renderMarkdown(report)}\n`);
    say(`  wrote ${path.relative(CODE_ROOT, path.join(OUT_DIR, 'agent-ab.json'))} and agent-ab.md`);
  }
  writeAll(1, AS_JSON ? `${JSON.stringify(report, null, 2)}\n` : `${renderMarkdown(report)}\n`);
}

main().catch((e) => {
  if (e instanceof IntegrityError) fail(`integrity: ${e.message}. Nothing was recorded.`);
  fail(e.message);
});
