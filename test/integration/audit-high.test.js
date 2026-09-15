'use strict';

/**
 * Integration tests for the v8.48 audit HIGH tier (#709 Tier 1).
 *
 * Tests:
 *  1.  H1 #659: compare outside the source checkout does not spawn the benchmark
 *  2.  H1 #659: compare outside the checkout renders local history
 *  3.  H1 #659: compare --json outside the checkout is machine-readable
 *  4.  H1 #659: compare --run without the corpus exits 1 and explains
 *  5.  H1 #659: compare writes nothing outside cwd
 *  6.  H2 #660: coverage never exceeds 100% when the index holds stale files
 *  7.  H2 #660: stale index entries are reported separately from coverage
 *  8.  H2 #660: a fully-indexed project reports 100% with no residuals
 *  9.  H2 #660: --query output is unchanged by the coverage rework
 */

const assert = require('assert');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const { spawnSync } = require('child_process');

const ROOT   = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

function makeProject(extraConfig) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'SigMap-High-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'gen-context.config.json'),
    JSON.stringify(Object.assign({ srcDirs: ['src'] }, extraConfig || {}))
  );
  return dir;
}

/**
 * A project containing an *installed-shaped* copy of the CLI: `gen-context.js`
 * with no sibling `scripts/` or `benchmarks/`, exactly as the npm tarball ships.
 */
function makeInstalledCopy(dir) {
  const installed = path.join(dir, 'node_modules', 'sigmap');
  fs.mkdirSync(installed, { recursive: true });
  const target = path.join(installed, 'gen-context.js');
  fs.copyFileSync(SCRIPT, target);
  return target;
}

function run(script, dir, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
}

function writeHistory(dir, records) {
  fs.mkdirSync(path.join(dir, '.context'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.context', 'benchmark-history.ndjson'),
    records.map((r) => JSON.stringify(r)).join('\n') + '\n'
  );
}

function listTree(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(d, e.name);
      out.push(path.relative(dir, full).replace(/\\/g, '/'));
      if (e.isDirectory()) walk(full);
    }
  })(dir);
  return out.sort();
}

console.log('[audit-high.test.js] v8.48 audit HIGH tier H1-H2 (#659 #660)');
console.log('');

// ---------------------------------------------------------------------------
// H1 - #659: compare must not spawn the 21-repo benchmark outside the checkout
// ---------------------------------------------------------------------------

test('H1: compare outside the source checkout does not spawn the benchmark', () => {
  const dir = makeProject();
  const cli = makeInstalledCopy(dir);

  const started = Date.now();
  const r = run(cli, dir, ['compare']);
  const elapsed = Date.now() - started;

  assert.strictEqual(r.status, 0, `compare should exit 0, got ${r.status}: ${r.stderr}`);
  assert.doesNotMatch(r.stdout, /Running comparison benchmark/,
    'the benchmark must not be spawned without its corpus');
  assert.doesNotMatch(r.stderr, /Could not parse benchmark output/,
    'the old crash path must be gone');
  // The old path burned 30-60s before dying; the guard is a filesystem probe.
  assert.ok(elapsed < 15000, `compare should return promptly, took ${elapsed}ms`);

  fs.rmSync(dir, { recursive: true });
});

test('H1: compare outside the checkout renders local history', () => {
  const dir = makeProject();
  const cli = makeInstalledCopy(dir);
  writeHistory(dir, [
    { ts: '2026-01-01', type: 'retrieval', hitAt5: 0.76 },
    { ts: '2026-02-01', type: 'token-reduction', reduction: 94 },
    { ts: '2026-03-01', type: 'retrieval', hitAt5: 0.88 },
    { ts: '2026-04-01', type: 'token-reduction', reduction: 97 },
  ]);

  const r = run(cli, dir, ['compare']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /local benchmark history/);
  assert.match(r.stdout, /88\.0%/, 'should show the latest hit@5');
  assert.match(r.stdout, /97%/, 'should show the latest token reduction');
  assert.match(r.stdout, /compare --run/, 'should say how to get the live comparison');

  fs.rmSync(dir, { recursive: true });
});

test('H1: compare --json outside the checkout is machine-readable', () => {
  const dir = makeProject();
  const cli = makeInstalledCopy(dir);
  writeHistory(dir, [
    { ts: '2026-01-01', type: 'retrieval', hitAt5: 0.76 },
    { ts: '2026-03-01', type: 'retrieval', hitAt5: 0.88 },
  ]);

  const r = run(cli, dir, ['compare', '--json']);
  assert.strictEqual(r.status, 0);
  const payload = JSON.parse(r.stdout);
  assert.strictEqual(payload.mode, 'history');
  assert.strictEqual(payload.available, true);
  assert.strictEqual(payload.hitAt5.first, 0.76);
  assert.strictEqual(payload.hitAt5.latest, 0.88);

  fs.rmSync(dir, { recursive: true });
});

