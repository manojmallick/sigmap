'use strict';

/**
 * #996 — the TypeScript/JavaScript extractor stops dropping four common shapes.
 *
 * Four declaration shapes were dropped without a word, and `sigmap explain` then
 * gave a remedy that could not apply ("check that the file contains function/class
 * definitions" — the file contained exactly that). In zod 33% of the top-level
 * exports carry a `$`; generic arrows, factory-wrapped consts and CommonJS
 * `app.x = function` APIs are everywhere.
 *
 *   1. a `$` is part of a name (const, function, interface, type, class)
 *   2. generic, typed and curried arrow exports, and `export const x = factory(...)`
 *   3. an anonymous default export, function or arrow
 *   4. CommonJS assignment methods on the module's exported object
 *   5. what was already read is still read, byte for byte
 *   6. a run prints how many files with exports produced no signatures, and which
 *   7. `explain` says what the extractor saw instead of a remedy that cannot apply
 *
 * ADR 0002 stands: hand-written extractors, no tree-sitter. The point is to stop silent
 * loss, not to match the grammar.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const ts = require(path.join(ROOT, 'src', 'extractors', 'typescript'));
const js = require(path.join(ROOT, 'src', 'extractors', 'javascript'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

const has = (sigs, re) => sigs.some((s) => re.test(s));
const show = (sigs) => '\n' + sigs.map((s) => '    ' + s).join('\n');

const SCHEMAS = [
  'export const plainParse = (schema: unknown, value: unknown) => ({ schema, value });',
  'export const $parseCore = (schema: unknown, value: unknown) => ({ schema, value });',
  'export function $zodCheck(value: unknown) { return !!value; }',
  'export interface $ZodType { kind: string }',
  'export type $Infer = string;',
  'export class $ZodError extends Error {}',
  'export const plainOther = (a: number) => a + 1;',
  '',
].join('\n');

const FORMS = [
  'export const plain = (a: number) => a + 1;',
  'export const generic = <T>(x: T): T => x;',
  'export const curried: (e: Error) => Function = (e) => (a: unknown) => a;',
  "export const wrapped = makeThing('Name', (inst: unknown) => inst);",
  'export function named(a: number): number { return a; }',
  '',
].join('\n');

// ---------------------------------------------------------------------------
// 1. `$` is a name character
// ---------------------------------------------------------------------------
test('every $-prefixed declaration is read: const arrow, function, interface, type, class', () => {
  const sigs = ts.extract(SCHEMAS);
  assert.ok(has(sigs, /^export const \$parseCore = \(schema, value\) =>/), show(sigs));
  assert.ok(has(sigs, /^export function \$zodCheck\(value\)/), show(sigs));
  assert.ok(has(sigs, /^export interface \$ZodType\b/), show(sigs));
  assert.ok(has(sigs, /^export type \$Infer\b/), show(sigs));
  assert.ok(has(sigs, /^export class \$ZodError\b/), show(sigs));
  // and the plain names beside them are still there
  assert.ok(has(sigs, /^export const plainParse = /) && has(sigs, /^export const plainOther = /), show(sigs));
});

test('a file of nothing but $ names is no longer empty', () => {
  const sigs = ts.extract('export const $a = (x: number) => x;  export function $b(x: number) { return x; }  export interface $C { k: string }\n');
  assert.ok(has(sigs, /\$a\b/) && has(sigs, /\$b\b/) && has(sigs, /\$C\b/), show(sigs));
});

test('the JavaScript extractor reads $ names too', () => {
  const sigs = js.extract('export const $q = (a) => a;\nexport function $z(a) { return a; }\nfunction $helper(a) { return a; }\n');
  assert.ok(has(sigs, /\$q\b/) && has(sigs, /\$z\b/) && has(sigs, /\$helper\b/), show(sigs));
});

// ---------------------------------------------------------------------------
// 2. Arrow forms and factories
// ---------------------------------------------------------------------------
test('generic and typed/curried arrow exports are read, and the plain one is unchanged', () => {
  const sigs = ts.extract(FORMS);
  assert.ok(has(sigs, /^export const plain = \(a\) =>/), show(sigs));
  assert.ok(has(sigs, /^export const generic = \(x\) =>/), 'generic arrow: ' + show(sigs));
  assert.ok(has(sigs, /^export const curried = \(e\) =>/), 'typed, curried arrow: ' + show(sigs));
  assert.ok(has(sigs, /^export function named\(a\)/), show(sigs));
});

test('an export const bound to a factory call is a const entry: name and anchor, no body', () => {
  const sigs = ts.extract(FORMS);
  const w = sigs.find((s) => /^export const wrapped\b/.test(s));
  assert.ok(w, show(sigs));
  assert.ok(/makeThing\(\.\.\.\)/.test(w) && /:\d+-\d+$/.test(w), w);
  assert.ok(!/inst/.test(w), 'the body is not copied: ' + w);
});

test('a constant that is not a call, and an IIFE, add nothing', () => {
  const sigs = ts.extract("export const VERSION = '1.0.0';\nexport const LIMITS = { a: 1 };\nexport const ready = (() => 1)();\nexport const list = [1, 2];\n");
  assert.deepStrictEqual(sigs, [], show(sigs));
});

test('a zustand store is listed once, as before', () => {
  const sigs = ts.extract("export const useCartStore = create<CartState>()((set) => ({ items: [] }));\ninterface CartState { items: string[] }\n");
  assert.strictEqual(sigs.filter((s) => /useCartStore/.test(s)).length, 1, show(sigs));
});

// ---------------------------------------------------------------------------
// 3. Anonymous default exports
// ---------------------------------------------------------------------------
test('an anonymous default function and an anonymous default arrow are read', () => {
  const f = ts.extract('export default function () { return 1; }\n');
  assert.ok(has(f, /^export default function \(\)/), show(f));
  const g = ts.extract('export default async function (a: number) { return a; }\n');
  assert.ok(has(g, /^export default async function \(a\)/), show(g));
  const a = ts.extract('export default (ctx: Context) => ctx.value;\n');
  assert.ok(has(a, /^export default \(ctx\) =>/), show(a));
  const j = js.extract('export default function (req) { return req; }\n');
  assert.ok(has(j, /^export default function \(req\)/), show(j));
});

test('a named default export is still listed once under its name', () => {
  const sigs = ts.extract('export default function handler(a: number) { return a; }\n');
  assert.strictEqual(sigs.length, 1, show(sigs));
  assert.ok(/handler/.test(sigs[0]), sigs[0]);
});

// ---------------------------------------------------------------------------
// 4. CommonJS assignment methods
// ---------------------------------------------------------------------------
const APP = [
  'var app = module.exports = {};',
  'app.use = function use(fn) { return fn; };',
  'app.handle = function handle(req, res) { return req; };',
  'app.arrow = (a, b) => a + b;',
  'function helper(a) { return a; }',
  '',
].join('\n');

test('methods assigned onto the module\'s exported object are read', () => {
  const sigs = js.extract(APP);
  assert.ok(has(sigs, /^app\.use = function use\(fn\)/), show(sigs));
  assert.ok(has(sigs, /^app\.handle = function handle\(req, res\)/), show(sigs));
  assert.ok(has(sigs, /^app\.arrow = \(a, b\) =>/), show(sigs));
  assert.ok(has(sigs, /^function helper\(a\)/), 'the plain function is still there: ' + show(sigs));
});

test('exports.x, module.exports.x and an object that is exported later are read; a local object is not', () => {
  const sigs = js.extract([
    'exports.one = function () {};',
    'module.exports.two = function two(a) {};',
    'const api = {};',
    'api.three = function three() {};',
    'module.exports = api;',
    'const local = {};',
    'local.nope = function nope() {};',
    '',
  ].join('\n'));
  assert.ok(has(sigs, /^exports\.one = function \(\)/), show(sigs));
  assert.ok(has(sigs, /^module\.exports\.two = function two\(a\)/), show(sigs));
  assert.ok(has(sigs, /^api\.three = function three\(\)/), show(sigs));
  assert.ok(!has(sigs, /nope/), 'an object that is never exported is not the module\'s API: ' + show(sigs));
});

// ---------------------------------------------------------------------------
// 5. What was read before is read the same
// ---------------------------------------------------------------------------
test('shapes the extractor already read keep their exact signatures', () => {
  const src = [
    'export interface Options { name: string; run(a: number): void }',
    'export type Id = string;',
    'export enum Mode { A, B }',
    'export class Store extends Base { load(id: string) { return id; } }',
    'export async function fetchAll(a: number, b?: string): Promise<void> { }',
    'export const mapIt = async (a: number) => a;',
    'export default function main() {}',
    '',
  ].join('\n');
  const sigs = ts.extract(src);
  // The list below is what the extractor produced BEFORE #996 (taken from develop), anchors removed.
  assert.deepStrictEqual(sigs.map((s) => s.replace(/\s+:\d+-\d+$/, '')), [
    'export interface Options',
    '  name: string',
    'export type Id',
    'export enum Mode',
    'export class Store',
    '  load(id)',
    'export async function fetchAll(a, b?) → Promise<void>',
    'export default function main()',
    'export const mapIt = async (a) =>',
  ], show(sigs));
});

// ---------------------------------------------------------------------------
// 6-7. The run says what it could not read, and explain says what it saw
// ---------------------------------------------------------------------------
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-tsshapes-'));
let counter = 0;
function repo(files) {
  const dir = path.join(tmpRoot, `r${counter++}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"fx","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'] }));
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}
const sigmap = (dir, args = []) => spawnSync('node', [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });

const UNREAD = 'export default defineConfig({ plugins: [] });\n';

test('a run lists the files with exports that produced no signatures, and ignores barrels', () => {
  const dir = repo({
    'src/ok.ts': 'export function ok(a: number) { return a; }\n',
    'src/config.ts': UNREAD,
    'src/barrel.ts': "export * from './ok';\nexport { x } from './x';\nexport type { T } from './t';\n",
    'src/globals.d.ts': 'export declare const v: number;\n',
    'src/ok.test.ts': UNREAD,
  });
  const res = sigmap(dir);
  assert.strictEqual(res.status, 0, res.stderr);
  const out = res.stderr + res.stdout;
  assert.ok(/1 file with exports produced 0 signatures: src\/config\.ts/.test(out), out);
  assert.ok(!/barrel/.test(out) && !/globals\.d\.ts/.test(out) && !/ok\.test/.test(out), 'barrels, declarations and tests are not unindexed exporters: ' + out);
});

test('a run with nothing unread prints no such line', () => {
  const dir = repo({ 'src/ok.ts': 'export function ok(a: number) { return a; }\n' });
  const res = sigmap(dir);
  assert.ok(!/produced 0 signatures/.test(res.stderr + res.stdout), res.stderr);
});

test('explain on a file the extractor cannot read shows what it saw, not a remedy that cannot apply', () => {
  const dir = repo({ 'src/ok.ts': 'export function ok(a: number) { return a; }\n', 'src/config.ts': UNREAD });
  const res = sigmap(dir, ['explain', 'src/config.ts']);
  assert.ok(/EXCLUDED/.test(res.stdout), res.stdout);
  assert.ok(/1 export line/.test(res.stdout) && /export default defineConfig/.test(res.stdout), res.stdout);
  assert.ok(!/check that the file contains function\/class definitions/.test(res.stdout), 'the remedy that cannot help: ' + res.stdout);
  const json = JSON.parse(sigmap(dir, ['explain', 'src/config.ts', '--json']).stdout);
  assert.strictEqual(json.status, 'excluded');
  assert.ok(json.exports >= 1 && !/contains function\/class/.test(json.fix), JSON.stringify(json));
});

test('explain on a file with no exports keeps its remedy; on a $-only file it now includes', () => {
  const dir = repo({
    'src/plain.ts': '// nothing declared here\nconst x = 1;\n',
    'src/only-dollar.ts': 'export const $a = (x: number) => x;\nexport function $b(x: number) { return x; }\nexport interface $C { k: string }\n',
  });
  assert.ok(/check that the file contains function\/class definitions/.test(sigmap(dir, ['explain', 'src/plain.ts']).stdout));
  const d = sigmap(dir, ['explain', 'src/only-dollar.ts']).stdout;
  assert.ok(/INCLUDED/.test(d) && !/check that the file contains/.test(d), d);
});

// ─── 8. a long string literal must not make the scan quadratic ──────────────────────────────
// The first version asked "does `export` begin a statement" with `(?<=[;}][ \t]*)`. V8 up to
// Node 22 walks back over the whole run of blanks at every position, and a string literal is
// masked to blanks before the scan: excalidraw's 790 KB base64 wasm module ran for more than ten
// minutes in CI and timed the job out. Node 25 optimises it away, so a clock alone proves nothing
// on a laptop — the first test reads the mechanism, the second the clock.

const { atStatementStart } = require(path.join(ROOT, 'src', 'util', 'statement-start'));

test('the TypeScript and JavaScript extractors use no lookbehind (it walks back over a blank run at every position)', () => {
  for (const f of ['typescript.js', 'javascript.js']) {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'extractors', f), 'utf8');
    const hit = src.split('\n').findIndex((l) => /\(\?<[=!]/.test(l));
    assert.strictEqual(hit, -1, `${f}:${hit + 1} has a lookbehind`);
  }
});

test('a 1 MB string literal does not stall extraction, and what follows it is still read', () => {
  const blank = ' '.repeat(1000000);
  for (const [name, lang, body] of [
    ['wasm.ts', ts, `export const WASM = "${blank}";\nexport const after = (n: number) => n + 1;\nexport function done(): void {}\n`],
    ['wasm.js', js, `export const WASM = "${blank}";\nexport const after = (n) => n + 1;\nexport function done() {}\n`],
  ]) {
    const t0 = Date.now();
    const sigs = lang.extract(body, name);
    const ms = Date.now() - t0;
    assert.ok(ms < 10000, `${name} took ${ms} ms`);
    assert.ok(has(sigs, /export const after/) && has(sigs, /export function done/), name + show(sigs));
  }
});

test('atStatementStart: a line start, or behind ";" / "}" and blanks; never mid-expression', () => {
  const at = (text, needle) => atStatementStart(text, text.indexOf(needle));
  assert.strictEqual(at('export const a = 1', 'export'), true, 'start of text');
  assert.strictEqual(at('x\nexport const a = 1', 'export'), true, 'start of line');
  assert.strictEqual(at('x\r\nexport const a = 1', 'export'), true, 'after CRLF');
  assert.strictEqual(at('const x = 1; export const a = 1', 'export'), true, 'after ;');
  assert.strictEqual(at('function f() {}\t export const a = 1', 'export'), true, 'after } and blanks');
  assert.strictEqual(at('  export const a = 1', 'export'), false, 'indented: not a top-level statement');
  assert.strictEqual(at('const x = reexport const a = 1', 'export'), false, 'inside a word');
  assert.strictEqual(at('call(a) export const a = 1', 'export'), false, 'behind ")"');
  assert.strictEqual(at('x\n   ' + ' '.repeat(200000) + 'export const a = 1', 'export'), false, 'a long blank run walks back once, and says no');
});

test('exports after ";" or "}" on the same line are still read (what the lookbehind was for)', () => {
  const sigs = ts.extract('const a = 1; export const b = (x: number) => x; function f() {} export function g(y: string): string { return y; }\nexport interface I { k: string } export type T = string;\n', 'one.ts');
  for (const re of [/export const b/, /export function g/, /export interface I/, /export type T/]) {
    assert.ok(has(sigs, re), String(re) + show(sigs));
  }
  const none = ts.extract('const s = a export function nope() {}\n  export function indented() {}\n', 'two.ts');
  assert.ok(!has(none, /nope|indented/), show(none));
});

try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}

console.log(`\nts-declaration-shapes: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
