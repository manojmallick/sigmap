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
const { verify, isTestPath } = require(path.join(ROOT, 'src', 'verify', 'hallucination-guard'));
const closest = require(path.join(ROOT, 'src', 'verify', 'closest-match'));
const report = require(path.join(ROOT, 'src', 'format', 'verify-report'));

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

test('extractFilePaths skips runtime/library product names (Node.js, Next.js, …)', () => {
  const text = 'Write a minimal Node.js example. It uses Next.js, Vue.js, Express.js and D3.js.';
  const paths = parsers.extractFilePaths(text).map((p) => p.path.toLowerCase());
  for (const lib of ['node.js', 'next.js', 'vue.js', 'express.js', 'd3.js']) {
    assert.ok(!paths.includes(lib), `should not flag library token ${lib}`);
  }
});

test('extractFilePaths skips illustrative placeholder filenames', () => {
  const text = [
    'Save this as `example.js`.',
    'See `minimal-example.js` and `example-coverage-walk.js`.',
    'Try `sample.ts`, `demo.py`, and `placeholder.js`.',
  ].join('\n');
  const paths = parsers.extractFilePaths(text).map((p) => p.path);
  for (const ph of ['example.js', 'minimal-example.js', 'example-coverage-walk.js', 'sample.ts', 'demo.py', 'placeholder.js']) {
    assert.ok(!paths.includes(ph), `should not flag placeholder ${ph}`);
  }
});

test('extractFilePaths skips camelCase/Pascal placeholders, keeps ordinary words', () => {
  const text = 'Save `myExample.js` and `exampleConfig.ts` and `fooSample.js`; but `resample.js` and `src/foo/bar.js` are real.';
  const paths = parsers.extractFilePaths(text).map((p) => p.path);
  for (const ph of ['myExample.js', 'exampleConfig.ts', 'fooSample.js']) {
    assert.ok(!paths.includes(ph), `should not flag camelCase placeholder ${ph}`);
  }
  assert.ok(paths.includes('resample.js'), 'resample.js is an ordinary word — must still extract');
  assert.ok(paths.includes('src/foo/bar.js'), 'genuine path must still extract');
});

