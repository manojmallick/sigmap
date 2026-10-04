'use strict';

/**
 * Bundle integrity check (scripts/check-bundle.mjs).
 * Guards the gap that broke the v7.1.0 binaries: a src/ module not registered
 * in gen-context.js __factories. Run: node test/integration/bundle-integrity.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-bundle.mjs');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

(async () => {
  const mod = await import('url').then((u) => import(u.pathToFileURL(SCRIPT).href));
  const { findMissingFactories, generateFactory } = mod;

  // ── current bundle is in sync (acceptance: passes on current) ──────────────
  test('findMissingFactories: real bundle has no missing src/ modules', () => {
    assert.deepStrictEqual(findMissingFactories(ROOT), []);
  });

  test('CLI: check passes (exit 0) on the current repo', () => {
    const out = execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
    assert.ok(/all src\/ modules present/.test(out), out);
  });

  // ── detects a missing module (hermetic temp root) ──────────────────────────
  test('findMissingFactories: detects a src/ module absent from __factories', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-bundle-'));
    try {
      fs.mkdirSync(path.join(dir, 'src', 'sub'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'module.exports={};\n');
      fs.writeFileSync(path.join(dir, 'src', 'sub', 'b.js'), 'module.exports={};\n');
      // bundle registers only a, not sub/b
      fs.writeFileSync(path.join(dir, 'gen-context.js'),
        '__factories["./src/a"] = function(module, exports) {};\n');
      const missing = findMissingFactories(dir);
      assert.deepStrictEqual(missing, ['./src/sub/b']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ── generated factory is loadable + rewrites local requires (--fix output) ──
  test('generateFactory: produces a working factory with __require rewrites', () => {
    // aggregate requires ./pricing, and both read the model profile — all
    // three must load via the bundle harness.
    const harness = `
      const __factories = {}; const __cache = {};
      function __require(key){
        if (__cache[key]) return __cache[key].exports;
        const m = { exports: {} }; __cache[key] = m; __factories[key](m, m.exports);
        return m.exports;
      }
      ${generateFactory('./src/config/models')}
      ${generateFactory('./src/tracking/pricing')}
      ${generateFactory('./src/tracking/aggregate')}
      module.exports = __require('./src/tracking/aggregate');
    `;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-fac-'));
    try {
      const f = path.join(dir, 'harness.js');
      fs.writeFileSync(f, harness);
      const agg = require(f);
      assert.strictEqual(typeof agg.aggregate, 'function', 'aggregate export missing');
      // exercise it — proves __require('./pricing') rewrite resolved
      const out = agg.aggregate([{ ts: '2026-01-01T00:00:00Z', op: 'ask', baselineTokens: 100, actualTokens: 10 }]);
      assert.strictEqual(out.totals.saved, 90);
      assert.ok(out.price && out.price.perMtok > 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  console.log(`\nbundle-integrity: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
