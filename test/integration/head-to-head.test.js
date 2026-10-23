'use strict';

/**
 * Head-to-head harness (#972): SigMap against codebase-memory-mcp and code-review-graph on one scorer.
 *
 * What is pinned here is the method, not any number: one scorer for every system; ambiguities resolved in the
 * rival's favour and counted; an unsupported task is never a miss; Gate G1 as pre-registered; a rival is
 * downloaded only when its SHA-256 equals the pin and is never a dependency; exploratory numbers cannot be
 * written into the repository. The rivals themselves are stood in for by small scripts, so the suite needs
 * neither network nor their binaries.
 *
 * NOTE: the `test()` helper does not await, so every case is synchronous (an async case would pass vacuously).
 *
 * Run: node test/integration/head-to-head.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.stack).split('\n').slice(0, 3).join('\n        ')}`); fail++; }
}
const tmp = [];
const mk = (p) => { const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), p))); tmp.push(d); return d; };

(async () => {
  const H = await imp('scripts/lib/head-to-head.mjs');
  const A = await imp('scripts/lib/rivals/adapters.mjs');
  const F = await imp('scripts/lib/rivals/fetch.mjs');
  const R = await imp('scripts/lib/head-to-head-run.mjs');

  // ── one scorer ────────────────────────────────────────────────────────────
  test('hit@5 and MRR@10: the cutoffs are the stated ones', () => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
    assert.deepStrictEqual(H.scoreTask(files, ['e']), { rank: 5, ambiguous: false, hit: true, rr: 0.2 });
    assert.deepStrictEqual(H.scoreTask(files, ['f']), { rank: 6, ambiguous: false, hit: false, rr: 1 / 6 });
    assert.strictEqual(H.scoreTask(files, ['k']).rr, 0, 'rank 11 is past MRR@10');
    assert.deepStrictEqual(H.scoreTask(files, ['zzz']), { rank: null, ambiguous: false, hit: false, rr: 0 });
    assert.strictEqual(H.K, 5);
    assert.strictEqual(H.MRR_CUT, 10);
  });

  test('a suffix match counts for the rival and is flagged; an exact match earlier is not flagged', () => {
    assert.deepStrictEqual(H.rankOf(['pkg/src/a.ts'], ['src/a.ts']), { rank: 1, ambiguous: true });
    assert.deepStrictEqual(H.rankOf(['a.ts'], ['src/a.ts']), { rank: 1, ambiguous: true }, 'a rival that printed a shorter path');
    assert.deepStrictEqual(H.rankOf(['src/a.ts', 'pkg/src/a.ts'], ['src/a.ts']), { rank: 1, ambiguous: false });
    assert.deepStrictEqual(H.rankOf(['./src/a.ts'], ['src/a.ts']), { rank: 1, ambiguous: false });
    assert.deepStrictEqual(H.rankOf(['src\\a.ts'], ['src/a.ts']), { rank: 1, ambiguous: false });
    assert.strictEqual(H.rankOf(['xsrc/a.ts'], ['src/a.ts']).rank, null, 'a name that merely ends the same is not a path suffix');
  });

  // ── nodes become files ────────────────────────────────────────────────────
  test('results become repository-relative files in order of first appearance', () => {
    const dir = mk('h2h-repo-');
    const files = A.dedupeFiles([`${dir}/src/a.py`, `${dir}/src/b.py`, `${dir}/src/a.py`, '/elsewhere/c.py', 'src/d.py', './src/e.py'], dir);
    assert.deepStrictEqual(files, ['src/a.py', 'src/b.py', 'src/d.py', 'src/e.py']);
    assert.strictEqual(A.relativeTo(dir, '/nowhere/x.py'), null, 'outside the repository: never matches');
    assert.strictEqual(A.tokensOf('x'.repeat(40)), 10);
  });

  test('a path that goes through a symlinked root (macOS /tmp) still maps', () => {
    const real = mk('h2h-real-');
    const link = path.join(mk('h2h-link-'), 'repo');
    fs.symlinkSync(real, link);
    assert.strictEqual(A.relativeTo(link, `${real}/src/a.py`), 'src/a.py', 'the rival printed the resolved path of the directory we gave it');
    assert.strictEqual(A.relativeTo(link, `${link}/src/a.py`), 'src/a.py');
  });

  test('a rival runs in a scratch HOME with nothing inherited from the tool configuration', () => {
    const home = path.join(mk('h2h-home-'), 'h');
    process.env.CBM_CACHE_DIR = '/should/not/leak';
    process.env.CODE_REVIEW_GRAPH_HOME = '/should/not/leak';
    try {
      const env = A.scratchEnv(home, { X: '1' });
      assert.strictEqual(env.HOME, home);
      assert.strictEqual(env.X, '1');
      assert.ok(!('CBM_CACHE_DIR' in env) && !('CODE_REVIEW_GRAPH_HOME' in env), 'nothing of the user\'s configuration is passed on');
      assert.ok(fs.existsSync(home));
    } finally { delete process.env.CBM_CACHE_DIR; delete process.env.CODE_REVIEW_GRAPH_HOME; }
  });

  // ── the adapters, against stand-ins for the two command lines ──────────────
  function standIn(dir, name, body) {
    const f = path.join(dir, name);
    fs.writeFileSync(f, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    return f;
  }

  test('codebase-memory-mcp: index, file presence and the three search arms are read from its JSON', () => {
    const d = mk('h2h-cbm-');
    const bin = standIn(d, 'cbm', `
echo "$HOME" > "${d}/home.seen"
case " $* " in
  *index_repository*) echo '{"project":"p1"}' ;;
  *--file-pattern*)
    case " $* " in *known.py*) echo '{"groups":[{"file":"src/known.py","rows":[["f","Function","1-2",0,0]]}],"total":1}' ;; *) echo '{"groups":[],"total":0}' ;; esac ;;
  *--semantic-query*) echo "$*" > "${d}/sem.args"; echo '{"semantic":{"cols":["qn","label","file","score"],"rows":[["q","Function","src/sem.py",0.5],["q","Method","src/sem.py",0.4],["q","Function","src/two.py",0.3]]}}' ;;
  *--query*) echo '{"cols":["qn","label","file","lines","rank"],"rows":[["q","Method","src/known.py","1-2",-9],["q","Method","src/other.py","1-2",-8],["q","Method","src/known.py","3-4",-7]]}' ;;
esac`);
    const home = path.join(d, 'home');
    const ad = A.cbmAdapter({ bin, home });
    const repo = mk('h2h-cbm-repo-');
    const idx = ad.index(repo);
    assert.strictEqual(idx.project, 'p1');
    assert.ok(idx.ms >= 0 && idx.bytes >= 0);
    assert.strictEqual(fs.readFileSync(path.join(d, 'home.seen'), 'utf8').trim(), home, 'run with the scratch HOME');
    assert.strictEqual(ad.hasFile(repo, 'src/known.py'), true);
    assert.strictEqual(ad.hasFile(repo, 'src/missing.py'), false, 'no nodes for the file: unsupported, not a miss');
    const bm = ad.query(repo, 'bm25', 'where is the thing');
    assert.deepStrictEqual(bm.files, ['src/known.py', 'src/other.py'], 'nodes collapse to files, first appearance wins');
    assert.strictEqual(bm.results, 3);
    assert.ok(bm.tokens > 0);
    const sem = ad.query(repo, 'semantic', 'where is the thing');
    assert.deepStrictEqual(sem.files, ['src/sem.py', 'src/two.py']);
    assert.ok(/--semantic-query \["where is the thing"\]/.test(fs.readFileSync(path.join(d, 'sem.args'), 'utf8')), 'the whole question is one entry');
    ad.query(repo, 'semantic-kw', 'where is the billing ledger');
    const kw = JSON.parse(/--semantic-query (\[.*?\]) /.exec(fs.readFileSync(path.join(d, 'sem.args'), 'utf8'))[1]);
    assert.ok(kw.length > 1 && !kw.includes('the') && !kw.includes('is') && kw.includes('billing') && kw.includes('ledger'), `significant words, one entry each: ${kw}`);
    assert.throws(() => ad.query(repo, 'nonsense', 'q'), /no arm/);
  });

  test('a rival that fails does so loudly: a non-zero exit and non-JSON are errors, never an empty answer', () => {
    const d = mk('h2h-bad-');
    const bad = standIn(d, 'bad', 'echo boom >&2; exit 3');
    const junk = standIn(d, 'junk', 'echo not-json');
    const repo = mk('h2h-bad-repo-');
    assert.throws(() => A.cbmAdapter({ bin: bad, home: path.join(d, 'h') }).index(repo), /exited 3/);
    assert.throws(() => A.cbmAdapter({ bin: junk, home: path.join(d, 'h') }).index(repo), /not JSON/);
  });

  test('code-review-graph: build, File-node presence and search are read from its JSON', () => {
    const d = mk('h2h-crg-');
    const repo = mk('h2h-crg-repo-');
    const bin = standIn(d, 'crg', `
case "$1" in
  build) mkdir -p .code-review-graph; head -c 4096 /dev/zero > .code-review-graph/g.db; echo built ;;
  search)
    if [ "$3" = "--kind" ]; then
      case "$2" in *known.py*) echo '{"results":[{"kind":"File","file_path":"${repo}/src/known.py"}]}' ;; *) echo '{"results":[]}' ;; esac
    else
      echo '{"search_mode":"fts","results":[{"file_path":"${repo}/src/a.py"},{"file_path":"${repo}/src/a.py"},{"file_path":"${repo}/tests/t.py"}]}'
    fi ;;
esac`);
    const ad = A.crgAdapter({ bin, home: path.join(d, 'home') });
    const idx = ad.index(repo);
    assert.strictEqual(idx.bytes, 4096);
    assert.strictEqual(ad.hasFile(repo, 'src/known.py'), true);
    assert.strictEqual(ad.hasFile(repo, 'docs/readme.rst'), false);
    const q = ad.query(repo, 'search', 'a question');
    assert.deepStrictEqual(q.files, ['src/a.py', 'tests/t.py']);
    assert.strictEqual(q.mode, 'fts', 'the report records which search mode the tool used');
  });

  // ── a rival is only ever run when it is the pinned one ─────────────────────
  const tarball = (version) => {
    const d = mk('h2h-tar-');
    standIn(d, 'codebase-memory-mcp', `echo "codebase-memory-mcp ${version}"`);
    const t = path.join(d, 'a.tar.gz');
    assert.strictEqual(spawnSync('tar', ['-czf', t, '-C', d, 'codebase-memory-mcp']).status, 0);
    return fs.readFileSync(t);
  };
  const toolFor = (buf, over = {}) => ({
    version: '9.9.9', tag: 'v9.9.9', repository: 'https://example.invalid/r', binary: 'codebase-memory-mcp',
    checksumsUrl: 'https://example.invalid/checksums.txt',
    artifacts: { 'test-x64': { file: 'a.tar.gz', sha256: crypto.createHash('sha256').update(buf).digest('hex') } }, ...over,
  });
  const dl = (map) => async (url) => { if (!(url in map)) throw new Error(`unexpected GET ${url}`); return map[url]; };

  const jobs = [];
  jobs.push((async () => {
    const buf = tarball('9.9.9');
    const tool = toolFor(buf);
    const dir = mk('h2h-rivals-');
    const url = 'https://example.invalid/r/releases/download/v9.9.9/a.tar.gz';
    const sums = Buffer.from(`${tool.artifacts['test-x64'].sha256}  a.tar.gz\n`);
    const results = {};
    // matching pin and matching published list
    const ok = await F.ensureCbm(tool, { dir, platform: 'test-x64', download: dl({ [url]: buf, [tool.checksumsUrl]: sums }) });
    results.ok = ok;
    results.again = await F.ensureCbm(tool, { dir, platform: 'test-x64', download: dl({}) }); // no network needed the second time
    // tampered download
    const dir2 = mk('h2h-rivals-');
    const evil = Buffer.concat([buf, Buffer.from('x')]);
    results.tampered = await F.ensureCbm(tool, { dir: dir2, platform: 'test-x64', download: dl({ [url]: evil, [tool.checksumsUrl]: sums }) }).then(() => null, (e) => e);
    results.leftBehind = fs.existsSync(path.join(dir2, 'codebase-memory-mcp'));
    // a pin copied wrong: the file is the pinned one but the release's own list disagrees
    const dir3 = mk('h2h-rivals-');
    results.disagree = await F.ensureCbm(tool, { dir: dir3, platform: 'test-x64', download: dl({ [url]: buf, [tool.checksumsUrl]: Buffer.from(`${'0'.repeat(64)}  a.tar.gz\n`) }) }).then(() => null, (e) => e);
    // a platform with no pinned artifact
    results.platform = await F.ensureCbm(tool, { dir: mk('h2h-rivals-'), platform: 'plan9-mips', download: dl({}) }).then(() => null, (e) => e);
    return results;
  })());
  const fetched = await jobs[0];
  test('a downloaded artifact is used only when it matches the pin and the release\'s own checksums', () => {
    assert.strictEqual(fetched.ok.reused, false);
    assert.ok(fs.existsSync(fetched.ok.bin));
    assert.strictEqual(fetched.again.reused, true, 'an unpacked, runnable binary of the pinned version is reused without a download');
    assert.ok(fetched.tampered && /refusing to use it/.test(fetched.tampered.message), String(fetched.tampered));
    assert.strictEqual(fetched.leftBehind, false, 'a refused artifact leaves nothing that a later run would pick up');
    assert.ok(fetched.disagree && /checksums\.txt says/.test(fetched.disagree.message), String(fetched.disagree));
    assert.ok(fetched.platform && /no pinned artifact for plan9-mips/.test(fetched.platform.message), String(fetched.platform));
  });

  test('checksums.txt is parsed by file name; the pin helpers compare hex exactly', () => {
    const text = `${'a'.repeat(64)}  one.tar.gz\n${'b'.repeat(64)}  two.tar.gz\n`;
    assert.strictEqual(F.checksumFor(text, 'two.tar.gz'), 'b'.repeat(64));
    assert.strictEqual(F.checksumFor(text, 'three.tar.gz'), null);
    assert.throws(() => F.assertPinned(Buffer.from('x'), 'f'.repeat(64), 'x'), /refusing/);
    assert.strictEqual(F.assertPinned(Buffer.from('x'), crypto.createHash('sha256').update('x').digest('hex'), 'x').length, 64);
  });

  test('the rivals directory ignores itself, so nothing in it can reach git', () => {
    const d = path.join(mk('h2h-root-'), 'rivals');
    F.rivalsDir(d);
    assert.strictEqual(fs.readFileSync(path.join(d, '.gitignore'), 'utf8'), '*\n');
  });

  test('every pin in the manifest is complete: version, hash of 64 hex digits, a dated commit-pinned README', () => {
    const m = F.loadRivals();
    assert.deepStrictEqual(Object.keys(m.tools).sort(), ['code-review-graph', 'codebase-memory-mcp']);
    for (const [name, t] of Object.entries(m.tools)) {
      assert.ok(/^\d+\.\d+\.\d+$/.test(t.version), name);
      assert.ok(/\/blob\/[0-9a-f]{40}\/README\.md$/.test(t.readme), `${name}: the README is read at a commit`);
      assert.ok(/^2026-\d\d-\d\d$/.test(t.readOn), `${name}: and dated`);
      assert.ok(t.license, name);
    }
    for (const a of Object.values(m.tools['codebase-memory-mcp'].artifacts)) assert.ok(/^[0-9a-f]{64}$/.test(a.sha256));
    assert.ok(/^[0-9a-f]{64}$/.test(m.tools['code-review-graph'].wheel.sha256));
  });

  // ── never a dependency ─────────────────────────────────────────────────────
  test('no rival appears in package.json, and nothing under benchmarks/ ships in the npm package', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const rivals = ['codebase-memory-mcp', 'code-review-graph', 'code_review_graph', 'aider', 'aider-chat'];
    const deps = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'bundledDependencies'].flatMap((k) => Object.keys(pkg[k] || {}));
    for (const r of rivals) assert.ok(!deps.includes(r), `${r} must not be a dependency`);
    const scripts = JSON.stringify(pkg.scripts || {});
    assert.ok(!/pip install|npm i(nstall)? .*codebase-memory|code-review-graph/.test(scripts), 'no script installs a rival');
    assert.ok((pkg.files || []).every((f) => !/^benchmarks/.test(f)), 'benchmarks/ (and so benchmarks/rivals.json) is not in the package');
  });

  // ── the comparison and Gate G1 ─────────────────────────────────────────────
  const rec = (id, repo, split, expected, sig, riv, reachable = true) => ({
    id, repo, split, expected: [expected], sigmap: { files: sig, reachable },
    rivals: { rival: riv },
  });
  const hitList = (e) => [e, 'x', 'y'];
  const missList = () => ['q', 'r', 's'];
  const sup = (arms) => ({ supported: true, arms: Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, { files: v, tokens: 10 }])) });
  const unsup = { supported: false, arms: {} };

  test('an unsupported task is a miss in "all" and is absent from the table G1 reads', () => {
    const recs = [
      rec('t1', 'gin', 'hard', 'a', hitList('a'), sup({ a1: hitList('a') })),
      rec('t2', 'gin', 'hard', 'b', hitList('b'), unsup),
      rec('t3', 'gin', 'easy', 'c', missList(), sup({ a1: missList() })),
    ];
    const c = H.compare(H.scoreRecords(recs));
    assert.strictEqual(c.all.sigmap.hits, 2);
    assert.strictEqual(c.all['rival/a1'].hits, 1, 'unsupported counts as a miss in the all-tasks row');
    assert.strictEqual(c.bothIndexed.rival.tasks, 2, 'but is not in the both-indexed table');
    assert.deepStrictEqual(c.unsupported.rival, ['t2']);
    assert.strictEqual(c.bothIndexed.rival.sigmap.hits, 1);
  });

  test('a task SigMap cannot reach is a SigMap miss in "all" and is not held against it in the both-indexed table', () => {
    const recs = [
      rec('t1', 'gin', 'hard', 'a', missList(), sup({ a1: hitList('a') }), false),
      rec('t2', 'gin', 'hard', 'b', hitList('b'), sup({ a1: hitList('b') })),
    ];
    const c = H.compare(H.scoreRecords(recs));
    assert.strictEqual(c.all.sigmap.hits, 1);
    assert.deepStrictEqual(c.sigmapUnreachable, ['t1']);
    assert.strictEqual(c.bothIndexed.rival.tasks, 1);
  });

  test('best is the better arm per task, and a derived arm scores the filtered list', () => {
    const recs = [
      rec('t1', 'gin', 'easy', 'src/a.go', missList(), sup({ x: ['t_test.go', 'b.go', 'src/a.go'], y: missList() })),
    ];
    const noTests = (f) => !/_test\.go$/.test(f);
    const s = H.scoreRecords(recs, { derived: { '+src': noTests } });
    const arms = s[0].rivals.rival.arms;
    assert.strictEqual(arms.x.score.rank, 3);
    assert.strictEqual(arms['x+src'].score.rank, 2, 'the test file is left out, so the answer moves up');
    assert.strictEqual(s[0].rivals.rival.best.rank, 2, 'best takes the most favourable arm');
  });

  const g1For = (sigHits, rivalHits, repos) => {
    const recs = [];
    for (let i = 0; i < 20; i++) {
      const repo = repos[i % repos.length];
      const sigHit = i < sigHits;
      const rivHit = rivalHits.includes(i);
      recs.push(rec(`t${i}`, repo, 'easy', `f${i}`, sigHit ? hitList(`f${i}`) : missList(), sup({ a1: rivHit ? hitList(`f${i}`) : missList() })));
    }
    return H.gateG1(H.scoreRecords(recs));
  };

  test('G1 rule 1: a rival more than 10 points ahead on tasks both can index sends us to #985', () => {
    const g = g1For(10, [...Array(13).keys()], ['gin']); // sigmap 10/20, rival 13/20 -> +15 points
    assert.ok(g.best.leadPoints > 10, `${g.best.leadPoints}`);
    assert.strictEqual(g.rule1, true);
    assert.ok(/#985/.test(g.decision));
  });

  test('G1 rule 2: rival-only wins concentrated in graph-blind repos send us to #980; otherwise the order stands', () => {
    // SigMap hits tasks 0-9; the rival hits 0-8 and 10-11: 5 points ahead (not rule 1), its two extra wins are 10 and 11
    const rival = [...Array(9).keys(), 10, 11];
    const blind = g1For(10, rival, ['laravel']);
    assert.strictEqual(blind.rule1, false);
    assert.deepStrictEqual(blind.best.rivalOnlyWins, ['t10', 't11']);
    assert.strictEqual(blind.graphBlindShare, 1);
    assert.strictEqual(blind.rule2, true);
    assert.ok(/#980/.test(blind.decision));
    const seen = g1For(10, rival, ['gin']);
    assert.strictEqual(seen.rule1, false);
    assert.strictEqual(seen.graphBlindShare, 0);
    assert.strictEqual(seen.rule2, false);
    assert.ok(/keep the order/.test(seen.decision));
    const half = g1For(10, rival, ['laravel', 'gin']); // t10 -> laravel, t11 -> gin: exactly half is "concentrated"
    assert.strictEqual(half.graphBlindShare, 0.5);
    assert.strictEqual(half.rule2, true);
    assert.deepStrictEqual([...H.GRAPH_BLIND].sort(), ['alamofire', 'godot-demo-projects', 'laravel', 'plenary', 'riverpod', 'serilog']);
    assert.deepStrictEqual({ ...H.G1 }, { leadPoints: 10, concentrationShare: 0.5 });
  });

  test('costs: install, index time and size, tokens per query, as medians', () => {
    const c = H.costs({ t: { installMs: 5, index: [{ ms: 10, bytes: 100 }, { ms: 30, bytes: 300 }, { ms: 20, bytes: 200 }], tokens: [1, 3, 2] } });
    assert.deepStrictEqual(c.t, { installMs: 5, indexMsTotal: 60, indexMsMedianPerRepo: 20, indexBytesMedianPerRepo: 200, tokensPerQueryMedian: 2 });
  });

  // ── running a rival over a repository ──────────────────────────────────────
  test('a rival that cannot index is reported as an error and its tasks as unsupported, not as misses; forget always runs', () => {
    const repo = mk('h2h-run-');
    fs.writeFileSync(path.join(repo, 'a.py'), 'x = 1\n');
    let forgotten = 0;
    const ok = { id: 'ok', arms: ['s'], index: () => ({ ms: 1, bytes: 2 }), hasFile: (_d, f) => f === 'a.py', query: () => ({ files: ['a.py'], tokens: 3, results: 1 }), forget: () => { forgotten++; } };
    const boom = { id: 'boom', arms: ['s'], index: () => { throw new Error('index exploded'); }, hasFile: () => true, query: () => ({}), forget: () => { forgotten++; } };
    const r = R.runRivalsOnRepo({ dir: repo, pristine: false, tasks: [{ id: 't1', query: 'q', expected_files: ['a.py'] }, { id: 't2', query: 'q', expected_files: ['zzz.py'] }], adapters: [ok, boom] });
    assert.strictEqual(r.byTool.ok.tasks.t1.supported, true);
    assert.strictEqual(r.byTool.ok.tasks.t2.supported, false, 'no node for the expected file: unsupported');
    assert.deepStrictEqual(r.byTool.ok.tasks.t1.arms.s.files, ['a.py']);
    assert.ok(/index exploded/.test(r.byTool.boom.error));
    assert.strictEqual(r.byTool.boom.tasks.t1.supported, false);
    assert.strictEqual(forgotten, 2);
  });

  // ── exploratory numbers cannot reach the repository ────────────────────────
  const cli = (args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts/run-head-to-head.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, SIGMAP_RIVALS_DIR: mk('h2h-norival-') } });
  test('the runner needs --exploratory and --out, and refuses an --out under benchmarks/', () => {
    let r = cli([]);
    assert.strictEqual(r.status, 1);
    assert.ok(/only --exploratory is implemented/.test(r.stderr), r.stderr);
    r = cli(['--exploratory']);
    assert.strictEqual(r.status, 1);
    assert.ok(/--out <dir> is required/.test(r.stderr), r.stderr);
    r = cli(['--exploratory', '--out', path.join(ROOT, 'benchmarks', 'reports', 'h2h')]);
    assert.strictEqual(r.status, 1);
    assert.ok(/refusing to write exploratory numbers under/.test(r.stderr), r.stderr);
    assert.ok(!fs.existsSync(path.join(ROOT, 'benchmarks', 'reports', 'h2h')), 'and wrote nothing there');
  });

  for (const d of tmp) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\nhead-to-head: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
