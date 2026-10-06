'use strict';

// The retrieval gate's per-split report: miss classes, per-task ranks, JSON, saved account, signal arms. Runs the real script against a throwaway repository.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GATE = path.join(ROOT, 'scripts/run-retrieval-gate.mjs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}

const tmpDirs = [];

// Eight single-purpose files. `herald.js` keeps the words of its purpose in a comment inside
// the function, which the signature index does not see: a question in those words shares nothing
// with its index entry although its source holds them.
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

/** A data root: the eight files and the three corpora the gate scores. `hard` has one answer labelled with a file that shares no word with its question; `mined` has one whose words live only in a function body. */
function dataRoot() {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-retrieval-why-'));
  tmpDirs.push(data);
  for (const [rel, body] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(data, rel)), { recursive: true });
    fs.writeFileSync(path.join(data, rel), body);
  }
  const tasks = path.join(data, 'benchmarks/tasks');
  fs.mkdirSync(tasks, { recursive: true });
  const write = (name, lines) => fs.writeFileSync(path.join(tasks, name), lines.join('\n') + '\n');
  write('retrieval-hard.jsonl', [
    task('h001', 'settle a payment for an open invoice', 'src/ledger.js', { split: 'hard' }),
    task('h002', 'charge a customer card for the order', 'src/gateway.js', { split: 'hard' }),
    task('h003', 'refund a payment against an invoice', 'src/marshal.js', { split: 'hard' }),
  ]);
  write('retrieval-mined.jsonl', [
    task('m001', 'send nightly reminders', 'src/herald.js'),
    task('m002', 'settle a payment for an open invoice', 'src/ledger.js'),
  ]);
  write('retrieval.jsonl', [
    task('t001', 'refund payment', 'src/vault.js'),
    task('t002', 'create invoice order', 'src/scribe.js'),
  ]);
  return data;
}

const gate = (data, args) => spawnSync('node', [GATE, ...args], {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env: Object.assign({}, process.env, { SIGMAP_RETRIEVAL_DATA: data }),
});

