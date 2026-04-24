'use strict';

const fs   = require('fs');
const path = require('path');

module.exports = { loadIgnorePatterns, matchesIgnorePattern };

function loadIgnorePatterns(cwd) {
  for (const fname of ['.sigmapignore', '.contextignore']) {
    const p = path.join(cwd, fname);
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
    }
  }
  return [];
}

function matchesIgnorePattern(dirName, patterns) {
  for (const pat of patterns) {
    const clean = pat.replace(/\/$/, '');
    if (clean === dirName) return true;
    if (clean.endsWith('/**') && dirName.startsWith(clean.slice(0, -3))) return true;
    if (clean.endsWith('/*') && dirName.startsWith(clean.slice(0, -2))) return true;
  }
  return false;
}
