'use strict';

/**
 * #1071, T3 — instruction footprint. What SigMap writes for a repository must fit what the host reads: a generated AGENTS.md of at most
 * 32 KiB (Codex's default `project_doc_max_bytes`) and a generated CLAUDE.md of at most 200 lines (what Claude Code asks for), under today's
 * config AND under Candidate A (`strategy: "index"` + `mcp.tools: "locate"`).
 *
 * The measurement is `scripts/check-instruction-footprint.mjs`, which works on a `git archive` copy so no clone is ever written to.
 *   - SigMap's own repository is always measured, so this runs in CI.
 *   - gin, flask and django are measured when their clones are present (`benchmarks/repos/<name>`, or the folder in SIGMAP_REPOS). A missing
 *     clone is a SKIP in this output, never a pass; the pull request that flips a default has to run `--require-repos` and show the table.
 *
 * Also pinned: Candidate A's files are far smaller than today's, so the reason to prefer it (less standing text) cannot erode unnoticed.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');
const REPOS_DIR = process.env.SIGMAP_REPOS || path.join(ROOT, 'benchmarks', 'repos');

(async () => {
  let passed = 0; let failed = 0; let skipped = 0;
  const test = async (name, fn) => {
    try {
      const r = await fn();
      if (typeof r === 'string') { skipped++; console.log(`  SKIP  ${name}\n        ${r}`); } else { passed++; console.log(`  PASS  ${name}`); }
    } catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n').join('\n        ')}`); }
  };
  const fp = await import('../../scripts/check-instruction-footprint.mjs');

  await test('the limits are the registered ones: 32 KiB for Codex, 200 lines for Claude Code', () => {
    assert.deepStrictEqual({ ...fp.LIMITS }, { codexBytes: 32768, claudeLines: 200 });
    assert.deepStrictEqual({ ...fp.CANDIDATE_A }, { strategy: 'index', mcp: { tools: 'locate' } });
  });

  await test('the verdict is exact at the limits: 32768 bytes and 200 lines pass, one more of either does not', () => {
    assert.deepStrictEqual(fp.verdict({ codexBytes: 32768, claudeLines: 200 }), []);
    assert.strictEqual(fp.verdict({ codexBytes: 32769, claudeLines: 200 }).length, 1);
    assert.strictEqual(fp.verdict({ codexBytes: 32768, claudeLines: 201 }).length, 1);
    assert.strictEqual(fp.verdict({ codexBytes: 40000, claudeLines: 300 }).length, 2);
  });

  const own = {};
  for (const cfg of Object.keys(fp.CONFIGS)) {
    await test(`SigMap's own repository, ${cfg === 'today' ? "today's config" : 'Candidate A'}: AGENTS.md within 32 KiB, CLAUDE.md within 200 lines`, () => {
      own[cfg] = fp.measure({ repoDir: ROOT, config: fp.CONFIGS[cfg] });
      assert.deepStrictEqual(fp.verdict(own[cfg]), [], JSON.stringify(own[cfg]));
      assert.ok(own[cfg].codexBytes > 0 && own[cfg].claudeLines > 0, 'something was written');
    });
  }

  await test('Candidate A writes at most a quarter of the AGENTS.md bytes and fewer CLAUDE.md lines than today\'s config', () => {
    assert.ok(own.today && own['candidate-a'], 'both measurements ran');
    assert.ok(own['candidate-a'].codexBytes * 4 <= own.today.codexBytes, `${own['candidate-a'].codexBytes} B vs ${own.today.codexBytes} B`);
    assert.ok(own['candidate-a'].claudeLines < own.today.claudeLines, `${own['candidate-a'].claudeLines} vs ${own.today.claudeLines} lines`);
  });

  for (const name of ['gin', 'flask', 'django']) {
    await test(`${name}: both configs within the limits (needs the clone under ${path.relative(ROOT, REPOS_DIR) || REPOS_DIR})`, () => {
      const dir = path.join(REPOS_DIR, name);
      if (!fs.existsSync(path.join(dir, '.git'))) return `SKIPPED, not counted as a pass: no clone at ${dir}. Run \`node scripts/check-instruction-footprint.mjs --repos <dir> --require-repos\`.`;
      for (const cfg of Object.keys(fp.CONFIGS)) {
        const m = fp.measure({ repoDir: dir, config: fp.CONFIGS[cfg] });
        assert.deepStrictEqual(fp.verdict(m), [], `${name} / ${cfg}: ${JSON.stringify(m)}`);
      }
    });
  }

  console.log(`\ninstruction-footprint: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed ? 1 : 0);
})();
