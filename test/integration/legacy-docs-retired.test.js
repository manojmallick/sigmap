'use strict';

/**
 * The legacy Jekyll site under docs/ is retired, and stays retired (#930, #699).
 *
 * Until then `docs/` held 11 hand-written pages, a sitemap, a robots.txt and a
 * Search Console verification file that no workflow deployed (pages.yml builds
 * docs-vp/). They still stated "29 languages" / "21 extractors", were the top
 * `grep` hit for a number, five test files pinned them (one required the stale
 * "29 languages"), and every release hand-edited docs/index.html's softwareVersion.
 *
 * What this pins:
 *   A. docs/ carries no site — no HTML, sitemap, robots, verification, Jekyll config.
 *   B. Every URL the legacy sitemap advertised still redirects (a stub under
 *      docs-vp/public, which VitePress copies to the site root), to a page that exists.
 *   C. Exactly one robots.txt, one verification file, and no committed sitemap — the
 *      one sitemap is the one the VitePress build generates.
 *   D. Every asset the VitePress config names is actually served. The favicon and the
 *      nav logo sat in docs-vp/.vitepress/public, which VitePress never serves, so
 *      sigmap.io/favicon.png and /logo.svg were 404s.
 *   E. docs/ still holds what the README links to.
 *   F. A stale count appears only in dated history.
 *
 * Run: node test/integration/legacy-docs-retired.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

let pass = 0, fail = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); pass++; })
    .catch((e) => { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; });
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'cache', '.git']);
function walk(rel, out = []) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.posix.join(rel, e.name), out);
    } else {
      out.push(path.posix.join(rel, e.name));
    }
  }
  return out;
}

// The URLs the deleted docs/sitemap.xml advertised (plus /start.html, the onboarding
// page the same site served), and the guide page each now redirects to.
const LEGACY_URLS = {
  'quick-start': 'quick-start',
  cli: 'cli',
  config: 'config',
  mcp: 'mcp',
  troubleshooting: 'troubleshooting',
  strategies: 'strategies',
  languages: 'languages',
  repomix: 'repomix',
  roadmap: 'roadmap',
  start: 'quick-start',
};

(async () => {
  // ── A. docs/ carries no site ────────────────────────────────────────────────

  await test('docs/ holds no HTML page', () => {
    const html = walk('docs').filter((f) => /\.html?$/i.test(f));
    assert.deepStrictEqual(html, [], `legacy pages are back: ${html.join(', ')}`);
  });

  await test('docs/ holds no sitemap, robots, verification file or Jekyll config', () => {
    const legacy = walk('docs').filter((f) => {
      const b = path.posix.basename(f);
      return /^sitemap.*\.xml$/i.test(b) || b === 'robots.txt' || /^google[0-9a-f]+\.html$/.test(b)
        || b === '_config.yml' || b === '.nojekyll';
    });
    assert.deepStrictEqual(legacy, [], `site plumbing is back under docs/: ${legacy.join(', ')}`);
  });

  // ── B. every legacy URL still redirects ─────────────────────────────────────

  for (const [name, target] of Object.entries(LEGACY_URLS)) {
    await test(`/${name}.html redirects to /guide/${target}`, () => {
      const stubPath = `docs-vp/public/${name}.html`;
      assert.ok(exists(stubPath), `${stubPath} is missing — the old URL would 404`);
      const stub = read(stubPath);
      assert.ok(stub.includes(`rel="canonical" href="https://sigmap.io/guide/${target}"`), 'canonical must name the guide page');
      assert.ok(stub.includes(`http-equiv="refresh" content="0; url=/guide/${target}"`), 'must redirect to the guide page');
      assert.ok(/<meta name="robots" content="noindex">/.test(stub), 'a redirect stub must not be indexed');
      assert.ok(exists(`docs-vp/guide/${target}.md`), `docs-vp/guide/${target}.md does not exist — the redirect would land on a 404`);
    });
  }

  // ── C. one robots.txt, one verification file, one sitemap ───────────────────

  await test('exactly one robots.txt in the repo, in the directory VitePress serves', () => {
    const robots = [...walk('docs'), ...walk('docs-vp')].filter((f) => path.posix.basename(f) === 'robots.txt');
    assert.deepStrictEqual(robots, ['docs-vp/public/robots.txt']);
  });

  await test('exactly one Search Console verification file', () => {
    const files = [...walk('docs'), ...walk('docs-vp')].filter((f) => /^google[0-9a-f]+\.html$/.test(path.posix.basename(f)));
    assert.strictEqual(files.length, 1, `found ${files.length}: ${files.join(', ')}`);
    assert.ok(files[0].startsWith('docs-vp/public/'), `${files[0]} would not be served`);
  });

  await test('no sitemap is committed; the one advertised is generated by the VitePress build', () => {
    const sitemaps = [...walk('docs'), ...walk('docs-vp')].filter((f) => /^sitemap.*\.xml$/i.test(path.posix.basename(f)));
    assert.deepStrictEqual(sitemaps, [], `committed sitemap(s): ${sitemaps.join(', ')}`);
    assert.ok(/sitemap:\s*\{[^}]*hostname:\s*'https:\/\/sigmap\.io\/'/.test(read('docs-vp/.vitepress/config.mts')),
      'config.mts must generate the sitemap for https://sigmap.io/');
    assert.ok(/^Sitemap:\s*https:\/\/sigmap\.io\/sitemap\.xml\s*$/m.test(read('docs-vp/public/robots.txt')),
      'robots.txt must advertise the generated sitemap and no other');
  });

  // ── D. every asset the config names is served ───────────────────────────────

  await test('docs-vp/.vitepress/public does not exist (VitePress serves docs-vp/public only)', () => {
    assert.ok(!exists('docs-vp/.vitepress/public'),
      'files under docs-vp/.vitepress/public are never served — put them in docs-vp/public');
  });

  await test('every image the VitePress config names is in docs-vp/public', () => {
    const cfg = read('docs-vp/.vitepress/config.mts');
    const wanted = [...cfg.matchAll(/(?:href|logo|src|image):\s*'(\/[^'\s]+\.(?:png|svg|ico|jpe?g|webp|gif))'/g)].map((m) => m[1]);
    assert.ok(wanted.includes('/favicon.png') && wanted.includes('/logo.svg'), `expected the favicon and logo in config, found: ${wanted.join(', ')}`);
    const missing = wanted.filter((u) => !exists(`docs-vp/public${u}`));
    assert.deepStrictEqual(missing, [], `named in config.mts but not served (404 on the site): ${missing.join(', ')}`);
  });

  // ── E. docs/ still holds what the README links to ───────────────────────────

  await test('every docs/ path the README links to exists', () => {
    const readme = read('README.md');
    const targets = new Set();
    for (const m of readme.matchAll(/(?:\]\(|src=")(docs\/[^)"#\s]+)/g)) targets.add(m[1]);
    assert.ok(targets.size > 0, 'README links nothing under docs/ — is the pattern still right?');
    const missing = [...targets].filter((t) => !exists(t));
    assert.deepStrictEqual(missing, [], `README links to files that do not exist: ${missing.join(', ')}`);
  });

  // ── F. a stale count appears only in dated history ──────────────────────────

  await test('"29 languages" / "21 extractors" appear only in dated historical prose', async () => {
    const { HISTORICAL_FILES } = await import('../../scripts/check-doc-counts.mjs');
    // llms*.txt are generated from the CLI help and the manual, not site claims.
    const files = [...walk('docs'), ...walk('docs-vp')].filter((f) => !/(^|\/)llms(-full)?\.txt$/.test(f));
    const stale = files.filter((f) => /\b(29|21) languages\b|\b21 extractors\b|\b29-language\b/.test(read(f)) && !HISTORICAL_FILES.has(f));
    assert.deepStrictEqual(stale, [], `stale counts outside dated history: ${stale.join(', ')}`);
  });

  console.log(`\nlegacy-docs-retired: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
