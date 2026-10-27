'use strict';

/**
 * Extraction recall harness (#983): `scripts/run-extraction-recall.mjs`, its adapters and
 * its arithmetic in `scripts/lib/extraction-recall.mjs`.
 *
 * The harness asks a language's own parser what each file defines and counts how many of
 * those names SigMap lists. What is pinned here is the part that has to be right for the
 * numbers to mean anything: a name counts once, private names are skipped on both sides, a
 * floor can neither pass by absence nor be compared with a run on a different reference
 * version, every language is accounted for, and the published page says what the saved
 * report says. The two end-to-end cases run the real adapters over a few lines of Python
 * and Ruby, and skip (loudly) where the interpreter is not installed.
 *
 * Run: node test/integration/extraction-recall.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const RUNNER = path.join(ROOT, 'scripts/run-extraction-recall.mjs');

let passed = 0;
let failed = 0;
let skipped = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}
function skip(name, why) {
  console.log(`  SKIP  ${name} (${why})`);
  skipped++;
}

const have = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return !r.error && r.status === 0; };
const tmpDirs = [];
function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
const run = (args) => spawnSync(process.execPath, [RUNNER, ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });

(async () => {
  const lib = await import('../../scripts/lib/extraction-recall.mjs');
  const py = await import('../../scripts/extraction-recall/python.mjs');
  const rb = await import('../../scripts/extraction-recall/ruby.mjs');
  const cx = await import('../../scripts/extraction-recall/cpp.mjs');
  const cref = await import('../../scripts/extraction-recall/cpp-reference.mjs');
  const tsx = await import('../../scripts/extraction-recall/typescript.mjs');
  const tsRef = await import('../../scripts/extraction-recall/typescript-reference.mjs');
  const runner = await import('../../scripts/run-extraction-recall.mjs');

  // ── the arithmetic ────────────────────────────────────────────────────────

  await test('typescript: the extractor\'s lines are read as functions, classes, interfaces, types, enums, arrows, factories and anonymous defaults', () => {
    const got = tsx.parseSigs([
      'export function plain(a, b?) → void  :1-3', 'export default function main()  :4-5', 'export async function $load(x)  :6-7',
      'export default function ()  :8-9', 'export default async (ctx) =>  :10-11',
      'export class Store extends Base  :12-20', '  load(id)  :13-15', 'class Internal  :21-22',
      'export interface $Options  :23-27', '  name: string', 'export type Id  :28-28', 'export enum Mode  :29-31',
      'export const mapIt = async (a) =>  :32-33', 'export const $parse = (s, v) =>  :34-34',
      'export const wrapped = makeThing(...)  :35-37', 'export const shape = z.object(...)  :38-40',
      'export const useCartStore = create<State>(...)  :41-45',
    ]);
    assert.deepStrictEqual([...got.function].sort(), ['$load', 'main', 'plain']);
    assert.deepStrictEqual([...got.class].sort(), ['Internal', 'Store']);
    assert.deepStrictEqual([...got.interface], ['$Options']);
    assert.deepStrictEqual([...got.type], ['Id']);
    assert.deepStrictEqual([...got.enum], ['Mode']);
    assert.deepStrictEqual([...got.arrow].sort(), ['$parse', 'mapIt']);
    // a zustand store (`create<State>(...)`) is a call to a name too, which is how the reference counts it
    assert.deepStrictEqual([...got.factory].sort(), ['shape', 'useCartStore', 'wrapped']);
    assert.deepStrictEqual([...got.default], ['(default)']);
    assert.deepStrictEqual([...got.dollar].sort(), ['$Options', '$load', '$parse']);
    assert.ok(!got.function.has('load'), 'an indented member is not a top-level declaration');
  });

  await test('typescript: recall by name once per file and kind; the $ row counts a name a second time; an absent default is a miss', () => {
    const t = lib.newTally(tsx.KINDS);
    tsx.compareFile(t, [['function', 'a'], ['function', 'a'], ['function', 'b'], ['interface', '$I'], ['dollar', '$I'], ['default', '(default)']],
      tsx.parseSigs(['export function a()  :1-1', 'export interface $I  :2-2']), 'x.ts');
    const by = Object.fromEntries(lib.rowsOf(t).map((r) => [r.kind, r]));
    assert.deepStrictEqual([by.function.found, by.function.reference], [1, 2], 'overloads are one name');
    assert.deepStrictEqual([by.dollar.found, by.dollar.reference], [1, 1]);
    assert.deepStrictEqual([by.default.found, by.default.reference], [0, 1]);
  });

  await test('typescript: without a compiler or clones the language is unmeasured, never a failure or a zero', () => {
    const empty = tmp('sigmap-recall-ts-');
    assert.strictEqual(tsx.measure({ reposDir: empty, index: false }).measured, false);
    const withClone = tmp('sigmap-recall-ts-');
    put(path.join(withClone, 'zod/packages/zod/src/a.ts'), 'export const x = 1;\n');
    const r = tsx.measure({ reposDir: withClone, index: false, typescript: path.join(withClone, 'no-such-compiler') });
    if (!tsRef.findTypeScript()) assert.ok(/no typescript package found/.test(r.reason), JSON.stringify(r));
  });

  await test('typescript reference: exports are read from the compiler\'s parse, and calls to nothing named are not factories', () => {
    const found = tsRef.findTypeScript();
    if (!found) { skip('typescript reference', 'no typescript package on this machine (--typescript <path> or SIGMAP_TYPESCRIPT)'); return; }
    const truth = tsRef.truthOf(found.ts, [
      'export function a() {}', 'export default function () {}', 'export class C {}', 'export interface $I {}', 'export type T = 1;',
      'export enum E { A }', 'export const arrow = (x) => x;', 'export const wrapped = make(1);', 'export const dotted = z.object({});',
      'export const iife = (() => 1)();', "export const req = require('x');", 'export const lit = 1;', 'const hidden = make();', '',
    ].join('\n'), 'x.ts');
    assert.deepStrictEqual(truth.map((p) => p.join(':')), ['function:a', 'default:(default)', 'class:C', 'interface:$I', 'dollar:$I', 'type:T', 'enum:E', 'arrow:arrow', 'factory:wrapped', 'factory:dotted']);
  });

  await test('python: what the extractors omit on purpose is left out of the comparison, and nothing else', () => {
    for (const [kind, n] of [['func', '_x'], ['method', 'A._x'], ['method', 'A.__eq__'], ['method', 'A.__call__'], ['func', '__main__']]) assert.strictEqual(py.isOmitted(kind, n), true, `${kind} ${n}`);
    for (const [kind, n] of [['method', 'A.__init__'], ['method', 'A.run'], ['func', 'run_'], ['func', 'a_b'], ['class', 'Public'], ['class', '_Hidden'], ['class', '__Mangled']]) assert.strictEqual(py.isOmitted(kind, n), false, `${kind} ${n}`);
  });

  await test('recall is rounded to one decimal and is null, not 0 or NaN, with nothing to find', () => {
    assert.strictEqual(lib.pct(2, 3), 66.7);
    assert.strictEqual(lib.pct(1, 3), 33.3);
    assert.strictEqual(lib.pct(944, 944), 100);
    assert.strictEqual(lib.pct(0, 0), null);
  });

  await test('a tally counts hits and misses, keeps the first MISS_CAP misses and still counts the rest', () => {
    const t = lib.newTally(['func']);
    for (let i = 0; i < lib.MISS_CAP + 10; i++) lib.record(t, 'func', false, `m${i}`);
    lib.record(t, 'func', true, 'ok');
    lib.skip(t, 'func');
    const [row] = lib.rowsOf(t);
    assert.deepStrictEqual({ r: row.reference, f: row.found, s: row.skipped, m: row.missed }, { r: lib.MISS_CAP + 11, f: 1, s: 1, m: lib.MISS_CAP + 10 });
    assert.strictEqual(lib.missesOf(t).func.length, lib.MISS_CAP);
    assert.strictEqual(lib.missesOf(t).func[0], 'm0');
  });

  // ── floors ────────────────────────────────────────────────────────────────

  const spec = { references: [{ match: '3.', floors: { pop: { class: 90, func: 80 } } }, { match: '2.6', floors: { pop: { class: 50 } } }] };
  const measured = (version, rows, extra = {}) => ({
    measured: true, reference: { name: 'x', version },
    populations: { pop: { label: 'p', filesCompared: 1, rows: rows.map(([kind, recall]) => ({ kind, recall, reference: 10, found: 9, skipped: 0, missed: 1 })), misses: {} } },
    ...extra,
  });

  await test('the floors that apply are those of the first matching version prefix', () => {
    assert.strictEqual(lib.floorsFor(spec, '3.12.3').match, '3.');
    assert.strictEqual(lib.floorsFor(spec, '2.6.10').match, '2.6');
    assert.strictEqual(lib.floorsFor(spec, '2.7.8'), null);
    assert.strictEqual(lib.floorsFor(spec, '3'), null, 'a bare "3" is not under "3."');
    assert.strictEqual(lib.floorsFor(spec, '13.0'), null, 'a prefix, not a substring');
    assert.strictEqual(lib.floorsFor(spec, '2.3.1'), null, 'a prefix, not a substring');
    assert.strictEqual(lib.floorsFor(spec, null), null);
  });

  await test('a recall at the floor passes and one point of a percent below it fails', () => {
    assert.strictEqual(lib.evaluate(measured('3.9.6', [['class', 90], ['func', 80]]), spec).status, 'pass');
    const v = lib.evaluate(measured('3.9.6', [['class', 89.9], ['func', 95]]), spec);
    assert.strictEqual(v.status, 'fail');
    assert.deepStrictEqual(v.checks.filter((c) => c.status === 'fail').map((c) => c.kind), ['class']);
  });

  await test('a floor is never compared with a run on a version it was not recorded for', () => {
    const v = lib.evaluate(measured('2.7.8', [['class', 1], ['func', 1]]), spec);
    assert.strictEqual(v.status, 'not-enforced');
    assert.deepStrictEqual(v.checks, []);
    assert.ok(/3\., 2\.6/.test(v.note) && /2\.7\.8/.test(v.note), v.note);
  });

  await test('a floor cannot pass by absence: a missing population or kind fails, a population not requested is skipped', () => {
    const noKind = lib.evaluate(measured('3.9.6', [['class', 99]]), spec);
    assert.strictEqual(noKind.status, 'fail');
    assert.strictEqual(noKind.checks.find((c) => c.kind === 'func').recall, null);
    const noPop = measured('3.9.6', []);
    delete noPop.populations.pop;
    assert.strictEqual(lib.evaluate(noPop, spec).status, 'fail');
    const asked = lib.evaluate({ ...noPop, notRun: ['pop'] }, spec);
    assert.strictEqual(asked.status, 'pass');
    assert.ok(asked.checks.every((c) => c.status === 'skipped'));
  });

  await test('an unmeasured language and a language with no floors are reported, not passed off as measured', () => {
    assert.strictEqual(lib.evaluate({ measured: false, reason: 'ruby is not on PATH' }, spec).status, 'unmeasured');
    assert.strictEqual(lib.evaluate({ measured: false, reason: 'r' }, spec).note, 'r');
    assert.strictEqual(lib.evaluate(measured('3.9.6', [['class', 100]]), undefined).status, 'unfloored');
  });

  // ── Python: reading signature lines, scoring a file ──────────────────────

  await test('python signature lines are read as classes, functions, and methods of the class above', () => {
    const got = py.parseSigs([
      'class A(Base)  :1-9', '  def run(self) → None', '  async def go()', '@dataclass Point(x, y)  :11-12',
      'def top(a) → int  :14-15', 'async def fetch()', '  def stray()',
      'class B  :20-30', '  def only()', '… +14 more signatures',
    ]);
    assert.deepStrictEqual([...got.class].sort(), ['A', 'B', 'Point']);
    assert.deepStrictEqual([...got.func].sort(), ['fetch', 'top']);
    assert.deepStrictEqual([...got.method].sort(), ['A.go', 'A.run', 'B.only']);
  });

  await test('python: a name counts once per file; omitted names are skipped; __init__ and underscore classes count; a miss says where', () => {
    const t = lib.newTally(['class', 'func', 'method']);
    const got = py.parseSigs(['class A', '  def run()']);
    py.compareFile(
      t,
      [['class', 'A'], ['class', '_Hidden'], ['method', 'A.run'], ['method', 'A.run'], ['method', 'A.save'], ['method', 'A.__init__'], ['method', 'A.__eq__'], ['method', 'A._x'], ['func', '_hidden'], ['func', 'helper']],
      got, 'flask/src/flask/a.py',
    );
    const rows = Object.fromEntries(lib.rowsOf(t).map((r) => [r.kind, r]));
    assert.deepStrictEqual([rows.class.reference, rows.class.found, rows.class.skipped], [2, 1, 0], 'an underscore class is a reference symbol');
    assert.deepStrictEqual([rows.method.reference, rows.method.found, rows.method.skipped], [3, 1, 2], 'run twice is one name; __init__ counts; __eq__ and _x are skipped');
    assert.deepStrictEqual([rows.func.reference, rows.func.found, rows.func.skipped], [1, 0, 1]);
    assert.deepStrictEqual(lib.missesOf(t).method, ['flask/src/flask/a.py :: A.save', 'flask/src/flask/a.py :: A.__init__']);
    assert.deepStrictEqual(lib.missesOf(t).class, ['flask/src/flask/a.py :: _Hidden']);
  });

  // ── Ruby: scoring a file ──────────────────────────────────────────────────

  const rubyTruth = [['module', 'Sidekiq'], ['class', 'Worker'], ['method', 'Worker#perform'], ['method', 'Worker.build'], ['method', 'Worker#_hidden'], ['class', 'Top'], ['method', 'Top#run']];
  const rubyTally = () => lib.newTally(rb.KINDS);
  const rubyRows = (t) => Object.fromEntries(lib.rowsOf(t).map((r) => [r.kind, `${r.found}/${r.reference}`]));

  await test('ruby: a method listed under the wrong class is found by name and missed by owner', () => {
    const t = rubyTally();
    rb.compareFile(t, rubyTruth, ['module Sidekiq', '  class Worker', '    def perform', '    def self.build', 'class Top', '  def perform'], 'x.rb');
    // Top#run is not listed anywhere; Worker's two are under Worker; the extra `perform` under Top is not asked for
    assert.deepStrictEqual(rubyRows(t), { class: '2/2', module: '1/1', method: '2/3', owner: '2/3', anchored: '0/6', 'anchor-exact': '0/0' });
    const wrongOwner = rubyTally();
    rb.compareFile(wrongOwner, [['class', 'A'], ['class', 'B'], ['method', 'B#save']], ['class A', '  def save', 'class B'], 'x.rb');
    assert.deepStrictEqual(rubyRows(wrongOwner), { class: '2/2', module: '0/0', method: '1/1', owner: '0/1', anchored: '0/3', 'anchor-exact': '0/0' });
  });

  await test('ruby: a private method is skipped, and a method listed twice is still one owner hit per definition', () => {
    const t = rubyTally();
    rb.compareFile(t, [['class', 'A'], ['method', 'A#_x'], ['method', 'A#a'], ['method', 'A#a']], ['class A', '  def a', '  def a'], 'x.rb');
    assert.deepStrictEqual(rubyRows(t), { class: '1/1', module: '0/0', method: '2/2', owner: '2/2', anchored: '0/3', 'anchor-exact': '0/0' });
    assert.strictEqual(t.method.skipped, 1);
    const once = rubyTally();
    rb.compareFile(once, [['class', 'A'], ['method', 'A#a'], ['method', 'A#a']], ['class A', '  def a'], 'x.rb');
    assert.strictEqual(rubyRows(once).owner, '1/2');
  });

  await test('ruby: anchors are judged on what the extractor emits: is one there, and is it the parser\'s own range (#975)', () => {
    const truth = [['module', 'M', 1, 10], ['class', 'C', 2, 9], ['method', 'C#a', 3, 5], ['method', 'C.b', 7, 7]];
    const t = rubyTally();
    // five definition lines: four carry an anchor; `b` ends a line late, so three of the four are exact; a
    // notice line is not a definition and is not counted
    rb.compareFile(t, truth, ['module M  :1-10', '  class C  :2-9', '    def a  :3-5', '    def self.b  :7-8', '  def c', '… +3 more signatures'], 'x.rb');
    const rows = rubyRows(t);
    assert.strictEqual(rows.anchored, '4/5');
    assert.strictEqual(rows['anchor-exact'], '3/4');
    assert.deepStrictEqual(t['anchor-exact'].misses, ['x.rb :: def self.b :7-8']);
    // the same range under another name or kind is not a match
    const other = rubyTally();
    rb.compareFile(other, [['class', 'C', 2, 9]], ['module C  :2-9', 'class D  :2-9'], 'y.rb');
    assert.strictEqual(rubyRows(other)['anchor-exact'], '0/2');
  });

  // ── C and C++: scoring a file against clangd (#975) ──────────────────────

  const cxTally = () => lib.newTally(cx.KINDS);
  const cxRows = (t) => Object.fromEntries(lib.rowsOf(t).map((r) => [r.kind, `${r.found}/${r.reference}`]));

  await test('cpp: the extractor\'s lines are read as classes, enums, functions and methods of the class above', () => {
    const scope = [];
    const read = (l) => { const r = cx.readLine(l, scope); return r && `${r.kind} ${r.owner ? `${r.owner}::` : ''}${r.name}`; };
    assert.strictEqual(read('class Service  :6-20'), 'class Service');
    assert.strictEqual(read('  Service(int id)  :8-8'), 'method Service::Service');
    assert.strictEqual(read('  ~Service()  :10-10'), 'method Service::~Service');
    assert.strictEqual(read('  operator()(int x) → int  :15-15'), 'method Service::operator()');
    assert.strictEqual(read('  operator bool()  :16-16'), 'method Service::operator bool');
    assert.strictEqual(read('  struct Inner  :17-18'), 'class Service::Inner');
    assert.strictEqual(read('    go() → void  :17-17'), 'method Inner::go');
    assert.strictEqual(read('enum class Mode  :30-30'), 'enum Mode');
    assert.strictEqual(read('helper(int x) → int  :40-40'), 'function helper');
    assert.strictEqual(read('Service::run(int a) → int  :41-41'), 'method Service::run');
    assert.strictEqual(read('… +30 more signatures'), null, 'a notice is not a definition');
  });

  await test('cpp: recall by name once per file and kind; owner by class; underscore names skipped; anchors judged on what is emitted', () => {
    const truth = [['class', 'A', 1, 9, ''], ['method', 'f', 2, 2, 'A'], ['method', 'f', 3, 3, 'A'], ['method', '_hid', 4, 4, 'A'], ['function', 'g', 11, 12, ''], ['enum', 'E', 14, 16, '']];
    const t = cxTally();
    cx.compareFile(t, truth, ['class A  :1-9', '  f(int) → void  :2-2', 'g() → int  :11-13', 'extra() → int  :20-20'], 'x.cpp');
    const rows = cxRows(t);
    assert.deepStrictEqual([rows.class, rows.method, rows.function, rows.enum, rows.owner], ['1/1', '1/1', '1/1', '0/1', '1/1'], 'f counts once, _hid is skipped, E is missed');
    assert.strictEqual(t.method.skipped, 1);
    assert.deepStrictEqual([rows.anchored, rows['anchor-exact']], ['4/4', '2/3'], 'g ends a line late; extra() is not in clangd, so it is not judged');
    assert.strictEqual(t['anchor-exact'].skipped, 1);
    assert.deepStrictEqual(t['anchor-exact'].misses, ['x.cpp :: g() → int :11-13']);
    // a method listed under another class is found by name and missed by owner
    const wrong = cxTally();
    cx.compareFile(wrong, [['class', 'A', 1, 3, ''], ['class', 'B', 4, 6, ''], ['method', 'save', 5, 5, 'B']], ['class A  :1-3', '  save() → void  :2-2', 'class B  :4-6'], 'y.cpp');
    assert.deepStrictEqual([cxRows(wrong).method, cxRows(wrong).owner], ['1/1', '0/1']);
  });

  await test('cpp: a template header above a declaration is part of SigMap\'s anchor and not of clangd\'s range, and only that is forgiven', () => {
    const src = 'template <typename T>\nT id(T v) { return v; }\nint late(int x);\n\nint other(int y);\n';
    const truth = [['function', 'id', 2, 2, ''], ['function', 'late', 3, 3, ''], ['function', 'other', 5, 5, '']];
    const withHeader = cxTally();
    cx.compareFile(withHeader, truth, ['id(T v) → T  :1-2', 'late(int x) → int  :1-3', 'other(int y) → int  :4-5'], 'z.cpp', src);
    // id: the extra line is a template header -> exact; late: it starts on `template` and runs over code -> not; other: a blank line is not a header
    assert.deepStrictEqual(withHeader['anchor-exact'].misses, ['z.cpp :: late(int x) → int :1-3', 'z.cpp :: other(int y) → int :4-5']);
    const noSource = cxTally();
    cx.compareFile(noSource, truth, ['id(T v) → T  :1-2'], 'z.cpp');
    assert.strictEqual(cxRows(noSource)['anchor-exact'], '0/1', 'without the source only an identical range is exact');
  });

  await test('cpp: a forward or friend declaration is not a definition, so it is not asked for', () => {
    const src = 'class Fwd;\nclass Real {\n};\nenum class Op : int;\nenum class Full : int { A };\n';
    const truth = [['class', 'Fwd', 1, 1, ''], ['class', 'Real', 2, 3, ''], ['enum', 'Op', 4, 4, ''], ['enum', 'Full', 5, 5, '']];
    const t = cxTally();
    cx.compareFile(t, truth, ['class Real  :2-3', 'enum class Full  :5-5'], 'f.cpp', src);
    assert.deepStrictEqual([cxRows(t).class, cxRows(t).enum], ['1/1', '1/1']);
  });

  await test('cpp reference: clangd names lose their template arguments, an operator keeps its symbols, and a macro node is transparent', () => {
    assert.deepStrictEqual(cref.splitName('Storage<T, N, A>::Resize'), { qualifier: 'Storage', bare: 'Resize' });
    assert.deepStrictEqual(cref.splitName('formatter<spdlog::stopwatch>'), { qualifier: '', bare: 'formatter' });
    assert.deepStrictEqual(cref.splitName('Foo::operator<=>'), { qualifier: 'Foo', bare: 'operator<=>' });
    assert.deepStrictEqual(cref.splitName('std::less<int>::operator()'), { qualifier: 'less', bare: 'operator()' });
    const node = (kind, name, a, b, detail, children) => ({ kind, name, range: { start: { line: a - 1 }, end: { line: b - 1 } }, detail, children });
    const tree = [
      node(15, 'LIB_NAMESPACE_BEGIN', 1, 30, '', [node(3, 'lib', 1, 30, '', [
        node(5, 'Box', 3, 12, 'template class', [node(9, 'Box', 4, 4, '()'), node(6, 'put', 5, 6, 'void (T)'), node(8, 'v_', 7, 7, 'T'), node(5, 'alias_t', 8, 8, 'type alias')]),
        node(10, 'Color', 14, 16, 'enum', [node(22, 'Red', 15, 15, '')]),
        node(10, 'RED', 17, 17, 'int'),
        node(12, 'make', 20, 24, 'Box<int> ()'),
        node(12, 'Box::get', 26, 28, 'int ()'),
      ])]),
    ];
    assert.deepStrictEqual(cref.flatten(tree), [
      ['class', 'Box', 3, 12, ''], ['method', 'Box', 4, 4, 'Box'], ['method', 'put', 5, 6, 'Box'],
      ['enum', 'Color', 14, 16, ''], ['function', 'make', 20, 24, ''], ['method', 'get', 26, 28, 'Box'],
    ], 'fields, aliases, enumerators and macro-made enum constants are left out');
  });

  await test('the held-out repositories are fixed commits, apart from the development ones, and the recorded numbers name the same commits', () => {
    const names = new Set([...cx.REPOS, ...cx.DEV_REPOS].map((r) => r.repo));
    assert.ok(cx.HELD_OUT_REPOS.length >= 3);
    for (const r of cx.HELD_OUT_REPOS) {
      assert.ok(/^[0-9a-f]{40}$/.test(r.commit), `${r.repo} is not pinned to a full commit`);
      assert.ok(!names.has(r.repo), `${r.repo} is also a development repository`);
      assert.ok(/^https:\/\/github\.com\//.test(r.url), r.repo);
    }
    const held = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/reports/extraction-recall-cpp-held-out.json'), 'utf8'));
    assert.deepStrictEqual(held.commits, Object.fromEntries(cx.HELD_OUT_REPOS.map((r) => [r.repo, r.commit])));
    assert.strictEqual(held.first.extractor.files, held.final.extractor.files, 'the same files before and after');
  });

  await test('--held-out says unmeasured with no clones, and refuses a clone at another commit instead of measuring it', () => {
    const empty = tmp('sigmap-recall-held-');
    const none = cx.measure({ reposDir: empty, heldOut: true });
    assert.strictEqual(none.measured, false);
    assert.ok(/docs-vp\/guide\/extraction-recall\.md/.test(none.reason) && !/fetch-xrepo-repos/.test(none.reason), none.reason);
    const spec = cx.HELD_OUT_REPOS[0];
    const dir = path.join(empty, spec.repo);
    fs.mkdirSync(path.join(dir, spec.roots[0]), { recursive: true });
    fs.writeFileSync(path.join(dir, spec.roots[0], 'a.h'), 'int f(void);\n');
    const git = (...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
    git('init', '-q');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'x');
    const moved = cx.measure({ reposDir: empty, heldOut: true });
    assert.strictEqual(moved.measured, false);
    assert.ok(new RegExp(`${spec.repo} is at [0-9a-f]+, not ${spec.commit.slice(0, 7)}`).test(moved.reason), moved.reason);
  });

  // ── the runner ────────────────────────────────────────────────────────────

  await test('every extractor language is either measured or listed as unmeasured, none omitted', () => {
    const { LANGUAGES } = require('../../src/extractors/dispatch');
    const empty = tmp('sigmap-recall-empty-');
    const r = run(['--repos', empty, '--json']);
    assert.strictEqual(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    const accounted = new Set([...Object.keys(out.languages), ...Object.keys(out.unmeasured)]);
    assert.deepStrictEqual([...accounted].sort(), [...LANGUAGES].sort());
    assert.deepStrictEqual(Object.keys(out.languages).sort(), [...runner.ADAPTERS].sort());
    for (const reason of Object.values(out.unmeasured)) assert.ok(reason);
  });

  await test('without clones every language is unmeasured: the run exits 0, and exits 1 only with --require-reference', () => {
    const empty = tmp('sigmap-recall-empty-');
    const plain = run(['--repos', empty, '--gate']);
    assert.strictEqual(plain.status, 0, plain.stderr);
    assert.ok(/python: unmeasured/.test(plain.stdout) && /ruby: unmeasured/.test(plain.stdout), plain.stdout);
    assert.ok(/unmeasured \(\d+\): .*javascript/.test(plain.stdout), plain.stdout);
    const strict = run(['--repos', empty, '--gate', '--require-reference']);
    assert.strictEqual(strict.status, 1);
    assert.ok(/python: unmeasured/.test(strict.stderr) && /ruby: unmeasured/.test(strict.stderr), strict.stderr);
  });

  await test('a partial or unmeasured run is never saved over the report', () => {
    const empty = tmp('sigmap-recall-empty-');
    const out = path.join(tmp('sigmap-recall-out-'), 'report.json');
    const r = run(['--repos', empty, '--save', '--out', out]);
    assert.strictEqual(r.status, 1);
    assert.ok(/not saved/.test(r.stderr), r.stderr);
    assert.strictEqual(fs.existsSync(out), false, 'an unmeasured run wrote a report');
    const partial = run(['--repos', empty, '--only', 'python', '--save', '--out', out]);
    assert.strictEqual(partial.status, 1);
    assert.strictEqual(fs.existsSync(out), false, 'a partial run wrote a report');
  });

  // ── end to end, over a few real lines ─────────────────────────────────────

  const PY_SRC = [
    'class App:', '    def __init__(self): pass', '    def run(self): pass', '    def _private(self): pass', '    def __eq__(self, o): pass', '    def handle(self): pass', '',
    'class _Hidden: pass', '',
    'def helper(): pass', 'async def fetch(): pass', 'def _hidden(): pass', '',
  ].join('\n');
  const floorsFile2 = (languages) => {
    const f = path.join(tmp('sigmap-recall-floors-'), 'floors.json');
    put(f, JSON.stringify({ languages }));
    return f;
  };
  const pyFloors = (n, match = '3.', pops = { 'extractor-regex': ['class', 'func', 'method'] }) => floorsFile2({
    python: { references: [{ match, floors: Object.fromEntries(Object.entries(pops).map(([pop, kinds]) => [pop, Object.fromEntries(kinds.map((k) => [k, n]))])) }] },
  });
  const cells = (rows) => rows.map((x) => `${x.kind} ${x.found}/${x.reference}`);

  if (have('python3', ['--version'])) {
    await test('python end to end: the real parser against an extractor that finds only some names', () => {
      const repos = tmp('sigmap-recall-py-');
      put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
      // directories the file set leaves out: tests, migrations, locale
      put(path.join(repos, 'flask/src/flask/tests/test_x.py'), 'class InTests:\n    def go(self): pass\n');
      put(path.join(repos, 'flask/src/flask/migrations/0001.py'), 'class InMigrations: pass\n');
      put(path.join(repos, 'flask/src/flask/locale/x.py'), 'class InLocale: pass\n');
      const extractor = path.join(tmp('sigmap-recall-ext-'), 'partial.js');
      put(extractor, `module.exports = {
        extract: () => ['class App  :1-6', '  def __init__()', '  def run()', 'def helper()'],
        prefetch: () => {},
        tryNativeExtract: () => ['class App  :1-6', '  def run()', '  def handle()', 'async def fetch()', 'class _Hidden'],
      };`);
      const r = py.measure({ reposDir: repos, extractorPath: extractor, index: false });
      assert.strictEqual(r.measured, true);
      assert.ok(/^3\./.test(r.reference.version), r.reference.version);
      const regex = r.populations['extractor-regex'];
      assert.strictEqual(regex.filesCompared, 1, 'tests, migrations and locale directories are not compared');
      assert.deepStrictEqual(cells(regex.rows), ['class 1/2', 'func 1/2', 'method 2/3']);
      assert.deepStrictEqual(regex.misses, { class: ['flask/src/flask/app.py :: _Hidden'], func: ['flask/src/flask/app.py :: fetch'], method: ['flask/src/flask/app.py :: App.handle'] });
      const ast = r.populations['extractor-ast'];
      assert.deepStrictEqual(cells(ast.rows), ['class 2/2', 'func 1/2', 'method 2/3']);
      assert.deepStrictEqual(ast.misses.method, ['flask/src/flask/app.py :: App.__init__'], '__init__ is a reference symbol');
      assert.deepStrictEqual(r.notRun, ['index-regex', 'index-ast']);
    });

    await test('python end to end with the real extractor: the shipped extractor finds every name of the fixture it lists on purpose', () => {
      const repos = tmp('sigmap-recall-py-');
      put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
      const r = py.measure({ reposDir: repos, index: false });
      for (const id of ['extractor-regex', 'extractor-ast']) {
        assert.deepStrictEqual(cells(r.populations[id].rows), ['class 2/2', 'func 2/2', 'method 3/3'], id);
        assert.deepStrictEqual(r.populations[id].rows.map((x) => x.skipped), [0, 1, 2], id);
      }
    });

    await test('python end to end: the index is built per tier, scored over the files it holds, with the files it lacks counted apart', () => {
      const repos = tmp('sigmap-recall-py-');
      put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
      // a default value with a call in it: the regex tier cannot match the first def, the AST tier lists both
      put(path.join(repos, 'flask/src/flask/odd.py'), 'class Odd:\n    def a(self, x=f(1)): pass\n    def b(self): pass\n');
      put(path.join(repos, 'flask/src/flask/skipme.py'), 'class Skipped:\n    def go(self): pass\n');
      put(path.join(repos, 'flask/.contextignore'), 'src/flask/skipme.py\n');
      const r = py.measure({ reposDir: repos });
      const regex = r.populations['index-regex'];
      const ast = r.populations['index-ast'];
      assert.deepStrictEqual([regex.filesCompared, regex.filesTotal, ast.filesCompared, ast.filesTotal], [2, 3, 2, 3]);
      assert.deepStrictEqual(cells(regex.rows), ['class 3/3', 'func 2/2', 'method 4/5'], 'the regex tier misses the def with a call in its defaults');
      assert.deepStrictEqual(cells(ast.rows), ['class 3/3', 'func 2/2', 'method 5/5'], 'the AST tier lists both: this fails if the two tiers are swapped');
      assert.deepStrictEqual(cells(regex.rowsAllFiles), ['class 3/4', 'func 2/2', 'method 4/6'], 'the file the index lacks counts as all missed');
      assert.strictEqual(fs.existsSync(path.join(repos, 'flask/.context')), false, 'the checkout was left as it was found');
    });

    await test('the runner gates: exit 1 below a floor, 0 at it, and 0 below it when only reporting', () => {
      const repos = tmp('sigmap-recall-py-');
      put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
      const base = ['--repos', repos, '--only', 'python', '--no-index'];
      const at = run([...base, '--floors', pyFloors(100), '--gate']);
      assert.strictEqual(at.status, 0, at.stdout + at.stderr);
      assert.ok(/floor 100%/.test(at.stdout), at.stdout);
      const over = run([...base, '--floors', pyFloors(101), '--gate']);
      assert.strictEqual(over.status, 1, over.stdout);
      assert.ok(/python: below a floor — extractor-regex\/class 100% < 101%/.test(over.stderr), over.stderr);
      assert.strictEqual(run([...base, '--floors', pyFloors(101)]).status, 0, 'without --gate a run only reports');
      assert.strictEqual(run([...base, '--floors', pyFloors(101), '--require-reference']).status, 1, '--require-reference is a stricter --gate, not an add-on to it');
    });

    await test('--require-reference fails a reference it cannot use: no floors for this version, a language left out, a population not run', () => {
      const repos = tmp('sigmap-recall-py-');
      put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
      const base = ['--repos', repos, '--only', 'python', '--no-index'];
      const wrongVersion = pyFloors(50, '9.');
      assert.strictEqual(run([...base, '--floors', wrongVersion, '--gate']).status, 0, 'a gate alone reports "not enforced" and passes');
      const strict = run([...base, '--floors', wrongVersion, '--require-reference']);
      assert.strictEqual(strict.status, 1);
      assert.ok(/python: not-enforced/.test(strict.stderr), strict.stderr);
      const rubyToo = floorsFile2({
        python: { references: [{ match: '3.', floors: { 'extractor-regex': { class: 1 } } }] },
        ruby: { references: [{ match: '2.', floors: { extractor: { class: 1 } } }, { match: '3.', floors: { extractor: { class: 1 } } }] },
      });
      const left = run([...base, '--floors', rubyToo, '--require-reference']);
      assert.strictEqual(left.status, 1);
      assert.ok(/ruby: not measured \(left out by --only\)/.test(left.stderr), left.stderr);
      const indexFloor = pyFloors(1, '3.', { 'index-regex': ['class'] });
      const notRun = run([...base, '--floors', indexFloor, '--require-reference']);
      assert.strictEqual(notRun.status, 1);
      assert.ok(/floored population was not run/.test(notRun.stderr), notRun.stderr);
      assert.strictEqual(run([...base, '--floors', indexFloor, '--gate']).status, 0, 'a gate alone skips a population that was not asked for');
    });

    await test('an unknown language in --only is an error, not an empty pass', () => {
      const r = run(['--only', 'nonsense', '--gate', '--require-reference']);
      assert.strictEqual(r.status, 1);
      assert.ok(/unknown language: nonsense/.test(r.stderr), r.stderr);
    });
  } else {
    skip('python end to end (6 cases)', 'python3 is not installed');
  }

  const RB_SRC = [
    'module Sidekiq', '  class Worker', '    def perform; end', '    def self.build; end', '    def _hidden; end', '  end', 'end', '',
    'class Top', '  def run; end', 'end', '', 'def helper; end', '',
  ].join('\n');
  if (have('ruby', ['--version'])) {
    await test('ruby end to end: Ripper against the shipped extractor and against one that finds nothing', () => {
      const repos = tmp('sigmap-recall-rb-');
      put(path.join(repos, 'sidekiq/lib/a.rb'), RB_SRC);
      const real = rb.measure({ reposDir: repos, index: false });
      assert.strictEqual(real.measured, true);
      assert.deepStrictEqual(cells(real.populations.extractor.rows), ['class 2/2', 'module 1/1', 'method 4/4', 'owner 4/4', 'anchored 7/7', 'anchor-exact 7/7'], 'a top-level def has no owner');
      const none = path.join(tmp('sigmap-recall-ext-'), 'none.js');
      put(none, 'module.exports = { extract: () => [] };');
      const blind = rb.measure({ reposDir: repos, extractorPath: none, index: false });
      assert.deepStrictEqual(blind.populations.extractor.rows.map((x) => x.recall), [0, 0, 0, 0, null, null], 'an extractor that emits nothing has no anchors to judge');
      assert.deepStrictEqual(blind.populations.extractor.misses.class.sort(), ['sidekiq/lib/a.rb :: Top', 'sidekiq/lib/a.rb :: Worker']);
      // a top-level def listed under the class above it is found by name and missed by owner
      const stale = path.join(tmp('sigmap-recall-ext-'), 'stale.js');
      put(stale, "module.exports = { extract: () => ['class Top', '  def helper'] };");
      const wrong = rb.measure({ reposDir: repos, extractorPath: stale, index: false });
      assert.deepStrictEqual(cells(wrong.populations.extractor.rows).slice(2, 4), ['method 1/4', 'owner 0/4']);
    });

    await test('ruby.mjs keeps its command line, stays read-only without --index, and --min-* exits 1 under a floor', () => {
      const repos = tmp('sigmap-recall-rb-');
      put(path.join(repos, 'sidekiq/lib/a.rb'), RB_SRC);
      const script = path.join(ROOT, 'scripts/extraction-recall/ruby.mjs');
      const none = path.join(tmp('sigmap-recall-ext-'), 'none.js');
      put(none, 'module.exports = { extract: () => [] };');
      const ok = spawnSync(process.execPath, [script, '--repos', repos, '--min-class', '99'], { encoding: 'utf8' });
      assert.strictEqual(ok.status, 0, ok.stdout + ok.stderr);
      assert.ok(!/index:/.test(ok.stdout), 'the index step is opt-in');
      assert.strictEqual(fs.existsSync(path.join(repos, 'sidekiq/.context')), false);
      const bad = spawnSync(process.execPath, [script, '--repos', repos, '--extractor', none, '--min-class', '99'], { encoding: 'utf8' });
      assert.strictEqual(bad.status, 1, bad.stdout);
      assert.ok(/FAIL class: 0\.0% is below the floor of 99%/.test(bad.stdout), bad.stdout);
      const json = JSON.parse(spawnSync(process.execPath, [script, '--repos', repos, '--json'], { encoding: 'utf8' }).stdout);
      assert.deepStrictEqual(Object.keys(json).filter((k) => ['measured', 'filesCompared', 'pins', 'rows', 'failures'].includes(k)).sort(), ['failures', 'filesCompared', 'measured', 'pins', 'rows']);
      // a kind with nothing to find has a null recall: the command line must say so, not throw
      const empty = tmp('sigmap-recall-rb-');
      put(path.join(empty, 'sidekiq/lib/a.rb'), 'class A\nend\n');
      const r = spawnSync(process.execPath, [script, '--repos', empty, '--min-module', '50'], { encoding: 'utf8' });
      assert.strictEqual(r.status, 1, r.stdout + r.stderr);
      assert.ok(/module .*recall n\/a/.test(r.stdout) && /FAIL module: nothing to find/.test(r.stdout), r.stdout + r.stderr);
    });

    if (have('python3', ['--version'])) {
      await test('--save writes the report only for a complete run: not with --only, not without the index, and it does when complete', () => {
        const repos = tmp('sigmap-recall-both-');
        put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
        put(path.join(repos, 'sidekiq/lib/a.rb'), RB_SRC);
        put(path.join(repos, 'spdlog/include/spdlog/a.h'), 'class C {\n public:\n  void m();\n};\nenum class E { A };\nvoid f();\n');
        const out = path.join(tmp('sigmap-recall-out-'), 'report.json');
        put(path.join(repos, 'zod/packages/zod/src/a.ts'), 'export function plain(a: number) { return a; }\nexport const $g = (x: number) => x;\n');
        // C and C++ are measured against clangd and TypeScript against a typescript package SigMap does not
        // depend on: without either, that language is unmeasured and nothing is saved.
        const found = tsRef.findTypeScript();
        const withTs = found ? ['--typescript', found.path] : [];
        const unmeasured = [!have('clangd', ['--version']) && 'cpp', !found && 'typescript'].filter(Boolean);
        const only = run(['--repos', repos, '--only', 'python', '--save', '--out', out]);
        assert.strictEqual(only.status, 1, only.stdout + only.stderr);
        assert.ok(/a partial run \(--only\)/.test(only.stderr), only.stderr);
        const noIndex = run(['--repos', repos, ...withTs, '--no-index', '--save', '--out', out]);
        assert.strictEqual(noIndex.status, 1, noIndex.stdout + noIndex.stderr);
        // an unmeasured language is named first; either way nothing is saved
        assert.ok((unmeasured.length ? new RegExp(`unmeasured ${unmeasured.join(', ')}`) : /without the index/).test(noIndex.stderr), noIndex.stderr);
        assert.strictEqual(fs.existsSync(out), false, 'a partial run wrote a report');
        const whole = run(['--repos', repos, ...withTs, '--save', '--out', out]);
        if (unmeasured.length) {
          assert.strictEqual(whole.status, 1, whole.stdout + whole.stderr);
          assert.ok(new RegExp(`unmeasured ${unmeasured.join(', ')}`).test(whole.stderr), whole.stderr);
          assert.strictEqual(fs.existsSync(out), false);
          return;
        }
        assert.strictEqual(whole.status, 0, whole.stdout + whole.stderr);
        const saved = JSON.parse(fs.readFileSync(out, 'utf8'));
        assert.deepStrictEqual(Object.keys(saved.languages).sort(), ['cpp', 'python', 'ruby', 'typescript']);
        assert.ok(saved.version && saved.generated, 'stamped');
      });
    } else {
      skip('--save case', 'python3 is not installed');
    }
  } else {
    skip('ruby end to end (3 cases)', 'ruby is not installed');
  }

  // ── the committed floors, the saved report and the published page ─────────

  const floorsFile = JSON.parse(fs.readFileSync(path.join(ROOT, runner.FLOORS_REL), 'utf8'));
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, runner.REPORT_REL), 'utf8'));

  await test('the saved report records the reference version and the pins of every measured language', () => {
    assert.deepStrictEqual(Object.keys(report.languages).sort(), [...runner.ADAPTERS].sort());
    for (const [name, r] of Object.entries(report.languages)) {
      assert.strictEqual(r.measured, true, name);
      assert.ok(/^\d+\.\d+/.test(r.reference.version), `${name}: ${r.reference.version}`);
      for (const [repo, sha] of Object.entries(r.pins)) assert.ok(/^[0-9a-f]{7,}$/.test(sha), `${name}/${repo}: ${sha}`);
      for (const p of Object.values(r.populations)) assert.ok(p.rows.length && p.rows.every((x) => x.reference > 0));
    }
    const { LANGUAGES } = require('../../src/extractors/dispatch');
    assert.deepStrictEqual([...Object.keys(report.languages), ...Object.keys(report.unmeasured)].sort(), [...LANGUAGES].sort());
  });

  await test('every committed floor names a real population and kind, and the saved report meets it', () => {
    for (const [name, spec] of Object.entries(floorsFile.languages)) {
      const measuredRun = report.languages[name];
      assert.ok(measuredRun, `${name} has floors but no report`);
      const v = lib.evaluate(measuredRun, spec);
      assert.notStrictEqual(v.status, 'not-enforced', `${name}: the saved report was made on ${measuredRun.reference.version}, which no floor covers`);
      assert.strictEqual(v.status, 'pass', JSON.stringify(v.checks.filter((c) => c.status !== 'pass')));
      for (const ref of spec.references) {
        assert.ok(ref.measuredWith && ref.measuredWith.version, `${name}/${ref.match}: no measuredWith`);
        for (const [pop, kinds] of Object.entries(ref.floors)) {
          assert.ok(measuredRun.populations[pop], `${name}: floor for unknown population ${pop}`);
          for (const [kind, floor] of Object.entries(kinds)) {
            assert.ok(measuredRun.populations[pop].rows.some((r) => r.kind === kind), `${name}/${pop}: floor for unknown kind ${kind}`);
            assert.ok(Number.isInteger(floor) && floor > 0 && floor <= 99, `${name}/${pop}/${kind}: ${floor}`);
          }
        }
      }
    }
  });

  await test('every floor is the recorded recall rounded down less one point: tight enough to trip on a loss, never above what was measured', () => {
    const floorOf = (x) => (x >= 100 ? 99 : Math.floor(x) - 1);
    for (const [name, spec] of Object.entries(floorsFile.languages)) {
      for (const ref of spec.references) {
        for (const [pop, kinds] of Object.entries(ref.floors)) {
          for (const [kind, floor] of Object.entries(kinds)) {
            const where = `${name}/${ref.match}/${pop}/${kind}`;
            if (ref.measuredWith.recorded) {
              assert.strictEqual(floor, floorOf(ref.measuredWith.recorded[pop][kind]), where);
            } else if (report.languages[name].reference.version.startsWith(ref.match)) {
              const recall = report.languages[name].populations[pop].rows.find((r) => r.kind === kind).recall;
              // several interpreters were checked for a prefix: the floor is the lowest of them
              assert.ok(floor <= floorOf(recall) && floor >= floorOf(recall) - 1, `${where}: ${floor} for a recall of ${recall}`);
            }
          }
        }
      }
    }
  });

  await test('the pins in the report and the floors are the commits the manifest pins', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/xrepo-repos.json'), 'utf8'));
    const commit = (name) => manifest.repos.find((r) => r.name === name).commit;
    const check = (pins, where) => {
      for (const [repo, sha] of Object.entries(pins)) assert.ok(commit(repo).startsWith(sha), `${where}: ${repo} is at ${sha}, the manifest pins ${commit(repo)}`);
    };
    for (const [name, r] of Object.entries(report.languages)) check(r.pins, `report/${name}`);
    for (const [name, spec] of Object.entries(floorsFile.languages)) {
      for (const ref of spec.references) check(ref.measuredWith.pins, `floors/${name}/${ref.match}`);
    }
  });

  await test('typescript: the docs table publishes the committed before/after report, and its "after" rows are the saved report\'s', () => {
    const page = fs.readFileSync(path.join(ROOT, 'docs-vp/guide/extraction-recall.md'), 'utf8');
    const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/reports/extraction-recall-typescript.json'), 'utf8'));
    const pct = (r) => (r.recall == null ? 'n/a' : `${r.recall.toFixed(1)}%`);
    const cellsOf = (label) => {
      const line = page.split('\n').find((l) => l.startsWith(`| ${label} |`));
      assert.ok(line, `no row for ${label}`);
      return line.split('|').slice(2, -1).map((c) => c.trim());
    };
    for (const [label, pop] of [['extractor, before #996', t.before.extractor], ['extractor, after #996', t.after.extractor], ['index as shipped, before #996', t.before.index], ['index as shipped, after #996', t.after.index]]) {
      const cells = cellsOf(label);
      assert.deepStrictEqual(cells.slice(1), tsx.KINDS.map((k) => pct(pop.rows.find((r) => r.kind === k))), label);
      assert.strictEqual(cells[0], pop.filesTotal && pop.filesTotal !== pop.filesCompared ? `${pop.filesCompared} of ${pop.filesTotal}` : String(pop.filesCompared), label);
    }
    const saved = report.languages.typescript;
    for (const pop of ['extractor', 'index']) {
      for (const k of tsx.KINDS) {
        const a = t.after[pop].rows.find((r) => r.kind === k);
        const b = saved.populations[pop].rows.find((r) => r.kind === k);
        assert.deepStrictEqual([a.found, a.reference], [b.found, b.reference], `${pop}/${k}`);
      }
    }
    assert.ok(page.includes(t.reference.version) && page.includes('benchmarks/reports/extraction-recall-typescript.json'));
    for (const sha of Object.values(t.pins)) assert.ok(page.includes(sha), `pin ${sha} not on the page`);
  });

  await test('the docs page publishes the numbers of the saved report, and the language table links to it', () => {
    const page = fs.readFileSync(path.join(ROOT, 'docs-vp/guide/extraction-recall.md'), 'utf8');
    const cellsOf = (label) => {
      const line = page.split('\n').find((l) => l.startsWith(`| ${label}`));
      assert.ok(line, `no row for ${label}`);
      return line.split('|').slice(2, -1).map((c) => c.trim()); // after the label
    };
    const pct1 = (x) => `${x.recall.toFixed(1)}%`;
    const rows = (lang, pop) => report.languages[lang].populations[pop].rows;
    const pyRows = {
      'extractor, regex tier': 'extractor-regex', 'extractor, AST tier': 'extractor-ast',
      'index as shipped, without': 'index-regex', 'index as shipped, with `python3`': 'index-ast',
    };
    for (const [label, pop] of Object.entries(pyRows)) {
      const cells = cellsOf(label);
      assert.deepStrictEqual(cells.slice(1), rows('python', pop).map(pct1), label);
      assert.strictEqual(Number(cells[0].split(' ')[0]), report.languages.python.populations[pop].filesCompared, label);
    }
    const rbExtractor = cellsOf('extractor |');
    assert.deepStrictEqual(rbExtractor.slice(1), rows('ruby', 'extractor').map(pct1));
    const rbIndex = cellsOf('index as shipped |');
    assert.deepStrictEqual(rbIndex.slice(1), rows('ruby', 'index').map(pct1));
    const idx = report.languages.ruby.populations.index;
    assert.strictEqual(rbIndex[0], `${idx.filesCompared} of ${idx.filesTotal}`);
    for (const [lang, v] of [['python', report.languages.python.reference.version], ['ruby', report.languages.ruby.reference.version]]) {
      assert.ok(page.includes(v), `${lang} reference version ${v} not on the page`);
    }
    for (const sha of [...Object.values(report.languages.python.pins), ...Object.values(report.languages.ruby.pins)]) {
      assert.ok(page.includes(sha), `pin ${sha} not on the page`);
    }
    assert.ok(page.includes(`These ${Object.keys(report.unmeasured).length} have no adapter`), 'the unmeasured count');
    for (const l of Object.keys(report.unmeasured)) assert.ok(page.includes(l), `unmeasured language ${l} not listed`);
    // the prose figures, not only the table cells
    const n = (x) => x.toLocaleString('en-US');
    const regexRows = Object.fromEntries(report.languages.python.populations['extractor-regex'].rows.map((x) => [x.kind, x]));
    assert.ok(page.includes(`${n(regexRows.class.found)} of ${n(regexRows.class.reference)} classes, ${n(regexRows.func.found)} of ${n(regexRows.func.reference)} functions and ${n(regexRows.method.found)} of ${n(regexRows.method.reference)} methods`), 'the regex-tier counts');
    assert.ok(page.includes(`(${regexRows.func.skipped} functions and ${regexRows.method.skipped} methods for the regex tier)`), 'the skipped counts');
    const idxAst = Object.fromEntries(report.languages.python.populations['index-ast'].rows.map((x) => [x.kind, x]));
    const idxRegex = Object.fromEntries(report.languages.python.populations['index-regex'].rows.map((x) => [x.kind, x]));
    assert.ok(page.includes(`the ${idxAst.class.missed} classes and ${idxAst.method.missed} methods the index misses with \`python3\``), 'the AST-path misses');
    assert.ok(page.includes(`of the ${idxRegex.method.missed} methods it misses are in`), 'the regex-tier method misses');
    const idxRb = report.languages.ruby.populations.index;
    assert.ok(page.includes(`index recall is ${idxRb.rowsAllFiles.filter((x) => !/^anchor/.test(x.kind)).map((x) => `${x.recall.toFixed(1)}%`).join(' / ')}`), 'the all-files Ruby index recall (the anchor rows are about what is emitted, so a file the index lacks adds nothing to them)');
    const rbRows = Object.fromEntries(report.languages.ruby.populations.extractor.rows.map((x) => [x.kind, x]));
    assert.ok(page.includes(`(${n(rbRows.class.found)} of ${n(rbRows.class.reference)} classes, ${n(rbRows.module.found)} of ${n(rbRows.module.reference)} modules, ${n(rbRows.method.found)} of ${n(rbRows.method.reference)} methods, ${n(rbRows.owner.found)} of ${n(rbRows.owner.reference)} under the right owner)`), 'the Ruby counts');
    // C and C++: the section's own table, found by its heading so the Ruby rows above cannot be matched
    const cxr = report.languages.cpp;
    const cxSection = page.slice(page.indexOf('## C and C++'), page.indexOf('## Not measured'));
    assert.ok(cxSection.length > 0, 'no C and C++ section');
    const cxCells = (label) => {
      const line = cxSection.split('\n').find((l) => l.startsWith(`| ${label}`));
      assert.ok(line, `no C and C++ row for ${label}`);
      return line.split('|').slice(2, -1).map((c) => c.trim());
    };
    const cxExtractor = cxCells('extractor |');
    const cxRows = Object.fromEntries(cxr.populations.extractor.rows.map((x) => [x.kind, x]));
    const cxPct = (kinds) => kinds.map((k) => pct1(cxRows[k]));
    assert.strictEqual(cxExtractor[0], String(cxr.populations.extractor.filesCompared));
    assert.deepStrictEqual(cxExtractor.slice(1, 6), cxPct(['class', 'enum', 'function', 'method', 'owner']));
    assert.strictEqual(cxExtractor[6], pct1(cxRows.anchored));
    assert.strictEqual(cxExtractor[7], pct1(cxRows['anchor-exact']));
    const cxIndex = cxCells('index as shipped |');
    const cxIdx = cxr.populations.index;
    assert.strictEqual(cxIndex[0], `${cxIdx.filesCompared} of ${cxIdx.filesTotal}`);
    assert.deepStrictEqual(cxIndex.slice(1, 6), cxIdx.rows.filter((x) => !/^anchor/.test(x.kind)).map(pct1));
    assert.ok(cxSection.includes(`clangd ${cxr.reference.version}`), 'the clangd version');
    assert.ok(page.includes(`## C and C++ — against clangd ${cxr.reference.version}`), 'the heading names the version');
    for (const sha of Object.values(cxr.pins)) assert.ok(page.includes(sha), `pin ${sha} not on the page`);
    assert.ok(cxSection.includes(`${n(cxRows.anchored.found)} of ${n(cxRows.anchored.reference)}`), 'the anchored count');
    assert.ok(cxSection.includes(`${n(cxRows['anchor-exact'].found)} of ${n(cxRows['anchor-exact'].reference)}`), 'the anchor-exact count');
    assert.ok(cxSection.includes(`the other ${cxRows['anchor-exact'].skipped} name`), 'the anchor-exact skipped count');
    assert.ok(!/unmeasured[^\n]*\bcpp\b/.test(page.slice(page.indexOf('## Not measured'), page.indexOf('## How it is measured'))), 'cpp is listed as unmeasured');
    const held = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/reports/extraction-recall-cpp-held-out.json'), 'utf8'));
    const heldCells = (label) => {
      const line = cxSection.split('\n').find((l) => l.startsWith(`| ${label}`));
      assert.ok(line, `no held-out row for ${label}`);
      return line.split('|').slice(2, -1).map((c) => c.trim());
    };
    const heldPct = (pop) => pop.rows.map((x) => `${(100 * x.found / x.reference).toFixed(1)}%`);
    const heldFiles = (pop) => `${pop.files}${pop.filesTotal ? ` of ${pop.filesTotal}` : ''}`;
    for (const [label, pop] of [['first check', held.first.extractor], ['after the three changes below', held.final.extractor], ['after the three changes, index', held.final.index]]) {
      const cells = heldCells(label);
      assert.strictEqual(cells[0], heldFiles(pop), label);
      assert.deepStrictEqual(cells.slice(1), heldPct(pop), label);
    }
    for (const sha of Object.values(held.commits)) assert.ok(cxSection.includes(sha), `held-out commit ${sha} not on the page`);
    const languages = fs.readFileSync(path.join(ROOT, 'docs-vp/guide/languages.md'), 'utf8');
    for (const lang of ['Python', 'Ruby', 'C / C++']) {
      const row = languages.split('\n').find((l) => l.startsWith(`| ${lang} |`));
      assert.ok(row && row.includes('/guide/extraction-recall'), `${lang} row of the language table does not link to the report`);
    }
    assert.ok(fs.readFileSync(path.join(ROOT, 'docs-vp/.vitepress/config.mts'), 'utf8').includes("'/guide/extraction-recall'"), 'not in the sidebar');
  });

  await test('the gate is wired: an npm script, and a CI step in the job that fetches the pinned clones', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.scripts['validate:extraction-recall'], 'node scripts/run-extraction-recall.mjs --gate');
    const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    const job = ci.slice(ci.indexOf('\n  xrepo:'));
    const next = job.slice(1).search(/\n  [a-z][\w-]*:\n/);
    const body = next === -1 ? job : job.slice(0, next + 1);
    assert.ok(body.includes('node scripts/fetch-xrepo-repos.mjs'), 'the xrepo job does not fetch the clones');
    assert.ok(/npm run validate:extraction-recall -- --require-reference/.test(body), 'the xrepo job does not run the recall gate with --require-reference');
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
  process.exit(failed > 0 ? 1 : 0);
})();
