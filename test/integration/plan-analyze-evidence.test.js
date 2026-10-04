'use strict';

/**
 * `--analyze` and `plan` each said things about a repo that the code behind
 * them could not support (#862, combining #769 and #774).
 *
 * `--analyze` marked a file tested when any entry directly under `test/`
 * contained its basename as a substring: tests one directory down were
 * invisible, and `fix` matched the directory `fixtures`. On this repo that
 * reported 5 files tested out of 182.
 *
 * `plan` filled "Likely to change" with the ranker's MEDIUM confidence band,
 * which by construction leaves out the files the task names and lets in
 * anything scoring a third of the top match — CI YAML and fixtures included.
 *
 * Both now rest on evidence that can be named: the test file that targets or
 * loads a source file, and the task words a change candidate actually carries.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const GEN = path.join(ROOT, 'gen-context.js');

const { buildTestCoverageIndex } = require(path.join(ROOT, 'src/analysis/test-coverage'));
const { findRelatedTests, relatedTestsIndex } = require(path.join(ROOT, 'src/evidence/pack'));
const { analyzeFiles, formatAnalysisTable } = require(path.join(ROOT, 'src/eval/analyzer'));
const { createPlan, isChangeCandidate, matchReason, CHANGE_CONFIDENCE } = require(path.join(ROOT, 'src/plan/planner'));
const { buildSigIndex, rank } = require(path.join(ROOT, 'src/retrieval/ranker'));
const fileClass = require(path.join(ROOT, 'src/util/file-class'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

function tmpRepo(prefix, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  return dir;
}

// ── The coverage index ─────────────────────────────────────────────────────
// The fixture trees live under lib/, not src/: this file embeds test source as
// strings, and a path in them must not resolve to a real file in this repo.

const FN = (name) => `function ${name}() { return 1; }\nmodule.exports = { ${name} };\n`;

const coverageRepo = tmpRepo('sigmap-coverage-', {
  'lib/judge/judge-engine.js': FN('judge'),
  'lib/deps/inventory.js': FN('inventory'),
  'lib/extractors/patterns.js': FN('extractPatterns'),
  'lib/security/patterns.js': FN('secretPatterns'),
  'lib/conventions/fix.js': FN('fix'),
  'lib/conventions/extract.js': FN('extract'),
  'lib/util/slug.js': FN('slug'),
  'lib/auth/index.js': FN('auth'),
  'lib/co/located.js': FN('located'),
  'lib/co/located.test.js': "require('./located');\n",
  'lib/lonely.js': FN('lonely'),
  // Named after the feature, one directory down, loaded by relative require.
  'test/integration/features/judge.test.js': "const { judge } = require('../../../lib/judge/judge-engine');\n",
  // Loaded through the repo root, as one path string.
  'test/integration/dependency-inventory.test.js': "const path = require('path');\nconst inv = require(path.join(ROOT, 'lib/deps/inventory'));\n",
  // Loaded through the repo root, as path segments.
  'test/integration/extractors/patterns.test.js': "const path = require('path');\nconst ext = require(path.join(ROOT, 'lib', 'extractors', 'patterns.js'));\n",
  'test/slug.test.js': "// named after its target\n",
  'test/auth.test.js': "const auth = require('../lib/auth');\n",
  // Decoys the substring scan fell for.
  'test/fixtures/fix.js': FN('fixtureFix'),
  'test/fixtures-adversarial/extract.js': FN('fixtureExtract'),
  'test/test_python_ast_extractor.py': "def test_it():\n    pass\n",
});

const coverage = buildTestCoverageIndex(coverageRepo, {});

test('a test one directory down, named after the feature, is found by what it loads', () => {
  assert.deepStrictEqual(coverage.testsFor('lib/judge/judge-engine.js'), ['test/integration/features/judge.test.js']);
});

test("a repo-relative path string counts as loading the file (path.join(ROOT, 'lib/x/y'))", () => {
  assert.deepStrictEqual(coverage.testsFor('lib/deps/inventory.js'), ['test/integration/dependency-inventory.test.js']);
});

test("so does the same path written as segments (path.join(ROOT, 'lib', 'x', 'y.js'))", () => {
  assert.deepStrictEqual(coverage.testsFor('lib/extractors/patterns.js'), ['test/integration/extractors/patterns.test.js']);
});

test('a same-named test belongs to the file it loads, not to every file of that stem', () => {
  // The naming rule alone gives patterns.test.js to both patterns.js files.
  assert.deepStrictEqual(coverage.testsFor('lib/security/patterns.js'), []);
});

test('a directory name is not a test: `fix` does not match `fixtures`', () => {
  assert.deepStrictEqual(coverage.testsFor('lib/conventions/fix.js'), []);
});

test('an unrelated substring is not a test: `extract` vs test_python_ast_extractor.py', () => {
  assert.deepStrictEqual(coverage.testsFor('lib/conventions/extract.js'), []);
});

test('fixture directories hold no tests, including a suffixed one', () => {
  const leaked = coverage.testFiles.filter((f) => /fixtures/.test(f));
  assert.deepStrictEqual(leaked, []);
});

test('the naming rule still works on its own', () => {
  assert.deepStrictEqual(coverage.testsFor('lib/util/slug.js'), ['test/slug.test.js']);
});

test('loading a directory resolves to its index file', () => {
  assert.deepStrictEqual(coverage.testsFor('lib/auth/index.js'), ['test/auth.test.js']);
});

test('a test beside its source is seen when the caller passes its file list', () => {
  assert.deepStrictEqual(coverage.testsFor('lib/co/located.js'), []);
  const withFiles = buildTestCoverageIndex(coverageRepo, { files: ['lib/co/located.js', 'lib/co/located.test.js'] });
  assert.deepStrictEqual(withFiles.testsFor('lib/co/located.js'), ['lib/co/located.test.js']);
});

test('no evidence means no tests, and a test file is not its own subject', () => {
  assert.deepStrictEqual(coverage.testsFor('lib/lonely.js'), []);
  assert.deepStrictEqual(coverage.testsFor('test/slug.test.js'), []);
});

test('relatedTestsIndex returns exactly what findRelatedTests returns', () => {
  const all = [...coverage.testFiles, 'lib/util/slug.js', 'lib/security/patterns.js', 'lib/extractors/patterns.js', 'lib/lonely.js'];
  const lookup = relatedTestsIndex(all);
  for (const f of all) assert.deepStrictEqual(lookup(f), findRelatedTests(f, all), f);
});

// ── --analyze ──────────────────────────────────────────────────────────────

test('--analyze reports covered from the shared index', () => {
  const abs = (rel) => path.join(coverageRepo, rel);
  const stats = analyzeFiles(
    ['lib/judge/judge-engine.js', 'lib/deps/inventory.js', 'lib/conventions/fix.js', 'lib/conventions/extract.js', 'lib/lonely.js'].map(abs),
    coverageRepo, {});
  const covered = Object.fromEntries(stats.map((s) => [s.file.replace(/\\/g, '/'), s.covered]));
  assert.deepStrictEqual(covered, {
    'lib/judge/judge-engine.js': true,
    'lib/deps/inventory.js': true,
    'lib/conventions/fix.js': false,
    'lib/conventions/extract.js': false,
    'lib/lonely.js': false,
  });
  const table = formatAnalysisTable(stats, false);
  assert.ok(/judge-engine\.js\s*\|.*✓ tested/.test(table), table);
  assert.ok(/conventions\/fix\.js\s*\|.*✗ untested/.test(table), table);
});

test('the four files #769 named are covered in this repo', () => {
  const real = buildTestCoverageIndex(ROOT, {});
  const expected = {
    'src/judge/judge-engine.js': 'test/integration/features/judge.test.js',
    'src/config/loader.js': 'test/integration/config-loader.test.js',
    'src/deps/inventory.js': 'test/integration/dependency-inventory.test.js',
    'src/create/orchestrate.js': 'test/integration/create.test.js',
  };
  for (const [file, by] of Object.entries(expected)) {
    assert.ok(real.testsFor(file).includes(by), `${file}: expected ${by}, got ${JSON.stringify(real.testsFor(file))}`);
  }
  // `fix.js` IS tested here — by the test that loads it, not by `test/fixtures`.
  assert.deepStrictEqual(real.testsFor('src/conventions/fix.js'), ['test/integration/conventions-fix.test.js']);
});

// ── plan: what can be on the change list ───────────────────────────────────

test('tests, fixtures, CI and docs are not change candidates unless the task asks', () => {
  const none = { tests: false, docs: false, ci: false, models: false };
  assert.strictEqual(isChangeCandidate('src/security/patterns.js', none), true);
  assert.strictEqual(isChangeCandidate('test/security/patterns.test.js', none), false);
  assert.strictEqual(isChangeCandidate('test/fixtures/.github/workflows/pipeline.yml', none), false);
  assert.strictEqual(isChangeCandidate('.github/workflows/publish.yml', none), false);
  assert.strictEqual(isChangeCandidate('README.md', none), false);
  assert.strictEqual(isChangeCandidate('dist/bundle.js', none), false);

  assert.strictEqual(isChangeCandidate('test/security/patterns.test.js', { tests: true }), true);
  assert.strictEqual(isChangeCandidate('.github/workflows/publish.yml', { ci: true }), true);
  assert.strictEqual(isChangeCandidate('README.md', { docs: true }), true);
});

test('a reason names the task words a file carries, and where', () => {
  const reason = matchReason('add a secret detection pattern', 'src/security/patterns.js', ['function detectSecret(text)  :1-9']);
  assert.ok(reason.includes('"secret" in signatures'), reason);
  assert.ok(reason.includes('"pattern" in path'), reason);
  assert.strictEqual(matchReason('rename the widget', 'src/util/format.js', ['function formatDate(d)  :1-4']),
    'no task word in its path or signatures');
});

// ── plan: the contract, on a fixture repo ──────────────────────────────────

const planRepo = tmpRepo('sigmap-plan-', {
  'lib/security/patterns.js': [
    '/** Secret detection patterns. */',
    'const SECRET_PATTERNS = [];',
    'function detectSecret(text) { return SECRET_PATTERNS.some((p) => p.test(text)); }',
    'function addSecretPattern(name, regex) { SECRET_PATTERNS.push(regex); }',
    'module.exports = { detectSecret, addSecretPattern, SECRET_PATTERNS };',
    '',
  ].join('\n'),
  'lib/security/scanner.js': "const { detectSecret } = require('./patterns');\nfunction scanLines(lines) { return lines.filter(detectSecret); }\nmodule.exports = { scanLines };\n",
  'lib/util/format.js': 'function formatDate(d) { return String(d); }\nmodule.exports = { formatDate };\n',
  'lib/billing/invoice.js': 'function createInvoice(order) { return { order }; }\nmodule.exports = { createInvoice };\n',
  'test/security/patterns.test.js': "const { detectSecret } = require('../../lib/security/patterns');\nfunction secretDetectionPatternTest() { return detectSecret('x'); }\n",
  'test/fixtures/secret-pattern.js': 'function secretPatternFixture() { return 1; }\nmodule.exports = { secretPatternFixture };\n',
  '.github/workflows/secret-scan.yml': 'name: secret pattern detection\non: [push]\njobs:\n  scan:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n',
  'package.json': '{ "name": "plan-fixture", "version": "1.0.0" }\n',
});

