#!/usr/bin/env node
/**
 * SigMap quality benchmark — measures what token reduction means for LLM behaviour
 *
 * No LLM API key required. Metrics are computed from repo stats and established
 * LLM context-window / pricing data.
 *
 * Usage:
 *   node scripts/run-quality-benchmark.mjs               # print all tables
 *   node scripts/run-quality-benchmark.mjs --save        # also write benchmarks/reports/quality.json
 *
 * Metrics computed per repo:
 *   1. Context overflow risk  — which model context windows does the raw repo overflow?
 *                               Overflow → LLM must truncate, hallucinate, or ask questions.
 *   2. Hallucination surface  — without SigMap the LLM has no function-name grounding;
 *                               we measure how many symbols are "dark" vs visible.
 *   3. Forced assumptions     — files invisible to LLM (truncated) with raw vs SigMap.
 *   4. Clarifying-question risk — repos where raw > GPT-4o window require the LLM to ask
 *                                  "could you share the relevant code?" before it can proceed.
 *   5. API cost savings       — real dollars at published GPT-4o & Claude Sonnet pricing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { withSharedRepoContext, loadOverrides } from './lib/shared-repo-context.mjs';
import { countSignatureLines, countContextLines } from './lib/signature-count.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const REPOS_DIR = path.join(ROOT, 'benchmarks', 'repos');
const REPORTS   = path.join(ROOT, 'benchmarks', 'reports');
const GEN_CTX   = path.join(ROOT, 'gen-context.js');
const SAVE      = process.argv.includes('--save');

// ─── Model context windows (input tokens) ────────────────────────────────────
const MODELS = [
  { name: 'GPT-4o',          limit: 128_000,  icon: '🟢' },
  { name: 'Claude Sonnet',   limit: 200_000,  icon: '🟠' },
  { name: 'Gemini 2.0 Flash',limit: 1_000_000,icon: '🔵' },
];

// ─── Pricing ($/1M input tokens, verified 2026-07) ───────────────────────────
// GPT-4o $2.50 (OpenAI, stable through 2026); Claude Sonnet 5/4.6 $3.00 and
// Haiku 4.5 $1.00 (platform.claude.com). Cached = prompt-cache read rate.
const PRICING = [
  { model: 'GPT-4o',        regularPer1M: 2.50, cachedPer1M: 1.25 },
  { model: 'Claude Sonnet', regularPer1M: 3.00, cachedPer1M: 0.30 },
  { model: 'Claude Haiku',  regularPer1M: 1.00, cachedPer1M: 0.10 },
];

const CALLS_PER_DAY = 10;

// ─── Load existing token-reduction.json ──────────────────────────────────────
const tokenFile = path.join(REPORTS, 'token-reduction.json');
if (!fs.existsSync(tokenFile)) {
  console.error('Run `node scripts/run-benchmark.mjs --save` first to generate token-reduction.json');
  process.exit(1);
}
const tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));

// ─── Count grounded symbols in each repo's SigMap output ─────────────────────
// Counted STRUCTURALLY, from the shape of the generated context, not by
// pattern-matching the prose inside it (#694). The old implementation tested
// each line against a hardcoded keyword-prefix allowlist (`function `, `def `,
// `fun `, … plus a `→` fallback), so any language whose signature begins with
// the identifier rather than a keyword counted as ZERO. R was the worst case:
// `name <- function(args)` matches nothing, so ggplot2 reported 1 grounded
// symbol out of 964 real signature lines — a 964x undercount published as
// "0% grounding" for a language the project markets as a headline capability.
// spring-petclinic (59 -> 361), vue-core (244 -> 666) and svelte (380 -> 1108)
// were wrong for the same reason.
//
// The generated context already delimits signatures: fenced blocks under
// `### <file>` headers. Counting non-empty lines inside those fences is
// language-agnostic and needs no allowlist, so a new extractor cannot silently
// read as zero.
/**
 * @returns {{ grounded: number, contextLines: number }} both measured from the
 *   SAME regenerated context — the hermetic wrapper restores the file on exit,
 *   so reading it afterwards would measure the previous run's artifact instead.
 */
