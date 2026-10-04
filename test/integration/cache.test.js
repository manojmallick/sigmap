'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const GEN_CONTEXT = path.resolve(__dirname, '../../gen-context.js');
const { formatCache, formatCachePayload } = require('../../src/format/cache');

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

function withTempProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-cache-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function seedSrc(dir) {
  const srcDir = path.join(dir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'index.js'), [
    'function hello() {}',
    'function world() {}',
    'module.exports = { hello, world };',
  ].join('\n'));
}

// ---------------------------------------------------------------------------
// Unit tests — formatCache()
// ---------------------------------------------------------------------------

console.log('\nUnit tests — formatCache()\n');

const MARK = '<!-- sigmap:volatile -->';
const layoutContent = `# Code signatures\n\n## src\n\n### src/index.js\n\`\`\`\nfunction hello()\n\`\`\`\n\n${MARK}\n## recent changes (develop@abc1234)\n\`\`\`\nsrc/index.js  +hello\n\`\`\`\n`;

test('returns a JSON array of system blocks', () => {
  const parsed = JSON.parse(formatCache('# Code signatures\n\nsome content'));
  assert.ok(Array.isArray(parsed), 'should be the Anthropic system array');
});

test('content with no volatile marker is one cached text block', () => {
  const content = '# Code signatures\n\n## src\n';
  const parsed = JSON.parse(formatCache(content));
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].type, 'text');
  assert.strictEqual(parsed[0].text, content);
  assert.deepStrictEqual(parsed[0].cache_control, { type: 'ephemeral' });
});

test('stable-prefix content splits into a cached block then an uncached tail', () => {
  const parsed = JSON.parse(formatCache(layoutContent));
  assert.strictEqual(parsed.length, 2);
  assert.deepStrictEqual(parsed[0].cache_control, { type: 'ephemeral' });
  assert.ok(parsed[0].text.includes('function hello()'));
  assert.ok(!parsed[0].text.includes('recent changes'), 'volatile content must not sit inside the cached block');
  assert.strictEqual(parsed[1].cache_control, undefined, 'the volatile tail carries no cache_control');
  assert.ok(parsed[1].text.startsWith('## recent changes'));
  assert.ok(!parsed.some((b) => b.text.includes(MARK)), 'the marker is a boundary, not content');
});

test('an empty volatile tail is omitted, never sent as an empty block', () => {
  const parsed = JSON.parse(formatCache(`# Code signatures\n\nbody\n\n${MARK}\n`));
  assert.strictEqual(parsed.length, 1);
});

test('ttl "1h" is carried on the cached block only', () => {
  const parsed = JSON.parse(formatCache(layoutContent, { ttl: '1h' }));
  assert.deepStrictEqual(parsed[0].cache_control, { type: 'ephemeral', ttl: '1h' });
  assert.strictEqual(parsed[1].cache_control, undefined);
});

test('ttl "5m" leaves the API default implicit', () => {
  const parsed = JSON.parse(formatCache(layoutContent, { ttl: '5m' }));
  assert.deepStrictEqual(parsed[0].cache_control, { type: 'ephemeral' });
});

test('handles empty string without throwing', () => {
  const parsed = JSON.parse(formatCache(''));
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].text, '');
});

test('handles null without throwing', () => {
  const parsed = JSON.parse(formatCache(null));
  assert.strictEqual(parsed[0].text, '');
});

// ---------------------------------------------------------------------------
// Unit tests — formatCachePayload()
// ---------------------------------------------------------------------------

console.log('\nUnit tests — formatCachePayload()\n');

test('returns valid JSON string from formatCachePayload', () => {
  const result = formatCachePayload('# Code signatures');
  const parsed = JSON.parse(result);
  assert.ok(parsed, 'should parse as JSON');
});

test('payload has model field', () => {
  const parsed = JSON.parse(formatCachePayload('hello'));
  assert.ok(typeof parsed.model === 'string' && parsed.model.length > 0);
});

test('payload model defaults to claude-opus-4-5', () => {
  const parsed = JSON.parse(formatCachePayload('hello'));
  assert.strictEqual(parsed.model, 'claude-opus-4-5');
});

