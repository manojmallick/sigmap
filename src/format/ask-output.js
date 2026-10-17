'use strict';

/**
 * Default `sigmap ask` output (#966, from #879): the answer first, then as little
 * metadata as it takes to audit it.
 *
 * `ask` used to print a 12-line box and nothing else on stdout — intent, context
 * size, cutoff, hash, selection, coverage, risk, cost and a footnote — while the
 * files it ranked lived only in `.context/query-context.md`. The first thing a
 * reader met was metadata, none of it the answer, and `Risk: HIGH (19 file(s)
 * changed vs HEAD)` on an ordinary dirty working tree.
 *
 * The default is now the ranked files, one summary line carrying what makes a
 * result reproducible (count, cutoff, tokens, hash, where the context was
 * written) and — only when there is something to act on — one more line.
 * `--verbose` keeps the whole box, which the CLI core still prints; `--json` is
 * untouched.
 *
 * Pure formatting: the CLI core hands over figures it already computed for the
 * box and for `--json`, so nothing here can disagree with either. Zero dependencies.
 */

/** NONE / LOW / MEDIUM / HIGH for a count of changed files — the scale `ask` uses for every `Risk` figure. */
function riskLevel(count) {
  return count === 0 ? 'NONE' : count <= 3 ? 'LOW' : count <= 10 ? 'MEDIUM' : 'HIGH';
}

/** A score rounded exactly as `--json` rounds it, so a row and `cutoffScore` compare as equals. */
function roundScore(score) {
  return Number.isFinite(score) ? Math.round(score * 1000) / 1000 : null;
}

const num = (n) => n.toLocaleString('en-US');

/**
 * The ranked files, one per line: rank, path, score, and the tokens of its signatures.
 *
 * @param {Array<{file:string, score:number, tokens?:number}>} ranked
 * @returns {string[]}
 */
function formatRankedList(ranked) {
  const rows = (ranked || []).map((r, i) => ({
    n: String(i + 1),
    file: String(r.file),
    score: roundScore(r.score),
    tokens: typeof r.tokens === 'number' ? num(r.tokens) : null,
  }));
  if (rows.length === 0) return [];
  const scoreOf = (r) => (r.score === null ? '-' : r.score.toFixed(3));
  // A loop, not `Math.max(...rows.map(...))`: spreading a very large `--top` overflows the call stack.
  const widest = (len) => rows.reduce((w, r) => Math.max(w, len(r)), 0);
  const nW = widest((r) => r.n.length);
  const fW = widest((r) => r.file.length);
  const sW = widest((r) => scoreOf(r).length);
  const tW = widest((r) => (r.tokens === null ? 0 : r.tokens.length));
  return rows.map((r) => {
    const tok = r.tokens === null ? '' : `  ${r.tokens.padStart(tW)} tok`;
    return `${r.n.padStart(nW)}  ${r.file.padEnd(fW)}  ${scoreOf(r).padStart(sW)}${tok}`.trimEnd();
  });
}

/**
 * The line every default run prints after the list. It keeps what #775 made
 * auditable — how many files, where the cut fell, a hash of what was written —
 * and says where the signatures are.
 *
 * @param {{ selected:number, indexed:number, cutoff:number|null, tokens:number, hash:string, contextPath:string }} s
 * @returns {string}
 */
function formatSummary(s) {
  const parts = [
    `${s.selected} of ${s.indexed} files`,
    Number.isFinite(s.cutoff) ? `cutoff ${s.cutoff.toFixed(3)}` : null,
    `${num(s.tokens)} tokens`,
    s.hash,
  ].filter(Boolean);
  return `${parts.join(' · ')} → ${s.contextPath}`;
}

/**
 * What `--with-source` did, or null when it was not asked for. A request that put
 * nothing in is reported, never dropped: the reader asked for bodies.
 *
 * @param {object|null} section  the `--with-source` report, or null when it failed
 * @param {boolean} requested    whether `--with-source` was passed
 * @returns {string|null}
 */
function formatSourceStatus(section, requested) {
  if (section && section.included > 0) {
    const omitted = section.truncated ? `; ${section.skipped} omitted (over budget)` : '';
    return `source: ${section.included} of ${section.candidates} top symbol(s), ` +
      `${num(section.spentTokens)} of ${num(section.budgetTokens)} budget token(s)${omitted}`;
  }
  if (requested) {
    const budget = section ? num(section.budgetTokens) : '0';
    return `source: none included — no anchored symbol fit the ${budget}-token budget ` +
      '(raise maxTokens or pass --source-budget <n>)';
  }
  return null;
}

/**
 * The `Risk` a reader can act on: the selected files that differ from HEAD. The
 * whole-tree figure (`--verbose`) says how much is in flight; this says whether
 * the answer is standing on code that is mid-edit.
 *
 * @param {number} selected  how many files were selected
 * @param {number} changed   how many of them are changed vs HEAD
 * @returns {{ level:string, changed:number, selected:number }|null}  null when none is
 */
function selectionRisk(selected, changed) {
  return changed > 0 ? { level: riskLevel(changed), changed, selected } : null;
}

/** What an empty selection says when nothing in the query matched. */
const NO_MATCH_HINT = 'no file matched — try other wording, or --explain to see which tokens matched';

/**
 * The optional second line: only what the reader can act on, joined by " · ".
 *
 * @param {{ empty?:string|null, notes?:string[], source?:string|null, risk?:{level:string,changed:number,selected:number}|null }} h
 *        `empty` is the message for an empty selection (NO_MATCH_HINT, or a more exact one such
 *        as "nothing changed since <ref>" when a filter, not the query, emptied it)
 * @returns {string|null}  null when there is nothing to say
 */
function formatHeadsUp(h) {
  const items = [];
  if (h.empty) items.push(h.empty);
  if (h.notes && h.notes.length > 0) items.push(`notes: ${h.notes.length} matching (${h.notes.join(' / ')})`);
  if (h.source) items.push(h.source);
  if (h.risk) items.push(`risk: ${h.risk.level} (${h.risk.changed} of ${h.risk.selected} selected file(s) changed vs HEAD)`);
  return items.length > 0 ? items.join(' · ') : null;
}

module.exports = { NO_MATCH_HINT, riskLevel, roundScore, formatRankedList, formatSummary, formatSourceStatus, selectionRisk, formatHeadsUp };
