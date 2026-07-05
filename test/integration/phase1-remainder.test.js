'use strict';

/**
 * Phase 1 remainder (#425) — "bank the A":
 *   D8 — installed version pins appear in the generated context header
 *   G2 — `sigmap verify` is a working alias of `verify-ai-output` (flagship)
 *   G1 — public-benchmarks harness is present, self-consistent, and runnable
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const PB = path.join(ROOT, 'public-benchmarks');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-p1-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'app.js'),
    'function handle(request, response) { return response; }\nmodule.exports = { handle };\n');
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fx', version: '1.0.0', dependencies: { alpha: '^1', beta: '^2' } }));
  for (const [n, v] of [['alpha', '1.2.3'], ['beta', '2.0.0']]) {
    const d = path.join(dir, 'node_modules', n);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: n, version: v }));
  }
  return dir;
}
function gen(dir, config) {
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'),
    JSON.stringify({ srcDirs: ['src'], outputs: ['copilot'], ...config }));
  const r = spawnSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8' });
  const out = path.join(dir, '.github', 'copilot-instructions.md');
  return { res: r, text: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '' };
}

console.log('\nPhase 1 remainder (#425) tests\n');

// ── D8 — version pins in the context header ──────────────────────────────────
test('D8: header includes a ## versions section with sorted installed pins', () => {
  const dir = tmpRepo();
  try {
    const { text } = gen(dir);
    assert.ok(/## versions \(installed direct deps\)/.test(text), 'missing ## versions section');
    const alphaAt = text.indexOf('alpha@1.2.3');
    const betaAt = text.indexOf('beta@2.0.0');
    assert.ok(alphaAt !== -1 && betaAt !== -1, 'expected both pins present');
    assert.ok(alphaAt < betaAt, 'pins must be sorted');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('D8: versionPins:false suppresses the section', () => {
  const dir = tmpRepo();
  try {
    const { text } = gen(dir, { versionPins: false });
    assert.ok(!/## versions/.test(text), 'section should be absent when disabled');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('D8: no ## versions section when no deps are installed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-p1-nodep-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function f(x) { return x; }\nmodule.exports = { f };\n');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }));
    const { text } = gen(dir);
    assert.ok(!/## versions/.test(text), 'no deps → no section');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── G2 — `sigmap verify` alias ───────────────────────────────────────────────
test('G2: `verify` alias matches `verify-ai-output` (output + exit code)', () => {
  const dir = tmpRepo();
  try {
    gen(dir);
    const answer = path.join(dir, 'answer.md');
    fs.writeFileSync(answer, 'Uses `src/app.js` and calls `handle()`.\nAlso imports `src/ghost.js` and calls `nope()`.\n');
    const a = spawnSync('node', [SCRIPT, 'verify', 'answer.md', '--json'], { cwd: dir, encoding: 'utf8' });
    const b = spawnSync('node', [SCRIPT, 'verify-ai-output', 'answer.md', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(a.status, b.status, 'exit codes must match');
    assert.strictEqual(a.status, 1, 'fabrications must exit 1');
    assert.strictEqual(a.stdout.trim(), b.stdout.trim(), 'JSON output must be identical');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('G2: `verify` with no target prints its own usage name', () => {
  const r = spawnSync('node', [SCRIPT, 'verify'], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(r.status, 1);
  assert.ok(/Usage: sigmap verify </.test(r.stderr), 'usage should name the invoked alias');
});

test('G2: --help documents `verify` as the flagship', () => {
  const r = spawnSync('node', [SCRIPT, '--help'], { cwd: ROOT, encoding: 'utf8' });
  const help = (r.stdout || '') + (r.stderr || '');
  assert.ok(/\bverify <answer\.md>/.test(help), '--help must list `verify <answer.md>`');
});

// ── G1 — public benchmark harness ────────────────────────────────────────────
test('G1: harness files exist', () => {
  for (const f of ['repos.csv', 'queries.json', 'run.sh', 'score.mjs', 'README.md']) {
    assert.ok(fs.existsSync(path.join(PB, f)), `missing public-benchmarks/${f}`);
  }
});

test('G1: queries.json aligns with repos.csv and is well-formed', () => {
  const csv = fs.readFileSync(path.join(PB, 'repos.csv'), 'utf8').trim().split('\n');
  const header = csv.shift();
  assert.strictEqual(header, 'repo,url,commit,srcDirs', 'unexpected CSV header');
  const repos = csv.map((l) => l.split(',')[0]);
  const queries = JSON.parse(fs.readFileSync(path.join(PB, 'queries.json'), 'utf8'));
  let total = 0;
  for (const repo of repos) {
    assert.ok(Array.isArray(queries[repo]) && queries[repo].length > 0, `no queries for ${repo}`);
    for (const q of queries[repo]) {
      assert.ok(q.query && Array.isArray(q.expected_files) && q.expected_files.length, `bad query in ${repo}`);
      total++;
    }
    // each CSV row must have a 40-char pinned commit
    const row = csv.find((l) => l.startsWith(repo + ','));
    const commit = row.split(',')[2];
    assert.ok(/^[0-9a-f]{40}$/.test(commit), `${repo} commit not pinned`);
  }
  assert.ok(total >= 90, `expected ≥90 queries, got ${total}`);
});

test('G1: score.mjs runs, prints hit@5, and exits 1 with no repos cloned', () => {
  const r = spawnSync('node', [path.join(PB, 'score.mjs'), '--skip-run', '--repos-dir', '/tmp/sm-none-xyz'],
    { cwd: PB, encoding: 'utf8' });
  assert.strictEqual(r.status, 1, 'no scored queries → exit 1');
  assert.ok(/hit@5/.test(r.stdout), 'must print a hit@5 column');
  assert.ok(/AGGREGATE/.test(r.stdout), 'must print an aggregate row');
});

console.log(`\nPhase 1 remainder: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
