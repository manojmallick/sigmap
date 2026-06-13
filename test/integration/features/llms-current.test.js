'use strict';

/**
 * CI gate (#242): the committed llms.txt / llms-full.txt must match what the
 * generator produces from source of truth. Fails the build if they are stale —
 * so LLM-facing docs can never silently drift from the code.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

test('llms.txt + llms-full.txt exist at repo root and docs-vp/public', () => {
  for (const rel of ['llms.txt', 'llms-full.txt', 'docs-vp/public/llms.txt', 'docs-vp/public/llms-full.txt']) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} missing`);
  }
});

test('committed llms files are current (npm run validate:llms passes)', () => {
  const res = spawnSync('node', [path.join(ROOT, 'scripts', 'validate-llms.mjs')], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, `validate:llms failed — run \`npm run generate:llms\`:\n${res.stdout}${res.stderr}`);
});

test('llms-full.txt reflects current MCP tool count + metrics from version.json', () => {
  const full = fs.readFileSync(path.join(ROOT, 'llms-full.txt'), 'utf8');
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
  assert.ok(full.includes(`## MCP server — ${v.mcp_tools} tools`), 'MCP tool count drifted');
  assert.ok(full.includes(`${(v.metrics.overall_token_reduction_pct).toFixed(1)}%`), 'token-reduction metric drifted');
  assert.ok(!full.includes('<!-- sigmap-tools -->'), 'unexpected stale tools-json marker');
});

console.log(`\nllms-current: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
