'use strict';

/**
 * Tests for Surgical Context Phase 1 — line anchors (issue #212).
 *
 * Top-level signatures carry a `:start-end` line anchor; indented members do
 * not. Line numbers must stay correct even when block comments / docstrings
 * appear before a declaration (the newline-preserving comment-strip fix).
 */

const path   = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
const ts   = require(path.join(ROOT, 'src', 'extractors', 'typescript'));
const py   = require(path.join(ROOT, 'src', 'extractors', 'python'));
const { lineAt, anchor, withAnchor } = require(path.join(ROOT, 'src', 'extractors', 'line-anchor'));

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

// ── line-anchor helper ────────────────────────────────────────────────────────

test('1. lineAt counts newlines (1-based)', () => {
  const s = 'a\nb\nc';
  assert.strictEqual(lineAt(s, 0), 1);
  assert.strictEqual(lineAt(s, 2), 2);   // index of 'b'
  assert.strictEqual(lineAt(s, 4), 3);   // index of 'c'
});

test('2. anchor / withAnchor format', () => {
  assert.strictEqual(anchor(5, 7), '  :5-7');
  assert.strictEqual(withAnchor('class X', 5, 7), 'class X  :5-7');
});

// ── TypeScript ────────────────────────────────────────────────────────────────

test('3. TS top-level function carries :start-end', () => {
  const src = `export function foo(): number {
  return 1;
}`;
  const sigs = ts.extract(src);
  assert.ok(sigs.some(s => /export function foo\(\) → number  :1-3$/.test(s)),
    `expected foo :1-3, got:\n${sigs.join('\n')}`);
});

test('4. TS indented members are NOT anchored', () => {
  const src = `export class Svc {
  doThing(x: string): void {}
}`;
  const sigs = ts.extract(src);
  const member = sigs.find(s => s.includes('doThing('));
  assert.ok(member, 'doThing member must be present');
  assert.ok(!/:\d+-\d+/.test(member), `member must not carry an anchor, got "${member}"`);
  const header = sigs.find(s => s.startsWith('export class Svc'));
  assert.ok(/:1-3$/.test(header), `class header must be anchored :1-3, got "${header}"`);
});

test('5. TS block-comment regression — newlines preserved, line numbers exact', () => {
  // Without the newline-preserving strip the 4-line comment would collapse and
  // shift foo's reported line up to ~1-2 instead of 5-7.
  const src = `/* multi
line
block
comment */
export function foo(): number {
  return 1;
}`;
  const sigs = ts.extract(src);
  assert.ok(sigs.some(s => s.includes('export function foo(') && s.endsWith(':5-7')),
    `expected foo anchored :5-7, got:\n${sigs.join('\n')}`);
});

test('6. TS interface anchor spans its block', () => {
  const src = `export interface Box {
  w: number;
  h: number;
}`;
  const sigs = ts.extract(src);
  assert.ok(sigs.some(s => s === 'export interface Box  :1-4'),
    `expected interface Box :1-4, got:\n${sigs.join('\n')}`);
});

// ── Python (regex fallback — no filePath forces the JS regex path) ─────────────

test('7. Python regex fallback anchors a function before the # hint', () => {
  const src = `def my_fn(x):
    """Docstring hint here."""
    return x`;
  const sigs = py.extract(src);
  const sig = sigs.find(s => s.includes('my_fn'));
  assert.ok(sig, 'my_fn must be present');
  assert.ok(/def my_fn\(x\)  :1-3  # Docstring hint here$/.test(sig),
    `anchor must precede hint, got "${sig}"`);
});

test('8. Python docstring regression — multiline docstring does not shift later lines', () => {
  const src = `def fn_a(x):
    """
    multi
    line
    doc
    """
    return x


def fn_b(y):
    return y`;
  const sigs = py.extract(src);
  // fn_a may carry a trailing "# hint" (the docstring's first line), so match
  // the anchor without anchoring to end-of-string.
  assert.ok(sigs.some(s => s.includes('def fn_a(x)  :1-7')),
    `expected fn_a :1-7, got:\n${sigs.join('\n')}`);
  assert.ok(sigs.some(s => /def fn_b\(y\)  :10-11$/.test(s)),
    `expected fn_b :10-11 (proves docstring newlines preserved), got:\n${sigs.join('\n')}`);
});

test('9. Python class header anchored, methods not', () => {
  const src = `class Svc:
    def do_it(self):
        return 1`;
  const sigs = py.extract(src);
  assert.ok(sigs.some(s => s === 'class Svc  :1-3'),
    `expected class Svc :1-3, got:\n${sigs.join('\n')}`);
  const method = sigs.find(s => s.includes('do_it'));
  assert.ok(method && !/:\d+-\d+/.test(method), `method must not be anchored, got "${method}"`);
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n--- line-anchors ---');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
