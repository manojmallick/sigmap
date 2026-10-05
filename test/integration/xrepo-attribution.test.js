'use strict';

/**
 * `run-xrepo-gate.mjs --why` (#900, #674): why does each miss miss?
 *
 * The hit rate says how many tasks miss and nothing about the remedy. A file
 * that was never indexed needs detection or an extractor; one the path penalty
 * buried needs a classifier; only one that ranks below the top 5 on its merits
 * needs ranking work, the kind that trades one split against another. The
 * classifier is pure — it is handed the ranker's complete result — so every
 * class is exercised here with fake rankings, and one end-to-end run proves the
 * flag wires the real ranker to it.
 */

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

/**
 * A ranking of n files f01..fn, best first. Scores fall by one per place
 * (100, 99, 98 …) so the list is genuinely in rank order, as the ranker's is;
 * `penalties` maps a file to the path penalty already folded into its score.
 */
function ranking(n, penalties = {}) {
  return Array.from({ length: n }, (_, i) => {
    const file = `f${String(i + 1).padStart(2, '0')}`;
    return { file, score: 100 - i, penalty: penalties[file] === undefined ? 1 : penalties[file] };
  });
}
const names = (n) => new Set(Array.from({ length: n }, (_, i) => `f${String(i + 1).padStart(2, '0')}`));

