'use strict';

// The benchmark guide's "Where the misses come from": every figure in it is a saved report's, and its claims are the grid's.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

let passed = 0;
let failed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}

const guide = read('docs-vp/guide/retrieval-benchmark.md');
const start = guide.indexOf('## Where the misses come from');
const end = guide.indexOf('\n## ', start + 5);
// Typographic dashes are read as the ASCII ones, so a figure is compared as a figure.
const section = guide.slice(start, end).replace(/\u2212/g, '-').replace(/\u2013/g, '-');

/** The rows of the markdown table whose header starts with `header`, as cells with bold removed. */
function table(header) {
  const lines = section.split('\n');
  const i = lines.findIndex((l) => l.startsWith(header));
  assert.ok(i !== -1, `the table that starts "${header}" is missing from the section`);
  const rows = [];
  for (let j = i + 2; j < lines.length && lines[j].startsWith('|'); j++) rows.push(lines[j].split('|').slice(1, -1).map((c) => c.trim().replace(/\*\*/g, '')));
  return rows;
}
const match = (re, what) => { const m = re.exec(section); assert.ok(m, `the section no longer says: ${what}`); return m; };
const pct = (n, d) => ((100 * n) / d).toFixed(1) + '%';
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;

(async () => {
  const xb = json('benchmarks/xrepo-baseline.json');
  const rb = json('benchmarks/retrieval-baseline.json');
  const au = json('benchmarks/reports/honest-autopsy.json');
  const hb = json('benchmarks/reports/honest-baseline.json');
  const sa = json('benchmarks/reports/signal-arms.json');
  const sw = json('benchmarks/reports/body-words-sweep.json');
  const X = xb.why;
  const J = rb.jvm.why;
  const NT = 'no token in common with the question';

  await test('the section exists and the config reference\'s links land on headings that exist', () => {
    assert.ok(start !== -1 && end !== -1);
    for (const h of ['### The opt-in ranking signals', '### Body words']) assert.ok(section.includes(`\n${h}\n`), `${h} is the target of a link in config.md`);
    const cfg = read('docs-vp/guide/config.md');
    assert.ok(cfg.includes('/guide/retrieval-benchmark#the-opt-in-ranking-signals') && cfg.includes('/guide/retrieval-benchmark#body-words'));
  });

  await test('the class table is the xrepo and jvm baselines\' account of their misses', () => {
    const rows = table('| Why the task misses');
    const by = Object.fromEntries(rows.map((r) => [r[0], r.slice(1)]));
    const classes = ['answer not indexed', 'demoted by a path penalty', NT, 'ranked 6-10', 'ranked 11-20', 'ranked 21-50', 'ranked beyond 50'];
    for (const c of classes) assert.deepStrictEqual(by[c], [String(X.misses[c]), String(J.misses[c])], c);
    assert.deepStrictEqual(by['hits / tasks'], [`${X.hits} / ${xb.overall.tasks}`, `${J.hits} / ${rb.jvm.tasks}`]);
    assert.deepStrictEqual(by['hit rate over the tasks a word can reach'], [
      `${pct(X.reachableHits, X.reachable)} (${X.reachableHits} / ${X.reachable})`,
      `${pct(J.reachableHits, J.reachable)} (${J.reachableHits} / ${J.reachable})`,
    ]);
    assert.strictEqual(rows.length, classes.length + 2, 'every class is in the table, and nothing else');
  });

  await test('the words behind the no-token misses are the baselines\'', () => {
    const x = match(/\*\*(\d+) of the (\d+)\*\* hold a \*distinctive\* word/, 'how many xrepo no-token misses hold a distinctive word');
    assert.deepStrictEqual([Number(x[1]), Number(x[2])], [X.noTokenWords.distinctive, X.misses[NT]]);
    assert.strictEqual(X.noTokenWords.commonOnly, 0, 'the section says the twelfth holds none: no common-only answers');
    assert.strictEqual(X.noTokenWords.nowhere, 1);
    const j = match(/\*\*(\d+) \/ (\d+) \/ (\d+)\*\*: six hold|reads \*\*(\d+) \/ (\d+) \/ (\d+)\*\*/, 'the JVM split of the no-token misses');
    const triple = j.slice(1).filter(Boolean).map(Number);
    assert.deepStrictEqual(triple, [J.noTokenWords.distinctive, J.noTokenWords.commonOnly, J.noTokenWords.nowhere]);
    assert.match(section, /six hold a distinctive word, twelve only common ones[^.]*, six nothing/, 'the words for 6 / 12 / 6');
    assert.deepStrictEqual([J.noTokenWords.distinctive, J.noTokenWords.commonOnly, J.noTokenWords.nowhere], [6, 12, 6]);
  });

  await test('the JVM figures are the jvm baseline\'s', () => {
    const m = match(/It reads \*\*(\d+\.\d)%\*\* \((\d+) of (\d+)\)/, 'the JVM headline');
    assert.deepStrictEqual([m[1], Number(m[2]), Number(m[3])], [(rb.jvm.hitAt5 * 100).toFixed(1), J.hits, rb.jvm.tasks]);
    const misses = match(/Of its (\d+) misses \*\*(\d+)\*\* share no token/, 'the JVM misses that share no token');
    assert.deepStrictEqual([Number(misses[1]), Number(misses[2])], [rb.jvm.tasks - J.hits, J.misses[NT]]);
    assert.strictEqual(Number(match(/\*\*(\d+)\*\* tasks name only a test file/, 'the test-only answers')[1]), J.answerIsTest);
    assert.strictEqual(match(/hit rate is \*\*(\d+\.\d)%\*\*/, 'the rate over reachable tasks')[1], (100 * J.reachableHits / J.reachable).toFixed(1));
    assert.match(section, new RegExp(`Over the ${J.reachable} tasks a word-matching ranker can reach`));
    const ranked = J.misses['ranked 6-10'] + J.misses['ranked 11-20'] + J.misses['ranked 21-50'] + J.misses['ranked beyond 50'];
    assert.match(section, new RegExp(`What is left is ${ranked + J.misses['demoted by a path penalty']} ranking misses \\(${ranked} ranked below the top 5, one demoted by a path penalty\\)`));
    assert.strictEqual(J.misses['demoted by a path penalty'], 1);
  });

  await test('the hard split and the grep scan are the saved honest reports\'', () => {
    const hard = hb.summary.splits.hard;
    const m = match(/SigMap \*\*(\d+\.\d)%\*\* \((\d+) of (\d+)\) against grep \*\*(\d+\.\d)%\*\* \((\d+) of (\d+)\)/, 'the hard split');
    assert.deepStrictEqual(m.slice(1).map(Number), [
      Number((hard.sigmap.hitAt5 * 100).toFixed(1)), Math.round(hard.sigmap.hitAt5 * hard.tasks), hard.tasks,
      Number((hard.grepBaseline.hitAt5 * 100).toFixed(1)), Math.round(hard.grepBaseline.hitAt5 * hard.tasks), hard.tasks,
    ]);
    const polluted = match(/\*\*(\d+) of the (\d+)\*\* top-5 places/, 'the places SigMap\'s own files took');
    assert.deepStrictEqual([Number(polluted[1]), Number(polluted[2])], [au.sigmapFilesInGrepTop5.polluted, au.sigmapFilesInGrepTop5.places]);
    const g = table('| grep scan');
    assert.deepStrictEqual(g[0], ['as published', `${pct(au.grepHits.published, au.tasks)} (${au.grepHits.published} / ${au.tasks})`, `${(au.sigmapHits / au.grepHits.published).toFixed(2)}×`]);
    assert.deepStrictEqual(g[1], ["SigMap's own files left out", `${pct(au.grepHits.withoutSigmapFiles, au.tasks)} (${au.grepHits.withoutSigmapFiles} / ${au.tasks})`, `${(au.sigmapHits / au.grepHits.withoutSigmapFiles).toFixed(2)}×`]);
    // the published report's own figures are the "as published" row: the autopsy is on the same basis as the headline it qualifies
    assert.strictEqual(au.grepHits.published, Math.round(hb.summary.grepBaseline.hitAt5 * hb.summary.tasks), 'recorded in the layout the published report uses');
    assert.strictEqual(au.sigmapHits, Math.round(hb.summary.sigmap.hitAt5 * hb.summary.tasks));
    assert.strictEqual(au.tasks, hb.summary.tasks);
  });

  await test('who finds what, and the three tasks grep finds, are the autopsy\'s', () => {
    const c = au.againstScanWithoutSigmapFiles;
    const rows = table('| | tasks | both find it');
    assert.deepStrictEqual(rows[0], ['every task', String(au.tasks), ...[c.allTasks.both, c.allTasks.sigmapOnly, c.allTasks.grepOnly, c.allTasks.neither].map(String)]);
    assert.deepStrictEqual(rows[1], ['hard split', String(hb.summary.splits.hard.tasks), ...[c.hardSplit.both, c.hardSplit.sigmapOnly, c.hardSplit.grepOnly, c.hardSplit.neither].map(String)]);
    const only = Object.fromEntries(au.grepOnlyTasks.map((t) => [t.task.split('/')[1], t]));
    assert.strictEqual(au.grepOnlyTasks.length, c.allTasks.grepOnly);
    assert.match(section, new RegExp(`\`express-h003\`, which grep ranks ${ordinal(only['express-h003'].grepRank)}`));
    assert.match(section, new RegExp(`that grep ranks ${ordinal(only['fastapi-t004'].grepRank)} and ${ordinal(only['svelte-t002'].grepRank)} \\(\`fastapi-t004\`, \`svelte-t002\``));
    assert.strictEqual(only['express-h003'].sigmap, NT);
    assert.strictEqual(only['fastapi-t004'].sigmap, 'ranked 6-10');
    assert.strictEqual(only['svelte-t002'].sigmap, 'ranked 6-10');
    const m = au.sigmapMisses;
    const ranked = m['ranked 6-10'] + (m['ranked 11-20'] || 0) + (m['ranked 21-50'] || 0) + (m['ranked beyond 50'] || 0);
    const t = match(/are \*\*(\d+)\*\* that share no word with their index entry and \*\*(\d+)\*\* ranked misses, \*\*(\d+)\*\* of them ranked/, 'the honest corpus\'s misses');
    assert.deepStrictEqual(t.slice(1).map(Number), [m[NT], ranked, m['ranked 6-10']]);
    assert.strictEqual(m[NT] + ranked, au.tasks - au.sigmapHits);
  });

  await test('the signals table is the saved arms report', () => {
    const cs = ['xrepo', 'hard', 'mined', 'easy', 'jvm', 'honest'];
    assert.deepStrictEqual(Object.keys(sa.corpora), cs);
    const cell = (a, plain) => (!a ? '—' : a === plain ? `${a.hits} / ${a.tasks}` : `${signed(a.gained.length - a.lost.length)} (${a.gained.length} / ${a.lost.length})`);
    const labels = { plain: 'plain (as shipped)', centrality: 'centrality blend', surface: 'surface enrichment', mined: 'mined expansions', callgraph: 'call-graph boost', body: 'body words', nograph: 'no import graph (as `ask`)' };
    const rows = table('| signal');
    assert.deepStrictEqual(rows.map((r) => r[0]), Object.values(labels));
    for (const [i, arm] of Object.keys(labels).entries()) {
      const t = sa.total[arm];
      const all = arm === 'plain' ? `${t.hits} / ${t.tasks}` : `${signed(t.gained - t.lost)} (${t.gained} / ${t.lost})`;
      assert.deepStrictEqual(rows[i].slice(1), [...cs.map((c) => cell(sa.corpora[c][arm], sa.corpora[c].plain)), all], `the row for ${arm}`);
    }
  });

  await test('what the section says of each signal is what the table says', () => {
    const net = (a) => a.gained - a.lost;
    const T = sa.total;
    const cen = match(/moved the rank of (\d+) of (\d+) tasks and changed one hit, a loss/, 'centrality');
    assert.deepStrictEqual([Number(cen[1]), Number(cen[2])], [T.centrality.moved, T.centrality.tasks]);
    assert.deepStrictEqual([T.centrality.gained, T.centrality.lost], [0, 1]);
    assert.deepStrictEqual([T.surface.gained, T.surface.lost], [1, 1], 'surface enrichment changed two hits, one each way');
    assert.match(section, /It changed two hits, one each way/);
    const mined = match(/\+(\d+) on the third-party corpus \(won (\d+), lost (\d+)\) and \+(\d+) on the honest corpus/, 'mined expansions');
    const xm = sa.corpora.xrepo.mined, hm = sa.corpora.honest.mined;
    assert.deepStrictEqual(mined.slice(1).map(Number), [xm.gained.length - xm.lost.length, xm.gained.length, xm.lost.length, hm.gained.length - hm.lost.length]);
    // a sign test over the tasks mined expansions changed on xrepo: P(at least `won` of won+lost)
    const n = xm.gained.length + xm.lost.length;
    let p = 0;
    for (let k = xm.gained.length; k <= n; k++) { let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); p += c / 2 ** n; }
    assert.match(section, new RegExp(`five tasks changed on \`xrepo\`[^(]*\\(p ≈ ${p.toFixed(2)}\\)`), `a sign test of ${xm.gained.length} to ${xm.lost.length} is p ≈ ${p.toFixed(2)}`);
    assert.strictEqual(n, 5);
    const cg = match(/Net -(\d+) \(won (\d+), lost (\d+)\), negative on (\w+) of the six corpora/, 'call-graph boost');
    assert.deepStrictEqual([Number(cg[1]), Number(cg[2]), Number(cg[3])], [-net(T.callgraph), T.callgraph.gained, T.callgraph.lost]);
    const negative = Object.values(sa.corpora).filter((c) => c.callgraph && c.callgraph.gained.length < c.callgraph.lost.length).length;
    assert.strictEqual(cg[4], ({ 3: 'three' })[negative], `the call-graph boost is net-negative on ${negative} corpora`);
    const ng = match(/Removing it is net -(\d+) over the five corpora it applies to \(won (\d+), lost (\d+)\)/, 'no import graph');
    assert.deepStrictEqual([Number(ng[1]), Number(ng[2]), Number(ng[3])], [-net(T.nograph), T.nograph.gained, T.nograph.lost]);
    assert.strictEqual(T.nograph.tasks, 314);
  });

  await test('the rule a signal is held to puts each signal where the section says', () => {
    // default: wins >= 5 more than it loses on xrepo and loses net on no other corpus; deprecated: net not positive and at most two hits changed
    const verdict = (arm) => {
      const x = sa.corpora.xrepo[arm];
      const others = Object.entries(sa.corpora).filter(([c]) => c !== 'xrepo' && sa.corpora[c][arm]).map(([, c]) => c[arm].gained.length - c[arm].lost.length);
      const t = sa.total[arm];
      if (x.gained.length - x.lost.length >= 5 && others.every((n) => n >= 0)) return 'default';
      if (t.gained - t.lost <= 0 && t.gained + t.lost <= 2) return 'deprecated';
      return 'opt-in';
    };
    assert.deepStrictEqual(Object.fromEntries(['centrality', 'surface', 'mined', 'callgraph', 'body'].map((a) => [a, verdict(a)])), {
      centrality: 'deprecated', surface: 'deprecated', mined: 'opt-in', callgraph: 'opt-in', body: 'default',
    });
    assert.match(section, /Centrality blend: deprecated/);
    assert.match(section, /Surface enrichment: deprecated/);
    assert.match(section, /Mined expansions: stays opt-in/);
    assert.match(section, /at least five more tasks than it loses/);
  });

  await test('the body-words results are the arms report\'s', () => {
    const x = sa.corpora.xrepo, h = sa.corpora.honest;
    const m = match(/42 of 83 to \*\*(\d+)\*\* \((\d+\.\d)% → (\d+\.\d)%\), winning \*\*(\d+)\*\* tasks and losing \*\*(\d+)\*\*, and lifts MRR from (\d\.\d+) to (\d\.\d+)/, 'the xrepo result');
    assert.deepStrictEqual(m.slice(1), [String(x.body.hits), pct(x.plain.hits, x.plain.tasks).replace('%', ''), pct(x.body.hits, x.body.tasks).replace('%', ''), String(x.body.gained.length), String(x.body.lost.length), x.plain.mrr.toFixed(3), x.body.mrr.toFixed(3)]);
    assert.strictEqual(x.plain.hits, xb.overall.hits, 'plain on xrepo is the baseline');
    const hm = match(/honest corpus \*\*(\d+) → (\d+)\*\* of (\d+) \((\d+\.\d)% → \*\*(\d+\.\d)%\*\*\) without losing a task/, 'the honest result');
    assert.deepStrictEqual(hm.slice(1), [String(h.plain.hits), String(h.body.hits), String(h.plain.tasks), pct(h.plain.hits, h.plain.tasks).replace('%', ''), pct(h.body.hits, h.body.tasks).replace('%', '')]);
    assert.strictEqual(h.body.lost.length, 0);
    const nets = Object.fromEntries(['mined', 'jvm', 'hard'].map((c) => [c, sa.corpora[c].body.gained.length - sa.corpora[c].body.lost.length]));
    assert.match(section, new RegExp(`\`mined\` \\+${nets.mined}, \`jvm\` \\+${nets.jvm}, \`hard\` \\+${nets.hard}`));
    for (const c of Object.values(sa.corpora)) assert.ok(c.body.gained.length >= c.body.lost.length, 'no corpus loses net');
    assert.match(section, /No corpus loses net/);
  });

  await test('the sweep table, and what is said of it, are the recorded grid', () => {
    const cs = Object.keys(sw.plain);
    const total = (id) => cs.reduce((t, c) => ({ w: t.w + sw.grid[id][c].won, l: t.l + sw.grid[id][c].lost }), { w: 0, l: 0 });
    const rows = table('| share of files');
    assert.strictEqual(rows.length, sw.shares.length);
    sw.shares.forEach((s, i) => {
      assert.strictEqual(rows[i][0], `${Math.round(s * 100)}%`);
      sw.perFile.forEach((p, j) => {
        const t = total(`s${Math.round(s * 100)}-p${p}`);
        assert.strictEqual(rows[i][j + 1], `${signed(t.w - t.l)} (${t.w} / ${t.l})`, `${s} / ${p}`);
      });
    });
    // the shipped setting is the module's, and the grid's mark is on it
    const mod = require(path.join(ROOT, 'src/retrieval/body-words'));
    assert.deepStrictEqual(sw.shipped, { share: mod.DISTINCTIVE_SHARE, perFile: mod.PER_FILE });
    const shippedId = `s${Math.round(sw.shipped.share * 100)}-p${sw.shipped.perFile}`;
    const sh = total(shippedId);
    assert.ok(section.includes(`**${signed(sh.w - sh.l)} (${sh.w} / ${sh.l})**`), 'the shipped cell is the bold one');
    // "none is net-negative" and "+6 or better on xrepo at every setting"
    const cells = Object.entries(sw.grid).flatMap(([id, g]) => Object.entries(g).map(([c, m]) => ({ id, c, net: m.won - m.lost })));
    assert.strictEqual(cells.length, 90);
    assert.deepStrictEqual(cells.filter((x) => x.net < 0), [], 'no cell of the grid is net-negative');
    assert.match(section, /\(90 cells\) \*\*none\*\* is net-negative/);
    const minX = Math.min(...cells.filter((x) => x.c === 'xrepo').map((x) => x.net));
    assert.match(section, new RegExp(`the third-party corpus is \\+${minX} or better at every one`));
    // the plateau: shares of 5% and up, from the smallest word count up
    const plateau = Object.keys(sw.grid).filter((id) => Number(id.match(/^s(\d+)/)[1]) >= 5).map((id) => total(id));
    const nets = plateau.map((t) => t.w - t.l);
    assert.match(section, new RegExp(`\\*\\*\\+${Math.min(...nets)} to \\+${Math.max(...nets)}\\*\\* over ${cs.reduce((n, c) => n + sw.plain[c].tasks, 0)} tasks`));
    const s10p100 = total('s10-p100');
    assert.match(section, new RegExp(`\\(10% / 100 is \\+${s10p100.w - s10p100.l}\\)`));
    assert.strictEqual(Math.max(...nets), s10p100.w - s10p100.l, '10% / 100 is the peak');
    assert.strictEqual(sh.l, Math.min(...plateau.map((t) => t.l)), 'the shipped setting loses as few tasks as any setting on the plateau');
    assert.match(section, new RegExp(`it loses ${sh.l} tasks, as few as any setting in it`));
  });

  await test('the ninety-percent question is answered from the honest corpus\'s own numbers', () => {
    const h = sa.corpora.honest;
    const m = match(/It reads \*\*(\d+\.\d)%\*\* \((\d+) of (\d+)\): one task short/, 'the honest corpus as shipped');
    assert.deepStrictEqual([m[1], Number(m[2]), Number(m[3])], [pct(h.plain.hits, h.plain.tasks).replace('%', ''), h.plain.hits, h.plain.tasks]);
    assert.strictEqual(Math.ceil(0.9 * h.plain.tasks) - h.plain.hits, 1, 'one more task would clear 90%');
    const w = match(/reads \*\*(\d+\.\d)%\*\* \((\d+) of (\d+)\)\. That clears 90%/, 'the honest corpus with body words');
    assert.deepStrictEqual([w[1], Number(w[2])], [pct(h.body.hits, h.body.tasks).replace('%', ''), h.body.hits]);
    assert.ok(h.body.hits / h.body.tasks >= 0.9);
    const k = match(/each reach (\d+) of (\d+), \*\*(\d+\.\d)%\*\*/, 'what one extra task is');
    assert.strictEqual(h.mined.hits, Number(k[1]));
    assert.strictEqual(h.callgraph.hits, Number(k[1]));
    assert.strictEqual(k[3], pct(h.mined.hits, h.mined.tasks).replace('%', ''));
    assert.match(section, new RegExp(`${pct(sa.corpora.xrepo.plain.hits, sa.corpora.xrepo.plain.tasks)} as shipped, ${pct(sa.corpora.xrepo.body.hits, sa.corpora.xrepo.body.tasks)} with the words`));
  });

  await test('every command the section tells a reader to run exists', () => {
    const block = /```bash\n([\s\S]*?)```/.exec(section);
    assert.ok(block, 'the Run it block');
    const scripts = json('package.json').scripts;
    for (const line of block[1].split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean)) {
      const npm = /^npm run (\S+)/.exec(line);
      if (npm) assert.ok(scripts[npm[1]], `${npm[1]} is not an npm script`);
      const node = /^node (\S+)/.exec(line);
      if (node) assert.ok(fs.existsSync(path.join(ROOT, node[1])), `${node[1]} does not exist`);
    }
    // the autopsy is run directly because benchmark:honest saves, in whatever layout the clones sit in
    assert.ok(/--save/.test(scripts['benchmark:honest']), 'benchmark:honest saves, which is why the autopsy is not run through it');
    assert.ok(!/benchmark:honest -- --autopsy/.test(section), 'the section must not send a reader to save the honest report from an arbitrary layout');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
