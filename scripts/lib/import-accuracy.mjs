'use strict';

/**
 * import-accuracy.mjs — the arithmetic of the import-resolver accuracy benchmark (#980):
 * comparing the import graph's file-to-file edges with the edges a language's own tooling
 * reports, the protocol commit guard, and the report text. No I/O except `protocolState`,
 * and no knowledge of any language, so the tests can feed it synthetic edge lists. The
 * per-language references are in scripts/import-accuracy/.
 *
 * The method is benchmarks/IMPORT_RESOLVER_PROTOCOL.md; its numbers are in
 * benchmarks/import-resolver-protocol.json, committed before the first measured run. The
 * bootstrap is the one of the call-graph benchmark (#976).
 *
 * Dev-only. Nothing here ships in the npm package.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { intervals } from './callgraph-accuracy.mjs';

export const SCHEMA = 1;
export const PROTOCOL_REL = 'benchmarks/import-resolver-protocol.json';
/** Disagreements kept per repository in a saved report. */
export const SAMPLE_CAP = 25;

/**
 * The Swift module-level relation as the product reports it: `[file, 'module:<target>']` for
 * every file that `moduleImpact` lists as an importer of a target. The product answers per
 * file and every file of a target gives the same answer, so a target's importers are listed
 * once, however many of its files are asked about.
 * @param {(root: string, file: string) => ({module: string, importers: string[]}|null)} moduleImpact
 * @param {string} root
 * @param {string[]} files  repo-relative `.swift` files
 * @returns {Array<[string, string]>}
 */
export function swiftModuleEdges(moduleImpact, root, files) {
  const seen = new Set();
  const edges = [];
  for (const f of files) {
    const m = moduleImpact(root, path.join(root, f));
    if (!m || seen.has(m.module)) continue;
    seen.add(m.module);
    for (const importer of m.importers) edges.push([importer, `module:${m.module}`]);
  }
  return edges;
}

export function loadProtocol(root) {
  return JSON.parse(fs.readFileSync(path.join(root, PROTOCOL_REL), 'utf8'));
}

