'use strict';

/**
 * Regression tests for #979 — a blast-radius query on a file whose language the
 * graph cannot read answers "not tracked", never an empty list.
 *
 * Before the fix `--impact src/Illuminate/Support/Str.php` on Laravel (imported
 * by 164 files) printed "No importers found via relative + aliased imports":
 * the same words as "nothing depends on this". The import graph reads eight
 * language families, the call graph seven, and every other language
 * contributes no edges. `--impact`, `get_impact`, `--callers`,
 * `get_method_impact` and `plan` now say so, and `doctor` counts the files
 * affected.
 *
 * Each acceptance criterion gets a test that fails against the pre-fix code.
 * Run: node test/integration/graph-unsupported-languages.test.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const GEN = path.join(ROOT, 'gen-context.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const made = [];
function tmpRepo(tag) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `sigmap-untracked-${tag}-`)));
  made.push(d);
  return d;
}
function write(root, rel, body) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return abs;
}
function cli(cwd, args) {
  const r = spawnSync(process.execPath, [GEN, ...args], { cwd, encoding: 'utf8' });
  return { out: r.stdout || '', err: r.stderr || '', code: r.status };
}

const STR = 'src/Illuminate/Support/Str.php';
const NOT_TRACKED = 'graph: unsupported-language';

/** The Laravel shape from the issue: a PHP helper imported by several files. */
function laravelRepo() {
  const root = tmpRepo('laravel');
  write(root, STR, "<?php\nnamespace Illuminate\\Support;\n\nclass Str\n{\n    public static function slug($title, $separator = '-')\n    {\n        return $title;\n    }\n}\n");
  for (const rel of ['src/Illuminate/Mail/Mailer.php', 'src/Illuminate/Http/Request.php', 'app/Http/Controllers/PostController.php']) {
    const cls = path.basename(rel, '.php');
    write(root, rel, `<?php\nnamespace App;\n\nuse Illuminate\\Support\\Str;\n\nclass ${cls}\n{\n    public function name() { return Str::slug('x'); }\n}\n`);
  }
  return root;
}

/** A repo whose only code is JavaScript. */
function jsRepo() {
  const root = tmpRepo('js');
  write(root, 'src/util.js', 'function helper() { return 1; }\nmodule.exports = { helper };\n');
  write(root, 'src/app.js', "const { helper } = require('./util');\nfunction run() { return helper(); }\nmodule.exports = { run };\n");
  write(root, 'src/lonely.js', 'function alone() { return 2; }\nmodule.exports = { alone };\n');
  return root;
}

// ── --impact ───────────────────────────────────────────────────────────────

test('--impact on a PHP file says PHP is not tracked, not "No importers found" (Laravel Str.php)', () => {
  const root = laravelRepo();
  const { out, code } = cli(root, ['--impact', STR]);
  assert.strictEqual(code, 0);
  assert.ok(out.includes(NOT_TRACKED), `expected the explicit marker, got:\n${out}`);
  assert.ok(out.includes('PHP imports are not tracked'), `the message must name PHP:\n${out}`);
  assert.ok(out.includes('not evidence that nothing depends on this file'), out);
  assert.ok(!out.includes('No importers found'), `must not claim "No importers found":\n${out}`);
});

test('--impact --json carries graph:"unsupported-language" and the language, with no importers', () => {
  const root = laravelRepo();
  const j = JSON.parse(cli(root, ['--impact', STR, '--json']).out);
  assert.strictEqual(j.graph, 'unsupported-language');
  assert.strictEqual(j.language, 'PHP');
  assert.strictEqual(j.totalImpact, 0);
  assert.deepStrictEqual(j.direct, []);
});

const UNSUPPORTED = [
  ['.cs', 'C#'], ['.dart', 'Dart'], ['.swift', 'Swift'], ['.lua', 'Lua'], ['.gd', 'GDScript'],
  ['.cpp', 'C/C++'], ['.c', 'C/C++'], ['.h', 'C/C++'], ['.m', 'Objective-C'],
  ['.vue', 'Vue'], ['.svelte', 'Svelte'], ['.astro', 'Astro'], ['.php', 'PHP'],
];
test('every unsupported language from the issue gets the explicit result', () => {
  const root = tmpRepo('langs');
  for (const [ext] of UNSUPPORTED) write(root, `src/thing${ext}`, '// x\n');
  for (const [ext, label] of UNSUPPORTED) {
    const j = JSON.parse(cli(root, ['--impact', `src/thing${ext}`, '--json']).out);
    assert.strictEqual(j.graph, 'unsupported-language', `${ext} is not marked`);
    assert.strictEqual(j.language, label, `${ext} should be called ${label}, got ${j.language}`);
  }
});

test('a file with importers keeps its list: the guard only marks an EMPTY result', () => {
  const root = jsRepo();
  const j = JSON.parse(cli(root, ['--impact', 'src/util.js', '--json']).out);
  assert.deepStrictEqual(j.direct, ['src/app.js']);
  assert.strictEqual('graph' in j, false);
});

