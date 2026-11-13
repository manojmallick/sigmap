'use strict';

/**
 * Runtime-change detector (#999, #1050).
 *
 * `scripts/check-runtime-change.mjs` answers one question for `tag-on-merge`:
 * did a file the package runs change since the last release? A detector that
 * answers "no" too often silently stops releases, and one that answers "yes"
 * too often changes nothing, so this holds it to account on throwaway git
 * repositories:
 *
 *   - a release bump (versions, README, CHANGELOG, docs, scripts, workflows)
 *     reads as unchanged; an edit, an added file or a deleted file under a
 *     runtime path reads as changed;
 *   - the manifest counts through the fields that change what runs (a new
 *     dependency, a moved `bin`), not through `scripts`, `files` or `version`;
 *   - no earlier release tag, a prerelease tag and a commit that is already
 *     tagged all pick the right starting point;
 *   - the CLI writes `runtime_changed` for GitHub Actions and exits 2 on a
 *     usage or git error;
 *   - every `package.json` `files` entry is classified as runtime or not, so a
 *     new shipped directory cannot be forgotten.
 *
 * The last block reads this repository's real tags and is skipped where they
 * are not fetched (CI checks out without them).
 *
 * Run: node test/integration/runtime-change.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts/check-runtime-change.mjs');

let pass = 0, fail = 0, skip = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); pass++; })
    .catch((e) => { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-rc-'));
let n = 0;

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com',
};
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const write = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const manifest = (version, extra = {}) =>
  JSON.stringify({ name: 'fx', version, main: 'packages/core/index.js', bin: { fx: 'gen-context.js' }, files: ['gen-context.js', 'src/', 'packages/', 'README.md'], scripts: { test: 'node t.js' }, ...extra }, null, 2) + '\n';

/** A repository at release 1.0.0 (tagged), with the four runtime paths and some non-runtime files. */
function fixture({ tag = 'v1.0.0' } = {}) {
  const dir = path.join(tmp, `repo-${n++}`);
  fs.mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main', '--template=');
  write(dir, 'package.json', manifest('1.0.0'));
  write(dir, 'gen-context.js', "const VERSION = '1.0.0';\nmodule.exports = { VERSION };\n");
  write(dir, 'gen-project-map.js', "module.exports = 'map';\n");
  write(dir, 'src/a.js', "module.exports = 'a';\n");
  write(dir, 'src/mcp/server.js', "const SERVER_INFO = { name: 'fx', version: '1.0.0' };\nmodule.exports = SERVER_INFO;\n");
  write(dir, 'packages/core/package.json', '{ "name": "core", "version": "1.0.0" }\n');
  write(dir, 'README.md', '# fx 1.0.0\n');
  write(dir, 'CHANGELOG.md', '## [1.0.0]\n');
  write(dir, 'docs/x.md', 'docs\n');
  commit(dir, 'release 1.0.0');
  if (tag) git(dir, 'tag', '-a', tag, '-m', tag);
  return dir;
}
function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
}
/** The release bump: every version string, plus the non-runtime churn a real release carries. */
function bump(dir, to) {
  for (const f of ['gen-context.js', 'src/mcp/server.js', 'packages/core/package.json', 'README.md']) {
    write(dir, f, fs.readFileSync(path.join(dir, f), 'utf8').split('1.0.0').join(to));
  }
  write(dir, 'package.json', manifest(to, { scripts: { test: 'node t.js', 'check:x': 'node x.js' }, description: 'now with a description', files: ['gen-context.js', 'src/', 'packages/'] }));
  write(dir, 'CHANGELOG.md', `## [${to}]\n\n## [1.0.0]\n`);
  write(dir, 'docs/x.md', 'docs, edited\n');
  write(dir, '.github/workflows/ci.yml', 'name: ci\n');
  write(dir, 'scripts/release.mjs', 'export {};\n');
  write(dir, 'benchmarks/report.json', '{}\n');
}

