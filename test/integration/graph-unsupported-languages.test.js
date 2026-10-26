'use strict';

/**
 * Regression tests for #979 — a blast-radius query on a file whose language the
 * graph cannot read answers "not tracked", never an empty list.
 *
 * Before the fix `--impact src/Illuminate/Support/Str.php` on Laravel (imported
 * by 164 files) printed "No importers found via relative + aliased imports":
 * the same words as "nothing depends on this". The import graph then read eight
 * language families, the call graph seven, and every other language
 * contributed no edges. `--impact`, `get_impact`, `--callers`,
 * `get_method_impact` and `plan` now say so, and `doctor` counts the files
 * affected.
 *
 * #980 taught the import graph PHP, C#, C/C++, Dart, Vue/Svelte/Astro, Lua and
 * GDScript, so the import-graph assertions here use Swift, which names modules and
 * not files and stays unread at file level. The call graph still reads none of
 * those, so the call-graph assertions keep using PHP.
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
const SW = 'Sources/App/Str.swift';
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

/** The same shape in a language the import graph still cannot read: a Swift helper imported by several files. */
function swiftRepo() {
  const root = tmpRepo('swift');
  write(root, SW, 'import Foundation\n\nenum Str {\n    static func slug(_ title: String) -> String {\n        return title\n    }\n}\n');
  for (const name of ['Mailer', 'Request', 'PostController']) {
    write(root, `Sources/App/${name}.swift`, `import Foundation\n\nstruct ${name} {\n    func name() -> String { return Str.slug("x") }\n}\n`);
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

test('--impact on a file the import graph cannot read says so, not "No importers found" (a Swift helper)', () => {
  const root = swiftRepo();
  const { out, code } = cli(root, ['--impact', SW]);
  assert.strictEqual(code, 0);
  assert.ok(out.includes(NOT_TRACKED), `expected the explicit marker, got:\n${out}`);
  assert.ok(out.includes('Swift imports are not tracked'), `the message must name Swift:\n${out}`);
  assert.ok(out.includes('not evidence that nothing depends on this file'), out);
  assert.ok(!out.includes('No importers found'), `must not claim "No importers found":\n${out}`);
});

test('--impact --json carries graph:"unsupported-language" and the language, with no importers', () => {
  const root = swiftRepo();
  const j = JSON.parse(cli(root, ['--impact', SW, '--json']).out);
  assert.strictEqual(j.graph, 'unsupported-language');
  assert.strictEqual(j.language, 'Swift');
  assert.strictEqual(j.totalImpact, 0);
  assert.deepStrictEqual(j.direct, []);
});

const UNSUPPORTED = [
  ['.swift', 'Swift'], ['.css', 'CSS'], ['.html', 'HTML'], ['.sql', 'SQL'],
  ['.proto', 'Protocol Buffers'], ['.sh', 'Shell'], ['.yaml', 'YAML'], ['.tf', 'Terraform'],
];
test('every language the import graph still cannot read gets the explicit result', () => {
  const root = tmpRepo('langs');
  for (const [ext] of UNSUPPORTED) write(root, `src/thing${ext}`, '// x\n');
  for (const [ext, label] of UNSUPPORTED) {
    const j = JSON.parse(cli(root, ['--impact', `src/thing${ext}`, '--json']).out);
    assert.strictEqual(j.graph, 'unsupported-language', `${ext} is not marked`);
    assert.strictEqual(j.language, label, `${ext} should be called ${label}, got ${j.language}`);
  }
});

test('the languages #980 added are read, so an empty result for one is NOT marked', () => {
  const root = tmpRepo('read');
  for (const ext of ['.php', '.cs', '.dart', '.lua', '.gd', '.cpp', '.c', '.h', '.m', '.vue', '.svelte', '.astro']) write(root, `src/thing${ext}`, '// x\n');
  for (const ext of ['.php', '.cs', '.dart', '.lua', '.gd', '.cpp', '.c', '.h', '.m', '.vue', '.svelte', '.astro']) {
    const j = JSON.parse(cli(root, ['--impact', `src/thing${ext}`, '--json']).out);
    assert.strictEqual('graph' in j, false, `${ext} is read by the import graph and must not be marked`);
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

test('get_impact answers "not tracked" for a file the import graph cannot read', () => {
  const { getImpact } = require('../../src/mcp/handlers');
  const text = getImpact({ file: SW }, swiftRepo());
  assert.ok(text.includes(NOT_TRACKED) && text.includes('Swift imports are not tracked'), text);
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

test('a class-qualified name is not mistaken for a file: Service#save, com.acme.Service#save, #x', () => {
  const root = jsRepo();
  cli(root, []);
  for (const sym of ['Service#save', 'com.acme.Service#save', '#x', 'src/nonexistent.php#whatever']) {
    const { out } = cli(root, ['--callers', sym]);
    assert.ok(!out.includes(NOT_TRACKED), `${sym} must not claim a declaration in an untracked file:\n${out}`);
    assert.ok(out.includes('symbol not found in the call-graph'), out);
  }
});

test('file#name with a file that exists in an unread language names it', () => {
  const root = laravelRepo();
  const { out } = cli(root, ['--callers', `${STR}#slug`]);
  assert.ok(out.includes(NOT_TRACKED) && out.includes(`\`${STR}\``) && out.includes('(PHP)'), out);
});

test('languages only the import graph reads are named, not printed as raw keys', () => {
  const root = jsRepo();
  write(root, 'src/tool.rb', 'class Tool; end\n');
  write(root, 'src/job.ex', 'defmodule Job do end\n');
  write(root, 'src/calc.R', 'f <- function() 1\n');
  const { out } = cli(root, ['--callers', 'noSuchThing']);
  const note = out.split('\n').find((l) => l.includes('Not searched')) || '';
  assert.ok(/1 Ruby/.test(note) && /1 Elixir/.test(note) && /1 R\b/.test(note), `expected readable names in:\n${note}`);
  assert.ok(!/\b1 (ruby|elixir|r)\b/.test(note), `a raw language key leaked into:\n${note}`);
});

/** A flat repo: sources at the root, so the walk starts at "." and meets vendor/ and target/. */
function flatRepo(opts) {
  const ext = (opts && opts.ext) || 'php';
  const body = ext === 'php' ? (n) => `<?php\nclass ${n} {}\n` : (n) => `struct ${n} {}\n`;
  const root = tmpRepo('flat');
  for (let i = 0; i < 12; i++) write(root, `mod${i}.js`, `module.exports = ${i};\n`);
  write(root, `helper.${ext}`, body('Helper'));
  for (let i = 0; i < 40; i++) write(root, `vendor/pkg/F${i}.${ext}`, body('F'));
  if (!opts || opts.target !== false) for (let i = 0; i < 10; i++) write(root, `target/gen/G${i}.${ext}`, body('G'));
  return root;
}

test('"Not searched" counts the tree the call graph walked: vendor/ is excluded', () => {
  const root = flatRepo({ target: false });
  cli(root, []);
  const j = JSON.parse(cli(root, ['--callers', 'noSuchThing', '--json']).out);
  assert.strictEqual(j.scope.roots.includes('.'), true, `the fixture must be walked from ".", got ${JSON.stringify(j.scope.roots)}`);
  assert.strictEqual(j.unsearched.files, 1, `only helper.php is a real PHP file, got ${JSON.stringify(j.unsearched)}`);
});

test('get_method_impact counts the tree ITS walk used: vendor/ and target/ are excluded', () => {
  const { getMethodImpact } = require('../../src/mcp/handlers');
  const root = flatRepo();
  cli(root, []);
  const text = getMethodImpact({ symbol: 'noSuchThing' }, root);
  assert.ok(/Not searched: 1 PHP file\(s\)/.test(text), text);
});

test('a directory is not a file in a language: it is never marked', () => {
  const root = laravelRepo();
  const j = JSON.parse(cli(root, ['--impact', 'src/Illuminate', '--json']).out);
  assert.strictEqual('graph' in j, false, JSON.stringify(j));
});

// ── the other blast-radius surfaces ────────────────────────────────────────

test('verify-plan does not report "blast radius in bounds" for a file the graph cannot read', () => {
  const root = swiftRepo();
  const plan = path.join(root, 'plan.md');
  fs.writeFileSync(plan, `Plan: edit \`${SW}\` and keep the rest.\n`);
  const j = JSON.parse(cli(root, ['verify-plan', plan, '--json']).out);
  assert.strictEqual(j.blast[0].graph, 'unsupported-language');
  assert.strictEqual(j.blast[0].language, 'Swift');
  const text = cli(root, ['verify-plan', plan]).out;
  assert.ok(text.includes('blast radius not tracked') && text.includes('Swift imports are not tracked'), text);
  assert.ok(!text.includes('blast radius and scope in bounds'), `must not claim the blast radius is in bounds:\n${text}`);
});

test('verify-plan over a readable language keeps its wording and its blast entry', () => {
  const root = jsRepo();
  const plan = path.join(root, 'plan.md');
  fs.writeFileSync(plan, 'Plan: edit `src/util.js`.\n');
  const text = cli(root, ['verify-plan', plan]).out;
  assert.ok(text.includes('blast radius and scope in bounds'), text);
  const j = JSON.parse(cli(root, ['verify-plan', plan, '--json']).out);
  assert.deepStrictEqual(Object.keys(j.blast[0]), ['file', 'totalImpact', 'tests']);
});

function gitRepoWithChange(root, rel) {
  const git = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  fs.appendFileSync(path.join(root, rel), '// edited\n');
}

test('get_diff_context says "not tracked" for a changed Swift file, not "0 file(s) impacted"', () => {
  const { getDiffContext } = require('../../src/mcp/handlers');
  const root = swiftRepo();
  gitRepoWithChange(root, SW);
  const text = getDiffContext({}, root);
  assert.ok(text.includes('**Blast radius:** not tracked'), text);
  assert.ok(text.includes('Swift imports are not tracked'), text);
  assert.ok(!text.includes('0 file(s) impacted'), text);
});

test('get_diff_context over a readable language is unchanged', () => {
  const { getDiffContext } = require('../../src/mcp/handlers');
  const root = jsRepo();
  gitRepoWithChange(root, 'src/lonely.js');
  const text = getDiffContext({}, root);
  assert.ok(text.includes('**Blast radius:** 0 file(s) impacted'), text);
  assert.ok(!text.includes('not tracked'), text);
});

test('the PR evidence report says "not tracked" for a changed Swift file', () => {
  const { buildPrEvidence, formatPrEvidenceMarkdown } = require('../../src/review/pr-evidence');
  const root = swiftRepo();
  const ev = buildPrEvidence([SW], root, {});
  assert.strictEqual(ev.files[0].blast.graph, 'unsupported-language');
  const md = formatPrEvidenceMarkdown(ev);
  assert.ok(md.includes('**Blast radius:** not tracked') && md.includes('Swift imports are not tracked'), md);
  assert.ok(!/Blast radius:\*\* 0 file/.test(md), md);
});

test('ask --with-source says "not tracked" in its blast radius section for a Swift file', () => {
  const { buildSourceSection } = require('../../src/retrieval/with-source');
  const root = swiftRepo();
  const ranked = [{ file: SW, sigs: ['enum Str  :3-7', 'static func slug(_ title: String) -> String  :4-6'] }];
  const section = buildSourceSection(ranked, root, { budgetTokens: 4000 });
  assert.ok(/## Blast radius/.test(section.text), section.text);
  assert.ok(section.text.includes(`${SW}  ← not tracked: Swift imports are not tracked`), section.text);
  assert.ok(!/0 direct, 0 total/.test(section.text), section.text);
});

// ── plan ───────────────────────────────────────────────────────────────────

test('plan lists the entry files whose blast radius is not tracked', () => {
  const root = tmpRepo('plan');
  write(root, 'src/Billing/InvoiceMailer.swift', 'struct InvoiceMailer {\n    func sendInvoiceReminder(_ invoice: String) -> String { return invoice }\n}\n');
  write(root, 'src/Billing/Ledger.swift', 'struct Ledger {\n    func record(_ entry: String) -> String { return entry }\n}\n');
  cli(root, []);
  const j = JSON.parse(cli(root, ['plan', 'change how the invoice mailer sends invoice reminders', '--json']).out);
  assert.ok(j.impactRadius && Array.isArray(j.impactRadius.untracked) && j.impactRadius.untracked.length > 0,
    `impactRadius.untracked missing: ${JSON.stringify(j.impactRadius)}`);
  assert.strictEqual(j.impactRadius.untracked[0].language, 'Swift');
  const text = cli(root, ['plan', 'change how the invoice mailer sends invoice reminders']).out;
  assert.ok(text.includes('Impact radius not tracked') && text.includes('Swift imports are not tracked'), text);
});

test('plan over a readable language is unchanged: no untracked key', () => {
  const root = jsRepo();
  cli(root, []);
  const j = JSON.parse(cli(root, ['plan', 'change the helper in util', '--json']).out);
  assert.ok(j.impactRadius, 'the plan must have a blast radius for this to test anything');
  assert.strictEqual('untracked' in j.impactRadius, false);
});

// ── doctor ─────────────────────────────────────────────────────────────────

function graphCheck(root) {
  const { diagnose } = require('../../src/doctor/diagnose');
  return diagnose(root).checks.find((c) => c.id === 'graph');
}

test('doctor counts the files the import graph cannot read, by language', () => {
  const root = swiftRepo();
  const c = graphCheck(root);
  assert.ok(c, 'doctor has no import-graph check');
  assert.strictEqual(c.status, 'warn');
  assert.ok(/Swift 4\b/.test(c.detail), `expected the Swift count, got: ${c.detail}`);
  assert.ok(c.detail.includes('"not tracked"'), c.detail);
});

test('doctor is quiet about a few stray files and about a repo the graph reads fully', () => {
  const root = jsRepo();
  for (let i = 0; i < 12; i++) write(root, `src/more${i}.js`, `module.exports = ${i};\n`);
  write(root, 'src/odd.swift', 'let x = 1\n');
  const stray = graphCheck(root);
  assert.strictEqual(stray.status, 'ok', `1 Swift file in 16 must not warn: ${stray.detail}`);
  assert.ok(stray.detail.includes('Swift 1'), stray.detail);
  const clean = graphCheck(jsRepo());
  assert.strictEqual(clean.status, 'ok');
  assert.ok(!clean.detail.includes('does not read'), clean.detail);
});

test('doctor counts the tree the graph walks: vendor/ and target/ are excluded', () => {
  const root = flatRepo({ ext: 'swift' });
  const c = graphCheck(root);
  assert.strictEqual(c.status, 'ok', `1 Swift file in 13 must not warn when vendor/ and target/ are not walked: ${c.detail}`);
  assert.ok(/Swift 1\b/.test(c.detail), c.detail);
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
  // Swift is the one language of the issue the file-level graph still does not read; the rest
  // (added in #980) are read, so none of them may be a counted gap.
  assert.ok(gap.includes('swift'), 'swift should be a counted gap');
  for (const k of ['php', 'csharp', 'cpp', 'objc', 'dart', 'lua', 'gdscript', 'vue_sfc', 'svelte', 'astro']) {
    assert.ok(readable.has(k), `${k} is read by the import graph since #980`);
    assert.ok(!gap.includes(k), `${k} must not be a counted gap`);
  }
  for (const k of gap) assert.ok(LABELS[k], `gap language ${k} needs a display name`);
  // A call-graph report also names the languages only the import graph reads.
  const { CALL_GRAPH_EXTS } = require('../../src/graph/call-graph');
  const callReadable = new Set([...CALL_GRAPH_EXTS].map((e) => EXT_MAP[e]).filter(Boolean));
  for (const k of LANGUAGES.filter((x) => !callReadable.has(x) && !NOT_EXPECTED.has(x))) {
    assert.ok(LABELS[k], `${k} can appear in a call-graph report and needs a display name`);
  }
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
