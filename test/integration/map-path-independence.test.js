'use strict';

/**
 * #993 — the generated map is a function of the repo, not of where it is checked out.
 *
 * Two things broke "byte-stable" for the artifact most users see:
 *
 *   1. The token budget priced each section by its ABSOLUTE path while the
 *      heading renders the repo-relative one, so the same commit lost sections
 *      the deeper it was cloned (gin: 69 → 50 over 180 characters of path).
 *      It also classified files by the absolute path, so a checkout under a
 *      directory named `test` turned every file into a test.
 *   2. The first run was not a fixed point: the second run indexed the file the
 *      first one wrote (`.github/copilot-instructions.md`), and the third indexed
 *      the second.
 *
 * Each test fails on the code before this change. The only line allowed to
 * differ between two runs is the trailing wall-clock stamp, and that stays one
 * line, last (the #683 stable-prefix layout).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-pathind-'));

/** A repo big enough that a 1,500-token budget has to choose: 8 modules × 10 files, plus tests. */
function makeRepo(dir, { adapters } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  for (let m = 0; m < 8; m++) {
    const d = path.join(dir, 'src', `mod${m}`);
    fs.mkdirSync(d, { recursive: true });
    for (let i = 0; i < 10; i++) {
      let body = '';
      const names = [];
      for (let k = 0; k < 4; k++) { names.push(`fn_${m}_${i}_${k}`); body += `function fn_${m}_${i}_${k}(alpha, beta) { return alpha + beta; }\n`; }
      fs.writeFileSync(path.join(d, `file${i}.js`), `${body}module.exports = { ${names.join(', ')} };\n`);
    }
  }
  fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
  for (let i = 0; i < 12; i++) {
    fs.writeFileSync(path.join(dir, 'test', `case${i}.test.js`), `function check_${i}(x) { return x; }\nmodule.exports = { check_${i} };\n`);
  }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'pathind', version: '1.0.0' }));
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
    maxTokens: 1500, autoMaxTokens: false, srcDirs: ['src', 'test'],
    ...(adapters ? { adapters } : {}),
  }));
  stampMtimes(dir);
}

/**
 * Recency is a drop-order input, so two checkouts only differ by their PATH if their
 * timestamps agree. Linux stamps files from a coarse clock (about 4 ms): 92 files written
 * in a loop land on a few dozen distinct mtimes, and where the boundaries fall depends on
 * timing, not on the repo. Fixed whole-second mtimes, increasing in path order, put the
 * same recency ranking in every checkout and keep the mtime branch of the comparator live.
 */
function stampMtimes(dir) {
  const files = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d).sort()) {
      const full = path.join(d, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  const base = 1700000000;
  files.forEach((f, i) => fs.utimesSync(f, base + i, base + i));
}

function generate(dir) {
  const res = spawnSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, `generation failed:\n${res.stdout}${res.stderr}`);
  return fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
}

