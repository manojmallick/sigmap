'use strict';

/**
 * Published statements that an outsider could falsify in one step stay out (#992).
 *
 * Each of these got ahead of the measurement it rested on, and nothing failed
 * because nothing read the prose against the files and constants behind it:
 *
 *   1. "no per-repo tuning" / "blind selection" — the retrieval benchmark loads
 *      benchmarks/config-overrides.json, which pins `srcDirs` for every repo.
 *   2. "Hidden files … 0" — a literal in the quality benchmark; SigMap's budget
 *      does omit files from the written map, and says so when it does.
 *   3. The Zenodo record — its results file has `final_tokens` = 0 in all 405 rows.
 *   4. "105 real coding tasks" — a prompt-weight model, not live sessions.
 *   5. "5.9× lift" — 80.4% over a RANDOM-file baseline of 13.6%, not over a tool.
 *
 * (The About texts of two other repositories are outside this repository; a
 * test cannot read them.) History files — the roadmap and the changelog — record
 * what was published at the time and are not rewritten.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

const HISTORY = new Set(['roadmap.md', 'changelog.md']);

function docs() {
  const out = [{ rel: 'README.md', text: fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8') }];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.vitepress') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(md|txt)$/.test(e.name) && !HISTORY.has(e.name.toLowerCase())) {
        out.push({ rel: path.relative(ROOT, full), text: fs.readFileSync(full, 'utf8') });
      }
    }
  };
  walk(path.join(ROOT, 'docs-vp'));
  for (const f of ['llms.txt', 'llms-full.txt']) out.push({ rel: f, text: fs.readFileSync(path.join(ROOT, f), 'utf8') });
  return out;
}

/** Every line of every published document that matches `re`. */
function linesMatching(re) {
  const hits = [];
  for (const d of docs()) {
    d.text.split('\n').forEach((line, i) => { if (re.test(line)) hits.push({ where: `${d.rel}:${i + 1}`, line }); });
  }
  return hits;
}

const json = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

// ---------------------------------------------------------------------------
test('1. no document claims "no per-repo tuning", "zero per-repo tuning" or "blind selection"', () => {
  const hits = linesMatching(/\b(?:no|zero|without)\s+per-repo\s+tuning\b|blind selection/i);
  assert.deepStrictEqual(hits.map((h) => h.where), [], hits.map((h) => `${h.where}: ${h.line.trim().slice(0, 120)}`).join('\n'));
});

test('1. the generalization page names the pinned srcDirs, and counts them from the file', () => {
  const pinned = Object.keys(json('benchmarks/config-overrides.json')).length;
  const page = fs.readFileSync(path.join(ROOT, 'docs-vp/guide/generalization.md'), 'utf8');
  assert.ok(page.includes('benchmarks/config-overrides.json'), 'the page must name the file that pins the source directories');
  assert.ok(new RegExp(`\\b${pinned}\\b[^\\n]*(?:repos|of ${pinned})|${pinned} of ${pinned}`).test(page), `the page must state the number of pinned repos (${pinned})`);
  assert.ok(/xrepo|zero-config/i.test(page), 'the zero-config third-party measurement stands beside the headline');
});

// ---------------------------------------------------------------------------
test('2. the quality benchmark computes the SigMap side of "hidden files"; it is not a literal', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/run-quality-benchmark.mjs'), 'utf8');
  assert.ok(!/filesHiddenSigMap\s*=\s*0\b/.test(src), 'filesHiddenSigMap is still a literal 0');
  assert.ok(/filesHiddenSigMap\s*=\s*repo\.droppedCount/.test(src), 'filesHiddenSigMap must come from the measured droppedCount');
  // (The context-window OVERFLOW lines say "With SigMap: 0" and are true by construction of the token budget;
  // it is the files-hidden lines that must carry the measured count.)
  const hiddenLines = src.split('\n').filter((l) => /hidden/i.test(l) && (/With SigMap: 0\b/.test(l) || /→ 0 with SigMap/.test(l)));
  assert.deepStrictEqual(hiddenLines.map((l) => l.trim()), [], 'a files-hidden line still says 0 with SigMap');
});

test('2. the published hidden-files row carries the measured numbers, not 0', () => {
  const row = linesMatching(/^\|\s*Files left out of the context\s*\|/)[0];
  assert.ok(row, 'the headline table has the files-left-out row');
  assert.ok(!/^\|\s*Hidden files/i.test(row.line));
  const dropped = json('benchmarks/reports/token-reduction.json').repos.reduce((s, r) => s + (r.droppedCount || 0), 0);
  const hiddenRaw = json('benchmarks/reports/quality.json').summary.totalHiddenFiles;
  assert.ok(dropped > 0, 'the saved run did drop files, so "0 hidden" was false');
  assert.ok(row.line.includes(dropped.toLocaleString('en-US')), `the row must show ${dropped.toLocaleString('en-US')} files omitted from the map: ${row.line}`);
  assert.ok(row.line.includes(hiddenRaw.toLocaleString('en-US')), `the row must show ${hiddenRaw.toLocaleString('en-US')} hidden without SigMap: ${row.line}`);
});

// ---------------------------------------------------------------------------
test('3. every Zenodo link says what is wrong with the record it points at', () => {
  const hits = linesMatching(/zenodo\.(?:org\/records\/|19898842)|10\.5281\/zenodo\.19898842/);
  assert.ok(hits.length >= 5, `expected the README, four guides and the llms files to link the record, found ${hits.length}`);
  const bare = hits.filter((h) => !/known defect/i.test(h.line));
  assert.deepStrictEqual(bare.map((h) => h.where), [], `a link without the caveat:\n${bare.map((h) => `${h.where}: ${h.line.trim().slice(0, 140)}`).join('\n')}`);
});

// ---------------------------------------------------------------------------
test('4. the prompts figure is called modeled wherever it is called a reduction across tasks', () => {
  const hits = linesMatching(/prompts?\b.*real coding tasks|real coding tasks.*prompts?\b/i);
  assert.deepStrictEqual(hits.map((h) => h.where), [], hits.map((h) => `${h.where}: ${h.line.trim().slice(0, 140)}`).join('\n'));
  const card = linesMatching(/Latest saved run:.*prompts without SigMap/)[0];
  assert.ok(card && /modeled/i.test(card.line), `the homepage card must say modeled: ${card && card.line}`);
});

// ---------------------------------------------------------------------------
test('5. 5.9× is only ever stated against its random-file baseline', () => {
  const hits = linesMatching(/5\.9\s*[×x]/);
  const bare = hits.filter((h) => !/random/i.test(h.line));
  assert.deepStrictEqual(bare.map((h) => h.where), [], `5.9× with no baseline named:\n${bare.map((h) => `${h.where}: ${h.line.trim().slice(0, 140)}`).join('\n')}`);
  const m = json('version.json').metrics;
  assert.ok(Math.abs(m.retrieval_lift - m.hit_at_5 / m.baseline_hit_at_5) < 0.06, 'retrieval_lift is hit@5 over the baseline hit@5');
  assert.ok(m.baseline_hit_at_5 < 0.2, 'and that baseline is the random-file one');
});

console.log(`\npublished-claims: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
