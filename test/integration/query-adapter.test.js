'use strict';

/**
 * Integration tests for Fix 1 & Fix 2:
 *
 *  Fix 1 — buildSigIndex probes all known adapter output paths
 *   1.  buildSigIndex: returns non-empty index from copilot-instructions.md
 *   2.  buildSigIndex: returns non-empty index from CLAUDE.md (claude adapter)
 *   3.  buildSigIndex: returns non-empty index from AGENTS.md (codex adapter)
 *   4.  buildSigIndex: returns non-empty index from .cursorrules (cursor adapter)
 *   5.  buildSigIndex: returns non-empty index from .windsurfrules (windsurf adapter)
 *   6.  buildSigIndex: skips human-written preamble before ## Auto-generated signatures
 *   7.  buildSigIndex: opts.contextPath overrides probe behaviour
 *   8.  buildSigIndex: returns empty Map when no context file exists
 *   9.  buildSigIndex: ignores files with no parseable ### headers
 *  10.  buildSigIndex: probe order — copilot wins when both copilot and claude files exist
 *
 *  Fix 2 — CLI --query respects --adapter flag
 *  11.  CLI --query --adapter claude: reads CLAUDE.md, exits 0
 *  12.  CLI --query --adapter codex: reads AGENTS.md, exits 0
 *  13.  CLI --query --adapter cursor: reads .cursorrules, exits 0
 *  14.  CLI --query --adapter copilot: reads copilot-instructions.md, exits 0
 *  15.  CLI --query --adapter <unknown>: still works via probe fallback
 *  16.  CLI --query: works without --adapter (probe picks up whichever file exists)
 *  17.  CLI --query: exits 1 with helpful message when no context file exists anywhere
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

/** Minimal context file content with two fake file signatures. */
function minimalContext(extra = '') {
  return [
    extra,
    '## Auto-generated signatures',
    '<!-- Updated by gen-context.js -->',
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

/** Create a temp dir, write a context file at relPath, return { dir, filePath }. */
function writeTmp(relPath, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-test-'));
  const filePath = path.join(dir, ...relPath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return { dir, filePath };
}

/** Run the CLI with given args from a given cwd. */
function run(cwd, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 2 * 1024 * 1024,
  });
}

console.log('[query-adapter.test.js] Fix 1 & Fix 2 — adapter-aware --query');
console.log('');

// ---------------------------------------------------------------------------
// Fix 1 — buildSigIndex unit tests
// ---------------------------------------------------------------------------

test('buildSigIndex: returns non-empty index from copilot-instructions.md', () => {
  const { dir } = writeTmp('.github/copilot-instructions.md', minimalContext());
  try {
    const index = buildSigIndex(dir);
    assert.ok(index.size >= 2, `expected ≥2 entries, got ${index.size}`);
    assert.ok(index.has('src/foo.js'), 'should contain src/foo.js');
    assert.ok(index.has('src/bar.js'), 'should contain src/bar.js');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSigIndex: returns non-empty index from CLAUDE.md (claude adapter)', () => {
  const { dir } = writeTmp('CLAUDE.md', minimalContext());
  try {
    const index = buildSigIndex(dir);
    assert.ok(index.size >= 2, `expected ≥2 entries, got ${index.size}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSigIndex: returns non-empty index from AGENTS.md (codex adapter)', () => {
  const { dir } = writeTmp('AGENTS.md', minimalContext());
  try {
    const index = buildSigIndex(dir);
    assert.ok(index.size >= 2, `expected ≥2 entries, got ${index.size}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSigIndex: returns non-empty index from .cursorrules (cursor adapter)', () => {
  const { dir } = writeTmp('.cursorrules', minimalContext());
  try {
    const index = buildSigIndex(dir);
    assert.ok(index.size >= 2, `expected ≥2 entries, got ${index.size}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSigIndex: returns non-empty index from .windsurfrules (windsurf adapter)', () => {
  const { dir } = writeTmp('.windsurfrules', minimalContext());
  try {
    const index = buildSigIndex(dir);
    assert.ok(index.size >= 2, `expected ≥2 entries, got ${index.size}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSigIndex: skips human-written preamble before ## Auto-generated signatures', () => {
  const preamble = [
    '# My Project',
    '',
    '## Rules',
    'Always use TypeScript.',
    '',
    '### some-human-section',
    '```',
    'not a real sig',
    '```',
    '',
  ].join('\n');
  const { dir } = writeTmp('CLAUDE.md', minimalContext(preamble));
  try {
    const index = buildSigIndex(dir);
    // Human section "some-human-section" must not appear in the index
    assert.ok(!index.has('some-human-section'),
      'human-written ### section should not appear in index');
    // Real signatures should be present
    assert.ok(index.has('src/foo.js'), 'src/foo.js should be indexed');
    assert.ok(index.has('src/bar.js'), 'src/bar.js should be indexed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSigIndex: opts.contextPath overrides probe behaviour', () => {
  // Write two context files; opts.contextPath should pin to the second one
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-test-'));
  try {
    // Default probe would find copilot first
    const copilotDir = path.join(dir, '.github');
    fs.mkdirSync(copilotDir, { recursive: true });
    fs.writeFileSync(path.join(copilotDir, 'copilot-instructions.md'), minimalContext(), 'utf8');

    // Write a different file with a unique entry
    const customPath = path.join(dir, 'custom-context.md');
    const customContent = [
      '## Auto-generated signatures',
      '',
      '### src/unique-only-in-custom.js',
      '```',
      'function uniqueFn() → void',
      '```',
      '',
    ].join('\n');
    fs.writeFileSync(customPath, customContent, 'utf8');

    const index = buildSigIndex(dir, { contextPath: customPath });
    assert.ok(index.has('src/unique-only-in-custom.js'),
      'should read from the explicitly provided contextPath');
    assert.ok(!index.has('src/foo.js'),
      'should NOT read from the default copilot path when contextPath is given');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSigIndex: returns empty Map when no context file exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-test-'));
  try {
    const index = buildSigIndex(dir);
    assert.strictEqual(index.size, 0, 'should return empty Map');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSigIndex: ignores files with no parseable ### headers', () => {
  // A file that exists but contains no ### headers should yield size 0
  // so the probe continues to the next candidate.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-test-'));
  try {
    const copilotDir = path.join(dir, '.github');
    fs.mkdirSync(copilotDir, { recursive: true });
    fs.writeFileSync(
      path.join(copilotDir, 'copilot-instructions.md'),
      '# Nothing here\nNo signatures at all.\n',
      'utf8'
    );
    // AGENTS.md has real signatures
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), minimalContext(), 'utf8');

    const index = buildSigIndex(dir);
    // copilot file has no headers → probe falls through to AGENTS.md
    assert.ok(index.size >= 2, `expected ≥2 entries from AGENTS.md fallback, got ${index.size}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSigIndex: probe order — copilot wins when both copilot and claude files exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-test-'));
  try {
    // copilot file has src/copilot-only.js
    const copilotDir = path.join(dir, '.github');
    fs.mkdirSync(copilotDir, { recursive: true });
    const copilotContent = [
      '## Auto-generated signatures',
      '',
      '### src/copilot-only.js',
      '```',
      'function copilotFn() → void',
      '```',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(copilotDir, 'copilot-instructions.md'), copilotContent, 'utf8');

    // claude file has src/claude-only.js
    const claudeContent = [
      '## Auto-generated signatures',
      '',
      '### src/claude-only.js',
      '```',
      'function claudeFn() → void',
      '```',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), claudeContent, 'utf8');

    const index = buildSigIndex(dir);
    assert.ok(index.has('src/copilot-only.js'), 'copilot should take priority');
    assert.ok(!index.has('src/claude-only.js'), 'claude file should not be read when copilot exists');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Fix 2 — CLI --query respects --adapter flag
// ---------------------------------------------------------------------------

/**
 * Helper: create a temp project dir with a context file at adapterRelPath,
 * run --query "foo" [--adapter adapterName] from that dir, clean up.
 */
function cliQueryTest(adapterRelPath, adapterFlag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-clitest-'));
  try {
    const filePath = path.join(dir, ...adapterRelPath.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, minimalContext(), 'utf8');

    const extraArgs = adapterFlag ? ['--adapter', adapterFlag] : [];
    const res = run(dir, '--query', 'foo', ...extraArgs);

    return { status: res.status, stdout: res.stdout, stderr: res.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('CLI --query --adapter claude: reads CLAUDE.md, exits 0', () => {
  const { status, stderr } = cliQueryTest('CLAUDE.md', 'claude');
  assert.strictEqual(status, 0,
    `Expected exit 0, got ${status}. stderr: ${stderr}`);
});

test('CLI --query --adapter codex: reads AGENTS.md, exits 0', () => {
  const { status, stderr } = cliQueryTest('AGENTS.md', 'codex');
  assert.strictEqual(status, 0,
    `Expected exit 0, got ${status}. stderr: ${stderr}`);
});

test('CLI --query --adapter cursor: reads .cursorrules, exits 0', () => {
  const { status, stderr } = cliQueryTest('.cursorrules', 'cursor');
  assert.strictEqual(status, 0,
    `Expected exit 0, got ${status}. stderr: ${stderr}`);
});

test('CLI --query --adapter copilot: reads copilot-instructions.md, exits 0', () => {
  const { status, stderr } = cliQueryTest('.github/copilot-instructions.md', 'copilot');
  assert.strictEqual(status, 0,
    `Expected exit 0, got ${status}. stderr: ${stderr}`);
});

test('CLI --query --adapter windsurf: reads .windsurfrules, exits 0', () => {
  const { status, stderr } = cliQueryTest('.windsurfrules', 'windsurf');
  assert.strictEqual(status, 0,
    `Expected exit 0, got ${status}. stderr: ${stderr}`);
});

test('CLI --query: works without --adapter (probe picks up whichever file exists)', () => {
  // Only AGENTS.md exists — probe should find it without --adapter
  const { status, stderr } = cliQueryTest('AGENTS.md', null);
  assert.strictEqual(status, 0,
    `Expected exit 0, got ${status}. stderr: ${stderr}`);
});

test('CLI --query: exits 1 with helpful message when no context file exists anywhere', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-clitest-'));
  try {
    const res = run(dir, '--query', 'anything');
    assert.strictEqual(res.status, 1,
      `Expected exit 1, got ${res.status}`);
    const out = res.stdout + res.stderr;
    assert.ok(out.includes('no context file found'),
      `Expected "no context file found" in output, got: ${out.slice(0, 200)}`);
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
