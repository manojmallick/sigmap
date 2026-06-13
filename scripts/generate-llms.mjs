#!/usr/bin/env node
'use strict';

/**
 * Generate SigMap's own llms.txt (concise) + llms-full.txt (full LLM reference)
 * from source of truth — so any LLM reading them knows exactly how to use SigMap,
 * and the docs can never silently go stale (issue #242).
 *
 *   node scripts/generate-llms.mjs            # write the files
 *   node scripts/generate-llms.mjs --check    # print, don't write (used by validate)
 *
 * Sources of truth (never hand-typed): package.json, version.json (metrics),
 * src/mcp/tools.js (MCP tools + schemas), src/config/defaults.js (config keys),
 * the extractor set (languages), packages/adapters (integrations), and
 * `gen-context.js --help` (CLI commands). Brand/legal/philosophy prose comes
 * from scripts/llms-manual.mjs verbatim.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { tagline, solves, projectDescription, doesNotDo, compliance, positioning } from './llms-manual.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const bq = (s) => s.split('\n').map((l) => `> ${l}`).join('\n');
const pct = (n, d = 1) => `${Number(n).toFixed(d)}%`;

// ── Gather source of truth (deterministic) ──────────────────────────────────
function gather() {
  const pkg = require(path.join(ROOT, 'package.json'));
  const version = require(path.join(ROOT, 'version.json'));
  const { TOOLS } = require(path.join(ROOT, 'src/mcp/tools.js'));
  const { DEFAULTS } = require(path.join(ROOT, 'src/config/defaults.js'));

  const HELPERS = new Set(['line-anchor', 'deps', 'coverage', 'patterns', 'python_ast', 'python_dataclass', 'todos', 'prdiff']);
  const languages = fs.readdirSync(path.join(ROOT, 'src/extractors'))
    .filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''))
    .filter((n) => !HELPERS.has(n)).sort();

  const ADAPTER_HELPERS = new Set(['index', 'llm-full']);
  const adapters = fs.readdirSync(path.join(ROOT, 'packages/adapters'))
    .filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''))
    .filter((n) => !ADAPTER_HELPERS.has(n)).sort();

  let helpLines = [];
  try {
    const out = spawnSync('node', [path.join(ROOT, 'gen-context.js'), '--help'], { encoding: 'utf8' }).stdout || '';
    helpLines = out.split('\n').map((l) => l.replace(/\s+$/, ''))
      .filter((l) => /^\s+(sigmap|gen-context)\b/.test(l))
      .map((l) => l.trim().replace(/^gen-context\b/, 'sigmap'));
  } catch (_) {}

  const repo = String((pkg.repository && pkg.repository.url) || 'https://github.com/manojmallick/sigmap')
    .replace(/^git\+/, '').replace(/\.git$/, '');
  const home = pkg.homepage || 'https://manojmallick.github.io/sigmap/';
  return { pkg, version, TOOLS, DEFAULTS, languages, adapters, helpLines, repo, home };
}

function stamp(d) {
  return [
    `# Version: ${d.pkg.version} | Benchmark: ${d.version.benchmark_id} (${d.version.benchmark_date})`,
    '# Source: auto-generated from package.json, version.json, src/mcp/tools.js, src/config/defaults.js',
    '# Regenerate: npm run generate:llms   |   Validate: npm run validate:llms',
  ].join('\n');
}

function metricsBullets(d) {
  const m = d.version.metrics;
  return [
    `## Core metrics (benchmark: ${d.version.benchmark_id}, ${d.version.benchmark_date})`,
    '',
    `- hit@5 retrieval: ${pct(m.hit_at_5 * 100)} vs ${pct(m.baseline_hit_at_5 * 100)} random baseline (${m.retrieval_lift}× lift)`,
    `- Token reduction: ${pct(m.overall_token_reduction_pct)} average across benchmark repos`,
    `- Task success: ${pct(m.task_success_proxy_pct)} vs 10% without SigMap`,
    `- Prompts per task: ${m.prompts_per_task} vs ${m.baseline_prompts_per_task} baseline (${pct(m.prompt_reduction_pct)} fewer)`,
    `- Languages: ${d.version.languages} supported · MCP tools: ${d.version.mcp_tools}`,
    '- Dependencies: zero npm runtime dependencies · fully offline',
  ].join('\n');
}

function metricsTable(d) {
  const m = d.version.metrics;
  return [
    `## Core metrics (benchmark: ${d.version.benchmark_id}, ${d.version.benchmark_date})`,
    '',
    '| Metric | Without SigMap | With SigMap |',
    '|--------|----------------|-------------|',
    `| Retrieval hit@5 | ${pct(m.baseline_hit_at_5 * 100)} (random) | ${pct(m.hit_at_5 * 100)} (${m.retrieval_lift}× lift) |`,
    `| Token reduction | — | ${pct(m.overall_token_reduction_pct)} average |`,
    `| Task success proxy | 10% | ${pct(m.task_success_proxy_pct)} |`,
    `| Prompts per task | ${m.prompts_per_task < m.baseline_prompts_per_task ? m.baseline_prompts_per_task : '—'} | ${m.prompts_per_task} (${pct(m.prompt_reduction_pct)} fewer) |`,
    `| Supported languages | — | ${d.version.languages} |`,
    `| MCP tools | — | ${d.version.mcp_tools} |`,
    '| npm runtime dependencies | — | 0 |',
  ].join('\n');
}

function mcpInputLine(t) {
  const props = (t.inputSchema && t.inputSchema.properties) || {};
  const req = new Set((t.inputSchema && t.inputSchema.required) || []);
  const keys = Object.keys(props);
  if (!keys.length) return 'Input:  { } (no arguments)';
  const parts = keys.map((k) => `${k}${req.has(k) ? '' : '?'}: ${props[k].type || 'any'}`);
  return `Input:  { ${parts.join(', ')} }`;
}

// ── Concise llms.txt ─────────────────────────────────────────────────────────
export function buildConcise(d) {
  return [
    '# SigMap',
    '',
    bq(tagline),
    '',
    projectDescription,
    '',
    stamp(d),
    '',
    solves,
    '',
    metricsBullets(d),
    '',
    '## Quick start',
    '```bash',
    'npx sigmap                          # generate compact signature context for the repo',
    'npx sigmap ask "<your query>"       # rank the files relevant to a task',
    'npx sigmap verify-ai-output ans.md  # flag fabricated files/imports/symbols in an AI answer',
    'npx sigmap --mcp                    # start the MCP server over stdio',
    '```',
    '',
    '## Docs',
    `- [Full documentation](${d.home})`,
    `- [CLI reference](${d.home}guide/cli)`,
    `- [MCP tools](${d.home}guide/mcp)`,
    `- [Benchmark methodology](${d.home}guide/benchmark)`,
    `- [Configuration guide](${d.home}guide/config)`,
    `- [Changelog](${d.repo}/blob/main/CHANGELOG.md)`,
    '',
    '## Optional',
    `- [GitHub repository](${d.repo})`,
    '- [npm package](https://www.npmjs.com/package/sigmap)',
    '- [Benchmark dataset (Zenodo)](https://doi.org/10.5281/zenodo.19898842)',
    `- [Full LLM reference](${d.home}llms-full.txt)`,
    '',
    positioning,
    '',
  ].join('\n');
}

// ── Full llms-full.txt ───────────────────────────────────────────────────────
export function buildFull(d) {
  const { pkg, TOOLS, DEFAULTS, languages, adapters, helpLines } = d;
  const L = [
    '# SigMap — Complete LLM Reference', '',
    bq(tagline), '',
    projectDescription, '',
    stamp(d), '',
    '---', '',
    metricsTable(d), '',
    '---', '',
    '## Installation', '',
    '```bash',
    '# Run immediately without installing',
    'npx sigmap',
    '',
    '# Install globally',
    'npm install -g sigmap',
    '',
    '# Auto-wire MCP + editor config + git hook + watcher',
    'npx sigmap --setup',
    '```', '',
    '---', '',
    '## CLI commands — complete reference', '',
    'Every command and flag (`sigmap --help`):', '',
  ];
  if (helpLines.length) L.push('```', ...helpLines, '```');
  else L.push('_Run `sigmap --help` for the full list._');
  L.push('', '---', '');

  L.push(`## MCP server — ${TOOLS.length} tools`, '',
    'Start with `sigmap --mcp` (stdio JSON-RPC). Configure once:', '',
    '```json',
    '{ "mcpServers": { "sigmap": { "command": "npx", "args": ["sigmap", "--mcp"] } } }',
    '```', '');
  for (const t of TOOLS) {
    const desc = String(t.description || '').replace(/\s+/g, ' ').trim();
    L.push(`### ${t.name}`, '', desc, '', '```', mcpInputLine(t), '```', '');
  }
  L.push('---', '');

  L.push('## Configuration (gen-context.config.json)', '',
    'Every config key and its default:', '', '```');
  for (const k of Object.keys(DEFAULTS)) {
    const v = DEFAULTS[k];
    L.push(`${k} = ${(v && typeof v === 'object') ? JSON.stringify(v) : String(v)}`);
  }
  L.push('```', '', '---', '');

  L.push(`## Supported languages (${languages.length} extractors)`, '', languages.join(', '), '', '---', '');

  L.push('## Integrations', '',
    `Generates native context files for: ${adapters.join(', ')} — plus an MCP server for any agent (Claude Code, Cursor, Cline, Windsurf, OpenCode, Gemini CLI, Aider). One \`sigmap --setup\` wires the lot.`,
    '', '---', '');

  L.push(compliance, '', '---', '');

  L.push('## Project information', '',
    `- Author: ${(pkg.author && pkg.author.name) || 'Manoj Mallick'}`,
    `- License: ${pkg.license || 'MIT'}`,
    `- Repository: ${d.repo}`,
    `- Documentation: ${d.home}`,
    '- npm: https://www.npmjs.com/package/sigmap',
    '- Benchmark dataset: https://doi.org/10.5281/zenodo.19898842',
    `- Issues: ${d.repo}/issues`,
    '', '---', '');

  L.push(doesNotDo, '');
  return L.join('\n');
}

// ── Targets / run ────────────────────────────────────────────────────────────
export const TARGETS = {
  concise: ['docs-vp/public/llms.txt', 'llms.txt'],
  full: ['docs-vp/public/llms-full.txt', 'llms-full.txt'],
};
export function generate() {
  const d = gather();
  return { concise: buildConcise(d), full: buildFull(d) };
}
function main() {
  const { concise, full } = generate();
  if (process.argv.includes('--check')) { process.stdout.write(concise + '\n----8<----\n' + full); return; }
  for (const rel of TARGETS.concise) { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, concise); }
  for (const rel of TARGETS.full) { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, full); }
  console.log(`[llms] wrote ${concise.length}B concise + ${full.length}B full → ${[...TARGETS.concise, ...TARGETS.full].join(', ')}`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
