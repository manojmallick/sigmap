'use strict';

/**
 * Per-client MCP install (v8.0 E4).
 *
 * `sigmap --setup` wires *every* known editor at once and only touches config
 * files that already exist (to avoid creating clutter for editors the user does
 * not use). This module is the targeted counterpart: `sigmap mcp install <client>`
 * picks one client, and — because the user explicitly asked for it — CREATES the
 * config dir/file if it is missing. Idempotent: re-running never duplicates the
 * entry. Zero dependencies; only `fs`/`path`/`os`.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { spawnSync } = require('child_process');

// Config shapes the supported clients use.
//  - 'json'  → { mcpServers: { sigmap: { command, args } } }
//  - 'vscode'→ { servers: { sigmap: { type: 'stdio', command, args } } }
//  - 'zed'   → { context_servers: { sigmap: { command: { path, args } } } }
//  - 'opencode' → { mcp: { sigmap: { type: 'local', command: [...] } } }
//  - 'codex' → Codex CLI ~/.codex/config.toml ([mcp_servers.sigmap])
const CLIENTS = {
  claude:   { label: 'Claude Code',  format: 'json', scope: 'project', project: ['.mcp.json'] },
  cursor:   { label: 'Cursor',       format: 'json', scope: 'project', project: ['.cursor', 'mcp.json'] },
  windsurf: { label: 'Windsurf',     format: 'json', scope: 'both',
              project: ['.windsurf', 'mcp.json'],
              global:  ['.codeium', 'windsurf', 'mcp_config.json'] },
  vscode:   { label: 'VS Code',      format: 'vscode', scope: 'project', project: ['.vscode', 'mcp.json'] },
  opencode: { label: 'OpenCode',     format: 'opencode', scope: 'both',
              project: ['opencode.json'],
              global:  ['.config', 'opencode', 'opencode.json'] },
  gemini:   { label: 'Gemini CLI',   format: 'json', scope: 'global', global: ['.gemini', 'settings.json'] },
  zed:      { label: 'Zed',          format: 'zed',  scope: 'global', global: ['.config', 'zed', 'settings.json'] },
  codex:    { label: 'Codex CLI',    format: 'codex', scope: 'global', global: ['.codex', 'config.toml'] },
  mcp:      { label: 'Portable (.mcp.json)', format: 'json', scope: 'project', project: ['.mcp.json'] },
};

/** Resolve the absolute config path for a client, honoring `global`. */
function resolveTarget(spec, cwd, home, useGlobal) {
  const wantGlobal = useGlobal || spec.scope === 'global';
  if (wantGlobal && spec.global) return path.join(home, ...spec.global);
  if (spec.project) return path.join(cwd, ...spec.project);
  if (spec.global)  return path.join(home, ...spec.global);
  return null;
}

/** List supported clients with their resolved target paths. */
function listClients(opts = {}) {
  const cwd  = opts.cwd  || process.cwd();
  const home = opts.home || os.homedir();
  const codexHome = path.resolve(cwd, opts.codexHome || (opts.env || process.env).CODEX_HOME || path.join(home, '.codex'));
  return Object.keys(CLIENTS).map((key) => {
    const spec = CLIENTS[key];
    const target = key === 'codex' ? path.join(codexHome, 'config.toml') : resolveTarget(spec, cwd, home, false);
    return {
      client: key,
      label:  spec.label,
      scope:  spec.scope,
      format: spec.format,
      target,
      globalTarget: spec.scope === 'both' ? resolveTarget(spec, cwd, home, true) : null,
    };
  });
}

function serverArgs(scriptPath, portable = false) {
  return portable ? ['-y', 'sigmap', '--mcp'] : [path.resolve(scriptPath), '--mcp'];
}

function _readJsonObject(filePath) {
  let settings;
  try { settings = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (err) { throw new Error(`Invalid JSON in ${filePath}: ${err.message}`); }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error(`Invalid JSON in ${filePath}: expected a top-level object`);
  }
  return settings;
}

