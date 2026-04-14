#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIGMAP_ROOT = path.resolve(__dirname, '..');
const SIGMAP_CLI = path.join(SIGMAP_ROOT, 'gen-context.js');

const DEFAULT_CONFIG = {
  output: '.github/copilot-instructions.md',
  outputs: ['copilot'],
  srcDirs: [
    'src', 'app', 'lib', 'packages', 'services', 'api',
    'server', 'client', 'web', 'frontend', 'backend',
    'desktop', 'mobile', 'shared', 'common', 'core',
    'workers', 'functions', 'lambda', 'cmd',
    'pages', 'components', 'hooks', 'routes', 'controllers',
    'models', 'views', 'resources', 'config', 'db',
    'projects', 'apps', 'libs', 'instance', 'blueprints',
  ],
  exclude: [
    'node_modules', '.git', 'dist', 'build', 'out',
    '__pycache__', '.next', 'coverage', 'target', 'vendor',
    '.context',
  ],
  maxDepth: 6,
  maxSigsPerFile: 25,
  maxTokens: 6000,
  secretScan: true,
  monorepo: false,
  diffPriority: true,
  mcp: { autoRegister: true },
  strategy: 'full',
  hotCommits: 10,
  depMap: true,
  todos: true,
  changes: true,
  changesCommits: 5,
  testCoverage: false,
  testDirs: ['tests', 'src/test', 'test', '__tests__', 'spec'],
  impactRadius: false,
};

const STRATEGIES = ['full', 'per-module', 'hot-cold'];

const SUPPORTED_EXTENSIONS = new Map([
  ['.ts', 'typescript'], ['.tsx', 'typescript'],
  ['.js', 'javascript'], ['.jsx', 'javascript'], ['.mjs', 'javascript'], ['.cjs', 'javascript'],
  ['.py', 'python'], ['.pyw', 'python'],
  ['.java', 'java'],
  ['.kt', 'kotlin'], ['.kts', 'kotlin'],
  ['.go', 'go'],
  ['.rs', 'rust'],
  ['.cs', 'csharp'],
  ['.cpp', 'cpp'], ['.c', 'cpp'], ['.h', 'cpp'], ['.hpp', 'cpp'], ['.cc', 'cpp'],
  ['.rb', 'ruby'], ['.rake', 'ruby'],
  ['.php', 'php'],
  ['.swift', 'swift'],
  ['.dart', 'dart'],
  ['.scala', 'scala'], ['.sc', 'scala'],
  ['.vue', 'vue'],
  ['.svelte', 'svelte'],
  ['.html', 'html'], ['.htm', 'html'],
  ['.css', 'css'], ['.scss', 'css'], ['.sass', 'css'], ['.less', 'css'],
  ['.yml', 'yaml'], ['.yaml', 'yaml'],
  ['.sh', 'shell'], ['.bash', 'shell'], ['.zsh', 'shell'], ['.fish', 'shell'],
  // P1 languages
  ['.sql', 'sql'],
  ['.graphql', 'graphql'], ['.gql', 'graphql'],
  ['.tf', 'terraform'], ['.tfvars', 'terraform'],
  ['.proto', 'protobuf'],
  // Phase A formats
  ['.toml', 'toml'],
  ['.properties', 'properties'],
  ['.xml', 'xml'],
  ['.md', 'markdown'],
]);

const IMPORTANT_UNSUPPORTED_EXTENSIONS = new Set([
  '.ini', '.env', '.gradle',
]);

const IMPORTANT_FILE_NAMES = new Set([
  'Dockerfile', 'README', 'README.md', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  'settings.gradle', 'settings.gradle.kts', '.gitpod.yml', 'docker-compose.yml',
]);

// Common top-level code-holding folder names (language/framework agnostic)
const COMMON_CODE_DIRS = new Set([
  'src', 'app', 'lib', 'packages', 'services', 'api', 'core', 'cmd',
  'internal', 'pkg', 'handlers', 'controllers', 'models', 'views',
  'components', 'pages', 'routes', 'middleware', 'utils', 'helpers',
  'modules', 'plugins', 'extensions', 'adapters', 'drivers',
  'examples', 'sample', 'demo', 'tests', 'test', 'spec', '__tests__',
  'hooks', 'composables', 'stores', 'features', 'domain', 'infra',
  'infrastructure', 'application', 'presentation', 'data', 'di',
  'Sources', 'Tests',
]);

/**
 * Detect src directories for a repo by reading manifest files and scanning
 * top-level folders for actual source files.
 *
 * @param {string} repoDir
 * @param {string[]} excludeList
 * @returns {string[]} Ordered list of srcDirs that exist in the repo
 */
