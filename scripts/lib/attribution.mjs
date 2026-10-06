#!/usr/bin/env node
'use strict';

/**
 * attribution.mjs — why a retrieval task misses, as exactly one class (#674).
 *
 * A hit rate says how many tasks miss, not WHY, and the why decides the remedy:
 * a file that is not indexed needs detection or an extractor, a file the path
 * penalty buries needs a classifier, a file that shares no word with the
 * question needs a way across the vocabulary, and only a file ranked below the
 * top 5 on its merits needs ranking work — the kind that trades one split
 * against another. Pure, like the rest of the gate libraries: the caller hands
 * over the ranker's complete result, so every class can be tested with fake
 * lists. Shared by the xrepo gate and the retrieval gate.
 */

/** First 1-based rank at which a ranked list reaches an expected file, or null. */
export function rankOf(ranked, expected) {
  const i = (ranked || []).findIndex((f) => (expected || []).includes(f));
  return i === -1 ? null : i + 1;
}

/** Where a ranked miss sits relative to the top 5. */
export function bucketOf(rank) {
  return rank <= 10 ? '6-10' : rank <= 20 ? '11-20' : rank <= 50 ? '21-50' : 'beyond 50';
}

/**
 * Why a task is or is not a hit, as exactly one class.
 *
 *   hit         an expected file is in the top 5
 *   unindexed   no expected file is in the zero-config index, so the task is
 *               unreachable — detection skipped it or the extractor emitted nothing
 *   no-overlap  an expected file IS indexed but the ranker never returned it:
 *               it shares no token with the question, so it scores zero
 *   penalty     ranked below the top 5, and inside it were the path penalty
 *               undone — the classifier lost it, not the question
 *   ranking     ranked below the top 5 on its merits; `bucket` is how far down
 *
 * The penalty counterfactual divides the penalty out of the final score and
 * re-sorts with the ranker's own tie-break (score, then path). Every other
 * signal is held fixed, so it answers "would this file have made the top 5 had
 * it not been demoted for its path" and nothing more.
 *
 * @param {object} i
 * @param {Array<{file:string, score:number, penalty?:number}>} i.ranked the ranker's complete result, best first
 * @param {string[]} i.expected the task's expected files
 * @param {Set<string>} i.indexed files in the index
 * @returns {{cls:'hit'|'unindexed'|'no-overlap'|'penalty'|'ranking', rank:number|null, bucket?:string, penalty?:number, withoutPenalty?:number}}
 */
export function attribute({ ranked, expected, indexed }) {
  const files = ranked.map((r) => r.file);
  const rank = rankOf(files, expected);
  if (rank !== null && rank <= 5) return { cls: 'hit', rank };
  if (!expected.some((f) => indexed.has(f))) return { cls: 'unindexed', rank: null };
  if (rank === null) return { cls: 'no-overlap', rank: null };

  const penalty = typeof ranked[rank - 1].penalty === 'number' ? ranked[rank - 1].penalty : 1;
  if (penalty < 1) {
    const undone = ranked
      .map((r) => ({ file: r.file, score: r.penalty > 0 ? r.score / r.penalty : r.score }))
      .sort((a, b) => (b.score - a.score) || (a.file < b.file ? -1 : 1));
    const without = rankOf(undone.map((r) => r.file), expected);
    if (without !== null && without <= 5) return { cls: 'penalty', rank, penalty, withoutPenalty: without };
  }
  return { cls: 'ranking', rank, bucket: bucketOf(rank) };
}

/** The label a class is reported under; a ranked miss is reported by distance. */
export function whyLabel(a) {
  switch (a.cls) {
    case 'unindexed': return 'answer not indexed';
    case 'penalty': return 'demoted by a path penalty';
    case 'no-overlap': return 'no token in common with the question';
    case 'ranking': return `ranked ${a.bucket}`;
    default: return 'hit';
  }
}

export const WHY_ORDER = [
  'answer not indexed', 'demoted by a path penalty', 'no token in common with the question',
  'ranked 6-10', 'ranked 11-20', 'ranked 21-50', 'ranked beyond 50',
];

/**
 * Counts per label, in a fixed order, so two runs print comparable tables.
 * Every miss lands in exactly one row: the rows sum to `misses`.
 */
export function summarizeWhy(attributions) {
  const counts = new Map(WHY_ORDER.map((l) => [l, 0]));
  let hits = 0;
  for (const a of attributions) {
    if (a.cls === 'hit') { hits++; continue; }
    const l = whyLabel(a);
    counts.set(l, (counts.get(l) || 0) + 1);
  }
  return { tasks: attributions.length, hits, misses: attributions.length - hits, rows: [...counts.entries()] };
}

/**
 * The tasks a lexical ranker can reach at all: the answer is indexed and shares a
 * word with the question. A task outside this set cannot be won by any
 * token-matching method, so the hit rate over the set is the figure that moves
 * when the ranker improves; the hit rate over every task also moves when the
 * corpus does.
 *
 * @returns {{tasks:number, reachable:number, hits:number}}
 */
export function reachable(attributions) {
  const reach = attributions.filter((a) => a.cls !== 'unindexed' && a.cls !== 'no-overlap');
  return { tasks: attributions.length, reachable: reach.length, hits: reach.filter((a) => a.cls === 'hit').length };
}


// ── Vocabulary (the words of a miss) ─────────────────────────────────────────
//
// `attribute()` says a task misses; this says whether the answer's OWN words
// could have served the question. It takes token sets, not text, so the caller
// tokenises with the ranker's tokenizer and this stays pure.

/** A word shared with the answer is distinctive when no more than this share of the files hold it. */
export const DISTINCTIVE_SHARE = 0.05;

