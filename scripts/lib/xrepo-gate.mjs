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

/** First 1-based rank at which a ranked list reaches an expected file, or null. */
export function rankOf(ranked, expected) {
  const i = (ranked || []).findIndex((f) => (expected || []).includes(f));
  return i === -1 ? null : i + 1;
}

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

// ── Attribution (--why, #674) ────────────────────────────────────────────────
//
// A hit rate says how many tasks miss, not WHY, and the why decides the remedy:
// a file that is not indexed needs detection or an extractor, a file the path
// penalty buries needs a classifier, and a file that is ranked below the top 5
// on its merits needs ranking work — the only kind that trades one split against
// another. Pure, like the rest of this module: the caller hands over the ranker's
// complete result, so the classes can be tested with fake lists.

/** Where a ranked miss sits relative to the top 5. */
export function bucketOf(rank) {
  return rank <= 10 ? '6-10' : rank <= 20 ? '11-20' : rank <= 50 ? '21-50' : 'beyond 50';
}

/**
 * Why a task is or is not a hit, as exactly one class.
 *
 *   hit         an expected file is in the top 5
 *   unindexed   no expected file is in the zero-config index, so the task is
 *               unreachable — detection skipped it or the extractor emitted nothing
 *   no-overlap  an expected file IS indexed but the ranker never returned it:
 *               it shares no token with the question, so it scores zero
 *   penalty     ranked below the top 5, and inside it were the path penalty
 *               undone — the classifier lost it, not the question
 *   ranking     ranked below the top 5 on its merits; `bucket` is how far down
 *
 * The penalty counterfactual divides the penalty out of the final score and
 * re-sorts with the ranker's own tie-break (score, then path). Every other
 * signal is held fixed, so it answers "would this file have made the top 5 had
 * it not been demoted for its path" and nothing more.
 *
 * @param {object} i
 * @param {Array<{file:string, score:number, penalty?:number}>} i.ranked the ranker's complete result, best first
 * @param {string[]} i.expected the task's expected files
 * @param {Set<string>} i.indexed files in the zero-config index that carry a signature
 * @returns {{cls:'hit'|'unindexed'|'no-overlap'|'penalty'|'ranking', rank:number|null, bucket?:string, penalty?:number, withoutPenalty?:number}}
 */
export function attribute({ ranked, expected, indexed }) {
  const files = ranked.map((r) => r.file);
  const rank = rankOf(files, expected);
  if (rank !== null && rank <= 5) return { cls: 'hit', rank };
  if (!expected.some((f) => indexed.has(f))) return { cls: 'unindexed', rank: null };
  if (rank === null) return { cls: 'no-overlap', rank: null };

  const penalty = typeof ranked[rank - 1].penalty === 'number' ? ranked[rank - 1].penalty : 1;
  if (penalty < 1) {
    const undone = ranked
      .map((r) => ({ file: r.file, score: r.penalty > 0 ? r.score / r.penalty : r.score }))
      .sort((a, b) => (b.score - a.score) || (a.file < b.file ? -1 : 1));
    const without = rankOf(undone.map((r) => r.file), expected);
    if (without !== null && without <= 5) return { cls: 'penalty', rank, penalty, withoutPenalty: without };
  }
  return { cls: 'ranking', rank, bucket: bucketOf(rank) };
}

/** The label a class is reported under; a ranked miss is reported by distance. */
export function whyLabel(a) {
  switch (a.cls) {
    case 'unindexed': return 'answer not indexed';
    case 'penalty': return 'demoted by a path penalty';
    case 'no-overlap': return 'no token in common with the question';
    case 'ranking': return `ranked ${a.bucket}`;
    default: return 'hit';
  }
}

const WHY_ORDER = [
  'answer not indexed', 'demoted by a path penalty', 'no token in common with the question',
  'ranked 6-10', 'ranked 11-20', 'ranked 21-50', 'ranked beyond 50',
];

/**
 * Counts per label, in a fixed order, so two runs print comparable tables.
 * Every miss lands in exactly one row: the rows sum to `misses`.
 */
export function summarizeWhy(attributions) {
  const counts = new Map(WHY_ORDER.map((l) => [l, 0]));
  let hits = 0;
  for (const a of attributions) {
    if (a.cls === 'hit') { hits++; continue; }
    const l = whyLabel(a);
    counts.set(l, (counts.get(l) || 0) + 1);
  }
  return { tasks: attributions.length, hits, misses: attributions.length - hits, rows: [...counts.entries()] };
}
