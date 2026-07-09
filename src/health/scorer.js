'use strict';

/**
 * SigMap health scorer (v8.11 — auditable composite).
 *
 * Computes a 0-100 health score for a project. Every deduction is recorded in a
 * `components[]` breakdown so the number is auditable (which signal cost what),
 * and purely-informational metrics live under `diagnostics` rather than being
 * dressed up as if they affect the grade.
 *
 * Scored signals (each appears in `components` only when it fires):
 *   1. context never generated  — no adapter output exists though source does  (45 pts)
 *   2. staleness                — freshest adapter output older than 7 days     (≤30 pts)
 *   3. low token reduction      — avg reduction under threshold (full strategy) (20 pts)
 *   4. cold-context staleness   — hot-cold context-cold.md older than 1 day     (≤10 pts)
 *   5. over-budget rate         — >20% of runs exceeded the token budget        (20 pts)
 *   6. sustained over-budget    — ≥3 consecutive over-budget runs               (5 pts)
 *
 * Diagnostics (informational, NOT scored): p50/p95 token count, and
 * languageCoverage (share of SigMap's supported languages present in the repo —
 * this is language diversity, not extractor quality, and was previously
 * mislabeled "extractorCoverage").
 *
 * Freshness looks at the freshest of ANY adapter output (not just Copilot), so a
 * Claude/Codex/Cursor user is not falsely flagged as "never generated".
 *
 * Grade scale:  A ≥ 90 | B ≥ 75 | C ≥ 60 | D < 60. Never throws.
 *
 * @param {string} cwd
 * @returns {object} { score, grade, components, strategy, tokenReductionPct,
 *   daysSinceRegen, strategyFreshnessDays, totalRuns, overBudgetRuns,
 *   overBudgetStreak, languageCoverage, extractorCoverage, diagnostics }
 */

const fs = require('fs');
const path = require('path');

// Every path a SigMap adapter may write context to (freshness looks at the
// freshest existing one). Mirrors the ranker's adapter-output probe order.
const CONTEXT_FILES = [
  ['.github', 'copilot-instructions.md'],
  ['CLAUDE.md'],
  ['AGENTS.md'],
  ['.cursorrules'],
  ['.windsurfrules'],
  ['.github', 'openai-context.md'],
  ['.github', 'gemini-context.md'],
  ['llm-full.txt'],
  ['llm.txt'],
];

function gradeFor(points) {
  if (points >= 90) return 'A';
  if (points >= 75) return 'B';
  if (points >= 60) return 'C';
  return 'D';
}

/**
 * Pure scoring core. Given gathered signals, return the score, grade, and the
 * labeled list of deductions. No IO — unit-testable in isolation.
 *
 * @param {object} s gathered signals
 * @returns {{ score:number, grade:'A'|'B'|'C'|'D', components:Array }}
 */
