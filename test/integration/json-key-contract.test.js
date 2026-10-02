'use strict';

/**
 * Output-contract guard for the `--json` surfaces (#845).
 *
 * `cli.md` had promised `ask --json` an `intent`, `coverage`, `cost`, `riskLevel`
 * and `rankedFiles` object since before v8.54.2. Two of those five keys did not
 * exist: `rankedFiles` was never implemented (no surface emits that name —
 * `--query --json` calls its array `results`), and the cost figure ships as
 * `costBefore`/`costAfter`/`savingsPct`. A consumer written against the
 * documented contract got `undefined` twice (#662).
 *
 * #661 guards that every dispatchable COMMAND appears in `--help`, and #817 asks
 * for the same at FLAG level. Neither covers OUTPUT KEYS, which is how a
 * documented-but-absent key survived several releases — and v8.61.0 added
 * fourteen keys to this exact surface, so the drift risk is live.
 *
 * The documented key list is read from `cli.md` rather than restated here. A
 * hand-kept list in the test would be a third place to drift, which is the
 * defect, not the fix.
 *
 * Run: node test/integration/json-key-contract.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const CLI_MD = path.join(ROOT, 'docs-vp', 'guide', 'cli.md');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

/** Run a command and parse the last JSON object on stdout (stderr may carry warnings). */
function runJson(dir, args) {
  const r = spawnSync(process.execPath, [GEN, ...args], { cwd: dir, encoding: 'utf8', timeout: 60000 });
  const line = (r.stdout || '').trim().split('\n').filter((l) => l.startsWith('{')).pop();
  assert.ok(line, `no JSON on stdout for ${args.join(' ')}: ${(r.stdout || '') + (r.stderr || '')}`.slice(0, 400));
  return JSON.parse(line);
}

const docText = fs.readFileSync(CLI_MD, 'utf8');

/**
 * Backticked identifiers in the sentence(s) that state a command's `--json`
 * contract. Scoped to one documented sentence per command so unrelated prose
 * cannot inflate the expected set.
 */
function documentedKeys(sentenceMatcher) {
  const m = docText.match(sentenceMatcher);
  assert.ok(m, `cli.md no longer states this --json contract: ${sentenceMatcher}`);
  const keys = new Set();
  for (const k of m[0].matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/g)) keys.add(k[1]);
  return keys;
}

/** A tiny repo with real source, generated so the index exists. */
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-jsonkeys-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'router.js'),
    'function dispatchChain(request, chain) {\n'
    + '  let index = 0;\n'
    + '  const next = () => (chain[index] ? chain[index++](request, next) : request);\n'
    + '  return next();\n'
    + '}\n'
    + 'module.exports = { dispatchChain };\n');
  fs.writeFileSync(path.join(dir, 'src', 'server.js'),
    "const { dispatchChain } = require('./router');\n"
    + 'function handle(request, chain) { return dispatchChain(request, chain); }\n'
    + 'module.exports = { handle };\n');
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'),
    JSON.stringify({ srcDirs: ['src'], outputs: ['copilot'], maxTokens: 6000 }));
  spawnSync(process.execPath, [GEN], { cwd: dir, encoding: 'utf8', timeout: 60000 });
  return dir;
}

// ---------------------------------------------------------------------------
// #662 — rankedFiles exists, and says what the selection was
// ---------------------------------------------------------------------------

test('ask --json emits rankedFiles', () => {
  const dir = makeRepo();
  const j = runJson(dir, ['ask', 'how does the chain dispatch a request', '--json']);
  assert.ok(Array.isArray(j.rankedFiles),
    `rankedFiles must be an array, got ${JSON.stringify(j.rankedFiles)}`);
  assert.ok(j.rankedFiles.length > 0, 'a source-bearing repo must rank something');
});

test('every rankedFiles row carries rank, file, score and tokens', () => {
  const dir = makeRepo();
  const j = runJson(dir, ['ask', 'how does the chain dispatch a request', '--json']);
  j.rankedFiles.forEach((row, i) => {
    assert.deepStrictEqual(Object.keys(row).sort(), ['file', 'rank', 'score', 'tokens'],
      `row ${i} shape drifted: ${JSON.stringify(row)}`);
    assert.strictEqual(row.rank, i + 1, `rank must be 1-based and in order, got ${row.rank} at index ${i}`);
    assert.strictEqual(typeof row.file, 'string');
    assert.ok(row.file.length > 0, 'file must be a path');
    assert.strictEqual(typeof row.score, 'number');
    assert.strictEqual(typeof row.tokens, 'number');
  });
});

test('rankedFiles reports the same selection as selectedFiles and cutoffScore', () => {
  const dir = makeRepo();
  const j = runJson(dir, ['ask', 'how does the chain dispatch a request', '--json']);
  assert.strictEqual(j.rankedFiles.length, j.selectedFiles,
    'the array and the count must describe one selection, not two');
  // The cut falls at the last row, so the two figures must agree exactly —
  // which is why the score is rounded the same way in both places.
  assert.strictEqual(j.rankedFiles[j.rankedFiles.length - 1].score, j.cutoffScore,
    'the last ranked score IS the cutoff; a mismatch means two roundings');
  const scores = j.rankedFiles.map((r) => r.score);
  const sorted = [...scores].sort((a, b) => b - a);
  assert.deepStrictEqual(scores, sorted, `rankedFiles must be in descending score order: ${scores}`);
});

