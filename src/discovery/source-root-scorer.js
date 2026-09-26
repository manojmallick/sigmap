'use strict';

const fs   = require('fs');
const path = require('path');
const { git } = require('../util/git');

const CODE_EXTS = new Set([
  '.js','.mjs','.cjs','.ts','.tsx','.jsx',
  '.py','.rb','.go','.rs','.java','.kt',
  '.cs','.cpp','.c','.h','.swift','.dart','.scala','.php','.lua',
]);

const AUTO_SKIP = new Set([
  'node_modules','dist','build','.git','.next','.nuxt','vendor',
  'DerivedData','Pods','target','coverage','__pycache__','.venv','venv',
  '.build','Carthage','storybook-static','.gradle','bin','obj','.vs',
]);

const PENALTY_DIRS = new Set([
  'test','tests','spec','__tests__','e2e','docs','doc','docs-vp',
  'examples','example','fixtures','mocks','__mocks__','demo','samples','migrations',
  'benchmarks','scripts',
]);

// Matches a JVM source root anywhere in a path, for any SOURCE SET.
//
// Two separate misses were hiding behind the original anchored `src/main/...`
// form. It never matched `<module>/src/main/kotlin`, the standard Gradle
// multi-module layout, so every module in a 27-module build scored 0. And it
// assumed the source set is always called `main`, which Kotlin Multiplatform
// has not been true of for years — okhttp's core keeps 307 files under
// `okhttp/src/jvmMain/kotlin` and `src/androidMain/kotlin`.
//
// Test source sets (`src/test`, `src/commonTest`, `src/androidHostTest`) are
// excluded here; they are indexed separately and must not become src roots.
const JVM_PATH_PATTERN = /(^|\/)(app\/)?src\/(?!.*[Tt]est)[A-Za-z0-9_]+\/(java|kotlin|scala)$/;

const ROOT_ENTRYPOINTS = {
  go:         ['main.go'],
  python:     ['app.py','main.py','wsgi.py','asgi.py'],
  javascript: ['index.js','server.js','app.js'],
  typescript: ['index.ts','main.ts'],
  rust:       [],
  php:        ['index.php'],
};

function getRecentlyChangedDirs(cwd) {
  try {
    const out = git(['log', '--name-only', '--format=', 'HEAD~10'], { cwd, timeout: 3000 }).toString();
    return new Set(out.split('\n').filter(Boolean).map(f => f.split('/')[0]));
  } catch { return new Set(); }
}

function scoreCandidate(dirName, fullPath, context) {
  const { frameworks, languages, recentDirs, frameworkSrcDirs, entrypoints, frameworkPenalties } = context;

  // Auto-skip noise
  if (AUTO_SKIP.has(dirName)) return -99;
  if (!fs.existsSync(fullPath)) return -99;

  let score = 0;

  // JVM paths (Java, Kotlin, Scala) get highest priority: +5.0
  if (JVM_PATH_PATTERN.test(dirName)) score += 5.0;

  // Framework match: +3.0 if this dir is in the framework's srcDirs
  if (frameworkSrcDirs.has(dirName)) score += 3.0;

  // Count source files in dir (depth 2)
  const sourceFileCount = _countSourceFiles(fullPath, 2);
  const density = Math.min(1.0, sourceFileCount / 10);

  // Language density: +2.5
  score += density * 2.5;

  // Symbol density: +2.0 if ≥3 source files
  if (sourceFileCount >= 3) score += 2.0;

  // Entrypoint: +1.5 if a known entrypoint lives in this dir
  if ((entrypoints || []).some(ep => ep.startsWith(dirName + '/'))) score += 1.5;

  // Manifest proximity: +1.0 if a manifest file is in this dir
  if (fs.existsSync(path.join(fullPath, 'package.json')) ||
      fs.existsSync(path.join(fullPath, 'go.mod')) ||
      fs.existsSync(path.join(fullPath, 'Cargo.toml')) ||
      fs.existsSync(path.join(fullPath, 'pom.xml'))) {
    score += 1.0;
  }

  // Git activity bonus: +2.0 if recently committed files exist here
  if (recentDirs.has(dirName)) score += 2.0;

  // Noise penalty: -3.0 (unless directory is in framework's srcDirs)
  if (PENALTY_DIRS.has(dirName.toLowerCase()) && !frameworkSrcDirs.has(dirName)) score -= 3.0;

  // Framework penalty dirs
  if ((frameworkPenalties || []).includes(dirName)) score -= 3.0;

  return Math.round(score * 100) / 100;
}

function _countSourceFiles(dir, depth) {
  if (depth <= 0) return 0;
  let count = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile() && CODE_EXTS.has(path.extname(e.name).toLowerCase())) count++;
      else if (e.isDirectory() && depth > 1) count += _countSourceFiles(path.join(dir, e.name), depth - 1);
    }
  } catch (_) {}
  return count;
}

module.exports = { scoreCandidate, getRecentlyChangedDirs, ROOT_ENTRYPOINTS, JVM_PATH_PATTERN };
