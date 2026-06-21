'use strict';

/**
 * Documented-surface gate (Trust Hygiene H4).
 * The CLI `--help`, README MCP count, and README adapter table must match the
 * real shipped surface so the docs can never silently undersell it again.
 * Run: node test/integration/surface-docs.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const { TOOLS } = require(path.join(ROOT, 'src/mcp/tools.js'));
const { listAdapters } = require(path.join(ROOT, 'packages/adapters/index.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const help = execFileSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--help'], { encoding: 'utf8' });

// The grounded-creation pipeline + conventions — wired commands that were
// previously absent from --help.
const COMMANDS = ['conventions', 'scaffold', 'verify-plan', 'review-pr', 'create'];

for (const cmd of COMMANDS) {
  test(`--help lists "${cmd}"`, () => {
    const re = new RegExp(`(sigmap|gen-context)\\s+${cmd}\\b`);
    assert.ok(re.test(help), `"${cmd}" not found in --help command list`);
  });
}

test('README documents every grounded-creation command', () => {
  for (const cmd of COMMANDS) {
    assert.ok(README.includes(`sigmap ${cmd}`), `README missing "sigmap ${cmd}"`);
  }
});

test('README states the real MCP tool count (derived from TOOLS)', () => {
  assert.ok(README.includes(`${TOOLS.length} on-demand tools`),
    `README must say "${TOOLS.length} on-demand tools" (TOOLS has ${TOOLS.length})`);
});

test('README does not undercount MCP tools (no stale "10 on-demand tools")', () => {
  // Guard the specific stale claim this gate was created to fix.
  if (TOOLS.length !== 10) {
    assert.ok(!README.includes('10 on-demand tools'), 'stale "10 on-demand tools" still in README');
  }
});

test('README adapter table lists every registered adapter', () => {
  for (const name of listAdapters()) {
    assert.ok(README.includes('`' + name + '`'), `README missing adapter \`${name}\``);
  }
});

console.log(`\nsurface-docs: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
