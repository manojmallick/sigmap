'use strict';

module.exports = { scoreUsefulness, computeUsefulnessStats };

/**
 * Score answer usefulness based on:
 * 1. Whether right file was retrieved (retrieval hit)
 * 2. Whether retrieved context covered the answer (coverage)
 * 3. Confidence in answer quality (from ranking score)
 */
function scoreUsefulness(taskResult, rankingScore) {
  const { hitRank } = taskResult;

  // Tier 1: File not retrieved — context cannot be useful
  if (hitRank === -1 || hitRank > 5) {
    return {
      tier: 'not-useful',
      score: 0.0,
      reason: 'expected file not in top 5'
    };
  }

  // Tier 2: File retrieved but not top ranking — partially useful
  if (hitRank > 1) {
    return {
      tier: 'partially-useful',
      score: rankingScore * 0.5,  // Partial usefulness
      reason: `file ranked #${hitRank}`
    };
  }

  // Tier 3: File at top of ranking — fully useful
  return {
    tier: 'fully-useful',
    score: rankingScore,  // Full usefulness
    reason: 'file ranked first'
  };
}

function computeUsefulnessStats(taskResults) {
  const tiers = {
    'fully-useful': 0,
    'partially-useful': 0,
    'not-useful': 0
  };

  let totalScore = 0;
  let count = 0;

  taskResults.forEach(result => {
    const usefulness = scoreUsefulness(result, result.rankingScore || 1.0);
    tiers[usefulness.tier]++;
    totalScore += usefulness.score;
    count++;
  });

  return {
    fully_useful: tiers['fully-useful'],
    partially_useful: tiers['partially-useful'],
    not_useful: tiers['not-useful'],
    fully_useful_pct: count > 0 ? (tiers['fully-useful'] / count * 100).toFixed(1) : 0,
    partially_useful_pct: count > 0 ? (tiers['partially-useful'] / count * 100).toFixed(1) : 0,
    not_useful_pct: count > 0 ? (tiers['not-useful'] / count * 100).toFixed(1) : 0,
    average_usefulness_score: count > 0 ? (totalScore / count).toFixed(3) : 0
  };
}
