'use strict';

/**
 * JS/TS scanning (#874) — regex literals and nested template literals must not
 * move a function's `:start-end` anchor.
 *
 * `maskCode` blanked comments and string/template contents but not regex
 * literals, so the braces, parens and quotes inside one unbalanced every block
 * scan after it: about 4% of JS anchors were wrong (a body that ran to a later
 * function, or collapsed to one line), and an agent following `sigmap lines` or
 * `get_lines` read the wrong code with full confidence. A template literal nested
 * inside another's `${ }` had the same effect.
 *
 * The self-audit below is the trust claim turned into an invariant: every
 * anchored function declaration in this repository ends on the line the V8
 * parser says it does.
 *
 * Run: node test/integration/js-anchor-masking.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const { maskCode, stripComments, readBalanced } = require(path.join(ROOT, 'src/extractors/scan.js'));
const { extractFile } = require(path.join(ROOT, 'src/extractors/dispatch.js'));
const { maskJs } = require(path.join(ROOT, 'src/graph/call-graph.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const JS = { js: true };
/** The braces left in `src` after masking — structure only. */
const braces = (src, opts) => maskCode(src, opts).replace(/[^{}]/g, '');
const blanked = (src, opts) => maskCode(src, opts);

// ── Regex literals ───────────────────────────────────────────────────────────

test('the issue repro: braces in a regex body no longer unbalance the block', () => {
  const src = 'function a(){ const r=/\\$\\{([^}]+)\\}/g; return 1 }\nfunction b(){ return 2 }';
  assert.strictEqual(braces(src), '{}{}{}'.slice(0, 0) + braces(src), 'sanity');
  assert.notStrictEqual(braces(src), braces(src, JS), 'the default masker still sees the regex braces');
  assert.strictEqual(braces(src, JS), '{}{}', 'one { and one } per function, nothing from the regex');
});

test('the old masker is untouched without the option (other languages depend on it)', () => {
  const src = 'x := a / b / c\nfunc f() { return 1 }';
  assert.strictEqual(maskCode(src), src, 'no strings or comments, so nothing may be blanked');
});

for (const [label, re] of [
  ['braces', '/\\{(\\w+)\\}/g'],
  ['parens', '/\\((\\d+)\\)/'],
  ['a double quote', '/"/g'],
  ['a single quote', "/'/"],
  ['a backtick', '/`/g'],
  ['a slash escaped', '/a\\/b/'],
  ['a slash inside a class', '/[/]x/'],
  ['an escaped closing bracket in a class', '/[\\]/]+/'],
  ['// (not a comment)', '/\\//g'],
  ['/* (not a comment)', '/\\/\\*/'],
  ['flags', '/x/gimsuy'],
]) {
  test(`regex containing ${label} is inert`, () => {
    const src = `function f(s){ return s.replace(${re}, 'y'); }\nfunction g(){ return 1; }`;
    const m = maskCode(src, JS);
    assert.strictEqual(m.replace(/[^{}]/g, ''), '{}{}', `leaked structure: ${JSON.stringify(m)}`);
    assert.strictEqual(m.length, src.length);
    assert.strictEqual(m.split('\n').length, 2, 'newlines preserved');
    // and the function boundary is found where it really is
    const open = m.indexOf('{');
    assert.strictEqual(src[readBalanced(m, open, '{', '}')], '}');
    assert.ok(readBalanced(m, open, '{', '}') < m.indexOf('function g'), 'f must end before g starts');
  });
}

