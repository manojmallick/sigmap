'use strict';

/**
 * #1074, the demote branch of #976: `--callers` / `--callees` / `get_method_impact` say when a
 * symbol is in a language whose receiver calls (`x.m()`, `this.m()`, `self.m()`) the call graph
 * does not resolve, instead of printing "no caller found" as if it were a safe answer.
 *
 * Four things are pinned:
 *   1. the behaviour on real fixtures (TypeScript, Python, Go: a method with callers prints none
 *      and says why; a plain function call is still found);
 *   2. the shape: the note and the JSON `receiverCalls` field appear only where they apply, so every
 *      other result keeps its text and its keys;
 *   3. the table is derived from the saved SCIP report (benchmarks/reports/callgraph-accuracy.json)
 *      and fails if the two disagree, so the claim cannot go stale;
 *   4. the CLI and the MCP tool print the same note.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const { methodImpact, methodCallees, formatCallGraph, formatCallGraphJSON } = require('../../src/graph/call-graph');
const support = require('../../src/graph/language-support');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; } catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}

function withDir(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-rc-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    for (const [rel, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'src', rel), content);
    fn(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const TS = [
  'export class Repo {',
  '  save(x: number) { return x; }',
  '  helper() { return this.save(1); }',
  '}',
  'export function freeFn(n: number) { return n + 1; }',
  'export function useAll() { const r = new Repo(); r.save(2); return freeFn(3); }',
  '',
].join('\n');
const PY = [
  'class Repo:',
  '    def save(self, x):',
  '        return x',
  '    def helper(self):',
  '        return self.save(1)',
  '',
  'def free_fn(n):',
  '    return n + 1',
  '',
  'def use_all():',
  '    r = Repo()',
  '    r.save(2)',
  '    return free_fn(3)',
  '',
].join('\n');
const GO = [
  'package main',
  '',
  'type Repo struct{}',
  '',
  'func (r *Repo) Save(x int) int { return x }',
  'func (r *Repo) Helper() int { return r.Save(1) }',
  'func FreeFn(n int) int { return n + 1 }',
  'func UseAll() int { r := &Repo{}; r.Save(2); return FreeFn(3) }',
  '',
].join('\n');
const JS = [
  'function helper(x) { return x + 1; }',
  'function run(a) { return helper(a); }',
  'module.exports = { helper, run };',
  '',
].join('\n');

// 1. behaviour ---------------------------------------------------------------------------------
for (const [label, file, src, method, free, caller, labelText] of [
  ['TypeScript', 'a.ts', TS, 'src/a.ts#save', 'src/a.ts#freeFn', 'src/a.ts#useAll', 'TypeScript'],
  ['Python', 'a.py', PY, 'src/a.py#save', 'src/a.py#free_fn', 'src/a.py#use_all', 'Python'],
  ['Go', 'a.go', GO, 'src/a.go#Save', 'src/a.go#FreeFn', 'src/a.go#UseAll', 'Go'],
]) {
  test(`${label}: a method called through a receiver has no edge and the output says why`, () => {
    withDir({ [file]: src }, (dir) => {
      const r = methodImpact(method, dir);
      assert.strictEqual(r.total, 0, 'the receiver calls draw no edge (that is what the note is about)');
      const text = formatCallGraph(r, 'callers');
      assert.match(text, /no caller found/);
      assert.ok(text.includes(`not resolved for ${labelText}`), text);
      assert.ok(text.includes('not evidence that nothing calls this'), text);
      assert.ok(text.includes('https://sigmap.io/guide/callgraph-accuracy'), text);
    });
  });
  test(`${label}: a plain function call is still found, and its output carries the note too`, () => {
    withDir({ [file]: src }, (dir) => {
      const r = methodImpact(free, dir);
      assert.deepStrictEqual(r.direct, [caller]);
      const text = formatCallGraph(r, 'callers');
      assert.ok(text.includes(`- \`${caller}\``), 'the list is kept');
      assert.ok(text.includes(`not resolved for ${labelText}`), 'a found list is still a lower bound for receiver calls');
    });
  });
}

test('callees get their own wording: the list leaves out calls made through a receiver', () => {
  withDir({ 'a.ts': TS }, (dir) => {
    const text = formatCallGraph(methodCallees('src/a.ts#useAll', dir), 'callees');
    assert.ok(text.includes('This list leaves out the calls this symbol makes through a receiver.'), text);
    assert.ok(!text.includes('not evidence that nothing calls this'), text);
  });
});

// 2. shape -------------------------------------------------------------------------------------
test('JavaScript output is byte-for-byte unchanged: no note, no receiverCalls key', () => {
  withDir({ 'a.js': JS }, (dir) => {
    const r = methodImpact('helper', dir);
    const text = formatCallGraph(r, 'callers');
    assert.ok(!/receiver/.test(text), text);
    assert.ok(!('receiverCalls' in formatCallGraphJSON(r, 'callers')));
  });
});

test('Rust, Kotlin and Scala are not claimed (not measured against a compiler index)', () => {
  for (const f of ['x.rs', 'x.kt', 'x.scala']) assert.deepStrictEqual(support.receiverCalls([`src/${f}#m`]), [], f);
});

test('an unresolved symbol keeps its existing answer and gains no receiver note', () => {
  withDir({ 'a.ts': TS }, (dir) => {
    const r = methodImpact('noSuchSymbol', dir);
    assert.ok(!/receiver/.test(formatCallGraph(r, 'callers')));
  });
});

test('Java is partial, TypeScript Python and Go are none, in first-seen order, one entry per language', () => {
  const got = support.receiverCalls(['a/B.java#m', 'x/y.ts#m', 'x/z.tsx#n', 'p/q.py#m', 'g/h.go#M']);
  assert.deepStrictEqual(got.map((e) => [e.language, e.resolved]), [['java', 'partial'], ['typescript', 'none'], ['python', 'none'], ['go', 'none']]);
  const text = support.receiverNote(got, 'callers');
  assert.ok(text.includes('not resolved for TypeScript, Python and Go'), text);
  assert.ok(text.includes('For Java they are resolved only where a declared type names'), text);
});

test('the JSON field carries the same facts and keeps lowerBound', () => {
  withDir({ 'a.py': PY }, (dir) => {
    const j = formatCallGraphJSON(methodImpact('src/a.py#save', dir), 'callers');
    assert.deepStrictEqual(j.receiverCalls, [{ language: 'python', resolved: 'none' }]);
    assert.strictEqual(j.lowerBound, true);
  });
});

// 3. the table is derived from the saved measurement -------------------------------------------
test('the receiver table equals what the saved SCIP report says (threshold, interval, size)', () => {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/reports/callgraph-accuracy.json'), 'utf8'));
  const derived = {};
  for (const [lang, g] of Object.entries(report.groups)) {
    const r = g.table && g.table.receiverOnly;
    if (!r || r.small) continue;                       // fewer than 100 edges: nothing is claimed
    const threshold = g.threshold && g.threshold.threshold;
    assert.strictEqual(threshold, 0.7, `${lang}: the registered threshold is 70%`);
    if (r.value >= threshold) continue;                // resolved well enough: no note
    derived[lang] = r.hi < 0.05 ? 'none' : 'partial';
  }
  assert.deepStrictEqual({ ...support.RECEIVER_CALLS }, derived,
    'RECEIVER_CALLS in src/graph/language-support.js must match benchmarks/reports/callgraph-accuracy.json; re-measure, then update both');
});

test('every extension the note covers is one the call graph reads, and each flagged language has an extension', () => {
  const { CALL_GRAPH_EXTS } = require('../../src/graph/call-graph');
  for (const ext of Object.keys(support.RECEIVER_EXT)) assert.ok(CALL_GRAPH_EXTS.has(ext), `${ext} is not read by the call graph`);
  for (const lang of Object.keys(support.RECEIVER_CALLS)) assert.ok(Object.values(support.RECEIVER_EXT).includes(lang), `${lang} has no extension`);
  assert.strictEqual(support.RECEIVER_EXT['.pyw'], 'python', '.pyw is a Python file the graph reads');
});

// 4. CLI and MCP -------------------------------------------------------------------------------
test('the CLI prints the note, and --json carries receiverCalls', () => {
  withDir({ 'a.ts': TS }, (dir) => {
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'] }));
    const run = (extra) => spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--callers', 'src/a.ts#save', ...extra], { cwd: dir, encoding: 'utf8', timeout: 60000 });
    const human = run([]);
    assert.strictEqual(human.status, 0, human.stderr);
    assert.ok(human.stdout.includes('not resolved for TypeScript'), human.stdout);
    const json = JSON.parse(run(['--json']).stdout);
    assert.deepStrictEqual(json.receiverCalls, [{ language: 'typescript', resolved: 'none' }]);
  });
});

test('the MCP tool prints the same note', () => {
  withDir({ 'a.go': GO }, (dir) => {
    const { getMethodImpact } = require('../../src/mcp/handlers');
    const out = getMethodImpact({ symbol: 'src/a.go#Save' }, dir);
    assert.ok(String(out).includes('not resolved for Go'), String(out));
  });
});

console.log(`\ncallgraph-receiver-caveat: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
