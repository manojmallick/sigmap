'use strict';

const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
const codex = require(path.join(ROOT, 'packages', 'adapters', 'codex'));

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

const SAMPLE_CONTEXT = `## src\n\n### src/auth/service.ts\n\`\`\`\nexport class AuthService\n  login(user, pass)\n\`\`\``;

// Issue #96: no verbose LLM preamble in AGENTS.md output
test('format does not include "You are a coding assistant" preamble', () => {
  const out = codex.format(SAMPLE_CONTEXT);
  assert.ok(!out.includes('You are a coding assistant'), `preamble should be absent:\n${out.slice(0, 200)}`);
});

test('format does not include HTML comment metadata block', () => {
  const out = codex.format(SAMPLE_CONTEXT);
  assert.ok(!out.includes('<!-- sigmap:'), `HTML comment metadata should be absent:\n${out.slice(0, 200)}`);
});

test('format does not include "Use these signatures to answer questions" boilerplate', () => {
  const out = codex.format(SAMPLE_CONTEXT);
  assert.ok(!out.includes('Use these signatures to answer'), `boilerplate should be absent`);
});

test('format starts with single # Code signatures header', () => {
  const out = codex.format(SAMPLE_CONTEXT);
  assert.ok(out.startsWith('# Code signatures'), `should start with "# Code signatures" but got:\n${out.slice(0, 100)}`);
});

test('format does not produce duplicate headers', () => {
  const out = codex.format(SAMPLE_CONTEXT);
  const headerCount = (out.match(/^#\s+Code\s+[Ss]ignatures/gm) || []).length;
  assert.strictEqual(headerCount, 1, `expected 1 header, got ${headerCount}`);
});

test('format includes the context content', () => {
  const out = codex.format(SAMPLE_CONTEXT);
  assert.ok(out.includes('AuthService'), 'context body should be present');
  assert.ok(out.includes('login('), 'context body should be present');
});

test('format returns empty string for falsy input', () => {
  assert.strictEqual(codex.format(''), '');
  assert.strictEqual(codex.format(null), '');
  assert.strictEqual(codex.format(undefined), '');
});

test('outputPath returns AGENTS.md', () => {
  const p = codex.outputPath('/tmp/myproject');
  assert.ok(p.endsWith('AGENTS.md'), `expected AGENTS.md, got ${p}`);
});

console.log('\n--- codex-adapter-format ---');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
