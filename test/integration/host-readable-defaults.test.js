'use strict';

/**
 * #995 — instruction files the host can read, and a stated MCP default.
 *
 * Two defaults handed a host more than it will read:
 *
 *   - the `codex` and `claude` outputs wrote their whole map. Codex loads at most
 *     `project_doc_max_bytes` of an AGENTS.md (32 KiB unless its config.toml says
 *     otherwise) and cuts the rest in silence; Claude Code asks for a short CLAUDE.md;
 *   - a plain `sigmap mcp install claude` advertises all 22 tools, and no page said
 *     that the 7-tool `core` profile is something `--init` writes, not something an
 *     install does.
 *
 * Pinned here:
 *   1. the limit for each host, and where it comes from
 *   2. a map over 32 KiB gives an AGENTS.md at or under it and a CLAUDE.md at or under
 *      200 lines, with the lines a person wrote above SigMap's block intact
 *   3. the host's own `project_doc_max_bytes` is honoured, and 0 turns the cap off
 *   4. lines above the block that already exceed the limit are said, not hidden
 *   5. the written file is stable from one run to the next
 *   6. `sigmap doctor` reports each instruction file against its limit
 *   7. the npm tarball does not carry SigMap's own AGENTS.md
 *   8. the tool count a fresh `mcp install` advertises is the count the docs state,
 *      and the install writes no config key
 *
 * Every test that runs the CLI points CODEX_HOME at an empty directory: a developer's
 * own ~/.codex/config.toml must not decide what this suite expects.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const hl = require(path.join(ROOT, 'src', 'util', 'host-limits'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-hostlimits-'));
const EMPTY_CODEX_HOME = path.join(tmpRoot, 'codex-home-empty');
fs.mkdirSync(EMPTY_CODEX_HOME, { recursive: true });
let counter = 0;

/** A repo with 168 small files, so the whole map is far over 32 KiB. */
function bigRepo(extra = {}, depCount = 0) {
  const dir = path.join(tmpRoot, `big${counter++}`);
  fs.mkdirSync(dir, { recursive: true });
  for (let m = 0; m < 12; m++) {
    const d = path.join(dir, 'src', `mod${m}`);
    fs.mkdirSync(d, { recursive: true });
    for (let i = 0; i < 14; i++) {
      const names = [];
      let body = '';
      for (let k = 0; k < 6; k++) {
        names.push(`handle_${m}_${i}_${k}`);
        body += `function handle_${m}_${i}_${k}(request, response, options) { return request + response + options; }\n`;
      }
      fs.writeFileSync(path.join(d, `file${i}.js`), `${body}module.exports = { ${names.join(', ')} };\n`);
    }
  }
  // declared dependencies are listed in the map whatever files it keeps, so a package with many
  // of them gives the optional sections more weight than a tight limit can hold
  const dependencies = {};
  for (let i = 0; i < depCount; i++) dependencies[`left-pad-${String(i).padStart(3, '0')}`] = `^1.${i}.0`;
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'big', version: '1.0.0', ...(depCount ? { dependencies } : {}) }));
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ outputs: ['copilot', 'codex', 'claude'], srcDirs: ['src'], ...extra }));
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Project notes\n\nHuman line one.\nHuman line two.\n');
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Agents\n\nBe careful.\n');
  return dir;
}

function sigmap(dir, args = [], env = {}) {
  return spawnSync('node', [SCRIPT, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, CODEX_HOME: EMPTY_CODEX_HOME, ...env } });
}
function generate(dir, env) {
  const res = sigmap(dir, [], env);
  assert.strictEqual(res.status, 0, `generation failed:\n${res.stdout}${res.stderr}`);
  return res;
}
const bytes = (file) => fs.statSync(file).size;
const lines = (file) => fs.readFileSync(file, 'utf8').split('\n').length;
const stampless = (text) => text.split('\n').filter((l) => !/^<!-- Updated: /.test(l)).join('\n');

