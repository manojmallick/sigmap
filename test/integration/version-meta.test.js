'use strict';

/**
 * version.json metadata gate (scripts/check-version-meta.mjs).
 * Ensures derived counts (languages, extractors, mcp_tools, tests) stay in sync
 * with source via scripts/lib/source-meta.mjs (Trust Hygiene H3).
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

/** Build a minimal hermetic repo for drift testing. */
function makeFakeRepo(versionMeta) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-vmeta-'));
  fs.mkdirSync(path.join(dir, 'src', 'mcp'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'extractors'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
  // 3 extractor modules, one of which is a helper → 2 languages, 3 extractors.
  fs.writeFileSync(path.join(dir, 'src', 'extractors', 'javascript.js'), '// js\n');
  fs.writeFileSync(path.join(dir, 'src', 'extractors', 'python.js'), '// py\n');
  fs.writeFileSync(path.join(dir, 'src', 'extractors', 'line-anchor.js'), '// helper\n');
  fs.writeFileSync(path.join(dir, 'src', 'mcp', 'tools.js'),
    'module.exports = { TOOLS: [{name:"a"},{name:"b"}] };\n');
  fs.writeFileSync(path.join(dir, 'test', 'x.test.js'), '// test\n');
  fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify(versionMeta, null, 2));
  return dir;
}

(async () => {
  const mod = await import('url').then((u) => import(u.pathToFileURL(SCRIPT).href));
  const { computeMeta, findMetaDrift } = mod;

  test('computeMeta: mcp_tools matches TOOLS length', () => {
    const { TOOLS } = require(path.join(ROOT, 'src/mcp/tools.js'));
    assert.strictEqual(computeMeta(ROOT).mcp_tools, TOOLS.length);
  });

  test('computeMeta: derives languages, extractors, tests as positive ints', () => {
    const m = computeMeta(ROOT);
    for (const k of ['languages', 'extractors', 'tests']) {
      assert.ok(Number.isInteger(m[k]) && m[k] > 0, `${k}=${m[k]}`);
    }
    assert.ok(m.extractors >= m.languages, 'extractors >= languages (helpers included)');
  });

  test('version.json is in sync (no drift) on the committed repo', () => {
    assert.deepStrictEqual(findMetaDrift(ROOT), []);
  });

  test('CLI: check passes (exit 0) on the current repo', () => {
    const out = execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
    assert.ok(/metadata current/.test(out), out);
  });

  test('languages is now DERIVED (in the gated set), not editorial', () => {
    assert.ok(computeMeta(ROOT).languages > 0);
    const dir = makeFakeRepo({ version: '1.0.0', languages: 99, extractors: 3, mcp_tools: 2, tests: 1 });
    try {
      const drift = findMetaDrift(dir);
      assert.deepStrictEqual(drift.map((d) => d.field), ['languages']);
      assert.strictEqual(drift[0].expected, 2); // javascript + python, helper excluded
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('findMetaDrift: detects tampered mcp_tools (hermetic temp root)', () => {
    const dir = makeFakeRepo({ version: '1.0.0', languages: 2, extractors: 3, mcp_tools: 99, tests: 1 });
    try {
      const drift = findMetaDrift(dir);
      assert.deepStrictEqual(drift.map((d) => d.field), ['mcp_tools']);
      assert.strictEqual(drift[0].expected, 2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('findMetaDrift: detects tampered extractors (hermetic temp root)', () => {
    const dir = makeFakeRepo({ version: '1.0.0', languages: 2, extractors: 999, mcp_tools: 2, tests: 1 });
    try {
      const drift = findMetaDrift(dir);
      assert.deepStrictEqual(drift.map((d) => d.field), ['extractors']);
      assert.strictEqual(drift[0].expected, 3);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  console.log(`\nversion-meta: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
