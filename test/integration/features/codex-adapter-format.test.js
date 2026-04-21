'use strict';

/**
 * Regression tests for issue #96:
 * codex adapter must produce clean markdown for AGENTS.md — no LLM preamble.
 *
 * format() tests:
 *  1.  no "You are a coding assistant" preamble
 *  2.  no HTML comment metadata block
 *  3.  no "Use these signatures to answer questions" boilerplate
 *  4.  no "Below are the code signatures extracted by SigMap" line
 *  5.  starts with exactly "# Code signatures"
 *  6.  exactly one # Code signatures header (no duplicates)
 *  7.  context body is present verbatim
 *  8.  empty/null/undefined input returns ''
 *  9.  whitespace-only input returns ''
 * 10.  opts (version, projectName) do not bleed into output
 * 11.  large context preserved without truncation
 * 12.  output is plain markdown — no HTML tags
 *
 * outputPath() tests:
 * 13.  returns path ending in AGENTS.md
 * 14.  absolute path is correctly joined
 *
 * write() tests:
 * 15.  creates AGENTS.md when file does not exist
 * 16.  output contains # Code signatures header
 * 17.  second write replaces content below marker, not above
 * 18.  human content above marker is preserved on re-run
 * 19.  legacy "# Code signatures" content replaced cleanly
 * 20.  module exports name === 'codex'
 */

const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const assert = require('assert');

const ROOT  = path.resolve(__dirname, '../../..');
const codex = require(path.join(ROOT, 'packages', 'adapters', 'codex'));

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

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-codex-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const CTX = `## src\n\n### src/auth/service.ts\n\`\`\`\nexport class AuthService\n  login(user, pass)\n  logout()\n\`\`\`\n\n### src/payments/service.ts\n\`\`\`\nexport function chargeCard(amount, cardId)\n\`\`\``;

// ── format() — content correctness ───────────────────────────────────────────

test('1. no "You are a coding assistant" preamble', () => {
  const out = codex.format(CTX);
  assert.ok(!out.includes('You are a coding assistant'),
    `preamble must be absent:\n${out.slice(0, 300)}`);
});

test('2. no HTML comment metadata block', () => {
  const out = codex.format(CTX);
  assert.ok(!out.includes('<!-- sigmap:') && !out.includes('<!-- Generated'),
    `HTML comment must be absent:\n${out.slice(0, 300)}`);
});

test('3. no "Use these signatures to answer questions" boilerplate', () => {
  const out = codex.format(CTX);
  assert.ok(!out.includes('Use these signatures to answer'),
    'boilerplate line must be absent');
});

test('4. no "Below are the code signatures extracted by SigMap" line', () => {
  const out = codex.format(CTX);
  assert.ok(!out.includes('Below are the code signatures'),
    'SigMap intro line must be absent');
});

test('5. output starts with exactly "# Code signatures"', () => {
  const out = codex.format(CTX);
  assert.ok(out.startsWith('# Code signatures'),
    `must start with "# Code signatures" but got:\n${out.slice(0, 100)}`);
});

