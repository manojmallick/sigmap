'use strict';

const { capWithNotice } = require('../util/truncate');

// Ceiling discloses what it drops rather than truncating silently (#583).
const PER_FILE_LIMIT = 50;

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

  return capWithNotice(Array.from(new Set(sigs)), PER_FILE_LIMIT, 'keys');
}

module.exports = { extract };
