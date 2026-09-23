'use strict';

/**
 * Willow adapter posts knowledge_ingest with full section content (#145 refresh).
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const willow = require(path.join(ROOT, 'packages/adapters/willow'));

const SAMPLE = `## src/app.py
\`\`\`
def hello(): pass
\`\`\`
`;

async function main() {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, status: 200 };
  };
  try {
    await willow.write(SAMPLE, '/tmp/myproj', { mcpUrl: 'http://127.0.0.1:9999', maxRetries: 1 });
  } finally {
    global.fetch = original;
  }
  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/tools/call'));
  assert.strictEqual(calls[0].body.name, 'knowledge_ingest');
  const args = calls[0].body.arguments;
  assert.strictEqual(args.app_id, 'sigmap');
  assert.ok(args.content.includes('def hello'), 'content must include signatures');
  assert.strictEqual(args.domain, 'code');
  assert.ok(args.tags.includes('sigmap'));
  console.log('  PASS  write() calls knowledge_ingest with content field');
  console.log('\nwillow-adapter-ingest: 1 passed, 0 failed');
}

main().catch((e) => {
  console.log(`  FAIL  ${e.message}`);
  console.log('\nwillow-adapter-ingest: 0 passed, 1 failed');
  process.exit(1);
});
