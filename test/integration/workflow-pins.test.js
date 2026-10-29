'use strict';

/**
 * Workflow supply-chain guard (#1000).
 *
 * The workflows that test and publish the package must run only pinned code
 * with only the token scopes each job needs. `scripts/check-workflow-pins.mjs`
 * enforces that; this test holds the checker itself to account, because a
 * checker that passes everything proves nothing:
 *
 *   - the repository's own workflows are clean;
 *   - every rule FAILS on a planted workflow that breaks it (a floating tag, a
 *     short SHA, a pin with no release comment, a workflow-level write scope,
 *     a missing permissions block) and PASSES on the compliant form of the same
 *     workflow, so a rule cannot be satisfied by deleting the check;
 *   - `id-token: write` sits only on the jobs that mint an OIDC token;
 *   - `.github/dependabot.yml` keeps the pins moving by pull request.
 *
 * Run: node test/integration/workflow-pins.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts/check-workflow-pins.mjs');
const SHA = '11d5960a326750d5838078e36cf38b85af677262';

let pass = 0, fail = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); pass++; })
    .catch((e) => { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-wf-'));
let n = 0;
/** A directory holding one planted workflow; returns its path. */
function plant(yaml) {
  const dir = path.join(tmp, `case-${n++}`);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'w.yml'), yaml);
  return dir;
}
const wf = ({ top = 'permissions:\n  contents: read\n', step = `      - uses: actions/checkout@${SHA} # v4.4.0\n`, job = '' } = {}) =>
  `name: planted\non: push\n${top}\njobs:\n  build:\n    runs-on: ubuntu-latest\n${job}    steps:\n${step}`;
const kinds = (r) => r.problems.map((p) => p.kind).sort();

