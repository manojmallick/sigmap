'use strict';

/**
 * npm name guard (#1000, item 7).
 *
 * `scripts/check-npm-names.mjs` runs daily from `.github/workflows/npm-name-guard.yml`
 * and must go red when a SigMap look-alike npm name is unclaimed, owned by
 * someone else, or a new look-alike package appears. A guard that is never
 * exercised passes whatever the registry says, so these tests run the real
 * script against a local fake registry and plant each breach:
 *
 *   - everything owned: exit 0, and the list asks for no name we do not hold;
 *   - an unclaimed name, a foreign maintainer (on a reserved name and on the
 *     real package), a missing `latest`, a new look-alike, an unreachable
 *     registry: each exits 1 with its own status;
 *   - a reviewed foreign package, an unrelated search hit and a reviewed name
 *     that went 404 do NOT fail it;
 *   - the workflow holds `issues: write` on the one job that files the issue.
 *
 * Run: node test/integration/npm-name-guard.test.js
 */

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
// GUARD_SCRIPT lets a mutation sweep point the tests at a temporary mutant copy, so the real script is never edited.
const SCRIPT = process.env.GUARD_SCRIPT || path.join(ROOT, 'scripts/check-npm-names.mjs');
const WORKFLOW = process.env.GUARD_WORKFLOW || path.join(ROOT, '.github/workflows/npm-name-guard.yml');

let pass = 0, fail = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); pass++; })
    .catch((e) => { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; });
}

const OWNED = ['sigmap', 'sigmap-cli', 'sigmap-core', 'sigmap-mcp', 'sigmap-mcp-server', 'gen-project-map'];
const doc = (maint = ['manojmallick'], latest = '1.0.0') =>
  ({ maintainers: maint.map((name) => ({ name })), 'dist-tags': latest ? { latest } : {} });

/**
 * A fake registry. `docs` maps a package name to its document (missing = 404),
 * `search` is the list of packages the search endpoint returns, `latest` maps a
 * name to the status of `/<name>/latest` (default 200), and `status` forces
 * every answer to one HTTP status (a registry that is down).
 */
function registry({ docs = {}, search = [], latest = {}, status = 0, searchStatus = 0, docsStatus = 0 } = {}) {
  const all = Object.fromEntries(OWNED.map((n) => [n, doc()]));
  Object.assign(all, docs);
  const server = http.createServer((req, res) => {
    const send = (code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body || {})); };
    if (status) return send(status);
    const u = new URL(req.url, 'http://x');
    const raw = u.pathname.replace(/^\//, '');
    const p = decodeURIComponent(raw);
    if (p === '-/v1/search') return searchStatus ? send(searchStatus) : send(200, { objects: search.map((pkg) => ({ package: pkg })) });
    if (docsStatus) return send(docsStatus);
    // Like the real registry, a scoped name is addressed with its slash encoded.
    const bare = raw.replace(/\/latest$/, '');
    if (bare.includes('/')) return send(404);
    if (p.endsWith('/latest')) return send(latest[p.slice(0, -7)] || 200);
    return all[p] ? send(200, all[p]) : send(404);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () =>
    resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })));
}

/** Run the real script against a fake registry; resolve with its exit code and output. */
async function guard(reg, env = {}) {
  const clean = { ...process.env };
  for (const k of Object.keys(clean)) if (/^GUARD_/.test(k) || k === 'GITHUB_STEP_SUMMARY') delete clean[k];
  const child = spawn(process.execPath, [SCRIPT], { env: { ...clean, GUARD_REGISTRY: reg.url, GUARD_RETRY_DELAY_MS: '1', ...env } });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const code = await new Promise((r) => child.on('close', r));
  return { code, out };
}

async function against(opts, env) {
  const reg = await registry(opts);
  try { return await guard(reg, env); } finally { await reg.close(); }
}

const row = (out, name, status) => new RegExp('\\| `' + name.replace(/[/@-]/g, '\\$&') + '` \\| ' + status + ' \\|').test(out);

