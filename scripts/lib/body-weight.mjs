'use strict';

/**
 * body-weight.mjs — the candidate weightings of the body-word field and the rule that
 * decides whether any of them may become the default (#943).
 *
 * Pure: it holds the variant family and the arithmetic of judging it, so both are tested
 * without a repository. `run-body-weight-sweep.mjs` supplies the per-task hits.
 *
 * Why a family and a rule instead of an argmax. `retrieval.bodyWords` wins +15 on xrepo and
 * loses one task on `hard`, and the guide's default rule says no corpus may be net-negative.
 * Picking the cell that scores best on the data it is scored on would answer a different
 * question — "which setting happens to read highest" — so the family is fixed before the run
 * and the rule below is applied to the whole table AND to each half of the corpora that are
 * split, so a variant cannot qualify on the strength of one half.
 */

import { foldsOf, SPLIT_CORPORA, HELD_OUT_CORPORA } from './graph-damping.mjs';

export { foldsOf, SPLIT_CORPORA, HELD_OUT_CORPORA };

/**
 * The variants, mildest first. `bodyWeight` is the body words' own BM25F weight (through v8.74
 * the ranker gave them the prose field's 0.6 and counted them into the length normaliser — the
 * control, `bodyField: 'prose'`); `bodyLength` is `count` (they lengthen the document, as every
 * other field does) or `ignore` (they add term frequency but no length).
 *
 * Order is the tie-break and the selection: weight ascending, `count` before `ignore` — a
 * lower weight departs less from plain, and counting length damps what body words add. The
 * mildest variant that meets the rule is what `verdict()` names, so a variant has to earn every
 * extra bit of bite. The placement through v8.74 is `shipped` and is not in the family: it is
 * the control the variants are compared with.
 */
export const VARIANTS = [
  { id: 'w0.2-count',  options: { bodyField: 'own', bodyWeight: 0.2, bodyLength: 'count' } },
  { id: 'w0.2-ignore', options: { bodyField: 'own', bodyWeight: 0.2, bodyLength: 'ignore' } },
  { id: 'w0.3-count',  options: { bodyField: 'own', bodyWeight: 0.3, bodyLength: 'count' } },
  { id: 'w0.3-ignore', options: { bodyField: 'own', bodyWeight: 0.3, bodyLength: 'ignore' } },
  { id: 'w0.4-count',  options: { bodyField: 'own', bodyWeight: 0.4, bodyLength: 'count' } },
  { id: 'w0.4-ignore', options: { bodyField: 'own', bodyWeight: 0.4, bodyLength: 'ignore' } },
  { id: 'w0.5-count',  options: { bodyField: 'own', bodyWeight: 0.5, bodyLength: 'count' } },
  { id: 'w0.5-ignore', options: { bodyField: 'own', bodyWeight: 0.5, bodyLength: 'ignore' } },
  { id: 'w0.6-ignore', options: { bodyField: 'own', bodyWeight: 0.6, bodyLength: 'ignore' } },
  { id: 'w0.8-count',  options: { bodyField: 'own', bodyWeight: 0.8, bodyLength: 'count' } },
  { id: 'w0.8-ignore', options: { bodyField: 'own', bodyWeight: 0.8, bodyLength: 'ignore' } },
];

/**
 * The variant the code ships, and why it is not the one `verdict()` names.
 *
 * `verdict()` is the rule as it was written before the first run: the mildest variant that meets
 * the guide's default rule. On the tree it was first run on (develop at f33510f) that was
 * `w0.3-ignore`, because the control failed the rule by one task on `hard`. By the time the report
 * was recorded the control met it — `hard` h087 names `src/config/defaults.js` and is decided by
 * the words in that file, so it moved with an edit to a comment in it — and a rule whose premise is
 * a one-task knife-edge on the one corpus that moves with this repository is not a reason to change
 * a placement. What is reproducible on the corpora that do not move with it (xrepo, jvm, honest,
 * easy) is the length treatment: leaving the words out of a document's length beats counting them
 * on xrepo at every weight tried, by +2 or +3. The code ships that, at the weight the words
 * already carried, so no new constant is introduced and the comparison with the control is one
 * factor. `ADOPTED` is held to the report by test: it must meet the rule and must not be worse
 * than the control on a stable corpus.
 */
