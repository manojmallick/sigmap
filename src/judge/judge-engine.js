'use strict';

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
  return { score, verdict, reasons };
}

module.exports = { groundedness, judge };
