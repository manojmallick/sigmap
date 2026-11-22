'use strict';

/**
 * The change-task half of the agent A/B (scripts/lib/agent-ab-change.mjs): the tools the agent edits with, and the grader that turns what it
 * left in a checkout into a patch, puts the hidden tests on a pristine copy and runs them. Offline; no model is called.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
}

const tmpDirs = [];
const mktmp = (p) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); tmpDirs.push(d); return d; };
const git = (dir, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-C', dir, ...args], { encoding: 'utf8' }).trim();

/** A base checkout: one buggy function, a visible test, one commit. */
function base() {
  const dir = mktmp('chg-base-');
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'add.js'), "'use strict';\n// adds two numbers\nfunction add(a, b) {\n  return a - b;\n}\nmodule.exports = { add };\n");
  fs.writeFileSync(path.join(dir, 'test', 'visible.test.js'), "const { add } = require('../src/add');\nprocess.exit(typeof add === 'function' ? 0 : 1);\n");
  fs.writeFileSync(path.join(dir, '.gitignore'), '.context/\n');
  execFileSync('git', ['init', '-q', dir]);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'base']);
  return dir;
}

const HIDDEN = [{ path: 'test/hidden.test.js', content: "const assert = require('assert');\nconst { add } = require('../src/add');\nassert.strictEqual(add(2, 3), 5);\nassert.strictEqual(add(-1, 1), 0);\n" }];

