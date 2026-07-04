'use strict';

/**
 * Build & CI extractor (v8.5 C1).
 *
 * Surfaces how the project is built and validated: npm/pnpm/yarn scripts
 * (package.json), GitHub Actions workflows (.github/workflows/*.yml), and
 * Makefile targets. Pure, zero-dependency, deterministic.
 *
 * @param {string[]} files — absolute file paths (unused; roots are read directly)
 * @param {string}   cwd   — project root
 * @returns {string} formatted markdown table (empty string if none found)
 */

const fs = require('fs');
const path = require('path');

const MAX_ROWS = 120;

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function npmScripts(cwd, rows) {
  const pkg = readJson(path.join(cwd, 'package.json'));
  if (!pkg || !pkg.scripts || typeof pkg.scripts !== 'object') return;
  for (const name of Object.keys(pkg.scripts).sort()) {
    rows.push({ kind: 'script', name, detail: 'npm run ' + name });
  }
}

function ciWorkflows(cwd, rows) {
  const dir = path.join(cwd, '.github', 'workflows');
  let entries;
  try { entries = fs.readdirSync(dir); } catch (_) { return; }
  for (const file of entries.sort()) {
    if (!/\.ya?ml$/i.test(file)) continue;
    let content;
    try { content = fs.readFileSync(path.join(dir, file), 'utf8'); } catch (_) { continue; }
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : file;
    // Trigger events from an `on:` mapping or inline form.
    const onMatch = content.match(/^on:\s*(.*)$/m);
    let triggers = '';
    if (onMatch) {
      if (onMatch[1].trim()) {
        triggers = onMatch[1].replace(/[[\]{}'"]/g, '').trim();
      } else {
        const block = content.slice(onMatch.index);
        const events = [...block.matchAll(/^\s{2,}([a-z_]+):/gm)].map((m) => m[1]);
        triggers = [...new Set(events)].slice(0, 6).join(', ');
      }
    }
    rows.push({ kind: 'ci', name, detail: `${file}${triggers ? ' — ' + triggers : ''}` });
  }
}

function makeTargets(cwd, rows) {
  let content;
  try { content = fs.readFileSync(path.join(cwd, 'Makefile'), 'utf8'); } catch (_) { return; }
  const targets = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_][a-zA-Z0-9_.-]*)\s*:(?!=)/);
    if (m && m[1] !== '.PHONY') targets.push(m[1]);
  }
  for (const t of [...new Set(targets)].sort()) {
    rows.push({ kind: 'make', name: t, detail: 'make ' + t });
  }
}

function analyze(files, cwd) {
  const rows = [];
  npmScripts(cwd, rows);
  ciWorkflows(cwd, rows);
  makeTargets(cwd, rows);
  if (rows.length === 0) return '';

  const lines = [
    '| Kind | Name | Detail |',
    '|------|------|--------|',
  ];
  for (const r of rows.slice(0, MAX_ROWS)) {
    lines.push(`| ${r.kind} | ${r.name} | ${r.detail} |`);
  }
  if (rows.length > MAX_ROWS) {
    lines.push(`| … | | +${rows.length - MAX_ROWS} more |`);
  }
  return lines.join('\n');
}

module.exports = { analyze };
