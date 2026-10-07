'use strict';

/**
 * Symbols are confirmed against the source, not only the index (#914, closes #910).
 *
 * Covers:
 *   Primitive (src/verify/source-confirm.js) — real temp repos
 *    1. a call, a generic call, a function-valued binding, a keyword definition and an
 *       exported binding confirm a name, in every language family the maskers read
 *    2. a comment, a docstring, a string, a template literal and a regex literal confirm
 *       nothing — not even as `name()` inside them
 *    3. whole identifiers only; a call to a name is not a fabrication of it
 *    4. excluded trees, minified/generated files, unsupported languages, oversized files
 *    5. order and budget: indexed files first, a sorted walk, a byte/file cap, no clock
 *   Guard (verify), through a real generated index
 *    6. #910: a real symbol past the 25-signature cap is not flagged; an invented one is
 *    7. a real symbol outside the indexed roots, and one the extractor does not list
 *    8. a name only a comment or a string mentions stays flagged
 *    9. a caller-supplied symbol set is the whole truth; the lookup is injectable and
 *       runs only for names that would be flagged
 *   Plan (verify-plan)
 *   10. a referenced real symbol outside the index is no longer an `unknown-symbol` error;
 *       the redefinition guard is unchanged
 *   Judge and CLI
 *   11. a correct answer citing a symbol past the cut is grounded through the repo
 *   12. `verify` exits 0 for it and 1 for an invented name
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const sc = require(path.join(ROOT, 'src', 'verify', 'source-confirm'));
const { verify } = require(path.join(ROOT, 'src', 'verify', 'hallucination-guard'));
const { verifyPlan } = require(path.join(ROOT, 'src', 'plan', 'verify-plan'));
const { claimGrounding } = require(path.join(ROOT, 'src', 'judge', 'judge-engine'));
const { resolveContextFile } = require(path.join(ROOT, 'src', 'judge', 'context-source'));

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

const cleanup = [];
/** Write `{ 'rel/path': 'content' }` into a fresh temp repo. */
function repo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-confirm-'));
  cleanup.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}
/** Index a temp repo with the real generator. */
function index(dir) {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: dir, stdio: 'ignore' });
  assert.strictEqual(r.status, 0, 'gen-context exited ' + r.status);
  return dir;
}
const confirmed = (dir, names, opts) => [...sc.confirmSymbols(dir, names, opts).confirmed.keys()].sort();
const flagged = (result) => result.issues.filter((i) => i.type === 'fake-symbol').map((i) => i.value);
const answer = (...calls) => 'See ' + calls.map((c) => '`' + c + '`').join(' and ') + '.';
/** `def handler_00(a)` … — a Python file with `n` functions, far past the 25-signature cap. */
const bigPy = (n) => Array.from({ length: n }, (_, i) => `def handler_${String(i).padStart(2, '0')}(a):\n    return a\n`).join('\n');

// ── 1. Forms, by language family ─────────────────────────────────────────────

