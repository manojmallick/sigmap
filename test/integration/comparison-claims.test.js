'use strict';

/**
 * Claims about other tools carry a date and a source, and SigMap's own counts are
 * derived, not typed (#973).
 *
 * `docs-vp/guide/compare-alternatives.md` said RepoMix "Works with MCP tools: No"
 * (its README documents `repomix --mcp`) and gave RepoMix "~90%" token reduction
 * from nowhere, and it listed no row for the tools people actually compare SigMap
 * with. Nothing failed, because nothing checked the page's claims about anyone
 * else. The rule here is structural, so it holds for the next rival added:
 *
 *   - a column of a comparison table that is neither SigMap nor a generic category
 *     is a claim about a named tool, and its header must say whether it is
 *     "characterized" (read from the tool's own README, not run) or "measured",
 *     link a commit-pinned GitHub permalink, and give the date it was read;
 *   - a generic category column (embeddings, IDE context, hand-written files) is
 *     exempt, and the table must say its figures are typical ranges, not
 *     measurements of a named product;
 *   - SigMap's tool counts come from `version.json` and the `core` profile in
 *     `src/mcp/profile.js`, its language count from `version.json`, its hit@5 and
 *     third-party figures from `benchmarks/latest.json`;
 *   - the README shows the third-party figure and its interval beside the honest
 *     corpus headline.
 *
 * Run: node test/integration/comparison-claims.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const PAGE = read('docs-vp/guide/compare-alternatives.md');
const version = JSON.parse(read('version.json'));
const latest = JSON.parse(read('benchmarks/latest.json'));
const { CORE } = require(path.join(ROOT, 'src/mcp/profile.js'));

// Generic categories, not products: exempt from the source rule, and obliged to
// say so. Anything else that appears as a column is treated as a named tool.
const CATEGORY_COLUMNS = new Set(['Embeddings / RAG', 'IDE context (Copilot, etc.)', 'Hand-written instructions']);
const CATEGORY_NOTE = 'typical figures for the category, not measurements of a named product';
const EARLIEST = '2026-10-17';

let passed = 0;
let failed = 0;
function test(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((e) => { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; });
}

/** Markdown tables: [{ header: string[], rows: string[][], line: number, after: string }]. */
function tables(md) {
  const lines = md.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('|') || !/^\|[\s:|-]+\|$/.test(lines[i + 1] || '')) continue;
    const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
    const header = cells(lines[i]);
    const rows = [];
    let j = i + 2;
    for (; j < lines.length && lines[j].startsWith('|'); j++) rows.push(cells(lines[j]));
    let k = j;
    while (k < lines.length && lines[k].trim() === '') k++;
    out.push({ header, rows, line: i + 1, after: lines[k] || '' });
    i = j;
  }
  return out;
}

/** A comparison table has an empty first header cell and SigMap as the second. */
const comparisons = (md) => tables(md).filter((t) => t.header[0] === '' && t.header[1] === 'SigMap');

/** The claims about other tools that lack a source, a label or a date. */
function rivalProblems(md, today = new Date().toISOString().slice(0, 10)) {
  const out = [];
  for (const t of comparisons(md)) {
    t.header.slice(2).forEach((h) => {
      const full = h.trim();
      if (CATEGORY_COLUMNS.has(full)) {
        if (!t.after.includes(CATEGORY_NOTE)) out.push(`${full}: a category table must say its figures are ${CATEGORY_NOTE}`);
        return;
      }
      const name = full.replace(/\s*\(.*$/, '').trim();
      const link = /\[[^\]]+\]\((https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/blob\/[0-9a-f]{40}\/[^)\s]+)\)/.exec(h);
      const date = /\b(\d{4}-\d{2}-\d{2})\b/.exec(h);
      if (!/\b(characterized|measured)\b/.test(h)) out.push(`${name}: the header must say "characterized" or "measured"`);
      if (!link) out.push(`${name}: the header must link a commit-pinned GitHub permalink (…/blob/<40-hex sha>/…)`);
      if (!date) out.push(`${name}: the header must give the date it was read`);
      else if (date[1] > today) out.push(`${name}: ${date[1]} is in the future`);
      else if (date[1] < EARLIEST) out.push(`${name}: ${date[1]} predates the audit`);
    });
  }
  return out;
}

/** Cells of the SigMap column across every comparison table. */
const sigmapCells = (md) => comparisons(md).flatMap((t) => t.rows.map((r) => r[1] || ''));

