'use strict';

/**
 * Reproducible bundle build (scripts/build-bundle.mjs) — Trust Hygiene H2.
 * The committed gen-context.js must equal a fresh build of its __factories from
 * src/ — no drift, no duplicates, CLI core preserved.
 * Run: node test/integration/bundle-repro.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts', 'build-bundle.mjs');
const BUNDLE = fs.readFileSync(path.join(ROOT, 'gen-context.js'), 'utf8');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

(async () => {
  const mod = await import('url').then((u) => import(u.pathToFileURL(SCRIPT).href));
  const { buildBundle, bundleInSync, bundledModuleKeys, START_MARKER, END_MARKER } = mod;

  test('committed gen-context.js is reproducible from src/ (byte-for-byte)', () => {
    assert.strictEqual(BUNDLE, buildBundle(ROOT));
    assert.strictEqual(bundleInSync(ROOT), true);
  });

  test('bundled-modules section is bounded by both markers', () => {
    assert.ok(BUNDLE.includes(START_MARKER), 'missing START marker');
    assert.ok(BUNDLE.includes(END_MARKER), 'missing END marker');
    assert.ok(BUNDLE.indexOf(START_MARKER) < BUNDLE.indexOf(END_MARKER), 'markers out of order');
  });

  test('module keys are sorted, unique, and cover src/ + packages/adapters/', () => {
    const keys = bundledModuleKeys(ROOT);
    assert.deepStrictEqual(keys, [...keys].sort(), 'keys not sorted');
    assert.strictEqual(keys.length, new Set(keys).size, 'duplicate keys');
    // count must equal the number of .js files under src/ + packages/adapters/
    let n = 0;
    const countJs = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) countJs(f); else if (e.name.endsWith('.js')) n++;
      }
    };
    countJs(path.join(ROOT, 'src'));
    countJs(path.join(ROOT, 'packages', 'adapters'));
    assert.strictEqual(keys.length, n, `keys=${keys.length} vs bundled .js files=${n}`);
    // every adapter (incl. willow) is embedded
    assert.ok(keys.includes('./packages/adapters/copilot'), 'copilot adapter not embedded');
    assert.ok(keys.includes('./packages/adapters/willow'), 'willow adapter not embedded');
  });

  test('no duplicate __factories block in the committed bundle', () => {
    const decls = BUNDLE.match(/^__factories\["[^"]+"\]/gm) || [];
    assert.strictEqual(decls.length, new Set(decls).size, 'duplicate factory block present');
    assert.strictEqual(decls.length, bundledModuleKeys(ROOT).length, 'factory count != module count');
  });

  test('CLI core (after END marker) is preserved and the bundle still boots', () => {
    const tail = BUNDLE.slice(BUNDLE.indexOf(END_MARKER));
    assert.ok(tail.includes("const fs = require('fs');"), 'CLI core requires missing');
    assert.ok(/main\(\);\s*$/.test(BUNDLE.trimEnd() + '\n') || tail.includes('main();'), 'CLI entrypoint missing');
    const ver = execFileSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--version'], { encoding: 'utf8' }).trim();
    assert.ok(/^\d+\.\d+\.\d+$/.test(ver), `--version output: ${ver}`);
  });

  test('CLI --check passes (exit 0) on the committed repo', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--check'], { cwd: ROOT, encoding: 'utf8' });
    assert.ok(/reproducible from src\//.test(out), out);
  });

  console.log(`\nbundle-repro: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
