'use strict';

/**
 * Published-count drift guard (#697, #698).
 *
 * `sync-metrics.mjs` only ever wrote version.json and README.md, so the
 * docs-vp site that actually deploys drifted freely: `languages.md` stated
 * **31** in both of its SEO `content:` meta lines and **36** in its body, on
 * one page, and `repomix.md` said 29. Markers cannot fix the frontmatter half —
 * an HTML comment inside a YAML `content: "…"` string lands verbatim in the
 * rendered `<meta>` tag — so every occurrence is classified explicitly instead
 * and an unclassified one fails.
 *
 * Also guards the two #697 claims that were factually wrong rather than merely
 * stale: the README promised a line anchor for *every* symbol when five Tier-3
 * languages emit none, and the KNOWN_LIMITATIONS tier table named neither R,
 * Lua, Elixir nor Astro.
 *
 * Run: node test/integration/doc-counts.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); pass++; })
    .catch((e) => { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; });
}

(async () => {
  const { audit } = await import('../../scripts/check-doc-counts.mjs');
  const vj = JSON.parse(read('version.json'));

  // ── #698: no count anywhere disagrees with version.json ───────────────────

  await test('every published count traces to version.json', () => {
    const { problems } = audit(ROOT);
    const drift = problems.filter((p) => p.kind === 'DRIFT');
    assert.strictEqual(drift.length, 0,
      'drifted counts: ' + drift.map((p) => `${p.rel}:${p.line} says ${p.found} ${p.metric}, want ${p.expected}`).join('; '));
  });

  await test('no count is left unclassified', () => {
    const { problems } = audit(ROOT);
    const un = problems.filter((p) => p.kind === 'UNCLASSIFIED');
    assert.strictEqual(un.length, 0,
      'unclassified: ' + un.map((p) => `${p.rel}:${p.line} (${p.found} ${p.metric})`).join('; '));
  });

  await test('languages.md states one number, in body AND SEO meta', () => {
    const src = read('docs-vp/guide/languages.md');
    const found = [...src.matchAll(/\b(\d+)\s+languages\b/g)].map((m) => Number(m[1]));
    assert.ok(found.length >= 4, `expected several language counts, found ${found.length}`);
    const distinct = [...new Set(found)];
    assert.deepStrictEqual(distinct, [vj.languages],
      `page states ${distinct.join(' and ')} languages; version.json says ${vj.languages}`);
  });

  await test('the SEO content: meta lines carry the canonical count', () => {
    const metas = read('docs-vp/guide/languages.md')
      .split('\n').filter((l) => l.includes('content:') && /\d+\s+languages/.test(l));
    assert.ok(metas.length >= 2, `expected 2 meta lines with a language count, got ${metas.length}`);
    for (const l of metas) {
      assert.ok(l.includes(`${vj.languages} languages`), `stale SEO meta: ${l.trim()}`);
    }
  });

  await test('markers are never emitted into YAML frontmatter meta', () => {
    // A marker inside `content: "…"` would render as literal HTML in the tag.
    for (const rel of ['docs-vp/guide/languages.md', 'docs-vp/guide/mcp.md', 'docs-vp/index.md']) {
      for (const line of read(rel).split('\n')) {
        if (!line.includes('content:')) continue;
        assert.ok(!/<!--SM:/.test(line), `${rel}: SM marker inside frontmatter meta — ${line.trim().slice(0, 70)}`);
      }
    }
  });

  await test('check:metrics runs the guard', () => {
    const scripts = JSON.parse(read('package.json')).scripts;
    assert.ok(scripts['check:metrics'].includes('check-doc-counts'),
      'check:metrics does not run check-doc-counts.mjs — drift could return unnoticed');
  });

  // ── #697: claims that were wrong, not merely stale ────────────────────────

  await test('README does not promise a line anchor for every symbol', () => {
    const src = read('README.md');
    assert.ok(!/every file and symbol traces to a real line anchor/.test(src),
      'README still claims universal anchors; Ruby, R, Lua, Elixir and C/C++ emit none');
    assert.ok(!/every symbol on a real line anchor/.test(src),
      'README comparison table still claims universal anchors');
  });

  await test('the anchor claim is scoped to the tiers that actually anchor', () => {
    const src = read('README.md');
    assert.ok(/anchored-regex tiers/.test(src), 'no tier-scoped anchor wording found');
    assert.ok(/KNOWN_LIMITATIONS/.test(src), 'scoped claim should point at the limitations page');
  });

  await test('the anchor claim matches measured extractor behaviour', () => {
    // The scoping is only honest if these really do differ.
    const anchored = ['javascript', 'go'];
    const unanchored = ['ruby', 'r', 'lua', 'elixir'];
    const sample = {
      javascript: 'function f(a) { }',
      go: 'func F(a int) int { return 1 }',
      ruby: 'def f(a)\nend',
      r: 'f <- function(a) 1',
      lua: 'function f(a)\nend',
      elixir: 'defmodule M do\nend',
    };
    const has = (lang) => require(path.join(ROOT, 'src/extractors', lang))
      .extract(sample[lang]).some((s) => /:\d+-\d+/.test(s));
    for (const l of anchored) assert.ok(has(l), `${l} should emit anchors`);
    for (const l of unanchored) assert.ok(!has(l), `${l} now emits anchors — re-scope the README claim`);
  });

  await test('the tier table accounts for R, Lua, Elixir and Astro', () => {
    const doc = read('KNOWN_LIMITATIONS.md');
    for (const lang of ['R', 'Lua', 'Elixir', 'Astro']) {
      assert.ok(new RegExp(`\\b${lang}\\b`).test(doc), `${lang} appears in no tier row`);
    }
  });

  await test('R is stated as Tier 3, and Astro as anchored', () => {
    const doc = read('KNOWN_LIMITATIONS.md');
    assert.ok(/R, Lua and Elixir are Tier 3/.test(doc), 'R/Lua/Elixir tier not stated plainly');
    assert.ok(/Astro is Tier 2/.test(doc), 'Astro tier not stated — it does carry anchors via the TS path');
  });

  console.log(`\n  doc-counts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
