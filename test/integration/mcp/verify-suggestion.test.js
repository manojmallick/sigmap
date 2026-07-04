'use strict';

/**
 * MCP tool: verify_suggestion (v8.2.0 — exposes the G5/D5 grounding moat to agents).
 *
 * Covers:
 *   - registered in TOOLS with a required `code` input
 *   - dirty code → fake symbols flagged, real installed-library calls NOT flagged
 *   - clean code → clean verdict
 *   - D8: reports the installed libraries verified against, with pinned versions
 *   - missing/empty code → graceful usage message (no crash)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '../../..');
const { TOOLS } = require(path.join(ROOT, 'src', 'mcp', 'tools'));
const { verifySuggestion } = require(path.join(ROOT, 'src', 'mcp', 'handlers'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}

/** Temp project with an installed typed dependency. */
function withProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-vs-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'proj', dependencies: { acme: '^1' } }));
    const lib = path.join(dir, 'node_modules', 'acme');
    fs.mkdirSync(lib, { recursive: true });
    fs.writeFileSync(path.join(lib, 'package.json'), JSON.stringify({ name: 'acme', version: '4.19.2', types: 'index.d.ts' }));
    fs.writeFileSync(path.join(lib, 'index.d.ts'), 'export class Router {}\nexport declare function debounce(fn: any): any;');
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('\nverify_suggestion MCP tool tests\n');

test('verify_suggestion is registered in TOOLS with a required `code` input', () => {
  const tool = TOOLS.find((t) => t.name === 'verify_suggestion');
  assert.ok(tool, 'verify_suggestion not in TOOLS');
  assert.ok(tool.description && /installed|librar/i.test(tool.description), 'description should mention installed libraries');
  assert.deepStrictEqual(tool.inputSchema.required, ['code']);
  assert.ok(tool.inputSchema.properties.code, 'code property missing');
});

test('dirty code: fake symbol flagged, real installed-library call NOT flagged', () => {
  withProject((dir) => {
    const out = verifySuggestion({ code: 'Use `Router()` and `notReal()` from acme.' }, dir);
    assert.ok(/✗/.test(out), 'should report a verdict of issues');
    assert.ok(/notReal/.test(out), 'the fake symbol should be flagged');
    assert.ok(!/fake-symbol\]\s+Symbol not found in repo index: Router/.test(out), 'real library call Router must not be flagged');
  });
});

test('clean code (only real library calls) → clean verdict', () => {
  withProject((dir) => {
    const out = verifySuggestion({ code: 'Use `Router()` and `debounce(fn)`.' }, dir);
    assert.ok(/✓ Grounded/.test(out), `expected clean verdict, got: ${out}`);
  });
});

test('D8: reports installed libraries verified against, with pinned versions', () => {
  withProject((dir) => {
    const out = verifySuggestion({ code: 'Use `Router()`.' }, dir);
    assert.ok(/1 installed library/.test(out), 'should report the installed-library count');
    assert.ok(/acme@4\.19\.2/.test(out), 'should pin the library version (D8)');
  });
});

test('missing / empty code → graceful usage message', () => {
  withProject((dir) => {
    assert.ok(/Usage: verify_suggestion/.test(verifySuggestion({}, dir)));
    assert.ok(/Usage: verify_suggestion/.test(verifySuggestion({ code: '   ' }, dir)));
  });
});

console.log(`\nverify_suggestion: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
