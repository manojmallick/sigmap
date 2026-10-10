'use strict';

/**
 * One definition of the index population, and one of its age (#825).
 *
 * `generate` writes the signature index over an AUGMENTED population: the
 * configured `srcDirs` walk, widened by the declared package entrypoints, every
 * test root and every CI definition. All three widenings are deliberate — they
 * are how `sigmap ask` reaches code that lives outside `srcDirs` by
 * construction.
 *
 * `validate` measured that index against the UN-widened `srcDirs` list, so on
 * the SigMap repo 266 perfectly good entries (256 under `test/`, 10 under
 * `.github/`) read as "stale index entries … re-run sigmap", advice that could
 * not change the number because nothing was stale. `doctor` counted the same
 * entries as indexed coverage and called the index fresh. `status`, reading
 * only the usage log, said the index had never been built at all.
 *
 * Three private definitions of one population and one timestamp. These tests
 * pin the shared primitive structurally — the roots `generate` collects from
 * ARE the constants the classifier exports, not a second literal that happens
 * to match today — and behaviourally on both stale classes.
 *
 * Run: node test/integration/index-population.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const STATE = path.join(ROOT, 'src', 'analysis', 'index-state.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

/** stdout only — machine surfaces. */
const runOut = (dir, args) => {
  try { return execFileSync(process.execPath, [GEN, ...args], { cwd: dir, encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { return (e.stdout || ''); }
};

/** stdout + stderr — remediation lines are warnings, and warnings go to stderr. */
const run = (dir, args) => {
  const r = spawnSync(process.execPath, [GEN, ...args], { cwd: dir, encoding: 'utf8' });
  return (r.stdout || '') + (r.stderr || '');
};

const json = (dir, args) => JSON.parse(runOut(dir, args).trim().split('\n').pop());

/**
 * A repo whose index legitimately reaches past srcDirs: source, a test root, a
 * GitHub workflow and a declared package entrypoint.
 */
function makeRepo(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-idxpop-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });

  fs.writeFileSync(path.join(dir, 'src', 'alpha.js'), 'function alpha(a, b) { return a + b; }\nmodule.exports = { alpha };\n');
  fs.writeFileSync(path.join(dir, 'src', 'beta.js'), 'function beta(x) { return x * 2; }\nmodule.exports = { beta };\n');
  fs.writeFileSync(path.join(dir, 'test', 'alpha.test.js'), 'function itWorks() { return true; }\nmodule.exports = { itWorks };\n');
  fs.writeFileSync(path.join(dir, '.github', 'workflows', 'ci.yml'),
    'name: ci\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n');
  fs.writeFileSync(path.join(dir, 'cli.js'), 'function main() { return 0; }\nmodule.exports = { main };\n');
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ name: 'idxpop-fixture', version: '1.0.0', bin: { idxpop: './cli.js' } }));
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'),
    JSON.stringify(Object.assign({ srcDirs: ['src'], maxTokens: 6000, outputs: ['copilot'] }, opts.config || {})));

  run(dir, []);
  return dir;
}

const indexKeys = (dir) =>
  Object.keys(JSON.parse(fs.readFileSync(path.join(dir, '.context', 'sig-index.json'), 'utf8')).files);

// ---------------------------------------------------------------------------
// Structural: one definition, consumed by generate and by the classifier
// ---------------------------------------------------------------------------

test('generate collects test entries from the exported TEST_ROOTS, not a literal', () => {
  const src = fs.readFileSync(GEN, 'utf8');
  const fn = src.slice(src.indexOf('function collectTestEntries('));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.ok(/testRootDirs\s*\}\s*=\s*requireSourceOrBundled\('\.\/src\/analysis\/index-state'\)/.test(body),
    'collectTestEntries must import testRootDirs (built on TEST_ROOTS) from src/analysis/index-state');
  assert.ok(!/const\s+TEST_ROOTS\s*=\s*\[/.test(body),
    'collectTestEntries must not redeclare TEST_ROOTS as a local literal');
});

test('generate collects pipeline entries from the exported CI_DIRS, not a literal', () => {
  const src = fs.readFileSync(GEN, 'utf8');
  const fn = src.slice(src.indexOf('function collectPipelineEntries('));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.ok(/CI_DIRS\s*\}\s*=\s*requireSourceOrBundled\('\.\/src\/analysis\/index-state'\)/.test(body),
    'collectPipelineEntries must import CI_DIRS from src/analysis/index-state');
  assert.ok(!/const\s+CI_DIRS\s*=\s*\[/.test(body),
    'collectPipelineEntries must not redeclare CI_DIRS as a local literal');
});

test('validate, doctor and status all consume the shared primitive', () => {
  const gen = fs.readFileSync(GEN, 'utf8');
  const doc = fs.readFileSync(path.join(ROOT, 'src', 'doctor', 'diagnose.js'), 'utf8');
  assert.ok(fs.existsSync(STATE), 'src/analysis/index-state.js must exist');
  assert.ok(/classifyIndexEntries/.test(gen), 'validate must classify index entries');
  assert.ok(/indexFreshness/.test(gen), 'status must read freshness from the primitive');
  assert.ok(/require\('\.\.\/analysis\/index-state'\)/.test(doc), 'doctor must require the primitive');
  assert.ok(/classifyIndexEntries/.test(doc) && /indexFreshness/.test(doc) && /changedSince/.test(doc),
    'doctor must use all three shared definitions');
});

