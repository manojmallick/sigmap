'use strict';

/**
 * Extract signatures from .properties configuration files.
 * Captures key names, grouped by prefixes where possible.
 *
 * @param {string} src - Raw properties content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  const lines = src.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;

    const idxEq = trimmed.indexOf('=');
    const idxColon = trimmed.indexOf(':');
    const idx = idxEq >= 0 && idxColon >= 0 ? Math.min(idxEq, idxColon) : Math.max(idxEq, idxColon);
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    if (!key) continue;

    const parts = key.split('.').filter(Boolean);
    if (parts.length >= 2) {
      sigs.push(`group ${parts[0]}.${parts[1]}`);
    }
    sigs.push(`key ${key}`);
  }

  return Array.from(new Set(sigs)).slice(0, 50);
}

module.exports = { extract };
