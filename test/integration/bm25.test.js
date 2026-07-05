'use strict';

/**
 * Unit tests for the identifier-aware BM25 re-ranker (src/retrieval/bm25.js, #395).
 *
 * Each acceptance criterion from the issue gets at least one test:
 *  - identifier-aware tokenization (camelCase / snake_case split)
 *  - light stemming (plurals / common suffixes)
 *  - path-token boost (filename is highly indicative)
 *  - BM25 scoring lifts an identifier-mismatch query that exact-token TF-IDF misses
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const { tokenize, stem, bm25rank, PATH_BOOST, expandQuery, EXPANSIONS, EXPANSION_WEIGHT } =
  require(path.join(ROOT, 'src', 'retrieval', 'bm25'));

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

console.log('[bm25.test.js] identifier-aware BM25 re-ranker (#395)');
console.log('');

// ---------------------------------------------------------------------------
// 1. Identifier-aware tokenization
// ---------------------------------------------------------------------------
test('tokenize: splits camelCase into constituent tokens', () => {
  const t = tokenize('componentEmits');
  assert.ok(t.includes('component'), `expected "component" in ${t}`);
  assert.ok(t.includes('emit'), `expected stemmed "emit" in ${t}`);
});

test('tokenize: splits snake_case into constituent tokens', () => {
  const t = tokenize('build_sig_index');
  assert.ok(t.includes('build'), `expected "build" in ${t}`);
  assert.ok(t.includes('sig'), `expected "sig" in ${t}`);
  assert.ok(t.includes('index'), `expected "index" in ${t}`);
});

test('tokenize: splits ALLCAPS acronym boundaries', () => {
  const t = tokenize('HTTPServer');
  assert.ok(t.includes('http'), `expected "http" in ${t}`);
  assert.ok(t.includes('serv'), `expected stemmed "serv" in ${t}`);
});

test('tokenize: drops stop words and single chars', () => {
  const t = tokenize('the a b c');
  assert.ok(!t.includes('the'), 'should drop "the"');
  assert.ok(!t.includes('a'), 'should drop single char "a"');
});

// ---------------------------------------------------------------------------
// 2. Light stemming
// ---------------------------------------------------------------------------
test('stem: collapses plurals and common suffixes', () => {
  assert.strictEqual(stem('emits'), 'emit');
  assert.strictEqual(stem('options'), 'option');
  assert.strictEqual(stem('parsing'), 'pars');
});

test('stem: leaves short words untouched', () => {
  assert.strictEqual(stem('css'), 'css');
  assert.strictEqual(stem('id'), 'id');
});

test('tokenize: query and identifier stem to the same token', () => {
  // "emit" (query) and "emits" (identifier) must collide after stemming
  assert.deepStrictEqual(
    tokenize('emit')[0],
    tokenize('emits')[0],
    'emit and emits should stem to the same token',
  );
});

// ---------------------------------------------------------------------------
// 3. Path-token boost
// ---------------------------------------------------------------------------
test('PATH_BOOST is applied: filename match outranks a body-only match', () => {
  const candidates = [
    { file: 'src/util/misc.js', sigs: ['function router(routes)'] },   // "router" only in a signature
    { file: 'src/router.js', sigs: ['function handle(req, res)'] },     // "router" in the filename
  ];
  const ranked = bm25rank('router', candidates);
  assert.strictEqual(ranked[0].file, 'src/router.js',
    `filename match should win, got ${ranked.map(r => r.file).join(', ')}`);
  assert.ok(PATH_BOOST >= 2, 'path boost should be at least 2×');
});

// ---------------------------------------------------------------------------
// 4. BM25 surfaces identifier-mismatch queries that exact-token TF-IDF misses
// ---------------------------------------------------------------------------
test('bm25rank: "component emit" surfaces componentEmits (the #395 motivating case)', () => {
  const candidates = [
    { file: 'src/componentEmits.ts', sigs: ['export function emit(instance, event)'] },
    { file: 'src/renderer.ts', sigs: ['export function render(vnode, container)'] },
    { file: 'src/scheduler.ts', sigs: ['export function queueJob(job)'] },
  ];
  const ranked = bm25rank('component emit', candidates);
  assert.strictEqual(ranked[0].file, 'src/componentEmits.ts',
    `expected componentEmits first, got ${ranked.map(r => r.file).join(', ')}`);
  assert.ok(ranked[0].score > 0, 'top score should be positive');
});

test('bm25rank: non-matching query yields zero scores', () => {
  const candidates = [{ file: 'src/a.js', sigs: ['function foo()'] }];
  const ranked = bm25rank('zzzznonexistent', candidates);
  assert.strictEqual(ranked[0].score, 0, 'no token match → score 0');
});

test('bm25rank: deterministic tie-break by file path', () => {
  const candidates = [
    { file: 'src/z.js', sigs: ['irrelevant'] },
    { file: 'src/a.js', sigs: ['irrelevant'] },
  ];
  const ranked = bm25rank('nomatch', candidates);
  assert.strictEqual(ranked[0].file, 'src/a.js', 'ties should sort by path asc');
});

test('bm25rank: empty candidate list returns empty array', () => {
  assert.deepStrictEqual(bm25rank('anything', []), []);
});

// ---------------------------------------------------------------------------
// Query expansion (#421) — benchmark-neutral recall aid, deterministic
// ---------------------------------------------------------------------------
test('EXPANSIONS maps bidirectional code-domain synonyms (stemmed)', () => {
  // `auth` and `database` resolve to their group members.
  const authSyns = EXPANSIONS.get(stem('auth')) || new Set();
  assert.ok(authSyns.has(stem('login')), 'auth should expand to login');
  const dbSyns = EXPANSIONS.get(stem('db')) || new Set();
  assert.ok(dbSyns.has(stem('database')), 'db should expand to database');
  const dbBack = EXPANSIONS.get(stem('database')) || new Set();
  assert.ok(dbBack.has('db'), 'database should expand back to db');
});

test('expandQuery: original tokens weight 1, synonyms weight < 1', () => {
  const q = [...new Set(tokenize('database'))];
  const w = expandQuery(q);
  for (const t of q) assert.strictEqual(w.get(t), 1, `original ${t} must keep full weight`);
  assert.strictEqual(w.get('db'), EXPANSION_WEIGHT, 'db (synonym) should carry the discount weight');
  assert.ok(EXPANSION_WEIGHT > 0 && EXPANSION_WEIGHT < 1, 'discount weight in (0,1)');
});

test('a synonym query surfaces a file that only uses the abbreviation', () => {
  const cands = [
    { file: 'src/auth.js', sigs: ['function authGuard(token)', 'function login(user)'] },
    { file: 'src/widget.js', sigs: ['function renderWidget(props)'] },
  ];
  const r = bm25rank('authentication', cands); // doc has no literal "authentication"
  assert.strictEqual(r[0].file, 'src/auth.js', 'expansion should surface the auth file');
  assert.ok(r[0].score > 0, 'expanded synonym should produce a non-zero score');
});

test('an exact-term match still outranks a synonym-only match', () => {
  const cands = [
    { file: 'src/exact.js', sigs: ['function authentication()'] }, // literal query term
    { file: 'src/syn.js', sigs: ['function auth()'] },             // synonym only
  ];
  const r = bm25rank('authentication', cands);
  assert.strictEqual(r[0].file, 'src/exact.js', 'exact term must win over synonym');
  assert.ok(r[0].score > r[1].score, 'exact score strictly greater');
});

test('expansion is deterministic (identical scores across runs)', () => {
  const cands = [{ file: 'src/config.js', sigs: ['function loadConfig()'] }];
  const a = bm25rank('configuration', cands)[0].score;
  const b = bm25rank('configuration', cands)[0].score;
  assert.strictEqual(a, b);
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
