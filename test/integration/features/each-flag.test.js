'use strict';

/**
 * Integration tests for --each flag (v0.6)
 *
 * Verifies that running `sigmap --each` from a parent directory processes
 * each qualifying sub-directory independently and writes a
 * .github/copilot-instructions.md inside each sub-repo.
 *
 * A subdirectory qualifies when it contains .git or a recognised project
 * manifest (package.json, pyproject.toml, Cargo.toml, go.mod, build.gradle,
 * pom.xml, requirements.txt).
 */

const fs     = require('fs');
const path   = require('path');
const assert = require('assert');
const os     = require('os');
const { spawnSync } = require('child_process');

const GEN = path.resolve(__dirname, '../../../gen-context.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cf-each-test-'));
}

function rmdir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFixtures(tmpDir, fixtures) {
  for (const [rel, content] of Object.entries(fixtures)) {
    const fullPath = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
}

function runEach(parentDir) {
  return spawnSync(process.execPath, [GEN, '--each'], {
    cwd: parentDir,
    encoding: 'utf8',
    timeout: 20000,
  });
}

// Expected output path inside a sub-repo (copilot adapter default)
function repoOut(repoDir) {
  return path.join(repoDir, '.github', 'copilot-instructions.md');
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
console.log('\n--each integration tests\n');

// ── 1. Processes three sibling repos from a parent directory ──────────────
test('processes three sibling repos from a parent directory', () => {
  const parent = mkTmp();
  try {
    writeFixtures(parent, {
      'repo-a/package.json':    '{"name":"repo-a"}',
      'repo-a/src/index.ts':   'export function repoAMain() {}',
      'repo-b/package.json':   '{"name":"repo-b"}',
      'repo-b/src/index.ts':   'export function repoBMain() {}',
      'repo-c/package.json':   '{"name":"repo-c"}',
      'repo-c/src/index.ts':   'export function repoCMain() {}',
    });

    const result = runEach(parent);
    assert.strictEqual(result.status, 0, `exit ${result.status}: ${result.stderr}`);

    for (const repo of ['repo-a', 'repo-b', 'repo-c']) {
      assert.ok(
        fs.existsSync(repoOut(path.join(parent, repo))),
        `Missing copilot-instructions.md for ${repo}`
      );
    }
  } finally {
    rmdir(parent);
  }
});

// ── 2. Each repo's output contains only its own signatures ───────────────
test('each repo output contains only its own signatures', () => {
  const parent = mkTmp();
  try {
    writeFixtures(parent, {
      'orders/package.json':  '{"name":"orders"}',
      'orders/src/api.ts':    'export function createOrder() {}\nexport function cancelOrder() {}',
      'catalog/package.json': '{"name":"catalog"}',
      'catalog/src/api.ts':   'export function listProducts() {}\nexport function getProduct() {}',
    });

    runEach(parent);

    const ordersOut  = fs.readFileSync(repoOut(path.join(parent, 'orders')), 'utf8');
    const catalogOut = fs.readFileSync(repoOut(path.join(parent, 'catalog')), 'utf8');

    assert.ok(ordersOut.includes('createOrder'),   'createOrder missing from orders output');
    assert.ok(!ordersOut.includes('listProducts'),  'listProducts leaked into orders output');
    assert.ok(catalogOut.includes('listProducts'), 'listProducts missing from catalog output');
    assert.ok(!catalogOut.includes('createOrder'),  'createOrder leaked into catalog output');
  } finally {
    rmdir(parent);
  }
});

// ── 3. Qualifies repos via .git directory (not just package.json) ─────────
test('qualifies sub-repo via .git presence (no manifest needed)', () => {
  const parent = mkTmp();
  try {
    writeFixtures(parent, {
      'git-repo/.git/HEAD':     'ref: refs/heads/main',
      'git-repo/src/logic.py':  'def process_event():\n    pass\n',
    });

    const result = runEach(parent);
    assert.strictEqual(result.status, 0, `exit ${result.status}: ${result.stderr}`);

    assert.ok(
      fs.existsSync(repoOut(path.join(parent, 'git-repo'))),
      'copilot-instructions.md not generated for .git-qualified repo'
    );
  } finally {
    rmdir(parent);
  }
});

// ── 4. Qualifies repos via non-JS manifests (Cargo.toml, go.mod, pyproject.toml)
test('qualifies Rust/Go/Python repos via their manifest files', () => {
  const parent = mkTmp();
  try {
    writeFixtures(parent, {
      'rust-svc/Cargo.toml':     '[package]\nname = "rust-svc"',
      'rust-svc/src/lib.rs':     'pub fn serve() {}',
      'go-svc/go.mod':           'module go-svc\ngo 1.21',
      'go-svc/main.go':          'package main\nfunc Serve() {}',
      'py-svc/pyproject.toml':   '[project]\nname = "py-svc"',
      'py-svc/app/main.py':      'def serve():\n    pass\n',
    });

    const result = runEach(parent);
    assert.strictEqual(result.status, 0, `exit ${result.status}: ${result.stderr}`);

    for (const repo of ['rust-svc', 'go-svc', 'py-svc']) {
      assert.ok(
        fs.existsSync(repoOut(path.join(parent, repo))),
        `copilot-instructions.md missing for ${repo}`
      );
    }
  } finally {
    rmdir(parent);
  }
});

// ── 5. Non-qualifying directories (no .git and no manifest) are skipped ───
test('skips directories with no .git and no manifest', () => {
  const parent = mkTmp();
  try {
    writeFixtures(parent, {
      'real-repo/package.json':  '{"name":"real-repo"}',
      'real-repo/src/index.ts':  'export function main() {}',
      'not-a-repo/README.md':    '# just some docs',
      'also-not/somefile.txt':   'plain text',
    });

    runEach(parent);

    assert.ok(
      fs.existsSync(repoOut(path.join(parent, 'real-repo'))),
      'real-repo should have been processed'
    );
    assert.ok(
      !fs.existsSync(repoOut(path.join(parent, 'not-a-repo'))),
      'not-a-repo should have been skipped'
    );
  } finally {
    rmdir(parent);
  }
});

// ── 6. Each repo uses its own gen-context.config.json when present ────────
test('each repo respects its own gen-context.config.json', () => {
  const parent = mkTmp();
  try {
    writeFixtures(parent, {
      // repo-custom has a config requesting claude adapter
      'repo-custom/package.json':           '{"name":"repo-custom"}',
      'repo-custom/src/service.ts':         'export function customService() {}',
      'repo-custom/gen-context.config.json': JSON.stringify({ outputs: ['claude'] }),
      // repo-default uses no config (defaults to copilot)
      'repo-default/package.json':          '{"name":"repo-default"}',
      'repo-default/src/index.ts':          'export function defaultFn() {}',
    });

    const result = runEach(parent);
    assert.strictEqual(result.status, 0, `exit ${result.status}: ${result.stderr}`);

    // repo-custom should have written CLAUDE.md
    assert.ok(
      fs.existsSync(path.join(parent, 'repo-custom', 'CLAUDE.md')),
      'repo-custom should have written CLAUDE.md (claude adapter)'
    );
    // repo-default should have written .github/copilot-instructions.md
    assert.ok(
      fs.existsSync(repoOut(path.join(parent, 'repo-default'))),
      'repo-default should have written copilot-instructions.md (default adapter)'
    );
  } finally {
    rmdir(parent);
  }
});

// ── 7. Summary message reports correct count ─────────────────────────────
test('summary output reports number of repos processed', () => {
  const parent = mkTmp();
  try {
    writeFixtures(parent, {
      'svc-1/package.json': '{"name":"svc-1"}',
      'svc-1/src/a.ts':     'export function a() {}',
      'svc-2/package.json': '{"name":"svc-2"}',
      'svc-2/src/b.ts':     'export function b() {}',
    });

    const result = runEach(parent);
    assert.strictEqual(result.status, 0, `exit ${result.status}: ${result.stderr}`);
    assert.ok(
      result.stderr.includes('2') && result.stderr.includes('succeeded'),
      `Expected "2 succeeded" in stderr; got: ${result.stderr}`
    );
  } finally {
    rmdir(parent);
  }
});

// ── 8. No crash when parent directory has no qualifying sub-repos ─────────
test('no crash when no qualifying sub-repos found', () => {
  const parent = mkTmp();
  try {
    writeFixtures(parent, {
      'docs/README.md': '# docs',
      'notes/todo.txt': 'todo',
    });

    const result = runEach(parent);
    assert.strictEqual(result.status, 0, `exited with ${result.status}: ${result.stderr}`);
  } finally {
    rmdir(parent);
  }
});

// ── 9. --each --adapter claude → CLAUDE.md written per sub-repo ──────────
test('--each --adapter claude writes CLAUDE.md per sub-repo', () => {
  const parent = mkTmp();
  try {
    writeFixtures(parent, {
      'svc-a/package.json': '{"name":"svc-a"}',
      'svc-a/src/api.ts':   'export function getUser() {}',
      'svc-b/package.json': '{"name":"svc-b"}',
      'svc-b/src/api.ts':   'export function getOrder() {}',
    });

    const result = spawnSync(process.execPath, [GEN, '--each', '--adapter', 'claude'], {
      cwd: parent,
      encoding: 'utf8',
      timeout: 20000,
    });
    assert.strictEqual(result.status, 0, `exit ${result.status}: ${result.stderr}`);

    for (const svc of ['svc-a', 'svc-b']) {
      const claudeMd = path.join(parent, svc, 'CLAUDE.md');
      assert.ok(fs.existsSync(claudeMd), `CLAUDE.md missing for ${svc}`);
      // Default copilot output should NOT be written
      assert.ok(
        !fs.existsSync(path.join(parent, svc, '.github', 'copilot-instructions.md')),
        `copilot-instructions.md should not be written when adapter=claude (${svc})`
      );
    }
  } finally {
    rmdir(parent);
  }
});

// ── 10. --each --adapter cursor → .cursorrules written per sub-repo ───────
test('--each --adapter cursor writes .cursorrules per sub-repo', () => {
  const parent = mkTmp();
  try {
    writeFixtures(parent, {
      'frontend/package.json': '{"name":"frontend"}',
      'frontend/src/App.tsx':  'export function App() { return null; }',
      'backend/package.json':  '{"name":"backend"}',
      'backend/src/server.ts': 'export function startServer() {}',
    });

    const result = spawnSync(process.execPath, [GEN, '--each', '--adapter', 'cursor'], {
      cwd: parent,
      encoding: 'utf8',
      timeout: 20000,
    });
    assert.strictEqual(result.status, 0, `exit ${result.status}: ${result.stderr}`);

    for (const repo of ['frontend', 'backend']) {
      const cursorRules = path.join(parent, repo, '.cursorrules');
      assert.ok(fs.existsSync(cursorRules), `.cursorrules missing for ${repo}`);
    }
  } finally {
    rmdir(parent);
  }
});

// ── 11. --each --adapter with unknown name fails with clear error ─────────
test('--each --adapter with unknown adapter name exits non-zero', () => {
  const parent = mkTmp();
  try {
    writeFixtures(parent, {
      'repo/package.json': '{"name":"repo"}',
      'repo/src/a.ts':     'export function a() {}',
    });

    const result = spawnSync(process.execPath, [GEN, '--each', '--adapter', 'notanadapter'], {
      cwd: parent,
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.notStrictEqual(result.status, 0, 'should exit non-zero for unknown adapter');
    assert.ok(
      result.stderr.includes('notanadapter') || result.stdout.includes('notanadapter'),
      'error output should mention the unknown adapter name'
    );
  } finally {
    rmdir(parent);
  }
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
const total = passCount + failCount;
console.log(`\n${passCount}/${total} --each tests passed\n`);

if (failCount > 0) process.exit(1);