(async () => {
  const { audit } = await import('../../scripts/check-workflow-pins.mjs');

  // ── the repository's own workflows ────────────────────────────────────────

  await test('every workflow of this repository is pinned and read-only by default', () => {
    const r = audit();
    assert.deepStrictEqual(r.problems, [], r.problems.map((p) => `${p.rel}:${p.line} ${p.kind}`).join('; '));
    assert.ok(r.files > 0 && r.uses > 0, 'the audit read the workflows');
    assert.strictEqual(r.pinned, r.uses, 'every reference counted is pinned');
  });

  await test('the issue\'s own one-liner finds nothing unpinned', () => {
    const dir = path.join(ROOT, '.github/workflows');
    const lines = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))
      .flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n'))
      .filter((l) => /^\s*-?\s*uses:/.test(l));
    assert.ok(lines.length > 0);
    assert.deepStrictEqual(lines.filter((l) => !/@[0-9a-f]{40}/.test(l)), []);
  });

  // ── each rule fails on a planted breach and passes on the compliant form ──

  await test('a floating tag is UNPINNED; the same step pinned to a SHA is clean', () => {
    assert.deepStrictEqual(kinds(audit(plant(wf({ step: '      - uses: actions/checkout@v4\n' })))), ['UNPINNED']);
    assert.deepStrictEqual(kinds(audit(plant(wf({ step: '      - uses: actions/checkout@main\n' })))), ['UNPINNED']);
    assert.deepStrictEqual(audit(plant(wf())).problems, []);
  });

  await test('a short or malformed SHA is UNPINNED', () => {
    assert.deepStrictEqual(kinds(audit(plant(wf({ step: '      - uses: actions/checkout@11d5960 # v4.4.0\n' })))), ['UNPINNED']);
    assert.deepStrictEqual(kinds(audit(plant(wf({ step: `      - uses: actions/checkout@${SHA.toUpperCase()} # v4.4.0\n` })))), ['UNPINNED']);
    assert.deepStrictEqual(kinds(audit(plant(wf({ step: `      - uses: actions/checkout@${SHA}0 # v4.4.0\n` })))), ['UNPINNED']);
  });

  await test('a pin with no release comment is UNLABELLED', () => {
    assert.deepStrictEqual(kinds(audit(plant(wf({ step: `      - uses: actions/checkout@${SHA}\n` })))), ['UNLABELLED']);
    assert.deepStrictEqual(kinds(audit(plant(wf({ step: `      - uses: actions/checkout@${SHA} # latest\n` })))), ['UNLABELLED']);
  });

  await test('a quoted reference, a step with a name first, and a path inside the action are all read', () => {
    assert.deepStrictEqual(kinds(audit(plant(wf({ step: '      - uses: "actions/checkout@v4"\n' })))), ['UNPINNED']);
    assert.deepStrictEqual(kinds(audit(plant(wf({ step: '      - name: x\n        uses: actions/checkout@v4\n' })))), ['UNPINNED']);
    assert.deepStrictEqual(kinds(audit(plant(wf({ step: '      - uses: github/codeql-action/analyze@v3\n' })))), ['UNPINNED']);
    assert.deepStrictEqual(audit(plant(wf({ step: `      - uses: github/codeql-action/analyze@${SHA} # v3.28.0\n` }))).problems, []);
  });

  await test('a commented-out reference and a local action are not references', () => {
    const r = audit(plant(wf({ step: `      # - uses: actions/checkout@v4\n      - uses: ./.github/actions/local\n      - uses: actions/checkout@${SHA} # v4.4.0\n` })));
    assert.deepStrictEqual(r.problems, []);
    assert.strictEqual(r.uses, 1, 'only the real remote reference is counted');
  });

  await test('a docker:// image must be pinned by digest', () => {
    assert.deepStrictEqual(kinds(audit(plant(wf({ step: '      - uses: docker://alpine:3.20\n' })))), ['UNPINNED']);
    assert.deepStrictEqual(audit(plant(wf({ step: `      - uses: docker://alpine@sha256:${'a'.repeat(64)} # v3.20\n` }))).problems, []);
  });

  await test('a workflow-level write scope is WRITE; the same scope on a job is clean', () => {
    const top = 'permissions:\n  contents: read\n  id-token: write\n';
    assert.deepStrictEqual(kinds(audit(plant(wf({ top })))), ['WRITE']);
    assert.deepStrictEqual(kinds(audit(plant(wf({ top: 'permissions:\n  contents: write\n  packages: write\n' })))), ['WRITE', 'WRITE']);
    assert.deepStrictEqual(audit(plant(wf({ job: '    permissions:\n      contents: read\n      id-token: write\n' }))).problems, []);
  });

  await test('a comment line at column 0 inside the block does not hide a write scope after it', () => {
    assert.deepStrictEqual(kinds(audit(plant(wf({ top: 'permissions:\n  contents: read\n# a note\n  packages: write\n' })))), ['WRITE']);
  });

  await test('a trailing comment on a scope does not turn read into write or hide a write', () => {
    assert.deepStrictEqual(audit(plant(wf({ top: 'permissions:\n  contents: read   # write access is per job\n' }))).problems, []);
    assert.deepStrictEqual(kinds(audit(plant(wf({ top: 'permissions:\n  contents: write   # create releases\n' })))), ['WRITE']);
  });

  await test('no permissions block is NO_PERMISSIONS; read-all and {} are read-only; write-all is not', () => {
    assert.deepStrictEqual(kinds(audit(plant(wf({ top: '' })))), ['NO_PERMISSIONS']);
    assert.deepStrictEqual(audit(plant(wf({ top: 'permissions: read-all\n' }))).problems, []);
    assert.deepStrictEqual(audit(plant(wf({ top: 'permissions: {}\n' }))).problems, []);
    assert.deepStrictEqual(kinds(audit(plant(wf({ top: 'permissions: write-all\n' })))), ['WRITE']);
  });

  await test('a job-level permissions block alone does not count as the workflow default', () => {
    assert.deepStrictEqual(kinds(audit(plant(wf({ top: '', job: '    permissions:\n      contents: read\n' })))), ['NO_PERMISSIONS']);
  });

  await test('the CLI exits 0 when clean, 1 on a finding, 2 on a missing directory', () => {
    const run = (dir) => spawnSync(process.execPath, [SCRIPT, '--dir', dir], { encoding: 'utf8' });
    const ok = run(plant(wf()));
    assert.strictEqual(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /1 action references in 1 workflows, all pinned/);
    const bad = run(plant(wf({ step: '      - uses: actions/checkout@v4\n' })));
    assert.strictEqual(bad.status, 1);
    assert.match(bad.stderr, /w\.yml:\d+ {2}UNPINNED/);
    assert.strictEqual(run(path.join(tmp, 'does-not-exist')).status, 2);
  });

  // ── what the publish workflows are allowed to hold ────────────────────────

  await test('id-token: write is held only by the jobs that mint an OIDC token', () => {
    const dir = path.join(ROOT, '.github/workflows');
    const holders = [];
    for (const f of fs.readdirSync(dir).filter((x) => /\.ya?ml$/.test(x)).sort()) {
      let job = null;
      for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
        const j = /^ {2}([\w-]+):\s*$/.exec(line);
        if (/^jobs:/.test(line)) job = '';
        else if (j && job !== null) job = j[1];
        if (/^\s+id-token:\s*write\b/.test(line) && !line.trim().startsWith('#')) holders.push(`${f}#${job === null ? '(workflow)' : job}`);
      }
    }
    assert.deepStrictEqual(holders, ['npm-publish.yml#publish-npm', 'pages.yml#deploy', 'prerelease-publish.yml#publish-npm']);
  });

  await test('no workflow reads NPM_TOKEN: both npm publishes use Trusted Publishing (#1050)', () => {
    const dir = path.join(ROOT, '.github/workflows');
    for (const f of fs.readdirSync(dir).filter((x) => /\.ya?ml$/.test(x))) {
      const code = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
      assert.doesNotMatch(code, /NPM_TOKEN/, `${f} reads NPM_TOKEN`);
    }
  });

  await test('the prerelease npm publish mints an OIDC token on that one job, publishes with provenance, and sets up node without a registry token', () => {
    const text = fs.readFileSync(path.join(ROOT, '.github/workflows/prerelease-publish.yml'), 'utf8');
    const block = (name) => new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [\\w-]+:\\n|$)`).exec(text)[1];
    const npm = block('publish-npm');
    assert.match(npm, /needs: update-versions/);
    assert.match(npm, /id-token: write/);
    assert.doesNotMatch(npm, /contents: write|packages: write/);
    assert.match(npm, /npm install -g npm@\^11\.5\.1/, 'Trusted Publishing needs npm 11.5.1 or newer');
    assert.match(npm, /npm publish --tag \$\{\{ inputs\.prerelease_type \}\} --provenance --access public/);
    assert.doesNotMatch(npm, /registry-url|NODE_AUTH_TOKEN/, 'an .npmrc that reads NODE_AUTH_TOKEN would shadow the OIDC exchange');
    for (const other of ['test', 'update-versions', 'publish-github', 'publish-vscode', 'publish-openvsx', 'publish-jetbrains', 'release']) {
      assert.doesNotMatch(block(other), /id-token: write/, `${other} must not mint an OIDC token`);
    }
  });

  await test('the npm publish job is the only one that publishes, and it is gated on the test job', () => {
    const text = fs.readFileSync(path.join(ROOT, '.github/workflows/npm-publish.yml'), 'utf8');
    const block = (name) => new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [\\w-]+:\\n|$)`).exec(text)[1];
    assert.match(block('publish-npm'), /needs: test/);
    assert.match(block('publish-npm'), /id-token: write/);
    assert.doesNotMatch(block('publish-npm'), /contents: write|packages: write/);
    assert.match(block('publish-github'), /packages: write/);
    assert.doesNotMatch(block('publish-github'), /id-token: write/);
    assert.match(block('release'), /contents: write/);
    assert.doesNotMatch(block('release'), /id-token: write|packages: write/);
  });

  // ── Dependabot keeps the pins current ─────────────────────────────────────

  await test('dependabot.yml updates the github-actions ecosystem weekly, against develop', () => {
    const text = fs.readFileSync(path.join(ROOT, '.github/dependabot.yml'), 'utf8').replace(/^\s*#.*$/gm, '');
    assert.match(text, /^version:\s*2\b/m);
    assert.match(text, /package-ecosystem:\s*github-actions\b/);
    assert.match(text, /directory:\s*\/\s*$/m);
    assert.match(text, /interval:\s*weekly\b/);
    assert.match(text, /target-branch:\s*develop\b/);
  });

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nworkflow-pins: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
