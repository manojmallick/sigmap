'use strict';

/**
 * Reference for Swift imports at module level (#980): the Swift compiler and SwiftPM.
 *
 * `swift package describe --type json` reports the targets of the package and the files each
 * owns; `swiftc -emit-imported-modules` reports the modules a file imports. A reference edge is
 * (file, module:M) when the file imports the module M and M is a local target other than the
 * file's own, which is exactly the module-level importer relation `--impact` reports. No Swift
 * code of the repository is compiled and no dependency is resolved: `describe` reads the
 * manifest, and `-emit-imported-modules` only parses.
 *
 * A manifest that needs its dependencies fetched before it can be described (a package with
 * remote dependencies, offline) is reported unmeasured with the error.
 *
 * Dev-only. Nothing here ships in the npm package.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const GROUP = 'swift';

/**
 * @param {{ tree: string, files: string[], protocol: object, work?: string }} i  `files` are every `.swift` file under the tree
 * @returns {{ edges: Array<[string,string]>, covered: Set<string>, notes: object }}
 */
export function reference({ tree, files, protocol, work }) {
  const cfg = protocol.groups.swift.reference;
  const d = spawnSync(cfg.swift, ['package', 'describe', '--type', 'json'], { cwd: tree, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 600000 });
  if (d.status !== 0) {
    return { edges: [], covered: new Set(), notes: { unmeasured: `swift package describe failed: ${(d.stderr || '').trim().split('\n').slice(0, 3).join(' | ').slice(0, 300)}` } };
  }
  let pkg;
  try { pkg = JSON.parse(d.stdout); } catch (e) { return { edges: [], covered: new Set(), notes: { unmeasured: 'swift package describe did not print JSON' } }; }
  const local = new Set(pkg.targets.map((t) => t.name));
  // a target whose sources hold no Swift file (a C or C++ target) has no file the product could be asked about
  const hasSwift = new Set(pkg.targets.filter((t) => (t.sources || []).some((s) => s.endsWith('.swift'))).map((t) => t.name));
  const ownerOf = new Map();
  for (const t of pkg.targets) for (const s of t.sources || []) ownerOf.set(path.normalize(path.join(t.path, s)), t.name);

  const edges = [];
  const covered = new Set();
  const failed = [];
  // The module list goes to a file: `-o /dev/stdout` fails on Linux ("No such device or address")
  // when stdout is a socket, which is how a child process gets it from Node.
  const outDir = fs.mkdtempSync(path.join(work || os.tmpdir(), 'swift-imports-'));
  const out = path.join(outDir, 'imports.txt');
  try {
    for (const rel of files) {
      // The compiler's own rule: a file named main.swift is the program's entry point and may hold
      // top-level code; every other file is parsed as part of a library.
      const asLibrary = path.basename(rel) !== 'main.swift';
      fs.rmSync(out, { force: true });
      const r = spawnSync(cfg.compiler, ['-emit-imported-modules', ...(asLibrary ? ['-parse-as-library'] : []), '-module-name', 'M', path.join(tree, rel), '-o', out], { encoding: 'utf8', maxBuffer: 1 << 24, timeout: 60000 });
      if (r.status !== 0 || !fs.existsSync(out)) { failed.push([rel, (r.stderr || String(r.error || '')).split('\n').find((l) => /error/.test(l)) || 'exit ' + r.status]); continue; }
      covered.add(rel);
      const own = ownerOf.get(path.normalize(rel));
      for (const m of new Set(fs.readFileSync(out, 'utf8').split('\n').map((x) => x.trim()).filter(Boolean))) {
        if (local.has(m) && m !== own) edges.push([rel, `module:${m}`, hasSwift.has(m) ? 'a module of Swift files' : 'a module with no Swift file (a C-language target)']);
      }
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  return { edges, covered, notes: { targets: pkg.targets.length, filesOwned: ownerOf.size, failed: failed.length, failedSample: failed.slice(0, 5).map(([f, why]) => `${f}: ${why.trim().slice(0, 100)}`) } };
}
