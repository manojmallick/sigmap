'use strict';

/**
 * Convention fix list (IMPL.md §4 — `conventions --fix`).
 *
 * The complete, actionable rename checklist: every scoped source file whose
 * name doesn't match the dominant file-naming convention, with full from→to
 * paths. Distinct from `--conflicts` (a diagnostic summary with up to 3 example
 * basenames) — `--fix` lists *every* offending file with its real path, ready
 * to paste into a task or PR. Pure, zero-dependency, bundle-safe.
 */

const path = require('path');
const { classifyNaming } = require('./extract');
const { toNamingStyle } = require('./conflicts');

const JS_TS_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const PY_EXTS = new Set(['.py']);
const SCOPED_EXTS = new Set([...JS_TS_EXTS, ...PY_EXTS]);

const TEST_RE = /\.(test|spec)\.[jt]sx?$|(^|\/)test_|_test\.py$/;

/** Rename a file path's basename to the target naming style (keep dir + ext). */
function _renamePath(relPath, style) {
  const dir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/') + 1) : '';
  const base = relPath.includes('/') ? relPath.slice(relPath.lastIndexOf('/') + 1) : relPath;
  const dot = base.indexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  return `${dir}${toNamingStyle(stem, style)}${ext}`;
}

/**
 * Build the exhaustive rename checklist for the dominant file-naming convention.
 * @param {string} cwd repo root (for relative paths)
 * @param {string[]} files absolute source paths (e.g. from buildFileList)
 * @param {object} conventions an `extractConventions` result (for the dominant style)
 * @returns {{ dominant: string|null, renames: Array<{from:string,to:string,fromStyle:string}>, count: number }}
 */
function buildFixList(cwd, files, conventions) {
  const dominant = conventions && conventions.fileNaming && conventions.fileNaming.dominant;
  if (!dominant) return { dominant: null, renames: [], count: 0 };

  const renames = [];
  for (const f of files || []) {
    if (!SCOPED_EXTS.has(path.extname(f).toLowerCase())) continue;
    if (TEST_RE.test(f)) continue;
    const base = path.basename(f);
    const style = classifyNaming(base);
    if (style === 'other' || style === dominant) continue;
    const rel = path.relative(cwd, f).replace(/\\/g, '/');
    renames.push({ from: rel, to: _renamePath(rel, dominant), fromStyle: style });
  }
  renames.sort((a, b) => a.from.localeCompare(b.from));
  return { dominant, renames, count: renames.length };
}

module.exports = { buildFixList };
