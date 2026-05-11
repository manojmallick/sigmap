'use strict';

/**
 * Diagnostic utilities for understanding file inclusion/exclusion decisions.
 *
 * Provides detailed per-file diagnostics showing:
 * - Why files are included or excluded
 * - Ranking scores and signals
 * - Budget constraints and priorities
 */

const path = require('path');

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function formatFileDecision(entry, decision, reason, score = null) {
  const rel = path.relative(process.cwd(), entry.filePath);
  const tokens = estimateTokens(entry.sigs.join('\n'));
  let line = `${decision === 'included' ? '✓' : '✗'} ${rel}`;
  line += ` [${tokens} tokens]`;
  if (score !== null) line += ` [score: ${score.toFixed(2)}]`;
  if (reason) line += ` — ${reason}`;
  return line;
}

function computeFileMetrics(entry) {
  const loc = entry.content ? entry.content.split('\n').length : 1;
  const sigCount = entry.sigs ? entry.sigs.length : 0;
  const signalQuality = loc > 0 ? sigCount / loc : 0;
  const tokens = estimateTokens(entry.sigs.join('\n'));

  return {
    lineOfCode: loc,
    sigCount: sigCount,
    signalQuality: signalQuality.toFixed(3),
    tokens: tokens,
    relevance: (sigCount / Math.max(loc, 1)).toFixed(3),
  };
}

function explainInclusion(fileEntries, budgetLimit) {
  const lines = [];

  lines.push('## File Inclusion Diagnostics\n');
  lines.push(`Budget: ${budgetLimit} tokens`);
  lines.push(`Files: ${fileEntries.length} scanned\n`);

  let totalTokens = 0;
  const withMetrics = fileEntries.map((e) => {
    const metrics = computeFileMetrics(e);
    totalTokens += metrics.tokens;
    return { entry: e, metrics };
  });

  lines.push(`Total token requirement: ${totalTokens} tokens`);
  lines.push(`Budget headroom: ${budgetLimit * 0.9} tokens (90% of ${budgetLimit})\n`);

  if (totalTokens > budgetLimit * 0.9) {
    lines.push('⚠ Over budget — files will be dropped\n');
    lines.push('### Per-file metrics:');
    for (const { entry, metrics } of withMetrics) {
      const rel = path.relative(process.cwd(), entry.filePath);
      lines.push(`- ${rel}`);
      lines.push(`  - Size: ${metrics.tokens} tokens, ${metrics.lineOfCode} lines`);
      lines.push(`  - Sigs: ${metrics.sigCount}, quality: ${metrics.signalQuality}`);
    }
  } else {
    lines.push('✓ All files fit within budget\n');
  }

  return lines.join('\n');
}

function explainExclusion(dropped, reason) {
  return `Excluded ${dropped.length} files: ${reason}`;
}

module.exports = {
  formatFileDecision,
  computeFileMetrics,
  explainInclusion,
  explainExclusion,
  estimateTokens,
};
