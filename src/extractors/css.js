'use strict';

/**
 * Extract signatures from CSS/SCSS/SASS/Less source code.
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  const stripped = src
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // CSS custom properties (variables)
  const rootMatch = stripped.match(/:root\s*\{([^}]*)\}/);
  if (rootMatch) {
    for (const m of rootMatch[1].matchAll(/(--[\w-]+)\s*:/g)) {
      sigs.push(`var ${m[1]}`);
    }
  }

  // SCSS/Less variables
  for (const m of stripped.matchAll(/^(\$[\w-]+)\s*:/gm)) {
    sigs.push(`$var ${m[1]}`);
  }

  // SCSS mixins
  for (const m of stripped.matchAll(/^@mixin\s+([\w-]+)(?:\s*\(([^)]*)\))?/gm)) {
    const params = m[2] ? `(${m[2].trim()})` : '';
    sigs.push(`@mixin ${m[1]}${params}`);
  }

  // SCSS functions
  for (const m of stripped.matchAll(/^@function\s+([\w-]+)\s*\(([^)]*)\)/gm)) {
    sigs.push(`@function ${m[1]}(${m[2].trim()})`);
  }

  // Key class names (top-level) — prefer hyphenated BEM/component names over utilities
  const allClassMatches = [...stripped.matchAll(/^\.([\w-]+)(?=[^{]*\{)/gm)];
  // Utility-class detection: if 70%+ of top-level selectors are single-word (no hyphens),
  // this is likely a compiled/utility CSS file — skip class extraction to avoid noise
  const singleWordCount = allClassMatches.filter(m => !m[1].includes('-')).length;
  const isUtilityFile = allClassMatches.length >= 5 && (singleWordCount / allClassMatches.length) > 0.70;
  if (!isUtilityFile) {
    const hyphenated = [];
    const singleWord = [];
    for (const m of allClassMatches) {
      if (m[1].includes('-')) hyphenated.push(m[1]);
      else singleWord.push(m[1]);
    }
    // Up to 8 slots: hyphenated classes (semantic) first, then single-word to fill remaining
    const selected = [...hyphenated, ...singleWord].slice(0, 8);
    for (const name of selected) sigs.push(`.${name}`);
  }

  return sigs.slice(0, 25);
}

module.exports = { extract };
