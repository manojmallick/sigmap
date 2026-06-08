'use strict';

/**
 * Closest-match suggestions for the Hallucination Guard (v6.15.0).
 *
 * Heuristic layer (plan §5 labels this "Medium" confidence): given a name the
 * detectors flagged as fake, find the nearest *real* candidate by Levenshtein
 * distance so the report can say "Did you mean `loadConfig()` in
 * src/config/loader.js:42?". Pure, deterministic, offline — no network, no LLM.
 *
 * All inputs are passed in (symbol/file/script candidate lists) so this module
 * stays unit-testable without touching the filesystem or the SigMap index.
 */

/**
 * Levenshtein edit distance with an early-exit ceiling.
 * Returns `max + 1` as soon as the best achievable distance exceeds `max`,
 * so callers can cheaply reject far-apart strings.
 */
function levenshtein(a, b, max = Infinity) {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  if (Math.abs(al - bl) > max) return max + 1;

  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[bl];
}

/** Bucket a normalized edit distance into a confidence label (plan §5). */
function suggestionConfidence(distance, targetLen) {
  const ratio = distance / Math.max(targetLen, 1);
  if (distance === 0 || ratio <= 0.2) return 'high';
  if (ratio <= 0.4) return 'medium';
  return 'low';
}

/**
 * Find the nearest candidate name to `target`.
 *
 * @param {string} target
 * @param {Array<string | { name: string, file?: string, line?: number }>} candidates
 * @param {object} [opts]
 * @param {number} [opts.maxRatio=0.5]  reject matches farther than ratio·len edits
 * @param {number} [opts.minLen=3]      skip very short targets (too noisy)
 * @returns {{ name, file, line, distance, confidence } | null}
 */
function closestMatch(target, candidates, opts = {}) {
  const maxRatio = opts.maxRatio != null ? opts.maxRatio : 0.5;
  const minLen = opts.minLen != null ? opts.minLen : 3;
  if (!target || target.length < minLen) return null;
  if (!candidates || candidates.length === 0) return null;

  const lower = target.toLowerCase();
  const cap = Math.max(1, Math.ceil(target.length * maxRatio));
  let best = null;

  for (const c of candidates) {
    const name = typeof c === 'string' ? c : c && c.name;
    if (!name || name === target) continue;
    if (Math.abs(name.length - target.length) > cap) continue;
    const d = levenshtein(lower, name.toLowerCase(), cap);
    if (d > cap) continue;
    if (!best || d < best.distance ||
        (d === best.distance && name.length < best.name.length)) {
      best = {
        name,
        file: typeof c === 'object' ? c.file : undefined,
        line: typeof c === 'object' ? c.line : undefined,
        distance: d,
      };
      if (d === 0) break; // case-only difference — can't beat it
    }
  }

  if (!best) return null;
  best.confidence = suggestionConfidence(best.distance, target.length);
  return best;
}

/**
 * Build `[{ name, file, line }]` symbol candidates from a SigMap signature
 * index (`Map<file, string[]>` whose entries may carry a `:start-end` anchor).
 */
function buildSymbolCandidates(sigIndex) {
  const out = [];
  const seen = new Set();
  if (!sigIndex) return out;
  for (const [file, sigs] of sigIndex) {
    for (const sig of sigs) {
      const s = String(sig);
      const lineM = s.match(/:(\d+)(?:-\d+)?\s*$/);
      const line = lineM ? parseInt(lineM[1], 10) : null;
      const cleaned = s.replace(/\s*:\d+(?:-\d+)?\s*$/, '');
      const m = cleaned.match(/\b(?:async\s+function|function|class|def|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/)
        || cleaned.match(/([A-Za-z_$][\w$]*)\s*\(/)
        || cleaned.match(/([A-Za-z_$][\w$]*)/);
      if (!m) continue;
      const name = m[1];
      const key = name + '@' + file;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, file, line });
    }
  }
  return out;
}

/** Format a suggestion object into a human one-liner for reports/CLI. */
function formatSuggestion(match, asCall) {
  if (!match) return null;
  const sym = asCall ? `${match.name}()` : match.name;
  let where = '';
  if (match.file) {
    where = match.line ? ` in ${match.file}:${match.line}` : ` in ${match.file}`;
  }
  return `Did you mean \`${sym}\`${where}?`;
}

module.exports = {
  levenshtein,
  closestMatch,
  buildSymbolCandidates,
  suggestionConfidence,
  formatSuggestion,
};
