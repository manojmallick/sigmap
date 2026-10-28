#!/usr/bin/env node
'use strict';

/**
 * check-workflow-pins.mjs — the workflows that test and publish the package
 * run only code that was reviewed, with only the token scopes they need (#1000).
 *
 *   node scripts/check-workflow-pins.mjs                 # check .github/workflows, exit 1 on a finding
 *   node scripts/check-workflow-pins.mjs --dir <path>    # check another directory (the test plants failures there)
 *
 * Two rules:
 *
 *   PINNED    — every `uses:` names a full 40-hex commit SHA followed by a
 *               `# vX.Y.Z` comment that says which release it is. A floating
 *               tag (`@v4`) moves under the workflow the day its owner
 *               re-points it, and the job that publishes the package runs
 *               whatever it points to that day. A local action (`./…`) lives in
 *               this repository and is exempt; a `docker://` image must be
 *               pinned by its `@sha256:` digest.
 *   READ-ONLY — every workflow has a top-level `permissions:` block that grants
 *               no write scope. `contents: write`, `id-token: write` and
 *               `packages: write` are asked for by the job that needs them, so
 *               a job that only runs tests cannot publish or push.
 *
 * Read line by line, as the other check-* scripts read theirs: this gate runs
 * in the job that installs nothing, so it carries no YAML parser.
 *
 * Zero-dependency. Node built-ins only.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = '.github/workflows';

const USES = /^\s*-?\s*uses:\s*(?:"([^"]+)"|'([^']+)'|(\S+))\s*(?:#\s*(.*?))?\s*$/;
const SHA_REF = /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/;
const DOCKER_REF = /^docker:\/\/\S+@sha256:[0-9a-f]{64}$/;
const VERSION_NOTE = /^v\d+(?:\.\d+){0,2}(?:[-+.\w]*)$/;
const READ_ONLY_SCALARS = new Set(['read-all', '{}']);

/**
 * The top-level `permissions:` block of one workflow, or null when it has none.
 * `scalar` is set for the one-line forms (`read-all`, `{}`, `write-all`); `scopes`
 * lists the `scope: level` lines of the block form.
 */
function topLevelPermissions(lines) {
  const at = lines.findIndex((l) => /^permissions:/.test(l));
  if (at === -1) return null;
  const scalar = lines[at].replace(/#.*$/, '').slice('permissions:'.length).trim();
  const scopes = [];
  if (!scalar) {
    for (let i = at + 1; i < lines.length; i++) {
      if (/^[^\s#]/.test(lines[i])) break; // the next top-level key ends the block
      const m = /^\s+([\w-]+):\s*(\w+)/.exec(lines[i].replace(/#.*$/, ''));
      if (m) scopes.push({ scope: m[1], level: m[2], line: i + 1 });
    }
  }
  return { line: at + 1, scalar, scopes };
}

/** One workflow file: its `uses:` references and its token default. */
function auditFile(text, rel) {
  const lines = text.split('\n');
  const problems = [];
  let uses = 0, pinned = 0;

  lines.forEach((line, i) => {
    if (/^\s*#/.test(line)) return;
    const m = USES.exec(line);
    if (!m) return;
    const ref = m[1] || m[2] || m[3];
    const note = m[4] || '';
    if (ref.startsWith('./')) return;
    uses++;
    const at = { rel, line: i + 1, text: line.trim() };
    if (!SHA_REF.test(ref) && !DOCKER_REF.test(ref)) {
      problems.push({ ...at, kind: 'UNPINNED', message: `${ref} is not pinned to a commit SHA` });
    } else if (!VERSION_NOTE.test(note)) {
      problems.push({ ...at, kind: 'UNLABELLED', message: `${ref.split('@')[0]} is pinned but has no "# vX.Y.Z" comment saying which release` });
    } else {
      pinned++;
    }
  });

  const perms = topLevelPermissions(lines);
  if (!perms) {
    problems.push({ rel, line: 1, kind: 'NO_PERMISSIONS', text: '', message: 'no top-level permissions: block, so the token takes the repository default (add contents: read)' });
  } else if (perms.scalar && !READ_ONLY_SCALARS.has(perms.scalar)) {
    problems.push({ rel, line: perms.line, kind: 'WRITE', text: `permissions: ${perms.scalar}`, message: `permissions: ${perms.scalar} at workflow level is not read-only` });
  } else {
    for (const s of perms.scopes) {
      if (s.level === 'write') {
        problems.push({ rel, line: s.line, kind: 'WRITE', text: `${s.scope}: write`, message: `${s.scope}: write at workflow level; grant it on the job that needs it` });
      }
    }
  }
  return { uses, pinned, problems };
}

/**
 * Audit every workflow in `dir` (default: this repository's).
 * @returns {{ dir: string, files: number, uses: number, pinned: number, problems: object[] }}
 */
export function audit(dir = path.join(ROOT, WORKFLOWS)) {
  const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort();
  const out = { dir, files: files.length, uses: 0, pinned: 0, problems: [] };
  for (const f of files) {
    const r = auditFile(readFileSync(path.join(dir, f), 'utf8'), f);
    out.uses += r.uses;
    out.pinned += r.pinned;
    out.problems.push(...r.problems);
  }
  return out;
}

function main() {
  const at = process.argv.indexOf('--dir');
  const dir = at === -1 ? path.join(ROOT, WORKFLOWS) : path.resolve(String(process.argv[at + 1] || ''));
  if (!existsSync(dir)) {
    console.error(`check-workflow-pins: no such directory: ${dir}`);
    process.exit(2);
  }
  const r = audit(dir);
  if (!r.problems.length) {
    console.log(`✓ ${r.uses} action references in ${r.files} workflows, all pinned to a commit SHA; every default token is read-only`);
    return;
  }
  console.error(`\n❌ ${r.problems.length} workflow finding(s) in ${path.relative(ROOT, dir) || dir}:`);
  for (const p of r.problems) {
    console.error(`   ${p.rel}:${p.line}  ${p.kind}  ${p.message}`);
    if (p.text) console.error(`      ${p.text}`);
  }
  console.error('\n   Pin with the SHA the tag points to and its release in a comment:');
  console.error('     uses: actions/checkout@<40-hex sha> # v4.4.0');
  console.error('   and ask for write scopes on the job that needs them, not at workflow level.\n');
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
