'use strict';

/**
 * Extract signatures from TOML configuration files.
 * Focuses on section/table names and high-value keys.
 *
 * @param {string} src - Raw TOML content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Remove # comments while preserving values before comment markers.
  const stripped = src.replace(/\s+#.*$/gm, '');

  // [section] and [[array.section]]
  for (const m of stripped.matchAll(/^\s*(\[\[?[^\]]+\]\]?)\s*$/gm)) {
    sigs.push(`table ${m[1].trim()}`);
  }

  // Key-value lines (top-level and nested) — keep key names only.
  for (const m of stripped.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*=\s*(.+)$/gm)) {
    const key = m[1].trim();
    const value = m[2].trim();

    // Prefer common metadata/config keys for compact, useful output.
    if (/^(name|version|description|authors|license|requires-python|dependencies|optional-dependencies|scripts|tool\.|build-system\.|project\.)/.test(key)) {
      sigs.push(`key ${key}`);
      continue;
    }

    // Include booleans and simple scalar keys as generic config signal.
    if (/^(true|false|"[^"]*"|'[^']*'|[0-9._-]+)$/.test(value)) {
      sigs.push(`key ${key}`);
    }
  }

  return Array.from(new Set(sigs)).slice(0, 40);
}

module.exports = { extract };