function detectAutoSrcDirs(repoDir, excludeList) {
  const candidates = new Set(DEFAULT_CONFIG.srcDirs);

  // ── Manifest-based detection ──────────────────────────────────────────────

  // Node.js / JavaScript / TypeScript ecosystem
  const pkgPath = path.join(repoDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
      // React / Next.js
      if (allDeps.react || allDeps.next) {
        for (const d of ['src', 'app', 'pages', 'components', 'hooks', 'lib', 'utils']) candidates.add(d);
      }
      // Angular
      if (allDeps['@angular/core']) {
        for (const d of ['src', 'projects', 'apps', 'libs']) candidates.add(d);
      }
      // NestJS
      if (allDeps['@nestjs/core']) {
        for (const d of ['src', 'libs', 'apps']) candidates.add(d);
      }
      // Vue
      if (allDeps.vue) {
        for (const d of ['src', 'components', 'views', 'stores', 'composables', 'plugins']) candidates.add(d);
      }
      // Svelte
      if (allDeps.svelte || allDeps['@sveltejs/kit']) {
        for (const d of ['src', 'lib', 'routes']) candidates.add(d);
      }
      // Monorepo root  (nx/turborepo/lerna)
      if (allDeps.nx || allDeps.turbo || allDeps.lerna || pkg.workspaces) {
        for (const d of ['packages', 'apps', 'libs', 'services']) candidates.add(d);
      }
    } catch (_) {}
  }

  // Python ecosystem
  const hasPyproject = fs.existsSync(path.join(repoDir, 'pyproject.toml'));
  const hasRequirements = fs.existsSync(path.join(repoDir, 'requirements.txt'));
  const hasSetupPy = fs.existsSync(path.join(repoDir, 'setup.py'));
  const hasSetupCfg = fs.existsSync(path.join(repoDir, 'setup.cfg'));

  if (hasPyproject || hasRequirements || hasSetupPy || hasSetupCfg) {
    for (const d of ['src', 'app', 'tests', 'examples']) candidates.add(d);
    if (hasPyproject) {
      try {
        const content = fs.readFileSync(path.join(repoDir, 'pyproject.toml'), 'utf8');
        if (content.includes('flask') || content.includes('fastapi') || content.includes('django')) {
          for (const d of ['app', 'tests', 'alembic']) candidates.add(d);
        }
      } catch (_) {}
    }
    // Common Python src-layout: src/<package-name>/
    const srcDir = path.join(repoDir, 'src');
    if (fs.existsSync(srcDir)) {
      try {
        for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
            candidates.add(`src/${entry.name}`);
          }
        }
      } catch (_) {}
    }
  }

  // Ruby / Rails
  if (fs.existsSync(path.join(repoDir, 'Gemfile'))) {
    for (const d of ['app', 'lib', 'config', 'db', 'spec', 'test']) candidates.add(d);
  }

  // PHP / Laravel
  if (fs.existsSync(path.join(repoDir, 'composer.json'))) {
    for (const d of ['app', 'resources', 'routes', 'database', 'tests']) candidates.add(d);
  }

  // Go
  if (fs.existsSync(path.join(repoDir, 'go.mod'))) {
    for (const d of ['cmd', 'internal', 'pkg', 'api', 'handler', 'handlers', 'middleware', 'service', 'services']) candidates.add(d);
  }

  // Rust / Cargo
  if (fs.existsSync(path.join(repoDir, 'Cargo.toml'))) {
    for (const d of ['src', 'crates', 'examples', 'tests', 'benches']) candidates.add(d);
  }

  // JVM: Java / Kotlin / Scala (Gradle or Maven)
  const hasGradle = fs.existsSync(path.join(repoDir, 'build.gradle')) ||
                    fs.existsSync(path.join(repoDir, 'build.gradle.kts'));
  const hasMaven = fs.existsSync(path.join(repoDir, 'pom.xml'));
  const hasSettings = fs.existsSync(path.join(repoDir, 'settings.gradle')) ||
                      fs.existsSync(path.join(repoDir, 'settings.gradle.kts'));
  if (hasGradle || hasMaven || hasSettings) {
    for (const d of [
      'src/main/java', 'src/main/kotlin', 'src/main/scala',
      'src/main/resources', 'src/test/java', 'src/test/kotlin',
    ]) candidates.add(d);
  }

  // Dart / Flutter
  if (fs.existsSync(path.join(repoDir, 'pubspec.yaml'))) {
    for (const d of ['lib', 'test', 'integration_test', 'example', 'bin']) candidates.add(d);
  }

  // Swift (Swift Package Manager)
  if (fs.existsSync(path.join(repoDir, 'Package.swift'))) {
    for (const d of ['Sources', 'Tests']) candidates.add(d);
  }

  // ── Top-level directory scan ──────────────────────────────────────────────
  // Add any top-level folder that: (a) has a common code-dir name, OR
  // (b) directly contains supported source files (for project-name dirs like /absl/)
  try {
    const topEntries = fs.readdirSync(repoDir, { withFileTypes: true });
    for (const entry of topEntries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (isExcluded(entry.name, excludeList)) continue;

      const lname = entry.name.toLowerCase();
      if (COMMON_CODE_DIRS.has(entry.name) || COMMON_CODE_DIRS.has(lname)) {
        candidates.add(entry.name);
        continue;
      }

      // For unknown dir names: check if they directly contain source files
      // This catches project-name dirs like absl/, akka-actor/, flask/, etc.
      const dirPath = path.join(repoDir, entry.name);
      try {
        const subEntries = fs.readdirSync(dirPath, { withFileTypes: true });
        const hasSourceFiles = subEntries.some((sub) => {
          if (!sub.isFile()) return false;
          const ext = path.extname(sub.name).toLowerCase();
          return SUPPORTED_EXTENSIONS.has(ext) || sub.name === 'Dockerfile';
        });
        if (hasSourceFiles) {
          candidates.add(entry.name);
          continue;
        }
        // Or contains a src/lib/main sub-folder (e.g. akka-actor/src/main/scala)
        const hasSrcSubdir = subEntries.some((sub) =>
          sub.isDirectory() && ['src', 'lib', 'main', 'java', 'kotlin', 'scala', 'python'].includes(sub.name));
        if (hasSrcSubdir) candidates.add(entry.name);
      } catch (_) {}
    }
  } catch (_) {}

  // ── Filter to only existing directories ───────────────────────────────────
  return Array.from(candidates).filter((d) => {
    try {
      return fs.statSync(path.join(repoDir, d)).isDirectory();
    } catch (_) {
      return false;
    }
  });
}

