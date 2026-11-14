'use strict';

/**
 * advise.js — `sigmap advise`: what SigMap can tell you about a project, offline, before you pick how an agent gets it.
 *
 * It reports FACTS and makes NO CALL. The agent study asked whether anything computable for free on a repository predicts how much a setup
 * saves there, with the test and its bar written first (docs-vp/guide/agent-study-protocol.md, Stage I). The test did not pass
 * (rho -0.13, 95% interval -0.57 to +0.36 over twenty repositories), so this command prints what each setup adds to a turn in the project,
 * how often SigMap's first five files hold the file a recent change of the project touched, against a single-shot grep, and whether the
 * project's prompts are readable by the hook, and says that these numbers did not predict the saving. It prints no percentage as a forecast.
 *
 * Read-only on the project: it runs `git log`/`git diff --name-only`, reads the index and the project's files, and writes nothing there (it never generates an
 * index; without one it says so).
 *
 * Zero-dependency.
 */

const fs = require('fs');
const path = require('path');
const { mineQuestions, DEFAULT_SINCE, DEFAULT_MAX } = require('./mine');
const { grepRank, sigmapOutputs } = require('./grep-scan');

// Fewer than this many questions and the interval is too wide to read: the numbers are still printed, with that said.
const MIN_QUESTIONS = 8;

/**
 * What the agent study measured, copied from benchmarks/agent-study/data/setup-signal-eval.txt (test/integration/advise.test.js fails if it drifts).
 * Messages-API agent, Haiku 5.5, the twenty held-out repositories, the typical-task change against each repository's own baseline.
 */
const STUDY = {
  repositories: 20,
  primary: { feature: 'headroom', setup: 'prefetch', measure: 'cost', rho: -0.13, lo: -0.57, hi: 0.36, bar: -0.5 },
  byGoal: {
    cost:   { index: { saves: 3, none: 15, costs: 2, pooled: -1 },  prefetch: { saves: 7, none: 8, costs: 5, pooled: -7 },  locate: { saves: 4, none: 16, costs: 0, pooled: -7 } },
    time:   { index: { saves: 1, none: 15, costs: 4, pooled: 2 },   prefetch: { saves: 19, none: 1, costs: 0, pooled: -18 }, locate: { saves: 1, none: 16, costs: 3, pooled: 1 } },
    tokens: { index: { saves: 0, none: 3, costs: 17, pooled: 51 },  prefetch: { saves: 9, none: 11, costs: 0, pooled: -26 }, locate: { saves: 1, none: 8, costs: 11, pooled: 18 } },
  },
};

const tokensOf = (bytes) => Math.ceil(bytes / 4); // chars/4, as everywhere in SigMap

/** "In the first five": the cut the agent study and the honest benchmark both use. */
const TOP = 5;
/** 1-based position of the first of `files` in `list`, or 0 when none is there. */
const rankOf = (list, files) => list.findIndex((f) => files.includes(f)) + 1;
const inTop = (rank) => rank >= 1 && rank <= TOP;
/** SigMap's share minus grep's, in whole points of the questions; null when grep was not scored. */
const headroomPoints = (lead, grep, n) => (grep === null || !n ? null : Math.round((100 * (lead - grep)) / n));
const fmt = (n) => Number(n).toLocaleString('en-US');

/** Wilson score interval for k of n at 95%, in [0, 1]. */
function wilson(k, n) {
  if (!n) return { lo: 0, hi: 1 };
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const w = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lo: Math.max(0, (c - w) / d), hi: Math.min(1, (c + w) / d) };
}

function _toolFacts() {
  const profile = require('../mcp/profile');
  const one = (tools) => { const r = profile.resolveProfile({ mcp: tools === null ? undefined : { tools } }); return { tools: r.names.length, tokens: r.tokens }; };
  return { locate: one('locate'), core: one('core'), all: one(null) };
}

function _alwaysOn(cwd) {
  const out = [];
  for (const rel of ['CLAUDE.md', 'AGENTS.md', path.join('.github', 'copilot-instructions.md')]) {
    try {
      const st = fs.statSync(path.join(cwd, rel));
      if (st.isFile()) out.push({ file: rel.replace(/\\/g, '/'), tokens: tokensOf(st.size) });
    } catch (_) { /* absent */ }
  }
  return out;
}

/** Ranks of each question's expected file, by the MCP `query_context` tool an agent calls, and by the single-shot grep. */
function _signals(cwd, questions, opts) {
  const handlers = require('../mcp/handlers');
  let lead = 0;
  let firstBlockTokens = null;
  questions.forEach((q, i) => {
    const txt = String(handlers.queryContext({ query: q.title, topK: 10 }, cwd));
    if (i === 0) firstBlockTokens = tokensOf(Buffer.byteLength(txt));
    const got = [...txt.matchAll(/^\| (\d+) \| (\S+) \| ([\d.]+) \|/gm)].map((m) => m[2]);
    if (inTop(rankOf(got, q.files))) lead++;
  });
  let grep = null, filesScanned = null, truncated = false;
  if (!opts.noGrep) {
    const g = grepRank(cwd, questions.map((q, i) => ({ id: String(i), query: q.title })), { skipFile: sigmapOutputs(cwd), maxFiles: opts.maxGrepFiles });
    grep = 0;
    questions.forEach((q, i) => {
      if (inTop(rankOf(g.ranked.get(String(i)) || [], q.files))) grep++;
    });
    filesScanned = g.filesScanned; truncated = g.truncated;
  }
  return { lead, grep, firstBlockTokens, filesScanned, truncated };
}

