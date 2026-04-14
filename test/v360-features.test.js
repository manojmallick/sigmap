#!/usr/bin/env node
'use strict';

/**
 * v3.6.0 feature tests — zero dependencies.
 * Tests CLI-level features (1, 7) + module-level (2, 3 data contract) and
 * verifies --health --json emits tokens + reduction (features 3+5).
 *
 * Usage: node test/v360-features.test.js
 */

const fs   = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GEN  = path.join(ROOT, 'gen-context.js');
const TMP  = path.join(ROOT, '.tmp-test-360');

let passed = 0;
let failed = 0;

function pass(name) { console.log(`  PASS  ${name}`); passed++; }
function fail(name, reason) { console.log(`  FAIL  ${name} — ${reason}`); failed++; }
function assert(name, condition, reason) { condition ? pass(name) : fail(name, reason || 'assertion failed'); }

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
  // Isolated git repo so resolveProjectRoot returns TMP, not sigmap root
  execSync('git init -q', { cwd: TMP });
  execSync('git commit --allow-empty -m "init" -q', {
    cwd: TMP,
    env: { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'x@x.com', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'x@x.com' },
  });
  fs.writeFileSync(path.join(TMP, 'package.json'), JSON.stringify({ name: 'test-project', version: '0.1.0' }));
  fs.mkdirSync(path.join(TMP, 'src'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'src', 'index.js'), [
    "'use strict';",
    'function hello(name) { return `Hello ${name}`; }',
    'function goodbye(name) { return `Bye ${name}`; }',
    'module.exports = { hello, goodbye };',
  ].join('\n'));
  // Write a fake context file so --health has something to read
  fs.mkdirSync(path.join(TMP, '.github'), { recursive: true });
  fs.writeFileSync(path.join(TMP, '.github', 'copilot-instructions.md'), '# test context\nfunction hello(name)\nfunction goodbye(name)\n');
}

