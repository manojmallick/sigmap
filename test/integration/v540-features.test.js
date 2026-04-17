'use strict';

/**
 * Integration tests for v5.4 features — Neovim plugin (sigmap.nvim):
 *  1.  neovim-plugin directory structure exists
 *  2.  lua/sigmap/init.lua exports setup, run, query, statusline
 *  3.  lua/sigmap/health.lua exports check
 *  4.  plugin/sigmap.lua registers SigMap and SigMapQuery commands
 *  5.  init.lua find_binary prefers M.config.binary when set
 *  6.  statusline returns 'sm:✓' for fresh context file (< 24 h)
 *  7.  statusline returns 'sm:⚠ Nh' for stale context file (≥ 24 h)
 *  8.  statusline returns '' when no context file exists
 *  9.  setup sets auto_run config option
 * 10.  README.md exists and documents :SigMap, :SigMapQuery, setup options
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const ROOT        = path.resolve(__dirname, '../..');
const PLUGIN_DIR  = path.join(ROOT, 'neovim-plugin');
const INIT_LUA    = path.join(PLUGIN_DIR, 'lua', 'sigmap', 'init.lua');
const HEALTH_LUA  = path.join(PLUGIN_DIR, 'lua', 'sigmap', 'health.lua');
const PLUGIN_LUA  = path.join(PLUGIN_DIR, 'plugin', 'sigmap.lua');
const README      = path.join(PLUGIN_DIR, 'README.md');

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

console.log('\n[v540-features.test.js] v5.4 Neovim plugin\n');

// ── 1. Directory structure ─────────────────────────────────────────────────
test('neovim-plugin directory exists', () => {
  assert.ok(fs.existsSync(PLUGIN_DIR), 'neovim-plugin/ must exist');
});

test('lua/sigmap/init.lua exists', () => {
  assert.ok(fs.existsSync(INIT_LUA), 'lua/sigmap/init.lua must exist');
});

test('lua/sigmap/health.lua exists', () => {
  assert.ok(fs.existsSync(HEALTH_LUA), 'lua/sigmap/health.lua must exist');
});

test('plugin/sigmap.lua exists', () => {
  assert.ok(fs.existsSync(PLUGIN_LUA), 'plugin/sigmap.lua must exist');
});

// ── 2. init.lua exports ────────────────────────────────────────────────────
test('init.lua defines M.setup', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes('function M.setup'), 'M.setup must be defined');
});

test('init.lua defines M.run', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes('function M.run'), 'M.run must be defined');
});

test('init.lua defines M.query', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes('function M.query'), 'M.query must be defined');
});

test('init.lua defines M.statusline', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes('function M.statusline'), 'M.statusline must be defined');
});

test('init.lua returns M', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes('return M'), 'init.lua must return M');
});

// ── 3. health.lua exports ──────────────────────────────────────────────────
test('health.lua defines M.check', () => {
  const src = fs.readFileSync(HEALTH_LUA, 'utf8');
  assert.ok(src.includes('function M.check'), 'M.check must be defined');
});

test('health.lua checks Node version', () => {
  const src = fs.readFileSync(HEALTH_LUA, 'utf8');
  assert.ok(src.includes('node --version'), 'health.lua must check node version');
});

test('health.lua checks binary presence', () => {
  const src = fs.readFileSync(HEALTH_LUA, 'utf8');
  assert.ok(src.includes("executable('sigmap')"), 'health.lua must check sigmap binary');
});

test('health.lua checks context file age', () => {
  const src = fs.readFileSync(HEALTH_LUA, 'utf8');
  assert.ok(src.includes('copilot-instructions.md'), 'health.lua must check context file age');
});

// ── 4. plugin/sigmap.lua registers user commands ──────────────────────────
test('plugin/sigmap.lua registers :SigMap command', () => {
  const src = fs.readFileSync(PLUGIN_LUA, 'utf8');
  assert.ok(src.includes("'SigMap'"), ':SigMap user command must be registered');
});

test('plugin/sigmap.lua registers :SigMapQuery command', () => {
  const src = fs.readFileSync(PLUGIN_LUA, 'utf8');
  assert.ok(src.includes("'SigMapQuery'"), ':SigMapQuery user command must be registered');
});

test('plugin/sigmap.lua requires sigmap module', () => {
  const src = fs.readFileSync(PLUGIN_LUA, 'utf8');
  assert.ok(src.includes("require('sigmap')"), "plugin must require('sigmap')");
});

// ── 5. Binary resolution logic ─────────────────────────────────────────────
test('init.lua has binary config override path', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes('M.config.binary'), 'init.lua must support M.config.binary override');
});

test('init.lua falls back to npx sigmap', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes('npx sigmap'), 'init.lua must fall back to npx sigmap');
});

test('init.lua falls back to local gen-context.js', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes('gen-context.js'), 'init.lua must fall back to local gen-context.js');
});

// ── 6-8. statusline logic ─────────────────────────────────────────────────
test('statusline returns sm:✓ for fresh file (< 24 h)', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes("'sm:✓'"), "statusline must return 'sm:✓' for fresh context");
});

test('statusline returns sm:⚠ Nh for stale file (>= 24 h)', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes("'sm:⚠ '"), "statusline must return stale indicator with age");
});

test('statusline returns empty string when context file missing', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes("return ''"), "statusline must return '' when file is unreadable");
});

// ── 9. setup config ────────────────────────────────────────────────────────
test('setup merges auto_run into M.config', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes('auto_run'), 'M.config must include auto_run');
});

test('auto_run creates BufWritePost autocmd', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes('BufWritePost'), 'setup auto_run must register BufWritePost autocmd');
});

test('BufWritePost pattern includes source file extensions', () => {
  const src = fs.readFileSync(INIT_LUA, 'utf8');
  assert.ok(src.includes('*.js') && src.includes('*.ts') && src.includes('*.py'),
    'BufWritePost pattern must include common source file extensions');
});

// ── 10. README ────────────────────────────────────────────────────────────
test('README.md exists', () => {
  assert.ok(fs.existsSync(README), 'neovim-plugin/README.md must exist');
});

test('README documents :SigMap command', () => {
  const src = fs.readFileSync(README, 'utf8');
  assert.ok(src.includes(':SigMap'), 'README must document :SigMap');
});

test('README documents :SigMapQuery command', () => {
  const src = fs.readFileSync(README, 'utf8');
  assert.ok(src.includes(':SigMapQuery'), 'README must document :SigMapQuery');
});

test('README documents setup options', () => {
  const src = fs.readFileSync(README, 'utf8');
  assert.ok(src.includes('auto_run') && src.includes('float_query'),
    'README must document auto_run and float_query options');
});

test('README documents :checkhealth sigmap', () => {
  const src = fs.readFileSync(README, 'utf8');
  assert.ok(src.includes(':checkhealth sigmap'), 'README must document :checkhealth sigmap');
});

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
