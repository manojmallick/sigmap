'use strict';

/**
 * Convention CI gate (IMPL.md §4 — `conventions --ci`).
 *
 * Fails CI when a repo's overall convention consistency is below a threshold,
 * and optionally when it regresses vs the last recorded run. Builds on the
 * `--report` score. Pure, zero-dependency, bundle-safe.
 */

const { overallScore } = require('./report');

const DEFAULT_MIN = 0.7;
const EPS = 1e-9;

/**
 * Evaluate the consistency gate.
 * @param {object} result an `extractConventions` result
 * @param {object} [opts]
 * @param {number} [opts.min=0.7] minimum overall consistency (0–1)
 * @param {boolean} [opts.noRegress=false] also fail if the score dropped vs prior
 * @param {object|null} [prior] the previous snapshot (from `report.snapshot`)
 * @returns {{ score:number, min:number, ok:boolean, regressed:boolean, reasons:string[] }}
 */
function ciGate(result, opts = {}, prior = null) {
  const min = opts.min != null ? opts.min : DEFAULT_MIN;
  const score = overallScore(result);
  const reasons = [];
  let ok = true;

  if (score < min) {
    ok = false;
    reasons.push(`consistency ${(score * 100).toFixed(0)}% below min ${(min * 100).toFixed(0)}%`);
  }

  let regressed = false;
  if (opts.noRegress && prior && typeof prior.score === 'number') {
    if (score < prior.score - EPS) {
      regressed = true;
      ok = false;
      reasons.push(`consistency dropped ${(prior.score * 100).toFixed(0)}% → ${(score * 100).toFixed(0)}%`);
    }
  }

  return { score, min, ok, regressed, reasons };
}

module.exports = { ciGate, DEFAULT_MIN };
