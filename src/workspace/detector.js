'use strict';
const fs   = require('fs');
const path = require('path');
module.exports = { detectWorkspaces, inferPackage, scopeToPackage };

function detectWorkspaces(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return [];
  }

  const patterns = pkg.workspaces || [];
  const dirs = [];

  // Handle both flat array and object with packages field (Yarn v2 format)
  const patternArray = Array.isArray(patterns) ? patterns : (patterns.packages || []);

  for (const p of patternArray) {
    const base = p.replace(/\/\*\*?$/, '');
    const resolved = path.join(cwd, base);
    if (fs.existsSync(resolved)) {
      try {
        for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
          if (entry.isDirectory()) dirs.push(path.join(resolved, entry.name));
        }
      } catch (_) {}
    }
  }

  return dirs;
}

// Infer package from query tokens: "add rate limiting to payments" → "packages/payments"
function inferPackage(query, workspaceDirs, cwd) {
  const tokens = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);

  // Find longest matching package name
  let bestMatch = null;
  let bestLen = 0;
  let bestMatchLen = 0;

  for (const dir of workspaceDirs) {
    const name = path.basename(dir).toLowerCase();
    for (const token of tokens) {
      const matchLen = _getMatchLength(name, token);
      // Only consider matches; use longest match, and break ties by longest package name
      if (matchLen > 0 && (matchLen > bestLen || (matchLen === bestLen && name.length > bestMatchLen))) {
        bestMatch = dir;
        bestLen = matchLen;
        bestMatchLen = name.length;
      }
    }
  }

  return bestMatch;
}

function _getMatchLength(name, token) {
  if (name === token) return 1000 + name.length;  // Exact match is best
  if (name.startsWith(token) && token.length >= 3) return 100 + token.length;
  if (token.startsWith(name) && name.length >= 3) return name.length;
  return 0;
}

// Return boost multiplier for files inside the inferred package
function scopeToPackage(filePath, packageDir) {
  const normalized = filePath.replace(/\\/g, '/');
  const normalizedPkg = packageDir.replace(/\\/g, '/');

  // Ensure we match the directory boundary, not just a prefix
  // e.g., packages/payment should not match packages/payment-old
  if (normalized.startsWith(normalizedPkg)) {
    const afterPrefix = normalized.slice(normalizedPkg.length);
    // Check if next char is / or if it's the exact match
    if (afterPrefix === '' || afterPrefix[0] === '/') {
      return 0.30;
    }
  }
  return 0;
}
