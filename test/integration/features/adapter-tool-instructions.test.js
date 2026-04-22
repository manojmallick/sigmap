'use strict';

/**
 * Tests for v6.1.0 Level 1: tool instructions in every adapter.
 * Each adapter's format() must include native-format sigmap tool instructions.
 *
 * Adapters tested:
 *  1–3   copilot  — markdown table with sigmap commands
 *  4–6   claude   — bullet list with sigmap commands
 *  7–9   cursor   — # comment lines with sigmap commands
 * 10–12  windsurf — # comment lines with sigmap commands
 * 13–15  openai   — instruction sentence in preamble
 * 16–18  gemini   — instruction sentence in preamble
 * 19–21  codex    — markdown table + always-run line
 */

const path   = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');

function loadAdapter(name) {
  return require(path.join(ROOT, 'packages', 'adapters', name));
}

const CTX = `## src\n\n### src/api/routes.ts\n\`\`\`\nexport function getUsers(req, res)\nexport function createUser(req, res)\n\`\`\``;

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

// ── copilot ───────────────────────────────────────────────────────────────────

const copilot = loadAdapter('copilot');

test('1. copilot: format() includes SigMap commands header', () => {
  const out = copilot.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('## SigMap commands'), `missing header:\n${out.slice(0, 400)}`);
});

test('2. copilot: format() includes sigmap ask command', () => {
  const out = copilot.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap ask'), `missing sigmap ask:\n${out.slice(0, 400)}`);
});

test('3. copilot: format() includes sigmap validate command', () => {
  const out = copilot.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap validate'), `missing sigmap validate:\n${out.slice(0, 400)}`);
});

// ── claude ────────────────────────────────────────────────────────────────────

const claude = loadAdapter('claude');

test('4. claude: format() includes SigMap section header', () => {
  const out = claude.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('## SigMap'), `missing ## SigMap:\n${out.slice(0, 400)}`);
});

test('5. claude: format() includes sigmap ask in bullet list', () => {
  const out = claude.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap ask'), `missing sigmap ask:\n${out.slice(0, 400)}`);
});

test('6. claude: format() includes sigmap validate in bullet list', () => {
  const out = claude.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap validate'), `missing sigmap validate:\n${out.slice(0, 400)}`);
});

// ── cursor ────────────────────────────────────────────────────────────────────

const cursor = loadAdapter('cursor');

test('7. cursor: format() includes # SigMap comment line', () => {
  const out = cursor.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('# SigMap:'), `missing # SigMap: comment:\n${out.slice(0, 400)}`);
});

test('8. cursor: format() includes sigmap ask in comment', () => {
  const out = cursor.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap ask'), `missing sigmap ask:\n${out.slice(0, 400)}`);
});

test('9. cursor: format() includes sigmap validate in comment', () => {
  const out = cursor.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap validate'), `missing sigmap validate:\n${out.slice(0, 400)}`);
});

// ── windsurf ──────────────────────────────────────────────────────────────────

const windsurf = loadAdapter('windsurf');

test('10. windsurf: format() includes # SigMap comment line', () => {
  const out = windsurf.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('# SigMap:'), `missing # SigMap: comment:\n${out.slice(0, 400)}`);
});

test('11. windsurf: format() includes sigmap ask in comment', () => {
  const out = windsurf.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap ask'), `missing sigmap ask:\n${out.slice(0, 400)}`);
});

test('12. windsurf: format() includes sigmap validate in comment', () => {
  const out = windsurf.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap validate'), `missing sigmap validate:\n${out.slice(0, 400)}`);
});

// ── openai ────────────────────────────────────────────────────────────────────

const openai = loadAdapter('openai');

test('13. openai: format() includes sigmap ask instruction', () => {
  const out = openai.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap ask'), `missing sigmap ask:\n${out.slice(0, 500)}`);
});

test('14. openai: format() includes sigmap validate instruction', () => {
  const out = openai.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap validate'), `missing sigmap validate:\n${out.slice(0, 500)}`);
});

test('15. openai: format() still contains standard preamble', () => {
  const out = openai.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('You are a coding assistant'), 'preamble must be present');
  assert.ok(out.includes('## Code Signatures'), 'Code Signatures header must be present');
});

// ── gemini ────────────────────────────────────────────────────────────────────

const gemini = loadAdapter('gemini');

test('16. gemini: format() includes sigmap ask instruction', () => {
  const out = gemini.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap ask'), `missing sigmap ask:\n${out.slice(0, 500)}`);
});

test('17. gemini: format() includes sigmap validate instruction', () => {
  const out = gemini.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('sigmap validate'), `missing sigmap validate:\n${out.slice(0, 500)}`);
});

test('18. gemini: format() still contains standard preamble', () => {
  const out = gemini.format(CTX, { version: '6.1.0' });
  assert.ok(out.includes('You are a coding assistant'), 'preamble must be present');
  assert.ok(out.includes('## Code Signatures'), 'Code Signatures header must be present');
});

// ── codex ─────────────────────────────────────────────────────────────────────

const codex = loadAdapter('codex');

test('19. codex: format() includes SigMap commands table', () => {
  const out = codex.format(CTX);
  assert.ok(out.includes('## SigMap commands'), `missing ## SigMap commands:\n${out.slice(0, 400)}`);
});

test('20. codex: format() includes sigmap ask in table', () => {
  const out = codex.format(CTX);
  assert.ok(out.includes('sigmap ask'), `missing sigmap ask:\n${out.slice(0, 400)}`);
});

test('21. codex: format() includes always-run instruction', () => {
  const out = codex.format(CTX);
  assert.ok(out.includes('Always run'), `missing always-run line:\n${out.slice(0, 400)}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n--- adapter-tool-instructions ---');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