function teardown() {
  fs.rmSync(TMP, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Feature 1: sigmap explain <file>
// ---------------------------------------------------------------------------
function testExplainIncluded() {
  const r = run(['explain', 'src/index.js']);
  assert('feature-1 explain included: exits 0', r.status === 0, `exit ${r.status}\n${r.stderr}`);
  const out = r.stdout + r.stderr;
  assert('feature-1 explain included: prints INCLUDED', out.includes('INCLUDED'), `output: ${out.slice(0, 200)}`);
  assert('feature-1 explain included: prints Extractor',   out.includes('Extractor'), 'no extractor line');
  assert('feature-1 explain included: prints Signatures',  out.includes('Signatures'), 'no signatures line');
  assert('feature-1 explain included: prints Preview',     out.includes('Preview'), 'no preview line');
}

function testExplainJson() {
  const r = run(['explain', 'src/index.js', '--json']);
  assert('feature-1 explain --json: exits 0', r.status === 0, `exit ${r.status}`);
  let data;
  try { data = JSON.parse(r.stdout.trim()); } catch (_) { fail('feature-1 explain --json: valid JSON', 'parse error'); return; }
  assert('feature-1 explain --json: status=included',  data.status === 'included',  `status=${data.status}`);
  assert('feature-1 explain --json: has signatures',   typeof data.signatures === 'number', 'no signatures field');
  assert('feature-1 explain --json: has extractor',    typeof data.extractor === 'string',  'no extractor field');
  assert('feature-1 explain --json: has preview array', Array.isArray(data.preview), 'preview not array');
}

function testExplainExcludedNotInSrcDirs() {
  const r = run(['explain', 'package.json']);
  assert('feature-1 explain non-srcdir: exits 0', r.status === 0, `exit ${r.status}`);
  const out = r.stdout + r.stderr;
  assert('feature-1 explain non-srcdir: prints EXCLUDED', out.includes('EXCLUDED'), `output: ${out.slice(0, 200)}`);
  assert('feature-1 explain non-srcdir: mentions srcDir',  out.includes('srcDir') || out.includes('srcDirs'), 'no srcDir mention');
}

function testExplainMissingArg() {
  const r = run(['explain']);
  assert('feature-1 explain no arg: exits 1', r.status === 1, `exit ${r.status}`);
}

function testExplainAliasFlag() {
  // --explain flag form
  const r = run(['--explain', 'src/index.js']);
  assert('feature-1 --explain flag: exits 0', r.status === 0, `exit ${r.status}\n${r.stderr}`);
  const out = r.stdout + r.stderr;
  assert('feature-1 --explain flag: prints INCLUDED', out.includes('INCLUDED'), `output: ${out.slice(0, 200)}`);
}

// ---------------------------------------------------------------------------
// Feature 2: VS Code decorations module — unit test the pure logic
// ---------------------------------------------------------------------------
function testDecorationsParseContextPaths() {
  const contextContent = [
    '# SigMap context',
    '',
    '## src',
    '',
    '### src/index.js',
    '```',
    'function hello(name)',
    '```',
    '',
    '### src/utils.js',
    '```',
    'function util()',
    '```',
  ].join('\n');

  const tmpCtx = path.join(TMP, '.github', 'copilot-instructions.md');
  fs.writeFileSync(tmpCtx, contextContent);

  // Inline the parseContextPaths logic (mirrors decorations.js without vscode dep)
  function parseContextPaths(file) {
    if (!fs.existsSync(file)) return new Set();
    const content = fs.readFileSync(file, 'utf8');
    const paths = new Set();
    for (const m of content.matchAll(/^### (.+)$/gm)) paths.add(m[1].trim());
    return paths;
  }

  const paths = parseContextPaths(tmpCtx);
  assert('feature-2 decorations: parses ### src/index.js',  paths.has('src/index.js'),  `paths: ${[...paths]}`);
  assert('feature-2 decorations: parses ### src/utils.js',  paths.has('src/utils.js'),  `paths: ${[...paths]}`);
  assert('feature-2 decorations: finds 2 paths',            paths.size === 2,            `size: ${paths.size}`);
  assert('feature-2 decorations: file exists',              fs.existsSync(path.join(ROOT, 'vscode-extension/src/decorations.js')), 'decorations.js missing');
}

// ---------------------------------------------------------------------------
// Feature 3 + 5: --health --json emits tokens and reduction
// ---------------------------------------------------------------------------
function testHealthJsonTokensReduction() {
  const r = run(['--health', '--json']);
  assert('feature-3/5 health --json: exits 0', r.status === 0, `exit ${r.status}\n${r.stderr}`);
  let data;
  try { data = JSON.parse(r.stdout.trim()); } catch (_) { fail('feature-3/5 health --json: valid JSON', `stdout: ${r.stdout}`); return; }
  assert('feature-3/5 health --json: has grade',     typeof data.grade === 'string',  `grade=${data.grade}`);
  assert('feature-3/5 health --json: has score',     typeof data.score === 'number',  `score=${data.score}`);
  assert('feature-3/5 health --json: has tokens',    typeof data.tokens === 'number', `tokens=${data.tokens}`);
  assert('feature-3/5 health --json: tokens ≥ 0',   data.tokens >= 0,                `tokens=${data.tokens}`);
  assert('feature-3/5 health --json: has reduction', typeof data.reduction === 'number', `reduction=${data.reduction}`);
}

// ---------------------------------------------------------------------------
// Feature 6: docs/start.html exists and has key structure
// ---------------------------------------------------------------------------
function testOnboardingPage() {
  const htmlPath = path.join(ROOT, 'docs', 'start.html');
  assert('feature-6 start.html: file exists', fs.existsSync(htmlPath), 'file not found');
  if (!fs.existsSync(htmlPath)) return;
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert('feature-6 start.html: has step-0 (AI tool)', html.includes('id="step-0"'), 'no step-0');
  assert('feature-6 start.html: has step-1 (structure)', html.includes('id="step-1"'), 'no step-1');
  assert('feature-6 start.html: has step-2 (first time)', html.includes('id="step-2"'), 'no step-2');
  assert('feature-6 start.html: has result block', html.includes('id="result"'), 'no result block');
  assert('feature-6 start.html: has npx sigmap', html.includes('npx sigmap'), 'no npx sigmap');
  assert('feature-6 start.html: has copy button logic', html.includes('Copy'), 'no copy button');
  assert('feature-6 start.html: has restart function', html.includes('restart()'), 'no restart fn');
}

// ---------------------------------------------------------------------------
// Feature 7: --verbose per-file drop reason
// ---------------------------------------------------------------------------
function testVerboseFlag() {
  // Generate context with --verbose — may or may not drop files depending on repo size,
  // but the flag must be accepted without error
  const r = run(['--verbose']);
  assert('feature-7 --verbose: exits 0', r.status === 0, `exit ${r.status}\n${r.stderr}`);
}

function testVerboseFlagDropsShown() {
  // Create enough tiny JS files that budget is exceeded, forcing drops with --verbose output
  const many = path.join(TMP, 'src', 'many');
  fs.mkdirSync(many, { recursive: true });
  for (let i = 0; i < 5; i++) {
    fs.writeFileSync(path.join(many, `util${i}.test.js`), `function test${i}(x){ return x; }\n`.repeat(30));
  }

  // Run with a tiny budget to force drops
  const configPath = path.join(TMP, 'gen-context.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ maxTokens: 200 }));

  const r = run(['--verbose']);
  // Even if nothing is dropped (small fixture), --verbose must not crash
  assert('feature-7 --verbose with budget: exits 0', r.status === 0, `exit ${r.status}`);

  // Cleanup
  fs.rmSync(many, { recursive: true, force: true });
  fs.rmSync(configPath);
}

// ---------------------------------------------------------------------------
// Version check
// ---------------------------------------------------------------------------
function testVersion() {
  const r = run(['--version']);
  assert('version: 3.6.0', (r.stdout + r.stderr).includes('3.6.0'), `output: ${r.stdout}`);
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
console.log('\nv3.6.0 feature tests\n');

setup();
try {
  testVersion();
  testExplainIncluded();
  testExplainJson();
  testExplainExcludedNotInSrcDirs();
  testExplainMissingArg();
  testExplainAliasFlag();
  testDecorationsParseContextPaths();
  testHealthJsonTokensReduction();
  testOnboardingPage();
  testVerboseFlag();
  testVerboseFlagDropsShown();
} finally {
  teardown();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
