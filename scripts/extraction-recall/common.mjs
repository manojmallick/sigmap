// What every extraction-recall adapter needs: the file set, the pinned commits and the
// shipped index. Dev-only (see scripts/lib/extraction-recall.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { CODE_ROOT, loadManifest, withZeroConfigIndex } from '../lib/xrepo.mjs';

export const DEFAULT_REPOS = path.join(CODE_ROOT, 'benchmarks', 'repos');

/**
 * The files under `roots` (each `[repo, dir-inside-repo]`) with extension `ext`, sorted,
 * skipping directories whose name matches `skipDir`. Returns [] when no clone is present.
 * @returns {{repo:string, rel:string, abs:string}[]}
 */
export function listFiles(reposDir, roots, ext, skipDir) {
  const out = [];
  const walk = (repo, dir) => {
    let entries;
    try { entries = fs.readdirSync(path.join(reposDir, repo, dir), { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!skipDir || !skipDir.test(e.name)) walk(repo, rel); }
      else if (e.name.endsWith(ext)) out.push({ repo, rel, abs: path.join(reposDir, repo, rel) });
    }
  };
  for (const [repo, dir] of roots) walk(repo, dir);
  return out.sort((a, b) => (a.abs < b.abs ? -1 : a.abs > b.abs ? 1 : 0));
}

/** The short commit a clone is at, or null. */
export function shaOf(reposDir, repo) {
  try { return execFileSync('git', ['-C', path.join(reposDir, repo), 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_) { return null; }
}

/** First line of `cmd args` output, or null when the command is absent or fails. */
export function probe(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return null;
  return (r.stdout || r.stderr || '').split('\n')[0].trim() || null;
}

/**
 * Index one clone the way a first-time user's `sigmap` run does (auto-detected source
 * directories, no config file), hand the signature index to `fn`, and leave the
 * checkout byte-identical. `pythonAst` lets the host's python3 serve the Python files,
 * as it does on a user's machine; without it the pure-Node regex tier serves them.
 */
export function withShippedIndex(reposDir, repo, opts, fn) {
  const manifest = (() => { try { return loadManifest(CODE_ROOT); } catch (_) { return { repos: [] }; } })();
  const entry = manifest.repos.find((r) => r.name === repo) || { name: repo };
  return withZeroConfigIndex(CODE_ROOT, entry, ({ index }) => fn(index), { dir: path.join(reposDir, repo), pythonAst: !!opts.pythonAst });
}

/** The index's line for a file, minus the "… +N more" notice that the cap leaves in its place. */
export function indexedSigs(index, rel) {
  return (index.get(rel) || []).filter((s) => !/^\s*…\s*\+\d+ more/.test(s));
}

/** Drop a signature line's `:start-end` anchor and anything after it. */
export function bare(sig) {
  return sig.replace(/\s+:\d+-\d+.*$/, '');
}