(async () => {
  const ab = await import('../../scripts/lib/agent-ab-change.mjs');

  console.log('agent-ab change tasks');

  await test('problemStatement keeps the title and the first paragraph of the Problem section and takes the fix\'s locations out', () => {
    const issue = {
      title: 'extractor: a function named async is listed as an async function',
      body: '## Problem / Goal\n\n`export function async(…)` is listed as `export async function async(…)`. The new loops in `src/extractors/typescript.js` detect it wrongly.\n\nSecond paragraph about the root cause.\n\n## Acceptance\n\n- tests',
    };
    const t = ab.problemStatement(issue, ['src/extractors/typescript.js', 'src/extractors/javascript.js']);
    assert.ok(t.startsWith('extractor: a function named async'));
    assert.ok(/listed as `export async function async/.test(t));
    assert.ok(!/typescript\.js|javascript\.js|src\/extractors/.test(t), t);
    assert.ok(/<path>|<file>/.test(t));
    assert.ok(!/Second paragraph|Acceptance/.test(t), 'only the first paragraph');
    const plain = ab.problemStatement({ title: 'T', body: 'No heading here.\n\nMore.' }, []);
    assert.strictEqual(plain, 'T\n\nNo heading here.');
  });

  await test('Edit replaces one exact occurrence, refuses none or several, and stays inside the checkout and out of .git and .context', () => {
    const dir = base();
    assert.ok(!ab.runChangeTool('Edit', { file_path: 'src/add.js', old_string: 'a - b', new_string: 'a + b' }, { cwd: dir }).isError);
    assert.match(fs.readFileSync(path.join(dir, 'src', 'add.js'), 'utf8'), /return a \+ b;/);
    assert.match(ab.runChangeTool('Edit', { file_path: 'src/add.js', old_string: 'nowhere', new_string: 'x' }, { cwd: dir }).text, /not found/);
    assert.match(ab.runChangeTool('Edit', { file_path: 'src/add.js', old_string: 'a', new_string: 'x' }, { cwd: dir }).text, /matches \d+ places/);
    assert.ok(ab.runChangeTool('Edit', { file_path: '../outside.js', old_string: 'a', new_string: 'b' }, { cwd: dir }).isError);
    assert.ok(ab.runChangeTool('Write', { file_path: '/etc/evil', content: 'x' }, { cwd: dir }).isError);
    assert.match(ab.runChangeTool('Write', { file_path: '.git/hooks/pre-commit', content: 'x' }, { cwd: dir }).text, /not editable/);
    assert.match(ab.runChangeTool('Write', { file_path: '.context/x.json', content: 'x' }, { cwd: dir }).text, /not editable/);
    assert.ok(!ab.runChangeTool('Write', { file_path: 'src/new/dir/file.js', content: 'module.exports = 1;\n' }, { cwd: dir }).isError);
    assert.ok(fs.existsSync(path.join(dir, 'src', 'new', 'dir', 'file.js')));
  });

  await test('RunTest runs a test file under test/ with a minimal environment and reports its exit and output', () => {
    const dir = base();
    fs.writeFileSync(path.join(dir, 'test', 'env.test.js'), "console.log('KEY=' + (process.env.ANTHROPIC_API_KEY || '') + (process.env.BENCH_ANTHROPIC_KEY || '') + '|HOME=' + process.env.HOME);\nprocess.exit(3);\n");
    process.env.ANTHROPIC_API_KEY = 'sk-test-SECRET'; process.env.BENCH_ANTHROPIC_KEY = 'sk-bench-SECRET';
    try {
      const r = ab.runChangeTool('RunTest', { file_path: 'test/env.test.js' }, { cwd: dir });
      assert.ok(r.isError && /^exit 3/.test(r.text), r.text);
      assert.ok(!/SECRET/.test(r.text), 'no key reaches a child process');
      assert.match(r.text, /KEY=\|HOME=/);
    } finally { delete process.env.ANTHROPIC_API_KEY; delete process.env.BENCH_ANTHROPIC_KEY; }
    assert.ok(!ab.runChangeTool('RunTest', { file_path: 'test/visible.test.js' }, { cwd: dir }).isError);
    assert.match(ab.runChangeTool('RunTest', { file_path: 'src/add.js' }, { cwd: dir }).text, /under test\/ only/);
    assert.ok(ab.runChangeTool('RunTest', { file_path: '../x.js' }, { cwd: dir }).isError);
  });

  await test('gradeChange: a correct fix passes the hidden tests, a wrong one fails, nothing changed is an empty patch', () => {
    const task = { hidden: HIDDEN };
    const none = base();
    assert.deepStrictEqual(ab.gradeChange(task, none).why, 'empty patch');

    const good = base();
    ab.runChangeTool('Edit', { file_path: 'src/add.js', old_string: 'a - b', new_string: 'a + b' }, { cwd: good });
    const g = ab.gradeChange(task, good);
    assert.strictEqual(g.pass, true, g.why);
    assert.deepStrictEqual(g.patch, { files: 1, added: 1, removed: 1 });

    const wrong = base();
    ab.runChangeTool('Edit', { file_path: 'src/add.js', old_string: 'a - b', new_string: 'a * b' }, { cwd: wrong });
    const w = ab.gradeChange(task, wrong);
    assert.strictEqual(w.pass, false);
    assert.deepStrictEqual(w.failed, ['test/hidden.test.js']);
    assert.match(w.why, /hidden tests failed: hidden\.test\.js/);
  });

  await test('gradeChange builds the patch from the agent\'s files only: new files count, the harness\'s config and index do not, and a doctored test is overwritten', () => {
    const task = { hidden: HIDDEN };
    const dir = base();
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), '{"mcp":{"tools":"core"}}');
    fs.mkdirSync(path.join(dir, '.context'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.context', 'sig-index.json'), '{}');
    ab.runChangeTool('Write', { file_path: 'src/add.js', content: "'use strict';\nconst helper = require('./helper');\nfunction add(a, b) { return helper.plus(a, b); }\nmodule.exports = { add };\n" }, { cwd: dir });
    ab.runChangeTool('Write', { file_path: 'src/helper.js', content: 'module.exports = { plus: (a, b) => a + b };\n' }, { cwd: dir });
    // the agent also "fixes" the hidden test file it can guess: whatever it writes there is replaced
    ab.runChangeTool('Write', { file_path: 'test/hidden.test.js', content: 'process.exit(0);\n' }, { cwd: dir });
    const r = ab.gradeChange(task, dir);
    assert.strictEqual(r.pass, true, r.why);
    assert.strictEqual(r.patch.files, 3, 'src/add.js, the new src/helper.js and the test file; not the config or .context');
    const cheat = base();
    ab.runChangeTool('Write', { file_path: 'test/hidden.test.js', content: 'process.exit(0);\n' }, { cwd: cheat });
    assert.strictEqual(ab.gradeChange(task, cheat).pass, false, 'rewriting the test does not make a wrong source pass');
  });

  for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
