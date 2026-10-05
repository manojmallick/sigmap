'use strict';

/**
 * Extractor gaps found by the third-party gate (#900, from #893 §2).
 *
 * Each of these constructs made an extractor return ZERO signatures for a file
 * that is real implementation, so the file never reached the index and no
 * amount of ranking work could surface it:
 *
 *   C#     any `partial` type            — `public partial class Foo { … }`
 *   Swift  an attribute in the inheritance clause — `: @unchecked Sendable`
 *   TS/JS  `export default function f`, `export default class C`, and
 *          `export default <identifier>` naming a declaration that is itself
 *          not exported (vue-core's `pluginScoped.ts` ends `export default scopedPlugin`)
 *
 * Every case pairs the construct with its plain sibling, so a fix that only
 * "works" by loosening a regex into matching everything is caught.
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const dispatch = require(path.join(ROOT, 'src/extractors/dispatch'));
const csharp = require(path.join(ROOT, 'src/extractors/csharp'));
const swift = require(path.join(ROOT, 'src/extractors/swift'));
const typescript = require(path.join(ROOT, 'src/extractors/typescript'));
const javascript = require(path.join(ROOT, 'src/extractors/javascript'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/** The signature text with its trailing `  :start-end` anchor removed. */
const bare = (s) => s.replace(/\s+:\d+-\d+(\s+#.*)?$/, '');
const heads = (sigs) => sigs.map(bare);
const has = (sigs, text) => heads(sigs).includes(text);

// ── C# ─────────────────────────────────────────────────────────────────────

const CS_BODY = '    {\n        public void Bar(int x) { }\n    }\n}\n';
const cs = (decl) => `using System;\nnamespace N\n{\n    ${decl}\n${CS_BODY}`;

test('csharp: a plain class still extracts (control)', () => {
  const sigs = csharp.extract(cs('public class Foo'));
  assert.ok(has(sigs, 'class Foo'), JSON.stringify(sigs));
  assert.ok(has(sigs, '  Bar(int x) → void'), JSON.stringify(sigs));
});

for (const decl of [
  'public partial class Foo',
  'internal sealed partial class Foo',
  'public static partial class Foo',
  'public abstract partial class Foo',
  'partial class Foo',
  'protected partial class Foo',
]) {
  test(`csharp: \`${decl}\` extracts the type and its members`, () => {
    const sigs = csharp.extract(cs(decl));
    assert.ok(has(sigs, 'class Foo'), `type missing: ${JSON.stringify(sigs)}`);
    assert.ok(has(sigs, '  Bar(int x) → void'), `member missing: ${JSON.stringify(sigs)}`);
  });
}

test('csharp: partial struct, interface and record extract with their kind', () => {
  const struct = csharp.extract('namespace N\n{\n    public partial struct S\n    {\n        public void M() { }\n    }\n}\n');
  assert.ok(has(struct, 'struct S'), JSON.stringify(struct));
  const iface = csharp.extract('namespace N\n{\n    public partial interface IThing\n    {\n        void Run(int n);\n    }\n}\n');
  assert.ok(has(iface, 'interface IThing'), JSON.stringify(iface));
  const rec = csharp.extract('namespace N\n{\n    public partial record Pt\n    {\n        public int Dist() { return 0; }\n    }\n}\n');
  assert.ok(has(rec, 'record Pt'), JSON.stringify(rec));
});

test('csharp: a partial class in a file-scoped namespace extracts', () => {
  const sigs = csharp.extract('namespace N;\n\npublic partial class Foo : Base, IFoo\n{\n    public int Baz() { return 1; }\n}\n');
  assert.ok(has(sigs, 'class Foo'), JSON.stringify(sigs));
  assert.ok(sigs.some((s) => /^  Baz\(\)/.test(s)), JSON.stringify(sigs));
});

test('csharp: the two halves of a partial class each extract their own members', () => {
  const a = csharp.extract('public partial class Foo\n{\n    public void FromA() { }\n}\n');
  const b = csharp.extract('public partial class Foo\n{\n    public void FromB() { }\n}\n');
  assert.ok(a.some((s) => /FromA\(\)/.test(s)) && !a.some((s) => /FromB/.test(s)), JSON.stringify(a));
  assert.ok(b.some((s) => /FromB\(\)/.test(s)) && !b.some((s) => /FromA/.test(s)), JSON.stringify(b));
});

test('csharp: `partial` appearing as an ordinary word does not invent a type', () => {
  const sigs = csharp.extract('namespace N\n{\n    public class Foo\n    {\n        // a partial class is declared elsewhere\n        public void Bar() { var partial = 1; }\n    }\n}\n');
  assert.deepStrictEqual(heads(sigs).filter((s) => !s.startsWith(' ')), ['class Foo'], JSON.stringify(sigs));
});

// ── Swift ──────────────────────────────────────────────────────────────────

const sw = (decl) => `${decl} {\n    func f() {}\n}\n`;

test('swift: a plain inheritance clause still extracts (control)', () => {
  const sigs = swift.extract(sw('open class A: Sendable, P'));
  assert.ok(has(sigs, 'class A'), JSON.stringify(sigs));
  assert.ok(has(sigs, '  func f()'), JSON.stringify(sigs));
});

for (const [decl, kind, name] of [
  ['open class A: @unchecked Sendable, P', 'class', 'A'],
  ['public final class Pacer: @unchecked Sendable', 'class', 'Pacer'],
  ['struct S: @retroactive Equatable', 'struct', 'S'],
  ['final class B: NSObject, @preconcurrency P', 'class', 'B'],
  ['public actor Store: @unchecked Sendable', 'actor', 'Store'],
]) {
  test(`swift: \`${decl}\` extracts the type and its members`, () => {
    const sigs = swift.extract(sw(decl));
    assert.ok(has(sigs, `${kind} ${name}`), `type missing: ${JSON.stringify(sigs)}`);
    assert.ok(has(sigs, '  func f()'), `member missing: ${JSON.stringify(sigs)}`);
  });
}

test('swift: an `@` outside an inheritance clause does not turn a non-type into one', () => {
  const sigs = swift.extract('@MainActor\nfunc free() {}\nlet x = 1 // @unchecked Sendable\n');
  assert.deepStrictEqual(heads(sigs).filter((s) => /^(class|struct|actor)\b/.test(s)), [], JSON.stringify(sigs));
});

// ── TypeScript ─────────────────────────────────────────────────────────────

test('typescript: exported function and arrow still extract (control)', () => {
  const sigs = typescript.extract('export function foo(a: number): number {\n  return a\n}\nexport const bar = (b: string) => {\n  return b\n}\n');
  // TypeScript signatures carry parameter NAMES (and defaults), not their types.
  assert.ok(has(sigs, 'export function foo(a) → number'), JSON.stringify(sigs));
  assert.ok(has(sigs, 'export const bar = (b) =>'), JSON.stringify(sigs));
});

test('typescript: `export default function f` extracts', () => {
  const sigs = typescript.extract('export default function foo(a: number): number {\n  return a\n}\n');
  assert.ok(has(sigs, 'export default function foo(a) → number'), JSON.stringify(sigs));
  assert.match(sigs[0], /:1-3$/, 'anchor should span the declaration');
});

test('typescript: `export default async function f` extracts', () => {
  const sigs = typescript.extract('export default async function load(id: string) {\n  return id\n}\n');
  assert.ok(has(sigs, 'export default async function load(id)'), JSON.stringify(sigs));
});

test('typescript: `export default class C` extracts the class and its methods', () => {
  const sigs = typescript.extract('export default class Foo {\n  run(n: number) {}\n}\n');
  assert.ok(has(sigs, 'export default class Foo'), JSON.stringify(sigs));
  assert.ok(sigs.some((s) => /^ {2}run\(/.test(s)), JSON.stringify(sigs));
});

test('typescript: `export default <identifier>` resolves a non-exported function', () => {
  const sigs = typescript.extract('function scoped(opts: any) {\n  return opts\n}\nexport default scoped\n');
  assert.ok(has(sigs, 'export default function scoped(opts)'), JSON.stringify(sigs));
  assert.match(sigs[0], /:1-3$/, 'anchor is the declaration, not the export line');
});

test('typescript: `export default <identifier>` resolves a non-exported arrow', () => {
  const sigs = typescript.extract('const Foo = (props: any) => {\n  return props\n}\nexport default Foo\n');
  assert.ok(has(sigs, 'export default const Foo = (props) =>'), JSON.stringify(sigs));
});

test('typescript: ...including a typed arrow, the vue-core pluginScoped.ts shape', () => {
  const src = [
    "import type { PluginCreator } from 'postcss'",
    '',
    "const scopedPlugin: PluginCreator<string> = (id = '') => {",
    '  const shortId = id.replace(/^data-v-/, "")',
    '  return { postcssPlugin: "vue-sfc-scoped", Rule(rule) {} }',
    '}',
    '',
    'scopedPlugin.postcss = true',
    '',
    'export default scopedPlugin',
    '',
  ].join('\n');
  const sigs = typescript.extract(src);
  assert.ok(has(sigs, "export default const scopedPlugin = (id = '') =>"), JSON.stringify(sigs));
  assert.match(sigs[0], /:3-6$/, 'anchor spans the arrow body');
});

test('typescript: an imported identifier is not a declaration, so nothing is invented', () => {
  const sigs = typescript.extract("import foo from './foo'\nexport default foo\n");
  assert.deepStrictEqual(sigs, [], JSON.stringify(sigs));
});

test('typescript: an already-exported name is not emitted twice', () => {
  const sigs = typescript.extract('export const foo = (a: number) => {\n  return a\n}\nexport default foo\n');
  assert.strictEqual(heads(sigs).filter((s) => /\bfoo\b/.test(s)).length, 1, JSON.stringify(sigs));
});

test('typescript: `export default <call>(…)` and object literals stay unresolved', () => {
  const sigs = typescript.extract("import { defineComponent } from 'vue'\nexport default defineComponent({\n  name: 'x',\n})\n");
  assert.deepStrictEqual(sigs, [], JSON.stringify(sigs));
});

test('typescript: dispatch routes a .ts file with a default export through the same path', () => {
  const sigs = dispatch.extractFile('src/a.ts', 'export default function foo(a: number) {\n  return a\n}\n');
  assert.ok(has(sigs, 'export default function foo(a)'), JSON.stringify(sigs));
});

// ── JavaScript ─────────────────────────────────────────────────────────────

test('javascript: `export default function f` and the async form extract', () => {
  const sigs = javascript.extract('export default function foo(a) {\n  return a\n}\n');
  assert.ok(has(sigs, 'export default function foo(a)'), JSON.stringify(sigs));
  const asyncSigs = javascript.extract('export default async function load(id) {\n  return id\n}\n');
  assert.ok(has(asyncSigs, 'export default async function load(id)'), JSON.stringify(asyncSigs));
});

test('javascript: `export default <identifier>` resolves a non-exported arrow', () => {
  const sigs = javascript.extract('const foo = (a, b) => {\n  return a + b\n}\nexport default foo\n');
  assert.ok(has(sigs, 'export default const foo = (a, b) =>'), JSON.stringify(sigs));
});

test('javascript: `export default <identifier>` over a function declaration is still one signature', () => {
  const sigs = javascript.extract('function foo(a) {\n  return a\n}\nexport default foo\n');
  assert.strictEqual(heads(sigs).filter((s) => /\bfoo\b/.test(s)).length, 1, JSON.stringify(sigs));
});

test('javascript: `export default class` still extracts (control)', () => {
  const sigs = javascript.extract('export default class Foo {\n  run() {}\n}\n');
  assert.ok(has(sigs, 'export default class Foo'), JSON.stringify(sigs));
});

test('javascript: a default export of an imported identifier invents nothing', () => {
  const sigs = javascript.extract("import foo from './foo.js'\nexport default foo\n");
  assert.deepStrictEqual(sigs, [], JSON.stringify(sigs));
});

// ── #902: a function NAMED async is not an async function ──────────────────
// The first version of the export loops searched the whole match for the word
// `async`, so svelte's `export function async(node, …)` was listed as
// `export async function async(…)`. An extraction diff of v8.66.0's extractors
// against develop's over 9,512 files in the 50 benchmark clones found it: it was
// the only file that lost a signature. The modifier is a captured group now.

for (const [label, extract] of [['typescript', typescript.extract], ['javascript', javascript.extract]]) {
  test(`${label}: a function merely NAMED async is not listed as async (#902)`, () => {
    const sigs = extract('export function async(node, fn) {\n  return fn(node)\n}\n');
    assert.ok(has(sigs, 'export function async(node, fn)'), JSON.stringify(sigs));
    assert.ok(!heads(sigs).some((s) => /^export async function/.test(s)), `the name is not a modifier: ${JSON.stringify(sigs)}`);
  });

  test(`${label}: ...while the genuine modifier on a function of that name still counts (#902)`, () => {
    const sigs = extract('export async function async(node) {\n  return node\n}\n');
    assert.ok(has(sigs, 'export async function async(node)'), JSON.stringify(sigs));
  });

  test(`${label}: the default forms keep a function's name and its modifier apart (#902)`, () => {
    assert.ok(has(extract('export default function async(n) {\n  return n\n}\n'), 'export default function async(n)'));
    assert.ok(has(extract('export default async function async(n) {\n  return n\n}\n'), 'export default async function async(n)'));
    assert.ok(has(extract('export default function load(n) {\n  return n\n}\n'), 'export default function load(n)'), 'a plain default is not async');
  });

  test(`${label}: a name that merely contains "async" is not a modifier either (#902)`, () => {
    const sigs = extract('export function asyncMap(xs) {\n  return xs\n}\nexport async function loadAsync(a) {\n  return a\n}\n');
    assert.ok(has(sigs, 'export function asyncMap(xs)'), JSON.stringify(sigs));
    assert.ok(has(sigs, 'export async function loadAsync(a)'), JSON.stringify(sigs));
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
