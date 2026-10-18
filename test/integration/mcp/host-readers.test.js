'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const assert = require('assert');
const { installClient, verifyClient } = require('../../../src/mcp/install');

const HOSTS = [
  { client: 'claude', command: 'claude' },
  { client: 'codex', command: 'codex' },
  { client: 'opencode', command: 'opencode' },
];
const requireHosts = process.env.SIGMAP_REQUIRE_HOST_CLIS === '1';
let passed = 0;
let failed = 0;
let skipped = 0;

function available(command) {
  const probe = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(probe, [command], {
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true,
  });
  return result.status === 0;
}

for (const host of HOSTS) {
  if (!available(host.command)) {
    const message = `${host.command} CLI is not installed`;
    if (requireHosts) {
      console.error(`  FAIL  ${host.client}: ${message}`);
      failed++;
    } else {
      console.log(`  SKIP  ${host.client}: ${message}`);
      skipped++;
    }
    continue;
  }

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `sigmap-${host.client}-reader-`));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `sigmap-${host.client}-home-`));
  try {
    const env = { ...process.env, HOME: home, USERPROFILE: home };
    if (host.client === 'codex') env.CODEX_HOME = path.join(home, '.codex');
    installClient(host.client, { cwd, home, env });
    const result = verifyClient(host.client, { cwd, env });
    assert.strictEqual(result.status, 'verified', result.reason || `${host.command} did not list SigMap`);
    console.log(`  PASS  ${host.client}: ${host.command} mcp list reads the generated config`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${host.client}: ${err.message}`);
    failed++;
  } finally {
    try { fs.rmSync(cwd, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) {}
  }
}

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);
if (failed > 0) process.exit(1);
