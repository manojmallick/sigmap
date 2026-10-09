'use strict';

/**
 * Architecture decision records stay complete, linked and checkable (#930, #705 G6).
 *
 * The records under docs-vp/adr/ are only worth publishing if a reader can check
 * them. This pins the structure (every part present), the wiring (index and sidebar
 * list every record), and — the part that rots — that every repository path an
 * ADR cites as evidence still exists, so a rename fails here instead of leaving a
 * published page pointing at nothing.
 *
 * Run: node test/integration/adr-records.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ADR_DIR = 'docs-vp/adr';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const records = fs.readdirSync(path.join(ROOT, ADR_DIR))
  .filter((f) => /^\d{4}-.+\.md$/.test(f))
  .sort();
const slugOf = (f) => f.replace(/\.md$/, '');

const SECTIONS = ['Context', 'Decision', 'Why', 'Consequences', 'Evidence', 'Revisit when'];
const STATUSES = ['Accepted', 'Accepted with exceptions', 'Deprecated', 'Superseded'];

// A path in backticks that points into this repository. Runtime paths (`.context/…`), the
// user's own `node_modules`, and globs are not repository files and are skipped.
const REPO_PATH = /^(?:(?:src|scripts|test|packages|benchmarks|\.github|docs-vp)\/[^\s*]*|KNOWN_LIMITATIONS\.md|CHANGELOG\.md|gen-context\.js|package\.json)$/;
function citedPaths(md) {
  const out = new Set();
  for (const m of md.matchAll(/`([^`\n]+)`/g)) {
    const t = m[1].replace(/:\d+(-\d+)?$/, '');
    if (REPO_PATH.test(t)) out.add(t);
  }
  for (const m of md.matchAll(/\]\(https:\/\/github\.com\/manojmallick\/sigmap\/blob\/main\/([^)#\s]+)\)/g)) out.add(m[1]);
  return [...out];
}

test('the template and the index exist', () => {
  assert.ok(exists(`${ADR_DIR}/template.md`), 'template.md is missing');
  assert.ok(exists(`${ADR_DIR}/index.md`), 'index.md is missing');
});

test('there are at least the six founding records, numbered contiguously from 0001', () => {
  assert.ok(records.length >= 6, `expected at least 6 records, found ${records.length}`);
  records.forEach((f, i) => {
    const want = String(i + 1).padStart(4, '0');
    assert.ok(f.startsWith(want + '-'), `record ${i + 1} should be numbered ${want}, got ${f}`);
  });
});

for (const f of records) {
  const rel = `${ADR_DIR}/${f}`;
  const md = read(rel);
  const num = f.slice(0, 4);

  test(`${num}: has every part of a record`, () => {
    for (const s of SECTIONS) {
      assert.ok(new RegExp(`^## ${s}\\s*$`, 'm').test(md), `missing "## ${s}"`);
    }
    assert.ok(new RegExp(`^# ADR ${num} — .+`, 'm').test(md), `heading must read "# ADR ${num} — …"`);
  });

  test(`${num}: states a status and a recorded date`, () => {
    const status = (md.match(/^\| \*\*Status\*\* \| (.+) \|$/m) || [])[1] || '';
    assert.ok(STATUSES.some((s) => status.startsWith(s)), `status "${status}" is not one of ${STATUSES.join(' / ')}`);
    assert.ok(/^\| \*\*Recorded\*\* \| \d{4}-\d{2}-\d{2}\b/m.test(md), 'missing a "Recorded" date');
  });

  test(`${num}: Evidence cites something in the repository`, () => {
    const evidence = md.split(/^## Evidence\s*$/m)[1].split(/^## /m)[0];
    const refs = citedPaths(evidence).length + [...evidence.matchAll(/\(\/(?:guide|adr)\//g)].length
      + [...evidence.matchAll(/github\.com\/manojmallick\/sigmap\/(?:issues|pull)\/\d+/g)].length;
    assert.ok(refs > 0, 'the Evidence section cites no file, page or issue');
  });

  test(`${num}: every repository path it cites exists`, () => {
    const cited = citedPaths(md);
    assert.ok(cited.length > 0, 'cites no repository path at all');
    const missing = cited.filter((p) => !exists(p));
    assert.deepStrictEqual(missing, [], `cited but not in the repository: ${missing.join(', ')}`);
  });

  test(`${num}: internal links resolve to a page`, () => {
    const targets = [...md.matchAll(/\]\((\/(?:adr|guide)\/[^)#\s]*)/g)].map((m) => m[1]);
    const missing = targets.filter((t) => {
      const base = t.endsWith('/') ? `${t}index` : t;
      return !exists(`docs-vp${base}.md`);
    });
    assert.deepStrictEqual(missing, [], `links to pages that do not exist: ${missing.join(', ')}`);
  });
}

test('the index lists every record', () => {
  const index = read(`${ADR_DIR}/index.md`);
  const missing = records.filter((f) => !index.includes(`(/adr/${slugOf(f)})`));
  assert.deepStrictEqual(missing, [], `index.md does not link: ${missing.join(', ')}`);
});

test('the sidebar links the overview and every record', () => {
  const cfg = read('docs-vp/.vitepress/config.mts');
  assert.ok(cfg.includes("link: '/adr/'"), 'the sidebar has no link to /adr/');
  const missing = records.filter((f) => !cfg.includes(`link: '/adr/${slugOf(f)}'`));
  assert.deepStrictEqual(missing, [], `sidebar does not link: ${missing.join(', ')}`);
});

test('the template carries every section a record must have', () => {
  const t = read(`${ADR_DIR}/template.md`);
  for (const s of SECTIONS) assert.ok(new RegExp(`^## ${s}\\s*$`, 'm').test(t), `template is missing "## ${s}"`);
});

console.log(`\nadr-records: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
