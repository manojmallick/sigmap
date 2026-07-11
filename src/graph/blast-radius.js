'use strict';

/**
 * Method-level blast-radius scoring (GR2).
 *
 * Consumes the D4 call-graph (src/graph/call-graph.js): for each changed file,
 * resolve the functions it defines, BFS the reverse call edges, and score how
 * much of the codebase transitively calls into the change. The score is a
 * documented deterministic formula — no heuristics that vary run to run — so
 * review-pr findings and PR Evidence lines are byte-stable for a fixed tree.
 *
 * Score: min(100, direct×4 + transitive×1). Tiers:
 *   0 → none · 1–9 → low · 10–29 → medium · 30–59 → high · 60+ → critical
 */

const path = require('path');
const { buildCallGraph } = require('./call-graph');

const DIRECT_WEIGHT = 4;
const TRANSITIVE_WEIGHT = 1;
const IMPACTED_FUNCTIONS_CAP = 12;

const TEST_FILE_RE = /\.(test|spec)\.[jt]sx?$|(^|\/)test_|_test\.(py|go)$|(^|\/)(tests?|__tests__|spec)\//;

function tierFor(score) {
  if (score >= 60) return 'critical';
  if (score >= 30) return 'high';
  if (score >= 10) return 'medium';
  if (score >= 1) return 'low';
  return 'none';
}

function _normRel(p) {
  return String(p).replace(/\\/g, '/');
}

// BFS the reverse edges from a set of symbol ids; returns direct/transitive id sets.
function _bfs(seedIds, reverse, maxDepth) {
  const direct = new Set();
  const transitive = new Set();
  const visited = new Set(seedIds);
  let frontier = [];
  for (const s of seedIds) {
    for (const nb of (reverse.get(s) || [])) {
      if (!visited.has(nb)) { direct.add(nb); visited.add(nb); frontier.push(nb); }
    }
  }
  let depth = 1;
  while (frontier.length && (maxDepth === 0 || depth < maxDepth)) {
    const next = [];
    for (const node of frontier) {
      for (const nb of (reverse.get(node) || [])) {
        if (!visited.has(nb)) { transitive.add(nb); visited.add(nb); next.push(nb); }
      }
    }
    frontier = next;
    depth++;
  }
  return { direct, transitive };
}

/**
 * Score the method-level blast radius of a changed-file list.
 *
 * @param {string[]} changedFiles repo-relative paths
 * @param {string} cwd
 * @param {object} [opts]
 * @param {object} [opts.graph]  injected call graph (tests); else built from cwd
 * @param {number} [opts.depth=0] BFS depth limit (0 = unlimited)
 * @returns {{
 *   available: boolean,
 *   files: Array<{ file:string, symbols:number, directCallers:number,
 *                  transitiveCallers:number, testCallers:number,
 *                  impactedFunctions:string[], score:number, tier:string }>,
 *   aggregate: { score:number, tier:string, impactedFunctions:number }
 * }}
 */
function methodBlastRadius(changedFiles, cwd, opts = {}) {
  const empty = { available: false, files: [], aggregate: { score: 0, tier: 'none', impactedFunctions: 0 } };
  let graph;
  try {
    graph = opts.graph || buildCallGraph(cwd, opts);
  } catch (_) {
    return empty;
  }
  if (!graph || !graph.defs || graph.defs.size === 0) return empty;

  // Group defined symbol ids by their (normalized) defining file.
  const idsByFile = new Map();
  for (const [id, def] of graph.defs.entries()) {
    const rel = _normRel(def.file);
    if (!idsByFile.has(rel)) idsByFile.set(rel, []);
    idsByFile.get(rel).push(id);
  }

  const depth = Number.isFinite(opts.depth) ? opts.depth : 0;
  const files = [];
  const allImpacted = new Set();

  for (const changed of (changedFiles || []).map(_normRel).sort()) {
    const ids = idsByFile.get(changed);
    if (!ids || !ids.length) continue;
    const { direct, transitive } = _bfs(ids, graph.reverse, depth);
    const impacted = [...direct, ...transitive].sort();
    for (const id of impacted) allImpacted.add(id);
    const testCallers = impacted.filter((id) => {
      const def = graph.defs.get(id);
      return def && TEST_FILE_RE.test(_normRel(def.file));
    }).length;
    const score = Math.min(100, direct.size * DIRECT_WEIGHT + transitive.size * TRANSITIVE_WEIGHT);
    files.push({
      file: changed,
      symbols: ids.length,
      directCallers: direct.size,
      transitiveCallers: transitive.size,
      testCallers,
      impactedFunctions: impacted.slice(0, IMPACTED_FUNCTIONS_CAP),
      score,
      tier: tierFor(score),
    });
  }

  if (!files.length) return empty;
  const maxScore = files.reduce((m, f) => Math.max(m, f.score), 0);
  return {
    available: true,
    files,
    aggregate: { score: maxScore, tier: tierFor(maxScore), impactedFunctions: allImpacted.size },
  };
}

module.exports = { methodBlastRadius, tierFor, DIRECT_WEIGHT, TRANSITIVE_WEIGHT };