const sections = (text) => text.split('\n').filter((l) => l.startsWith('### ')).map((l) => l.replace(/ \(used by:.*$/, ''));
const withoutStamp = (text) => text.split('\n').filter((l) => !/^<!-- Updated: /.test(l)).join('\n');

// ---------------------------------------------------------------------------
// 1. The checkout path does not change the map
// ---------------------------------------------------------------------------
test('the same commit gives the same sections and bytes at four checkout depths', () => {
  const outputs = [0, 60, 120, 180].map((pad) => {
    const dir = path.join(tmpRoot, pad ? 'd'.repeat(pad) : 'near', 'proj');
    makeRepo(dir);
    return { pad, text: generate(dir), dir };
  });
  const base = outputs[0];
  assert.ok(sections(base.text).length > 8 && sections(base.text).length < 8 * 10 + 12, `the budget must bite for this to prove anything, got ${sections(base.text).length} sections`);
  for (const o of outputs.slice(1)) {
    assert.strictEqual(sections(o.text).length, sections(base.text).length, `${o.pad} extra characters of path: ${sections(o.text).length} sections vs ${sections(base.text).length}`);
    assert.strictEqual(withoutStamp(o.text), withoutStamp(base.text), `${o.pad} extra characters of path changed the bytes`);
  }
});

test('a checkout under a directory named test does not turn every file into a test', () => {
  const plain = path.join(tmpRoot, 'plain', 'proj');
  const inTest = path.join(tmpRoot, 'test', 'proj');
  makeRepo(plain);
  makeRepo(inTest);
  assert.strictEqual(withoutStamp(generate(inTest)), withoutStamp(generate(plain)));
  // and the drop order still keeps source ahead of tests under that budget
  const kept = sections(generate(inTest));
  assert.ok(kept.filter((s) => /^### src\//.test(s)).length > kept.filter((s) => /^### test\//.test(s)).length, kept.join('\n'));
});

// ---------------------------------------------------------------------------
// 2. The first run is the fixed point
// ---------------------------------------------------------------------------
function fixedPointRepo(name, adapters) {
  const dir = path.join(tmpRoot, name);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.github'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'one.js'), 'function one(a) { return a; }\nmodule.exports = { one };\n');
  fs.writeFileSync(path.join(dir, '.github', 'PULL_REQUEST_TEMPLATE.md'), '# Template\nDescribe the change.\n');
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Human notes\n\n## Rules\nBe kind.\n');
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Human agents\n\n## Setup\nRun it.\n');
  // srcDirs is the root, as on gin and any repo without a src/ directory: that is where the outputs live
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ adapters, srcDirs: ['.'] }));
  return dir;
}

test('two runs on an unchanged tree give identical bytes apart from the stamp, and the first already equals the second', () => {
  const dir = fixedPointRepo('fixed', ['copilot']);
  const first = generate(dir);
  const second = generate(dir);
  const third = generate(dir);
  assert.deepStrictEqual(sections(first), sections(second), 'run 2 indexed something run 1 did not');
  assert.strictEqual(withoutStamp(first), withoutStamp(second));
  assert.strictEqual(withoutStamp(second), withoutStamp(third));
});

test('SigMap\'s own outputs are never listed as sections, whichever adapters wrote them', () => {
  const dir = fixedPointRepo('adapters', ['copilot', 'claude', 'cursor', 'windsurf', 'codex', 'gemini', 'openai']);
  generate(dir);
  const text = generate(dir);
  const listed = sections(text).join('\n');
  for (const out of ['.github/copilot-instructions.md', '.github/gemini-context.md', '.github/openai-context.md', '.cursorrules', '.windsurfrules']) {
    assert.ok(!listed.includes(out), `${out} is listed:\n${listed}`);
  }
  // CLAUDE.md and AGENTS.md hold human lines above SigMap's block: those are still the repo's to index.
  assert.ok(/### CLAUDE\.md/.test(listed) && /### AGENTS\.md/.test(listed), listed);
  const claudeSection = text.split('### CLAUDE.md')[1].split('\n### ')[0];
  assert.ok(/Human notes/.test(claudeSection) && !/Code signatures/.test(claudeSection), `the managed block leaked into the section:\n${claudeSection}`);
});

// ---------------------------------------------------------------------------
// 3. The wall-clock stays isolated
// ---------------------------------------------------------------------------
test('the wall-clock is one trailing line, so nothing else can differ between runs', () => {
  const dir = fixedPointRepo('stamp', ['copilot']);
  const text = generate(dir);
  const stamped = text.split('\n').filter((l) => /\b20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d/.test(l));
  assert.strictEqual(stamped.length, 1, `expected one line carrying a timestamp, got:\n${stamped.join('\n')}`);
  assert.ok(/^<!-- Updated: /.test(stamped[0]) && text.trimEnd().endsWith(stamped[0].trimEnd()), 'and it is the last line');
});

try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}

console.log(`\nmap-path-independence: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
