'use strict';

const fs   = require('fs');
const path = require('path');
const { REGISTRY }              = require('./source-root-registry');
const { detectLanguages }       = require('./language-detector');
const { detectFrameworks }      = require('./framework-detector');
const { scoreCandidate, getRecentlyChangedDirs, ROOT_ENTRYPOINTS, CODE_EXTS, AUTO_SKIP } = require('./source-root-scorer');
const { loadIgnorePatterns, matchesIgnorePattern } = require('./sigmapignore');
const { detectMonorepo }         = require('./monorepo');

module.exports = { resolveSourceRoots };

const MAX_ROOTS = 6;

// A Gradle/Maven multi-module build legitimately has one source root per
// module — okhttp has 27 — so the 6-root cap tuned for JS layouts would
// discard most of the repo. Raised only for that case.
const MAX_JVM_MODULE_ROOTS = 40;
const JVM_SOURCE_LANGS = ['java', 'kotlin', 'scala', 'groovy'];

/**
 * Build-file evidence of a multi-module JVM project.
 *
 * Secondary signal only: the primary test is structural (see below), because
 * a build file can describe modules that are not on disk, and a layout can be
 * multi-module under a tool nobody enumerated. Covers the three that declare
 * modules declaratively — Gradle, Maven, sbt.
 */
function _hasMultiModuleMarker(cwd) {
  for (const f of ['settings.gradle', 'settings.gradle.kts']) {
    try {
      if (/^\s*include\b/m.test(fs.readFileSync(path.join(cwd, f), 'utf8'))) return true;
    } catch (_) { /* absent */ }
  }
  try {
    const pom = fs.readFileSync(path.join(cwd, 'pom.xml'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    if (/<modules>[\s\S]*?<module>/.test(pom)) return true;
  } catch (_) { /* absent */ }
  try {
    // sbt: `lazy val core = project.in(file("core"))` / `= Project(...)`.
    if (/^\s*lazy\s+val\s+\w+\s*=\s*[\w.]*[Pp]roject/m.test(fs.readFileSync(path.join(cwd, 'build.sbt'), 'utf8'))) return true;
  } catch (_) { /* absent */ }
  return false;
}

/**
 * JVM source-set directories under each module, one and two levels deep.
 *
 * Two levels because grouped layouts (`libs/core/...`, `samples/guide/...`)
 * are common. Leaves are used rather than module roots so tests, resources
 * and build output are excluded by construction rather than filtered later.
 *
 * Source sets are discovered rather than assumed: classic Gradle uses
 * `src/main/<lang>`, but Kotlin Multiplatform uses `src/jvmMain/<lang>`,
 * `src/commonMain/<lang>`, `src/androidMain/<lang>` and friends. Anything
 * test-shaped is skipped — test files are indexed by their own pass and must
 * not become source roots.
 *
 * @returns {Array<{name:string, full:string}>}
 */
function _jvmModuleSourceDirs(cwd, ignorePatterns, excSet) {
  const out = [];
  const seen = new Set();

  const dirsIn = (abs) => {
    try {
      return fs.readdirSync(abs, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));
    } catch (_) { return []; }
  };

  // `<base>/src/<sourceSet>/<lang>` for every non-test source set present.
  const collect = (relBase) => {
    const srcRel = relBase ? `${relBase}/src` : 'src';
    const srcAbs = path.join(cwd, srcRel.split('/').join(path.sep));
    for (const sourceSet of dirsIn(srcAbs)) {
      if (/test/i.test(sourceSet)) continue;
      for (const lang of JVM_SOURCE_LANGS) {
        const rel = `${srcRel}/${sourceSet}/${lang}`;
        if (seen.has(rel)) continue;
        const full = path.join(cwd, rel.split('/').join(path.sep));
        try { if (!fs.statSync(full).isDirectory()) continue; } catch (_) { continue; }
        seen.add(rel);
        out.push({ name: rel, full });
      }
    }
  };

  collect('');
  for (const top of dirsIn(cwd)) {
    if (excSet.has(top) || matchesIgnorePattern(top, ignorePatterns)) continue;
    if (top.startsWith('.')) continue;
    collect(top);
    for (const nested of dirsIn(path.join(cwd, top))) {
      if (excSet.has(nested) || nested.startsWith('.') || nested === 'src' || nested === 'build') continue;
      collect(`${top}/${nested}`);
    }
  }
  return out;
}

function resolveSourceRoots(cwd, opts = {}) {
  const ignorePatterns = loadIgnorePatterns(cwd);
  const languages      = detectLanguages(cwd);
  const frameworks     = detectFrameworks(cwd);
  const recentDirs     = getRecentlyChangedDirs(cwd);
  const monorepo       = detectMonorepo(cwd);
  const isMonorepo     = monorepo.isMonorepo;

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

  // JVM source sets are discovered STRUCTURALLY — two or more module source
  // dirs on disk is what makes a build multi-module, whatever tool declares
  // them. Gradle/Maven/sbt markers are a secondary signal, so a single-module
  // project with a declared-but-absent module still behaves normally.
  const jvmModuleDirs = _jvmModuleSourceDirs(cwd, ignorePatterns, new Set(opts.exclude || []));
  const nestedModuleDirs = jvmModuleDirs.filter((c) => c.name.includes('/src/'));
  const isJvmMultiModule = nestedModuleDirs.length >= 2 || (nestedModuleDirs.length >= 1 && _hasMultiModuleMarker(cwd));
  if (isJvmMultiModule) {
    const have = new Set(candidates.map((c) => c.name));
    for (const c of jvmModuleDirs) {
      if (!have.has(c.name)) candidates.push(c);
    }
  }

  // Score each candidate
  const scored = candidates
    .map(({ name, full }) => ({
      dir:   name,
      full,
      score: scoreCandidate(name, full, context),
    }))
    .filter(c => c.score > 0)
    // Final tie-break on dir keeps selection deterministic when scores tie — the
    // top-MAX_ROOTS slice below would otherwise admit different dirs run to run
    // (candidate order comes from filesystem readdir), changing which files are
    // collected and making the generated context non-reproducible.
    .sort((a, b) => b.score - a.score || a.dir.localeCompare(b.dir));

  // Handle special rules
  let roots = _applySpecialRules(scored, cwd, primaryFw, fwEntry, frameworks, new Set(opts.exclude || []));

  // Dedupe nested paths (prefer parent)
  roots = _dedupeNested(roots);

  // Cap at MAX_ROOTS — raised for a multi-module JVM build, where one root
  // per module is the correct answer rather than over-detection.
  const cap = isJvmMultiModule ? MAX_JVM_MODULE_ROOTS : MAX_ROOTS;
  roots = roots.slice(0, cap).map(r => r.dir);

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
    monorepo,
    isJvmMultiModule,
  };
}