/**
 * Auto-detect optimal maxDepth by sampling the depth distribution of source
 * files actually present in the repo.
 *
 * @param {string} repoDir
 * @param {string[]} excludeList
 * @returns {number}
 */
function autoDetectMaxDepth(repoDir, excludeList) {
  const depths = [];
  const MAX_SAMPLE = 2000;

  function walk(dir, depth) {
    if (depth > 15 || depths.length >= MAX_SAMPLE) return;
    let entries;
    try { entries = fs.readdirSync(dir); } catch (_) { return; }
    for (const name of entries) {
      if (depths.length >= MAX_SAMPLE) return;
      const fullPath = path.join(dir, name);
      const relPath = safeRelative(repoDir, fullPath);
      if (isExcluded(relPath, excludeList)) continue;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (stat.isFile()) {
          const ext = path.extname(name).toLowerCase();
          if (SUPPORTED_EXTENSIONS.has(ext) || name === 'Dockerfile') {
            depths.push(depth);
          }
        }
      } catch (_) {}
    }
  }

  walk(repoDir, 0);
  if (depths.length === 0) return 7;

  depths.sort((a, b) => a - b);
  const p95 = depths[Math.floor(depths.length * 0.95)];

  if (p95 <= 3) return 5;
  if (p95 <= 5) return 7;
  if (p95 <= 7) return 9;
  return 12; // very deep monorepo / gradle/maven layouts
}

function parseArgs(argv) {
  const args = {
    repo: null,
    out: null,
    keepGenerated: false,
    verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo' || arg === '-r') args.repo = argv[++index];
    else if (arg === '--out' || arg === '-o') args.out = argv[++index];
    else if (arg === '--keep-generated') args.keepGenerated = true;
    else if (arg === '--verbose') args.verbose = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!args.repo) {
    printHelp();
    process.exit(1);
  }

  args.repo = path.resolve(args.repo);
  args.out = args.out
    ? path.resolve(args.out)
    : path.join(args.repo, '.context', 'strategy-audit');

  return args;
}

