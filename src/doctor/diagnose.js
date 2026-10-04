'use strict';

/**
 * sigmap doctor (v8.0 E3).
 *
 * One-shot diagnostic for a SigMap setup: each check reports ok/warn/fail with
 * an actionable fix, so a cold user can reach a useful answer in minutes. Pure,
 * resilient (no check ever throws), zero new runtime deps. Composes the config
 * loader, coverage scorer, signature index, and the known adapter-output /
 * MCP-config paths.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Generated context files a `read_context`/`ask` flow can consume.
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

const ICON = { ok: '✓', warn: '⚠', fail: '✗' };

// Share of implementation outside srcDirs that turns the report into a warning.
// Below it, a couple of root entrypoints outside srcDirs is an ordinary layout.
const OUTSIDE_WARN_SHARE = 0.10;

function _short(p, cwd) {
  const rel = path.relative(cwd, p);
  return rel && !rel.startsWith('..') ? rel : p.replace(os.homedir(), '~');
}

function _contextFiles(cwd) {
  const out = [];
  for (const parts of ADAPTER_OUTPUTS) {
    const p = path.join(cwd, ...parts);
    try { if (fs.existsSync(p)) out.push(p); } catch (_) {}
  }
  return out;
}

function _mcpTargets(cwd) {
  return [
    path.join(cwd, '.mcp.json'),
    path.join(cwd, '.claude', 'settings.json'),
    path.join(cwd, '.cursor', 'mcp.json'),
    path.join(cwd, '.windsurf', 'mcp.json'),
    path.join(cwd, '.vscode', 'mcp.json'),
    path.join(cwd, 'opencode.json'),
    path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
    path.join(os.homedir(), '.config', 'opencode', 'config.json'),
    path.join(os.homedir(), '.gemini', 'settings.json'),
    path.join(os.homedir(), '.codex', 'config.yaml'),
    path.join(os.homedir(), '.config', 'zed', 'settings.json'),
  ];
}

/**
 * Count code files under srcDirs modified after the context was generated.
 * Delegates to the shared primitive so `status` counts the same population
 * against the same timestamp (#825).
 */
function _countChangedSince(cwd, srcDirs, config, ctxMtime) {
  const { changedSince } = require('../analysis/index-state');
  return changedSince(cwd, Object.assign({}, config, { srcDirs }), ctxMtime);
}

/**
 * Run all diagnostic checks.
 * @param {string} cwd
 * @returns {{ checks: Array<{id,label,status,detail,fix}>, ok: boolean, errors: number, warnings: number }}
 */
