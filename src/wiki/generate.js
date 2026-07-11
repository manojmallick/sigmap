'use strict';

/**
 * Wiki generation (D9) — `sigmap wiki`.
 *
 * Deterministic architecture narrative composed from data SigMap already
 * computes: the signature index, the dependency graph, conventions, and the
 * health score. Template prose only — no LLM, no network, no timestamps —
 * so two runs on an unchanged repo produce byte-identical markdown.
 */

const fs = require('fs');
const path = require('path');

const HUB_LIMIT = 8;
const ENTRY_LIMIT = 8;
const MODULE_LIMIT = 20;
const KEY_FILE_LIMIT = 3;

// Graph keys come from src/graph/builder's normalizePath (normalized +
// lowercased), so relativize against the same normalization of cwd.
function _rel(cwd, f) {
  return path.relative(path.normalize(cwd).toLowerCase(), f).replace(/\\/g, '/');
}

function _pct(fraction) {
  return Math.round(fraction * 100);
}

/** Project name + version from package.json, falling back to the dir name. */
function _identity(cwd) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    if (pkg && pkg.name) return { name: pkg.name, version: pkg.version || null };
  } catch (_) {}
  return { name: path.basename(cwd), version: null };
}

/** Module rollup from the signature index (keys are cwd-relative paths). */
function _modules(index) {
  const groups = new Map();
  let totalTokens = 0;
  for (const [rel, sigs] of index.entries()) {
    const parts = String(rel).replace(/\\/g, '/').split('/');
    const mod = parts.length > 1 ? parts[0] : '.';
    const tokens = Math.ceil((sigs || []).join('\n').length / 4);
    totalTokens += tokens;
    if (!groups.has(mod)) groups.set(mod, { name: mod, files: 0, tokens: 0, fileSigs: [] });
    const g = groups.get(mod);
    g.files++;
    g.tokens += tokens;
    g.fileSigs.push({ file: rel, sigCount: (sigs || []).length });
  }
  const modules = [...groups.values()]
    .sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name))
    .slice(0, MODULE_LIMIT)
    .map((g) => ({
      name: g.name,
      files: g.files,
      tokens: g.tokens,
      keyFiles: g.fileSigs
        .sort((a, b) => b.sigCount - a.sigCount || a.file.localeCompare(b.file))
        .slice(0, KEY_FILE_LIMIT)
        .map((f) => f.file),
    }));
  return { modules, totalTokens };
}

/** Hubs, entry points, and cycle count from the dependency graph. */
function _flow(cwd) {
  try {
    const { buildFromCwd } = require('../graph/builder');
    const { detectCycles } = require('../map/import-graph');
    const graph = buildFromCwd(cwd);
    if (!graph || !graph.forward || graph.forward.size === 0) return null;

    const importersOf = (f) => (graph.reverse.get(f) || []).length;
    const hubs = [...graph.reverse.entries()]
      .map(([f, importers]) => ({ file: _rel(cwd, f), importers: importers.length }))
      .filter((h) => h.importers > 0)
      .sort((a, b) => b.importers - a.importers || a.file.localeCompare(b.file))
      .slice(0, HUB_LIMIT);

    const entryPoints = [...graph.forward.entries()]
      .filter(([f, deps]) => deps.length > 0 && importersOf(f) === 0)
      .map(([f, deps]) => ({ file: _rel(cwd, f), imports: deps.length }))
      .sort((a, b) => b.imports - a.imports || a.file.localeCompare(b.file))
      .slice(0, ENTRY_LIMIT);

    let cycles = 0;
    try { cycles = detectCycles(graph.forward).length; } catch (_) {}

    return { hubs, entryPoints, cycles, edges: graph.forward.size };
  } catch (_) {
    return null;
  }
}

/** Conventions summary; index keys are resolved back to absolute paths. */
function _conventions(cwd, index) {
  try {
    const { extractConventions } = require('../conventions/extract');
    const files = [...index.keys()].map((rel) => path.join(cwd, rel));
    const c = extractConventions(cwd, files);
    return {
      fileNaming: c.fileNaming
        ? { dominant: c.fileNaming.dominant, pct: _pct(c.fileNaming.dominantPct || 0), tier: c.fileNaming.tier }
        : null,
      exportStyle: c.exportStyle
        ? { dominant: c.exportStyle.dominant, pct: _pct(c.exportStyle.dominantPct || 0), tier: c.exportStyle.tier }
        : null,
      testFramework: c.testFramework || null,
    };
  } catch (_) {
    return null;
  }
}

function _health(cwd) {
  try {
    const { score } = require('../health/scorer');
    const h = score(cwd);
    return { score: h.score, grade: h.grade };
  } catch (_) {
    return null;
  }
}

/**
 * Build the wiki. Every data source is optional — a repo with no context file
 * or no resolvable graph still yields a valid document.
 * @param {string} cwd
 * @param {object} [opts]
 * @param {string} [opts.version] SigMap version stamped in the header
 * @returns {{ data: object, markdown: string }}
 */
