'use strict';

/**
 * graph-damping.mjs — the candidate rules and the held-out selection behind the
 * hop-1 graph-boost calibration (#935).
 *
 * Pure: it holds the rule family and the arithmetic of choosing among rules, so
 * both are tested without a repository. `run-graph-damping-sweep.mjs` supplies
 * the per-task hits.
 *
 * Why a protocol and not an argmax. The sweep in #935's issue text scored 13
 * variants on the corpora they were scored on; the best of 13 on 83 tasks is
 * partly noise. Here the rule is CHOSEN on one half of the tasks and SCORED on
 * the other half, and on the corpora tuning never touches.
 */

/**
 * The rule family, fixed before the held-out run and mildest first. Most of the
 * shapes come from the lead in #935, which was scored on the corpora it was
 * picked from; this file is what makes the second look a different measurement
 * (see the folds below), not a claim that the family was never seen. Order is
 * the tie-break: among rules that score the same on the tuning half, the earlier
 * (milder) one is chosen, so a rule has to earn its extra bite.
 *
 * `damping` is the ranker's `graphDamping` option.
 */
export const RULES = [
  { id: 'cap24',      damping: { maxBonuses: 24 } },
  { id: 'cap16',      damping: { maxBonuses: 16 } },
  { id: 'cap12',      damping: { maxBonuses: 12 } },
  { id: 'cap8',       damping: { maxBonuses: 8 } },
  { id: 'cap4',       damping: { maxBonuses: 4 } },
  { id: 'share2',     damping: { maxShare: 2 } },
  { id: 'share1',     damping: { maxShare: 1 } },
  { id: 'share0.5',   damping: { maxShare: 0.5 } },
  { id: 'decay0.9',   damping: { decay: 0.9 } },
  { id: 'decay0.8',   damping: { decay: 0.8 } },
];

/** Corpora whose tasks are split into a tuning half and a held-out half. */
export const SPLIT_CORPORA = ['xrepo', 'mined'];
/** Corpora no rule is ever tuned on. */
export const HELD_OUT_CORPORA = ['hard', 'easy', 'jvm'];

/**
 * Which fold a unit belongs to: units are sorted and dealt alternately, so the
 * split is deterministic and does not depend on how the corpus file is ordered.
 *
 * @param {string[]} unitIds repo names (xrepo) or task ids (mined)
 * @returns {Map<string, 0|1>}
 */
export function foldsOf(unitIds) {
  return new Map([...unitIds].sort().map((id, i) => [id, /** @type {0|1} */ (i % 2)]));
}

/**
 * Net hits of one rule against the shipped ranker, over a set of per-task cells.
 *
 * @param {Array<{shipped:number, rules:Object<string,number>}>} cells
 * @param {string} ruleId
 */
export function netOf(cells, ruleId) {
  return cells.reduce((n, c) => n + (c.rules[ruleId] - c.shipped), 0);
}

/**
 * The rule with the best net on `cells`; ties go to the earlier (milder) rule.
 * A rule that does not beat the shipped ranker (net <= 0) is reported as
 * `null` — "change nothing" is a valid choice, and the only one a flat table earns.
 *
 * @param {Array<{shipped:number, rules:Object<string,number>}>} cells
 * @param {string[]} [ids] candidate ids, mildest first
 * @returns {{id:string, net:number}|null}
 */
export function chooseRule(cells, ids = RULES.map((r) => r.id)) {
  let best = null;
  for (const id of ids) {
    const net = netOf(cells, id);
    if (best === null || net > best.net) best = { id, net };
  }
  return best && best.net > 0 ? best : null;
}
