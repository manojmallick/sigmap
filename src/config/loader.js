'use strict';

const fs = require('fs');
const path = require('path');
const { DEFAULTS } = require('./defaults');

// Keys that are valid in gen-context.config.json
const KNOWN_KEYS = new Set(Object.keys(DEFAULTS));

// Common top-level folder names that reliably hold source code
const COMMON_CODE_DIRS = new Set([
  'src', 'app', 'lib', 'packages', 'services', 'api', 'core', 'cmd',
  'internal', 'pkg', 'handlers', 'controllers', 'models', 'views',
  'components', 'pages', 'routes', 'middleware', 'utils', 'helpers',
  'modules', 'plugins', 'extensions', 'adapters', 'drivers',
  'examples', 'sample', 'demo', 'tests', 'test', 'spec', '__tests__',
  'hooks', 'composables', 'stores', 'features', 'domain', 'infra',
  'infrastructure', 'application', 'data', 'Sources', 'Tests',
]);

const SUPPORTED_CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw', '.java', '.kt', '.kts', '.go', '.rs', '.cs',
  '.cpp', '.c', '.h', '.hpp', '.cc', '.rb', '.rake', '.php',
  '.swift', '.dart', '.scala', '.sc', '.vue', '.svelte',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.yml', '.yaml', '.sh', '.bash', '.zsh', '.fish',
  '.sql', '.graphql', '.gql', '.tf', '.tfvars', '.proto',
  '.toml', '.properties', '.xml', '.md',
]);

/**
 * Detect source directories for the given project root by reading manifest
 * files and scanning top-level directories for code files.
 *
 * @param {string} cwd - Project root
 * @param {string[]} excludeList - Folders to skip
 * @returns {string[]}
 */
function detectAutoSrcDirs(cwd, excludeList) {
  const excludeSet = new Set(excludeList || []);
  const candidates = new Set(DEFAULTS.srcDirs);

  // ── Manifest-based detection ──────────────────────────────────────────────
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
      if (allDeps.react || allDeps.next) {
        for (const d of ['src', 'app', 'pages', 'components', 'hooks', 'lib', 'utils']) candidates.add(d);
      }
      if (allDeps['@angular/core']) {
        for (const d of ['src', 'projects', 'apps', 'libs']) candidates.add(d);
      }
      if (allDeps['@nestjs/core']) {
        for (const d of ['src', 'libs', 'apps']) candidates.add(d);
      }
      if (allDeps.vue) {
        for (const d of ['src', 'components', 'views', 'stores', 'composables', 'plugins']) candidates.add(d);
      }
      if (allDeps.svelte || allDeps['@sveltejs/kit']) {
        for (const d of ['src', 'lib', 'routes']) candidates.add(d);
      }
      if (allDeps.nx || allDeps.turbo || allDeps.lerna || pkg.workspaces) {
        for (const d of ['packages', 'apps', 'libs', 'services']) candidates.add(d);
      }
    } catch (_) {}
  }

  const hasPyproject = fs.existsSync(path.join(cwd, 'pyproject.toml'));
  const hasRequirements = fs.existsSync(path.join(cwd, 'requirements.txt'));
  const hasSetupPy = fs.existsSync(path.join(cwd, 'setup.py'));
  if (hasPyproject || hasRequirements || hasSetupPy) {
    for (const d of ['src', 'app', 'apps', 'tests', 'examples', 'instance', 'blueprints']) candidates.add(d);
  }

  if (fs.existsSync(path.join(cwd, 'Gemfile'))) {
    for (const d of ['app', 'lib', 'config', 'db', 'spec', 'test']) candidates.add(d);
  }

  if (fs.existsSync(path.join(cwd, 'composer.json'))) {
    for (const d of ['app', 'resources', 'routes', 'database', 'tests']) candidates.add(d);
  }

  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    for (const d of ['cmd', 'internal', 'pkg', 'api', 'handler', 'handlers', 'middleware', 'service']) candidates.add(d);
  }

  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    for (const d of ['src', 'crates', 'examples', 'tests', 'benches']) candidates.add(d);
  }

  const hasGradle = fs.existsSync(path.join(cwd, 'build.gradle')) ||
                    fs.existsSync(path.join(cwd, 'build.gradle.kts'));
  const hasMaven = fs.existsSync(path.join(cwd, 'pom.xml'));
  if (hasGradle || hasMaven) {
    for (const d of [
      'src/main/java', 'src/main/kotlin', 'src/main/scala',
      'src/main/resources', 'src/test/java', 'src/test/kotlin',
    ]) candidates.add(d);
  }

  if (fs.existsSync(path.join(cwd, 'pubspec.yaml'))) {
    for (const d of ['lib', 'test', 'integration_test', 'example', 'bin']) candidates.add(d);
  }

  if (fs.existsSync(path.join(cwd, 'Package.swift'))) {
    for (const d of ['Sources', 'Tests']) candidates.add(d);
  }

  // ── Top-level directory scan ──────────────────────────────────────────────
  try {
    const entries = fs.readdirSync(cwd, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (excludeSet.has(entry.name)) continue;

      const lname = entry.name.toLowerCase();
      if (COMMON_CODE_DIRS.has(entry.name) || COMMON_CODE_DIRS.has(lname)) {
        candidates.add(entry.name);
        continue;
      }
      // Unknown dir: add if it directly contains source files
      const dirPath = path.join(cwd, entry.name);
      try {
        const subs = fs.readdirSync(dirPath, { withFileTypes: true });
        const hasSrc = subs.some((s) => {
          if (!s.isFile()) return false;
          return SUPPORTED_CODE_EXTS.has(path.extname(s.name).toLowerCase()) || s.name === 'Dockerfile';
        });
        if (hasSrc) { candidates.add(entry.name); continue; }
        const hasSrcSub = subs.some((s) =>
          s.isDirectory() && ['src', 'lib', 'main', 'java', 'kotlin', 'scala', 'python'].includes(s.name));
        if (hasSrcSub) candidates.add(entry.name);
      } catch (_) {}
    }
  } catch (_) {}

  // Only return those that exist
  return Array.from(candidates).filter((d) => {
    try { return fs.statSync(path.join(cwd, d)).isDirectory(); } catch (_) { return false; }
  });
}

