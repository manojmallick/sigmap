'use strict';

/**
 * Regression test for benchmark cross-suite pollution (#480).
 *
 * The grounding benchmark regenerates repo contexts with a plain default
 * config; left behind, those skew any later context-reading suite. The
 * hermetic wrapper must leave every context artifact byte-identical —
 * including deleting files that did not exist before.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-iso-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'app.js'), [
    'function greet(name) {',
    '  return `hi ${name}`;',
    '}',
    'module.exports = { greet };',
    '',
  ].join('\n'));
  return dir;
}

(async () => {
  const mod = await import('../../scripts/run-hallucination-benchmark.mjs');

  await test('measureGroundingHermetic restores a pre-existing context byte-exactly', () => {
    const dir = makeRepo();
    try {
      // Seed a sentinel context + config the way the retrieval harness would.
      const ctxPath = path.join(dir, '.github', 'copilot-instructions.md');
      fs.mkdirSync(path.dirname(ctxPath), { recursive: true });
      const sentinelCtx = '# SENTINEL CONTEXT — must survive the grounding benchmark\n';
      fs.writeFileSync(ctxPath, sentinelCtx);
      const cfgPath = path.join(dir, 'gen-context.config.json');
      const sentinelCfg = JSON.stringify({ srcDirs: ['src'], maxTokens: 123 }, null, 2);
      fs.writeFileSync(cfgPath, sentinelCfg);

      const m = mod.measureGroundingHermetic(dir);
      assert.ok(m.total > 0, `expected symbols, got ${m.total}`);
      assert.strictEqual(fs.readFileSync(ctxPath, 'utf8'), sentinelCtx, 'context artifact not restored');
      assert.strictEqual(fs.readFileSync(cfgPath, 'utf8'), sentinelCfg, 'config not restored');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('measureGroundingHermetic removes artifacts that did not exist before', () => {
    const dir = makeRepo();
    try {
      const ctxPath = path.join(dir, '.github', 'copilot-instructions.md');
      assert.ok(!fs.existsSync(ctxPath), 'fixture should start without a context');
      const m = mod.measureGroundingHermetic(dir);
      assert.ok(m.total > 0);
      assert.ok(!fs.existsSync(ctxPath), 'regen leftovers not cleaned up');
      assert.ok(!fs.existsSync(path.join(dir, 'gen-context.config.json')), 'config leftover');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('every generated artifact class is covered by the snapshot list', () => {
    for (const rel of ['.github/copilot-instructions.md', 'CLAUDE.md', 'AGENTS.md', 'gen-context.config.json']) {
      assert.ok(mod.CONTEXT_ARTIFACTS.includes(rel), `missing ${rel}`);
    }
  });

  console.log(`\nbenchmark-isolation: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
