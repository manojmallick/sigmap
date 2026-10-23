#!/usr/bin/env node
'use strict';

/**
 * paired-test.mjs — the exact paired test behind every "better than" claim (#984).
 *
 * A retrieval change is judged on the SAME tasks before and after, so only the tasks whose
 * hit status changed carry information: the ones it won (miss -> hit) and the ones it lost
 * (hit -> miss). Under "nothing changed, the answers were only moved around" a changed task
 * is equally likely to go either way, so the number of wins among the changed tasks is
 * Binomial(n, 1/2) and the exact two-sided p-value is the sign test (McNemar's exact test
 * is the same computation). No normal approximation: the counts here are small.
 *
 * Pure and dependency-free, so it is tested with plain numbers. It decides nothing: it
 * puts a number and a plain-words verdict beside the won/lost counts a report already has.
 */

export const ALPHA = 0.05;

/** ln(i!) for i = 0..n, built once per call: n is at most a few hundred. */
function logFactorials(n) {
  const f = new Float64Array(n + 1);
  for (let i = 2; i <= n; i++) f[i] = f[i - 1] + Math.log(i);
  return f;
}

/** P(X <= k) for X ~ Binomial(n, 1/2), summed in log space so a large n cannot underflow. */
function cumulative(n, k) {
  const f = logFactorials(n);
  let p = 0;
  for (let i = 0; i <= k; i++) p += Math.exp(f[n] - f[i] - f[n - i] - n * Math.LN2);
  return Math.min(1, p);
}

/**
 * Exact two-sided sign-test p-value for `won` and `lost` changed tasks.
 * @param {number} won  tasks that went miss -> hit
 * @param {number} lost tasks that went hit -> miss
 * @returns {number} 1 when nothing changed
 */
export function signTest(won, lost) {
  for (const v of [won, lost]) if (!Number.isInteger(v) || v < 0) throw new Error(`signTest needs non-negative integer counts, got ${won}, ${lost}`);
  const n = won + lost;
  if (n === 0) return 1;
  // Rounded to 12 significant digits: the log-space sum is off in the 16th, and every small-n answer is a dyadic
  // fraction (6-0 is exactly 1/32) that a reader, and a comparison with alpha, should see as exactly that.
  return Math.min(1, Number((2 * cumulative(n, Math.min(won, lost))).toPrecision(12)));
}

/**
 * The fewest wins out of `n` changed tasks (with no losses beyond n - wins) that the test
 * calls decisive at `alpha`, or null when no count of n changed tasks can be: with fewer than
 * six changed tasks even a clean sweep has p > 0.05. This is the number to read before
 * trusting a small experiment.
 */
export function winsNeeded(n, alpha = ALPHA) {
  for (let w = Math.ceil(n / 2); w <= n; w++) if (signTest(w, n - w) < alpha) return w;
  return null;
}

/**
 * @param {number} won
 * @param {number} lost
 * @param {number} [alpha]
 * @returns {{won:number, lost:number, n:number, net:number, p:number, alpha:number, verdict:'unchanged'|'better'|'worse'|'inconclusive'}}
 */
export function pairedVerdict(won, lost, alpha = ALPHA) {
  const p = signTest(won, lost);
  const n = won + lost;
  let verdict = 'inconclusive';
  if (n === 0) verdict = 'unchanged';
  else if (p < alpha) verdict = won > lost ? 'better' : 'worse';
  return { won, lost, n, net: won - lost, p, alpha, verdict };
}

/** The verdict for one signal arm of a `compareArms` result: its gained and lost task lists, paired against plain. */
export function pairedOfArm(arm, alpha = ALPHA) {
  return pairedVerdict(arm.gained.length, arm.lost.length, alpha);
}

/** "0.0312", "0.5", "<0.0001": the p-value as a reader should see it. */
export function formatP(p) {
  if (p < 0.0001) return '<0.0001';
  if (p >= 0.995) return '1';
  return p.toFixed(p < 0.01 ? 4 : 3).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * One line a report can print after its won/lost counts. It says what the count supports and
 * no more: a verdict of "better" needs p below alpha; everything else is "not distinguishable
 * from reshuffling the answers", with how many changed tasks it would take to tell.
 */
export function pairedText(v) {
  if (v.verdict === 'unchanged') return 'no task changed its hit status';
  const base = `exact sign test on ${v.n} changed task${v.n === 1 ? '' : 's'}: p = ${formatP(v.p)}`;
  if (v.verdict === 'better') return `${base} → better, beyond what reshuffling explains`;
  if (v.verdict === 'worse') return `${base} → worse, beyond what reshuffling explains`;
  const need = winsNeeded(v.n, v.alpha);
  const tail = need === null
    ? `${v.n} changed task${v.n === 1 ? ' is' : 's are'} too few for any result to be decisive`
    : `${need} of ${v.n} would be decisive`;
  return `${base} → not distinguishable from reshuffling (${tail})`;
}

const isHit = (rank, k) => rank !== null && rank !== undefined && rank <= k;

/**
 * Compare two rank tables over the tasks present in BOTH, by hit@k.
 * A rank is the 1-based position of the best expected file, or null for a miss.
 *
 * @param {Object<string, number|null>} before key -> rank (key is a task id, or repo/id)
 * @param {Object<string, number|null>} after
 * @param {number} [k] hit cut-off (5)
 * @returns {{compared:number, onlyBefore:string[], onlyAfter:string[], won:string[], lost:string[], moved:number, verdict:object}}
 */
export function compareRanks(before, after, k = 5) {
  const won = [];
  const lost = [];
  let compared = 0;
  let moved = 0;
  for (const key of Object.keys(after)) {
    if (!(key in before)) continue;
    compared++;
    const a = isHit(before[key], k);
    const b = isHit(after[key], k);
    if (!a && b) won.push(key);
    if (a && !b) lost.push(key);
    if (before[key] !== after[key]) moved++;
  }
  return {
    compared,
    onlyBefore: Object.keys(before).filter((key) => !(key in after)),
    onlyAfter: Object.keys(after).filter((key) => !(key in before)),
    won,
    lost,
    moved,
    verdict: pairedVerdict(won.length, lost.length),
  };
}