// ---------------------------------------------------------------------------
// 1. The limits
// ---------------------------------------------------------------------------
test('Codex: 32 KiB by default, the host config.toml when it sets one, the project key over both, 0 for off', () => {
  assert.deepStrictEqual([hl.hostLimit('codex', {}, { CODEX_HOME: EMPTY_CODEX_HOME }).max, hl.hostLimit('codex', {}, { CODEX_HOME: EMPTY_CODEX_HOME }).unit], [32768, 'bytes']);
  const home = path.join(tmpRoot, 'codex-home-set');
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, 'config.toml'), '# user settings\nmodel = "x"\nproject_doc_max_bytes = 65_536  # bigger\n');
  assert.strictEqual(hl.hostLimit('codex', {}, { CODEX_HOME: home }).max, 65536);
  assert.ok(/config\.toml/.test(hl.hostLimit('codex', {}, { CODEX_HOME: home }).source));
  assert.strictEqual(hl.hostLimit('codex', { codexMaxBytes: 10000 }, { CODEX_HOME: home }).max, 10000, 'the project key wins');
  assert.strictEqual(hl.hostLimit('codex', { codexMaxBytes: 0 }, { CODEX_HOME: home }), null, '0 turns the cap off');
  fs.writeFileSync(path.join(home, 'config.toml'), 'project_doc_max_bytes = "lots"\n');
  assert.strictEqual(hl.hostLimit('codex', {}, { CODEX_HOME: home }).max, 32768, 'a value that is not a number falls back to the default');
});

test('Claude Code: 200 lines by default, the project key over it, 0 for off; other targets have no limit', () => {
  assert.deepStrictEqual([hl.hostLimit('claude', {}).max, hl.hostLimit('claude', {}).unit], [200, 'lines']);
  assert.strictEqual(hl.hostLimit('claude', { claudeMaxLines: 90 }).max, 90);
  assert.strictEqual(hl.hostLimit('claude', { claudeMaxLines: 0 }), null);
  assert.strictEqual(hl.hostLimit('copilot', {}), null);
});

