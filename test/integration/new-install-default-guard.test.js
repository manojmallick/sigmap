'use strict';

/**
 * #1071 — guard rails for changing what a NEW install is proposed (T1 and T2). Nothing here changes a default. These tests pass on
 * today's code and are written so that the pull request that does flip the new-install default has to meet them, or say why not.
 *
 *   T1  config equivalence. Candidate A (`strategy: "index"` + `mcp.tools: "locate"`) is the setup the confirmatory runs measured
 *       (T5 with Haiku 5.5, T6 with Sonnet 5.5). Pinned: the study's `locate` arm writes exactly that config, the profile advertises
 *       exactly `query_context` and `get_lines`, and Candidate A differs from a project with no config in those two keys and no other.
 *       Also pinned: what `sigmap --init` proposes today, so a flip shows up as a changed pin. The last check (T1c) compares a flipped
 *       `--init` with the study's arm and says, on every run before a flip, that it was not evaluated.
 *   T2  upgrade invariance. Four kinds of existing project (no config, minimal, full custom, legacy `outputs`) resolve to the same effective
 *       config and tool profile as they did at v8.87.0 (`test/fixtures/upgrade-invariance`). An existing project must not change behaviour
 *       because SigMap was upgraded. Pinned with it: a key a project sets keeps its value, and `--init` never rewrites a config file.
 *
 * T3 (instruction footprint) is `instruction-footprint.test.js`; T4 (cold start) is `scripts/bench-cold-start.mjs`.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const FIX = path.join(ROOT, 'test', 'fixtures', 'upgrade-invariance');
const fixtures = require(path.join(FIX, 'fixtures.js'));
const { resolveProfile, LOCATE } = require(path.join(ROOT, 'src', 'mcp', 'profile.js'));
const { loadConfig } = require(path.join(ROOT, 'src', 'config', 'loader.js'));
const BASELINE = JSON.parse(fs.readFileSync(path.join(FIX, 'effective-config.v8.87.0.json'), 'utf8'));

/** Candidate A of #1071: what the confirmatory runs called `locate`. */
const CANDIDATE_A = { strategy: 'index', mcp: { tools: 'locate' } };
const TWO_TOOLS = ['get_lines', 'query_context'];

const tmp = [];
const mktmp = (p) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); tmp.push(d); return d; };
const quiet = (fn) => { const w = process.stderr.write; process.stderr.write = () => true; try { return fn(); } finally { process.stderr.write = w; } };
const effective = (dir) => quiet(() => loadConfig(dir));
/** Every leaf of a config as `a.b.c` -> value, so two configs can be compared key by key. */
function leaves(o, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, p, out); else out[p] = JSON.stringify(v);
  }
  return out;
}
const changedKeys = (a, b) => { const x = leaves(a); const y = leaves(b); return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => x[k] !== y[k]).sort(); };
/** `sigmap --init` in a directory, with no developer Codex config deciding anything. */
function runInit(dir) {
  const home = mktmp('sigmap-codex-');
  return spawnSync(process.execPath, [SCRIPT, '--init'], { cwd: dir, encoding: 'utf8', env: { ...process.env, CODEX_HOME: home } });
}
function project(config) {
  const dir = mktmp('sigmap-guard-');
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function alpha(x) { return x; }\nmodule.exports = { alpha };\n');
  if (config) fs.writeFileSync(path.join(dir, 'gen-context.config.json'), `${JSON.stringify(config, null, 2)}\n`);
  return dir;
}