function _enumerateCandidates(cwd, isMonorepo, ignorePatterns, excludeList) {
  const candidates = [];
  const excSet     = new Set(excludeList);

  // Root-level dirs (sorted so candidate order — and downstream dedupe/selection
  // — is deterministic regardless of filesystem readdir order)
  try {
    const rootEntries = fs.readdirSync(cwd, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const e of rootEntries) {
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
          for (const jvmLang of ['java', 'kotlin', 'scala', 'groovy']) {
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
    'src/main/java','src/main/kotlin','src/main/scala','src/main/groovy',
    'src-tauri/src','Sources/App','app/src/main/java','app/src/main/kotlin','app/src/main/scala',
    'src/test/java','src/test/kotlin','src/test/groovy',
  ];
  for (const dp of DEEP_PATHS) {
    const full = path.join(cwd, dp);
    if (fs.existsSync(full)) candidates.push({ name: dp, full });
  }

  return candidates;
}

// A flat layout keeps its source at the repo root — the normal shape of a Go
// module, and common in C and single-file-per-package Rust. `_enumerateCandidates`
// only ever walks DIRECTORIES, so `.` could never be selected no matter how much
// source sat there: a fresh `gin` clone detected
// ["internal","binding","render","codec","ginS","testdata"] and left `gin.go`,
// `routergroup.go`, `context.go` and `tree.go` invisible, with nothing warning
// (#805). Two structural signals qualify the root, deliberately not one tuned
// ratio:
//
//   A. a Go module — `go.mod` at the root means the root IS a package, which is
//      the toolchain's own model. Measured across 43 cached benchmark repos this
//      selects exactly the four Go modules (cobra, echo, gin, gorm) and nothing
//      else; every non-Go repo has zero root-level `.go` files.
//   B. the root holds a meaningful share of the tree's code. The margin is wide:
//      the Go repos sit at 10-69% while every other repo is at or below 4%.
const ROOT_MIN_FILES = 3;
const ROOT_MIN_SHARE = 0.20;
const ROOT_SCORE     = 9.0;   // above any scored subdirectory, so `.` sorts first

/** Code files directly in `dir` (non-recursive). */
function _directCodeFiles(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && CODE_EXTS.has(path.extname(e.name))).length;
  } catch (_) { return 0; }
}