const FORMS = [
  // [file, source, name, what confirms it]
  ['a.py', 'def alpha_py(x):\n    return x\n', 'alpha_py', 'def'],
  ['a.py', 'class AlphaPyClass:\n    pass\n', 'AlphaPyClass', 'class'],
  ['a.py', 'alpha_lambda = lambda x: x\n', 'alpha_lambda', 'lambda binding'],
  ['a.rb', 'def alpha_rb\nend\n', 'alpha_rb', 'def without parameters'],
  ['a.go', 'func (s *Svc) AlphaGo(x int) {}\n', 'AlphaGo', 'method with a receiver'],
  ['a.go', 'type AlphaGoType struct{}\n', 'AlphaGoType', 'type'],
  ["a.rs", "pub fn alpha_rs<'a>(x: &'a str) -> &'a str { x }\n", 'alpha_rs', 'fn with a lifetime'],
  ['a.rs', 'pub struct AlphaStruct;\n', 'AlphaStruct', 'struct'],
  ['a.kt', 'suspend inline fun <T> alphaKt(block: () -> T): T = block()\n', 'alphaKt', 'fun with a generic'],
  ['a.kt', 'fun CoroutineScope.alphaExt(): Job = launch {}\n', 'alphaExt', 'extension fun'],
  ['a.cs', 'public static void AlphaCs<T>(this T x) { }\n', 'AlphaCs', 'generic method head'],
  ['a.java', 'public static <T> List<T> alphaJava(T... a) { return null; }\n', 'alphaJava', 'method head'],
  ['a.ts', 'export const alphaTs = (x: number) => x;\n', 'alphaTs', 'exported arrow'],
  ['a.ts', 'export const alphaCast = impl as unknown as Impl;\n', 'alphaCast', 'exported binding that is not function-shaped'],
  ['a.ts', 'const alphaTyped: Handler = (req) => req;\n', 'alphaTyped', 'typed arrow binding'],
  ['a.ts', 'export class AlphaTsClass {}\n', 'AlphaTsClass', 'class'],
  ['a.js', 'exports.alphaJs = helper;\n', 'alphaJs', 'CommonJS export'],
  ['a.js', 'fastify.addAlpha = function () {};\n', 'addAlpha', 'assigned method'],
  ['a.js', 'const o = { betaMethod: function () {} };\n', 'betaMethod', 'object-literal method'],
  ['a.js', 'obj.gammaCall(1);\n', 'gammaCall', 'a call (the code uses it, so it is not invented)'],
  ['a.php', 'class P { public function alphaPhp($x) { return $x; } }\n', 'alphaPhp', 'method'],
  ['a.swift', 'func alphaSwift<T>(_ x: T) {}\n', 'alphaSwift', 'func with a generic'],
  ['a.scala', 'def alphaScala[T](x: T): T = x\n', 'alphaScala', 'def with a type parameter'],
  ['a.ex', 'def alpha_ex(x) do\n  x\nend\n', 'alpha_ex', 'def'],
  ['a.R', 'alphaR <- function(x) x\n', 'alphaR', 'R binding'],
  ['a.sh', 'alpha_sh() {\n  echo hi\n}\n', 'alpha_sh', 'shell function'],
  ['a.vue', '<script>\nexport default {\n  methods: { alphaVue() {} }\n}\n</script>\n', 'alphaVue', 'method in a single-file component'],
];

test('every form confirms a name, in every language family the maskers read', () => {
  for (const [file, src, name, what] of FORMS) {
    const dir = repo({ [file]: src });
    assert.deepStrictEqual(confirmed(dir, [name]), [name], `${file}: ${name} — ${what}`);
  }
});

test('the confirming file is reported', () => {
  const dir = repo({ 'src/deep/mod.py': 'def reported_fn():\n    pass\n' });
  assert.strictEqual(sc.confirmSymbols(dir, ['reported_fn']).confirmed.get('reported_fn'), 'src/deep/mod.py');
});

// ── 2. Comments, strings and prose confirm nothing ───────────────────────────

const MASKED = [
  ['a.js', '// maskedFn() is not here\nconst x = 1;\n', 'maskedFn', 'a line comment'],
  ['a.js', '/* function maskedBlock(a) {} */\n', 'maskedBlock', 'a block comment'],
  ['a.js', "const s = 'call maskedStr() first';\n", 'maskedStr', 'a string'],
  ['a.js', 'const t = `${1} maskedTpl() ${2}`;\n', 'maskedTpl', 'a template literal'],
  ['a.js', 'const r = /maskedRe\\(/;\n', 'maskedRe', 'a regex literal'],
  ['a.ts', '// export const maskedExport = 1;\n', 'maskedExport', 'a commented export'],
  ['a.py', '# maskedPy() — removed\nx = 1\n', 'maskedPy', 'a # comment'],
  ['a.py', 'def real():\n    """Call maskedDoc() or def maskedDocDef(): to reset."""\n', 'maskedDoc', 'a docstring'],
  ['a.py', 'def real():\n    """Call maskedDoc() or def maskedDocDef(): to reset."""\n', 'maskedDocDef', 'a docstring definition'],
  ['a.py', 'MSG = "run maskedPyStr() first"\n', 'maskedPyStr', 'a Python string'],
  ['a.rb', "# def maskedRb\nputs 'maskedRbStr()'\n", 'maskedRb', 'a Ruby comment'],
  ['a.go', '// func MaskedGo() {}\nvar s = "MaskedGoStr()"\n', 'MaskedGo', 'a Go comment'],
  ['a.go', '// func MaskedGo() {}\nvar s = "MaskedGoStr()"\n', 'MaskedGoStr', 'a Go string'],
  ['a.rs', '// fn masked_rs() {}\nlet s = "masked_rs_str()";\n', 'masked_rs', 'a Rust comment'],
  ['a.kt', '/* fun maskedKt() */\nval s = "maskedKtStr()"\n', 'maskedKt', 'a Kotlin block comment'],
  ['a.sh', '# maskedSh() { }\necho hi\n', 'maskedSh', 'a shell comment'],
  // Multi-line text blocks: `maskCode` alone would leave their bodies to be read as code.
  ['a.kt', 'val q = """\n  call maskedKtBlock() first\n"""\n', 'maskedKtBlock', 'a Kotlin raw string'],
  ['a.java', 'String q = """\n  def maskedJavaBlock(): pass\n  """;\n', 'maskedJavaBlock', 'a Java text block'],
  ['a.swift', 'let q = """\n  call maskedSwiftBlock() first\n  """\n', 'maskedSwiftBlock', 'a Swift multi-line string'],
  ['a.scala', 'val q = """\n  maskedScalaBlock()\n"""\n', 'maskedScalaBlock', 'a Scala triple-quoted string'],
  ['a.cs', 'var q = """\n  maskedCsBlock()\n  """;\n', 'maskedCsBlock', 'a C# raw string'],
  ['a.dart', "var q = '''\n  maskedDartBlock()\n''';\n", 'maskedDartBlock', 'a Dart multi-line string'],
];

