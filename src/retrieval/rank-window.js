'use strict';

/**
 * What the ranker reads of a file's signatures (#982).
 *
 * The retrieval index holds up to `maxIndexSigsPerFile` (200) signatures of a file, for the
 * tools that look a symbol up (`verify`, `explain`, `get_callee_signatures`). The RANKER
 * reads the leading `maxSigsPerFile` (25), as it always did: scoring the rest was measured
 * on the third-party gate and lost more tasks than it won (74 -> 72 of 108 locally; gin and
 * serilog gained one each, phoenix, plenary, libuv and spdlog lost one each), so retrieval is
 * left exactly as it was. Everything that feeds the ranker from the index reads this view:
 * `rank` itself, the body words (which exclude the words an entry already carries) and the
 * mined expansions.
 *
 * Zero-dependency, bundle-safe.
 */

const { MODULE_DOC_RE } = require('./bm25');

/**
 * How many signatures of a file the ranker reads: an explicit option, else the project's
 * `maxSigsPerFile`, else 25.
 *
 * @param {{rankSigsPerFile?: number, cwd?: string}} [opts]
 * @returns {number}
 */
function rankWindow(opts) {
  if (opts && Number.isFinite(opts.rankSigsPerFile)) return opts.rankSigsPerFile;
  if (opts && opts.cwd) {
    try { return require('../cache/entry').entryConfig(opts.cwd).maxSigsPerFile; } catch (_) { /* default */ }
  }
  return 25;
}

/**
 * The index as the ranker reads it: for each file its module-doc lines and its first
 * `limit` other lines. A file with no more than that keeps the very array it had, and an
 * index nothing is cut from comes back as the same Map.
 *
 * @param {Map<string,string[]>} sigIndex
 * @param {number} limit
 * @returns {Map<string,string[]>}
 */
function rankingView(sigIndex, limit) {
  let out = null;
  for (const [file, sigs] of sigIndex) {
    if (!Array.isArray(sigs) || sigs.length <= limit) continue;
    let code = 0;
    const kept = [];
    for (const line of sigs) {
      if (MODULE_DOC_RE.test(line)) kept.push(line);
      else if (code < limit) { kept.push(line); code++; }
    }
    if (kept.length === sigs.length) continue;
    if (!out) out = new Map(sigIndex);
    out.set(file, kept);
  }
  return out || sigIndex;
}

module.exports = { rankWindow, rankingView };