test('readable languages are unchanged: same keys, no graph field, same wording for "no importers"', () => {
  const root = jsRepo();
  const j = JSON.parse(cli(root, ['--impact', 'src/lonely.js', '--json']).out);
  assert.deepStrictEqual(Object.keys(j), ['changed', 'direct', 'transitive', 'tests', 'routes', 'totalImpact']);
  const text = cli(root, ['--impact', 'src/lonely.js']).out;
  assert.ok(text.includes('No importers found via relative + aliased imports'), text);
  assert.ok(!text.includes(NOT_TRACKED), text);
});

test('every readable family stays unmarked when it has no importers', () => {
  const { GRAPH_EXTS } = require('../../src/graph/builder');
  const root = tmpRepo('readable');
  const exts = [...new Set([...GRAPH_EXTS].map((e) => e.toLowerCase()))]; // '.r' and '.R' are one file on a case-insensitive disk
  for (const ext of exts) write(root, `src/solo${ext}`, '// x\n');
  for (const ext of exts) {
    const j = JSON.parse(cli(root, ['--impact', `src/solo${ext}`, '--json']).out);
    assert.strictEqual('graph' in j, false, `${ext} is a language the graph reads, so it must not be marked`);
  }
});

// ── get_impact (MCP) ───────────────────────────────────────────────────────

test('get_impact answers "not tracked" for a PHP file', () => {
  const { getImpact } = require('../../src/mcp/handlers');
  const text = getImpact({ file: STR }, laravelRepo());
  assert.ok(text.includes(NOT_TRACKED) && text.includes('PHP imports are not tracked'), text);
  assert.ok(!text.includes('No importers found'), text);
});

test('get_impact on a readable file with no importers is unchanged', () => {
  const { getImpact } = require('../../src/mcp/handlers');
  const text = getImpact({ file: 'src/lonely.js' }, jsRepo());
  assert.ok(text.includes('No importers found via relative + aliased imports'), text);
  assert.ok(!text.includes(NOT_TRACKED), text);
});

// ── --callers / get_method_impact ──────────────────────────────────────────

test('--callers on a symbol declared in PHP says the call graph does not read PHP', () => {
  const root = laravelRepo();
  cli(root, []); // the signature index is how the symbol is found
  const { out } = cli(root, ['--callers', 'slug']);
  assert.ok(out.includes(NOT_TRACKED), out);
  assert.ok(out.includes(STR) && out.includes('(PHP)'), `must name where it is declared:\n${out}`);
  const j = JSON.parse(cli(root, ['--callers', 'slug', '--json']).out);
  assert.strictEqual(j.graph, 'unsupported-language');
  assert.deepStrictEqual(j.declaredIn, [STR]);
});

test('get_method_impact says the same', () => {
  const { getMethodImpact } = require('../../src/mcp/handlers');
  const root = laravelRepo();
  cli(root, []);
  const text = getMethodImpact({ symbol: 'slug' }, root);
  assert.ok(text.includes(NOT_TRACKED) && text.includes('(PHP)'), text);
});

test('an unknown symbol in a repo with unread files says what was not searched', () => {
  const root = laravelRepo();
  cli(root, []);
  const { out } = cli(root, ['--callers', 'noSuchThing']);
  assert.ok(out.includes('symbol not found in the call-graph'), out);
  assert.ok(/Not searched: \d+ PHP file\(s\)/.test(out), out);
  const j = JSON.parse(cli(root, ['--callers', 'noSuchThing', '--json']).out);
  assert.ok(j.unsearched && j.unsearched.files >= 4 && j.unsearched.languages[0].language === 'PHP', JSON.stringify(j.unsearched));
});

test('an unknown symbol in a readable-only repo is unchanged', () => {
  const root = jsRepo();
  cli(root, []);
  const { out } = cli(root, ['--callers', 'noSuchThing']);
  assert.strictEqual(out.trim(), '## Callers: `noSuchThing`\n\n_symbol not found in the call-graph._');
  const j = JSON.parse(cli(root, ['--callers', 'noSuchThing', '--json']).out);
  assert.strictEqual('unsearched' in j, false);
  assert.strictEqual('graph' in j, false);
});

test('a resolved symbol is unchanged', () => {
  const root = jsRepo();
  const j = JSON.parse(cli(root, ['--callers', 'helper', '--json']).out);
  assert.strictEqual(j.unresolved, false);
  assert.strictEqual('graph' in j, false);
  assert.strictEqual('unsearched' in j, false);
});

// ── plan ───────────────────────────────────────────────────────────────────

test('plan lists the entry files whose blast radius is not tracked', () => {
  const root = tmpRepo('plan');
  write(root, 'src/Billing/InvoiceMailer.php', '<?php\nclass InvoiceMailer\n{\n    public function sendInvoiceReminder($invoice) { return $invoice; }\n}\n');
  write(root, 'src/Billing/Ledger.php', '<?php\nclass Ledger\n{\n    public function record($entry) { return $entry; }\n}\n');
  cli(root, []);
  const j = JSON.parse(cli(root, ['plan', 'change how the invoice mailer sends invoice reminders', '--json']).out);
  assert.ok(j.impactRadius && Array.isArray(j.impactRadius.untracked) && j.impactRadius.untracked.length > 0,
    `impactRadius.untracked missing: ${JSON.stringify(j.impactRadius)}`);
  assert.strictEqual(j.impactRadius.untracked[0].language, 'PHP');
  const text = cli(root, ['plan', 'change how the invoice mailer sends invoice reminders']).out;
  assert.ok(text.includes('Impact radius not tracked') && text.includes('PHP imports are not tracked'), text);
});

