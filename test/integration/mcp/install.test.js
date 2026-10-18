'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const assert = require('assert');
const { execFileSync } = require('child_process');

const GEN_CONTEXT = path.resolve(__dirname, '../../../gen-context.js');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-mcp-install-'));
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: [] }));
  return dir;
}

function cleanup(dirs) {
  for (const d of dirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
}

function fakeHost(binDir, name, output, status = 0) {
  const file = path.join(binDir, name + (process.platform === 'win32' ? '.cmd' : ''));
  if (process.platform === 'win32') {
    fs.writeFileSync(file, `@echo off\r\n@echo ${output.replace(/[\r\n]/g, ' ')}\r\n@exit /b ${status}\r\n`);
  } else {
    fs.writeFileSync(file, `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(output)});\nprocess.exitCode = ${status};\n`);
    fs.chmodSync(file, 0o755);
  }
  return file;
}

/** Run gen-context.js; returns { stdout, status }. Never throws on non-zero. */
function run(dir, argv, extraEnv) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-host-bin-'));
  const home = (extraEnv && (extraEnv.USERPROFILE || extraEnv.HOME)) || path.join(dir, '.test-home');
  fakeHost(bin, 'claude', 'sigmap: listed');
  fakeHost(bin, 'codex', 'sigmap enabled');
  fakeHost(bin, 'opencode', 'sigmap connected');
  try {
    const stdout = execFileSync('node', [GEN_CONTEXT, ...argv], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 15000,
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        CODEX_HOME: path.join(home, '.codex'),
        PATH: bin + path.delimiter + process.env.PATH,
        ...(extraEnv || {}),
      },
    });
    return { stdout, status: 0 };
  } catch (err) {
    return { stdout: (err.stdout || '') + (err.stderr || ''), status: err.status || 1 };
  } finally {
    cleanup([bin]);
  }
}

console.log('\nmcp-install: sigmap mcp install/list tests\n');

// ── mcp list ────────────────────────────────────────────────────────────────
test('mcp list prints supported clients with config paths', () => {
  const dir = makeTmpDir();
  try {
    const { stdout, status } = run(dir, ['mcp', 'list']);
    assert.strictEqual(status, 0, 'mcp list should exit 0');
    assert.ok(/claude/.test(stdout), 'should list claude');
    assert.ok(/cursor/.test(stdout), 'should list cursor');
    assert.ok(/\.mcp\.json/.test(stdout), 'should show Claude project config path');
  } finally {
    cleanup([dir]);
  }
});

test('mcp list --json emits parseable client array with target paths', () => {
  const dir = makeTmpDir();
  try {
    const { stdout, status } = run(dir, ['mcp', 'list', '--json']);
    assert.strictEqual(status, 0);
    const clients = JSON.parse(stdout);
    assert.ok(Array.isArray(clients) && clients.length >= 5, 'should be an array of clients');
    const claude = clients.find((c) => c.client === 'claude');
    assert.ok(claude && claude.target, 'claude entry should carry a target path');
  } finally {
    cleanup([dir]);
  }
});

// ── install creates config when absent ───────────────────────────────────────
test('mcp install claude writes the portable project config the host reads', () => {
  const dir = makeTmpDir();
  try {
    const { status } = run(dir, ['mcp', 'install', 'claude']);
    assert.strictEqual(status, 0);
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.mcp.json'), 'utf8'));
    assert.ok(cfg.mcpServers?.sigmap, 'mcpServers.sigmap should be set');
    assert.strictEqual(cfg.mcpServers.sigmap.command, 'npx');
    assert.deepStrictEqual(cfg.mcpServers.sigmap.args, ['-y', 'sigmap', '--mcp']);
    assert.ok(!fs.existsSync(path.join(dir, '.claude', 'settings.json')), 'must not write the ignored Claude settings path');
  } finally {
    cleanup([dir]);
  }
});

