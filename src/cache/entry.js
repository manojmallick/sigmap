'use strict';

/**
 * The index form of one file's signatures — the stages every writer shares (#926).
 *
 * A full `generate`, the watcher's per-file patch, the read-time `freshen` and the
 * MCP notify hooks all put a file's signatures into the index. They used to
 * disagree: the hooks and `freshen` stored the raw extraction, so an edit that
 * went through them replaced a redacted base entry with one carrying the secret,
 * and dropped the module-doc line. Now the stages live here, once:
 *
 *   extract → cap at maxSigsPerFile → redact secrets → module-doc line / terse
 *
 * The CLI core's `detectAndExtract` stays the extractor for generate and the
 * watcher (it owns the opt-in exactness tiers and the generic fallback); the
 * stages after extraction are these.
 *
 * Zero-dependency, bundle-safe.
 */

const fs = require('fs');
const path = require('path');

/**
 * Redact secrets from a file's signatures. Fails CLOSED: a scanner that cannot
 * run throws, and the caller records nothing rather than storing a raw entry.
 *
 * @param {string[]} sigs
 * @param {string} filePath
 * @param {{secretScan?: boolean}} config
 * @returns {{ sigs: string[], redacted: boolean }}
 */
function redactSecrets(sigs, filePath, config) {
  if (!config || !config.secretScan) return { sigs, redacted: false };
  const { scan } = require('../security/scanner');
  const result = scan(sigs, filePath);
  return { sigs: result.safe, redacted: !!result.redacted };
}

/**
 * The file as the retrieval index stores it: a leading module-doc line (the
 * file's stated purpose, which is the vocabulary a behavioural query uses) and,
 * with `terse`, the compact encoding. Index-only — the prompt artifact is
 * token-budgeted, the index is not.
 *
 * @param {string} filePath
 * @param {string} content
 * @param {string[]} sigs
 * @param {{terse?: boolean}} config
 * @returns {string[]}
 */
function indexSigsFor(filePath, content, sigs, config) {
  let out = sigs;
  try {
    // TRIED AND REJECTED: also indexing every per-symbol doc sentence
    // untruncated (src/retrieval/doc-text.js). 39% of extractor doc hints are
    // cut at 60 chars, so recovering them looked like free vocabulary. It is
    // not: train hit@5 fell 75.6% -> 73.3% at every docWeight from 0.2 to 1.0,
    // and the mined corpus never moved off 62.5%. The MODULE HEADER is the
    // high-signal prose — it states the file's purpose. Per-symbol sentences
    // describe internal helpers, so they broaden what each file matches
    // without making any file a better answer.
    const { moduleDocSig } = require('../retrieval/module-doc');
    const doc = moduleDocSig(content, filePath);
    // The header is prose lifted from the file, so it is scanned like a signature:
    // a key pasted into a header comment must not reach the index. A scanner that
    // cannot run throws into the catch below and the line is simply omitted.
    if (doc) out = [redactSecrets([doc], filePath, config).sigs[0], ...sigs];
  } catch (_) { /* enrichment is best-effort */ }
  if (config && config.terse) {
    try {
      const { encodeTerseSigs } = require('../format/terse');
      out = encodeTerseSigs(sigs);
    } catch (_) { /* terse unavailable → index full signatures */ }
  }
  return out;
}

/**
 * The few settings the stages above read, from the project's own config file
 * over the shipped defaults. Reading the raw file (not the full loader) keeps
 * this cheap enough for a hook that runs on every agent write.
 *
 * @param {string} cwd
 * @returns {{ secretScan: boolean, terse: boolean, maxSigsPerFile: number }}
 */
function entryConfig(cwd) {
  const { DEFAULTS } = require('../config/defaults');
  let raw = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(cwd, 'gen-context.config.json'), 'utf8'));
    if (parsed && typeof parsed === 'object') raw = parsed;
  } catch (_) { /* no project config → shipped defaults */ }
  // A local `extends` supplies the base. A URL is not followed here: a hook that
  // runs on every agent write never goes to the network.
  if (typeof raw.extends === 'string' && !/^https?:\/\//.test(raw.extends)) {
    try { raw = Object.assign({}, require('../config/loader').loadBaseConfig(raw.extends, cwd), raw); } catch (_) { /* unreadable base → own keys only */ }
  }
  const pick = (k) => (raw[k] !== undefined ? raw[k] : DEFAULTS[k]);
  return {
    secretScan: !!pick('secretScan'),
    terse: !!pick('terse'),
    maxSigsPerFile: Number.isFinite(pick('maxSigsPerFile')) ? pick('maxSigsPerFile') : 25,
  };
}

/**
 * A file's signatures as the index would hold them, for writers that live in
 * `src/` (freshen, the notify hooks) and so extract through the dispatch table.
 *
 * @param {string} filePath - absolute
 * @param {string} content
 * @param {string} cwd
 * @param {object} [config] - from entryConfig(cwd)
 * @returns {string[]} empty when the file yields no signatures
 */
function entrySigs(filePath, content, cwd, config) {
  const cfg = config || entryConfig(cwd);
  const { extractFile, langFor } = require('../extractors/dispatch');
  let sigs = extractFile(filePath, content);
  // A full run's generic tier indexes files the dispatch table has no extractor
  // for (.zig, templates, ...). Without the same fallback an entry written here
  // would be empty for them, and "empty" must never mean "remove".
  if (sigs.length === 0 && !langFor(filePath)) {
    try { sigs = require('../extractors/generic').extract(content, filePath) || []; } catch (_) { sigs = []; }
  }
  sigs = sigs.slice(0, cfg.maxSigsPerFile);
  if (sigs.length === 0) return [];
  sigs = redactSecrets(sigs, filePath, cfg).sigs;
  return indexSigsFor(filePath, content, sigs, cfg);
}

module.exports = { redactSecrets, indexSigsFor, entryConfig, entrySigs };
