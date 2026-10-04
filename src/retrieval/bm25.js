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
 *   2. Light stemming — plurals / inflections (`emits` → `emit`, `classified` → `classify`).
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

const SUFFIX = /(ing|edly|ed|er|ers|ation|ations|ment|ness|ity|ive|able|ible|ize|ise|al)$/;
// Suffixes that inflect a word. They are the only ones that can take a final
// `e` with them (`parse` -> `parsing`), so they are the only ones that put it back.
const INFLECTION = new Set(['ing', 'edly', 'ed', 'er', 'ers']);
// -ing/-ed may leave a short root (`mapping` -> `map`). Everything else needs a real
// one: `order` is not `ord` + `er`, and `normal` is not `norm` + `al`.
const MIN_ROOT = 5;
// `classify`, `classifier`, `classification` -> `class`, so they meet a `file-class` path.
// A root under 4 chars is left alone: `verify` is not `ver` + `ify`.
const dropIfy = (s) => s.replace(/(ification|ifier|ify)$/, (m, _, at) => (at >= 4 ? '' : m));

/**
 * Suffix stemmer, tuned for code identifiers rather than prose. Base and inflected
 * forms of a word reach the same stem — `classify`/`classified`, `parse`/`parsing`,
 * `order`/`ordering`, `register`/`registered` (#875) — and `classify` reaches
 * `class`, so `classified` meets a `file-class` path. Words of 3 chars or fewer pass
 * through unchanged; a result shorter than 3 chars reverts to the plural-folded token.
 *
 * Not idempotent for every word: a stem that still ends in a removable suffix
 * (`implemented` -> `implement`, which stems on to `impl`) is left as it is, because
 * merging those chains makes a verb like `implement` match every file that says
 * "implementation" and costs ranking precision (measured; see the #875 tests).
 *
 * @param {string} w
 * @returns {string}
 */
function stem(w) {
  let s = STEMS.get(w);
  if (s === undefined) {
    s = stemWord(w);
    if (STEMS.size >= STEM_CACHE_MAX) STEMS.clear();
    STEMS.set(w, s);
  }
  return s;
}

// Pure, and a corpus repeats a small vocabulary across every query, so memoise.
const STEMS = new Map();
const STEM_CACHE_MAX = 50000;

