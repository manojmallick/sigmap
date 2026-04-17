'use strict';

/**
 * SigMap coverage scorer — v5.5.0
 *
 * Measures what fraction of *code* files made it into the context output
 * after token-budget application. Non-code files (json, md, config) are
 * counted separately as `nonCodeSkipped` so the grade reflects real coverage.
 *
 *   - Health score = context freshness / reduction quality / budget compliance
 *   - Coverage score = how much of the codebase is represented in context
 *
 * Grade scale:  A ≥ 90%  |  B ≥ 75%  |  C ≥ 50%  |  D < 50%
 *
 * @param {string} cwd
 * @param {Array<{filePath:string}>} fileEntries - files that made it into output
 * @param {{srcDirs:string[], exclude:string[]}} config
 * @returns {{
 *   score: number,
 *   grade: 'A'|'B'|'C'|'D',
 *   total: number,
 *   included: number,
 *   dropped: number,
 *   nonCodeSkipped: number,
 *   confidence: 'HIGH'|'MEDIUM'|'LOW',
 *   perModule: Map<string, {total:number, included:number, pct:number}>,
 * }}
 */

const CODE_EXTS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.cs', '.cpp', '.c', '.h', '.hpp',
  '.swift', '.dart', '.scala', '.php',
  '.vue', '.svelte', '.css', '.scss',
  '.sql', '.graphql', '.proto', '.tf',
  '.lua', '.r', '.jl', '.ex', '.exs',
  '.sh', '.bash', '.zsh', '.ps1',
]);

function coverageScore(cwd, fileEntries, config) {
  const fs   = require('fs');
  const path = require('path');

  const srcDirs = (config && Array.isArray(config.srcDirs) && config.srcDirs.length > 0)
    ? config.srcDirs
    : ['src', 'app', 'lib'];

  const excludeSet = new Set([
    'node_modules', '.git', 'dist', 'build', 'out', '__pycache__',
    '.next', 'coverage', 'target', 'vendor', '.context',
  ]);
  if (config && Array.isArray(config.exclude)) {
    for (const x of config.exclude) excludeSet.add(String(x));
  }

  const includedSet = new Set((fileEntries || []).map(f => f.filePath));

  // Walk srcDirs: separate code files from non-code files
  const allFiles  = [];
  const allSource = [];
  for (const relDir of srcDirs) {
    const absDir = path.resolve(cwd, relDir);
    if (fs.existsSync(absDir)) _walk(absDir, excludeSet, allFiles);
  }
  for (const f of allFiles) {
    if (CODE_EXTS.has(path.extname(f).toLowerCase())) allSource.push(f);
  }
  const nonCodeSkipped = allFiles.length - allSource.length;

  const total    = allSource.length;
  const included = allSource.filter(f => includedSet.has(f)).length;
  const dropped  = total - included;
  const pct      = total > 0 ? Math.round((included / total) * 100) : 100;

  const grade = pct >= 90 ? 'A' : pct >= 75 ? 'B' : pct >= 50 ? 'C' : 'D';
  const confidence = pct >= 90 ? 'HIGH' : pct >= 70 ? 'MEDIUM' : 'LOW';

  // Per-module breakdown (one entry per srcDir)
  const perModule = new Map();
  for (const relDir of srcDirs) {
    const absDir   = path.resolve(cwd, relDir);
    const modFiles = allSource.filter(f => f.startsWith(absDir + path.sep) || f === absDir);
    const modIncl  = modFiles.filter(f => includedSet.has(f)).length;
    const modPct   = modFiles.length > 0 ? Math.round((modIncl / modFiles.length) * 100) : 100;
    perModule.set(relDir, { total: modFiles.length, included: modIncl, pct: modPct });
  }

  return { score: pct, grade, total, included, dropped, nonCodeSkipped, confidence, perModule };
}

function _walk(dir, excludeSet, out) {
  const fs   = require('fs');
  const path = require('path');
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of entries) {
    if (excludeSet.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { _walk(full, excludeSet, out); }
    else if (e.isFile())  { out.push(full); }
  }
}

module.exports = { coverageScore, CODE_EXTS };
