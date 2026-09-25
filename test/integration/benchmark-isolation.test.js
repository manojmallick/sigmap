'use strict';

/**
 * Regression test for benchmark cross-suite pollution (#480, #522, #706).
 *
 * `benchmarks/repos/*` is SHARED state. `run-honest-benchmark` never
 * regenerates — it reads each repo's context AS-IS. So any suite that
 * regenerates a repo and leaves the result behind silently decides what every
 * later suite measures.
 *
 * Two earlier fixes each covered only part of the artifact set:
 *   #522 restored `gen-context.config.json` but not the generated context.
 *   #480 restored the markdown adapters but omitted `.context/` — the
 *        directory holding `sig-index.json`, which is what the ranker reads.
 *
 * These tests pin the whole artifact set, and pin that every regenerating
 * suite goes through the shared primitive rather than hand-rolling a restore.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..', '..');

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

/** Recursive Map<relPath, sha-ish string> for byte-comparison of a directory. */
function treeOf(dir) {
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const abs = path.join(d, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(abs, r);
      else if (e.isFile()) out.set(r, fs.readFileSync(abs).toString('base64'));
    }
  };
  walk(dir, '');
  return out;
}

(async () => {
  const mod = await import('../../scripts/run-hallucination-benchmark.mjs');
  const shared = await import('../../scripts/lib/shared-repo-context.mjs');

  await test('measureGroundingHermetic restores a pre-existing context byte-exactly', () => {
    const dir = makeRepo();
    try {
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

  // ── #706: `.context/` is the artifact the ranker actually reads ────────────

  await test('.context/ is in the snapshot set (ranker reads .context/sig-index.json)', () => {
    assert.ok(shared.CONTEXT_DIRS.includes('.context'),
      '.context missing from CONTEXT_DIRS — sig-index.json would survive a "hermetic" call');
  });

  await test('a hermetic regen restores .context/sig-index.json byte-exactly', () => {
    const dir = makeRepo();
    try {
      // Seed a canonical index the way the retrieval harness leaves one.
      const ctxDir = path.join(dir, '.context');
      fs.mkdirSync(ctxDir, { recursive: true });
      const sentinel = JSON.stringify({ schema: 1, files: { 'SENTINEL.js': ['function sentinel()'] } });
      fs.writeFileSync(path.join(ctxDir, 'sig-index.json'), sentinel);

      const before = treeOf(ctxDir);
      const m = mod.measureGroundingHermetic(dir);
      assert.ok(m.total > 0, 'expected the regen to see symbols');
      const after = treeOf(ctxDir);

      assert.deepStrictEqual([...after.keys()].sort(), [...before.keys()].sort(),
        '.context/ file set changed across a hermetic call');
      assert.strictEqual(fs.readFileSync(path.join(ctxDir, 'sig-index.json'), 'utf8'), sentinel,
        '.context/sig-index.json was rewritten — later suites would score the wrong index');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('a hermetic regen removes a .context/ that did not exist before', () => {
    const dir = makeRepo();
    try {
      assert.ok(!fs.existsSync(path.join(dir, '.context')), 'fixture should start without .context');
      mod.measureGroundingHermetic(dir);
      assert.ok(!fs.existsSync(path.join(dir, '.context')),
        '.context/ leftover — a later suite would read this run\'s index');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('withSharedRepoContext restores on throw', () => {
    const dir = makeRepo();
    try {
      const cfgPath = path.join(dir, 'gen-context.config.json');
      fs.writeFileSync(cfgPath, '{"srcDirs":["src"]}');
      const before = fs.readFileSync(cfgPath, 'utf8');
      assert.throws(() => shared.withSharedRepoContext(dir, {
        override: { srcDirs: ['other'], maxTokens: 99 },
        generate: () => {},
        measure: () => { throw new Error('boom'); },
      }), /boom/);
      assert.strictEqual(fs.readFileSync(cfgPath, 'utf8'), before,
        'config not restored when the measure step threw');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ── #706: no suite may hand-roll its own restore ───────────────────────────

  await test('every repo-regenerating suite routes through the shared primitive', () => {
    // These three suites regenerate repos under benchmarks/repos and are
    // READERS of shared state. Each must import the shared primitive; a
    // hand-rolled restore is how #522 and #480 each ended up partial.
    const consumers = [
      'run-quality-benchmark.mjs',
      'run-benchmark.mjs',
      'run-hallucination-benchmark.mjs',
    ];
    for (const name of consumers) {
      const src = fs.readFileSync(path.join(ROOT, 'scripts', name), 'utf8');
      assert.ok(/from '\.\/lib\/shared-repo-context\.mjs'/.test(src),
        `${name} does not use scripts/lib/shared-repo-context.mjs`);
    }
  });

  await test('the determinism gate is wired into a CI workflow', () => {
    const GATE = 'check-benchmark-determinism';
    // Accept either a direct invocation or an npm script that wraps it —
    // resolved through package.json rather than guessing at spellings.
    const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts || {};
    const wrappers = Object.keys(scripts).filter((k) => scripts[k].includes(GATE));
    assert.ok(wrappers.length, `no npm script runs ${GATE}`);

    const wfDir = path.join(ROOT, '.github', 'workflows');
    const hit = fs.readdirSync(wfDir)
      .filter((f) => /\.ya?ml$/.test(f))
      .map((f) => fs.readFileSync(path.join(wfDir, f), 'utf8'))
      .some((src) => src.includes(GATE) || wrappers.some((w) => src.includes(`npm run ${w}`)));
    assert.ok(hit, `no workflow runs ${GATE} — #522 regressed unnoticed for exactly this reason`);
  });

  console.log(`\nbenchmark-isolation: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