function printHelp() {
  console.log(`SigMap strategy audit runner

Usage:
  node scripts/run-strategy-audit.mjs --repo /path/to/repo
  node scripts/run-strategy-audit.mjs --repo /path/to/repo --out /tmp/audit

What it does:
  1. Runs SigMap in full, per-module, and hot-cold modes
  2. Saves generated outputs, report JSON, analyze JSON, and stdout logs
  3. Detects missed folders and unsupported high-value file types
  4. Writes a detailed summary with strategy and config recommendations

Options:
  --repo, -r            Target repository to audit
  --out, -o             Output directory (default: <repo>/.context/strategy-audit)
  --keep-generated      Keep the last generated SigMap files in the target repo
  --verbose             Print extra progress logs
  --help, -h            Show this help
`);
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function safeRelative(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function mergeConfig(baseConfig, override) {
  const merged = JSON.parse(JSON.stringify(baseConfig));
  for (const [key, value] of Object.entries(override)) {
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      merged[key] && typeof merged[key] === 'object' && !Array.isArray(merged[key])
    ) {
      merged[key] = { ...merged[key], ...value };
    }
    else {
      merged[key] = value;
    }
  }
  return merged;
}

function loadRepoConfig(repoDir) {
  const configPath = path.join(repoDir, 'gen-context.config.json');
  const excludeList = DEFAULT_CONFIG.exclude;

  if (!fs.existsSync(configPath)) {
    const parsed = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    parsed.srcDirs = detectAutoSrcDirs(repoDir, excludeList);
    parsed.maxDepth = autoDetectMaxDepth(repoDir, excludeList);
    return { exists: false, raw: null, parsed };
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  let parsed = JSON.parse(raw);
  parsed = mergeConfig(DEFAULT_CONFIG, parsed);

  // If no explicit srcDirs in user config, auto-detect
  const userHasSrcDirs = (() => {
    try { return Array.isArray(JSON.parse(raw).srcDirs); } catch (_) { return false; }
  })();
  if (!userHasSrcDirs) {
    parsed.srcDirs = detectAutoSrcDirs(repoDir, parsed.exclude || excludeList);
  }

  // If no explicit maxDepth in user config, auto-detect
  const userHasMaxDepth = (() => {
    try { return typeof JSON.parse(raw).maxDepth === 'number'; } catch (_) { return false; }
  })();
  if (!userHasMaxDepth) {
    parsed.maxDepth = autoDetectMaxDepth(repoDir, parsed.exclude || excludeList);
  }

  return { exists: true, raw, parsed };
}

function listGeneratedFiles(repoDir) {
  const files = [];
  const githubDir = path.join(repoDir, '.github');

  const candidates = [
    path.join(repoDir, 'AGENTS.md'),
    path.join(githubDir, 'copilot-instructions.md'),
    path.join(githubDir, 'context-cold.md'),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) files.push(filePath);
  }

  if (fs.existsSync(githubDir)) {
    for (const name of fs.readdirSync(githubDir)) {
      if (!name.startsWith('context-') || !name.endsWith('.md')) continue;
      const filePath = path.join(githubDir, name);
      if (fs.statSync(filePath).isFile()) files.push(filePath);
    }
  }

  return Array.from(new Set(files));
}

function backupRepoState(repoDir) {
  const backup = new Map();
  const configPath = path.join(repoDir, 'gen-context.config.json');
  if (fs.existsSync(configPath)) backup.set('gen-context.config.json', fs.readFileSync(configPath, 'utf8'));
  else backup.set('gen-context.config.json', null);

  for (const filePath of listGeneratedFiles(repoDir)) {
    backup.set(safeRelative(repoDir, filePath), fs.readFileSync(filePath));
  }

  return backup;
}

function restoreRepoState(repoDir, backup) {
  const currentGenerated = new Set(listGeneratedFiles(repoDir).map((filePath) => safeRelative(repoDir, filePath)));
  for (const relPath of currentGenerated) {
    if (backup.has(relPath)) continue;
    removeIfExists(path.join(repoDir, relPath));
  }

  for (const [relPath, content] of backup.entries()) {
    const targetPath = path.join(repoDir, relPath);
    if (content === null) {
      removeIfExists(targetPath);
      continue;
    }
    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, content);
  }
}

function cleanGeneratedFiles(repoDir) {
  for (const filePath of listGeneratedFiles(repoDir)) removeIfExists(filePath);
}

function runSigmap(args, repoDir) {
  // For large --analyze outputs, avoid stdout buffering by writing to temp file
  const tmpOutFile = path.join(os.tmpdir(), `sigmap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.json`);
  let cleanupPath = null;

  try {
    // Check if this is an --analyze --json call
    if (args.includes('--analyze') && args.includes('--json')) {
      // Redirect output to temp file to avoid Node.js buffer limits
      const combinedArgs = [...args, '>', tmpOutFile];
      const result = spawnSync('sh', ['-c', `node "${SIGMAP_CLI}" ${args.map(a => `"${a}"`).join(' ')} > "${tmpOutFile}"`], {
        cwd: repoDir,
        encoding: 'utf8',
        maxBuffer: 100 * 1024 * 1024,
      });
      cleanupPath = tmpOutFile;
      
      if (fs.existsSync(tmpOutFile)) {
        const stdout = fs.readFileSync(tmpOutFile, 'utf8');
        return { status: result.status || 0, stdout, stderr: result.stderr || '' };
      }
      return {
        status: result.status || 1,
        stdout: '',
        stderr: result.stderr || 'Failed to capture analyze output to file',
      };
    }

    // For non-analyze calls, use execFileSync normally
    const stdout = execFileSync(process.execPath, [SIGMAP_CLI, ...args], {
      cwd: repoDir,
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  }
  catch (error) {
    return {
      status: typeof error.status === 'number' ? error.status : 1,
      stdout: typeof error.stdout === 'string' ? error.stdout : String(error.stdout || ''),
      stderr: typeof error.stderr === 'string' ? error.stderr : String(error.stderr || error.message || ''),
    };
  }
  finally {
    // Cleanup temp file
    if (cleanupPath && fs.existsSync(cleanupPath)) {
      try {
        fs.unlinkSync(cleanupPath);
      } catch (_) {}
    }
  }
}

function parseJsonFromStdout(stdout) {
  const fullText = String(stdout || '').trim();
  if (!fullText) return null;
  try {
    return JSON.parse(fullText);
  }
  catch (_) {}

  const lines = fullText.split('\n').map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith('{')) continue;
    try {
      return JSON.parse(line);
    }
    catch (_) {
      continue;
    }
  }
  return null;
}