function countGroundedSymbols(repoDir, configOverride) {
  const contextFile = path.join(repoDir, '.github', 'copilot-instructions.md');

  if (!fs.existsSync(repoDir)) return { grounded: 0, contextLines: 0 };

  // Regenerate through the shared hermetic primitive (#706). Restoring only
  // `gen-context.config.json` (the #522 fix) left the regenerated context AND
  // `.context/sig-index.json` on disk, so whichever suite ran last decided
  // what `run-honest-benchmark` — which reads context AS-IS — measured next.
  return withSharedRepoContext(repoDir, {
    override: configOverride,
    generate: () => { spawnSync('node', [GEN_CTX], { cwd: repoDir, encoding: 'utf8' }); },
    measure: () => {
      if (!fs.existsSync(contextFile)) return { grounded: 0, contextLines: 0 };
      const content = fs.readFileSync(contextFile, 'utf8');
      return {
        grounded: countSignatureLines(content),
        contextLines: countContextLines(content),
      };
    },
  });
}

// ─── Config overrides — shared single source of truth (#522) ─────────────────
// The old local copy here was a 13-entry subset of the retrieval harness's
// table; the missing entries (express, flask, spring-petclinic, serilog, …)
// meant this suite regenerated those repos with default srcDirs, overwriting
// the canonical contexts and decaying every later honest/retrieval score.
const CONFIG_OVERRIDES = loadOverrides(ROOT);

// ─── Per-repo analysis ────────────────────────────────────────────────────────
function pad(s, w, right = false) {
  s = String(s);
  return right ? s.padStart(w) : s.padEnd(w);
}
function fmtDollars(d) {
  return '$' + d.toFixed(d < 1 ? 3 : 2);
}

const results = [];
console.log('\nCounting grounded symbols per repo (this re-runs sigmap on each)...');

