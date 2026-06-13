'use strict';

/**
 * Tool-instruction guidance in adapters (originally v6.1.0; reworked in v7.0 / #239).
 *
 * The canonical "## SigMap commands" guidance block is now emitted ONCE from
 * `formatOutput()` (the single content source every writer consumes), instead
 * of each adapter inventing its own divergent variant (markdown table vs.
 * bullets vs. `#` comments vs. prose). This file asserts the new contract:
 *
 *   - adapters no longer embed their own bespoke guidance in format()
 *   - the canonical block still reaches every generated file (full-pipeline
 *     verification lives in test/integration/context-consistency.test.js)
 */

const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
function loadAdapter(name) { return require(path.join(ROOT, 'packages', 'adapters', name)); }

const CTX = '## src\n\n### src/api/routes.ts\n```\nexport function getUsers(req, res)\n```';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}

// Stale per-adapter guidance strings that must NOT reappear in format() output —
// they would mean an adapter went back to inventing its own divergent block.
const STALE = {
  claude: ['## SigMap\n', '- Before searching for files'],
  cursor: ['# SigMap: before answering'],
  windsurf: ['# SigMap: before answering'],
  gemini: ['suggest running `sigmap ask'],
  openai: ['prefer running `sigmap ask'],
  codex: ['<!-- sigmap-tools -->', '"sigmap_ask"'],
};

for (const [name, markers] of Object.entries(STALE)) {
  test(`${name}: format() no longer embeds bespoke guidance`, () => {
    const out = loadAdapter(name).format(CTX, { version: '7.0.0' });
    for (const m of markers) {
      assert.ok(!out.includes(m), `${name} format() still contains stale marker: ${JSON.stringify(m)}`);
    }
  });
}

test('usage-guidance module exposes one canonical SigMap commands table', () => {
  const { usageBlock } = require(path.join(ROOT, 'src', 'format', 'usage-guidance'));
  const block = usageBlock();
  assert.ok(/## SigMap commands/.test(block), 'heading missing');
  assert.ok(/`sigmap ask "<your question>"`/.test(block), 'ask command missing');
  assert.ok(/`sigmap validate`/.test(block), 'validate command missing');
});

console.log(`\nadapter-tool-instructions: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
