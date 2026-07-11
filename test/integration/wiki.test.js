'use strict';

/**
 * Integration tests for `sigmap wiki` (D9, #465).
 *
 * Covers: generation of .context/WIKI.md with the required sections,
 * byte-identical determinism across consecutive runs, --json structured
 * output, --out path override, the no-context fallback, and --help.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const GEN_CONTEXT = path.resolve(__dirname, '../../gen-context.js');

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

function run(dir, ...args) {
  return spawnSync(process.execPath, [GEN_CONTEXT, ...args], { cwd: dir, encoding: 'utf8' });
}

function withProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-wiki-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'util.js'), [
      'function formatUser(user, style) {',
      '  return String(user);',
      '}',
      'module.exports = { formatUser };',
      '',
    ].join('\n'));
    fs.writeFileSync(path.join(dir, 'src', 'app.js'), [
      "const { formatUser } = require('./util');",
      'async function fetchUser(id, opts = {}) {',
      '  return formatUser({ id });',
      '}',
      'module.exports = { fetchUser };',
      '',
    ].join('\n'));
    const gen = run(dir);
    assert.strictEqual(gen.status, 0, gen.stderr);
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── generation ──────────────────────────────────────────────────────────────

test('wiki writes .context/WIKI.md with the required sections', () => {
  withProject((dir) => {
    const res = run(dir, 'wiki');
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(/\[sigmap\] wiki → \.context\/WIKI\.md \(\d+ files · \d+ modules\)/.test(res.stdout), res.stdout);
    const md = fs.readFileSync(path.join(dir, '.context', 'WIKI.md'), 'utf8');
    for (const section of ['## Overview', '## Modules', '## Dependency flow', '## Conventions', '## Navigating']) {
      assert.ok(md.includes(section), `missing ${section}`);
    }
    assert.ok(md.includes('**2 indexed files**'), md.split('\n').find((l) => l.includes('indexed')));
    assert.ok(md.includes('`src/util.js`'), 'util.js missing from wiki');
    assert.ok(md.includes('Entry points'), 'entry points missing');
    assert.ok(md.includes('none detected'), 'cycle line missing');
  });
});

test('wiki output is byte-identical across consecutive runs (determinism)', () => {
  withProject((dir) => {
    assert.strictEqual(run(dir, 'wiki').status, 0);
    const first = fs.readFileSync(path.join(dir, '.context', 'WIKI.md'), 'utf8');
    assert.strictEqual(run(dir, 'wiki').status, 0);
    const second = fs.readFileSync(path.join(dir, '.context', 'WIKI.md'), 'utf8');
    assert.strictEqual(first, second, 'consecutive runs differ');
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}/.test(first), 'wiki contains a timestamp');
  });
});

test('wiki --json emits structured data and writes no file', () => {
  withProject((dir) => {
    const res = run(dir, 'wiki', '--json');
    assert.strictEqual(res.status, 0, res.stderr);
    const data = JSON.parse(res.stdout);
    assert.strictEqual(data.files, 2);
    assert.ok(Array.isArray(data.modules) && data.modules[0].name === 'src', JSON.stringify(data.modules));
    assert.ok(data.flow && data.flow.hubs.some((h) => h.file === 'src/util.js'), JSON.stringify(data.flow));
    assert.ok(!fs.existsSync(path.join(dir, '.context', 'WIKI.md')), '--json should not write WIKI.md');
  });
});

test('wiki --out overrides the output path', () => {
  withProject((dir) => {
    const res = run(dir, 'wiki', '--out', 'docs/ARCH.md');
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(fs.existsSync(path.join(dir, 'docs', 'ARCH.md')), 'custom path missing');
    assert.ok(!fs.existsSync(path.join(dir, '.context', 'WIKI.md')), 'default path should not be written with --out');
  });
});

test('wiki degrades gracefully with no context file (no crash, valid doc)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-wiki-empty-'));
  try {
    const res = run(dir, 'wiki');
    assert.strictEqual(res.status, 0, res.stderr);
    const md = fs.readFileSync(path.join(dir, '.context', 'WIKI.md'), 'utf8');
    assert.ok(md.includes('No signature index found'), md.slice(0, 300));
    assert.ok(md.includes('## Navigating'), 'navigating section missing in fallback');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--help documents wiki', () => {
  const res = spawnSync(process.execPath, [GEN_CONTEXT, '--help'], { encoding: 'utf8' });
  assert.ok((res.stdout || '').includes('wiki'), 'missing wiki in help');
});

console.log(`\nwiki: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
