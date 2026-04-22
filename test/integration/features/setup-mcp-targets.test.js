'use strict';

/**
 * Tests for v6.2.0 — MCP auto-wire for new --setup targets.
 *
 * Verifies that --setup (registerMcp) correctly writes to:
 *  1.  .vscode/mcp.json            (VS Code / GitHub Copilot)
 *  2.  opencode.json               (OpenCode project-level)
 *  3.  ~/.config/opencode/config.json  (OpenCode global)
 *  4.  ~/.gemini/settings.json     (Gemini CLI)
 *  5.  ~/.codex/config.yaml        (Codex CLI — YAML)
 *  6–10. Idempotency for each new target
 * 11.  Existing targets (Claude, Cursor) still work
 * 12.  Snippet output includes new target names
 */

const fs     = require('fs');
const path   = require('path');
const assert = require('assert');
const os     = require('os');
const { spawnSync } = require('child_process');

const GEN = path.resolve(__dirname, '../../../gen-context.js');

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

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-setup-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function runSetup(cwd, env = {}) {
  return spawnSync('node', [GEN, '--setup'], {
    cwd,
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, ...env },
  });
}

const ENTRY = { command: 'node', args: [path.resolve(GEN), '--mcp'] };

// ── VS Code / GitHub Copilot (.vscode/mcp.json) ───────────────────────────────

test('1. .vscode/mcp.json: registers sigmap when file exists', () => {
  withTempDir((dir) => {
    const vscodeDir = path.join(dir, '.vscode');
    fs.mkdirSync(vscodeDir);
    fs.writeFileSync(path.join(vscodeDir, 'mcp.json'), JSON.stringify({}));
    runSetup(dir);
    const result = JSON.parse(fs.readFileSync(path.join(vscodeDir, 'mcp.json'), 'utf8'));
    assert.ok(result.mcpServers && result.mcpServers.sigmap, 'sigmap entry missing from .vscode/mcp.json');
    assert.strictEqual(result.mcpServers.sigmap.command, 'node');
  });
});

test('2. .vscode/mcp.json: skipped when file does not exist', () => {
  withTempDir((dir) => {
    runSetup(dir);
    assert.ok(!fs.existsSync(path.join(dir, '.vscode', 'mcp.json')), '.vscode/mcp.json must not be created');
  });
});

test('3. .vscode/mcp.json: idempotent — second run makes no changes', () => {
  withTempDir((dir) => {
    const vscodeDir = path.join(dir, '.vscode');
    fs.mkdirSync(vscodeDir);
    fs.writeFileSync(path.join(vscodeDir, 'mcp.json'), JSON.stringify({}));
    runSetup(dir);
    const after1 = fs.readFileSync(path.join(vscodeDir, 'mcp.json'), 'utf8');
    runSetup(dir);
    const after2 = fs.readFileSync(path.join(vscodeDir, 'mcp.json'), 'utf8');
    assert.strictEqual(after1, after2, 'file changed on second run — not idempotent');
  });
});

// ── OpenCode project-level (opencode.json) ────────────────────────────────────

test('4. opencode.json: registers sigmap when file exists', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'opencode.json'), JSON.stringify({}));
    runSetup(dir);
    const result = JSON.parse(fs.readFileSync(path.join(dir, 'opencode.json'), 'utf8'));
    assert.ok(result.mcpServers && result.mcpServers.sigmap, 'sigmap entry missing from opencode.json');
  });
});

test('5. opencode.json: idempotent — second run makes no changes', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'opencode.json'), JSON.stringify({}));
    runSetup(dir);
    const after1 = fs.readFileSync(path.join(dir, 'opencode.json'), 'utf8');
    runSetup(dir);
    const after2 = fs.readFileSync(path.join(dir, 'opencode.json'), 'utf8');
    assert.strictEqual(after1, after2, 'opencode.json changed on second run');
  });
});

// ── OpenCode global (~/.config/opencode/config.json) ─────────────────────────

test('6. ~/.config/opencode/config.json: registers sigmap when file exists', () => {
  withTempDir((dir) => {
    withTempDir((fakeHome) => {
      const ocDir = path.join(fakeHome, '.config', 'opencode');
      fs.mkdirSync(ocDir, { recursive: true });
      fs.writeFileSync(path.join(ocDir, 'config.json'), JSON.stringify({}));
      runSetup(dir, { HOME: fakeHome });
      const result = JSON.parse(fs.readFileSync(path.join(ocDir, 'config.json'), 'utf8'));
      assert.ok(result.mcpServers && result.mcpServers.sigmap, 'sigmap entry missing from ~/.config/opencode/config.json');
    });
  });
});

test('7. ~/.config/opencode/config.json: idempotent', () => {
  withTempDir((dir) => {
    withTempDir((fakeHome) => {
      const ocDir = path.join(fakeHome, '.config', 'opencode');
      fs.mkdirSync(ocDir, { recursive: true });
      fs.writeFileSync(path.join(ocDir, 'config.json'), JSON.stringify({}));
      runSetup(dir, { HOME: fakeHome });
      const after1 = fs.readFileSync(path.join(ocDir, 'config.json'), 'utf8');
      runSetup(dir, { HOME: fakeHome });
      const after2 = fs.readFileSync(path.join(ocDir, 'config.json'), 'utf8');
      assert.strictEqual(after1, after2, 'changed on second run');
    });
  });
});

