'use strict';

/**
 * Lightweight markdown technical indexer.
 * Captures headings and fenced code block language hints only.
 *
 * @param {string} src - Raw markdown content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Headings: # .. ######
  for (const m of src.matchAll(/^(#{1,6})\s+(.+)$/gm)) {
    const level = m[1].length;
    const title = m[2].trim().replace(/\s+/g, ' ');
    if (title) sigs.push(`h${level} ${title}`);
  }

  // Fenced code blocks: ```lang
  for (const m of src.matchAll(/^```\s*([A-Za-z0-9_+-]*)\s*$/gm)) {
    const lang = m[1] ? m[1].toLowerCase() : 'plain';
    sigs.push(`code-fence ${lang}`);
  }

  return Array.from(new Set(sigs)).slice(0, 40);
}

module.exports = { extract };
