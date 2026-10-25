'use strict';

/**
 * callgraph-accuracy.mjs — the arithmetic of the call-graph accuracy benchmark (#976):
 * matching, per-file tallies, the cluster bootstrap, the registered threshold and
 * predictions, and the report text. No I/O except `protocolState`, and no knowledge of
 * any indexer, so the tests can feed it synthetic graphs and references.
 *
 * The protocol is benchmarks/CALLGRAPH_ACCURACY_PROTOCOL.md; its machine-readable half is
 * benchmarks/callgraph-accuracy-protocol.json, which this module reads its numbers from.
 *
 * Dev-only. Nothing here ships in the npm package.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const SCHEMA = 1;
export const PROTOCOL_REL = 'benchmarks/callgraph-accuracy-protocol.json';
export const KINDS = ['function', 'method', 'constructor'];
/** Every kind+site pair a reference edge can take (protocol section 2, step 6). */
export const KIND_SITES = [
  'function/bare', 'function/qualified',
  'method/bare', 'method/self', 'method/receiver',
  'constructor/bare', 'constructor/qualified',
];
/** Samples of disagreements kept per repository in a saved report. */
export const SAMPLE_CAP = 25;

// ── Protocol ─────────────────────────────────────────────────────────────────

export function loadProtocol(root) {
  return JSON.parse(fs.readFileSync(path.join(root, PROTOCOL_REL), 'utf8'));
}

/**
 * Is the protocol file the committed one? A report saved from an edited protocol would claim
 * a pre-registration it does not have.
 * @returns {{ sha256: string, commit: string|null, committed: boolean }}
 */