export const ADOPTED = 'w0.6-ignore';

/** The corpora that do not move with this repository's own files. */
export const STABLE_CORPORA = ['xrepo', 'jvm', 'honest', 'easy'];

/** The default rule of the guide: xrepo wins at least this many more than it loses. */
export const XREPO_MIN_NET = 5;

/**
 * Net hits of one arm against plain, over a set of per-task rows.
 *
 * @param {Array<{plain:number, arms:Object<string,number>}>} rows
 * @param {string} armId
 */
export function netOf(rows, armId) {
  return rows.reduce((n, r) => n + (r.arms[armId] - r.plain), 0);
}

/**
 * Whether one arm meets the default rule, and why not when it does not.
 *
 * The guide's rule is "xrepo wins at least 5 more than it loses, and no corpus is
 * net-negative". It is applied one step more strictly here: neither half of a split corpus
 * (xrepo by repository, mined by task) may be net-negative either.
 *
 * @param {Object<string,Array<object>>} byCorpus corpus -> its per-task rows
 * @param {string} armId
 * @param {(corpus:string, row:object) => 0|1|undefined} foldFor which half a split-corpus row is in
 * @returns {{meets:boolean, nets:Object<string,number>, halves:Object<string,number[]>, failures:string[]}}
 */
export function judge(byCorpus, armId, foldFor) {
  const nets = Object.fromEntries(Object.entries(byCorpus).map(([c, rs]) => [c, netOf(rs, armId)]));
  const halves = {};
  for (const c of SPLIT_CORPORA) {
    if (!byCorpus[c]) continue;
    halves[c] = [0, 1].map((f) => netOf(byCorpus[c].filter((r) => foldFor(c, r) === f), armId));
  }
  const failures = [];
  if (nets.xrepo === undefined) failures.push('xrepo was not scored');
  else if (nets.xrepo < XREPO_MIN_NET) failures.push(`xrepo net ${nets.xrepo} is below +${XREPO_MIN_NET}`);
  for (const [c, n] of Object.entries(nets)) if (n < 0) failures.push(`${c} is net-negative (${n})`);
  for (const [c, hs] of Object.entries(halves)) hs.forEach((n, f) => { if (n < 0) failures.push(`${c} half ${f} is net-negative (${n})`); });
  return { meets: failures.length === 0, nets, halves, failures };
}

/**
 * The verdict over a family: the mildest variant that meets the rule, or null.
 *
 * @param {Object<string,Array<object>>} byCorpus
 * @param {string[]} ids variant ids, mildest first
 * @param {(corpus:string, row:object) => 0|1|undefined} foldFor
 * @returns {{choice:string|null, judged:Object<string,object>}}
 */
export function verdict(byCorpus, ids, foldFor) {
  const judged = Object.fromEntries(ids.map((id) => [id, judge(byCorpus, id, foldFor)]));
  const choice = ids.find((id) => judged[id].meets) || null;
  return { choice, judged };
}

/**
 * Choose a variant on the tuning rows only: the best net over xrepo and mined, among variants
 * that are net-negative on neither; ties go to the milder variant; `null` when none beats plain.
 * This is the cross-validation reading — what a choice made without ever seeing `hard`, `easy`,
 * `jvm` or honest would have been, scored afterwards on the half it did not see.
 *
 * @param {Array<{corpus:string, plain:number, arms:Object<string,number>}>} tuning
 * @param {string[]} ids
 * @returns {{id:string, net:number}|null}
 */
export function chooseOnTuning(tuning, ids) {
  let best = null;
  for (const id of ids) {
    const per = (c) => netOf(tuning.filter((r) => r.corpus === c), id);
    const xrepo = per('xrepo');
    const mined = per('mined');
    if (xrepo < 0 || mined < 0) continue;
    const net = xrepo + mined;
    if (best === null || net > best.net) best = { id, net };
  }
  return best && best.net > 0 ? best : null;
}
