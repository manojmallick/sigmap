'use strict';

/**
 * Database-migration extractor (v8.5 C1).
 *
 * Detects schema-migration files across the common frameworks — Rails
 * (db/migrate), Django/Alembic, Prisma, Flyway (`V1__name.sql`), knex/Sequelize,
 * and timestamped SQL — and surfaces them with a parsed version + name. Pure,
 * zero-dependency, deterministic.
 *
 * @param {string[]} files — absolute file paths (unused; the tree is walked)
 * @param {string}   cwd   — project root
 * @returns {string} formatted markdown table (empty string if none found)
 */

const fs = require('fs');
const path = require('path');

const MAX_DEPTH = 6;
const MAX_ROWS = 200;
const SKIP_DIR = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', 'target', '.venv', 'venv', '__pycache__']);
const MIG_EXT = new Set(['.sql', '.rb', '.py', '.js', '.ts']);

// A directory whose path marks its children as migrations.
const MIG_DIR_RE = /(^|\/)(db\/migrate|migrations?|alembic\/versions|prisma\/migrations)$/i;
// A filename that is itself a migration regardless of directory.
const FLYWAY_RE = /^V\d+(?:[._]\d+)*__(.+)\.(sql|java)$/;
const TIMESTAMP_RE = /^(\d{8,})[_-](.+)\.(sql|rb|py|js|ts)$/;
const NAMED_RE = /[._-]migrations?[._-]/i;

function walk(dir, cwd, depth, out) {
  if (depth > MAX_DEPTH) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const relDir = path.relative(cwd, dir).replace(/\\/g, '/');
  const dirIsMigration = MIG_DIR_RE.test(relDir);

  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      walk(path.join(dir, e.name), cwd, depth + 1, out);
      continue;
    }
    const ext = path.extname(e.name).toLowerCase();
    if (!MIG_EXT.has(ext)) continue;

    const rel = path.relative(cwd, path.join(dir, e.name)).replace(/\\/g, '/');
    let version = null;
    let name = null;

    let m;
    if ((m = e.name.match(FLYWAY_RE))) { version = e.name.split('__')[0]; name = m[1].replace(/_/g, ' '); }
    else if ((m = e.name.match(TIMESTAMP_RE))) { version = m[1]; name = m[2].replace(/[_-]/g, ' '); }
    else if (dirIsMigration) { version = '—'; name = e.name.replace(ext, ''); }
    else if (NAMED_RE.test(e.name)) { version = '—'; name = e.name.replace(ext, ''); }
    else continue;

    out.push({ version, name, file: rel });
  }
}

function analyze(files, cwd) {
  const found = [];
  walk(cwd, cwd, 0, found);
  if (found.length === 0) return '';

  found.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

  const lines = [
    '| Version | Migration | File |',
    '|---------|-----------|------|',
  ];
  for (const r of found.slice(0, MAX_ROWS)) {
    lines.push(`| ${r.version} | ${r.name} | ${r.file} |`);
  }
  if (found.length > MAX_ROWS) {
    lines.push(`| … | +${found.length - MAX_ROWS} more | |`);
  }
  return lines.join('\n');
}

module.exports = { analyze };
