'use strict';

/**
 * #1071: the two tools a confirmatory run of the agent study needs.
 *
 *   rebuild-heldout-root.mjs  writes the study's held-out data root from the saved pins and fetches each repository AT ITS PINNED COMMIT
 *                             (not the head: build-heldout-set.mjs would give new questions), refusing a directory inside this repository;
 *   confirm-bar.mjs           applies a pre-registered bar (B1 to B4) to a run file with the study's own pairing and pooling.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; } catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });
const git = (args, cwd) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8' }); assert.strictEqual(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };

(async () => {
  const rb = await import('../../benchmarks/agent-study/rebuild-heldout-root.mjs');
  const cb = await import('../../benchmarks/agent-study/confirm-bar.mjs');

  // a local "remote" with two commits, and the pins of two repositories (the second is only there to be excluded)
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-rb-src-'));
  git(['init', '-q'], src);
  git(['config', 'user.email', 't@example.invalid'], src); git(['config', 'user.name', 't'], src); git(['config', 'uploadpack.allowAnySHA1InWant', 'true'], src);
  fs.writeFileSync(path.join(src, 'a.txt'), 'v1\n'); git(['add', '-A'], src); git(['commit', '-q', '-m', 'one'], src);
  const pinned = git(['rev-parse', 'HEAD'], src);
  fs.writeFileSync(path.join(src, 'a.txt'), 'v2 after the pin\n'); git(['commit', '-qam', 'two'], src);
  const head = git(['rev-parse', 'HEAD'], src);
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-rb-data-'));
  fs.writeFileSync(path.join(data, 'pins.json'), JSON.stringify({ repos: [
    { name: 'o__r', url: src, commit: pinned, language: 'x', layout: 'heldout' },
    { name: 'o__skip', url: src, commit: pinned, language: 'x', layout: 'heldout' },
  ] }));
  fs.writeFileSync(path.join(data, 'q.jsonl'), [
    { id: 'p001', repo: 'o__r', query: 'q1', expected_files: ['a.txt'] }, { id: 'p002', repo: 'o__r', query: 'q2', expected_files: ['a.txt'] },
    { id: 'p003', repo: 'o__skip', query: 'q3', expected_files: ['a.txt'] },
  ].map((x) => JSON.stringify(x)).join('\n') + '\n');
  const base = { dataDir: data, pinFiles: ['pins.json'], questionFiles: ['q.jsonl'] };
  const outs = [];
  const mkOut = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-rb-out-')); outs.push(d); return d; };

  await test('rebuild fetches each repository at its PINNED commit, not the head', () => {
    const out = mkOut();
    const r = rb.rebuild({ ...base, out, exclude: ['o__skip'] });
    assert.deepStrictEqual(r.fetched, ['o__r']);
    const dir = path.join(out, 'benchmarks/repos/o__r');
    assert.strictEqual(git(['rev-parse', 'HEAD'], dir), pinned);
    assert.notStrictEqual(pinned, head);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'a.txt'), 'utf8'), 'v1\n');
  });

  await test('the manifest and the questions are written in the harness layout, minus the excluded repository', () => {
    const out = mkOut();
    rb.rebuild({ ...base, out, exclude: ['o__skip'] });
    const m = JSON.parse(fs.readFileSync(path.join(out, 'benchmarks/xrepo-repos.json'), 'utf8'));
    assert.deepStrictEqual(m.repos.map((r) => r.name), ['o__r']);
    const q = fs.readFileSync(path.join(out, 'benchmarks/tasks/retrieval-xrepo.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepStrictEqual(q.map((x) => x.id), ['p001', 'p002']);
  });

  await test('a second run keeps a checkout that is already at its pin', () => {
    const out = mkOut();
    rb.rebuild({ ...base, out });
    const r2 = rb.rebuild({ ...base, out });
    assert.deepStrictEqual(r2.fetched, []);
    assert.deepStrictEqual(r2.kept.sort(), ['o__r', 'o__skip']);
  });

  await test('a pin that cannot be fetched is reported, and nothing half-built is left in its place', () => {
    const out = mkOut();
    const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-rb-bad-'));
    fs.writeFileSync(path.join(bad, 'pins.json'), JSON.stringify({ repos: [{ name: 'o__r', url: src, commit: '0'.repeat(40), language: 'x', layout: 'heldout' }] }));
    fs.copyFileSync(path.join(data, 'q.jsonl'), path.join(bad, 'q.jsonl'));
    try {
      const r = rb.rebuild({ dataDir: bad, pinFiles: ['pins.json'], questionFiles: ['q.jsonl'], out, exclude: [] });
      assert.strictEqual(r.failed.length, 1);
      assert.ok(!fs.existsSync(path.join(out, 'benchmarks/repos/o__r')));
    } finally { rm(bad); }
  });

  await test('--out inside this repository is refused; a dry run writes nothing', () => {
    assert.throws(() => rb.rebuild({ ...base, out: path.join(ROOT, 'benchmarks', 'x-held-out-root') }), /inside this repository/);
    const out = path.join(os.tmpdir(), `sigmap-rb-dry-${process.pid}`);
    const r = rb.rebuild({ ...base, out, dryRun: true });
    assert.strictEqual(r.repos.length, 2);
    assert.ok(!fs.existsSync(out));
  });

  await test('the saved pins are the study: 21 repositories, 20 without egui_plot, 222 questions, 40-hex commits', () => {
    const pins = rb.readPins();
    assert.strictEqual(pins.length, 21);
    for (const p of pins) assert.match(p.commit, /^[0-9a-f]{40}$/, p.name);
    const keep = pins.filter((p) => p.name !== 'emilk__egui_plot').map((p) => p.name);
    assert.strictEqual(keep.length, 20);
    const qs = rb.readQuestions().filter((q) => keep.includes(q.repo));
    assert.strictEqual(qs.length, 222);
    // the same 20 repositories and 222 questions as the study's Messages-API `locate` series (data/runs.ndjson)
    const rows = fs.readFileSync(path.join(ROOT, 'benchmarks/agent-study/data/runs.ndjson'), 'utf8').trim().split('\n').map(JSON.parse)
      .filter((r) => r.route === 'api' && r.set === 'heldout' && r.variant === 'locate' && r.model === 'claude-haiku-5-5' && r.arm === 'with');
    assert.deepStrictEqual([...new Set(rows.map((r) => r.repo))].sort(), keep.slice().sort());
    assert.strictEqual(new Set(rows.map((r) => `${r.repo}/${r.task}`)).size, 222);
  });

  // ---- confirm-bar --------------------------------------------------------------------------------------------------------
  const synth = ({ repos = 20, per = 6, ratio = 0.9, passWith = 1, passWithout = 1, mcp = 1, costsRepos = 0, ratioCosts = 1.5, failRun = false, loseFound = 0 } = {}) => {
    const rows = [];
    for (let r = 0; r < repos; r++) {
      const rat = r < costsRepos ? ratioCosts : ratio;
      for (let t = 0; t < per; t++) {
        const jitter = 1 + ((t % 3) - 1) * 0.02;
        const b = 0.003 * jitter;
        const mk = (arm, usd, pass, m) => ({ series: 's', variant: 'locate', set: 'heldout', repo: `r${r}`, task: `t${t}`, arm, run: 1, ok: true, pass, mcp: m, cli: 0, usd });
        rows.push(mk('without', b, t < passWithout, 0), mk('with', b * rat, t < passWith, mcp));
      }
    }
    if (failRun) rows[1].ok = false;
    if (loseFound) { let n = 0; for (const r of rows) if (r.arm === 'with' && r.pass && n < loseFound) { r.pass = false; n++; } }   // exactly this many fewer files found
    return rows;
  };
  const sel = { variant: 'locate' };

  await test('B1 to B4 all met: a real saving with the file still found and SigMap used', () => {
    const j = cb.judge(synth(), sel);
    assert.strictEqual(j.met, true, JSON.stringify(j.clauses));
    assert.strictEqual(j.repositories, 20);
    assert.ok(j.pooled.hi < 0.05 && j.pooled.change < 0);
  });

  await test('B1 fails when the pooled upper bound reaches +5%', () => {
    const j = cb.judge(synth({ ratio: 1.12 }), sel);
    assert.strictEqual(j.clauses.find((c) => c.id === 'B1').ok, false);
    assert.strictEqual(j.met, false);
  });

  await test('B2: three of twenty repositories costing more is allowed, four is not', () => {
    assert.strictEqual(cb.judge(synth({ costsRepos: 3 }), sel).clauses.find((c) => c.id === 'B2').ok, true);
    assert.strictEqual(cb.judge(synth({ costsRepos: 4 }), sel).clauses.find((c) => c.id === 'B2').ok, false);
  });

  await test('B3 fails when the file is found more than 5 points less often', () => {
    const j = cb.judge(synth({ passWith: 4, passWithout: 6 }), sel);   // 4/6 vs 6/6 = -33 points
    assert.strictEqual(j.clauses.find((c) => c.id === 'B3').ok, false);
    assert.strictEqual(cb.judge(synth({ passWith: 6, passWithout: 6 }), sel).clauses.find((c) => c.id === 'B3').ok, true);
  });

  await test('B3 boundary: exactly 5.0 points lower is allowed (6 of 120), 5.8 is not (7 of 120)', () => {
    assert.strictEqual(cb.judge(synth({ loseFound: 6 }), sel).clauses.find((c) => c.id === 'B3').ok, true);
    assert.strictEqual(cb.judge(synth({ loseFound: 7 }), sel).clauses.find((c) => c.id === 'B3').ok, false);
  });

  await test('B4 fails when SigMap is hardly ever called, and counts a `sigmap` command as a call', () => {
    assert.strictEqual(cb.judge(synth({ mcp: 0 }), sel).clauses.find((c) => c.id === 'B4').ok, false);
    const viaCli = synth({ mcp: 0 }).map((r) => (r.arm === 'with' ? { ...r, cli: 1 } : r));
    assert.strictEqual(cb.judge(viaCli, sel).clauses.find((c) => c.id === 'B4').ok, true);
    const half = synth({ mcp: 1 }).map((r, i) => (r.arm === 'with' && i % 4 === 1 ? { ...r, mcp: 0 } : r));   // every other SigMap-arm run uses none: exactly half
    assert.strictEqual(cb.judge(half, sel).clauses.find((c) => c.id === 'B4').ok, true, 'exactly half is enough ("at least half")');
  });

  await test('a pair with a failed run is dropped and counted; one repository, or none, is nothing to judge', () => {
    const j = cb.judge(synth({ failRun: true }), sel);
    assert.strictEqual(j.dropped, 1);
    assert.strictEqual(j.pairs, 20 * 6 - 1);
    assert.strictEqual(cb.judge(synth({ repos: 1 }), sel), null);
    assert.strictEqual(cb.judge(synth(), { variant: 'nope' }), null);
  });

  await test('the analysis reproduces the study: the installed hook over the 20 repositories, from the saved runs', () => {
    const rows = fs.readFileSync(path.join(ROOT, 'benchmarks/agent-study/data/runs.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
    const j = cb.judge(rows, { variant: 'prefetch-hook', set: 'heldout-w' });
    assert.strictEqual(j.pairs, 888);
    assert.strictEqual(j.repositories, 20);
    assert.strictEqual(j.foundWith, 804); assert.strictEqual(j.foundWithout, 817);
    assert.ok(j.pooled.change > -0.06 && j.pooled.change < -0.04, `pooled ${j.pooled.change}`);   // published: -5% [-10, -1] by repository
    assert.ok(j.pooled.hi > -0.02 && j.pooled.hi < 0, `upper ${j.pooled.hi}`);
  });

  // The confirmatory run of #1071 (T5): `locate` in Claude Code, Haiku 5.5, the 20 held-out repositories, run 2026-11-18/19 on the maintainer's key
  // and converted with to-runs.mjs. The file is the run table; the headline below is what the pre-registered bar says about it.
  const T5 = () => fs.readFileSync(path.join(ROOT, 'benchmarks/agent-study/data/confirm-locate-claude-code.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);

  await test('the saved confirmatory run is complete: 1,776 runs, 20 repositories, both arms, none failed or capped', () => {
    const rows = T5();
    assert.strictEqual(rows.length, 1776);
    assert.strictEqual(rows.filter((r) => r.arm === 'with').length, 888);
    assert.strictEqual(rows.filter((r) => r.arm === 'without').length, 888);
    assert.strictEqual(new Set(rows.map((r) => r.repo)).size, 20);
    assert.ok(rows.every((r) => r.ok && !r.limit && r.variant === 'locate' && r.set === 'heldout' && r.model === 'claude-haiku-5-5' && r.route === 'claude-code'));
    assert.deepStrictEqual([rows.filter((r) => r.ask === 'first').length, rows.filter((r) => r.ask === 'repeat').length], [444, 1332], 'run 1 of each question is a first ask, runs 2-4 are cache repeats');
  });

  await test('the saved confirmatory run: the pre-registered bar is met, on first asks and on all runs (the numbers posted on #1071)', () => {
    const rows = T5();
    const first = cb.judge(rows.filter((r) => r.ask !== 'repeat'), { variant: 'locate', set: 'heldout' });
    assert.strictEqual(first.pairs, 222); assert.strictEqual(first.repositories, 20);
    assert.strictEqual(first.foundWith, 205); assert.strictEqual(first.foundWithout, 208);
    assert.ok(first.pooled.change > -0.17 && first.pooled.change < -0.16, `pooled ${first.pooled.change}`);       // -16.6%
    assert.ok(first.pooled.lo > -0.235 && first.pooled.lo < -0.23, `lower ${first.pooled.lo}`);                   // -23.2%
    assert.ok(first.pooled.hi > -0.10 && first.pooled.hi < -0.09, `upper ${first.pooled.hi}`);                    // -9.7%
    assert.ok(first.uptake > 0.95 && first.uptake < 0.97, `uptake ${first.uptake}`);
    assert.deepStrictEqual(first.clauses.map((c) => c.ok), [true, true, true, true]);
    assert.strictEqual(first.met, true);
    const cls = {}; for (const r of first.repos) cls[r.cls] = (cls[r.cls] || 0) + 1;
    assert.deepStrictEqual(cls, { saves: 10, none: 10 }, 'ten repositories clearly save, ten are indeterminate, none clearly costs more');
    assert.deepStrictEqual(first.flaggedAbove15, []);
    const all = cb.judge(rows, { variant: 'locate', set: 'heldout' });
    assert.strictEqual(all.pairs, 888); assert.strictEqual(all.foundWith, 819); assert.strictEqual(all.foundWithout, 823);
    assert.ok(all.pooled.change > -0.17 && all.pooled.change < -0.155 && all.pooled.hi < -0.10, `all runs ${JSON.stringify(all.pooled)}`);
    assert.strictEqual(all.met, true);
    const noPjp = cb.judge(rows.filter((r) => r.repo !== 'stefankoegl__python-json-patch'), { variant: 'locate', set: 'heldout' });
    assert.strictEqual(noPjp.repositories, 19); assert.strictEqual(noPjp.met, true);
  });

  await test('the bar constants are the pre-registered ones', () => {
    assert.deepStrictEqual({ ...cb.BAR }, { poolHiBelow: 0.05, maxCostsShare: 0.15, foundPointsAtLeast: -5, uptakeAtLeast: 0.5, repoPointFlag: 0.15 });
  });

  await test('the CLI prints one line per clause and exits 1 when the bar is not met', () => {
    const f = path.join(os.tmpdir(), `sigmap-bar-${process.pid}.ndjson`);
    fs.writeFileSync(f, synth({ ratio: 1.2 }).map((r) => JSON.stringify(r)).join('\n') + '\n');
    try {
      const r = spawnSync(process.execPath, [path.join(ROOT, 'benchmarks/agent-study/confirm-bar.mjs'), '--runs', f, '--variant', 'locate'], { encoding: 'utf8' });
      assert.strictEqual(r.status, 1, r.stderr);
      assert.match(r.stdout, /NOT MET B1/); assert.match(r.stdout, /BAR NOT MET/);
    } finally { rm(f); }
  });

  rm(src); rm(data); for (const d of outs) rm(d);
  console.log(`\nagent-study-confirmatory-tools: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
