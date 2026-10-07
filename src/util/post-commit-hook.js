'use strict';

/**
 * The git post-commit hook `sigmap --setup` installs (#784, #918).
 *
 * One module owns what a SigMap hook line looks like, so the installer, `doctor`
 * and the tests cannot disagree about it. The installer used to find "its" line
 * with `line.includes('gen-context.js')`, which went wrong both ways:
 *
 *   - a global install runs through the `sigmap` symlink, so the line it writes
 *     never contains `gen-context.js` and re-running `--setup` appended another
 *     copy — one more regeneration on every commit, each run;
 *   - the rewrite dropped EVERY line containing the substring, including a
 *     team's own `node scripts/gen-context.js …` step.
 *
 * A line is SigMap's when it has the shape SigMap writes: `node <sigmap entry>
 * --generate …`. Anything else in the hook is left alone.
 *
 * `--generate` is the v0.1.0 spelling of a bare run and is promised unchanged
 * (packages/core/README.md), so every hook already written keeps working.
 *
 * Zero dependencies; reads and writes only `.git/hooks/post-commit`.
 */

const fs = require('fs');
const path = require('path');

/** The flag the hook passes; a documented alias of a bare `sigmap` run. */
const HOOK_FLAG = '--generate';

// `node "<path>/gen-context.js" --generate …` (a local install, or the original
// `$(git rev-parse --show-toplevel)/gen-context.js` form) or
// `node "<bin>/sigmap" --generate …` (a global / npx install, quoted or not).
const OWN_LINE = /^\s*node\s+(?:"[^"\n]*(?:gen-context\.js|[/\\]sigmap)"|\S*(?:gen-context\.js|[/\\]sigmap))\s+--generate(?:\s|$)/;

/** The line `--setup` writes for a given entry script. */
function hookLine(scriptPath) {
  return `node ${JSON.stringify(path.resolve(scriptPath))} ${HOOK_FLAG} 2>/dev/null || true`;
}

/** Whether a line of a hook file is one SigMap wrote. */
function isOwnLine(line) {
  return OWN_LINE.test(line);
}

/** The entry script a SigMap hook line runs, resolved against `cwd`; null when unreadable. */
function scriptOf(line, cwd) {
  const m = line.match(/^\s*node\s+("[^"\n]*"|\S+)/);
  if (!m) return null;
  let target = m[1];
  if (target[0] === '"') {
    try { target = JSON.parse(target); } catch (_) { target = target.slice(1, -1); }
  }
  target = target.replace('$(git rev-parse --show-toplevel)', cwd);
  return path.resolve(cwd, target);
}

/**
 * Install the hook, or bring an existing one up to date. Idempotent: running it
 * again with the same entry changes nothing.
 *
 * @param {string} cwd
 * @param {string} scriptPath the entry script the hook should run
 * @returns {{ action: 'installed'|'updated'|'unchanged'|'skipped', path: string|null }}
 */
function installPostCommitHook(cwd, scriptPath) {
  const hookDir = path.join(cwd, '.git', 'hooks');
  if (!fs.existsSync(hookDir)) return { action: 'skipped', path: null };
  const hookPath = path.join(hookDir, 'post-commit');
  const line = hookLine(scriptPath);

  if (!fs.existsSync(hookPath)) {
    fs.writeFileSync(hookPath, `#!/bin/sh\n${line}\n`);
    fs.chmodSync(hookPath, '755');
    return { action: 'installed', path: hookPath };
  }

  const existing = fs.readFileSync(hookPath, 'utf8');
  const lines = existing.split('\n');
  const own = lines.map((l, i) => (isOwnLine(l) ? i : -1)).filter((i) => i !== -1);

  if (own.length === 0) {
    fs.appendFileSync(hookPath, `\n${line}\n`);
    return { action: 'installed', path: hookPath };
  }
  if (own.length === 1 && lines[own[0]] === line) return { action: 'unchanged', path: hookPath };

  // Rewrite in place: the first SigMap line becomes the current one, any extra
  // copies go, and every other line keeps its place.
  const out = lines.map((l, i) => (i === own[0] ? line : l)).filter((l, i) => !own.slice(1).includes(i));
  fs.writeFileSync(hookPath, out.join('\n'));
  return { action: 'updated', path: hookPath };
}

/**
 * What is in the hook now, for `doctor`.
 *
 * @param {string} cwd
 * @returns {{ gitHooks: boolean, path: string, exists: boolean, copies: number,
 *   script: string|null, scriptExists: boolean|null, executable: boolean|null }}
 */
function inspectPostCommitHook(cwd) {
  const hookDir = path.join(cwd, '.git', 'hooks');
  const hookPath = path.join(hookDir, 'post-commit');
  const res = { gitHooks: false, path: hookPath, exists: false, copies: 0, script: null, scriptExists: null, executable: null };
  try { res.gitHooks = fs.statSync(hookDir).isDirectory(); } catch (_) { return res; }
  let text;
  try { text = fs.readFileSync(hookPath, 'utf8'); res.exists = true; } catch (_) { return res; }
  const own = text.split('\n').filter(isOwnLine);
  res.copies = own.length;
  if (own.length) {
    res.script = scriptOf(own[0], cwd);
    res.scriptExists = res.script ? fs.existsSync(res.script) : false;
  }
  // Git runs a hook only when it is executable. Windows has no such bit.
  if (process.platform !== 'win32') {
    try { fs.accessSync(hookPath, fs.constants.X_OK); res.executable = true; } catch (_) { res.executable = false; }
  }
  return res;
}

module.exports = { HOOK_FLAG, hookLine, isOwnLine, scriptOf, installPostCommitHook, inspectPostCommitHook };
