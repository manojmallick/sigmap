'use strict';

// Generated-output hygiene for mined retrieval tasks (#883).

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'gen-context.js');
const MINER = path.join(ROOT, 'scripts/mine-corpus.mjs');
const CHECKER = path.join(ROOT, 'scripts/check-corpus.mjs');
const TASKS_DIR = path.join(ROOT, 'benchmarks/tasks');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}

const tmpDirs = [];
function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

function git(dir, args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

function lines(prefix, n) {
  return Array.from({ length: n }, (_, i) => `function ${prefix}${i}() { return ${i}; }`).join('\n') + '\n';
}

// A repo shaped like the real defect: every feature commit rewrites the bundle
// and a generated llms.txt alongside the one real source file.
function bundledRepo() {
  const dir = tmp('sigmap-mine-');
  git(dir, ['init', '-q']);
  const write = (rel, body) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  };
  write('gen-context.config.json', JSON.stringify({ srcDirs: ['.'], outputs: ['copilot'] }));
  write('src/engine.js', lines('engineBase', 3));
  write('src/pool.js', lines('poolBase', 3));
  write('gen-context.js', lines('bundleBase', 3));
  write('llms.txt', 'base\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'chore: initial import']);

  write('src/engine.js', lines('engineBase', 3) + lines('retryEngine', 30));
  write('gen-context.js', lines('bundleBase', 3) + lines('bundledEngine', 300));
  write('llms.txt', 'base\n' + 'generated line\n'.repeat(50));
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'feat: stop dropping sessions when the upstream connection resets']);

  write('src/pool.js', lines('poolBase', 3) + lines('warmPool', 30));
  write('gen-context.js', lines('bundleBase', 3) + lines('bundledEngine', 300) + lines('bundledPool', 300));
  write('llms.txt', 'base\n' + 'generated line\n'.repeat(100));
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'feat: reuse idle workers instead of spawning a fresh process each time']);

  const gen = spawnSync('node', [CLI], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(gen.status, 0, `gen-context failed in the fixture repo: ${gen.stderr}`);
  assert.ok(fs.existsSync(path.join(dir, '.context', 'sig-index.json')), 'fixture repo has no retrieval index');
  return dir;
}