(async () => {
  const data = dataRoot();

  await test('without a flag the report has no attribution and no signal arms, and records nothing', () => {
    const r = gate(data, []);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /retrieval quality/);
    assert.match(r.stdout, /hard \(gated\)\s+3\s+66\.7%/);
    assert.ok(!/why the misses miss/.test(r.stdout), 'no attribution without --why');
    assert.ok(!/signal arms/.test(r.stdout), 'no arms without --signals');
    assert.ok(!fs.existsSync(path.join(data, 'benchmarks/retrieval-baseline.json')), 'a report is not a baseline');
  });

  await test('--why places every miss in one class, and the columns add up', () => {
    const r = gate(data, ['--why', '--per-task']);
    assert.strictEqual(r.status, 0, r.stderr);
    // one no-token miss each on hard and mined, none on easy
    assert.match(r.stdout, /no token in common with the question\s+1\s+1\s+0/);
    assert.match(r.stdout, /hits \/ tasks\s+2\/3\s+1\/2\s+2\/2/);
    // a task that shares no word with its answer is out of reach; the rate over the rest is what ranking can move
    assert.match(r.stdout, /hit rate, every task\s+66\.7%\s+50\.0%\s+100\.0%/);
    assert.match(r.stdout, /hit rate, tasks a token can reach\s+100\.0%\s+100\.0%\s+100\.0%/);
    assert.match(r.stdout, /those tasks\s+2\/3\s+1\/2\s+2\/2/);
    // the miss on hard holds no word of the question; the one on mined holds distinctive words only in its source
    assert.match(r.stdout, /a distinctive word only in its source\s+0\s+1\s+0/);
    assert.match(r.stdout, /no word of the question at all\s+1\s+0\s+0/);
    assert.match(r.stdout, /h003\s+no token in common with the question\s+no word of the question anywhere in the file/);
    assert.match(r.stdout, /m001\s+no token in common with the question\s+a distinctive word is only in its source — distinctive in source only: send\(1\), nightly\(1\), reminders\(1\)/);
    // --per-task: one line per task, hits included
    assert.match(r.stdout, /hard\s+h001\s+hit\s+1\b/);
    assert.match(r.stdout, /mined\s+m002\s+hit\s+1\b/);
    assert.match(r.stdout, /easy\s+t002\s+hit\s+1\b/);
    assert.match(r.stdout, /hard\s+h003\s+no token in common with the question\s+-/);
  });

  await test('--why --signals --json writes one document to stdout and the report to stderr', () => {
    const r = gate(data, ['--why', '--signals', '--json']);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.trimStart().startsWith('{'), 'stdout is the document and nothing else');
    assert.match(r.stderr, /retrieval quality/);
    const j = JSON.parse(r.stdout);
    assert.deepStrictEqual(Object.keys(j.splits), ['hard', 'mined', 'easy']);
    const hard = j.splits.hard;
    assert.strictEqual(hard.metrics.tasks, 3);
    assert.strictEqual(hard.why.hits, 2);
    assert.strictEqual(hard.why.misses['no token in common with the question'], 1);
    assert.deepStrictEqual(hard.why.noTokenWords, { distinctive: 0, commonOnly: 0, nowhere: 1, inIndex: 0 });
    assert.deepStrictEqual(j.splits.mined.why.noTokenWords, { distinctive: 1, commonOnly: 0, nowhere: 0, inIndex: 0 });
    assert.strictEqual(hard.perTask.length, 3);
    assert.deepStrictEqual(hard.perTask.find((t) => t.id === 'h003'), { id: 'h003', class: 'no token in common with the question', rank: null, gapClass: 'nowhere' });
    assert.deepStrictEqual(hard.perTask.find((t) => t.id === 'h001'), { id: 'h001', class: 'hit', rank: 1 });
    // the arms: plain is the gate's own ranking, and every arm is there
    const arms = hard.signals.arms;
    assert.strictEqual(arms.plain.hits, 2, 'the plain arm must score what the gate scored');
    assert.deepStrictEqual(Object.keys(arms), ['plain', 'centrality', 'surface', 'mined', 'callgraph', 'body', 'nograph']);
    assert.deepStrictEqual(hard.signals.fellBack, [], 'every arm could be built on this repository');
  });

  await test('--signals prints one row per arm against plain', () => {
    const r = gate(data, ['--signals']);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /signal arms: each opt-in signal against plain/);
    assert.match(r.stdout, /plain \(as shipped\)\s+2\/3\s+1\/2\s+2\/2/);
    for (const label of ['+ centrality blend', '+ surface enrichment', '+ mined expansions', '+ call-graph boost', '+ body words', '- import graph (as `ask`)']) {
      assert.ok(r.stdout.includes(label), `a row for ${label}`);
    }
    assert.ok(!/why the misses miss/.test(r.stdout), '--signals alone prints no attribution');
  });

  await test('--save records the account of each split beside its number, with or without --why', () => {
    const d = dataRoot();
    const before = fs.statSync(path.join(ROOT, 'benchmarks/retrieval-baseline.json')).mtimeMs;
    const r = gate(d, ['--save']);
    assert.strictEqual(r.status, 0, r.stderr);
    const b = JSON.parse(fs.readFileSync(path.join(d, 'benchmarks/retrieval-baseline.json'), 'utf8'));
    assert.strictEqual(b.hard.tasks, 3);
    assert.strictEqual(b.hard.why.hits, 2);
    assert.strictEqual(b.hard.why.reachable, 2);
    assert.strictEqual(b.hard.why.reachableHits, 2);
    assert.deepStrictEqual(b.mined.why.noTokenWords, { distinctive: 1, commonOnly: 0, nowhere: 0, inIndex: 0 });
    assert.strictEqual(b.jvm, undefined, 'no jvm repos, so no jvm entry');
    assert.strictEqual(b.recordedBy, 'run-retrieval-gate.mjs');
    assert.strictEqual(fs.statSync(path.join(ROOT, 'benchmarks/retrieval-baseline.json')).mtimeMs, before, 'this checkout\'s own baseline is never touched');
  });

  await test('a save from a machine without the jvm repos keeps the jvm entry already recorded', () => {
    const d = dataRoot();
    const jvm = { hitAt5: 0.344, mrr: 0.229, precisionAt5: 0.075, tasks: 61, repos: ['spring-petclinic', 'akka'], why: { hits: 21 } };
    fs.writeFileSync(path.join(d, 'benchmarks/retrieval-baseline.json'), JSON.stringify({ jvm }));
    const r = gate(d, ['--save']);
    assert.strictEqual(r.status, 0, r.stderr);
    const b = JSON.parse(fs.readFileSync(path.join(d, 'benchmarks/retrieval-baseline.json'), 'utf8'));
    assert.deepStrictEqual(b.jvm, jvm, 'erasing it would silently drop the gate');
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
