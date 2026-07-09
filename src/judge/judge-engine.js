'use strict';

const fs = require('fs');
const path = require('path');
const { boostFiles, normalizeFile, penalizeFiles } = require('../learning/weights');
const parsers = require('../verify/parsers');

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

/**
 * Claim-level grounding (v8.10) — the structural half of the judge.
 *
 * `groundedness` above measures lexical *word* overlap: "does the answer reuse
 * context vocabulary?" That is a weak proxy — an answer can echo context words
 * while asserting a symbol, file, or import the context never mentions (a
 * hallucination), and still score high. This function extracts the answer's
 * *concrete, checkable claims* — the same high-precision claims the hallucination
 * guard checks (backtick-wrapped `foo()` calls, `path/to/file.ext` references,
 * and `import … from 'mod'` statements) — and verifies each one appears in the
 * provided context. A claim the context never grounds is a hallucination signal
 * that pure word-overlap cannot see.
 *
 * Deterministic, offline, zero-dependency. Reuses `src/verify/parsers`.
 *
 * @param {string} response
 * @param {string} context
 * @returns {{ total: number, grounded: number, ungrounded: Array<{kind:string, value:string}> }}
 */
function claimGrounding(response, context) {
  if (!response || !context) return { total: 0, grounded: 0, ungrounded: [] };
  const ctxLower = context.toLowerCase();

  const raw = [];
  for (const s of parsers.extractSymbols(response)) raw.push({ kind: 'symbol', value: s.name });
  for (const f of parsers.extractFilePaths(response)) raw.push({ kind: 'file', value: f.path });
  for (const i of parsers.extractImports(response)) raw.push({ kind: 'import', value: i.module });

  const seen = new Set();
  const claims = raw.filter((c) => {
    const key = `${c.kind}::${c.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const ungrounded = [];
  let grounded = 0;
  for (const c of claims) {
    // A file claim is grounded if its basename appears in context (the answer
    // may cite a different directory than the map records). Symbols and modules
    // are matched on the token itself.
    const needle = c.value.toLowerCase();
    const base = c.kind === 'file' ? (c.value.split('/').pop() || c.value).toLowerCase() : needle;
    if (ctxLower.includes(base) || ctxLower.includes(needle)) grounded++;
    else ungrounded.push({ kind: c.kind, value: c.value });
  }

  return { total: claims.length, grounded, ungrounded };
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

  // Structural claim grounding: any concrete symbol/file/import the answer
  // states that the context never mentions is a hallucination the lexical
  // score above cannot detect. Each ungrounded claim fails the verdict.
  const claims = claimGrounding(response, context);
  for (const c of claims.ungrounded) {
    reasons.push(`${c.kind} claim not grounded in context: ${c.value}${c.kind === 'symbol' ? '()' : ''}`);
  }

  const verdict = score >= threshold && reasons.length === 0 ? 'pass' : 'fail';
  const result = { score, verdict, reasons, claims };

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

module.exports = { groundedness, claimGrounding, judge };