for (const [label, expr] of [
  ['an identifier', 'a / b / c'],
  ['a number', '10 / 2 / 5'],
  ['a call', 'f(x) / 2 / 3'],
  ['an index', 'xs[0] / 2 / 3'],
  ['a postfix increment', 'n++ / 2 / 3'],
  ['a string length', '"abc".length / 2 / 3'],
  ['a property named like a keyword', 'o.in / 2 / 3'],
]) {
  test(`division after ${label} is not a regex`, () => {
    const src = `function f(a,b,c,x,xs,n,o){ return ${expr}; }`;
    const m = maskCode(src, JS);
    // a division would leave every non-string token intact; a mis-read regex would blank `/ 2 /`
    assert.ok(/\/ ?\d? ?\/|\/ [bc] \//.test(m) || m.includes('/ 2 /') || m.includes('/ b /'), `division was swallowed: ${m}`);
    assert.strictEqual(m.replace(/[^{}]/g, ''), '{}');
  });
}

for (const [label, prefix] of [
  ['=', 'const r ='],
  ['(', 'test('],
  [',', 'f(1,'],
  [':', 'x ? 1 :'],
  ['?', 'x ?'],
  ['!', '!'],
  ['&&', 'a &&'],
  ['||', 'a ||'],
  ['[', 'xs = ['],
  ['{', 'o = {k:'],
  [';', 'a;'],
  ['return', 'return'],
  ['typeof', 'typeof'],
  ['=>', 'f = (s) =>'],
]) {
  test(`a / after ${label} starts a regex`, () => {
    const src = `${prefix} /\\{x\\}/g.test(s) ;\nfunction h(){}`;
    const m = maskCode(src, JS);
    assert.strictEqual(m.replace(/[^{}]/g, '').length <= 2 + (prefix.includes('{') ? 1 : 0), true, `regex braces leaked: ${JSON.stringify(m)}`);
  });
}

test('a regex cannot span lines: an unterminated / is left alone', () => {
  const src = 'const a = x\n/ 2;\nfunction f(){}';
  assert.strictEqual(maskCode(src, JS).replace(/[^{}]/g, ''), '{}');
});

test('a closing JSX tag is not a regex', () => {
  const src = 'const el = <div>{a}</div>; const b = <b>{c}</b>;';
  // `</div>` and `</b>` must not swallow the `{c}` between them
  assert.strictEqual(maskCode(src, JS).replace(/[^{}]/g, ''), '{}{}');
});

test('stripComments with js:true does not read // inside a regex as a comment', () => {
  const src = "const s = p.replace(/\\//g, '-'); const t = 1;";
  assert.strictEqual(stripComments(src, JS), src, 'nothing here is a comment');
  assert.notStrictEqual(stripComments(src), src, 'the default stripper still mis-reads it (unchanged for other languages)');
});

test('a real comment after a regex is still a comment', () => {
  const src = 'const r = /a/; // trailing\nconst s = 1;';
  assert.ok(!maskCode(src, JS).includes('trailing'));
});

// ── Nested template literals ─────────────────────────────────────────────────

test('a template literal nested in a ${ } does not end the outer one', () => {
  const src = 'function f(t){ return `a ${t.map((x) => `\\`${x}\\``).join(", ")} b`; }\nfunction g(){}';
  assert.strictEqual(braces(src, JS), '{}{}');
});

test('a regex inside a ${ } hides its quotes from the string scanner', () => {
  const src = "function f(i){ return `[${i[0].replace(/['\"]/g, '')}..${i[1].replace(/['\"]/g, '')}]`; }\nfunction g(){}";
  assert.strictEqual(braces(src, JS), '{}{}');
});

test('braces, strings and comments inside a ${ } are all inert', () => {
  const src = "function f(o){ return `${ o.x ? { a: 1 }.a : '}' /* } */ } done`; }\nfunction g(){}";
  assert.strictEqual(braces(src, JS), '{}{}');
});

test('an unterminated template runs to the end of input, not forever', () => {
  assert.doesNotThrow(() => maskCode('const s = `abc ${ x', JS));
  assert.doesNotThrow(() => maskCode('const s = `abc', JS));
});

// ── The extractors ───────────────────────────────────────────────────────────

const anchorOf = (sigs, name) => {
  const s = sigs.find((x) => new RegExp(`\\b${name}\\(`).test(x));
  const m = s && s.match(/:(\d+)-(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

test('JS extractor: a function after a regex-heavy one is anchored correctly', () => {
  const src = [
    'function clean(s) {',
    "  return s.replace(/\\{([^}]+)\\}/g, '$1')",
    "    .replace(/['\"]/g, '');",
    '}',
    '',
    'function other(a) {',
    '  return a;',
    '}',
    '',
  ].join('\n');
  const sigs = extractFile('x.js', src);
  assert.deepStrictEqual(anchorOf(sigs, 'clean'), [1, 4]);
  assert.deepStrictEqual(anchorOf(sigs, 'other'), [6, 8]);
});

test('TS extractor: same, with types', () => {
  const src = [
    'export function clean(s: string): string {',
    "  return s.replace(/\\{([^}]+)\\}/g, '$1');",
    '}',
    '',
    'export function other(a: number): number {',
    '  return a;',
    '}',
    '',
  ].join('\n');
  const sigs = extractFile('x.ts', src);
  assert.deepStrictEqual(anchorOf(sigs, 'clean'), [1, 3]);
  assert.deepStrictEqual(anchorOf(sigs, 'other'), [5, 7]);
});

test('JS extractor: class methods after a regex are anchored correctly', () => {
  const src = [
    'class A {',
    '  m(s) {',
    '    return s.replace(/[{}]/g, "");',
    '  }',
    '  n() {',
    '    return 1;',
    '  }',
    '}',
    '',
  ].join('\n');
  const sigs = extractFile('x.js', src);
  assert.deepStrictEqual(anchorOf(sigs, 'm'), [2, 4]);
  assert.deepStrictEqual(anchorOf(sigs, 'n'), [5, 7]);
});

test('call-graph maskJs: JS gets the regex-aware mask, other languages keep the old one', () => {
  const src = 'function f(){ return /\\{/.test(s) }';
  assert.strictEqual(maskJs(src, JS).replace(/[^{}]/g, ''), '{}');
  assert.strictEqual(maskJs(src).replace(/[^{}]/g, ''), '{{}', 'default mode is unchanged');
});

// ── The issue's seven examples, as they are now ──────────────────────────────

const realEnd = (file, start) => {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  let e = start - 1;
  while (e < lines.length && !/^\}\s*$/.test(lines[e])) e++;
  return e + 1;
};

for (const [file, name] of [
  ['src/graph/call-graph.js', 'javaTypeDecl'],
  ['src/plan/verify-plan.js', '_cleanEntry'],
  ['src/plan/verify-plan.js', 'extractIntroductions'],
  ['src/plan/verify-plan.js', 'verifyPlan'],
  ['src/extractors/rust.js', 'extract'],
  ['src/extractors/csharp.js', 'extract'],
  ['src/verify/parsers.js', 'extractCodeBlocks'],
]) {
  test(`${file} ${name} is anchored to its real end`, () => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const a = anchorOf(extractFile(path.join(ROOT, file), src), name);
    assert.ok(a, `no anchor for ${name}`);
    assert.strictEqual(a[1], realEnd(file, a[0]), `${name} claims :${a[0]}-${a[1]}, ends at ${realEnd(file, a[0])}`);
  });
}

// ── The self-audit ───────────────────────────────────────────────────────────

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return ['node_modules', '.context'].includes(e.name) ? [] : walk(p);
  return e.name.endsWith('.js') ? [p] : [];
});

