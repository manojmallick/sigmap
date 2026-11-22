'use strict';

/**
 * A top-level directory named like a member of Object.prototype (`constructor`, `toString`, `hasOwnProperty`) is a directory like any other.
 *
 * Found on a real repository (conda/constructor): the generator grouped files by their top-level directory in a plain `{}`, so the group
 * called `constructor` was `Object.prototype.constructor`, a function, and `groups[group].push(...)` threw — `--adapter claude` printed
 * "adapter error: groups[group].push is not a function" and wrote no file. The module list and the architecture view grouped the same way
 * and did not crash: they dropped the directory from their counts, or counted it as NaN.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-dirs-'));
const DIRS = { constructor: 'build', toString: 'show', hasOwnProperty: 'own', valueOf: 'val', src: 'ok' };
for (const [dir, fn] of Object.entries(DIRS)) {
  fs.mkdirSync(path.join(tmp, dir), { recursive: true });
  fs.writeFileSync(path.join(tmp, dir, 'a.js'), `function ${fn}() { return 1; }\nmodule.exports = { ${fn} };\n`);
}
const run = (args) => spawnSync(process.execPath, [GEN, ...args], { cwd: tmp, encoding: 'utf8', env: { ...process.env, SIGMAP_NO_UPDATE_CHECK: '1' } });

console.log('directories named like Object.prototype members');

test('--adapter claude writes a section for every top-level directory, including constructor and toString', () => {
  const r = run(['--adapter', 'claude']);
  assert.ok(!/adapter error/.test(`${r.stdout}${r.stderr}`), `${r.stdout}${r.stderr}`);
  const md = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf8');
  for (const dir of Object.keys(DIRS)) assert.ok(new RegExp(`^## ${dir}$`, 'm').test(md), `no "## ${dir}" in CLAUDE.md`);
  for (const fn of Object.values(DIRS)) assert.ok(md.includes(`function ${fn}`), `the signature of ${fn} is missing`);
});

test('list_modules counts them (they were dropped from the table, and from its total)', () => {
  const { listModules } = require(path.join(ROOT, 'src/mcp/handlers.js'));
  const out = String(listModules({}, tmp));
  for (const dir of Object.keys(DIRS)) assert.ok(new RegExp(`\\| ${dir} \\| 1 \\| ~\\d+ \\|`).test(out), `${dir} is not a row of:\n${out}`);
  assert.ok(!/NaN/.test(out));
});

test('the architecture view counts them with real numbers', () => {
  const { architectureView } = require(path.join(ROOT, 'src/map/knowledge-map.js'));
  const nodes = Object.keys(DIRS).map((d) => ({ kind: 'file', id: `file:${d}/a.js`, tokens: 7 }));
  const v = architectureView({ nodes, edges: [] });
  assert.strictEqual(v.totalTokens, 7 * Object.keys(DIRS).length);
  assert.deepStrictEqual(v.modules.map((m) => m.mod).sort(), Object.keys(DIRS).sort());
  for (const m of v.modules) assert.deepStrictEqual([m.files, m.tokens], [1, 7], m.mod);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
