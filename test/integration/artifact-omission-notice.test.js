'use strict';

/**
 * The generated artifact says when the budget left files out (#587).
 *
 * The `[sigmap] budget: dropped N file(s)` warning goes to stderr, which an
 * agent reading the file never sees. Measured on flask: 25 of 51 files present,
 * no notice — indistinguishable from a 25-file repo. That is the same failure
 * as an undisclosed truncation cap (#576), one level up.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const CLI = path.join(ROOT, 'gen-context.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/** Build a repo of `n` source files and generate with a fixed token budget. */
function generate(n, maxTokens) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-omit-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  for (let i = 0; i < n; i++) {
    const body = Array.from({ length: 12 },
      (_, k) => `function mod${i}fn${k}(alpha, beta, gamma) { return alpha + beta + gamma; }`).join('\n');
    fs.writeFileSync(path.join(dir, 'src', `module${i}.js`), `${body}\nmodule.exports = {};\n`);
  }
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
    srcDirs: ['src'], autoMaxTokens: false, maxTokens, adapters: ['claude'],
  }));
  execFileSync('node', [CLI], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  return { dir, content: fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8') };
}

const NOTICE = /Not everything is here/;

test('an over-budget artifact carries the omission notice', () => {
  const { content } = generate(40, 1200);
  assert.ok(NOTICE.test(content), 'no omission notice in a budget-constrained artifact');
});

test('the notice names a count and points at sigmap ask', () => {
  const { content } = generate(40, 1200);
  const line = content.split('\n').find((l) => NOTICE.test(l));
  assert.ok(/\d+ file\(s\) omitted|collapsed to anchors/.test(line), `no count in: ${line}`);
  assert.ok(/sigmap ask/.test(line), `no pointer to sigmap ask in: ${line}`);
  assert.ok(/retrieval index still has them all/.test(line),
    'the notice should say retrieval can still reach the omitted files');
});

test('an artifact that fits carries no notice', () => {
  const { content } = generate(2, 200000);
  assert.ok(!NOTICE.test(content), 'emitted an omission notice when nothing was omitted');
});

test('output stays deterministic', () => {
  // Regenerate in the SAME directory. Comparing two fresh temp dirs was wrong:
  // the artifact embeds path-derived content, so that test compared unequal
  // inputs and passed only by luck locally — CI caught it.
  const { dir, content: first } = generate(40, 1200);
  execFileSync('node', [CLI], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  const second = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
  const strip = (s) => s.replace(/^.*(generated|updated|ago|\d{4}-\d{2}-\d{2}).*$/gmi, '');
  assert.strictEqual(strip(first), strip(second), 'regenerating produced different content');
});

test('the notice does not claim files are unreachable', () => {
  // The omitted files ARE in the retrieval index — the notice must not imply
  // they are lost, or it trades one wrong impression for another.
  const { content } = generate(40, 1200);
  const line = content.split('\n').find((l) => NOTICE.test(l));
  assert.ok(!/(lost|unavailable|cannot be)/i.test(line), `overstates the loss: ${line}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