/**
 * Where each significant word of the question is, for one answer file.
 *
 *   indexed  the word is in the file's index entry (its path or signatures)
 *   source   the word is in the file's source but not in its index entry — the
 *            vocabulary a whole-file scan sees and a signature index does not
 *   absent   the word is nowhere in the file — a paraphrase, which no lexical
 *            method reaches, grep included
 *
 * A word in the source is only worth anything when it tells the file apart:
 * `import`, `not` and `use` are in nearly every file and would never let a scan
 * find this one. So each source word carries its document frequency, and the
 * ones held by no more than `distinctiveShare` of the files are `distinctive`.
 *
 * @param {object} i
 * @param {Array<string|{term:string, word:string}>} i.queryTerms the question's tokens; `word` is what to print
 * @param {Set<string>} i.indexTerms tokens of the file's path and index entry
 * @param {Set<string>} i.sourceTerms tokens of the file's source
 * @param {Map<string,number>} [i.docFreq] files holding each token; without it every source word counts as distinctive
 * @param {number} [i.docCount] files the frequencies are over
 * @param {number} [i.distinctiveShare]
 * @returns {{indexed:string[], source:string[], distinctive:string[], common:string[], absent:string[], df:Object<string,number>}}
 */
export function vocabularyGap({ queryTerms, indexTerms, sourceTerms, docFreq, docCount, distinctiveShare = DISTINCTIVE_SHARE }) {
  const cap = docFreq && docCount ? Math.max(1, Math.floor(distinctiveShare * docCount)) : Infinity;
  const seen = new Set();
  const gap = { indexed: [], source: [], distinctive: [], common: [], absent: [], df: {} };
  for (const q of queryTerms) {
    const term = typeof q === 'string' ? q : q.term;
    const word = typeof q === 'string' ? q : q.word;
    if (seen.has(term)) continue;
    seen.add(term);
    if (indexTerms.has(term)) gap.indexed.push(word);
    else if (sourceTerms.has(term)) {
      const df = docFreq ? (docFreq.get(term) || 0) : 0;
      gap.source.push(word);
      gap.df[word] = df;
      (df <= cap ? gap.distinctive : gap.common).push(word);
    } else gap.absent.push(word);
  }
  return gap;
}

/**
 * The one class a gap falls in, ordered by how much a body-vocabulary lever
 * could do about it: a word the index already holds makes this a ranking
 * matter, a distinctive word only the source holds is vocabulary the index
 * lacks, words common to every file cannot tell this one apart, and no word at
 * all is a paraphrase.
 *
 * @returns {'in-index'|'distinctive'|'common-only'|'nowhere'}
 */
export function gapClass(gap) {
  if (gap.indexed.length) return 'in-index';
  if (gap.distinctive.length) return 'distinctive';
  if (gap.source.length) return 'common-only';
  return 'nowhere';
}

export const GAP_LABELS = {
  'in-index': 'a word of the question is in its index entry',
  'distinctive': 'a distinctive word is only in its source',
  'common-only': 'only common words are in its source',
  'nowhere': 'no word of the question anywhere in the file',
};

/**
 * Attribute every task of a corpus, with the vocabulary evidence for each miss
 * whose answer is indexed. Everything that touches a ranker or a file arrives as
 * a function, so this stays pure and a test can hand it fakes.
 *
 * @param {object} i
 * @param {Array<{id:string, query:string, expected:string[]}>} i.tasks
 * @param {Set<string>} i.indexed files in the index
 * @param {(query:string)=>Array<{file:string, score:number, penalty?:number}>} i.rankFull the ranker's complete result, best first
 * @param {(query:string)=>Array<string|{term:string, word:string}>} i.queryTerms the question's tokens
 * @param {(file:string)=>({index:Set<string>, source:Set<string>}|null)} i.termsOf tokens of a file's index entry and of its source; null when unreadable
 * @param {Map<string,number>} [i.docFreq] files holding each token
 * @param {number} [i.docCount] files the frequencies are over
 * @returns {Array<object>} one `attribute()` result per task, plus `file`, `gap` and `gapClass` on a miss whose answer is indexed
 */
export function attributeTasks({ tasks, indexed, rankFull, queryTerms, termsOf, docFreq, docCount }) {
  return tasks.map((t) => {
    const ranked = rankFull(t.query);
    const a = attribute({ ranked, expected: t.expected, indexed });
    const out = { id: t.id, query: t.query, expected: t.expected, ...a };
    if (a.cls === 'hit' || a.cls === 'unindexed') return out;
    // The answer the ranker came closest to; when it returned none, the first one that is indexed.
    const file = a.rank !== null ? ranked[a.rank - 1].file : t.expected.find((f) => indexed.has(f));
    const terms = file && termsOf(file);
    if (!terms) return out;
    out.file = file;
    out.gap = vocabularyGap({ queryTerms: queryTerms(t.query), indexTerms: terms.index, sourceTerms: terms.source, docFreq, docCount });
    out.gapClass = gapClass(out.gap);
    return out;
  });
}

/** One line of evidence: the words by where they are, at most `max` of each. */
export function formatGap(gap, max = 5) {
  const cut = (list) => `${list.slice(0, max).join(', ')}${list.length > max ? ', …' : ''}`;
  const withDf = (list) => cut(list.map((w) => `${w}(${gap.df[w]})`));
  const part = (label, list, fmt = cut) => (list.length ? `${label}: ${fmt(list)}` : null);
  return [
    part('in index', gap.indexed),
    part('distinctive in source only', gap.distinctive, withDf),
    part('common in source only', gap.common, withDf),
    part('absent', gap.absent),
  ].filter(Boolean).join(' · ') || 'the question has no significant word';
}
