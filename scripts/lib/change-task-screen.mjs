// The invented-name screen for change tasks (#1072; the rule the agent study's change stage was missing).
//
// A hidden test that takes a name out of a module (`const { a, b } = require('../../src/x')`) which does not exist in that module at the
// base commit cannot pass unless the fix invents that very name, however correctly the bug is fixed. The bug report cannot contain it, so
// such a task measures whether the agent guessed the author's API, not whether it fixed the bug. In the first run this was 5 of 9 tasks
// (c01, c02, c03, c07, c11) and it made the whole stage uninformative (docs-vp/guide/agent-study.md, "Change tasks").
//
// `screenHiddenTests` is used by `scripts/build-change-tasks.mjs` (as a rule: a task whose tests invent a name is never kept) and by
// `benchmarks/agent-study/screen-change-tasks.mjs` (to describe a data root). Modules that fail to load are reported apart in
// `unresolved` and are NOT counted as invented: a test usually writes such a fixture to a temp directory itself.
//
// What it does not see (stated so nobody reads a pass as more than it is): only `const { a, b } = require(expr);` destructuring, which is
// how this repository's tests take names; not ESM `import { a } from`, not `const m = require(x); m.a`, not names a test takes from a file
// the fix creates (the builder excludes those separately), and not a hidden test that needs a changed *behaviour* nobody could guess.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const DESTRUCTURE = /const\s*\{([^}]+)\}\s*=\s*require\(([^;]+?)\);/g;

/**
 * The names each hidden test destructures out of a `require`, with the expression it requires.
 * @param {string} content  a test file's text
 * @returns {Array<{ names: string[], expr: string }>}
 */
export function destructuredRequires(content) {
  const out = [];
  const re = new RegExp(DESTRUCTURE.source, 'g');
  for (let m; (m = re.exec(content));) {
    out.push({ names: m[1].split(',').map((s) => s.trim().split(':')[0].trim()).filter(Boolean), expr: m[2] });
  }
  return out;
}

/**
 * Which names the hidden tests need that the tree at `dir` does not have.
 *
 * `dir` must hold the BASE tree (the fix not applied). A throwaway script is written next to each hidden test, so a relative
 * `require` resolves exactly as it would in the test, and is removed afterwards.
 *
 * @param {string} dir  the base tree
 * @param {Array<{ path: string, content: string }>} hidden  the hidden tests, `path` relative to `dir`
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {{ invents: string[], unresolved: string[] }}
 */
export function screenHiddenTests(dir, hidden, opts = {}) {
  const invents = []; const unresolved = [];
  for (const h of hidden) {
    const checks = destructuredRequires(h.content);
    const where = path.join(dir, path.dirname(h.path));
    fs.mkdirSync(where, { recursive: true });
    const lines = ["const path = require('path'); const fs = require('fs'); const os = require('os'); const ROOT = path.resolve(__dirname, '../..'); const res = { missing: [], unresolved: [] };"];
    for (const c of checks) {
      lines.push(`try { const m = require(${c.expr}); for (const n of ${JSON.stringify(c.names)}) if (typeof m[n] === 'undefined') res.missing.push(n); } catch (e) { res.unresolved.push(${JSON.stringify(c.expr.slice(0, 60))}); }`);
    }
    lines.push('console.log(JSON.stringify(res));');
    const file = path.join(where, '__screen.js');
    fs.writeFileSync(file, lines.join('\n'));
    try {
      const r = spawnSync(process.execPath, [file], { cwd: dir, encoding: 'utf8', timeout: opts.timeoutMs || 60000 });
      try {
        const j = JSON.parse(r.stdout.trim().split('\n').pop());
        for (const n of j.missing) if (!invents.includes(n)) invents.push(n);
        for (const n of j.unresolved) if (!unresolved.includes(n)) unresolved.push(n);
      } catch (_) { unresolved.push(`screen failed for ${h.path}`); }
    } finally {
      fs.rmSync(file, { force: true });
    }
  }
  return { invents, unresolved };
}

/**
 * Whether a screened task may be run: it was not left out, and its tests need no invented name.
 * @param {{ ran?: boolean, invents?: string[] }} entry  one object of `screen-change-tasks.mjs`'s output
 */
export function answerable(entry) {
  return entry.ran !== false && (entry.invents || []).length === 0;
}
