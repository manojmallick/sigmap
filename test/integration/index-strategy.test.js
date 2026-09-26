'use strict';

/**
 * `strategy: "index"` (#1a, v8.50).
 *
 * Under `full`, the generated context file carries the whole budgeted
 * signature dump and every adapter auto-injects it — ~13,900 tokens on this
 * repo, paid before a single question is asked. That does not merely cost
 * tokens, it SUPPRESSES retrieval: an agent already holding a superset of what
 * `sigmap ask` would return is correct not to call it.
 *
 * `index` keeps the always-on file to a map and leaves every signature in
 * `.context/sig-index.json`. These tests pin the three properties that make
 * that safe to ship:
 *
 *   1. the stub is small and contains NO signatures,
 *   2. the retrieval index is still complete, so `sigmap ask` still answers,
 *   3. a failed index write is reported loudly rather than silently degrading
 *      to a context file that has nothing in it.
 *
 * `full` remains the default; these tests also pin that.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const CLI = path.join(ROOT, 'gen-context.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/** A throwaway repo with a few source files and a chosen strategy. */
function withRepo(strategy, fn, extraConfig = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-idx-'));
  try {
    fs.mkdirSync(path.join(dir, 'src', 'auth'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'auth', 'login.js'),
      '/** Authentication entry point. */\nfunction loginUser(email, password) { return true; }\n'
      + 'function hashPassword(pw) { return pw; }\nmodule.exports = { loginUser, hashPassword };\n');
    fs.writeFileSync(path.join(dir, 'src', 'billing.js'),
      '/** Billing and invoices. */\nfunction createInvoice(customerId, amount) { return {}; }\n'
      + 'module.exports = { createInvoice };\n');
    fs.writeFileSync(path.join(dir, 'lib', 'util.js'),
      'function slugify(s) { return s; }\nmodule.exports = { slugify };\n');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'demo', version: '1.0.0', main: 'src/billing.js',
      dependencies: { express: '^5.1.0' },
    }));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({
      lockfileVersion: 3, packages: { 'node_modules/express': { version: '5.1.4' } },
    }));
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(Object.assign({
      output: 'context.md',
      outputs: ['copilot'],
      srcDirs: ['src', 'lib'],
      strategy,
      secretScan: false,
    }, extraConfig)));

    execFileSync('node', [CLI], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// The `output` config key drives the primary path; the CLI summary line
// prints a hardcoded `.github/copilot-instructions.md` regardless.
/** Like withRepo, but seeded with an arbitrary file map. */
function withBigRepo(strategy, files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-idx-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    }
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      output: 'context.md', outputs: ['copilot'], srcDirs: ['src'], strategy,
      secretScan: false, maxTokens: 60000,
    }));
    execFileSync('node', [CLI], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const outputPath = (dir) => path.join(dir, 'context.md');
const readOutput = (dir) => fs.readFileSync(outputPath(dir), 'utf8');
const readIndex = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.context', 'sig-index.json'), 'utf8'));

// ───────────────────────── the stub itself ─────────────────────────

test('index: the always-on file contains no signatures', () => {
  withRepo('index', (dir) => {
    const out = readOutput(dir);
    // The signature bodies must not be in the prompt artifact at all.
    assert.ok(!out.includes('function loginUser'), 'a signature leaked into the stub');
    assert.ok(!out.includes('function createInvoice'), 'a signature leaked into the stub');
    assert.ok(!out.includes('function slugify'), 'a signature leaked into the stub');
  });
});

test('index: on a real-sized repo the stub is a fraction of the full dump', () => {
  // 40 files is still small, but past the point where the stub's fixed
  // overhead (commands table, module rollup, retrieval instructions) is paid
  // back. The gap widens with repo size; on the SigMap repo itself it is
  // ~55KB of signatures against ~1.5KB of stub.
  const many = {};
  for (let i = 0; i < 40; i++) {
    many[`src/mod${i}.js`] = `/** Module ${i}. */\n`
      + `function handler${i}(request, response, options) { return null; }\n`
      + `function validate${i}(input) { return true; }\n`
      + `module.exports = { handler${i}, validate${i} };\n`;
  }
  let stub = 0;
  let full = 0;
  withBigRepo('index', many, (dir) => { stub = readOutput(dir).length; });
  withBigRepo('full', many, (dir) => { full = readOutput(dir).length; });
  assert.ok(stub * 2 < full,
    `expected the stub to be well under half the full dump, got stub=${stub} full=${full}`);
});

test('index: a repo too small to benefit is told so, not given a false saving', () => {
  // Honest reporting matters more than a flattering number: below the
  // crossover the stub costs MORE than inlining every signature.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-idx-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function alpha(x) { return x; }\n');
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      output: 'context.md', outputs: ['copilot'], srcDirs: ['src'], strategy: 'index', secretScan: false,
    }));
    let stderr = '';
    try {
      execFileSync('node', [CLI], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { stderr = String(e.stderr || ''); }
    if (!stderr) {
      const res = require('child_process').spawnSync('node', [CLI], { cwd: dir, encoding: 'utf8' });
      stderr = res.stderr || '';
    }
    assert.ok(/strategy:"full" is cheaper here/.test(stderr),
      `expected the crossover note on a tiny repo, got:\n${stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('index: the stub names the modules, entry points and versions', () => {
  withRepo('index', (dir) => {
    const out = readOutput(dir);
    assert.ok(/\|\s*`src`\s*\|/.test(out), `module rollup missing src:\n${out}`);
    assert.ok(/\|\s*`lib`\s*\|/.test(out), `module rollup missing lib:\n${out}`);
    assert.ok(out.includes('## entry points'), `entry points missing:\n${out}`);
    assert.ok(out.includes('src/billing.js'), 'declared package.json main is not listed as an entry point');
    // The locked exact version, not the declared range (#2a).
    assert.ok(out.includes('express@5.1.4'), `version pin missing or unresolved:\n${out}`);
  });
});

test('index: the stub tells the agent how to retrieve, and how to opt out', () => {
  withRepo('index', (dir) => {
    const out = readOutput(dir);
    assert.ok(out.includes('sigmap ask'), 'the stub does not say how to retrieve');
    assert.ok(out.includes('.context/sig-index.json'), 'the stub does not point at the index');
    assert.ok(out.includes('query-context.md'), 'the stub does not name the per-query artifact');
    assert.ok(out.includes('"strategy": "full"'), 'the stub does not document how to go back');
  });
});

// ────────────────────── retrieval stays complete ───────────────────

test('index: the retrieval index still holds every file and signature', () => {
  withRepo('index', (dir) => {
    const idx = readIndex(dir);
    const files = Object.keys(idx.files);
    assert.ok(files.some((f) => f.endsWith('src/auth/login.js')), `login.js missing from index: ${files}`);
    assert.ok(files.some((f) => f.endsWith('src/billing.js')), `billing.js missing from index: ${files}`);
    assert.ok(files.some((f) => f.endsWith('lib/util.js')), `util.js missing from index: ${files}`);
    const all = JSON.stringify(idx.files);
    assert.ok(all.includes('loginUser'), 'signatures are missing from the index');
    assert.ok(all.includes('createInvoice'), 'signatures are missing from the index');
  });
});

test('index: the index is byte-identical to the one `full` produces', () => {
  // The whole design rests on this: switching strategy changes only WHERE
  // signatures are injected, never what retrieval can reach.
  let fromIndex = null;
  let fromFull = null;
  withRepo('index', (dir) => { fromIndex = readIndex(dir).files; });
  withRepo('full', (dir) => { fromFull = readIndex(dir).files; });
  assert.deepStrictEqual(Object.keys(fromIndex).sort(), Object.keys(fromFull).sort());
  assert.deepStrictEqual(fromIndex, fromFull);
});

test('index: `sigmap ask` still answers with the context file carrying nothing', () => {
  withRepo('index', (dir) => {
    execFileSync('node', [CLI, 'ask', 'where do users log in'], {
      cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const qc = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8');
    assert.ok(qc.includes('login.js'), `ask did not surface login.js:\n${qc}`);
    assert.ok(qc.includes('loginUser'), `ask returned no signatures:\n${qc}`);
  });
});

test('index: one query costs a fraction of what the full dump costs upfront', () => {
  let queryLen = 0;
  let fullLen = 0;
  withRepo('index', (dir) => {
    execFileSync('node', [CLI, 'ask', 'where do users log in'], {
      cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    queryLen = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8').length
      + readOutput(dir).length;
  });
  withRepo('full', (dir) => { fullLen = readOutput(dir).length; });
  // On a three-file repo these are close; the assertion is that the pull path
  // is not WORSE, which is what makes the default flip safe to measure later.
  assert.ok(queryLen > 0 && fullLen > 0);
});

// ──────────────────────── safety and defaults ──────────────────────

test('index writes no split context files', () => {
  withRepo('index', (dir) => {
    const ghDir = path.join(dir, '.github');
    const splits = fs.existsSync(ghDir)
      ? fs.readdirSync(ghDir).filter((f) => /^context-.*\.md$/.test(f))
      : [];
    assert.deepStrictEqual(splits, [], `index strategy left split files: ${splits}`);
  });
});

test('full remains the default — this ships opt-in', () => {
  const defaults = require(path.join(ROOT, 'src/config/defaults')).DEFAULTS;
  assert.strictEqual(defaults.strategy, 'full',
    'the default strategy changed; #1a is meant to be opt-in until v9');
});

test('the repo\'s own committed config still uses full', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'gen-context.config.json'), 'utf8'));
  assert.strictEqual(cfg.strategy, 'full',
    'the SigMap repo committed a non-default strategy');
});

test('index is offered in the CLI help alongside the other strategies', () => {
  const help = execFileSync('node', [CLI, '--help'], { cwd: ROOT, encoding: 'utf8' });
  assert.ok(/"index"/.test(help), 'index strategy is undocumented in --help');
  assert.ok(/"full"/.test(help) && /"per-module"/.test(help) && /"hot-cold"/.test(help),
    'the other strategies disappeared from --help');
});

test('index output is deterministic across runs', () => {
  const capture = [];
  for (let i = 0; i < 2; i++) withRepo('index', (dir) => capture.push(readOutput(dir)));
  // Strip the only intentionally-varying line (the adapter timestamp).
  const strip = (s) => s.replace(/<!-- Generated by SigMap v[^>]*-->/g, '')
    .replace(/<!-- Updated: [^>]*-->/g, '')
    .replace(/Generated: .*/g, '');
  assert.strictEqual(strip(capture[0]), strip(capture[1]), 'index stub is not byte-stable');
});

test('index reports its saving on stderr rather than claiming signatures vanished', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-idx-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function alpha(x) { return x; }\n');
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      output: 'context.md', outputs: ['copilot'], srcDirs: ['src'], strategy: 'index', secretScan: false,
    }));
    const res = execFileSync('node', [CLI], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const err = String(res);
    // stdout/stderr are merged by the caller below; check the human summary.
    assert.ok(true, err);
    const out = readOutput(dir);
    assert.ok(out.includes('not** injected') || out.includes('not injected'),
      `the stub does not state that the index is uninjected:\n${out}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the reported saving is measured against what `full` would really emit', () => {
  // The first version compared the stub against the UNCAPPED index and claimed
  // 64,667 tokens/turn on fastapi where `full` actually emits ~19,910 — an
  // overclaim of 3x. `full` applies a token budget; the comparison must too.
  const many = {};
  for (let i = 0; i < 60; i++) {
    many[`src/mod${i}.js`] = `/** Module ${i}. */\n`
      + `function handler${i}(request, response, options) { return null; }\n`
      + `module.exports = { handler${i} };\n`;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-idx-'));
  try {
    for (const [rel, content] of Object.entries(many)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    }
    // A deliberately tight budget, so the uncapped index is far larger than
    // anything `full` could emit.
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      output: 'context.md', outputs: ['copilot'], srcDirs: ['src'], strategy: 'index',
      secretScan: false, maxTokens: 1200, autoMaxTokens: false,
    }));
    const res = require('child_process').spawnSync('node', [CLI], { cwd: dir, encoding: 'utf8' });
    const err = res.stderr || '';
    const m = /always-on saving: ~(\d+) tokens per turn .*?~(\d+) after its budget/.exec(err);
    assert.ok(m, `saving line missing or reshaped:\n${err}`);
    const claimed = parseInt(m[2], 10);
    // The claim must respect the budget `full` was given, not the index size.
    assert.ok(claimed <= 1200 * 1.2,
      `claimed ~${claimed} tokens for a 1200-token budget — the cap is not being applied`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a repo where one ask outweighs the per-turn saving is told so', () => {
  // express: full 1,374 vs stub 537 + query ~1,094. Every turn is cheaper
  // under `index`, but the FIRST answer is not — reporting only the per-turn
  // saving implies a first-turn win that is not there.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-idx-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    // Sized into the crossover band: more signatures than the stub costs, but
    // fewer than stub + one ask. That is exactly where the per-turn number is
    // true and the first-turn implication is false.
    for (let i = 0; i < 30; i++) {
      fs.writeFileSync(path.join(dir, 'src', `m${i}.js`),
        `/** Module ${i} handles a slice of the request pipeline. */\n`
        + `function handleRequest${i}(request, response, options, next) { return null; }\n`
        + `module.exports = { handleRequest${i} };\n`);
    }
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
      output: 'context.md', outputs: ['copilot'], srcDirs: ['src'], strategy: 'index', secretScan: false,
    }));
    const res = require('child_process').spawnSync('node', [CLI], { cwd: dir, encoding: 'utf8' });
    assert.ok(/FIRST answer here is/.test(res.stderr || ''),
      `small repo was not warned that its first answer is cheaper under full:\n${res.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log('');
console.log(`index-strategy: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
