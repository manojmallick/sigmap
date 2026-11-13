#!/usr/bin/env node
/**
 * npm name guard (#1000, item 7): fail when a SigMap look-alike npm name is not
 * owned by the maintainer, or when a new look-alike package appears.
 *
 * Read-only: anonymous GETs against the npm registry. No token, no secrets,
 * zero dependencies, Node >= 18 (global fetch). Run daily by
 * `.github/workflows/npm-name-guard.yml`; exit 1 prints which name drifted.
 *
 * Environment (all optional; the workflow sets none):
 *   GUARD_OWNER           npm user that must maintain every reserved name
 *   GUARD_RESERVED        comma-separated names, replacing the list below
 *   GUARD_REGISTRY        registry base URL (tests point it at a local server)
 *   GUARD_RETRY_DELAY_MS  base back-off between the three attempts per request
 *   GITHUB_STEP_SUMMARY   when set, the table is appended to it
 */

import fs from 'node:fs';

const OWNER = process.env.GUARD_OWNER || 'manojmallick';

// Names the maintainer holds and publishes as official redirect packages.
// `@sigmap/cli` is NOT here and cannot be: the `@sigmap` npm scope belongs to
// someone else (npm's website answers "The organization name 'sigmap' is not
// available", 2026-10-29), and listing a name the maintainer cannot own would
// fail the guard daily. The search check below still reports any `@sigmap/*`
// package published by anyone but the maintainer, because its name matches the
// brand.
const RESERVED = (process.env.GUARD_RESERVED ||
  'sigmap-cli,sigmap-core,sigmap-mcp,sigmap-mcp-server,gen-project-map').split(',').filter(Boolean);

// The real package: ownership must never drift.
const CORE = ['sigmap'];

// Packages that exist, belong to someone else, and were reviewed. Adding a name
// here is a deliberate act.
const REVIEWED_FOREIGN = {
  'gen-context': 'unrelated tool by another author, registered 2025-09-03 (cannot be claimed; never tell users to run `npx gen-context`)',
  'proc-sigmap': 'unrelated package from 2015',
  '@iflow-mcp/manojmallick-sigmap': 'third-party MCP-marketplace mirror of sigmap@4.1.0 (April 2026)',
};

const REG = (process.env.GUARD_REGISTRY || 'https://registry.npmjs.org').replace(/\/+$/, '');
const RETRY_MS = process.env.GUARD_RETRY_DELAY_MS === undefined ? 1500 : Number(process.env.GUARD_RETRY_DELAY_MS);

const rows = [];
let failed = 0;
const add = (name, status, note = '', fail = false) => { rows.push({ name, status, note }); if (fail) failed++; };

async function get(url, accept = 'application/json') {
  let last = 'no attempt';
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { accept } });
      if (r.status === 404) return { status: 404 };
      if (r.ok) return { status: 200, json: await r.json() };
      last = 'HTTP ' + r.status;
    } catch (e) { last = String(e.message || e); }
    await new Promise((res) => setTimeout(res, RETRY_MS * (i + 1)));
  }
  return { status: 0, error: last };
}

const maintainers = (doc) => (doc.maintainers || []).map((m) => m.name || m.username);

for (const name of [...new Set([...CORE, ...RESERVED])]) {
  const r = await get(`${REG}/${name.replace('/', '%2f')}`);
  if (r.status === 0) { add(name, 'ERROR', `registry unreachable: ${r.error}`, true); continue; }
  if (r.status === 404) { add(name, 'UNCLAIMED', 'returns 404: anyone can register it', true); continue; }
  const m = maintainers(r.json);
  if (!m.includes(OWNER)) { add(name, 'FOREIGN', `maintainers: ${m.join(', ') || 'none'}`, true); continue; }
  const latest = r.json['dist-tags'] && r.json['dist-tags'].latest;
  if (!latest) { add(name, 'NO-LATEST', 'owned, but has no `latest` dist-tag', true); continue; }
  add(name, 'OK', `latest ${latest}; maintainers: ${m.join(', ')}`);
}

// New look-alikes: anything the search index returns for the brand that we
// neither own nor reviewed.
const seen = new Set();
for (const term of ['sigmap', 'sig-map']) {
  const s = await get(`${REG}/-/v1/search?text=${encodeURIComponent(term)}&size=250`);
  if (s.status !== 200) { add(`search:${term}`, 'ERROR', `search unreachable: ${s.error || s.status}`, true); continue; }
  for (const o of s.json.objects || []) {
    const p = o.package;
    if (seen.has(p.name) || !/sig-?map/i.test(p.name)) continue;
    seen.add(p.name);
    const m = (p.maintainers || []).map((x) => x.username);
    if (m.includes(OWNER)) continue;
    if (REVIEWED_FOREIGN[p.name]) { add(p.name, 'REVIEWED', REVIEWED_FOREIGN[p.name]); continue; }
    add(p.name, 'NEW-LOOKALIKE', `published ${String(p.date).slice(0, 10)} by ${(p.publisher || {}).username || '?'}; maintainers: ${m.join(', ')}`, true);
  }
}
// Reviewed foreign names that are not brand-matching (e.g. gen-context) still
// get an ownership drift check.
for (const name of Object.keys(REVIEWED_FOREIGN)) {
  if (seen.has(name)) continue;
  const r = await get(`${REG}/${name.replace('/', '%2f')}/latest`);
  if (r.status === 404) add(name, 'REVIEWED-GONE', 'was reviewed as foreign; now 404 (claimable)', false);
}

const icon = { OK: 'ok', REVIEWED: 'reviewed', 'REVIEWED-GONE': 'gone' };
const lines = ['| name | status | note |', '|---|---|---|',
  ...rows.map((r) => `| \`${r.name}\` | ${icon[r.status] || '**' + r.status + '**'} | ${r.note} |`)];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### npm name guard\n\n${lines.join('\n')}\n`);
}
console.log(failed ? `\nnpm-name-guard: ${failed} problem(s)` : '\nnpm-name-guard: all reserved names are owned by ' + OWNER);
process.exit(failed ? 1 : 0);
