'use strict';

/**
 * Where body words go in BM25, and the rule that decides what weight they get (#943).
 *
 * `retrieval.bodyWords` used to put a file's rare source words into the prose field, carrying
 * its weight and its length. `bodyField: 'own'` gives them a field of their own with a weight
 * and a length treatment, so the sweep can ask what each does. These tests pin what the knob may
 * and may not do, with hand-built candidates (no repository, no network), and the arithmetic of
 * judging a family of variants:
 *
 *   - nothing set is exactly the prose-field behaviour, and the knob is inert without body words
 *   - a weight of zero is no body words at all; a higher weight scores a body-only match higher
 *   - `count` lengthens a document by its body words, `ignore` does not
 *   - the verdict is the mildest variant that meets the guide's rule, halves included
 *
 * Run: node test/integration/body-weight.test.js
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const { bm25rank, BODY_FIELD, BODY_WEIGHT, BODY_LENGTH } = require(path.join(ROOT, 'src/retrieval/bm25'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}

// Four files of identical signatures, so only their body words tell them apart. `plain` has none,
// `short` holds the one word the question asks for, `long` holds it and a hundred filler words.
const FILLER = Array.from({ length: 100 }, (_, i) => `filler${i}x`).join(' ');
const CANDIDATES = [
  { file: 'src/plain.js', sigs: ['function alpha(a)'] },
  { file: 'src/short.js', sigs: ['function alpha(a)'] },
  { file: 'src/long.js', sigs: ['function alpha(a)'] },
  { file: 'src/other.js', sigs: ['function beta(b)'] },
];
const WORDS = new Map([
  ['src/short.js', 'pelican'],
  ['src/long.js', `pelican ${FILLER}`],
]);
const QUERY = 'pelican';
const scoreOf = (opts, file) => bm25rank(QUERY, CANDIDATES, Object.assign({ bodyWords: WORDS }, opts)).find((r) => r.file === file).score;

(async () => {
  const { VARIANTS, XREPO_MIN_NET, netOf, judge, verdict, chooseOnTuning, foldsOf } = await import('../../scripts/lib/body-weight.mjs');

  // ── the knob ───────────────────────────────────────────────────────────────

  await test('the shipped placement is a pair of named constants, and the field is the one the verdict chose', () => {
    assert.ok(['prose', 'own'].includes(BODY_FIELD));
    assert.strictEqual(typeof BODY_WEIGHT, 'number');
    assert.ok(['count', 'ignore'].includes(BODY_LENGTH));
  });

  await test('nothing set, and an unknown value, are exactly the placement the constants name', () => {
    const named = JSON.stringify(bm25rank(QUERY, CANDIDATES, { bodyWords: WORDS, bodyField: BODY_FIELD, bodyWeight: BODY_WEIGHT, bodyLength: BODY_LENGTH }));
    for (const opts of [{}, { bodyField: 'elsewhere' }, { bodyWeight: -1 }, { bodyWeight: 'heavy' }, { bodyLength: 'sometimes' }]) {
      assert.strictEqual(JSON.stringify(bm25rank(QUERY, CANDIDATES, Object.assign({ bodyWords: WORDS }, opts))), named, JSON.stringify(opts));
    }
  });

  await test('without body words the knob does nothing, whatever it is set to', () => {
    const base = JSON.stringify(bm25rank(QUERY, CANDIDATES));
    for (const opts of [{ bodyField: 'own' }, { bodyField: 'own', bodyWeight: 0.9, bodyLength: 'ignore' }, { bodyField: 'prose', bodyWeight: 0.1 }]) {
      assert.strictEqual(JSON.stringify(bm25rank(QUERY, CANDIDATES, opts)), base);
      assert.strictEqual(JSON.stringify(bm25rank(QUERY, CANDIDATES, Object.assign({ bodyWords: new Map() }, opts))), base);
    }
  });

  await test('prose ignores weight and length: the body words ride the prose field, weight and length alike', () => {
    const prose = JSON.stringify(bm25rank(QUERY, CANDIDATES, { bodyWords: WORDS, bodyField: 'prose' }));
    for (const opts of [{ bodyWeight: 0.1 }, { bodyLength: 'ignore' }, { bodyWeight: 0.9, bodyLength: 'count' }]) {
      assert.strictEqual(JSON.stringify(bm25rank(QUERY, CANDIDATES, Object.assign({ bodyWords: WORDS, bodyField: 'prose' }, opts))), prose);
    }
  });

  await test('in a field of their own a weight of zero is no body words at all', () => {
    for (const bodyLength of ['count', 'ignore']) {
      const zero = bm25rank(QUERY, CANDIDATES, { bodyWords: WORDS, bodyField: 'own', bodyWeight: 0, bodyLength });
      assert.ok(zero.every((r) => r.score === 0), `${bodyLength}: nothing matches the question without body words`);
    }
  });

  await test('a higher weight scores a body-only match higher, and never reorders by name', () => {
    let last = 0;
    for (const w of [0.1, 0.3, 0.6, 0.9]) {
      const s = scoreOf({ bodyField: 'own', bodyWeight: w, bodyLength: 'ignore' }, 'src/short.js');
      assert.ok(s > last, `weight ${w} scored ${s}, not above ${last}`);
      last = s;
    }
  });

  await test('counted into the length, a file with many body words scores lower than one with few; ignored, they tie', () => {
    const counted = { bodyField: 'own', bodyWeight: 0.6, bodyLength: 'count' };
    const ignored = { bodyField: 'own', bodyWeight: 0.6, bodyLength: 'ignore' };
    assert.ok(scoreOf(counted, 'src/long.js') < scoreOf(counted, 'src/short.js'), 'count: the longer document is penalised');
    assert.strictEqual(scoreOf(ignored, 'src/long.js'), scoreOf(ignored, 'src/short.js'), 'ignore: body words add no length');
  });

  await test('ignored, body words leave a file that has none exactly as it was; counted, they only raise it, through the average length', () => {
    const ignored = { bodyField: 'own', bodyWeight: 0.3, bodyLength: 'ignore' };
    const counted = { bodyField: 'own', bodyWeight: 0.3, bodyLength: 'count' };
    const without = bm25rank('alpha', CANDIDATES);
    const scoreIn = (rs, file) => rs.find((r) => r.file === file).score;
    for (const file of ['src/plain.js', 'src/other.js']) {
      assert.strictEqual(scoreIn(bm25rank('alpha', CANDIDATES, Object.assign({ bodyWords: WORDS }, ignored)), file), scoreIn(without, file), `${file}: ignore must not move a file with no body words`);
      assert.ok(scoreIn(bm25rank('alpha', CANDIDATES, Object.assign({ bodyWords: WORDS }, counted)), file) >= scoreIn(without, file), `${file}: count can only lengthen the average`);
    }
  });

  // ── the family and the verdict ─────────────────────────────────────────────

  await test('variant ids are unique, each is a field of its own, and the family runs mildest first', () => {
    assert.strictEqual(new Set(VARIANTS.map((v) => v.id)).size, VARIANTS.length);
    let prev = null;
    for (const v of VARIANTS) {
      assert.strictEqual(v.options.bodyField, 'own', `${v.id} is not a field of its own`);
      assert.ok(['count', 'ignore'].includes(v.options.bodyLength));
      assert.strictEqual(v.id, `w${v.options.bodyWeight}-${v.options.bodyLength}`, `${v.id} does not say what it sets`);
      if (prev) {
        const byWeight = v.options.bodyWeight - prev.options.bodyWeight;
        assert.ok(byWeight > 0 || (byWeight === 0 && prev.options.bodyLength === 'count' && v.options.bodyLength === 'ignore'), `${v.id} is not milder-first after ${prev.id}`);
      }
      prev = v;
    }
  });

  await test('folds deal sorted units alternately, so the split does not depend on file order', () => {
    assert.deepStrictEqual([...foldsOf(['d', 'b', 'a', 'c']).entries()].sort(), [...foldsOf(['a', 'b', 'c', 'd']).entries()].sort());
  });

  // Rows for the arithmetic: `repo` is the xrepo unit, folds are dealt by repository.
  const row = (corpus, unit, id, plain, arms) => ({ corpus, unit, id, plain, arms });
  const foldFor = (corpus, r) => ({ a: 0, b: 1 }[r.unit]);
  const xrepo = (armHits) => ['a', 'b'].flatMap((unit) => Array.from({ length: 4 }, (_, i) => row('xrepo', unit, `${unit}${i}`, 0, armHits)));

  await test('netOf is the arm\'s hits minus plain\'s, summed', () => {
    assert.strictEqual(netOf([row('x', 'u', '1', 1, { v: 0 }), row('x', 'u', '2', 0, { v: 1 }), row('x', 'u', '3', 0, { v: 1 })], 'v'), 1);
  });

  await test('a variant meets the rule on xrepo +5 with nothing negative, and says why when it does not', () => {
    const win = { v: 1 };
    const meets = judge({ xrepo: xrepo(win), hard: [row('hard', 'self', 'h1', 1, { v: 1 })] }, 'v', foldFor);
    assert.strictEqual(meets.meets, true, JSON.stringify(meets.failures));
    assert.strictEqual(meets.nets.xrepo, 8);

    const small = judge({ xrepo: [...xrepo({ v: 0 }).slice(0, 2).map((r, i) => Object.assign(r, { arms: { v: i < 2 ? 1 : 0 } }))] }, 'v', foldFor);
    assert.strictEqual(small.meets, false);
    assert.ok(small.failures.some((f) => f.includes(`below +${XREPO_MIN_NET}`)), small.failures.join('; '));

    const negative = judge({ xrepo: xrepo(win), hard: [row('hard', 'self', 'h1', 1, { v: 0 })] }, 'v', foldFor);
    assert.strictEqual(negative.meets, false);
    assert.ok(negative.failures.some((f) => /hard is net-negative/.test(f)));
  });

  await test('a variant that wins on one half and loses on the other does not meet the rule', () => {
    // 5 won on half a, 1 lost on half b: xrepo net +4 is below +5 anyway, so give it 9 won against 1 lost on b
    const rows = [
      ...Array.from({ length: 9 }, (_, i) => row('xrepo', 'a', `a${i}`, 0, { v: 1 })),
      ...Array.from({ length: 5 }, (_, i) => row('mined', `m${i}`, `m${i}`, 1, { v: 0 })),
      ...Array.from({ length: 6 }, (_, i) => row('mined', `n${i}`, `n${i}`, 0, { v: 1 })),
    ];
    const folds = (corpus, r) => (corpus === 'xrepo' ? 0 : (r.unit.startsWith('m') ? 0 : 1));
    const j = judge({ xrepo: rows.filter((r) => r.corpus === 'xrepo'), mined: rows.filter((r) => r.corpus === 'mined') }, 'v', folds);
    assert.strictEqual(j.nets.mined, 1, 'net-positive over the whole corpus');
    assert.strictEqual(j.meets, false);
    assert.ok(j.failures.some((f) => /mined half 0 is net-negative/.test(f)), j.failures.join('; '));
  });

  await test('the verdict is the mildest variant that meets the rule, and null when none does', () => {
    const byCorpus = { xrepo: xrepo({ weak: 0, mild: 1, strong: 1 }), hard: [row('hard', 'self', 'h1', 1, { weak: 1, mild: 1, strong: 0 })] };
    const v = verdict(byCorpus, ['weak', 'mild', 'strong'], foldFor);
    assert.strictEqual(v.choice, 'mild');
    assert.strictEqual(v.judged.weak.meets, false);
    assert.strictEqual(v.judged.strong.meets, false, 'the strongest loses hard');
    assert.strictEqual(verdict({ xrepo: xrepo({ weak: 0 }) }, ['weak'], foldFor).choice, null);
  });

  await test('chooseOnTuning picks the best net of xrepo and mined, skips a variant that loses a tuned corpus, and may pick nothing', () => {
    const tuning = [
      ...Array.from({ length: 6 }, (_, i) => row('xrepo', 'a', `x${i}`, 0, { mild: i < 3 ? 1 : 0, bold: 1, risky: 1 })),
      ...Array.from({ length: 2 }, (_, i) => row('mined', 'self', `m${i}`, 1, { mild: 1, bold: 1, risky: 0 })),
    ];
    assert.deepStrictEqual(chooseOnTuning(tuning, ['mild', 'bold', 'risky']), { id: 'bold', net: 6 });
    assert.strictEqual(chooseOnTuning(tuning, ['risky']), null, 'risky loses both mined tasks');
    assert.strictEqual(chooseOnTuning([row('xrepo', 'a', 'x', 1, { flat: 1 })], ['flat']), null, 'a flat table picks nothing');
  });

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