const generated = spawnSync('node', [GEN, '--cwd', planRepo], { cwd: planRepo, encoding: 'utf8' });
const GOAL = 'add a secret detection pattern';

test('fixture repo generates', () => {
  assert.strictEqual(generated.status, 0, `${generated.stdout}\n${generated.stderr}`.slice(-400));
});

test('the change list names the file the task is about, and no test, fixture or CI file', () => {
  const plan = createPlan(GOAL, planRepo, {});
  assert.ok(plan.likelyToChange.includes('lib/security/patterns.js'), JSON.stringify(plan.likelyToChange));
  for (const f of plan.likelyToChange) {
    assert.ok(!fileClass.isTestFile(f) && !fileClass.isMockFile(f) && !fileClass.isCiFile(f), `${f} is not an implementation file`);
  }
});

test('every entry is in the high band, and carries a score and a reason', () => {
  assert.strictEqual(CHANGE_CONFIDENCE, 'high');
  const plan = createPlan(GOAL, planRepo, {});
  const confidence = new Map(rank(GOAL, buildSigIndex(planRepo), { topK: 15, cwd: planRepo }).map((r) => [r.file, r.confidence]));
  assert.ok(plan.likelyToChangeEvidence.length > 0);
  assert.deepStrictEqual(plan.likelyToChangeEvidence.map((e) => e.file), plan.likelyToChange);
  for (const e of plan.likelyToChangeEvidence) {
    assert.strictEqual(confidence.get(e.file), 'high', `${e.file} is ${confidence.get(e.file)}`);
    assert.ok(e.score > 0 && e.score <= 1, `${e.file} score ${e.score}`);
    assert.ok(typeof e.reason === 'string' && e.reason.length > 0, `${e.file} has no reason`);
  }
  const subject = plan.likelyToChangeEvidence.find((e) => e.file === 'lib/security/patterns.js');
  assert.ok(/"(secret|detection|pattern)" in (path|signatures|path and signatures)/.test(subject.reason), subject.reason);
});