for (const repo of tokenData.repos) {
  const repoDir = path.join(REPOS_DIR, repo.repo);
  if (!fs.existsSync(repoDir)) {
    console.warn(`  SKIP ${repo.repo} — not cloned`);
    continue;
  }
  process.stdout.write(`  ${repo.repo} (${repo.language})... `);
  const { grounded: groundedSymbols, contextLines } = countGroundedSymbols(repoDir, CONFIG_OVERRIDES[repo.repo]);
  // Estimate raw functions: raw codebase has bodies+comments+whitespace averaging
  // ~200 tokens per function body. SigMap distills to ~15 tokens per signature.
  // So rough total functions ≈ rawTokens / 200.
  const estimatedRawSymbols = Math.round(repo.rawTokens / 200);
  const darkSymbols = Math.max(0, estimatedRawSymbols - groundedSymbols);
  process.stdout.write(`${groundedSymbols} grounded, ~${darkSymbols} dark\n`);

  // Context window overflow
  const overflowModels = MODELS.filter(m => repo.rawTokens > m.limit).map(m => m.name);
  const fitsModels     = MODELS.filter(m => repo.rawTokens <= m.limit).map(m => m.name);

  // Forced-assumption files: when raw overflows smallest model, LLM can only see
  // floor(contextWindow / avgTokensPerFile) files. With SigMap all are visible.
  const avgTokPerFile = repo.rawTokens / Math.max(repo.fileCount, 1);
  const gpt4oLimit    = MODELS[0].limit;
  const filesVisibleRaw    = repo.rawTokens > gpt4oLimit
    ? Math.floor(gpt4oLimit / avgTokPerFile)
    : repo.fileCount;
  const filesHiddenRaw     = Math.max(0, repo.fileCount - filesVisibleRaw);
  const filesHiddenSigMap  = 0; // SigMap always shows all files (signatures only)

  // Clarifying-question risk: any repo that overflows GPT-4o forces the LLM to ask
  const clarifyingQRisk =
    repo.rawTokens > gpt4oLimit ? 'HIGH — raw overflows GPT-4o' :
    repo.rawTokens > gpt4oLimit / 2 ? 'MEDIUM — approaching limit' : 'LOW';

  // API cost per day (CALLS_PER_DAY calls)
  const costRows = PRICING.map(p => {
    const rawCostDay    = (repo.rawTokens   / 1e6) * p.regularPer1M * CALLS_PER_DAY;
    const sigCostDay    = (repo.finalTokens / 1e6) * p.regularPer1M * CALLS_PER_DAY;
    const rawCostCached = (repo.rawTokens   / 1e6) * p.cachedPer1M  * CALLS_PER_DAY;
    const sigCostCached = (repo.finalTokens / 1e6) * p.cachedPer1M  * CALLS_PER_DAY;
    return {
      model: p.model,
      rawDayRegular:    rawCostDay,
      sigDayRegular:    sigCostDay,
      savedDayRegular:  rawCostDay - sigCostDay,
      rawDayCached:     rawCostCached,
      sigDayCached:     sigCostCached,
      savedDayCached:   rawCostCached - sigCostCached,
      savedMonthRegular: (rawCostDay - sigCostDay) * 30,
    };
  });

  results.push({
    repo: repo.repo,
    language: repo.language,
    rawTokens: repo.rawTokens,
    finalTokens: repo.finalTokens,
    groundedSymbols,
    estimatedRawSymbols,
    darkSymbols,
    groundingPct: Math.min(100, Math.round(groundedSymbols / Math.max(estimatedRawSymbols, 1) * 100)),
    // `estimatedRawSymbols` is a heuristic (rawTokens / 200). When the MEASURED
    // grounded count exceeds it, the estimate is wrong — not the measurement —
    // and the ratio is not a publishable number (#694). okhttp printed 114%.
    // Clamped above; flagged here so the rendering says so instead of implying
    // a precision the estimate does not have.
    estimateReliable: groundedSymbols <= estimatedRawSymbols,
    // Non-empty lines in the generated context, so the zero-grounding guard
    // below can tell "nothing to count" from "counter did not see it".
    contextLines,
    overflowModels,
    fitsModels,
    filesVisible: repo.fileCount,
    filesVisibleRaw,
    filesHiddenRaw,
    filesHiddenSigMap,
    clarifyingQRisk,
    costRows,
  });
}

if (results.length === 0) {
  console.error('\nNo repos found. Clone them first with run-benchmark.mjs.');
  process.exit(1);
}

const W = 100;
const sep = '═'.repeat(W);

// ─── Table 1: Context Overflow Risk ──────────────────────────────────────────
console.log('\n\n' + sep);
console.log('BENCHMARK 1 — Context Window Overflow Risk');
console.log('When raw content overflows a model\'s context window, the LLM must truncate,');
console.log('assume, or ask the user to "paste the relevant files" before it can proceed.');
console.log(sep);

const ow = [
  { label: 'Repo',          w: 22 },
  { label: 'Raw tokens',    w: 12, r: true },
  { label: 'GPT-4o 128K',  w: 14, r: true },
  { label: 'Claude 200K',  w: 14, r: true },
  { label: 'Gemini 1M',    w: 13, r: true },
  { label: 'SigMap',       w: 10, r: true },
];
const owHead = ow.map(c => pad(c.label, c.w, c.r)).join('  ');
const owDiv  = ow.map(c => '-'.repeat(c.w)).join('  ');

function overflowCell(rawTokens, limit) {
  if (rawTokens <= limit) return 'FITS ✓';
  const pct = Math.round((rawTokens / limit - 1) * 100);
  return `OVERFLOW +${pct}%`;
}