export function protocolState(root) {
  const file = path.join(root, PROTOCOL_REL);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const git = (args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  const status = git(['status', '--porcelain', '--', PROTOCOL_REL]);
  const log = git(['log', '-1', '--format=%H', '--', PROTOCOL_REL]);
  const commit = log.status === 0 && log.stdout.trim() ? log.stdout.trim() : null;
  return { sha256, commit, committed: status.status === 0 && status.stdout.trim() === '' && commit !== null };
}

// ── Matching ─────────────────────────────────────────────────────────────────

/** `forward` of buildCallGraph as `{ key, callerId, calleeId, callerFile, calleeFile }`. */
export function graphEdgesOf(graph) {
  const out = [];
  for (const [callerId, calleeIds] of graph.forward) {
    const caller = graph.defs.get(callerId);
    if (!caller) continue;
    for (const calleeId of calleeIds) {
      const callee = graph.defs.get(calleeId);
      if (!callee) continue;
      out.push({ key: `${callerId}\u0000${calleeId}`, callerId, calleeId, callerFile: caller.file, calleeFile: callee.file });
    }
  }
  return out;
}

const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

/**
 * Compare one repository's graph with its reference (protocol sections 3 and 4).
 *
 * @param {{ forward: Map, defs: Map }} graph  from buildCallGraph
 * @param {{ edges: Map, nodeKinds: Map, callerNodes: Set, documents: Set<string> }} ref  from deriveReferenceEdges
 * @returns {{
 *   clusters: Map<string, Record<string, number>>,   per caller file, for the bootstrap
 *   scope: object, diagnostics: object, fileLevel: object, samples: object,
 * }}
 */
export function compareRepo(graph, ref) {
  const graphFiles = new Set();
  for (const d of graph.defs.values()) graphFiles.add(d.file);
  const universe = new Set([...graphFiles].filter((f) => ref.documents.has(f)));
  const inU = (e) => universe.has(e.callerFile) && universe.has(e.calleeFile);

  const allGraph = graphEdgesOf(graph);
  const graphEdges = allGraph.filter(inU);
  const graphKeys = new Set(allGraph.map((e) => e.key));
  const refAll = [...ref.edges.entries()];
  const refInU = refAll.filter(([, e]) => inU(e));

  const clusters = new Map();
  const cluster = (file) => {
    if (!clusters.has(file)) clusters.set(file, {});
    return clusters.get(file);
  };

  // Recall side: every reference edge in U, found or not.
  let found = 0;
  const missed = [];
  for (const [key, e] of refInU) {
    const c = cluster(e.callerFile);
    const hit = graphKeys.has(key);
    const ks = `${e.kind}/${e.site}`;
    bump(c, 'ref'); bump(c, `ref:${e.kind}`); bump(c, `ref:${ks}`);
    if (e.kind === 'method' && e.site !== 'bare') bump(c, 'ref:method/no-bare');
    if (hit) {
      found++;
      bump(c, 'tp'); bump(c, `tp:${e.kind}`); bump(c, `tp:${ks}`);
      if (e.kind === 'method' && e.site !== 'bare') bump(c, 'tp:method/no-bare');
    } else {
      missed.push({ edge: `${e.callerFile}#${e.callerName} -> ${e.calleeFile}#${e.calleeName}`, kind: ks });
    }
  }

  // Precision side: every graph edge in U, right or not. A right one takes the reference
  // edge's kind; a wrong one takes the kind of its callee's definition in the index.
  const refKeys = ref.edges;
  const blind = { calleeUnnamed: 0, callerUnnamed: 0, bothNamed: 0 };
  const spurious = [];
  for (const e of graphEdges) {
    const c = cluster(e.callerFile);
    const r = refKeys.get(e.key);
    bump(c, 'graph');
    if (r) {
      bump(c, `graph:${r.kind}`);
      continue;
    }
    const kind = ref.nodeKinds.get(e.calleeId) || 'unknown';
    bump(c, `graph:${kind}`);
    const calleeKnown = ref.nodeKinds.has(e.calleeId);
    const callerKnown = ref.callerNodes.has(e.callerId);
    if (!calleeKnown) blind.calleeUnnamed++;
    else if (!callerKnown) blind.callerUnnamed++;
    else blind.bothNamed++;
    spurious.push({ edge: `${e.callerId} -> ${e.calleeId}`, calleeKind: kind, reason: !calleeKnown ? 'callee-not-in-index' : !callerKnown ? 'caller-not-in-index' : 'both-in-index' });
  }

  // Scope-inclusive recall: every reference edge between two indexed files, walked or not.
  let outsideCaller = 0;
  let outsideCallee = 0;
  for (const [, e] of refAll) {
    if (inU(e)) continue;
    if (!universe.has(e.callerFile)) outsideCaller++;
    else outsideCallee++;
  }

  // File level (protocol section 4): undirected pairs, caller file != callee file.
  const pair = (a, b) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  const refPairs = new Set(refInU.filter(([, e]) => e.callerFile !== e.calleeFile).map(([, e]) => pair(e.callerFile, e.calleeFile)));
  const graphPairs = new Set(graphEdges.filter((e) => e.callerFile !== e.calleeFile).map((e) => pair(e.callerFile, e.calleeFile)));
  let pairsFound = 0;
  for (const p of refPairs) if (graphPairs.has(p)) pairsFound++;

  const byReason = {};
  for (const s of spurious) bump(byReason, s.reason);
  return {
    clusters,
    scope: {
      graphFiles: graphFiles.size,
      indexedFiles: ref.documents.size,
      universeFiles: universe.size,
      graphEdges: allGraph.length,
      graphEdgesInU: graphEdges.length,
      referenceEdges: refAll.length,
      referenceEdgesInU: refInU.length,
      truePositives: found,
      referenceEdgesOutsideU: { callerNotWalked: outsideCaller, calleeNotWalked: outsideCallee },
      scopeInclusiveRecall: refAll.length ? found / refAll.length : null,
    },
    diagnostics: { ...ref.counts, wrongEdges: spurious.length, wrongEdgesByReason: byReason },
    fileLevel: { referencePairs: refPairs.size, graphPairs: graphPairs.size, found: pairsFound },
    samples: {
      missed: missed.sort((a, b) => a.edge.localeCompare(b.edge)).slice(0, SAMPLE_CAP),
      wrong: spurious.sort((a, b) => a.edge.localeCompare(b.edge)).slice(0, SAMPLE_CAP),
    },
  };
}

// ── Intervals ────────────────────────────────────────────────────────────────

/** A small seeded generator, so a published interval can be reproduced exactly. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The `q` quantile of an ascending array, by linear interpolation. */
export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Cluster-bootstrap intervals for ratios of summed per-file counts (protocol section 4).
 * A resample draws caller files with replacement, so the many edges of one file are not
 * treated as independent.
 *
 * @param {Array<Record<string, number>>} clusters
 * @param {Array<{ id: string, num: string, den: string }>} ratios
 * @returns {Record<string, { value: number|null, lo: number|null, hi: number|null, n: number }>}
 */
export function intervals(clusters, ratios, { resamples = 2000, seed = 976, level = 0.95 } = {}) {
  const keys = [...new Set(ratios.flatMap((r) => [r.num, r.den]))];
  const col = new Map(keys.map((k, i) => [k, i]));
  const K = keys.length;
  const N = clusters.length;
  const mat = new Float64Array(N * K);
  const total = new Float64Array(K);
  clusters.forEach((c, i) => {
    keys.forEach((k, j) => {
      const v = c[k] || 0;
      mat[i * K + j] = v;
      total[j] += v;
    });
  });

  const rng = mulberry32(seed);
  const samples = ratios.map(() => []);
  const sums = new Float64Array(K);
  if (N > 0) {
    for (let b = 0; b < resamples; b++) {
      sums.fill(0);
      for (let i = 0; i < N; i++) {
        const off = Math.floor(rng() * N) * K;
        for (let j = 0; j < K; j++) sums[j] += mat[off + j];
      }
      ratios.forEach((r, t) => {
        const den = sums[col.get(r.den)];
        if (den > 0) samples[t].push(sums[col.get(r.num)] / den);
      });
    }
  }

  const out = {};
  ratios.forEach((r, t) => {
    const den = total[col.get(r.den)];
    const num = total[col.get(r.num)];
    const s = Float64Array.from(samples[t]).sort();
    // An interval from resamples most of which had nothing to divide is not an interval.
    const usable = s.length >= resamples * 0.9;
    out[r.id] = {
      value: den > 0 ? num / den : null,
      lo: usable ? quantile(s, (1 - level) / 2) : null,
      hi: usable ? quantile(s, 1 - (1 - level) / 2) : null,
      n: den,
    };
  });
  return out;
}

// ── Rows ─────────────────────────────────────────────────────────────────────

/** The recall and precision ratios of the report, by id. */
export function ratioSpecs() {
  const r = [{ id: 'recall:all', num: 'tp', den: 'ref' }, { id: 'precision:all', num: 'tp', den: 'graph' }];
  for (const k of KINDS) {
    r.push({ id: `recall:${k}`, num: `tp:${k}`, den: `ref:${k}` });
    r.push({ id: `precision:${k}`, num: `tp:${k}`, den: `graph:${k}` });
  }
  r.push({ id: 'precision:unknown', num: 'tp:unknown', den: 'graph:unknown' });
  for (const ks of KIND_SITES) r.push({ id: `recall:${ks}`, num: `tp:${ks}`, den: `ref:${ks}` });
  r.push({ id: 'recall:method/no-bare', num: 'tp:method/no-bare', den: 'ref:method/no-bare' });
  return r;
}

const f1 = (p, r) => (p && r ? (2 * p * r) / (p + r) : p === 0 || r === 0 ? 0 : null);

/**
 * The table of one language group: pooled over its repositories, with intervals.
 * @param {Array<Map<string, Record<string, number>>>} clusterMaps  one per repository
 */
export function tableOf(clusterMaps, protocol) {
  const clusters = clusterMaps.flatMap((m, i) => [...m.entries()].map(([file, c]) => ({ file: `${i}:${file}`, ...c })));
  const iv = intervals(clusters, ratioSpecs(), protocol.bootstrap);
  const min = protocol.minSample;
  const cell = (id) => ({ ...iv[id], small: iv[id].n < min });
  const row = (label, recallId, precisionId) => {
    const recall = recallId ? cell(recallId) : null;
    const precision = precisionId ? cell(precisionId) : null;
    return { label, recall, precision, f1: recall && precision ? f1(precision.value, recall.value) : null };
  };
  const rows = [row('all edges', 'recall:all', 'precision:all')];
  for (const k of KINDS) rows.push(row(k, `recall:${k}`, `precision:${k}`));
  rows.push(row('unknown callee', null, 'precision:unknown'));
  const sites = KIND_SITES.map((ks) => row(ks, `recall:${ks}`, null));
  return { rows, sites, receiverOnly: cell('recall:method/no-bare'), edgesPooled: clusters.length };
}

/** Add the integer counts of several per-repository objects, key by key. */
export function sumCounts(list) {
  const out = {};
  for (const o of list) for (const [k, v] of Object.entries(o)) if (typeof v === 'number') out[k] = (out[k] || 0) + v;
  return out;
}

// ── Threshold and predictions ────────────────────────────────────────────────

/** The registered threshold applied to one group (protocol section 5). */
export function thresholdVerdict(table, protocol) {
  const cell = table.receiverOnly;
  const t = protocol.threshold;
  if (cell.value === null || cell.n < protocol.minSample) {
    return { status: 'insufficient-sample', recall: cell.value, referenceEdges: cell.n, threshold: t.value };
  }
  return {
    status: cell.value < t.value ? 'spike-warranted' : 'above-threshold',
    recall: cell.value, lo: cell.lo, hi: cell.hi, referenceEdges: cell.n, threshold: t.value,
  };
}

/**
 * The registered predictions, checked against the measured tables (protocol section 6).
 * `held`, `missed`, or `not-testable` when the cell has too few edges.
 * @param {Record<string, object>} tables  language group -> tableOf result
 */
export function checkPredictions(tables, protocol) {
  const val = (g, id) => {
    const t = tables[g];
    if (!t) return null;
    const find = (label) => [...t.rows, ...t.sites].find((r) => r.label === label);
    const [, which] = id.split(':');
    const label = which === 'receiver-only' ? null : which;
    if (id === 'recall:receiver-only') return t.receiverOnly;
    const r = find(label);
    return r ? (id.startsWith('recall') ? r.recall : r.precision) : null;
  };
  const judge = (groups, id, test) => {
    const parts = [];
    let measured = 0;
    for (const g of groups) {
      const c = val(g, id);
      if (!c || c.value === null || c.small) { parts.push({ group: g, value: c && c.value, note: 'not testable' }); continue; }
      measured++;
      parts.push({ group: g, value: c.value, ok: test(c.value) });
    }
    if (!measured) return { status: 'not-testable', parts };
    return { status: parts.every((p) => p.ok === undefined || p.ok) ? 'held' : 'missed', parts };
  };
  const present = (gs) => gs.filter((g) => tables[g]);
  const claims = Object.fromEntries(protocol.predictions.map((p) => [p.id, p.claim]));
  const javaTable = tables.java;
  let p5 = { status: 'not-testable', parts: [] };
  if (javaTable) {
    const j = javaTable.receiverOnly;
    const others = present(['typescript', 'javascript', 'python', 'go']).map((g) => tables[g].receiverOnly);
    if (!j.small && j.value !== null) {
      const ok = j.value < 0.7 && others.every((o) => o.value === null || o.small || j.value > o.value);
      p5 = { status: ok ? 'held' : 'missed', parts: [{ group: 'java', value: j.value }] };
    }
  }
  return {
    P1: { claim: claims.P1, ...judge(present(['typescript', 'javascript', 'python', 'go']), 'recall:receiver-only', (v) => v < 0.15) },
    P2: { claim: claims.P2, ...judge(present(Object.keys(tables)), 'recall:function/bare', (v) => v >= 0.5 && v <= 0.9) },
    P3: { claim: claims.P3, ...judge(present(Object.keys(tables)), 'precision:all edges', (v) => v >= 0.5 && v <= 0.9) },
    P4: { claim: claims.P4, ...judge(present(['typescript', 'javascript', 'python']), 'recall:constructor', (v) => v < 0.1) },
    P5: { claim: claims.P5, ...p5 },
  };
}

// ── Text ─────────────────────────────────────────────────────────────────────

const pct = (v) => (v === null || v === undefined ? '   -  ' : `${(100 * v).toFixed(1).padStart(5)}%`);
const band = (c) => (c && c.value !== null && c.lo !== null ? ` [${(100 * c.lo).toFixed(0)}-${(100 * c.hi).toFixed(0)}]` : '');
const cellText = (c) => (c ? `${pct(c.value)}${band(c)}${c.small ? ' n<100' : ''}`.padEnd(24) : '-'.padEnd(24));

/** The printed table of a group. */
export function formatGroup(name, group) {
  const lines = [`${name}  (${group.repos.join(', ')})`];
  lines.push(`  ${'edge kind'.padEnd(22)}${'recall'.padEnd(24)}${'ref'.padStart(7)}  ${'precision'.padEnd(24)}${'graph'.padStart(7)}  F1`);
  for (const r of group.table.rows) {
    const refN = r.recall ? String(r.recall.n) : '';
    const graphN = r.precision ? String(r.precision.n) : '';
    lines.push(`  ${r.label.padEnd(22)}${cellText(r.recall)}${refN.padStart(7)}  ${cellText(r.precision)}${graphN.padStart(7)}  ${r.f1 === null ? '  -  ' : pct(r.f1)}`);
  }
  lines.push('  by site (recall only)');
  for (const r of group.table.sites) {
    if (!r.recall.n) continue;
    lines.push(`    ${r.label.padEnd(20)}${cellText(r.recall)}${String(r.recall.n).padStart(7)}`);
  }
  const t = group.threshold;
  lines.push(`  receiver-only method recall ${pct(t.recall)} (threshold ${pct(t.threshold)}): ${t.status}`);
  const s = group.scope;
  lines.push(`  scope: ${s.universeFiles} files in U of ${s.graphFiles} walked and ${s.indexedFiles} indexed; scope-inclusive recall ${pct(s.scopeInclusiveRecall)}; file-level P ${pct(group.fileLevel.precision)} R ${pct(group.fileLevel.recall)}`);
  return lines;
}
