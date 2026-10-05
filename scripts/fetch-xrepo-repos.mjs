#!/usr/bin/env node
/**
 * Fetch the xrepo corpus repositories at their pinned commits (#892).
 *
 *   node scripts/fetch-xrepo-repos.mjs                 # fetch whatever is missing or off-pin
 *   node scripts/fetch-xrepo-repos.mjs --only gin,tokio
 *   node scripts/fetch-xrepo-repos.mjs --check         # verify only — no network; exit 1 if a present repo is off-pin
 *
 * Every checkout lands at the exact SHA in benchmarks/xrepo-repos.json, so a
 * labelled expected file can only stop existing when the manifest changes.
 * Repos whose full tree is mostly binary assets carry `sparse` patterns and are
 * fetched blob-less, so only the matching files are downloaded.
 *
 * Idempotent: a repo already at its pin is left alone, which is what lets CI
 * restore `benchmarks/repos` from cache and fetch nothing. Git is always run
 * with an argument array, never through a shell.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadManifest, repoDir, git, checkoutState } from './lib/xrepo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const onlyIdx = argv.indexOf('--only');
const ONLY = onlyIdx !== -1 && argv[onlyIdx + 1] ? new Set(argv[onlyIdx + 1].split(',')) : null;

function must(step, r) {
  if (!r.ok) throw new Error(`${step} failed: ${r.err || r.out || 'no output'}`);
}

/** Bring one manifest entry's checkout to its pinned commit. */
function fetchPinned(repo) {
  const dir = repoDir(ROOT, repo.name);
  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.mkdirSync(dir, { recursive: true });
    must('git init', git(dir, ['init', '-q']));
    must('git remote add', git(dir, ['remote', 'add', 'origin', repo.url]));
  }
  if (repo.sparse) {
    // Written by hand rather than through `git sparse-checkout set`, which
    // differs across git versions on an unborn branch.
    must('sparse config', git(dir, ['config', 'core.sparseCheckout', 'true']));
    must('promisor config', git(dir, ['config', 'remote.origin.promisor', 'true']));
    must('filter config', git(dir, ['config', 'remote.origin.partialclonefilter', 'blob:none']));
    fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.git', 'info', 'sparse-checkout'), repo.sparse.join('\n') + '\n');
  }
  const fetchArgs = ['fetch', '--depth', '1', '--quiet', ...(repo.sparse ? ['--filter=blob:none'] : []), 'origin', repo.commit];
  must('git fetch', git(dir, fetchArgs));
  must('git checkout', git(dir, ['checkout', '-q', '--detach', repo.commit]));
  const now = checkoutState(ROOT, repo);
  if (!now.atPin) throw new Error(`HEAD is ${now.head}, expected ${repo.commit}`);
}

const manifest = loadManifest(ROOT);
let off = 0, failed = 0, fetched = 0, ok = 0, absent = 0;
for (const repo of manifest.repos) {
  if (ONLY && !ONLY.has(repo.name)) continue;
  const state = checkoutState(ROOT, repo);
  if (state.atPin) { ok++; console.log(`  ok       ${repo.name}  ${repo.commit.slice(0, 10)}`); continue; }
  if (CHECK) {
    if (state.present) { off++; console.error(`  OFF-PIN  ${repo.name}  at ${(state.head || '?').slice(0, 10)}, manifest pins ${repo.commit.slice(0, 10)}`); }
    else { absent++; console.log(`  absent   ${repo.name}`); }
    continue;
  }
  process.stdout.write(`  fetching ${repo.name} @ ${repo.commit.slice(0, 10)} ... `);
  try { fetchPinned(repo); fetched++; console.log('done'); }
  catch (e) { failed++; console.log('FAILED'); console.error(`    ${e.message}`); }
}

if (CHECK) {
  console.log(`\n[xrepo] ${ok} at pin, ${absent} absent, ${off} off-pin`);
  process.exit(off ? 1 : 0);
}
console.log(`\n[xrepo] ${ok} already at pin, ${fetched} fetched, ${failed} failed`);
process.exit(failed ? 1 : 0);
