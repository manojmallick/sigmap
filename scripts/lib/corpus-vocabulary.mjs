#!/usr/bin/env node
'use strict';

/**
 * corpus-vocabulary.mjs — the words behind a retrieval miss, read from a checkout (#674).
 *
 * attribution.mjs classifies a miss from token sets it is handed; this builds
 * those sets from a repository, with the ranker's own tokenizer so "shares a
 * word" means what it means to the ranker (stemmed, camelCase split). Shared by
 * the retrieval gate, the xrepo gate and the honest benchmark's autopsy, so the
 * three cannot disagree about what counts as a word the answer holds.
 *
 * Impure (it reads files); the classification stays in attribution.mjs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { tokenize } = require(path.join(CODE_ROOT, 'src/retrieval/bm25'));

/**
 * Words that frame a question rather than name its topic: the lever's own list
 * (src/retrieval/body-words.js), so the evidence and the signal cannot disagree about what
 * is a topic word. The ranker keeps them (BM25 weighs each by how rare it is); the evidence
 * leaves them out, because a file holds some of them whatever it is about and "how appears
 * in the answer" would count as evidence the answer was findable when it is none.
 */
export const QUESTION_WORDS = require(path.join(CODE_ROOT, 'src/retrieval/body-words')).FRAMING_WORDS;

/** A whole-file scan skips files over this size, as the grep baseline does. */
export const MAX_SOURCE_BYTES = 1024 * 1024;

/** A file's text, or null when it cannot be read or is too large for a whole-file scan. */
export function readSource(dir, file) {
  try {
    const abs = path.join(dir, file);
    if (fs.statSync(abs).size > MAX_SOURCE_BYTES) return null;
    return fs.readFileSync(abs, 'utf8');
  } catch (_) {
    return null;
  }
}

/**
 * How many of the indexed files hold each word. A word every file holds cannot
 * tell the answer apart, so it is no evidence that the answer was findable.
 *
 * @param {Map<string,string[]>} index
 * @param {string} dir the repository the index describes
 * @returns {{docFreq: Map<string,number>, docCount: number}}
 */
export function docStats(index, dir) {
  const docFreq = new Map();
  let docCount = 0;
  for (const file of index.keys()) {
    const source = readSource(dir, file);
    if (source === null) continue;
    docCount++;
    for (const t of new Set(tokenize(source))) docFreq.set(t, (docFreq.get(t) || 0) + 1);
  }
  return { docFreq, docCount };
}

/**
 * The question's tokens, each with what to print for it, minus the words that only
 * frame it (QUESTION_WORDS). A word that is one token prints as the word; one that
 * splits (camelCase, MySQL) prints as its tokens, so every entry is one thing with one
 * frequency.
 *
 * @returns {Array<{term:string, word:string}>}
 */
export function queryTermsOf(query) {
  return String(query).split(/[^A-Za-z0-9]+/).filter((w) => w && !QUESTION_WORDS.has(w.toLowerCase())).flatMap((w) => {
    const tokens = tokenize(w);
    return tokens.map((term) => ({ term, word: tokens.length === 1 ? w.toLowerCase() : term }));
  });
}

/**
 * Tokens of one file's index entry (its path and signatures) and of its source.
 *
 * @param {Map<string,string[]>} index
 * @param {string} dir
 * @returns {(file:string)=>({index:Set<string>, source:Set<string>}|null)}
 */
export function termsOf(index, dir) {
  return (file) => {
    const source = readSource(dir, file);
    if (source === null) return null;
    return { index: new Set(tokenize(`${file}\n${(index.get(file) || []).join('\n')}`)), source: new Set(tokenize(source)) };
  };
}