/**
 * @param {string} cwd
 * @param {{ since?: string, max?: number, noGrep?: boolean, maxGrepFiles?: number }} [opts]
 * @returns {object} the facts; `call` and `forecast` are always null
 */
function buildAdvice(cwd, opts = {}) {
  let config = {};
  try { config = require('../config/loader').loadConfig(cwd) || {}; } catch (_) { config = {}; }
  const prefetch = require('../session/prefetch');
  const tools = _toolFacts();
  const advice = {
    project: path.basename(cwd),
    call: null,
    forecast: null,
    standing: {
      strategy: config.strategy || 'full',
      mcpTools: (config.mcp && config.mcp.tools) || 'all',
      tools,
      alwaysOn: _alwaysOn(cwd),
      hook: { standingTokens: 0, perPromptMaxTokens: tokensOf(prefetch.MAX_BYTES), perPromptFirstQuestionTokens: null },
    },
    questions: { ok: false },
    lead: null,
    readability: null,
    notes: [],
    study: STUDY,
  };

  const mined = mineQuestions(cwd, { since: opts.since, max: opts.max });
  advice.questions = { ok: mined.ok, reason: mined.reason || null, since: mined.since || null, examined: mined.examined || 0, used: mined.questions.length, skipped: mined.skipped, list: mined.questions.map((q) => ({ sha: q.sha, title: q.title, files: q.files })) };
  if (!mined.ok) { advice.notes.push(`no questions mined: ${mined.reason}`); return advice; }
  if (mined.questions.length === 0) { advice.notes.push(`no change since ${mined.since} qualified as a question (1 to 3 source files, a title that describes behaviour); try a longer --since`); return advice; }

  // The hook's own screen, on each question as a prompt: how many would it stay silent for, and why.
  const silent = {};
  let fires = 0;
  for (const q of mined.questions) {
    const s = prefetch.screen(q.title);
    if (s.ok) fires++; else silent[s.reason] = (silent[s.reason] || 0) + 1;
  }
  advice.readability = { fires, silent: mined.questions.length - fires, reasons: silent };

  const indexFile = require('../retrieval/sig-index-store').indexPath(cwd);
  if (!fs.existsSync(indexFile)) { advice.notes.push('no index: run `sigmap` first (advise reads the index and never generates one), so SigMap\'s ranking was not scored'); return advice; }

  const n = mined.questions.length;
  const sig = _signals(cwd, mined.questions, opts);
  const w = (k) => { const i = wilson(k, n); return { count: k, of: n, share: k / n, lo: i.lo, hi: i.hi }; };
  advice.lead = { n, enough: n >= MIN_QUESTIONS, sigmap: w(sig.lead), grep: sig.grep === null ? null : w(sig.grep), headroomPoints: headroomPoints(sig.lead, sig.grep, n), filesScanned: sig.filesScanned, grepTruncated: sig.truncated };
  advice.standing.hook.perPromptFirstQuestionTokens = sig.firstBlockTokens;
  if (n < MIN_QUESTIONS) advice.notes.push(`only ${n} question(s) qualified (fewer than ${MIN_QUESTIONS}): the intervals are too wide to read; a longer --since finds more`);
  if (sig.truncated) advice.notes.push('the grep scan stopped at its file limit, so its share is for the files it reached');
  return advice;
}

const pc = (x) => `${Math.round(x * 100)}%`;
const sgn = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');

