#!/usr/bin/env node
'use strict';

/**
 * agent-ab-stats.mjs — the two estimators of "did it save?" (#812 follow-up).
 *
 * "Did the treatment use less?" hides two separate choices: how the tasks are
 * summarised. This module holds both, so the harness reports each one and never
 * lets one stand in for the other:
 *
 *   - the WORKLOAD TOTAL: add up everything the tasks consumed in each arm and
 *     compare the two sums. It is the closest thing to the bill for this exact
 *     batch, and one or two enormous tasks can decide it.
 *   - the TYPICAL TASK: pair the arms on each task, take the ratio on each pair,
 *     and average the ratios geometrically. Every task has equal influence, and
 *     the result no longer adds up to the batch total.
 *
 * The two can disagree in sign on the very same runs (a few large tasks dominate
 * the sum), which is why neither is "the" answer. A bootstrap interval on the
 * typical-task estimate says how much of a difference is just which tasks were
 * drawn: an interval that includes zero is inside the noise.
 *
 * Pure and deterministic: no clock, no Math.random, no I/O. The bootstrap runs
 * on a seeded generator, so the same pairs give the same interval on every
 * machine and the report stays byte-stable. Zero dependencies.
 *
 * A "change" here is a FRACTION: -0.25 means 25% lower, +0.5 means 50% higher.
 */

/** Resamples per interval. Fixed, not a flag: a knob a run can turn is a number that can be tuned. */
export const BOOTSTRAP_ITERATIONS = 10000;

/** One seed for every interval, re-applied per call so an estimate never depends on call order. */
export const BOOTSTRAP_SEED = 1;

/** Central coverage of the interval. */
export const CI_LEVEL = 0.95;

/**
 * mulberry32 — a small, well-known 32-bit generator. Not cryptographic and not
 * meant to be: it only has to be repeatable and evenly spread.
 *
 * @param {number} seed
 * @returns {() => number} uniform in [0, 1)
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

/** Only pairs whose two values are both finite numbers: an unknown is never a pair, never a zero. */
const usable = (pairs) => (pairs || []).filter((p) => p && isNum(p.without) && isNum(p.with));

/**
 * The workload-total estimate: Σ(with) ÷ Σ(without) − 1 over the pairs.
 *
 * @param {Array<{without:number, with:number}>} pairs
 * @returns {{ n:number, without:number|null, with:number|null, change:number|null }}
 *   `change` is `null` with no pairs or a zero baseline total (a ratio of nothing).
 */
export function workloadChange(pairs) {
  const ps = usable(pairs);
  if (!ps.length) return { n: 0, without: null, with: null, change: null };
  const without = ps.reduce((s, p) => s + p.without, 0);
  const withSum = ps.reduce((s, p) => s + p.with, 0);
  return { n: ps.length, without, with: withSum, change: without > 0 ? withSum / without - 1 : null };
}

/** ln(with ÷ without) for each pair that has a ratio; a zero on either side has none. */
function logRatios(pairs) {
  const ps = usable(pairs);
  const logs = [];
  for (const p of ps) if (p.without > 0 && p.with > 0) logs.push(Math.log(p.with / p.without));
  return { logs, dropped: ps.length - logs.length };
}

const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * The typical-task estimate: the geometric mean of the per-pair ratios, minus 1,
 * with a seeded percentile-bootstrap interval over the pairs.
 *
 * A pair with a 0 on either side has no ratio. It is COUNTED in `dropped`, not
 * folded in as "0%" or "-100%", so a metric that is often zero says so instead
 * of quietly shrinking the sample.
 *
 * With fewer than 2 pairs there is no spread to resample, so there is no
 * interval (`lo`/`hi` are `null`) — a single pair is a point, not a band.
 *
 * @param {Array<{without:number, with:number}>} pairs
 * @param {{ iterations?: number, seed?: number, level?: number }} [opts]
 * @returns {{ n:number, dropped:number, change:number|null, lo:number|null, hi:number|null, inNoise:boolean|null }}
 *   `inNoise` is `true` when the interval includes zero, `null` when there is none.
 */
export function geometricChange(pairs, opts = {}) {
  const iterations = opts.iterations === undefined ? BOOTSTRAP_ITERATIONS : opts.iterations;
  const seed = opts.seed === undefined ? BOOTSTRAP_SEED : opts.seed;
  const level = opts.level === undefined ? CI_LEVEL : opts.level;
  const { logs, dropped } = logRatios(pairs);
  const n = logs.length;
  if (!n) return { n: 0, dropped, change: null, lo: null, hi: null, inNoise: null };
  const change = Math.exp(meanOf(logs)) - 1;
  if (n < 2 || iterations < 1) return { n, dropped, change, lo: null, hi: null, inNoise: null };

  const rng = makeRng(seed);
  const draws = new Array(iterations);
  for (let b = 0; b < iterations; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += logs[Math.floor(rng() * n)];
    draws[b] = Math.exp(sum / n) - 1;
  }
  draws.sort((a, b) => a - b);
  const alpha = (1 - level) / 2;
  const lo = draws[Math.floor(alpha * iterations)];
  const hi = draws[Math.min(iterations - 1, Math.ceil((1 - alpha) * iterations) - 1)];
  return { n, dropped, change, lo, hi, inNoise: lo <= 0 && hi >= 0 };
}

/**
 * Whether a series of per-repetition changes points the same way every time.
 * This is the question the estimates exist to answer — a saving that shows up in
 * one repetition and reverses in the next is not a saving.
 *
 * Needs at least 2 measurable repetitions: one repetition is a single draw and
 * cannot show consistency either way. A change of exactly 0 is neither a saving
 * nor a cost: a series that is 0 every time is `unchanged`, and a 0 among
 * movements in a direction breaks that direction (`mixed`).
 *
 * @param {Array<number|null>} changes one per repetition, `null` where unmeasurable
 * @returns {'fewer-every-repetition'|'more-every-repetition'|'unchanged'|'mixed'|null}
 */
export function consistency(changes) {
  const c = (changes || []).filter(isNum);
  if (c.length < 2) return null;
  if (c.every((x) => x < 0)) return 'fewer-every-repetition';
  if (c.every((x) => x > 0)) return 'more-every-repetition';
  if (c.every((x) => x === 0)) return 'unchanged';
  return 'mixed';
}
