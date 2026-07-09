'use strict';

/**
 * Integration tests for `sigmap review-pr` (Gap 2, step 4).
 *   reviewPr: missing-tests / security-file / god-node / scope-drift · CLI (git diff)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { reviewPr } = require(path.join(ROOT, 'src/review/review-pr'));
const { buildPrEvidence, formatPrEvidenceMarkdown } = require(path.join(ROOT, 'src/review/pr-evidence'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

// ── reviewPr (pure) ─────────────────────────────────────────────────────────
test('missing-tests: source changed without matching test', () => {
  const r = reviewPr([{ path: 'src/foo.js', status: 'M' }], process.cwd());
  assert.ok(r.findings.some((f) => f.type === 'missing-tests' && f.file === 'src/foo.js'));
});
test('no missing-tests when a matching test changed', () => {
  const r = reviewPr([
    { path: 'src/foo.js', status: 'M' },
    { path: 'test/foo.test.js', status: 'M' },
  ], process.cwd());
  assert.ok(!r.findings.some((f) => f.type === 'missing-tests'));
});
test('security-file: flags sensitive paths (path heuristic, basis recorded)', () => {
  const r = reviewPr([
    { path: '.env', status: 'M' },
    { path: '.github/workflows/ci.yml', status: 'M' },
    { path: 'package.json', status: 'M' },
    { path: 'src/auth/login.js', status: 'M' },
  ], process.cwd(), { readFile: () => '' });
  const secFindings = r.findings.filter((f) => f.type === 'security-file');
  const sec = secFindings.map((f) => f.file);
  assert.ok(sec.includes('.env'));
  assert.ok(sec.includes('.github/workflows/ci.yml'));
  assert.ok(sec.includes('package.json'));
  // honest labeling: the finding declares it is a path heuristic, not a scan
  assert.ok(secFindings.every((f) => f.basis === 'path-heuristic'), 'security-file must record basis: path-heuristic');
});

test('secret-detected: content scan flags a hardcoded key in an innocent file', () => {
  const r = reviewPr([{ path: 'src/utils.js', status: 'M' }], process.cwd(), {
    readFile: () => 'const k = "AKIAABCDEFGHIJKLMNOP";\n', // AWS-access-key shaped
  });
  const hits = r.findings.filter((f) => f.type === 'secret-detected');
  assert.strictEqual(hits.length, 1, `expected one secret finding, got ${JSON.stringify(r.findings)}`);
  assert.strictEqual(hits[0].secret, 'AWS Access Key');
  assert.strictEqual(hits[0].basis, 'content-scan');
  assert.strictEqual(r.summary.ok, false, 'a detected secret must fail the review');
});

test('secret-detected: clean content produces no secret finding', () => {
  const r = reviewPr([{ path: 'src/utils.js', status: 'M' }], process.cwd(), {
    readFile: () => 'function add(a, b) { return a + b; }\n',
  });
  assert.ok(!r.findings.some((f) => f.type === 'secret-detected'));
});
test('deletions are ignored for security + source checks', () => {
  const r = reviewPr([{ path: '.env', status: 'D' }, { path: 'src/foo.js', status: 'D' }], process.cwd());
  assert.ok(!r.findings.some((f) => f.type === 'security-file'));
  assert.ok(!r.findings.some((f) => f.type === 'missing-tests'));
});
test('scope-drift: too many top-level dirs', () => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f'].map((d) => ({ path: `${d}/x.js`, status: 'M' }));
  const r = reviewPr(files, process.cwd(), { scopeThreshold: 5 });
  assert.ok(r.findings.some((f) => f.type === 'scope-drift' && f.count === 6));
});
test('summary: byType + ok=false when findings present', () => {
  const r = reviewPr([{ path: '.env', status: 'M' }], process.cwd());
  assert.strictEqual(r.summary.ok, false);
  assert.strictEqual(r.summary.byType['security-file'], 1);
});
test('summary: ok=true when clean', () => {
  const r = reviewPr([
    { path: 'src/foo.js', status: 'M' },
    { path: 'src/foo.test.js', status: 'M' },
  ], process.cwd());
  assert.strictEqual(r.summary.ok, true);
  assert.strictEqual(r.findings.length, 0);
});

// ── CLI (real git repo) ─────────────────────────────────────────────────────
function withGitRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewpr-'));
  const g = (args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  try {
    g(['init', '-q']);
    g(['config', 'user.email', 't@t.t']);
    g(['config', 'user.name', 'T']);
    g(['commit', '--allow-empty', '-q', '-m', 'base']);
    fn(dir, g);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('CLI: review-pr --staged flags a sensitive file (exit 1)', () => {
  withGitRepo((dir, g) => {
    fs.writeFileSync(path.join(dir, '.env'), 'SECRET=1\n');
    g(['add', '.env']);
    const res = spawnSync('node', [SCRIPT, 'review-pr', '--staged'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1, res.stdout + res.stderr);
    assert.ok(/sensitive path/.test(res.stdout), res.stdout);
  });
});

test('CLI: review-pr --staged flags a hardcoded secret via content scan (exit 1)', () => {
  withGitRepo((dir, g) => {
    fs.mkdirSync(path.join(dir, 'src'));
    // innocently-named file, no test needed — the secret is the finding
    fs.writeFileSync(path.join(dir, 'src', 'config.js'), 'module.exports = { key: "AKIAABCDEFGHIJKLMNOP" };\n');
    fs.writeFileSync(path.join(dir, 'src', 'config.test.js'), 'require("./config");\n');
    g(['add', '-A']);
    const res = spawnSync('node', [SCRIPT, 'review-pr', '--staged'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1, res.stdout + res.stderr);
    assert.ok(/secret detected/.test(res.stdout), res.stdout);
  });
});
test('CLI: review-pr --staged clean (source + test) exits 0', () => {
  withGitRepo((dir, g) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'foo.js'), 'module.exports = 1;\n');
    fs.writeFileSync(path.join(dir, 'src', 'foo.test.js'), 'require("./foo");\n');
    g(['add', '-A']);
    const res = spawnSync('node', [SCRIPT, 'review-pr', '--staged'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    assert.ok(/no findings/.test(res.stdout));
  });
});
test('CLI: review-pr --json emits the result', () => {
  withGitRepo((dir, g) => {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}\n');
    g(['add', '-A']);
    const res = spawnSync('node', [SCRIPT, 'review-pr', '--staged', '--json'], { cwd: dir, encoding: 'utf8' });
    const data = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.ok(data.summary);
    assert.ok(Array.isArray(data.findings));
  });
});

// ── PR Evidence Report (G3) ─────────────────────────────────────────────────

/** Temp project with source files for signatures + blast radius. */
function withSrcProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prev-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'] }));
    fs.writeFileSync(path.join(dir, 'src', 'auth.js'), 'function login(u, p) { return true; }\nmodule.exports = { login };\n');
    fs.writeFileSync(path.join(dir, 'src', 'consumer.js'), 'const { login } = require("./auth");\nmodule.exports = () => login("a", "b");\n');
    fn(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('buildPrEvidence returns per-file structure + review', () => {
  withSrcProject((dir) => {
    const ev = buildPrEvidence([{ path: 'src/auth.js', status: 'M' }], dir, { scope: 'vs main' });
    const a = ev.files.find((f) => f.path === 'src/auth.js');
    assert.ok(a, 'auth.js entry missing');
    assert.strictEqual(a.riskLabel, 'auth');
    assert.ok(a.signatures.length >= 1, 'expected extracted signatures');
    assert.ok(a.blast && a.blast.total >= 1, 'expected blast radius (consumer imports auth)');
    assert.ok(ev.review && ev.review.summary, 'expected review summary');
    assert.strictEqual(ev.scope, 'vs main');
  });
});

test('formatPrEvidenceMarkdown is branded, deterministic, timestamp-free', () => {
  withSrcProject((dir) => {
    const md1 = formatPrEvidenceMarkdown(buildPrEvidence([{ path: 'src/auth.js', status: 'M' }], dir, { scope: 'vs main' }));
    const md2 = formatPrEvidenceMarkdown(buildPrEvidence([{ path: 'src/auth.js', status: 'M' }], dir, { scope: 'vs main' }));
    assert.strictEqual(md1, md2, 'report is not byte-stable');
    assert.ok(/^## 🔍 PR Evidence Report/.test(md1), 'missing branded header');
    assert.ok(/Blast radius:/.test(md1), 'missing blast radius');
    assert.ok(!/\d{4}-\d\d-\d\dT/.test(md1), 'report contains a wall-clock timestamp');
  });
});

test('CLI: review-pr --markdown emits the PR Evidence Report', () => {
  withGitRepo((dir, g) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'auth.js'), 'function login(u, p) { return true; }\nmodule.exports = { login };\n');
    g(['add', '-A']);
    const res = spawnSync('node', [SCRIPT, 'review-pr', '--markdown', '--staged'], { cwd: dir, encoding: 'utf8' });
    assert.ok(/## 🔍 PR Evidence Report/.test(res.stdout), res.stdout + res.stderr);
    assert.ok(/`src\/auth\.js`/.test(res.stdout), 'changed file not in report');
    assert.strictEqual(res.status, 1, 'auth.js with no test → finding → exit 1');
  });
});

console.log(`\nreview-pr: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
