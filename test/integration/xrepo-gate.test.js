'use strict';

// xrepo gate: decision rules, and an end-to-end run on a throwaway pinned repo (#892).

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GATE = path.join(ROOT, 'scripts/run-xrepo-gate.mjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}

const tmpDirs = [];
function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

// ── a throwaway "third-party" repo, pinned at an exact commit ───────────────
// Eight neutral file names and a vocabulary built so that a query naming one
// file's behaviour hits it and a query labelled with the wrong file misses.
const FILES = {
  'src/ledger.js': 'function settlePayment(invoice) {}\nfunction reconcileEntries(entries) {}\nmodule.exports = { settlePayment, reconcileEntries };\n',
  'src/vault.js': 'function refundPayment(invoice) {}\nfunction archiveRecords() {}\nmodule.exports = { refundPayment, archiveRecords };\n',
  'src/scribe.js': 'function createInvoice(order) {}\nfunction voidInvoice(invoice) {}\nmodule.exports = { createInvoice, voidInvoice };\n',
  'src/gateway.js': 'function chargeCard(card) {}\nfunction tokenizeCard(card) {}\nmodule.exports = { chargeCard, tokenizeCard };\n',
  'src/broker.js': 'function payoutSeller(seller) {}\nfunction scheduleBatch() {}\nmodule.exports = { payoutSeller, scheduleBatch };\n',
  'src/courier.js': 'function computeTax(order) {}\nmodule.exports = { computeTax };\n',
  'src/marshal.js': 'function recordAudit(event) {}\nmodule.exports = { recordAudit };\n',
  'src/herald.js': 'function notifyCustomer(customer) {}\nmodule.exports = { notifyCustomer };\n',
  'other/stray.js': 'function strayHelper() {}\nmodule.exports = { strayHelper };\n',
};

const RATIONALE = 'Fixture label: this file is where the behaviour in the query is implemented, by construction of the fixture.';
const TASKS = [
  { id: 'x001', query: 'settle a payment for an open invoice', expected_files: ['src/ledger.js'] },
  { id: 'x002', query: 'charge a customer card for the order', expected_files: ['src/gateway.js'] },
  // Deliberately mislabelled: the query is about refunds, the label is the audit file.
  { id: 'x003', query: 'refund a payment against an invoice', expected_files: ['src/marshal.js'] },
  { id: 'x004', query: 'void an invoice and notify the customer', expected_files: ['src/courier.js'] },
].map((t) => Object.assign({ split: 'hard', source: 'labelled', repo: 'shop', rationale: RATIONALE }, t));

function git(dir, args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function writeJson(file, v) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(v, null, 2) + '\n'); }
function writeTasks(data, tasks) {
  const f = path.join(data, 'benchmarks/tasks/retrieval-xrepo.jsonl');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, tasks.map((t) => JSON.stringify(t)).join('\n') + '\n');
}

/** A data root holding the manifest, tasks and one pinned checkout. */
function dataRoot({ tasks = TASKS, entry = {} } = {}) {
  const data = tmp('sigmap-xrepo-data-');
  const repo = path.join(data, 'benchmarks/repos/shop');
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ['init', '-q']);
  for (const [rel, body] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), body);
  }
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'fixture']);
  const commit = git(repo, ['rev-parse', 'HEAD']);
  writeJson(path.join(data, 'benchmarks/xrepo-repos.json'), {
    repos: [Object.assign({ name: 'shop', url: 'https://example.invalid/shop.git', commit, language: 'javascript', layout: 'src' }, entry)],
  });
  writeTasks(data, tasks);
  return { data, repo, commit };
}

function gate(data, args = []) {
  const r = spawnSync('node', [GATE, ...args], { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { SIGMAP_XREPO_DATA: data }) });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '' };
}

const baselinePath = (data) => path.join(data, 'benchmarks/xrepo-baseline.json');

