'use strict';

// The exact paired test (#984): the sign-test arithmetic, the verdict words, the rank-table comparison, and the xrepo
// gate's "against the baseline" report on a throwaway pinned repository.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const XREPO = path.join(ROOT, 'scripts/run-xrepo-gate.mjs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}

const tmpDirs = [];
const tmp = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); tmpDirs.push(d); return d; };

/** An independent oracle: the two-sided sign test from exact integer binomials, no logarithms. */
function oracle(won, lost) {
  const n = won + lost;
  if (n === 0) return 1;
  const k = Math.min(won, lost);
  let c = 1n; // C(n, 0)
  let tail = 0n;
  for (let i = 0; i <= k; i++) {
    tail += c;
    c = (c * BigInt(n - i)) / BigInt(i + 1);
  }
  const num = Number(tail * 2n);
  return Math.min(1, num / Number(2n ** BigInt(n)));
}

(async () => {
  const pt = await import(path.join(ROOT, 'scripts/lib/paired-test.mjs'));

  // ── the arithmetic ─────────────────────────────────────────────────────────

  await test('signTest is the exact two-sided binomial test, checked against integer arithmetic for every count up to 40 each', () => {
    for (let w = 0; w <= 40; w++) {
      for (let l = 0; l <= 40; l++) {
        const got = pt.signTest(w, l);
        const want = oracle(w, l);
        assert.ok(Math.abs(got - want) < 1e-12, `signTest(${w}, ${l}) = ${got}, exact ${want}`);
      }
    }
  });

  await test('signTest on counts worth knowing by heart', () => {
    assert.strictEqual(pt.signTest(0, 0), 1, 'nothing changed: no evidence');
    assert.strictEqual(pt.signTest(3, 3), 1);
    assert.strictEqual(pt.signTest(5, 0), 0.0625, 'a clean sweep of 5 is still p = 0.0625');
    assert.strictEqual(pt.signTest(6, 0), 0.03125);
    assert.strictEqual(pt.signTest(0, 6), 0.03125, 'symmetric: losing six is as unlikely as winning six');
    assert.ok(Math.abs(pt.signTest(9, 1) - 22 / 1024) < 1e-12);
    assert.ok(Math.abs(pt.signTest(2, 8) - 112 / 1024) < 1e-12);
  });

  await test('signTest stays finite and monotone for large counts, and refuses nonsense', () => {
    const p = pt.signTest(300, 100);
    assert.ok(Number.isFinite(p) && p > 0 && p < 1e-20, `p = ${p}`);
    assert.ok(pt.signTest(300, 120) > pt.signTest(300, 100), 'more losses, less convincing');
    assert.strictEqual(pt.signTest(5000, 0), 0, 'underflows to zero rather than NaN');
    for (const bad of [[-1, 2], [1.5, 2], [1, NaN], ['3', 1]]) assert.throws(() => pt.signTest(...bad), /non-negative integer/);
  });

  await test('winsNeeded: the fewest wins that are decisive, and none below six changed tasks', () => {
    assert.strictEqual(pt.winsNeeded(0), null);
    for (const n of [1, 2, 3, 4, 5]) assert.strictEqual(pt.winsNeeded(n), null, `${n} changed tasks cannot be decisive`);
    assert.deepStrictEqual([6, 7, 8, 9, 10, 12, 20].map((n) => pt.winsNeeded(n)), [6, 7, 8, 8, 9, 10, 15]);
    for (const n of [6, 9, 12, 20]) {
      const w = pt.winsNeeded(n);
      assert.ok(pt.signTest(w, n - w) < 0.05 && pt.signTest(w - 1, n - w + 1) >= 0.05, `${w} of ${n} is the first decisive count`);
    }
  });

  // ── the verdict ────────────────────────────────────────────────────────────

  await test('pairedVerdict: unchanged, better, worse, inconclusive, and the edge at alpha', () => {
    assert.strictEqual(pt.pairedVerdict(0, 0).verdict, 'unchanged');
    assert.strictEqual(pt.pairedVerdict(6, 0).verdict, 'better');
    assert.strictEqual(pt.pairedVerdict(0, 6).verdict, 'worse');
    assert.strictEqual(pt.pairedVerdict(5, 0).verdict, 'inconclusive', 'p = 0.0625 is not below 0.05');
    assert.strictEqual(pt.pairedVerdict(4, 4).verdict, 'inconclusive');
    assert.strictEqual(pt.pairedVerdict(3, 1).verdict, 'inconclusive', 'a net gain of two is not evidence');
    const v = pt.pairedVerdict(9, 1);
    assert.deepStrictEqual([v.won, v.lost, v.n, v.net, v.alpha, v.verdict], [9, 1, 10, 8, 0.05, 'better']);
    assert.strictEqual(pt.pairedVerdict(9, 1, 0.01).verdict, 'inconclusive', 'a stricter alpha is honoured');
  });

  await test('formatP prints a p-value the way a reader should see it', () => {
    assert.strictEqual(pt.formatP(1), '1');
    assert.strictEqual(pt.formatP(0.5), '0.5');
    assert.strictEqual(pt.formatP(0.0625), '0.063');
    assert.strictEqual(pt.formatP(0.03125), '0.031');
    assert.strictEqual(pt.formatP(pt.signTest(8, 0)), '0.0078', 'two decimals of precision more below 0.01');
    assert.strictEqual(pt.formatP(0.0005), '0.0005', 'between 0.0001 and 0.001 is printed, not collapsed');
    assert.strictEqual(pt.formatP(0.00001), '<0.0001');
    assert.strictEqual(pt.formatP(0), '<0.0001');
  });

  await test('pairedText says no more than the count supports', () => {
    assert.strictEqual(pt.pairedText(pt.pairedVerdict(0, 0)), 'no task changed its hit status');
    assert.match(pt.pairedText(pt.pairedVerdict(6, 0)), /^exact sign test on 6 changed tasks: p = 0\.031 → better, beyond what reshuffling explains$/);
    assert.match(pt.pairedText(pt.pairedVerdict(1, 7)), /on 8 changed tasks: p = 0\.07 → not distinguishable from reshuffling \(8 of 8 would be decisive\)$/);
    assert.match(pt.pairedText(pt.pairedVerdict(0, 7)), /→ worse, beyond what reshuffling explains$/);
    assert.match(pt.pairedText(pt.pairedVerdict(2, 1)), /on 3 changed tasks: p = 1 → not distinguishable from reshuffling \(3 changed tasks are too few for any result to be decisive\)$/);
    assert.match(pt.pairedText(pt.pairedVerdict(1, 0)), /on 1 changed task: p = 1 → not distinguishable.*\(1 changed task is too few/);
    assert.match(pt.pairedText(pt.pairedVerdict(4, 2)), /\(6 of 6 would be decisive\)$/);
  });

  await test('pairedOfArm reads a signal arm: gained are wins, lost are losses', () => {
    const ids = (n) => Array.from({ length: n }, (_, i) => `t${i}`);
    assert.strictEqual(pt.pairedOfArm({ gained: ids(6), lost: [] }).verdict, 'better');
    assert.strictEqual(pt.pairedOfArm({ gained: [], lost: ids(6) }).verdict, 'worse');
    assert.deepStrictEqual([pt.pairedOfArm({ gained: ids(4), lost: ids(1) }).won, pt.pairedOfArm({ gained: ids(4), lost: ids(1) }).lost], [4, 1]);
    assert.strictEqual(pt.pairedOfArm({ gained: [], lost: [] }).verdict, 'unchanged');
  });

  // ── comparing two rank tables ──────────────────────────────────────────────

  await test('compareRanks counts hits at 5, lists what was won and lost, and counts what has nothing to compare with', () => {
    const before = { 'a/x1': 3, 'a/x2': null, 'a/x3': 5, 'a/x4': 6, 'a/x5': 1, 'b/x6': 2 };
    const after = { 'a/x1': null, 'a/x2': 2, 'a/x3': 6, 'a/x4': 5, 'a/x5': 1, 'a/x7': 4 };
    const c = pt.compareRanks(before, after);
    assert.deepStrictEqual(c.won, ['a/x2', 'a/x4'], 'miss -> rank 2, and rank 6 -> rank 5 (the cut-off is inclusive at 5)');
    assert.deepStrictEqual(c.lost, ['a/x1', 'a/x3'], 'rank 3 -> miss, and rank 5 -> rank 6');
    assert.strictEqual(c.compared, 5);
    assert.deepStrictEqual(c.onlyBefore, ['b/x6']);
    assert.deepStrictEqual(c.onlyAfter, ['a/x7']);
    assert.strictEqual(c.moved, 4, 'x5 stayed at rank 1; the other four moved');
    assert.strictEqual(c.verdict.won, 2);
    assert.strictEqual(c.verdict.lost, 2);
    assert.strictEqual(c.verdict.verdict, 'inconclusive');
  });

  await test('compareRanks: a rank that moves inside the top 5, or among misses, changes no hit', () => {
    const c = pt.compareRanks({ a: 4, b: 9, c: null }, { a: 1, b: 7, c: null });
    assert.deepStrictEqual([c.won, c.lost, c.moved], [[], [], 2]);
    assert.strictEqual(c.verdict.verdict, 'unchanged');
    assert.deepStrictEqual(pt.compareRanks({ a: 4, b: 9 }, { a: 8, b: 3 }, 10).won, [], 'the cut-off is a parameter');
    assert.deepStrictEqual(pt.compareRanks({ a: 9 }, { a: 8 }, 10).won, [], 'rank 9 and rank 8 are both hits at 10');
    assert.deepStrictEqual(pt.compareRanks({ a: 11 }, { a: 8 }, 10).won, ['a']);
  });

  // ── the xrepo gate, on a throwaway pinned repository ───────────────────────

  function git(dir, args) {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  }

  const RATIONALE = 'Fixture label: this file is where the behaviour in the query is implemented, by construction of the fixture.';
  const TASKS = [
    { id: 'x001', query: 'settle a payment for an open invoice', expected_files: ['src/ledger.js'] },
    { id: 'x002', query: 'refund a payment against an invoice', expected_files: ['src/marshal.js'] },
    { id: 'x003', query: 'charge a customer card for the order', expected_files: ['src/gateway.js'] },
  ];

  function dataRoot(tasks) {
    const data = tmp('sigmap-xrepo-paired-');
    const repo = path.join(data, 'benchmarks/repos/shop');
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
    git(repo, ['init', '-q']);
    const files = {
      'src/ledger.js': 'function settlePayment(invoice) {}\nmodule.exports = { settlePayment };\n',
      'src/vault.js': 'function refundPayment(invoice) {}\nmodule.exports = { refundPayment };\n',
      'src/scribe.js': 'function createInvoice(order) {}\nmodule.exports = { createInvoice };\n',
      'src/gateway.js': 'function chargeCard(card) {}\nmodule.exports = { chargeCard };\n',
      'src/broker.js': 'function payoutSeller(seller) {}\nmodule.exports = { payoutSeller };\n',
      'src/courier.js': 'function computeTax(order) {}\nmodule.exports = { computeTax };\n',
      'src/marshal.js': 'function recordAudit(event) {}\nmodule.exports = { recordAudit };\n',
      'src/herald.js': 'function notifyCustomer(customer) {}\nmodule.exports = { notifyCustomer };\n',
    };
    for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(repo, rel), body);
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-q', '-m', 'fixture']);
    const commit = git(repo, ['rev-parse', 'HEAD']);
    fs.writeFileSync(path.join(data, 'benchmarks/xrepo-repos.json'),
      JSON.stringify({ repos: [{ name: 'shop', url: 'https://example.invalid/shop.git', commit, language: 'javascript', layout: 'src' }] }, null, 2) + '\n');
    fs.mkdirSync(path.join(data, 'benchmarks/tasks'), { recursive: true });
    fs.writeFileSync(path.join(data, 'benchmarks/tasks/retrieval-xrepo.jsonl'),
      tasks.map((t) => JSON.stringify(Object.assign({ split: 'hard', source: 'labelled', repo: 'shop', rationale: RATIONALE }, t))).join('\n') + '\n');
    return data;
  }

  const xrepo = (data, args) => spawnSync('node', [XREPO, ...args], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env: Object.assign({}, process.env, { SIGMAP_XREPO_DATA: data }),
  });

  const baselineOf = (data) => path.join(data, 'benchmarks/xrepo-baseline.json');
  const readBaseline = (data) => JSON.parse(fs.readFileSync(baselineOf(data), 'utf8'));
  const writeBaseline = (data, b) => fs.writeFileSync(baselineOf(data), JSON.stringify(b, null, 2) + '\n');

  await test('with no baseline there is nothing to compare, and the JSON carries no vsBaseline', () => {
    const data = dataRoot(TASKS);
    const r = xrepo(data, ['--json']);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.strictEqual(JSON.parse(r.stdout).vsBaseline, undefined);
    assert.ok(!/against the baseline/.test(xrepo(data, []).stdout));
  });

  await test('against an identical baseline: every task compared, nothing changed, said in words', () => {
    const data = dataRoot(TASKS);
    assert.strictEqual(xrepo(data, ['--save']).status, 0);
    const j = JSON.parse(xrepo(data, ['--json']).stdout);
    assert.deepStrictEqual(
      [j.vsBaseline.compared, j.vsBaseline.newTasks, j.vsBaseline.won, j.vsBaseline.lost, j.vsBaseline.p, j.vsBaseline.verdict],
      [3, 0, 0, 0, 1, 'unchanged']);
    const text = xrepo(data, []).stdout;
    assert.match(text, /against the baseline {2}3 tasks compared · won 0 · lost 0\n {4}no task changed its hit status/);
    assert.ok(!/new, nothing to compare with/.test(text));
  });

  await test('a baseline that disagrees on some tasks: wins and losses are listed, with the exact test beside them', () => {
    const data = dataRoot(TASKS);
    assert.strictEqual(xrepo(data, ['--save']).status, 0);
    const b = readBaseline(data);
    const now = JSON.parse(xrepo(data, ['--json']).stdout).rows[0].ranks;
    const hit = Object.keys(now).filter((id) => now[id] !== null && now[id] <= 5);
    const miss = Object.keys(now).filter((id) => now[id] === null || now[id] > 5);
    assert.ok(hit.length >= 2, 'the fixture must hit at least two tasks for this test to mean anything');
    // Pretend the baseline missed one task we now hit (a win) and hit one we now miss or hit (a loss needs a miss now).
    b.repos.shop.ranks[hit[0]] = null;
    writeBaseline(data, b);
    let j = JSON.parse(xrepo(data, ['--json']).stdout).vsBaseline;
    assert.deepStrictEqual([j.won, j.lost, j.wonTasks, j.lostTasks, j.verdict], [1, 0, [`shop/${hit[0]}`], [], 'inconclusive']);
    const text = xrepo(data, []).stdout;
    assert.match(text, /won 1 · lost 0\n {4}exact sign test on 1 changed task: p = 1 → not distinguishable from reshuffling/);
    assert.match(text, new RegExp(`\\n {4}won {3}shop/${hit[0]}\\n`));
    if (miss.length) {
      b.repos.shop.ranks[miss[0]] = 2;
      writeBaseline(data, b);
      j = JSON.parse(xrepo(data, ['--json']).stdout).vsBaseline;
      assert.deepStrictEqual([j.won, j.lost, j.lostTasks], [1, 1, [`shop/${miss[0]}`]]);
      assert.match(xrepo(data, []).stdout, new RegExp(`\\n {4}lost {2}shop/${miss[0]}\\n`));
    }
  });

  await test('a baseline recorded before ranks were kept per task has nothing to compare, and does not crash the gate', () => {
    const data = dataRoot(TASKS);
    assert.strictEqual(xrepo(data, ['--save']).status, 0);
    const b = readBaseline(data);
    delete b.repos.shop.ranks;
    writeBaseline(data, b);
    const r = xrepo(data, ['--json']);
    assert.strictEqual(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout).vsBaseline;
    assert.deepStrictEqual([j.compared, j.newTasks, j.verdict], [0, 3, 'unchanged']);
  });

  await test('tasks the baseline does not hold yet are counted as new, never compared', () => {
    const data = dataRoot(TASKS.slice(0, 2));
    assert.strictEqual(xrepo(data, ['--save']).status, 0);
    fs.writeFileSync(path.join(data, 'benchmarks/tasks/retrieval-xrepo.jsonl'),
      TASKS.map((t) => JSON.stringify(Object.assign({ split: 'hard', source: 'labelled', repo: 'shop', rationale: RATIONALE }, t))).join('\n') + '\n');
    const j = JSON.parse(xrepo(data, ['--json']).stdout).vsBaseline;
    assert.deepStrictEqual([j.compared, j.newTasks, j.won, j.lost], [2, 1, 0, 0]);
    assert.match(xrepo(data, []).stdout, /against the baseline {2}2 tasks compared · 1 new, nothing to compare with · won 0 · lost 0/);
  });

  await test('--signals prints the exact test under each arm that changed a task', () => {
    const data = dataRoot(TASKS);
    const r = xrepo(data, ['--signals']);
    assert.strictEqual(r.status, 0, r.stderr);
    // An arm that changes no hit prints no won/lost block, so no verdict line either: the table says "identical to plain".
    const blocks = r.stdout.split('\n').filter((l) => /^ {6}(won|lost) /.test(l));
    const verdicts = r.stdout.split('\n').filter((l) => /^ {6}exact sign test on \d+ changed tasks?: p = /.test(l));
    if (blocks.length) assert.ok(verdicts.length > 0, 'a won/lost block must be followed by the exact test');
    else assert.strictEqual(verdicts.length, 0);
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\npaired-test: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
