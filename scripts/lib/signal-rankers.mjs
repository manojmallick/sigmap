#!/usr/bin/env node
'use strict';

/**
 * signal-rankers.mjs — the ranker for each signal arm, built the way production builds it (#703).
 *
 * The MCP `query_context` tool is the one place the opt-in signals are read: it
 * builds each input when its flag is on and hands it to `rank()`. This builds the
 * same inputs for a benchmark, so an arm measures what a user who turned the flag
 * on would get. The one deliberate difference: expansions are mined in memory,
 * because the production loader caches them under `.context/` of the repository
 * it is pointed at, and a benchmark must leave a pinned checkout untouched.
 *
 * Impure (it reads the repository), unlike signal-arms.mjs, which only compares.
 * The ranker and the signal builders always come from THIS checkout.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { readSource } from './corpus-vocabulary.mjs';

const require = createRequire(import.meta.url);
const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (rel) => require(path.join(CODE_ROOT, rel));

/** How deep each arm's ranking runs: enough to place an answer well below the top 5. */
export const DEPTH = 50;

/**
 * @param {object} i
 * @param {Map<string,string[]>} i.index the signature index
 * @param {string} i.dir the repository the index describes
 * @param {object|null} i.graph its import graph (`buildFromCwd`), or null when it could not be built
 * @param {Function} i.rankQuery `rank(query, index, topK, opts)` from src/eval/runner
 * @returns {{rankers:Object<string,(query:string)=>string[]>, fellBack:string[], skipped:string[], stats:object}}
 *          an arm that cannot be built falls back to plain and is named in `fellBack`, so
 *          "identical to plain" never hides a signal that did not run. With no import graph
 *          (the honest benchmark scores SigMap without one) the two arms that are about the
 *          graph have nothing to compare and are left out, named in `skipped`
 */
export function buildArmRankers({ index, dir, graph, rankQuery }) {
  const { computeCentrality } = load('src/graph/centrality');
  const { enrichWithSurfaces } = load('src/retrieval/enrich-from-maps');
  const { mineExpansions } = load('src/retrieval/mined-expansions');
  const { buildCallFileGraph } = load('src/graph/call-graph');
  const { buildBodyWords } = load('src/retrieval/body-words');

  const base = { cwd: dir, graph, learned: false };
  const rankWith = (idx, extra) => (q) => rankQuery(q, idx, DEPTH, { ...base, ...extra }).map((x) => x.file);
  const rankers = { plain: rankWith(index, {}) };
  const fellBack = [];
  const stats = {};
  const arm = (id, build) => {
    try { rankers[id] = build(); } catch (_) { rankers[id] = rankers.plain; fellBack.push(id); }
  };

  const skipped = graph ? [] : ['centrality', 'nograph'];
  if (graph) {
    arm('centrality', () => {
      const centrality = computeCentrality(graph);
      stats.centralityFiles = centrality.size;
      return rankWith(index, { centrality });
    });
  }
  arm('surface', () => {
    const enriched = new Map([...index.entries()].map(([k, v]) => [k, [...v]]));
    stats.routeSigs = enrichWithSurfaces(enriched, dir);
    return rankWith(enriched, {});
  });
  arm('mined', () => {
    const { expansions } = mineExpansions(index);
    stats.minedTokens = Object.keys(expansions).length;
    return rankWith(index, { expansions });
  });
  arm('callgraph', () => {
    const callGraph = buildCallFileGraph(dir);
    stats.callEdges = callGraph.forward.size;
    return rankWith(index, { callGraph });
  });
  arm('body', () => {
    const bodyWords = buildBodyWords(index, (file) => readSource(dir, file));
    stats.bodyFiles = bodyWords.size;
    stats.bodyWords = [...bodyWords.values()].reduce((n, w) => n + w.split(' ').length, 0);
    return rankWith(index, { bodyWords });
  });
  // Not a signal but a configuration: `sigmap ask` and `--query` call `rank()` with no import
  // graph, so the neighbour boost the benchmarks and the MCP tool include never applies there.
  if (graph) rankers.nograph = rankWith(index, { graph: null });
  return { rankers, fellBack, skipped, stats };
}
