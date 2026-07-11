'use strict';

/**
 * Integration tests for call-graph Java/Go/Rust support (GR1 expansion, #471).
 *
 * Covers: per-language def extraction (functions, methods, constructors,
 * generics, receivers), the Rust lifetime-safe masker, cross-file edges via
 * the same-package (same-directory) scope, methodImpact/methodBlastRadius on
 * non-JS fixtures, and that JS/Python behavior is untouched.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const { extractDefs, maskRust, methodImpact } = require('../../src/graph/call-graph');
const { methodBlastRadius } = require('../../src/graph/blast-radius');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

function names(defs) { return (defs || []).map((d) => d.name).sort(); }

function withDir(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-cg-lang-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    for (const [rel, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, 'src', rel), content);
    }
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── def extraction ──────────────────────────────────────────────────────────

test('Go: functions and receiver methods extract; parenthesized returns handled', () => {
  const src = [
    'package main', '',
    'func Helper(x int) int {', '\treturn x + 1', '}', '',
    'func (s *Svc) Run(a, b int) (int, error) {', '\treturn Helper(a), nil', '}', '',
  ].join('\n');
  const defs = extractDefs('a.go', src);
  assert.deepStrictEqual(names(defs), ['Helper', 'Run']);
  const run = defs.find((d) => d.name === 'Run');
  assert.strictEqual(run.line, 7);
});

test('Java: constructor, generic method, plain method extract; control flow rejected', () => {
  const src = [
    'public class Foo {',
    '  public Foo(int x) {',
    '    init(x);',
    '  }',
    '  private static <T> T identity(T x) throws Exception {',
    '    return x;',
    '  }',
    '  void run() {',
    '    if (ready) {',
    '      identity(1);',
    '    }',
    '    while (busy) {',
    '      wait(10);',
    '    }',
    '    new Thread(() -> {}).start();',
    '  }',
    '}', '',
  ].join('\n');
  assert.deepStrictEqual(names(extractDefs('Foo.java', src)), ['Foo', 'identity', 'run']);
});

test('Rust: fn with generics/where and impl method extract; trait declaration skipped', () => {
  const src = [
    'struct S;',
    'impl S {',
    '    fn helper<T>(x: T) -> T where T: Clone {',
    '        x',
    '    }',
    "    pub fn run(&self, s: &'static str) -> u8 {",
    '        Self::helper(1);',
    '        1',
    '    }',
    '}',
    'trait T2 { fn decl(&self); }', '',
  ].join('\n');
  assert.deepStrictEqual(names(extractDefs('s.rs', src)), ['helper', 'run']);
});

test('maskRust: length-preserving; lifetimes untouched, char + string literals masked', () => {
  const src = "fn f<'a>(x: &'a str) -> &'a str { let c = 'x'; let s = \"lit()\"; x }";
  const masked = maskRust(src);
  assert.strictEqual(masked.length, src.length);
  assert.ok(masked.includes("&'a str"), 'lifetime corrupted');
  assert.ok(!masked.includes("'x'"), 'char literal not masked');
  assert.ok(!masked.includes('lit()'), 'string not masked');
});

test('JS and Python extraction unchanged', () => {
  assert.deepStrictEqual(names(extractDefs('a.js', 'function foo(a) {\n  return a;\n}\n')), ['foo']);
  assert.deepStrictEqual(names(extractDefs('a.py', 'def bar(a):\n    return a\n')), ['bar']);
});

// ── cross-file edges + consumers ────────────────────────────────────────────

test('Go: same-package cross-file call produces a caller edge (no import statement)', () => {
  withDir({
    'util.go': 'package main\n\nfunc Helper(x int) int {\n\treturn x + 1\n}\n',
    'app.go': 'package main\n\nfunc Run(a int) int {\n\treturn Helper(a)\n}\n',
  }, (dir) => {
    const r = methodImpact('Helper', dir);
    assert.strictEqual(r.unresolved, false);
    assert.deepStrictEqual(r.direct, ['src/app.go#Run']);
  });
});

test('Java: same-package cross-file call resolves; methodBlastRadius scores it', () => {
  withDir({
    'Util.java': 'public class Util {\n  static int helper(int x) {\n    return x + 1;\n  }\n}\n',
    'App.java': 'public class App {\n  int run(int a) {\n    return helper(a);\n  }\n}\n',
  }, (dir) => {
    const r = methodImpact('helper', dir);
    assert.deepStrictEqual(r.direct, ['src/App.java#run']);
    const mb = methodBlastRadius(['src/Util.java'], dir);
    assert.strictEqual(mb.available, true);
    const f = mb.files.find((x) => x.file === 'src/Util.java');
    assert.ok(f && f.directCallers === 1 && f.tier === 'low', JSON.stringify(f));
  });
});

test('Rust: same-file impl call produces a caller edge', () => {
  withDir({
    'lib.rs': [
      'fn helper(x: u8) -> u8 {', '    x + 1', '}',
      'pub fn run(a: u8) -> u8 {', '    helper(a)', '}', '',
    ].join('\n'),
  }, (dir) => {
    const r = methodImpact('helper', dir);
    assert.deepStrictEqual(r.direct, ['src/lib.rs#run']);
  });
});

test('JS fixture still resolves (no regression from the language dispatch)', () => {
  withDir({
    'util.js': 'function helper(x) {\n  return x + 1;\n}\nmodule.exports = { helper };\n',
    'app.js': "const { helper } = require('./util');\nfunction run(a) {\n  return helper(a);\n}\nmodule.exports = { run };\n",
  }, (dir) => {
    const r = methodImpact('helper', dir);
    assert.deepStrictEqual(r.direct, ['src/app.js#run']);
  });
});

console.log(`\ncall-graph-languages: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
