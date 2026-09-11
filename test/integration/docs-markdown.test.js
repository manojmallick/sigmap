'use strict';

/**
 * VitePress markdown guard (#573).
 *
 * The v8.31.0 Pages deploy failed after the tag was pushed, on a real build
 * error: an example embedded `sigmap lines` output — which itself contains a
 * fenced block — inside a three-backtick fence. The inner fence closed the
 * block early, leaving a JSDoc `{{ … }}` as raw markdown, which VitePress
 * parses as a Vue interpolation.
 *
 * Nothing caught it: /update-docs never builds the docs, and the release
 * commit is pushed straight to develop, so the "Build docs" PR check never ran.
 *
 * This is deliberately a lint, not a build — milliseconds, no docs-vp/
 * node_modules — so it runs on every suite pass rather than at deploy time.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../..');
const DOCS = path.join(ROOT, 'docs-vp');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/** Markdown under docs-vp, excluding build output and dependencies. */
function docFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'cache' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) docFiles(full, out);
    else if (e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * Walk a file's lines, tracking fence state. A fence closes only on a run of
 * backticks at least as long as the one that opened it — so a ```` block may
 * legitimately contain ``` , which is exactly how the v8.31.0 bug was fixed.
 */
function scan(src) {
  const lines = src.split('\n');
  let fence = null;              // length of the open fence, or null
  const interpolations = [];
  lines.forEach((line, i) => {
    const m = /^\s*(`{3,})/.exec(line);
    if (m) {
      if (fence === null) { fence = m[1].length; return; }
      if (m[1].length >= fence) { fence = null; return; }
      return;                     // shorter run inside a longer fence: content
    }
    if (fence === null && /\{\{[^}]*\}\}/.test(line)) {
      interpolations.push({ line: i + 1, text: line.trim().slice(0, 70) });
    }
  });
  return { unbalanced: fence !== null, interpolations };
}

const files = docFiles(DOCS);

test('docs-vp markdown is present to check', () => {
  assert.ok(files.length > 5, `expected several markdown files, found ${files.length}`);
});

test('every fenced code block is closed', () => {
  const bad = files.filter((f) => scan(fs.readFileSync(f, 'utf8')).unbalanced)
    .map((f) => path.relative(ROOT, f));
  assert.deepStrictEqual(bad, [], `unclosed code fence in: ${bad.join(', ')}`);
});

test('no Vue interpolation outside a code fence', () => {
  const hits = [];
  for (const f of files) {
    for (const i of scan(fs.readFileSync(f, 'utf8')).interpolations) {
      hits.push(`${path.relative(ROOT, f)}:${i.line}  ${i.text}`);
    }
  }
  assert.deepStrictEqual(hits, [],
    `VitePress parses {{ … }} as a Vue expression and fails the build:\n        ${hits.join('\n        ')}`);
});

// ---------------------------------------------------------------------------
// The scanner itself — proven against the markdown that actually broke
// ---------------------------------------------------------------------------

test('flags the exact shape that broke the v8.31.0 build', () => {
  const broken = [
    '```text',
    '$ sigmap lines src/graph/builder.js :447',
    '# src/graph/builder.js:445-449',
    '```',
    ' * @returns {{ forward: Map<string,string[]> }}',
    ' */',
    '```',
    '```',
  ].join('\n');
  const r = scan(broken);
  assert.strictEqual(r.interpolations.length, 1, 'the escaped interpolation must be flagged');
  assert.ok(/forward/.test(r.interpolations[0].text));
});

test('accepts the four-backtick form that fixed it', () => {
  const fixed = [
    '````text',
    '# src/graph/builder.js:445-449',
    '```',
    ' * @returns { forward: Map<string,string[]> }',
    '```',
    '````',
  ].join('\n');
  const r = scan(fixed);
  assert.strictEqual(r.interpolations.length, 0, 'content inside a longer fence is not markdown');
  assert.strictEqual(r.unbalanced, false, 'the four-backtick fence closes');
});

test('an unclosed fence is detected', () => {
  assert.strictEqual(scan('```js\nconst a = 1;\n').unbalanced, true);
  assert.strictEqual(scan('```js\nconst a = 1;\n```\n').unbalanced, false);
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