test('a comment, docstring, string, template or regex literal confirms nothing — even as name()', () => {
  for (const [file, src, name, what] of MASKED) {
    const dir = repo({ [file]: src });
    assert.deepStrictEqual(confirmed(dir, [name]), [], `${file}: ${name} must stay unconfirmed — ${what}`);
  }
});

test('code between and after text blocks is still read — a block does not swallow the next one', () => {
  const dir = repo({ 'a.kt': 'val a = """\n  one()\n"""\nfun afterBlock() {}\nval b = """\n  two()\n"""\nfun lastFn() {}\n' });
  assert.deepStrictEqual(confirmed(dir, ['afterBlock', 'lastFn', 'one', 'two']), ['afterBlock', 'lastFn']);
});

test('whole identifiers only: a longer name does not confirm a shorter one', () => {
  const dir = repo({ 'a.js': 'function clearAll(x) {}\nfunction xclear(y) {}\nconst clearing = (z) => z;\n' });
  assert.deepStrictEqual(confirmed(dir, ['clear']), []);
  assert.deepStrictEqual(confirmed(dir, ['clearAll', 'xclear', 'clearing']), ['clearAll', 'clearing', 'xclear']);
});

test('the bare word is never enough: a variable named like the symbol confirms nothing', () => {
  const dir = repo({ 'a.js': 'const result = 1;\nreturn result + 1;\n', 'b.py': 'value = 3\nprint(value)\n' });
  assert.deepStrictEqual(confirmed(dir, ['result', 'value']), []);
});

// ── 3. What is scanned ───────────────────────────────────────────────────────

test('only code is read: markdown, data and an unsupported language confirm nothing', () => {
  const dir = repo({
    'README.md': 'Call `docOnly()` and `def docDef(): pass`.\n',
    'data.json': '{ "jsonOnly": "function jsonOnly() {}" }\n',
    'conf.yaml': 'key: yamlOnly()\n',
    'a.lua': 'function luaOnly() end\n',
    'q.sql': 'CREATE FUNCTION sqlOnly() RETURNS int;\n',
  });
  assert.deepStrictEqual(confirmed(dir, ['docOnly', 'docDef', 'jsonOnly', 'yamlOnly', 'luaOnly', 'sqlOnly']), []);
});

