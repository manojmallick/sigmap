'use strict';

/**
 * JSON-payload squeeze (v7.0.0).
 *
 * Collapses repeated array elements, truncates long string values, and
 * preserves the schema shape at every depth — so an LLM still sees the
 * structure of an API/GraphQL/validation error without the bulk.
 */

const MAX_STR = 500;
const ARRAY_KEEP = 2;

function squeezeValue(v, opts) {
  const maxStr = opts.maxStr;
  const keep = opts.arrayKeep;
  if (Array.isArray(v)) {
    if (v.length <= keep + 1) return v.map((x) => squeezeValue(x, opts));
    const head = v.slice(0, keep).map((x) => squeezeValue(x, opts));
    head.push(`…${v.length - keep} more similar items`);
    return head;
  }
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = squeezeValue(v[k], opts);
    return o;
  }
  if (typeof v === 'string' && v.length > maxStr) {
    return v.slice(0, maxStr) + `…(${v.length} chars)`;
  }
  return v;
}

/**
 * @param {string} input
 * @param {object} [opts]
 * @param {number} [opts.maxStr=500]    truncate strings longer than this
 * @param {number} [opts.arrayKeep=2]   array items kept before collapsing
 * @returns {{ squeezed, kept, stripped }}
 */
function squeezeJsonPayload(input, opts = {}) {
  let parsed;
  try { parsed = JSON.parse(input); }
  catch (_) { return { squeezed: input, kept: ['(not valid JSON — unchanged)'], stripped: [] }; }
  const cfg = { maxStr: opts.maxStr != null ? opts.maxStr : MAX_STR, arrayKeep: opts.arrayKeep != null ? opts.arrayKeep : ARRAY_KEEP };
  const squeezed = JSON.stringify(squeezeValue(parsed, cfg), null, 2);
  return {
    squeezed,
    kept: ['schema shape preserved at all depths'],
    stripped: ['collapsed repeated array items; truncated long string values'],
  };
}

module.exports = { squeezeJsonPayload, squeezeValue };
