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
const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

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
    // body words are on by default, so what is left of the third-party corpus's no-token class holds no distinctive word:
    // some tasks hold none of the question's words anywhere, the others only common ones
    const x = match(/the class is \*\*(\d+)\*\* now: (\w+) tasks? holds? none of the question's words anywhere and (\w+) hold only common ones/, 'what is left of the xrepo no-token class');
    assert.strictEqual(Number(x[1]), X.misses[NT]);
    assert.deepStrictEqual({ distinctive: X.noTokenWords.distinctive, inIndex: X.noTokenWords.inIndex }, { distinctive: 0, inIndex: 0 }, 'no xrepo no-token miss holds a distinctive word');
    assert.deepStrictEqual([x[2], x[3]], [WORDS[X.noTokenWords.nowhere], WORDS[X.noTokenWords.commonOnly]], 'the words spell the counts of the baseline');
    assert.strictEqual(X.noTokenWords.nowhere + X.noTokenWords.commonOnly, X.misses[NT], 'every no-token miss is one of the two');
    const j = match(/reads \*\*(\d+) \/ (\d+) \/ (\d+)\*\*: (\w+) holds? a distinctive word, (\w+) only common ones[^.]*, (\w+) nothing/, 'the JVM split of the no-token misses');
    const triple = [1, 2, 3].map((i) => Number(j[i]));
    assert.deepStrictEqual(triple, [J.noTokenWords.distinctive, J.noTokenWords.commonOnly, J.noTokenWords.nowhere]);
    assert.deepStrictEqual([j[4], j[5], j[6]], triple.map((n) => WORDS[n]), 'the words spell the numbers');
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
    const penalty = J.misses['demoted by a path penalty'];
    assert.match(section, new RegExp(`What is left is ${ranked + penalty} ranking misses \\(${ranked} ranked below the top 5, ${WORDS[penalty]} demoted by a path penalty\\)`));
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

  await test('who finds what, and the tasks grep finds, are the autopsy\'s', () => {
    const c = au.againstScanWithoutSigmapFiles;
    const rows = table('| | tasks | both find it');
    assert.deepStrictEqual(rows[0], ['every task', String(au.tasks), ...[c.allTasks.both, c.allTasks.sigmapOnly, c.allTasks.grepOnly, c.allTasks.neither].map(String)]);
    assert.deepStrictEqual(rows[1], ['hard split', String(hb.summary.splits.hard.tasks), ...[c.hardSplit.both, c.hardSplit.sigmapOnly, c.hardSplit.grepOnly, c.hardSplit.neither].map(String)]);
    assert.strictEqual(au.grepOnlyTasks.length, c.allTasks.grepOnly);
    assert.match(section, new RegExp(`The ${WORDS[au.grepOnlyTasks.length]} tasks grep finds and SigMap does not`));
    for (const t of au.grepOnlyTasks) {
      const name = t.task.split('/')[1];
      assert.match(section, new RegExp(`\`${name}\`[^.]*grep ranks ${ordinal(t.grepRank)}|grep ranks ${ordinal(t.grepRank)}[^.]*\`${name}\``), `${name}: the section names the task and where grep ranks it`);
    }
    const m = au.sigmapMisses;
    const ranked = m['ranked 6-10'] + (m['ranked 11-20'] || 0) + (m['ranked 21-50'] || 0) + (m['ranked beyond 50'] || 0);
    const t = match(/are \*\*(\d+)\*\* that share no word with their index entry and \*\*(\d+)\*\* ranked misses, \*\*(\d+)\*\* of them ranked/, 'the honest corpus\'s misses');
    assert.deepStrictEqual(t.slice(1).map(Number), [m[NT], ranked, m['ranked 6-10']]);
    assert.strictEqual(m[NT] + ranked, au.tasks - au.sigmapHits);
    assert.match(section, new RegExp(`SigMap's ${au.tasks - au.sigmapHits} misses on this corpus`));
  });

  await test('the signals table is the saved arms report', () => {
    const cs = ['xrepo', 'hard', 'mined', 'easy', 'jvm', 'honest'];
    assert.deepStrictEqual(Object.keys(sa.corpora), cs);
    const cell = (a, plain) => (!a ? '—' : a === plain ? `${a.hits} / ${a.tasks}` : `${signed(a.gained.length - a.lost.length)} (${a.gained.length} / ${a.lost.length})`);
    const labels = { plain: 'plain (as shipped)', centrality: 'centrality blend', surface: 'surface enrichment', mined: 'mined expansions', callgraph: 'call-graph boost', body: 'body words (flag off)', nograph: 'no import graph (as `ask`)' };
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
    const negative = (arm) => Object.values(sa.corpora).filter((c) => c[arm] && c[arm].gained.length < c[arm].lost.length).length;
    const cen = match(/moved the rank of (\d+) of (\d+) tasks and changed no hit/, 'centrality');
    assert.deepStrictEqual([Number(cen[1]), Number(cen[2])], [T.centrality.moved, T.centrality.tasks]);
    assert.deepStrictEqual([T.centrality.gained, T.centrality.lost], [0, 0]);
    assert.deepStrictEqual([T.surface.gained, T.surface.lost], [0, 0], 'surface enrichment changed no hit');
    assert.match(section, /It changed no hit/);
    const mined = match(/Mined expansions: stays opt-in\.\*\* Net -(\d+) \(won (\d+), lost (\d+)\), negative on (\w+) of the six corpora/, 'mined expansions');
    assert.deepStrictEqual([Number(mined[1]), Number(mined[2]), Number(mined[3])], [-net(T.mined), T.mined.gained, T.mined.lost]);
    assert.strictEqual(mined[4], WORDS[negative('mined')], `mined expansions are net-negative on ${negative('mined')} corpora`);
    const xm = sa.corpora.xrepo.mined;
    assert.ok(xm.gained.length - xm.lost.length < 5, 'mined expansions do not meet the default rule on the third-party corpus');
    const cg = match(/Call-graph boost: not decided here\*\*[\s\S]*?\. Net -(\d+) \(won (\d+), lost (\d+)\), negative on (\w+) of the six corpora/, 'call-graph boost');
    assert.deepStrictEqual([Number(cg[1]), Number(cg[2]), Number(cg[3])], [-net(T.callgraph), T.callgraph.gained, T.callgraph.lost]);
    assert.strictEqual(cg[4], WORDS[negative('callgraph')], `the call-graph boost is net-negative on ${negative('callgraph')} corpora`);
    const ng = match(/Removing it is net -(\d+) over the five corpora it applies to \(won (\d+), lost (\d+)\)/, 'no import graph');
    assert.deepStrictEqual([Number(ng[1]), Number(ng[2]), Number(ng[3])], [-net(T.nograph), T.nograph.gained, T.nograph.lost]);
    assert.strictEqual(T.nograph.tasks, Object.values(sa.corpora).filter((c) => c.nograph).reduce((n, c) => n + c.plain.tasks, 0), 'the arm applies to the five corpora that are scored with a graph');
  });

  await test('the rule a signal is held to puts each signal where the section says', () => {
    // default: wins >= 5 more than it loses on xrepo and loses net on no other corpus; deprecated: net not positive and at most two hits changed.
    // The `body` arm is the ablation (the flag off), so what the SIGNAL wins is what the arm loses.
    const n = (v) => (Array.isArray(v) ? v.length : v); // a corpus holds task lists, the total holds counts
    const effect = (arm, a) => (arm === 'body' ? { won: n(a.lost), lost: n(a.gained) } : { won: n(a.gained), lost: n(a.lost) });
    const verdict = (arm) => {
      const x = effect(arm, sa.corpora.xrepo[arm]);
      const others = Object.entries(sa.corpora).filter(([c]) => c !== 'xrepo' && sa.corpora[c][arm]).map(([, c]) => { const e = effect(arm, c[arm]); return e.won - e.lost; });
      const t = effect(arm, sa.total[arm]);
      if (x.won - x.lost >= 5 && others.every((n) => n >= 0)) return 'default';
      if (t.won - t.lost <= 0 && t.won + t.lost <= 2) return 'deprecated';
      return 'opt-in';
    };
    // Body words ship on. By the rule as written they are a default only while no other corpus is net-negative for them; on the tree this
    // report was recorded on `hard` reads -1 (the words win 3, lose 4), so the rule as written says opt-in. The section states that plainly and
    // leaves the call to the maintainer; this test holds the section to the measurement, and fails if either side moves without the other.
    const blockers = Object.entries(sa.corpora).filter(([c]) => c !== 'xrepo' && sa.corpora[c].body)
      .filter(([, c]) => effect('body', c.body).won - effect('body', c.body).lost < 0).map(([c]) => c);
    assert.deepStrictEqual(Object.fromEntries(['centrality', 'surface', 'mined', 'callgraph', 'body'].map((a) => [a, verdict(a)])), {
      centrality: 'deprecated', surface: 'deprecated', mined: 'opt-in', callgraph: 'opt-in', body: blockers.length ? 'opt-in' : 'default',
    });
    const shipped = require(path.join(ROOT, 'src/config/defaults')).DEFAULTS.retrieval.bodyWords;
    assert.strictEqual(shipped, true, 'body words ship on');
    if (blockers.length) {
      assert.deepStrictEqual(blockers, ['hard'], 'the only corpus the words cost is the self-scored one');
      assert.match(section, /by the rule as written they would not be a default/);
      assert.match(section, /Body words: the default, by one task of `hard` short of the rule/);
    } else {
      assert.match(section, /Body words: the default\./);
    }
    assert.match(section, /Centrality blend: deprecated/);
    assert.match(section, /Surface enrichment: deprecated/);
    assert.match(section, /Mined expansions: stays opt-in/);
    assert.match(section, /at least five more tasks than it loses/);
  });

  await test('the body-words results are the arms report\'s', () => {
    // the arm is the flag turned OFF: its hits are what the ranker reads without the words, and what it "gains" are tasks the words lose
    const x = sa.corpora.xrepo, h = sa.corpora.honest;
    const m = match(/switching it off takes (\d+) of (\d+) to \*\*(\d+)\*\* \((\d+\.\d)% → (\d+\.\d)%\): it wins \*\*(\d+)\*\* tasks and loses \*\*(\d+)\*\*, and lifts MRR from (\d\.\d+) to (\d\.\d+)/, 'the xrepo result');
    assert.deepStrictEqual(m.slice(1), [
      String(x.plain.hits), String(x.plain.tasks), String(x.body.hits), pct(x.plain.hits, x.plain.tasks).replace('%', ''), pct(x.body.hits, x.body.tasks).replace('%', ''),
      String(x.body.lost.length), String(x.body.gained.length), x.body.mrr.toFixed(3), x.plain.mrr.toFixed(3),
    ]);
    // The report is recorded on the corpus as it stood (ids x001..x<plain.tasks>); if tasks were added after it, they are in the
    // baseline but not in the report, so "plain is the baseline" is held on the tasks the report measured.
    assert.ok(x.plain.tasks <= xb.overall.tasks, 'the report cannot have measured more tasks than the baseline holds');
    const measuredHits = Object.values(xb.repos).flatMap((r) => Object.entries(r.ranks))
      .filter(([id, rank]) => Number(id.slice(1)) <= x.plain.tasks && rank !== null).length;
    assert.strictEqual(x.plain.hits, measuredHits, 'plain on xrepo is the baseline, on the tasks the report measured');
    assert.ok(x.plain.mrr > x.body.mrr, 'the words lift MRR: it is not a hit@5-only effect');
    const hm = match(/honest corpus \*\*(\d+) → (\d+)\*\* of (\d+) \((\d+\.\d)% → \*\*(\d+\.\d)%\*\*\) without losing a task/, 'the honest result');
    assert.deepStrictEqual(hm.slice(1), [String(h.body.hits), String(h.plain.hits), String(h.plain.tasks), pct(h.body.hits, h.body.tasks).replace('%', ''), pct(h.plain.hits, h.plain.tasks).replace('%', '')]);
    assert.strictEqual(h.body.gained.length, 0, 'the words lose no honest task');
    const effect = (c) => sa.corpora[c].body.lost.length - sa.corpora[c].body.gained.length;
    assert.match(section, new RegExp(`\`mined\` \\+${effect('mined')}, \`jvm\` \\+${effect('jvm')}, \`easy\` \\+${effect('easy')}`));
    // `hard` is the one corpus the words cost, by one task; the section names it, its win/lose counts and the tasks they lose
    const hb2 = sa.corpora.hard.body;
    assert.strictEqual(effect('hard'), -1, 'the words cost `hard` one task on this recording');
    assert.match(section, new RegExp(`the words win ${hb2.lost.length} of its tasks and lose ${hb2.gained.length}`));
    for (const id of hb2.gained) assert.ok(section.includes(id.split('/')[1]), `${id}: the section names a task the words lose`);
    const worse = Object.entries(sa.corpora).filter(([, c]) => c.body.lost.length < c.body.gained.length).map(([n]) => n);
    assert.deepStrictEqual(worse, ['hard'], 'no corpus but hard is worse off with the words');
    assert.match(section, /no corpus but `hard` is worse off with them/);
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
    const as = match(/As shipped it reads \*\*(\d+\.\d)%\*\* \((\d+) of (\d+)\)/, 'the honest corpus as shipped');
    assert.deepStrictEqual([as[1], Number(as[2]), Number(as[3])], [pct(h.plain.hits, h.plain.tasks).replace('%', ''), h.plain.hits, h.plain.tasks]);
    assert.ok(h.plain.hits / h.plain.tasks >= 0.9, 'as shipped it clears 90%');
    const before = match(/with the words switched off it reads (\d+\.\d)% \((\d+) of (\d+)\), (\w+) tasks? short of 90%/, 'the honest corpus without the words');
    assert.deepStrictEqual([before[1], Number(before[2]), Number(before[3])], [pct(h.body.hits, h.body.tasks).replace('%', ''), h.body.hits, h.body.tasks]);
    const short = Math.ceil(0.9 * h.body.tasks) - h.body.hits;
    assert.ok(short > 0, 'without the words the honest corpus falls short of 90%');
    assert.strictEqual(before[4], WORDS[short], `${short} more tasks would have cleared 90%`);
    const margin = h.plain.hits - Math.ceil(0.9 * h.plain.tasks);
    assert.match(section, new RegExp(`clears 90% by ${WORDS[margin]} tasks`));
    assert.match(section, new RegExp(`${pct(sa.corpora.xrepo.plain.hits, sa.corpora.xrepo.plain.tasks)} as shipped, ${pct(sa.corpora.xrepo.body.hits, sa.corpora.xrepo.body.tasks)} without the words`));
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
