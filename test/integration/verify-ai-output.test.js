'use strict';

/**
 * Integration tests for `verify-ai-output` — Hallucination Guard (Phase 1 MVP).
 *
 * Covers:
 *   Parsers
 *    1. extractFilePaths finds path-like tokens, skips URLs/version numbers
 *    2. extractImports finds js + py imports and marks relative vs bare
 *    3. extractSymbols finds backtick-wrapped call references
 *   Module (verify, injected fixtures — deterministic)
 *    4. fake-file flagged when path absent
 *    5. fake-import flagged for unresolved relative + missing bare package
 *    6. fake-symbol flagged for unknown symbol; real symbol passes
 *    7. clean answer → zero issues, summary.clean true
 *    8. node/py builtins + scoped/real deps are not flagged
 *   CLI dispatch (against a generated fixture repo)
 *    9. dirty answer exits 1 and reports fake-file + fake-import
 *   10. clean answer exits 0
 *   11. --json emits { file, issues, summary } and exits 1 on issues
 *   12. missing file / missing arg → exit 1 with usage
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const parsers = require(path.join(ROOT, 'src', 'verify', 'parsers'));
const { verify } = require(path.join(ROOT, 'src', 'verify', 'hallucination-guard'));

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

// --------------------------------------------------------------------------
// Parsers
// --------------------------------------------------------------------------
test('extractFilePaths finds paths, skips URLs and version numbers', () => {
  const text = 'See `src/config/loader.js` and visit https://example.com/x.js — released v6.13.0';
  const paths = parsers.extractFilePaths(text).map((p) => p.path);
  assert.ok(paths.includes('src/config/loader.js'), 'should find the path');
  assert.ok(!paths.some((p) => p.startsWith('http')), 'should skip URLs');
  assert.ok(!paths.includes('6.13.0'), 'should skip version numbers');
});

test('extractImports finds js + py imports and flags relative vs bare', () => {
  const text = [
    "import { rank } from './ranker';",
    "const fs = require('fs');",
    'from os import path',
    'import chalk from "chalk";',
  ].join('\n');
  const imps = parsers.extractImports(text);
  const byMod = Object.fromEntries(imps.map((i) => [i.module, i]));
  assert.strictEqual(byMod['./ranker'].relative, true);
  assert.strictEqual(byMod['fs'].relative, false);
  assert.strictEqual(byMod['fs'].kind, 'js');
  assert.strictEqual(byMod['os'].kind, 'py');
  assert.ok(byMod['chalk']);
});

test('extractSymbols finds backtick-wrapped calls', () => {
  const text = 'Call `loadConfig()` then `doThing(a, b)`, but plain loadConfig() is ignored.';
  const names = parsers.extractSymbols(text).map((s) => s.name);
  assert.ok(names.includes('loadConfig'));
  assert.ok(names.includes('doThing'));
  assert.strictEqual(names.length, 2, 'only backtick calls counted');
});

// --------------------------------------------------------------------------
// Module: verify() with injected fixtures (deterministic, no fs/index needed)
// --------------------------------------------------------------------------
const realFiles = new Set(['src/index.js', 'src/util.js']);
const baseOpts = {
  symbolSet: new Set(['realFunc', 'helper', 'loadConfig']),
  fileBasenames: new Set(['index', 'util', 'ranker']),
  deps: new Set(['chalk', '@scope/pkg']),
  hasPkg: true,
  fileExists: (ref) => realFiles.has(ref.replace(/^\.\//, '')),
  relativeResolvable: (mod) => /index|util|ranker/.test(mod),
};

test('fake-file flagged when path absent', () => {
  const { issues } = verify('See `src/ghost.js` and `src/index.js`.', '/x', baseOpts);
  const files = issues.filter((i) => i.type === 'fake-file').map((i) => i.value);
  assert.deepStrictEqual(files, ['src/ghost.js']);
});

test('fake-import flagged for unresolved relative + missing bare package', () => {
  const text = [
    "import a from './util';",       // resolvable → ok
    "import b from './nope';",       // unresolved → flag
    "import c from 'chalk';",        // real dep → ok
    "import d from 'ghost-pkg';",    // missing dep → flag
  ].join('\n');
  const { issues } = verify(text, '/x', baseOpts);
  const imps = issues.filter((i) => i.type === 'fake-import').map((i) => i.value).sort();
  assert.deepStrictEqual(imps, ['./nope', 'ghost-pkg']);
});

test('fake-symbol flagged for unknown symbol; real symbol passes', () => {
  const { issues } = verify('Use `realFunc()` then `phantomFn()`.', '/x', baseOpts);
  const syms = issues.filter((i) => i.type === 'fake-symbol').map((i) => i.value);
  assert.deepStrictEqual(syms, ['phantomFn']);
});

test('clean answer → zero issues and summary.clean true', () => {
  const text = "File `src/index.js` exposes `realFunc()`.\n\nimport x from './util';";
  const { issues, summary } = verify(text, '/x', baseOpts);
  assert.strictEqual(issues.length, 0);
  assert.strictEqual(summary.clean, true);
  assert.strictEqual(summary.total, 0);
});

test('builtins + scoped/real deps are not flagged', () => {
  const text = [
    "const fs = require('fs');",
    "import os from 'os';",
    "import s from '@scope/pkg';",
    'from json import dumps',
  ].join('\n');
  const { issues } = verify(text, '/x', baseOpts);
  assert.strictEqual(issues.filter((i) => i.type === 'fake-import').length, 0);
});

// --------------------------------------------------------------------------
// CLI dispatch against a generated fixture repo
// --------------------------------------------------------------------------
function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-verify-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fx', version: '1.0.0', dependencies: { chalk: '^5.0.0' } }, null, 2)
  );
  fs.writeFileSync(
    path.join(dir, 'src', 'index.js'),
    'function realFunc(a) { return a; }\nmodule.exports = { realFunc };\n'
  );
  fs.writeFileSync(
    path.join(dir, 'src', 'util.js'),
    'function helper() { return 1; }\nmodule.exports = { helper };\n'
  );
  // Generate context so buildSigIndex has a symbol index.
  spawnSync('node', [SCRIPT, '--cwd', dir], { cwd: ROOT, encoding: 'utf8' });
  return dir;
}

function runVerify(dir, answerPath, extra = []) {
  return spawnSync('node', [SCRIPT, 'verify-ai-output', answerPath, '--cwd', dir, ...extra], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

const fixtureDir = makeFixtureRepo();

const dirtyAnswer = path.join(fixtureDir, 'dirty.md');
fs.writeFileSync(dirtyAnswer, [
  '# Answer',
  'Edit `src/index.js` and the missing `src/ghost.js`.',
  '',
  '```js',
  "import { helper } from './src/util';",
  "import x from './src/missing';",
  "import chalk from 'chalk';",
  "import y from 'totally-not-real-pkg';",
  '```',
].join('\n'));

const cleanAnswer = path.join(fixtureDir, 'clean.md');
fs.writeFileSync(cleanAnswer, [
  '# Answer',
  'Edit `src/index.js` which exports `realFunc()`.',
  '',
  '```js',
  "import { helper } from './src/util';",
  "import chalk from 'chalk';",
  '```',
].join('\n'));

test('CLI: dirty answer exits 1 and reports fake-file + fake-import', () => {
  const res = runVerify(fixtureDir, dirtyAnswer);
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\n${res.stdout}${res.stderr}`);
  assert.ok(/src\/ghost\.js/.test(res.stdout), 'reports fake file');
  assert.ok(/src\/missing/.test(res.stdout), 'reports unresolved import');
  assert.ok(/totally-not-real-pkg/.test(res.stdout), 'reports missing package');
});

test('CLI: clean answer exits 0', () => {
  const res = runVerify(fixtureDir, cleanAnswer);
  assert.strictEqual(res.status, 0, `expected exit 0, got ${res.status}\n${res.stdout}${res.stderr}`);
  assert.ok(/no hallucinations/.test(res.stdout));
});

test('CLI: --json emits { file, issues, summary } and exits 1 on issues', () => {
  const res = runVerify(fixtureDir, dirtyAnswer, ['--json']);
  assert.strictEqual(res.status, 1);
  const obj = JSON.parse(res.stdout.trim());
  assert.ok(Array.isArray(obj.issues));
  assert.ok(obj.summary && typeof obj.summary.total === 'number');
  assert.ok(obj.summary.total >= 3);
  assert.ok(obj.issues.every((i) => i.type && typeof i.line === 'number' && i.message));
});

test('CLI: missing file → exit 1', () => {
  const res = runVerify(fixtureDir, path.join(fixtureDir, 'does-not-exist.md'));
  assert.strictEqual(res.status, 1);
  assert.ok(/file not found/i.test(res.stderr));
});

test('CLI: missing arg → exit 1 with usage', () => {
  const res = spawnSync('node', [SCRIPT, 'verify-ai-output', '--cwd', fixtureDir], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(res.status, 1);
  assert.ok(/Usage: sigmap verify-ai-output/.test(res.stderr));
});

// Cleanup
try { fs.rmSync(fixtureDir, { recursive: true, force: true }); } catch (_) {}

console.log(`\nverify-ai-output: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