test('6. exactly one # Code signatures header — no duplicates', () => {
  const out = codex.format(CTX);
  const count = (out.match(/^#\s+Code\s+[Ss]ignatures/gm) || []).length;
  assert.strictEqual(count, 1, `expected 1 header, got ${count}`);
});

test('7. context body is present verbatim', () => {
  const out = codex.format(CTX);
  assert.ok(out.includes('AuthService'), 'AuthService must be in output');
  assert.ok(out.includes('login(user, pass)'), 'login signature must be in output');
  assert.ok(out.includes('chargeCard(amount, cardId)'), 'chargeCard must be in output');
});

test('8. null input returns empty string', () => {
  assert.strictEqual(codex.format(null), '');
});

test('8b. undefined input returns empty string', () => {
  assert.strictEqual(codex.format(undefined), '');
});

test('8c. empty string input returns empty string', () => {
  assert.strictEqual(codex.format(''), '');
});

test('9. whitespace-only input returns empty string', () => {
  assert.strictEqual(codex.format('   \n\t  '), '');
});

test('10. opts.version does not appear in output body', () => {
  const out = codex.format(CTX, { version: '9.9.9', projectName: 'my-project' });
  assert.ok(!out.includes('9.9.9'), 'version must not appear in codex output');
  assert.ok(!out.includes('my-project'), 'projectName must not appear in codex output');
});

test('11. large context preserved without truncation', () => {
  const large = Array.from({ length: 200 }, (_, i) =>
    `export function fn${i}(arg: string): void`).join('\n');
  const out = codex.format(large);
  assert.ok(out.includes('fn0('), 'first entry present');
  assert.ok(out.includes('fn199('), 'last entry present');
});

test('12. output contains no HTML tags', () => {
  const out = codex.format(CTX);
  assert.ok(!/<[a-z]+[\s>]/i.test(out), `HTML tags found in output:\n${out.slice(0, 300)}`);
});

// ── outputPath() ──────────────────────────────────────────────────────────────

test('13. outputPath ends with AGENTS.md', () => {
  const p = codex.outputPath('/some/project');
  assert.ok(p.endsWith('AGENTS.md'), `expected AGENTS.md, got ${p}`);
});

test('14. outputPath is an absolute path under the given cwd', () => {
  const p = codex.outputPath('/my/project');
  assert.ok(path.isAbsolute(p), 'must be absolute');
  assert.ok(p.startsWith('/my/project'), `expected path under /my/project, got ${p}`);
});

// ── write() ───────────────────────────────────────────────────────────────────

test('15. write() creates AGENTS.md when file does not exist', () => {
  withTempDir((dir) => {
    codex.write(CTX, dir);
    const outPath = path.join(dir, 'AGENTS.md');
    assert.ok(fs.existsSync(outPath), 'AGENTS.md should be created');
  });
});

test('16. written file contains # Code signatures header', () => {
  withTempDir((dir) => {
    codex.write(CTX, dir);
    const content = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
    assert.ok(content.includes('# Code signatures'), 'header must be in written file');
    assert.ok(content.includes('AuthService'), 'context body must be in written file');
  });
});

test('17. second write replaces content below marker, not above', () => {
  withTempDir((dir) => {
    codex.write(CTX, dir);
    const ctx2 = CTX.replace('AuthService', 'AuthServiceV2');
    codex.write(ctx2, dir);
    const content = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
    assert.ok(content.includes('AuthServiceV2'), 'updated content must be present');
    assert.ok(!content.includes('AuthService\n'), 'old content must be replaced');
  });
});

test('18. human content above marker is preserved on re-run', () => {
  withTempDir((dir) => {
    const humanSection = '# My Project\n\nThis is a human-written description.\n\n';
    const agentsPath = path.join(dir, 'AGENTS.md');
    // Simulate existing file with human content + marker from previous run
    fs.writeFileSync(agentsPath,
      humanSection + '## Auto-generated signatures\n<!-- Updated by gen-context.js -->\n# Code signatures\n\nold sigs');
    codex.write(CTX, dir);
    const content = fs.readFileSync(agentsPath, 'utf8');
    assert.ok(content.includes('# My Project'), 'human header must be preserved');
    assert.ok(content.includes('human-written description'), 'human body must be preserved');
    assert.ok(content.includes('AuthService'), 'new sigs must be present');
    assert.ok(!content.includes('old sigs'), 'old generated sigs must be replaced');
  });
});

test('19. legacy "# Code signatures" content replaced cleanly — no stacking', () => {
  withTempDir((dir) => {
    const legacy = '# Code signatures\n\nexport function legacyFn()';
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), legacy);
    codex.write(CTX, dir);
    const content = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
    const headerCount = (content.match(/^#\s+Code\s+[Ss]ignatures/gm) || []).length;
    assert.strictEqual(headerCount, 1, `expected 1 header after legacy replace, got ${headerCount}`);
    assert.ok(!content.includes('legacyFn'), 'legacy content must be gone');
  });
});

test('20. module exports name === "codex"', () => {
  assert.strictEqual(codex.name, 'codex');
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n--- codex-adapter-format ---');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
