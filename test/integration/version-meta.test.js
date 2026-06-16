'use strict';

/**
 * version.json metadata gate (scripts/check-version-meta.mjs).
 * Ensures derived counts (mcp_tools, tests) stay in sync with source.
 * Run: node test/integration/version-meta.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-version-meta.mjs');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

(async () => {
  const mod = await import('url').then((u) => import(u.pathToFileURL(SCRIPT).href));
  const { computeMeta, findMetaDrift } = mod;

  test('computeMeta: mcp_tools matches TOOLS length', () => {
    const { TOOLS } = require(path.join(ROOT, 'src/mcp/tools.js'));
    assert.strictEqual(computeMeta(ROOT).mcp_tools, TOOLS.length);
  });

  test('computeMeta: tests count is a positive integer', () => {
    const { tests } = computeMeta(ROOT);
    assert.ok(Number.isInteger(tests) && tests > 0, `tests=${tests}`);
  });

  test('version.json is in sync (no drift) on the committed repo', () => {
    assert.deepStrictEqual(findMetaDrift(ROOT), []);
  });

  test('CLI: check passes (exit 0) on the current repo', () => {
    const out = execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
    assert.ok(/metadata current/.test(out), out);
  });

  test('findMetaDrift: detects a tampered version.json (hermetic temp root)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-vmeta-'));
    try {
      // minimal fake repo: src/mcp/tools.js with 2 tools, one test file
      fs.mkdirSync(path.join(dir, 'src', 'mcp'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'src', 'mcp', 'tools.js'),
        'module.exports = { TOOLS: [{name:"a"},{name:"b"}] };\n');
      fs.writeFileSync(path.join(dir, 'test', 'x.test.js'), '// test\n');
      fs.writeFileSync(path.join(dir, 'version.json'),
        JSON.stringify({ version: '1.0.0', mcp_tools: 99, tests: 1, languages: 31 }, null, 2));
      const drift = findMetaDrift(dir);
      const fields = drift.map((d) => d.field).sort();
      assert.deepStrictEqual(fields, ['mcp_tools']); // tests=1 matches, mcp_tools 99≠2
      assert.strictEqual(drift[0].expected, 2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('languages is left editorial (not in derived drift set)', () => {
    const drift = findMetaDrift(ROOT);
    assert.ok(!drift.some((d) => d.field === 'languages'));
  });

  console.log(`\nversion-meta: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
