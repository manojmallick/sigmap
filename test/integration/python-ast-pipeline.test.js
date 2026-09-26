'use strict';

/**
 * Integration: Python AST extractor is reachable from dispatch (#693).
 * Unit tests invoke python_ast.py directly; this asserts the JS pipeline passes
 * a real file path and surfaces nested-default signatures regex cannot see.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const dispatch = require(path.join(ROOT, 'src/extractors/dispatch'));
const python = require(path.join(ROOT, 'src/extractors/python'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

test('resolvePythonAstScript finds python_ast.py in the repo', () => {
  const script = python.resolvePythonAstScript();
  assert.ok(script, 'python_ast.py not found');
  assert.ok(fs.existsSync(script), script);
});

test('dispatch.extractFile extracts compute_totals via AST when python3 exists', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-py-'));
  const appPath = path.join(tmp, 'src', 'app.py');
  fs.mkdirSync(path.dirname(appPath), { recursive: true });
  fs.writeFileSync(
    appPath,
    `def compute_totals(a, b=helper(1, 2)):\n    return a + b\n\ndef plain_helper(a, b):\n    return a\n`,
    'utf8',
  );

  const src = fs.readFileSync(appPath, 'utf8');
  const regexOnly = python.extract(src);
  const viaDispatch = dispatch.extractFile(appPath, src);
  const joined = viaDispatch.join('\n');

  if (joined.includes('compute_totals')) {
    assert.ok(true, 'AST path active');
    return;
  }

  // No python3 on PATH — regex tier cannot see compute_totals; skip rather than fail CI.
  const hasPython3 = (() => {
    try {
      require('child_process').execFileSync('python3', ['--version'], { stdio: 'ignore' });
      return true;
    } catch (_) {
      return false;
    }
  })();

  if (!hasPython3) {
    console.log('  SKIP  dispatch AST (no python3 on PATH)');
    passed++;
    return;
  }

  assert.ok(
    !regexOnly.some((s) => s.includes('compute_totals')),
    'regex fallback should drop compute_totals',
  );
  assert.ok(
    viaDispatch.some((s) => s.includes('compute_totals')),
    `expected compute_totals in dispatch output, got:\n${joined}`,
  );
});

console.log(`\npython-ast-pipeline: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
