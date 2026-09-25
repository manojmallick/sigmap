'use strict';

/**
 * #522 benchmark-determinism guards — source-level, CI-safe (no cloned repos).
 * The full two-run/cross-suite gate is `npm run validate:benchmark-determinism`
 * (needs cached benchmark repos); these guards keep the fix from regressing
 * structurally: one shared override table, mirrored apply/restore semantics,
 * the labeled self-repo set, and the gate itself staying wired.
 * Run: node test/integration/benchmark-determinism.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

test('benchmarks/config-overrides.json exists, parses, and covers the skew repos', () => {
  const overrides = JSON.parse(read('benchmarks/config-overrides.json'));
  // The four repos whose absence from the quality suite's table caused the
  // measured 11.2pt cross-suite decay (plus two sanity anchors).
  for (const repo of ['express', 'flask', 'spring-petclinic', 'serilog', 'rails', 'gin']) {
    assert.ok(overrides[repo] && Array.isArray(overrides[repo].srcDirs), `missing override: ${repo}`);
  }
});

test('every repo-regenerating suite loads the shared table — no local copies', () => {
  // #706 added run-benchmark.mjs: it used to generate with whatever config was
  // on disk, so it rewrote the canonical contexts with a DEFAULT config.
  const scripts = [
    'scripts/run-retrieval-benchmark.mjs',
    'scripts/run-quality-benchmark.mjs',
    'scripts/run-benchmark.mjs',
  ];
  for (const script of scripts) {
    const src = read(script);
    // Either read the shared JSON directly or go through the shared loader.
    assert.ok(src.includes('config-overrides.json') || src.includes('loadOverrides'),
      `${script} must load the shared override table`);
    assert.ok(!/CONFIG_OVERRIDES = \{\s*\n\s+['"a-z]/.test(src), `${script} still defines a local override table`);
  }
});

test('consumer suites apply/restore via the shared hermetic primitive', () => {
  // #522 restored only the config; #480 restored only the markdown adapters.
  // Both were hand-rolled and both were partial. The primitive owns the whole
  // artifact set (adapters + config + .context/) and restores in a finally —
  // see test/integration/benchmark-isolation.test.js for the behavioural proof.
  const lib = read('scripts/lib/shared-repo-context.mjs');
  assert.ok(/finally\s*\{/.test(lib), 'shared primitive must restore in finally');
  assert.ok(/CONTEXT_DIRS\s*=\s*\[\s*'\.context'/.test(lib),
    'shared primitive must snapshot .context/ — the index the ranker reads');

  for (const script of ['scripts/run-quality-benchmark.mjs', 'scripts/run-benchmark.mjs']) {
    const src = read(script);
    assert.ok(src.includes('withSharedRepoContext'), `${script} must regenerate through the shared primitive`);
    assert.ok(!/!hadConfig && configOverride/.test(src),
      `${script} must ALWAYS apply the override, not only when no config exists`);
  }
});

test('honest benchmark labels the self-repo task set', () => {
  const h = read('scripts/run-honest-benchmark.mjs');
  assert.ok(h.includes('selfRepo'), 'selfRepo label missing from honest script');
  assert.ok(h.includes('self-repo task set'), 'human-output note for the self-repo set missing');
});

test('determinism gate exists and is wired as an npm script', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'check-benchmark-determinism.mjs')), 'gate script missing');
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.scripts['validate:benchmark-determinism'], 'validate:benchmark-determinism npm script missing');
  assert.ok(pkg.scripts['validate:benchmark-determinism'].includes('--cross-suite'), 'gate must run in cross-suite mode');
});

console.log(`\n  benchmark-determinism: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
