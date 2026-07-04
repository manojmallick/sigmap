'use strict';

/**
 * Config & package-manifest extractor (v8.5 C1).
 *
 * Surfaces the project's package manifests (name / version / dependency counts)
 * across ecosystems and the notable root config files present. Pure,
 * zero-dependency, deterministic.
 *
 * @param {string[]} files — absolute file paths (unused; roots are read directly)
 * @param {string}   cwd   — project root
 * @returns {string} formatted markdown table (empty string if none found)
 */

const fs = require('fs');
const path = require('path');

const CONFIG_FILES = [
  'tsconfig.json', 'jsconfig.json', '.eslintrc', '.eslintrc.json', '.eslintrc.js',
  '.prettierrc', 'babel.config.js', 'jest.config.js', 'vitest.config.ts',
  'webpack.config.js', 'vite.config.ts', 'rollup.config.js', 'tailwind.config.js',
  'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile', '.editorconfig',
];

function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; } }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } }
function count(obj) { return obj && typeof obj === 'object' ? Object.keys(obj).length : 0; }

function manifests(cwd, rows) {
  const pkg = readJson(path.join(cwd, 'package.json'));
  if (pkg) {
    const deps = count(pkg.dependencies);
    const dev = count(pkg.devDependencies);
    const id = [pkg.name, pkg.version].filter(Boolean).join('@') || 'package.json';
    rows.push({ manifest: 'package.json (npm)', detail: `${id} · ${deps} deps, ${dev} devDeps` });
  }

  const pyproject = readText(path.join(cwd, 'pyproject.toml'));
  if (pyproject) {
    const name = (pyproject.match(/^\s*name\s*=\s*["']([^"']+)["']/m) || [])[1];
    const ver = (pyproject.match(/^\s*version\s*=\s*["']([^"']+)["']/m) || [])[1];
    rows.push({ manifest: 'pyproject.toml (python)', detail: [name, ver].filter(Boolean).join('@') || 'present' });
  } else if (readText(path.join(cwd, 'setup.py'))) {
    rows.push({ manifest: 'setup.py (python)', detail: 'present' });
  }
  if (readText(path.join(cwd, 'requirements.txt'))) {
    rows.push({ manifest: 'requirements.txt (python)', detail: 'present' });
  }

  const cargo = readText(path.join(cwd, 'Cargo.toml'));
  if (cargo) {
    const name = (cargo.match(/^\s*name\s*=\s*["']([^"']+)["']/m) || [])[1];
    const ver = (cargo.match(/^\s*version\s*=\s*["']([^"']+)["']/m) || [])[1];
    rows.push({ manifest: 'Cargo.toml (rust)', detail: [name, ver].filter(Boolean).join('@') || 'present' });
  }

  const gomod = readText(path.join(cwd, 'go.mod'));
  if (gomod) {
    const mod = (gomod.match(/^module\s+(\S+)/m) || [])[1];
    const go = (gomod.match(/^go\s+(\S+)/m) || [])[1];
    rows.push({ manifest: 'go.mod (go)', detail: [mod, go && 'go ' + go].filter(Boolean).join(' · ') || 'present' });
  }

  if (readText(path.join(cwd, 'pom.xml'))) rows.push({ manifest: 'pom.xml (maven)', detail: 'present' });
  if (readText(path.join(cwd, 'build.gradle')) || readText(path.join(cwd, 'build.gradle.kts'))) {
    rows.push({ manifest: 'build.gradle (gradle)', detail: 'present' });
  }
  if (readText(path.join(cwd, 'Gemfile'))) rows.push({ manifest: 'Gemfile (ruby)', detail: 'present' });
  const composer = readJson(path.join(cwd, 'composer.json'));
  if (composer) {
    rows.push({ manifest: 'composer.json (php)', detail: `${composer.name || 'present'} · ${count(composer.require)} deps` });
  }
}

function configFiles(cwd) {
  const present = [];
  for (const f of CONFIG_FILES) {
    if (fs.existsSync(path.join(cwd, f))) present.push(f);
  }
  return present;
}

function analyze(files, cwd) {
  const rows = [];
  manifests(cwd, rows);
  const configs = configFiles(cwd);
  if (rows.length === 0 && configs.length === 0) return '';

  const lines = [];
  if (rows.length) {
    lines.push('| Manifest | Detail |', '|----------|--------|');
    for (const r of rows) lines.push(`| ${r.manifest} | ${r.detail} |`);
  }
  if (configs.length) {
    if (lines.length) lines.push('');
    lines.push(`**Config files:** ${configs.map((c) => '`' + c + '`').join(', ')}`);
  }
  return lines.join('\n');
}

module.exports = { analyze };