test('mcp install claude migrates its old ignored entry and preserves other settings', () => {
  const dir = makeTmpDir();
  const settingsPath = path.join(dir, '.claude', 'settings.json');
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({
      theme: 'dark',
      mcpServers: {
        playwright: { command: 'npx', args: ['-y', 'pw'] },
        sigmap: { command: 'node', args: ['/old/gen-context.js', '--mcp'] },
      },
    }, null, 2));
    const { stdout, status } = run(dir, ['mcp', 'install', 'claude']);
    assert.strictEqual(status, 0);
    assert.ok(/migrated SigMap config/.test(stdout));
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.mcp.json'), 'utf8'));
    assert.deepStrictEqual(cfg.mcpServers.sigmap.args, ['-y', 'sigmap', '--mcp']);
    const legacy = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert.strictEqual(legacy.theme, 'dark');
    assert.ok(legacy.mcpServers.playwright);
    assert.ok(!legacy.mcpServers.sigmap);
  } finally {
    cleanup([dir]);
  }
});

test('mcp install claude keeps the legacy entry when the new config is invalid', () => {
  const dir = makeTmpDir();
  const legacyPath = path.join(dir, '.claude', 'settings.json');
  const configPath = path.join(dir, '.mcp.json');
  const original = '{"mcpServers":';
  try {
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.writeFileSync(legacyPath, JSON.stringify({ mcpServers: { sigmap: { command: 'node', args: ['old'] } } }));
    fs.writeFileSync(configPath, original);
    const { stdout, status } = run(dir, ['mcp', 'install', 'claude']);
    assert.notStrictEqual(status, 0);
    assert.ok(/Invalid JSON in/.test(stdout));
    assert.strictEqual(fs.readFileSync(configPath, 'utf8'), original);
    assert.ok(JSON.parse(fs.readFileSync(legacyPath, 'utf8')).mcpServers.sigmap);
  } finally {
    cleanup([dir]);
  }
});

// ── idempotency ───────────────────────────────────────────────────────────────
test('mcp install is idempotent — re-run reports already-installed, no duplicate', () => {
  const dir = makeTmpDir();
  try {
    run(dir, ['mcp', 'install', 'cursor']);
    const { stdout, status } = run(dir, ['mcp', 'install', 'cursor']);
    assert.strictEqual(status, 0);
    assert.ok(/already/.test(stdout), 'second run should report already registered');
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.cursor', 'mcp.json'), 'utf8'));
    assert.strictEqual(Object.keys(cfg.mcpServers).length, 1, 'exactly one server entry');
  } finally {
    cleanup([dir]);
  }
});

test('mcp install preserves an existing different sigmap entry', () => {
  const dir = makeTmpDir();
  try {
    fs.mkdirSync(path.join(dir, '.cursor'));
    fs.writeFileSync(
      path.join(dir, '.cursor', 'mcp.json'),
      JSON.stringify({ mcpServers: { sigmap: { command: 'node', args: ['existing'] } } })
    );
    run(dir, ['mcp', 'install', 'cursor']);
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.cursor', 'mcp.json'), 'utf8'));
    assert.deepStrictEqual(cfg.mcpServers.sigmap.args, ['existing'], 'existing entry must not be overwritten');
  } finally {
    cleanup([dir]);
  }
});

test('mcp install merges alongside another mcp server', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(
      path.join(dir, '.mcp.json'),
      JSON.stringify({ mcpServers: { other: { command: 'foo', args: [] } } })
    );
    run(dir, ['mcp', 'install', 'mcp']);
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.mcp.json'), 'utf8'));
    assert.ok(cfg.mcpServers.other, 'pre-existing server must be preserved');
    assert.ok(cfg.mcpServers.sigmap, 'sigmap must be added');
  } finally {
    cleanup([dir]);
  }
});

// ── Zed shape (context_servers) ───────────────────────────────────────────────
test('mcp install zed produces context_servers shape (not mcpServers)', () => {
  const dir      = makeTmpDir();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-home-'));
  try {
    const { status } = run(dir, ['mcp', 'install', 'zed'], { HOME: fakeHome, USERPROFILE: fakeHome });
    assert.strictEqual(status, 0);
    const cfg = JSON.parse(fs.readFileSync(path.join(fakeHome, '.config', 'zed', 'settings.json'), 'utf8'));
    assert.ok(cfg.context_servers?.sigmap, 'context_servers.sigmap should be set');
    assert.strictEqual(cfg.context_servers.sigmap.command.path, 'node');
    assert.deepStrictEqual(cfg.context_servers.sigmap.command.args, [path.resolve(GEN_CONTEXT), '--mcp']);
  } finally {
    cleanup([dir, fakeHome]);
  }
});

