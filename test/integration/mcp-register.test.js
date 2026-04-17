'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const assert = require('assert');
const { execSync } = require('child_process');

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

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-mcp-'));
  // minimal config so gen-context.js doesn't error
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: [] }));
  return dir;
}

function cleanup(dirs) {
  for (const d of dirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
}

console.log('\nmcp-register: MCP auto-wire tests\n');

// ── Windsurf project-level ──────────────────────────────────────────────────
test('writes mcpServers.sigmap to .windsurf/mcp.json on --setup', () => {
  const dir = makeTmpDir();
  try {
    const wsDir = path.join(dir, '.windsurf');
    fs.mkdirSync(wsDir);
    fs.writeFileSync(path.join(wsDir, 'mcp.json'), JSON.stringify({}));

    execSync(`node "${GEN_CONTEXT}" --setup`, { cwd: dir, encoding: 'utf8', timeout: 15000 });

    const result = JSON.parse(fs.readFileSync(path.join(wsDir, 'mcp.json'), 'utf8'));
    assert.ok(result.mcpServers, '.windsurf/mcp.json should have mcpServers');
    assert.ok(result.mcpServers.sigmap, 'mcpServers.sigmap should be set');
    assert.strictEqual(result.mcpServers.sigmap.command, 'node');
    assert.ok(Array.isArray(result.mcpServers.sigmap.args));
  } finally {
    cleanup([dir]);
  }
});

test('does not duplicate Windsurf entry on repeat --setup', () => {
  const dir = makeTmpDir();
  try {
    const wsDir = path.join(dir, '.windsurf');
    fs.mkdirSync(wsDir);
    fs.writeFileSync(path.join(wsDir, 'mcp.json'), JSON.stringify({ mcpServers: { sigmap: { command: 'node', args: ['existing'] } } }));

    execSync(`node "${GEN_CONTEXT}" --setup`, { cwd: dir, encoding: 'utf8', timeout: 15000 });

    const result = JSON.parse(fs.readFileSync(path.join(wsDir, 'mcp.json'), 'utf8'));
    assert.deepStrictEqual(result.mcpServers.sigmap.args, ['existing'], 'existing entry must not be overwritten');
  } finally {
    cleanup([dir]);
  }
});

// ── Cursor (regression: must still work) ───────────────────────────────────
test('still writes mcpServers.sigmap to .cursor/mcp.json on --setup', () => {
  const dir = makeTmpDir();
  try {
    const cursorDir = path.join(dir, '.cursor');
    fs.mkdirSync(cursorDir);
    fs.writeFileSync(path.join(cursorDir, 'mcp.json'), JSON.stringify({}));

    execSync(`node "${GEN_CONTEXT}" --setup`, { cwd: dir, encoding: 'utf8', timeout: 15000 });

    const result = JSON.parse(fs.readFileSync(path.join(cursorDir, 'mcp.json'), 'utf8'));
    assert.ok(result.mcpServers?.sigmap, '.cursor/mcp.json mcpServers.sigmap must still be set');
  } finally {
    cleanup([dir]);
  }
});

// ── Zed ─────────────────────────────────────────────────────────────────────
test('writes context_servers.sigmap to zed settings when file exists', () => {
  const dir      = makeTmpDir();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-fakehome-'));
  try {
    const zedDir = path.join(fakeHome, '.config', 'zed');
    fs.mkdirSync(zedDir, { recursive: true });
    fs.writeFileSync(path.join(zedDir, 'settings.json'), JSON.stringify({}));

    // Patch HOME so os.homedir() resolves to fakeHome
    execSync(`node "${GEN_CONTEXT}" --setup`, {
      cwd:     dir,
      env:     { ...process.env, HOME: fakeHome },
      encoding: 'utf8',
      timeout: 15000,
    });

    const result = JSON.parse(fs.readFileSync(path.join(zedDir, 'settings.json'), 'utf8'));
    assert.ok(result.context_servers, 'zed settings.json should have context_servers');
    assert.ok(result.context_servers.sigmap, 'context_servers.sigmap should be set');
    assert.strictEqual(result.context_servers.sigmap.command.path, 'node');
    assert.ok(Array.isArray(result.context_servers.sigmap.command.args));
  } finally {
    cleanup([dir, fakeHome]);
  }
});

test('does not duplicate Zed entry on repeat --setup', () => {
  const dir      = makeTmpDir();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-fakehome-'));
  try {
    const zedDir = path.join(fakeHome, '.config', 'zed');
    fs.mkdirSync(zedDir, { recursive: true });
    fs.writeFileSync(path.join(zedDir, 'settings.json'), JSON.stringify({
      context_servers: { sigmap: { command: { path: 'node', args: ['original'] } } },
    }));

    execSync(`node "${GEN_CONTEXT}" --setup`, {
      cwd:     dir,
      env:     { ...process.env, HOME: fakeHome },
      encoding: 'utf8',
      timeout: 15000,
    });

    const result = JSON.parse(fs.readFileSync(path.join(zedDir, 'settings.json'), 'utf8'));
    assert.deepStrictEqual(result.context_servers.sigmap.command.args, ['original'], 'existing Zed entry must not be overwritten');
  } finally {
    cleanup([dir, fakeHome]);
  }
});

test('skips Zed registration when ~/.config/zed/settings.json does not exist', () => {
  const dir      = makeTmpDir();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-fakehome-'));
  try {
    // fakeHome has no .config/zed — should not throw
    execSync(`node "${GEN_CONTEXT}" --setup`, {
      cwd:     dir,
      env:     { ...process.env, HOME: fakeHome },
      encoding: 'utf8',
      timeout: 15000,
    });
    // no assertion needed — test passes if no exception thrown
  } finally {
    cleanup([dir, fakeHome]);
  }
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