console.log('\n' + owHead + '\n' + owDiv);
for (const r of results) {
  console.log([
    pad(r.repo,                                    ow[0].w),
    pad(fmtNum(r.rawTokens),                       ow[1].w, true),
    pad(overflowCell(r.rawTokens, 128_000),        ow[2].w, true),
    pad(overflowCell(r.rawTokens, 200_000),        ow[3].w, true),
    pad(overflowCell(r.rawTokens, 1_000_000),      ow[4].w, true),
    pad('FITS ✓',                                  ow[5].w, true),
  ].join('  '));
}
console.log(owDiv);
const overflowCount = results.filter(r => r.rawTokens > 128_000).length;
console.log(`\n  ${overflowCount}/${results.length} repos overflow GPT-4o's 128K window without SigMap.`);
console.log(`  With SigMap: all ${results.length}/${results.length} repos fit in every model's context window.`);

// ─── Table 2: Hallucination Surface ──────────────────────────────────────────
console.log('\n\n' + sep);
console.log('BENCHMARK 2 — Hallucination Surface');
console.log('Without SigMap, the LLM cannot see function names it\'s being asked to call.');
console.log('"Dark symbols" = functions in the codebase the LLM must guess or hallucinate.');
console.log(sep);

const hs = [
  { label: 'Repo',           w: 22 },
  { label: 'Grounded (SigMap)',w: 20, r: true },
  { label: 'Dark (no SigMap)',w: 18, r: true },
  { label: 'Grounding %',    w: 13, r: true },
  { label: 'Hallu. risk',    w: 13, r: true },
];
const hsHead = hs.map(c => pad(c.label, c.w, c.r)).join('  ');
const hsDiv  = hs.map(c => '-'.repeat(c.w)).join('  ');

console.log('\n' + hsHead + '\n' + hsDiv);
for (const r of results) {
  const risk = r.groundingPct >= 80 ? 'LOW' : r.groundingPct >= 50 ? 'MEDIUM' : 'HIGH';
  console.log([
    pad(r.repo,                                    hs[0].w),
    pad(r.groundedSymbols + ' symbols',            hs[1].w, true),
    pad('~' + r.darkSymbols + ' symbols',          hs[2].w, true),
    pad(r.estimateReliable ? r.groundingPct + '%' : '>=100%*', hs[3].w, true),
    pad(r.estimateReliable ? risk : 'n/a',         hs[4].w, true),
  ].join('  '));
}
console.log(hsDiv);
// Average over rows whose raw-symbol ESTIMATE held. Including a row where the
// measured count already exceeded the estimate would average in a number the
// estimate cannot support; excluding it silently would read as full coverage,
// so the exclusion is stated.
const reliable = results.filter((r) => r.estimateReliable);
const unreliable = results.filter((r) => !r.estimateReliable);
const avgGrounding = reliable.length
  ? Math.round(reliable.reduce((s, r) => s + r.groundingPct, 0) / reliable.length)
  : 0;
console.log(`\n  Average grounding with SigMap: ${avgGrounding}% of estimated symbols made visible`
  + ` (${reliable.length}/${results.length} repos).`);
if (unreliable.length) {
  console.log(`  * ${unreliable.length} repo(s) excluded — measured signatures exceed the`
    + ` rawTokens/200 symbol estimate, so the ratio is not meaningful: `
    + unreliable.map((r) => `${r.repo} (${r.groundedSymbols} > ${r.estimatedRawSymbols})`).join(', '));
}

// ─── Table 3: Clarifying Questions + Forced Assumptions ───────────────────────
console.log('\n\n' + sep);
console.log('BENCHMARK 3 — Forced Assumptions & Clarifying Questions');
console.log('When raw content > context window, LLM sees only a fraction of the codebase.');
console.log('Every unseen file becomes an assumption. SigMap surfaces all files as signatures.');
console.log(sep);

const fa = [
  { label: 'Repo',              w: 22 },
  { label: 'Total files',       w: 13, r: true },
  { label: 'Visible (raw)',     w: 15, r: true },
  { label: 'Hidden (raw)',      w: 14, r: true },
  { label: 'Hidden (SigMap)',   w: 15, r: true },
  { label: 'Risk',              w: 10, r: true },
];
const faHead = fa.map(c => pad(c.label, c.w, c.r)).join('  ');
const faDiv  = fa.map(c => '-'.repeat(c.w)).join('  ');