function mine(dir, extra = []) {
  const out = path.join(tmp('sigmap-mined-out-'), 'tasks.jsonl');
  const r = spawnSync('node', [MINER, '--repo', dir, '--out', out, ...extra], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `miner failed: ${r.stderr}${r.stdout}`);
  return fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

(async () => {
  const hygiene = await import('../../scripts/lib/corpus-hygiene.mjs');

  // ── classification ────────────────────────────────────────────────────────

  await test('tooling-written outputs are classified as generated', () => {
    for (const p of ['.context/sig-index.json', 'CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.cursorrules', '.windsurfrules',
      '.github/copilot-instructions.md', 'llms.txt', 'llms-full.txt', 'llm.txt', 'llm-full.txt',
      'docs-vp/public/llms-full.txt', 'packages/cli/CLAUDE.md', 'src/api/user.generated.ts', 'dist/cli.js']) {
      assert.ok(hygiene.isGeneratedOutput(p), `${p} must be a generated output`);
    }
  });

  await test('implementation files are not classified as generated', () => {
    for (const p of ['src/retrieval/ranker.js', 'src/extractors/scan.js', 'scripts/mine-corpus.mjs',
      'gen-project-map.js', 'test/integration/all.js', 'README.md', 'gen-context.config.json', 'lib/llms.js']) {
      assert.ok(!hygiene.isGeneratedOutput(p), `${p} must not be a generated output`);
      assert.ok(!hygiene.isMinedNoise(p), `${p} must not be mined noise`);
    }
  });

  await test('the bundle is mined noise but not a generated output (it holds a hand-written CLI core)', () => {
    assert.strictEqual(hygiene.isBundle('gen-context.js'), true);
    assert.strictEqual(hygiene.isMinedNoise('gen-context.js'), true);
    assert.strictEqual(hygiene.isGeneratedOutput('gen-context.js'), false,
      'a hand-labelled task may legitimately name the bundle for its CLI core');
    assert.strictEqual(hygiene.isBundle('vendor/gen-context.js'), false, 'only the root bundle is the bundle');
  });

  // ── the miner ─────────────────────────────────────────────────────────────

  await test('the miner labels the real source file, not the bundle that regenerates with it', () => {
    const tasks = mine(bundledRepo());
    assert.ok(tasks.length >= 1, 'the focused source commit must still yield a task');
    for (const t of tasks) {
      assert.ok(!t.expected_files.includes('gen-context.js'), `${t.id} labels the bundle: ${JSON.stringify(t.expected_files)}`);
      assert.ok(!t.expected_files.includes('llms.txt'), `${t.id} labels a generated output`);
    }
    const engine = tasks.find((t) => /upstream connection/.test(t.query));
    assert.ok(engine, 'the engine commit must be mined');
    assert.deepStrictEqual(engine.expected_files, ['src/engine.js']);
  });

  await test('generated churn no longer drags a real file under the focus threshold', () => {
    // src/engine.js is ~8% of this commit's churn WITH the bundle and llms.txt
    // counted, ~100% without them. Before the fix this commit was unfocused.
    const tasks = mine(bundledRepo());
    assert.ok(tasks.some((t) => t.expected_files.includes('src/pool.js')), 'the pool commit must be mined too');
  });

  await test('--limit bounds the history scanned; the default is the whole history', () => {
    const dir = bundledRepo();
    assert.strictEqual(mine(dir, ['--limit', '1']).length, 1, '--limit 1 considers only the newest commit');
    assert.strictEqual(mine(dir).length, 2, 'the default considers every commit');
  });

  // ── the corpus check ──────────────────────────────────────────────────────

  await test('check-corpus rejects a mined task whose expected file is a generated output', () => {
    const file = path.join(tmp('sigmap-check-'), 'mined.jsonl');
    fs.writeFileSync(file, JSON.stringify({ id: 'x1', split: 'hard', source: 'git', sha: 'deadbeef',
      query: 'keep every session alive across a flaky network', expected_files: ['gen-context.js'], repo: '.' }) + '\n');
    const r = spawnSync('node', [CHECKER, file], { cwd: ROOT, encoding: 'utf8' });
    assert.notStrictEqual(r.status, 0, 'a mined task labelled with the bundle must fail the check');
    assert.match(r.stdout, /GENERATED OUTPUT as expected file: gen-context\.js/);
  });

  await test('check-corpus rejects a generated output in ANY corpus, and allows the bundle only when hand-labelled', () => {
    const dir = tmp('sigmap-check-');
    const bad = path.join(dir, 'hand.jsonl');
    fs.writeFileSync(bad, JSON.stringify({ id: 'x2', query: 'keep every session alive across a flaky network',
      expected_files: ['llms.txt'], repo: '.' }) + '\n');
    const r1 = spawnSync('node', [CHECKER, bad], { cwd: ROOT, encoding: 'utf8' });
    assert.match(r1.stdout, /GENERATED OUTPUT as expected file: llms\.txt/);

    const ok = path.join(dir, 'hand-bundle.jsonl');
    fs.writeFileSync(ok, JSON.stringify({ id: 'x3', query: 'keep every session alive across a flaky network',
      expected_files: ['gen-context.js'], repo: '.' }) + '\n');
    const r2 = spawnSync('node', [CHECKER, ok], { cwd: ROOT, encoding: 'utf8' });
    assert.doesNotMatch(r2.stdout, /GENERATED OUTPUT/, 'a hand-labelled task may name the bundle for its CLI core');
  });

  // ── the committed corpora ─────────────────────────────────────────────────

  await test('no committed corpus labels a generated output as its answer', () => {
    const offenders = [];
    for (const f of fs.readdirSync(TASKS_DIR).filter((n) => n.endsWith('.jsonl'))) {
      for (const [i, l] of fs.readFileSync(path.join(TASKS_DIR, f), 'utf8').split('\n').filter(Boolean).entries()) {
        const t = JSON.parse(l);
        const bad = (t.expected_files || []).filter((e) => (t.source === 'git' ? hygiene.isMinedNoise(e) : hygiene.isGeneratedOutput(e)));
        if (bad.length) offenders.push(`${f}:${i + 1} ${t.id} -> ${bad.join(', ')}`);
      }
    }
    assert.deepStrictEqual(offenders, [], `generated outputs labelled as answers:\n  ${offenders.join('\n  ')}`);
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