test('payload model can be overridden', () => {
  const parsed = JSON.parse(formatCachePayload('hello', 'claude-haiku-3-5'));
  assert.strictEqual(parsed.model, 'claude-haiku-3-5');
});

test('payload has system array', () => {
  const parsed = JSON.parse(formatCachePayload('hello'));
  assert.ok(Array.isArray(parsed.system));
  assert.strictEqual(parsed.system.length, 1);
});

test('payload system[0] has cache_control ephemeral', () => {
  const parsed = JSON.parse(formatCachePayload('hello'));
  assert.deepStrictEqual(parsed.system[0].cache_control, { type: 'ephemeral' });
});

test('payload system[0].text contains input', () => {
  const content = '# Test content';
  const parsed = JSON.parse(formatCachePayload(content));
  assert.strictEqual(parsed.system[0].text, content);
});

test('payload has messages array', () => {
  const parsed = JSON.parse(formatCachePayload('hello'));
  assert.ok(Array.isArray(parsed.messages));
});

// ---------------------------------------------------------------------------
// Integration tests — CLI --format cache
// ---------------------------------------------------------------------------

console.log('\nIntegration tests — CLI --format cache\n');

test('--format cache writes .github/copilot-instructions.cache.json', () => {
  withTempProject((dir) => {
    seedSrc(dir);
    execSync(`node "${GEN_CONTEXT}" --format cache`, {
      cwd: dir,
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const cachePath = path.join(dir, '.github', 'copilot-instructions.cache.json');
    assert.ok(fs.existsSync(cachePath), 'cache JSON file should exist');
  });
});

test('cache JSON file is valid JSON', () => {
  withTempProject((dir) => {
    seedSrc(dir);
    execSync(`node "${GEN_CONTEXT}" --format cache`, {
      cwd: dir,
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const cachePath = path.join(dir, '.github', 'copilot-instructions.cache.json');
    const raw = fs.readFileSync(cachePath, 'utf8');
    const parsed = JSON.parse(raw);
    assert.ok(parsed);
  });
});

test('cache JSON is a system array: cached stable block, then uncached volatile tail', () => {
  withTempProject((dir) => {
    seedSrc(dir);
    execSync('git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm one', { cwd: dir, stdio: 'pipe' });
    fs.appendFileSync(path.join(dir, 'src', 'index.js'), '\nfunction extra() {}\n');
    execSync('git -c user.email=t@t -c user.name=t commit -qam two', { cwd: dir, stdio: 'pipe' });
    execSync(`node "${GEN_CONTEXT}" --format cache`, {
      cwd: dir,
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const cachePath = path.join(dir, '.github', 'copilot-instructions.cache.json');
    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    assert.ok(Array.isArray(parsed));
    assert.strictEqual(parsed[0].type, 'text');
    assert.deepStrictEqual(parsed[0].cache_control, { type: 'ephemeral' });
    assert.ok(parsed[0].text.includes('Code signatures'), 'cached block should carry the signatures');
    assert.ok(!parsed[0].text.includes('recent changes'), 'recent changes must not be inside the cached block');
    assert.strictEqual(parsed.length, 2, 'a repo with recent changes has a volatile tail block');
    assert.strictEqual(parsed[1].cache_control, undefined);
  });
});

test('without --format cache, no cache JSON file is written', () => {
  withTempProject((dir) => {
    seedSrc(dir);
    execSync(`node "${GEN_CONTEXT}"`, {
      cwd: dir,
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const cachePath = path.join(dir, '.github', 'copilot-instructions.cache.json');
    assert.ok(!fs.existsSync(cachePath), 'cache JSON should NOT exist without --format cache');
  });
});

test('config format:cache writes cache JSON automatically', () => {
  withTempProject((dir) => {
    seedSrc(dir);
    fs.writeFileSync(
      path.join(dir, 'gen-context.config.json'),
      JSON.stringify({ format: 'cache' }),
      'utf8'
    );
    execSync(`node "${GEN_CONTEXT}"`, {
      cwd: dir,
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const cachePath = path.join(dir, '.github', 'copilot-instructions.cache.json');
    assert.ok(fs.existsSync(cachePath), 'cache JSON should exist when config format:cache');
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'─'.repeat(50)}`);
console.log(`cache: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
