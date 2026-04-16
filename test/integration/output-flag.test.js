'use strict';

/**
 * Integration tests for Fix 3: --output <file> flag.
 *
 * Tests:
 *
 *  buildSigIndex — customOutput in config
 *   1.  buildSigIndex: reads customOutput path from gen-context.config.json
 *   2.  buildSigIndex: falls through to adapter probe when customOutput file is missing
 *   3.  buildSigIndex: customOutput takes priority over adapter output paths
 *
 *  CLI --output during generation
 *   4.  CLI --output: creates the custom file during generation
 *   5.  CLI --output: custom file contains parseable ### headers
 *   6.  CLI --output: persists customOutput to gen-context.config.json
 *   7.  CLI --output: nested directory is created automatically
 *   8.  CLI --output: missing path argument exits 1 with usage message
 *   9.  CLI --output --adapter claude: custom file is written alongside CLAUDE.md
 *
 *  CLI --query with --output
 *  10.  CLI --output --query: reads the custom file directly (explicit)
 *  11.  CLI --query (no --output): finds the custom file via persisted config
 *  12.  CLI --output --query: exits 1 when the custom file does not exist
 *  13.  CLI --output overrides --adapter during --query
 */

const assert      = require('assert');
const fs          = require('fs');
const os          = require('os');
const path        = require('path');
const { spawnSync } = require('child_process');

const ROOT   = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

const { buildSigIndex } = require(path.join(ROOT, 'src', 'retrieval', 'ranker'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minimalContext() {
  return [
    '## Auto-generated signatures',
    '',
    '# Code signatures',
    '',
    '### src/foo.js',
    '```',
    'function foo(x) → string',
    '```',
    '',
    '### src/bar.js',
    '```',
    'function bar(y) → number',
    '```',
    '',
  ].join('\n');
}

/** Create a temp dir, write a file at relPath (slash-separated), return dir. */
function writeTmp(relPath, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-of-'));
  const filePath = path.join(dir, ...relPath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return dir;
}

/** Run CLI with given args from the given cwd. */
function run(cwd, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

/**
 * Build a minimal but real project dir that sigmap can scan:
 *  - src/hello.js with one function
 *  - gen-context.config.json with srcDirs: ['src']
 */
function makeMinimalProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-proj-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'src', 'hello.js'),
    "function hello(name) { return 'Hello ' + name; }\nmodule.exports = { hello };\n",
    'utf8'
  );
  fs.writeFileSync(
    path.join(dir, 'gen-context.config.json'),
    JSON.stringify({ srcDirs: ['src'], outputs: ['copilot'] }, null, 2) + '\n',
    'utf8'
  );
  return dir;
}

console.log('[output-flag.test.js] Fix 3 — --output <file> flag');
console.log('');

// ---------------------------------------------------------------------------
// buildSigIndex — customOutput in config (unit tests)
// ---------------------------------------------------------------------------

test('buildSigIndex: reads customOutput path from gen-context.config.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-of-'));
  try {
    const customFile = path.join(dir, 'custom', 'ai-context.md');
    fs.mkdirSync(path.dirname(customFile), { recursive: true });
    fs.writeFileSync(customFile, minimalContext(), 'utf8');

    const cfg = { customOutput: 'custom/ai-context.md' };
    fs.writeFileSync(
      path.join(dir, 'gen-context.config.json'),
      JSON.stringify(cfg, null, 2),
      'utf8'
    );

    const index = buildSigIndex(dir);
    assert.ok(index.size >= 2, `expected ≥2 entries, got ${index.size}`);
    assert.ok(index.has('src/foo.js'), 'should contain src/foo.js from custom file');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSigIndex: falls through to adapter probe when customOutput file is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-of-'));
  try {
    // Config points to a non-existent file
    fs.writeFileSync(
      path.join(dir, 'gen-context.config.json'),
      JSON.stringify({ customOutput: 'does-not-exist.md' }, null, 2),
      'utf8'
    );

    // But AGENTS.md exists and has real content
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), minimalContext(), 'utf8');

    const index = buildSigIndex(dir);
    assert.ok(index.size >= 2, `expected ≥2 entries via fallback, got ${index.size}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSigIndex: customOutput takes priority over adapter output paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-of-'));
  try {
    // customOutput has a unique entry
    const customContent = [
      '## Auto-generated signatures',
      '',
      '### src/custom-only.js',
      '```',
      'function customFn() → void',
      '```',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'custom.md'), customContent, 'utf8');
    fs.writeFileSync(
      path.join(dir, 'gen-context.config.json'),
      JSON.stringify({ customOutput: 'custom.md' }, null, 2),
      'utf8'
    );

    // Copilot file also exists (would be picked first without customOutput)
    const copilotDir = path.join(dir, '.github');
    fs.mkdirSync(copilotDir, { recursive: true });
    fs.writeFileSync(path.join(copilotDir, 'copilot-instructions.md'), minimalContext(), 'utf8');

    const index = buildSigIndex(dir);
    assert.ok(index.has('src/custom-only.js'), 'customOutput should take priority');
    assert.ok(!index.has('src/foo.js'), 'copilot file should not be read when customOutput is set');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// CLI --output during generation
