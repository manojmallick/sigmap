'use strict';

/**
 * Zero-dependency import-graph centrality (Semantic Bridge II, B3).
 *
 * Power iteration over the forward dependency graph: rank flows from each
 * importer to the files it imports, so heavily-referenced files accumulate
 * centrality and one-off helpers do not. Deterministic — fixed damping,
 * fixed iteration count, nodes processed in sorted order.
 *
 * The result feeds the opt-in `retrieval.centralityBlend` ranking prior
 * (see src/retrieval/ranker.js) — a principled deepening of the existing
 * graph-boost idea, not a replacement for query relevance.
 */

const DAMPING = 0.85;
const ITERATIONS = 20;

/**
 * Compute a normalized centrality score for every file in a dependency graph.
 *
 * @param {{ forward: Map<string, string[]> }} graph - forward dependency graph
 *        (file → files it imports), as built by src/graph/builder.js
 * @returns {Map<string, number>} file → centrality in (0, 1], max-normalized;
 *          empty Map when the graph is missing or empty
 */
function computeCentrality(graph) {
  if (!graph || !(graph.forward instanceof Map) || graph.forward.size === 0) return new Map();

  const nodes = new Set(graph.forward.keys());
  for (const deps of graph.forward.values()) {
    for (const dep of deps || []) nodes.add(dep);
  }
  const nodeList = [...nodes].sort();
  const n = nodeList.length;
  const indexOf = new Map(nodeList.map((file, i) => [file, i]));
  const outLinks = nodeList.map((file) =>
    (graph.forward.get(file) || []).map((dep) => indexOf.get(dep)).filter((i) => i !== undefined));

  let ranks = new Array(n).fill(1 / n);
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const next = new Array(n).fill((1 - DAMPING) / n);
    let dangling = 0;
    for (let i = 0; i < n; i++) {
      if (outLinks[i].length === 0) { dangling += ranks[i]; continue; }
      const share = (DAMPING * ranks[i]) / outLinks[i].length;
      for (const j of outLinks[i]) next[j] += share;
    }
    // Dangling mass (files that import nothing) is redistributed uniformly.
    const danglingShare = (DAMPING * dangling) / n;
    for (let i = 0; i < n; i++) next[i] += danglingShare;
    ranks = next;
  }

  const max = Math.max(...ranks) || 1;
  const result = new Map();
  for (let i = 0; i < n; i++) result.set(nodeList[i], ranks[i] / max);
  return result;
}

module.exports = { computeCentrality, DAMPING, ITERATIONS };