/** Install into a JSON `mcpServers` config (create file/dir if absent). */
function _installJson(filePath, scriptPath, portable = false, rejectInvalid = false) {
  let settings = {};
  if (fs.existsSync(filePath)) {
    if (rejectInvalid) settings = _readJsonObject(filePath);
    else try { settings = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {}; }
    catch (err) {
      settings = {};
    }
  }
  if (rejectInvalid && settings.mcpServers !== undefined &&
      (!settings.mcpServers || typeof settings.mcpServers !== 'object' || Array.isArray(settings.mcpServers))) {
    throw new Error(`Invalid JSON in ${filePath}: mcpServers must be an object`);
  }
  if (!settings.mcpServers) settings.mcpServers = {};
  if (settings.mcpServers.sigmap) return 'already';
  settings.mcpServers.sigmap = {
    command: portable ? 'npx' : 'node',
    args: serverArgs(scriptPath, portable),
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
  return 'installed';
}

/**
 * Install into VS Code's `.vscode/mcp.json`, which keys servers under `servers`
 * (not `mcpServers`) and expects an explicit transport `type`. A config written
 * by an older SigMap under `mcpServers` is migrated rather than left in place,
 * so re-running repairs it instead of leaving two entries VS Code cannot read.
 */
function _installVscode(filePath, scriptPath) {
  let settings = {};
  if (fs.existsSync(filePath)) {
    try { settings = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {}; }
    catch (_) { settings = {}; }
  }
  const stale = settings.mcpServers && settings.mcpServers.sigmap;
  if (stale) {
    delete settings.mcpServers.sigmap;
    if (Object.keys(settings.mcpServers).length === 0) delete settings.mcpServers;
  }
  if (!settings.servers) settings.servers = {};
  if (settings.servers.sigmap && !stale) return 'already';
  settings.servers.sigmap = { type: 'stdio', command: 'node', args: serverArgs(scriptPath) };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
  return stale ? 'updated' : 'installed';
}

/** Install into Zed's `context_servers` config (create file/dir if absent). */
function _installZed(filePath, scriptPath) {
  let settings = {};
  if (fs.existsSync(filePath)) {
    try { settings = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {}; }
    catch (_) { settings = {}; }
  }
  if (!settings.context_servers) settings.context_servers = {};
  if (settings.context_servers.sigmap) return 'already';
  settings.context_servers.sigmap = { command: { path: 'node', args: serverArgs(scriptPath) } };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
  return 'installed';
}

function _removeLegacyClaudeEntry(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let settings;
  try { settings = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {}; }
  catch (_) { return false; }
  if (!settings.mcpServers || !settings.mcpServers.sigmap) return false;
  delete settings.mcpServers.sigmap;
  if (Object.keys(settings.mcpServers).length === 0) delete settings.mcpServers;
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
  return true;
}

function _removeLegacyOpenCodeEntry(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let settings;
  try { settings = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {}; }
  catch (_) { return false; }
  if (!settings.mcpServers || !settings.mcpServers.sigmap) return false;
  delete settings.mcpServers.sigmap;
  if (Object.keys(settings.mcpServers).length === 0) delete settings.mcpServers;
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
  return true;
}

/** Remove only the old SigMap block written to Codex's ignored YAML path. */
function _removeLegacyCodexYaml(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const root = lines.findIndex((line) => /^mcpServers:\s*(?:#.*)?$/.test(line));
  if (root === -1) return false;
  const endRoot = lines.findIndex((line, i) => i > root && /^\S/.test(line) && !/^\s*#/.test(line));
  const limit = endRoot === -1 ? lines.length : endRoot;
  const entry = lines.findIndex((line, i) => i > root && i < limit && /^  sigmap:\s*(?:#.*)?$/.test(line));
  if (entry === -1) return false;
  let end = entry + 1;
  while (end < limit && !/^ {0,2}\S/.test(lines[end])) end++;
  lines.splice(entry, end - entry);
  const nextRoot = lines.findIndex((line, i) => i > root && /^\S/.test(line) && !/^\s*#/.test(line));
  const afterRoot = nextRoot === -1 ? lines.length : nextRoot;
  if (!lines.slice(root + 1, afterRoot).some((line) => /^  \S/.test(line))) lines.splice(root, 1);
  fs.writeFileSync(filePath, lines.join('\n').replace(/\n*$/, '\n'));
  return true;
}

/** Install into Codex CLI TOML and migrate SigMap out of its former YAML file. */
function _installCodex(filePath, legacyYamlPath) {
  let raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const hasEntry = /^\[mcp_servers\.sigmap\]\s*$/m.test(raw);
  if (!hasEntry) {
    const block = [
      '[mcp_servers.sigmap]',
      'command = "npx"',
      'args = ["-y", "sigmap", "--mcp"]',
    ].join('\n');
    raw = raw ? raw.trimEnd() + '\n\n' + block + '\n' : block + '\n';
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, raw);
  }
  const migrated = _removeLegacyCodexYaml(legacyYamlPath);
  return migrated ? 'updated' : hasEntry ? 'already' : 'installed';
}

/** Install OpenCode's documented `mcp` local-server shape. */
function _installOpenCode(filePath) {
  let settings = {};
  if (fs.existsSync(filePath)) settings = _readJsonObject(filePath);
  let migrated = false;
  if (settings.mcpServers && settings.mcpServers.sigmap) {
    delete settings.mcpServers.sigmap;
    if (Object.keys(settings.mcpServers).length === 0) delete settings.mcpServers;
    migrated = true;
  }
  if (settings.mcp === undefined) settings.mcp = {};
  else if (!settings.mcp || typeof settings.mcp !== 'object' || Array.isArray(settings.mcp)) {
    throw new Error(`Invalid JSON in ${filePath}: mcp must be an object`);
  }
  if (settings.mcp.sigmap) {
    if (!migrated) return 'already';
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
    return 'updated';
  }
  settings.mcp.sigmap = { type: 'local', command: ['npx', '-y', 'sigmap', '--mcp'], enabled: true };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
  return migrated ? 'updated' : 'installed';
}

const HOST_READERS = {
  claude: { command: 'claude', args: ['mcp', 'list'], hint: 'Run `claude mcp list` and approve SigMap on first use.' },
  codex: { command: 'codex', args: ['mcp', 'list'], hint: 'Run `codex mcp list` and confirm SigMap is enabled.' },
  opencode: { command: 'opencode', args: ['mcp', 'list'], hint: 'Run `opencode mcp list` and confirm SigMap is listed.' },
};

/** Verify a client-specific install through the host CLI when it is available. */
function verifyClient(client, opts = {}) {
  const reader = HOST_READERS[client];
  if (!reader) return { status: 'not-applicable' };
  const result = spawnSync(reader.command, reader.args, {
    cwd: opts.cwd || process.cwd(),
    env: opts.env || process.env,
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true,
    shell: process.platform === 'win32',
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if ((result.error && result.error.code === 'ENOENT') || result.status === 127 || /is not recognized as (?:a name of a cmdlet|an internal or external command)|command not found/i.test(output)) {
    return { status: 'unavailable', command: reader.command, hint: reader.hint };
  }
  if (result.error || result.status !== 0) {
    return { status: 'failed', command: reader.command, reason: `${reader.command} mcp list failed` };
  }
  const lines = output.split(/\r?\n/);
  const entry = lines.find((line) => /\bsigmap\b/i.test(line));
  if (!entry || (client === 'opencode' && /\bfailed:/i.test(entry))) {
    return { status: 'failed', command: reader.command, reason: `${reader.command} mcp list did not report a usable SigMap server` };
  }
  return { status: 'verified', command: reader.command };
}

/**
 * Install the sigmap MCP server for a single client.
 * @returns { client, label, path, status } where status is
 *   'installed' | 'already' | 'unknown'.
 */
function installClient(client, opts = {}) {
  const spec = CLIENTS[client];
  if (!spec) {
    return { client, status: 'unknown', valid: Object.keys(CLIENTS) };
  }
  const cwd        = opts.cwd  || process.cwd();
  const home       = opts.home || os.homedir();
  const env        = opts.env || process.env;
  const scriptPath = opts.scriptPath || path.join(cwd, 'gen-context.js');
  const codexHome  = path.resolve(cwd, env.CODEX_HOME || path.join(home, '.codex'));
  const filePath   = client === 'codex' ? path.join(codexHome, 'config.toml') : resolveTarget(spec, cwd, home, opts.global);

  let status;
  if (spec.format === 'vscode')       status = _installVscode(filePath, scriptPath);
  else if (spec.format === 'zed')     status = _installZed(filePath, scriptPath);
  else if (spec.format === 'codex')   status = _installCodex(filePath, path.join(codexHome, 'config.yaml'));
  else if (spec.format === 'opencode') {
    const legacyPath = opts.global ? path.join(home, '.config', 'opencode', 'config.json') : null;
    status = _installOpenCode(filePath);
    const migratedLegacy = legacyPath && _removeLegacyOpenCodeEntry(legacyPath);
    if (migratedLegacy) status = 'updated';
  }
  else {
    status = _installJson(filePath, scriptPath, client === 'claude', client === 'claude');
    const migrated = client === 'claude' && _removeLegacyClaudeEntry(path.join(cwd, '.claude', 'settings.json'));
    if (migrated) status = 'updated';
  }

  return { client, label: spec.label, path: filePath, status };
}

module.exports = { CLIENTS, listClients, installClient, resolveTarget, verifyClient };
