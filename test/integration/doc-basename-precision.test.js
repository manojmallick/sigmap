'use strict';

/**
 * A doc basename is documentation only when it is not source code (#900, from
 * #893 section 3).
 *
 * `isDocsFile` matched the well-known names (README, CHANGELOG, HISTORY,
 * SECURITY, LICENSE, AUTHORS, NOTICE, CHANGES …) with ANY extension, so
 * `history.ts`, `security.py` and `changes.rb` were "docs" and lost 80% of their
 * score. On the third-party gate that left excalidraw's undo/redo
 * implementation at rank 20 for the one question about undo and redo.
 *
 * The rule is a deny-list on purpose. A census over every tracked file in the 50
 * local benchmark repos (66,691 files) found 16 whose class an allow-list of
 * prose extensions would change — 8 real source files, and 8 genuine docs that
 * the allow-list would have wrongly released (`README.Rmd`, `LICENSE.python`,
 * `LICENSE.note`, `Readme.scalatex`). Excluding only programming-language
 * extensions changes exactly the 8.
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { isDocsFile, isTestFile, isGeneratedDir } = require(path.join(ROOT, 'src/util/file-class'));
const { rank } = require(path.join(ROOT, 'src/retrieval/ranker'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

// ── The predicate ──────────────────────────────────────────────────────────

test('the real source files the census found are no longer docs', () => {
  for (const f of [
    'packages/excalidraw/history.ts',
    'django/middleware/security.py',
    'activestorage/lib/active_storage/attached/changes.rb',
    'tools/rail_inspector/lib/rail_inspector/changelog.rb',
    'xtask/src/release/changelog.rs',
    'R/history.R',
    'srcts/src/initialize/history.ts',
    'scripts/authors.scala',
  ]) assert.strictEqual(isDocsFile(f), false, `${f} is source, not documentation`);
});

test('every other doc basename in a programming-language extension is source too', () => {
  for (const f of ['license.go', 'notice.java', 'security.js', 'changes.tsx', 'history.kt', 'authors.rb',
    'Contributing.cs', 'upgrading.swift', 'migrating.php', 'maintainers.lua', 'governance.ex', 'readme.dart']) {
    assert.strictEqual(isDocsFile(f), false, `${f} is source, not documentation`);
  }
});

test('documentation is still documentation — the plain names and every prose form', () => {
  for (const f of [
    'README', 'README.md', 'readme.md', 'README.markdown', 'README.rst', 'README.txt', 'README.html',
    'CHANGELOG.md', 'CHANGES.rst', 'HISTORY.rst', 'HISTORY.md', 'LICENSE', 'LICENSE.txt', 'LICENCE',
    'NOTICE', 'NOTICE.txt', 'AUTHORS', 'AUTHORS.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md',
    'CONTRIBUTING.md', 'CONTRIBUTING.rst', 'UPGRADING.md', 'MIGRATING.md', 'MAINTAINERS', 'GOVERNANCE.md',
    'packages/x/README.md', 'a/b/CHANGELOG.md',
  ]) assert.strictEqual(isDocsFile(f), true, `${f} is documentation`);
});

test('genuine docs with an unusual extension stay docs (what an allow-list would have released)', () => {
  for (const f of ['README.Rmd', 'LICENSE.python', 'LICENSE.note', 'Readme.scalatex', 'README.zoneinfo', 'CHANGELOG.json']) {
    assert.strictEqual(isDocsFile(f), true, `${f} is documentation`);
  }
});

test('the docs/ directory rule is untouched: code under docs/ is still docs', () => {
  for (const f of ['docs/index.md', 'docs/api/reference.ts', 'website/docs/guide.js', 'documentation/x.py']) {
    assert.strictEqual(isDocsFile(f), true, `${f} sits under a docs directory`);
  }
});

test('ordinary source with an unrelated name is never docs', () => {
  for (const f of ['src/index.ts', 'lib/router.py', 'cmd/main.go', 'src/readmeParser.ts', 'src/security/policy.ts']) {
    assert.strictEqual(isDocsFile(f), false, `${f} is source`);
  }
});

test('the two sibling predicates are unchanged — the census found no case for touching them', () => {
  // `test_*` fires on 62 code files in the benchmark repos and every one is a
  // test or testing-infrastructure file, so it stays.
  assert.strictEqual(isTestFile('lua/plenary/test_harness.lua'), true);
  assert.strictEqual(isTestFile('rails/lib/active_support/test_case.rb'), true);
  assert.strictEqual(isGeneratedDir('packages/astro/src/core/build/static-build.ts'), true);
});

// ── The ranker: the demotion is what actually hurt ─────────────────────────

const undoIndex = () => new Map([
  ['packages/excalidraw/history.ts', ['export class History', '  record(entry)', '  undo()', '  redo()', 'export class HistoryEntry']],
  ['packages/excalidraw/actions/actionHistory.tsx', ['export const createUndoAction = (history) =>', 'export const createRedoAction = (history) =>']],
  ['packages/excalidraw/README.md', ['h1 Excalidraw', 'h2 undo redo']],
]);

test('ranker: history.ts is not penalised, README.md still is', () => {
  const out = rank('how does the editor keep undo and redo history stacks', undoIndex(), { topK: 5, learned: false });
  const penaltyOf = (f) => (out.find((r) => r.file === f) || {}).signals;
  assert.ok(penaltyOf('packages/excalidraw/history.ts'), `history.ts missing from ${out.map((r) => r.file).join(', ')}`);
  assert.strictEqual(penaltyOf('packages/excalidraw/history.ts').penalty, 1, 'history.ts must carry no penalty');
  assert.ok(penaltyOf('packages/excalidraw/README.md'), 'README.md should still rank');
  assert.ok(penaltyOf('packages/excalidraw/README.md').penalty < 1, 'README.md must still be demoted');
});

test('ranker: the implementation outranks its README for the question about it', () => {
  const out = rank('how does the editor keep undo and redo history stacks', undoIndex(), { topK: 5, learned: false });
  const at = (f) => out.findIndex((r) => r.file === f);
  assert.ok(at('packages/excalidraw/history.ts') !== -1, 'history.ts must be ranked');
  assert.ok(at('packages/excalidraw/history.ts') < at('packages/excalidraw/README.md'),
    `history.ts (${at('packages/excalidraw/history.ts')}) should outrank README.md (${at('packages/excalidraw/README.md')})`);
});

test('ranker: security.py is a candidate on equal terms for a question about security', () => {
  const idx = new Map([
    ['django/middleware/security.py', ['class SecurityMiddleware', '  process_request(request)', '  process_response(request, response)']],
    ['django/utils/text.py', ['def slugify(value)']],
  ]);
  const out = rank('how does the security middleware set strict transport headers', idx, { topK: 3, learned: false });
  assert.ok(out.length > 0 && out[0].file === 'django/middleware/security.py', JSON.stringify(out.map((r) => r.file)));
  assert.strictEqual(out[0].signals.penalty, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