test('covered files name the tests that cover them', () => {
  const plan = createPlan(GOAL, planRepo, {});
  assert.deepStrictEqual(plan.relatedTests['lib/security/patterns.js'], ['test/security/patterns.test.js']);
  assert.ok(plan.coveredFiles.includes('lib/security/patterns.js'));
  assert.deepStrictEqual(plan.testsAffected, plan.coveredFiles);
});

test('plan prints score and reason per entry, and the tests beside each covered file', () => {
  const res = spawnSync('node', [GEN, 'plan', GOAL, '--cwd', planRepo], { cwd: planRepo, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('Likely to change (high-confidence implementation files'), res.stdout);
  assert.ok(/1\. lib\/security\/patterns\.js\s+\d\.\d\d\s+"/.test(res.stdout), res.stdout);
  assert.ok(res.stdout.includes('lib/security/patterns.js  ←  test/security/patterns.test.js'), res.stdout);
  const change = res.stdout.split('Likely to change')[1].split('\n\n')[0];
  assert.ok(!/\.yml|fixtures|\.test\./.test(change), change);
});

test('plan --json keeps likelyToChange as strings and adds the evidence beside it', () => {
  const res = spawnSync('node', [GEN, 'plan', GOAL, '--json', '--cwd', planRepo], { cwd: planRepo, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr);
  const json = JSON.parse(res.stdout);
  assert.ok(json.likelyToChange.every((f) => typeof f === 'string'));
  assert.deepStrictEqual(json.likelyToChangeEvidence.map((e) => e.file), json.likelyToChange);
  assert.deepStrictEqual(Object.keys(json.likelyToChangeEvidence[0]).sort(), ['file', 'reason', 'score']);
  assert.deepStrictEqual(json.relatedTests['lib/security/patterns.js'], ['test/security/patterns.test.js']);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
