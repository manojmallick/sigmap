'use strict';

/**
 * Honesty checks on an `ask` selection (#806).
 *
 * `ask` printed `Coverage : 100%` and `Risk : NONE` over a result set holding a
 * test file, a README and a CI workflow. Neither reading was a lie on its own —
 * the coverage figure counts "of the source files under srcDirs, how many are
 * indexed", and the risk figure counts changed files in the working tree — but
 * printed bare, side by side, directly under the answer, they read as "this
 * answer is trustworthy". Same class as #762 (unlabelled coverage) and #764
 * (unmeasured rendered as measured).
 *
 * This module owns the one question those two numbers never asked: did the
 * selection actually contain any implementation? A query that returns only
 * tests, docs, CI and config has missed, and that is a signal the user can act
 * on — unlike a coverage percentage about a different population entirely.
 *
 * Zero dependencies, pure, deterministic.
 */

const path = require('path');
const { isTestFile, isMockFile, isGeneratedFile, isDocsFile, isCiFile } = require('../util/file-class');
const { CODE_EXTS } = require('../analysis/coverage-score');

/**
 * Configuration and data files, by extension or by the `*.config.*` convention.
 * Deliberately narrower than `src/util/file-class.js`'s categories: those cover
 * the classes the ranker demotes, and config is not one of them — it is indexed
 * at full weight because "where is the build configured" is a real question.
 */
const CONFIG_EXTS = new Set(['.json', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.properties', '.lock', '.env']);

/** True when a selected path is configuration rather than implementation. */
function isConfigPath(filePath) {
  const p = String(filePath).replace(/\\/g, '/');
  const base = p.slice(p.lastIndexOf('/') + 1);
  if (/\.config\.[a-z]+$/i.test(base)) return true;
  return CONFIG_EXTS.has(path.extname(base).toLowerCase());
}

/** Prose that is not under a docs/ root and carries no well-known doc name. */
function isProsePath(filePath) {
  return /\.(md|mdx|rst|txt|adoc)$/i.test(String(filePath));
}

/**
 * Split a selection into the implementation files an answer can be grounded in
 * and the support files it cannot.
 *
 * "Support" is not a complaint — a CI workflow is the right answer to a CI
 * question. It becomes a signal only when it is ALL that came back.
 *
 * @param {Array<{file:string}>|string[]} selected
 * @returns {{ source: string[], support: string[], sourceFree: boolean, total: number }}
 */
function classifySelection(selected) {
  const files = (selected || []).map((r) => (typeof r === 'string' ? r : r && r.file)).filter(Boolean);
  const source = [];
  const support = [];
  for (const f of files) {
    const isSupport =
      isTestFile(f) || isMockFile(f) || isGeneratedFile(f) ||
      isDocsFile(f) || isCiFile(f) || isConfigPath(f) || isProsePath(f);
    const isCode = CODE_EXTS.has(path.extname(String(f)).toLowerCase());
    if (isCode && !isSupport) source.push(f);
    else support.push(f);
  }
  return { source, support, sourceFree: files.length > 0 && source.length === 0, total: files.length };
}

/**
 * The composition of a selection, named — `3 source, 2 support (test, docs)`.
 * Printed next to the figures it qualifies so a reader can see at a glance what
 * the answer is standing on.
 */
function formatComposition(classification) {
  const c = classification;
  if (!c || c.total === 0) return 'no files selected';
  const kinds = [];
  for (const f of c.support) {
    const kind = isTestFile(f) || isMockFile(f) ? 'test'
      : isCiFile(f) ? 'ci'
      : isDocsFile(f) || isProsePath(f) ? 'docs'
      : isGeneratedFile(f) ? 'generated'
      : 'config';
    if (!kinds.includes(kind)) kinds.push(kind);
  }
  const support = c.support.length > 0 ? `, ${c.support.length} support (${kinds.join(', ')})` : '';
  return `${c.source.length} source${support}`;
}

/**
 * Warning for a selection with no implementation in it, or null when at least
 * one source file came back.
 */
function selectionWarning(classification) {
  const c = classification;
  if (!c || !c.sourceFree) return null;
  return `no source file in the selection — ${formatComposition(c)}; the query likely missed. `
    + `Re-run with --explain to see which tokens matched, or raise --top`;
}

module.exports = { classifySelection, selectionWarning, formatComposition, isConfigPath, CONFIG_EXTS };
