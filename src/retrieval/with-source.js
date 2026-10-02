'use strict';

/**
 * `ask --with-source` — give back the bodies, not the files (#814).
 *
 * The map saves tokens by emitting signatures. An agent that then needs the
 * body opens the whole file, which is the exact cost the map exists to avoid:
 * the saving is real at the map level and partly handed back at the agent
 * level. The `:start-end` anchors every extractor already emits are enough to
 * close that loop — slice the top symbols' lines instead of the files holding
 * them, and add the blast radius so the agent sees what else a change there
 * touches without a second query.
 *
 * Strictly opt-in: anything that adds tokens must be asked for. Budgeted
 * against the project's single `maxTokens` knob rather than a second one, and
 * truncation is disclosed — a silently clipped body is worse than no body.
 *
 * Zero dependencies, deterministic (ordered by rank, never by filesystem).
 */

const fs = require('fs');
const path = require('path');

/** Token estimate; same chars/4 heuristic as the CLI's `estimateTokens`. */
const estimateTokens = (s) => Math.ceil(String(s).length / 4);

/**
 * Declaration heads whose body is not worth a budget slot.
 *
 * A module's export list is already in the signature section verbatim, so
 * slicing its line back out spends budget to repeat what the agent has — and
 * it competes for the same per-file slots as the functions being exported.
 */