(async () => {
  console.log('\nnpm name guard\n');

  await test('every name owned: exit 0, and it asks for no name the maintainer does not hold', async () => {
    const r = await against({});
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /all reserved names are owned by manojmallick/);
    for (const n of OWNED) assert.ok(row(r.out, n, 'ok'), `${n} is not listed as ok`);
    assert.doesNotMatch(r.out, /@sigmap\/cli/, 'the guard must not list a name that is not yet claimed');
  });

  await test('an unclaimed reserved name fails with UNCLAIMED', async () => {
    const r = await against({}, { GUARD_RESERVED: 'sigmap-cli,sigmap-unclaimed' });
    assert.strictEqual(r.code, 1);
    assert.ok(row(r.out, 'sigmap-unclaimed', '\\*\\*UNCLAIMED\\*\\*'), r.out);
    assert.ok(row(r.out, 'sigmap-cli', 'ok'));
  });

  await test('a reserved name held by someone else fails with FOREIGN and names the maintainer', async () => {
    const r = await against({ docs: { 'sigmap-core': doc(['stranger']) } });
    assert.strictEqual(r.code, 1);
    assert.ok(row(r.out, 'sigmap-core', '\\*\\*FOREIGN\\*\\*'), r.out);
    assert.match(r.out, /maintainers: stranger/);
  });

  await test('the real package drifting to another maintainer also fails', async () => {
    const r = await against({ docs: { sigmap: doc(['manojmallick', 'stranger']) } });
    assert.strictEqual(r.code, 0, 'an extra co-maintainer is not a loss of ownership');
    const lost = await against({ docs: { sigmap: doc(['stranger']) } });
    assert.strictEqual(lost.code, 1);
    assert.ok(row(lost.out, 'sigmap', '\\*\\*FOREIGN\\*\\*'), lost.out);
  });

  await test('an owned name with no `latest` dist-tag fails with NO-LATEST', async () => {
    const r = await against({ docs: { 'sigmap-mcp': doc(['manojmallick'], null) } });
    assert.strictEqual(r.code, 1);
    assert.ok(row(r.out, 'sigmap-mcp', '\\*\\*NO-LATEST\\*\\*'), r.out);
  });

  await test('a scoped name is requested with the slash encoded', async () => {
    const r = await against({ docs: { '@sigmap/cli': doc() } }, { GUARD_RESERVED: '@sigmap/cli' });
    assert.strictEqual(r.code, 0, r.out);
    assert.ok(row(r.out, '@sigmap/cli', 'ok'), r.out);
  });

  await test('a new look-alike in the search index fails with NEW-LOOKALIKE, naming who published it', async () => {
    const r = await against({ search: [{ name: 'sigmap-helper', date: '2026-10-30T10:00:00Z', publisher: { username: 'squatter' }, maintainers: [{ username: 'squatter' }] }] });
    assert.strictEqual(r.code, 1);
    assert.ok(row(r.out, 'sigmap-helper', '\\*\\*NEW-LOOKALIKE\\*\\*'), r.out);
    assert.match(r.out, /published 2026-10-30 by squatter/);
  });

  await test('a package under the @sigmap scope, which the maintainer cannot own, fails with NEW-LOOKALIKE when anyone else publishes it', async () => {
    const r = await against({ search: [{ name: '@sigmap/cli', date: '2026-11-02T09:00:00Z', publisher: { username: 'someone-else' }, maintainers: [{ username: 'someone-else' }] }] });
    assert.strictEqual(r.code, 1, r.out);
    assert.ok(row(r.out, '@sigmap/cli', '\\*\\*NEW-LOOKALIKE\\*\\*'), r.out);
    assert.match(r.out, /published 2026-11-02 by someone-else/);
    const own = await against({ search: [{ name: '@sigmap/cli', date: '2026-11-02T09:00:00Z', maintainers: [{ username: 'manojmallick' }] }] });
    assert.strictEqual(own.code, 0, 'the maintainer publishing under it would be fine');
  });

  await test('reviewed foreign packages, unrelated hits and the maintainer\'s own packages do not fail it', async () => {
    const r = await against({
      search: [
        { name: 'proc-sigmap', date: '2015-01-01T00:00:00Z', maintainers: [{ username: 'someone' }] },
        { name: 'left-pad', date: '2016-01-01T00:00:00Z', maintainers: [{ username: 'someone' }] },
        { name: 'sigmap-extra', date: '2026-10-01T00:00:00Z', maintainers: [{ username: 'manojmallick' }] },
      ],
    });
    assert.strictEqual(r.code, 0, r.out);
    assert.ok(row(r.out, 'proc-sigmap', 'reviewed'), r.out);
    assert.doesNotMatch(r.out, /left-pad|sigmap-extra/);
  });

  await test('a reviewed foreign name that went 404 is reported as gone but does not fail', async () => {
    const r = await against({ latest: { 'gen-context': 404 } });
    assert.strictEqual(r.code, 0, r.out);
    assert.ok(row(r.out, 'gen-context', 'gone'), r.out);
  });

  await test('an unreachable registry fails with ERROR rather than passing', async () => {
    const r = await against({ status: 503 });
    assert.strictEqual(r.code, 1);
    assert.match(r.out, /\*\*ERROR\*\*/);
    assert.match(r.out, /HTTP 503/);
  });

  await test('package lookups failing alone, with the search still answering, fail with ERROR', async () => {
    const r = await against({ docsStatus: 502 });
    assert.strictEqual(r.code, 1);
    assert.ok(row(r.out, 'sigmap', '\\*\\*ERROR\\*\\*'), r.out);
    assert.doesNotMatch(r.out, /search:/, 'the search did answer');
  });

  await test('the search failing alone, with every package answering, fails with ERROR', async () => {
    const r = await against({ searchStatus: 500 });
    assert.strictEqual(r.code, 1);
    assert.ok(row(r.out, 'search:sigmap', '\\*\\*ERROR\\*\\*'), r.out);
    assert.ok(row(r.out, 'sigmap-cli', 'ok'), 'the package lookups did answer');
  });

  await test('the table is appended to GITHUB_STEP_SUMMARY when it is set', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-guard-')), 'summary.md');
    const r = await against({}, { GITHUB_STEP_SUMMARY: file });
    assert.strictEqual(r.code, 0);
    const summary = fs.readFileSync(file, 'utf8');
    assert.match(summary, /^### npm name guard/);
    assert.match(summary, /\| `sigmap` \| ok \|/);
  });

  await test('GUARD_OWNER changes who must hold the names', async () => {
    const r = await against({}, { GUARD_OWNER: 'someone-else' });
    assert.strictEqual(r.code, 1);
    assert.ok(row(r.out, 'sigmap-cli', '\\*\\*FOREIGN\\*\\*'), r.out);
  });

  // ── the workflow that runs it ─────────────────────────────────────────────

  const wf = fs.readFileSync(WORKFLOW, 'utf8');
  const code = wf.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

  await test('the workflow runs the script on a schedule and by hand, holding no secret', () => {
    assert.match(code, /schedule:\s*\n\s*- cron: '\d+ \d+ \* \* \*'/);
    assert.match(code, /workflow_dispatch:/);
    assert.match(code, /run: node scripts\/check-npm-names\.mjs/);
    assert.doesNotMatch(code, /secrets\./, 'the guard reads only public registry data');
    assert.doesNotMatch(code, /NPM_TOKEN|NODE_AUTH_TOKEN/);
  });

  await test('issues: write is held by the guard job alone; the workflow default stays read-only', () => {
    const top = /\npermissions:\n((?: {2}.+\n)+)/.exec(code)[1];
    assert.strictEqual(top.trim(), 'contents: read');
    const job = /\n {4}permissions:\n((?: {6}.+\n)+)/.exec(code)[1];
    assert.match(job, /contents: read/);
    assert.match(job, /issues: write/);
    assert.doesNotMatch(job, /contents: write|id-token|packages: write/);
    assert.strictEqual((code.match(/issues: write/g) || []).length, 1);
  });

  await test('the issue is filed only when the check fails', () => {
    const step = /- name: Open or update a tracking issue on failure\n((?: {8}.+\n?)+)/.exec(code)[1];
    assert.match(step, /if: failure\(\)/);
    assert.match(step, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  });

  await test('the script keeps the owned names it publishes and does not reserve @sigmap/cli, which cannot be claimed', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    const list = /'(sigmap-cli,[^']+)'\)\.split/.exec(src)[1].split(',');
    assert.deepStrictEqual(list, ['sigmap-cli', 'sigmap-core', 'sigmap-mcp', 'sigmap-mcp-server', 'gen-project-map']);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
