'use strict';

/**
 * v8.0 E3 — `sigmap doctor` diagnostic command.
 * Covers the diagnose() module directly and the CLI (exit codes + --json).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execFileSync } = require('child_process');

const GEN_CONTEXT = path.resolve(__dirname, '../../gen-context.js');
const { diagnose, formatDoctor, formatDoctorJSON } = require('../../src/doctor/diagnose');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}

function withTempProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-doctor-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/** Seed a healthy project: a src file, a matching context file, a config. */
function seedHealthy(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'widget.js'), 'function renderWidget(props){return props;}\nmodule.exports={renderWidget};\n');
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'] }) + '\n');
  fs.mkdirSync(path.join(dir, '.github'), { recursive: true });
  // Written last so the context mtime is newest → freshness ok.
  fs.writeFileSync(path.join(dir, '.github', 'copilot-instructions.md'), [
    '## Auto-generated signatures', '# Code signatures', '',
    '### src/widget.js', '```', 'function renderWidget(props)  :1-1', '```', '',
  ].join('\n'));
}

function runDoctor(dir, args) {
  return execFileSync('node', [GEN_CONTEXT, 'doctor', ...(args || [])], { cwd: dir, encoding: 'utf8' });
}

function runDoctorExit(dir, args) {
  try {
    execFileSync('node', [GEN_CONTEXT, 'doctor', ...(args || [])], { cwd: dir, encoding: 'utf8', stdio: 'ignore' });
    return 0;
  } catch (e) {
    return e.status == null ? -1 : e.status;
  }
}

// ── diagnose() module ──────────────────────────────────────────────────────

test('diagnose returns the result shape with a checks array', () => {
  withTempProject((dir) => {
    const r = diagnose(dir);
    assert.ok(Array.isArray(r.checks) && r.checks.length >= 5, 'has checks');
    assert.ok(typeof r.ok === 'boolean');
    assert.ok(typeof r.errors === 'number' && typeof r.warnings === 'number');
    for (const c of r.checks) {
      assert.ok(c.id && c.label && c.status, 'each check has id/label/status');
      assert.ok(['ok', 'warn', 'fail'].includes(c.status));
    }
  });
});

test('diagnose flags a missing context file as a hard failure', () => {
  withTempProject((dir) => {
    const r = diagnose(dir);
    const ctx = r.checks.find((c) => c.id === 'context');
    assert.strictEqual(ctx.status, 'fail');
    assert.ok(/npx sigmap/.test(ctx.fix), 'fix points at generating context');
    assert.strictEqual(r.ok, false);
    assert.ok(r.errors >= 1);
  });
});

test('diagnose passes context + index on a seeded project', () => {
  withTempProject((dir) => {
    seedHealthy(dir);
    const r = diagnose(dir);
    assert.strictEqual(r.checks.find((c) => c.id === 'context').status, 'ok');
    assert.strictEqual(r.checks.find((c) => c.id === 'index').status, 'ok');
    assert.strictEqual(r.checks.find((c) => c.id === 'coverage').status, 'ok');
    assert.strictEqual(r.ok, true, 'no hard failures on a healthy project');
  });
});

test('diagnose flags invalid gen-context.config.json', () => {
  withTempProject((dir) => {
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), '{ not valid json ');
    const cfg = diagnose(dir).checks.find((c) => c.id === 'config');
    assert.strictEqual(cfg.status, 'fail');
    assert.ok(/invalid JSON/i.test(cfg.detail));
  });
});

test('every non-ok check carries an actionable fix', () => {
  withTempProject((dir) => {
    const r = diagnose(dir);
    for (const c of r.checks) {
      if (c.status !== 'ok') assert.ok(c.fix && c.fix.length > 0, `${c.id} has a fix`);
    }
  });
});

test('diagnose does not throw on an empty directory', () => {
  withTempProject((dir) => {
    assert.doesNotThrow(() => diagnose(dir));
  });
});

test('formatDoctor renders a checklist; formatDoctorJSON round-trips', () => {
  withTempProject((dir) => {
    const r = diagnose(dir);
    const text = formatDoctor(r);
    assert.ok(/sigmap doctor/.test(text));
    assert.ok(/[✓⚠✗]/.test(text), 'has status icons');
    assert.deepStrictEqual(JSON.parse(formatDoctorJSON(r)).errors, r.errors);
  });
});

// ── CLI ────────────────────────────────────────────────────────────────────

test('CLI doctor exits 1 when context is missing (hard failure)', () => {
  withTempProject((dir) => {
    assert.strictEqual(runDoctorExit(dir), 1);
  });
});

test('CLI doctor exits 0 on a healthy seeded project', () => {
  withTempProject((dir) => {
    seedHealthy(dir);
    assert.strictEqual(runDoctorExit(dir), 0);
  });
});

test('CLI doctor --json emits { checks, ok, errors, warnings }', () => {
  withTempProject((dir) => {
    seedHealthy(dir);
    const out = runDoctor(dir, ['--json']);
    const r = JSON.parse(out);
    assert.ok(Array.isArray(r.checks));
    assert.ok(typeof r.ok === 'boolean');
    assert.ok('errors' in r && 'warnings' in r);
  });
});

test('CLI doctor prints fix hints for failures (exit 1, stdout captured)', () => {
  withTempProject((dir) => {
    let out = '';
    try {
      out = execFileSync('node', [GEN_CONTEXT, 'doctor'], { cwd: dir, encoding: 'utf8' });
      assert.fail('expected non-zero exit on missing context');
    } catch (e) {
      assert.strictEqual(e.status, 1);
      out = e.stdout || '';
    }
    assert.ok(/Generated context/.test(out), 'lists the context check');
    assert.ok(/npx sigmap/.test(out), 'prints the fix hint');
  });
});

console.log(`\nDoctor: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
