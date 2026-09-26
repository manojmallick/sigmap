'use strict';

/**
 * Quality-benchmark grounding counter (#694).
 *
 * The counter used a hardcoded keyword-prefix allowlist, so any language whose
 * signature starts with the IDENTIFIER rather than a keyword counted as zero.
 * R is the worst case — `name <- function(args)` matches nothing, so ggplot2
 * published "1 grounded symbol / 0% grounding" against 964 real signature
 * lines, for a language the project markets as a headline capability.
 *
 * Two defects, two guard families here:
 *   1. counting must be STRUCTURAL (fenced blocks), not pattern-matched prose
 *   2. `groundingPct` must never exceed 100 — it divides by a rawTokens/200
 *      HEURISTIC, and when the measured count beats the estimate the ratio is
 *      not a publishable number (okhttp printed 114%)
 *
 * Run: node test/integration/quality-grounding.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

let pass = 0, fail = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); pass++; })
    .catch((e) => { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; });
}

// Signature shapes that the old keyword allowlist could not see.
const IDENTIFIER_FIRST = [
  ['R', 'setup_data <- function(data, params)'],
  ['R', 'stat_spoke <- function(...)'],
  ['Lua', 'M.render = function(opts)'],
  ['JS assignment', 'handler = (req, res) => {}'],
];

(async () => {
  const { countSignatureLines, countContextLines } =
    await import('../../scripts/lib/signature-count.mjs');

  // ── 1. Structural counting ────────────────────────────────────────────────

  await test('counts identifier-first signatures the keyword allowlist missed', () => {
    for (const [lang, sig] of IDENTIFIER_FIRST) {
      const doc = ['### a/b.R', '```', sig, '```', ''].join('\n');
      assert.strictEqual(countSignatureLines(doc), 1,
        `${lang} signature not counted: ${sig}`);
    }
  });

  await test('counts every non-empty line inside a fence, blank lines excluded', () => {
    const doc = [
      '### src/a.R', '```',
      'f <- function(x)', '', 'g <- function(y)',
      '```', '',
      '### src/b.R', '```',
      'h <- function(z)',
      '```', '',
    ].join('\n');
    assert.strictEqual(countSignatureLines(doc), 3);
  });

  await test('ignores prose outside fences', () => {
    const doc = [
      '# Code signatures', 'Some prose about function names.',
      '### src/a.R', '```', 'f <- function(x)', '```',
      'More prose mentioning class and def.', '',
    ].join('\n');
    assert.strictEqual(countSignatureLines(doc), 1);
  });

  await test('countContextLines separates "nothing to count" from "not seen"', () => {
    const empty = '';
    const proseOnly = '# Code signatures\n\nNo fences here.\n';
    assert.strictEqual(countContextLines(empty), 0);
    assert.strictEqual(countSignatureLines(proseOnly), 0);
    assert.ok(countContextLines(proseOnly) > 0,
      'prose-only doc should report context lines even with zero signatures');
  });

  await test('the real R corpus counts in the hundreds, not single digits', () => {
    const ctx = path.join(ROOT, 'benchmarks/repos/ggplot2/.github/copilot-instructions.md');
    if (!fs.existsSync(ctx)) { console.log('        (skip — ggplot2 not cloned)'); return; }
    const n = countSignatureLines(fs.readFileSync(ctx, 'utf8'));
    assert.ok(n > 500, `expected >500 R signature lines, counted ${n} (allowlist counted 1)`);
  });

  // ── 2. Published report invariants ────────────────────────────────────────

  const reportPath = path.join(ROOT, 'benchmarks/reports/quality.json');
  const report = fs.existsSync(reportPath)
    ? JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    : null;

  await test('no repo publishes a grounding percentage above 100', () => {
    if (!report) { console.log('        (skip — quality.json absent)'); return; }
    const over = report.repos.filter((r) => r.groundingPct > 100);
    assert.strictEqual(over.length, 0,
      'impossible percentages: ' + over.map((r) => `${r.repo} ${r.groundingPct}%`).join(', '));
  });

  await test('a repo whose measured count beats the estimate is flagged, not printed', () => {
    if (!report) { console.log('        (skip — quality.json absent)'); return; }
    for (const r of report.repos) {
      assert.notStrictEqual(r.estimateReliable, undefined,
        `${r.repo} missing estimateReliable`);
      const shouldBeReliable = r.groundedSymbols <= r.estimatedRawSymbols;
      assert.strictEqual(r.estimateReliable, shouldBeReliable,
        `${r.repo}: grounded ${r.groundedSymbols} vs estRaw ${r.estimatedRawSymbols}`
        + ` but estimateReliable=${r.estimateReliable}`);
    }
  });

  await test('no repo publishes 0 grounded symbols — that is a counter failure', () => {
    if (!report) { console.log('        (skip — quality.json absent)'); return; }
    const zero = report.repos.filter((r) => r.groundedSymbols === 0);
    assert.strictEqual(zero.length, 0,
      'zero-grounding rows (the R symptom): ' + zero.map((r) => `${r.repo} (${r.language})`).join(', '));
  });

  await test('the R repos report real grounding, not 0%', () => {
    if (!report) { console.log('        (skip — quality.json absent)'); return; }
    const rRepos = report.repos.filter((r) => /^(ggplot2|dplyr|shiny)$/.test(r.repo));
    if (!rRepos.length) { console.log('        (skip — R repos not in corpus)'); return; }
    for (const r of rRepos) {
      assert.ok(r.groundedSymbols > 100,
        `${r.repo} counted ${r.groundedSymbols} grounded symbols — the allowlist bug is back`);
      assert.ok(r.groundingPct > 0, `${r.repo} still publishes ${r.groundingPct}%`);
    }
  });

  // ── 3. The allowlist must not come back ───────────────────────────────────

  await test('the quality suite no longer pattern-matches signature prose', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/run-quality-benchmark.mjs'), 'utf8');
    assert.ok(!/startsWith\('(async )?function /.test(src),
      'keyword-prefix allowlist is back in run-quality-benchmark.mjs');
    assert.ok(src.includes('countSignatureLines'),
      'quality suite must count via scripts/lib/signature-count.mjs');
  });

  await test('the suite fails rather than publishing a zero-with-content row', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/run-quality-benchmark.mjs'), 'utf8');
    assert.ok(/contextLines > 0/.test(src) && /process\.exit\(1\)/.test(src),
      'no zero-grounding guard — the R undercount could publish again');
  });

  console.log(`\n  quality-grounding: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