// ---------------------------------------------------------------------------

test('CLI --output: creates the custom file during generation', () => {
  const dir = makeMinimalProject();
  try {
    const r = run(dir, '--output', 'out/custom.md');
    assert.strictEqual(r.status, 0, `exit ${r.status}: ${r.stderr}`);
    assert.ok(fs.existsSync(path.join(dir, 'out', 'custom.md')),
      'custom output file should exist');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI --output: custom file contains parseable ### headers', () => {
  const dir = makeMinimalProject();
  try {
    run(dir, '--output', 'my-sigs.md');
    const content = fs.readFileSync(path.join(dir, 'my-sigs.md'), 'utf8');
    assert.ok(content.includes('###'), 'custom file should contain ### file headers');
    assert.ok(content.includes('```'), 'custom file should contain code fences');

    const index = buildSigIndex(dir, { contextPath: path.join(dir, 'my-sigs.md') });
    assert.ok(index.size > 0, `buildSigIndex should parse custom file, got size ${index.size}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI --output: persists customOutput to gen-context.config.json', () => {
  const dir = makeMinimalProject();
  try {
    run(dir, '--output', 'ai/context.md');
    const cfg = JSON.parse(
      fs.readFileSync(path.join(dir, 'gen-context.config.json'), 'utf8')
    );
    assert.strictEqual(cfg.customOutput, 'ai/context.md',
      'customOutput should be persisted in config');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI --output: nested directory is created automatically', () => {
  const dir = makeMinimalProject();
  try {
    const r = run(dir, '--output', 'a/b/c/deep.md');
    assert.strictEqual(r.status, 0, `exit ${r.status}: ${r.stderr}`);
    assert.ok(fs.existsSync(path.join(dir, 'a', 'b', 'c', 'deep.md')),
      'deeply nested directory should be created');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI --output: missing path argument exits 1 with usage message', () => {
  const dir = makeMinimalProject();
  try {
    const r = run(dir, '--output');
    assert.strictEqual(r.status, 1, `expected exit 1, got ${r.status}`);
    const out = r.stdout + r.stderr;
    assert.ok(out.includes('--output'), 'error should mention --output');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI --output --adapter claude: custom file is written alongside CLAUDE.md', () => {
  const dir = makeMinimalProject();
  try {
    const r = run(dir, '--adapter', 'claude', '--output', 'shared/sigs.md');
    assert.strictEqual(r.status, 0, `exit ${r.status}: ${r.stderr}`);
    assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')),
      'CLAUDE.md should still be written by the adapter');
    assert.ok(fs.existsSync(path.join(dir, 'shared', 'sigs.md')),
      'custom output file should also be written');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// CLI --query with --output
// ---------------------------------------------------------------------------

test('CLI --output --query: reads the custom file directly (explicit)', () => {
  const dir = makeMinimalProject();
  try {
    // Generate to a custom path
    let r = run(dir, '--output', 'my-context.md');
    assert.strictEqual(r.status, 0, `generate exit ${r.status}: ${r.stderr}`);

    // Query with the same --output flag
    r = run(dir, '--output', 'my-context.md', '--query', 'hello');
    assert.strictEqual(r.status, 0,
      `--query exit ${r.status}. stderr: ${r.stderr}`);
    const out = r.stdout + r.stderr;
    assert.ok(out.length > 0, 'should produce output');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI --query (no --output): finds the custom file via persisted config', () => {
  const dir = makeMinimalProject();
  try {
    // First run: generate with --output, which persists customOutput
    let r = run(dir, '--output', 'persisted-context.md');
    assert.strictEqual(r.status, 0, `generate exit ${r.status}: ${r.stderr}`);

    // Second run: --query without --output — should find via persisted config
    r = run(dir, '--query', 'hello');
    assert.strictEqual(r.status, 0,
      `--query (no --output) exit ${r.status}. stderr: ${r.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI --output --query: exits 1 when the custom file does not exist', () => {
  const dir = makeMinimalProject();
  try {
    const r = run(dir, '--output', 'ghost.md', '--query', 'anything');
    assert.strictEqual(r.status, 1, `expected exit 1, got ${r.status}`);
    const out = r.stdout + r.stderr;
    assert.ok(out.includes('no context file found'), `expected error message, got: ${out.slice(0, 200)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI --output overrides --adapter during --query', () => {
  const dir = makeMinimalProject();
  try {
    // Generate custom output
    let r = run(dir, '--output', 'override.md');
    assert.strictEqual(r.status, 0, `generate exit ${r.status}: ${r.stderr}`);

    // Query: --output should take priority over --adapter claude
    r = run(dir, '--output', 'override.md', '--adapter', 'claude', '--query', 'hello');
    assert.strictEqual(r.status, 0,
      `--query (--output + --adapter) exit ${r.status}. stderr: ${r.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log('');
console.log(`${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
