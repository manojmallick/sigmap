#!/usr/bin/env node

/**
 * check-path-independence.mjs — does the generated map depend on where the repo is checked out? (#993)
 *
 * The same commit must give the same instruction file wherever it lives. The token
 * budget used to price each section by its ABSOLUTE path although the heading
 * renders the repo-relative one, so a deeper clone lost sections (gin: 69 → 50
 * over 180 characters of path), and the retrieval headline that scores the budgeted
 * file moved with it. This copies a repository to checkout paths of different
 * length, generates the map in each, and compares them. The wall-clock line
 * (`<!-- Updated: … -->`) is the only line allowed to differ.
 *
 * The copy keeps each file's timestamps. The drop order ranks files by mtime, so a
 * copy with fresh timestamps compares two recency orderings, not two paths: on a
 * filesystem with a coarse clock (Linux) a copy loop spreads a repository over a few
 * dozen distinct mtimes whose boundaries fall wherever the copy happened to be.
 *
 *   node scripts/check-path-independence.mjs --repo benchmarks/repos/gin
 *   node scripts/check-path-independence.mjs --repo <dir> --pads 0,100,200 --keep
 *
 * Exits 1 when two checkouts disagree. Zero dependencies. The copy leaves out .git,
 * node_modules, .context and SigMap's own outputs, so a repo that was already
 * indexed starts from the same place as a fresh clone.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import { join, basename, resolve } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1]; };

const repo = opt('--repo');
if (!repo || !existsSync(resolve(repo))) {
  console.error('usage: node scripts/check-path-independence.mjs --repo <dir> [--pads 0,60,120,180] [--keep]');
  process.exit(2);
}
const pads = String(opt('--pads', '0,60,120,180')).split(',').map((n) => Number(n.trim()));
const keep = args.includes('--keep');
const src = resolve(repo);
const work = mkdtempSync(join(tmpdir(), 'sigmap-pathind-'));

const SKIP = new Set(['.git', 'node_modules', '.context', '.sigmap-cache.json']);
const OWN = new Set(['copilot-instructions.md', 'copilot-instructions.cache.json']);

const rows = [];
for (const pad of pads) {
  const dest = join(work, pad ? 'p'.repeat(pad) : 'near', basename(src));
  cpSync(src, dest, {
    recursive: true,
    preserveTimestamps: true,
    filter: (p) => !SKIP.has(basename(p)) && !(p.includes(`${join(src, '.github')}`) && OWN.has(basename(p))),
  });
  const res = spawnSync(process.execPath, [join(ROOT, 'gen-context.js')], { cwd: dest, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (res.status !== 0) {
    console.error(`generation failed at pad ${pad}:\n${res.stdout}${res.stderr}`);
    process.exit(2);
  }
  const text = readFileSync(join(dest, '.github', 'copilot-instructions.md'), 'utf8');
  const body = text.split('\n').filter((l) => !/^<!-- Updated: /.test(l)).join('\n');
  rows.push({ pad, pathLength: dest.length, sections: (text.match(/^### /gm) || []).length, bytes: Buffer.byteLength(body), body });
}

const base = rows[0];
console.log(`${'pad'.padEnd(6)}${'path length'.padEnd(13)}${'sections'.padEnd(10)}${'bytes'.padEnd(10)}vs first`);
let differ = 0;
for (const r of rows) {
  const same = r.body === base.body;
  if (!same) differ++;
  console.log(`${String(r.pad).padEnd(6)}${String(r.pathLength).padEnd(13)}${String(r.sections).padEnd(10)}${String(r.bytes).padEnd(10)}${same ? 'identical' : 'DIFFERENT'}`);
}

if (keep) console.log(`\ncheckouts kept under ${work}`);
else rmSync(work, { recursive: true, force: true });

if (differ) {
  console.error(`\nFAIL: ${differ} checkout path(s) produced a different map for the same commit`);
  process.exit(1);
}
console.log(`\nOK: ${rows.length} checkout paths, one map`);
