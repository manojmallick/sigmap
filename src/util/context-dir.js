'use strict';

/**
 * `.context/` — SigMap's own state directory — keeps itself out of git.
 *
 * It holds derived indexes (`sig-index.json`, `body-words.json`), run telemetry
 * (`gain.ndjson`, `usage.json`) and session records (`sessions.ndjson`, which
 * carry the questions asked). None of it is source, and the user's own
 * `.gitignore` is not ours to edit.
 *
 * Several published pages said `sigmap --init` gitignores the directory. Nothing
 * did: `--init` writes a config and a `.contextignore`, and every other command
 * wrote into `.context/` and left `git add .` to commit it (#947). The words
 * cache turning on by default in v8.75.0 raised the stakes.
 *
 * The fix is the one `.pytest_cache`, `.ruff_cache` and `.mypy_cache` use: the
 * directory carries its own `.gitignore` holding `*`. That works on the first
 * run, with or without `--init`, in a repo that has no root `.gitignore`, and
 * the pattern ignores the file that holds it, so no stray untracked file
 * replaces the one it hides.
 *
 * Deliberately NOT done:
 *   - creating `.context/` — a command that wrote nothing there gets nothing;
 *   - overwriting an existing `.context/.gitignore` — a user who wants some of
 *     the directory tracked edits it and is left alone;
 *   - untracking — ignore rules never touch files git already tracks, so a repo
 *     that committed `.context/` under an earlier version keeps tracking it
 *     until `git rm -r --cached .context` (`sigmap doctor` says so).
 *
 * Zero dependencies, synchronous, never throws.
 */

const fs = require('fs');
const path = require('path');

const CONTEXT_DIR = '.context';
const SELF_IGNORE = '.gitignore';

const BODY = [
  '# SigMap local state: derived indexes, caches, run telemetry and session records.',
  '# None of it is source, so nothing in this directory is committed.',
  '# SigMap writes this file only when it is absent; edit it to track part of the directory.',
  '*',
  '',
].join('\n');

/**
 * Make `<cwd>/.context/` ignore itself.
 *
 * @param {string} cwd project root
 * @returns {'created'|'present'|'absent'|'unwritable'}
 *   `absent` when there is no `.context/` directory (nothing is created),
 *   `present` when a `.context/.gitignore` already exists (left byte-for-byte),
 *   `unwritable` when the directory cannot take the file (read-only checkout).
 */
function ensureSelfIgnore(cwd) {
  const dir = path.join(cwd, CONTEXT_DIR);
  try {
    if (!fs.statSync(dir).isDirectory()) return 'absent';
  } catch (_) { return 'absent'; }
  const file = path.join(dir, SELF_IGNORE);
  try {
    if (fs.existsSync(file)) return 'present';
    // `wx`: fail rather than overwrite if another process won the race.
    fs.writeFileSync(file, BODY, { flag: 'wx' });
    return 'created';
  } catch (e) {
    return e && e.code === 'EEXIST' ? 'present' : 'unwritable';
  }
}

/**
 * Whether a directory-entry name under `.context/` is the self-ignore file.
 * The scans that key a cache on the newest mtime in `.context/` skip it, so
 * creating it never invalidates a cache.
 */
function isSelfIgnore(name) {
  return name === SELF_IGNORE;
}

module.exports = { ensureSelfIgnore, isSelfIgnore, CONTEXT_DIR, SELF_IGNORE };
