'use strict';

/**
 * Regression tests for issue #104:
 * Adapter outputs must not produce duplicate headers on repeated runs.
 *
 * Root cause: formatOutput() prepends its own "<!-- Generated... -->\n# Code signatures\n"
 * header, then writeOutputs() passes that pre-headered string to adapters whose
 * format() wraps it again — producing two headers on every run.
 *
 *  1.  copilot: single "# Code signatures" header after first run
 *  2.  copilot: single header after second run (marker-replace path)
 *  3.  copilot: human content above marker preserved on second run
 *  4.  codex: single "# Code signatures" header after first run
 *  5.  codex: single header after second run
 *  6.  codex: human content above marker preserved on second run
 *  7.  claude: single "# Code signatures" header after first run
 *  8.  claude: single header after second run
 *  9.  claude: human content above marker preserved on second run
 * 10.  stripFormatHeader() — removes generated preamble, leaves body
 * 11.  stripFormatHeader() — passthrough when no header present
 * 12.  stripFormatHeader() — passthrough for empty / falsy input
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { spawnSync } = require('child_process');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
const GEN  = path.join(ROOT, 'gen-context.js');

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

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-hdr-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function run(args, cwd) {
  return spawnSync('node', [GEN, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function countOccurrences(str, sub) {
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(sub, pos)) !== -1) { count++; pos += sub.length; }
  return count;
}

// Minimal project with one source file
function makeProject(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'index.ts'),
    `export function greet(name: string): string { return 'Hello ' + name; }\nexport class Greeter { greet(n: string) { return greet(n); } }`);
}

// ── copilot adapter ───────────────────────────────────────────────────────────

test('1. copilot: single "# Code signatures" header on first run', () => {
  withTempDir((dir) => {
    makeProject(dir);
    const r = run(['--adapter', 'copilot'], dir);
    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const outPath = path.join(dir, '.github', 'copilot-instructions.md');
    assert.ok(fs.existsSync(outPath), 'copilot-instructions.md must exist');
    const content = fs.readFileSync(outPath, 'utf8');
    const count = countOccurrences(content, '# Code signatures');
    assert.strictEqual(count, 1, `expected 1 header, got ${count}:\n${content.slice(0, 600)}`);
  });
});

test('2. copilot: still single header after second run (marker-replace path)', () => {
  withTempDir((dir) => {
    makeProject(dir);
    run(['--adapter', 'copilot'], dir);
    run(['--adapter', 'copilot'], dir); // second run
    const content = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
    const count = countOccurrences(content, '# Code signatures');
    assert.strictEqual(count, 1, `expected 1 header after 2 runs, got ${count}:\n${content.slice(0, 600)}`);
  });
});

test('3. copilot: human content above marker preserved on second run', () => {
  withTempDir((dir) => {
    makeProject(dir);
    // First run — creates file
    run(['--adapter', 'copilot'], dir);
    // Prepend human content above marker
    const outPath = path.join(dir, '.github', 'copilot-instructions.md');
    const existing = fs.readFileSync(outPath, 'utf8');
    fs.writeFileSync(outPath, '# My project rules\n\nAlways use TypeScript.\n\n' + existing);
    // Second run — must preserve human content
    run(['--adapter', 'copilot'], dir);
    const final = fs.readFileSync(outPath, 'utf8');
    assert.ok(final.includes('# My project rules'), 'human header must be preserved');
    assert.ok(final.includes('Always use TypeScript'), 'human body must be preserved');
    const count = countOccurrences(final, '# Code signatures');
    assert.strictEqual(count, 1, `expected 1 header, got ${count}`);
  });
});

// ── codex adapter ─────────────────────────────────────────────────────────────

test('4. codex: single "# Code signatures" header on first run', () => {
  withTempDir((dir) => {
    makeProject(dir);
    const r = run(['--adapter', 'codex'], dir);
    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const outPath = path.join(dir, 'AGENTS.md');
    assert.ok(fs.existsSync(outPath), 'AGENTS.md must exist');
    const content = fs.readFileSync(outPath, 'utf8');
    const count = countOccurrences(content, '# Code signatures');
    assert.strictEqual(count, 1, `expected 1 header, got ${count}:\n${content.slice(0, 600)}`);
  });
});

test('5. codex: still single header after second run', () => {
  withTempDir((dir) => {
    makeProject(dir);
    run(['--adapter', 'codex'], dir);
    run(['--adapter', 'codex'], dir);
    const content = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
    const count = countOccurrences(content, '# Code signatures');
    assert.strictEqual(count, 1, `expected 1 header after 2 runs, got ${count}:\n${content.slice(0, 600)}`);
  });
});

test('6. codex: human content above marker preserved on second run', () => {
  withTempDir((dir) => {
    makeProject(dir);
    run(['--adapter', 'codex'], dir);
    const outPath = path.join(dir, 'AGENTS.md');
    const existing = fs.readFileSync(outPath, 'utf8');
    fs.writeFileSync(outPath, '# Agents guide\n\nUse this context for all tasks.\n\n' + existing);
    run(['--adapter', 'codex'], dir);
    const final = fs.readFileSync(outPath, 'utf8');
    assert.ok(final.includes('# Agents guide'), 'human header must be preserved');
    assert.ok(final.includes('Use this context for all tasks'), 'human body must be preserved');
    const count = countOccurrences(final, '# Code signatures');
    assert.strictEqual(count, 1, `expected 1 header, got ${count}`);
  });
});

// ── claude adapter ────────────────────────────────────────────────────────────

test('7. claude: single "# Code signatures" header on first run', () => {
  withTempDir((dir) => {
    makeProject(dir);
    const r = run(['--adapter', 'claude'], dir);
    assert.strictEqual(r.status, 0, `exit non-zero: ${r.stderr}`);
    const outPath = path.join(dir, 'CLAUDE.md');
    assert.ok(fs.existsSync(outPath), 'CLAUDE.md must exist');
    const content = fs.readFileSync(outPath, 'utf8');
    const count = countOccurrences(content, '# Code signatures');
    assert.strictEqual(count, 1, `expected 1 header, got ${count}:\n${content.slice(0, 600)}`);
  });
});

test('8. claude: still single header after second run', () => {
  withTempDir((dir) => {
    makeProject(dir);
    run(['--adapter', 'claude'], dir);
    run(['--adapter', 'claude'], dir);
    const content = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    const count = countOccurrences(content, '# Code signatures');
    assert.strictEqual(count, 1, `expected 1 header after 2 runs, got ${count}:\n${content.slice(0, 600)}`);
  });
});

test('9. claude: human content above marker preserved on second run', () => {
  withTempDir((dir) => {
    makeProject(dir);
    run(['--adapter', 'claude'], dir);
    const outPath = path.join(dir, 'CLAUDE.md');
    const existing = fs.readFileSync(outPath, 'utf8');
    fs.writeFileSync(outPath, '# Project conventions\n\nNo console.log in production.\n\n' + existing);
    run(['--adapter', 'claude'], dir);
    const final = fs.readFileSync(outPath, 'utf8');
    assert.ok(final.includes('# Project conventions'), 'human header must be preserved');
    assert.ok(final.includes('No console.log in production'), 'human body must be preserved');
    const count = countOccurrences(final, '# Code signatures');
    assert.strictEqual(count, 1, `expected 1 header, got ${count}`);
  });
});

// ── stripFormatHeader() unit tests ────────────────────────────────────────────

// Load the function directly — it's defined in gen-context.js but not exported,
// so we test its effect through the CLI integration tests above and verify the
// stripping logic independently here using the same pattern.
function stripFormatHeader(content) {
  if (!content || typeof content !== 'string') return content;
  const marker = '\n# Code signatures\n';
  const idx = content.indexOf(marker);
  if (idx === -1) return content;
  const afterMarker = content.slice(idx + marker.length);
  return afterMarker.startsWith('\n') ? afterMarker.slice(1) : afterMarker;
}

test('10. stripFormatHeader removes generated preamble, leaves body', () => {
  const input = [
    '<!-- Generated by SigMap gen-context.js v6.0.1 -->',
    '<!-- DO NOT EDIT below the marker line — run gen-context.js to regenerate -->',
    '',
    '# Code signatures',
    '',
    '## src',
    '',
    '### src/index.ts',
    '```',
    'export function greet(name)',
    '```',
  ].join('\n');

  const result = stripFormatHeader(input);
  assert.ok(!result.includes('<!-- Generated by SigMap'), 'preamble comment must be stripped');
  assert.ok(!result.includes('DO NOT EDIT'), 'DO NOT EDIT comment must be stripped');
  assert.ok(result.includes('## src'), '## src body must be preserved');
  assert.ok(result.includes('greet(name)'), 'signature must be preserved');
  assert.ok(!result.startsWith('# Code signatures'), 'header line itself must be stripped');
});

test('11. stripFormatHeader passthrough when no header present (raw body)', () => {
  const body = '## src\n\n### src/index.ts\n```\nexport function greet(name)\n```';
  assert.strictEqual(stripFormatHeader(body), body, 'raw body must pass through unchanged');
});

test('12. stripFormatHeader passthrough for empty / falsy input', () => {
  assert.strictEqual(stripFormatHeader(''), '', 'empty string');
  assert.strictEqual(stripFormatHeader(null), null, 'null');
  assert.strictEqual(stripFormatHeader(undefined), undefined, 'undefined');
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n--- no-duplicate-headers ---');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