test('somebody else\'s code is skipped: the generator\'s exclude, vendored trees, dot directories, minified and generated files', () => {
  const body = (n) => `function ${n}() {}\n`;
  const dir = repo({
    'node_modules/pkg/i.js': body('inNodeModules'),
    'vendor/lib/x.go': 'func InVendor() {}\n',
    'dist/app.js': body('inDist'),
    'build/app.js': body('inBuild'),
    'third_party/t.c': 'int inThirdParty(void) { return 0; }\n',
    'venv/lib/site-packages/p.py': 'def in_venv(): pass\n',
    '.hidden/h.py': 'def in_dot_dir(): pass\n',
    'static/jquery.min.js': body('inMinified'),
    'api/service.generated.ts': body('inGenerated'),
    'api/msg.pb.go': 'func InProto() {}\n',
    'src/ok.js': body('inSrc'),
  });
  assert.deepStrictEqual(confirmed(dir, ['inNodeModules', 'InVendor', 'inDist', 'inBuild', 'inThirdParty', 'in_venv', 'in_dot_dir', 'inMinified', 'inGenerated', 'InProto']), []);
  assert.deepStrictEqual(confirmed(dir, ['inSrc']), ['inSrc'], 'ordinary source is scanned');
});

test('the project\'s own `exclude` is honoured, and a broken config falls back to the defaults', () => {
  const dir = repo({
    'gen-context.config.json': JSON.stringify({ exclude: ['legacy'] }),
    'legacy/old.py': 'def in_legacy(): pass\n',
    'src/new.py': 'def in_src(): pass\n',
  });
  assert.deepStrictEqual(confirmed(dir, ['in_legacy', 'in_src']), ['in_src']);
  const broken = repo({ 'gen-context.config.json': '{ not json', 'src/new.py': 'def in_src(): pass\n', 'node_modules/x.py': 'def in_nm(): pass\n' });
  assert.deepStrictEqual(confirmed(broken, ['in_src', 'in_nm']), ['in_src']);
  assert.ok(sc.excludedNames(broken).has('node_modules'));
});

test('a file over the size limit is skipped, and a symlink is not followed', () => {
  const dir = repo({ 'small.py': 'def in_small(): pass\n' });
  fs.writeFileSync(path.join(dir, 'huge.py'), 'def in_huge(): pass\n' + '#'.repeat(sc.MAX_FILE_BYTES + 10));
  const outside = repo({ 'o.py': 'def in_linked(): pass\n' });
  if (process.platform !== 'win32') fs.symlinkSync(outside, path.join(dir, 'linked'));
  assert.deepStrictEqual(confirmed(dir, ['in_small', 'in_huge', 'in_linked']), ['in_small']);
});

// ── 4. Order and budget ──────────────────────────────────────────────────────

test('the indexed files are read first; otherwise the walk is sorted — two runs agree', () => {
  const dir = repo({ 'a/first.py': 'def dup_fn(): pass\n', 'b/second.py': 'def dup_fn(): pass\n' });
  const run = (opts) => sc.confirmSymbols(dir, ['dup_fn'], opts).confirmed.get('dup_fn');
  assert.strictEqual(run({}), 'a/first.py');
  assert.strictEqual(run({}), 'a/first.py');
  assert.strictEqual(run({ priority: ['b/second.py'] }), 'b/second.py');
});

test('the walk is sorted whatever order the filesystem lists in', () => {
  const dir = repo({ 'a/first.py': 'def dup_fn(): pass\n', 'b/second.py': 'def dup_fn(): pass\n', 'c.py': 'def dup_fn(): pass\n' });
  const real = fs.readdirSync;
  fs.readdirSync = (p, o) => real.call(fs, p, o).reverse();
  try {
    assert.strictEqual(sc.confirmSymbols(dir, ['dup_fn']).confirmed.get('dup_fn'), 'a/first.py');
  } finally {
    fs.readdirSync = real;
  }
});

test('the budget ends the walk without a clock: names found earlier stand, the rest stay unconfirmed', () => {
  const files = {};
  for (let i = 0; i < 30; i++) files[`m${String(i).padStart(2, '0')}.py`] = `def filler_${i}(): pass\n`;
  files['z_last.py'] = 'def target_fn(): pass\n';
  const dir = repo(files);
  const cut = sc.confirmSymbols(dir, ['target_fn', 'filler_0'], { maxFiles: 5 });
  assert.strictEqual(cut.truncated, true);
  assert.strictEqual(cut.files, 5);
  assert.deepStrictEqual([...cut.confirmed.keys()], ['filler_0'], 'a name inside the budget is still confirmed');
  const whole = sc.confirmSymbols(dir, ['target_fn']);
  assert.strictEqual(whole.truncated, false);
  assert.deepStrictEqual([...whole.confirmed.keys()], ['target_fn']);
  const viaPriority = sc.confirmSymbols(dir, ['target_fn'], { maxFiles: 1, priority: ['z_last.py'] });
  assert.deepStrictEqual([...viaPriority.confirmed.keys()], ['target_fn'], 'the priority files are inside the budget');
  const bytes = sc.confirmSymbols(dir, ['target_fn'], { maxBytes: 40 });
  assert.strictEqual(bytes.truncated, true);
  assert.deepStrictEqual([...bytes.confirmed.keys()], []);
});