/** The human-readable report. */
function formatAdvice(a) {
  const L = [];
  const s = a.standing;
  L.push(`sigmap advise — ${a.project}: what SigMap can tell you offline (no model call, nothing written)`);
  L.push('');
  L.push('What each setup adds to a turn (tokens, estimated as chars/4; the API\'s own counter read the study\'s locate profile at 426 and core at 1,505):');
  L.push(`  tools, locate profile   ${fmt(s.tools.locate.tokens).padStart(6)}   (${s.tools.locate.tools} tools: query_context, get_lines)`);
  L.push(`  tools, core profile     ${fmt(s.tools.core.tokens).padStart(6)}   (${s.tools.core.tools} tools)`);
  L.push(`  tools, all              ${fmt(s.tools.all.tokens).padStart(6)}   (${s.tools.all.tools} tools)`);
  L.push(`  prefetch hook           ${String(0).padStart(6)}   standing; one block per prompt, at most ~${fmt(s.hook.perPromptMaxTokens)}${s.hook.perPromptFirstQuestionTokens !== null ? `; on your first question below, the search result is ~${fmt(s.hook.perPromptFirstQuestionTokens)}` : ''}`);
  L.push(`  now: strategy "${s.strategy}", mcp.tools "${s.mcpTools}"`);
  for (const f of s.alwaysOn) L.push(`  ${f.file.padEnd(30)} ${fmt(f.tokens).padStart(6)}   the whole file (which one your agent loads depends on the client)`);
  L.push('  the map `strategy: "index"` writes was 761 tokens on the API\'s counter for the study\'s snapshot of SigMap\'s own repository; it is not measured for yours here');
  L.push('');

  if (!a.questions.ok) {
    L.push(`Questions from your git history: none (${a.questions.reason}).`);
  } else if (a.questions.used === 0) {
    L.push(`Questions from your git history: none qualified since ${a.questions.since} (${a.questions.examined} commit(s) examined).`);
  } else {
    L.push(`Questions mined from your git history since ${a.questions.since}: ${a.questions.used} (${a.questions.examined} commit(s) examined; the title is the question, the source files it touched are the answer).`);
  }
  if (a.lead) {
    const l = a.lead;
    const band = (c) => `${c.count} of ${c.of} (${pc(c.share)}, 95% interval ${pc(c.lo)} to ${pc(c.hi)})`;
    L.push(`  the file is in SigMap's first five   ${band(l.sigmap)}`);
    if (l.grep) {
      L.push(`  the file is in a single-shot grep's  ${band(l.grep)}`);
      L.push(`  headroom (SigMap minus grep)         ${sgn(l.headroomPoints)} points`);
    }
  }
  if (a.readability) {
    const r = a.readability;
    L.push(`  the prefetch hook would fire for     ${r.fires} of ${r.fires + r.silent} of those titles as prompts${r.silent ? ` (silent for ${r.silent}: ${Object.entries(r.reasons).map(([k, v]) => `${v} ${k}`).join(', ')})` : ''}`);
  }
  for (const n of a.notes) L.push(`  note: ${n}`);
  L.push('');
  L.push('What this does NOT do: it makes no call and prints no saving. In the agent study these numbers did not predict which repositories save');
  L.push(`  (headroom against the cost of prefetch over ${STUDY.repositories} repositories: rho ${STUDY.primary.rho} [${STUDY.primary.lo}, +${STUDY.primary.hi}]; the bar was ${STUDY.primary.bar} with the interval below zero).`);
  L.push('');
  const g = STUDY.byGoal;
  L.push(`What the study measured, by goal (${STUDY.repositories} repositories, Messages-API agent, Haiku 5.5; repositories that save / cost more):`);
  L.push(`  time    prefetch ${sgn(g.time.prefetch.pooled)}% (${g.time.prefetch.saves} save, ${g.time.prefetch.costs} slower)   index ${sgn(g.time.index.pooled)}%   locate ${sgn(g.time.locate.pooled)}%`);
  L.push(`  tokens  prefetch ${sgn(g.tokens.prefetch.pooled)}% (${g.tokens.prefetch.saves} save, ${g.tokens.prefetch.costs} more)   index ${sgn(g.tokens.index.pooled)}%   locate ${sgn(g.tokens.locate.pooled)}%`);
  L.push(`  cost    prefetch ${sgn(g.cost.prefetch.pooled)}% (${g.cost.prefetch.saves} save, ${g.cost.prefetch.costs} more)   locate ${sgn(g.cost.locate.pooled)}% (${g.cost.locate.saves} save, ${g.cost.locate.costs} more)   index ${sgn(g.cost.index.pooled)}%`);
  L.push('');
  if (a.emitted) {
    const e = a.emitted;
    const q = (p) => `'${String(p).replace(/'/g, "'\\''")}'`;
    const per = Math.min(e.questions, 8);
    const base = `SIGMAP_XREPO_DATA=${q(e.root)} node scripts/run-agent-ab.mjs --agent api --model claude-haiku-5-5 --tasks-per-repo ${per} --runs 4`;
    L.push(`Harness inputs written under ${e.root} (nothing in your project): ${e.questions} question(s), pinned to ${e.commit.slice(0, 10)}, checkout linked to this project.`);
    if (e.dirty) L.push('  note: the working tree has uncommitted changes; every arm is a copy reset to the pinned commit, so the harness measures the committed state.');
    L.push('  1. preview the plan and the worst-case spend (spawns nothing); scripts/run-agent-ab.mjs is in the SigMap repository, not in the npm package:');
    L.push(`       ${base} --sigmap-variant prefetch --dry-run`);
    L.push('  2. run it (ANTHROPIC_API_KEY, each run capped by --max-budget-usd), once per setup; compare with the interval, not the point:');
    L.push(`       ${base} --sigmap-variant prefetch --save   # then --sigmap-variant index, then locate`);
    L.push('');
  }
  L.push('To find out for this project, measure it: https://sigmap.io/guide/choosing-a-setup');
  return L.join('\n');
}

module.exports = { buildAdvice, formatAdvice, wilson, rankOf, inTop, headroomPoints, TOP, STUDY, MIN_QUESTIONS, DEFAULT_SINCE, DEFAULT_MAX };
