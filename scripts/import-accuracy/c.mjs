'use strict';

/**
 * Reference for C / C++ / Objective-C includes (#980): the compiler's own include trace.
 *
 * For every file the graph walked, `clang -E -H -fshow-skipped-includes` prints the headers it
 * opened, one per line, with a dot for each level of nesting. The lines with one dot are the
 * file's direct includes, resolved by the compiler's real search order. A header that an
 * include guard skipped is still printed (`-fshow-skipped-includes`), so a direct include is
 * not hidden because an earlier header already pulled it in.
 *
 * A header the compiler needs and the repository does not hold (a system header on a foreign
 * target, a third-party header such as `gtest/gtest.h`) is reported as an error, and the
 * preprocessor carries on with the next line, so the includes after it are still listed. It
 * is not in the tree, so it is never an edge. (A compiler that stopped at the first missing
 * header would leave such a file half read; the test pins that this one does not.)
 *
 * Conditional includes are seen only for the configurations run: the host (macOS), and Linux
 * and Windows by target triple with no system headers. An include behind another switch
 * (`-DFOO`) is not in the reference, which makes the graph's precision against it a lower bound.
 *
 * Dev-only. Nothing here ships in the npm package.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const GROUP = 'c';

const CPP_SOURCE = new Set(['.cc', '.cpp', '.cxx', '.c++', '.hpp', '.hh', '.hxx', '.h++', '.inl', '.ipp', '.tpp']);

/** The language flag for a file; a plain `.h` follows the repository's other sources. */
function languageOf(rel, repoIsCpp) {
  const ext = path.extname(rel).toLowerCase();
  if (ext === '.c') return 'c';
  if (ext === '.m') return 'objective-c';
  if (ext === '.mm') return 'objective-c++';
  if (CPP_SOURCE.has(ext)) return 'c++';
  return repoIsCpp ? 'c++' : 'c'; // .h
}

/**
 * @param {{ tree: string, files: string[], protocol: object }} i
 *        `files` are the repo-relative C-family files the graph walked
 * @returns {{ edges: Array<[string,string]>, covered: Set<string>, notes: object }}
 */
export function reference({ tree, files, protocol }) {
  const cfg = protocol.groups.c.reference;
  const repoIsCpp = files.some((f) => CPP_SOURCE.has(path.extname(f).toLowerCase()) && !/\.h$/i.test(f));
  const roots = ['', 'include', 'src'].map((d) => path.join(tree, d)).filter((d) => fs.existsSync(d));
  const treeReal = fs.realpathSync(tree);
  const edges = new Map();
  const covered = new Set();
  const failed = new Map();
  let runs = 0;

  for (const target of cfg.targets) {
    const base = ['-E', '-H', '-fshow-skipped-includes', '-w', '-ferror-limit=0', ...target.args, ...roots.flatMap((r) => ['-I', r])];
    for (const rel of files) {
      const abs = path.join(tree, rel);
      const r = spawnSync(cfg.compiler, [...base, '-x', languageOf(rel, repoIsCpp), abs, '-o', '/dev/null'], { cwd: tree, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60000 });
      runs++;
      if (r.error || r.status === null) { failed.set(rel, r.error ? r.error.code || 'error' : 'signal'); continue; }
      covered.add(rel);
      for (const line of (r.stderr || '').split('\n')) {
        const m = /^(\.+) (.+)$/.exec(line);
        if (!m || m[1].length !== 1) continue;
        let p;
        try { p = fs.realpathSync(path.resolve(tree, m[2])); } catch (_) { continue; }
        const inTree = path.relative(treeReal, p);
        if (!inTree || inTree.startsWith('..') || path.isAbsolute(inTree)) continue;
        const to = inTree.replace(/\\/g, '/');
        if (to !== rel) edges.set(`${rel}\u0000${to}`, [rel, to]);
      }
    }
  }
  // A file is covered only when every configuration processed it.
  for (const f of failed.keys()) covered.delete(f);
  return { edges: [...edges.values()], covered, notes: { clangRuns: runs, failed: failed.size, targets: cfg.targets.map((t) => t.name) } };
}
