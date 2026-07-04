'use strict';

/**
 * Environment-variable schema extractor (v8.5 C1).
 *
 * Surfaces the environment the project actually reads — from source across
 * JS/TS, Python, Ruby, and Go, plus keys declared in a committed `.env.example`
 * / `.env.sample` / `.env.template`. Pure, zero-dependency, deterministic.
 *
 * @param {string[]} files — absolute file paths to analyze (srcDirs-scoped)
 * @param {string}   cwd   — project root
 * @returns {string} formatted markdown table (empty string if none found)
 */

const fs = require('fs');
const path = require('path');

const SCAN_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.rb', '.go']);
const EXAMPLE_FILES = ['.env.example', '.env.sample', '.env.template', '.env.dist'];

// process.env.X / process.env['X'] / import.meta.env.X / Deno.env.get('X')
const JS_RE = /(?:process\.env|import\.meta\.env)(?:\.([A-Z_][A-Z0-9_]*)|\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\])|Deno\.env\.get\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g;
// os.environ['X'] / os.environ.get('X') / os.getenv('X') / getenv('X')
const PY_RE = /(?:os\.)?(?:environ(?:\.get)?\[?\s*['"]([A-Z_][A-Z0-9_]*)['"]|getenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"])/g;
const RB_RE = /ENV\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\]/g;
const GO_RE = /os\.(?:Getenv|LookupEnv)\(\s*["`']([A-Z_][A-Z0-9_]*)["`']/g;

const MAX_ROWS = 200;

function collectMatches(re, content, into) {
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(content)) !== null) {
    const name = m[1] || m[2] || m[3];
    if (name) into.add(name);
  }
}

function readExampleKeys(cwd) {
  const keys = new Set();
  for (const name of EXAMPLE_FILES) {
    let content;
    try { content = fs.readFileSync(path.join(cwd, name), 'utf8'); } catch (_) { continue; }
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/);
      if (eq) keys.add(eq[1]);
    }
  }
  return keys;
}

function analyze(files, cwd) {
  const fromCode = new Set();

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (!SCAN_EXTS.has(ext)) continue;
    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch (_) { continue; }

    if (ext === '.py') collectMatches(PY_RE, content, fromCode);
    else if (ext === '.rb') collectMatches(RB_RE, content, fromCode);
    else if (ext === '.go') collectMatches(GO_RE, content, fromCode);
    else collectMatches(JS_RE, content, fromCode);
  }

  const fromExample = readExampleKeys(cwd);
  const all = new Set([...fromCode, ...fromExample]);
  if (all.size === 0) return '';

  const names = [...all].sort();
  const lines = [
    '| Variable | Source |',
    '|----------|--------|',
  ];
  for (const name of names.slice(0, MAX_ROWS)) {
    const src = [];
    if (fromCode.has(name)) src.push('code');
    if (fromExample.has(name)) src.push('.env.example');
    lines.push(`| ${name} | ${src.join(', ')} |`);
  }
  if (names.length > MAX_ROWS) {
    lines.push(`| … | +${names.length - MAX_ROWS} more |`);
  }
  return lines.join('\n');
}

module.exports = { analyze };
