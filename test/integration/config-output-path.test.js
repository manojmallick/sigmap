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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-output-path-'));
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

// ─────────────────────────────────────────────────────────────────────────
// Issue #30: custom output path for copilot adapter
// ─────────────────────────────────────────────────────────────────────────

test('output + outputs:["copilot"] writes to custom path', () => {
  withTempProject((dir) => {
    seedProject(dir);
    const customPath = '.context/sigmap-instructions.md';
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      output: customPath,
      outputs: ['copilot'],
      secretScan: false,
    }));

    runGenerate(dir);

    const customFile = path.join(dir, customPath);
    assert.ok(fs.existsSync(customFile), `Custom output path "${customPath}" should exist`);
    const content = fs.readFileSync(customFile, 'utf8');
    assert.ok(content.includes('greet'), 'Content should include extracted signature');
    
    // Verify default path is NOT written
    const defaultFile = path.join(dir, '.github', 'copilot-instructions.md');
    assert.ok(!fs.existsSync(defaultFile), '.github/copilot-instructions.md should NOT exist when custom path is set');
  });
});

test('output + adapters:["copilot"] writes to custom path', () => {
  withTempProject((dir) => {
    seedProject(dir);
    const customPath = '.qoder/qoder-instructions.md';
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      output: customPath,
      adapters: ['copilot'],
      secretScan: false,
    }));

    runGenerate(dir);

    const customFile = path.join(dir, customPath);
    assert.ok(fs.existsSync(customFile), `Custom output path "${customPath}" should exist`);
    const content = fs.readFileSync(customFile, 'utf8');
    assert.ok(content.includes('greet'), 'Content should include extracted signature');
    
    // Verify default path is NOT written
    const defaultFile = path.join(dir, '.github', 'copilot-instructions.md');
    assert.ok(!fs.existsSync(defaultFile), '.github/copilot-instructions.md should NOT exist when custom path is set');
  });
});

test('no output falls back to .github/copilot-instructions.md', () => {
  withTempProject((dir) => {
    seedProject(dir);
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      outputs: ['copilot'],
      secretScan: false,
      // Note: no 'output' key
    }));

    runGenerate(dir);

    const defaultFile = path.join(dir, '.github', 'copilot-instructions.md');
    assert.ok(fs.existsSync(defaultFile), '.github/copilot-instructions.md should exist as fallback');
    const content = fs.readFileSync(defaultFile, 'utf8');
    assert.ok(content.includes('greet'), 'Content should include extracted signature');
  });
});

test('cursor still uses fixed path (.cursorrules)', () => {
  withTempProject((dir) => {
    seedProject(dir);
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      output: '.custom/path.md',
      outputs: ['cursor'],
      secretScan: false,
    }));

    runGenerate(dir);

    // Cursor should still write to fixed .cursorrules
    const cursorFile = path.join(dir, '.cursorrules');
    assert.ok(fs.existsSync(cursorFile), '.cursorrules should exist');
    
    // Custom output path should NOT be used for cursor
    const customFile = path.join(dir, '.custom', 'path.md');
    assert.ok(!fs.existsSync(customFile), 'Custom output path should NOT be used for cursor adapter');
  });
});

test('claude still uses fixed path (CLAUDE.md)', () => {
  withTempProject((dir) => {
    seedProject(dir);
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      output: '.custom/path.md',
      outputs: ['claude'],
      secretScan: false,
    }));

    runGenerate(dir);

    // Claude should write to fixed CLAUDE.md
    const claudeFile = path.join(dir, 'CLAUDE.md');
    assert.ok(fs.existsSync(claudeFile), 'CLAUDE.md should exist');
    
    // Custom output path should NOT be used for claude
    const customFile = path.join(dir, '.custom', 'path.md');
    assert.ok(!fs.existsSync(customFile), 'Custom output path should NOT be used for claude adapter');
  });
});

test('output + outputs:["copilot", "claude"] writes copilot to custom path, claude to CLAUDE.md', () => {
  withTempProject((dir) => {
    seedProject(dir);
    const customPath = '.context/sigmap.md';
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      output: customPath,
      outputs: ['copilot', 'claude'],
      secretScan: false,
    }));

    runGenerate(dir);

    // Copilot should write to custom path
    const customFile = path.join(dir, customPath);
    assert.ok(fs.existsSync(customFile), `Custom output path "${customPath}" should exist for copilot`);
    
    // Claude should write to fixed CLAUDE.md
    const claudeFile = path.join(dir, 'CLAUDE.md');
    assert.ok(fs.existsSync(claudeFile), 'CLAUDE.md should exist for claude');
    
    // Default copilot path should NOT be used
    const defaultFile = path.join(dir, '.github', 'copilot-instructions.md');
    assert.ok(!fs.existsSync(defaultFile), '.github/copilot-instructions.md should NOT exist when custom output is set');
  });
});

test('output path can be in nested directory', () => {
  withTempProject((dir) => {
    seedProject(dir);
    const customPath = '.docs/generated/ai-context.md';
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      output: customPath,
      outputs: ['copilot'],
      secretScan: false,
    }));

    runGenerate(dir);

    const customFile = path.join(dir, customPath);
    assert.ok(fs.existsSync(customFile), `Nested output path "${customPath}" should exist`);
    const content = fs.readFileSync(customFile, 'utf8');
    assert.ok(content.includes('greet'), 'Content should include extracted signature');
    
    // Verify all intermediate directories were created
    assert.ok(fs.existsSync(path.dirname(customFile)), 'Parent directories should be created');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────
console.log('\n─ Config Output Path Tests ─────────────────────────────────────────');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('─────────────────────────────────────────────────────────────────────\n');

if (failed > 0) {
  process.exit(1);
}
