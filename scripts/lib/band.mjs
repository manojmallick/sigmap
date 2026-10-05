#!/usr/bin/env node
'use strict';

/**
 * band.mjs — the interval a hit rate over a small corpus can honestly be read as.
 *
 * A hit@5 over 60 tasks is not a point: one task is 1.7pp and the 95% interval
 * is about ±12pp. Wilson's score interval is closed-form and deterministic, so
 * a gate's output does not move between runs, and it stays valid at the small
 * n and the extreme rates a retrieval corpus produces. Zero-dependency.
 */

/**
 * Wilson score interval for k hits of n.
 * @returns {{ low: number, high: number }} proportions in [0, 1]
 */
export function wilson(k, n, z = 1.96) {
  if (!n) return { low: 0, high: 0 };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/** `49.0%-73.0%` for k of n. */
export function band(k, n) {
  const { low, high } = wilson(k, n);
  return `${(low * 100).toFixed(1)}%-${(high * 100).toFixed(1)}%`;
}
