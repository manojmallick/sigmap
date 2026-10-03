'use strict';

/**
 * Hop-1 graph boost may not manufacture relevance (#851).
 *
 * `GRAPH_BOOST_AMOUNTS.hop1` is added once per importing seed, so a file with
 * many importers accumulated a boost larger than any real BM25 score in the
 * result set. A shared string utility ranked 3rd for mined task m007 — whose
 * subject names neither that file nor anything it does — on these signals:
 *
 *   exactToken 0 · symbolMatch 0 · prefixMatch 0 · pathMatch 0 · bm25 0
 *   graphBoost 9.2   (23 importing seeds x 0.40)
 *
 * Whether it happened at all turned on `_computeHubs`' threshold,
 * `ceil(fileCount * 0.2)`: the utility had exactly 36 importers, so it was a
 * hub at 180 graph nodes and stopped being one at 181 — adding ONE unrelated
 * file to the repo pushed the correct answer out of the top 5 and failed the
 * retrieval gate on a change that touched nothing in the ranker.
 *
 * Lifting a zero-score direct neighbour of a match is DESIGNED — #596 pins it,
 * and it is how a file that implements what a matching file calls gets found.
 * So the rule is not "never boost a non-match"; it is that a non-match may take
 * ONE bonus and may not ACCUMULATE. Two blunter fixes were tried and rejected:
 * refusing non-matches outright broke #596 and the A12 case-path test, and
 * capping everyone at one bonus reordered the matches among themselves and cost
 * src/graph/builder.js — a genuine rank-5 answer — its place.
 *
 * Run: node test/integration/graph-boost-relevance.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const { GRAPH_BOOST_AMOUNTS } = require(path.join(ROOT, 'src', 'retrieval', 'ranker'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

// `_computeHubs` excludes any file with >= ceil(fileCount * 0.2) importers, so
// the fixture has to be big enough that both subjects sit BELOW the threshold —
// otherwise the hub guard swallows them and every assertion here is vacuous.
const TOTAL = 60;
const IMPORTERS = 11;              // ceil(60 * 0.2) = 12, so 11 is not a hub
const hubThreshold = Math.ceil(TOTAL * 0.2);

/**
 * A repo with both shapes the fix has to tell apart:
 *
 *   src/clip-core.js            imported by 11 widgets, matches NOTHING in the
 *                               query — the shape that accumulated 9.2
 *   src/widget-layout-core.js   imported by 11 widgets AND matches the query —
 *                               the shape whose accumulation must survive
 */
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-boost-'));
  const src = path.join(dir, 'src');
  fs.mkdirSync(src, { recursive: true });

  fs.writeFileSync(path.join(src, 'clip-core.js'),
    'function clip(s, n) { return s.slice(0, n); }\nmodule.exports = { clip };\n');
  fs.writeFileSync(path.join(src, 'widget-layout-core.js'),
    'function renderWidgetLayout(widget, layout) { return widget + layout; }\n'
    + 'module.exports = { renderWidgetLayout };\n');

  for (let i = 0; i < IMPORTERS; i++) {
    fs.writeFileSync(path.join(src, `widget${i}.js`),
      "const { clip } = require('./clip-core');\n"
      + "const { renderWidgetLayout } = require('./widget-layout-core');\n"
      + `function renderWidgetLayout${i}(widget, layout) { return clip(renderWidgetLayout(widget, layout), 10); }\n`
      + `module.exports = { renderWidgetLayout${i} };\n`);
  }
  // Filler: no imports, no query tokens — present only to lift the hub
  // threshold above IMPORTERS.
  for (let i = 0; i < TOTAL - IMPORTERS - 2; i++) {
    fs.writeFileSync(path.join(src, `unrelated${i}.js`),
      `function computeTariffBracket${i}(amount) { return amount * 2; }\n`
      + `module.exports = { computeTariffBracket${i} };\n`);
  }
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'),
    JSON.stringify({ srcDirs: ['src'], maxTokens: 60000, autoMaxTokens: false, outputs: ['copilot'] }));
  return dir;
}

/**
 * Rank with the import graph wired, the way the eval runner and `ask` do.
 *
 * Runs in a child process with `cwd` set to the fixture: `buildSigIndex`
 * resolves the context file's paths against `process.cwd()`, so ranking a temp
 * repo from this process produces keys the graph cannot match and the boost
 * silently never applies — which would make every assertion here vacuous.
 */
function rankWithGraph(dir, query, topK) {
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [path.join(ROOT, 'gen-context.js')], { cwd: dir, stdio: 'ignore' });
  const script = `
    const path = require('path');
    const R = require(${JSON.stringify(path.join(ROOT, 'src', 'retrieval', 'ranker'))});
    let graph = null;
    try { graph = require(${JSON.stringify(path.join(ROOT, 'src', 'graph', 'builder'))}).buildFromCwd(process.cwd()); } catch (e) {}
    const index = R.buildSigIndex(process.cwd());
    const out = R.rank(process.argv[1], index, { cwd: process.cwd(), graph, topK: Number(process.argv[2]), learned: false })
      .map((r) => ({ file: path.relative(process.cwd(), r.file).split(path.sep).join('/'), score: r.score, signals: r.signals || {} }));
    process.stdout.write(JSON.stringify({ graphNodes: graph ? graph.reverse.size : 0, out }));
  `;
  const raw = execFileSync(process.execPath, ['-e', script, query, String(topK)],
    { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 24 });
  return JSON.parse(raw);
}

