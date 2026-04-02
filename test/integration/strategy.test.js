'use strict';

/**
 * Integration tests for context generation strategies: per-module and hot-cold.
 * Validates v1.1 strategy features and their fallback behaviour.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpRepo(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cf-strategy-${name}-`));
  execSync('git init -b main', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });
  return dir;
}

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commit(dir, msg) {
  execSync('git add -A', { cwd: dir, stdio: 'ignore' });
  execSync(`git commit -m "${msg}"`, { cwd: dir, stdio: 'ignore' });
}

function runGenContext(dir, extraArgs = '') {
  const script = path.resolve(__dirname, '../../gen-context.js');
  execSync(`node "${script}" --generate ${extraArgs}`, { cwd: dir, stdio: 'pipe' });
}

function writeConfig(dir, config) {
  writeFile(dir, 'gen-context.config.json', JSON.stringify(config, null, 2));
}

// ---------------------------------------------------------------------------
// per-module strategy
// ---------------------------------------------------------------------------

test('per-module: creates one context-<module>.md per srcDir', () => {
  const dir = makeTmpRepo('per-mod-1');

  writeFile(dir, 'server/index.js', 'function startServer(port) {}');
  writeFile(dir, 'web/index.js', 'function renderApp(req, res) {}');
  commit(dir, 'initial');

  writeConfig(dir, { strategy: 'per-module', srcDirs: ['server', 'web'] });
  runGenContext(dir);

  const githubDir = path.join(dir, '.github');
  const files = fs.readdirSync(githubDir);
  const moduleFiles = files.filter(f => f.startsWith('context-') && f.endsWith('.md'));

  assert.ok(moduleFiles.length >= 2, `Expected ≥2 context-*.md files, got: ${moduleFiles.join(', ')}`);
  assert.ok(moduleFiles.some(f => f === 'context-server.md'), 'context-server.md not found');
  assert.ok(moduleFiles.some(f => f === 'context-web.md'), 'context-web.md not found');
});

test('per-module: primary output contains cross-module overview table', () => {
  const dir = makeTmpRepo('per-mod-2');

  writeFile(dir, 'api/routes.js', 'function initRoutes(app) {}');
  writeFile(dir, 'lib/utils.js', 'function parseInput(raw) {}');
  commit(dir, 'initial');

  writeConfig(dir, { strategy: 'per-module', srcDirs: ['api', 'lib'] });
  runGenContext(dir);

  const overview = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
  assert.ok(overview.includes('context-api.md') || overview.includes('api'), 'Overview must reference api module');
  assert.ok(overview.includes('context-lib.md') || overview.includes('lib'), 'Overview must reference lib module');
  // Should be much smaller than a full-context file (overview only)
  const overviewTokens = Math.ceil(overview.length / 4);
  assert.ok(overviewTokens < 1000, `Overview too large (${overviewTokens} tokens) — should be < 1000`);
});

test('per-module: each module file contains only that module\'s signatures', () => {
  const dir = makeTmpRepo('per-mod-3');

  writeFile(dir, 'alpha/service.js', 'function alphaService(opts) {}');
  writeFile(dir, 'beta/service.js', 'function betaService(opts) {}');
  commit(dir, 'initial');

  writeConfig(dir, { strategy: 'per-module', srcDirs: ['alpha', 'beta'] });
  runGenContext(dir);

  const alphaContent = fs.readFileSync(path.join(dir, '.github', 'context-alpha.md'), 'utf8');
  const betaContent = fs.readFileSync(path.join(dir, '.github', 'context-beta.md'), 'utf8');

  assert.ok(alphaContent.includes('alphaService'), 'alpha module must contain alphaService');
  assert.ok(!alphaContent.includes('betaService'), 'alpha module must NOT contain betaService');
  assert.ok(betaContent.includes('betaService'), 'beta module must contain betaService');
  assert.ok(!betaContent.includes('alphaService'), 'beta module must NOT contain alphaService');
});

// ---------------------------------------------------------------------------
// hot-cold strategy
// ---------------------------------------------------------------------------

test('hot-cold: primary output contains only hot (recently committed) file sigs', () => {
  const dir = makeTmpRepo('hot-cold-1');

  // Commit a cold file first
  writeFile(dir, 'src/old.js', 'function oldFunction() {}');
  commit(dir, 'old file');

  // Commit a hot file more recently
  writeFile(dir, 'src/new.js', 'function newFunction() {}');
  commit(dir, 'new file');

  writeConfig(dir, { strategy: 'hot-cold', hotCommits: 1, srcDirs: ['src'] });
  runGenContext(dir);

  const primary = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
  assert.ok(primary.includes('newFunction'), 'Hot file sig must be in primary output');
  // old file should be cold (not in primary when only 1 commit is hot)
  assert.ok(!primary.includes('oldFunction'), 'Cold file sig must NOT be in primary output');
});

test('hot-cold: context-cold.md is created and contains cold file signatures', () => {
  const dir = makeTmpRepo('hot-cold-2');

  writeFile(dir, 'src/cold.js', 'function coldFn(x) {}');
  commit(dir, 'cold commit');

  writeFile(dir, 'src/hot.js', 'function hotFn(x) {}');
  commit(dir, 'hot commit');

  writeConfig(dir, { strategy: 'hot-cold', hotCommits: 1, srcDirs: ['src'] });
  runGenContext(dir);

  const coldPath = path.join(dir, '.github', 'context-cold.md');
  assert.ok(fs.existsSync(coldPath), 'context-cold.md must be created');

  const coldContent = fs.readFileSync(coldPath, 'utf8');
  assert.ok(coldContent.includes('coldFn'), 'context-cold.md must contain cold file signatures');
  assert.ok(!coldContent.includes('hotFn'), 'context-cold.md must NOT contain hot file signatures');
});

test('hot-cold: hotCommits config controls how many commits are treated as hot', () => {
  const dir = makeTmpRepo('hot-cold-3');

  writeFile(dir, 'src/a.js', 'function funcA() {}');
  commit(dir, 'commit a');

  writeFile(dir, 'src/b.js', 'function funcB() {}');
  commit(dir, 'commit b');

  writeFile(dir, 'src/c.js', 'function funcC() {}');
  commit(dir, 'commit c');

  // With hotCommits: 2, commits b and c are hot → funcB and funcC in primary
  writeConfig(dir, { strategy: 'hot-cold', hotCommits: 2, srcDirs: ['src'] });
  runGenContext(dir);

  const primary = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
  assert.ok(primary.includes('funcB') || primary.includes('funcC'),
    'At least one of the 2 hot commits must appear in primary output');
});

// ---------------------------------------------------------------------------
// Fallback behaviour
// ---------------------------------------------------------------------------

test('per-module: falls back gracefully when srcDir does not exist', () => {
  const dir = makeTmpRepo('per-mod-fallback');

  writeFile(dir, 'src/index.js', 'function main(args) {}');
  commit(dir, 'initial');

  writeConfig(dir, { strategy: 'per-module', srcDirs: ['src', 'nonexistent'] });
  // Should not throw
  assert.doesNotThrow(() => runGenContext(dir));

  const overview = path.join(dir, '.github', 'copilot-instructions.md');
  assert.ok(fs.existsSync(overview), 'Primary output must still be written');
});

test('hot-cold: falls back to full-equivalent when outside git repo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-hot-cold-nogit-'));

  writeFile(dir, 'src/index.js', 'function standaloneFunc(x) {}');
  writeConfig(dir, { strategy: 'hot-cold', hotCommits: 5, srcDirs: ['src'] });

  // Should not throw even without a git repo
  assert.doesNotThrow(() => runGenContext(dir));

  const primary = path.join(dir, '.github', 'copilot-instructions.md');
  assert.ok(fs.existsSync(primary), 'Primary output must still be written without git');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('');
console.log(`strategy: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
