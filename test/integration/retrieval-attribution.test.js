'use strict';

// Miss classes, word evidence and the grep scan: attribution, vocabulary, autopsy and grep-baseline libraries.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const LIB = path.join(ROOT, 'scripts/lib');

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

/** A ranking of n files f01..fn, best first, scores falling by one per place. */
function ranking(n) {
  return Array.from({ length: n }, (_, i) => ({ file: `f${String(i + 1).padStart(2, '0')}`, score: 100 - i, penalty: 1 }));
}
const names = (n) => new Set(Array.from({ length: n }, (_, i) => `f${String(i + 1).padStart(2, '0')}`));

(async () => {
  const attr = await import(path.join(LIB, 'attribution.mjs'));
  const vocab = await import(path.join(LIB, 'corpus-vocabulary.mjs'));
  const autopsy = await import(path.join(LIB, 'autopsy.mjs'));
  const grep = await import(path.join(LIB, 'grep-baseline.mjs'));
  const hygiene = await import(path.join(LIB, 'xrepo-hygiene.mjs'));

  // ── the shared classifier is the one the xrepo gate reports through ────────

  await test('the xrepo gate re-exports the classifier rather than keeping a second copy', async () => {
    const xg = await import(path.join(LIB, 'xrepo-gate.mjs'));
    for (const name of ['rankOf', 'bucketOf', 'attribute', 'whyLabel', 'summarizeWhy']) {
      assert.strictEqual(xg[name], attr[name], `${name} must be the same function`);
    }
  });

  // ── reachable ──────────────────────────────────────────────────────────────

  await test('a task is reachable when its answer is indexed and shares a word with the question', () => {
    const indexed = names(30);
    indexed.add('silent.js');
    const r = ranking(30);
    const all = [
      attr.attribute({ ranked: r, expected: ['f01'], indexed }),       // hit
      attr.attribute({ ranked: r, expected: ['gone.js'], indexed }),   // unindexed
      attr.attribute({ ranked: r, expected: ['silent.js'], indexed }), // no overlap
      attr.attribute({ ranked: r, expected: ['f12'], indexed }),       // ranked
    ];
    assert.deepStrictEqual(attr.reachable(all), { tasks: 4, reachable: 2, hits: 1 });
    assert.deepStrictEqual(attr.reachable([]), { tasks: 0, reachable: 0, hits: 0 });
  });

  // ── vocabulary of a miss ───────────────────────────────────────────────────

  const set = (...w) => new Set(w);

  await test('each word of the question is in the index entry, only in the source, or nowhere', () => {
    const gap = attr.vocabularyGap({
      queryTerms: ['retry', 'delivery', 'socket', 'banana'],
      indexTerms: set('retry', 'sink'),
      sourceTerms: set('retry', 'delivery', 'socket', 'sink'),
    });
    assert.deepStrictEqual(gap.indexed, ['retry']);
    assert.deepStrictEqual(gap.source, ['delivery', 'socket']);
    assert.deepStrictEqual(gap.absent, ['banana']);
  });

  await test('a word the index holds is never counted as source-only, and a repeated word is counted once', () => {
    const gap = attr.vocabularyGap({ queryTerms: ['retry', 'retry', 'retry'], indexTerms: set('retry'), sourceTerms: set('retry') });
    assert.deepStrictEqual(gap, { indexed: ['retry'], source: [], distinctive: [], common: [], absent: [], df: {} });
  });

  await test('a source word is distinctive only when few of the files hold it', () => {
    const docFreq = new Map([['rare', 5], ['frequent', 6]]);
    const gap = attr.vocabularyGap({
      queryTerms: ['rare', 'frequent'], indexTerms: set(), sourceTerms: set('rare', 'frequent'), docFreq, docCount: 100,
    });
    // 5% of 100 files is 5: a word in five files tells the answer apart, one in six does not.
    assert.deepStrictEqual(gap.distinctive, ['rare']);
    assert.deepStrictEqual(gap.common, ['frequent']);
    assert.deepStrictEqual(gap.df, { rare: 5, frequent: 6 });
  });

  await test('the cut-off never drops below one file, so a word in a single file is always distinctive', () => {
    const gap = attr.vocabularyGap({
      queryTerms: ['unique'], indexTerms: set(), sourceTerms: set('unique'), docFreq: new Map([['unique', 1]]), docCount: 8,
    });
    assert.deepStrictEqual(gap.distinctive, ['unique']);
  });

  await test('without frequencies every source word counts as distinctive, since nothing says otherwise', () => {
    const gap = attr.vocabularyGap({ queryTerms: ['a1', 'b2'], indexTerms: set(), sourceTerms: set('a1', 'b2') });
    assert.deepStrictEqual(gap.distinctive, ['a1', 'b2']);
    assert.deepStrictEqual(gap.common, []);
  });

  await test('terms may carry the word to print, and the printed word is what lands in the lists', () => {
    const gap = attr.vocabularyGap({
      queryTerms: [{ term: 'hibernat', word: 'hibernate' }, { term: 'siz', word: 'size' }],
      indexTerms: set(), sourceTerms: set('hibernat'),
    });
    assert.deepStrictEqual(gap.distinctive, ['hibernate']);
    assert.deepStrictEqual(gap.absent, ['size']);
  });

  await test('a gap falls in one class, ordered by how much the index already knows', () => {
    const mk = (over) => Object.assign({ indexed: [], source: [], distinctive: [], common: [], absent: [], df: {} }, over);
    assert.strictEqual(attr.gapClass(mk({ indexed: ['a'], distinctive: ['b'] })), 'in-index');
    assert.strictEqual(attr.gapClass(mk({ source: ['a', 'b'], distinctive: ['a'], common: ['b'] })), 'distinctive');
    assert.strictEqual(attr.gapClass(mk({ source: ['a'], common: ['a'] })), 'common-only');
    assert.strictEqual(attr.gapClass(mk({ absent: ['a'] })), 'nowhere');
    assert.strictEqual(attr.gapClass(mk({})), 'nowhere');
    for (const c of ['in-index', 'distinctive', 'common-only', 'nowhere']) assert.ok(attr.GAP_LABELS[c], `a label for ${c}`);
  });

  await test('the evidence line names each word with its frequency, and truncates a long list', () => {
    const gap = attr.vocabularyGap({
      queryTerms: ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'ghost'],
      indexTerms: set(), sourceTerms: set('alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'),
      docFreq: new Map([['alpha', 1], ['bravo', 1], ['charlie', 1], ['delta', 1], ['echo', 1], ['foxtrot', 1]]), docCount: 10,
    });
    const line = attr.formatGap(gap, 3);
    assert.match(line, /distinctive in source only: alpha\(1\), bravo\(1\), charlie\(1\), …/);
    assert.match(line, /absent: ghost/);
    assert.strictEqual(attr.formatGap(attr.vocabularyGap({ queryTerms: [], indexTerms: set(), sourceTerms: set() })), 'the question has no significant word');
  });

  // ── attributeTasks wires a ranker and a file reader to the classifier ──────

  await test('attributeTasks classifies every task and adds word evidence to a miss with an indexed answer', () => {
    const indexed = names(30);
    indexed.add('silent.js');
    const terms = { 'silent.js': { index: set('other'), source: set('quiet', 'silent') } };
    const out = attr.attributeTasks({
      tasks: [
        { id: 't1', query: 'q1', expected: ['f01'] },        // hit
        { id: 't2', query: 'q2', expected: ['gone.js'] },     // unindexed
        { id: 't3', query: 'quiet silent', expected: ['silent.js'] }, // no overlap, word in the source
        { id: 't4', query: 'q4', expected: ['f12'] },         // ranked
      ],
      indexed,
      rankFull: () => ranking(30),
      queryTerms: (q) => q.split(' '),
      termsOf: (f) => terms[f] || { index: set('x'), source: set('x') },
    });
    assert.deepStrictEqual(out.map((a) => a.cls), ['hit', 'unindexed', 'no-overlap', 'ranking']);
    assert.strictEqual(out[0].gap, undefined, 'a hit needs no evidence');
    assert.strictEqual(out[1].gap, undefined, 'an unindexed answer has no index entry to compare with');
    assert.strictEqual(out[2].file, 'silent.js', 'with nothing ranked, the first indexed answer');
    assert.strictEqual(out[2].gapClass, 'distinctive');
    assert.strictEqual(out[3].file, 'f12', 'the answer the ranker came closest to');
    assert.strictEqual(out[3].gapClass, 'nowhere');
    assert.deepStrictEqual(out.map((a) => a.id), ['t1', 't2', 't3', 't4']);
  });

  await test('an answer whose source cannot be read is classified without evidence, not dropped', () => {
    const indexed = names(30);
    indexed.add('silent.js');
    const [a] = attr.attributeTasks({
      tasks: [{ id: 't1', query: 'q', expected: ['silent.js'] }], indexed, rankFull: () => ranking(30), queryTerms: () => [], termsOf: () => null,
    });
    assert.strictEqual(a.cls, 'no-overlap');
    assert.strictEqual(a.gap, undefined);
  });

  // ── what counts as a test answer ───────────────────────────────────────────

  await test('a test answer is a test directory or a language\'s own test-file naming, and nothing wider', () => {
    for (const p of ['src/test/java/org/x/PetClinicIntegrationTests.java', 'lib/__tests__/a.js', 'tests/test_a.py', 'app/OwnerTests.cs', 'spec/foo_spec.rb', 'pkg/x_test.go']) {
      assert.strictEqual(hygiene.isTestAnswer(p), true, p);
    }
    // `samples` is a Java package here, `test_harness.lua` is a runner, `docs` is documentation: none is a test.
    for (const p of ['src/main/java/org/springframework/samples/petclinic/owner/Owner.java', 'lua/plenary/test_harness.lua', 'docs/guide.md', 'scripts/build.js', 'src/contest/Main.java']) {
      assert.strictEqual(hygiene.isTestAnswer(p), false, p);
    }
  });

  // ── the words of a question, and of a file, read from a checkout ───────────

  await test('words that only frame a question are left out, and the ranker\'s tokens are kept', () => {
    const terms = vocab.queryTermsOf('How does the Hibernate fetch size get applied?');
    const words = terms.map((t) => t.word);
    assert.ok(!words.includes('how') && !words.includes('does'), `question words must go: ${words}`);
    assert.ok(words.includes('hibernate') && words.includes('fetch'), words.join(','));
    assert.ok(terms.every((t) => t.term && t.word));
  });

  await test('a word that splits into tokens is printed as its tokens, so each entry has one frequency', () => {
    const words = vocab.queryTermsOf('proxyBeanMethods').map((t) => t.word);
    assert.ok(words.length > 1 && !words.includes('proxybeanmethods'), words.join(','));
  });

  await test('document frequencies and token sets are read from the files of an index', () => {
    const dir = tmp('sigmap-vocab-');
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/a.js'), '// settle quarterly ledgers\nfunction settleAccounts() {}\n');
    fs.writeFileSync(path.join(dir, 'src/b.js'), '// settle disputes\nfunction openDispute() {}\n');
    const index = new Map([['src/a.js', ['function settleAccounts()']], ['src/b.js', ['function openDispute()']], ['src/gone.js', ['function missing()']]]);
    const { docFreq, docCount } = vocab.docStats(index, dir);
    assert.strictEqual(docCount, 2, 'an unreadable file is not counted');
    assert.strictEqual(docFreq.get('settl') || docFreq.get('settle'), 2, 'both files say settle');
    const of = vocab.termsOf(index, dir);
    const a = of('src/a.js');
    assert.ok([...a.index].some((t) => t.startsWith('account')), 'the index entry holds the signature words');
    assert.ok([...a.source].some((t) => t.startsWith('quarter')), 'the source holds the comment words');
    assert.ok(![...a.index].some((t) => t.startsWith('quarter')), 'a comment word is not in the index entry');
    assert.strictEqual(of('src/gone.js'), null);
  });

  await test('a file too large for a whole-file scan reads as absent', () => {
    const dir = tmp('sigmap-vocab-big-');
    fs.writeFileSync(path.join(dir, 'big.js'), 'a'.repeat(vocab.MAX_SOURCE_BYTES + 1));
    fs.writeFileSync(path.join(dir, 'small.js'), 'function f() {}');
    assert.strictEqual(vocab.readSource(dir, 'big.js'), null);
    assert.strictEqual(vocab.readSource(dir, 'small.js'), 'function f() {}');
    assert.strictEqual(vocab.readSource(dir, 'nope.js'), null);
  });

  // ── who finds what ─────────────────────────────────────────────────────────

  await test('tasks are split by who finds the answer in the top 5', () => {
    const rec = (id, sigRank, cleanGrepRank, grepRank = null) => ({ id, sigRank, cleanGrepRank, grepRank });
    const x = autopsy.crossTab([rec('a', 1, 2), rec('b', 7, 3), rec('c', 2, null), rec('d', null, 9), rec('e', 5, 5), rec('f', 6, 6)]);
    assert.deepStrictEqual(x.both.map((r) => r.id), ['a', 'e']);
    assert.deepStrictEqual(x.grepOnly.map((r) => r.id), ['b']);
    assert.deepStrictEqual(x.sigmapOnly.map((r) => r.id), ['c']);
    assert.deepStrictEqual(x.neither.map((r) => r.id), ['d', 'f']);
    const published = autopsy.crossTab([rec('a', 1, 2, null)], 'grepRank');
    assert.strictEqual(published.sigmapOnly.length, 1, 'the published scan can be compared instead');
  });

  await test('hit counts and polluted places are counted over the same records', () => {
    const recs = [
      { sigRank: 1, grepRank: 9, cleanGrepRank: 2 },
      { sigRank: 8, grepRank: null, cleanGrepRank: 1 },
      { sigRank: 3, grepRank: 3, cleanGrepRank: 3 },
    ];
    assert.deepStrictEqual(autopsy.hitCounts(recs), { tasks: 3, sigmap: 2, grep: 1, cleanGrep: 3 });
    const p = autopsy.pollutedPlaces([{ top5: ['a.js', '.context/sig-index.json', 'b.js'] }, { top5: ['.github/copilot-instructions.md', 'c.js'] }], (f) => f.startsWith('.context/') || f.startsWith('.github/'));
    assert.deepStrictEqual(p, { places: 5, polluted: 2 });
  });

  // ── the grep scan ──────────────────────────────────────────────────────────

  /** A repository SigMap has been run in: one source file, and the context it wrote. */
  function indexedRepo() {
    const dir = tmp('sigmap-grep-');
    fs.mkdirSync(path.join(dir, 'src'));
    fs.mkdirSync(path.join(dir, '.context'));
    fs.mkdirSync(path.join(dir, '.github'));
    fs.writeFileSync(path.join(dir, 'src/answer.js'), '// handles webhook delivery retries\nfunction retryDelivery() {}\n');
    fs.writeFileSync(path.join(dir, 'src/other.js'), 'function unrelated() {}\n');
    // The generated files hold every identifier of the repository, so any question matches them.
    const everything = 'webhook delivery retries retryDelivery unrelated answer other\n';
    fs.writeFileSync(path.join(dir, '.context/sig-index.json'), everything);
    fs.writeFileSync(path.join(dir, '.github/copilot-instructions.md'), everything);
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), everything);
    return dir;
  }
  const TASKS = [{ id: 't1', query: 'webhook delivery retries' }];

  await test('the scan as published ranks the files SigMap wrote above the answer', () => {
    const dir = indexedRepo();
    const { ranked } = grep.grepRank(dir, TASKS);
    const top = ranked.get('t1');
    assert.ok(top.includes('.context/sig-index.json') && top.includes('.github/copilot-instructions.md'), top.join(','));
    assert.ok(top.indexOf('src/answer.js') > 0, 'the answer is pushed down by files that are not answers');
  });

  await test('with SigMap\'s own output left out, the answer leads and fewer files are scanned', () => {
    const dir = indexedRepo();
    const base = grep.grepRank(dir, TASKS);
    const clean = grep.grepRank(dir, TASKS, { skipFile: grep.sigmapOutputs(dir) });
    assert.strictEqual(clean.ranked.get('t1')[0], 'src/answer.js');
    assert.ok(!clean.ranked.get('t1').some((f) => f.startsWith('.context/') || f === 'CLAUDE.md' || f.startsWith('.github/copilot')));
    assert.strictEqual(base.filesScanned - clean.filesScanned, 3, 'sig-index.json, copilot-instructions.md and CLAUDE.md, and nothing else');
  });

  await test('the files SigMap writes are the adapters\' outputs and .context/, and nothing wider', () => {
    const dir = tmp('sigmap-grep-paths-');
    const mine = grep.sigmapOutputs(dir);
    for (const p of ['.context', '.context/sig-index.json', '.github/copilot-instructions.md', 'CLAUDE.md', 'AGENTS.md', '.cursorrules', '.windsurfrules', '.github/gemini-context.md', '.github/openai-context.md']) {
      assert.strictEqual(mine(p), true, p);
    }
    for (const p of ['src/CLAUDE.md', 'docs/AGENTS.md', 'src/context/a.js', '.github/workflows/ci.yml', '.contextual/x']) {
      assert.strictEqual(mine(p), false, p);
    }
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