function diagnose(cwd, opts = {}) {
  const checks = [];
  const add = (id, label, status, detail, fix) => checks.push({ id, label, status, detail: detail || '', fix: fix || null });

  // 1. Git repository
  try {
    const { tryGit } = require('../util/git');
    const inside = tryGit(['rev-parse', '--is-inside-work-tree'], { cwd });
    if (inside === 'true') add('git', 'Git repository', 'ok', 'recency boost + impact analysis enabled');
    else add('git', 'Git repository', 'warn', 'not a git repository', 'git init — enables recency boost and impact analysis');
  } catch (_) {
    add('git', 'Git repository', 'warn', 'git not available', 'install git for recency boost + impact analysis');
  }

  // 2. Config & source roots
  let config = {};
  try {
    const cfgPath = path.join(cwd, 'gen-context.config.json');
    let configBroken = false;
    if (fs.existsSync(cfgPath)) {
      try { JSON.parse(fs.readFileSync(cfgPath, 'utf8')); }
      catch (e) {
        configBroken = true;
        add('config', 'Config & source roots', 'fail', `gen-context.config.json is invalid JSON: ${e.message}`, 'fix the JSON syntax, or delete the file to fall back to defaults');
      }
    }
    const { loadConfig } = require('../config/loader');
    config = loadConfig(cwd) || {};
    if (!configBroken) {
      // Distinguish explicitly-configured srcDirs (validate each) from the
      // default candidate list (just report which ones actually exist).
      let explicitSrcDirs = null;
      if (fs.existsSync(cfgPath)) {
        try { const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); if (Array.isArray(raw.srcDirs)) explicitSrcDirs = raw.srcDirs; } catch (_) {}
      }
      const exists = (d) => { try { return fs.existsSync(path.isAbsolute(d) ? d : path.join(cwd, d)); } catch (_) { return false; } };
      const srcDirs = Array.isArray(config.srcDirs) ? config.srcDirs : [];
      const present = srcDirs.filter(exists);

      if (explicitSrcDirs) {
        const missing = explicitSrcDirs.filter((d) => !exists(d));
        if (missing.length) add('config', 'Config & source roots', 'warn', `configured srcDirs not found: ${missing.join(', ')}`, 'fix "srcDirs" in gen-context.config.json');
        else add('config', 'Config & source roots', 'ok', `srcDirs: ${explicitSrcDirs.join(', ')}`);
      } else if (present.length === 0) {
        add('config', 'Config & source roots', 'warn', 'no source directories found (looked for src/, app/, lib/, …)', 'create a src/ dir, set "srcDirs" in gen-context.config.json, or run: sigmap roots --fix');
      } else {
        add('config', 'Config & source roots', 'ok', `source roots: ${present.slice(0, 8).join(', ')}${present.length > 8 ? `, +${present.length - 8} more` : ''}`);
      }

      // #805: srcDirs can be confidently wrong. A coverage figure computed over
      // srcDirs cannot see a file the detector never selected, so a flat Go
      // layout reported a healthy-looking percentage while the codebase was
      // invisible. This check measures the population itself.
      try {
        const { outsideSrcDirs } = require('../analysis/coverage-score');
        const outside = outsideSrcDirs(cwd, config);
        const pct = Math.round(outside.share * 100);
        if (outside.total === 0) {
          add('srcdirs-coverage', 'Source files in scope', 'ok', 'every implementation file is under srcDirs');
        } else if (outside.share < OUTSIDE_WARN_SHARE) {
          // A few root-level entrypoints outside srcDirs is a normal layout,
          // so the count is reported without crying wolf.
          const exts = outside.byExt.slice(0, 3).map((e) => `${e.count}${e.ext}`).join(' ');
          add('srcdirs-coverage', 'Source files in scope', 'ok',
            `${outside.inScope} in scope · ${outside.total} outside (${pct}%) — ${exts} in ${outside.dirs.slice(0, 3).join(', ')}`);
        } else {
          const exts = outside.byExt.slice(0, 4).map((e) => `${e.count}${e.ext}`).join(' ');
          add('srcdirs-coverage', 'Source files in scope',
            'warn',
            `${outside.total} of ${outside.inScope + outside.total} implementation file(s) are OUTSIDE srcDirs (${pct}%) — ${exts} in ${outside.dirs.slice(0, 5).join(', ')}`,
            'run: sigmap roots --fix   or widen "srcDirs" in gen-context.config.json');
        }
      } catch (_) {}
    }
  } catch (e) {
    if (!checks.some((c) => c.id === 'config')) add('config', 'Config & source roots', 'warn', `could not load config: ${e.message}`);
  }

  // 3. Generated context file
  const ctxFiles = _contextFiles(cwd);
  if (ctxFiles.length === 0) {
    add('context', 'Generated context', 'fail', 'no context file found', 'run: npx sigmap   (generates the signature map)');
  } else {
    add('context', 'Generated context', 'ok', `${ctxFiles.length} file(s): ${ctxFiles.map((f) => _short(f, cwd)).join(', ')}`);
  }

  // 4. Signature index
  //
  // #825: this printed one bare total ("447 file(s) indexed") over a population
  // `generate` deliberately widens past srcDirs, so it read as coverage of the
  // source tree and never surfaced a genuinely stale entry. The classifier owns
  // the split; the three classes are reported as what they are.
  let indexSize = 0;
  let indexClass = null;
  try {
    const { buildSigIndex } = require('../retrieval/ranker');
    const sigIndex = buildSigIndex(cwd);
    indexSize = sigIndex.size;
    const { classifyIndexEntries } = require('../analysis/index-state');
    indexClass = classifyIndexEntries(cwd, sigIndex.keys(), config);
  } catch (_) {}
  if (indexSize === 0) {
    add('index', 'Signature index', ctxFiles.length === 0 ? 'fail' : 'warn', 'no signatures indexed', 'run: npx sigmap   then: sigmap ask "<query>"');
  } else if (!indexClass) {
    add('index', 'Signature index', 'ok', `${indexSize} file(s) indexed`);
  } else {
    const { formatAugmented, staleRemedies } = require('../analysis/index-state');
    const parts = [`${indexClass.inScope.length} in-scope file(s) indexed`];
    if (indexClass.augmented.length) parts.push(`${indexClass.augmented.length} beyond srcDirs (${formatAugmented(indexClass)})`);
    if (indexClass.stale) parts.push(`${indexClass.stale} stale`);
    const remedies = staleRemedies(indexClass);
    add('index', 'Signature index', indexClass.stale ? 'warn' : 'ok', parts.join(' · '), remedies.length ? remedies[0] : null);
  }

  // 5. Index freshness
  //
  // #825: the timestamp comes from the shared primitive, so `status` cannot
  // report "never" against the same index this calls up to date. An index
  // holding stale entries is not up to date either, whatever the mtimes say.
  try {
    if (ctxFiles.length) {
      const { indexFreshness } = require('../analysis/index-state');
      const fresh = indexFreshness(cwd);
      const sinceMs = fresh.ts ? Date.parse(fresh.ts) : NaN;
      const refMs = Number.isFinite(sinceMs)
        ? sinceMs
        : Math.max(...ctxFiles.map((f) => { try { return fs.statSync(f).mtimeMs; } catch (_) { return 0; } }));
      const srcDirs = (config && Array.isArray(config.srcDirs) && config.srcDirs.length) ? config.srcDirs : ['src', 'app', 'lib'];
      const changed = _countChangedSince(cwd, srcDirs, config, refMs);
      const from = fresh.source ? ` (from ${fresh.source})` : '';
      if (changed > 0) add('freshness', 'Index freshness', 'warn', `${changed} source file(s) changed since last generate${from}`, 'run: sigmap   (or: sigmap --watch to auto-refresh)');
      else if (indexClass && indexClass.stale) add('freshness', 'Index freshness', 'warn', `sources unchanged${from}, but the index holds ${indexClass.stale} stale entry/entries`, 'run: sigmap   (prunes deleted files), then: sigmap validate');
      else add('freshness', 'Index freshness', 'ok', `index is up to date with sources${from}`);
    }
  } catch (_) {}

  // 6. Coverage
  try {
    if (indexSize > 0) {
      // #762: this fed `coverageScore` the RETRIEVAL INDEX and then printed
      // "of source files in context" — so doctor claimed 100% in-context while
      // the run that built that context reported 54%. The index deliberately
      // holds more than the budget admitted. Measure what is actually in the
      // context file, and name the population either way.
      const { coverageScore, formatCoverage, inContextFiles } = require('../analysis/coverage-score');
      const cov = coverageScore(cwd, inContextFiles(cwd), config);
      const line = formatCoverage(cov, 'in-context');
      if (cov.score < 70) add('coverage', 'Coverage', 'warn', line, 'increase maxTokens or expand srcDirs in gen-context.config.json');
      else add('coverage', 'Coverage', 'ok', line);
    }
  } catch (_) {}

  // 7. Model profile (#688)
  //
  // Every model name, price and window SigMap prints comes from one dated
  // table. Nothing refreshes it — there is no live fetch — so its age is the
  // only freshness signal there is, and a roster entry with no figures is
  // advice that cannot be costed.
  try {
    const { resolveProfile, profileAge, asOfLabel, STALE_AFTER_DAYS } = require('../config/models');
    const profile = resolveProfile(config);
    const age = profileAge(profile, opts.nowMs);
    const roster = profile.rosterDeclared ? `roster: ${profile.roster.join(', ')}` : 'no roster declared — advice names the shipped defaults';
    if (age.stale) {
      add('models', 'Model profile', 'warn',
        `${asOfLabel(profile)} is ${age.days} days old (limit ${STALE_AFTER_DAYS}) — model names, prices and windows may have changed`,
        'check your vendors\' pricing pages, then set "models.asOf" and any changed figures in gen-context.config.json — or upgrade sigmap');
    } else if (profile.rosterUnknown.length) {
      add('models', 'Model profile', 'warn',
        `roster names model(s) with no price on record: ${profile.rosterUnknown.join(', ')}`,
        'add them under "models.prices" (and "models.windows", "models.tiers") in gen-context.config.json');
    } else {
      add('models', 'Model profile', 'ok', `${asOfLabel(profile)} · ${roster}`);
    }
  } catch (_) {}

  // 8. MCP wiring
  try {
    let wired = null;
    for (const t of _mcpTargets(cwd)) {
      try {
        if (!fs.existsSync(t)) continue;
        if (/sigmap/.test(fs.readFileSync(t, 'utf8'))) { wired = t; break; }
      } catch (_) {}
    }
    if (wired) add('mcp', 'MCP wiring', 'ok', `registered in ${_short(wired, cwd)}`);
    else add('mcp', 'MCP wiring', 'warn', 'MCP server not registered in any editor config', 'run: sigmap --setup   (auto-wires Claude, Cursor, Windsurf, VS Code, …)');
  } catch (_) {}

  const errors = checks.filter((c) => c.status === 'fail').length;
  const warnings = checks.filter((c) => c.status === 'warn').length;
  return { checks, ok: errors === 0, errors, warnings };
}

/** Human-readable checklist. */
function formatDoctor(result) {
  const lines = ['sigmap doctor', ''];
  for (const c of result.checks) {
    lines.push(`${ICON[c.status] || '?'} ${c.label}${c.detail ? ' — ' + c.detail : ''}`);
    if (c.status !== 'ok' && c.fix) lines.push(`    ↳ ${c.fix}`);
  }
  lines.push('');
  lines.push(
    result.errors === 0 && result.warnings === 0
      ? '✓ All checks passed.'
      : `${result.errors} error(s), ${result.warnings} warning(s).`
  );
  return lines.join('\n');
}

/** Machine-readable result. */
function formatDoctorJSON(result) {
  return JSON.stringify(result, null, 2);
}

module.exports = { diagnose, formatDoctor, formatDoctorJSON };
