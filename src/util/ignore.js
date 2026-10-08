'use strict';

/**
 * `.contextignore` / `.repomixignore` — the one definition (#926).
 *
 * A full `generate` filters its file list through these patterns. The live
 * writers (the watcher, `freshen`, the MCP notify hooks) must apply the SAME
 * filter, or an overlay entry resurrects a file the full run deliberately
 * omitted and `ask` serves it.
 *
 * Zero-dependency, bundle-safe.
 */

const fs = require('fs');
const path = require('path');

/**
 * Patterns from `.contextignore` then `.repomixignore`, comments and blanks
 * dropped. An unreadable file contributes nothing: ignore rules are advisory,
 * and a long-running watcher must not die over a permissions flip.
 *
 * @param {string} cwd
 * @returns {string[]}
 */
function loadIgnorePatterns(cwd) {
  const patterns = [];
  for (const name of ['.contextignore', '.repomixignore']) {
    const p = path.join(cwd, name);
    let text;
    try { text = fs.readFileSync(p, 'utf8'); } catch (_) { continue; }
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) patterns.push(trimmed);
    }
  }
  return patterns;
}

/**
 * @param {string} relPath - repo-relative, forward slashes
 * @param {string[]} patterns
 * @returns {boolean}
 */
function matchesIgnore(relPath, patterns) {
  for (const pat of patterns) {
    const normalized = pat.replace(/\\/g, '/');
    // Strip trailing slash (gitignore style — directory patterns)
    const patternToUse = normalized.endsWith('/')
      ? normalized.slice(0, -1)
      : normalized;
    // Escape regex special chars but NOT brackets (keep them for character classes)
    const regexStr = patternToUse
      .replace(/[.+^${}()|\\]/g, '\\$&')
      .replace(/\*\*/g, '___DOUBLE___')
      .replace(/\*/g, '[^/]*')
      .replace(/___DOUBLE___/g, '.*');
    try {
      const regex = new RegExp(`(^|/)${regexStr}($|/)`);
      if (regex.test(relPath)) return true;
    } catch (_) {
      // Malformed bracket syntax or invalid regex — skip this pattern
    }
  }
  return false;
}

module.exports = { loadIgnorePatterns, matchesIgnore };