/**
 * Load and merge configuration for a given working directory.
 *
 * @param {string} cwd - Project root directory
 * @returns {object} Merged config (DEFAULTS + user overrides)
 */
function loadConfig(cwd) {
  const configPath = path.join(cwd, 'gen-context.config.json');
  if (!fs.existsSync(configPath)) {
    const cfg = deepClone(DEFAULTS);
    const detected = detectAutoSrcDirs(cwd, cfg.exclude);
    if (detected.length > 0) cfg.srcDirs = detected;
    return cfg;
  }

  let userConfig;
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    userConfig = JSON.parse(raw);
  } catch (err) {
    console.warn(`[sigmap] config parse error in ${configPath}: ${err.message}`);
    const cfg = deepClone(DEFAULTS);
    const detected = detectAutoSrcDirs(cwd, cfg.exclude);
    if (detected.length > 0) cfg.srcDirs = detected;
    return cfg;
  }

  // Warn on unknown keys (helps catch typos)
  for (const key of Object.keys(userConfig)) {
    if (key.startsWith('_')) continue; // allow _comment etc.
    if (!KNOWN_KEYS.has(key)) {
      console.warn(`[sigmap] unknown config key: "${key}" (ignored)`);
    }
  }

  // Deep merge: top-level known keys from user override defaults
  // For object values (e.g. mcp), merge one level deep
  const merged = deepClone(DEFAULTS);
  for (const key of Object.keys(userConfig)) {
    if (key.startsWith('_')) continue;
    if (!KNOWN_KEYS.has(key)) continue; // skip unknown keys
    const val = userConfig[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val) &&
        typeof merged[key] === 'object' && !Array.isArray(merged[key])) {
      merged[key] = Object.assign({}, merged[key], val);
    } else {
      merged[key] = val;
    }
  }

  // If user didn't specify srcDirs, auto-detect; fall back to DEFAULTS if nothing found
  if (!Array.isArray(userConfig.srcDirs)) {
    const detected = detectAutoSrcDirs(cwd, merged.exclude);
    merged.srcDirs = detected.length > 0 ? detected : deepClone(DEFAULTS.srcDirs);
  }

  // Backward compat (v3.0+): mirror outputs ↔ adapters
  if (merged.adapters && !Array.isArray(merged.adapters)) merged.adapters = null;
  if (!merged.adapters && Array.isArray(merged.outputs)) {
    merged.adapters = merged.outputs.slice();
  } else if (Array.isArray(merged.adapters) && !userConfig.outputs) {
    merged.outputs = merged.adapters.filter((a) => ['copilot','claude','cursor','windsurf'].includes(a));
  }
  return merged;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = { loadConfig };
