'use strict';

/**
 * Files the extractors read nothing from (agent study, Stage H).
 *
 * Two changes, each with its plain sibling beside it so that a fix which only "works" by matching
 * everything is caught:
 *
 *   E  the PHP extractor reads `final` / `readonly` classes, namespaced parents and interfaces,
 *      several interfaces and enums (it took `abstract class` and a bare-word parent only, so a
 *      file made of them was not in the index at all);
 *   P  a source file that still yields no signature is recorded under `bare` in
 *      `.context/sig-index.json`, returned by `buildSigIndex(cwd, { bare: true })` as an entry with
 *      no signatures and ranked on its path. The context file handed to an agent does not change,
 *      and a caller that does not ask sees the index it always saw.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const dispatch = require(path.join(ROOT, 'src/extractors/dispatch'));
const bareFiles = require(path.join(ROOT, 'src/retrieval/bare-files'));
const store = require(path.join(ROOT, 'src/retrieval/sig-index-store'));
const { buildSigIndex, rank } = require(path.join(ROOT, 'src/retrieval/ranker'));
const { buildBodyWords } = require(path.join(ROOT, 'src/retrieval/body-words'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const heads = (sigs) => sigs.map((s) => s.replace(/\s+:\d+-\d+$/, ''));

// ── E: PHP ───────────────────────────────────────────────────────────────────

const php = (decl) => `<?php\n${decl}\n{\n    public function run(): void {}\n}\n`;

test('php: a plain class and `abstract class` still extract (control)', () => {
  assert.deepStrictEqual(heads(dispatch.extractFile('a.php', php('class A'))), ['class A', '  function run() → void']);
  assert.deepStrictEqual(heads(dispatch.extractFile('a.php', php('abstract class A'))), ['class A', '  function run() → void']);
});

for (const [decl, head] of [
  ['final class A', 'class A'],
  ['final class A extends B', 'class A'],
  ['class A extends \\Foo\\Bar', 'class A'],
  ['final class A extends \\Foo\\Bar implements \\Countable, Foo\\Baz', 'class A'],
  ['final readonly class A', 'class A'],
  ['readonly final class A', 'class A'],
  ['class A implements\n    B,\n    \\C\\D', 'class A'],
  ['enum A: string', 'enum A'],
  ['enum A: int implements HasLabel', 'enum A'],
  ['enum A', 'enum A'],
  ['interface A extends B, \\C\\D', 'interface A'],
  ['trait A', 'trait A'],
]) {
  test(`php: \`${decl.replace(/\n\s*/g, ' ')}\` extracts the type and its method`, () => {
    assert.deepStrictEqual(heads(dispatch.extractFile('a.php', php(decl)))[0], head);
    assert.ok(heads(dispatch.extractFile('a.php', php(decl))).includes('  function run() → void'), 'method missing');
  });
}

test('php: text that is not a declaration yields nothing', () => {
  assert.deepStrictEqual(dispatch.extractFile('a.php', '<?php\n$x = "class Foo {";\nclass_exists("A");\n$y = new class { public function f() {} };\n'), []);
});

// ── P: the rule ──────────────────────────────────────────────────────────────

const FIVE = 'a\nb\nc\nd\ne\n';

test('rule: a programming-language file with five non-blank lines is a candidate', () => {
  for (const f of ['src/a.ts', 'src/a.tsx', 'a.js', 'a.py', 'src/main.rs', 'a.php', 'a.rb', 'a.go', 'a.java', 'a.cs', 'a.sh', 'a.gd']) {
    assert.strictEqual(bareFiles.isBareCandidate(f, FIVE), true, f);
  }
});

test('rule: fewer than five non-blank lines is not', () => {
  assert.strictEqual(bareFiles.isBareCandidate('a.py', 'a\nb\nc\nd\n\n\n\n'), false);
  assert.strictEqual(bareFiles.isBareCandidate('a.py', ''), false);
  assert.strictEqual(bareFiles.isBareCandidate('a.py', 'a\nb\nc\nd\ne'), true, 'a last line without a newline counts');
});

test('rule: data and markup files are not candidates', () => {
  for (const f of ['a.yml', 'a.yaml', 'a.toml', 'a.xml', 'a.html', 'a.css', 'a.md', 'a.sql', 'a.json', 'Dockerfile', 'a.txt', 'Makefile']) {
    assert.strictEqual(bareFiles.isBareCandidate(f, FIVE), false, f);
  }
});

