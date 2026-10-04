'use strict';

/**
 * Repo-mined query expansion (B2, #649): deterministic co-occurrence mining
 * with precision filters, weight-ordered consumption in expandQuery, and the
 * mtime-keyed .context cache.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const me = require(path.join(ROOT, 'src/retrieval/mined-expansions'));
const { expandQuery, bm25rank, EXPANSION_WEIGHT } = require(path.join(ROOT, 'src/retrieval/bm25'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/**
 * 12-file fixture index (maxDf = floor(12 × 0.25) = 3):
 *  - alpha+bravo co-occur in 2 files          → mined both ways, weight 1
 *  - delta appears once (df floor)            → never expands
 *  - omega appears in 4 files (df ceiling)    → never expands
 *  - gamma+kappa co-occur once (min cooc)     → pair excluded
 *  - hub co-occurs with 5 partners            → top-K keeps 4
 *  - auth+login (static pair) + session       → static pair excluded, session mined
 */
function fixtureIndex() {
  return new Map([
    ['f1.js', ['function alpha bravo omega  :1-2']],
    ['f2.js', ['function alpha bravo omega  :1-2']],
    ['f3.js', ['function delta omega  :1-2']],
    ['f4.js', ['function omega solo  :1-2']],
    ['f5.js', ['function gamma kappa  :1-2']],
    ['f6.js', ['function gamma alone  :1-2']],
    ['f7.js', ['function kappa alone  :1-2']],
    ['f8.js', ['function hub pona ptwo pthree pfour pfiva  :1-2']],
    ['f9.js', ['function hub pona ptwo pthree pfour pfiva  :1-2']],
    ['f10.js', ['function auth login session  :1-2']],
    ['f11.js', ['function auth login session  :1-2']],
    ['f12.js', ['function zzfiller  :1-2']],
  ]);
}

const mined = me.mineExpansions(fixtureIndex());

test('mining is deterministic — same index, byte-identical JSON', () => {
  const again = me.mineExpansions(fixtureIndex());
  assert.strictEqual(me.canonicalJson(mined), me.canonicalJson(again));
});

test('co-occurring pair mines both directions with conditional-probability weight', () => {
  assert.ok(mined.expansions.alpha, `alpha missing: ${Object.keys(mined.expansions)}`);
  assert.deepStrictEqual(mined.expansions.alpha.find((p) => p[0] === 'bravo'), ['bravo', 1]);
  assert.deepStrictEqual(mined.expansions.bravo.find((p) => p[0] === 'alpha'), ['alpha', 1]);
});

test('df floor and ceiling exclude rare and ubiquitous tokens', () => {
  assert.strictEqual(mined.expansions.delta, undefined, 'df-1 token must not expand');
  assert.strictEqual(mined.expansions.omega, undefined, 'over-ceiling token must not expand');
  for (const [tok, list] of Object.entries(mined.expansions)) {
    assert.ok(!list.some((p) => p[0] === 'omega'), `${tok} expands to over-ceiling omega`);
  }
});

test('a pair below the co-occurrence minimum is excluded', () => {
  assert.ok(!mined.expansions.gamma || !mined.expansions.gamma.some((p) => p[0] === 'kappa'),
    `gamma↔kappa co-occur once and must not mine: ${JSON.stringify(mined.expansions.gamma)}`);
});

test('top-K caps a token at its strongest neighbors, deterministically ordered', () => {
  const hub = mined.expansions.hub;
  assert.ok(hub, 'hub missing');
  assert.strictEqual(hub.length, me.TOP_K, `expected ${me.TOP_K} neighbors, got ${hub.length}`);
  assert.deepStrictEqual(hub.map((p) => p[0]), ['pfiva', 'pfour', 'pona', 'pthree'],
    'equal weights must tie-break alphabetically');
});

test('pairs covered by the static EXPANSIONS table are excluded', () => {
  const auth = mined.expansions.auth || [];
  assert.ok(!auth.some((p) => p[0] === 'login'), `static pair auth↔login must not mine: ${JSON.stringify(auth)}`);
  assert.ok(auth.some((p) => p[0] === 'session'), `auth↔session is repo knowledge and must mine: ${JSON.stringify(auth)}`);
});

test('expandQuery without a mined map is byte-identical to before', () => {
  const a = expandQuery(['alpha']);
  assert.deepStrictEqual([...a.entries()], [['alpha', 1]]);
  const b = expandQuery(['auth']);
  assert.strictEqual(b.get('auth'), 1);
  assert.strictEqual(b.get('login'), EXPANSION_WEIGHT);
});

test('expandQuery merges mined entries below static weight without overriding', () => {
  const m = { auth: [['session', 0.9], ['login', 0.9]], alpha: [['bravo', 0.5]] };
  const w = expandQuery(['auth', 'alpha'], m);
  assert.strictEqual(w.get('auth'), 1);
  assert.strictEqual(w.get('login'), EXPANSION_WEIGHT, 'static entry must not be overridden by mined');
  assert.ok(Math.abs(w.get('session') - EXPANSION_WEIGHT * 0.9) < 1e-9, `mined weight wrong: ${w.get('session')}`);
  assert.ok(Math.abs(w.get('bravo') - EXPANSION_WEIGHT * 0.5) < 1e-9, `mined weight wrong: ${w.get('bravo')}`);
  for (const [, weight] of w) assert.ok(weight <= 1, 'no weight may exceed the original token weight');
});

test('bm25rank without expansions is unchanged; with them, mined synonyms score', () => {
  const candidates = [
    { file: 'a.js', sigs: ['function bravo thing  :1-1'] },
    { file: 'b.js', sigs: ['function unrelated words  :1-1'] },
  ];
  const off1 = bm25rank('alpha', candidates);
  const off2 = bm25rank('alpha', candidates, { expansions: null });
  assert.deepStrictEqual(off1.map((r) => [r.file, r.score]), off2.map((r) => [r.file, r.score]));
  assert.strictEqual(off1[0].score, 0, 'no token overlap without expansions');
  const on = bm25rank('alpha', candidates, { expansions: { alpha: [['bravo', 1]] } });
  assert.ok(on[0].file === 'a.js' && on[0].score > 0, `mined synonym must reach scoring: ${JSON.stringify(on)}`);
});

test('loadOrMine caches in .context keyed by context mtime', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-mined-'));
  try {
    fs.mkdirSync(path.join(dir, '.context'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.context', 'anchor.md'), 'x');
    const first = me.loadOrMine(dir);
    const cachePath = path.join(dir, '.context', 'mined-expansions.json');
    assert.ok(fs.existsSync(cachePath), 'cache file missing');
    const second = me.loadOrMine(dir);
    assert.strictEqual(JSON.stringify(first), JSON.stringify(second), 'cache hit must return identical data');
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(dir, '.context', 'anchor.md'), future, future);
    const third = me.loadOrMine(dir);
    assert.notStrictEqual(third.builtFor, first.builtFor, 'moved context mtime must rebuild the cache');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

console.log(`\nmined-expansions: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