const matched = (s) => (s.bm25 || 0) > 0 || (s.exactToken || 0) > 0
  || (s.symbolMatch || 0) > 0 || (s.prefixMatch || 0) > 0 || (s.pathMatch || 0) > 0;

console.log('[graph-boost-relevance.test.js] hop-1 may not manufacture relevance (#851)');
console.log('');
console.log(`  fixture: ${TOTAL} files, ${IMPORTERS} importers, hub threshold ${hubThreshold}`);
console.log('');

// ── the fixture actually exercises the boost ────────────────────────────────

test('the fixture reaches the graph boost at all', () => {
  const { graphNodes, out } = rankWithGraph(makeRepo(), 'render widget layout', 60);
  assert.ok(graphNodes >= TOTAL - 5, `graph has ${graphNodes} nodes — the fixture did not build`);
  assert.ok(IMPORTERS < Math.ceil(graphNodes * 0.2),
    `${IMPORTERS} importers >= hub threshold ${Math.ceil(graphNodes * 0.2)} — the hub guard would `
    + 'swallow both subjects and every assertion below would pass vacuously');
  assert.ok(out.some((r) => (r.signals.graphBoost || 0) > 0),
    'no file received any hop-1 boost — the fixture does not exercise the code under test');
});

// ── the defect ─────────────────────────────────────────────────────────────

test('a non-matching file takes one bonus, not one per importer', () => {
  const dir = makeRepo();
  try {
    const { out } = rankWithGraph(dir, 'render widget layout', 60);
    const clip = out.find((r) => r.file === 'src/clip-core.js');
    if (!clip) return;                       // suppressed entirely is also fine
    assert.ok(!matched(clip.signals),
      'fixture drift: src/clip-core.js was supposed to share no token with the query');
    assert.ok((clip.signals.graphBoost || 0) <= GRAPH_BOOST_AMOUNTS.hop1 + 1e-9,
      `src/clip-core.js matches nothing yet carries graphBoost ${clip.signals.graphBoost} `
      + `from ${IMPORTERS} importers — popularity is being counted as relevance`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('no non-matching file anywhere accumulates past a single bonus', () => {
  const dir = makeRepo();
  try {
    const { out } = rankWithGraph(dir, 'render widget layout', 60);
    const offenders = out
      .filter((r) => !matched(r.signals)
        && (r.signals.graphBoost || 0) > GRAPH_BOOST_AMOUNTS.hop1 + 1e-9)
      .map((r) => `${r.file} (graphBoost ${r.signals.graphBoost})`);
    assert.deepStrictEqual(offenders, [],
      `these match nothing but accumulated multiple hop-1 bonuses: ${offenders.join(', ')}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a file that DOES match keeps its hop-1 accumulation', () => {
  // The rejected fix — boost each neighbour once — satisfied the two checks
  // above and broke this one.
  const dir = makeRepo();
  try {
    const { out } = rankWithGraph(dir, 'render widget layout', 60);
    const core = out.find((r) => r.file === 'src/widget-layout-core.js');
    assert.ok(core, 'the matching core module was not ranked at all');
    assert.ok((core.signals.graphBoost || 0) > GRAPH_BOOST_AMOUNTS.hop1 + 1e-9,
      `src/widget-layout-core.js matches the query and has ${IMPORTERS} importers, but its `
      + `graphBoost is ${core.signals.graphBoost} — one hop-1 bonus or less means legitimate `
      + 'accumulation was stripped');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── the threshold is no longer load-bearing ────────────────────────────────

test('the accumulation guard is wired, and hop-2 eligibility is untouched', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'retrieval', 'ranker.js'), 'utf8');
  assert.ok(/const hop1Matched = scored\.map\(\(e\) => e\.score > 0\)/.test(src),
    'hop-1 must know which files matched on their own');
  assert.ok(/hop1Matched\[idx\] \|\| !hop1Count\.has\(idx\)/.test(src),
    'hop-1 must allow one free bonus and gate accumulation on a real match');
  assert.ok(/idx !== undefined && hop2Eligible\[idx\]/.test(src),
    'hop-2 eligibility must stay in place');
});

test('adding one unrelated file does not reorder the top 5', () => {
  // That utility sat exactly ON ceil(fileCount * 0.2), so one added file flipped
  // it out of the hub set and into rank 3. With eligibility enforced, a
  // borderline hub can only be boosted when it matched the query anyway.
  const dir = makeRepo();
  try {
    const before = rankWithGraph(dir, 'render widget layout', 5).out.map((r) => r.file);
    fs.writeFileSync(path.join(dir, 'src', 'brand-new-module.js'),
      'function somethingElseEntirely(a) { return a; }\nmodule.exports = { somethingElseEntirely };\n');
    const after = rankWithGraph(dir, 'render widget layout', 5).out.map((r) => r.file);
    assert.deepStrictEqual(after, before,
      'adding one unrelated file reordered the top 5 — the hub threshold is still load-bearing');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

console.log('');
console.log(`  graph-boost-relevance: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
