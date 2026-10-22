#!/usr/bin/env node
'use strict';

/**
 * head-to-head.mjs — scoring SigMap and the rivals with one scorer, and reading Gate G1 (#972).
 *
 * Parity is the whole point, so every system — SigMap's ranker and each rival arm — is reduced to the same
 * thing (an ordered list of repository-relative files per task) and scored by the same two functions:
 * hit@5 (an expected file is among the first five) and MRR@10 (1 / rank of the first expected file, 0 past
 * rank ten). Nothing is tuned per tool.
 *
 * Ambiguities are resolved in the RIVAL's favour, and counted so the report can say how often:
 *   - a rival path that ends with an expected path, or an expected path that ends with the rival's, counts as
 *     the file (monorepo prefixes, a different root): `ambiguous`;
 *   - each rival arm is scored on its own, and `best` takes, per task, the better of its arms (an upper bound
 *     no user could get without knowing the answer; labelled as such);
 *   - a task whose expected files the rival has no node for is `unsupported` for it, never a miss, and is
 *     reported separately.
 *
 * Gate G1 is pre-registered in issue #972 (its Pickup section) and in the plan, before any rival number is read.
 * "Concentrate" is operationalised here, also before the run, as at least half of the rival-only wins.
 *
 * Zero-dependency; pure functions, no I/O.
 */

import { wilson } from './band.mjs';

export const K = 5;
export const MRR_CUT = 10;
/** Repos whose language the import graph cannot read (the plan's Gate G1, second rule). */
export const GRAPH_BLIND = Object.freeze(['laravel', 'serilog', 'riverpod', 'alamofire', 'plenary', 'godot-demo-projects']);
export const G1 = Object.freeze({ leadPoints: 10, concentrationShare: 0.5 });

const norm = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '');

/** First 1-based rank at which `files` reaches an expected file; `ambiguous` when only a suffix match did. */
export function rankOf(files, expected) {
  const exp = (expected || []).map(norm);
  const list = (files || []).map(norm);
  let exact = null;
  let favour = null;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    if (exact === null && exp.includes(f)) exact = i + 1;
    if (favour === null && exp.some((e) => f === e || f.endsWith('/' + e) || e.endsWith('/' + f))) favour = i + 1;
    if (exact !== null && favour !== null) break;
  }
  return { rank: favour, ambiguous: favour !== null && favour !== exact };
}

/** The one scorer. */
export function scoreTask(files, expected) {
  const { rank, ambiguous } = rankOf(files, expected);
  return { rank, ambiguous, hit: rank !== null && rank <= K, rr: rank !== null && rank <= MRR_CUT ? 1 / rank : 0 };
}

/** n, hits, rate, MRR@10 and the 95% interval of a list of scored tasks. */
export function aggregate(items) {
  const n = items.length;
  const hits = items.filter((i) => i.hit).length;
  const { low, high } = wilson(hits, n);
  return { n, hits, hit5: n ? hits / n : null, mrr: n ? items.reduce((s, i) => s + i.rr, 0) / n : null, low: n ? low : null, high: n ? high : null };
}

const median = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/**
 * @typedef {{ id:string, repo:string, split:string, expected:string[],
 *             sigmap:{ files:string[], reachable:boolean },
 *             rivals:Object<string,{ supported:boolean, arms:Object<string,{ files:string[], tokens?:number }> }> }} Record
 */

/**
 * Score every record: attaches `.score` to SigMap and to each rival arm, and a `best` arm per rival.
 *
 * `derived` maps a suffix to a filter over a rival's file list; each rival arm also gets a derived arm
 * (`bm25+src` for `bm25`) scored on the filtered list. The runner passes "leave out test, mock and generated
 * files": SigMap's own ranker demotes them, the rivals do not, and the expected answers are source files, so
 * the filtered arms show what each rival scores if the user ignores its test-file hits. Favourable to the
 * rival, and kept apart: every arm is reported on its own line.
 */
export function scoreRecords(records, { derived = {} } = {}) {
  return records.map((r) => {
    const sigmap = { ...r.sigmap, score: scoreTask(r.sigmap.files, r.expected) };
    const rivals = {};
    for (const [tool, t] of Object.entries(r.rivals || {})) {
      const arms = {};
      for (const [arm, a] of Object.entries(t.arms || {})) {
        arms[arm] = { ...a, score: scoreTask(a.files, r.expected) };
        for (const [suffix, keep] of Object.entries(derived)) arms[arm + suffix] = { ...a, files: a.files.filter(keep), score: scoreTask(a.files.filter(keep), r.expected) };
      }
      // best arm per task, in the rival's favour: highest reciprocal rank
      let best = null;
      for (const a of Object.values(arms)) if (!best || a.score.rr > best.rr || (a.score.rr === best.rr && a.score.hit && !best.hit)) best = a.score;
      rivals[tool] = { supported: t.supported, arms, best: best || { rank: null, ambiguous: false, hit: false, rr: 0 } };
    }
    return { ...r, sigmap, rivals };
  });
}

/** Systems to compare: SigMap, and for each rival every arm plus `best`. */
export function systemsOf(scored) {
  const tools = new Map();
  for (const r of scored) for (const [tool, t] of Object.entries(r.rivals)) {
    if (!tools.has(tool)) tools.set(tool, new Set());
    for (const arm of Object.keys(t.arms)) tools.get(tool).add(arm);
  }
  return tools;
}

const scoreOf = (r, tool, arm) => (tool === 'sigmap' ? r.sigmap.score : arm === 'best' ? r.rivals[tool].best : r.rivals[tool].arms[arm].score);