/** Is the protocol file the committed one? A report from an edited protocol claims a pre-registration it lacks. */
export function protocolState(root) {
  const file = path.join(root, PROTOCOL_REL);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const git = (args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  const status = git(['status', '--porcelain', '--', PROTOCOL_REL]);
  const log = git(['log', '-1', '--format=%H', '--', PROTOCOL_REL]);
  const commit = log.status === 0 && log.stdout.trim() ? log.stdout.trim() : null;
  return { sha256, commit, committed: status.status === 0 && status.stdout.trim() === '' && commit !== null };
}

const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

/**
 * How a reference edge reaches its target: what the adapter says about the import (a third
 * element of the edge), else the extension of the file it reaches. Diagnostic only: no figure
 * depends on it.
 */
const kindOf = ([, to, kind]) => kind || `reaches a ${path.extname(to) || '(no extension)'} file`;

/** Add the counts of several `{ kind: n }` objects. */
export function sumKinds(list) {
  const out = {};
  for (const o of list) for (const [k, n] of Object.entries(o || {})) bump(out, k, n);
  return out;
}

/**
 * Compare one repository's graph edges with its reference edges.
 *
 * Both are lists of `[from, to]` repo-relative paths. The universe is the files the graph
 * walked AND the reference could analyse: a graph edge or a reference edge counts only when
 * its importing file is in it. (An edge to a file outside the walk is still compared: if the
 * graph did not walk the target it cannot have the edge, and that is a recall miss, not a
 * scope artefact. The importer is what must have been read by both.)
 *
 * @param {{ graphEdges: Array<[string,string]>, refEdges: Array<[string,string]>, walked: Set<string>, covered: Set<string>, importers?: (rel: string) => boolean }} i
 *        `importers` restricts both sides to the importing files of the group being measured.
 */
export function compareImports({ graphEdges, refEdges, walked, covered, importers }) {
  const inGroup = importers || (() => true);
  const universe = new Set([...walked].filter((f) => covered.has(f) && inGroup(f)));
  const key = ([a, b]) => `${a}\u0000${b}`;
  const G = new Map(graphEdges.filter(([a]) => universe.has(a) && a !== undefined).map((e) => [key(e), e]));
  const R = new Map(refEdges.filter(([a, b]) => universe.has(a) && a !== b).map((e) => [key(e), e]));

  const clusters = new Map();
  const cluster = (f) => { if (!clusters.has(f)) clusters.set(f, {}); return clusters.get(f); };
  let tp = 0;
  const missed = [];
  const wrong = [];
  const missedByKind = {};
  const wrongByKind = {};
  for (const [k, e] of R) {
    const [a, b] = e;
    const c = cluster(a);
    bump(c, 'ref');
    if (G.has(k)) { tp++; bump(c, 'tp'); } else { missed.push(`${a} -> ${b}`); bump(missedByKind, kindOf(e)); }
  }
  for (const [k, [a, b]] of G) {
    bump(cluster(a), 'graph');
    if (!R.has(k)) { wrong.push(`${a} -> ${b}`); bump(wrongByKind, a === b ? 'a file importing itself' : `reaches a ${path.extname(b) || '(no extension)'} file`); }
  }
  missed.sort();
  wrong.sort();
  return {
    clusters,
    counts: {
      walked: walked.size, covered: covered.size, universe: universe.size,
      referenceEdges: R.size, graphEdges: G.size, truePositives: tp,
      graphEdgesOutsideUniverse: graphEdges.filter(([a]) => !universe.has(a)).length,
      referenceEdgesOutsideUniverse: refEdges.filter(([a]) => !universe.has(a)).length,
    },
    samples: { missed: missed.slice(0, SAMPLE_CAP), wrong: wrong.slice(0, SAMPLE_CAP) },
    diagnostics: { missedByKind, wrongByKind },
  };
}

const f1 = (p, r) => (p && r ? (2 * p * r) / (p + r) : p === 0 || r === 0 ? 0 : null);

/** Pooled precision, recall and F1 of several repositories, with cluster-bootstrap intervals. */
export function tableOf(clusterMaps, protocol) {
  const clusters = clusterMaps.flatMap((m, i) => [...m.entries()].map(([file, c]) => ({ file: `${i}:${file}`, ...c })));
  const iv = intervals(clusters, [
    { id: 'precision', num: 'tp', den: 'graph' },
    { id: 'recall', num: 'tp', den: 'ref' },
  ], protocol.bootstrap);
  const cell = (id) => ({ ...iv[id], small: iv[id].n < protocol.minSample });
  const precision = cell('precision');
  const recall = cell('recall');
  return { precision, recall, f1: f1(precision.value, recall.value) };
}

/** Add the numeric fields of several count objects. */
export function sumCounts(list) {
  const out = {};
  for (const o of list) for (const [k, v] of Object.entries(o)) if (typeof v === 'number') out[k] = (out[k] || 0) + v;
  return out;
}

const pct = (v) => (v === null || v === undefined ? '   -  ' : `${(100 * v).toFixed(1).padStart(5)}%`);
const band = (c) => (c && c.value !== null && c.lo !== null ? ` [${(100 * c.lo).toFixed(0)}-${(100 * c.hi).toFixed(0)}]` : '');
const cellText = (c) => (c ? `${pct(c.value)}${band(c)}${c.small ? ' n<100' : ''}`.padEnd(24) : '-'.padEnd(24));

/** One printed line per group. */
export function formatGroup(name, g) {
  return [
    `${name.padEnd(8)} ${g.repos.join(', ')}`,
    `  precision ${cellText(g.table.precision)}${String(g.table.precision.n).padStart(7)} graph edges`,
    `  recall    ${cellText(g.table.recall)}${String(g.table.recall.n).padStart(7)} reference edges`,
    `  F1        ${pct(g.table.f1)}   (${g.counts.universe} importing files in the universe of ${g.counts.walked} walked)`,
  ];
}
