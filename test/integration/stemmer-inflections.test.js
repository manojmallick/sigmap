'use strict';

/**
 * #875 — the stemmer must conflate a word with its inflections.
 *
 * `stem("classified")` was `classifi` and `stem("classify")` was `classify`, so a
 * question phrased "how are test files classified" never met `classify` in code, and
 * `src/util/file-class.js` sat at rank 15-35. Six of ten common pairs failed. The fix
 * is measured, not guessed — every rule below was kept or dropped by a same-tree
 * retrieval control (hit@5 per corpus, MRR, per-task rank diff); see the PR.
 *
 * What these guard:
 *   - the issue's ten pairs and a wider set of inflection families conflate
 *   - the guards that stop the new rules over-stripping (`order` is not `ord`)
 *   - stability: re-stemming a stem changes nothing for the common vocabulary, and
 *     the rate over this repo's own identifiers stays low (the old stemmer: 2.9%)
 *   - a stem ending in a lone `s` never exists, because the plural rule eats it
 *   - the motivating query reaches the file that answers it
 *   - a mined-expansions cache written by the old stemmer is not reused
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const { stem, tokenize, STOP } = require(path.join(ROOT, 'src/retrieval/bm25'));
const { rank } = require(path.join(ROOT, 'src/retrieval/ranker'));
const mined = require(path.join(ROOT, 'src/retrieval/mined-expansions'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

console.log('[stemmer-inflections.test.js] inflection conflation (#875)');
console.log('');

// ── the issue's pairs ───────────────────────────────────────────────────────

test('#875 all ten pairs from the issue conflate', () => {
  const pairs = [['classify', 'classified'], ['apply', 'applied'], ['order', 'ordering'],
    ['parse', 'parsing'], ['verify', 'verified'], ['cache', 'caching'], ['index', 'indexing'],
    ['rank', 'ranking'], ['budget', 'budgets'], ['match', 'matching']];
  const failing = pairs.filter(([a, b]) => stem(a) !== stem(b))
    .map(([a, b]) => `${a}→${stem(a)} / ${b}→${stem(b)}`);
  assert.deepStrictEqual(failing, [], `pairs that do not conflate: ${failing.join(', ')}`);
});

// Every form in a row must reach ONE stem. Rows are common code vocabulary, chosen
// across the shapes the rules handle: -y/-ied/-ies, silent e, doubled consonants,
// an -er base word, an -er that sits under -ed, and the plural folds.
const FAMILIES = [
  ['classify', 'classified', 'classifies', 'classifying', 'classifier', 'classification'],
  ['apply', 'applied', 'applies', 'applying'],
  ['verify', 'verified', 'verifies', 'verifying'],
  ['try', 'tries', 'tried', 'trying'],
  ['parse', 'parses', 'parsed', 'parsing'],
  ['cache', 'caches', 'cached', 'caching'],
  ['resolve', 'resolves', 'resolved', 'resolving'],
  ['merge', 'merges', 'merged', 'merging'],
  ['create', 'creates', 'created', 'creating'],
  ['handle', 'handles', 'handled', 'handling', 'handler', 'handlers'],
  ['manage', 'manages', 'managed', 'managing', 'manager'],
  ['map', 'maps', 'mapped', 'mapping'],
  ['log', 'logs', 'logged', 'logging'],
  ['scan', 'scans', 'scanned', 'scanning'],
  ['emit', 'emits', 'emitted', 'emitting'],
  ['rank', 'ranks', 'ranked', 'ranking'],
  ['index', 'indexes', 'indexed', 'indexing'],
  ['match', 'matches', 'matched', 'matching'],
  ['budget', 'budgets', 'budgeted', 'budgeting'],
  ['order', 'orders', 'ordered', 'ordering'],
  ['render', 'renders', 'rendered', 'rendering'],
  ['filter', 'filters', 'filtered', 'filtering'],
  ['register', 'registers', 'registered', 'registering'],
  ['trigger', 'triggers', 'triggered', 'triggering'],
  ['process', 'processes', 'processed', 'processing'],
  ['load', 'loads', 'loaded', 'loading'],
  ['walk', 'walks', 'walked', 'walking'],
  ['serve', 'serves', 'served', 'serving'],
];

test('#875 every form of a common code word reaches one stem', () => {
  const split = FAMILIES.filter((f) => new Set(f.map(stem)).size !== 1)
    .map((f) => f.map((w) => `${w}→${stem(w)}`).join(' '));
  assert.deepStrictEqual(split, [], `families that split:\n  ${split.join('\n  ')}`);
});

test('#875 classify reaches `class`, so "classified" meets a file-class path', () => {
  assert.strictEqual(stem('classified'), stem('class'));
  assert.ok(tokenize('file-class.js').includes(stem('classified')));
});

// ── the guards ──────────────────────────────────────────────────────────────

test('#875 a short root is not mangled by -er (order is not ord + er)', () => {
  assert.strictEqual(stem('order'), 'order');
  assert.notStrictEqual(stem('order'), stem('ord'));
  for (const w of ['filter', 'render', 'buffer', 'server', 'folder', 'number', 'user']) {
    assert.strictEqual(stem(w), stem(w + 's'), `${w} must keep its root through the plural`);
  }
});

test('#875 derivational suffixes need a real root (normal is not norm + al)', () => {
  assert.notStrictEqual(stem('normal'), stem('norm'));
  assert.notStrictEqual(stem('final'), stem('fin'));
  assert.notStrictEqual(stem('local'), stem('loc'));
});

test('#875 -ify needs a root of 4+ chars: verify and notify are not ver / not', () => {
  assert.strictEqual(stem('verify'), 'verify');
  assert.strictEqual(stem('notify'), 'notify');
  assert.strictEqual(stem('modify'), 'modify');
});

test('#875 distinct words stay distinct (no collision with a different root)', () => {
  assert.notStrictEqual(stem('process'), stem('proces'));
  assert.notStrictEqual(stem('database'), stem('data'));
  assert.notStrictEqual(stem('status'), stem('state'));
  assert.notStrictEqual(stem('parser'), stem('part'));
});

test('stem leaves words of 3 chars or fewer untouched and never returns an empty string', () => {
  for (const w of ['css', 'id', 'use', 'run', 'map', 'sig']) assert.strictEqual(stem(w), w);
  for (const w of ['ing', 'ied', 'edly', 'ers', 'aled', 'ered', 'ably']) {
    assert.ok(stem(w).length >= 3 || stem(w) === w, `stem("${w}") = "${stem(w)}"`);
  }
});

// ── stability ───────────────────────────────────────────────────────────────

test('#875 re-stemming a stem changes nothing, for every word in the families', () => {
  const unstable = FAMILIES.flat().filter((w) => stem(stem(w)) !== stem(w))
    .map((w) => `${w}→${stem(w)}→${stem(stem(w))}`);
  assert.deepStrictEqual(unstable, [], `not idempotent: ${unstable.join(', ')}`);
});

test('#875 a stem never ends in a lone `s` (the plural rule would eat it on re-stemming)', () => {
  for (const w of ['parse', 'parses', 'parsing', 'close', 'closing', 'release', 'releasing',
    'response', 'database', 'license', 'phase', 'cause', 'caused', 'raise', 'raised']) {
    assert.ok(!/[^s]s$/.test(stem(w)) || /[^aeiou]us$/.test(stem(w)), `stem("${w}") = "${stem(w)}"`);
    assert.strictEqual(stem(stem(w)), stem(w), `stem("${w}") is not stable`);
  }
  assert.strictEqual(stem('parsing'), stem('parse'));
  assert.strictEqual(stem('closing'), stem('close'));
});

test('stem is a pure function: the bounded cache filling and clearing never changes a result', () => {
  const words = FAMILIES.flat();
  const before = words.map(stem);
  for (let i = 0; i < 60000; i++) stem(`word${i.toString(36)}ing`); // past STEM_CACHE_MAX, forces a clear
  assert.deepStrictEqual(words.map(stem), before);
});

function ownVocabulary() {
  const words = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      const toks = fs.readFileSync(p, 'utf8').replace(/[^A-Za-z0-9]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .toLowerCase().split(/\s+/);
      for (const t of toks) if (/^[a-z]{2,}$/.test(t) && !STOP.has(t)) words.add(t);
    }
  };
  walk(path.join(ROOT, 'src'));
  walk(path.join(ROOT, 'packages'));
  return [...words];
}

test('#875 re-stemming is stable for 98%+ of this repo\'s own identifiers (was 97.1%)', () => {
  const vocab = ownVocabulary();
  assert.ok(vocab.length > 2000, `vocabulary too small to mean anything: ${vocab.length}`);
  const unstable = vocab.filter((w) => stem(stem(w)) !== stem(w));
  const rate = unstable.length / vocab.length;
  assert.ok(rate < 0.02,
    `${unstable.length}/${vocab.length} (${(rate * 100).toFixed(2)}%) words change when re-stemmed; `
    + `the old stemmer was 2.9%. Offenders: ${unstable.slice(0, 15).join(' ')}`);
});

test('#875 stems are at least 3 chars for every identifier of 4+ chars in this repo', () => {
  const short = ownVocabulary().filter((w) => w.length >= 4 && stem(w).length < 3);
  assert.deepStrictEqual(short, [], `over-stripped to a stub: ${short.slice(0, 15).join(' ')}`);
});

// ── the motivating query ────────────────────────────────────────────────────

test('#875 "how are test files classified" ranks file-class.js in the top 3', () => {
  // A miniature of the real index: file-class.js says "file" in its path and never
  // spells `classified`, while a dozen other files say "file" far more often. Only the
  // stem reaches it — before #875 it ranked outside the top 12.
  const fillers = ['reader', 'writer', 'watcher', 'lock', 'copy', 'stat', 'cache', 'walker', 'filter', 'mover', 'hasher', 'linker'];
  const idx = new Map([
    ['src/util/file-class.js', ['function isTestFile(filePath)', 'function isMockFile(filePath)',
      'function isGeneratedFile(filePath)', 'function isDocsFile(filePath)']],
    ['src/routing/classifier.js', ['function classifyTask(task)', 'function classifierFor(kind)']],
    ['src/analysis/index-state.js', ['function classifyIndexEntries(cwd, indexed)', 'function indexFreshness(cwd)']],
    ['src/retrieval/selection-quality.js', ['function classifySelection(selected)']],
    ...fillers.map((n) => [`src/io/file-${n}.js`, [`function ${n}File(filePath)`, `function ${n}Files(files)`,
      `function ${n}FileSync(filePath)`, `function file${n[0].toUpperCase() + n.slice(1)}(filePath, fileOptions)`]]),
    ['src/format/table.js', ['function renderTable(rows)']],
  ]);
  const ranked = rank('how are test files classified', idx, { topK: 12, learned: false });
  const at = ranked.findIndex((r) => r.file === 'src/util/file-class.js') + 1;
  assert.ok(at >= 1 && at <= 3,
    `file-class.js ranked ${at || 'outside the top 12'}: ${ranked.slice(0, 6).map((r) => r.file).join(', ')}`);
});

// ── cached state keyed by stem ──────────────────────────────────────────────

test('#875 a mined-expansions cache written by the old stemmer is rebuilt, not reused', () => {
  assert.ok(mined.SCHEMA_VERSION >= 2, 'the schema must have moved with the stemmer');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-stem-'));
  try {
    fs.mkdirSync(path.join(dir, '.context'));
    fs.writeFileSync(path.join(dir, '.context', 'sig-index.json'), '{}');
    const mtime = fs.statSync(path.join(dir, '.context', 'sig-index.json')).mtimeMs;
    // Exactly what a pre-#875 run left behind: keyed by the old stems, same mtime key.
    fs.writeFileSync(path.join(dir, '.context', 'mined-expansions.json'), JSON.stringify({
      schema: 1, builtFor: mtime, files: 3, expansions: { classifi: [['legacystem', 1]] },
    }));
    const out = mined.loadOrMine(dir);
    assert.strictEqual(out.schema, mined.SCHEMA_VERSION);
    assert.ok(!('classifi' in out.expansions), 'the stale cache was served');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
