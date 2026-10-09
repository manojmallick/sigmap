'use strict';

/**
 * Integration tests for v1.5 features:
 *  - .npmignore content validation
 *  - gen-context.js shebang line
 *  - VS Code extension manifest structure
 *  - docs site search stays local (VitePress provider, no hosted service)
 *  - npx / bin entry validation via package.json
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../');

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

// ─────────────────────────────────────────────────────────────
// npm package integrity
// ─────────────────────────────────────────────────────────────

console.log('\nnpm package integrity\n');

test('package.json has name "sigmap"', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.name, 'sigmap');
});

test('package.json bin includes "sigmap" and "gen-context" entries', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.bin, 'Should have bin field');
  assert.ok(pkg.bin['sigmap'], 'Should have sigmap bin');
  assert.ok(pkg.bin['gen-context'], 'Should have gen-context bin');
});

test('package.json bin entries point to gen-context.js', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.bin['sigmap'].includes('gen-context.js'), 'sigmap bin should point to gen-context.js');
});

test('package.json has engines.node >= 18', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.engines && pkg.engines.node, 'Should have engines.node');
  assert.ok(pkg.engines.node.includes('18'), 'Should require Node 18+');
});

test('package.json has zero runtime dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const deps = pkg.dependencies;
  assert.ok(!deps || Object.keys(deps).length === 0, 'Should have zero runtime dependencies');
});

test('.npmignore exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, '.npmignore')), '.npmignore should exist');
});

test('.npmignore excludes test/', () => {
  const content = fs.readFileSync(path.join(ROOT, '.npmignore'), 'utf8');
  assert.ok(content.includes('test/'), 'Should exclude test/');
});

test('.npmignore excludes docs/', () => {
  const content = fs.readFileSync(path.join(ROOT, '.npmignore'), 'utf8');
  assert.ok(content.includes('docs/'), 'Should exclude docs/');
});

test('.npmignore excludes .github/workflows/', () => {
  const content = fs.readFileSync(path.join(ROOT, '.npmignore'), 'utf8');
  assert.ok(content.includes('.github/workflows/'), 'Should exclude .github/workflows/');
});

// ─────────────────────────────────────────────────────────────
// gen-context.js shebang
// ─────────────────────────────────────────────────────────────

console.log('\ngen-context.js shebang\n');

test('gen-context.js first line is #!/usr/bin/env node', () => {
  const content = fs.readFileSync(path.join(ROOT, 'gen-context.js'), 'utf8');
  const firstLine = content.split('\n')[0];
  assert.strictEqual(firstLine, '#!/usr/bin/env node', `First line should be shebang, got: ${firstLine}`);
});

test('gen-context.js second line is use strict', () => {
  const content = fs.readFileSync(path.join(ROOT, 'gen-context.js'), 'utf8');
  const lines = content.split('\n');
  assert.ok(lines[1].includes("'use strict'") || lines[2].includes("'use strict'"), 'Should have use strict after shebang');
});

// ─────────────────────────────────────────────────────────────
// Docs site search
// ─────────────────────────────────────────────────────────────
// This block used to assert that six legacy docs/*.html pages each carried a
// hand-injected search overlay. Those pages no longer deploy (#930); the site is
// VitePress, whose local provider builds its index in the browser — no external
// script, no search service. The intent (docs search exists, depends on nothing
// outside the page) is what is checked now.

console.log('\nDocs search\n');

const VP_CONFIG = fs.readFileSync(path.join(ROOT, 'docs-vp/.vitepress/config.mts'), 'utf8');

test('docs site enables VitePress local search', () => {
  assert.ok(/search:\s*\{\s*provider:\s*'local',?\s*\}/.test(VP_CONFIG),
    "docs-vp/.vitepress/config.mts should set search: { provider: 'local' }");
});

test('docs search uses no external service', () => {
  assert.ok(!/algolia|appId|apiKey|meilisearch|typesense/i.test(VP_CONFIG),
    'docs search must not depend on a hosted search provider');
});

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`v1.5: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