test('rule: tests, mocks, generated, declaration and minified files are not candidates', () => {
  for (const f of ['a.test.ts', 'tests/a.py', 'src/test/java/A.java', 'a_test.go', 'src/mocks/a.js', 'a.generated.ts', 'a.pb.go', 'a.d.ts', 'a.min.js']) {
    assert.strictEqual(bareFiles.isBareCandidate(f, FIVE), false, f);
  }
});

test('rule: a CI definition is not a candidate even though it is source-like', () => {
  assert.strictEqual(bareFiles.isBareCandidate('.github/workflows/ci.yml', FIVE), false);
});

// ── P: the index file ────────────────────────────────────────────────────────

function tmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

test('store: bare is written sorted, de-duplicated, inside the project, and never alongside a file that has signatures', () => {
  const d = tmp('sigmap-bare-store-');
  store.writeFullIndex(d, [{ filePath: path.join(d, 'a.js'), sigs: ['function a()'] }], { bare: ['b.js', 'a.js', '../x.js', 'b.js', 'c.py', ''] });
  const m = store.readFullIndexMeta(d);
  assert.deepStrictEqual([...m.index.keys()], ['a.js']);
  assert.deepStrictEqual(m.bare, ['b.js', 'c.py']);
});

test('store: without bare the file is exactly what it was (no field)', () => {
  const d = tmp('sigmap-bare-store-');
  store.writeFullIndex(d, [{ filePath: path.join(d, 'a.js'), sigs: ['function a()'] }]);
  assert.ok(!('bare' in JSON.parse(fs.readFileSync(path.join(d, '.context', 'sig-index.json'), 'utf8'))));
  assert.deepStrictEqual(store.readFullIndexMeta(d).bare, []);
});

test('store: an index written before this field existed reads as having none', () => {
  const d = tmp('sigmap-bare-store-');
  fs.mkdirSync(path.join(d, '.context'));
  fs.writeFileSync(path.join(d, '.context', 'sig-index.json'), JSON.stringify({ schema: 1, files: { 'a.js': ['function a()'] } }));
  assert.deepStrictEqual(store.readFullIndexMeta(d).bare, []);
});

// ── P: the ranker ────────────────────────────────────────────────────────────

function project() {
  const d = tmp('sigmap-bare-');
  fs.mkdirSync(path.join(d, 'src', 'plugin'), { recursive: true });
  fs.mkdirSync(path.join(d, 'src', 'utils'), { recursive: true });
  fs.writeFileSync(path.join(d, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'] }));
  // exports nothing the extractor reads
  fs.writeFileSync(path.join(d, 'src', 'plugin', 'weather.ts'), 'import { WeatherPlugin } from "./impl";\nimport { units } from "./units";\n\nconst retries = 3;\nconst options = { units, retries };\n\nexport default new WeatherPlugin(options);\n');
  fs.writeFileSync(path.join(d, 'src', 'utils', 'format.ts'), 'export function formatDate(d: Date): string { return d.toISOString(); }\nexport function formatNumber(n: number): string { return String(n); }\n');
  fs.writeFileSync(path.join(d, 'src', 'utils', 'parse.ts'), 'export function parseDate(s: string): Date { return new Date(s); }\n');
  // too short to be an entry
  fs.writeFileSync(path.join(d, 'src', 'plugin', 'tiny.ts'), 'export default 1;\n');
  return d;
}

function generate(d) {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: d, encoding: 'utf8', timeout: 120000, env: { ...process.env, SIGMAP_NO_UPDATE_CHECK: '1' } });
  assert.strictEqual(r.status, 0, r.stderr);
}

test('generate: the file with no signature is recorded under bare, the short one and the others are not', () => {
  const d = project();
  generate(d);
  const j = JSON.parse(fs.readFileSync(path.join(d, '.context', 'sig-index.json'), 'utf8'));
  assert.deepStrictEqual(j.bare, ['src/plugin/weather.ts']);
  assert.ok(!('src/plugin/weather.ts' in j.files));
  assert.ok('src/utils/format.ts' in j.files);
});

test('generate: the context file handed to an agent does not mention it', () => {
  const d = project();
  generate(d);
  const ctx = fs.readFileSync(path.join(d, '.github', 'copilot-instructions.md'), 'utf8');
  assert.ok(ctx.includes('formatDate'), 'the signatures are there');
  assert.ok(!ctx.includes('weather'), 'a path-only file is not in the context');
});

