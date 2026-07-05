'use strict';

/**
 * SigMap identifier-aware BM25 re-ranker (zero dependencies, deterministic).
 *
 * Plain exact-token TF-IDF misses queries whose terms live *inside* code
 * identifiers — e.g. `component emit` never surfaces `componentEmits.ts`,
 * because "componentEmits" is one token that shares no exact term with the
 * query. This module fixes that with four small additions:
 *
 *   1. Identifier-aware tokenization — split camelCase and snake_case.
 *   2. Light stemming — plurals / common suffixes (`emits` → `emit`).
 *   3. Path-token boost — file path / basename tokens weigh PATH_BOOST× more.
 *   4. BM25 scoring instead of raw TF-IDF (length-normalized).
 *
 * On 85 curated tasks across 17 repos this lifted hit@5 from 75.3% → 82.4%
 * (MRR +16% relative). See issue #395.
 */

// Stop words: common English + low-signal code verbs/nouns that appear in
// nearly every signature and so carry little retrieval signal.
const STOP = new Set(
  ('a an the of to in on for and or is are be by with as at from that this it its ' +
   'into get set add new return value test')
    .split(' ')
);

/**
 * Light suffix stemmer — conservative, tuned for code identifiers rather than
 * prose. Words of 3 chars or fewer pass through unchanged; a result shorter
 * than 3 chars reverts to the original token.
 *
 * @param {string} w
 * @returns {string}
 */
function stem(w) {
  if (w.length <= 3) return w;
  let s = w;
  s = s.replace(/ies$/, 'y');
  s = s.replace(/(sses|shes|ches|xes|zes)$/, (m) => m.slice(0, -2));
  s = s.replace(/([^s])s$/, '$1');
  s = s.replace(/(ization|izations)$/, 'ize');
  s = s.replace(/(ing|edly|ed|er|ers|ation|ations|ment|ness|ity|ive|able|ible|ize|ise|al)$/, '');
  return s.length >= 3 ? s : w;
}

/**
 * Split on non-alphanumeric characters AND camelCase / snake_case boundaries,
 * lowercase, drop stop words and single characters, then stem.
 *
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem)
    .filter(Boolean);
}

// The file path / basename is highly indicative of relevance, so its tokens
// are counted PATH_BOOST times when building the document term-frequency map.
const PATH_BOOST = 3;

// Curated, high-precision code-domain synonym / abbreviation expansions. A query
// for `authentication` should still surface a file whose signatures only say
// `auth`. Kept deliberately tight — over-broad synonyms hurt precision. Groups
// are expanded bidirectionally (every member maps to the others). Values are
// tokenized+stemmed at load, so entries are written in natural form.
const EXPANSION_GROUPS = [
  ['auth', 'authenticate', 'authentication', 'login', 'signin', 'credential'],
  ['authorize', 'authorization', 'permission', 'access'],
  ['config', 'configuration', 'settings', 'options'],
  ['db', 'database'],
  ['ctx', 'context'],
  ['req', 'request'],
  ['res', 'response'],
  ['err', 'error'],
  ['msg', 'message'],
  ['init', 'initialize', 'initialization', 'setup'],
  ['async', 'asynchronous'],
  ['sync', 'synchronize', 'synchronous'],
  ['repo', 'repository'],
  ['impl', 'implementation'],
  ['util', 'utility', 'helper'],
  ['param', 'parameter', 'argument'],
  ['fn', 'func', 'function'],
  ['btn', 'button'],
  ['calc', 'calculate', 'calculation'],
  ['gen', 'generate', 'generator'],
  ['val', 'validate', 'validation'],
  ['del', 'delete', 'remove'],
  ['dir', 'directory', 'folder'],
  ['env', 'environment'],
  ['doc', 'document', 'documentation'],
  ['id', 'identifier'],
  ['num', 'number'],
  ['str', 'string'],
];

// The weight applied to an expanded (synonym) query term, so an exact match on
// the literal query token always outranks a synonym-only match.
const EXPANSION_WEIGHT = 0.15;

// Build a stemmed lookup: stem(member) → Set of the group's other stemmed members.
const EXPANSIONS = (() => {
  const map = new Map();
  for (const group of EXPANSION_GROUPS) {
    const stemmed = [...new Set(group.map((w) => tokenize(w).join('')).filter(Boolean))];
    for (const s of stemmed) {
      if (!map.has(s)) map.set(s, new Set());
      for (const other of stemmed) if (other !== s) map.get(s).add(other);
    }
  }
  return map;
})();

/**
 * Expand stemmed query tokens with curated synonyms. Returns a Map of
 * token → weight (1 for the original query tokens, EXPANSION_WEIGHT for
 * synonyms). Original tokens always keep full weight even if also a synonym.
 *
 * @param {string[]} qToks  stemmed, de-duplicated query tokens
 * @returns {Map<string, number>}
 */
function expandQuery(qToks) {
  const weights = new Map();
  for (const t of qToks) weights.set(t, 1);
  for (const t of qToks) {
    const syns = EXPANSIONS.get(t);
    if (!syns) continue;
    for (const s of syns) if (!weights.has(s)) weights.set(s, EXPANSION_WEIGHT);
  }
  return weights;
}

/**
 * BM25 re-rank of candidates against a query. Each candidate is
 * `{ file, sigs }`; the returned objects preserve all original candidate
 * fields and add a numeric `score` (higher = more relevant), sorted best-first
 * with a deterministic path tie-break. A `score` of 0 means no query token
 * matched — callers typically drop those.
 *
 * @param {string} query
 * @param {{ file: string, sigs: string[] }[]} candidates
 * @returns {Array<object & { score: number }>}
 */
function bm25rank(query, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const k1 = 1.5;
  const b = 0.75;

  const docs = candidates.map((c) => {
    const pathToks = tokenize(c.file || '');
    const toks = tokenize((c.sigs || []).join(' '));
    for (let i = 0; i < PATH_BOOST; i++) toks.push(...pathToks);
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    return { cand: c, tf, len: toks.length };
  });

  const N = docs.length || 1;
  const avgdl = docs.reduce((s, d) => s + d.len, 0) / N || 1;

  const df = new Map();
  for (const d of docs) {
    for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  }

  const qToks = [...new Set(tokenize(query))];
  const qWeights = expandQuery(qToks); // token → weight (1 exact, <1 synonym)

  return docs
    .map((d) => {
      let score = 0;
      for (const [t, w] of qWeights) {
        const f = d.tf.get(t);
        if (!f) continue;
        const dfT = df.get(t);
        const idf = Math.log(1 + (N - dfT + 0.5) / (dfT + 0.5));
        score += w * ((idf * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * d.len) / avgdl)));
      }
      return Object.assign({}, d.cand, { score });
    })
    .sort((a, c) => c.score - a.score || String(a.file).localeCompare(String(c.file)));
}

module.exports = { tokenize, stem, bm25rank, PATH_BOOST, STOP, expandQuery, EXPANSIONS, EXPANSION_WEIGHT };
