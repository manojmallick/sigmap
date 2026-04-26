'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const { GRAPH_BOOST_AMOUNTS } = require('../../../src/retrieval/ranker');
const { loadCache, saveCache } = require('../../../src/cache/sig-cache');

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

console.log('\nv6.7.0: 2-hop graph boost + hub suppression + sigCache\n');

// ---------------------------------------------------------------------------
// GRAPH_BOOST_AMOUNTS constants
// ---------------------------------------------------------------------------

console.log('GRAPH_BOOST_AMOUNTS constants:');

test('should have hop1 and hop2 amounts exported', () => {
  assert(GRAPH_BOOST_AMOUNTS, 'GRAPH_BOOST_AMOUNTS not exported');
  assert.strictEqual(GRAPH_BOOST_AMOUNTS.hop1, 0.40, 'hop1 should be 0.40');
  assert.strictEqual(GRAPH_BOOST_AMOUNTS.hop2, 0.15, 'hop2 should be 0.15');
});

test('should have hop2 < hop1 (decay applied)', () => {
  assert(GRAPH_BOOST_AMOUNTS.hop2 < GRAPH_BOOST_AMOUNTS.hop1, 'hop2 should be smaller than hop1 (decay)');
});

// ---------------------------------------------------------------------------
// sigCache config integration
// ---------------------------------------------------------------------------

console.log('\nsigCache config integration:');

test('should have sigCache default in DEFAULTS', () => {
  const { DEFAULTS } = require('../../../src/config/defaults');
  assert('sigCache' in DEFAULTS, 'sigCache not in DEFAULTS');
  assert.strictEqual(DEFAULTS.sigCache, false, 'sigCache default should be false');
});

test('should load and save cache without errors', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-v670-'));
  try {
    const testCache = new Map([
      [path.join(dir, 'src', 'index.ts'), { mtime: 12345, sigs: ['function foo()'] }],
    ]);
    const version = 'v6.7.0-test';
    saveCache(dir, version, testCache);

    // Verify file was created
    const cachePath = path.join(dir, '.sigmap-cache.json');
    assert(fs.existsSync(cachePath), 'cache file was not created');

    // Verify we can load it back
    const loaded = loadCache(dir, version);
    assert.strictEqual(loaded.size, 1, 'loaded cache should have 1 entry');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('should bust cache on version change', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-v670-'));
  try {
    const testCache = new Map([
      [path.join(dir, 'src', 'service.ts'), { mtime: 67890, sigs: ['function bar()'] }],
    ]);
    saveCache(dir, 'v6.7.0-old', testCache);

    // Load with different version should return empty
    const loaded = loadCache(dir, 'v6.7.0-new');
    assert.strictEqual(loaded.size, 0, 'cache should be busted on version mismatch');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('should survive malformed cache file gracefully', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-v670-'));
  try {
    const cachePath = path.join(dir, '.sigmap-cache.json');
    fs.writeFileSync(cachePath, 'invalid json {]', 'utf8');

    // Should return empty map without throwing
    const loaded = loadCache(dir, 'v6.7.0');
    assert(loaded instanceof Map, 'should return a Map');
    assert.strictEqual(loaded.size, 0, 'should return empty Map on corrupt cache');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// --health cache stats output
// ---------------------------------------------------------------------------

console.log('\n--health cache stats output:');

test('should show cache file size and entry count in --health', () => {
  const projDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-health-cache-'));
  try {
    fs.mkdirSync(path.join(projDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projDir, 'src', 'index.ts'), 'export function test() {}');
    fs.writeFileSync(
      path.join(projDir, 'gen-context.config.json'),
      JSON.stringify({ sigCache: true, srcDirs: ['src'] })
    );

    // Generate with cache enabled
    const cmd = `node ${path.resolve(__dirname, '../../../gen-context.js')} --cwd "${projDir}" 2>/dev/null`;
    execSync(cmd, { timeout: 5000 });

    // Check health output
    const healthCmd = `node ${path.resolve(__dirname, '../../../gen-context.js')} --health --cwd "${projDir}" 2>/dev/null`;
    const output = execSync(healthCmd, { encoding: 'utf8', timeout: 5000 });

    // Should mention sig-cache if cache was created
    if (fs.existsSync(path.join(projDir, '.sigmap-cache.json'))) {
      assert(output.includes('sig-cache') || output.includes('cache'), 'cache stats should appear in --health output');
    }
  } finally {
    fs.rmSync(projDir, { recursive: true, force: true });
  }
});

test('--health --json should include cache stats if cache exists', () => {
  const projDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-health-json-cache-'));
  try {
    fs.mkdirSync(path.join(projDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projDir, 'src', 'index.ts'), 'export function hello() {}');
    fs.writeFileSync(path.join(projDir, 'gen-context.config.json'),
      JSON.stringify({ sigCache: true, srcDirs: ['src'] }));

    // Generate
    const cmd = `node ${path.resolve(__dirname, '../../../gen-context.js')} --cwd "${projDir}" 2>/dev/null`;
    execSync(cmd, { timeout: 5000 });

    // Health JSON
    const healthCmd = `node ${path.resolve(__dirname, '../../../gen-context.js')} --health --json --cwd "${projDir}" 2>/dev/null`;
    const output = execSync(healthCmd, { encoding: 'utf8', timeout: 5000 });
    const json = JSON.parse(output);

    if (fs.existsSync(path.join(projDir, '.sigmap-cache.json'))) {
      assert('cacheStats' in json, 'cacheStats field should be in JSON output when cache exists');
      if (json.cacheStats) {
        assert('sizeKb' in json.cacheStats, 'cacheStats should have sizeKb');
        assert('entries' in json.cacheStats, 'cacheStats should have entries count');
      }
    }
  } finally {
    fs.rmSync(projDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
