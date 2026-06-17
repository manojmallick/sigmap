'use strict';

/**
 * Convention conflict analysis (IMPL.md §4 / §5.3 — grounded codegen, Layer 3).
 *
 * Given an `extractConventions` result, surface *why* a convention is mixed:
 * every variant pattern with its file count, share, and example files, plus
 * rename suggestions that move minority file-naming files toward the dominant
 * style. Pure, zero-dependency, bundle-safe.
 */

/** Split a file name into its stem (before the first dot) and the rest. */
function _splitName(filename) {
  const s = String(filename || '');
  const dot = s.indexOf('.');
  if (dot <= 0) return { stem: s, ext: '' };
  return { stem: s.slice(0, dot), ext: s.slice(dot) };
}

/** Break a stem into lowercase word parts regardless of its current style. */
function _words(stem) {
  return String(stem || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camel/Pascal boundaries
    .replace(/[-_]+/g, ' ')                 // kebab / snake separators
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const _cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

/**
 * Convert a file stem to a target naming style.
 * @param {string} stem name without extension
 * @param {'PascalCase'|'camelCase'|'kebab-case'|'snake_case'} style
 * @returns {string}
 */
function toNamingStyle(stem, style) {
  const w = _words(stem);
  if (w.length === 0) return String(stem || '');
  switch (style) {
    case 'PascalCase': return w.map(_cap).join('');
    case 'camelCase': return w[0] + w.slice(1).map(_cap).join('');
    case 'kebab-case': return w.join('-');
    case 'snake_case': return w.join('_');
    default: return String(stem || '');
  }
}

/** Rename suggestion to bring a file to the dominant naming style. */
function renameSuggestion(filename, dominantStyle) {
  const { stem, ext } = _splitName(filename);
  const to = toNamingStyle(stem, dominantStyle) + ext;
  return { from: filename, to };
}

const LABELS = {
  fileNaming: 'file naming',
  exportStyle: 'export style',
};

/**
 * Analyze an `extractConventions` result for conflicts.
 * @param {object} result the object returned by `extractConventions`
 * @returns {{ hasConflicts: boolean, conventions: Array<{
 *   key:string, name:string, dominant:string|null, dominantPct:number,
 *   tier:string, total:number,
 *   variants:Array<{pattern:string,count:number,pct:number,examples:string[]}>,
 *   renames:Array<{from:string,to:string}> }> }}
 */
function analyzeConflicts(result) {
  const out = [];
  for (const key of ['fileNaming', 'exportStyle']) {
    const conv = result && result[key];
    // A conflict is any convention with more than one observed pattern.
    if (!conv || conv.total === 0 || conv.variants.length < 2) continue;

    const variants = conv.variants.map((v) => ({
      pattern: v.label,
      count: v.count,
      pct: v.pct,
      examples: v.examples || [],
    }));

    // Rename suggestions only for file naming (export style is a code change, not a rename).
    const renames = [];
    if (key === 'fileNaming' && conv.dominant) {
      for (const v of conv.variants) {
        if (v.label === conv.dominant) continue;
        for (const ex of (v.examples || [])) {
          renames.push(renameSuggestion(ex, conv.dominant));
        }
      }
    }

    out.push({
      key,
      name: LABELS[key] || key,
      dominant: conv.dominant,
      dominantPct: conv.dominantPct,
      tier: conv.tier,
      total: conv.total,
      variants,
      renames,
    });
  }
  return { hasConflicts: out.length > 0, conventions: out };
}

module.exports = { analyzeConflicts, toNamingStyle, renameSuggestion };