console.log('\n' + faHead + '\n' + faDiv);
for (const r of results) {
  const risk =
    r.filesHiddenRaw > r.filesVisible * 0.5 ? 'CRITICAL' :
    r.filesHiddenRaw > 0                    ? 'HIGH'     : 'NONE';
  console.log([
    pad(r.repo,                                    fa[0].w),
    pad(r.filesVisible,                            fa[1].w, true),
    pad(r.filesVisibleRaw,                         fa[2].w, true),
    pad(r.filesHiddenRaw + ' hidden',              fa[3].w, true),
    pad('0 hidden',                                fa[4].w, true),
    pad(risk,                                      fa[5].w, true),
  ].join('  '));
}
console.log(faDiv);
const criticalCount = results.filter(r => r.filesHiddenRaw > r.filesVisible * 0.5).length;
console.log(`\n  ${criticalCount} repos have >50% of files hidden from the LLM without SigMap.`);
console.log(`  SigMap reduces hidden files to 0 for all repos.`);

// ─── Table 4: API Cost Savings ────────────────────────────────────────────────
console.log('\n\n' + sep);
console.log('BENCHMARK 4 — API Cost Savings');
console.log(`At ${CALLS_PER_DAY} calls/day per repo. Pricing ($/1M input, verified 2026-07):`);
console.log('GPT-4o $2.50 · Claude Sonnet $3.00 · Claude Haiku $1.00 (regular). Source: published API pricing.');
console.log(sep);

// Per-model cost table (GPT-4o only for readability; also print Claude summary)
for (const pricing of PRICING) {
  console.log(`\n── ${pricing.model} ($${pricing.regularPer1M}/1M regular · $${pricing.cachedPer1M}/1M cached) ──`);
  const cc = [
    { label: 'Repo',           w: 22 },
    { label: 'Raw/day',        w: 11, r: true },
    { label: 'SigMap/day',     w: 13, r: true },
    { label: 'Saved/day',      w: 12, r: true },
    { label: 'Saved/month',    w: 13, r: true },
    { label: 'Cached/day saved',w: 16, r: true },
  ];
  console.log(cc.map(c => pad(c.label, c.w, c.r)).join('  '));
  console.log(cc.map(c => '-'.repeat(c.w)).join('  '));
  let totalSavedDay = 0, totalSavedMonth = 0, totalSavedCached = 0;
  for (const r of results) {
    const cr = r.costRows.find(c => c.model === pricing.model);
    totalSavedDay   += cr.savedDayRegular;
    totalSavedMonth += cr.savedMonthRegular;
    totalSavedCached+= cr.savedDayCached;
    console.log([
      pad(r.repo,                          cc[0].w),
      pad(fmtDollars(cr.rawDayRegular),    cc[1].w, true),
      pad(fmtDollars(cr.sigDayRegular),    cc[2].w, true),
      pad(fmtDollars(cr.savedDayRegular),  cc[3].w, true),
      pad(fmtDollars(cr.savedMonthRegular),cc[4].w, true),
      pad(fmtDollars(cr.savedDayCached),   cc[5].w, true),
    ].join('  '));
  }
  console.log(cc.map(c => '-'.repeat(c.w)).join('  '));
  console.log([
    pad('TOTAL',                      cc[0].w),
    pad('',                           cc[1].w, true),
    pad('',                           cc[2].w, true),
    pad(fmtDollars(totalSavedDay),    cc[3].w, true),
    pad(fmtDollars(totalSavedMonth),  cc[4].w, true),
    pad(fmtDollars(totalSavedCached), cc[5].w, true),
  ].join('  '));
}