test('plan over a readable language is unchanged: no untracked key', () => {
  const root = jsRepo();
  cli(root, []);
  const j = JSON.parse(cli(root, ['plan', 'change the helper in util', '--json']).out);
  if (j.impactRadius) assert.strictEqual('untracked' in j.impactRadius, false);
});

// ── doctor ─────────────────────────────────────────────────────────────────

function graphCheck(root) {
  const { diagnose } = require('../../src/doctor/diagnose');
  return diagnose(root).checks.find((c) => c.id === 'graph');
}

test('doctor counts the files the import graph cannot read, by language', () => {
  const root = laravelRepo();
  const c = graphCheck(root);
  assert.ok(c, 'doctor has no import-graph check');
  assert.strictEqual(c.status, 'warn');
  assert.ok(/PHP 4\b/.test(c.detail), `expected the PHP count, got: ${c.detail}`);
  assert.ok(c.detail.includes('"not tracked"'), c.detail);
});

test('doctor is quiet about a few stray files and about a repo the graph reads fully', () => {
  const root = jsRepo();
  for (let i = 0; i < 12; i++) write(root, `src/more${i}.js`, `module.exports = ${i};\n`);
  write(root, 'src/odd.lua', 'return 1\n');
  const stray = graphCheck(root);
  assert.strictEqual(stray.status, 'ok', `1 Lua file in 16 must not warn: ${stray.detail}`);
  assert.ok(stray.detail.includes('Lua 1'), stray.detail);
  const clean = graphCheck(jsRepo());
  assert.strictEqual(clean.status, 'ok');
  assert.ok(!clean.detail.includes('does not read'), clean.detail);
});

test('doctor leaves markup, config and query files out of the gap', () => {
  const root = jsRepo();
  for (const f of ['a.md', 'b.yaml', 'c.toml', 'd.sql', 'e.sh', 'f.html', 'g.css', 'h.proto']) write(root, `src/${f}`, 'x\n');
  assert.ok(!graphCheck(root).detail.includes('does not read'), graphCheck(root).detail);
});

// ── one list, not two ──────────────────────────────────────────────────────

test('the graph walk and the support list agree: every readable extension is walked', () => {
  const { GRAPH_EXTS, buildFromCwd } = require('../../src/graph/builder');
  const root = tmpRepo('walk');
  // The walk lowercases extensions, so '.R' is '.r' (and one file on a case-insensitive disk).
  const exts = [...new Set([...GRAPH_EXTS].map((e) => e.toLowerCase()))];
  for (const ext of exts) write(root, `src/f${ext}`, '// x\n');
  const nodes = [...buildFromCwd(root, { srcDirs: ['src'] }).forward.keys()];
  assert.strictEqual(nodes.length, exts.length, `walked ${nodes.length} of ${exts.length} readable extensions`);
});

test('every extractor language is classified: readable, a counted gap, or deliberately not expected', () => {
  const { EXT_MAP, LANGUAGES } = require('../../src/extractors/dispatch');
  const { GRAPH_EXTS } = require('../../src/graph/builder');
  const { NOT_EXPECTED, LABELS } = require('../../src/graph/language-support');
  const readable = new Set([...GRAPH_EXTS].map((e) => EXT_MAP[e]).filter(Boolean));
  const gap = LANGUAGES.filter((k) => !readable.has(k) && !NOT_EXPECTED.has(k));
  // The languages the issue names must be counted as gaps, and nothing the graph reads may be.
  for (const k of ['php', 'csharp', 'cpp', 'objc', 'swift', 'dart', 'lua', 'gdscript', 'vue_sfc', 'svelte', 'astro']) {
    assert.ok(gap.includes(k), `${k} should be a counted gap`);
  }
  for (const k of gap) assert.ok(LABELS[k], `gap language ${k} needs a display name`);
  for (const k of readable) assert.ok(!gap.includes(k), `${k} is readable and must not be a gap`);
});

// ── docs ───────────────────────────────────────────────────────────────────

test('KNOWN_LIMITATIONS lists the languages the import graph and the call graph read', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'KNOWN_LIMITATIONS.md'), 'utf8');
  const { graphLanguageList, callGraphLanguageList } = require('../../src/graph/language-support');
  assert.ok(doc.includes(graphLanguageList()), `KNOWN_LIMITATIONS must list the import graph's languages: ${graphLanguageList()}`);
  assert.ok(doc.includes(callGraphLanguageList()), `KNOWN_LIMITATIONS must list the call graph's languages: ${callGraphLanguageList()}`);
});

for (const d of made) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }

console.log(`\ngraph-unsupported-languages: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