function buildWiki(cwd, opts = {}) {
  let index = new Map();
  try {
    const { buildSigIndex } = require('../retrieval/ranker');
    index = buildSigIndex(cwd);
  } catch (_) {}

  const identity = _identity(cwd);
  const { modules, totalTokens } = _modules(index);
  const flow = _flow(cwd);
  const conventions = index.size ? _conventions(cwd, index) : null;
  const health = _health(cwd);

  const data = {
    name: identity.name,
    version: identity.version,
    files: index.size,
    modules,
    totalTokens,
    flow,
    conventions,
    health,
  };

  return { data, markdown: renderWikiMarkdown(data, opts.version) };
}

/**
 * Render the narrative markdown. Pure function of `data` — no clocks, no
 * randomness — so output is byte-stable for a fixed repo state.
 * @param {object} data
 * @param {string} [sigmapVersion]
 * @returns {string}
 */
function renderWikiMarkdown(data, sigmapVersion) {
  const L = [];
  const title = data.version ? `${data.name} v${data.version}` : data.name;
  L.push(`# ${title} — Architecture Wiki`);
  L.push('');
  L.push(`_Deterministically generated from signatures + dependency graph by SigMap${sigmapVersion ? ` v${sigmapVersion}` : ''} — no LLM. Regenerate: \`sigmap wiki\`._`);
  L.push('');

  L.push('## Overview');
  if (data.files === 0) {
    L.push('No signature index found yet — run `sigmap` (or `node gen-context.js`) to generate context, then regenerate this wiki.');
  } else {
    const fileWord = data.files === 1 ? 'indexed file' : 'indexed files';
    const modWord = data.modules.length === 1 ? 'top-level module' : 'top-level modules';
    L.push(`The codebase spans **${data.files} ${fileWord}** across **${data.modules.length} ${modWord}**, with ~${data.totalTokens} tokens of extracted signatures.`);
    if (data.health) {
      L.push(`Context health: **${data.health.score}/100 (${data.health.grade})**.`);
    }
  }
  L.push('');

  if (data.modules.length) {
    L.push('## Modules');
    L.push('| Module | Files | Sig tokens | Key files |');
    L.push('|--------|-------|------------|-----------|');
    for (const m of data.modules) {
      L.push(`| \`${m.name}\` | ${m.files} | ~${m.tokens} | ${m.keyFiles.map((f) => `\`${f}\``).join(', ')} |`);
    }
    const top = data.modules[0];
    L.push('');
    L.push(`The largest module by signature volume is \`${top.name}\` (${top.files} files, ~${top.tokens} tokens) — start there for the core logic.`);
    L.push('');
  }

  if (data.flow) {
    L.push('## Dependency flow');
    if (data.flow.hubs.length) {
      L.push('The most depended-on files — changes here have the widest blast radius:');
      L.push('');
      L.push('| Hub file | Importers |');
      L.push('|----------|-----------|');
      for (const h of data.flow.hubs) L.push(`| \`${h.file}\` | ${h.importers} |`);
      L.push('');
    }
    if (data.flow.entryPoints.length) {
      L.push('Entry points (imported by nothing, importing the rest):');
      L.push('');
      for (const e of data.flow.entryPoints) L.push(`- \`${e.file}\` → ${e.imports} imports`);
      L.push('');
    }
    L.push(data.flow.cycles
      ? `**Dependency cycles:** ${data.flow.cycles} — untangle these first when refactoring.`
      : '**Dependency cycles:** none detected.');
    L.push('');
  }

  if (data.conventions) {
    L.push('## Conventions');
    const c = data.conventions;
    const bits = [];
    if (c.fileNaming && c.fileNaming.dominant) bits.push(`file naming is predominantly **${c.fileNaming.dominant}** (${c.fileNaming.pct}%, ${c.fileNaming.tier})`);
    if (c.exportStyle && c.exportStyle.dominant) bits.push(`exports use the **${c.exportStyle.dominant}** style (${c.exportStyle.pct}%, ${c.exportStyle.tier})`);
    if (c.testFramework) bits.push(`tests run on **${c.testFramework}**`);
    L.push(bits.length
      ? `In this repo, ${bits.join('; ')}. New code should match.`
      : 'No dominant conventions detected (repo too small or styles mixed).');
    L.push('');
  }

  L.push('## Navigating');
  L.push('- `sigmap ask "<question>"` — ranked, budgeted mini-context for any task');
  L.push('- `sigmap --impact <file>` / `--callers <symbol>` — blast radius before you change something');
  L.push('- `sigmap evidence "<query>"` — machine-consumable Evidence Pack (JSON) for agents/CI');
  L.push('- MCP: `get_architecture_overview`, `get_map`, `get_callee_signatures` for live agent access');
  L.push('');

  return L.join('\n');
}

module.exports = { buildWiki, renderWikiMarkdown };
