'use strict';

const fs = require('fs');
const path = require('path');
const { boostFiles, normalizeFile, penalizeFiles } = require('../learning/weights');

const STOP = new Set([
  'the','a','an','in','on','at','to','of','for','and','or','but',
  'is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might',
  'shall','can','not','with','from','by','as','this','that','it',
]);

function tokenize(text) {
  return (text || '').toLowerCase().match(/\b[a-z][a-z0-9_]{2,}\b/g) || [];
}

function groundedness(response, context) {
  if (!response || !context) return 0;
  const ctxTokens = new Set(tokenize(context).filter((t) => !STOP.has(t)));
  if (ctxTokens.size === 0) return 0;
  const respTokens = tokenize(response).filter((t) => !STOP.has(t));
  if (respTokens.length === 0) return 0;
  const matched = respTokens.filter((t) => ctxTokens.has(t));
  return parseFloat((matched.length / respTokens.length).toFixed(3));
}

const GENERIC_MARKERS = [
  'however, based on my knowledge',
  'generally speaking',
  'in general',
  'typically,',
  'usually,',
  'as a general rule',
];

function extractContextFiles(context, cwd) {
  if (!context || !cwd) return [];

  const seen = new Set();
  const files = [];
  const lines = context.split('\n');

  for (const line of lines) {
    const match = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (!match) continue;

    const normalized = normalizeFile(cwd, match[1]);
    if (!normalized) continue;

    const abs = path.join(cwd, normalized);
    if (!fs.existsSync(abs) || seen.has(normalized)) continue;

    seen.add(normalized);
    files.push(normalized);
  }

  return files;
}

function judge(response, context, opts = {}) {
  const score = groundedness(response, context);
  const threshold = opts.threshold !== undefined ? opts.threshold : 0.25;
  const reasons = [];

  if (score < threshold) {
    reasons.push(`score ${score} is below threshold ${threshold} — response may not be grounded in context`);
  }

  if (response) {
    const lower = response.toLowerCase();
    for (const m of GENERIC_MARKERS) {
      if (lower.includes(m)) {
        reasons.push(`response contains generic phrase: "${m}"`);
      }
    }
  }

  const verdict = score >= threshold && reasons.length === 0 ? 'pass' : 'fail';
  const result = { score, verdict, reasons };

  if (opts.learn) {
    const learning = {
      applied: false,
      action: 'none',
      files: [],
    };

    if (!opts.cwd) {
      learning.reason = 'cwd is required for learning';
      result.learning = learning;
      return result;
    }

    const contextFiles = extractContextFiles(context, opts.cwd);
    learning.files = contextFiles;

    if (contextFiles.length === 0) {
      learning.reason = 'no context files found in context headings';
      result.learning = learning;
      return result;
    }

    if (score > 0.75) {
      boostFiles(opts.cwd, contextFiles, 0.05);
      learning.applied = true;
      learning.action = 'boost';
    } else if (score < 0.40) {
      penalizeFiles(opts.cwd, contextFiles, 0.03);
      learning.applied = true;
      learning.action = 'penalize';
    } else {
      learning.reason = 'groundedness in no-op band (0.40-0.75)';
    }

    result.learning = learning;
  }

  return result;
}

module.exports = { groundedness, judge };
