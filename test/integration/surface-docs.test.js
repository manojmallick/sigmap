'use strict';

/**
 * Documented-surface gate (Trust Hygiene H4).
 * The CLI `--help`, README MCP count, and README adapter table must match the
 * real shipped surface so the docs can never silently undersell it again.
 * Run: node test/integration/surface-docs.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const { TOOLS } = require(path.join(ROOT, 'src/mcp/tools.js'));
const { listAdapters } = require(path.join(ROOT, 'packages/adapters/index.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const help = execFileSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--help'], { encoding: 'utf8' });

// The grounded-creation pipeline + conventions — wired commands that were
// previously absent from --help.
const COMMANDS = ['conventions', 'scaffold', 'verify-plan', 'review-pr', 'create'];

for (const cmd of COMMANDS) {
  test(`--help lists "${cmd}"`, () => {
    const re = new RegExp(`(sigmap|gen-context)\\s+${cmd}\\b`);
    assert.ok(re.test(help), `"${cmd}" not found in --help command list`);
  });
}

test('README documents every grounded-creation command', () => {
  for (const cmd of COMMANDS) {
    assert.ok(README.includes(`sigmap ${cmd}`), `README missing "sigmap ${cmd}"`);
  }
});

test('README states the real MCP tool count (derived from TOOLS)', () => {
  assert.ok(README.includes(`${TOOLS.length} on-demand tools`),
    `README must say "${TOOLS.length} on-demand tools" (TOOLS has ${TOOLS.length})`);
});

test('README does not undercount MCP tools (no stale "10 on-demand tools")', () => {
  // Guard the specific stale claim this gate was created to fix.
  if (TOOLS.length !== 10) {
    assert.ok(!README.includes('10 on-demand tools'), 'stale "10 on-demand tools" still in README');
  }
});

test('README adapter table lists every registered adapter', () => {
  for (const name of listAdapters()) {
    assert.ok(README.includes('`' + name + '`'), `README missing adapter \`${name}\``);
  }
});

test('package.json description fits the registry limit (npm keeps 255 characters)', () => {
  // Every published sigmap version carries exactly 255 characters of a longer
  // description, cut mid-word. A description past the limit loses its ending
  // on the npm page and in search results.
  const { description } = require(path.join(ROOT, 'package.json'));
  assert.ok(description.length <= 255,
    `description is ${description.length} characters; npm keeps 255 (it ends "${description.slice(240, 255)}" and the rest is dropped)`);
});

test('README verify sample uses the messages `sigmap verify` really prints', () => {
  // A hand-written sample drifted from the real output once ("does not exist"
  // against the real "File not found on disk"). Run verify on a throwaway repo
  // and require the README to carry each message it printed.
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-readme-verify-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'util.js'), 'function summarize(a) { return a; }\nmodule.exports = { summarize };\n');
    fs.writeFileSync(path.join(dir, 'answer.md'), 'Edit `src/auth/session-store.js`, then call `authorize()`.\n');
    const cli = path.join(ROOT, 'gen-context.js');
    execFileSync(process.execPath, [cli], { cwd: dir, stdio: 'ignore' }); // the symbol check needs the index
    let out = '';
    try { execFileSync(process.execPath, [cli, 'verify', 'answer.md'], { cwd: dir, encoding: 'utf8' }); }
    catch (e) { out = String(e.stdout || ''); } // verify exits 1 when it finds an issue
    const messages = [...out.matchAll(/\[Fake (?:file|symbol)\]\s+([^:\n]+:)/g)].map((m) => m[1]);
    assert.strictEqual(messages.length, 2, `expected a fake file and a fake symbol from verify, got:\n${out}`);
    for (const message of messages) {
      assert.ok(README.includes(message), `README verify sample lacks the real message "${message}"`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\nsurface-docs: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