test('doctor no longer walks srcDirs with its own changed-since implementation', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'src', 'doctor', 'diagnose.js'), 'utf8');
  const fn = doc.slice(doc.indexOf('function _countChangedSince('));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.ok(/changedSince\(/.test(body), '_countChangedSince must delegate to the shared primitive');
  assert.ok(!/readdirSync/.test(body), '_countChangedSince must not keep a private walker');
});

// ---------------------------------------------------------------------------
// Behavioural: a healthy index reports zero stale
// ---------------------------------------------------------------------------

test('a full run leaves validate reporting 0 stale entries', () => {
  const dir = makeRepo();
  const v = json(dir, ['validate', '--json']);
  assert.strictEqual(v.staleEntries, 0, `expected 0 stale, got ${v.staleEntries}`);
  assert.strictEqual(v.missingEntries, 0);
  assert.strictEqual(v.outOfScopeEntries, 0);
});

test('validate names the augmented entries instead of calling them stale', () => {
  const dir = makeRepo();
  const v = json(dir, ['validate', '--json']);
  assert.strictEqual(v.augmentedEntries, 3, `expected 3 augmented, got ${v.augmentedEntries}`);
  assert.deepStrictEqual(v.augmentedByReason, { test: 1, ci: 1, entrypoint: 1 });

  const human = run(dir, ['validate']);
  assert.ok(/beyond srcDirs \(1 test, 1 CI, 1 entrypoint\)/.test(human),
    `human output must name the augmented population, got: ${human.trim()}`);
  assert.ok(!/stale/.test(human), `nothing is stale here, got: ${human.trim()}`);
});

test('doctor separates in-scope from augmented entries and stays ok', () => {
  const dir = makeRepo();
  const out = run(dir, ['doctor']);
  assert.ok(/✓ Signature index — 2 in-scope file\(s\) indexed · 3 beyond srcDirs \(1 test, 1 CI, 1 entrypoint\)/.test(out),
    `doctor must split the populations, got: ${out}`);
  assert.ok(!/Signature index.*stale/.test(out), 'nothing is stale here');
});

// ---------------------------------------------------------------------------
// Behavioural: the two real stale classes
// ---------------------------------------------------------------------------

test('a deleted file is stale, and a full run prunes it', () => {
  const dir = makeRepo({ config: { sigCache: true } });
  fs.unlinkSync(path.join(dir, 'src', 'beta.js'));

  // Simulate the index an earlier run left behind for the now-deleted file.
  const p = path.join(dir, '.context', 'sig-index.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  data.files['src/beta.js'] = ['function beta(x)  :1-1'];
  fs.writeFileSync(p, JSON.stringify(data));

  const before = json(dir, ['validate', '--json']);
  assert.strictEqual(before.missingEntries, 1, 'a deleted file must count as stale');
  assert.strictEqual(before.staleEntries, 1);

  const warned = run(dir, ['validate']);
  assert.ok(/no longer exist/.test(warned) && /run: sigmap/.test(warned),
    `remediation must name the command that prunes them, got: ${warned}`);

  run(dir, []);
  const after = json(dir, ['validate', '--json']);
  assert.strictEqual(after.staleEntries, 0, 'the advised full run must actually clear it');
  assert.ok(!indexKeys(dir).includes('src/beta.js'));
});

test('the sig-cache does not keep a deleted file across a full run', () => {
  const dir = makeRepo({ config: { sigCache: true } });
  const cachePath = path.join(dir, '.sigmap-cache.json');
  assert.ok(fs.existsSync(cachePath), 'fixture must exercise the sig-cache');
  assert.ok(Object.keys(JSON.parse(fs.readFileSync(cachePath, 'utf8')).entries)
    .some((k) => k.endsWith('beta.js')), 'beta.js must be cached before deletion');

  fs.unlinkSync(path.join(dir, 'src', 'beta.js'));
  run(dir, []);

  const entries = Object.keys(JSON.parse(fs.readFileSync(cachePath, 'utf8')).entries);
  assert.ok(!entries.some((k) => k.endsWith('beta.js')), 'a full run must prune the deleted entry');
});

test('a file outside srcDirs with no test/CI/entrypoint role is stale, with a config remedy', () => {
  const dir = makeRepo();
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'scripts', 'tool.js'), 'function tool() { return 1; }\n');

  const p = path.join(dir, '.context', 'sig-index.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  data.files['scripts/tool.js'] = ['function tool()  :1-1'];
  fs.writeFileSync(p, JSON.stringify(data));

  const v = json(dir, ['validate', '--json']);
  assert.strictEqual(v.outOfScopeEntries, 1);
  assert.strictEqual(v.missingEntries, 0);

  const out = run(dir, ['validate']);
  assert.ok(/outside srcDirs/.test(out) && /srcDirs/.test(out),
    `remediation must point at the config, not a re-run, got: ${out}`);
  assert.ok(!/no longer exist/.test(out), 'an existing file is not a deletion');
});

