'use strict';

/**
 * Config-reference drift gate (#708).
 *
 * docs-vp/guide/config.md is the user-facing key reference, and nothing checked
 * it against the code: the page documented `enrichTodos` / `enrichChanges` /
 * `enrichCoverage`, which appear nowhere in the source, and omitted keys that
 * `loadConfig` does read. Both sides are derived here from their own source of
 * truth — `src/config/defaults.js` for the accepted key set, the page's own
 * tables for the documented set — so neither can drift without failing this gate.
 *
 * A key documented but absent from DEFAULTS is drift the page invented; a
 * DEFAULTS key missing from the page is drift the reader cannot discover.
 *
 * Deliberately a lint (milliseconds, no docs-vp/node_modules) so it runs on
 * every integration pass rather than at deploy time.
 * Run: node test/integration/config-docs.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_MD = fs.readFileSync(path.join(ROOT, 'docs-vp', 'guide', 'config.md'), 'utf8');
const { DEFAULTS } = require(path.join(ROOT, 'src', 'config', 'defaults.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/**
 * Keys the page may document that are not in DEFAULTS, each with its reason.
 * `extends` is read by loadConfig before the merge (src/config/loader.js:308,
 * :315 and :331), so it is a real top-level key that is intentionally not a
 * DEFAULT. Everything else must be backed by a DEFAULTS entry — no allowlist
 * may hide the class of bug this gate exists for.
 */
const NON_DEFAULTS_KEYS = new Map([
  ['extends', 'special-cased by loadConfig, so it has no DEFAULTS entry'],
]);

/** Every leaf path in a defaults tree; an empty object counts as a leaf. */
function defaultsPaths(node, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    const isBranch = value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
    if (isBranch) out.push(...defaultsPaths(value, full));
    else out.push(full);
  }
  return out;
}

/**
 * Keys documented in the reference tables. Only a table row whose first cell is
 * a single backticked token counts, so inline code in prose cannot leak in.
 */
