'use strict';

/**
 * Integration tests for v5.9.1 — README conversion rewrite.
 * Verifies: 15-section structure, exact benchmark numbers, no conflicting versions.
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const ROOT = path.resolve(__dirname, '../../..');

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

const src = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

console.log('\nv5.9.1 README conversion tests\n');

// ── Section 1: Title + tagline ────────────────────────────────────────────────

test('title: SigMap heading present', () => {
  assert.ok(src.includes('SigMap'), 'missing SigMap heading');
});

test('tagline: exact wording present', () => {
  assert.ok(src.includes('SigMap finds the right files before your AI answers'),
    'missing exact tagline');
});

// ── Section 2: npx demo ───────────────────────────────────────────────────────

test('demo: npx sigmap command present', () => {
  assert.ok(src.includes('npx sigmap'), 'missing npx sigmap');
});

test('demo: sigmap ask with example query present', () => {
  assert.ok(src.includes('sigmap ask'), 'missing sigmap ask');
  assert.ok(src.includes('auth'), 'missing auth in demo ask query');
});

test('demo: sigmap validate present', () => {
  assert.ok(src.includes('sigmap validate'), 'missing sigmap validate');
});

test('demo: sigmap judge present', () => {
  assert.ok(src.includes('sigmap judge'), 'missing sigmap judge');
});

// ── Section 3: What it is ─────────────────────────────────────────────────────

test('what-it-is: short explanation present', () => {
  assert.ok(src.includes('signatures') || src.includes('signature map'), 'missing signature description');
  assert.ok(src.includes('any LLM') || src.includes('any AI'), 'missing any LLM/AI phrase');
});

// ── Section 4: Why SigMap ─────────────────────────────────────────────────────

test('why: 80.0% hit@5 mentioned', () => {
  assert.ok(src.includes('80.0%'), 'missing 80.0% hit@5');
});

test('why: 13.6% baseline mentioned', () => {
  assert.ok(src.includes('13.6%'), 'missing 13.6% baseline');
});

test('why: token reduction range mentioned', () => {
  assert.ok(src.includes('40') && src.includes('98%'), 'missing 40–98% token reduction range');
});

// ── Section 5: Replace section ────────────────────────────────────────────────

test('replace: guessing files (❌) present', () => {
  assert.ok(src.includes('Guessing') || src.includes('guessing'), 'missing guessing files item');
});

test('replace: sending full repo (❌) present', () => {
  assert.ok(src.includes('full repo') || src.includes('sending the full'), 'missing full repo item');
});

test('replace: embeddings / vector DB (❌) present', () => {
  assert.ok(src.includes('embeddings') || src.includes('vector'), 'missing embeddings/vector item');
});

test('replace: correct file selection (✅) present', () => {
  assert.ok(
    src.includes('Correct file selection') || src.includes('correct file selection') ||
    src.includes('Right file in context'),
    'missing correct file selection item');
});

test('replace: minimal context (✅) present', () => {
  assert.ok(src.includes('Minimal context') || src.includes('minimal context'),
    'missing minimal context item');
});

test('replace: grounded answers (✅) present', () => {
  assert.ok(src.includes('Grounded answers') || src.includes('grounded answers'),
    'missing grounded answers item');
});

// ── Section 6: Workflow ───────────────────────────────────────────────────────

test('workflow: Ask → Rank → Context → Validate → Judge → Learn', () => {
  assert.ok(src.includes('Ask') && src.includes('Rank') && src.includes('Context') &&
            src.includes('Validate') && src.includes('Judge') && src.includes('Learn'),
    'missing workflow steps');
  assert.ok(src.includes('Ask → Rank') || src.includes('Ask →'), 'workflow not in arrow format');
});

// ── Section 7: Benchmark ─────────────────────────────────────────────────────

test('benchmark: sigmap-v6.6-main ID present', () => {
  assert.ok(src.includes('sigmap-v6.6-main'), 'missing sigmap-v6.6-main benchmark ID');
});

test('benchmark: date 2026-04-30 present', () => {
  assert.ok(src.includes('2026-04-30'), 'missing benchmark date 2026-04-30');
});

test('benchmark: Hit@5 80.0% present', () => {
  assert.ok(src.includes('80.0%'), 'missing Hit@5 80.0%');
});

test('benchmark: baseline 13.6% present', () => {
  assert.ok(src.includes('13.6%'), 'missing baseline 13.6%');
});

test('benchmark: prompt reduction 41.0% present', () => {
  assert.ok(src.includes('41.0%'), 'missing prompt reduction 41.0%');
});

test('benchmark: task success 52.2% present', () => {
  assert.ok(src.includes('52.2%'), 'missing task success 52.2%');
});

// ── Section 8: Install ────────────────────────────────────────────────────────

test('install: npx option present', () => {
  assert.ok(src.includes('npx sigmap'), 'missing npx install option');
});

test('install: npm global option present', () => {
  assert.ok(src.includes('npm install -g sigmap'), 'missing npm global install');
});

test('install: binary download links present', () => {
  assert.ok(src.includes('sigmap-darwin-arm64'), 'missing macOS ARM binary link');
  assert.ok(src.includes('sigmap-linux-x64'), 'missing Linux binary link');
});

test('install: Volta option present', () => {
  assert.ok(src.includes('volta install sigmap') || src.includes('Volta'), 'missing Volta');
});

// ── Section 9: Integrations ───────────────────────────────────────────────────

test('integrations: copilot adapter present', () => {
  assert.ok(src.includes('copilot') || src.includes('Copilot'), 'missing Copilot integration');
});

test('integrations: claude adapter present', () => {
  assert.ok(src.includes('claude') || src.includes('Claude'), 'missing Claude integration');
});

test('integrations: cursor adapter present', () => {
  assert.ok(src.includes('cursor') || src.includes('Cursor'), 'missing Cursor integration');
});

test('integrations: VS Code extension link present', () => {
  assert.ok(src.includes('VS Code'), 'missing VS Code extension');
});

test('integrations: JetBrains plugin link present', () => {
  assert.ok(src.includes('JetBrains'), 'missing JetBrains plugin');
});

test('integrations: Neovim plugin link present', () => {
  assert.ok(src.includes('Neovim') || src.includes('neovim'), 'missing Neovim plugin');
});

test('integrations: MCP server present', () => {
  assert.ok(src.includes('--mcp') || src.includes('MCP'), 'missing MCP server');
});

// ── Section 10: Try it ────────────────────────────────────────────────────────

test('try-it: section with multiple commands present', () => {
  const tryIdx = src.indexOf('Try it');
  assert.ok(tryIdx !== -1, 'missing Try it section');
  const section = src.slice(tryIdx, tryIdx + 500);
  assert.ok(section.includes('sigmap') || section.includes('npx'), 'Try it section has no commands');
});

// ── Section 11: Start guide ───────────────────────────────────────────────────

test('start-guide: New user routing present (👶)', () => {
  assert.ok(src.includes('👶') || src.includes('New'), 'missing new user guide entry');
});

test('start-guide: Daily use routing present (⚡)', () => {
  assert.ok(src.includes('⚡') || src.includes('Daily'), 'missing daily use guide entry');
});

test('start-guide: Advanced routing present (🧠)', () => {
  assert.ok(src.includes('🧠') || src.includes('Advanced'), 'missing advanced guide entry');
});

test('start-guide: Teams routing present (🏢)', () => {
  assert.ok(src.includes('🏢') || src.includes('Teams'), 'missing teams guide entry');
});

// ── Section 12: Docs link ─────────────────────────────────────────────────────

test('docs: main docs link present', () => {
  assert.ok(src.includes('manojmallick.github.io/sigmap'), 'missing docs link');
});

// ── Section 13: Support CTA ───────────────────────────────────────────────────

test('support: GitHub star CTA present', () => {
  assert.ok(src.includes('⭐') || src.includes('Star'), 'missing GitHub star CTA');
  assert.ok(src.includes('github.com/manojmallick/sigmap'), 'missing GitHub link in support');
});

// ── Section 14: Why not embeddings ────────────────────────────────────────────

test('embeddings: "No vector DB" reason present', () => {
  assert.ok(src.includes('vector DB') || src.includes('vector db') || src.includes('Vector DB'),
    'missing No vector DB');
});

test('embeddings: "No infra" reason present', () => {
  assert.ok(src.includes('infra') || src.includes('infrastructure'), 'missing No infra');
});

test('embeddings: "No drift" reason present', () => {
  assert.ok(src.includes('drift') || src.includes('Drift'), 'missing No drift');
});

test('embeddings: "Deterministic" reason present', () => {
  assert.ok(src.includes('Deterministic') || src.includes('deterministic'), 'missing Deterministic');
});

test('embeddings: "Faster" reason present', () => {
  assert.ok(src.includes('Faster') || src.includes('faster'), 'missing Faster');
});

// ── Section 15: License ───────────────────────────────────────────────────────

test('license: MIT License section present', () => {
  assert.ok(src.includes('MIT'), 'missing MIT license');
  assert.ok(src.includes('Manoj Mallick') || src.includes('manojmallick'), 'missing author in license');
});

// ── Consistency: no conflicting version numbers ───────────────────────────────

test('consistency: no stale v5.8-main benchmark ID', () => {
  assert.ok(!src.includes('sigmap-v5.8-main'), 'found stale sigmap-v5.8-main in README');
});

test('consistency: no stale v6.0-main benchmark ID', () => {
  assert.ok(!src.includes('sigmap-v6.0-main'), 'found stale sigmap-v6.0-main in README');
});

test('consistency: no stale 81.1% hit@5', () => {
  assert.ok(!src.includes('81.1%'), 'found stale 81.1% hit@5 in README');
});

test('consistency: no stale 1.69 prompts per task', () => {
  assert.ok(!src.includes('1.69'), 'found stale 1.69 in README');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
