'use strict';

/**
 * Evidence Pack v1 (v8.0 E1) — integration + unit coverage.
 *
 * Covers: JSON schema shape, Markdown handoff mode, byte-level determinism,
 * token-budget drops, the written .context/evidence-pack.json artifact, and the
 * pure helpers (parseAnchor / riskLabelFor / findRelatedTests).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execFileSync } = require('child_process');

const GEN_CONTEXT = path.resolve(__dirname, '../../gen-context.js');
const pack = require('../../src/evidence/pack');

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

function withTempProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-evidence-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Write a context file in the format buildSigIndex parses: an
 * `## Auto-generated signatures` marker, then `### path` headers with fenced
 * signature blocks. Signature lines keep their `:start-end` line anchors.
 */
function writeContextFile(dir) {
  const body = [
    '## Auto-generated signatures',
    '# Code signatures',
    '',
    '### src/widget.js',
    '```',
    'module.exports = { renderWidget }  :12-12',
    'function renderWidget(props) → string  :3-9',
    '```',
    '',
    '### src/payment.js',
    '```',
    'function chargeCard(token, amount)  :5-11',
    '```',
    '',
    '### settings.json',
    '```',
    'config widget.theme  :1-1',
    '```',
    '',
  ].join('\n');
  fs.mkdirSync(path.join(dir, '.github'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.github', 'copilot-instructions.md'), body, 'utf8');
}

function runEvidence(dir, args) {
  const out = execFileSync('node', [GEN_CONTEXT, 'evidence', ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return out;
}

// ── Pure helpers ──────────────────────────────────────────────────────────

test('parseAnchor splits symbol text from :start-end anchor', () => {
  const r = pack.parseAnchor('function renderWidget(props) → string  :3-9');
  assert.strictEqual(r.symbol, 'function renderWidget(props) → string');
  assert.strictEqual(r.start, 3);
  assert.strictEqual(r.end, 9);
});

test('parseAnchor returns null lines when no anchor present', () => {
  const r = pack.parseAnchor('function foo()');
  assert.strictEqual(r.symbol, 'function foo()');
  assert.strictEqual(r.start, null);
  assert.strictEqual(r.end, null);
});

test('riskLabelFor classifies generated/test/config/security/source', () => {
  assert.strictEqual(pack.riskLabelFor('dist/bundle.js'), 'generated');
  assert.strictEqual(pack.riskLabelFor('api.generated.ts'), 'generated');
  assert.strictEqual(pack.riskLabelFor('test/auth.test.js'), 'test');
  assert.strictEqual(pack.riskLabelFor('src/test_helpers.py'), 'test');
  assert.strictEqual(pack.riskLabelFor('settings.json'), 'config');
  assert.strictEqual(pack.riskLabelFor('src/auth.js'), 'security');
  assert.strictEqual(pack.riskLabelFor('src/payment.js'), 'security');
  assert.strictEqual(pack.riskLabelFor('src/widget.js'), 'source');
});

test('findRelatedTests matches a test file by stem', () => {
  const universe = ['src/widget.js', 'test/widget.test.js', 'src/other.js'];
  assert.deepStrictEqual(pack.findRelatedTests('src/widget.js', universe), ['test/widget.test.js']);
  // a test file maps to nothing
  assert.deepStrictEqual(pack.findRelatedTests('test/widget.test.js', universe), []);
});

test('buildEvidencePack produces a stable contextHash given the same index', () => {
  const idx = new Map([['src/widget.js', ['function renderWidget(props)  :3-9']]]);
  const a = pack.buildEvidencePack('render widget', '/tmp/none', { sigIndex: idx });
  const b = pack.buildEvidencePack('render widget', '/tmp/none', { sigIndex: idx });
  assert.strictEqual(a.grounding.contextHash, b.grounding.contextHash);
  assert.ok(a.grounding.contextHash.startsWith('sha256:'));
});

// ── CLI: JSON shape ───────────────────────────────────────────────────────

test('evidence JSON has the v1 schema shape', () => {
  withTempProject((dir) => {
    writeContextFile(dir);
    const p = JSON.parse(runEvidence(dir, ['render widget']));
    assert.strictEqual(p.schemaVersion, '1.0');
    assert.strictEqual(p.query, 'render widget');
    assert.ok(typeof p.intent === 'string');
    assert.ok(Array.isArray(p.files));
    assert.ok(p.files.length >= 1, 'expected at least one ranked file');
    assert.ok(p.tokenBudget && typeof p.tokenBudget.limit === 'number');
    assert.ok(typeof p.tokenBudget.used === 'number');
    assert.ok(typeof p.tokenBudget.remaining === 'number');
    assert.ok(Array.isArray(p.droppedFiles));
    assert.ok(p.grounding && typeof p.grounding.symbolCount === 'number');
    assert.strictEqual(p.grounding.deterministic, true);
    assert.ok(p.grounding.contextHash.startsWith('sha256:'));
  });
});

test('every file entry carries the required fields', () => {
  withTempProject((dir) => {
    writeContextFile(dir);
    const p = JSON.parse(runEvidence(dir, ['render widget']));
    const widget = p.files.find((f) => f.path === 'src/widget.js');
    assert.ok(widget, 'widget file should rank for "render widget"');
    assert.ok(Array.isArray(widget.symbols) && widget.symbols.length >= 1);
    assert.ok(typeof widget.reason === 'string' && widget.reason.length > 0);
    assert.ok(widget.confidence >= 0 && widget.confidence <= 1);
    assert.strictEqual(widget.riskLabel, 'source');
    assert.ok(Array.isArray(widget.relatedTests));
    assert.ok(widget.sourceLines.length >= 1);
    const sl = widget.sourceLines[0];
    assert.ok(typeof sl.start === 'number' && typeof sl.end === 'number');
    assert.ok(typeof sl.symbol === 'string');
  });
});

test('top-ranked file has confidence 1 (normalized to max score)', () => {
  withTempProject((dir) => {
    writeContextFile(dir);
    const p = JSON.parse(runEvidence(dir, ['render widget']));
    assert.strictEqual(p.files[0].confidence, 1);
  });
});

test('anchorCoverage reflects the fraction of anchored symbols', () => {
  withTempProject((dir) => {
    writeContextFile(dir);
    const p = JSON.parse(runEvidence(dir, ['render widget']));
    assert.ok(p.grounding.symbolCount > 0);
    assert.strictEqual(p.grounding.anchoredSymbols, p.grounding.symbolCount,
      'all fixture signatures carry anchors');
    assert.strictEqual(p.grounding.anchorCoverage, 1);
  });
});

// ── CLI: Markdown mode ────────────────────────────────────────────────────

test('--markdown emits the Markdown handoff rendering', () => {
  withTempProject((dir) => {
    writeContextFile(dir);
    const md = runEvidence(dir, ['render widget', '--markdown']);
    assert.ok(md.startsWith('# Evidence Pack'), 'markdown should start with the pack heading');
    assert.ok(md.includes('**Schema:** v1.0'));
    assert.ok(md.includes('src/widget.js'));
  });
});

// ── CLI: determinism ──────────────────────────────────────────────────────

test('JSON output is byte-identical across runs (deterministic)', () => {
  withTempProject((dir) => {
    writeContextFile(dir);
    const a = runEvidence(dir, ['render widget']);
    const b = runEvidence(dir, ['render widget']);
    assert.strictEqual(a, b, 'two runs on an unchanged repo must be byte-identical');
  });
});

// ── CLI: budget drops + artifact ──────────────────────────────────────────

test('a tiny --budget drops ranked files with a reason', () => {
  withTempProject((dir) => {
    writeContextFile(dir);
    const p = JSON.parse(runEvidence(dir, ['render widget chargeCard config', '--budget', '20']));
    assert.ok(p.files.length >= 1, 'budget always keeps at least the top file');
    assert.ok(p.droppedFiles.length >= 1, 'remaining ranked files should be dropped');
    assert.ok(/budget/.test(p.droppedFiles[0].reason));
    assert.ok(p.tokenBudget.used <= p.tokenBudget.limit + p.files[0].symbols.join('\n').length);
  });
});

test('writes the .context/evidence-pack.json artifact', () => {
  withTempProject((dir) => {
    writeContextFile(dir);
    runEvidence(dir, ['render widget']);
    const artifact = path.join(dir, '.context', 'evidence-pack.json');
    assert.ok(fs.existsSync(artifact), 'artifact file should be written');
    const p = JSON.parse(fs.readFileSync(artifact, 'utf8'));
    assert.strictEqual(p.schemaVersion, '1.0');
  });
});

test('exits non-zero with usage when no query given', () => {
  withTempProject((dir) => {
    writeContextFile(dir);
    let threw = false;
    try {
      execFileSync('node', [GEN_CONTEXT, 'evidence'], { cwd: dir, stdio: 'ignore' });
    } catch (_) {
      threw = true;
    }
    assert.ok(threw, 'missing query should exit non-zero');
  });
});

console.log(`\nEvidence Pack: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
