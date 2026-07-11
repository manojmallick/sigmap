'use strict';

/**
 * Integration tests for Evidence Pack schema v2 (#477).
 *
 * Covers: multi-factor risk labels (riskFactorsFor + files[].riskFactors),
 * the measured test-discovery provenance block and its guard against the
 * committed benchmark report, generator identity, structural conformance to
 * the published JSON Schema, and byte-stable determinism.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
  buildEvidencePack, riskFactorsFor, riskLabelFor,
  SCHEMA_VERSION, SCHEMA_URL, TEST_DISCOVERY,
} = require('../../src/evidence/pack');

const ROOT = path.resolve(__dirname, '../..');

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

function fixtureIndex() {
  return new Map([
    ['src/auth/login.js', ['function login(user, pass)  :1-9', 'function logout()  :11-14']],
    ['db/migrate/20240101_add_payments.rb', ['def change  :1-6']],
    ['src/util.js', ['function helper(x)  :1-3']],
    ['test/login.test.js', ['function run()  :1-5']],
  ]);
}

function buildPack(opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-ev2-'));
  try {
    return buildEvidencePack('login auth flow', dir, Object.assign({ sigIndex: fixtureIndex() }, opts));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── risk factors ────────────────────────────────────────────────────────────

test('riskFactorsFor returns every matched category in precedence order', () => {
  const factors = riskFactorsFor('db/migrate/20240101_add_payments.rb');
  assert.ok(factors.includes('migration') && factors.includes('payment'), JSON.stringify(factors));
  assert.strictEqual(factors[0], 'migration', 'precedence violated');
  assert.deepStrictEqual(riskFactorsFor('src/plain/thing.js'), ['source']);
});

test('riskLabelFor still equals the first factor (v1 compatibility)', () => {
  for (const p of ['db/migrate/20240101_add_payments.rb', 'src/auth/login.js', 'src/util.js', 'test/login.test.js']) {
    assert.strictEqual(riskLabelFor(p), riskFactorsFor(p)[0], p);
  }
});

test('pack files carry riskFactors with riskLabel as the first entry', () => {
  const pack = buildPack();
  const mig = pack.files.find((f) => f.path.includes('migrate'));
  if (mig) {
    assert.ok(Array.isArray(mig.riskFactors) && mig.riskFactors.length >= 2, JSON.stringify(mig.riskFactors));
    assert.strictEqual(mig.riskLabel, mig.riskFactors[0]);
  }
  for (const f of pack.files) {
    assert.ok(Array.isArray(f.riskFactors) && f.riskFactors.length >= 1, f.path);
    assert.strictEqual(f.riskLabel, f.riskFactors[0], f.path);
  }
});

// ── measured test-discovery provenance ──────────────────────────────────────

test('TEST_DISCOVERY constants match the committed benchmark report (guard)', () => {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/reports/test-discovery.json'), 'utf8'));
  assert.strictEqual(TEST_DISCOVERY.measured.f1, report.metrics.f1, 'f1 drifted — update TEST_DISCOVERY in src/evidence/pack.js');
  assert.strictEqual(TEST_DISCOVERY.measured.precision, report.metrics.precision, 'precision drifted');
  assert.strictEqual(TEST_DISCOVERY.measured.recall, report.metrics.recall, 'recall drifted');
  assert.strictEqual(TEST_DISCOVERY.measured.pairs, report.pairs, 'pairs drifted');
  assert.strictEqual(TEST_DISCOVERY.measured.repos, report.repos, 'repos drifted');
});

test('pack carries the testDiscovery provenance block', () => {
  const pack = buildPack();
  assert.strictEqual(pack.testDiscovery.method, 'stem-affix-match');
  assert.strictEqual(pack.testDiscovery.measured.f1, TEST_DISCOVERY.measured.f1);
  assert.ok(pack.testDiscovery.benchmark.includes('benchmark:test-discovery'));
});

// ── generator + schema ──────────────────────────────────────────────────────

test('generator carries the injected version, null without one', () => {
  assert.deepStrictEqual(buildPack({ version: '9.9.9' }).generator, { name: 'sigmap', version: '9.9.9' });
  assert.deepStrictEqual(buildPack().generator, { name: 'sigmap', version: null });
});

test('published schema exists and the pack structurally conforms', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs-vp/public/schemas/evidence-pack-2.json'), 'utf8'));
  assert.strictEqual(schema.$id, SCHEMA_URL);
  assert.strictEqual(schema.properties.schemaVersion.const, SCHEMA_VERSION);
  const pack = buildPack({ version: '1.2.3' });
  assert.strictEqual(pack.schemaVersion, '2.0');
  assert.strictEqual(pack.schemaUrl, SCHEMA_URL);
  for (const key of schema.required) {
    assert.ok(key in pack, `pack missing required key: ${key}`);
  }
  const fileRequired = schema.properties.files.items.required;
  for (const f of pack.files) {
    for (const key of fileRequired) assert.ok(key in f, `file entry missing: ${key}`);
    for (const r of f.riskFactors) assert.ok(schema.definitions.riskCategory.enum.includes(r), `unknown risk: ${r}`);
  }
  assert.ok(/^sha256:[0-9a-f]{64}$/.test(pack.grounding.contextHash));
});

test('pack is byte-stable: two builds are deep-equal with identical hashes', () => {
  const a = buildPack({ version: '1.2.3' });
  const b = buildPack({ version: '1.2.3' });
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.grounding.contextHash, b.grounding.contextHash);
});

console.log(`\nevidence-pack-v2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