function composeHealth(s) {
  const components = [];
  const add = (id, label, penalty, detail) => {
    const p = Math.round(penalty);
    if (p > 0) components.push({ id, label, penalty: p, detail });
  };

  // 1. Context never generated — a project with source files but no context of
  //    any kind is not "healthy"; it hasn't been set up. Gated on hasSource so
  //    an empty/new directory is not penalised for having nothing to index.
  if (s.daysSinceRegen === null && s.hasSource) {
    add('not-generated', 'context never generated', 45,
      'no adapter output found — run `sigmap` to generate context');
  }

  // 2. Staleness — freshest adapter output older than the 7-day window.
  if (s.daysSinceRegen !== null && s.daysSinceRegen > 7) {
    add('staleness', 'context stale', Math.min(30, Math.floor((s.daysSinceRegen - 7) * 4)),
      `${s.daysSinceRegen}d since last regen (>7d)`);
  }

  // 3. Low token reduction — only meaningful for the 'full' strategy; hot-cold
  //    and per-module intentionally produce small/partial outputs.
  const reductionThreshold = s.strategy === 'full' ? 60 : 0;
  if (s.tokenReductionPct !== null && s.tokenReductionPct < reductionThreshold) {
    add('low-reduction', 'low token reduction', 20,
      `${s.tokenReductionPct}% avg reduction (<${reductionThreshold}%)`);
  }

  // 4. Cold-context staleness (hot-cold only).
  if (s.strategy === 'hot-cold' && s.strategyFreshnessDays !== null && s.strategyFreshnessDays > 1) {
    add('cold-freshness', 'cold context stale', Math.min(10, Math.floor(s.strategyFreshnessDays - 1) * 3),
      `context-cold.md ${s.strategyFreshnessDays}d old`);
  }

  // 5. Over-budget rate.
  if (s.overBudgetRuns > 0 && s.totalRuns > 0) {
    const rate = (s.overBudgetRuns / s.totalRuns) * 100;
    if (rate > 20) add('over-budget', 'runs over budget', 20,
      `${Math.round(rate)}% of runs exceeded budget (>20%)`);
  }

  // 6. Sustained over-budget streak — previously computed but never scored.
  if (s.overBudgetStreak >= 3) {
    add('over-budget-streak', 'sustained over-budget', 5,
      `${s.overBudgetStreak} consecutive over-budget runs`);
  }

  const penalty = components.reduce((sum, c) => sum + c.penalty, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  return { score, grade: gradeFor(score), components };
}

/**
 * Gather health signals from disk and score them. Never throws.
 * @param {string} cwd
 */
function score(cwd) {
  let strategy = 'full';
  try {
    const cfgPath = path.join(cwd, 'gen-context.config.json');
    if (fs.existsSync(cfgPath)) {
      strategy = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).strategy || 'full';
    }
  } catch (_) {}

  // ── Usage-log signals (only present when tracking has recorded runs) ────────
  let tokenReductionPct = null;
  let overBudgetRuns = 0;
  let totalRuns = 0;
  let p50TokenCount = 0;
  let p95TokenCount = 0;
  let overBudgetStreak = 0;
  try {
    const { readLog, summarize } = require('../tracking/logger');
    const { percentile, overBudgetStreak: calcStreak } = require('../format/dashboard');
    const entries = readLog(cwd);
    const sum = summarize(entries);
    if (sum.totalRuns > 0) tokenReductionPct = sum.avgReductionPct;
    overBudgetRuns = sum.overBudgetRuns;
    totalRuns = sum.totalRuns;
    const finals = entries.map((e) => Number(e.finalTokens)).filter(Number.isFinite);
    p50TokenCount = Math.round(percentile(finals, 50));
    p95TokenCount = Math.round(percentile(finals, 95));
    overBudgetStreak = calcStreak(entries);
  } catch (_) {}

  // ── Language coverage (DIAGNOSTIC — share of supported languages present,
  //    i.e. diversity, not extractor quality). Also yields hasSource. ──────────
  let languageCoverage = null;
  let hasSource = false;
  try {
    const { computeExtractorCoverage } = require('../format/dashboard');
    const cov = computeExtractorCoverage(cwd);
    languageCoverage = { covered: cov.covered, supported: cov.supported, pct: cov.pct };
    hasSource = Object.values(cov.perLanguage || {}).some((n) => n > 0);
  } catch (_) {}

  // ── Freshness across ALL adapter outputs (freshest wins) ───────────────────
  let daysSinceRegen = null;
  try {
    let newest = null;
    for (const parts of CONTEXT_FILES) {
      const p = path.join(cwd, ...parts);
      try {
        if (fs.existsSync(p)) {
          const m = fs.statSync(p).mtimeMs;
          if (newest === null || m > newest) newest = m;
        }
      } catch (_) {}
    }
    if (newest !== null) {
      daysSinceRegen = parseFloat(((Date.now() - newest) / (1000 * 60 * 60 * 24)).toFixed(1));
    }
  } catch (_) {}

  // ── Cold-context freshness (hot-cold strategy only) ────────────────────────
  let strategyFreshnessDays = null;
  if (strategy === 'hot-cold') {
    try {
      const coldFile = path.join(cwd, '.github', 'context-cold.md');
      if (fs.existsSync(coldFile)) {
        const m = fs.statSync(coldFile).mtimeMs;
        strategyFreshnessDays = parseFloat(((Date.now() - m) / (1000 * 60 * 60 * 24)).toFixed(1));
      }
    } catch (_) {}
  }

  const { score: points, grade, components } = composeHealth({
    strategy,
    daysSinceRegen,
    strategyFreshnessDays,
    tokenReductionPct,
    overBudgetRuns,
    totalRuns,
    overBudgetStreak,
    hasSource,
  });

  return {
    score: points,
    grade,
    components,
    strategy,
    tokenReductionPct,
    daysSinceRegen,
    strategyFreshnessDays,
    totalRuns,
    overBudgetRuns,
    overBudgetStreak,
    languageCoverage,
    // Back-compat top-level fields (also surfaced, honestly grouped, under
    // `diagnostics`). `extractorCoverage` keeps its old name but its value is
    // language-diversity pct (never extractor quality) — prefer `languageCoverage`.
    p50TokenCount,
    p95TokenCount,
    extractorCoverage: languageCoverage ? languageCoverage.pct : 0,
    diagnostics: { p50TokenCount, p95TokenCount, languageCoverage },
  };
}

module.exports = { score, composeHealth };