// ── Codex TOML shape ─────────────────────────────────────────────────────────
test('mcp install codex writes a TOML mcp_servers table', () => {
  const dir      = makeTmpDir();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-home-'));
  try {
    const { status } = run(dir, ['mcp', 'install', 'codex'], { HOME: fakeHome, USERPROFILE: fakeHome });
    assert.strictEqual(status, 0);
    const raw = fs.readFileSync(path.join(fakeHome, '.codex', 'config.toml'), 'utf8');
    assert.ok(/\[mcp_servers\.sigmap\]/.test(raw), 'should contain the Codex MCP table');
    assert.ok(/command = "npx"/.test(raw), 'should use npx');
    assert.ok(/args = \["-y", "sigmap", "--mcp"\]/.test(raw), 'should pass portable args');
    assert.ok(!fs.existsSync(path.join(fakeHome, '.codex', 'config.yaml')), 'must not create a YAML config');
  } finally {
    cleanup([dir, fakeHome]);
  }
});

test('mcp install codex respects CODEX_HOME for writes and client verification', () => {
  const dir = makeTmpDir();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-home-'));
  const codexHome = path.join(fakeHome, 'custom-codex-home');
  try {
    const { status } = run(dir, ['mcp', 'install', 'codex'], {
      HOME: fakeHome,
      USERPROFILE: fakeHome,
      CODEX_HOME: codexHome,
    });
    assert.strictEqual(status, 0);
    assert.ok(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8').includes('[mcp_servers.sigmap]'));
    assert.ok(!fs.existsSync(path.join(fakeHome, '.codex', 'config.toml')));
    const installer = require('../../../src/mcp/install.js');
    const clients = installer.installClient('codex', {
      cwd: dir,
      home: fakeHome,
      env: { CODEX_HOME: codexHome },
    });
    assert.strictEqual(clients.path, path.join(codexHome, 'config.toml'));
    const codexList = installer.listClients({ cwd: dir, home: fakeHome, env: { CODEX_HOME: codexHome } })
      .find((client) => client.client === 'codex');
    assert.strictEqual(codexList.target, path.join(codexHome, 'config.toml'));
  } finally {
    cleanup([dir, fakeHome]);
  }
});

test('mcp install codex migrates the old YAML entry and preserves other servers', () => {
  const dir = makeTmpDir();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-home-'));
  const codexDir = path.join(fakeHome, '.codex');
  const yamlPath = path.join(codexDir, 'config.yaml');
  try {
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(yamlPath, [
      'model: gpt-5',
      'mcpServers:',
      '  sigmap:',
      '    command: node',
      '    args:',
      '      - /old/gen-context.js',
      '      - --mcp',
      '  other:',
      '    command: other-tool',
      '    args: []',
      '',
    ].join('\n'));
    const { stdout, status } = run(dir, ['mcp', 'install', 'codex'], { HOME: fakeHome, USERPROFILE: fakeHome });
    assert.strictEqual(status, 0);
    assert.ok(/migrated SigMap config/.test(stdout));
    const migrated = fs.readFileSync(yamlPath, 'utf8');
    assert.ok(migrated.includes('model: gpt-5'));
    assert.ok(migrated.includes('  other:'));
    assert.ok(!migrated.includes('  sigmap:'));
    assert.ok(fs.readFileSync(path.join(codexDir, 'config.toml'), 'utf8').includes('[mcp_servers.sigmap]'));
  } finally {
    cleanup([dir, fakeHome]);
  }
});

test('mcp install opencode uses the documented local command array', () => {
  const dir = makeTmpDir();
  try {
    const { status } = run(dir, ['mcp', 'install', 'opencode']);
    assert.strictEqual(status, 0);
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'opencode.json'), 'utf8'));
    assert.deepStrictEqual(cfg.mcp.sigmap, {
      type: 'local',
      command: ['npx', '-y', 'sigmap', '--mcp'],
      enabled: true,
    });
  } finally {
    cleanup([dir]);
  }
});

test('mcp install opencode migrates the old mcpServers shape', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'opencode.json'), JSON.stringify({
      model: 'test/model',
      mcpServers: { sigmap: { command: 'node', args: ['/old/gen-context.js', '--mcp'] } },
    }, null, 2));
    const { stdout, status } = run(dir, ['mcp', 'install', 'opencode']);
    assert.strictEqual(status, 0);
    assert.ok(/migrated SigMap config/.test(stdout));
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'opencode.json'), 'utf8'));
    assert.strictEqual(cfg.model, 'test/model');
    assert.deepStrictEqual(cfg.mcp.sigmap.command, ['npx', '-y', 'sigmap', '--mcp']);
    assert.ok(!cfg.mcpServers);
  } finally {
    cleanup([dir]);
  }
});

