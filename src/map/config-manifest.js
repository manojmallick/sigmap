'use strict';

/**
 * Config & package-manifest extractor (v8.5 C1).
 *
 * Surfaces the project's package manifests and the notable root config files.
 *
 * Dependency extraction lives in `src/deps/inventory.js` (#2a, v8.50). Before
 * that, most ecosystems were reported as the literal word "present" —
 * `pom.xml (maven) | present` names a file without naming a single package or
 * version, which is not grounding. This module now renders real coordinates.
 *
 * Pure, zero-dependency, deterministic.
 *
 * @param {string[]} files — absolute file paths (unused; roots are read directly)
 * @param {string}   cwd   — project root
 * @returns {string} formatted markdown table (empty string if none found)
 */

const fs = require('fs');
const path = require('path');
const { collectDependencies, versionPins } = require('../deps/inventory');

const CONFIG_FILES = [
  'tsconfig.json', 'jsconfig.json', '.eslintrc', '.eslintrc.json', '.eslintrc.js',
  '.prettierrc', 'babel.config.js', 'jest.config.js', 'vitest.config.ts',
  'webpack.config.js', 'vite.config.ts', 'rollup.config.js', 'tailwind.config.js',
  'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile', '.editorconfig',
];

const PIN_LIMIT = 30;

/** Human ecosystem label for a manifest row. */
const ECOSYSTEM_LABEL = {
  npm: 'npm', pypi: 'python', maven: 'maven', go: 'go', cargo: 'rust',
  rubygems: 'ruby', composer: 'php', nuget: 'dotnet', pub: 'dart',
};

/** `12 runtime, 3 dev` — scope counts for one manifest, most-important first. */
function scopeSummary(deps) {
  const order = ['runtime', 'dev', 'test', 'peer', 'optional', 'build', 'indirect'];
  const counts = new Map();
  for (const d of deps) counts.set(d.scope, (counts.get(d.scope) || 0) + 1);
  const parts = [];
  for (const scope of order) {
    if (counts.has(scope)) parts.push(`${counts.get(scope)} ${scope}`);
  }
  for (const [scope, n] of [...counts].sort()) {
    if (!order.includes(scope)) parts.push(`${n} ${scope}`);
  }
  return parts.length ? parts.join(', ') : 'none declared';
}

function configFiles(cwd) {
  const present = [];
  for (const f of CONFIG_FILES) {
    if (fs.existsSync(path.join(cwd, f))) present.push(f);
  }
  return present;
}

function analyze(files, cwd) {
  let inventory = { deps: [], manifests: [], ecosystems: [], truncated: 0 };
  try {
    inventory = collectDependencies(cwd);
  } catch (_) { /* a repo with no readable manifest still lists config files */ }

  const configs = configFiles(cwd);
  if (inventory.manifests.length === 0 && configs.length === 0) return '';

  const lines = [];
  if (inventory.manifests.length) {
    lines.push('| Manifest | Project | Dependencies |', '|----------|---------|--------------|');
    for (const m of inventory.manifests) {
      const label = ECOSYSTEM_LABEL[m.ecosystem] || m.ecosystem;
      const id = [m.name, m.version].filter(Boolean).join('@') || '—';
      const mine = inventory.deps.filter((d) => d.file === m.file);
      lines.push(`| \`${m.file}\` (${label}) | ${id} | ${scopeSummary(mine)} |`);
    }

    // Exact pins are the densest grounding available: a model that knows
    // express@5.1.4 stops writing Express 4 API.
    const { pins, total } = versionPins(inventory, { limit: PIN_LIMIT });
    if (pins.length) {
      lines.push('');
      const shown = pins.map((p) => '`' + p + '`').join(', ');
      lines.push(`**Direct dependencies:** ${shown}${total > pins.length ? ` … +${total - pins.length} more` : ''}`);
    }
    if (inventory.truncated > 0) {
      lines.push('');
      lines.push(`> ${inventory.truncated} dependency row(s) omitted to stay within the per-manifest cap.`);
    }
  }

  if (configs.length) {
    if (lines.length) lines.push('');
    lines.push(`**Config files:** ${configs.map((c) => '`' + c + '`').join(', ')}`);
  }
  return lines.join('\n');
}

module.exports = { analyze };