(async () => {
  const gateLib = await import('../../scripts/lib/xrepo-gate.mjs');
  const bandLib = await import('../../scripts/lib/band.mjs');
  const { decide, totals, rankOf } = gateLib;

  // ── arithmetic ────────────────────────────────────────────────────────────

  await test('rankOf is the 1-based rank of the first expected file, or null', () => {
    assert.strictEqual(rankOf(['a', 'b', 'c'], ['c', 'z']), 3);
    assert.strictEqual(rankOf(['a', 'b', 'c'], ['b']), 2);
    assert.strictEqual(rankOf(['a', 'b'], ['z']), null);
    assert.strictEqual(rankOf([], ['z']), null);
  });

  await test('totals weights every task equally, not every repo', () => {
    const t = totals([{ tasks: 4, hits: 2, mrr: 0.5, precisionAt5: 0.1 }, { tasks: 6, hits: 3, mrr: 0.2, precisionAt5: 0.3 }]);
    assert.strictEqual(t.tasks, 10);
    assert.strictEqual(t.hits, 5);
    assert.strictEqual(t.hitAt5, 0.5);
    assert.ok(Math.abs(t.mrr - 0.32) < 1e-9, `mrr ${t.mrr}`);
    assert.ok(Math.abs(t.precisionAt5 - 0.22) < 1e-9, `p@5 ${t.precisionAt5}`);
    assert.strictEqual(totals([]).hitAt5, 0);
  });

  await test('the Wilson band is the published interval, and degenerates safely', () => {
    const { low, high } = bandLib.wilson(37, 60);
    assert.ok(Math.abs(low - 0.490) < 0.001 && Math.abs(high - 0.729) < 0.001, `37/60 -> ${low}..${high}`);
    assert.strictEqual(bandLib.band(37, 60), '49.0%-72.9%');
    assert.deepStrictEqual(bandLib.wilson(0, 0), { low: 0, high: 0 });
    assert.strictEqual(bandLib.wilson(10, 10).high, 1);
    assert.strictEqual(bandLib.wilson(0, 10).low, 0);
  });

  // ── the decision ──────────────────────────────────────────────────────────

  const rows = [{ repo: 'a', tasks: 5, hits: 4, mrr: 0.5, precisionAt5: 0.2 }, { repo: 'b', tasks: 5, hits: 3, mrr: 0.4, precisionAt5: 0.2 }];
  const base = { rows, expectedRepos: ['a', 'b'], offPin: [], prior: null, min: 0.5, noRegress: false, requireRepos: false, problems: [] };
  const prior = { repos: { a: { tasks: 5, hits: 4 }, b: { tasks: 5, hits: 3 } } };

  await test('a complete run at or above the floor passes', () => {
    assert.deepStrictEqual(decide(base).reasons, []);
  });

  await test('the floor is enforced on a complete run and names the shortfall', () => {
    const r = decide(Object.assign({}, base, { min: 0.8 }));
    assert.strictEqual(r.reasons.length, 1);
    assert.match(r.reasons[0], /xrepo hit@5 70\.0% \(7\/10\) below floor 80\.0%/);
  });

  await test('the floor is NOT enforced on an incomplete run — a subset is not comparable with the whole', () => {
    const r = decide(Object.assign({}, base, { rows: [rows[0]], min: 0.99 }));
    assert.strictEqual(r.complete, false);
    assert.deepStrictEqual(r.reasons, []);
  });

  await test('--require-repos fails when a repo is absent or off-pin', () => {
    const absent = decide(Object.assign({}, base, { rows: [rows[0]], requireRepos: true }));
    assert.match(absent.reasons[0], /repos not at their pin: b/);
    const off = decide(Object.assign({}, base, { rows: [rows[0]], offPin: ['b'], requireRepos: true }));
    assert.match(off.reasons[0], /repos not at their pin: b/);
    assert.deepStrictEqual(decide(Object.assign({}, base, { requireRepos: true })).reasons, []);
  });

  await test('a drop in any repo\'s hit count is a regression, an improvement is not', () => {
    const worse = [Object.assign({}, rows[0], { hits: 3 }), rows[1]];
    const r = decide(Object.assign({}, base, { rows: worse, prior, noRegress: true }));
    assert.deepStrictEqual(r.reasons, ['a hit@5 regressed 4/5 -> 3/5']);
    const better = [Object.assign({}, rows[0], { hits: 5 }), rows[1]];
    assert.deepStrictEqual(decide(Object.assign({}, base, { rows: better, prior, noRegress: true })).reasons, []);
  });

  await test('a baseline that no longer matches the corpus must be re-recorded, not compared', () => {
    const stale = { repos: { a: { tasks: 4, hits: 4 }, b: { tasks: 5, hits: 3 } } };
    const r = decide(Object.assign({}, base, { prior: stale, noRegress: true }));
    assert.match(r.reasons[0], /baseline for a covers 4 tasks but the corpus has 5/);
  });

  await test('a repo with no recorded baseline, or no baseline at all, fails --no-regress', () => {
    const partial = { repos: { a: { tasks: 5, hits: 4 } } };
    assert.match(decide(Object.assign({}, base, { prior: partial, noRegress: true })).reasons[0], /no baseline recorded for b/);
    assert.match(decide(Object.assign({}, base, { prior: null, noRegress: true })).reasons[0], /no baseline recorded/);
  });

  await test('a task that becomes unreachable fails --no-regress; one already recorded as unreachable does not', () => {
    const priorU = { repos: { a: { tasks: 5, hits: 4, unreachable: ['x002'] }, b: { tasks: 5, hits: 3 } } };
    const same = [Object.assign({}, rows[0], { unreachable: ['x002'] }), rows[1]];
    assert.deepStrictEqual(decide(Object.assign({}, base, { rows: same, prior: priorU, noRegress: true })).reasons, []);
    const worse = [Object.assign({}, rows[0], { unreachable: ['x002', 'x004'] }), rows[1]];
    const r = decide(Object.assign({}, base, { rows: worse, prior: priorU, noRegress: true }));
    assert.strictEqual(r.reasons.length, 1);
    assert.match(r.reasons[0], /a: 1 task\(s\) became unreachable \(x004\)/);
  });

  await test('task problems are grouped by repo and kind, not dumped one per line', () => {
    const problems = Array.from({ length: 7 }, (_, i) => ({ repo: 'a', id: `x00${i}`, kind: 'unindexed', detail: `f${i}.js is not in the zero-config index` }));
    const r = decide(Object.assign({}, base, { problems }));
    assert.strictEqual(r.reasons.length, 1);
    assert.match(r.reasons[0], /^a: 7 task problem\(s\) \[unindexed\]/);
    assert.match(r.reasons[0], /…$/);
  });

  // ── the script, end to end ────────────────────────────────────────────────

  await test('scores a pinned zero-config checkout and reports hits, misses and the band', () => {
    const { data } = dataRoot();
    const r = gate(data, ['--per-task']);
    assert.strictEqual(r.status, 0, r.out);
    assert.match(r.out, /shop\s+javascript\s+auto\s+4\s+50\.0%/);
    assert.match(r.out, /2\/4 tasks hit · 1 task = 25\.0pp · 95% interval 15\.0%-85\.0%/);
    assert.match(r.out, /Read it as a band, not a point/);
    assert.match(r.out, /x001\s+shop\s+\d/);
    assert.match(r.out, /x003\s+shop\s+-/, 'the mislabelled task must be a miss');
  });

  await test('--save records the baseline and --gate --no-regress then passes against it', () => {
    const { data } = dataRoot();
    assert.strictEqual(gate(data, ['--save']).status, 0);
    const b = JSON.parse(fs.readFileSync(baselinePath(data), 'utf8'));
    assert.strictEqual(b.repos.shop.tasks, 4);
    assert.strictEqual(b.repos.shop.hits, 2);
    assert.deepStrictEqual(Object.keys(b.repos.shop.ranks), ['x001', 'x002', 'x003', 'x004']);
    assert.strictEqual(b.repos.shop.ranks.x003, null);
    assert.strictEqual(b.overall.tasks, 4);
    const r = gate(data, ['--gate', '--no-regress', '--require-repos']);
    assert.strictEqual(r.status, 0, r.out);
    assert.match(r.out, /\[xrepo\] PASS/);
  });

  await test('the floor fails the gate on a complete run', () => {
    const { data } = dataRoot();
    gate(data, ['--save']);
    const r = gate(data, ['--gate', '--min', '0.9']);
    assert.strictEqual(r.status, 1);
    assert.match(r.out, /xrepo hit@5 50\.0% \(2\/4\) below floor 90\.0%/);
  });

  await test('a drop below the recorded hit count fails --no-regress', () => {
    const { data } = dataRoot();
    gate(data, ['--save']);
    const b = JSON.parse(fs.readFileSync(baselinePath(data), 'utf8'));
    b.repos.shop.hits = 3; // the recorded baseline claims one more hit than the tree delivers
    writeJson(baselinePath(data), b);
    const r = gate(data, ['--gate', '--no-regress']);
    assert.strictEqual(r.status, 1);
    assert.match(r.out, /shop hit@5 regressed 3\/4 -> 2\/4/);
  });

  await test('a corpus that outgrew its baseline fails until the baseline is re-recorded', () => {
    const { data } = dataRoot();
    gate(data, ['--save']);
    writeTasks(data, TASKS.slice(0, 3));
    const r = gate(data, ['--gate', '--no-regress']);
    assert.strictEqual(r.status, 1);
    assert.match(r.out, /baseline for shop covers 4 tasks but the corpus has 3/);
  });

  await test('--no-regress without any baseline fails rather than passing vacuously', () => {
    const { data } = dataRoot();
    const r = gate(data, ['--gate', '--no-regress']);
    assert.strictEqual(r.status, 1);
    assert.match(r.out, /no baseline recorded/);
  });

  await test('an absent checkout is skipped (exit 0) unless --require-repos', () => {
    const { data, repo } = dataRoot();
    fs.rmSync(repo, { recursive: true, force: true });
    const soft = gate(data, ['--gate']);
    assert.strictEqual(soft.status, 0, soft.out);
    assert.match(soft.out, /no pinned checkouts present — skipped/);
    const hard = gate(data, ['--gate', '--require-repos']);
    assert.strictEqual(hard.status, 1);
    assert.match(hard.out, /repos not at their pin: shop/);
  });

  await test('a checkout that is not at its pin is never scored', () => {
    const { data, repo } = dataRoot();
    fs.writeFileSync(path.join(repo, 'src/extra.js'), 'function extra() {}\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-q', '-m', 'drift']);
    const soft = gate(data, ['--gate']);
    assert.strictEqual(soft.status, 0, soft.out);
    assert.doesNotMatch(soft.out, /xrepo — labelled/, 'an off-pin repo must not be scored');
    const hard = gate(data, ['--gate', '--require-repos']);
    assert.strictEqual(hard.status, 1);
    assert.match(hard.out, /repos not at their pin: shop/);
  });

  // The #805 shape: the answer exists but sits outside what zero-config indexes.
  // other/stray.js is outside src/, so with the manifest pinning srcDirs to src/ it
  // is unindexed; with srcDirs covering other/ it is found.
  const STRAY = { id: 'x005', query: 'run the one-off helper that nobody else owns', expected_files: ['other/stray.js'],
    split: 'hard', source: 'labelled', repo: 'shop', rationale: RATIONALE };

  await test('a task whose only answer is outside the zero-config index is reported as unreachable and does not fail on its own', () => {
    const { data } = dataRoot({ tasks: TASKS.concat([STRAY]), entry: { srcDirs: ['src'] } });
    const r = gate(data, ['--gate', '--json']);
    assert.strictEqual(r.status, 0, r.out);
    const row = JSON.parse(r.stdout).rows[0];
    assert.deepStrictEqual(row.unreachable, ['x005']);
    assert.strictEqual(row.unindexed, 1);
    assert.strictEqual(row.hits, 2, 'an unreachable task is a miss');
    const table = gate(data, ['--per-task']);
    assert.match(table.out, /shop\s+javascript\s+srcDirs\s+5\s+40\.0%.*\s1\s*$/m);
    assert.match(table.out, /x005\s+shop\s+U\s+run the one-off helper/);
  });

  await test('a task that BECOMES unreachable fails --no-regress, and the baseline records the ones that are not', () => {
    const { data } = dataRoot({ tasks: TASKS.concat([STRAY]), entry: { srcDirs: ['src', 'other'] } });
    assert.strictEqual(gate(data, ['--save']).status, 0);
    const b = JSON.parse(fs.readFileSync(baselinePath(data), 'utf8'));
    assert.deepStrictEqual(b.repos.shop.unreachable, [], 'x005 is reachable while srcDirs covers other/');
    assert.strictEqual(b.repos.shop.ranks.x005, 1);
    assert.strictEqual(gate(data, ['--gate', '--no-regress']).status, 0, 'unchanged tree passes');

    // The manifest stops covering other/: same pin, same tasks, one answer unreachable.
    const mf = path.join(data, 'benchmarks/xrepo-repos.json');
    const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
    m.repos[0].srcDirs = ['src'];
    writeJson(mf, m);
    const r = gate(data, ['--gate', '--no-regress']);
    assert.strictEqual(r.status, 1, r.out);
    assert.match(r.out, /shop: 1 task\(s\) became unreachable \(x005\) — their expected files fell out of the zero-config index/);
    assert.match(r.out, /shop hit@5 regressed 3\/5 -> 2\/5/);

    // Re-recorded, the gap is part of the baseline and the gate is green again.
    assert.strictEqual(gate(data, ['--save']).status, 0);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(baselinePath(data), 'utf8')).repos.shop.unreachable, ['x005']);
    assert.strictEqual(gate(data, ['--gate', '--no-regress']).status, 0);
  });

  await test('an expected file that does not exist at the pin is a corpus defect and fails the gate', () => {
    const gone = Object.assign({}, STRAY, { expected_files: ['other/nowhere.js'] });
    const { data } = dataRoot({ tasks: TASKS.concat([gone]) });
    const r = gate(data, ['--gate']);
    assert.strictEqual(r.status, 1, r.out);
    assert.match(r.out, /shop: 1 task problem\(s\) \[missing-file\]/);
    assert.match(r.out, /other\/nowhere\.js does not exist at the pin/);
  });

  await test('a basename leak fails the gate even when the repo is absent', () => {
    const leaky = TASKS.concat([{ id: 'x005', query: 'where does the herald announce things to customers', expected_files: ['src/herald.js'],
      split: 'hard', source: 'labelled', repo: 'shop', rationale: RATIONALE }]);
    const { data, repo } = dataRoot({ tasks: leaky });
    fs.rmSync(repo, { recursive: true, force: true });
    const r = gate(data, ['--gate']);
    assert.strictEqual(r.status, 1, r.out);
    assert.match(r.out, /\[basename-leak\]/);
  });

  await test('scoring is hermetic and zero-config: a stale config is ignored, then restored byte-identically', () => {
    const { data, repo } = dataRoot();
    const stale = JSON.stringify({ srcDirs: ['other'] }) + '\n';
    fs.writeFileSync(path.join(repo, 'gen-context.config.json'), stale);
    const before = fs.readdirSync(repo).sort();
    const r = gate(data, ['--json']);
    assert.strictEqual(r.status, 0, r.out);
    const j = JSON.parse(r.stdout);
    assert.strictEqual(j.rows[0].hits, 2, 'the stale srcDirs=["other"] config must not have been applied');
    assert.strictEqual(j.rows[0].config, 'auto');
    assert.strictEqual(fs.readFileSync(path.join(repo, 'gen-context.config.json'), 'utf8'), stale, 'the stale config must be restored');
    assert.deepStrictEqual(fs.readdirSync(repo).sort(), before, 'no .context/ or adapter output may be left behind');
  });

  await test('--only scores a subset and --json is machine-readable', () => {
    const { data } = dataRoot();
    const r = gate(data, ['--only', 'shop', '--json']);
    const j = JSON.parse(r.stdout);
    assert.strictEqual(j.overall.tasks, 4);
    assert.strictEqual(j.band, '15.0%-85.0%');
    assert.deepStrictEqual(j.reasons, []);
  });

  await test('generation shadows python3, so Python is extracted identically on every machine', async () => {
    const lib = await import('../../scripts/lib/xrepo.mjs');
    const env = lib.zeroConfigEnv();
    const r = spawnSync('python3', ['-c', 'print(1)'], { env, encoding: 'utf8' });
    assert.notStrictEqual(r.status, 0, 'python3 must resolve to the failing shim, not the host interpreter');
    assert.strictEqual(lib.zeroConfigEnv().PATH, env.PATH, 'one shim per process, not one per repo');
    assert.strictEqual(env.HOME, process.env.HOME, 'the rest of the environment is untouched');
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
