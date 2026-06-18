'use strict';

/**
 * Integration tests for scaffold persistence (IMPL §6.2 2d).
 *   renderScaffoldMarkdown · scaffoldPath · CLI writes (accepted) / skips (refused)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const { renderScaffoldMarkdown, scaffoldPath } = require(path.join(ROOT, 'src/scaffold/persist'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
}

function withRepo(naming, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-persist-'));
  try { fs.mkdirSync(path.join(dir, 'src')); for (const [f, c] of Object.entries(naming)) fs.writeFileSync(path.join(dir, 'src', f), c); fn(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── renderScaffoldMarkdown / scaffoldPath ───────────────────────────────────
test('scaffoldPath: .context/scaffold/latest.md under cwd', () => {
  assert.strictEqual(scaffoldPath('/repo'), path.join('/repo', '.context', 'scaffold', 'latest.md'));
});
test('renderScaffoldMarkdown: includes filename, export style, test file', () => {
  const md = renderScaffoldMarkdown({
    ok: true, name: 'user widget', tier: 'consistent', confidence: 0.95,
    proposal: { filename: 'userWidget.js', namingStyle: 'camelCase', exportStyle: 'named', testFile: 'userWidget.test.js', testFramework: 'jest' },
  }, { timestamp: '2026-06-18T00:00:00Z' });
  assert.ok(/# Scaffold — user widget/.test(md));
  assert.ok(/`userWidget\.js` \(camelCase\)/.test(md));
  assert.ok(/Export style:\*\* named/.test(md));
  assert.ok(/`userWidget\.test\.js` \(jest\)/.test(md));
  assert.ok(/2026-06-18T00:00:00Z/.test(md));
});
test('renderScaffoldMarkdown: includes a force warning when present', () => {
  const md = renderScaffoldMarkdown({ ok: true, name: 'x', tier: 'mostly', confidence: 0.6, warning: 'proposed below threshold', proposal: {} });
  assert.ok(/Warning:\*\* proposed below threshold/.test(md));
});

// ── CLI ─────────────────────────────────────────────────────────────────────
function consistentRepo() {
  const files = {};
  for (let i = 0; i < 9; i++) files[`fooBar${i}.js`] = 'export const a = 1;\n';
  files['user-service.js'] = 'export const b = 2;\n'; // 90% camelCase
  return files;
}

test('CLI: accepted scaffold writes .context/scaffold/latest.md', () => {
  withRepo(consistentRepo(), (dir) => {
    const res = spawnSync('node', [SCRIPT, 'scaffold', 'new widget'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    const out = path.join(dir, '.context', 'scaffold', 'latest.md');
    assert.ok(fs.existsSync(out), 'wrote latest.md');
    assert.ok(/newWidget\.js/.test(fs.readFileSync(out, 'utf8')));
    assert.ok(/→ wrote .context\/scaffold\/latest\.md/.test(res.stdout));
  });
});
test('CLI: refused scaffold does not write the file', () => {
  withRepo({ 'fooBar.js': 'export const a=1;\n', 'a-b.js': 'export const b=2;\n', 'c_d.js': 'export const c=3;\n' }, (dir) => {
    const res = spawnSync('node', [SCRIPT, 'scaffold', 'x'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1);
    assert.ok(!fs.existsSync(path.join(dir, '.context', 'scaffold', 'latest.md')), 'no file on refusal');
  });
});
test('CLI: --json persists too and reports persistedTo', () => {
  withRepo(consistentRepo(), (dir) => {
    const res = spawnSync('node', [SCRIPT, 'scaffold', 'thing', '--json'], { cwd: dir, encoding: 'utf8' });
    const data = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.strictEqual(data.persistedTo, '.context/scaffold/latest.md');
    assert.ok(fs.existsSync(path.join(dir, '.context', 'scaffold', 'latest.md')));
  });
});

console.log(`\nscaffold-persist: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