/** The rival columns' text, which carries their own counts and is exempt from the derived-count rule. */
function withoutRivalColumns(md) {
  const rival = new Set();
  for (const t of comparisons(md)) for (const r of t.rows) for (const c of r.slice(2)) rival.add(c);
  return md.split('\n').filter((l) => !(l.startsWith('|') && l.split('|').slice(3, -1).some((c) => rival.has(c.trim())))).join('\n');
}

(async () => {
  const { wilson } = await import('../../scripts/lib/band.mjs');
  const { computeLatest } = await import('../../scripts/gen-benchmark-latest.mjs');

  // ── the rule, on the page and on its former self ──────────────────────────

  await test('every column about another tool is labelled, linked to a commit permalink and dated', () => {
    const problems = rivalProblems(PAGE);
    assert.deepStrictEqual(problems, [], `\n  ${problems.join('\n  ')}`);
    const named = new Set(comparisons(PAGE).flatMap((t) => t.header.slice(2)).map((h) => h.replace(/\s*\(.*$/, '').trim()));
    for (const tool of ['RepoMix', 'codebase-memory-mcp', 'code-review-graph', 'Headroom']) assert.ok(named.has(tool), `no column for ${tool}`);
  });

  await test('the rule fails the page as it was: RepoMix with no source, no date, and MCP "No" (#973)', () => {
    const old = [
      '| | SigMap | RepoMix |', '|---|---|---|',
      '| Token reduction | **95.7%** average | ~90% |', '| Works with MCP tools | **Yes** — 22 MCP tools | No |',
    ].join('\n');
    const problems = rivalProblems(old);
    assert.ok(problems.some((p) => /characterized|measured/.test(p)), problems.join('; '));
    assert.ok(problems.some((p) => /permalink/.test(p)), problems.join('; '));
    assert.ok(problems.some((p) => /date/.test(p)), problems.join('; '));
  });

  await test('the rule rejects a branch link, a missing date, a future date and a category table without its note', () => {
    const hdr = (h) => `| | SigMap | ${h} |\n|---|---|---|\n| a | b | c |\n`;
    const sha = 'a'.repeat(40);
    const good = `characterized: [README, 2026-10-18](https://github.com/o/r/blob/${sha}/README.md)`;
    assert.deepStrictEqual(rivalProblems(hdr(`Tool (${good})`), '2026-10-18'), []);
    assert.ok(rivalProblems(hdr('Tool (characterized: [README, 2026-10-18](https://github.com/o/r/blob/main/README.md))'), '2026-10-18').some((p) => /permalink/.test(p)), 'a branch link moves under the claim');
    assert.ok(rivalProblems(hdr(`Tool (characterized: [README](https://github.com/o/r/blob/${sha}/README.md))`), '2026-10-18').some((p) => /date/.test(p)));
    assert.ok(rivalProblems(hdr(`Tool (${good})`), '2026-10-17').some((p) => /future/.test(p)));
    assert.ok(rivalProblems(hdr(`Tool (README, 2026-10-18, https://github.com/o/r/blob/${sha}/README.md)`), '2026-10-18').length > 0, 'a bare URL is not a link, and there is no label');
    assert.ok(rivalProblems(hdr('Embeddings / RAG')).some((p) => /category table/.test(p)), 'a category column needs its note');
    assert.deepStrictEqual(rivalProblems(`${hdr('Embeddings / RAG')}\n*Right-hand column: ${CATEGORY_NOTE}.*\n`), []);
  });

  await test('every category table on the page says its figures are typical, not measured', () => {
    const cats = comparisons(PAGE).filter((t) => t.header.slice(2).some((h) => CATEGORY_COLUMNS.has(h.trim())));
    assert.ok(cats.length >= 3, `expected the embeddings, IDE and hand-written tables, found ${cats.length}`);
  });

  // ── SigMap's own figures are derived ──────────────────────────────────────

  await test('SigMap\'s MCP tool counts are version.json\'s total and the core profile\'s length, in the same words everywhere', () => {
    const want = `${version.mcp_tools} by default; ${CORE.length} with \`mcp.tools: core\``;
    const cells = sigmapCells(PAGE).filter((c) => /MCP tools|by default/.test(c));
    assert.ok(cells.length >= 5, `expected the count in several tables, found ${cells.length}`);
    for (const c of cells) assert.ok(c.includes(want), `"${c}" does not say "${want}"`);
    const prose = withoutRivalColumns(PAGE);
    for (const m of prose.matchAll(/\b(\d+) MCP tools\b/g)) {
      assert.strictEqual(Number(m[1]), version.mcp_tools, `"${m[0]}" is not version.json's ${version.mcp_tools}`);
    }
  });

  await test('the default profile is still all tools, so the wording "22 by default; 7 with core" is true (#973 premise check)', () => {
    const { resolveProfile } = require(path.join(ROOT, 'src/mcp/profile.js'));
    const byDefault = resolveProfile({});
    assert.strictEqual(byDefault.profile, 'all', 'an absent mcp.tools key must mean every tool');
    assert.strictEqual(byDefault.tools.length, version.mcp_tools, 'the default advertises every tool version.json counts');
    const core = resolveProfile({ mcp: { tools: 'core' } });
    assert.strictEqual(core.profile, 'core');
    assert.strictEqual(core.tools.length, CORE.length, 'the core profile is the length the page states');
  });

  await test('SigMap\'s language count, hit@5, token reduction and third-party figure on the page are the saved ones', () => {
    const cells = sigmapCells(PAGE).join('\n');
    assert.ok(cells.includes(`**${version.languages}**`), `languages: ${version.languages}`);
    assert.ok(cells.includes(`**${(version.metrics.hit_at_5 * 100).toFixed(1)}%**`), 'hit@5');
    assert.ok(cells.includes(`**${version.metrics.overall_token_reduction_pct.toFixed(1)}%**`), 'token reduction');
    assert.ok(latest.third_party, 'latest.json has no third_party block');
    assert.ok(cells.includes(`**${latest.third_party.hit_at_5_pct.toFixed(1)}%**`), 'third-party hit@5');
  });

  // ── the README headline ───────────────────────────────────────────────────

  await test('latest.json\'s third_party block is the xrepo baseline, with the interval the gate prints', () => {
    const b = JSON.parse(read('benchmarks/xrepo-baseline.json'));
    const w = wilson(b.overall.hits, b.overall.tasks);
    assert.deepStrictEqual(latest.third_party, {
      repos: Object.keys(b.repos).length,
      tasks: b.overall.tasks,
      hits: b.overall.hits,
      hit_at_5_pct: Number((b.overall.hits / b.overall.tasks * 100).toFixed(1)),
      interval_low_pct: Number((w.low * 100).toFixed(1)),
      interval_high_pct: Number((w.high * 100).toFixed(1)),
    });
    assert.deepStrictEqual(computeLatest(ROOT).third_party, latest.third_party, 'latest.json is stale against the baseline');
  });

  await test('without a recorded baseline there is no third_party block, and a hand-edit of the baseline moves it', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-latest-'));
    try {
      fs.mkdirSync(path.join(tmp, 'benchmarks'), { recursive: true });
      fs.cpSync(path.join(ROOT, 'benchmarks', 'reports'), path.join(tmp, 'benchmarks', 'reports'), { recursive: true });
      fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(tmp, 'package.json'));
      assert.strictEqual(computeLatest(tmp).third_party, undefined, 'no baseline, no block');
      const b = JSON.parse(read('benchmarks/xrepo-baseline.json'));
      b.overall.hits -= 1;
      fs.writeFileSync(path.join(tmp, 'benchmarks', 'xrepo-baseline.json'), JSON.stringify(b));
      const moved = computeLatest(tmp).third_party;
      assert.strictEqual(moved.hits, latest.third_party.hits - 1);
      assert.notStrictEqual(moved.hit_at_5_pct, latest.third_party.hit_at_5_pct);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  await test('the README shows the third-party figure and its interval right beside the honest-corpus headline', () => {
    const tp = latest.third_party;
    const readme = read('README.md').split('\n');
    const honest = readme.findIndex((l) => l.startsWith('- **') && l.includes('single-shot grep baseline'));
    assert.ok(honest !== -1, 'the honest-corpus bullet is missing');
    const next = readme[honest + 1] || '';
    const interval = `${tp.interval_low_pct.toFixed(1)}–${tp.interval_high_pct.toFixed(1)}%`;
    assert.ok(next.startsWith(`- **${tp.hit_at_5_pct.toFixed(1)}% hit@5 on repositories we do not control**`), `the bullet after the headline is: ${next.slice(0, 90)}`);
    assert.ok(next.includes(`${tp.hits} of ${tp.tasks} questions over ${tp.repos} repos`) && next.includes(`95% interval ${interval}`), next);
    const blockHonest = readme.findIndex((l) => l.startsWith('Honest vs grep :'));
    assert.ok((readme[blockHonest + 1] || '').startsWith(`Third-party    : ${tp.hit_at_5_pct.toFixed(1)}% hit@5 (${tp.hits} of ${tp.tasks} questions / ${tp.repos} repos, 95% interval ${interval})`), 'the benchmark block lacks the third-party line');
  });

  console.log(`\n  comparison-claims: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
