'use strict';

/**
 * Retrieval surface-enrichment (#488, §7.4 Retrieval ceiling — opt-in via
 * `retrieval.surfaceEnrichment`, measure-gated).
 *
 * The map analyzers extract surfaces (routes) that never reach the rankable
 * signature index — a query like "payment webhook route" cannot match a
 * controller whose signatures never mention the route path. This module
 * appends deterministic pseudo-signatures (`route GET /api/users`) to the
 * defining file's signature list so the ranker's tokenizer can see them.
 *
 * Deterministic: rows are deduped and sorted; entries are copy-on-write so
 * arrays shared with the signature cache are never mutated.
 */

const path = require('path');

/**
 * Enrich a signature index with route pseudo-signatures.
 * @param {Map<string,string[]>} index cwd-relative file → sigs (mutated: enriched entries are replaced with fresh arrays)
 * @param {string} cwd
 * @returns {number} pseudo-signatures added
 */
function enrichWithSurfaces(index, cwd) {
  if (!(index instanceof Map) || index.size === 0) return 0;

  let collectRoutes;
  try { ({ collectRoutes } = require('../map/route-table')); } catch (_) { return 0; }

  const rels = [...index.keys()];
  const files = rels.map((rel) => path.join(cwd, rel));
  let routes = [];
  try { routes = collectRoutes(files, cwd) || []; } catch (_) { return 0; }

  const byFile = new Map();
  for (const r of routes) {
    const rel = String(r.file).replace(/\\/g, '/');
    if (!byFile.has(rel)) byFile.set(rel, new Set());
    byFile.get(rel).add(`route ${r.method} ${r.path}`);
  }

  let added = 0;
  for (const [rel, extras] of [...byFile.entries()].sort()) {
    const sigs = index.get(rel);
    if (!sigs) continue;
    const fresh = [...extras].sort().filter((x) => !sigs.includes(x));
    if (!fresh.length) continue;
    index.set(rel, [...sigs, ...fresh]); // copy-on-write: never mutate cached arrays
    added += fresh.length;
  }
  return added;
}

module.exports = { enrichWithSurfaces };
