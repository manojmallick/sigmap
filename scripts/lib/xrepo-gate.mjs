#!/usr/bin/env node
'use strict';

/**
 * xrepo-gate.mjs — scoring arithmetic and the pass/fail decision for the xrepo gate.
 *
 * Pure: no fs, no git, no ranker. The rules live here so they can be tested
 * with fake rows, without cloning sixteen repositories.
 *
 * The floor guards the ABSOLUTE level; per-repo no-regress guards against any
 * change in WHAT is found. Both are enforceable because the ranker is
 * deterministic and every repo is pinned: a repo's hit count only moves when
 * SigMap's code does, so any drop is a real signal, not sampling noise. The
 * 95% band reported beside them is about how much to trust the LEVEL, not
 * about whether a regression is real.
 */

export const EPS = 1e-9;

/** Task-weighted totals over per-repo rows ({tasks, hits, mrr, precisionAt5}). */
export function totals(rows) {
  const tasks = rows.reduce((s, r) => s + r.tasks, 0);
  const hits = rows.reduce((s, r) => s + r.hits, 0);
  const weighted = (k) => (tasks ? rows.reduce((s, r) => s + r[k] * r.tasks, 0) / tasks : 0);
  return { tasks, hits, hitAt5: tasks ? hits / tasks : 0, mrr: weighted('mrr'), precisionAt5: weighted('precisionAt5') };
}

/**
 * Integrity problems grouped by repo and kind, so 30 unindexed files read as
 * one line that names the repo instead of 30 lines.
 */
function groupProblems(problems) {
  const groups = new Map();
  for (const p of problems) {
    const key = `${p.repo}\u0000${p.kind}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.entries()].map(([key, list]) => {
    const [repo, kind] = key.split('\u0000');
    const shown = list.slice(0, 4).map((p) => `${p.id} (${p.detail})`).join('; ');
    return `${repo}: ${list.length} task problem(s) [${kind}] — ${shown}${list.length > 4 ? '; …' : ''}`;
  });
}

/**
 * The gate's reasons for failing; empty means pass.
 *
 * @param {object} i
 * @param {Array<{repo:string, tasks:number, hits:number, mrr:number, precisionAt5:number, unreachable?:string[]}>} i.rows repos scored this run
 * @param {string[]} i.expectedRepos every manifest repo that has tasks
 * @param {string[]} i.offPin present checkouts that are not at their pin
 * @param {object|null} i.prior committed baseline ({ repos: { name: {tasks, hits, unreachable} } })
 * @param {number} i.min overall hit@5 floor
 * @param {boolean} i.noRegress compare per-repo hits against the baseline
 * @param {boolean} i.requireRepos fail when any repo is absent or off-pin
 * @param {Array<{repo:string, id:string, kind:string, detail:string}>} i.problems task integrity problems
 * @returns {{ reasons: string[], complete: boolean }}
 */
export function decide(i) {
  const reasons = [];
  const scored = new Set(i.rows.map((r) => r.repo));
  const absent = i.expectedRepos.filter((n) => !scored.has(n) && !i.offPin.includes(n));
  // The floor compares like with like only when every repo contributed.
  const complete = absent.length === 0 && i.offPin.length === 0;

  if (i.requireRepos && !complete) {
    reasons.push(`repos not at their pin: ${[...absent, ...i.offPin].join(', ')} — run node scripts/fetch-xrepo-repos.mjs`);
  }
  reasons.push(...groupProblems(i.problems));

  const t = totals(i.rows);
  if (complete && t.tasks > 0 && t.hitAt5 < i.min - EPS) {
    reasons.push(`xrepo hit@5 ${(t.hitAt5 * 100).toFixed(1)}% (${t.hits}/${t.tasks}) below floor ${(i.min * 100).toFixed(1)}%`);
  }

  if (i.noRegress) {
    if (!i.prior || !i.prior.repos) {
      reasons.push('no baseline recorded — run node scripts/run-xrepo-gate.mjs --save');
    } else {
      for (const r of i.rows) {
        const p = i.prior.repos[r.repo];
        if (!p) reasons.push(`no baseline recorded for ${r.repo} — run --save`);
        else if (p.tasks !== r.tasks) reasons.push(`baseline for ${r.repo} covers ${p.tasks} tasks but the corpus has ${r.tasks} — re-record with --save`);
        else {
          if (r.hits < p.hits) reasons.push(`${r.repo} hit@5 regressed ${p.hits}/${p.tasks} -> ${r.hits}/${r.tasks}`);
          // A task whose every expected file is missing from the zero-config index
          // cannot be found at all. Those already recorded are known product gaps
          // and stay visible in the baseline; one that BECOMES unreachable is the
          // #805 shape — the answer silently falling outside what gets indexed.
          const was = new Set(p.unreachable || []);
          const fresh = (r.unreachable || []).filter((id) => !was.has(id));
          if (fresh.length) reasons.push(`${r.repo}: ${fresh.length} task(s) became unreachable (${fresh.join(', ')}) — their expected files fell out of the zero-config index`);
        }
      }
    }
  }
  return { reasons, complete };
}

// Attribution (--why, #674) moved to attribution.mjs so the retrieval gate shares it
// (#905); re-exported here so every existing importer keeps working.
export { rankOf, bucketOf, attribute, whyLabel, summarizeWhy } from './attribution.mjs';