function documentedKeys(md) {
  const out = new Set();
  for (const line of md.split('\n')) {
    const m = /^\|\s*`([^`]+)`\s*\|/.exec(line);
    if (m) out.add(m[1]);
  }
  return out;
}

/** Resolve a dotted path in a defaults tree. */
function valueAt(node, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o == null ? o : o[k]), node);
}

/**
 * Documented defaults from the third cell, keyed by config path. A cell is
 * checkable only when it is a single backticked literal that parses as JSON;
 * abbreviated lists (`…`) and prose defaults are skipped by design, so
 * `["src", "app", "lib", …]` and `6` (`12` for JVM layouts) stay legal.
 */
function documentedDefaults(md) {
  const out = new Map();
  for (const line of md.split('\n')) {
    if (!/^\|\s*`[^`]+`\s*\|/.test(line)) continue;
    // Split on unescaped pipes — type cells carry `\|` unions.
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    const key = /^`([^`]+)`$/.exec(cells[0]);
    const literal = /^`(.+)`$/.exec(cells[2]);
    if (!key || !literal || cells[2].includes('…')) continue;
    try { out.set(key[1], JSON.parse(literal[1])); } catch (_) { /* prose default */ }
  }
  return out;
}

/** Documented defaults that disagree with the DEFAULTS tree. */
function mismatchedDefaults(md, defaults) {
  const accepted = new Set(defaultsPaths(defaults));
  const wrong = [];
  for (const [key, shown] of documentedDefaults(md)) {
    if (!accepted.has(key)) continue;
    const actual = valueAt(defaults, key);
    if (JSON.stringify(shown) !== JSON.stringify(actual)) {
      wrong.push(`${key}: page says ${JSON.stringify(shown)}, DEFAULTS is ${JSON.stringify(actual)}`);
    }
  }
  return wrong;
}

/** Documented keys with no DEFAULTS entry and no named exception. */
function undocumentedInSource(docKeys, defaults, allow) {
  const accepted = new Set(defaultsPaths(defaults));
  return [...docKeys].filter((k) => !accepted.has(k) && !allow.has(k));
}

/** DEFAULTS leaf keys the page never documents. */
function undocumentedInPage(docKeys, defaults) {
  return defaultsPaths(defaults).filter((k) => !docKeys.has(k));
}

/** Every ```json block that parses; non-JSON examples are skipped. */
function jsonBlocks(md) {
  const out = [];
  const re = /```json\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md))) {
    try { out.push(JSON.parse(m[1])); } catch (_) { /* illustrative, not JSON */ }
  }
  return out;
}

/**
 * Key paths in a sample block that loadConfig would ignore. Descent stops
 * wherever DEFAULTS has no non-empty object, so free-form values such as
 * `exactness.lspServers` extensions are not mistaken for config keys.
 */
function unknownSamplePaths(block, defaults, allow) {
  const unknown = [];
  const walk = (obj, node, prefix) => {
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('_')) continue; // documented comment keys
      const full = prefix ? `${prefix}.${key}` : key;
      const has = node && Object.prototype.hasOwnProperty.call(node, key);
      if (!has) {
        if (!(prefix === '' && allow.has(key))) unknown.push(full);
        continue;
      }
      const child = node[key];
      const descends = value && typeof value === 'object' && !Array.isArray(value) &&
        child && typeof child === 'object' && !Array.isArray(child) && Object.keys(child).length > 0;
      if (descends) walk(value, child, full);
    }
  };
  walk(block, defaults, '');
  return unknown;
}

const docKeys = documentedKeys(CONFIG_MD);

// ---------------------------------------------------------------------------
// The real page, in both directions
// ---------------------------------------------------------------------------

test('every documented key exists in DEFAULTS (or is the extends exception)', () => {
  const unknown = undocumentedInSource(docKeys, DEFAULTS, NON_DEFAULTS_KEYS);
  assert.deepStrictEqual(unknown, [],
    `config.md documents keys loadConfig does not accept: ${unknown.join(', ')}`);
});

test('every DEFAULTS key appears in the reference table', () => {
  const missing = undocumentedInPage(docKeys, DEFAULTS);
  assert.deepStrictEqual(missing, [],
    `config.md omits keys loadConfig reads: ${missing.join(', ')}`);
});

test('every key in the sample JSON blocks is accepted by loadConfig', () => {
  const unknown = [];
  for (const block of jsonBlocks(CONFIG_MD)) {
    unknown.push(...unknownSamplePaths(block, DEFAULTS, NON_DEFAULTS_KEYS));
  }
  assert.deepStrictEqual(unknown, [],
    `sample config uses keys loadConfig ignores: ${unknown.join(', ')}`);
});

test('every documented default matches DEFAULTS', () => {
  const wrong = mismatchedDefaults(CONFIG_MD, DEFAULTS);
  assert.deepStrictEqual(wrong, [],
    `documented defaults drifted:\n  ${wrong.join('\n  ')}`);
});

// ---------------------------------------------------------------------------
// The checkers themselves — proven against the drift this gate was built for
// ---------------------------------------------------------------------------

test('the documented-key check flags the dead enrich* keys', () => {
  const dead = '| `enrichTodos` | `boolean` | `true` | Append a TODO section. |';
  assert.deepStrictEqual(undocumentedInSource(documentedKeys(dead), DEFAULTS, NON_DEFAULTS_KEYS), ['enrichTodos']);
});

test('the DEFAULTS check flags a key the page omits', () => {
  const thin = '| `output` | `string` | `.github/copilot-instructions.md` | Path. |';
  assert.ok(undocumentedInPage(documentedKeys(thin), DEFAULTS).includes('maxSigsPerFile'));
});

test('the sample check flags a dead key in a copy-paste block', () => {
  const sample = { enrichChanges: true, todos: true };
  assert.deepStrictEqual(unknownSamplePaths(sample, DEFAULTS, NON_DEFAULTS_KEYS), ['enrichChanges']);
});

test('the sample check allows the extends special case and comment keys', () => {
  const sample = { extends: './team-base.json', _comment: 'ok', todos: true };
  assert.deepStrictEqual(unknownSamplePaths(sample, DEFAULTS, NON_DEFAULTS_KEYS), []);
});

test('the default check flags a flipped documented default', () => {
  const fixture = { diffPriority: true };
  const md = '| `diffPriority` | `boolean` | `false` | When true, ranked highest. |';
  assert.deepStrictEqual(mismatchedDefaults(md, fixture), [
    'diffPriority: page says false, DEFAULTS is true',
  ]);
});

test('the default check resolves dotted paths', () => {
  const fixture = { judge: { threshold: 0.25 } };
  const md = '| `judge.threshold` | `number` | `0.30` | Verdict floor. |';
  assert.deepStrictEqual(mismatchedDefaults(md, fixture), [
    'judge.threshold: page says 0.3, DEFAULTS is 0.25',
  ]);
});

test('the default check skips abbreviated and prose defaults', () => {
  const fixture = { srcDirs: ['src', 'app'], maxDepth: 6 };
  const md = [
    '| `srcDirs` | `string[]` | `["src", "app", …]` | Directories. |',
    '| `maxDepth` | `number` | `6` (`12` for JVM layouts) | Depth. |',
  ].join('\n');
  assert.deepStrictEqual(mismatchedDefaults(md, fixture), []);
});

test('the default check reads rows whose type cell has escaped pipes', () => {
  const fixture = { format: 'default' };
  const md = '| `format` | `"default"\\|"cache"` | `"default"` | Output format. |';
  assert.deepStrictEqual(mismatchedDefaults(md, fixture), []);
});

console.log('');
console.log(`config-docs: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
