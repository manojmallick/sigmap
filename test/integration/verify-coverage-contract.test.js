'use strict';

/**
 * #989 — `verify` says what it checked.
 *
 * `verify` is a name-level linter, and its output read as proof. This pins the
 * coverage contract:
 *
 *   1. a verdict names the classes it checked and the classes it did not
 *   2. a missing or stale index is a distinct exit code (3), not an all-clear
 *   3. an answer with nothing checkable is an empty check, not a clean answer
 *   4. `node:` built-in imports are not reported as missing packages
 *   5. a bare file name resolves against the files the repo has
 *   6. the MCP tool prints per-library counts and never "Grounded against" a
 *      library it could not read (#990)
 *   7. the README, docs and tool description no longer claim "every" fabrication
 *      or "no competitor"
 *
 * Exit codes of `sigmap verify`: 0 clean · 1 issues found · 2 usage · 3 not an all-clear.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { verify } = require(path.join(ROOT, 'src', 'verify', 'hallucination-guard'));
const { verifySuggestion } = require(path.join(ROOT, 'src', 'mcp', 'handlers'));

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

const made = [];

function makeRepo({ indexed }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-verify-cov-'));
  made.push(dir);
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fx', version: '1.0.0', scripts: { build: 'echo b' } }, null, 2));
  fs.writeFileSync(path.join(dir, 'src', 'util.js'), 'function summarize(a) { return a; }\nmodule.exports = { summarize };\n');
  if (indexed) index(dir);
  return dir;
}

function index(dir) {
  spawnSync('node', [SCRIPT, '--cwd', dir], { cwd: ROOT, encoding: 'utf8' });
}

function write(dir, name, text) {
  fs.writeFileSync(path.join(dir, name), text);
  return path.join(dir, name);
}

function cli(dir, answer, extra = []) {
  return spawnSync('node', [SCRIPT, 'verify', answer, '--cwd', dir, ...extra], { cwd: ROOT, encoding: 'utf8' });
}

function jsonOf(res) {
  return JSON.parse(res.stdout.split('\n').filter((l) => l.startsWith('{'))[0]);
}

const indexed = makeRepo({ indexed: true });
const unindexed = makeRepo({ indexed: false });

// ---------------------------------------------------------------------------
// 1. A verdict names what it checked and what it did not
// ---------------------------------------------------------------------------
test('a clean verdict lists what was checked and what was not', () => {
  const res = cli(indexed, write(indexed, 'ok.md', 'Edit `src/util.js` and call `summarize()`.\n'));
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/✓ ok\.md — no hallucinations detected/.test(res.stdout), res.stdout);
  assert.ok(/checked 2 claims — 1 file path · 1 backticked call/.test(res.stdout), res.stdout);
  assert.ok(/not checked: .*calls in fenced or raw code.*member calls.*library APIs/.test(res.stdout), res.stdout);
});

test('a failing run also says what it did not check', () => {
  const res = cli(indexed, write(indexed, 'bad.md', 'Edit `src/ghost.js`.\n'));
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.ok(/not checked: .*library APIs/.test(res.stdout), res.stdout);
});

test('--json carries the claim counts and the coverage', () => {
  const res = cli(indexed, write(indexed, 'ok.md', 'Edit `src/util.js` and call `summarize()`.\n'), ['--json']);
  const { summary } = jsonOf(res);
  assert.strictEqual(summary.claims.total, 2);
  assert.strictEqual(summary.claims.files, 1);
  assert.strictEqual(summary.claims.symbols, 1);
  assert.strictEqual(summary.coverage.index, 'ok');
  assert.ok(summary.coverage.checked.includes('backticked calls'));
  assert.ok(summary.coverage.notChecked.some((c) => /library APIs/.test(c)));
  assert.strictEqual(summary.checks.symbols, true); // the pre-existing flags are still there
});

// ---------------------------------------------------------------------------
// 2. A missing or stale index is not an all-clear
// ---------------------------------------------------------------------------
test('no index: a run with no finding exits 3, not 0', () => {
  const res = cli(unindexed, write(unindexed, 'ok.md', 'Then call `authorize()`.\n'));
  assert.strictEqual(res.status, 3, res.stdout + res.stderr);
  assert.ok(/symbol check skipped/.test(res.stdout), res.stdout);
  const j = cli(unindexed, path.join(unindexed, 'ok.md'), ['--json']);
  assert.strictEqual(j.status, 3);
  assert.strictEqual(jsonOf(j).summary.coverage.index, 'missing');
});

test('no index: a finding is still exit 1', () => {
  const res = cli(unindexed, write(unindexed, 'bad.md', 'Edit `src/ghost.js`.\n'));
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.ok(/symbol check skipped/.test(res.stdout));
});

test('stale index: a run with no finding exits 3 until sigmap is re-run', () => {
  const dir = makeRepo({ indexed: true });
  const ok = write(dir, 'ok.md', 'Edit `src/util.js` and call `summarize()`.\n');
  assert.strictEqual(cli(dir, ok).status, 0, 'a fresh index is an all-clear');

  const ctx = path.join(dir, '.github', 'copilot-instructions.md');
  assert.ok(fs.existsSync(ctx), 'the fixture produced a context file');
  const past = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  fs.utimesSync(ctx, past, past); // the sources are now newer than the index
  const stale = cli(dir, ok);
  assert.strictEqual(stale.status, 3, stale.stdout + stale.stderr);
  assert.ok(/older than/.test(stale.stdout) && /sigmap/.test(stale.stdout), stale.stdout);
  assert.strictEqual(jsonOf(cli(dir, ok, ['--json'])).summary.coverage.index, 'stale');

  index(dir);
  assert.strictEqual(cli(dir, ok).status, 0, 're-running sigmap clears it');
});

// ---------------------------------------------------------------------------
// 3. An empty check is not a clean answer
// ---------------------------------------------------------------------------
test('an answer that names nothing checkable is not a green verdict', () => {
  const res = cli(indexed, write(indexed, 'prose.md', 'This is a paragraph of ordinary prose with no claims in it.\n'));
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/nothing to check/.test(res.stdout), res.stdout);
  assert.ok(!/✓|no hallucinations detected/.test(res.stdout), `no green mark at zero claims:\n${res.stdout}`);
  assert.ok(/checked 0 claims/.test(res.stdout), res.stdout);
});

// ---------------------------------------------------------------------------
// 4. node: built-ins
// ---------------------------------------------------------------------------
test('node: built-in imports are not reported as missing packages', () => {
  const text = [
    '```js',
    "import fs from 'node:fs';",
    "import { test } from 'node:test';",
    "import { readFile } from 'node:fs/promises';",
    "import later from 'node:a-core-module-this-list-does-not-know';",
    "import missing from 'definitely-not-a-dependency';",
    '```',
  ].join('\n');
  const { issues, summary } = verify(text, indexed);
  const imports = issues.filter((i) => i.type === 'fake-import').map((i) => i.value);
  assert.deepStrictEqual(imports, ['definitely-not-a-dependency'], `only the real miss is reported, got ${imports}`);
  assert.strictEqual(summary.claims.imports, 4, 'three node: imports and the missing package were decided; the unknown node: name was left alone');
});

// ---------------------------------------------------------------------------
// 5. Bare file names
// ---------------------------------------------------------------------------
test('a bare file name resolves against the files the repo has', () => {
  const real = verify('Edit `util.js` to add a case.', indexed);
  assert.strictEqual(real.issues.filter((i) => i.type === 'fake-file').length, 0, 'src/util.js answers util.js');
  const fake = verify('Edit `nothere.js` to add a case.', indexed);
  assert.strictEqual(fake.issues.filter((i) => i.type === 'fake-file').length, 1, 'a name the repo does not have is still reported');
});

// ---------------------------------------------------------------------------
// 6. MCP verify_suggestion: per-library counts, nothing "Grounded against" an unread library
// ---------------------------------------------------------------------------
test('verify_suggestion prints per-library counts and never "Grounded against"', () => {
  const dir = makeRepo({ indexed: true });
  const nm = path.join(dir, 'node_modules');
  fs.mkdirSync(path.join(nm, 'acme'), { recursive: true });
  fs.writeFileSync(path.join(nm, 'acme', 'package.json'), JSON.stringify({ name: 'acme', version: '1.0.0', types: 'index.d.ts' }));
  fs.writeFileSync(path.join(nm, 'acme', 'index.d.ts'), 'export declare function one(): void;\nexport declare function two(): void;\n');
  fs.mkdirSync(path.join(nm, 'opaque'), { recursive: true });
  fs.writeFileSync(path.join(nm, 'opaque', 'package.json'), JSON.stringify({ name: 'opaque', version: '2.0.0' }));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fx', version: '1.0.0', dependencies: { acme: '^1.0.0', opaque: '^2.0.0' } }));
  index(dir);

  const out = verifySuggestion({ code: 'Call `summarize()` from `src/util.js`.' }, dir);
  assert.ok(!/Grounded against/.test(out), out);
  assert.ok(/2 installed libraries read:/.test(out), out);
  assert.ok(/acme@1\.0\.0: 2 names indexed/.test(out), out);
  assert.ok(/opaque@2\.0\.0: no readable types — library imports not checked/.test(out), out);
  assert.ok(/not checked: .*library APIs/.test(out), out);
});

test('verify_suggestion: an empty check and a skipped check are not "Grounded"', () => {
  const empty = verifySuggestion({ code: 'Just some prose with nothing checkable.' }, indexed);
  assert.ok(/Nothing to check/.test(empty) && !/✓/.test(empty), empty);
  const skipped = verifySuggestion({ code: 'Then call `authorize()`.' }, unindexed);
  assert.ok(/did not run/.test(skipped) && !/✓/.test(skipped), skipped);
  const ok = verifySuggestion({ code: 'Call `summarize()`.' }, indexed);
  assert.ok(/✓ Grounded — .*in the claims checked/.test(ok), ok);
});

// ---------------------------------------------------------------------------
// 7. The published claim
// ---------------------------------------------------------------------------
test('README, docs and the tool description state the scope, not "every" fabrication or "no competitor"', () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const { TOOLS } = require(path.join(ROOT, 'src', 'mcp', 'tools'));
  const surfaces = {
    'README.md': read('README.md'),
    'docs-vp/guide/cli.md': read('docs-vp/guide/cli.md'),
    'docs-vp/guide/verify-ai-output.md': read('docs-vp/guide/verify-ai-output.md'),
    'verify_suggestion description': TOOLS.find((t) => t.name === 'verify_suggestion').description,
  };
  for (const [where, text] of Object.entries(surfaces)) {
    assert.ok(!/flags every fabricat/i.test(text), `${where}: "flags every fabricated …"`);
    assert.ok(!/no competitor/i.test(text), `${where}: "no competitor"`);
    assert.ok(!/competitor offers/i.test(text), `${where}: "competitor offers"`);
  }
  for (const where of ['README.md', 'docs-vp/guide/cli.md', 'docs-vp/guide/verify-ai-output.md']) {
    assert.ok(/not checked/i.test(surfaces[where]) && /tsc/.test(surfaces[where]), `${where} names what verify does not check and points at tsc/pyright`);
  }
  assert.ok(/not\b.*\bmember|member calls|library APIs/i.test(surfaces['verify_suggestion description']), 'the tool description names what it does not check');
});

for (const d of made) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }

console.log(`\nverify-coverage-contract: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
