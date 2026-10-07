'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execSync } = require('child_process');

const GEN_CONTEXT = path.resolve(__dirname, '../../gen-context.js');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-multi-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function seedProject(dir) {
  const srcDir = path.join(dir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(
    path.join(srcDir, 'index.js'),
    'function greet(name) { return `Hello ${name}`; }\nmodule.exports = { greet };\n'
  );
}

function runGenerate(cwd) {
  execSync(`node "${GEN_CONTEXT}"`, {
    cwd,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// ─────────────────────────────────────────────────────────────
// copilot only (default)
// ─────────────────────────────────────────────────────────────
test('Default output writes copilot-instructions.md', () => {
  withTempProject((dir) => {
    seedProject(dir);
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      outputs: ['copilot'],
      secretScan: false,
    }));

    runGenerate(dir);

    const out = path.join(dir, '.github', 'copilot-instructions.md');
    assert.ok(fs.existsSync(out), '.github/copilot-instructions.md should exist');
    const content = fs.readFileSync(out, 'utf8');
    assert.ok(content.includes('greet'), 'Content should include extracted signature');
  });
});

test('copilot output preserves human content above marker', () => {
  withTempProject((dir) => {
    seedProject(dir);
    const out = path.join(dir, '.github', 'copilot-instructions.md');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(
      out,
      '# Team notes\n\nKeep this section manual.\n\n## Auto-generated signatures\n<!-- Updated by gen-context.js -->\n\nold signatures\n',
      'utf8'
    );

    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      outputs: ['copilot'],
      secretScan: false,
    }));

    runGenerate(dir);

    const content = fs.readFileSync(out, 'utf8');
    assert.ok(content.startsWith('# Team notes'), 'Human content at top must be preserved');
    assert.ok(content.includes('Keep this section manual.'), 'Human content must be intact');
    assert.ok(content.includes('greet'), 'Signatures must be present');
    const markerCount = (content.match(/Auto-generated signatures/g) || []).length;
    assert.strictEqual(markerCount, 1, 'Marker should appear exactly once');
  });
});

// ─────────────────────────────────────────────────────────────
// cursor output
// ─────────────────────────────────────────────────────────────
test('cursor output writes .cursorrules', () => {
  withTempProject((dir) => {
    seedProject(dir);
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      outputs: ['cursor'],
      secretScan: false,
    }));

    runGenerate(dir);

    const out = path.join(dir, '.cursorrules');
    assert.ok(fs.existsSync(out), '.cursorrules should exist');
    const content = fs.readFileSync(out, 'utf8');
    assert.ok(content.includes('greet'), 'Content should include extracted signature');
  });
});

// ─────────────────────────────────────────────────────────────
// windsurf output
// ─────────────────────────────────────────────────────────────
test('windsurf output writes .windsurfrules', () => {
  withTempProject((dir) => {
    seedProject(dir);
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      outputs: ['windsurf'],
      secretScan: false,
    }));

    runGenerate(dir);

    const out = path.join(dir, '.windsurfrules');
    assert.ok(fs.existsSync(out), '.windsurfrules should exist');
    const content = fs.readFileSync(out, 'utf8');
    assert.ok(content.includes('greet'), 'Content should include extracted signature');
  });
});

// ─────────────────────────────────────────────────────────────
// claude output — CLAUDE.md append strategy
// ─────────────────────────────────────────────────────────────
test('claude output creates CLAUDE.md with signatures', () => {
  withTempProject((dir) => {
    seedProject(dir);
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      outputs: ['claude'],
      secretScan: false,
    }));

    runGenerate(dir);

    const out = path.join(dir, 'CLAUDE.md');
    assert.ok(fs.existsSync(out), 'CLAUDE.md should exist');
    const content = fs.readFileSync(out, 'utf8');
    assert.ok(content.includes('Auto-generated signatures'), 'Should contain marker');
    assert.ok(content.includes('greet'), 'Should include extracted signature');
  });
});

test('claude output preserves human content above marker', () => {
  withTempProject((dir) => {
    seedProject(dir);

    // Pre-existing CLAUDE.md with human content
    const humanContent = '# My Project\n\nThis is my custom CLAUDE.md content.\n\n## Rules\n- Be concise\n';
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), humanContent);

    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      outputs: ['claude'],
      secretScan: false,
    }));

    runGenerate(dir);

    const out = path.join(dir, 'CLAUDE.md');
    const content = fs.readFileSync(out, 'utf8');
    assert.ok(content.startsWith('# My Project'), 'Human content at top must be preserved');
    assert.ok(content.includes('This is my custom CLAUDE.md content.'), 'Human content must be intact');
    assert.ok(content.includes('Be concise'), 'Human rules must be intact');
    assert.ok(content.includes('Auto-generated signatures'), 'Marker must exist');
    assert.ok(content.includes('greet'), 'Signatures must be present');
  });
});

test('claude output replaces existing signatures when re-run', () => {
  withTempProject((dir) => {
    seedProject(dir);
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      outputs: ['claude'],
      secretScan: false,
    }));

    // Run once
    runGenerate(dir);

    // Add a second function and run again
    const srcDir = path.join(dir, 'src');
    fs.writeFileSync(
      path.join(srcDir, 'helper.js'),
      'function helper() { return true; }\nmodule.exports = { helper };\n'
    );

    runGenerate(dir);

    const out = path.join(dir, 'CLAUDE.md');
    const content = fs.readFileSync(out, 'utf8');

    // Should not have the marker twice
    const markerCount = (content.match(/Auto-generated signatures/g) || []).length;
    assert.strictEqual(markerCount, 1, 'Marker should appear exactly once');

    // Both functions should appear
    assert.ok(content.includes('greet'), 'greet should be in output');
    assert.ok(content.includes('helper'), 'helper should be in output');
  });
});