test('H1: compare --run without the corpus exits 1 and explains', () => {
  const dir = makeProject();
  const cli = makeInstalledCopy(dir);

  const r = run(cli, dir, ['compare', '--run']);
  assert.strictEqual(r.status, 1, '--run must not silently fall back');
  assert.match(r.stderr, /needs the sigmap source checkout/);
  assert.match(r.stderr, /sigmap compare/, 'should point at the working alternative');

  fs.rmSync(dir, { recursive: true });
});

test('H1: compare writes nothing outside cwd', () => {
  const dir = makeProject();
  const cli = makeInstalledCopy(dir);
  writeHistory(dir, [{ ts: '2026-01-01', type: 'retrieval', hitAt5: 0.8 }]);

  const before = listTree(dir);
  run(cli, dir, ['compare']);
  assert.deepStrictEqual(listTree(dir), before, 'compare must not create files');

  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// H2 - #660: coverage is an intersection, so it cannot exceed 100%
// ---------------------------------------------------------------------------

/**
 * Generate context for three files, then delete one. The persisted index still
 * lists the deleted file, so the old `index.size / fileList.length` ratio went
 * over 100% — the exact shape that produced 218% in the sigmap repo.
 */
function makeStaleIndexProject() {
  const dir = makeProject({ maxTokens: 8000 });
  for (const name of ['alpha.js', 'beta.js', 'gamma.js']) {
    fs.writeFileSync(path.join(dir, 'src', name),
      `function ${name.replace('.js', '')}Handler(req, res) {}\n`);
  }
  run(SCRIPT, dir, []);                                  // build the index
  fs.unlinkSync(path.join(dir, 'src', 'beta.js'));       // now it is stale
  fs.unlinkSync(path.join(dir, 'src', 'gamma.js'));
  return dir;
}

test('H2: coverage never exceeds 100% when the index holds stale files', () => {
  const dir = makeStaleIndexProject();

  const r = run(SCRIPT, dir, ['validate', '--json']);
  const payload = JSON.parse(r.stdout.trim().split('\n').pop());

  assert.ok(payload.coverage <= 100, `coverage must be <= 100%, got ${payload.coverage}%`);
  assert.ok(payload.coverage >= 0, `coverage must be >= 0%, got ${payload.coverage}%`);
  assert.ok(payload.indexedInScope <= payload.totalFiles,
    'the intersection cannot exceed the in-scope population');

  fs.rmSync(dir, { recursive: true });
});

test('H2: stale index entries are reported separately from coverage', () => {
  const dir = makeStaleIndexProject();

  const r = run(SCRIPT, dir, ['validate', '--json']);
  const payload = JSON.parse(r.stdout.trim().split('\n').pop());

  assert.ok(payload.staleEntries >= 2,
    `two deleted files should surface as stale, got ${payload.staleEntries}`);
  assert.strictEqual(payload.indexedInScope + payload.notIndexed, payload.totalFiles,
    'the in-scope residuals must account for every scoped file');

  const text = run(SCRIPT, dir, ['validate']);
  assert.match(text.stderr, /stale index entries/, 'the text rendering should warn too');

  fs.rmSync(dir, { recursive: true });
});

test('H2: a fully-indexed project reports 100% with no residuals', () => {
  const dir = makeProject({ maxTokens: 8000 });
  fs.writeFileSync(path.join(dir, 'src', 'auth.js'), 'function loginUser(user) {}\n');
  run(SCRIPT, dir, []);

  const r = run(SCRIPT, dir, ['validate', '--json']);
  const payload = JSON.parse(r.stdout.trim().split('\n').pop());

  assert.strictEqual(payload.coverage, 100);
  assert.strictEqual(payload.notIndexed, 0);
  assert.strictEqual(payload.staleEntries, 0);

  fs.rmSync(dir, { recursive: true });
});

test('H2: --query output is unchanged by the coverage rework', () => {
  const dir = makeProject({ maxTokens: 8000 });
  fs.writeFileSync(path.join(dir, 'src', 'auth.js'), 'function loginUser(user) {}\n');
  run(SCRIPT, dir, []);

  const r = run(SCRIPT, dir, ['validate', '--query', 'loginUser', '--json']);
  const payload = JSON.parse(r.stdout.trim().split('\n').pop());

  assert.ok(payload.query, 'validate --query should still emit a query report');
  assert.strictEqual(payload.query.text, 'loginUser');
  assert.ok('topFile' in payload.query && 'confidence' in payload.query,
    'the query report shape must be preserved');

  fs.rmSync(dir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log('');
console.log(`${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