test('rankedFiles honours --top', () => {
  const dir = makeRepo();
  const j = runJson(dir, ['ask', 'how does the chain dispatch a request', '--top', '1', '--json']);
  assert.strictEqual(j.rankedFiles.length, 1, `--top 1 must rank one file, got ${j.rankedFiles.length}`);
});

test('rankedFiles names the same files the written context carries', () => {
  const dir = makeRepo();
  const j = runJson(dir, ['ask', 'how does the chain dispatch a request', '--json']);
  const ctx = fs.readFileSync(path.join(dir, j.contextPath), 'utf8');
  for (const row of j.rankedFiles) {
    assert.ok(ctx.includes(`## ${row.file}`),
      `${row.file} is in rankedFiles but not in the context the same run wrote`);
  }
});

test('every pre-existing ask --json key is still present', () => {
  const dir = makeRepo();
  const j = runJson(dir, ['ask', 'how does the chain dispatch a request', '--json']);
  // The v8.61.0 surface, which consumers may already depend on. Adding
  // rankedFiles must not have displaced any of it.
  for (const k of [
    'intent', 'coverage', 'contextTokens', 'coveragePopulation', 'coverageIncluded',
    'coverageTotal', 'coverageBasis', 'costBefore', 'costAfter', 'savingsPct',
    'pricedModel', 'costBasis', 'riskLevel', 'riskAssessed', 'riskChangedFiles',
    'riskBasis', 'sourceFiles', 'supportFiles', 'sourceFree', 'stale', 'staleWarning',
    'withSource', 'source', 'contextPath', 'topK', 'selectedFiles', 'cutoffScore',
    'notes', 'contextHash',
  ]) {
    assert.ok(k in j, `pre-existing key dropped: ${k}`);
  }
});

// ---------------------------------------------------------------------------
// The class — documented keys are pinned to real output
// ---------------------------------------------------------------------------

test('every ask --json key cli.md documents is actually emitted', () => {
  const dir = makeRepo();
  const j = runJson(dir, ['ask', 'how does the chain dispatch a request', '--json']);
  const documented = documentedKeys(/With `--json` the output is a machine-readable object\.[\s\S]*?mean anything\./);
  // Identifiers that are value shapes, not top-level keys.
  const shapeWords = new Set(['rank', 'file', 'score', 'tokens', 'cost']);
  const expected = [...documented].filter((k) => !shapeWords.has(k));
  assert.ok(expected.length >= 6, `expected a real documented contract, got ${expected.join(', ')}`);
  const missing = expected.filter((k) => !(k in j));
  assert.deepStrictEqual(missing, [],
    `cli.md documents these ask --json keys but the command does not emit them: ${missing.join(', ')}`);
});

test('cli.md no longer promises a bare `cost` key for ask --json', () => {
  const dir = makeRepo();
  const j = runJson(dir, ['ask', 'how does the chain dispatch a request', '--json']);
  assert.ok(!('cost' in j), 'if a bare `cost` key is ever added, document it');
  // The old sentence is the regression this pins: it listed `cost` as a key.
  assert.doesNotMatch(docText,
    /machine-readable object with `intent`, `coverage`, `cost`, `riskLevel`, and `rankedFiles`/,
    'the corrected sentence must not come back');
});

test('every --callers --json key cli.md documents is actually emitted', () => {
  const j = runJson(ROOT, ['--callers', 'buildEvidencePack', '--json']);
  const documented = documentedKeys(/\| `--json` \| Emit `\{ symbol[\s\S]*?unqualified zero either \|/);
  const shapeWords = new Set(['roots', 'files', 'dynamicLoads', 'true']);
  const expected = [...documented].filter((k) => !shapeWords.has(k) && k !== 'json');
  const missing = expected.filter((k) => !(k in j));
  assert.deepStrictEqual(missing, [],
    `cli.md documents these --callers --json keys but they are absent: ${missing.join(', ')}`);
});

test('every judge --json key cli.md documents is actually emitted', () => {
  const dir = makeRepo();
  const ans = path.join(dir, 'answer.md');
  fs.writeFileSync(ans, 'The dispatchChain function lives in src/router.js.\n');
  const j = runJson(dir, ['judge', '--response', ans, '--json']);
  const documented = documentedKeys(/JSON output \(`--json`\) carries `score`[\s\S]*?exit code:/);
  const shapeWords = new Set(['high', 'medium', 'low', 'context', 'repo', 'null', 'checked', 'basis', 'confidence']);
  const expected = [...documented].filter((k) => !shapeWords.has(k) && k !== 'json');
  const missing = expected.filter((k) => !(k in j));
  assert.deepStrictEqual(missing, [],
    `cli.md documents these judge --json keys but they are absent: ${missing.join(', ')}`);
  // confidence IS a real key here; assert it directly rather than via the filter.
  assert.ok('confidence' in j, 'judge --json must carry confidence');
});

test('the guard fails when a key is documented but not emitted', () => {
  // Negative case: prove the assertion has teeth rather than trusting it.
  const emitted = { intent: 'search', coverage: 100 };
  const documented = new Set(['intent', 'coverage', 'phantomKey']);
  const missing = [...documented].filter((k) => !(k in emitted));
  assert.deepStrictEqual(missing, ['phantomKey'],
    'the comparison must surface a documented key that is absent');
  assert.throws(
    () => assert.deepStrictEqual(missing, []),
    'a documented-but-absent key must fail the assertion, not pass quietly'
  );
});

// ---------------------------------------------------------------------------

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
