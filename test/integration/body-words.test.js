'use strict';

// Body words: which words a file keeps, how BM25 uses them, the cache, and the three paths that read retrieval.bodyWords.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const bw = require(path.join(ROOT, 'src/retrieval/body-words'));
const { bm25rank } = require(path.join(ROOT, 'src/retrieval/bm25'));
const { rank } = require(path.join(ROOT, 'src/retrieval/ranker'));
const { queryContext } = require(path.join(ROOT, 'src/mcp/handlers'));

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

/** A file reader over a plain object of file -> text. */
const reader = (files) => (file) => (Object.prototype.hasOwnProperty.call(files, file) ? files[file] : null);
const index = (entries) => new Map(Object.entries(entries));

(async () => {
  // ── which words a file keeps ───────────────────────────────────────────────

  await test('a word qualifies when the source holds it and the index entry does not', () => {
    const out = bw.buildBodyWords(
      index({ 'src/a.js': ['function retryDelivery(job)'] }),
      reader({ 'src/a.js': 'function retryDelivery(job) {\n  // backoff after timeout\n}\n' }),
    );
    // `retry`, `delivery` and `job` are in the signature, `function` too; the comment's words are not
    assert.strictEqual(out.get('src/a.js'), 'after backoff timeout');
  });

  await test('a word the path or the signatures already carry is never a body word', () => {
    const out = bw.buildBodyWords(
      index({ 'src/handlers.js': ['function dispatch(event)'] }),
      reader({ 'src/handlers.js': '// handlers dispatch an event, then settle\nfunction dispatch(event) {}\n' }),
    );
    // `handlers` is in the path, `dispatch` and `event` in the signature, and `then` only frames a sentence
    assert.strictEqual(out.get('src/handlers.js'), 'settle');
  });

  await test('a word most files hold is not rare, and a word held by one file always qualifies', () => {
    const files = {};
    const entries = {};
    for (let i = 0; i < 40; i++) {
      entries[`src/f${i}.js`] = [`function fn${i}()`];
      files[`src/f${i}.js`] = `// shared words everywhere, and zebra${String(i).padStart(2, '0')}\nfunction fn${i}() {}\n`;
    }
    const out = bw.buildBodyWords(index(entries), reader(files));
    // 5% of 40 files is 2: `shared` and `everywhere` are in all 40, each zebra in one
    assert.ok(!/shared|everywhere/.test(out.get('src/f7.js')), out.get('src/f7.js'));
    assert.match(out.get('src/f7.js'), /\bzebra07\b/);
    assert.ok(!/zebra08/.test(out.get('src/f7.js')), 'another file\'s word is not this file\'s');
  });

  await test('the cut-off is never below one file, so a small repository keeps words held once and drops words held twice', () => {
    const out = bw.buildBodyWords(
      index({ 'a.js': ['function a()'], 'b.js': ['function b()'], 'c.js': ['function c()'], 'd.js': ['function d()'] }),
      reader({ 'a.js': 'twice onlya\n', 'b.js': 'twice onlyb\n', 'c.js': 'onlyc\n', 'd.js': 'onlyd\n' }),
    );
    assert.strictEqual(out.get('a.js'), 'onlya');
    assert.strictEqual(out.get('c.js'), 'onlyc');
  });

  await test('the share can be widened, and widening it keeps a word that two of four files hold', () => {
    const entries = index({ 'a.js': ['function a()'], 'b.js': ['function b()'], 'c.js': ['function c()'], 'd.js': ['function d()'] });
    const files = reader({ 'a.js': 'twice onlya\n', 'b.js': 'twice onlyb\n', 'c.js': 'onlyc\n', 'd.js': 'onlyd\n' });
    assert.strictEqual(bw.buildBodyWords(entries, files, { share: 0.5 }).get('a.js'), 'onlya twice');
  });

  await test('words that frame a question, short words and numbers are never body words', () => {
    const out = bw.buildBodyWords(
      index({ 'a.js': ['function a()'] }),
      reader({ 'a.js': 'how does the thing 1234 ab retrying\n' }),
    );
    assert.strictEqual(out.get('a.js'), 'retrying thing');
    assert.ok(bw.FRAMING_WORDS.has('how') && bw.FRAMING_WORDS.has('whether') && !bw.FRAMING_WORDS.has('retrying'));
  });

  await test('a file keeps its best words: most lines first, then alphabetical, up to the cap', () => {
    const entries = index({ 'a.js': ['function a()'] });
    const files = reader({ 'a.js': 'zulu alpha\nzulu\nzulu beta\nalpha\n' });
    assert.strictEqual(bw.buildBodyWords(entries, files).get('a.js'), 'zulu alpha beta');
    assert.strictEqual(bw.buildBodyWords(entries, files, { perFile: 2 }).get('a.js'), 'zulu alpha');
    assert.strictEqual(bw.buildBodyWords(entries, files, { perFile: 1 }).get('a.js'), 'zulu');
  });

  await test('the result does not depend on the order files arrive in', () => {
    const entries = { 'a.js': ['function a()'], 'b.js': ['function b()'], 'c.js': ['function c()'] };
    const text = { 'a.js': 'common alpha one\n', 'b.js': 'common beta two\n', 'c.js': 'common gamma three\n' };
    const forward = bw.buildBodyWords(index(entries), reader(text), { share: 0.7 });
    const backward = bw.buildBodyWords(new Map(Object.entries(entries).reverse()), reader(text), { share: 0.7 });
    assert.deepStrictEqual([...forward.entries()].sort(), [...backward.entries()].sort());
  });

  await test('a file whose source cannot be read is skipped without disturbing the others, and without counting as a document', () => {
    const entries = index({ 'a.js': ['function a()'], 'gone.js': ['function gone()'], 'boom.js': ['function boom()'], 'b.js': ['function b()'] });
    const read = (f) => { if (f === 'boom.js') throw new Error('EIO'); return f === 'a.js' ? 'alpha\n' : f === 'b.js' ? 'beta\n' : null; };
    const out = bw.buildBodyWords(entries, read);
    assert.deepStrictEqual([...out.keys()], ['a.js', 'b.js']);
  });

  await test('nothing in means nothing out, and a file with no qualifying word is absent', () => {
    assert.strictEqual(bw.buildBodyWords(new Map(), () => 'x').size, 0);
    assert.strictEqual(bw.buildBodyWords(null, () => 'x').size, 0);
    assert.strictEqual(bw.buildBodyWords(index({ 'a.js': ['function alpha()'] }), reader({ 'a.js': 'function alpha() {}\n' })).size, 0);
  });

  await test('the shipped parameters are the ones the sweep chose', () => {
    assert.strictEqual(bw.DISTINCTIVE_SHARE, 0.05);
    assert.strictEqual(bw.PER_FILE, 200);
    assert.strictEqual(bw.MIN_WORD_LENGTH, 3);
  });

  // ── a credential is a rare word too (#943) ─────────────────────────────────

  await test('a line the secret scanner flags contributes no word, and a clean line beside it keeps its words', () => {
    const out = bw.buildBodyWords(
      index({ 'src/cfg.js': ['function load()'] }),
      reader({ 'src/cfg.js': 'const key = "AKIAIOSFODNN7EXAMPLE"; // frobnicate\nconst note = pelican;\nconst password = "hunter2hunter2";\n' }),
    );
    const words = (out.get('src/cfg.js') || '').split(' ');
    assert.ok(words.includes('pelican'), 'a clean line keeps its words');
    for (const w of ['akiaiosfodnn7example', 'frobnicate', 'hunter2hunter2']) assert.ok(!words.includes(w), `${w} came from a line the scanner flags`);
  });

  await test('a word that is long and holds a digit is never kept, and an equally long word without one is', () => {
    assert.strictEqual(bw.OPAQUE_WORD_LENGTH, 20);
    const opaque = 'a1b2c3d4e5f6a7b8c9d0e1f2';
    const long = 'internationalizations';
    assert.ok(opaque.length >= bw.OPAQUE_WORD_LENGTH && long.length >= bw.OPAQUE_WORD_LENGTH);
    const out = bw.buildBodyWords(index({ 'src/a.js': ['function a()'] }), reader({ 'src/a.js': `const t = '${opaque}';\nconst u = '${long}';\n` }));
    const words = (out.get('src/a.js') || '').split(' ');
    assert.ok(!words.includes(opaque), 'a key-shaped word is dropped');
    assert.ok(words.includes(long), 'a long word of letters is an ordinary word');
  });

  await test('a flagged line is dropped on the line, not the word: the word survives on a clean line', () => {
    const out = bw.buildBodyWords(
      index({ 'src/a.js': ['function a()'] }),
      reader({ 'src/a.js': 'const k = "AKIAIOSFODNN7EXAMPLE"; // kestrel\nconst other = kestrel;\n' }),
    );
    assert.ok((out.get('src/a.js') || '').split(' ').includes('kestrel'));
  });

  // ── how BM25 uses them ─────────────────────────────────────────────────────

  const CANDIDATES = [
    { file: 'src/ledger.js', sigs: ['function settlePayment(invoice)'] },
    { file: 'src/herald.js', sigs: ['function notifyCustomer(customer)'] },
  ];

  await test('a question in a file\'s body words finds it, and without the option nothing matches', () => {
    const without = bm25rank('send nightly reminders', CANDIDATES);
    assert.ok(without.every((r) => r.score === 0), 'no signature says any of these words');
    const withWords = bm25rank('send nightly reminders', CANDIDATES, { bodyWords: new Map([['src/herald.js', 'nightly reminders sends']]) });
    assert.strictEqual(withWords[0].file, 'src/herald.js');
    assert.ok(withWords[0].score > 0 && withWords[1].score === 0);
  });

  await test('without body words the ranking is exactly what it was, whatever shape the option takes', () => {
    const base = JSON.stringify(bm25rank('settle a payment', CANDIDATES));
    for (const opts of [undefined, {}, { bodyWords: null }, { bodyWords: new Map() }, { bodyWords: { 'src/herald.js': 'settle' } }, { bodyWords: new Map([['src/other.js', 'settle']]) }]) {
      assert.strictEqual(JSON.stringify(bm25rank('settle a payment', CANDIDATES, opts)), base);
    }
  });

  await test('rank() hands the option to BM25', () => {
    const idx = new Map(CANDIDATES.map((c) => [c.file, c.sigs]));
    assert.deepStrictEqual(rank('send nightly reminders', idx, { topK: 5 }), []);
    const hit = rank('send nightly reminders', idx, { topK: 5, bodyWords: new Map([['src/herald.js', 'nightly reminders sends']]) });
    assert.deepStrictEqual(hit.map((r) => r.file), ['src/herald.js']);
  });

  // ── the cache ──────────────────────────────────────────────────────────────

  /** A repository with a generated index: one file whose purpose is said only inside its function. */
  function repo(config) {
    const dir = tmp('sigmap-body-words-');
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/herald.js'), 'function notifyCustomer(customer) {\n  // sends nightly reminders\n  return customer;\n}\nmodule.exports = { notifyCustomer };\n');
    fs.writeFileSync(path.join(dir, 'src/ledger.js'), 'function settlePayment(invoice) {}\nmodule.exports = { settlePayment };\n');
    fs.writeFileSync(path.join(dir, 'src/vault.js'), 'function refundPayment(invoice) {}\nmodule.exports = { refundPayment };\n');
    if (config) fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(config));
    generate(dir);
    return dir;
  }
  function generate(dir) {
    const r = spawnSync('node', [GEN], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
  }
  const cacheOf = (dir) => path.join(dir, '.context', 'body-words.json');
  const indexFile = (dir) => path.join(dir, '.context', 'sig-index.json');

  await test('the words are built from the index, cached beside it, and read back from the cache', () => {
    const dir = repo();
    assert.ok(!fs.existsSync(cacheOf(dir)), 'generating writes no cache: the signal is opt-in');
    const built = bw.loadOrBuild(dir);
    assert.match(built.get('src/herald.js'), /\bnightly\b/);
    const cache = JSON.parse(fs.readFileSync(cacheOf(dir), 'utf8'));
    assert.deepStrictEqual({ schema: cache.schema, share: cache.share, perFile: cache.perFile, files: cache.files }, { schema: bw.SCHEMA_VERSION, share: 0.05, perFile: 200, files: built.size });
    assert.strictEqual(cache.builtFor, fs.statSync(indexFile(dir)).mtimeMs, 'keyed by the complete index');
    // prove the second call reads the cache: change what it holds
    cache.words = { 'src/herald.js': 'sentinel' };
    fs.writeFileSync(cacheOf(dir), JSON.stringify(cache));
    assert.strictEqual(bw.loadOrBuild(dir).get('src/herald.js'), 'sentinel');
  });

  await test('the cache on disk holds no word of a line the scanner flags', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'src/secrets.js'), 'const key = "AKIAIOSFODNN7EXAMPLE"; // wombat\nfunction mountVolume() {}\nmodule.exports = { mountVolume };\n');
    generate(dir);
    bw.loadOrBuild(dir);
    const raw = fs.readFileSync(cacheOf(dir), 'utf8');
    assert.ok(!/akiaiosfodnn7example/.test(raw) && !/wombat/.test(raw), 'a key and the words beside it stay out of the cache');
    assert.ok(/nightly/.test(raw), 'while an ordinary file keeps its words');
  });

  await test('regenerating the index rebuilds the cache, but an ask rewriting query-context.md does not', () => {
    const dir = repo();
    bw.loadOrBuild(dir);
    const plant = () => {
      const c = JSON.parse(fs.readFileSync(cacheOf(dir), 'utf8'));
      c.words = { 'src/herald.js': 'sentinel' };
      fs.writeFileSync(cacheOf(dir), JSON.stringify(c));
    };
    plant();
    // `ask` rewrites query-context.md on every call; that must not cost a rebuild of every source file
    fs.writeFileSync(path.join(dir, '.context', 'query-context.md'), 'x');
    const later = new Date(Date.now() + 60000);
    fs.utimesSync(path.join(dir, '.context', 'query-context.md'), later, later);
    assert.strictEqual(bw.loadOrBuild(dir).get('src/herald.js'), 'sentinel', 'an unrelated .context file is not a reason to rebuild');
    // regenerating rewrites the index, whose mtime is the key
    fs.utimesSync(indexFile(dir), later, later);
    assert.match(bw.loadOrBuild(dir).get('src/herald.js'), /\bnightly\b/, 'a new index rebuilds the words');
  });

  await test('a cache built with other parameters, or another schema, is rebuilt', () => {
    const dir = repo();
    bw.loadOrBuild(dir);
    for (const [key, value] of [['perFile', 5], ['share', 0.5], ['schema', 99]]) {
      const c = JSON.parse(fs.readFileSync(cacheOf(dir), 'utf8'));
      c.words = { 'src/herald.js': 'sentinel' };
      c[key] = value;
      fs.writeFileSync(cacheOf(dir), JSON.stringify(c));
      assert.match(bw.loadOrBuild(dir).get('src/herald.js'), /\bnightly\b/, `${key} changed`);
    }
  });

  await test('with no complete index there is nothing to key a cache by, so none is written, and it never throws', () => {
    const dir = repo();
    fs.rmSync(indexFile(dir));
    const built = bw.loadOrBuild(dir);
    assert.ok(built instanceof Map);
    assert.ok(!fs.existsSync(cacheOf(dir)));
    assert.strictEqual(bw.loadOrBuild(path.join(os.tmpdir(), 'sigmap-no-such-repo-' + Date.now())).size, 0);
    assert.strictEqual(bw.loadOrBuild(dir, new Map()).size, 0, 'an empty index has no words');
  });

  // ── the three paths that read the flag ─────────────────────────────────────

  const ASK = ['ask', 'send nightly reminders', '--json'];
  const run = (dir, args) => {
    const r = spawnSync('node', [GEN, ...args], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    return r.stdout;
  };
  const setFlag = (dir, on) => fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ retrieval: { bodyWords: on } }));

  await test('ask finds a file by the words of its body only when the flag is on', () => {
    const dir = repo();
    assert.deepStrictEqual(JSON.parse(run(dir, ASK)).rankedFiles, [], 'off: no signature says any of these words');
    setFlag(dir, true);
    const on = JSON.parse(run(dir, ASK)).rankedFiles;
    assert.strictEqual(on[0].file, 'src/herald.js');
    setFlag(dir, false);
    assert.deepStrictEqual(JSON.parse(run(dir, ASK)).rankedFiles, [], 'off again: the option leaves nothing behind');
  });

  await test('--query reads the flag too', () => {
    const dir = repo();
    const QUERY = ['--query', 'send nightly reminders', '--json'];
    assert.strictEqual(JSON.parse(run(dir, QUERY)).totalResults, 0);
    setFlag(dir, true);
    assert.strictEqual(JSON.parse(run(dir, QUERY)).results[0].file, 'src/herald.js');
  });

  await test('the MCP query_context tool reads it', () => {
    const dir = repo();
    assert.ok(!/src\/herald\.js/.test(queryContext({ query: 'send nightly reminders' }, dir)));
    setFlag(dir, true);
    assert.match(queryContext({ query: 'send nightly reminders' }, dir), /\| 1 \| src\/herald\.js \|/);
  });

  await test('turning the flag on changes no generated artifact and puts no body word in a prompt', () => {
    const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f, 'utf8').replace(/<!-- Updated: .*? -->/, '')).digest('hex');
    const files = (dir) => JSON.parse(fs.readFileSync(indexFile(dir), 'utf8')).files;
    const off = repo({ retrieval: { bodyWords: false } });
    const on = repo({ retrieval: { bodyWords: true } });
    assert.strictEqual(hash(path.join(on, '.github/copilot-instructions.md')), hash(path.join(off, '.github/copilot-instructions.md')), 'the context file is byte-identical');
    assert.deepStrictEqual(files(on), files(off), 'so is the signature index');
    run(on, ASK);
    const prompt = fs.readFileSync(path.join(on, '.context', 'query-context.md'), 'utf8');
    assert.ok(!/nightly|reminders/.test(prompt), 'what ask hands an LLM carries signatures only');
    assert.ok(!/nightly|reminders/.test(fs.readFileSync(path.join(on, '.github/copilot-instructions.md'), 'utf8')));
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
