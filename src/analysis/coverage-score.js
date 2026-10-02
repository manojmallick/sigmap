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
  '.sh', '.bash', '.zsh', '.ps1', '.psm1', '.psd1',
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

/**
 * Source files that exist in the repo but fall OUTSIDE every configured
 * srcDir (#805).
 *
 * `coverageScore` walks srcDirs only, so its denominator cannot see a file the
 * detector never selected — which is how a flat Go layout reported a plausible
 * "indexed 67% (2/3 files)" while ten of thirteen source files were invisible.
 * The number was not wrong about its own population; nothing told the user the
 * population was wrong.
 *
 * Deliberately a SEPARATE primitive rather than a new denominator inside
 * `coverageScore`: the named populations (#762) are pinned, and the fix here is
 * to disclose what is missing, not to redefine coverage.
 *
 * @param {string} cwd
 * @param {{srcDirs:string[], exclude:string[], maxDepth?:number}} config
 * Counts IMPLEMENTATION files only — tests, docs, CI, mocks and the
 * conventional tooling directories are legitimately outside srcDirs and are
 * reported separately as `skipped`.
 *
 * @returns {{ total: number, byExt: Array<{ext: string, count: number}>,
 *             dirs: string[], skipped: number, inScope: number, share: number }}
 */
function outsideSrcDirs(cwd, config) {
  const fs   = require('fs');
  const path = require('path');

  const srcDirs = (config && Array.isArray(config.srcDirs) && config.srcDirs.length > 0)
    ? config.srcDirs : ['src', 'app', 'lib'];

  // A srcDir of '.' covers the whole tree, so nothing can be outside it.
  if (srcDirs.some((d) => d === '.' || d === './')) return { total: 0, byExt: [], dirs: [], skipped: 0, inScope: 0, share: 0 };

  const excludeSet = new Set([
    'node_modules', '.git', 'dist', 'build', 'out', '__pycache__',
    '.next', 'coverage', 'target', 'vendor', '.context',
  ]);
  if (config && Array.isArray(config.exclude)) {
    for (const x of config.exclude) excludeSet.add(String(x));
  }

  const srcAbs = srcDirs.map((d) => path.resolve(cwd, d));
  const inSrc  = (f) => srcAbs.some((a) => f === a || f.startsWith(a + path.sep));

  const all = [];
  _walkOwned(cwd, excludeSet, all, 0);

  let inScope = 0;
  for (const a of srcAbs) {
    const found = [];
    try { if (fs.existsSync(a)) _walkOwned(a, excludeSet, found, 0); } catch (_) {}
    for (const f of found) if (CODE_EXTS.has(path.extname(f).toLowerCase())) inScope++;
  }

  // Only IMPLEMENTATION counts. Tests, docs, CI, mocks and the conventional
  // tooling directories are routinely and correctly outside srcDirs — counting
  // them turned this into a 297-file warning on SigMap's own repo, where the
  // real answer is the two root-level entrypoints. A check that cries wolf on a
  // correct configuration teaches the user to ignore it.
  let cls = null;
  try { cls = require('../util/file-class'); } catch (_) {}
  const OUT_OF_SCOPE_DIRS = new Set([
    'test', 'tests', 'spec', 'specs', '__tests__', 'e2e',
    'docs', 'doc', 'documentation', 'examples', 'example', 'samples',
    'scripts', 'benchmarks', 'fixtures', 'mocks', '__mocks__',
    'testdata', 'demo', 'demos', 'tools', 'migrations',
  ]);

  const byExt = new Map();
  const dirs  = new Set();
  let total = 0;
  let skipped = 0;
  for (const f of all) {
    const ext = path.extname(f).toLowerCase();
    if (!CODE_EXTS.has(ext)) continue;
    if (inSrc(f)) continue;
    const rel = path.relative(cwd, f).split(path.sep).join('/');
    const topDir = rel.includes('/') ? rel.split('/')[0] : '.';
    if (OUT_OF_SCOPE_DIRS.has(topDir)) { skipped++; continue; }
    if (cls && (cls.isTestFile(rel) || cls.isDocsFile(rel) || cls.isCiFile(rel) || cls.isMockFile(rel))) {
      skipped++; continue;
    }
    total++;
    byExt.set(ext, (byExt.get(ext) || 0) + 1);
    dirs.add(topDir);
  }

  return {
    total,
    byExt: [...byExt.entries()]
      .map(([ext, count]) => ({ ext, count }))
      .sort((a, b) => b.count - a.count || a.ext.localeCompare(b.ext)),
    dirs: [...dirs].sort(),
    skipped,
    inScope,
    // Share of the implementation that srcDirs is missing. A handful of root
    // entrypoints outside srcDirs is normal; a majority of the codebase is the
    // #805 failure. Callers grade on this rather than on the raw count.
    share: inScope + total > 0 ? total / (inScope + total) : 0,
  };
}

