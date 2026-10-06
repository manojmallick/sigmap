'use strict';

// Signal arms: the per-task comparison against plain and the xrepo gate's --signals report.

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

/** A ranker over fixed lists: the files each query returns, best first. */
const fixed = (byQuery) => (q) => byQuery[q];
const filler = (n, from = 1) => Array.from({ length: n }, (_, i) => `x${from + i}`);
/** `file` placed at 1-based `rank` among fillers. */
const at = (file, rank) => { const l = filler(60); l[rank - 1] = file; return l; };

(async () => {
  const arms = await import(path.join(ROOT, 'scripts/lib/signal-arms.mjs'));

  // ── comparing arms ─────────────────────────────────────────────────────────

  const TASKS = [
    { id: 't1', query: 'q1', expected_files: ['a'] },
    { id: 't2', query: 'q2', expected_files: ['b'] },
    { id: 't3', query: 'q3', expected_files: ['c'] },
    { id: 't4', query: 'q4', expected_files: ['d'] },
  ];

  await test('plain comes first and every other signal is judged against it', () => {
    assert.strictEqual(arms.ARMS[0].id, 'plain');
    assert.deepStrictEqual(arms.ARMS.map((a) => a.id), ['plain', 'centrality', 'surface', 'mined', 'callgraph', 'body', 'nograph']);
    assert.ok(arms.ARMS.every((a) => a.label));
    // the flags the arms stand for are the ones the config documents
    assert.deepStrictEqual(arms.ARMS.filter((a) => a.flag).map((a) => a.flag), [
      'retrieval.centralityBlend', 'retrieval.surfaceEnrichment', 'retrieval.minedExpansions', 'retrieval.callGraphBoost', 'retrieval.bodyWords',
    ]);
  });

  await test('an arm\'s hits, MRR and the tasks it wins and loses are counted against plain', () => {
    const plain = fixed({ q1: at('a', 1), q2: at('b', 6), q3: at('c', 3), q4: filler(60) });
    const arm = fixed({ q1: at('a', 1), q2: at('b', 4), q3: at('c', 7), q4: filler(60) });
    const out = arms.compareArms({ tasks: TASKS, rankers: { plain, arm } });
    assert.deepStrictEqual({ hits: out.plain.hits, tasks: out.plain.tasks }, { hits: 2, tasks: 4 });
    assert.strictEqual(out.plain.mrr, (1 + 1 / 3) / 4, 'MRR over the top 5, as the gate counts it');
    assert.deepStrictEqual(out.arm.gained, ['t2'], 'rank 6 -> 4 enters the top 5');
    assert.deepStrictEqual(out.arm.lost, ['t3'], 'rank 3 -> 7 leaves it');
    assert.strictEqual(out.arm.hits, 2);
    assert.deepStrictEqual(out.plain.gained, []);
    assert.deepStrictEqual(out.arm.ranks, { t1: 1, t2: 4, t3: 7, t4: null });
  });

  await test('a rank that changes inside the top 10 is a move even when no hit changes', () => {
    const plain = fixed({ q1: at('a', 2), q2: at('b', 20), q3: at('c', 8), q4: filler(60) });
    const arm = fixed({ q1: at('a', 3), q2: at('b', 30), q3: at('c', 8), q4: filler(60) });
    const out = arms.compareArms({ tasks: TASKS, rankers: { plain, arm } });
    assert.deepStrictEqual(out.arm.moves, [{ id: 't1', from: 2, to: 3 }], 'rank 20 -> 30 is far from the top 10 on both sides, and t3 did not move');
    assert.deepStrictEqual(out.arm.gained.concat(out.arm.lost), []);
  });

  await test('an arm identical to plain wins, loses and moves nothing', () => {
    const plain = fixed({ q1: at('a', 1), q2: at('b', 9), q3: at('c', 40), q4: filler(60) });
    const out = arms.compareArms({ tasks: TASKS, rankers: { plain, same: plain } });
    assert.deepStrictEqual([out.same.gained, out.same.lost, out.same.moves], [[], [], []]);
    assert.strictEqual(arms.verdictOf(out.same), 'identical to plain');
  });

  await test('comparing arms needs a plain arm', () => {
    assert.throws(() => arms.compareArms({ tasks: TASKS, rankers: { arm: fixed({}) } }), /plain arm/);
  });

  await test('repos are added up with their task ids kept apart, and MRR weighted by tasks', () => {
    const mk = (hits, tasks, mrr, gained, lost) => ({ plain: { tasks, hits, mrr, gained: [], lost: [], moves: [] }, arm: { tasks, hits: hits + gained.length - lost.length, mrr, gained, lost, moves: [{ id: 't1', from: 6, to: 2 }] } });
    const merged = arms.mergeArms([
      { repo: 'one', arms: mk(1, 2, 0.5, ['t1'], []) },
      { repo: 'two', arms: mk(3, 6, 0.1, ['t1'], ['t2']) },
    ]);
    assert.deepStrictEqual({ tasks: merged.plain.tasks, hits: merged.plain.hits }, { tasks: 8, hits: 4 });
    assert.strictEqual(merged.plain.mrr, (0.5 * 2 + 0.1 * 6) / 8);
    assert.deepStrictEqual(merged.arm.gained, ['one/t1', 'two/t1'], 'the same id in two repos stays two tasks');
    assert.deepStrictEqual(merged.arm.lost, ['two/t2']);
    assert.deepStrictEqual(merged.arm.moves.map((m) => m.id), ['one/t1', 'two/t1']);
  });

  await test('a verdict says what the count supports and no more', () => {
    const arm = (gained, lost, moves = 0) => ({ gained: Array(gained).fill('t'), lost: Array(lost).fill('t'), moves: Array(moves).fill({}) });
    assert.strictEqual(arms.verdictOf(arm(0, 0, 3)), 'moves ranks, no task changes hit');
    assert.strictEqual(arms.verdictOf(arm(4, 1)), '+3 tasks (won 4, lost 1)');
    assert.strictEqual(arms.verdictOf(arm(1, 0)), '+1 task (won 1, lost 0)');
    assert.strictEqual(arms.verdictOf(arm(0, 1)), '-1 task (won 0, lost 1)');
    assert.strictEqual(arms.verdictOf(arm(1, 3)), '-2 tasks (won 1, lost 3)');
    assert.strictEqual(arms.verdictOf(arm(2, 2)), 'net zero (won 2, lost 2)', 'winning as many as it loses moved the answers around, not improved them');
  });

  // ── writing a document whole ───────────────────────────────────────────────

  await test('a document larger than a pipe buffer arrives whole when the process exits straight after writing it', () => {
    // A gate prints one JSON document and exits. Through a pipe the exit cuts an asynchronous write off at the
    // buffer size (65,536 bytes), which is how a --signals document reached its reader as truncated JSON.
    const helper = require('url').pathToFileURL(path.join(ROOT, 'scripts/lib/write-sync.mjs')).href;
    const script = `import(${JSON.stringify(helper)}).then(({ writeAll }) => { writeAll(1, 'x'.repeat(400000) + '\\n'); process.exit(0); })`;
    const r = spawnSync('node', ['-e', script], { encoding: 'utf8', maxBuffer: 1 << 24 });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.strictEqual(r.stdout.length, 400001);
  });

  // ── the xrepo gate's --signals, on a throwaway pinned repository ───────────

  function git(dir, args) {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  }

  function dataRoot(tasks) {
    const data = tmp('sigmap-xrepo-signals-');
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
    const RATIONALE = 'Fixture label: this file is where the behaviour in the query is implemented, by construction of the fixture.';
    fs.mkdirSync(path.join(data, 'benchmarks/tasks'), { recursive: true });
    fs.writeFileSync(path.join(data, 'benchmarks/tasks/retrieval-xrepo.jsonl'),
      tasks.map((t) => JSON.stringify(Object.assign({ split: 'hard', source: 'labelled', repo: 'shop', rationale: RATIONALE }, t))).join('\n') + '\n');
    return data;
  }

  const xrepo = (data, args) => spawnSync('node', [XREPO, ...args], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env: Object.assign({}, process.env, { SIGMAP_XREPO_DATA: data }),
  });

  const SHOP = [
    { id: 'x001', query: 'settle a payment for an open invoice', expected_files: ['src/ledger.js'] },
    { id: 'x002', query: 'refund a payment against an invoice', expected_files: ['src/marshal.js'] },
    { id: 'x003', query: 'charge a customer card for the order', expected_files: ['src/gateway.js'] },
  ];

  await test('--signals --json scores every arm on the repo\'s one index, and the plain arm is the gate\'s own ranking', () => {
    const data = dataRoot(SHOP);
    const r = xrepo(data, ['--signals', '--json']);
    assert.strictEqual(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(Object.keys(out.signals.arms), ['plain', 'centrality', 'surface', 'mined', 'callgraph', 'body', 'nograph']);
    assert.strictEqual(out.signals.arms.plain.hits, out.overall.hits, 'the plain arm must score what the gate scored');
    assert.strictEqual(out.signals.arms.plain.tasks, 3);
    assert.deepStrictEqual(out.signals.fellBack, {}, 'every arm could be built');
    assert.strictEqual(out.signals.added.routeSigs, 0, 'the fixture has no routes');
    for (const k of ['routeSigs', 'minedTokens', 'bodyWords', 'bodyFiles']) assert.strictEqual(typeof out.signals.added[k], 'number', `the cost of ${k} is reported`);
    assert.ok(!fs.existsSync(path.join(data, 'benchmarks/xrepo-baseline.json')), '--signals is a report; it must not record a baseline');
    assert.ok(!fs.existsSync(path.join(data, 'benchmarks/repos/shop/.context/mined-expansions.json')), 'expansions are mined in memory and never cached in a pinned checkout');
  });

  await test('--signals prints the arms, and a signal that changes nothing says so', () => {
    const r = xrepo(dataRoot(SHOP), ['--signals']);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /signal arms {2}\(zero-config, one index and graph per repo; measured here, never recorded\)/);
    assert.match(r.stdout, /plain \(as shipped\)\s+2\/3 66\.7%/);
    assert.match(r.stdout, /\+ centrality blend\s+2\/3 66\.7%\s+\d\.\d{3}\s+identical to plain/);
    assert.match(r.stdout, /cost: surface enrichment adds 0 pseudo-signatures to the index; mined expansions hold \d+ tokens; body words add \d+ words over \d+ files/);
  });

  await test('without --signals the report and the JSON shape are unchanged', () => {
    const data = dataRoot(SHOP);
    const r = xrepo(data, []);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(!/signal arms/.test(r.stdout));
    const j = JSON.parse(xrepo(data, ['--json']).stdout);
    assert.strictEqual(j.signals, undefined);
    assert.ok(!('signals' in j.rows[0]));
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
