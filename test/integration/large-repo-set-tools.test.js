'use strict';

/**
 * #1071 — the tools that build the large-repository set (held-out repositories of 3,000 or more tracked files). They are the first two rounds'
 * tools with two additions, each of which must leave the old behaviour exactly as it was:
 *
 *   - `select-heldout-repos.mjs --stars --size-kb`: the star and size windows of the repository rule. Defaults are round 1 and 2's.
 *   - `build-heldout-set.mjs --min-files --max-files`: a repository whose checkout tracks fewer or more files is left out and reported, before
 *     its history is read. With neither flag nothing changes.
 *   - `rebuild-heldout-root.mjs --pins --questions`: rebuild another saved set from the pins in data/.
 *
 * Offline: a stand-in `gh` records the search it is asked for, and the builder is given checkouts that already exist, so it never clones.
 * The saved set itself (data/heldout3-*) is pinned further down.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SELECT = path.join(ROOT, 'scripts', 'select-heldout-repos.mjs');
const BUILD = path.join(ROOT, 'scripts', 'build-heldout-set.mjs');
const REBUILD = path.join(ROOT, 'benchmarks', 'agent-study', 'rebuild-heldout-root.mjs');
const DATA = path.join(ROOT, 'benchmarks', 'agent-study', 'data');

const tmp = [];
const mktmp = (p) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); tmp.push(d); return d; };

/** A `gh` that records the arguments of every call and answers every search with no repositories. */
function fakeGh() {
  const dir = mktmp('sigmap-fake-gh-');
  const log = path.join(dir, 'calls.log');
  fs.writeFileSync(path.join(dir, 'gh'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\nprintf '{"items":[],"total_count":0}'\n`, { mode: 0o755 });
  return { dir, log };
}
const search = (extra) => {
  const gh = fakeGh();
  const r = spawnSync(process.execPath, [SELECT, '--languages', 'python', '--per-language', '1', ...extra], { encoding: 'utf8', env: { ...process.env, PATH: `${gh.dir}${path.delimiter}${process.env.PATH}` } });
  return { r, calls: fs.existsSync(gh.log) ? fs.readFileSync(gh.log, 'utf8') : '' };
};

/** A git repository with `files` tracked files and two commits that qualify as held-out questions. */
function checkout(out, name, files) {
  const dir = path.join(out, 'benchmarks', 'repos', name);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  for (let i = 0; i < files; i++) fs.writeFileSync(path.join(dir, 'src', `f${i}.js`), `function f${i}() { return ${i}; }\n`);
  const git = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=Dev', '-c', 'user.email=dev@example.com', ...a], { encoding: 'utf8' });
  execFileSync('git', ['init', '-q', dir]);
  git('add', '-A'); git('commit', '-q', '-m', 'initial import of the project');
  fs.appendFileSync(path.join(dir, 'src', 'f0.js'), '// handle empty input\n'); git('commit', '-qam', 'Handle empty input when parsing configuration values (#1)');
  fs.appendFileSync(path.join(dir, 'src', 'f1.js'), '// nested options\n'); git('commit', '-qam', 'Support nested options when loading project settings (#2)');
  return dir;
}

(async () => {
  let passed = 0; let failed = 0;
  const test = async (name, fn) => {
    try { await fn(); passed++; console.log(`  PASS  ${name}`); } catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n').join('\n        ')}`); }
  };

  await test('select: the default star and size windows are the first two rounds\'; --stars and --size-kb change them and nothing else', () => {
    const old = search([]);
    assert.strictEqual(old.r.status, 0, old.r.stderr);
    assert.ok(old.calls.includes('q=stars:100..500 pushed:>2026-10-15 created:<2026-01-01 archived:false fork:false size:800..10000 language:python'), old.calls);
    const big = search(['--size-kb', '30000..400000']);
    assert.ok(big.calls.includes('q=stars:100..500 pushed:>2026-10-15 created:<2026-01-01 archived:false fork:false size:30000..400000 language:python'), big.calls);
    const stars = search(['--stars', '100..2000']);
    assert.ok(stars.calls.includes('q=stars:100..2000 '), stars.calls);
  });

  await test('select: a malformed window is refused before any search', () => {
    for (const bad of [['--size-kb', '30000'], ['--stars', 'many'], ['--size-kb', '10..x']]) {
      const r = search(bad);
      assert.strictEqual(r.r.status, 2, bad.join(' '));
      assert.strictEqual(r.calls, '', `${bad.join(' ')} reached the search API`);
    }
  });

  const build = (args, names) => {
    const out = mktmp('sigmap-heldout-out-');
    for (const [n, files] of names) checkout(out, n, files);
    const r = spawnSync(process.execPath, [BUILD, '--out', out, '--since', '2020-01-01', '--min-per-repo', '1', ...args], { encoding: 'utf8' });
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'benchmarks', 'xrepo-repos.json'), 'utf8'));
    return { r, out, manifest, report: fs.readFileSync(path.join(out, 'report.txt'), 'utf8') };
  };
  const repos = [['o__small', 5], ['o__mid', 15], ['o__big', 30]];
  const slugs = 'o/small,o/mid,o/big';

  await test('build: --min-files and --max-files keep only the repositories inside the window, and say why for the others', () => {
    const b = build(['--repos', slugs, '--min-files', '10', '--max-files', '20'], repos);
    assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
    assert.deepStrictEqual(b.manifest.repos.map((r) => r.name), ['o__mid']);
    assert.match(b.report, /o\/small: 5 tracked files, outside 10 to 20; left out/);
    assert.match(b.report, /o\/big: 30 tracked files, outside 10 to 20; left out/);
    assert.match(b.report, /o\/mid: 2 questions .*; 15 tracked files\./);
  });

  await test('build: one bound alone works, the window is inclusive, and a repository left out leaves no checkout behind', () => {
    const lower = build(['--repos', slugs, '--min-files', '15'], repos);
    assert.deepStrictEqual(lower.manifest.repos.map((r) => r.name).sort(), ['o__big', 'o__mid']);
    const upper = build(['--repos', slugs, '--max-files', '15'], repos);
    assert.deepStrictEqual(upper.manifest.repos.map((r) => r.name).sort(), ['o__mid', 'o__small']);
    const present = (b, n) => fs.existsSync(path.join(b.out, 'benchmarks', 'repos', n));
    assert.deepStrictEqual([present(upper, 'o__mid'), present(upper, 'o__small'), present(upper, 'o__big')], [true, true, false], 'the checkout of a repository left out is removed');
    assert.deepStrictEqual([present(lower, 'o__big'), present(lower, 'o__small')], [true, false]);
  });

  await test('build: without the flags nothing changes: every repository is kept and no file count is reported', () => {
    const b = build(['--repos', slugs], repos);
    assert.deepStrictEqual(b.manifest.repos.map((r) => r.name).sort(), ['o__big', 'o__mid', 'o__small']);
    assert.ok(!/tracked files/.test(b.report), b.report);
  });

  await test('rebuild: --pins and --questions read another saved set; the default is still the first two rounds (21 repositories)', () => {
    const def = spawnSync(process.execPath, [REBUILD, '--out', path.join(os.tmpdir(), `sigmap-rebuild-dry-${process.pid}`), '--dry-run'], { encoding: 'utf8' });
    assert.strictEqual(def.status, 0, def.stderr);
    assert.match(def.stdout, /21 repositories, 230 questions/);
    const bad = spawnSync(process.execPath, [REBUILD, '--out', path.join(os.tmpdir(), `sigmap-rebuild-dry-${process.pid}`), '--dry-run', '--pins', 'no-such-set-repos.json'], { encoding: 'utf8' });
    assert.notStrictEqual(bad.status, 0, 'a pin file that does not exist is an error');
  });

  // ── the saved set (round 3: large repositories) ─────────────────────────────────────────────────────────────

  const read = (f) => fs.readFileSync(path.join(DATA, f), 'utf8');
  const repos3 = () => JSON.parse(read('heldout3-repos.json')).repos;
  const questions3 = () => read('heldout3-questions.jsonl').trim().split('\n').map(JSON.parse);
  const report3 = () => read('heldout3-build-report.txt').trim().split('\n');
  const slugOf = (r) => r.url.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').toLowerCase();

  await test('round 3 is 16 repositories and 192 questions, 12 each, with unique ids and pinned commits', () => {
    const rs = repos3(); const qs = questions3();
    assert.strictEqual(rs.length, 16); assert.strictEqual(qs.length, 192);
    assert.ok(rs.every((r) => /^[0-9a-f]{40}$/.test(r.commit) && r.layout === 'heldout' && /^https:\/\/github\.com\/[^/]+\/[^/]+\.git$/.test(r.url)));
    assert.strictEqual(new Set(rs.map((r) => r.commit)).size, 16);
    const per = {}; for (const q of qs) per[q.repo] = (per[q.repo] || 0) + 1;
    assert.deepStrictEqual(Object.keys(per).sort(), rs.map((r) => r.name).sort());
    assert.ok(Object.values(per).every((n) => n === 12), JSON.stringify(per));
    assert.deepStrictEqual(qs.map((q) => q.id), Array.from({ length: 192 }, (_, i) => `p${String(i + 1).padStart(3, '0')}`));
  });

  await test('round 3 questions follow the builder\'s rule: 1 to 3 expected source files, a 25 to 160 character title that names none of them', () => {
    for (const q of questions3()) {
      assert.ok(q.expected_files.length >= 1 && q.expected_files.length <= 3, `${q.id} ${q.expected_files.length} files`);
      assert.ok(q.query.length >= 25 && q.query.length <= 160, `${q.id} title length ${q.query.length}`);
      assert.match(q.goldCommit, /^[0-9a-f]{40}$/);
      for (const f of q.expected_files) assert.ok(!q.query.toLowerCase().includes(path.basename(f).toLowerCase()), `${q.id} names ${f}`);
    }
  });

  await test('round 3 repositories are new: none is in round 1, round 2 or the benchmark manifest', () => {
    const used = new Set();
    for (const f of ['heldout-repos.json', 'heldout2-repos.json']) for (const r of JSON.parse(read(f)).repos) used.add(slugOf(r));
    for (const r of JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks', 'xrepo-repos.json'), 'utf8')).repos) used.add(slugOf(r));
    const dup = repos3().filter((r) => used.has(slugOf(r))).map((r) => r.name);
    assert.deepStrictEqual(dup, []);
  });

  await test('round 3: every kept repository tracks 3,000 to 10,000 files at its pinned commit (from the build report), and the eight languages have two each', () => {
    const kept = report3().filter((l) => /: 12 questions \(of /.test(l));
    assert.strictEqual(kept.length, 16);
    for (const l of kept) { const n = Number(l.match(/; (\d+) tracked files\./)[1]); assert.ok(n >= 3000 && n <= 10000, l.slice(0, 80)); }
    const by = {}; for (const r of repos3()) by[r.language] = (by[r.language] || 0) + 1;
    assert.deepStrictEqual(by, { go: 2, java: 2, typescript: 2, rust: 2, csharp: 2, php: 2, ruby: 2, cpp: 2 });
    for (const r of repos3()) assert.ok(kept.some((l) => l.toLowerCase().startsWith(`${slugOf(r)}:`)), `${r.name} is not in the report`);
    // The pins agree with the report the builder wrote at the time: the commit's first ten characters and the language, repository by repository.
    for (const r of repos3()) {
      const line = kept.find((l) => l.toLowerCase().startsWith(`${slugOf(r)}:`));
      assert.ok(line.includes(`pinned ${r.commit.slice(0, 10)};`), `${r.name}: the pinned commit ${r.commit.slice(0, 10)} is not the one in the report`);
      assert.ok(line.includes(`language ${r.language};`), `${r.name}: the language differs from the report`);
    }
  });

  await test('round 3 discloses what the rule left out: 16 kept, 72 outside the window, 3 clones that failed, 2 with too few questions, 36 not tried', () => {
    const l = report3();
    assert.deepStrictEqual([
      l.filter((x) => /: 12 questions \(of /.test(x)).length, l.filter((x) => /tracked files, outside 3000 to 10000; left out/.test(x)).length,
      l.filter((x) => /clone failed/.test(x)).length, l.filter((x) => /qualifying question\(s\) \(< 8\); left out/.test(x)).length, l.filter((x) => /not tried \(2 [a-z]+ repositories already usable\)/.test(x)).length,
    ], [16, 72, 3, 2, 36]);
    assert.strictEqual(l.length, 16 + 72 + 3 + 2 + 36, 'every candidate has exactly one line');
  });

  await test('round 3: nothing was chosen by hand: every repository is a candidate the selection rule printed, language included', () => {
    const lines = read('heldout3-selected-repos.txt').split('\n').filter((x) => x && !x.startsWith('#')).map((x) => x.toLowerCase());
    assert.strictEqual(lines.length, 36 + 125);
    assert.strictEqual(new Set(lines).size, lines.length, 'no candidate twice');
    for (const r of repos3()) assert.ok(lines.includes(`${r.language}:${slugOf(r)}`), `${r.name} (${r.language}) is not a selected candidate`);
    assert.ok(/stars/i.test(read('heldout3-selection-log.txt')), 'the selection log keeps stars and merged-PR counts');
  });

  await test('rebuild: --pins heldout3-repos.json --questions heldout3-questions.jsonl plans the 16 repositories and 192 questions', () => {
    const r = spawnSync(process.execPath, [REBUILD, '--out', path.join(os.tmpdir(), `sigmap-rebuild3-dry-${process.pid}`), '--dry-run', '--pins', 'heldout3-repos.json', '--questions', 'heldout3-questions.jsonl'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /16 repositories, 192 questions/);
  });

  for (const d of tmp) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
  console.log(`\nlarge-repo-set-tools: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
