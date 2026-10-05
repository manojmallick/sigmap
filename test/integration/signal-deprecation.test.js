'use strict';

// Deprecated retrieval signals: the once-per-process notice from loadConfig, and the config reference that says which keys are going.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}

const tmpDirs = [];
const tmp = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); tmpDirs.push(d); return d; };
const project = (retrieval) => {
  const d = tmp('sigmap-deprecate-');
  fs.writeFileSync(path.join(d, 'gen-context.config.json'), JSON.stringify({ retrieval }));
  return d;
};

/** Run `fn` with console.warn captured; returns what it warned. */
function warned(fn) {
  const warnings = [];
  const warn = console.warn;
  console.warn = (m) => warnings.push(String(m));
  try { fn(); } finally { console.warn = warn; }
  return warnings;
}

(async () => {
  const { loadConfig } = require(path.join(ROOT, 'src/config/loader'));

  await test('a signal that earned no keep warns once per process when a config turns it on, and still works', () => {
    let cfg;
    const first = warned(() => { cfg = loadConfig(project({ centralityBlend: true })); });
    assert.strictEqual(cfg.retrieval.centralityBlend, true, 'a deprecated key is honoured until it is removed');
    assert.strictEqual(first.length, 1);
    assert.match(first[0], /retrieval\.centralityBlend is deprecated and will be removed in v9\.0/);
    assert.match(first[0], /sigmap\.io\/guide\/retrieval-benchmark/);

    const again = warned(() => { loadConfig(project({ centralityBlend: true })); loadConfig(project({ centralityBlend: true })); });
    assert.deepStrictEqual(again, [], 'once per process, not once per load');

    const other = warned(() => { loadConfig(project({ surfaceEnrichment: true })); });
    assert.strictEqual(other.length, 1);
    assert.match(other[0], /retrieval\.surfaceEnrichment is deprecated/);
  });

  await test('a signal that is switched off, or one that still earns its keep, never warns', () => {
    const all = warned(() => {
      loadConfig(project({ centralityBlend: false, surfaceEnrichment: false }));
      loadConfig(project({ minedExpansions: true, callGraphBoost: true, bodyWords: true }));
      loadConfig(tmp('sigmap-noconfig-'));
    });
    assert.deepStrictEqual(all.filter((w) => /deprecated/.test(w)), []);
  });

  await test('the config reference marks the deprecated keys, and only those', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'docs-vp/guide/config.md'), 'utf8');
    const row = (key) => doc.split('\n').find((l) => l.startsWith(`| \`${key}\``));
    for (const key of ['retrieval.centralityBlend', 'retrieval.surfaceEnrichment']) {
      assert.ok(row(key), `${key} must have a row in the config reference`);
      assert.match(row(key), /\*\*Deprecated\b/, `${key}'s row must say it is deprecated`);
      assert.match(row(key), /v9\.0/, `${key}'s row must say when it goes`);
    }
    for (const key of ['retrieval.minedExpansions', 'retrieval.callGraphBoost', 'retrieval.bodyWords']) {
      assert.ok(row(key), `${key} must have a row in the config reference`);
      assert.ok(!/\*\*Deprecated\b/.test(row(key)), `${key} is not deprecated`);
    }
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