function parseStrategyStdout(strategy, stdout) {
  const text = String(stdout || '');
  if (strategy === 'per-module') {
    const moduleMatch = text.match(/per-module:\s+(\d+) modules\s+—\s+(.+)/);
    const totalsMatch = text.match(/overview ~([0-9]+) tokens \(always-on\), modules total ~([0-9]+) tokens \(on-demand\)/);
    return {
      moduleCount: moduleMatch ? Number(moduleMatch[1]) : null,
      modules: moduleMatch ? moduleMatch[2].split(',').map((item) => item.trim()) : [],
      overviewTokens: totalsMatch ? Number(totalsMatch[1]) : null,
      moduleTokens: totalsMatch ? Number(totalsMatch[2]) : null,
    };
  }
  if (strategy === 'hot-cold') {
    const hotMatch = text.match(/hot\s+\(auto-injected\)\s+:\s+(\d+) files ~([0-9]+) tokens/);
    const coldMatch = text.match(/cold\s+\(MCP on-demand\)\s+:\s+(\d+) files ~([0-9]+) tokens/);
    return {
      hotFiles: hotMatch ? Number(hotMatch[1]) : null,
      hotTokens: hotMatch ? Number(hotMatch[2]) : null,
      coldFiles: coldMatch ? Number(coldMatch[1]) : null,
      coldTokens: coldMatch ? Number(coldMatch[2]) : null,
    };
  }
  return {};
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function copyGeneratedOutputs(repoDir, targetDir) {
  ensureDir(targetDir);
  for (const filePath of listGeneratedFiles(repoDir)) {
    const relPath = safeRelative(repoDir, filePath);
    const outPath = path.join(targetDir, relPath);
    ensureDir(path.dirname(outPath));
    fs.copyFileSync(filePath, outPath);
  }
}

function isExcluded(relPath, excludeList) {
  const normalized = relPath.split(path.sep).join('/');
  return excludeList.some((entry) => {
    const prefix = entry.replace(/\/$/, '');
    return normalized === prefix || normalized.startsWith(`${prefix}/`);
  });
}

function detectFileCategory(fileName, ext) {
  if (fileName === 'Dockerfile' || fileName.startsWith('Dockerfile.')) {
    return { supported: true, importantUnsupported: false, language: 'dockerfile' };
  }
  if (SUPPORTED_EXTENSIONS.has(ext)) {
    return { supported: true, importantUnsupported: false, language: SUPPORTED_EXTENSIONS.get(ext) };
  }
  if (IMPORTANT_UNSUPPORTED_EXTENSIONS.has(ext) || IMPORTANT_FILE_NAMES.has(fileName)) {
    return { supported: false, importantUnsupported: true, language: null };
  }
  return { supported: false, importantUnsupported: false, language: null };
}

function discoverFiles(repoDir, excludeList) {
  const discovered = [];

  function walk(currentDir) {
    for (const name of fs.readdirSync(currentDir)) {
      const fullPath = path.join(currentDir, name);
      const relPath = safeRelative(repoDir, fullPath);
      if (isExcluded(relPath, excludeList)) continue;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!stat.isFile()) continue;
      const ext = path.extname(name).toLowerCase();
      const category = detectFileCategory(name, ext);
      discovered.push({
        file: relPath,
        dir: path.dirname(relPath) === '.' ? '.' : path.dirname(relPath).split(path.sep).join('/'),
        ext,
        fileName: name,
        supported: category.supported,
        importantUnsupported: category.importantUnsupported,
        language: category.language,
      });
    }
  }

  walk(repoDir);
  return discovered;
}

function folderBucket(relPath) {
  const parts = relPath.split('/');
  if (parts.length === 1) return '.';
  if (parts[0] === 'src' && parts[1] === 'main' && parts.length >= 3) return parts.slice(0, 3).join('/');
  if (parts[0] === 'src' && parts[1] === 'test' && parts.length >= 3) return parts.slice(0, 3).join('/');
  if ((parts[0] === 'packages' || parts[0] === 'apps' || parts[0] === 'services') && parts.length >= 3) {
    if (['src', 'lib', 'app', 'test', 'tests'].includes(parts[2])) return parts.slice(0, 3).join('/');
    return parts.slice(0, 2).join('/');
  }
  if (['server', 'client', 'web', 'frontend', 'backend', 'desktop', 'mobile'].includes(parts[0])) {
    return parts[0];
  }
  if (parts[0] === '.github' || parts[0] === 'k8s' || parts[0] === 'docs') return parts[0];
  return parts[0];
}

function accumulate(map, key) {
  if (!map.has(key)) {
    map.set(key, {
      folder: key,
      supportedMissing: 0,
      importantMissing: 0,
      analyzedFiles: 0,
      zeroSigFiles: 0,
      totalTokens: 0,
      examples: [],
      unsupportedExts: new Map(),
    });
  }
  return map.get(key);
}

