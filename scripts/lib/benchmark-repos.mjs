'use strict';

/**
 * benchmark-repos.mjs — which checkouts under benchmarks/repos a suite that walks
 * the whole directory should measure (#893 §7).
 *
 * `fetch:xrepo` clones the xrepo corpus into benchmarks/repos, beside the
 * repositories the other suites expect. Seven of its repositories are expected
 * by no other suite; the manifest flags them `xrepoOnly`. A suite that
 * enumerates the directory instead of keeping a list of its own asks here for
 * the names, so a machine that has run `fetch:xrepo` measures the same corpus
 * as one that has not. Zero-dependency; Node built-ins only.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST_REL = 'benchmarks/xrepo-repos.json';

/**
 * Names of the checkouts only the xrepo gate uses.
 * @param {string} [root] data root holding the manifest (this checkout by default)
 * @returns {Set<string>} empty when the manifest is absent or unreadable
 */
export function xrepoOnlyNames(root = ROOT) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, MANIFEST_REL), 'utf8'));
    return new Set((manifest.repos || []).filter((r) => r && r.xrepoOnly === true).map((r) => r.name));
  } catch (_) {
    return new Set();
  }
}

/**
 * The checkouts a whole-directory suite measures, sorted. A symlinked checkout
 * counts: it is how a worktree borrows the clones of the main tree.
 *
 * @param {string} reposDir directory holding the checkouts
 * @param {string} [root] data root holding the manifest
 * @returns {string[]}
 * @throws when `reposDir` cannot be read — callers already handle a missing corpus
 */
export function benchmarkRepoNames(reposDir, root = ROOT) {
  const skip = xrepoOnlyNames(root);
  return fs.readdirSync(reposDir)
    .filter((name) => {
      if (skip.has(name)) return false;
      try { return fs.statSync(path.join(reposDir, name)).isDirectory(); } catch (_) { return false; }
    })
    .sort();
}
