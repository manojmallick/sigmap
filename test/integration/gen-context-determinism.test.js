'use strict';

/**
 * Regression guard for #440 — gen-context output must be byte-stable.
 *
 * Root cause fixed: the token-budget recency boost stamped
 * `mtime = Date.now()` on every recently-committed file. On repos where nearly
 * every file is "recently changed", almost every entry got a distinct wall-clock
 * mtime, but consecutive files often landed on the *same* millisecond. Which
 * files shared a millisecond (and thus fell through to the filePath tie-break
 * instead of sorting by a distinct mtime) shifted run to run — swapping which
 * files survived at the budget cutoff and making the generated context
 * non-byte-stable. The fix replaces Date.now() with a deterministic monotonic
 * counter (nextRecentMtime) that reproduces the same processing-order ranking
 * without millisecond collisions.
 *
 * This guard reproduces the trigger conditions (many equal-cost files, all
 * committed → all "recent", a budget small enough to force a drop) and asserts
 * two clean runs produce byte-identical output (excluding the `Updated:`
 * timestamp comment).
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const assert = require('assert');
const { execFileSync } = require('child_process');

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

function git(args, cwd) {
  execFileSync('git', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
}

function runGenerate(cwd) {
  execFileSync('node', [GEN_CONTEXT], { cwd, env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] });
}

/** Output content with the volatile `Updated:` timestamp line removed. */
function stableOutput(cwd) {
  const p = path.join(cwd, '.github', 'copilot-instructions.md');
  const raw = fs.readFileSync(p, 'utf8');
  return raw.split('\n').filter((l) => !l.startsWith('<!-- Updated:')).join('\n');
}

function withGitFixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-determinism-'));
  try {
    // Many equal-cost files with identical content: priority and signalQuality
    // tie, so the recency boost (mtime) drives the ordering — exactly the path
    // that used to flake. A small fixed budget forces a drop, so which files
    // survive the cutoff is the selection that must be reproducible run to run.
    const srcDir = path.join(dir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    for (let i = 0; i < 400; i++) {
      const n = String(i).padStart(3, '0');
      fs.writeFileSync(path.join(srcDir, `mod${n}.js`), 'export function handler() { return 1; }\n');
    }
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      autoMaxTokens: false,
      maxTokens: 4000,
      srcDirs: ['src'],
      outputs: ['copilot'],
      secretScan: false,
    }));

    // Commit everything so getRecentlyCommittedFiles() marks every file "recent"
    // — the exact condition that made the recency boost non-deterministic.
    git(['init'], dir);
    git(['config', 'user.email', 'test@example.com'], dir);
    git(['config', 'user.name', 'Test'], dir);
    git(['add', '-A'], dir);
    git(['commit', '-m', 'fixture'], dir);

    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('two clean runs produce byte-identical output (excluding Updated: line)', () => {
  withGitFixture((dir) => {
    runGenerate(dir);
    const first = stableOutput(dir);

    // Clean slate for the second run — remove output and sig cache so nothing
    // carries over between runs.
    fs.rmSync(path.join(dir, '.github', 'copilot-instructions.md'), { force: true });
    fs.rmSync(path.join(dir, '.sigmap-cache.json'), { force: true });

    runGenerate(dir);
    const second = stableOutput(dir);

    assert.strictEqual(second, first, 'gen-context output differs between two clean runs on an unchanged repo');
  });
});

test('the fixture actually forces a budget cutoff (guard exercises the tie-break)', () => {
  withGitFixture((dir) => {
    runGenerate(dir);
    const out = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
    const sections = (out.match(/^### /gm) || []).length;
    // 400 files written; a 4000-token budget must drop some — otherwise the test
    // never reaches the selection-among-ties path that used to be flaky.
    assert.ok(sections > 0, 'expected some sections in output');
    assert.ok(sections < 400, `expected a budget cutoff (some files dropped), but all ${sections} survived`);
  });
});

console.log('');
console.log(`gen-context-determinism: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
