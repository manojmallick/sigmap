'use strict';

/**
 * Context-file resolution and freshness for `sigmap judge` (#780).
 *
 * Two gaps this closes. First, `--context` was mandatory, so the most common
 * case — judge an answer against the context this repo just generated — still
 * meant typing the adapter's output path. Second, nothing ever compared that
 * file's age against the sources it describes, so an answer could be judged
 * against a context generated weeks and hundreds of commits ago with no hint
 * that the ground had moved.
 *
 * Zero dependencies, deterministic, filesystem-only.
 */

const fs = require('fs');
const path = require('path');

/**
 * Generated context files, in the order `judge` prefers them. Mirrors the list
 * `sigmap doctor` checks, so both commands agree on what "the repo's generated
 * context" means.
 */
const ADAPTER_OUTPUTS = [
  ['.github', 'copilot-instructions.md'],
  ['CLAUDE.md'],
  ['AGENTS.md'],
  ['.cursorrules'],
  ['.windsurfrules'],
  ['.github', 'openai-context.md'],
  ['.github', 'gemini-context.md'],
  ['llm-full.txt'],
  ['llm.txt'],
];

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '__pycache__',
  '.next', 'coverage', 'target', 'vendor', '.context',
]);

/**
 * The repo's generated context file, or null when none has been generated.
 *
 * @param {string} cwd
 * @returns {string|null} absolute path
 */
function resolveContextFile(cwd) {
  for (const parts of ADAPTER_OUTPUTS) {
    const p = path.join(cwd, ...parts);
    try { if (fs.statSync(p).isFile()) return p; } catch (_) {}
  }
  return null;
}

/**
 * Newest source file under `srcDirs`, by mtime.
 *
 * @returns {{ file: string, mtimeMs: number }|null}
 */
function _newestSource(cwd, srcDirs, config) {
  const { CODE_EXTS } = require('../analysis/coverage-score');
  const exclude = new Set(EXCLUDE_DIRS);
  if (config && Array.isArray(config.exclude)) for (const x of config.exclude) exclude.add(String(x));

  let newest = null;
  let seen = 0;
  const walk = (dir, depth) => {
    if (depth > 8 || seen > 5000) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (exclude.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (e.isFile() && CODE_EXTS.has(path.extname(e.name).toLowerCase())) {
        seen++;
        try {
          const m = fs.statSync(full).mtimeMs;
          if (!newest || m > newest.mtimeMs) newest = { file: full, mtimeMs: m };
        } catch (_) {}
      }
    }
  };
  for (const d of srcDirs || []) {
    const abs = path.isAbsolute(d) ? d : path.join(cwd, d);
    if (fs.existsSync(abs)) walk(abs, 0);
  }
  return newest;
}

/**
 * Whether a context file is older than the sources it describes.
 *
 * @param {string} contextFile absolute path to the context file
 * @param {string} cwd
 * @param {object} [config] loaded sigmap config (reads `srcDirs`, `exclude`)
 * @returns {{ stale: boolean, ageHours: number, newest: string }|null} null when
 *   freshness cannot be established (unreadable context, no source files found)
 */
function contextStaleness(contextFile, cwd, config) {
  let ctxMtime;
  try { ctxMtime = fs.statSync(contextFile).mtimeMs; } catch (_) { return null; }

  const srcDirs = (config && Array.isArray(config.srcDirs) && config.srcDirs.length)
    ? config.srcDirs
    : ['src', 'lib', 'app'];
  const newest = _newestSource(cwd, srcDirs, config);
  if (!newest) return null;

  const gapMs = newest.mtimeMs - ctxMtime;
  return {
    stale: gapMs > 0,
    gapMs: Math.max(0, Math.round(gapMs)),
    ageHours: Math.round((gapMs / 3600000) * 10) / 10,
    newest: path.relative(cwd, newest.file) || newest.file,
  };
}

/** Largest sensible unit for a gap, so a sub-hour drift never prints "0 hour(s)". */
function _formatGap(ms) {
  const minutes = ms / 60000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} minute(s)`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours * 10) / 10} hour(s)`;
  return `${Math.round((hours / 24) * 10) / 10} day(s)`;
}

/**
 * Human one-liner for a stale context, or null when it is fresh.
 *
 * `ask` and the MCP read tools answer from the same possibly-stale ground as
 * `judge` and used to say nothing about it (#815). They share this function
 * rather than growing a second definition of "stale": the threshold (any
 * positive gap) and the gap wording are fixed here, and only the consequence
 * clause varies by surface — what a stale index does to a verdict is not what
 * it does to a ranking.
 *
 * @param {{stale:boolean, gapMs:number, newest:string}|null} staleness
 * @param {{ tail?: string }} [opts] consequence clause; defaults to `judge`'s.
 */
function stalenessWarning(staleness, opts = {}) {
  if (!staleness || !staleness.stale) return null;
  const tail = opts.tail || 'the answer is being judged against stale ground';
  return `context is ${_formatGap(staleness.gapMs)} older than ${staleness.newest} — ${tail}`;
}

/**
 * Consequence clauses for the surfaces that share the warning above, so the
 * CLI and the MCP server cannot drift into two phrasings of one condition.
 */
const STALE_TAILS = {
  judge: 'the answer is being judged against stale ground',
  ask:   'this answer is ranked against stale ground; re-run `sigmap` to refresh the index',
  mcp:   'this result is ranked against stale ground; re-run `sigmap` to refresh the index',
};

module.exports = { resolveContextFile, contextStaleness, stalenessWarning, STALE_TAILS, ADAPTER_OUTPUTS };
