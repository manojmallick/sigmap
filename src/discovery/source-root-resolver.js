'use strict';

const fs   = require('fs');
const path = require('path');
const { REGISTRY }              = require('./source-root-registry');
const { detectLanguages }       = require('./language-detector');
const { detectFrameworks }      = require('./framework-detector');
const { scoreCandidate, getRecentlyChangedDirs, ROOT_ENTRYPOINTS } = require('./source-root-scorer');
const { loadIgnorePatterns, matchesIgnorePattern } = require('./sigmapignore');

module.exports = { resolveSourceRoots };

const MONOREPO_MARKERS = ['pnpm-workspace.yaml','turbo.json','nx.json','lerna.json'];
const MAX_ROOTS = 6;

function resolveSourceRoots(cwd, opts = {}) {
  const ignorePatterns = loadIgnorePatterns(cwd);
  const languages      = detectLanguages(cwd);
  const frameworks     = detectFrameworks(cwd);
  const recentDirs     = getRecentlyChangedDirs(cwd);
  const isMonorepo     = _detectMonorepo(cwd);

  const primaryLang   = languages[0]?.name;
  const primaryFw     = frameworks[0];
  const registry      = primaryLang ? REGISTRY[primaryLang] : null;

  // Build framework-derived context
  const fwEntry        = primaryFw && registry?.frameworks?.[primaryFw.name];
  const frameworkSrcDirs   = new Set(fwEntry?.srcDirs || registry?.srcDirs || []);
  const entrypoints        = fwEntry?.entrypoints || [];
  const frameworkPenalties = registry?.penalties || [];

  const context = { frameworks, languages, recentDirs, frameworkSrcDirs, entrypoints, frameworkPenalties };

  // Enumerate candidates
  const candidates = _enumerateCandidates(cwd, isMonorepo, ignorePatterns, opts.exclude || []);

  // Score each candidate
  const scored = candidates
    .map(({ name, full }) => ({
      dir:   name,
      full,
      score: scoreCandidate(name, full, context),
    }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);

  // Handle special rules
  let roots = _applySpecialRules(scored, cwd, primaryFw, fwEntry, frameworks);

  // Dedupe nested paths (prefer parent)
  roots = _dedupeNested(roots);

  // Cap at MAX_ROOTS
  roots = roots.slice(0, MAX_ROOTS).map(r => r.dir);

  // Fallback: if nothing scored, return empty (caller falls back to legacy)
  const confidence = _computeConfidence(frameworks, languages, scored.length);

  return {
    roots,
    languages,
    frameworks,
    confidence,
    explanation: scored.slice(0, 8).map(c => ({
      dir:   c.dir,
      score: c.score,
      reason: `score: ${c.score}`,
    })),
    isMonorepo,
  };
}

function _detectMonorepo(cwd) {
  for (const m of MONOREPO_MARKERS) {
    if (fs.existsSync(path.join(cwd, m))) return true;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    if (pkg.workspaces) return true;
  } catch (_) {}
  return false;
}

function _enumerateCandidates(cwd, isMonorepo, ignorePatterns, excludeList) {
  const candidates = [];
  const excSet     = new Set(excludeList);

  // Root-level dirs
  try {
    for (const e of fs.readdirSync(cwd, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (excSet.has(e.name)) continue;
      if (matchesIgnorePattern(e.name, ignorePatterns)) continue;
      candidates.push({ name: e.name, full: path.join(cwd, e.name) });
    }
  } catch (_) {}

  // Monorepo sub-packages: packages/*/src, apps/*/src, services/*/src
  if (isMonorepo) {
    for (const top of ['packages','apps','services','modules']) {
      const topFull = path.join(cwd, top);
      if (!fs.existsSync(topFull)) continue;
      try {
        for (const pkg of fs.readdirSync(topFull, { withFileTypes: true })) {
          if (!pkg.isDirectory()) continue;
          const srcFull = path.join(topFull, pkg.name, 'src');
          if (fs.existsSync(srcFull)) {
            candidates.push({ name: `${top}/${pkg.name}/src`, full: srcFull });
          }
          // Also consider the package root itself
          candidates.push({ name: `${top}/${pkg.name}`, full: path.join(topFull, pkg.name) });

          // JVM project structures in monorepo packages (Java, Kotlin, Scala)
          for (const jvmLang of ['java', 'kotlin', 'scala']) {
            const srcMainJvm = path.join(topFull, pkg.name, 'src', 'main', jvmLang);
            if (fs.existsSync(srcMainJvm)) {
              candidates.push({ name: `${top}/${pkg.name}/src/main/${jvmLang}`, full: srcMainJvm });
            }
            const appSrcMainJvm = path.join(topFull, pkg.name, 'app', 'src', 'main', jvmLang);
            if (fs.existsSync(appSrcMainJvm)) {
              candidates.push({ name: `${top}/${pkg.name}/app/src/main/${jvmLang}`, full: appSrcMainJvm });
            }
          }
        }
      } catch (_) {}
    }
  }

  // Deep paths known by language/framework (e.g. src/main/java, src-tauri/src)
  const DEEP_PATHS = [
    'src/main/java','src/main/kotlin','src/main/scala',
    'src-tauri/src','Sources/App','app/src/main/java','app/src/main/kotlin','app/src/main/scala',
    'src/test/java','src/test/kotlin',
  ];
  for (const dp of DEEP_PATHS) {
    const full = path.join(cwd, dp);
    if (fs.existsSync(full)) candidates.push({ name: dp, full });
  }

  return candidates;
}

function _applySpecialRules(scored, cwd, primaryFw, fwEntry, frameworks) {
  let roots = [...scored];

  // Django: walk root dirs for any containing models.py or views.py
  if (primaryFw?.name === 'django' || frameworks.some(f => f.name === 'django')) {
    try {
      for (const e of fs.readdirSync(cwd, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const d = path.join(cwd, e.name);
        if (fs.existsSync(path.join(d, 'models.py')) || fs.existsSync(path.join(d, 'views.py'))) {
          if (!roots.find(r => r.dir === e.name)) {
            roots.push({ dir: e.name, full: d, score: 5.0 });
          }
        }
      }
    } catch (_) {}
    roots.sort((a, b) => b.score - a.score);
  }

  // Swift project dir: dirs with ≥3 .swift files
  if (frameworks.some(f => f.name === 'swiftui')) {
    try {
      for (const e of fs.readdirSync(cwd, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const d = path.join(cwd, e.name);
        const swiftCount = (fs.readdirSync(d).filter(f => f.endsWith('.swift'))).length;
        if (swiftCount >= 3 && !roots.find(r => r.dir === e.name)) {
          roots.push({ dir: e.name, full: d, score: 4.0 });
        }
      }
    } catch (_) {}
    roots.sort((a, b) => b.score - a.score);
  }

  return roots;
}

function _dedupeNested(scored) {
  const result = [];
  for (const c of scored) {
    const isNested = result.some(r => c.dir.startsWith(r.dir + '/'));
    if (!isNested) result.push(c);
  }
  return result;
}

function _computeConfidence(frameworks, languages, scoredCount) {
  if (frameworks.length > 0 && frameworks[0].confidence >= 0.90) return 'high';
  if (languages.length > 0 && scoredCount > 0) return 'medium';
  return 'low';
}