function stemWord(w) {
  if (w.length <= 3) return w;
  let s = w;
  s = s.replace(/ies$/, 'y');
  s = s.replace(/(sses|shes|ches|xes|zes)$/, (m) => m.slice(0, -2));
  s = s.replace(/([^s])s$/, '$1');
  // Plural folding is the one reduction that must survive an over-strip. The
  // derivational pass below is aggressive, and when it leaves a stub the guard
  // used to revert to the RAW input — so `users` went user -> us -> back to
  // `users`, while `user` went user -> us -> back to `user`, and the two never
  // unified. A query for "users" therefore scored 0 against `loginUser`, and
  // `ask "where do users log in"` matched nothing at all.
  const folded = s;
  s = s.replace(/([^aeiou])ied$/, '$1y');                                       // classified -> classify
  s = s.replace(/(ization|izations)$/, 'ize');
  s = dropIfy(s);
  let suffix = null;
  const m = SUFFIX.exec(s);
  if (m) {
    const root = s.slice(0, -m[1].length);
    if (/^(ing|edly|ed)$/.test(m[1]) || root.length >= MIN_ROOT) { s = root; suffix = m[1]; }
  }
  // `registered` is `register` + ed, and `register` is `regist` + er: peel the -er too.
  if (suffix && /^(ing|edly|ed)$/.test(suffix) && s.length - 2 >= MIN_ROOT && s.endsWith('er')) s = s.slice(0, -2);
  if (suffix) s = dropIfy(s);                                                   // classifying -> classify -> class
  if (suffix && s.length > 3 && /([bcdfghjkmnpqrtvwx])\1$/.test(s)) s = s.slice(0, -1);   // mapping -> map
  // Base and inflected forms meet with the `e` off (`parse`/`parsing` -> `pars`) — except
  // that a stem ending in a lone `s` is eaten by the plural rule when it is stemmed again
  // (`pars` -> `par`). Those keep the `e` (`parse`), and the inflected form gets it back.
  if (s.length > 3 && /[^aeiou]e$/.test(s) && !/[^s]se$/.test(s)) s = s.slice(0, -1);
  if (suffix && INFLECTION.has(suffix) && /[^s]s$/.test(s) && !/[^aeiou]us$/.test(s)) s += 'e';
  if (s.length >= 3) return s;
  return folded.length >= 3 ? folded : w;
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

// Module-doc prose is indexed as a `# module: ...` pseudo-signature (index-only,
// see src/retrieval/module-doc.js). Per token it is a weaker relevance signal
// than a real signature — descriptive rather than definitional — so it is scored
// as its own BM25F field rather than pooled with the code terms.
const MODULE_DOC_RE = /^#\s*(module|docs):/;

// Line anchors are metadata, not content, and this ranker is documented as
// anchor-invariant. The previous strip was end-anchored, so it only fired when
// the anchor was the last thing on the line — but extractors append a doc hint
// AFTER it ("... :27-59  # Compute a normalized centrality score"). 27% of
// signatures therefore leaked their line numbers into the term space as tokens
// like "27" and "59": 840 junk terms, inflating document length for exactly the
// well-documented files, which BM25 then penalised via length normalisation.
const ANCHOR_RE = /\s*:\d+(?:-\d+)?(?=\s|$)/g;

function stripAnchor(line) {
  return String(line).replace(ANCHOR_RE, '');
}
// Tuned on the 30-task leak-free corpus. The 0.5-0.8 band is flat
// (hit@5 63.3-66.7%, easy MRR steady at 0.825); adjacent values swing by up to
// 6.7pp, which at 30 tasks is literally two tasks — noise, not signal. 0.6 is
// chosen from the middle of that band rather than at its peak, because a
// per-token weight below 1 is the principled position (prose is descriptive,
// a signature is definitional) and picking the argmax of a 30-task sweep is
// how you overfit a benchmark.
const DOC_WEIGHT = 0.6;

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
 * With a repo-mined map (B2, #649 — `{ token: [[neighbor, w], …] }` from
 * mined-expansions.js), mined neighbors join at EXPANSION_WEIGHT × w. The
 * ordering invariant: original (1) > static (EXPANSION_WEIGHT) ≥ mined
 * (EXPANSION_WEIGHT × w, w ≤ 1), and an existing entry is never overridden.
 * Without the second argument, behavior is byte-identical to before.
 *
 * @param {string[]} qToks  stemmed, de-duplicated query tokens
 * @param {object} [mined]  mined expansions: token → [[neighbor, weight], …]
 * @returns {Map<string, number>}
 */
function expandQuery(qToks, mined) {
  const weights = new Map();
  for (const t of qToks) weights.set(t, 1);
  for (const t of qToks) {
    const syns = EXPANSIONS.get(t);
    if (!syns) continue;
    for (const s of syns) if (!weights.has(s)) weights.set(s, EXPANSION_WEIGHT);
  }
  if (mined && typeof mined === 'object') {
    for (const t of qToks) {
      const neighbors = mined[t];
      if (!Array.isArray(neighbors)) continue;
      for (const pair of neighbors) {
        const s = pair && pair[0];
        const w = pair && pair[1];
        if (typeof s !== 'string' || typeof w !== 'number') continue;
        if (!weights.has(s)) weights.set(s, Math.min(EXPANSION_WEIGHT, EXPANSION_WEIGHT * w));
      }
    }
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
function bm25rank(query, candidates, opts) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const k1 = 1.5;
  const b = 0.75;

  const docWeight = (opts && typeof opts.docWeight === 'number') ? opts.docWeight : DOC_WEIGHT;

  const docs = candidates.map((c) => {
    const pathToks = tokenize(c.file || '');
    // Ranking is anchor-invariant: `:start-end` line anchors are metadata,
    // not content — strip them before tokenizing so adding anchors to an
    // extractor never shifts BM25 length normalization or token counts.
    // BM25F-style fields. Module-doc prose and code signatures are different
    // kinds of evidence and must not share one term-frequency pool: prose is
    // ~30% of all indexed tokens, and a short file with a long header (few
    // signatures, lots of description) otherwise wins unrelated queries purely
    // through length normalisation.
    const docLines = [];
    const codeLines = [];
    for (const line of (c.sigs || [])) (MODULE_DOC_RE.test(line) ? docLines : codeLines).push(line);
    // TRIED AND REJECTED: splitting the declared symbol NAME into its own
    // weighted BM25F field, on the IR prior that a name is a "title" and params
    // are "body". Swept 1.0-4.0. hit@5 on the mined corpus rose 60.9% -> 65.2%,
    // which is a single task crossing the rank-5 line — over 113 combined tasks
    // hit@1 fell 52.2% -> 51.3%, hit@3 fell 66.4% -> 65.5%, hit@10 was identical
    // and MRR dropped. It moves correct answers DOWN and happens to nudge one
    // past a cutoff. A hit@5-only view would have shipped this.
    const codeToks = tokenize(codeLines.map((x) => stripAnchor(x)).join(' '));
    const docToks = tokenize(docLines.join(' '));
    const tf = new Map();
    const addField = (toks, weight) => { for (const t of toks) tf.set(t, (tf.get(t) || 0) + weight); };
    addField(codeToks, 1);
    addField(pathToks, PATH_BOOST);
    addField(docToks, docWeight);
    // Length accumulates with the SAME weights, or a field's influence leaks
    // back in through the normalisation term.
    const len = codeToks.length + (PATH_BOOST * pathToks.length) + (docWeight * docToks.length);
    return { cand: c, tf, len };
  });

  const N = docs.length || 1;
  const avgdl = docs.reduce((s, d) => s + d.len, 0) / N || 1;

  const df = new Map();
  for (const d of docs) {
    for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  }

  const qToks = [...new Set(tokenize(query))];
  // token → weight (1 exact, <1 synonym); opts.expansions carries the opt-in
  // repo-mined map (B2) from callers that enabled retrieval.minedExpansions.
  const qWeights = expandQuery(qToks, opts && opts.expansions);

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

module.exports = { tokenize, stem, bm25rank, PATH_BOOST, STOP, expandQuery, EXPANSIONS, EXPANSION_WEIGHT, DOC_WEIGHT, MODULE_DOC_RE, stripAnchor };