test('nothing is read when there is nothing to confirm; the walk stops at the last name', () => {
  const dir = repo({ 'a.py': 'def only_fn(): pass\n', 'b.py': 'def other(): pass\n' });
  assert.deepStrictEqual(sc.confirmSymbols(dir, []), { confirmed: new Map(), files: 0, bytes: 0, truncated: false });
  assert.strictEqual(sc.confirmSymbols(dir, ['only_fn']).files, 1, 'the walk ends at the file that confirms the last name');
});

test('a 3,000-file repository is scanned within a loose bound, counters deterministic', () => {
  const files = {};
  for (let i = 0; i < 3000; i++) files[`pkg${i % 30}/m${i}.py`] = `def fn_${i}(a):\n    return a\n`;
  const dir = repo(files);
  const t = Date.now();
  const r = sc.confirmSymbols(dir, ['definitely_not_defined_anywhere']);
  assert.strictEqual(r.files, 3000);
  assert.strictEqual(r.confirmed.size, 0);
  assert.ok(Date.now() - t < 5000, `scan took ${Date.now() - t}ms`);
});

// ── 5. verify, through a real index ──────────────────────────────────────────

test('#910: a real symbol past the 25-signature cap is not flagged; an invented one is', () => {
  const dir = index(repo({ 'src/models.py': bigPy(40) }));
  const text = answer('handler_35(a)', 'handler_36(a)', 'handler_9x(a)');
  const before = verify(text, dir, { sourceConfirm: false });
  assert.deepStrictEqual(flagged(before).sort(), ['handler_35', 'handler_36', 'handler_9x'],
    'the index really lacks the symbols past the cut — otherwise this test proves nothing');
  const after = verify(text, dir);
  assert.deepStrictEqual(flagged(after), ['handler_9x']);
  assert.strictEqual(after.summary.symbolsConfirmed, 2);
  assert.strictEqual(after.summary.byType['fake-symbol'], 1);
});

test('a real symbol in a file outside the indexed roots, and one the extractor does not list, are not flagged', () => {
  const dir = index(repo({
    'gen-context.config.json': JSON.stringify({ srcDirs: ['src'] }),
    'src/mw.ts': 'const immerImpl = (init: unknown) => init;\nexport const immer = immerImpl as unknown as Immer;\nexport function indexedFn(a: number) { return a; }\n',
    'examples/demo.py': 'def run_demo():\n    pass\n',
  }));
  const text = answer('run_demo()', 'immer(fn)', 'indexedFn(1)', 'made_up_fn()');
  assert.deepStrictEqual(flagged(verify(text, dir, { sourceConfirm: false })).sort(), ['immer', 'made_up_fn', 'run_demo'],
    'run_demo is outside the roots and immer is not listed by the extractor');
  assert.deepStrictEqual(flagged(verify(text, dir)), ['made_up_fn']);
});

test('a name only a comment or a string mentions stays flagged', () => {
  const dir = index(repo({
    'src/a.py': 'def snapshot():\n    # purge_expired() belongs in the audit trail\n    raise RuntimeError("run recount_stock() first")\n',
  }));
  const text = answer('purge_expired(x)', 'recount_stock(y)', 'snapshot()');
  assert.deepStrictEqual(flagged(verify(text, dir)).sort(), ['purge_expired', 'recount_stock']);
});

