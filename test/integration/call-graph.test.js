'use strict';

/**
 * Method/caller-level call-graph (D4 v1, #429).
 *
 * Covers:
 *   buildCallGraph — symbol-level forward/reverse edges for JS/TS + Python
 *   call-site resolution — same-file first, then directly-imported files;
 *                          unresolved names produce no edge (precision)
 *   methodImpact / methodCallees — transitive blast radius with depth cap
 *   CLI — `--callers` / `--callees` (+ --json)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const cg = require(path.join(ROOT, 'src', 'graph', 'call-graph'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}

function mkproj(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-cg-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

console.log('\ncall-graph (D4 v1) tests\n');

// ── AC: a→b→c edges, reverse c→b→a ──────────────────────────────────────────
test('buildCallGraph yields forward a→b, b→c and reverse c→b, b→a', () => {
  const dir = mkproj({
    'src/a.js':
      'function c(x) { return x + 1; }\n' +
      'function b(x) { return c(x); }\n' +      // b calls c
      'function a(x) { return b(x); }\n' +      // a calls b (NOT c)
      'module.exports = { a, b, c };\n',
  });
  try {
    const g = cg.buildCallGraph(dir, { srcDirs: ['src'] });
    assert.deepStrictEqual(g.forward.get('src/a.js#a'), ['src/a.js#b'], 'a→b');
    assert.deepStrictEqual(g.forward.get('src/a.js#b'), ['src/a.js#c'], 'b→c');
    assert.deepStrictEqual(g.reverse.get('src/a.js#c'), ['src/a.js#b'], 'reverse c→b');
    assert.deepStrictEqual(g.reverse.get('src/a.js#b'), ['src/a.js#a'], 'reverse b→a');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── AC: method blast radius (transitive callers), depth cap ─────────────────
test('methodImpact returns transitive callers; --depth caps the walk', () => {
  const dir = mkproj({
    'src/a.js':
      'function c(x) { return x + 1; }\n' +
      'function b(x) { return c(x); }\n' +
      'function a(x) { return b(x); }\n',
  });
  try {
    const full = cg.methodImpact('c', dir, { srcDirs: ['src'] });
    assert.deepStrictEqual(full.direct, ['src/a.js#b'], 'direct caller of c is b');
    assert.deepStrictEqual(full.transitive, ['src/a.js#a'], 'transitive caller of c is a');
    assert.strictEqual(full.total, 2);

    const d1 = cg.methodImpact('c', dir, { srcDirs: ['src'], depth: 1 });
    assert.deepStrictEqual(d1.direct, ['src/a.js#b']);
    assert.deepStrictEqual(d1.transitive, [], 'depth 1 stops before transitive');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── AC: cross-file resolution prefers imported files; unresolved → no edge ──
test('call resolves into a directly-imported file; unknown names produce no edge', () => {
  const dir = mkproj({
    'src/util.js': 'function helper(x) { return x; }\nmodule.exports = { helper };\n',
    'src/main.js':
      "const { helper } = require('./util');\n" +
      'function run(x) { return helper(x) + notARepoSymbol(x); }\n' +  // helper resolves, notARepoSymbol does not
      'module.exports = { run };\n',
  });
  try {
    const g = cg.buildCallGraph(dir, { srcDirs: ['src'] });
    assert.deepStrictEqual(g.forward.get('src/main.js#run'), ['src/util.js#helper'],
      'run→util.js#helper only (notARepoSymbol has no def → no edge)');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── AC: same name in two files resolves to the local def, not the other ─────
test('same-file definition wins over an unrelated same-name def elsewhere', () => {
  const dir = mkproj({
    'src/x.js': 'function shared() { return 1; }\nfunction caller() { return shared(); }\n',
    'src/y.js': 'function shared() { return 2; }\n',   // unrelated, not imported by x.js
  });
  try {
    const g = cg.buildCallGraph(dir, { srcDirs: ['src'] });
    assert.deepStrictEqual(g.forward.get('src/x.js#caller'), ['src/x.js#shared'],
      'caller→x.js#shared (local), not y.js#shared');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── AC: Python def/method calls ─────────────────────────────────────────────
test('Python def calls are captured (main→helper)', () => {
  const dir = mkproj({
    'src/mod.py':
      'def helper(n):\n    return n * 2\n\n' +
      'def main(n):\n    return helper(n) + helper(n + 1)\n',
  });
  try {
    const g = cg.buildCallGraph(dir, { srcDirs: ['src'] });
    assert.deepStrictEqual(g.forward.get('src/mod.py#main'), ['src/mod.py#helper']);
    const imp = cg.methodImpact('helper', dir, { srcDirs: ['src'] });
    assert.deepStrictEqual(imp.direct, ['src/mod.py#main']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── AC: masker ignores calls inside strings/comments ────────────────────────
test('calls inside strings and comments are not counted as edges', () => {
  const dir = mkproj({
    'src/a.js':
      'function target() { return 1; }\n' +
      'function q() {\n' +
      '  const s = "target()";  // target()\n' +   // both are noise, not calls
      '  return 0;\n' +
      '}\n',
  });
  try {
    const g = cg.buildCallGraph(dir, { srcDirs: ['src'] });
    assert.ok(!(g.forward.get('src/a.js#q') || []).includes('src/a.js#target'),
      'q must NOT call target (only appears in a string + comment)');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── AC: unresolved symbol reported cleanly ──────────────────────────────────
test('methodImpact on an unknown symbol reports unresolved', () => {
  const dir = mkproj({ 'src/a.js': 'function a() { return 1; }\n' });
  try {
    const r = cg.methodImpact('doesNotExist', dir, { srcDirs: ['src'] });
    assert.strictEqual(r.unresolved, true);
    assert.strictEqual(r.total, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── AC: CLI --callers / --callees ───────────────────────────────────────────
test('CLI --callers prints method blast radius; --callees --json emits edges', () => {
  const dir = mkproj({
    'gen-context.config.json': JSON.stringify({ srcDirs: ['src'] }),
    'src/a.js':
      'function c(x) { return x; }\n' +
      'function b(x) { return c(x); }\n' +
      'function a(x) { return b(x); }\n',
  });
  try {
    const callers = spawnSync('node', [SCRIPT, '--callers', 'c'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(callers.status, 0);
    assert.ok(/Callers: `c`/.test(callers.stdout), 'has header');
    assert.ok(/src\/a\.js#b/.test(callers.stdout) && /src\/a\.js#a/.test(callers.stdout),
      'lists b (direct) and a (transitive)');

    const callees = spawnSync('node', [SCRIPT, '--callees', 'a', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(callees.status, 0);
    const j = JSON.parse(callees.stdout);
    assert.strictEqual(j.kind, 'callees');
    assert.ok(j.direct.includes('src/a.js#b'), 'a directly calls b');
    assert.ok(j.transitive.includes('src/a.js#c'), 'a transitively calls c');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI --callers with no symbol exits 1 with usage', () => {
  const r = spawnSync('node', [SCRIPT, '--callers'], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(r.status, 1);
  assert.ok(/requires a symbol/.test(r.stderr));
});

test('--help documents the call-graph flags', () => {
  const r = spawnSync('node', [SCRIPT, '--help'], { cwd: ROOT, encoding: 'utf8' });
  const help = (r.stdout || '') + (r.stderr || '');
  assert.ok(/--callers <symbol>/.test(help) && /--callees <symbol>/.test(help));
});

console.log(`\ncall-graph: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
