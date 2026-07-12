'use strict';

/**
 * Integration tests for route surface-enrichment (#488, opt-in).
 *
 * Covers: collectRoutes rows + unchanged analyze markdown, pseudo-signature
 * enrichment (deterministic, copy-on-write), retrieval effect on a
 * route-worded query, and the config-gated --query wiring (off by default).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const GEN_CONTEXT = path.resolve(__dirname, '../../gen-context.js');
const { collectRoutes, analyze } = require('../../src/map/route-table');
const { enrichWithSurfaces } = require('../../src/retrieval/enrich-from-maps');
const { rank, buildSigIndex } = require('../../src/retrieval/ranker');

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

/** Express-style fixture: webhook route lives in a file whose sigs never say "webhook". */
function withProject(fn, config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-surface-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'controller.js'), [
      "const app = require('./app');",
      'function handlePayment(req, res) {',
      '  res.send(1);',
      '}',
      "app.post('/api/payments/webhook', handlePayment);",
      'module.exports = { handlePayment };',
      '',
    ].join('\n'));
    fs.writeFileSync(path.join(dir, 'src', 'other.js'), [
      'function webhookHelper(x) {',
      '  return x;',
      '}',
      'module.exports = { webhookHelper };',
      '',
    ].join('\n'));
    if (config) fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(config, null, 2));
    const gen = spawnSync(process.execPath, [GEN_CONTEXT], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(gen.status, 0, gen.stderr);
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('collectRoutes returns rows and analyze markdown is unchanged', () => {
  withProject((dir) => {
    const files = [path.join(dir, 'src', 'controller.js'), path.join(dir, 'src', 'other.js')];
    const rows = collectRoutes(files, dir);
    assert.deepStrictEqual(rows, [{ method: 'POST', path: '/api/payments/webhook', file: 'src/controller.js' }]);
    const md = analyze(files, dir);
    assert.ok(md.startsWith('| Method | Path | File |'), md.slice(0, 40));
    assert.ok(md.includes('| POST | /api/payments/webhook | src/controller.js |'), md);
  });
});

test('enrichWithSurfaces adds the route pseudo-sig copy-on-write and deterministically', () => {
  withProject((dir) => {
    const index = buildSigIndex(dir);
    const original = index.get('src/controller.js');
    const before = [...original];
    const added = enrichWithSurfaces(index, dir);
    assert.strictEqual(added, 1);
    assert.ok(index.get('src/controller.js').includes('route POST /api/payments/webhook'));
    assert.deepStrictEqual(original, before, 'cached array was mutated');
    // idempotent + deterministic across a second pass on a fresh index
    const index2 = buildSigIndex(dir);
    enrichWithSurfaces(index2, dir);
    assert.deepStrictEqual(index.get('src/controller.js'), index2.get('src/controller.js'));
    assert.strictEqual(enrichWithSurfaces(index, dir), 0, 'second enrichment should add nothing');
  });
});

test('a route-worded query retrieves the controller only with enrichment', () => {
  withProject((dir) => {
    const query = 'payments webhook route endpoint';
    const plain = rank(query, buildSigIndex(dir), { topK: 2, cwd: dir });
    const enriched = buildSigIndex(dir);
    enrichWithSurfaces(enriched, dir);
    const boosted = rank(query, enriched, { topK: 2, cwd: dir });
    const plainTop = plain[0] && plain[0].file;
    const boostedTop = boosted[0] && boosted[0].file;
    assert.strictEqual(boostedTop, 'src/controller.js', `enriched top: ${boostedTop}`);
    const plainScore = (plain.find((r) => r.file === 'src/controller.js') || { score: 0 }).score;
    const boostedScore = boosted.find((r) => r.file === 'src/controller.js').score;
    assert.ok(boostedScore > plainScore, `score did not improve (${plainScore} → ${boostedScore}); plain top: ${plainTop}`);
  });
});

test('--query: route pseudo-sig appears only with retrieval.surfaceEnrichment on', () => {
  withProject((dir) => {
    const off = spawnSync(process.execPath, [GEN_CONTEXT, '--query', 'payments webhook route', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(off.status, 0, off.stderr);
    assert.ok(!off.stdout.includes('route POST'), 'enrichment active without config');
  });
  withProject((dir) => {
    const on = spawnSync(process.execPath, [GEN_CONTEXT, '--query', 'payments webhook route', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(on.status, 0, on.stderr);
    assert.ok(on.stdout.includes('route POST /api/payments/webhook'), 'pseudo-sig missing with config on');
  }, { retrieval: { surfaceEnrichment: true } });
});

console.log(`\nsurface-enrichment: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
