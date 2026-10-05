'use strict';

// The body-words sweep script: the grid of settings, the shipped one marked, and a task that only body words can win, scored on throwaway repositories.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SWEEP = path.join(ROOT, 'scripts/run-body-words-sweep.mjs');

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

// `herald.js` says its purpose only inside its function, so a question in those words shares nothing with its index entry.
const FILES = {
  'src/ledger.js': 'function settlePayment(invoice) {}\nmodule.exports = { settlePayment };\n',
  'src/vault.js': 'function refundPayment(invoice) {}\nmodule.exports = { refundPayment };\n',
  'src/scribe.js': 'function createInvoice(order) {}\nmodule.exports = { createInvoice };\n',
  'src/gateway.js': 'function chargeCard(card) {}\nmodule.exports = { chargeCard };\n',
  'src/broker.js': 'function payoutSeller(seller) {}\nmodule.exports = { payoutSeller };\n',
  'src/courier.js': 'function computeTax(order) {}\nmodule.exports = { computeTax };\n',
  'src/marshal.js': 'function recordAudit(event) {}\nmodule.exports = { recordAudit };\n',
  'src/herald.js': 'function notifyCustomer(customer) {\n  // sends nightly reminders\n  return customer;\n}\nmodule.exports = { notifyCustomer };\n',
};
const task = (id, query, file, extra) => JSON.stringify(Object.assign({ id, query, expected_files: [file], repo: '.' }, extra));
function git(dir, args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A data root for the retrieval gate's corpora: hard has one answer plain finds, mined has one only body words can. */
function retrievalRoot() {
  const data = tmp('sigmap-sweep-own-');
  for (const [rel, body] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(data, rel)), { recursive: true });
    fs.writeFileSync(path.join(data, rel), body);
  }
  fs.mkdirSync(path.join(data, 'benchmarks/tasks'), { recursive: true });
  const write = (name, lines) => fs.writeFileSync(path.join(data, 'benchmarks/tasks', name), lines.join('\n') + '\n');
  write('retrieval-hard.jsonl', [task('h001', 'settle a payment for an open invoice', 'src/ledger.js', { split: 'hard' })]);
  write('retrieval-mined.jsonl', [task('m001', 'send nightly reminders', 'src/herald.js'), task('m002', 'settle a payment for an open invoice', 'src/ledger.js')]);
  write('retrieval.jsonl', [task('t001', 'refund payment', 'src/vault.js')]);
  return data;
}

/** A data root for the xrepo corpus: one pinned repo, one task plain finds and one only body words can. */
function xrepoRoot() {
  const data = tmp('sigmap-sweep-xrepo-');
  const repo = path.join(data, 'benchmarks/repos/shop');
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  git(repo, ['init', '-q']);
  for (const [rel, body] of Object.entries(FILES)) fs.writeFileSync(path.join(repo, rel), body);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'fixture']);
  const commit = git(repo, ['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(data, 'benchmarks/xrepo-repos.json'),
    JSON.stringify({ repos: [{ name: 'shop', url: 'https://example.invalid/shop.git', commit, language: 'javascript', layout: 'src' }] }, null, 2) + '\n');
  fs.mkdirSync(path.join(data, 'benchmarks/tasks'), { recursive: true });
  const RATIONALE = 'Fixture label: this file is where the behaviour in the query is implemented, by construction of the fixture.';
  fs.writeFileSync(path.join(data, 'benchmarks/tasks/retrieval-xrepo.jsonl'), [
    task('x001', 'settle a payment for an open invoice', 'src/ledger.js', { repo: 'shop', rationale: RATIONALE }),
    task('x002', 'send nightly reminders', 'src/herald.js', { repo: 'shop', rationale: RATIONALE }),
  ].join('\n') + '\n');
  return data;
}

const sweep = (args) => spawnSync('node', [SWEEP, ...args], {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26,
  env: Object.assign({}, process.env, { SIGMAP_RETRIEVAL_DATA: retrievalRoot(), SIGMAP_XREPO_DATA: xrepoRoot() }),
});

(async () => {
  await test('a task only body words can win is won at a setting that keeps its words, and a task plain wins is never lost', () => {
    const r = sweep(['--only', 'xrepo,hard,mined,easy', '--shares', '0.05', '--per-file', '5,200']);
    assert.strictEqual(r.status, 0, r.stderr);
    // plain scores 1 of 2 on the third-party corpus and on mined, 1 of 1 on hard and easy
    assert.match(r.stdout, /xrepo 1\/2\s+hard 1\/1\s+mined 1\/2\s+easy 1\/1/);
    // keeping the words wins the one question that shares nothing with a signature, on both corpora, and loses nothing
    assert.match(r.stdout, /s5-p200 \*\s+\+1 \(1\/0\)\s+\+0 \(0\/0\)\s+\+1 \(1\/0\)\s+\+0 \(0\/0\)\s+\+2 \(2\/0\)/);
    assert.match(r.stdout, /s5-p5 {5}\s+\+\d \(\d\/0\)/, 'a smaller setting is reported on its own row');
  });

  await test('the default grid is three shares by five word counts, and exactly one row is the shipped setting', () => {
    const r = sweep(['--only', 'xrepo']);
    assert.strictEqual(r.status, 0, r.stderr);
    const rows = r.stdout.split('\n').filter((l) => /^ {4}s\d+-p\d+/.test(l));
    assert.strictEqual(rows.length, 15);
    assert.deepStrictEqual(rows.filter((l) => l.includes('*')).map((l) => l.trim().split(/\s+/)[0]), ['s5-p200']);
    assert.match(r.stdout, /the shipped setting: 5% of the files, 200 words a file/);
  });

  await test('without --save nothing is recorded, and with no corpus to score it says so and fails', () => {
    const before = fs.existsSync(path.join(ROOT, 'benchmarks/reports/body-words-sweep.json')) ? fs.statSync(path.join(ROOT, 'benchmarks/reports/body-words-sweep.json')).mtimeMs : null;
    const r = sweep(['--only', 'xrepo', '--shares', '0.05', '--per-file', '200']);
    assert.strictEqual(r.status, 0, r.stderr);
    const after = fs.existsSync(path.join(ROOT, 'benchmarks/reports/body-words-sweep.json')) ? fs.statSync(path.join(ROOT, 'benchmarks/reports/body-words-sweep.json')).mtimeMs : null;
    assert.strictEqual(after, before, 'a report is not a recording');
    const none = spawnSync('node', [SWEEP, '--only', 'nothing'], { cwd: ROOT, encoding: 'utf8' });
    assert.strictEqual(none.status, 1);
    assert.match(none.stderr, /No corpus was scored/);
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