// ─────────────────────────────────────────────────────────────
// all four outputs at once
// ─────────────────────────────────────────────────────────────
test('All 4 output targets written in a single run', () => {
  withTempProject((dir) => {
    seedProject(dir);
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      outputs: ['copilot', 'claude', 'cursor', 'windsurf'],
      secretScan: false,
    }));

    runGenerate(dir);

    const expected = [
      path.join(dir, '.github', 'copilot-instructions.md'),
      path.join(dir, 'CLAUDE.md'),
      path.join(dir, '.cursorrules'),
      path.join(dir, '.windsurfrules'),
    ];

    for (const f of expected) {
      assert.ok(fs.existsSync(f), `${path.basename(f)} should exist`);
      const content = fs.readFileSync(f, 'utf8');
      assert.ok(content.length > 0, `${path.basename(f)} should be non-empty`);
    }
  });
});

test('gemini output preserves human content above marker', () => {
  withTempProject((dir) => {
    seedProject(dir);
    const out = path.join(dir, '.github', 'gemini-context.md');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(
      out,
      '# Gemini setup notes\n\nUse concise answers.\n\n## Auto-generated signatures\n<!-- Updated by gen-context.js -->\n\nold signatures\n',
      'utf8'
    );

    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      outputs: ['gemini'],
      secretScan: false,
    }));

    runGenerate(dir);

    const content = fs.readFileSync(out, 'utf8');
    assert.ok(content.startsWith('# Gemini setup notes'), 'Human content at top must be preserved');
    assert.ok(content.includes('Use concise answers.'), 'Human content must be intact');
    assert.ok(content.includes('greet'), 'Signatures must be present');
    const markerCount = (content.match(/Auto-generated signatures/g) || []).length;
    assert.strictEqual(markerCount, 1, 'Marker should appear exactly once');
  });
});

test('codex output writes AGENTS.md and preserves human content above marker', () => {
  withTempProject((dir) => {
    seedProject(dir);
    const out = path.join(dir, 'AGENTS.md');
    fs.writeFileSync(
      out,
      '# Team agent rules\n\nDo not change this section.\n\n## Auto-generated signatures\n<!-- Updated by gen-context.js -->\n\nold signatures\n',
      'utf8'
    );

    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      outputs: ['codex'],
      secretScan: false,
    }));

    runGenerate(dir);

    const content = fs.readFileSync(out, 'utf8');
    assert.ok(content.startsWith('# Team agent rules'), 'Human content at top must be preserved');
    assert.ok(content.includes('Do not change this section.'), 'Human content must be intact');
    assert.ok(content.includes('greet'), 'Signatures must be present');
    const markerCount = (content.match(/Auto-generated signatures/g) || []).length;
    assert.strictEqual(markerCount, 1, 'Marker should appear exactly once');
  });
});

// ── the summary box names what the run wrote (#918) ─────────────────────────
// It printed a literal `.github/copilot-instructions.md` for every run — wrong
// in 12 of 16 real combinations of adapter and config.
function summaryOutputLine(dir, config, args = []) {
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ secretScan: false, ...config }));
  const r = require('child_process').spawnSync(process.execPath, [GEN_CONTEXT, ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const m = r.stderr.match(/^ Output {9}: (.*)$/m);
  assert.ok(m, `no Output line in the summary:\n${r.stderr}`);
  return { line: m[1] };
}

test('summary Output line: claude names CLAUDE.md, not the copilot file', () => {
  withTempProject((dir) => {
    seedProject(dir);
    const { line } = summaryOutputLine(dir, { outputs: ['claude'] });
    assert.strictEqual(line, 'CLAUDE.md');
    assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')) && !fs.existsSync(path.join(dir, '.github', 'copilot-instructions.md')));
  });
});

test('summary Output line: --adapter claude names CLAUDE.md', () => {
  withTempProject((dir) => {
    seedProject(dir);
    const { line } = summaryOutputLine(dir, {}, ['--adapter', 'claude']);
    assert.strictEqual(line, 'CLAUDE.md');
  });
});

test('summary Output line: every output the run writes is named, and only those', () => {
  withTempProject((dir) => {
    seedProject(dir);
    const { line } = summaryOutputLine(dir, { outputs: ['copilot', 'claude', 'cursor'] });
    assert.strictEqual(line, '.github/copilot-instructions.md, CLAUDE.md, .cursorrules');
    for (const f of ['.github/copilot-instructions.md', 'CLAUDE.md', '.cursorrules']) assert.ok(fs.existsSync(path.join(dir, f)), f);
  });
});

test('summary Output line: more than three outputs are counted, not listed', () => {
  withTempProject((dir) => {
    seedProject(dir);
    const { line } = summaryOutputLine(dir, { outputs: ['copilot', 'claude', 'cursor', 'windsurf', 'codex'] });
    assert.strictEqual(line, '.github/copilot-instructions.md, CLAUDE.md, .cursorrules (+2 more)');
  });
});

test('summary Output line: a custom copilot path and --output are what is named', () => {
  withTempProject((dir) => {
    seedProject(dir);
    assert.strictEqual(summaryOutputLine(dir, { outputs: ['copilot'], output: 'docs/ai.md' }).line, 'docs/ai.md');
    const withCopy = summaryOutputLine(dir, { outputs: ['claude'] }, ['--output', 'out/ctx.md']).line;
    assert.strictEqual(withCopy, 'CLAUDE.md, out/ctx.md');
  });
});

console.log('');
console.log(`multi-output: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
