'use strict';

/**
 * Convention audit + trend (IMPL.md §4 — `conventions --report`).
 *
 * Turns an `extractConventions` result into an audit: a consistency score per
 * convention plus a single file-count-weighted overall score, each with a delta
 * vs the previous run (the trend). Pure, zero-dependency, bundle-safe.
 */

const NAMES = { fileNaming: 'file naming', exportStyle: 'export style' };

/** File-count-weighted mean of the scored conventions' dominant shares (0–1). */
function overallScore(result) {
  let num = 0;
  let den = 0;
  for (const key of ['fileNaming', 'exportStyle']) {
    const c = result && result[key];
    if (c && c.total > 0) { num += c.dominantPct * c.total; den += c.total; }
  }
  return den > 0 ? num / den : 0;
}

/**
 * Build a consistency report with trend vs a prior snapshot.
 * @param {object} result an `extractConventions` result
 * @param {object|null} [prior] a previous snapshot (this module's `snapshot` shape)
 * @returns {{ conventions: object[], testFramework: string|null,
 *   score: number, prevScore: number|null, scoreDelta: number|null }}
 */
function scoreReport(result, prior) {
  const conventions = [];
  for (const key of ['fileNaming', 'exportStyle']) {
    const c = (result && result[key]) || { dominant: null, dominantPct: 0, total: 0, tier: 'unknown' };
    const priorPct = prior && prior[key] && typeof prior[key].dominantPct === 'number' ? prior[key].dominantPct : null;
    conventions.push({
      key,
      name: NAMES[key] || key,
      dominant: c.dominant,
      dominantPct: c.dominantPct,
      tier: c.tier,
      total: c.total,
      delta: priorPct == null ? null : c.dominantPct - priorPct,
    });
  }
  const score = overallScore(result);
  const prevScore = prior && typeof prior.score === 'number' ? prior.score : null;
  return {
    conventions,
    testFramework: (result && result.testFramework) || null,
    score,
    prevScore,
    scoreDelta: prevScore == null ? null : score - prevScore,
  };
}

/**
 * A compact, persistable snapshot of a run (one line in the history log).
 * @param {object} result an `extractConventions` result
 * @param {string} [ts] ISO timestamp (caller supplies — keeps this pure)
 */
function snapshot(result, ts) {
  const pick = (c) => (c && c.total > 0
    ? { dominant: c.dominant, dominantPct: c.dominantPct, tier: c.tier, total: c.total }
    : { dominant: null, dominantPct: 0, tier: 'unknown', total: 0 });
  return {
    ts: ts || null,
    fileNaming: pick(result && result.fileNaming),
    exportStyle: pick(result && result.exportStyle),
    testFramework: (result && result.testFramework) || null,
    score: overallScore(result),
  };
}

module.exports = { scoreReport, snapshot, overallScore };
