'use strict';

/**
 * Body words (retrieval only, opt-in via retrieval.bodyWords): for each indexed file, the rare words of its source that its signature entry does not carry. Fed to BM25 in a field of their own (weight and length: BODY_WEIGHT and BODY_LENGTH in bm25.js) so a question in the words a file's body uses can reach a file whose signatures never say them. Zero-dependency, deterministic, bundle-safe.
 *
 * A signature map keeps a file's shape — names, parameters — and drops what the
 * body says. A person asking how something works describes it in the words the
 * code uses to do it (`revalidated`, `retrying`, `tls`), and those live in the
 * body, so the question and the right file share no token and the file scores
 * zero. On the labelled third-party corpus that was the largest single class of
 * miss, and nearly all of it held a rare word of the question in its source.
 *
 * Only RARE words are kept: a word held by most files (`import`, `value`) cannot
 * tell the answer apart and would only lengthen every document. Like the module
 * header prose this is added to the RANKING only — never to a generated context
 * file or to anything rendered into a prompt.
 */

const fs = require('fs');
const path = require('path');
const { tokenize } = require('./tokenizer');
const { scan } = require('../security/scanner');

// 2: a word is never taken from a line the secret scanner flags, nor is a long word that holds a digit (#943).
const SCHEMA_VERSION = 2;
const CACHE_FILE = 'body-words.json';

// A word is rare when no more than this share of the indexed files hold it (and never
// fewer than one file, so a word that appears in a single file always qualifies).
const DISTINCTIVE_SHARE = 0.05;
// The most words one file contributes. A sweep of this and the share above, measured on
// every benchmark corpus, was flat from about 200 up; below 100 it began to lose gains.
const PER_FILE = 200;
const MIN_WORD_LENGTH = 3;
// A word this long that holds a digit is a key, a hash or an identifier no question is written in
// (an AWS access key id is 20 characters). The scanner's patterns are tried first; this is for
// whatever they do not name.
const OPAQUE_WORD_LENGTH = 20;
// A whole-file scan skips files over this size, as the grep baseline does.
const MAX_SOURCE_BYTES = 1024 * 1024;

// Words that frame a question rather than name its topic. A file holds some of them
// whatever it is about, and in a small repository one file can hold one alone — which
// would make `how` a rare word. They are never body words, and the benchmark
// vocabulary evidence leaves them out of a question for the same reason.
const FRAMING_WORDS = new Set((
  'how what when where which who whom whose why does did do can could would should will shall may might must whether '
  + 'there their them they these those then than such each other only same any all both some more most very also '
  + 'been being have has had was were are is be not but and for the you your its it our we can cannot'
).split(/\s+/));

/**
 * The lines of a source with every line the secret scanner flags blanked.
 *
 * Body words are the rare words of raw source, and a rare word is exactly what a credential is, so
 * unlike a signature they must pass the scanner too: a cache that held `akiaiosfodnn7example` would
 * carry the key's id into a file that is not the source and is not redacted.
 */
function _safeLines(source, file) {
  const lines = source.split('\n');
  try {
    const { safe, redacted } = scan(lines, file);
    if (!redacted) return lines;
    return lines.map((l, i) => (safe[i] === l ? l : ''));
  } catch (_) {
    return [];
  }
}