test('a caller-supplied symbol set is the whole truth; the lookup is injectable and only runs for names that would be flagged', () => {
  const dir = index(repo({ 'src/models.py': bigPy(40), 'examples/x.py': 'def in_examples(): pass\n' }));
  const text = answer('in_examples()', 'handler_35(a)');
  // Hermetic: with its own set the caller's answer stands — nothing is scanned.
  assert.deepStrictEqual(flagged(verify(text, dir, { symbolSet: new Set(['other']) })).sort(), ['handler_35', 'in_examples']);
  // Injectable: called once, with the unique names that would be flagged.
  const calls = [];
  const r = verify(text + '\n\nAnd `in_examples()` once more, on another line.', dir, {
    confirmSymbols: (names) => { calls.push(names); return new Set(['in_examples']); },
  });
  assert.deepStrictEqual(calls, [['in_examples', 'handler_35']]);
  assert.deepStrictEqual(flagged(r), ['handler_35']);
  // Never called when nothing would be flagged.
  const never = [];
  verify(answer('handler_01(a)'), dir, { confirmSymbols: (n) => { never.push(n); return new Set(); } });
  assert.deepStrictEqual(never, []);
  assert.strictEqual(verify(answer('handler_01(a)'), dir).summary.symbolsConfirmed, 0);
});

test('an installed-library or global name is still handled before the source is consulted', () => {
  const dir = index(repo({ 'src/a.py': 'def only_fn():\n    pass\n' }));
  const seen = [];
  verify(answer('structuredClone(x)', 'only_fn()', 'unknown_one()'), dir, { confirmSymbols: (n) => { seen.push(...n); return new Set(); } });
  assert.deepStrictEqual(seen, ['unknown_one'], 'a language global and an indexed name never reach the lookup');
});

// ── 6. verify-plan ───────────────────────────────────────────────────────────

test('verify-plan: a referenced real symbol outside the index is no longer an unknown-symbol error', () => {
  const dir = index(repo({ 'src/models.py': bigPy(40) }));
  const plan = '# Plan\n\nReuse `handler_35(a)` and `handler_9x(a)`.\n';
  const issues = (r) => r.issues.filter((i) => i.type === 'unknown-symbol').map((i) => i.ref);
  assert.deepStrictEqual(issues(verifyPlan(plan, dir, { confirmSymbols: () => new Set() })).sort(), ['handler_35', 'handler_9x']);
  const r = verifyPlan(plan, dir);
  assert.deepStrictEqual(issues(r), ['handler_9x']);
  assert.strictEqual(r.summary.errors, 1);
  // One lookup, for the unique names the index lacks — never for an indexed one.
  const calls = [];
  verifyPlan(plan + '\nAgain `handler_35(a)` and `handler_01(a)`.\n', dir, { confirmSymbols: (n) => { calls.push(n); return new Set(); } });
  assert.deepStrictEqual(calls, [['handler_35', 'handler_9x']]);
});

test('verify-plan: the redefinition guard is unchanged — a name introduced past the cut is still not caught', () => {
  const dir = index(repo({ 'src/models.py': bigPy(40) }));
  const r = verifyPlan('# Plan\n\nCreates: handler_35\n', dir);
  assert.strictEqual(r.introduces[0].exists, false, 'widening the redefinition guard is a separate, false-negative-direction change');
});

// ── 7. judge and CLI ─────────────────────────────────────────────────────────

test('judge: a correct answer citing a symbol past the cut is grounded through the repo', () => {
  const dir = index(repo({ 'src/models.py': bigPy(40) }));
  const context = fs.readFileSync(resolveContextFile(dir), 'utf8');
  assert.ok(!context.includes('handler_35'), 'the context never quotes it');
  const g = claimGrounding(answer('handler_35(a)', 'handler_9x(a)'), context, { cwd: dir });
  const by = Object.fromEntries(g.checked.map((c) => [c.value, c]));
  assert.strictEqual(by.handler_35.grounded, true);
  assert.strictEqual(by.handler_35.via, 'repo');
  assert.strictEqual(by.handler_9x.grounded, false);
});

test('CLI: `verify` exits 0 for a real symbol past the cut and 1 for an invented one', () => {
  const dir = index(repo({ 'src/models.py': bigPy(40) }));
  const run = (text) => {
    const f = path.join(dir, 'answer.md');
    fs.writeFileSync(f, text);
    return spawnSync(process.execPath, [SCRIPT, 'verify', f], { cwd: dir, encoding: 'utf8' });
  };
  assert.strictEqual(run(answer('handler_35(a)')).status, 0);
  const bad = run(answer('handler_9x(a)'));
  assert.strictEqual(bad.status, 1);
  assert.ok(/handler_9x/.test(bad.stdout + bad.stderr));
});

for (const d of cleanup) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }

console.log(`\nverify-source-confirm: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
