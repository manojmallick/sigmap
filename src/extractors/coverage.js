'use strict';

const fs = require('fs');
const path = require('path');

function walkFiles(dir) {
  let out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function buildTestIndex(cwd, testDirs) {
  const dirs = Array.isArray(testDirs) && testDirs.length ? testDirs : ['tests', 'test', '__tests__', 'spec'];
  const names = new Set();

  for (const dir of dirs) {
    const abs = path.join(cwd, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of walkFiles(abs)) {
      let src = '';
      try {
        src = fs.readFileSync(file, 'utf8');
      } catch (_) {
        continue;
      }

      // Extract tokens from JS/TS test name strings (it/test/describe calls)
      for (const m of src.matchAll(/\b(?:it|test|describe)\s*\(\s*['"\`]([\w_ ]+)['"\`]/g)) {
        if (!m[1]) continue;
        const full = m[1].replace(/[\s_]+/g, '_').toLowerCase();
        names.add(full); // also keep whole phrase: "validate_user"
        for (const word of m[1].split(/[\s_]+/)) {
          if (word.length >= 3) names.add(word.toLowerCase());
        }
      }
      // Python/Ruby style: def test_funcname() / def test_funcname: → index the suffix
      for (const m of src.matchAll(/\bdef\s+test_([\w]+)\s*[(:]/g)) {
        if (!m[1]) continue;
        names.add(m[1].toLowerCase()); // full suffix: "validate_user"
        for (const word of m[1].split('_')) {
          if (word.length >= 3) names.add(word.toLowerCase());
        }
      }
      // Also capture identifiers directly invoked in expect/assert calls
      for (const m of src.matchAll(/\b(?:expect|assert)\s*\(\s*(?:await\s+)?([\w]+)\s*\(/g)) {
        if (m[1] && m[1].length >= 3) names.add(m[1].toLowerCase());
      }
    }
  }

  return names;
}

function isTested(funcName, testIndex) {
  if (!funcName || funcName.length < 3 || !testIndex || testIndex.size === 0) return false;
  const lower = funcName.toLowerCase();
  // Direct match or test_ prefix match
  if (testIndex.has(lower) || testIndex.has(`test_${lower}`)) return true;
  // Token-level match: split camelCase and snake_case, check if all meaningful tokens are covered
  const tokens = funcName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(t => t.length >= 3);
  if (tokens.length >= 2 && tokens.every(t => testIndex.has(t))) return true;
  return false;
}

module.exports = { buildTestIndex, isTested };
