'use strict';

/**
 * Contributor-facing and package-facing hygiene (#999).
 *
 * Three claims the repository makes about itself had drifted from the thing
 * they describe, and each is held here to what it describes:
 *
 *   - CONTRIBUTING.md told a contributor `npm test` was the local command and
 *     that two hand-typed counts ("21/21", "17/17") were the bar, while CI ran
 *     a dozen more steps. `npm run test:ci` is now the local command, and it is
 *     the `test` job's own `run:` lines in the same order, so a step added to
 *     one and not the other fails here instead of failing a contributor's PR.
 *   - A hand-typed count in CONTRIBUTING.md is wrong the day a test is added,
 *     so none may appear.
 *   - Every tarball carried the whole CHANGELOG (730 KB, the second-largest
 *     file) and SigMap's own generated AGENTS.md. Release notes live on the
 *     GitHub Releases page; neither file belongs in `npm pack`.
 *
 * Run: node test/integration/release-hygiene.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); pass++; })
    .catch((e) => { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; });
}

/** The single-line `run:` commands of one CI job, in order. */
function runLines(workflow, job) {
  const lines = workflow.split('\n');
  const start = lines.findIndex((l) => l === `  ${job}:`);
  assert.ok(start !== -1, `ci.yml has a ${job} job`);
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}\S/.test(lines[i])) break; // the next job
    const m = /^\s+run:\s+(\S.*?)\s*$/.exec(lines[i]);
    if (m && !m[1].startsWith('|') && !m[1].startsWith('>')) out.push(m[1]);
  }
  return out;
}

(async () => {
  const pkg = JSON.parse(read('package.json'));
  const contributing = read('CONTRIBUTING.md');

  await test('npm run test:ci is the CI test job\'s own run: lines, in order', () => {
    const ci = runLines(read('.github/workflows/ci.yml'), 'test');
    assert.ok(ci.length >= 8, 'the test job\'s steps were read');
    assert.ok(pkg.scripts['test:ci'], 'package.json defines test:ci');
    assert.deepStrictEqual(pkg.scripts['test:ci'].split(' && '), ci,
      'a step added to ci.yml\'s test job (or to test:ci) must be added to the other');
  });

  await test('the third-party gate stays its own CI job and out of the local command', () => {
    const ci = read('.github/workflows/ci.yml');
    assert.match(ci, /\n {2}xrepo:\n/);
    assert.ok(!pkg.scripts['test:ci'].includes('validate:xrepo'), 'it needs the pinned clones, which a contributor may not have');
    assert.match(contributing, /validate:xrepo/, 'CONTRIBUTING says where it runs');
  });

  await test('npm test stays the fast loop and test:ci is not an alias of it', () => {
    assert.ok(!/integration\/all\.js/.test(pkg.scripts.test), 'npm test does not run the integration suite');
    assert.notStrictEqual(pkg.scripts['test:ci'], pkg.scripts.test);
  });

  await test('CONTRIBUTING documents test:ci and holds no hand-typed test count', () => {
    assert.match(contributing, /npm run test:ci/);
    const counts = contributing.split('\n')
      .map((text, i) => ({ text, line: i + 1 }))
      .filter(({ text }) => /\b\d+\s*\/\s*\d+\b/.test(text) || /\b\d+\s+(?:tests?|suites?|passed|PASS)\b/i.test(text));
    assert.deepStrictEqual(counts, [], 'a count goes stale the day a test is added: ' + counts.map((c) => `line ${c.line}`).join(', '));
  });

  await test('the tarball holds neither CHANGELOG.md nor AGENTS.md', () => {
    assert.ok(!pkg.files.includes('CHANGELOG.md') && !pkg.files.includes('AGENTS.md'), 'package.json files names neither');
    const r = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    assert.strictEqual(r.status, 0, r.stderr);
    const files = JSON.parse(r.stdout)[0].files.map((f) => f.path);
    assert.ok(files.includes('gen-context.js') && files.includes('package.json'), 'the listing is the package\'s');
    assert.ok(!files.includes('CHANGELOG.md'), 'CHANGELOG.md is on the GitHub Releases page, not in every download');
    assert.ok(!files.includes('AGENTS.md'), 'AGENTS.md is SigMap\'s own generated file, not the package\'s');
  });

  console.log(`\nrelease-hygiene: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
