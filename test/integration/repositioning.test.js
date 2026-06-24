'use strict';

/**
 * v8.0 "Pivot" gate (E2 repositioning + E4 agent recipes).
 *
 * The chosen positioning (master plan §0) is "the deterministic, verifiable
 * grounding layer for AI code work" — token reduction is demoted to proof.
 * This gate makes the pivot non-regressable: no public headline surface may
 * fall back to the old "context engine" / "feeds the right files" framing, and
 * the agent recipes + newly-documented commands must stay present.
 *
 * Run: node test/integration/repositioning.test.js
 *
 * Note: the literal "context-engine" appears legitimately inside the published
 * JetBrains plugin URL slug, so framing checks target specific surfaces/regions
 * (tagline, "What is SigMap?", llms.txt header, docs <title>) — never a blanket
 * whole-file ban.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const LLMS = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'docs/index.html'), 'utf8');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

// Slice the "## What is SigMap?" section (up to the next "## ") so framing
// checks are scoped to the headline region, not the whole README.
function section(md, heading) {
  const start = md.indexOf(heading);
  assert.ok(start !== -1, `section "${heading}" not found`);
  const after = md.indexOf('\n## ', start + heading.length);
  return md.slice(start, after === -1 ? md.length : after);
}

// ── E2: grounding-layer framing on every headline surface ───────────────────

test('README tagline is the grounding-layer positioning', () => {
  // The bold one-liner directly under the "# ⚡ SigMap" title.
  assert.ok(/grounding layer for AI code work/i.test(README.split('\n').slice(0, 12).join('\n')),
    'README tagline must state the grounding-layer positioning');
});

test('"What is SigMap?" leads with deterministic/grounding, not compression', () => {
  const what = section(README, '## What is SigMap?');
  assert.ok(/deterministic|grounding|auditable|verif/i.test(what),
    '"What is SigMap?" must use the grounding-layer framing');
  assert.ok(!/feeds the right files|finds the right files/i.test(what),
    'old "feeds/finds the right files" framing still present');
});

test('no public surface frames SigMap as a "context engine"', () => {
  // README body (the JetBrains URL slug uses a hyphen, so a spaced-phrase ban
  // is safe), the generated llms.txt header, and the docs <title>.
  assert.ok(!/context engine/i.test(README), 'README still says "context engine"');
  assert.ok(!/context engine/i.test(LLMS), 'llms.txt still says "context engine"');
  const title = (INDEX_HTML.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  assert.ok(/grounding layer/i.test(title), `docs <title> must use grounding framing, got: ${title}`);
  assert.ok(!/context engine/i.test(title), 'docs <title> still says "context engine"');
});

test('llms.txt header carries the grounding-layer positioning', () => {
  assert.ok(/grounding layer for AI code work/i.test(LLMS.slice(0, 600)),
    'llms.txt header must state the grounding-layer positioning');
});

test('token reduction is demoted to proof, not the README headline', () => {
  // The headline region (before "## Benchmark") must not lead on "token
  // reduction"; it should appear under a proof framing instead.
  const why = section(README, '## Why SigMap?');
  assert.ok(/proof/i.test(why), '"Why SigMap?" must frame metrics as proof');
});

// ── E4: agent recipes + newly-documented commands ───────────────────────────

test('README has an "Agent recipes" section', () => {
  assert.ok(/##\s*Agent recipes/i.test(README), 'README missing "## Agent recipes" section');
});

test('Agent recipes cover every named consumer agent', () => {
  const recipes = section(README, '## Agent recipes');
  for (const agent of ['Claude Code', 'Cursor', 'Cline', 'Continue', 'Aider', 'OpenHands', 'Codex']) {
    assert.ok(recipes.includes(agent), `Agent recipes missing "${agent}"`);
  }
  assert.ok(/sigmap mcp install/.test(recipes), 'Agent recipes must reference "sigmap mcp install"');
  assert.ok(/evidence/i.test(recipes), 'Agent recipes must reference the Evidence Pack');
});

test('README documents the shipped evidence + doctor commands', () => {
  assert.ok(README.includes('sigmap evidence'), 'README missing "sigmap evidence"');
  assert.ok(README.includes('sigmap doctor'), 'README missing "sigmap doctor"');
});

console.log(`\nrepositioning: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