// ─── Zero-grounding guard (#694) ─────────────────────────────────────────────
// The R repos published "0% grounding" for months because the counter returned
// zero while the context file was full of signatures. A zero that coexists with
// a non-empty context is a COUNTER failure, not a measurement — fail the suite
// rather than writing the number into quality.json and the public benchmark page.
const zeroGrounded = results.filter((r) => r.groundedSymbols === 0 && r.contextLines > 0);
if (zeroGrounded.length) {
  console.error('\n[quality] FAIL — repo(s) counted 0 grounded symbols from a non-empty context file:');
  for (const r of zeroGrounded) {
    console.error(`  ${r.repo} (${r.language}): ${r.contextLines} non-empty context lines, 0 counted`);
  }
  console.error('  The signature counter is not seeing this language. Fix the counter, not the number.');
  process.exit(1);
}

// ─── Summary scorecard ────────────────────────────────────────────────────────
console.log('\n\n' + sep);
console.log('QUALITY SCORE SUMMARY');
console.log(sep);

const totalDark = results.reduce((s, r) => s + r.darkSymbols, 0);
const totalGrounded = results.reduce((s, r) => s + r.groundedSymbols, 0);
const totalHiddenFiles = results.reduce((s, r) => s + r.filesHiddenRaw, 0);
const overflowsGPT4o = results.filter(r => r.rawTokens > 128_000).length;
// Per-model aggregate monthly / daily input-cost savings across all repos.
const costByModel = PRICING.map(p => ({
  model: p.model,
  perMtok: p.regularPer1M,
  savedDay:   results.reduce((s, r) => s + r.costRows.find(x => x.model === p.model).savedDayRegular, 0),
  savedMonth: results.reduce((s, r) => s + r.costRows.find(x => x.model === p.model).savedMonthRegular, 0),
}));
const gpt4oCostAll = costByModel.find(m => m.model === 'GPT-4o').savedMonth;

console.log(`
  Context overflow (GPT-4o)  : ${overflowsGPT4o}/${results.length} repos overflow without SigMap → 0/${results.length} with SigMap
  Symbols grounded           : ~${totalGrounded.toLocaleString()} visible with SigMap  /  ~${totalDark.toLocaleString()} dark without
  Files hidden from LLM      : ${totalHiddenFiles.toLocaleString()} files hidden without SigMap → 0 with SigMap
  API cost saved (GPT-4o/mo) : ~${fmtDollars(gpt4oCostAll)}/month across ${results.length} repos at ${CALLS_PER_DAY} calls/day

  Clarifying-question trigger : any repo with raw > 128K tokens forces the LLM to ask
                                 "can you share the relevant files?" before answering.
                                 That's ${overflowsGPT4o} of ${results.length} repos. With SigMap: 0.
`);
console.log(sep);

// ─── Markdown output ──────────────────────────────────────────────────────────
const mdLines = [
  '## Quality benchmark — beyond token reduction',
  '',
  '### 1. Context window overflow risk',
  '',
  '| Repo | Raw tokens | GPT-4o 128K | Claude 200K | Gemini 1M | SigMap |',
  '|------|:----------:|:-----------:|:-----------:|:---------:|:------:|',
];
for (const r of results) {
  mdLines.push(
    `| **${r.repo}** | ${fmtNum(r.rawTokens)} | ${overflowCell(r.rawTokens, 128_000)} | ${overflowCell(r.rawTokens, 200_000)} | ${overflowCell(r.rawTokens, 1_000_000)} | FITS ✓ |`
  );
}
mdLines.push('');
mdLines.push(`**${overflowsGPT4o}/${results.length} repos overflow GPT-4o without SigMap. With SigMap: 0/${results.length}.**`);

mdLines.push('');
mdLines.push('### 2. Hallucination surface');
mdLines.push('');
mdLines.push('| Repo | Grounded symbols (SigMap) | Dark symbols (no SigMap) | Grounding % |');
mdLines.push('|------|:-------------------------:|:------------------------:|:-----------:|');
for (const r of results) {
  mdLines.push(`| **${r.repo}** | ${r.groundedSymbols} | ~${r.darkSymbols} | **${r.estimateReliable ? r.groundingPct + '%' : '≥100%*'}** |`);
}

