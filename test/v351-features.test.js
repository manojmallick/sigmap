#!/usr/bin/env node
'use strict';

/**
 * v3.5.1 feature tests — zero dependencies.
 * Tests all 8 new features introduced in v3.5.1.
 *
 * Usage: node test/v351-features.test.js
 */

const fs   = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GEN  = path.join(ROOT, 'gen-context.js');
const TMP  = path.join(ROOT, '.tmp-test-351');

let passed = 0;
let failed = 0;

function pass(name) {
  console.log(`  PASS  ${name}`);
  passed++;
}
function fail(name, reason) {
  console.log(`  FAIL  ${name} — ${reason}`);
  failed++;
}
function assert(name, condition, reason) {
  condition ? pass(name) : fail(name, reason || 'assertion failed');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function run(args) {
  return spawnSync(process.execPath, [GEN, ...args], {
    cwd: TMP,
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function setup() {
  fs.mkdirSync(TMP, { recursive: true });
  // Init a standalone git repo so resolveProjectRoot returns TMP, not sigmap root
  execSync('git init -q', { cwd: TMP });
  execSync('git commit --allow-empty -m "init" -q', { cwd: TMP, env: { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@test.com', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@test.com' } });
  // Write a minimal package.json so sigmap can detect project root
  fs.writeFileSync(path.join(TMP, 'package.json'), JSON.stringify({ name: 'test-project', version: '0.1.0' }));
  // Write a small JS source file so context generation has something to index
  fs.mkdirSync(path.join(TMP, 'src'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'src', 'index.js'), [
    "'use strict';",
    'function hello(name) { return `Hello ${name}`; }',
    'function goodbye(name) { return `Bye ${name}`; }',
    'module.exports = { hello, goodbye };',
  ].join('\n'));
}

function teardown() {
  fs.rmSync(TMP, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Feature 1: `sigmap run` alias
// ---------------------------------------------------------------------------
function testRunAlias() {
  const r = run(['run', '--version']);
  assert('feature-1 run alias: exits 0', r.status === 0, `exit ${r.status}`);
  assert('feature-1 run alias: prints version', /\d+\.\d+\.\d+/.test(r.stdout + r.stderr), `output: ${r.stdout}`);
}

// ---------------------------------------------------------------------------
// Feature 2: --mode flag validation
// ---------------------------------------------------------------------------
function testModeValidation() {
  const r = run(['--mode', 'invalid']);
  assert('feature-2 --mode invalid: exits 1', r.status === 1, `exit ${r.status}`);
  assert('feature-2 --mode invalid: error message', (r.stdout + r.stderr).includes('unknown --mode'), 'no error msg');
}

function testModeFast() {
  const r = run(['--mode', 'fast']);
  // Should write llm.txt (even if context is minimal)
  const llmPath = path.join(TMP, 'llm.txt');
  const exists = fs.existsSync(llmPath);
  assert('feature-2 --mode fast: creates llm.txt', exists, 'file not found');
  if (exists) {
    const content = fs.readFileSync(llmPath, 'utf8');
    assert('feature-2 --mode fast: llm.txt starts with # Project:', content.startsWith('# Project:'), 'wrong header');
  }
}

function testModeBoth() {
  const r = run(['--mode', 'both']);
  const llmPath     = path.join(TMP, 'llm.txt');
  const llmFullPath = path.join(TMP, 'llm-full.txt');
  const llmsPath    = path.join(TMP, 'llms.txt');
  assert('feature-2 --mode both: creates llm.txt',      fs.existsSync(llmPath),     'llm.txt missing');
  assert('feature-2 --mode both: creates llm-full.txt', fs.existsSync(llmFullPath), 'llm-full.txt missing');
  assert('feature-2 --mode both: creates llms.txt',     fs.existsSync(llmsPath),    'llms.txt missing');
}

// ---------------------------------------------------------------------------
// Feature 3: llm.txt format module
// ---------------------------------------------------------------------------
function testLlmTxtModule() {
  const mod = require(path.join(ROOT, 'src', 'format', 'llm-txt.js'));
  const context = {
    projectName: 'my-app',
    fileEntries: [{ language: 'javascript' }, { language: 'python' }],
    srcDirs: ['src', 'lib'],
  };
  const out = mod.format(context, '/fake/cwd', '3.5.1');
  assert('feature-3 llm-txt: starts with # Project: my-app', out.startsWith('# Project: my-app'), 'wrong header');
  assert('feature-3 llm-txt: contains Languages', out.includes('Languages:'), 'no Languages line');
  assert('feature-3 llm-txt: contains ## Modules', out.includes('## Modules'), 'no Modules section');
  assert('feature-3 llm-txt: contains SigMap v', out.includes('SigMap v'), 'no version');
  assert('feature-3 llm-txt: outputPath returns llm.txt', mod.outputPath('/cwd').endsWith('llm.txt'), 'wrong outputPath');
}

// ---------------------------------------------------------------------------
// Feature 4: llm-full.txt adapter
// ---------------------------------------------------------------------------
function testLlmFullModule() {
  const mod = require(path.join(ROOT, 'packages', 'adapters', 'llm-full.js'));
  const context = {
    projectName: 'my-app',
    fileEntries: [
      { filePath: '/cwd/src/index.js', sigs: ['function hello(name)', 'function goodbye(name)'] },
    ],
  };
  const out = mod.format(context, { cwd: '/cwd', version: '3.5.1' });
  assert('feature-4 llm-full: starts with # my-app', out.startsWith('# my-app'), 'wrong header');
  assert('feature-4 llm-full: contains Generated:', out.includes('Generated:'), 'no timestamp');
  assert('feature-4 llm-full: contains ## src/index.js', out.includes('## src/index.js'), 'no file section');
  assert('feature-4 llm-full: contains signature', out.includes('function hello(name)'), 'no sig');
  assert('feature-4 llm-full: outputPath returns llm-full.txt', mod.outputPath('/cwd').endsWith('llm-full.txt'), 'wrong outputPath');
  assert('feature-4 llm-full: name = llm-full', mod.name === 'llm-full', `name = ${mod.name}`);
}

// ---------------------------------------------------------------------------
// Feature 5: llms.txt generator
// ---------------------------------------------------------------------------
function testLlmsTxtModule() {
  const mod = require(path.join(ROOT, 'src', 'format', 'llms-txt.js'));
  const context = {
    projectName: 'my-app',
    fileEntries: [
      { filePath: '/cwd/src/index.js', language: 'javascript', sigs: ['function hello(name)'] },
    ],
    srcDirs: ['src'],
  };
  const out = mod.format(context, '/cwd', [], '3.5.1');
  assert('feature-5 llms-txt: starts with # SigMap Context Index', out.startsWith('# SigMap Context Index'), 'wrong header');
  assert('feature-5 llms-txt: contains ## Project', out.includes('## Project'), 'no Project section');
  assert('feature-5 llms-txt: contains Name: my-app', out.includes('Name: my-app'), 'no name');
  assert('feature-5 llms-txt: contains ## Source Modules', out.includes('## Source Modules'), 'no modules');
  assert('feature-5 llms-txt: outputPath returns llms.txt', mod.outputPath('/cwd').endsWith('llms.txt'), 'wrong outputPath');

  // With written files
  const out2 = mod.format(context, '/cwd', [{ path: '/cwd/llm.txt', label: 'llm.txt', tokens: 120 }], '3.5.1');
  assert('feature-5 llms-txt: contains ## Context Files', out2.includes('## Context Files'), 'no Context Files section');
  assert('feature-5 llms-txt: contains llm.txt entry', out2.includes('[llm.txt]'), 'no llm.txt entry');
}

// ---------------------------------------------------------------------------
// Feature 6: sigmap sync command
// ---------------------------------------------------------------------------
function testSyncCommand() {
  const r = run(['sync']);
  assert('feature-6 sync: exits 0', r.status === 0, `exit ${r.status}\n${r.stderr}`);
  const combined = r.stdout + r.stderr;
  assert('feature-6 sync: prints sync complete', combined.includes('sync complete'), 'no sync complete msg');
}

// ---------------------------------------------------------------------------
// Feature 7: generic fallback extractor
// ---------------------------------------------------------------------------
function testGenericExtractor() {
  const mod = require(path.join(ROOT, 'src', 'extractors', 'generic.js'));

  const elixirLike = [
    'defmodule MyApp do',
    'def hello(name) do',
    '  "Hello #{name}"',
    'end',
    'def goodbye(name), do: "Bye #{name}"',
  ].join('\n');

  const nixLike = [
    '# nix expression',
    'let myPkg = { version = "1.0"; };',
    'let rec fib = n: if n < 2 then n else fib(n-1) + fib(n-2);',
    'in myPkg',
  ].join('\n');

  const gleanLike = [
    'fn add(x: Int, y: Int) -> Int {',
    '  x + y',
    '}',
    'fn multiply(x: Int, y: Int) -> Int {',
    '  x * y',
    '}',
  ].join('\n');

  const elixirSigs = mod.extract(elixirLike);
  assert('feature-7 generic: extracts def lines (Elixir-like)', elixirSigs.length >= 2, `got ${elixirSigs.length}`);

  const nixSigs = mod.extract(nixLike);
  assert('feature-7 generic: extracts let binding (Nix-like)', nixSigs.some(s => s.includes('let')), `got: ${nixSigs}`);

  const gleanSigs = mod.extract(gleanLike);
  assert('feature-7 generic: extracts fn lines (Gleam-like)', gleanSigs.length >= 2, `got ${gleanSigs.length}`);

  assert('feature-7 generic: returns [] for empty input', JSON.stringify(mod.extract('')) === '[]', 'not []');
  assert('feature-7 generic: returns [] for null',        JSON.stringify(mod.extract(null)) === '[]', 'not []');
  assert('feature-7 generic: truncates at 15 entries', mod.extract(
    Array.from({ length: 30 }, (_, i) => `def fn${i}(x)`).join('\n')
  ).length <= 15, 'not capped at 15');
}

// ---------------------------------------------------------------------------
// Feature 8: post-run summary on stderr
// ---------------------------------------------------------------------------
function testPostRunSummary() {
  const r = run([]);
  // Summary is written to stderr
  assert('feature-8 post-run: SigMap v in stderr', r.stderr.includes('SigMap v'), `stderr: ${r.stderr.slice(0, 200)}`);
  assert('feature-8 post-run: Files scanned in stderr',  r.stderr.includes('Files scanned'), 'no Files scanned line');
  assert('feature-8 post-run: Token reduction in stderr', r.stderr.includes('Token reduction'), 'no Token reduction line');
}

function testPostRunSummaryQuiet() {
  const r = run(['--quiet']);
  assert('feature-8 --quiet: no summary', !r.stderr.includes('SigMap v3.5.1'), 'summary printed despite --quiet');
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
console.log('\nv3.5.1 feature tests\n');

setup();
try {
  testRunAlias();
  testModeValidation();
  testLlmTxtModule();
  testLlmFullModule();
  testLlmsTxtModule();
  testGenericExtractor();
  testModeFast();
  testModeBoth();
  testSyncCommand();
  testPostRunSummary();
  testPostRunSummaryQuiet();
} finally {
  teardown();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
