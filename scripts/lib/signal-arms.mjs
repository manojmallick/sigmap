#!/usr/bin/env node
'use strict';

/**
 * signal-arms.mjs — compare opt-in ranking signals on one set of tasks (#703).
 *
 * Each arm is the shipped ranker plus ONE signal. The comparison is task by
 * task against the plain arm, so a signal's verdict is a count — tasks it won,
 * tasks it lost — rather than a rate whose small difference could be noise.
 * Pure: the caller hands over a ranker per arm, so the arithmetic is tested
 * with fake rankings and no repository.
 */

import { rankOf } from './attribution.mjs';

/** The arms, in report order. `plain` is the reference every other arm is compared with. */
export const ARMS = [
  { id: 'plain', label: 'plain (as shipped)' },
  { id: 'centrality', label: '+ centrality blend', flag: 'retrieval.centralityBlend' },
  { id: 'surface', label: '+ surface enrichment', flag: 'retrieval.surfaceEnrichment' },
  { id: 'mined', label: '+ mined expansions', flag: 'retrieval.minedExpansions' },
  { id: 'callgraph', label: '+ call-graph boost', flag: 'retrieval.callGraphBoost' },
  { id: 'body', label: '+ body words', flag: 'retrieval.bodyWords' },
  { id: 'nograph', label: '- import graph (as `ask`)' },
];

/** Hit@5 and MRR over the top 5, the way the gate's own table counts them. */
function tally(tasks, rankOfTask) {
  let hits = 0;
  let rr = 0;
  for (const t of tasks) {
    const r = rankOfTask(t);
    if (r !== null && r <= 5) { hits++; rr += 1 / r; }
  }
  return { hits, mrr: tasks.length ? rr / tasks.length : 0 };
}

/**
 * @param {object} i
 * @param {Array<{id:string, query:string, expected_files:string[]}>} i.tasks
 * @param {Object<string,(query:string)=>string[]>} i.rankers arm id -> the ranked files for a query, best first and deep
 *        enough to place an answer below the top 5; must hold `plain`
 * @returns {Object<string,{tasks:number, hits:number, mrr:number, ranks:Object<string,number|null>, gained:string[], lost:string[], moves:Array<{id:string, from:number|null, to:number|null}>}>}
 *          per arm; `gained` are the tasks the arm hits and plain misses, `lost` the reverse, `moves` every task whose
 *          rank changed and sits in the top 10 on either side
 */
export function compareArms({ tasks, rankers }) {
  if (typeof rankers.plain !== 'function') throw new Error('compareArms needs a plain arm to compare against');
  const ranksOf = (rank) => Object.fromEntries(tasks.map((t) => [t.id, rankOf(rank(t.query), t.expected_files)]));
  const plainRanks = ranksOf(rankers.plain);
  const isHit = (r) => r !== null && r <= 5;
  const out = {};
  for (const arm of Object.keys(rankers)) {
    const ranks = arm === 'plain' ? plainRanks : ranksOf(rankers[arm]);
    const { hits, mrr } = tally(tasks, (t) => ranks[t.id]);
    const entry = { tasks: tasks.length, hits, mrr, ranks, gained: [], lost: [], moves: [] };
    if (arm !== 'plain') {
      for (const t of tasks) {
        const from = plainRanks[t.id];
        const to = ranks[t.id];
        if (!isHit(from) && isHit(to)) entry.gained.push(t.id);
        if (isHit(from) && !isHit(to)) entry.lost.push(t.id);
        if (from !== to && ((from !== null && from <= 10) || (to !== null && to <= 10))) entry.moves.push({ id: t.id, from, to });
      }
    }
    out[arm] = entry;
  }
  return out;
}

/**
 * Add several repos' comparisons into one: counts and MRR are task-weighted, and
 * each gained or lost task is prefixed with its repo so ids from different repos
 * cannot collide.
 *
 * @param {Array<{repo:string, arms:object}>} perRepo `compareArms` results
 * @returns {Object<string,{tasks:number, hits:number, mrr:number, gained:string[], lost:string[], moves:Array<object>}>}
 */
export function mergeArms(perRepo) {
  const out = {};
  for (const { repo, arms } of perRepo) {
    for (const [arm, a] of Object.entries(arms)) {
      const m = out[arm] || (out[arm] = { tasks: 0, hits: 0, mrr: 0, gained: [], lost: [], moves: [] });
      m.tasks += a.tasks;
      m.hits += a.hits;
      m.mrr += a.mrr * a.tasks;
      m.gained.push(...a.gained.map((id) => `${repo}/${id}`));
      m.lost.push(...a.lost.map((id) => `${repo}/${id}`));
      m.moves.push(...a.moves.map((mv) => ({ ...mv, id: `${repo}/${mv.id}` })));
    }
  }
  for (const m of Object.values(out)) m.mrr = m.tasks ? m.mrr / m.tasks : 0;
  return out;
}

/**
 * What a result says about a signal, in words that cannot be read as more than
 * the count supports. A signal that wins and loses the same number of tasks has
 * moved the answer around, not improved it.
 */
export function verdictOf(arm) {
  const net = arm.gained.length - arm.lost.length;
  if (!arm.gained.length && !arm.lost.length) return arm.moves.length ? 'moves ranks, no task changes hit' : 'identical to plain';
  if (net > 0) return `+${net} task${net === 1 ? '' : 's'} (won ${arm.gained.length}, lost ${arm.lost.length})`;
  if (net < 0) return `${net} task${net === -1 ? '' : 's'} (won ${arm.gained.length}, lost ${arm.lost.length})`;
  return `net zero (won ${arm.gained.length}, lost ${arm.lost.length})`;
}