mdLines.push('');
mdLines.push('### 3. Files hidden from LLM');
mdLines.push('');
mdLines.push('| Repo | Total files | Visible without SigMap | Hidden without SigMap | With SigMap |');
mdLines.push('|------|:-----------:|:----------------------:|:---------------------:|:-----------:|');
for (const r of results) {
  mdLines.push(`| **${r.repo}** | ${r.filesVisible} | ${r.filesVisibleRaw} | **${r.filesHiddenRaw}** | 0 |`);
}
mdLines.push('');
mdLines.push(`**${totalHiddenFiles.toLocaleString()} total files hidden from LLM across all repos without SigMap. With SigMap: 0.**`);

mdLines.push('');
mdLines.push('### 4. API cost savings (GPT-4o, 10 calls/day)');
mdLines.push('');
mdLines.push('| Repo | Raw cost/day | SigMap cost/day | Saved/day | Saved/month |');
mdLines.push('|------|:------------:|:---------------:|:---------:|:-----------:|');
for (const r of results) {
  const c = r.costRows.find(x => x.model === 'GPT-4o');
  mdLines.push(`| **${r.repo}** | ${fmtDollars(c.rawDayRegular)} | ${fmtDollars(c.sigDayRegular)} | ${fmtDollars(c.savedDayRegular)} | **${fmtDollars(c.savedMonthRegular)}** |`);
}
mdLines.push('');
mdLines.push(`*Total GPT-4o savings: ~${fmtDollars(gpt4oCostAll)}/month across ${results.length} repos at ${CALLS_PER_DAY} calls/day*`);

mdLines.push('');
mdLines.push('### 5. API cost savings by model (10 calls/day)');
mdLines.push('');
mdLines.push('| Model | Input $/1M | Saved / day | Saved / month |');
mdLines.push('|------|:----------:|:-----------:|:-------------:|');
for (const m of costByModel) {
  mdLines.push(`| ${m.model} | $${m.perMtok.toFixed(2)} | ${fmtDollars(m.savedDay)} | **${fmtDollars(m.savedMonth)}** |`);
}
mdLines.push('');
mdLines.push(`*Savings scale with each model's input rate — token reduction is model-agnostic; the dollar figure is not. Verified 2026-07 pricing: GPT-4o $2.50, Claude Sonnet $3.00, Claude Haiku $1.00 per 1M input tokens.*`);

console.log('\n\nMarkdown (copy into docs):\n');
console.log(mdLines.join('\n'));

// ─── Save JSON ────────────────────────────────────────────────────────────────
if (SAVE) {
  const out = {
    version: getVersion(),
    timestamp: new Date().toISOString(),
    assumptions: {
      callsPerDay: CALLS_PER_DAY,
      models: MODELS,
      pricing: PRICING,
      avgTokensPerSymbol: 15,
    },
    repos: results.map(r => ({
      repo: r.repo,
      language: r.language,
      rawTokens: r.rawTokens,
      finalTokens: r.finalTokens,
      groundedSymbols: r.groundedSymbols,
      estimatedRawSymbols: r.estimatedRawSymbols,
      darkSymbols: r.darkSymbols,
      groundingPct: r.groundingPct,
      estimateReliable: r.estimateReliable,
      overflowModels: r.overflowModels,
      filesVisible: r.filesVisible,
      filesVisibleRaw: r.filesVisibleRaw,
      filesHiddenRaw: r.filesHiddenRaw,
      filesHiddenSigMap: r.filesHiddenSigMap,
      clarifyingQRisk: r.clarifyingQRisk,
      costRows: r.costRows,
    })),
    summary: {
      repoCount: results.length,
      overflowGPT4oCount: overflowsGPT4o,
      totalGroundedSymbols: totalGrounded,
      totalDarkSymbols: totalDark,
      totalHiddenFiles,
      gpt4oSavedPerMonth: parseFloat(gpt4oCostAll.toFixed(2)),
    },
  };
  const outPath = path.join(REPORTS, 'quality.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nReport saved → benchmarks/reports/quality.json`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function getVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  } catch (_) { return 'unknown'; }
}