test('mcp install opencode preserves an invalid existing config and reports an error', () => {
  const dir = makeTmpDir();
  const configPath = path.join(dir, 'opencode.json');
  const original = '{"model": "unfinished"';
  try {
    fs.writeFileSync(configPath, original);
    const { stdout, status } = run(dir, ['mcp', 'install', 'opencode']);
    assert.notStrictEqual(status, 0);
    assert.ok(/Invalid JSON in/.test(stdout));
    assert.strictEqual(fs.readFileSync(configPath, 'utf8'), original);
  } finally {
    cleanup([dir]);
  }
});

test('mcp install opencode rejects a non-object config without replacing it', () => {
  const dir = makeTmpDir();
  const configPath = path.join(dir, 'opencode.json');
  const original = '[]';
  try {
    fs.writeFileSync(configPath, original);
    const { stdout, status } = run(dir, ['mcp', 'install', 'opencode']);
    assert.notStrictEqual(status, 0);
    assert.ok(/expected a top-level object/.test(stdout));
    assert.strictEqual(fs.readFileSync(configPath, 'utf8'), original);
  } finally {
    cleanup([dir]);
  }
});

// ── --global scope ────────────────────────────────────────────────────────────
test('mcp install windsurf --global targets the user-level config', () => {
  const dir      = makeTmpDir();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-home-'));
  try {
    const { status } = run(dir, ['mcp', 'install', 'windsurf', '--global'], { HOME: fakeHome, USERPROFILE: fakeHome });
    assert.strictEqual(status, 0);
    const globalPath = path.join(fakeHome, '.codeium', 'windsurf', 'mcp_config.json');
    assert.ok(fs.existsSync(globalPath), 'global windsurf config should be created');
    assert.ok(!fs.existsSync(path.join(dir, '.windsurf')), 'project config should not be created with --global');
    const cfg = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
    assert.ok(cfg.mcpServers?.sigmap);
  } finally {
    cleanup([dir, fakeHome]);
  }
});

// ── error handling ────────────────────────────────────────────────────────────
test('mcp install <unknown> exits non-zero and lists valid clients', () => {
  const dir = makeTmpDir();
  try {
    const { stdout, status } = run(dir, ['mcp', 'install', 'bogus']);
    assert.notStrictEqual(status, 0, 'unknown client should exit non-zero');
    assert.ok(/claude/.test(stdout) && /cursor/.test(stdout), 'should list valid clients');
  } finally {
    cleanup([dir]);
  }
});

test('mcp install with no client name exits non-zero with usage', () => {
  const dir = makeTmpDir();
  try {
    const { status } = run(dir, ['mcp', 'install']);
    assert.notStrictEqual(status, 0);
  } finally {
    cleanup([dir]);
  }
});


// ── VS Code uses `servers`, not `mcpServers` (#556) ───────────────────────────

const { installClient: _install, verifyClient: _verify } = require(path.resolve(__dirname, '../../../src/mcp/install.js'));
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

test('vscode: writes a top-level servers key, not mcpServers', () => {
  const dir = makeTmpDir();
  const r = _install('vscode', { cwd: dir, scriptPath: '/x/gen-context.js' });
  assert.strictEqual(r.status, 'installed');
  const cfg = readJson(r.path);
  assert.ok(cfg.servers, 'VS Code reads `servers` — it ignores `mcpServers`');
  assert.ok(!cfg.mcpServers, 'must not write the generic mcpServers shape');
  assert.ok(cfg.servers.sigmap, 'sigmap entry missing');
});

test('vscode: the entry declares the stdio transport', () => {
  const dir = makeTmpDir();
  const r = _install('vscode', { cwd: dir, scriptPath: '/x/gen-context.js' });
  const e = readJson(r.path).servers.sigmap;
  assert.strictEqual(e.type, 'stdio');
  assert.strictEqual(e.command, 'node');
  assert.deepStrictEqual(e.args, [path.resolve('/x/gen-context.js'), '--mcp']);
});