function buildCoverageSummary(repoDir, config, analyzeData) {
  const discovered = discoverFiles(repoDir, config.exclude || DEFAULT_CONFIG.exclude);
  const analyzedEntries = Array.isArray(analyzeData?.files) ? analyzeData.files : [];
  const analyzedFiles = new Map(analyzedEntries.map((entry) => [entry.file, entry]));
  const folderStats = new Map();
  const missingSupportedFiles = [];
  const missingImportantFiles = [];
  const zeroSigFiles = [];
  const analyzedSet = new Set(analyzedFiles.keys());

  for (const file of discovered) {
    const bucket = folderBucket(file.file);
    const folder = accumulate(folderStats, bucket);
    const analyzed = analyzedFiles.get(file.file);

    if (analyzed) {
      folder.analyzedFiles += 1;
      folder.totalTokens += analyzed.tokens || 0;
      if ((analyzed.sigs || 0) === 0 || (analyzed.tokens || 0) === 0) {
        folder.zeroSigFiles += 1;
        zeroSigFiles.push({ file: file.file, extractor: analyzed.extractor, folder: bucket });
      }
      continue;
    }

    if (file.supported) {
      folder.supportedMissing += 1;
      if (folder.examples.length < 5) folder.examples.push(file.file);
      missingSupportedFiles.push({ file: file.file, folder: bucket, language: file.language });
    }
    else if (file.importantUnsupported) {
      folder.importantMissing += 1;
      const extKey = file.ext || file.fileName;
      folder.unsupportedExts.set(extKey, (folder.unsupportedExts.get(extKey) || 0) + 1);
      if (folder.examples.length < 5) folder.examples.push(file.file);
      missingImportantFiles.push({ file: file.file, folder: bucket, ext: extKey });
    }
  }

  const currentSrcDirs = new Set((config.srcDirs || []).map((entry) => entry.replace(/\\/g, '/').replace(/\/$/, '')));
  const recommendedSrcDirs = Array.from(folderStats.values())
    .filter((folder) => folder.supportedMissing > 0)
    .filter((folder) => folder.folder !== '.')
    .filter((folder) => !currentSrcDirs.has(folder.folder))
    .sort((left, right) => right.supportedMissing - left.supportedMissing || right.importantMissing - left.importantMissing || left.folder.localeCompare(right.folder))
    .slice(0, 8)
    .map((folder) => ({
      folder: folder.folder,
      reason: `${folder.supportedMissing} supported files are outside current coverage`,
      examples: folder.examples,
    }));

  const manualIndexFolders = Array.from(folderStats.values())
    .filter((folder) => folder.importantMissing > 0)
    .sort((left, right) => right.importantMissing - left.importantMissing || left.folder.localeCompare(right.folder))
    .slice(0, 8)
    .map((folder) => ({
      folder: folder.folder,
      importantMissing: folder.importantMissing,
      unsupportedExts: Array.from(folder.unsupportedExts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
      examples: folder.examples,
    }));

  const weakExtractorFolders = Array.from(folderStats.values())
    .filter((folder) => folder.zeroSigFiles >= 2)
    .sort((left, right) => right.zeroSigFiles - left.zeroSigFiles || left.folder.localeCompare(right.folder))
    .slice(0, 8)
    .map((folder) => ({
      folder: folder.folder,
      zeroSigFiles: folder.zeroSigFiles,
      analyzedFiles: folder.analyzedFiles,
      totalTokens: folder.totalTokens,
    }));

  return {
    discoveredFileCount: discovered.length,
    analyzedFileCount: analyzedSet.size,
    missingSupportedFiles,
    missingImportantFiles,
    zeroSigFiles,
    recommendedSrcDirs,
    manualIndexFolders,
    weakExtractorFolders,
  };
}

function chooseRecommendedStrategy(results) {
  const full = results.full || {};
  const perModule = results['per-module'] || {};
  const hotCold = results['hot-cold'] || {};

  const perOverview = perModule.stdoutMetrics?.overviewTokens;
  const perModules = perModule.stdoutMetrics?.moduleCount;
  const hotTokens = hotCold.stdoutMetrics?.hotTokens;
  const hotFiles = hotCold.stdoutMetrics?.hotFiles;
  const coldFiles = hotCold.stdoutMetrics?.coldFiles;
  const fullTokens = full.report?.finalTokens;

  if (hotTokens && fullTokens && hotTokens <= Math.floor(fullTokens * 0.4) && (coldFiles || 0) > 0) {
    return {
      strategy: 'hot-cold',
      reason: 'hot-cold meaningfully shrinks always-injected context while keeping cold files accessible on demand.',
    };
  }

  if (perOverview && fullTokens && perOverview <= Math.floor(fullTokens * 0.25) && (perModules || 0) >= 3) {
    return {
      strategy: 'per-module',
      reason: 'per-module keeps the always-on overview small and still preserves full module context without MCP dependency.',
    };
  }

  if (hotFiles && coldFiles === 0) {
    return {
      strategy: 'per-module',
      reason: 'hot-cold is not buying anything because nearly the entire repo is classified as hot.',
    };
  }

  return {
    strategy: 'full',
    reason: 'full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.',
  };
}

function buildSuggestedConfig(baseConfig, recommendation, coverageSummary) {
  const suggested = JSON.parse(JSON.stringify(baseConfig));
  suggested.strategy = recommendation.strategy;
  if (coverageSummary.recommendedSrcDirs.length > 0) {
    const merged = new Set([...(baseConfig.srcDirs || []), ...coverageSummary.recommendedSrcDirs.map((entry) => entry.folder)]);
    suggested.srcDirs = Array.from(merged);
  }
  // Keep the auto-detected maxDepth in the suggestion
  // (already reflected in baseConfig if auto-detected)
  return suggested;
}

function renderStrategyTable(results) {
  const rows = [];
  rows.push('| Strategy | Final tokens | Key shape | Extra metrics |');
  rows.push('|---|---:|---|---|');
  for (const name of STRATEGIES) {
    const result = results[name];
    const finalTokens = result.report?.finalTokens ?? 'n/a';
    let shape = 'single full file';
    let extra = 'n/a';
    if (name === 'per-module') {
      shape = 'overview + module files';
      const overview = result.stdoutMetrics?.overviewTokens ?? 'n/a';
      const modules = result.stdoutMetrics?.moduleTokens ?? 'n/a';
      extra = `overview ${overview}, modules ${modules}`;
    }
    else if (name === 'hot-cold') {
      shape = 'hot primary + cold on-demand';
      const hot = result.stdoutMetrics?.hotTokens ?? 'n/a';
      const cold = result.stdoutMetrics?.coldTokens ?? 'n/a';
      extra = `hot ${hot}, cold ${cold}`;
    }
    rows.push(`| ${name} | ${finalTokens} | ${shape} | ${extra} |`);
  }
  return rows.join('\n');
}

function renderCoverageTable(coverageSummary) {
  const rows = [];
  rows.push('| Coverage signal | Count |');
  rows.push('|---|---:|');
  rows.push(`| Discovered files | ${coverageSummary.discoveredFileCount} |`);
  rows.push(`| Files analyzed by SigMap | ${coverageSummary.analyzedFileCount} |`);
  rows.push(`| Supported files missing from analysis | ${coverageSummary.missingSupportedFiles.length} |`);
  rows.push(`| Important unsupported files missing from analysis | ${coverageSummary.missingImportantFiles.length} |`);
  rows.push(`| Analyzed files with 0 signatures or 0 tokens | ${coverageSummary.zeroSigFiles.length} |`);
  return rows.join('\n');
}

function renderListSection(title, items, formatter, emptyMessage) {
  const lines = [`## ${title}`];
  if (!items.length) {
    lines.push('');
    lines.push(emptyMessage);
    lines.push('');
    return lines.join('\n');
  }
  lines.push('');
  for (const item of items) lines.push(formatter(item));
  lines.push('');
  return lines.join('\n');
}

function buildSummaryMarkdown(repoDir, outputDir, results, coverageSummary, recommendation, suggestedConfig, repoConfig) {
  const lines = [];
  lines.push('# SigMap Strategy Audit');
  lines.push('');
  lines.push(`- Repo: \`${repoDir}\``);
  lines.push(`- Output directory: \`${outputDir}\``);
  lines.push(`- Recommended strategy: \`${recommendation.strategy}\``);
  lines.push(`- Why: ${recommendation.reason}`);
  if (!repoConfig.exists) {
    lines.push(`- srcDirs (auto-detected): ${suggestedConfig.srcDirs.map((d) => `\`${d}\``).join(', ')}`);
    lines.push(`- maxDepth (auto-detected): \`${suggestedConfig.maxDepth}\``);
  }
  lines.push('');
  lines.push('## Strategy comparison');
  lines.push('');
  lines.push(renderStrategyTable(results));
  lines.push('');
  lines.push('## Coverage summary');
  lines.push('');
  lines.push(renderCoverageTable(coverageSummary));
  lines.push('');
  lines.push('## Suggested config');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(suggestedConfig, null, 2));
  lines.push('```');
  lines.push('');
  lines.push(renderListSection(
    'Recommended srcDirs additions',
    coverageSummary.recommendedSrcDirs,
    (item) => `- \`${item.folder}\` — ${item.reason}. Examples: ${item.examples.join(', ')}`,
    'No supported folders were found outside the current scan coverage.'
  ));
  lines.push(renderListSection(
    'Folders needing manual indexing or extractor support',
    coverageSummary.manualIndexFolders,
    (item) => `- \`${item.folder}\` — ${item.importantMissing} high-value files not analyzed. Extensions: ${item.unsupportedExts.map(([ext, count]) => `${ext} (${count})`).join(', ')}. Examples: ${item.examples.join(', ')}`,
    'No high-value unsupported folders were detected.'
  ));
  lines.push(renderListSection(
    'Folders where extractors are weak',
    coverageSummary.weakExtractorFolders,
    (item) => `- \`${item.folder}\` — ${item.zeroSigFiles} analyzed files produced 0 signatures or 0 tokens out of ${item.analyzedFiles} analyzed files.`,
    'No obvious weak-extractor folders were detected.'
  ));
  lines.push('## Strategy artifacts');
  lines.push('');
  for (const strategy of STRATEGIES) {
    lines.push(`### ${strategy}`);
    lines.push('');
    lines.push(`- Report: \`strategies/${strategy}/report.json\``);
    lines.push(`- Analyze: \`strategies/${strategy}/analyze.json\``);
    lines.push(`- Stdout log: \`strategies/${strategy}/stdout.log\``);
    lines.push(`- Generated outputs: \`strategies/${strategy}/outputs/\``);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function runStrategyAudit(repoDir, outDir, keepGenerated, verbose) {
  const repoConfig = loadRepoConfig(repoDir);
  const backup = backupRepoState(repoDir);
  const configPath = path.join(repoDir, 'gen-context.config.json');
  const results = {};

  removeIfExists(outDir);
  ensureDir(outDir);

  try {
    for (const strategy of STRATEGIES) {
      log(`\n[strategy] ${strategy}`);

      const mergedConfig = mergeConfig(repoConfig.parsed, { strategy });
      fs.writeFileSync(configPath, `${JSON.stringify(mergedConfig, null, 2)}\n`);
      cleanGeneratedFiles(repoDir);

      const generate = runSigmap([], repoDir);
      const report = runSigmap(['--report', '--json'], repoDir);
      const analyze = runSigmap(['--analyze', '--json'], repoDir);

      if (generate.status !== 0 || report.status !== 0 || analyze.status !== 0) {
        throw new Error(`strategy ${strategy} failed:\n${generate.stderr || report.stderr || analyze.stderr}`);
      }

      const strategyDir = path.join(outDir, 'strategies', strategy);
      ensureDir(strategyDir);
      fs.writeFileSync(path.join(strategyDir, 'stdout.log'), String(generate.stdout || ''));
      fs.writeFileSync(path.join(strategyDir, 'stderr.log'), String(generate.stderr || ''));
      fs.writeFileSync(path.join(strategyDir, 'report.stdout.log'), String(report.stdout || ''));
      fs.writeFileSync(path.join(strategyDir, 'analyze.stdout.log'), String(analyze.stdout || ''));

      const reportJson = parseJsonFromStdout(report.stdout);
      const analyzeJson = parseJsonFromStdout(analyze.stdout);
      if (!reportJson) throw new Error(`strategy ${strategy} returned unreadable report JSON`);
      if (!analyzeJson) throw new Error(`strategy ${strategy} returned unreadable analyze JSON`);
      writeJson(path.join(strategyDir, 'report.json'), reportJson);
      writeJson(path.join(strategyDir, 'analyze.json'), analyzeJson);
      copyGeneratedOutputs(repoDir, path.join(strategyDir, 'outputs'));

      const stdoutMetrics = parseStrategyStdout(strategy, generate.stdout);
      results[strategy] = {
        strategy,
        report: reportJson,
        analyze: analyzeJson,
        stdoutMetrics,
      };

      if (verbose) {
        log(`  final tokens: ${reportJson?.finalTokens ?? 'n/a'}`);
      }
    }

    const coverageSummary = buildCoverageSummary(repoDir, repoConfig.parsed, results.full?.analyze || { files: [] });
    const recommendation = chooseRecommendedStrategy(results);
    const suggestedConfig = buildSuggestedConfig(repoConfig.parsed, recommendation, coverageSummary);

    const summaryJson = {
      repo: repoDir,
      recommendedStrategy: recommendation,
      currentConfig: repoConfig.parsed,
      suggestedConfig,
      coverageSummary,
      strategies: results,
    };

    writeJson(path.join(outDir, 'summary.json'), summaryJson);
    fs.writeFileSync(
      path.join(outDir, 'summary.md'),
      buildSummaryMarkdown(repoDir, outDir, results, coverageSummary, recommendation, suggestedConfig, repoConfig)
    );
    writeJson(path.join(outDir, 'suggested-config.json'), suggestedConfig);

    if (!keepGenerated) {
      restoreRepoState(repoDir, backup);
    }

    log(`\n[audit] wrote ${path.join(outDir, 'summary.md')}`);
    return summaryJson;
  }
  catch (error) {
    restoreRepoState(repoDir, backup);
    throw error;
  }
}

const args = parseArgs(process.argv.slice(2));

try {
  const result = runStrategyAudit(args.repo, args.out, args.keepGenerated, args.verbose);
  log(`\n[recommended] ${result.recommendedStrategy.strategy} — ${result.recommendedStrategy.reason}`);
}
catch (error) {
  console.error(`[audit] ${error.message}`);
  process.exit(1);
}