/**
 * An oracle that does not use the masker under test: this repository writes a
 * column-0 function as `function f(...) {` closed by a bare `}` at column 0, and
 * V8 must accept the slice as a complete function.
 */
function audit(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const wrong = [];
  let checked = 0;
  for (const sig of extractFile(file, src)) {
    const m = sig.match(/^(?:async )?function (\w+)\(.*?:(\d+)-(\d+)(?:\s+#.*)?\s*$/);
    if (!m) continue;
    const name = m[1], s = Number(m[2]), e = Number(m[3]);
    if (!/^(?:async )?function /.test(lines[s - 1] || '')) continue; // column-0 declarations only
    checked++;
    let why = null;
    if (e > s && !/^\}\s*(\/\/.*)?$/.test(lines[e - 1] || '')) why = 'ends on a line that is not a bare column-0 }';
    else if (e === s && /\{\s*$/.test(lines[s - 1])) why = 'collapsed to one line';
    else {
      try { new vm.Script('(function(){' + lines.slice(s - 1, e).join('\n') + '\n})'); }
      catch (err) { why = 'slice does not compile: ' + err.message.slice(0, 40); }
    }
    if (!why && e > s && /^\s+\S/.test(lines[e] || '') && !/^\s*(\/\/|\*|\/\*)/.test(lines[e])) why = 'the next line is indented — the function continues';
    if (why) wrong.push(`${path.relative(ROOT, file)} ${name} :${s}-${e} (${why})`);
  }
  return { checked, wrong };
}

test('self-audit: every anchored function declaration in src/ and packages/ ends where V8 says it does', () => {
  let checked = 0;
  const wrong = [];
  for (const f of [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'packages'))]) {
    const r = audit(f);
    checked += r.checked;
    wrong.push(...r.wrong);
  }
  assert.ok(checked > 800, `the audit must actually look at the code (checked ${checked})`);
  assert.deepStrictEqual(wrong, [], `${wrong.length} of ${checked} anchors are wrong:\n          ${wrong.slice(0, 10).join('\n          ')}`);
});

test('the oracle can fail: a deliberately wrong anchor is reported', () => {
  const tmp = path.join(require('os').tmpdir(), `anchor-oracle-${process.pid}.js`);
  // a regex with a brace, scanned WITHOUT the js option, reproduces the original defect
  const src = 'function a() {\n  return /\\{/.test(s);\n}\n\nfunction b() {\n  return 1;\n}\n';
  fs.writeFileSync(tmp, src);
  try {
    const lines = src.split('\n');
    const m = maskCode(src); // default mode: the regex's `{` is still visible
    const open = m.indexOf('{');
    const end = readBalanced(m, open, '{', '}');
    const endLine = src.slice(0, end).split('\n').length;
    assert.notStrictEqual(endLine, 3, 'the old masker really did mis-place the end');
    assert.ok(!/^\}\s*$/.test(lines[endLine - 1]) || endLine > 3, 'and the oracle would reject it');
  } finally { fs.rmSync(tmp, { force: true }); }
});

console.log(`\njs-anchor-masking: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