test('doctor warns and does not say "up to date" while the index holds stale entries', () => {
  const dir = makeRepo();
  const p = path.join(dir, '.context', 'sig-index.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  data.files['src/gone.js'] = ['function gone()  :1-1'];
  fs.writeFileSync(p, JSON.stringify(data));

  const out = run(dir, ['doctor']);
  assert.ok(/⚠ Signature index/.test(out), `index check must warn, got: ${out}`);
  assert.ok(/1 stale/.test(out), `stale count must be visible, got: ${out}`);
  assert.ok(!/index is up to date with sources/.test(out),
    `freshness must not claim up-to-date while stale, got: ${out}`);
});

// ---------------------------------------------------------------------------
// Behavioural: freshness agrees across status and doctor
// ---------------------------------------------------------------------------

test('status reports the index age with tracking off, and discloses the source', () => {
  const dir = makeRepo();
  const out = run(dir, ['status']);
  assert.ok(!/Last index:\s+never/.test(out), `a generated index is not "never", got: ${out}`);
  assert.ok(/from \.context\/sig-index\.json/.test(out),
    `the fallback must disclose its source, got: ${out}`);
});

test('status and doctor agree on freshness with tracking off', () => {
  const dir = makeRepo();
  const st = json(dir, ['status', '--json']);
  const doc = run(dir, ['doctor']);

  assert.ok(st.lastIndex, 'status must have a timestamp');
  assert.strictEqual(st.changedSinceIndex, 0, 'nothing changed since generate');
  assert.ok(/✓ Index freshness — index is up to date with sources/.test(doc),
    `doctor must agree the index is fresh, got: ${doc}`);

  // And they must move together when a source file changes.
  fs.writeFileSync(path.join(dir, 'src', 'alpha.js'), 'function alpha(a, b, c) { return a + b + c; }\n');
  const st2 = json(dir, ['status', '--json']);
  const doc2 = run(dir, ['doctor']);
  assert.strictEqual(st2.changedSinceIndex, 1, `status must see the change, got ${st2.changedSinceIndex}`);
  assert.ok(/⚠ Index freshness — 1 source file\(s\) changed since last generate/.test(doc2),
    `doctor must see the same single change, got: ${doc2}`);
});

test('tracking-on status still reports the usage log as its source', () => {
  const dir = makeRepo({ config: { tracking: true } });
  run(dir, ['--track']);
  const st = json(dir, ['status', '--json']);
  assert.strictEqual(st.indexSource, 'usage log', `tracking-on must prefer the log, got ${st.indexSource}`);
  assert.ok(st.lastIndex, 'the log must supply a timestamp');
});

// ---------------------------------------------------------------------------
// Behavioural: a test root is spelled as it is on disk (#893 §5)
// ---------------------------------------------------------------------------

/** A repo whose only test root is SwiftPM's capitalised `Tests/`. */
function makeSwiftPmRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-idxpop-case-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'Tests', 'NetworkingTests'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'alpha.js'), 'function alpha(a, b) { return a + b; }\nmodule.exports = { alpha };\n');
  fs.writeFileSync(path.join(dir, 'Tests', 'NetworkingTests', 'PacerTests.swift'),
    'final class PacerTests {\n    func testPacing() -> Bool { return true }\n}\n');
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'),
    JSON.stringify({ srcDirs: ['src'], maxTokens: 6000, outputs: ['copilot'] }));
  run(dir, []);
  return dir;
}

test('testRootDirs matches a root case-insensitively and keeps the on-disk spelling', () => {
  const { testRootDirs } = require(STATE);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-idxpop-roots-'));
  for (const d of ['Tests', 'e2e', 'testament', 'src']) fs.mkdirSync(path.join(dir, d));
  fs.writeFileSync(path.join(dir, 'spec'), 'a file named like a root is not a root');
  assert.deepStrictEqual(testRootDirs(dir), ['Tests', 'e2e']);
  assert.deepStrictEqual(testRootDirs(path.join(dir, 'missing')), []);
});

test('a capitalised Tests/ is indexed under its on-disk key on every filesystem', () => {
  const keys = indexKeys(makeSwiftPmRepo());
  assert.ok(keys.includes('Tests/NetworkingTests/PacerTests.swift'),
    `Tests/ must be indexed with its own spelling, got: ${keys.join(', ')}`);
  assert.ok(!keys.includes('tests/NetworkingTests/PacerTests.swift'),
    'the lowercased key is the macOS-only artefact this guards against');
});

test('the classifier calls a capitalised Tests/ entry a test, not stale', () => {
  const { augmentedReason } = require(STATE);
  assert.strictEqual(augmentedReason('Tests/NetworkingTests/PacerTests.swift'), 'test');
  const v = json(makeSwiftPmRepo(), ['validate', '--json']);
  assert.strictEqual(v.staleEntries, 0, `expected 0 stale, got ${v.staleEntries}`);
  assert.deepStrictEqual(v.augmentedByReason.test, 1);
});

// ---------------------------------------------------------------------------

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