// ── Gemini CLI (~/.gemini/settings.json) ──────────────────────────────────────

test('8. ~/.gemini/settings.json: registers sigmap when file exists', () => {
  withTempDir((dir) => {
    withTempDir((fakeHome) => {
      const geminiDir = path.join(fakeHome, '.gemini');
      fs.mkdirSync(geminiDir);
      fs.writeFileSync(path.join(geminiDir, 'settings.json'), JSON.stringify({}));
      runSetup(dir, { HOME: fakeHome });
      const result = JSON.parse(fs.readFileSync(path.join(geminiDir, 'settings.json'), 'utf8'));
      assert.ok(result.mcpServers && result.mcpServers.sigmap, 'sigmap entry missing from ~/.gemini/settings.json');
    });
  });
});

test('9. ~/.gemini/settings.json: idempotent', () => {
  withTempDir((dir) => {
    withTempDir((fakeHome) => {
      const geminiDir = path.join(fakeHome, '.gemini');
      fs.mkdirSync(geminiDir);
      fs.writeFileSync(path.join(geminiDir, 'settings.json'), JSON.stringify({}));
      runSetup(dir, { HOME: fakeHome });
      const after1 = fs.readFileSync(path.join(geminiDir, 'settings.json'), 'utf8');
      runSetup(dir, { HOME: fakeHome });
      const after2 = fs.readFileSync(path.join(geminiDir, 'settings.json'), 'utf8');
      assert.strictEqual(after1, after2, 'changed on second run');
    });
  });
});

// ── Codex CLI (~/.codex/config.yaml) ─────────────────────────────────────────

test('10. ~/.codex/config.yaml: registers sigmap when file exists', () => {
  withTempDir((dir) => {
    withTempDir((fakeHome) => {
      const codexDir = path.join(fakeHome, '.codex');
      fs.mkdirSync(codexDir);
      fs.writeFileSync(path.join(codexDir, 'config.yaml'), '# Codex config\nmodel: o4-mini\n');
      runSetup(dir, { HOME: fakeHome });
      const content = fs.readFileSync(path.join(codexDir, 'config.yaml'), 'utf8');
      assert.ok(content.includes('sigmap'), 'sigmap not found in ~/.codex/config.yaml');
      assert.ok(content.includes('mcpServers:'), 'mcpServers block missing');
      assert.ok(content.includes('command: node'), 'command: node missing');
      assert.ok(content.includes('--mcp'), '--mcp arg missing');
    });
  });
});

test('11. ~/.codex/config.yaml: idempotent — second run does not duplicate', () => {
  withTempDir((dir) => {
    withTempDir((fakeHome) => {
      const codexDir = path.join(fakeHome, '.codex');
      fs.mkdirSync(codexDir);
      fs.writeFileSync(path.join(codexDir, 'config.yaml'), '# Codex config\n');
      runSetup(dir, { HOME: fakeHome });
      const after1 = fs.readFileSync(path.join(codexDir, 'config.yaml'), 'utf8');
      runSetup(dir, { HOME: fakeHome });
      const after2 = fs.readFileSync(path.join(codexDir, 'config.yaml'), 'utf8');
      assert.strictEqual(after1, after2, 'config.yaml changed on second run — not idempotent');
    });
  });
});

test('12. ~/.codex/config.yaml: skipped when file does not exist', () => {
  withTempDir((dir) => {
    withTempDir((fakeHome) => {
      runSetup(dir, { HOME: fakeHome });
      assert.ok(!fs.existsSync(path.join(fakeHome, '.codex', 'config.yaml')), 'config.yaml must not be created');
    });
  });
});

// ── Existing targets still work ───────────────────────────────────────────────

test('13. .claude/settings.json: still registered (existing target unchanged)', () => {
  withTempDir((dir) => {
    const claudeDir = path.join(dir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({}));
    runSetup(dir);
    const result = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    assert.ok(result.mcpServers && result.mcpServers.sigmap, 'sigmap missing from .claude/settings.json');
  });
});

test('14. .cursor/mcp.json: still registered (existing target unchanged)', () => {
  withTempDir((dir) => {
    const cursorDir = path.join(dir, '.cursor');
    fs.mkdirSync(cursorDir);
    fs.writeFileSync(path.join(cursorDir, 'mcp.json'), JSON.stringify({}));
    runSetup(dir);
    const result = JSON.parse(fs.readFileSync(path.join(cursorDir, 'mcp.json'), 'utf8'));
    assert.ok(result.mcpServers && result.mcpServers.sigmap, 'sigmap missing from .cursor/mcp.json');
  });
});

// ── Snippet output ─────────────────────────────────────────────────────────────

test('15. --setup snippet output mentions VS Code / OpenCode / Gemini CLI', () => {
  withTempDir((dir) => {
    const result = runSetup(dir);
    const out = result.stderr + result.stdout;
    assert.ok(out.includes('VS Code') || out.includes('OpenCode') || out.includes('Gemini'), `snippet output does not mention new targets:\n${out.slice(0, 500)}`);
  });
});

test('16. --setup snippet output includes Codex CLI YAML block', () => {
  withTempDir((dir) => {
    const result = runSetup(dir);
    const out = result.stderr + result.stdout;
    assert.ok(out.includes('config.yaml') || out.includes('Codex CLI') || out.includes('mcpServers:'), `Codex CLI snippet missing:\n${out.slice(0, 500)}`);
  });
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n--- setup-mcp-targets ---');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
