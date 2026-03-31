'use strict';

const { PATTERNS } = require('./patterns');

/**
 * Scan an array of signature strings for secrets.
 *
 * @param {string[]} signatures - Array of extracted signature strings
 * @param {string} filePath - Source file path (used in redaction message)
 * @returns {{ safe: string[], redacted: boolean }}
 *   safe      — signatures with any secret-containing entries replaced
 *   redacted  — true if at least one signature was redacted
 */
function scan(signatures, filePath) {
  if (!Array.isArray(signatures)) return { safe: [], redacted: false };

  try {
    let redacted = false;
    const safe = signatures.map((sig) => {
      if (typeof sig !== 'string') return sig;
      for (const pattern of PATTERNS) {
        if (pattern.regex.test(sig)) {
          redacted = true;
          return `[REDACTED — ${pattern.name} detected in ${filePath}]`;
        }
      }
      return sig;
    });
    return { safe, redacted };
  } catch (_) {
    // Never throw — return original signatures on any error
    return { safe: signatures, redacted: false };
  }
}

module.exports = { scan };
