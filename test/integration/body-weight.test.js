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
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const { bm25rank, BODY_FIELD, BODY_WEIGHT, BODY_LENGTH } = require(path.join(ROOT, 'src/retrieval/bm25'));
const runner = require(path.join(ROOT, 'src/eval/runner'));
const { DEFAULTS } = require(path.join(ROOT, 'src/config/defaults'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const tmpDirs = [];

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
  const { VARIANTS, ADOPTED, STABLE_CORPORA, XREPO_MIN_NET, netOf, judge, verdict, chooseOnTuning, foldsOf } = await import('../../scripts/lib/body-weight.mjs');

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

  // ── the benchmarks read the flag, so they measure what ships ───────────────

  /** A repository whose only answer to the question lives in a function body: no signature says it. */
  function repo(config) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-body-weight-'));
    tmpDirs.push(dir);
    fs.mkdirSync(path.join(dir, 'src'));
    const files = {
      'src/herald.js': 'function notifyCustomer(customer) {\n  // sends nightly reminders\n  return customer;\n}\n',
      'src/ledger.js': 'function settlePayment(invoice) {}\n',
      'src/vault.js': 'function refundPayment(invoice) {}\n',
    };
    for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, rel), body);
    if (config) fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(config));
    const index = new Map(Object.keys(files).map((f) => [f, [f.includes('herald') ? 'function notifyCustomer(customer)' : f.includes('ledger') ? 'function settlePayment(invoice)' : 'function refundPayment(invoice)']]));
    return { dir, index };
  }
  const NIGHTLY = 'send nightly reminders';
  const found = (r, opts) => runner.rank(NIGHTLY, r.index, 5, Object.assign({ cwd: r.dir, learned: false }, opts)).map((x) => x.file);
  const withDefault = (on, fn) => {
    const before = DEFAULTS.retrieval.bodyWords;
    DEFAULTS.retrieval.bodyWords = on;
    try { return fn(); } finally { DEFAULTS.retrieval.bodyWords = before; }
  };

  await test('the runner ranks without body words while the flag is off, and the flag is off in this repository', () => {
    assert.strictEqual(DEFAULTS.retrieval.bodyWords, false, 'a default flip is a release decision: it moves every published figure');
    assert.deepStrictEqual(found(repo()), []);
  });

  await test('a repository that turns the flag on is benchmarked with its body words, and nothing is written into it', () => {
    const r = repo({ retrieval: { bodyWords: true } });
    assert.deepStrictEqual(found(r), ['src/herald.js']);
    assert.ok(!fs.existsSync(path.join(r.dir, '.context')), 'a benchmark leaves a pinned checkout untouched');
  });

  await test('a caller that names the option is left alone: null is no body words, whatever the repository says', () => {
    const r = repo({ retrieval: { bodyWords: true } });
    assert.deepStrictEqual(found(r, { bodyWords: null }), []);
    assert.deepStrictEqual(found(r, { bodyWords: undefined }), []);
    assert.deepStrictEqual(found(r, { bodyWords: new Map([['src/ledger.js', 'nightly reminders']]) }), ['src/ledger.js']);
  });

  await test('with the flag the default, an unconfigured repository is benchmarked with them and a configured one can opt out', () => {
    withDefault(true, () => {
      assert.deepStrictEqual(found(repo()), ['src/herald.js']);
      assert.deepStrictEqual(found(repo({ retrieval: { bodyWords: false } })), []);
    });
  });

  await test('an index scored over many tasks reads its sources once', () => {
    const r = repo({ retrieval: { bodyWords: true } });
    found(r);
    fs.writeFileSync(path.join(r.dir, 'src/herald.js'), 'function notifyCustomer(customer) {}\n');
    assert.deepStrictEqual(found(r), ['src/herald.js'], 'the words built for this index are reused, not re-read per question');
  });

  await test('the arms are flag-aware: plain is what ships, and the body arm flips the flag relative to it', async () => {
    const { buildArmRankers } = await import('../../scripts/lib/signal-rankers.mjs');
    const { bodyDefault } = await import('../../scripts/lib/signal-arms.mjs');
    const arms = (on) => withDefault(on, () => {
      const r = repo();
      const { rankers } = buildArmRankers({ index: r.index, dir: r.dir, graph: null, rankQuery: runner.rank });
      return { plain: rankersOut(rankers.plain), body: rankersOut(rankers.body), on: bodyDefault() };
    });
    function rankersOut(rank) { return rank(NIGHTLY); }
    const off = arms(false);
    assert.deepStrictEqual([off.on, off.plain, off.body], [false, [], ['src/herald.js']], 'off: the arm adds the words');
    const on = arms(true);
    assert.deepStrictEqual([on.on, on.plain, on.body], [true, ['src/herald.js'], []], 'on: plain carries them and the arm is the ablation');
  });

  // ── the recorded measurement and the guide that reports it ─────────────────

  const REPORT = 'benchmarks/reports/body-weight-sweep.json';
  const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
  const cell = (won, lost) => `${signed(won - lost)} (${won}/${lost})`;
  const CORPORA = ['xrepo', 'hard', 'mined', 'easy', 'jvm', 'honest'];
  const guideSection = () => {
    const guide = read('docs-vp/guide/retrieval-benchmark.md');
    const at = guide.indexOf('\n### Weighting the body words (#943)\n');
    assert.ok(at !== -1, 'the guide has no "Weighting the body words (#943)" section');
    const next = guide.indexOf('\n### ', at + 10);
    return guide.slice(at, next === -1 ? undefined : next).replace(/\u2212/g, '-');
  };

  await test('the report holds exactly the declared family, each scored on all six corpora', () => {
    const report = JSON.parse(read(REPORT));
    assert.deepStrictEqual(Object.keys(report.grid), VARIANTS.map((v) => v.id));
    for (const v of VARIANTS) {
      assert.deepStrictEqual(report.grid[v.id].options, v.options, `${v.id}: the report records another variant than the code declares`);
      assert.deepStrictEqual(Object.keys(report.grid[v.id].corpora), CORPORA);
    }
    assert.deepStrictEqual(Object.keys(report.shipped.corpora), CORPORA);
    assert.strictEqual(report.rule.xrepoMinNet, XREPO_MIN_NET);
  });

  await test('every verdict in the report is the rule applied to its own counts', () => {
    const report = JSON.parse(read(REPORT));
    for (const [id, g] of Object.entries({ shipped: report.shipped, ...report.grid })) {
      const nets = Object.fromEntries(CORPORA.map((c) => [c, g.corpora[c].won - g.corpora[c].lost]));
      const halves = Object.values(g.halves).flat();
      const meets = nets.xrepo >= XREPO_MIN_NET && Object.values(nets).every((n) => n >= 0) && halves.every((n) => n >= 0);
      assert.strictEqual(g.meets, meets, `${id}: the report says ${g.meets}, its own counts say ${meets}`);
      assert.strictEqual(g.failures.length === 0, g.meets, `${id}: failures and verdict disagree`);
    }
  });

  await test('the code ships the adopted variant, and it is one of the family', () => {
    const adopted = VARIANTS.find((v) => v.id === ADOPTED);
    assert.ok(adopted, `${ADOPTED} is not in the family`);
    assert.deepStrictEqual(
      { field: BODY_FIELD, weight: BODY_WEIGHT, length: BODY_LENGTH },
      { field: adopted.options.bodyField, weight: adopted.options.bodyWeight, length: adopted.options.bodyLength },
      'src/retrieval/bm25.js must ship the variant scripts/lib/body-weight.mjs adopts; change both together',
    );
  });

  await test('the adopted variant meets the rule on the recorded counts, and is worse than the control on no stable corpus', () => {
    const report = JSON.parse(read(REPORT));
    const net = (g, c) => g.corpora[c].won - g.corpora[c].lost;
    const adopted = report.grid[ADOPTED];
    assert.strictEqual(adopted.meets, true, `${ADOPTED} fails the rule: ${adopted.failures.join('; ')}`);
    for (const c of STABLE_CORPORA) {
      assert.ok(net(adopted, c) >= net(report.shipped, c), `${ADOPTED} is worse than the placement it replaces on ${c} (${net(adopted, c)} against ${net(report.shipped, c)})`);
    }
    assert.ok(net(adopted, 'xrepo') > net(report.shipped, 'xrepo'), 'the length treatment is adopted for what it does on the third-party corpus');
  });

  await test('the report records the rule\'s own verdict beside the adopted variant and says whether the control met it', () => {
    const report = JSON.parse(read(REPORT));
    const meeting = VARIANTS.filter((v) => report.grid[v.id].meets).map((v) => v.id);
    assert.strictEqual(report.verdict.choice, meeting.length ? meeting[0] : null, 'the verdict is the mildest variant that meets the rule');
    assert.strictEqual(report.verdict.adopted, ADOPTED);
    assert.strictEqual(report.verdict.controlMeets, report.shipped.meets);
  });

  await test('the length treatment is the reproducible effect: not counting the words beats counting them on xrepo at every weight, and never helps hard', () => {
    const report = JSON.parse(read(REPORT));
    const net = (g, c) => g.corpora[c].won - g.corpora[c].lost;
    const weights = [...new Set(VARIANTS.map((v) => v.options.bodyWeight))].filter((w) => report.grid[`w${w}-count`] && report.grid[`w${w}-ignore`]);
    assert.ok(weights.length >= 4, 'the pairs that differ only in the length treatment');
    const dx = weights.map((w) => net(report.grid[`w${w}-ignore`], 'xrepo') - net(report.grid[`w${w}-count`], 'xrepo'));
    assert.ok(dx.every((d) => d >= 2), `xrepo gains from ignoring length at every weight: ${dx.join(', ')}`);
    for (const w of weights) {
      assert.ok(net(report.grid[`w${w}-ignore`], 'hard') <= net(report.grid[`w${w}-count`], 'hard'), `w${w}: ignoring length helps hard, which the guide says it never does`);
    }
    const text = guideSection();
    assert.match(text, new RegExp(`by \\+${Math.min(...dx)} or \\+${Math.max(...dx)} on xrepo`), 'the guide states the range this test measures');
  });

  await test('the guide\'s table is the saved report, row for row', () => {
    const report = JSON.parse(read(REPORT));
    const lines = guideSection().split('\n');
    const i = lines.findIndex((l) => l.startsWith('| Placement'));
    assert.ok(i !== -1, 'the results table is missing');
    const rows = [];
    for (let j = i + 2; j < lines.length && lines[j].startsWith('|'); j++) {
      rows.push(lines[j].split('|').slice(1, -1).map((c) => c.trim().replace(/\*\*/g, '').replace(/`/g, '')));
    }
    assert.deepStrictEqual(rows.map((r) => r[0]), ['plain', 'prose field (through v8.74)', ...VARIANTS.map((v) => v.id)]);
    const plain = rows[0].slice(1);
    assert.deepStrictEqual(plain, [...CORPORA.map((c) => `${report.plain[c].hits} / ${report.plain[c].tasks}`), `${CORPORA.reduce((n, c) => n + report.plain[c].hits, 0)} / ${CORPORA.reduce((n, c) => n + report.plain[c].tasks, 0)}`]);
    for (const row of rows.slice(1)) {
      const g = row[0].startsWith('prose') ? report.shipped : report.grid[row[0]];
      let won = 0;
      let lost = 0;
      CORPORA.forEach((c, k) => {
        assert.strictEqual(row[k + 1], cell(g.corpora[c].won, g.corpora[c].lost), `${row[0]} on ${c}`);
        won += g.corpora[c].won;
        lost += g.corpora[c].lost;
      });
      assert.strictEqual(row[7], cell(won, lost), `${row[0]} over every corpus`);
    }
  });

  await test('the guide names the variant that ships, the one the rule chose, and what each fold chose on one half', () => {
    const report = JSON.parse(read(REPORT));
    const text = guideSection();
    assert.ok(text.includes(`\`${ADOPTED}\``), 'the guide does not name the variant that ships');
    assert.ok(report.verdict.choice === null || text.includes(`\`${report.verdict.choice}\``), 'the guide does not name the variant the rule chose');
    for (const cv of report.crossValidation) {
      const want = cv.chosen === null ? 'no variant' : `\`${cv.chosen}\``;
      assert.ok(text.includes(want), `the guide does not name fold ${cv.tuneFold}'s choice (${want})`);
    }
    assert.match(text, /neither half of xrepo \(by repository\) or of `mined` \(by task\) net-negative/);
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
