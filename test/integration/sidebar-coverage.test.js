'use strict';

/**
 * Docs-nav coverage guard (#700).
 *
 * `docs-vp/guide/methodology.md` shipped and built, but no sidebar entry in
 * `docs-vp/.vitepress/config.mts` pointed at it, so the only way to reach the
 * page was typing the URL. Nothing failed: VitePress builds an unreferenced
 * page fine, and the docs CI only proves the site compiles.
 *
 * This test derives both sides independently — the pages that exist on disk
 * and the links the sidebar declares — and fails when they disagree, in either
 * direction. A new `guide/*.md` file must be linked, and a renamed page must
 * not leave a dead sidebar link behind.
 *
 * Run: node test/integration/sidebar-coverage.test.js
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const ROOT      = path.resolve(__dirname, '../..');
const CONFIG    = path.join(ROOT, 'docs-vp', '.vitepress', 'config.mts');
const GUIDE_DIR = path.join(ROOT, 'docs-vp', 'guide');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/** The sidebar array literal, bracket-matched so the nested item arrays are included. */
function sidebarSource(src) {
  const start = src.indexOf('sidebar:');
  assert.notStrictEqual(start, -1, 'no `sidebar:` key in docs-vp/.vitepress/config.mts');
  const open = src.indexOf('[', start);
  assert.notStrictEqual(open, -1, 'no sidebar array in docs-vp/.vitepress/config.mts');
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error('sidebar array is not closed');
}

/** Every link the sidebar declares, as written (e.g. `/guide/cli`). */
function sidebarLinks(src) {
  const out = new Set();
  for (const m of sidebarSource(src).matchAll(/link:\s*'([^']+)'/g)) out.add(m[1]);
  return out;
}

/** Every page under docs-vp/guide, as its site path (e.g. `/guide/cli`). */
function guidePages() {
  return fs.readdirSync(GUIDE_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => `/guide/${f.replace(/\.md$/, '')}`)
    .sort();
}

const config = fs.readFileSync(CONFIG, 'utf8');
const links  = sidebarLinks(config);
const pages  = guidePages();

console.log('[sidebar-coverage.test.js] docs nav guard (#700)');
console.log('');
console.log(`  ${pages.length} guide pages, ${links.size} sidebar links`);
console.log('');

test('the sidebar parses to a plausible link set', () => {
  assert.ok(pages.length > 10, `expected several guide pages, found ${pages.length}`);
  assert.ok(links.size > 10, `expected several sidebar links, found ${links.size}`);
});

test('every guide page has a sidebar entry', () => {
  const orphans = pages.filter((p) => !links.has(p));
  assert.deepStrictEqual(orphans, [],
    `these pages build but the sidebar never links them: ${orphans.join(', ')}`);
});

test('every sidebar guide link resolves to a page that exists', () => {
  const guideLinks = [...links].filter((l) => l.startsWith('/guide/'));
  const missing = guideLinks.filter((l) => !pages.includes(l.split('#')[0].replace(/\/$/, '')));
  assert.deepStrictEqual(missing, [],
    `these sidebar links point at no guide page: ${missing.join(', ')}`);
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