/** Words of one file's source, with the number of its lines that hold each. */
function _lineFrequency(source, file) {
  const freq = new Map();
  for (const line of _safeLines(source, file)) {
    if (!line) continue;
    for (const w of tokenize(line)) {
      if (w.length >= OPAQUE_WORD_LENGTH && /\d/.test(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return freq;
}

/**
 * The body words of every file of an index.
 *
 * A word qualifies for a file when it is in the file's source, is not already in the
 * file's index entry (its path and signatures), is held by no more than `share` of the
 * files, is at least three characters, is not a number and is not a framing word. A
 * file keeps its `perFile` best, ordered by how many of its lines hold the word and
 * then alphabetically, so the result never depends on iteration order.
 *
 * @param {Map<string, string[]>} index file -> signature lines
 * @param {(file: string) => (string|null)} readSource a file's text, or null when it cannot be read
 * @param {{ share?: number, perFile?: number }} [opts]
 * @returns {Map<string, string>} file -> its words, space-separated; a file with none is absent
 */
function buildBodyWords(index, readSource, opts) {
  const share = opts && typeof opts.share === 'number' ? opts.share : DISTINCTIVE_SHARE;
  const perFile = opts && Number.isInteger(opts.perFile) && opts.perFile > 0 ? opts.perFile : PER_FILE;
  const out = new Map();
  if (!(index instanceof Map) || index.size === 0) return out;

  // Pass 1: how many files hold each word.
  const df = new Map();
  let files = 0;
  const readable = [];
  for (const file of index.keys()) {
    let source = null;
    try { source = readSource(file); } catch (_) { source = null; }
    if (typeof source !== 'string') continue;
    files++;
    readable.push(file);
    for (const w of new Set(tokenize(source))) df.set(w, (df.get(w) || 0) + 1);
  }
  const cap = Math.max(1, Math.floor(share * files));

  // Pass 2: each file's qualifying words, best first.
  for (const file of readable) {
    let source = null;
    try { source = readSource(file); } catch (_) { source = null; }
    if (typeof source !== 'string') continue;
    const have = new Set(tokenize(`${file}\n${(index.get(file) || []).join('\n')}`));
    const picks = [];
    for (const [w, lines] of _lineFrequency(source, file)) {
      if (w.length < MIN_WORD_LENGTH || have.has(w) || FRAMING_WORDS.has(w) || /^\d+$/.test(w)) continue;
      if ((df.get(w) || 0) > cap) continue;
      picks.push([w, lines]);
    }
    if (picks.length === 0) continue;
    picks.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    out.set(file, picks.slice(0, perFile).map(([w]) => w).join(' '));
  }
  return out;
}

/** A file's text under `cwd`, or null when it cannot be read or is too large for a whole-file scan. */
function _readUnder(cwd, file) {
  try {
    const abs = path.join(cwd, file);
    if (fs.statSync(abs).size > MAX_SOURCE_BYTES) return null;
    return fs.readFileSync(abs, 'utf8');
  } catch (_) {
    return null;
  }
}

/**
 * The body words of the files of `index`, read under `cwd`, with nothing written: for a benchmark
 * that scores a pinned checkout and must leave it untouched.
 *
 * @param {string} cwd
 * @param {Map<string, string[]>} index
 * @returns {Map<string, string>}
 */
function buildFor(cwd, index) {
  return buildBodyWords(index, (file) => _readUnder(cwd, file));
}

/**
 * The body words of a repository, from the cache in `.context/body-words.json` when it is
 * current, otherwise built from its index and written back. The cache is keyed by the mtime
 * of the complete index (`.context/sig-index.json`), which every `generate` rewrites, and by
 * the parameters it was built with. It is deliberately NOT keyed by the newest file in
 * `.context/`: `ask` rewrites `query-context.md` on every call, and rebuilding means reading
 * every source file. Without a complete index there is nothing to key by, so nothing is cached.
 *
 * Never throws: with no index or no readable source it returns an empty Map, and the ranker
 * then behaves exactly as it does without the signal.
 *
 * @param {string} cwd
 * @param {Map<string, string[]>} [index] the caller's signature index, to avoid building it twice
 * @returns {Map<string, string>}
 */
function loadOrBuild(cwd, index) {
  try { cwd = fs.realpathSync(cwd); } catch (_) { /* keep the path as given */ }
  const cachePath = path.join(cwd, '.context', CACHE_FILE);
  let stamp = 0;
  try { stamp = fs.statSync(require('./sig-index-store').indexPath(cwd)).mtimeMs; } catch (_) { /* no complete index */ }
  try {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (cached.schema === SCHEMA_VERSION && cached.builtFor === stamp && cached.share === DISTINCTIVE_SHARE
        && cached.perFile === PER_FILE && cached.words && typeof cached.words === 'object') {
      return new Map(Object.entries(cached.words));
    }
  } catch (_) { /* absent, stale or unreadable: rebuild */ }

  let built = new Map();
  try {
    built = buildFor(cwd, index instanceof Map ? index : require('./ranker').buildSigIndex(cwd));
  } catch (_) { built = new Map(); }

  if (!stamp) return built;
  try {
    // Sorted so the same repository always writes the same bytes.
    const words = {};
    for (const file of [...built.keys()].sort()) words[file] = built.get(file);
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify({
      schema: SCHEMA_VERSION, builtFor: stamp, share: DISTINCTIVE_SHARE, perFile: PER_FILE, files: built.size, words,
    }), 'utf8');
  } catch (_) { /* a cache that cannot be written is only slower */ }
  return built;
}

module.exports = { buildBodyWords, buildFor, loadOrBuild, DISTINCTIVE_SHARE, PER_FILE, MIN_WORD_LENGTH, OPAQUE_WORD_LENGTH, MAX_SOURCE_BYTES, FRAMING_WORDS, SCHEMA_VERSION, CACHE_FILE };