test('extractFilePaths still extracts genuine repo-shaped paths (no over-suppression)', () => {
  const text = 'Edit `src/foo/bar.js`, `src/config/loader.js`, `main.js`, and `index.ts`.';
  const paths = parsers.extractFilePaths(text).map((p) => p.path);
  for (const real of ['src/foo/bar.js', 'src/config/loader.js', 'main.js', 'index.ts']) {
    assert.ok(paths.includes(real), `should still extract ${real}`);
  }
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

test('verify(): Node.js + example.js prose yields no fake-file; real fake path still flags', () => {
  const text = 'Here is a minimal Node.js example saved as `example.js` that also touches `src/ghost.js`.';
  const { issues } = verify(text, '/x', baseOpts);
  const files = issues.filter((i) => i.type === 'fake-file').map((i) => i.value);
  assert.deepStrictEqual(files, ['src/ghost.js'], 'only the genuine fake path is flagged');
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

test('fake-import skips doc-placeholder imports, still flags genuine ones', () => {
  const text = [
    "import a from '@scope/utils';",   // placeholder scope → skip
    "import b from 'some-module';",    // placeholder bare → skip
    "import c from './local-file';",   // placeholder relative → skip
    "import d from './path/to/thing';",// placeholder path → skip
    "import e from 'ghost-pkg';",      // genuine missing dep → flag
    "import f from './nope';",         // genuine unresolved relative → flag
  ].join('\n');
  const { issues } = verify(text, '/x', baseOpts);
  const imps = issues.filter((i) => i.type === 'fake-import').map((i) => i.value).sort();
  assert.deepStrictEqual(imps, ['./nope', 'ghost-pkg'], 'only genuine imports flagged');
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
// New detectors + schema (Reliable MVP, v6.15.0)
// --------------------------------------------------------------------------
test('fake-test-file is a distinct type from fake-file', () => {
  const opts = { ...baseOpts, fileExists: () => false };
  const { issues } = verify('See `src/foo.test.js` and `src/foo.js` and `__tests__/x.js`.', '/x', opts);
  const byType = Object.fromEntries(issues.map((i) => [i.value, i.type]));
  assert.strictEqual(byType['src/foo.test.js'], 'fake-test-file');
  assert.strictEqual(byType['__tests__/x.js'], 'fake-test-file');
  assert.strictEqual(byType['src/foo.js'], 'fake-file');
});

test('isTestPath recognises spec/test/python conventions', () => {
  assert.ok(isTestPath('a/b.spec.ts'));
  assert.ok(isTestPath('test_thing.py'));
  assert.ok(isTestPath('thing_test.py'));
  assert.ok(isTestPath('tests/x.js'));
  assert.ok(!isTestPath('src/loader.js'));
});

test('fake-npm-script flags unknown script, passes known', () => {
  const opts = { ...baseOpts, hasPkg: true, scripts: new Set(['build', 'test']) };
  const text = 'Run `npm run build` then `pnpm run nope` and `yarn run other`.';
  const { issues } = verify(text, '/x', opts);
  const scripts = issues.filter((i) => i.type === 'fake-npm-script').map((i) => i.value).sort();
  assert.deepStrictEqual(scripts, ['nope', 'other']);
});

test('issues carry confidence + location; symbol detection is medium', () => {
  const opts = { ...baseOpts };
  const { issues, summary } = verify('Missing `src/ghost.js` and `phantomFn()`.', '/x', opts);
  const file = issues.find((i) => i.type === 'fake-file');
  const sym = issues.find((i) => i.type === 'fake-symbol');
  assert.strictEqual(file.confidence, 'high');
  assert.strictEqual(sym.confidence, 'medium');
  assert.ok(/^L\d+$/.test(file.location));
  assert.ok('withSuggestion' in summary);
});

test('closest-match suggestion attached for a near-miss symbol', () => {
  const opts = {
    ...baseOpts,
    symbolCandidates: [{ name: 'loadConfig', file: 'src/config/loader.js', line: 42 }],
  };
  const { issues } = verify('Call `loadConfg()`.', '/x', opts);
  const sym = issues.find((i) => i.type === 'fake-symbol');
  assert.ok(sym.suggestion && /loadConfig/.test(sym.suggestion), sym.suggestion);
  assert.ok(/loader\.js:42/.test(sym.suggestion));
});

// --------------------------------------------------------------------------
// closest-match module
// --------------------------------------------------------------------------
test('levenshtein basic + ceiling early-exit', () => {
  assert.strictEqual(closest.levenshtein('kitten', 'sitting'), 3);
  assert.strictEqual(closest.levenshtein('abc', 'abc'), 0);
  assert.ok(closest.levenshtein('abcdef', 'zzzzzz', 2) > 2); // exceeds cap
});

test('closestMatch finds nearest and skips far/short targets', () => {
  const cands = [{ name: 'loadConfig' }, { name: 'saveConfig' }, { name: 'rank' }];
  assert.strictEqual(closest.closestMatch('loadConfg', cands).name, 'loadConfig');
  assert.strictEqual(closest.closestMatch('xy', cands), null, 'too short');
  assert.strictEqual(closest.closestMatch('totallyDifferentNameHere', cands), null, 'too far');
});

test('buildSymbolCandidates parses name + anchor line from sig index', () => {
  const idx = new Map([['src/a.js', ['function loadConfig(p)  :42-58', 'class Foo  :3-9']]]);
  const cands = closest.buildSymbolCandidates(idx);
  const load = cands.find((c) => c.name === 'loadConfig');
  assert.ok(load);
  assert.strictEqual(load.line, 42);
  assert.strictEqual(load.file, 'src/a.js');
});

// --------------------------------------------------------------------------
// Parsers — edge cases (Reliable MVP)
// --------------------------------------------------------------------------
test('extractImports handles multi-line import and TS import=require', () => {
  const text = [
    'import {',
    '  A as B,',
    '  C,',
    "} from './multi';",
    "import fs = require('fs-extra');",
  ].join('\n');
  const mods = parsers.extractImports(text).map((i) => i.module);
  assert.ok(mods.includes('./multi'), 'multi-line import found');
  assert.ok(mods.includes('fs-extra'), 'TS import=require found');
});

test('extractNpmScripts finds explicit run forms only', () => {
  const text = 'Run `npm run build`, `pnpm run lint`, `yarn run dev`; ignore `npm install` and `yarn add x`.';
  const names = parsers.extractNpmScripts(text).map((s) => s.name).sort();
  assert.deepStrictEqual(names, ['build', 'dev', 'lint']);
});

// --------------------------------------------------------------------------
// verify-report renderer
// --------------------------------------------------------------------------
test('renderReportHtml produces a self-contained doc with issue rows', () => {
  const result = {
    file: 'ans.md',
    issues: [
      { type: 'fake-symbol', value: 'phantomFn', line: 3, location: 'L3', confidence: 'medium', message: 'Symbol not found', suggestion: 'Did you mean `realFn()`?' },
    ],
    summary: { total: 1, byType: { 'fake-symbol': 1 }, clean: false },
  };
  const html = report.renderReportHtml(result);
  assert.ok(/<!DOCTYPE html>/.test(html));
  assert.ok(/Fake symbol/.test(html));
  assert.ok(/Did you mean/.test(html));
  assert.ok(!/<script/i.test(html), 'no scripts — static report');
});

test('renderReportMarkdown clean vs dirty', () => {
  assert.ok(/clean/.test(report.renderReportMarkdown({ issues: [], summary: { clean: true } })));
  const md = report.renderReportMarkdown({
    file: 'a.md',
    issues: [{ type: 'fake-file', value: 'x.js', line: 1, location: 'L1', suggestion: null }],
    summary: { total: 1, clean: false },
  });
  assert.ok(/\| Type \| Location/.test(md));
  assert.ok(/Fake file/.test(md));
});

test('renderReportHtml escapes html in values', () => {
  const html = report.renderReportHtml({
    file: '<x>&"', issues: [], summary: { clean: true, symbolsIndexed: 0 },
  });
  assert.ok(!/<x>/.test(html), 'file name escaped');
});

// --------------------------------------------------------------------------
// CLI dispatch against a generated fixture repo
// --------------------------------------------------------------------------
function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-verify-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fx', version: '1.0.0', scripts: { build: 'echo b' }, dependencies: { chalk: '^5.0.0' } }, null, 2)
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

const mvpAnswer = path.join(fixtureDir, 'mvp.md');
fs.writeFileSync(mvpAnswer, [
  '# Answer',
  'Add `src/ghost.test.js` and call `realFun()`. Run `npm run buidl`.',
].join('\n'));

test('CLI: detects fake-test-file, fake-symbol w/ suggestion, fake-npm-script', () => {
  const res = runVerify(fixtureDir, mvpAnswer);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.ok(/Fake test file/.test(res.stdout), 'test-file detector');
  assert.ok(/Fake npm script/.test(res.stdout), 'npm-script detector');
  assert.ok(/Did you mean `build`/.test(res.stdout), 'script suggestion');
  assert.ok(/Did you mean `realFunc\(\)`/.test(res.stdout), 'symbol suggestion');
});

test('CLI: --report writes a standalone HTML file', () => {
  const out = path.join(fixtureDir, 'report.html');
  const res = runVerify(fixtureDir, mvpAnswer, ['--report', out]);
  assert.strictEqual(res.status, 1);
  assert.ok(fs.existsSync(out), 'report file written');
  const html = fs.readFileSync(out, 'utf8');
  assert.ok(/<!DOCTYPE html>/.test(html) && /Hallucination Guard report/.test(html));
});

test('CLI: --json issues include confidence + suggestion fields', () => {
  const res = runVerify(fixtureDir, mvpAnswer, ['--json']);
  const obj = JSON.parse(res.stdout.trim());
  assert.ok(obj.issues.every((i) => i.confidence && 'suggestion' in i && i.location));
  assert.ok(obj.summary.byType['fake-test-file'] >= 1);
});

// Cleanup
try { fs.rmSync(fixtureDir, { recursive: true, force: true }); } catch (_) {}

console.log(`\nverify-ai-output: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