/**
 * Code files in the whole tree, bounded in depth, skipping vendor directories
 * and stopping at NESTED REPOSITORIES — a vendored or cloned repo is not this
 * repo's source, and walking one is both wrong and expensive.
 */
function _treeCodeFiles(dir, excSet, depth = 0) {
  if (depth > 6) return 0;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return _directCodeFiles(dir); }
  if (depth > 0 && entries.some((e) => e.name === '.git')) return 0;
  let n = _directCodeFiles(dir);
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (AUTO_SKIP.has(e.name) || excSet.has(e.name) || e.name.startsWith('.')) continue;
    n += _treeCodeFiles(path.join(dir, e.name), excSet, depth + 1);
  }
  return n;
}

/**
 * Whether the repo root is itself a source root, and why.
 * @returns {{ score: number, reason: string }|null}
 */
function _flatLayoutRoot(cwd, excSet) {
  const rootFiles = _directCodeFiles(cwd);
  if (rootFiles === 0) return null;

  // A — a Go module's root is a package by definition.
  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    let goFiles = 0;
    try {
      goFiles = fs.readdirSync(cwd, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.go')).length;
    } catch (_) {}
    if (goFiles > 0) {
      return { score: ROOT_SCORE, reason: `go.mod with ${goFiles} root-level .go file(s)` };
    }
  }

  // B — the root holds a meaningful share of the tree's code.
  if (rootFiles < ROOT_MIN_FILES) return null;
  const total = _treeCodeFiles(cwd, excSet);
  if (total === 0) return null;
  const share = rootFiles / total;
  if (share >= ROOT_MIN_SHARE) {
    return { score: ROOT_SCORE, reason: `${rootFiles} of ${total} code files at the root (${Math.round(share * 100)}%)` };
  }
  return null;
}

function _applySpecialRules(scored, cwd, primaryFw, fwEntry, frameworks, excSet = new Set()) {
  let roots = [...scored];

  // Flat layout: the root is a source root. Added here rather than as an
  // ordinary candidate because `scoreCandidate` scores directory NAMES against
  // the framework registry, and `.` is not a name it can reason about.
  const flatRoot = _flatLayoutRoot(cwd, excSet);
  if (flatRoot && !roots.find((r) => r.dir === '.')) {
    roots.push({ dir: '.', full: cwd, score: flatRoot.score, reason: flatRoot.reason });
    roots.sort((a, b) => b.score - a.score || a.dir.localeCompare(b.dir));
  }

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
    roots.sort((a, b) => b.score - a.score || a.dir.localeCompare(b.dir));
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
    roots.sort((a, b) => b.score - a.score || a.dir.localeCompare(b.dir));
  }

  return roots;
}

function _dedupeNested(scored) {
  const result = [];
  for (const c of scored) {
    const cNorm = c.dir.replace(/\\/g, '/');
    const isNested = result.some(r => {
      const rNorm = r.dir.replace(/\\/g, '/');
      // `.` is the parent of everything, but `'internal'.startsWith('./')` is
      // false, so without this a flat layout would return ['.', 'internal', …]
      // and walk the same files twice.
      if (rNorm === '.') return cNorm !== '.';
      return cNorm.startsWith(rNorm + '/');
    });
    if (!isNested) result.push(c);
  }
  return result;
}

function _computeConfidence(frameworks, languages, scoredCount) {
  if (frameworks.length > 0 && frameworks[0].confidence >= 0.90) return 'high';
  if (languages.length > 0 && scoredCount > 0) return 'medium';
  return 'low';
}
