'use strict';

/**
 * #1072: the invented-name screen for change tasks is a rule of the builder, not a step done by hand afterwards.
 *
 *   1. the screen finds a name a hidden test destructures from a module that lacks it (and only that);
 *   2. it reproduces the study's own result on the saved data: c01, c02, c03, c07, c11 are rejected and c04, c05, c06, c09 accepted,
 *      c08 and c10 were left out for another reason (docs-vp/guide/agent-study.md, "Change tasks");
 *   3. the standalone script (now built on the same library) still prints the same fields on a tiny data root;
 *   4. build-change-tasks.mjs calls the screen before it runs any test.
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
function tmp(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-screen-'));
  for (const [rel, content] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), content); }
  return dir;
}
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });

(async () => {
  const lib = await import('../../scripts/lib/change-task-screen.mjs');
  const T = 'test/integration/t.test.js';

  await test('parses destructured requires: several names, a rename keeps the exported name, several requires', () => {
    const got = lib.destructuredRequires("const { a, b: bb, c } = require('../../src/m');\nconst { d } = require('../../src/n');\nconst z = require('x');\n");
    assert.deepStrictEqual(got, [{ names: ['a', 'b', 'c'], expr: "'../../src/m'" }, { names: ['d'], expr: "'../../src/n'" }]);
  });

  await test('a name the module does not have is reported as invented', () => {
    const dir = tmp({ 'src/m.js': 'module.exports = { a: 1 };\n' });
    try {
      const r = lib.screenHiddenTests(dir, [{ path: T, content: "const { a, b } = require('../../src/m');\n" }]);
      assert.deepStrictEqual(r, { invents: ['b'], unresolved: [] });
    } finally { rm(dir); }
  });

  await test('every name present: nothing invented', () => {
    const dir = tmp({ 'src/m.js': 'module.exports = { a: 1, b: 2 };\n' });
    try { assert.deepStrictEqual(lib.screenHiddenTests(dir, [{ path: T, content: "const { a, b } = require('../../src/m');\n" }]), { invents: [], unresolved: [] }); } finally { rm(dir); }
  });

  await test('a rename is judged by the exported name: { a: x, c: y } needs c', () => {
    const dir = tmp({ 'src/m.js': 'module.exports = { a: 1 };\n' });
    try { assert.deepStrictEqual(lib.screenHiddenTests(dir, [{ path: T, content: "const { a: x, c: y } = require('../../src/m');\n" }]).invents, ['c']); } finally { rm(dir); }
  });

  await test('a module that cannot be loaded is reported apart and is NOT counted as invented', () => {
    const dir = tmp({ 'src/m.js': 'module.exports = { a: 1 };\n' });
    try {
      const r = lib.screenHiddenTests(dir, [{ path: T, content: "const { q } = require('../../src/nope');\n" }]);
      assert.deepStrictEqual(r.invents, []);
      assert.strictEqual(r.unresolved.length, 1);
    } finally { rm(dir); }
  });

  await test('names are collected across several hidden tests, once each', () => {
    const dir = tmp({ 'src/m.js': 'module.exports = {};\n' });
    try {
      const r = lib.screenHiddenTests(dir, [
        { path: 'test/integration/a.test.js', content: "const { x, y } = require('../../src/m');\n" },
        { path: 'test/integration/b.test.js', content: "const { y, z } = require('../../src/m');\n" },
      ]);
      assert.deepStrictEqual(r.invents.sort(), ['x', 'y', 'z']);
    } finally { rm(dir); }
  });

  await test('the throwaway script is removed (the base tree is left as it was)', () => {
    const dir = tmp({ 'src/m.js': 'module.exports = { a: 1 };\n' });
    try {
      lib.screenHiddenTests(dir, [{ path: T, content: "const { a } = require('../../src/m');\n" }]);
      assert.ok(!fs.existsSync(path.join(dir, 'test/integration/__screen.js')));
    } finally { rm(dir); }
  });

  await test('answerable: not left out, and no invented name', () => {
    assert.strictEqual(lib.answerable({ ran: true, invents: [] }), true);
    assert.strictEqual(lib.answerable({ invents: [] }), true);
    assert.strictEqual(lib.answerable({ ran: true, invents: ['x'] }), false);
    assert.strictEqual(lib.answerable({ ran: false, invents: [] }), false);
  });

  await test("the study's own result: c01 c02 c03 c07 c11 rejected, c04 c05 c06 c09 accepted, c08 and c10 left out", () => {
    const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/agent-study/data/change-tasks.json'), 'utf8'));
    const verdict = (ids) => ids.map((id) => lib.answerable(saved.find((t) => t.id === id)));
    assert.deepStrictEqual(verdict(['c01', 'c02', 'c03', 'c07', 'c11']), [false, false, false, false, false]);
    assert.deepStrictEqual(verdict(['c04', 'c05', 'c06', 'c09']), [true, true, true, true]);
    assert.deepStrictEqual(verdict(['c08', 'c10']), [false, false]);
    assert.strictEqual(saved.find((t) => t.id === 'c08').leftOut.includes('umbrella'), true);
    assert.deepStrictEqual(saved.filter((t) => t.invents.length).map((t) => t.id), ['c01', 'c02', 'c03', 'c07', 'c11']);
  });

  await test('the standalone script, now on the library, prints the same fields for a tiny data root', () => {
    const root = tmp({
      'benchmarks/repos/r1/src/m.js': 'module.exports = { a: 1 };\n',
      'benchmarks/tasks/retrieval-xrepo.jsonl': `${JSON.stringify({ id: 'c01', issue: 1, parent: 'abc', repo: 'r1', query: 'title\nbody', expected_files: ['src/m.js'], hidden: [{ path: T, content: "const { a, zzz } = require('../../src/m');\n" }] })}\n`,
    });
    try {
      const r = spawnSync(process.execPath, [path.join(ROOT, 'benchmarks/agent-study/screen-change-tasks.mjs'), root], { encoding: 'utf8', timeout: 60000 });
      assert.strictEqual(r.status, 0, r.stderr);
      const [t] = JSON.parse(r.stdout);
      assert.deepStrictEqual({ id: t.id, invents: t.invents, unresolved: t.unresolved, ran: t.ran }, { id: 'c01', invents: ['zzz'], unresolved: [], ran: true });
      assert.deepStrictEqual(t.hiddenTests.map((h) => h.file), [T]);
    } finally { rm(root); }
  });

  await test('build-change-tasks.mjs applies the screen before it runs any test, and says why it left a task out', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/build-change-tasks.mjs'), 'utf8');
    assert.ok(src.includes("import { screenHiddenTests } from './lib/change-task-screen.mjs';"));
    const at = src.indexOf('screenHiddenTests(tmp, hidden)');
    const first = src.indexOf('runTests(tmp, files)');
    assert.ok(at > 0 && first > at, 'the screen must come before the first runTests call');
    assert.ok(/if \(screen\.invents\.length\) \{ note\(`the hidden tests need names the fix invents[^`]*`\); continue; \}/.test(src), 'a task whose tests invent a name is left out, not kept');
    assert.ok(/screenHiddenTests\(tmp, t\.hidden\)/.test(fs.readFileSync(path.join(ROOT, 'benchmarks/agent-study/screen-change-tasks.mjs'), 'utf8')));
  });

  console.log(`\nchange-task-screen: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
