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

/** Count code files under srcDirs modified after the context was generated. */
function _countChangedSince(cwd, srcDirs, config, ctxMtime) {
  const { CODE_EXTS } = require('../analysis/coverage-score');
  const exclude = new Set(EXCLUDE_DIRS);
  if (config && Array.isArray(config.exclude)) for (const x of config.exclude) exclude.add(String(x));

  let changed = 0;
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
        try { if (fs.statSync(full).mtimeMs > ctxMtime) changed++; } catch (_) {}
      }
    }
  };
  for (const d of srcDirs) {
    const abs = path.isAbsolute(d) ? d : path.join(cwd, d);
    if (fs.existsSync(abs)) walk(abs, 0);
  }
  return changed;
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
  let indexSize = 0;
  try {
    const { buildSigIndex } = require('../retrieval/ranker');
    indexSize = buildSigIndex(cwd).size;
  } catch (_) {}
  if (indexSize === 0) {
    add('index', 'Signature index', ctxFiles.length === 0 ? 'fail' : 'warn', 'no signatures indexed', 'run: npx sigmap   then: sigmap ask "<query>"');
  } else {
    add('index', 'Signature index', 'ok', `${indexSize} file(s) indexed`);
  }

  // 5. Index freshness
  try {
    if (ctxFiles.length) {
      const ctxMtime = Math.max(...ctxFiles.map((f) => { try { return fs.statSync(f).mtimeMs; } catch (_) { return 0; } }));
      const srcDirs = (config && Array.isArray(config.srcDirs) && config.srcDirs.length) ? config.srcDirs : ['src', 'app', 'lib'];
      const changed = _countChangedSince(cwd, srcDirs, config, ctxMtime);
      if (changed > 0) add('freshness', 'Index freshness', 'warn', `${changed} source file(s) changed since last generate`, 'run: sigmap   (or: sigmap --watch to auto-refresh)');
      else add('freshness', 'Index freshness', 'ok', 'index is up to date with sources');
    }
  } catch (_) {}

  // 6. Coverage
  try {
    if (indexSize > 0) {
      const { coverageScore } = require('../analysis/coverage-score');
      const { buildSigIndex } = require('../retrieval/ranker');
      const entries = [...buildSigIndex(cwd).keys()].map((rel) => ({ filePath: path.resolve(cwd, rel) }));
      const cov = coverageScore(cwd, entries, config);
      if (cov.score < 70) add('coverage', 'Coverage', 'warn', `${cov.score}% of source files in context (grade ${cov.grade})`, 'increase maxTokens or expand srcDirs in gen-context.config.json');
      else add('coverage', 'Coverage', 'ok', `${cov.score}% of source files in context (grade ${cov.grade})`);
    }
  } catch (_) {}

  // 7. MCP wiring
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