(async () => {
  const { attribute, summarizeWhy, whyLabel, bucketOf } = await import('../../scripts/lib/xrepo-gate.mjs');

  // ── the classes ───────────────────────────────────────────────────────────

  await test('an answer in the top 5 is a hit; the sixth place is not', () => {
    assert.deepStrictEqual(attribute({ ranked: ranking(30), expected: ['f03'], indexed: names(30) }), { cls: 'hit', rank: 3 });
    assert.strictEqual(attribute({ ranked: ranking(30), expected: ['f05'], indexed: names(30) }).cls, 'hit');
    assert.notStrictEqual(attribute({ ranked: ranking(30), expected: ['f06'], indexed: names(30) }).cls, 'hit');
  });

  await test('an answer that is not in the index is unindexed', () => {
    assert.deepStrictEqual(attribute({ ranked: ranking(30), expected: ['gone.js'], indexed: names(30) }), { cls: 'unindexed', rank: null });
  });

  await test('an indexed answer the ranker never returned shares no token with the question', () => {
    const indexed = names(30); indexed.add('silent.js');
    assert.deepStrictEqual(attribute({ ranked: ranking(30), expected: ['silent.js'], indexed }), { cls: 'no-overlap', rank: null });
  });

  await test('a file the path penalty buried, and that would lead without it, is the penalty\'s loss', () => {
    // f20 sits at rank 20 with a 0.2 penalty folded in: undone it scores 81/0.2 = 405, above everything.
    const a = attribute({ ranked: ranking(30, { f20: 0.2 }), expected: ['f20'], indexed: names(30) });
    assert.deepStrictEqual(a, { cls: 'penalty', rank: 20, penalty: 0.2, withoutPenalty: 1 });
  });

  await test('a penalised file that would STILL miss the top 5 is a ranking miss', () => {
    // 81/0.9 = 90: level with f11, which wins the tie on path, so it is rank 12.
    const a = attribute({ ranked: ranking(30, { f20: 0.9 }), expected: ['f20'], indexed: names(30) });
    assert.strictEqual(a.cls, 'ranking');
    assert.strictEqual(a.bucket, '11-20');
  });

  await test('the counterfactual breaks ties exactly as the ranker does: by path, not by list order', () => {
    // Undone, the penalised file scores 81 / 0.84375 = 96 exactly: level with f05.
    // The ranker orders equal scores by path, so which side of f05 it lands on
    // depends on its NAME. The file is placed at rank 20 of the list either way,
    // so a sort that merely keeps list order (f05 first) would call both the same.
    const tie = (name) => {
      const ranked = ranking(30);
      ranked[19] = { file: name, score: 81, penalty: 0.84375 };
      return attribute({ ranked, expected: [name], indexed: new Set([...names(30), name]) });
    };
    const before = tie('a-target');   // 'a-target' < 'f05': wins the tie, rank 5, inside the top 5
    assert.strictEqual(before.cls, 'penalty');
    assert.strictEqual(before.withoutPenalty, 5);
    const after = tie('z-target');    // 'z-target' > 'f05': loses the tie, rank 6, a miss
    assert.strictEqual(after.cls, 'ranking', 'a tie lost on path order is not a flip into the top 5');
  });

  await test('a ranked miss is placed by its distance from the top 5', () => {
    for (const [rank, bucket] of [[6, '6-10'], [10, '6-10'], [11, '11-20'], [20, '11-20'], [21, '21-50'], [50, '21-50'], [51, 'beyond 50'], [634, 'beyond 50']]) {
      assert.strictEqual(bucketOf(rank), bucket, `rank ${rank}`);
    }
    const a = attribute({ ranked: ranking(60), expected: ['f55'], indexed: names(60) });
    assert.deepStrictEqual({ cls: a.cls, rank: a.rank, bucket: a.bucket }, { cls: 'ranking', rank: 55, bucket: 'beyond 50' });
  });

  await test('with several expected files the best-ranked indexed one decides', () => {
    const indexed = names(30);
    assert.strictEqual(attribute({ ranked: ranking(30), expected: ['gone.js', 'f03'], indexed }).cls, 'hit');
    assert.strictEqual(attribute({ ranked: ranking(30), expected: ['gone.js', 'f12'], indexed }).bucket, '11-20');
    assert.strictEqual(attribute({ ranked: ranking(30), expected: ['gone.js', 'also-gone.js'], indexed }).cls, 'unindexed',
      'unindexed only when NONE of the answers is indexed');
  });

  // ── the summary ───────────────────────────────────────────────────────────

  await test('every miss lands in exactly one row, so the rows sum to the misses', () => {
    const indexed = names(60); indexed.add('silent.js');
    const ranked = ranking(60, { f40: 0.2 });
    const attributions = [
      attribute({ ranked, expected: ['f01'], indexed }),         // hit
      attribute({ ranked, expected: ['gone.js'], indexed }),     // unindexed
      attribute({ ranked, expected: ['silent.js'], indexed }),   // no overlap
      attribute({ ranked, expected: ['f08'], indexed }),         // 6-10
      attribute({ ranked, expected: ['f15'], indexed }),         // 11-20
      attribute({ ranked, expected: ['f30'], indexed }),         // 21-50
      attribute({ ranked, expected: ['f58'], indexed }),         // beyond 50
      attribute({ ranked, expected: ['f40'], indexed }),         // penalty
    ];
    const s = summarizeWhy(attributions);
    assert.deepStrictEqual({ tasks: s.tasks, hits: s.hits, misses: s.misses }, { tasks: 8, hits: 1, misses: 7 });
    assert.strictEqual(s.rows.reduce((n, [, c]) => n + c, 0), s.misses, JSON.stringify(s.rows));
    assert.deepStrictEqual(Object.fromEntries(s.rows), {
      'answer not indexed': 1, 'demoted by a path penalty': 1, 'no token in common with the question': 1,
      'ranked 6-10': 1, 'ranked 11-20': 1, 'ranked 21-50': 1, 'ranked beyond 50': 1,
    });
  });

  await test('the summary lists every class in a fixed order, so two runs print comparable tables', () => {
    const s = summarizeWhy([]);
    assert.deepStrictEqual(s.rows.map(([l]) => l), [
      'answer not indexed', 'demoted by a path penalty', 'no token in common with the question',
      'ranked 6-10', 'ranked 11-20', 'ranked 21-50', 'ranked beyond 50',
    ]);
    assert.ok(s.rows.every(([, n]) => n === 0));
  });

  await test('labels read as the reason', () => {
    assert.strictEqual(whyLabel({ cls: 'unindexed' }), 'answer not indexed');
    assert.strictEqual(whyLabel({ cls: 'ranking', bucket: '11-20' }), 'ranked 11-20');
    assert.strictEqual(whyLabel({ cls: 'hit' }), 'hit');
  });

  // ── end to end: the flag wires the real ranker to the classifier ──────────

  const tmpDirs = [];
  function git(dir, args) {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  }

  /** A data root with one pinned repo of eight single-purpose files. */
  function dataRoot(tasks) {
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-xrepo-why-'));
    tmpDirs.push(data);
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

  const gate = (data, args) => spawnSync('node', [GATE, ...args], {
    cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { SIGMAP_XREPO_DATA: data }),
  });

  await test('--why --json attributes each task of a real pinned repo, and writes nothing', () => {
    const data = dataRoot([
      { id: 'x001', query: 'settle a payment for an open invoice', expected_files: ['src/ledger.js'] },    // hit
      { id: 'x002', query: 'refund a payment against an invoice', expected_files: ['src/marshal.js'] },    // mislabelled: scores zero
      { id: 'x003', query: 'charge a customer card for the order', expected_files: ['src/gateway.js'] },   // hit
    ]);
    const r = gate(data, ['--why', '--json']);
    assert.strictEqual(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual({ tasks: out.why.tasks, hits: out.why.hits, misses: out.why.misses }, { tasks: 3, hits: 2, misses: 1 });
    assert.strictEqual(Object.fromEntries(out.why.rows)['no token in common with the question'], 1, JSON.stringify(out.why.rows));
    const why = out.rows[0].why;
    assert.strictEqual(why.x001.cls, 'hit');
    assert.strictEqual(why.x002.cls, 'no-overlap');
    assert.strictEqual(why.x003.cls, 'hit');
    assert.ok(!fs.existsSync(path.join(data, 'benchmarks/xrepo-baseline.json')), '--why is a report; it must not record a baseline');
  });

  await test('--why prints the table, and the misses add up to the rows', () => {
    const data = dataRoot([
      { id: 'x001', query: 'settle a payment for an open invoice', expected_files: ['src/ledger.js'] },
      { id: 'x002', query: 'refund a payment against an invoice', expected_files: ['src/marshal.js'] },
    ]);
    const r = gate(data, ['--why']);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /why the 1 misses miss {2}\(1 of 2 hit\)/);
    assert.match(r.stdout, /no token in common with the question\s+1/);
    assert.match(r.stdout, /x002 {2}shop\s+no token in common with the question\s+the answer scores zero for this question/);
  });

  await test('without --why the report is unchanged: no attribution is computed or printed', () => {
    const data = dataRoot([{ id: 'x001', query: 'settle a payment for an open invoice', expected_files: ['src/ledger.js'] }]);
    const r = gate(data, []);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(!/why the \d+ misses miss/.test(r.stdout));
    const j = JSON.parse(gate(data, ['--json']).stdout);
    assert.strictEqual(j.why, undefined, 'no summary without --why');
    assert.ok(!('why' in j.rows[0]), 'no per-row attribution without --why');
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
