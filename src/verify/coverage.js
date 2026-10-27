'use strict';

/**
 * What a `verify` run checked, what it could not, and whether the index it read
 * can be trusted (#989, #1007).
 *
 * `verify` is a name-level linter: it looks up the files, imports, backticked
 * calls and npm scripts an answer mentions in the repo and its index. A clean
 * verdict from it is a statement about THOSE claims, and only when the index it
 * read is there and current. Three states used to read the same as "all clear":
 *
 *   - no index        → the symbol check did not run at all (#1007)
 *   - a stale index   → symbols that were deleted or renamed since still resolve
 *   - nothing to check → an answer that names nothing checkable is an empty
 *                         check, not a clean answer
 *
 * This module is the one place that wording and the exit-code rule live, so the
 * CLI, the MCP tool and the HTML report cannot drift into three phrasings.
 *
 * Exit codes of `sigmap verify`: 0 clean · 1 issues found · 2 usage error ·
 * 3 nothing was found but the index is missing or stale, so that is not an
 * all-clear.
 *
 * Zero dependencies, deterministic, filesystem-only.
 */

// Claim classes verify never reads, whatever the repo looks like. Kept as data
// so the README, the docs and the output can be tested against the same list.
const NOT_CHECKED = [
  'calls in fenced or raw code',
  'member calls (obj.method())',
  'library APIs (named imports from, and members of, installed libraries)',
];

const CLASS_LABELS = {
  files: ['file path', 'file paths'],
  imports: ['import', 'imports'],
  symbols: ['backticked call', 'backticked calls'],
  scripts: ['npm script', 'npm scripts'],
};

/**
 * Whether the index verify reads is there and current.
 *
 * @param {string} cwd
 * @param {object} summary a `verify()` summary
 * @param {object} [config] loaded sigmap config (reads `srcDirs`, `exclude`)
 * @returns {{ state: 'ok'|'missing'|'stale', symbolsRan?: boolean, warning: string|null }}
 */
function indexState(cwd, summary, config) {
  if (summary && summary.checks && summary.checks.symbols === false) {
    return { state: 'missing', symbolsRan: false, warning: 'no symbol index, so function names were not checked — run `sigmap` to build it, then verify again' };
  }
  // Installed libraries can make the symbol check run with none of the repo's own symbols
  // in it: a library call checks out, while a call to the repo's own function is flagged.
  if (summary && summary.repoSymbolsIndexed === 0) {
    return { state: 'missing', symbolsRan: true, warning: 'no repo index, so calls were checked against installed libraries only and the repo\'s own functions are not recognised — run `sigmap` to build it, then verify again' };
  }
  try {
    const cs = require('../judge/context-source');
    const file = cs.resolveContextFile(cwd);
    if (!file) return { state: 'ok', warning: null };
    // verify reads through the index, which the live overlay keeps current (#926)
    const warning = cs.stalenessWarning(
      cs.contextStaleness(file, cwd, config || {}, { honorOverlay: true }),
      { tail: cs.STALE_TAILS.verify }
    );
    if (warning) return { state: 'stale', warning };
  } catch (_) { /* freshness is advisory: never fail a verdict over its own check */ }
  return { state: 'ok', warning: null };
}

/**
 * The coverage of one run, as plain data (it goes into `--json` too).
 *
 * @param {object} summary a `verify()` summary
 * @param {{ state: string }} index from `indexState`
 * @returns {{ claims: object, checked: string[], notChecked: string[], index: string, vacuous: boolean }}
 */
function coverageOf(summary, index) {
  const checks = (summary && summary.checks) || {};
  const claims = (summary && summary.claims) || { files: 0, imports: 0, symbols: 0, scripts: 0, total: 0 };
  const checked = ['file paths', 'imports'];
  const notChecked = [];
  if (checks.symbols) checked.push('backticked calls');
  else notChecked.push('backticked calls (no symbol index)');
  if (checks.scripts) checked.push('npm scripts');
  notChecked.push(...NOT_CHECKED);
  return {
    claims,
    checked,
    notChecked,
    index: (index && index.state) || 'ok',
    vacuous: claims.total === 0,
  };
}

/**
 * The exit code a run earns: a finding is 1 whatever the index; a run with no
 * finding is 0 only when its index can be relied on.
 */
function exitCodeFor(summary, coverage) {
  if (summary.total > 0) return 1;
  return coverage.index === 'ok' ? 0 : 3;
}

/** "7 claims — 2 file paths · 3 imports · 1 backticked call", classes with none left out. */
function claimsLine(coverage) {
  const c = coverage.claims;
  if (!c.total) return 'checked 0 claims';
  const parts = Object.keys(CLASS_LABELS)
    .filter((k) => c[k] > 0)
    .map((k) => `${c[k]} ${CLASS_LABELS[k][c[k] === 1 ? 0 : 1]}`);
  return `checked ${c.total} claim${c.total === 1 ? '' : 's'} — ${parts.join(' · ')}`;
}

/** The two detail lines every report carries: what was checked, what was not. */
function detailLines(coverage) {
  return [claimsLine(coverage), `not checked: ${coverage.notChecked.join(' · ')}`];
}

/**
 * Per-library footer lines for the installed libraries a run read (#990).
 * A library with no readable names is said to be unread, never "grounded against".
 */
function libraryLines(libraries) {
  return (libraries || []).map((l) => {
    const pin = l.version ? `${l.name}@${l.version}` : l.name;
    if (!l.symbols) return `${pin}: no readable types — library imports not checked`;
    return `${pin}: ${l.symbols} name${l.symbols === 1 ? '' : 's'} indexed`;
  });
}

module.exports = { NOT_CHECKED, indexState, coverageOf, exitCodeFor, claimsLine, detailLines, libraryLines };