const NON_BODY_HEAD = /^(module\.exports|export\s+(default\s+)?\{|exports\.)/;

const DEFAULT_MAX_PER_FILE = 3;
const DEFAULT_MAX_SYMBOLS = 12;
const DEFAULT_BLAST_FILES = 5;
/** A body longer than this is a module, not a symbol — pointer only. */
const MAX_SYMBOL_LINES = 120;

/**
 * Parse a signature's trailing `:start-end` line anchor.
 *
 * @param {string} sig
 * @returns {{ head: string, start: number, end: number }|null} null when the
 *   signature carries no anchor (an indented member, or a non-code section).
 */
function parseAnchor(sig) {
  if (typeof sig !== 'string') return null;
  const m = sig.match(/\s*:(\d+)-(\d+)(?:\s*#.*)?\s*$/);
  if (!m) return null;
  const start = parseInt(m[1], 10);
  const end = parseInt(m[2], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return { head: sig.slice(0, m.index).trim(), start, end };
}

/**
 * The anchored symbols worth slicing, in rank order.
 *
 * Breadth before depth: up to `maxPerFile` symbols from each file, files walked
 * in rank order. One file's long member list cannot eat the whole budget, which
 * is what a flat "top N anchors" ordering would do.
 *
 * @param {Array<{file:string, sigs:string[]}>} ranked
 * @param {{ maxPerFile?:number, maxSymbols?:number }} [opts]
 * @returns {Array<{ file:string, head:string, start:number, end:number }>}
 */
function collectSymbols(ranked, opts = {}) {
  const maxPerFile = opts.maxPerFile || DEFAULT_MAX_PER_FILE;
  const maxSymbols = opts.maxSymbols || DEFAULT_MAX_SYMBOLS;
  const out = [];
  for (const entry of ranked || []) {
    if (!entry || !Array.isArray(entry.sigs)) continue;
    let taken = 0;
    for (const sig of entry.sigs) {
      if (taken >= maxPerFile) break;
      const a = parseAnchor(sig);
      if (!a) continue;
      if (NON_BODY_HEAD.test(a.head)) continue;
      if (a.end - a.start + 1 > MAX_SYMBOL_LINES) continue;
      out.push({ file: entry.file, head: a.head, start: a.start, end: a.end });
      taken++;
    }
    if (out.length >= maxSymbols) break;
  }
  return out.slice(0, maxSymbols);
}

/**
 * Read one symbol's lines, clamped to the file and secret-scanned with the same
 * redactor `get_lines` and the signature pipeline use.
 *
 * @returns {{ lines:string[], from:number, to:number }|null} null when the file
 *   is unreadable or the anchor points past its end.
 */
function sliceSymbol(cwd, sym) {
  const abs = path.resolve(cwd, sym.file);
  const root = path.resolve(cwd);
  // Sandbox, matching `get_lines`: a ranked path is repo-relative by
  // construction, but the index is a file on disk and may be hand-edited.
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  let all;
  try { all = fs.readFileSync(abs, 'utf8').split('\n'); } catch (_) { return null; }
  const from = Math.max(1, sym.start);
  const to = Math.min(all.length, sym.end);
  if (from > all.length) return null;
  let lines = all.slice(from - 1, to);
  try {
    const { scan } = require('../security/scanner');
    lines = scan(lines, sym.file).safe;
  } catch (_) {} // non-fatal: a missing scanner must not drop the body
  return { lines, from, to };
}

/**
 * Blast radius for the files a source section covers — what else imports them.
 *
 * Reuses the same reverse-dependency walk as `--impact`, so `ask --with-source`
 * and `sigmap --impact <file>` cannot disagree about who depends on what.
 *
 * @returns {Array<{ file:string, direct:number, total:number }>}
 */
function blastRadius(cwd, files, opts = {}) {
  const limit = opts.limit || DEFAULT_BLAST_FILES;
  const targets = [...new Set(files || [])].slice(0, limit);
  if (targets.length === 0) return [];
  let rows;
  try {
    const { analyzeImpact } = require('../graph/impact');
    rows = analyzeImpact(targets, cwd, { depth: 2, srcDirs: opts.srcDirs, exclude: opts.exclude });
  } catch (_) { return []; }
  return rows.map(({ file, impact }) => ({
    file,
    direct: (impact && impact.direct ? impact.direct.length : 0),
    total: (impact && typeof impact.totalImpact === 'number' ? impact.totalImpact : 0),
  }));
}

/**
 * Render the `--with-source` addendum for a ranked selection.
 *
 * @param {Array<{file:string, sigs:string[]}>} ranked
 * @param {string} cwd
 * @param {object} [opts]
 * @param {number} [opts.budgetTokens=0] token ceiling for the bodies; 0 or less
 *   admits nothing and is reported as such rather than silently ignored.
 * @returns {{
 *   text: string, included: number, skipped: number, candidates: number,
 *   spentTokens: number, budgetTokens: number, truncated: boolean,
 *   blast: Array<{file:string, direct:number, total:number}>
 * }}
 */
function buildSourceSection(ranked, cwd, opts = {}) {
  const budgetTokens = Number.isFinite(opts.budgetTokens) ? opts.budgetTokens : 0;
  const symbols = collectSymbols(ranked, opts);
  const blocks = [];
  const covered = [];
  let spent = 0;
  let included = 0;

  for (const sym of symbols) {
    const slice = sliceSymbol(cwd, sym);
    if (!slice) continue;
    const block = [
      `### ${sym.file}:${slice.from}-${slice.to}${sym.head ? `  — ${sym.head}` : ''}`,
      '```',
      ...slice.lines,
      '```',
      '',
    ].join('\n');
    const cost = estimateTokens(block);
    // Budget is a ceiling, not a target: a body that does not fit is skipped
    // whole. Half a function is not a cheaper answer, it is a wrong one.
    if (spent + cost > budgetTokens) continue;
    blocks.push(block);
    if (!covered.includes(sym.file)) covered.push(sym.file);
    spent += cost;
    included++;
  }

  const blast = blastRadius(cwd, covered, opts);

  const skipped = symbols.length - included;
  const lines = [];
  if (blocks.length > 0) {
    lines.push('## Source (top symbols)', '');
    lines.push(...blocks);
  }
  if (blast.length > 0) {
    lines.push('## Blast radius', '```');
    for (const b of blast) {
      lines.push(`${b.file}  ← ${b.direct} direct, ${b.total} total dependent file(s)`);
    }
    lines.push('```', '');
  }
  if (skipped > 0) {
    // Disclosure, not a footnote: the agent must know the section is partial
    // before it concludes the listed symbols are all there are.
    lines.push(
      `> ${included} of ${symbols.length} top symbol(s) included — `
      + `${skipped} omitted to stay within the ${budgetTokens.toLocaleString()}-token source budget `
      + `(raise \`maxTokens\` or pass \`--source-budget <tokens>\`).`,
      ''
    );
  }

  return {
    text: lines.join('\n'),
    included,
    skipped,
    candidates: symbols.length,
    spentTokens: spent,
    budgetTokens,
    truncated: skipped > 0,
    blast,
  };
}

module.exports = {
  parseAnchor, collectSymbols, sliceSymbol, blastRadius, buildSourceSection,
  DEFAULT_MAX_PER_FILE, DEFAULT_MAX_SYMBOLS, DEFAULT_BLAST_FILES, MAX_SYMBOL_LINES, NON_BODY_HEAD,
};
