'use strict';

/**
 * `fn(...array)` passes every element as a separate call argument, and V8
 * gives up at roughly 125,000 of them with "Maximum call stack size exceeded".
 * Any spread over a per-FILE array is therefore a crash waiting for a tree
 * that large — a git root at the home directory was enough (#855).
 *
 * The first report was `buildFileList` (`files.push(...found)`). Fixing only
 * that moved the crash one command along: `ask` died in the ranker
 * (`Math.max(...scores)`), `--analyze` in its table formatter, and the
 * dependency-graph walk and centrality had the same shape. Each is pinned here.
 *
 * Nothing below creates 150,000 real files — that takes ~10s on macOS. The
 * in-process cases build their inputs in memory; the CLI case fakes one huge
 * directory through a preload that answers `readdirSync` for it.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const GEN = path.join(ROOT, 'gen-context.js');

// Comfortably past the ~125k argument limit of a default-size stack.
const N = 150000;

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fakeEntries(n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = { name: `f${i}.js`, isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false };
  }
  return out;
}

// ── CLI file list (the reported frame) ─────────────────────────────────────

test(`generate survives a source dir of ${N} files`, () => {
  const repo = tmpDir('sigmap-huge-');
  const srcDir = path.join(repo, 'src');
  fs.mkdirSync(srcDir);
  fs.writeFileSync(path.join(repo, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'] }));

  // Answers `readdirSync(<repo>/src, { withFileTypes: true })` with N entries.
  // The files do not exist, so every later read fails and is skipped — the
  // file LIST is what this test is about.
  const preload = path.join(tmpDir('sigmap-huge-preload-'), 'huge-dir-preload.js');
  fs.writeFileSync(preload, [
    "'use strict';",
    "const fs = require('fs');",
    "const path = require('path');",
    'const HUGE = fs.realpathSync(process.env.SIGMAP_TEST_HUGE_DIR);',
    'const N = Number(process.env.SIGMAP_TEST_HUGE_COUNT);',
    'const real = fs.readdirSync;',
    'fs.readdirSync = function (dir, opts) {',
    '  let resolved = null;',
    '  try { resolved = fs.realpathSync(String(dir)); } catch (_) {}',
    '  if (resolved === HUGE && opts && opts.withFileTypes) {',
    '    const out = new Array(N);',
    '    for (let i = 0; i < N; i++) {',
    '      out[i] = { name: `f${i}.js`, isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false };',
    '    }',
    '    return out;',
    '  }',
    '  return real.apply(this, arguments);',
    '};',
    '',
  ].join('\n'));

  const res = spawnSync('node', ['-r', preload, GEN, '--cwd', repo], {
    cwd: repo,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { SIGMAP_TEST_HUGE_DIR: srcDir, SIGMAP_TEST_HUGE_COUNT: String(N) }),
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${res.stdout}\n${res.stderr}`;
  assert.ok(!/Maximum call stack size exceeded/.test(out), `stack overflow:\n${out.slice(-600)}`);
  assert.strictEqual(res.status, 0, `exit ${res.status}:\n${out.slice(-600)}`);
  // Proves the preload was hit — without it the run would pass on an empty dir.
  const walked = out.match(/of (\d+) source files/);
  assert.ok(walked && Number(walked[1]) >= N, `expected the ${N}-file tree to be walked:\n${out.slice(-600)}`);
});

// ── Dependency-graph walk ──────────────────────────────────────────────────

test(`dependency-graph walk survives a directory of ${N} files`, () => {
  const { buildFromCwd } = require(path.join(ROOT, 'src/graph/builder'));
  const repo = tmpDir('sigmap-huge-graph-');
  fs.mkdirSync(path.join(repo, 'src'));
  const srcDir = fs.realpathSync(path.join(repo, 'src'));

  const real = fs.readdirSync;
  fs.readdirSync = function (dir, opts) {
    let resolved = null;
    try { resolved = fs.realpathSync(String(dir)); } catch (_) {}
    if (resolved === srcDir && opts && opts.withFileTypes) return fakeEntries(N);
    return real.apply(this, arguments);
  };
  let graph;
  try {
    graph = buildFromCwd(repo, { srcDirs: ['src'] });
  } finally {
    fs.readdirSync = real;
  }
  assert.strictEqual(graph.forward.size, N);
});

// ── Ranker ─────────────────────────────────────────────────────────────────

test(`rank() survives an index of ${N} files`, () => {
  const { rank } = require(path.join(ROOT, 'src/retrieval/ranker'));
  const index = new Map();
  for (let i = 0; i < N; i++) index.set(`src/f${i}.js`, [`function handler${i}(req, res)  :1-1`]);
  const ranked = rank('upload handler', index, { topK: 5, learned: false });
  assert.ok(Array.isArray(ranked));
  assert.ok(ranked.length <= 5);
});

test('rank() confidence tiers are unchanged by the min/max rewrite', () => {
  const { rank } = require(path.join(ROOT, 'src/retrieval/ranker'));
  const index = new Map([
    ['src/auth/session.js', ['function validateToken(token)  :1-9', 'function refreshSession(id)  :11-20']],
    ['src/auth/login.js', ['function login(user, password)  :1-9']],
    ['src/util/format.js', ['function formatDate(d)  :1-4']],
  ]);
  const ranked = rank('validate session token', index, { topK: 3, learned: false });
  assert.strictEqual(ranked[0].file, 'src/auth/session.js');
  assert.strictEqual(ranked[0].confidence, 'high');
  for (const r of ranked) assert.ok(['high', 'medium', 'low'].includes(r.confidence), `confidence missing on ${r.file}`);
});

// ── Centrality ─────────────────────────────────────────────────────────────

test(`computeCentrality survives a graph of ${N} files`, () => {
  const { computeCentrality } = require(path.join(ROOT, 'src/graph/centrality'));
  const forward = new Map();
  for (let i = 0; i < N; i++) forward.set(`f${i}`, i ? [`f${i - 1}`] : []);
  const c = computeCentrality({ forward });
  assert.strictEqual(c.size, N);
  let max = 0;
  for (const v of c.values()) if (v > max) max = v;
  assert.strictEqual(max, 1, 'scores stay max-normalised to 1');
});

// ── --analyze table ────────────────────────────────────────────────────────

test(`formatAnalysisTable survives ${N} rows and keeps its column width`, () => {
  const { formatAnalysisTable } = require(path.join(ROOT, 'src/eval/analyzer'));
  const stats = [];
  for (let i = 0; i < N; i++) stats.push({ file: `src/f${i}.js`, extractor: 'javascript', sigs: 1, tokens: 10, covered: false });
  const widest = `src/f${N - 1}.js`;
  const table = formatAnalysisTable(stats, false);
  const header = table.slice(0, table.indexOf('\n'));
  assert.ok(header.startsWith(`| ${'File'.padEnd(widest.length)} |`), `File column not padded to the widest path: ${header}`);

  // Short paths still get the 4-character minimum the header needs.
  const small = formatAnalysisTable([{ file: 'a', extractor: 'javascript', sigs: 1, tokens: 1, covered: true }], false);
  assert.ok(small.startsWith('| File |'), small.slice(0, 20));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