test('vscode: re-running is idempotent', () => {
  const dir = makeTmpDir();
  _install('vscode', { cwd: dir, scriptPath: '/x/gen-context.js' });
  const again = _install('vscode', { cwd: dir, scriptPath: '/x/gen-context.js' });
  assert.strictEqual(again.status, 'already');
});

test('vscode: a legacy mcpServers.sigmap config is migrated to servers', () => {
  const dir = makeTmpDir();
  fs.mkdirSync(path.join(dir, '.vscode'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.vscode', 'mcp.json'), JSON.stringify({
    servers: { playwright: { command: 'npx', args: ['-y', 'pw'] } },
    mcpServers: { sigmap: { command: 'node', args: ['/old/gen-context.js', '--mcp'] } },
  }, null, 2));
  const r = _install('vscode', { cwd: dir, scriptPath: '/x/gen-context.js' });
  assert.strictEqual(r.status, 'updated');
  const cfg = readJson(r.path);
  assert.ok(cfg.servers.sigmap, 'sigmap must move under servers');
  assert.ok(!cfg.mcpServers, 'the stale mcpServers block must be removed');
  assert.ok(cfg.servers.playwright, 'unrelated servers must be preserved');
});

test('vscode: unrelated keys in the file survive', () => {
  const dir = makeTmpDir();
  fs.mkdirSync(path.join(dir, '.vscode'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.vscode', 'mcp.json'),
    JSON.stringify({ inputs: [{ id: 'token', type: 'promptString' }] }, null, 2));
  const r = _install('vscode', { cwd: dir, scriptPath: '/x/gen-context.js' });
  const cfg = readJson(r.path);
  assert.ok(Array.isArray(cfg.inputs) && cfg.inputs.length === 1, 'inputs must be preserved');
  assert.ok(cfg.servers.sigmap);
});

test('JSON clients keep mcpServers; only Claude uses the portable command', () => {
  for (const client of ['claude', 'cursor', 'mcp']) {
    const dir = makeTmpDir();
    const r = _install(client, { cwd: dir, scriptPath: '/x/gen-context.js' });
    const cfg = readJson(r.path);
    assert.ok(cfg.mcpServers && cfg.mcpServers.sigmap, `${client} must keep the mcpServers shape`);
    assert.ok(!cfg.servers, `${client} must not switch to the VS Code shape`);
    if (client === 'claude') {
      assert.strictEqual(cfg.mcpServers.sigmap.command, 'npx');
      assert.deepStrictEqual(cfg.mcpServers.sigmap.args, ['-y', 'sigmap', '--mcp']);
    } else {
      assert.strictEqual(cfg.mcpServers.sigmap.command, 'node');
      assert.deepStrictEqual(cfg.mcpServers.sigmap.args, [path.resolve('/x/gen-context.js'), '--mcp']);
    }
  }
});

test('host verification accepts a server reported by the client CLI', () => {
  const dir = makeTmpDir();
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-host-bin-'));
  try {
    fakeHost(bin, 'claude', 'sigmap: node - pending approval');
    const result = _verify('claude', {
      cwd: dir,
      env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH },
    });
    assert.strictEqual(result.status, 'verified');
  } finally {
    cleanup([dir, bin]);
  }
});

test('host verification fails when an installed CLI cannot find SigMap', () => {
  const dir = makeTmpDir();
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-host-bin-'));
  try {
    fakeHost(bin, 'codex', 'No MCP servers configured');
    const result = _verify('codex', {
      cwd: dir,
      env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH },
    });
    assert.strictEqual(result.status, 'failed');
    assert.ok(/did not report/.test(result.reason));
  } finally {
    cleanup([dir, bin]);
  }
});

test('mcp install exits non-zero when the host CLI does not report its new entry', () => {
  const dir = makeTmpDir();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-home-'));
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-host-bin-'));
  try {
    fakeHost(bin, 'claude', 'No MCP servers configured');
    const { stdout, status } = run(dir, ['mcp', 'install', 'claude'], {
      HOME: fakeHome,
      USERPROFILE: fakeHome,
      PATH: bin + path.delimiter + process.env.PATH,
    });
    assert.notStrictEqual(status, 0);
    assert.ok(/could not confirm SigMap server|did not report a usable SigMap server/.test(stdout));
  } finally {
    cleanup([dir, fakeHome, bin]);
  }
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