test('buildSigIndex: a caller that does not ask sees the index it always saw', () => {
  const d = project();
  generate(d);
  assert.ok(!buildSigIndex(d).has('src/plugin/weather.ts'));
  assert.ok(!buildSigIndex(d, { full: true }).has('src/plugin/weather.ts'));
});

test('buildSigIndex: with bare it is an entry with no signatures, and the others are unchanged', () => {
  const d = project();
  generate(d);
  const plain = buildSigIndex(d);
  const withBare = buildSigIndex(d, { bare: true });
  assert.deepStrictEqual(withBare.get('src/plugin/weather.ts'), []);
  assert.strictEqual(withBare.size, plain.size + 1);
  for (const [k, v] of plain) assert.deepStrictEqual(withBare.get(k), v);
});

test('rank: a question that names the file finds it on its path; without the entry it cannot', () => {
  const d = project();
  generate(d);
  const q = 'where does the weather plugin live';
  assert.strictEqual(rank(q, buildSigIndex(d, { bare: true }), { topK: 3, learned: false })[0].file, 'src/plugin/weather.ts');
  assert.ok(!rank(q, buildSigIndex(d), { topK: 3, learned: false }).some((r) => r.file === 'src/plugin/weather.ts'));
});

test('rank: a question that does not mention it does not return it', () => {
  const d = project();
  generate(d);
  const hits = rank('format a date', buildSigIndex(d, { bare: true }), { topK: 5, learned: false });
  assert.strictEqual(hits[0].file, 'src/utils/format.ts');
  assert.ok(!hits.some((r) => r.file === 'src/plugin/weather.ts'));
});

test('body words: a path-only entry changes no other file\'s words', () => {
  const src = { 'a.ts': 'alpha beta gamma delta epsilon\nzeta eta theta\n', 'b.ts': 'alpha beta unique_b_word another_b_word\n', 'bare.ts': 'alpha beta gamma delta epsilon zeta\n' };
  const read = (f) => src[f] || null;
  const base = new Map([['a.ts', ['function a()']], ['b.ts', ['function b()']]]);
  const withBare = new Map([...base, ['bare.ts', []]]);
  const w0 = buildBodyWords(base, read);
  const w1 = buildBodyWords(withBare, read);
  assert.deepStrictEqual([...w1.entries()], [...w0.entries()]);
  assert.ok(!w1.has('bare.ts'));
});

test('ask: a question that names the file returns it (the CLI asks for the entry)', () => {
  const d = project();
  generate(d);
  const r = spawnSync(process.execPath, [SCRIPT, 'ask', 'where does the weather plugin live'], { cwd: d, encoding: 'utf8', timeout: 120000, env: { ...process.env, SIGMAP_NO_UPDATE_CHECK: '1', NO_COLOR: '1' } });
  assert.ok(/src\/plugin\/weather\.ts/.test(r.stdout), r.stdout + r.stderr);
});

test('explain: says the file is ranked by its path only, in text and in --json', () => {
  const d = project();
  generate(d);
  const text = spawnSync(process.execPath, [SCRIPT, 'explain', 'src/plugin/weather.ts'], { cwd: d, encoding: 'utf8', timeout: 60000 });
  assert.ok(/ranked by its path only/.test(text.stdout), text.stdout);
  const j = JSON.parse(spawnSync(process.execPath, [SCRIPT, 'explain', 'src/plugin/weather.ts', '--json'], { cwd: d, encoding: 'utf8', timeout: 60000 }).stdout);
  assert.strictEqual(j.status, 'excluded');
  assert.strictEqual(j.reason, 'no signatures');
  assert.strictEqual(j.pathOnly, true);
  const tiny = JSON.parse(spawnSync(process.execPath, [SCRIPT, 'explain', 'src/plugin/tiny.ts', '--json'], { cwd: d, encoding: 'utf8', timeout: 60000 }).stdout);
  assert.strictEqual(tiny.pathOnly, false);
});

test('MCP explain_file: says the file is ranked by its path only, and does not for an ordinary one', () => {
  const d = project();
  generate(d);
  const handlers = require(path.join(ROOT, 'src/mcp/handlers'));
  assert.ok(/ranked by its path only/.test(handlers.explainFile({ path: 'src/plugin/weather.ts' }, d)));
  assert.ok(!/ranked by its path only/.test(handlers.explainFile({ path: 'src/utils/format.ts' }, d)));
  assert.ok(/No signatures indexed for this file/.test(handlers.explainFile({ path: 'src/plugin/tiny.ts' }, d)), 'a short file is not an entry');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