/**
 * Depth-bounded walk that stops at NESTED REPOSITORIES.
 *
 * A vendored or cloned repo is not this repo's source, and walking it is both
 * wrong and expensive: on SigMap's own tree `benchmarks/repos/` holds 43 cloned
 * repositories — 47,327 of the 53,013 files under cwd — so an unbounded walk
 * spent its entire time in directories whose files could never be the user's.
 * A `.git` entry is the marker, which also covers submodules and any vendored
 * checkout the exclude list does not happen to name.
 */
const OWNED_WALK_MAX_DEPTH = 10;

function _walkOwned(dir, excludeSet, out, depth) {
  const fs   = require('fs');
  const path = require('path');
  if (depth > OWNED_WALK_MAX_DEPTH) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  if (depth > 0 && entries.some((e) => e.name === '.git')) return; // a repo of its own
  for (const e of entries) {
    if (excludeSet.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { _walkOwned(full, excludeSet, out, depth + 1); }
    else if (e.isFile())  { out.push(full); }
  }
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

/**
 * Named populations (#762).
 *
 * Four surfaces printed a coverage percentage for one repo and no two agreed:
 * `validate` 98% (175/179), `doctor` 100%, `--health` 100% (170/170) and
 * `--report` 54% (91/170). They were not in conflict — they were measuring
 * DIFFERENT populations through the same primitive, and none of them said
 * which. `doctor` was the sharpest case: it fed `coverageScore` the retrieval
 * index and then printed "of source files in context", contradicting the very
 * run that built that context.
 *
 * Differing numbers are fine. Unlabelled ones are not. Every surface now names
 * its population, so a reader can tell at a glance that 54% and 100% are
 * answers to two different questions.
 */
const POPULATIONS = {
  // Survived the token budget — what the agent actually sees.
  'in-context': { label: 'in-context', noun: 'scoped source files' },
  // Present in the retrieval index, including anything stored outside the
  // budgeted context file (sig-index, per-module splits, cold store).
  indexed:      { label: 'indexed',    noun: 'files' },
  // Readable on disk under srcDirs — an access check, not a coverage claim.
  readable:     { label: 'readable',   noun: 'files in srcDirs' },
};

/**
 * Render a coverage figure with its population, numerator and denominator.
 * `indexed 98% (175/179 files)` — never a bare percentage.
 */
function formatCoverage(cov, population, opts = {}) {
  const pop = POPULATIONS[population];
  if (!pop) throw new Error(`unknown coverage population: ${population}`);
  const included = opts.included != null ? opts.included : cov.included;
  const total    = opts.total    != null ? opts.total    : cov.total;
  const grade    = opts.grade === false ? '' : ` grade ${cov.grade}`;
  return `${pop.label} ${cov.score}% (${included}/${total} ${pop.noun})${grade}`;
}

/**
 * The files actually present in the generated context file — the `in-context`
 * population. Parsed from the `### <relpath>` section headings rather than the
 * retrieval index, because the index deliberately holds more than the budget
 * admitted, and conflating the two is what produced the contradiction above.
 */
function inContextFiles(cwd) {
  const fs   = require('fs');
  const path = require('path');
  const candidates = [
    path.join(cwd, '.github', 'copilot-instructions.md'),
    path.join(cwd, 'CLAUDE.md'),
    path.join(cwd, 'AGENTS.md'),
    path.join(cwd, 'GEMINI.md'),
  ];
  const out = new Set();
  for (const file of candidates) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch (_) { continue; }
    const markerIdx = content.indexOf('## Auto-generated signatures');
    if (markerIdx !== -1) content = content.slice(markerIdx);
    for (const m of content.matchAll(/^### (.+)$/gm)) {
      const rel = m[1].trim();
      if (!rel || rel.includes(' ')) continue;
      out.add(path.resolve(cwd, rel));
    }
    if (out.size) break; // first adapter output that carries sections wins
  }
  return [...out].map((filePath) => ({ filePath }));
}

module.exports = { coverageScore, formatCoverage, inContextFiles, outsideSrcDirs, POPULATIONS, CODE_EXTS };

