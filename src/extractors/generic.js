'use strict';
module.exports = { extract };

const PATTERNS = [
  /^(?:pub\s+)?(?:async\s+)?function\s+\w+\s*\(/,
  /^(?:pub\s+)?(?:async\s+)?fn\s+\w+[\s(<]/,
  /^def\s+\w+[\s(|:]/,
  /^(?:pub\s+)?func\s+\w+\s*\(/,
  /^(?:let|let\s+rec)\s+\w+\s*[=(]/,
  /^class\s+\w+/,
  /^(?:proc|sub|method)\s+\w+\s*\(/,
];

function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const results = [];
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || /^[#\-]/.test(line) || /^\/\//.test(line) || line.includes('\0')) continue;
    for (const pat of PATTERNS) {
      if (pat.test(line)) { results.push(line.slice(0, 120)); break; }
    }
    if (results.length >= 15) break;
  }
  return results;
}