(async () => {
  const { runtimeChange, previousReleaseTag, RUNTIME, SHIPPED_NON_RUNTIME, MANIFEST_FIELDS } = await import('../../scripts/check-runtime-change.mjs');

  // ── what counts as a runtime change ───────────────────────────────────────

  await test('a release bump with only versions, docs, scripts, workflows and a trimmed `files` is not a runtime change', () => {
    const dir = fixture();
    bump(dir, '1.0.1');
    commit(dir, 'prepare 1.0.1');
    const r = runtimeChange({ cwd: dir });
    assert.strictEqual(r.runtimeChanged, false, JSON.stringify(r));
    assert.deepStrictEqual(r.changed, []);
    assert.strictEqual(r.from, 'v1.0.0');
    assert.strictEqual(r.reason, 'version-strings-only');
    assert.strictEqual(r.touched, 4, 'package.json, gen-context.js, src/mcp/server.js and packages/core/package.json were touched');
  });

  await test('editing a file under src/ is a runtime change, and the file is named', () => {
    const dir = fixture();
    bump(dir, '1.0.1');
    write(dir, 'src/a.js', "module.exports = 'a, but different';\n");
    commit(dir, 'change a');
    const r = runtimeChange({ cwd: dir });
    assert.strictEqual(r.runtimeChanged, true);
    assert.deepStrictEqual(r.changed, ['src/a.js']);
    assert.strictEqual(r.reason, 'runtime-files-changed');
  });

  await test('a change next to a version string is not hidden by it', () => {
    const dir = fixture();
    bump(dir, '1.0.1');
    write(dir, 'src/mcp/server.js', "const SERVER_INFO = { name: 'fx', version: '1.0.1', extra: true };\nmodule.exports = SERVER_INFO;\n");
    commit(dir, 'bump and add a field');
    assert.deepStrictEqual(runtimeChange({ cwd: dir }).changed, ['src/mcp/server.js']);
  });

  await test('a new file and a deleted file under a runtime path are runtime changes', () => {
    const added = fixture();
    write(added, 'src/new.js', 'module.exports = 1;\n');
    commit(added, 'add');
    assert.deepStrictEqual(runtimeChange({ cwd: added }).changed, ['src/new.js']);

    const removed = fixture();
    fs.rmSync(path.join(removed, 'src/a.js'));
    commit(removed, 'remove');
    assert.deepStrictEqual(runtimeChange({ cwd: removed }).changed, ['src/a.js']);
  });

  await test('gen-project-map.js and packages/ count as runtime', () => {
    const a = fixture();
    write(a, 'gen-project-map.js', "module.exports = 'map2';\n");
    commit(a, 'map');
    assert.deepStrictEqual(runtimeChange({ cwd: a }).changed, ['gen-project-map.js']);

    const b = fixture();
    write(b, 'packages/core/index.js', 'module.exports = {};\n');
    commit(b, 'core');
    assert.deepStrictEqual(runtimeChange({ cwd: b }).changed, ['packages/core/index.js']);
  });

  await test('README, CHANGELOG, docs, scripts, workflows and benchmarks are not runtime', () => {
    const dir = fixture();
    for (const f of ['README.md', 'CHANGELOG.md', 'docs/x.md', 'scripts/a.mjs', '.github/workflows/ci.yml', 'benchmarks/a.json', 'test/a.test.js', 'llms.txt']) write(dir, f, `${f} changed\n`);
    commit(dir, 'non-runtime churn');
    assert.strictEqual(runtimeChange({ cwd: dir }).runtimeChanged, false);
  });

  // ── the manifest ──────────────────────────────────────────────────────────

  await test('a new dependency, a moved bin or main, or a new engines floor is a runtime change', () => {
    for (const [extra, field] of [
      [{ dependencies: { left: '^1.0.0' } }, 'dependencies'],
      [{ bin: { fx: 'other.js' } }, 'bin'],
      [{ main: 'src/a.js' }, 'main'],
      [{ engines: { node: '>=20' } }, 'engines'],
    ]) {
      const dir = fixture();
      write(dir, 'package.json', manifest('1.0.0', extra));
      commit(dir, `change ${field}`);
      const r = runtimeChange({ cwd: dir });
      assert.strictEqual(r.runtimeChanged, true, `${field}: ${JSON.stringify(r)}`);
      assert.deepStrictEqual(r.changed, [`package.json (${field})`]);
    }
  });

  await test('scripts, files, description and key order in the manifest are not runtime', () => {
    const dir = fixture();
    write(dir, 'package.json', JSON.stringify({
      files: ['gen-context.js'], description: 'd', scripts: { a: 'b' }, bin: { fx: 'gen-context.js' },
      main: 'packages/core/index.js', version: '1.0.0', name: 'fx',
    }, null, 4));
    commit(dir, 'rewrite manifest');
    assert.strictEqual(runtimeChange({ cwd: dir }).runtimeChanged, false);
  });

  await test('the manifest fields are the ones that change what runs, and `version`, `scripts` and `files` are not among them', () => {
    for (const f of ['main', 'bin', 'engines', 'dependencies', 'exports']) assert.ok(MANIFEST_FIELDS.includes(f), f);
    for (const f of ['version', 'scripts', 'files', 'description', 'keywords']) assert.ok(!MANIFEST_FIELDS.includes(f), f);
  });

  // ── where the comparison starts ───────────────────────────────────────────

  await test('with no earlier release tag, the answer is "changed" (the first release publishes)', () => {
    const dir = fixture({ tag: null });
    const r = runtimeChange({ cwd: dir });
    assert.strictEqual(r.runtimeChanged, true);
    assert.strictEqual(r.from, null);
    assert.strictEqual(r.reason, 'no-previous-release');
  });

  await test('a prerelease tag is not a release: the comparison starts from the last real one', () => {
    const dir = fixture();
    write(dir, 'src/a.js', "module.exports = 'rc';\n");
    commit(dir, 'rc work');
    git(dir, 'tag', '-a', 'v1.1.0-rc.1', '-m', 'rc');
    bump(dir, '1.0.1');
    commit(dir, 'prepare 1.0.1');
    assert.strictEqual(previousReleaseTag(dir, 'HEAD'), 'v1.0.0');
    const r = runtimeChange({ cwd: dir });
    assert.strictEqual(r.from, 'v1.0.0');
    assert.deepStrictEqual(r.changed, ['src/a.js'], 'the change that came in with the rc is still a change since v1.0.0');
  });

  await test('a commit that is already tagged is compared with the release before it, not with itself', () => {
    const dir = fixture();
    bump(dir, '1.0.1');
    write(dir, 'src/a.js', "module.exports = 'second';\n");
    commit(dir, 'release 1.0.1');
    git(dir, 'tag', '-a', 'v1.0.1', '-m', 'v1.0.1');
    assert.strictEqual(previousReleaseTag(dir, 'HEAD'), 'v1.0.0');
    assert.strictEqual(runtimeChange({ cwd: dir }).runtimeChanged, true);
  });

  await test('`from` and `to` can be given explicitly', () => {
    const dir = fixture();
    bump(dir, '1.0.1');
    commit(dir, 'prepare 1.0.1');
    git(dir, 'tag', '-a', 'v1.0.1', '-m', 'v1.0.1');
    write(dir, 'src/a.js', "module.exports = 'later';\n");
    commit(dir, 'later');
    assert.strictEqual(runtimeChange({ cwd: dir, from: 'v1.0.0', to: 'v1.0.1' }).runtimeChanged, false);
    assert.strictEqual(runtimeChange({ cwd: dir, from: 'v1.0.1', to: 'HEAD' }).runtimeChanged, true);
  });

  // ── the CLI ───────────────────────────────────────────────────────────────

  const cli = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env: GIT_ENV, encoding: 'utf8' });

  await test('the CLI answers in a sentence, as JSON, and into $GITHUB_OUTPUT', () => {
    const dir = fixture();
    bump(dir, '1.0.1');
    commit(dir, 'prepare');
    const out = path.join(tmp, 'gh-output');
    const human = cli(dir, '--github-output', out);
    assert.strictEqual(human.status, 0, human.stderr);
    assert.match(human.stdout, /runtime files since v1\.0\.0: unchanged/);
    assert.strictEqual(fs.readFileSync(out, 'utf8'), 'runtime_changed=false\nprevious_tag=v1.0.0\n');
    const json = JSON.parse(cli(dir, '--json').stdout);
    assert.strictEqual(json.runtimeChanged, false);
    assert.strictEqual(json.from, 'v1.0.0');

    write(dir, 'src/a.js', "module.exports = 'x';\n");
    commit(dir, 'change');
    fs.rmSync(out);
    assert.match(cli(dir, '--github-output', out).stdout, /1 changed: src\/a\.js/);
    assert.strictEqual(fs.readFileSync(out, 'utf8'), 'runtime_changed=true\nprevious_tag=v1.0.0\n');
  });

  await test('no earlier tag writes an empty previous_tag and `true`', () => {
    const dir = fixture({ tag: null });
    const out = path.join(tmp, 'gh-output-none');
    assert.strictEqual(cli(dir, '--github-output', out).status, 0);
    assert.strictEqual(fs.readFileSync(out, 'utf8'), 'runtime_changed=true\nprevious_tag=\n');
  });

  await test('a bad ref and a flag without a value exit 2 and say why', () => {
    const dir = fixture();
    const bad = cli(dir, '--from', 'no-such-ref');
    assert.strictEqual(bad.status, 2);
    assert.match(bad.stderr, /check-runtime-change:/);
    const flag = cli(dir, '--from');
    assert.strictEqual(flag.status, 2);
    assert.match(flag.stderr, /--from needs a value/);
    assert.strictEqual(cli(tmp, '--json').status, 2, 'outside a repository is an error, not an answer');
  });

  // ── what this repository ships ────────────────────────────────────────────

  await test('every package.json `files` entry is classified as runtime or not', () => {
    const files = require(path.join(ROOT, 'package.json')).files.map((f) => f.replace(/\/$/, ''));
    const known = new Set([...RUNTIME, ...SHIPPED_NON_RUNTIME]);
    const unclassified = files.filter((f) => !known.has(f));
    assert.deepStrictEqual(unclassified, [], `add ${unclassified.join(', ')} to RUNTIME or SHIPPED_NON_RUNTIME in scripts/check-runtime-change.mjs`);
  });

  await test('every runtime path exists in this repository, so a rename cannot leave the detector watching nothing', () => {
    for (const p of RUNTIME) assert.ok(fs.existsSync(path.join(ROOT, p)), `${p} does not exist`);
  });

  // ── this repository's own history (needs the release tags) ────────────────

  const hasTag = (t) => spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${t}`], { cwd: ROOT }).status === 0;
  const NINE = ['v8.51.3', 'v8.51.4', 'v8.52.2', 'v8.65.0', 'v8.72.1', 'v8.77.0', 'v8.77.1', 'v8.77.2', 'v8.79.0'];
  const needed = ['v8.84.0', 'v8.85.0', 'v8.85.1', ...NINE];
  if (needed.every(hasTag)) {
    await test('on this repository\'s tags: v8.85.1 changed nothing that runs, v8.85.0 did, and #999\'s nine releases are all unchanged', () => {
      assert.strictEqual(runtimeChange({ cwd: ROOT, from: 'v8.85.0', to: 'v8.85.1' }).runtimeChanged, false);
      assert.strictEqual(runtimeChange({ cwd: ROOT, from: 'v8.84.0', to: 'v8.85.0' }).runtimeChanged, true);
      for (const t of NINE) {
        const prev = previousReleaseTag(ROOT, t);
        assert.ok(prev, `no release before ${t}`);
        assert.strictEqual(runtimeChange({ cwd: ROOT, from: prev, to: t }).runtimeChanged, false, `${prev}..${t}`);
      }
    });
  } else {
    skip++;
    console.log('  SKIP  this repository\'s own tags are not fetched here (the fixture tests above carry the weight)');
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nruntime-change: ${pass} passed, ${fail} failed${skip ? `, ${skip} skipped` : ''}`);
  process.exit(fail > 0 ? 1 : 0);
})();
