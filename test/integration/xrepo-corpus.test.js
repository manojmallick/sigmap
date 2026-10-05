'use strict';

// xrepo corpus invariants: manifest pins, labelled tasks, baseline and CI wiring (#892).

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const manifest = JSON.parse(read('benchmarks/xrepo-repos.json'));
const tasks = read('benchmarks/tasks/retrieval-xrepo.jsonl').split('\n').filter(Boolean).map((l, i) => Object.assign(JSON.parse(l), { _line: i + 1 }));
const { LANGUAGES } = require(path.join(ROOT, 'src/extractors/dispatch'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}

const names = new Set(manifest.repos.map((r) => r.name));
const byRepo = (n) => tasks.filter((t) => t.repo === n);

(async () => {
  const { staticProblems } = await import('../../scripts/lib/xrepo-hygiene.mjs');
  const { totals } = await import('../../scripts/lib/xrepo-gate.mjs');

  // ── the manifest ──────────────────────────────────────────────────────────

  await test('at least 10 third-party repos, each pinned to an exact commit', () => {
    assert.ok(manifest.repos.length >= 10, `only ${manifest.repos.length} repos`);
    assert.strictEqual(names.size, manifest.repos.length, 'repo names must be unique');
    for (const r of manifest.repos) {
      assert.match(r.commit, /^[0-9a-f]{40}$/, `${r.name}: commit must be a full 40-hex SHA, not a branch or tag`);
      assert.match(r.url, /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/, `${r.name}: url`);
      assert.ok(LANGUAGES.includes(r.language), `${r.name}: ${r.language} is not an extractor language`);
      assert.ok(r.layout && r.layout.length > 2, `${r.name}: layout tag`);
      if (r.sparse) assert.ok(Array.isArray(r.sparse) && r.sparse.length && r.sparse.every((p) => typeof p === 'string'), `${r.name}: sparse`);
      if (r.srcDirs) assert.ok(r.srcDirsWhy && r.srcDirsWhy.length > 20, `${r.name}: srcDirs is a recorded detection gap and needs a srcDirsWhy`);
    }
  });

  await test('pins agree with run-benchmark.mjs for every repo both name', () => {
    const src = read('scripts/run-benchmark.mjs');
    const pins = new Map();
    for (const block of src.split(/\n {2}\{\n/).slice(1)) {
      const n = /name:\s*'([^']+)'/.exec(block);
      const c = /commit:\s*'([0-9a-f]{40})'/.exec(block);
      if (n && c) pins.set(n[1], c[1]);
    }
    const shared = manifest.repos.filter((r) => pins.has(r.name));
    assert.ok(shared.length >= 6, `expected several shared repos, found ${shared.length}`);
    for (const r of shared) assert.strictEqual(r.commit, pins.get(r.name), `${r.name}: the manifest and run-benchmark.mjs pin different commits`);
  });

  await test('the four languages #701 reported each have a pinned repo', () => {
    for (const l of ['elixir', 'astro', 'lua', 'gdscript']) {
      assert.ok(manifest.repos.some((r) => r.language === l), `no manifest repo for ${l}`);
    }
  });

  // ── the labelled corpus ───────────────────────────────────────────────────

  await test('every manifest repo is a row of its own, with enough tasks to mean something', () => {
    assert.ok(new Set(tasks.map((t) => t.repo)).size >= 10, 'tasks must span at least 10 repos');
    for (const t of tasks) assert.ok(names.has(t.repo), `${t.id}: task for a repo that is not in the manifest (${t.repo})`);
    for (const r of manifest.repos) assert.ok(byRepo(r.name).length >= 4, `${r.name} has ${byRepo(r.name).length} tasks`);
  });

  await test('ids are unique and sequential', () => {
    tasks.forEach((t, i) => assert.strictEqual(t.id, 'x' + String(i + 1).padStart(3, '0'), `line ${t._line}`));
  });

  await test('every task passes the static hygiene checks: shape, rationale, leak-free, answer-eligible', () => {
    const bad = tasks.flatMap((t) => staticProblems(t, names).map((p) => `${p.id} [${p.kind}] ${p.detail}`));
    assert.deepStrictEqual(bad, [], `\n  ${bad.join('\n  ')}`);
  });

  await test('every task is a hard-split, hand-labelled task', () => {
    for (const t of tasks) {
      assert.strictEqual(t.split, 'hard', `${t.id}: split`);
      assert.strictEqual(t.source, 'labelled', `${t.id}: source`);
    }
  });

  await test('no two tasks share a query or an expected-file set', () => {
    const q = new Map();
    const e = new Map();
    for (const t of tasks) {
      const qk = t.query.toLowerCase();
      const ek = `${t.repo}:${[...t.expected_files].sort().join('|')}`;
      assert.ok(!q.has(qk), `${t.id} repeats the query of ${q.get(qk)}`);
      assert.ok(!e.has(ek), `${t.id} has the same expected files as ${e.get(ek)}`);
      q.set(qk, t.id);
      e.set(ek, t.id);
    }
  });

  await test('the gin routing question from #805/#808 is in the corpus, verbatim, and says why gin.go is absent', () => {
    const t = tasks.find((x) => x.query === 'How does gin route requests through its middleware chain?');
    assert.ok(t, 'the audit question is missing');
    assert.strictEqual(t.repo, 'gin');
    assert.deepStrictEqual([...t.expected_files].sort(), ['context.go', 'routergroup.go', 'tree.go']);
    assert.match(t.origin, /#805\/#808/);
    assert.match(t.rationale, /gin\.go is omitted from expected_files on purpose/);
  });

  await test('the four unmeasured languages are answered by files of their own kind', () => {
    const ext = { elixir: /\.ex$/, lua: /\.lua$/, gdscript: /\.gd$/ };
    for (const [lang, re] of Object.entries(ext)) {
      const repo = manifest.repos.find((r) => r.language === lang).name;
      for (const t of byRepo(repo)) for (const f of t.expected_files) assert.match(f, re, `${t.id}: ${f} is not a ${lang} file`);
    }
    const astro = byRepo(manifest.repos.find((r) => r.language === 'astro').name);
    assert.ok(astro.filter((t) => t.expected_files.some((f) => f.endsWith('.astro'))).length >= 3,
      'at least 3 astro tasks must be answered by an .astro component, or the Astro extractor is barely measured');
  });

  // ── the baseline ──────────────────────────────────────────────────────────

  await test('the committed baseline covers exactly the corpus, task for task', () => {
    const b = JSON.parse(read('benchmarks/xrepo-baseline.json'));
    assert.deepStrictEqual(Object.keys(b.repos).sort(), [...new Set(tasks.map((t) => t.repo))].sort());
    for (const [name, r] of Object.entries(b.repos)) {
      assert.strictEqual(r.tasks, byRepo(name).length, `${name}: baseline records ${r.tasks} tasks, the corpus has ${byRepo(name).length}`);
      assert.deepStrictEqual(Object.keys(r.ranks).sort(), byRepo(name).map((t) => t.id).sort(), `${name}: rank ids`);
      assert.ok(r.hits >= 0 && r.hits <= r.tasks, `${name}: hits ${r.hits}`);
      assert.strictEqual(Object.values(r.ranks).filter((x) => x !== null).length, r.hits, `${name}: hits must equal the number of ranked tasks`);
      for (const rank of Object.values(r.ranks)) assert.ok(rank === null || (rank >= 1 && rank <= 5), `${name}: rank ${rank}`);
    }
    const t = totals(Object.values(b.repos));
    assert.strictEqual(b.overall.tasks, t.tasks);
    assert.strictEqual(b.overall.hits, t.hits);
  });

  await test('the floor leaves headroom under the recorded baseline, so a recording can never start red', () => {
    const b = JSON.parse(read('benchmarks/xrepo-baseline.json'));
    const m = /const MIN_XREPO = ([0-9.]+);/.exec(read('scripts/run-xrepo-gate.mjs'));
    assert.ok(m, 'MIN_XREPO must be a plain constant');
    const minHits = Math.ceil(parseFloat(m[1]) * b.overall.tasks - 1e-9);
    assert.ok(b.overall.hits - minHits >= 2, `baseline ${b.overall.hits}/${b.overall.tasks} leaves ${b.overall.hits - minHits} task(s) above a ${m[1]} floor`);
    assert.ok(parseFloat(m[1]) >= 0.3, 'a floor below 30% guards nothing');
  });

  // ── wiring ────────────────────────────────────────────────────────────────

  await test('npm exposes the fetch, the report and the gate', () => {
    const s = JSON.parse(read('package.json')).scripts;
    assert.match(s['fetch:xrepo'], /fetch-xrepo-repos\.mjs/);
    assert.match(s['benchmark:xrepo'], /run-xrepo-gate\.mjs/);
    assert.match(s['validate:xrepo'], /run-xrepo-gate\.mjs --gate --no-regress/);
  });

  await test('CI fetches the pinned repos and runs the gate with --require-repos', () => {
    const ci = read('.github/workflows/ci.yml');
    assert.match(ci, /^ {2}xrepo:/m, 'ci.yml needs an xrepo job');
    assert.match(ci, /hashFiles\('benchmarks\/xrepo-repos\.json'\)/, 'the cache must be keyed on the manifest');
    assert.match(ci, /node scripts\/fetch-xrepo-repos\.mjs/);
    assert.match(ci, /npm run validate:xrepo -- --require-repos/);
  });

  await test('the pinned repos stay out of the repository and out of the published package', () => {
    assert.match(read('.gitignore'), /^benchmarks\/repos\/$/m);
    const files = JSON.parse(read('package.json')).files || [];
    for (const f of files) assert.ok(!/^(benchmarks|scripts|test)\b/.test(f), `package.json "files" ships ${f}`);
  });

  await test('the benchmark guide explains the corpus, how to read it, and how to re-pin', () => {
    const doc = read('docs-vp/guide/retrieval-benchmark.md');
    assert.match(doc, /xrepo/);
    assert.match(doc, /band, not a point/);
    assert.match(doc, /fetch:xrepo|fetch-xrepo-repos/);
  });

  // ── the guide's numbers ARE the baseline (#900) ───────────────────────────
  // The results table, the interval and the headroom were typed by hand, and the
  // only guard on the page was three loose regexes — so the page could say 40/83
  // while the baseline said 42/83 and nothing failed. These pin every figure to
  // the committed baseline, row for row.

  const guide = () => read('docs-vp/guide/retrieval-benchmark.md');
  const baseline = () => JSON.parse(read('benchmarks/xrepo-baseline.json'));

  /** The `Reading it` table as {language|layout -> cells}. */
  function readingTable() {
    const lines = guide().split('\n');
    const start = lines.findIndex((l) => /^\| Repo \| Language \| Layout \| Indexed \|/.test(l));
    assert.ok(start !== -1, 'the results table is missing from the guide');
    const rows = new Map();
    let overall = null;
    for (const l of lines.slice(start + 2)) {
      if (!l.startsWith('|')) break;
      const c = l.split('|').slice(1, -1).map((s) => s.trim());
      if (c[0] === '**Overall**') overall = c;
      else rows.set(`${c[1]}|${c[2]}`, c);
    }
    return { rows, overall };
  }

  await test('every row of the guide\'s results table matches the baseline', () => {
    const { rows } = readingTable();
    const b = baseline();
    assert.strictEqual(rows.size, manifest.repos.length, `the table has ${rows.size} rows, the manifest ${manifest.repos.length} repos`);
    for (const r of manifest.repos) {
      const c = rows.get(`${r.language}|${r.layout}`);
      assert.ok(c, `${r.name}: no row for ${r.language}|${r.layout} in the guide`);
      const e = b.repos[r.name];
      const pct = (e.hits / e.tasks * 100).toFixed(1) + '%';
      const unreachable = (e.unreachable || []).length;
      assert.deepStrictEqual(
        { indexed: c[3], tasks: c[4], hits: c[5], hit5: c[6], unreachable: c[7] },
        { indexed: r.srcDirs ? '`srcDirs`' : 'zero-config', tasks: String(e.tasks), hits: String(e.hits), hit5: pct, unreachable: unreachable ? String(unreachable) : '—' },
        `${r.name}: the guide's row disagrees with the baseline`,
      );
    }
  });

  await test('the guide\'s overall row, interval and headroom are the baseline\'s', async () => {
    const { overall } = readingTable();
    const b = baseline();
    const t = totals(Object.values(b.repos));
    const unreachable = Object.values(b.repos).reduce((n, e) => n + (e.unreachable || []).length, 0);
    assert.deepStrictEqual(overall.slice(4), [`**${t.tasks}**`, `**${t.hits}**`, `**${(t.hitAt5 * 100).toFixed(1)}%**`, `**${unreachable}**`]);

    const { wilson } = await import('../../scripts/lib/band.mjs');
    const w = wilson(t.hits, t.tasks);
    assert.ok(guide().includes(`**${(w.low * 100).toFixed(1)}–${(w.high * 100).toFixed(1)}%**`),
      `the guide's 95% interval is not ${(w.low * 100).toFixed(1)}–${(w.high * 100).toFixed(1)}%`);

    const floor = 0.40;
    const headroom = t.hits - Math.ceil(floor * t.tasks - 1e-9);
    const words = { six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
    const m = /\(40%, (\w+) tasks of headroom/.exec(guide());
    assert.ok(m && words[m[1]] === headroom, `the guide says "${m && m[1]}" tasks of headroom; the baseline leaves ${headroom}`);
  });

  await test('the guide\'s --why table accounts for every miss behind the headline', () => {
    const b = baseline();
    const t = totals(Object.values(b.repos));
    const doc = guide();
    const at = doc.indexOf('| Why the task misses |');
    assert.ok(at !== -1, 'the --why table is missing from the guide');
    const rows = doc.slice(at).split('\n').slice(2).filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith('|')));
    const counts = rows.map((l) => Number(l.split('|')[2].trim()));
    assert.strictEqual(rows.length, 7, 'seven classes');
    assert.strictEqual(counts.reduce((n, x) => n + x, 0), t.tasks - t.hits,
      `the --why rows sum to ${counts.reduce((n, x) => n + x, 0)}, but the baseline has ${t.tasks - t.hits} misses`);
    // The unindexed row is not a free number: it is the baseline's own unreachable list.
    assert.strictEqual(counts[0], Object.values(b.repos).reduce((n, e) => n + (e.unreachable || []).length, 0));
    assert.ok(doc.includes(`behind the ${t.hits}/${t.tasks} above`), 'the --why table names the headline it explains');
  });

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
