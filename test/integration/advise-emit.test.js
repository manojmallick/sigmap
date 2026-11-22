'use strict';

/**
 * `sigmap advise --emit-root <dir>`: the inputs the paired agent harness reads, built from the project in the current directory.
 *
 * What must hold: it writes only under the directory it is given and never in the project; it refuses to write inside the project, over a
 * directory it did not write, or from a project whose .git is not a directory of its own (the harness copies the project and resets the copy,
 * which would write into the repository a linked worktree points at); what it writes is what the REAL harness accepts (a dry run reads it, and
 * the study's retrieval-rank script prepares real arms from it and leaves the project as it found it); and the commands it prints are quoted.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const { emitRoot, repoNameOf, languageOf, MARK } = require(path.join(ROOT, 'src/advise/emit.js'));
const { buildAdvice, formatAdvice } = require(path.join(ROOT, 'src/advise/advise.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
}

const ENV = { ...process.env, SIGMAP_NO_UPDATE_CHECK: '1', NO_COLOR: '1', GIT_TERMINAL_PROMPT: '0' };
const IDENT = { GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'dev@example.com' };
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'advise-emit-')));

function gitAt(dir, args) {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...ENV, ...IDENT } });
  assert.strictEqual(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}
function commitAt(dir, title, files) {
  for (const [f, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), body); }
  gitAt(dir, ['add', '-A']);
  gitAt(dir, ['commit', '-q', '-m', title]);
}
const js = (name, body) => `function ${name}(a, b) {\n  // ${body}\n  return a + b;\n}\nmodule.exports = { ${name} };\n`;
function makeProject(dir, qualifying = true) {
  fs.mkdirSync(dir, { recursive: true });
  gitAt(dir, ['init', '-q']);
  commitAt(dir, 'initial import of the project', { 'src/billing.js': js('formatCurrency', 'money'), 'src/users.js': js('createUser', 'user') });
  if (qualifying) {
    commitAt(dir, 'compute tax for invoices with several line items', { 'src/tax.js': js('computeTax', 'tax') });
    commitAt(dir, 'retry failed webhook deliveries with exponential backoff', { 'src/dispatcher.js': js('retryDelivery', 'webhook') });
    commitAt(dir, 'support partial refunds when an order is amended later', { 'src/credits.js': js('partialCredit', 'refund') });
  }
  commitAt(dir, 'refactor tests and docs for the billing module cleanup', { 'src/billing.js': js('formatCurrency', 'again') });
}
const run = (cwd, args) => spawnSync(process.execPath, [GEN, ...args], { cwd, encoding: 'utf8', env: ENV });
function snapshot(dir) {
  const out = {};
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      const st = fs.statSync(p);
      out[path.relative(dir, p)] = `${st.size}:${st.mtimeMs}`;
    }
  })(dir);
  return out;
}

const project = path.join(tmp, 'my project!');
makeProject(project);

console.log('sigmap advise --emit-root');

test('it writes a manifest pinned to HEAD, one task per mined question, and a link to the project', () => {
  const root = path.join(tmp, 'root1');
  const r = run(project, ['advise', '--no-grep', '--emit-root', root, '--json']);
  assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`);
  const e = JSON.parse(r.stdout).emitted;
  assert.strictEqual(e.root, root);
  const m = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks', 'xrepo-repos.json'), 'utf8'));
  assert.ok(m._comment.includes(MARK));
  assert.deepStrictEqual(m.repos, [{ name: 'my-project', url: 'local', commit: gitAt(project, ['rev-parse', 'HEAD']).trim(), language: 'javascript', layout: 'local' }]);
  const tasks = fs.readFileSync(path.join(root, 'benchmarks', 'tasks', 'retrieval-xrepo.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepStrictEqual(tasks.map((t) => [t.id, t.repo, t.query, t.expected_files]), [
    ['p001', 'my-project', 'compute tax for invoices with several line items', ['src/tax.js']],
    ['p002', 'my-project', 'retry failed webhook deliveries with exponential backoff', ['src/dispatcher.js']],
    ['p003', 'my-project', 'support partial refunds when an order is amended later', ['src/credits.js']],
  ]);
  for (const t of tasks) { assert.strictEqual(t.split, 'local'); assert.strictEqual(t.source, 'merged-commit'); assert.ok(/^[0-9a-f]{40}$/.test(t.goldCommit), t.goldCommit); }
  assert.strictEqual(fs.realpathSync(path.join(root, 'benchmarks', 'repos', 'my-project')), project);
  assert.ok(fs.lstatSync(path.join(root, 'benchmarks', 'repos', 'my-project')).isSymbolicLink());
});

test('the real harness accepts it: a dry run counts one repository, three tasks and the runs, on both agents', () => {
  const root = path.join(tmp, 'root1');
  for (const extra of [[], ['--agent', 'api']]) {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/run-agent-ab.mjs'), '--sigmap-variant', 'index', '--tasks-per-repo', '3', '--runs', '4', '--dry-run', ...extra], { encoding: 'utf8', env: { ...ENV, SIGMAP_XREPO_DATA: root } });
    assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.ok(/repos\s+1\n/.test(r.stdout), `the repository was skipped (not at its pin, or not fetched):\n${r.stdout}`);
    assert.ok(/tasks\s+3 /.test(r.stdout) && /24 agent runs/.test(r.stdout), r.stdout);
  }
});

test('arms prepared from it are copies: the study\'s own ranking script runs on it and the project is left exactly as it was', () => {
  const root = path.join(tmp, 'root1');
  const before = snapshot(project);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'benchmarks/agent-study/retrieval-rank.mjs')], { encoding: 'utf8', env: { ...ENV, SIGMAP_XREPO_DATA: root } });
  assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.ok(/3 questions:/.test(r.stdout) && /my-project \d\/\d of 3/.test(r.stdout), r.stdout);
  assert.deepStrictEqual(snapshot(project), before, 'preparing arms changed a file of the project');
  assert.strictEqual(gitAt(project, ['status', '--porcelain']), '', 'the project has changes after the arms were prepared');
});

test('it writes nothing in the project, with or without an index', () => {
  const before = snapshot(project);
  const r = run(project, ['advise', '--no-grep', '--emit-root', path.join(tmp, 'root2')]);
  assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.deepStrictEqual(snapshot(project), before);
  assert.ok(!fs.existsSync(path.join(project, '.context')));
});

test('it prints the harness commands for the pin, with the path quoted so a quote or a space in it cannot break them', () => {
  const r = run(project, ['advise', '--no-grep', '--emit-root', path.join(tmp, "it's here", 'root3')]);
  assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`);
  const want = `SIGMAP_XREPO_DATA='${path.join(tmp, "it'\\''s here", 'root3')}'`;
  assert.ok(r.stdout.includes(want), `no ${want} in:\n${r.stdout}`);
  assert.ok(/--sigmap-variant prefetch --dry-run/.test(r.stdout) && /--tasks-per-repo 3 --runs 4/.test(r.stdout), r.stdout);
  assert.ok(/not in the npm package/.test(r.stdout));
});

test('it refuses a directory inside the project, a directory it did not write, and a missing value', () => {
  const before = snapshot(project);
  const inside = run(project, ['advise', '--no-grep', '--emit-root', path.join(project, 'harness')]);
  assert.strictEqual(inside.status, 1);
  assert.ok(/inside the project/.test(inside.stderr), inside.stderr);
  const same = run(project, ['advise', '--no-grep', '--emit-root', project]);
  assert.strictEqual(same.status, 1);
  assert.ok(/inside the project/.test(same.stderr), same.stderr);
  assert.deepStrictEqual(snapshot(project), before);

  const foreign = path.join(tmp, 'foreign');
  fs.mkdirSync(foreign);
  fs.writeFileSync(path.join(foreign, 'keep.txt'), 'mine');
  const f = run(project, ['advise', '--no-grep', '--emit-root', foreign]);
  assert.strictEqual(f.status, 1);
  assert.ok(/not empty and is not a root this command wrote/.test(f.stderr), f.stderr);
  assert.deepStrictEqual(fs.readdirSync(foreign), ['keep.txt']);
  assert.strictEqual(fs.readFileSync(path.join(foreign, 'keep.txt'), 'utf8'), 'mine');

  const none = run(project, ['advise', '--no-grep', '--emit-root']);
  assert.strictEqual(none.status, 2);
  assert.ok(/takes a directory/.test(none.stderr), none.stderr);
});

test('a project whose .git is a file (a linked worktree) is refused, because the harness would reset the repository it points at', () => {
  const wt = path.join(tmp, 'linked');
  gitAt(project, ['worktree', 'add', '-q', '--detach', wt]);
  assert.ok(fs.statSync(path.join(wt, '.git')).isFile());
  const root = path.join(tmp, 'root-wt');
  const r = run(wt, ['advise', '--no-grep', '--emit-root', root]);
  assert.strictEqual(r.status, 1);
  assert.ok(/not a directory of its own/.test(r.stderr), r.stderr);
  assert.ok(!fs.existsSync(root), 'it wrote a root for a project the harness cannot use');
});

test('with no qualifying question there is nothing to write, and it says so', () => {
  const quiet = path.join(tmp, 'quiet');
  makeProject(quiet, false);
  const root = path.join(tmp, 'root-quiet');
  const r = run(quiet, ['advise', '--no-grep', '--emit-root', root]);
  assert.strictEqual(r.status, 1);
  assert.ok(/no question qualified/.test(r.stderr), r.stderr);
  assert.ok(!fs.existsSync(root));
});

test('a root it wrote can be written again (the pin and the questions follow the project), and a real directory where its link goes is never removed', () => {
  const root = path.join(tmp, 'root1');
  commitAt(project, 'handle currency rounding when a refund is partial', { 'src/rounding.js': js('roundMoney', 'rounding') });
  const again = run(project, ['advise', '--no-grep', '--max', '2', '--emit-root', root, '--json']);
  assert.strictEqual(again.status, 0, `${again.stdout}${again.stderr}`);
  const m = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks', 'xrepo-repos.json'), 'utf8'));
  assert.strictEqual(m.repos[0].commit, gitAt(project, ['rev-parse', 'HEAD']).trim());
  assert.strictEqual(fs.readFileSync(path.join(root, 'benchmarks', 'tasks', 'retrieval-xrepo.jsonl'), 'utf8').trim().split('\n').length, 2);

  const real = path.join(tmp, 'root-real');
  assert.strictEqual(run(project, ['advise', '--no-grep', '--emit-root', real]).status, 0);
  const link = path.join(real, 'benchmarks', 'repos', 'my-project');
  fs.unlinkSync(link);
  fs.mkdirSync(link);
  fs.writeFileSync(path.join(link, 'precious.txt'), 'do not delete');
  const r = run(project, ['advise', '--no-grep', '--emit-root', real]);
  assert.strictEqual(r.status, 1);
  assert.ok(/not a link this command made/.test(r.stderr), r.stderr);
  assert.strictEqual(fs.readFileSync(path.join(link, 'precious.txt'), 'utf8'), 'do not delete');
});

test('uncommitted changes are reported: the harness resets every arm to the pinned commit, so it measures the committed state', () => {
  const clean = JSON.parse(run(project, ['advise', '--no-grep', '--emit-root', path.join(tmp, 'root-clean'), '--json']).stdout).emitted;
  assert.strictEqual(clean.dirty, false);
  fs.appendFileSync(path.join(project, 'src', 'billing.js'), '// not committed\n');
  const r = run(project, ['advise', '--no-grep', '--emit-root', path.join(tmp, 'root-dirty')]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(/uncommitted changes.*committed state/.test(r.stdout), r.stdout);
  assert.strictEqual(JSON.parse(run(project, ['advise', '--no-grep', '--emit-root', path.join(tmp, 'root-dirty2'), '--json']).stdout).emitted.dirty, true);
  gitAt(project, ['checkout', '-q', '--', 'src/billing.js']);
});

test('the printed command asks for at most eight tasks a repository, and for fewer when there are fewer', () => {
  const base = buildAdvice(project, { noGrep: true });
  const text = (questions) => formatAdvice({ ...base, emitted: { root: '/r', questions, commit: 'a'.repeat(40), dirty: false } });
  assert.ok(/--tasks-per-repo 8 --runs 4/.test(text(20)), text(20));
  assert.ok(/--tasks-per-repo 3 --runs 4/.test(text(3)), text(3));
  assert.ok(!/uncommitted/.test(text(3)));
});

test('names and languages: a name the harness and a shell can hold, and the language most of the questions are in', () => {
  assert.strictEqual(repoNameOf('/x/my project!'), 'my-project');
  assert.strictEqual(repoNameOf('/x/.hidden'), 'hidden');
  assert.strictEqual(repoNameOf('/x/a b/c d'), 'c-d');
  assert.strictEqual(repoNameOf('/'), 'project');
  assert.strictEqual(repoNameOf('/x/keep.this_name-1'), 'keep.this_name-1');
  assert.strictEqual(repoNameOf('/x/a--b'), 'a--b', 'a hyphen is a legal character and a run of them is kept as it is');
  const q = (...files) => ({ files });
  assert.strictEqual(languageOf([q('a.py'), q('b.py', 'c.js'), q('d.go')]), 'python');
  assert.strictEqual(languageOf([q('a.ts'), q('b.go')]), 'go', 'a tie goes to the name that sorts first, so the manifest does not depend on question order');
  assert.strictEqual(languageOf([q('README'), q('notes.txt')]), 'unknown');
});

test('emitRoot called directly: no questions throws, and the throw writes nothing', () => {
  const root = path.join(tmp, 'root-direct');
  assert.throws(() => emitRoot(project, root, []), /no question qualified/);
  assert.ok(!fs.existsSync(root));
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
