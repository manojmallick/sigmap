'use strict';

const fs = require('fs');
const path = require('path');
const { tokenize, EXPANSIONS, stripAnchor } = require('./bm25');

/**
 * Repo-mined query expansion (B2, #649).
 *
 * The static `EXPANSION_GROUPS` table is a global prior; this module mines a
 * per-repo one: tokens that co-occur within the same file's path + signature
 * vocabulary become weighted expansion candidates ("auth" ↔ "session" in a
 * repo whose auth files actually say session). Deterministic — same index in,
 * byte-identical JSON out — cached in `.context/` and regenerated with the
 * map. SigMap's answer to embeddings: learned from the repo, provable,
 * diffable. Consumption is opt-in via `retrieval.minedExpansions` and
 * measure-gated (`npm run benchmark:mined-expansions`).
 */

// Keys are stems, so a cache written by a different stemmer matches nothing: bump
// this whenever `stem()` changes (2: inflection-aware stemmer, #875).
const SCHEMA_VERSION = 2;
const CACHE_FILE = 'mined-expansions.json';

// Precision filters. A token present in most files discriminates nothing
// (df ceiling); one seen in a single file has no co-occurrence evidence
// (df floor); a pair must repeat across files to count as a repo convention
// rather than a coincidence; and each token keeps only its strongest few
// neighbors so expansion never floods the query.
const MIN_DF = 2;
const MAX_DF_RATIO = 0.25;
const MIN_COOC = 2;
const TOP_K = 4;

/**
 * Mine per-repo expansion candidates from a signature index.
 * @param {Map<string, string[]>} sigIndex  file → signature lines
 * @returns {{ schema: number, files: number, expansions: Object<string, Array<[string, number]>> }}
 */
function mineExpansions(sigIndex) {
  const out = { schema: SCHEMA_VERSION, files: 0, expansions: {} };
  if (!(sigIndex instanceof Map) || sigIndex.size === 0) return out;

  // Per-file deduped token sets over path + anchor-stripped signatures.
  const fileSets = [];
  for (const [file, sigs] of sigIndex.entries()) {
    const toks = new Set(tokenize(
      String(file) + ' ' + (sigs || []).map((s) => stripAnchor(String(s))).join(' ')
    ));
    if (toks.size > 0) fileSets.push(toks);
  }
  out.files = fileSets.length;
  const N = fileSets.length;
  if (N < MIN_DF) return out;

  const df = new Map();
  for (const set of fileSets) {
    for (const t of set) df.set(t, (df.get(t) || 0) + 1);
  }
  const maxDf = Math.max(MIN_DF, Math.floor(N * MAX_DF_RATIO));
  const eligible = new Set([...df.keys()].filter((t) => df.get(t) >= MIN_DF && df.get(t) <= maxDf));

  // Pairwise co-occurrence over eligible tokens only.
  const cooc = new Map(); // "a|b" (a < b) → count
  for (const set of fileSets) {
    const toks = [...set].filter((t) => eligible.has(t)).sort();
    for (let i = 0; i < toks.length; i++) {
      for (let j = i + 1; j < toks.length; j++) {
        const key = `${toks[i]}|${toks[j]}`;
        cooc.set(key, (cooc.get(key) || 0) + 1);
      }
    }
  }

  // token → [neighbor, conditional probability] candidates.
  const perToken = new Map();
  const add = (a, b, count) => {
    // Pairs the static table already covers are excluded — the curated weight
    // applies there, and mining must not double-count it.
    const staticSyns = EXPANSIONS.get(a);
    if (staticSyns && staticSyns.has(b)) return;
    const w = Math.round((count / df.get(a)) * 1000) / 1000;
    if (!perToken.has(a)) perToken.set(a, []);
    perToken.get(a).push([b, w]);
  };
  for (const [key, count] of cooc.entries()) {
    if (count < MIN_COOC) continue;
    const [a, b] = key.split('|');
    add(a, b, count);
    add(b, a, count);
  }

  for (const tok of [...perToken.keys()].sort()) {
    const list = perToken.get(tok)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, TOP_K);
    out.expansions[tok] = list;
  }
  return out;
}

/** Canonical rendering: stable key order comes from mineExpansions itself. */
function canonicalJson(mined) {
  return JSON.stringify(mined, null, 1);
}

/**
 * Load the mined map from `.context/` (keyed by newest context mtime, the
 * knowledge-map cache pattern) or mine it fresh from the repo's signature
 * index and persist it.
 * @param {string} cwd
 * @returns {{ schema: number, files: number, expansions: object }}
 */
function loadOrMine(cwd) {
  try { cwd = fs.realpathSync(cwd); } catch (_) {}
  const cachePath = path.join(cwd, '.context', CACHE_FILE);
  let ctxMtime = 0;
  try {
    for (const f of fs.readdirSync(path.join(cwd, '.context'))) {
      if (f === CACHE_FILE) continue;
      const st = fs.statSync(path.join(cwd, '.context', f));
      if (st.mtimeMs > ctxMtime) ctxMtime = st.mtimeMs;
    }
  } catch (_) {}
  try {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (cached.schema === SCHEMA_VERSION && cached.builtFor === ctxMtime) return cached;
  } catch (_) {}
  let mined;
  try {
    const { buildSigIndex } = require('./ranker');
    mined = mineExpansions(buildSigIndex(cwd));
  } catch (_) {
    mined = { schema: SCHEMA_VERSION, files: 0, expansions: {} };
  }
  mined.builtFor = ctxMtime;
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, canonicalJson(mined));
  } catch (_) {}
  return mined;
}

module.exports = { mineExpansions, loadOrMine, canonicalJson, SCHEMA_VERSION, MIN_DF, MAX_DF_RATIO, MIN_COOC, TOP_K };