// ---------------------------------------------------------------------------
// 2-5. What gets written
// ---------------------------------------------------------------------------
test('a map over 32 KiB gives an AGENTS.md at or under 32 KiB and a CLAUDE.md at or under 200 lines', () => {
  const dir = bigRepo();
  const res = generate(dir);
  const whole = bytes(path.join(dir, '.github', 'copilot-instructions.md'));
  assert.ok(whole > 40000, `the fixture's whole map must exceed the limit for this to prove anything, got ${whole}`);
  assert.ok(bytes(path.join(dir, 'AGENTS.md')) <= 32768, `AGENTS.md is ${bytes(path.join(dir, 'AGENTS.md'))} bytes`);
  assert.ok(lines(path.join(dir, 'CLAUDE.md')) <= 200, `CLAUDE.md is ${lines(path.join(dir, 'CLAUDE.md'))} lines`);
  assert.ok(/AGENTS\.md: kept \d+ of 168 files to fit Codex's limit of 32\.0 KiB/.test(res.stderr + res.stdout), res.stderr);
  assert.ok(/CLAUDE\.md: kept \d+ of 168 files to fit Claude Code's limit of 200 lines/.test(res.stderr + res.stdout), res.stderr);
  // the sized files are not empty shells
  assert.ok(/handle_\d+_\d+_\d+/.test(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')));
});

test('the lines a person wrote above SigMap\'s block survive, and the index still holds every file', () => {
  const dir = bigRepo();
  generate(dir);
  assert.ok(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8').startsWith('# Project notes\n\nHuman line one.\nHuman line two.\n'));
  assert.ok(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8').startsWith('# Agents\n\nBe careful.\n'));
  const idx = JSON.parse(fs.readFileSync(path.join(dir, '.context', 'sig-index.json'), 'utf8')).files;
  assert.strictEqual(Object.keys(idx).filter((f) => f.startsWith('src/')).length, 168, 'every file stays reachable through sigmap ask');
});

test('a run without codex or claude outputs is exactly what it was', () => {
  const dir = bigRepo({ outputs: ['copilot'] });
  const before = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  const res = generate(dir);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), before, 'AGENTS.md is untouched when it is not an output');
  assert.ok(!/to fit/.test(res.stderr), res.stderr);
});

test('the host\'s own project_doc_max_bytes is honoured, and codexMaxBytes: 0 writes the whole map', () => {
  // 40,000 sits between Codex's default and the fixture's whole map (about 54 KB), so only a writer
  // that reads the host's setting lands in the gap
  const home = path.join(tmpRoot, 'codex-home-40k');
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, 'config.toml'), 'project_doc_max_bytes = 40000\n');
  const dir = bigRepo();
  generate(dir, { CODEX_HOME: home });
  const size = bytes(path.join(dir, 'AGENTS.md'));
  assert.ok(size > 32768 && size <= 40000, `AGENTS.md is ${size} bytes`);

  const off = bigRepo({ codexMaxBytes: 0, claudeMaxLines: 0 });
  generate(off);
  assert.ok(bytes(path.join(off, 'AGENTS.md')) > 40000, 'cap off: the whole map');
  assert.ok(lines(path.join(off, 'CLAUDE.md')) > 200, 'cap off: the whole map');
});

test('lines above the block that already exceed the limit are said, and the block shrinks to its header', () => {
  const dir = bigRepo();
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Agents\n\n' + 'Human guidance line that goes on and on and on.\n'.repeat(900));
  const res = generate(dir);
  assert.ok(/AGENTS\.md: .* with no signatures at all .* already over Codex's limit/.test(res.stderr + res.stdout), res.stderr);
  assert.ok(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8').includes('Human guidance line'), 'the human lines are never discarded');
});

test('the room a limit leaves is used: a tight limit keeps some files, not none', () => {
  const dir = bigRepo({ claudeMaxLines: 120 });
  const res = generate(dir);
  const n = lines(path.join(dir, 'CLAUDE.md'));
  assert.ok(n <= 120, `CLAUDE.md is ${n} lines`);
  assert.ok(n >= 100, `the limit leaves room for files and ${120 - n} lines are unused`);
  assert.ok(!/kept 0 of/.test(res.stderr + res.stdout), res.stderr);
});

test('the optional sections give way before a tight limit does, for that file only', () => {
  const dir = bigRepo({ claudeMaxLines: 50 }, 150);
  const res = generate(dir);
  const claude = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
  assert.ok(claude.split('\n').length <= 50, `CLAUDE.md is ${claude.split('\n').length} lines`);
  assert.ok(!/^## dependencies/m.test(claude), 'the declared-dependencies section is left out of the file that cannot hold it');
  assert.ok(/without the deps, todos and changes sections/.test(res.stderr + res.stdout), res.stderr);
  assert.ok(/^## dependencies/m.test(fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8')), 'every other output keeps it');
});

test('the sized files are the same from one run to the next', () => {
  const dir = bigRepo();
  generate(dir);
  const first = ['AGENTS.md', 'CLAUDE.md'].map((f) => stampless(fs.readFileSync(path.join(dir, f), 'utf8')));
  generate(dir);
  const second = ['AGENTS.md', 'CLAUDE.md'].map((f) => stampless(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.deepStrictEqual(second, first);
});

// ---------------------------------------------------------------------------
// 6. doctor
// ---------------------------------------------------------------------------
test('doctor reports each instruction file against its limit, warns when one is over, and is quiet once it fits', () => {
  const dir = bigRepo({ outputs: ['copilot'] });
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Agents\n' + 'x'.repeat(60000) + '\n');
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Notes\n' + 'line\n'.repeat(300));
  generate(dir);
  const check = (d) => JSON.parse(sigmap(d, ['doctor', '--json']).stdout).checks.find((c) => c.id === 'instructions');
  const over = check(dir);
  assert.ok(over, 'doctor has an Instruction files row');
  assert.strictEqual(over.status, 'warn');
  assert.ok(/AGENTS\.md 58\.6 KiB of 32\.0 KiB/.test(over.detail), over.detail);
  assert.ok(/CLAUDE\.md 30\d lines of 200 lines/.test(over.detail), over.detail);
  assert.ok(/reads the first 32\.0 KiB and cuts the rest/.test(over.detail), over.detail);

  const fits = bigRepo();
  generate(fits);
  const ok = check(fits);
  assert.strictEqual(ok.status, 'ok', ok.detail);
  assert.ok(/AGENTS\.md [\d.]+ KiB of 32\.0 KiB/.test(ok.detail) && /CLAUDE\.md \d+ lines of 200 lines/.test(ok.detail), ok.detail);
});

// ---------------------------------------------------------------------------
// 7. The tarball
// ---------------------------------------------------------------------------
test('the npm tarball carries no AGENTS.md: a package\'s own is read by no host', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(!pkg.files.includes('AGENTS.md'), 'package.json "files" lists AGENTS.md');
  const res = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr);
  const packed = JSON.parse(res.stdout)[0].files.map((f) => f.path);
  assert.ok(!packed.includes('AGENTS.md'), 'the tarball contains AGENTS.md');
  assert.ok(packed.includes('src/util/host-limits.js'), 'and does contain the new module');
});

// ---------------------------------------------------------------------------
// 8. The MCP default
// ---------------------------------------------------------------------------
function listTools(dir) {
  const input = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' }].map((m) => JSON.stringify(m)).join('\n') + '\n';
  const res = spawnSync(process.execPath, [SCRIPT, '--mcp'], { cwd: dir, input, encoding: 'utf8', timeout: 30000 });
  const replies = res.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return replies.find((r) => r.id === 2).result.tools;
}

test('a fresh `mcp install` writes no config key, advertises the tool count the docs state, and the docs say so', () => {
  const dir = path.join(tmpRoot, 'mcp-fresh');
  const home = path.join(tmpRoot, 'mcp-home');
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"m","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function a(x) { return x; }\nmodule.exports = { a };\n');
  spawnSync('git', ['init', '-q'], { cwd: dir });
  const inst = spawnSync('node', [SCRIPT, 'mcp', 'install', 'claude'], { cwd: dir, encoding: 'utf8', env: { ...process.env, HOME: home, CODEX_HOME: EMPTY_CODEX_HOME } });
  assert.strictEqual(inst.status, 0, inst.stdout + inst.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.mcp.json')), 'the install registered the server');
  assert.ok(!fs.existsSync(path.join(dir, 'gen-context.config.json')), 'the install must not write a SigMap config key into the repository');

  const advertised = listTools(dir).length;
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ mcp: { tools: 'core' } }));
  const core = listTools(dir).length;
  assert.ok(advertised > core && core > 0, `${advertised} vs ${core}`);

  const mcpMd = fs.readFileSync(path.join(ROOT, 'docs-vp', 'guide', 'mcp.md'), 'utf8');
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(new RegExp(`all ${advertised} tools`).test(mcpMd), `mcp.md must say a default server advertises ${advertised} tools`);
  assert.ok(new RegExp(`\\| \`"core"\` \\| ${core} `).test(mcpMd), `mcp.md must say the core profile advertises ${core}`);
  assert.ok(new RegExp(`${advertised} MCP tools by default`).test(readme), `the README must say ${advertised} tools by default`);
  assert.ok(/`sigmap mcp install` does not choose a profile/.test(mcpMd) && /`sigmap --init` is what writes/.test(mcpMd), 'mcp.md says the install path advertises everything and --init writes the profile');
});

try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}

console.log(`\nhost-readable-defaults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
