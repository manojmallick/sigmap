'use strict';

/**
 * Lightweight XML config extractor.
 * Captures root tags, key config tags, and id/name/class attributes.
 *
 * @param {string} src - Raw XML content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Remove comments and XML declaration for simpler scanning.
  const stripped = src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '');

  // Root element (first opening tag).
  const root = stripped.match(/<\s*([A-Za-z_][\w:.-]*)\b[^>]*>/);
  if (root) sigs.push(`root ${root[1]}`);

  // High-value config-like tags.
  const tagRe = /<\s*([A-Za-z_][\w:.-]*)\b([^>]*)>/g;
  for (const m of stripped.matchAll(tagRe)) {
    const tag = m[1];
    const attrs = m[2] || '';

    if (/^(bean|beans|route|routes|property|properties|dependency|dependencies|plugin|plugins|configuration|settings|profile|profiles|module|modules)$/i.test(tag)) {
      sigs.push(`tag ${tag}`);
    }

    const id = attrs.match(/\bid\s*=\s*"([^"]+)"/i);
    if (id) sigs.push(`${tag}#${id[1]}`);

    const name = attrs.match(/\bname\s*=\s*"([^"]+)"/i);
    if (name) sigs.push(`${tag}[name=${name[1]}]`);

    const cls = attrs.match(/\bclass\s*=\s*"([^"]+)"/i);
    if (cls) sigs.push(`${tag} -> ${cls[1]}`);
  }

  return Array.from(new Set(sigs)).slice(0, 50);
}

module.exports = { extract };