(async () => {
  let passed = 0; let failed = 0; let skipped = 0;
  // A test that cannot be evaluated yet returns a string, which is counted and printed as a skip, never as a pass.
  const test = async (name, fn) => {
    try {
      const r = await fn();
      if (typeof r === 'string') { skipped++; console.log(`  SKIP  ${name}\n        ${r}`); } else { passed++; console.log(`  PASS  ${name}`); }
    } catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n').join('\n        ')}`); }
  };
  const arms = await import('../../scripts/lib/agent-ab-arms.mjs');

  // The premise of everything below: these tests read the config code in `src/`, while the CLI a user runs (`gen-context.js`) is a bundle
  // with its own embedded copy of it. They are the same code only while the committed bundle equals a fresh build from `src/`.
  await test('premise: the bundle `gen-context.js` runs equals what `src/` builds (`build-bundle.mjs --check`), so reading src/ is reading the CLI', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-bundle.mjs'), '--check'], { encoding: 'utf8', cwd: ROOT });
    assert.strictEqual(r.status, 0, `the bundle has drifted from src/: ${(r.stdout + r.stderr).slice(-400)}`);
  });

  // ── T1: config equivalence ────────────────────────────────────────────────────────────────────────────────

  await test('T1: the locate profile advertises exactly query_context and get_lines', () => {
    const r = resolveProfile({ mcp: { tools: 'locate' } });
    assert.strictEqual(r.profile, 'locate');
    assert.deepStrictEqual(r.names.slice().sort(), TWO_TOOLS);
    assert.deepStrictEqual(LOCATE.slice().sort(), TWO_TOOLS);
    assert.ok(r.tokens < r.allTokens / 3, `the two definitions are ${r.tokens} tokens, all 22 are ${r.allTokens}`);
  });

  let armConfig;
  await test('T1: the study\'s locate arm writes exactly Candidate A: strategy "index" and the locate profile, nothing else', () => {
    // A throwaway data root with one pinned repository, the way the harness's own tests build one; the arm is prepared by the real code.
    const root = mktmp('sigmap-arm-root-');
    const repo = path.join(root, 'benchmarks', 'repos', 'r1');
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'alpha.js'), 'function alphaThing(a) { return a; }\nmodule.exports = { alphaThing };\n');
    fs.writeFileSync(path.join(repo, 'README.md'), '# fixture\n');
    execFileSync('git', ['init', '-q', repo]);
    const git = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' }).trim();
    git('add', '-A'); git('commit', '-q', '-m', 'pin');
    const manifestRepo = { name: 'r1', url: 'https://github.com/o/r.git', commit: git('rev-parse', 'HEAD'), language: 'javascript', layout: 'flat' };
    const prepared = arms.prepareArm({ root, repo: manifestRepo, arm: 'with', tmpRoot: mktmp('sigmap-arm-tmp-'), codeRoot: ROOT, variant: 'locate' });
    armConfig = JSON.parse(fs.readFileSync(path.join(prepared.cwd, 'gen-context.config.json'), 'utf8'));
    assert.deepStrictEqual(armConfig, CANDIDATE_A);
  });

  await test('T1: Candidate A as a project config differs from an empty config file in strategy and mcp.tools only', () => {
    const a = effective(project(CANDIDATE_A));
    const none = effective(project(null));
    // Against an EMPTY config file, not against no file: any config file makes the loader copy `outputs` into `adapters` and list the keys the
    // file sets in `_userKeys`. Both are bookkeeping (same targets, same behaviour), so they are not counted as something the setup changes.
    const empty = effective(project({}));
    assert.deepStrictEqual(changedKeys(empty, a).filter((k) => k !== '_userKeys'), ['mcp.tools', 'strategy']);
    assert.deepStrictEqual([none.strategy, none.mcp.tools], ['full', 'all'], 'what a project with no config uses today');
    assert.deepStrictEqual([a.strategy, a.mcp.tools], ['index', 'locate']);
    assert.deepStrictEqual(resolveProfile(a).names.slice().sort(), TWO_TOOLS);
  });

  // What `sigmap --init` proposes today. A pull request that changes the new-install default changes this pin on purpose.
  const fresh = project(null);
  const init = runInit(fresh);
  const proposed = effective(fresh);
  const proposedProfile = resolveProfile(proposed);

  await test('T1: today `sigmap --init` proposes strategy "full" and the 7-tool core profile (the pin a flip has to change)', () => {
    assert.strictEqual(init.status, 0, init.stderr);
    assert.deepStrictEqual([proposed.strategy, proposed.mcp.tools, proposedProfile.profile, proposedProfile.names.length], ['full', 'core', 'core', 7]);
  });

  // `--init` has a second path: with no example file beside gen-context.js (a lone copy of the bundle, the standalone binary) it writes the
  // defaults plus the core profile. A flip has to change both, so both are pinned. (They already differ in `outputs`: four targets from the
  // example, the copilot file from the fallback. That is not pinned here, so this test does not lock the difference in.)
  const lone = project(null);
  const loneDir = mktmp('sigmap-lone-bundle-');
  fs.copyFileSync(SCRIPT, path.join(loneDir, 'gen-context.js'));
  const loneInit = spawnSync(process.execPath, [path.join(loneDir, 'gen-context.js'), '--init'], { cwd: lone, encoding: 'utf8', env: { ...process.env, CODEX_HOME: mktmp('sigmap-codex-') } });
  const loneProposed = effective(lone);

  await test('T1: the lone-bundle `--init` (no example file beside it) proposes the same strategy and profile as the example', () => {
    assert.strictEqual(loneInit.status, 0, loneInit.stderr);
    assert.deepStrictEqual([loneProposed.strategy, loneProposed.mcp.tools], [proposed.strategy, proposed.mcp.tools]);
    assert.deepStrictEqual([loneProposed.strategy, loneProposed.mcp.tools], ['full', 'core']);
  });

  await test('T1c: a flipped `--init` proposes the study\'s locate arm, on both paths (evaluated only once `--init` proposes locate)', () => {
    const profiles = [proposedProfile.profile, resolveProfile(loneProposed).profile];
    if (profiles.every((p) => p !== 'locate')) return `not evaluated: \`sigmap --init\` proposes the "${profiles[0]}" profile, so no new-install default has been flipped to locate.`;
    for (const [label, p] of [['example', proposed], ['lone bundle', loneProposed]]) {
      assert.deepStrictEqual({ strategy: p.strategy, mcp: { tools: p.mcp.tools } }, armConfig, `${label}: the new-install default must equal the arm the confirmatory runs measured`);
      assert.deepStrictEqual(resolveProfile(p).names.slice().sort(), TWO_TOOLS, label);
    }
  });

  // ── T2: upgrade invariance ────────────────────────────────────────────────────────────────────────────────

  await test('T2: the four kinds of existing project resolve to what they did at v8.87.0 (effective config and tool profile)', () => {
    const now = fixtures.effectiveConfigs(ROOT);
    assert.deepStrictEqual(Object.keys(now), Object.keys(BASELINE));
    for (const name of Object.keys(BASELINE)) {
      const diff = changedKeys(BASELINE[name].config, now[name].config);
      assert.deepStrictEqual(diff, [], `"${name}": effective config changed since v8.87.0 in ${diff.join(', ')}. An existing project must not change on upgrade; if this is intended it is a behaviour change, not a new-install default.`);
      assert.deepStrictEqual(now[name].profile, BASELINE[name].profile, `"${name}": the MCP tool profile changed`);
    }
  });

  await test('T2: the baseline states today\'s existing-install defaults in words: no config means strategy full, the copilot file, all 22 tools', () => {
    const n = BASELINE['no-config'];
    assert.deepStrictEqual([n.config.strategy, n.config.outputs, n.config.mcp.tools, n.profile.profile, n.profile.names.length], ['full', ['copilot'], 'all', 'all', 22]);
  });

  await test('T2: every key a project sets keeps its value (property over the fixtures)', () => {
    for (const [name, cfg] of Object.entries(fixtures.CONFIGS)) {
      if (!cfg) continue;
      const eff = fixtures.effectiveConfigs(ROOT)[name].config;
      for (const [k, v] of Object.entries(leaves(cfg))) assert.strictEqual(leaves(eff)[k], v, `"${name}": ${k} is ${leaves(eff)[k]} in the effective config, the project sets ${v}`);
    }
  });

  await test('T2: `sigmap --init` never rewrites a config file: bytes and effective config are the same after it', () => {
    for (const [name, cfg] of Object.entries(fixtures.CONFIGS)) {
      if (!cfg) continue;
      const dir = fixtures.build(name); tmp.push(dir);
      const file = path.join(dir, 'gen-context.config.json');
      const before = fs.readFileSync(file, 'utf8'); const effBefore = effective(dir);
      const r = runInit(dir);
      assert.strictEqual(r.status, 0, r.stderr);
      assert.match(r.stdout + r.stderr, /already exists — skipping/, `"${name}": init did not say it skipped the config`);
      assert.strictEqual(fs.readFileSync(file, 'utf8'), before, `"${name}": init rewrote the config file`);
      assert.deepStrictEqual(changedKeys(effBefore, effective(dir)), [], `"${name}": the effective config changed after init`);
    }
  });

  for (const d of tmp) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
  console.log(`\nnew-install-default-guard: ${passed} passed, ${failed} failed, ${skipped} skipped (T1c waits for a flip)`);
  process.exit(failed ? 1 : 0);
})();