/**
 * The comparison tables.
 *  - all:        every task; a task a system cannot index counts as a miss for it
 *  - bothIndexed: tasks SigMap's index reaches AND the rival has nodes for; this is the table Gate G1 reads
 *  - splits / repos: per easy-hard split and per repository, on bothIndexed
 *  - unsupported: tasks per rival it has no nodes for, and SigMap's unreachable tasks, listed separately
 */
export function compare(scored) {
  const tools = systemsOf(scored);
  const out = { tasks: scored.length, all: {}, bothIndexed: {}, unsupported: {}, splits: {}, repos: {}, ambiguous: {} };
  out.sigmapUnreachable = scored.filter((r) => !r.sigmap.reachable).map((r) => r.id);
  out.all.sigmap = aggregate(scored.map((r) => r.sigmap.score));
  for (const [tool, arms] of tools) {
    const names = [...arms, 'best'];
    out.unsupported[tool] = scored.filter((r) => r.rivals[tool] && !r.rivals[tool].supported).map((r) => r.id);
    const both = scored.filter((r) => r.sigmap.reachable && r.rivals[tool] && r.rivals[tool].supported);
    out.bothIndexed[tool] = { tasks: both.length, sigmap: aggregate(both.map((r) => r.sigmap.score)), arms: {} };
    out.splits[tool] = {};
    out.repos[tool] = {};
    for (const arm of names) {
      out.all[`${tool}/${arm}`] = aggregate(scored.map((r) => (r.rivals[tool] && r.rivals[tool].supported ? scoreOf(r, tool, arm) : { hit: false, rr: 0 })));
      out.bothIndexed[tool].arms[arm] = aggregate(both.map((r) => scoreOf(r, tool, arm)));
      out.ambiguous[`${tool}/${arm}`] = both.filter((r) => scoreOf(r, tool, arm).ambiguous).length;
    }
    for (const key of ['split', 'repo']) {
      const bucket = key === 'split' ? out.splits[tool] : out.repos[tool];
      for (const v of [...new Set(both.map((r) => r[key]))].sort()) {
        const rows = both.filter((r) => r[key] === v);
        bucket[v] = { tasks: rows.length, sigmap: aggregate(rows.map((r) => r.sigmap.score)), best: aggregate(rows.map((r) => r.rivals[tool].best)) };
      }
    }
  }
  return out;
}

/**
 * Gate G1, as written before the run.
 *   Rule 1: on tasks both tools can index, if the best rival leads SigMap by more than 10 points hit@5, run #985 before #976.
 *   Rule 2: if the rival's wins concentrate (at least half) in repos the import graph cannot read, run #980 before #976.
 *   Otherwise keep the order in #978 and treat #985 as optional.
 * "Best rival" is the rival whose single best arm leads most (an arm a user could choose), not the per-task `best`.
 */
export function gateG1(scored) {
  const tools = systemsOf(scored);
  const rows = [];
  for (const [tool, arms] of tools) {
    const both = scored.filter((r) => r.sigmap.reachable && r.rivals[tool] && r.rivals[tool].supported);
    if (!both.length) continue;
    const sig = aggregate(both.map((r) => r.sigmap.score));
    for (const arm of arms) {
      const a = aggregate(both.map((r) => r.rivals[tool].arms[arm].score));
      const rivalOnly = both.filter((r) => r.rivals[tool].arms[arm].score.hit && !r.sigmap.score.hit);
      const sigmapOnly = both.filter((r) => !r.rivals[tool].arms[arm].score.hit && r.sigmap.score.hit);
      rows.push({ tool, arm, tasks: both.length, sigmapHit5: sig.hit5, rivalHit5: a.hit5, leadPoints: (a.hit5 - sig.hit5) * 100, rivalOnlyWins: rivalOnly.map((r) => r.id), sigmapOnlyWins: sigmapOnly.map((r) => r.id), rivalOnlyRepos: countBy(rivalOnly.map((r) => r.repo)) });
    }
  }
  rows.sort((a, b) => b.leadPoints - a.leadPoints);
  const best = rows[0] || null;
  const rule1 = !!best && best.leadPoints > G1.leadPoints;
  let rule2 = false;
  let share = null;
  if (best && best.rivalOnlyWins.length) {
    const blind = best.rivalOnlyWins.filter((id) => GRAPH_BLIND.includes(scored.find((r) => r.id === id).repo)).length;
    share = blind / best.rivalOnlyWins.length;
    rule2 = share >= G1.concentrationShare;
  }
  const decision = rule1 ? 'run #985 (reranker spike) before #976' : rule2 ? 'run #980 (import resolvers) before #976' : 'keep the order in #978; treat #985 as optional';
  return { rows, best, rule1, rule2, graphBlindShare: share, decision, rules: G1 };
}

function countBy(xs) {
  const m = {};
  for (const x of xs) m[x] = (m[x] || 0) + 1;
  return m;
}

/** Per-tool cost rows the gap analysis wants: install, index time and size per repo, tokens per query. */
export function costs(perTool) {
  const out = {};
  for (const [tool, c] of Object.entries(perTool)) {
    out[tool] = {
      installMs: c.installMs ?? null,
      indexMsTotal: (c.index || []).reduce((s, i) => s + i.ms, 0),
      indexMsMedianPerRepo: median((c.index || []).map((i) => i.ms)),
      indexBytesMedianPerRepo: median((c.index || []).map((i) => i.bytes)),
      tokensPerQueryMedian: median(c.tokens || []),
    };
  }
  return out;
}
