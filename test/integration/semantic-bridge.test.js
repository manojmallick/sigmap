'use strict';

/**
 * Semantic Bridge I (v8.20, #498): JS/TS doc-comment hints + `sigmap memory`.
 * Run: node test/integration/semantic-bridge.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const js = require(path.join(ROOT, 'src/extractors/javascript.js'));
const ts = require(path.join(ROOT, 'src/extractors/typescript.js'));
const { bm25rank } = require(path.join(ROOT, 'src/retrieval/bm25.js'));
const { inspectMemory, clearMemory } = require(path.join(ROOT, 'src/session/memory-inspect.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

// ── B1a: doc-comment hints ──────────────────────────────────────────────────

const JS_SRC = `
/**
 * Retries the payment with exponential backoff. Second sentence ignored.
 * @param {number} n
 */
export function chargeBackoff(n) { return n; }

/** Formats a user-facing error message */
export const fmtError = (e) => String(e);

/**
 * @param {string} x
 */
function tagOnly(x) { return x; }

/** Walks the config tree and resolves every include directive found there for later use */
function walkConfig(root) { return root; }

function noDoc(x) { return x; }
`;

test('JS: hint on exported function — first sentence, after anchor, `  # ` prefix', () => {
  const sig = js.extract(JS_SRC).find((s) => s.includes('chargeBackoff'));
  assert.ok(/:\d+-\d+  # Retries the payment with exponential backoff$/.test(sig), sig);
  assert.ok(!sig.includes('Second sentence'), 'must stop at first sentence');
});

test('JS: hint on exported arrow const, correctly attributed (no cross-block bleed)', () => {
  const sig = js.extract(JS_SRC).find((s) => s.includes('fmtError'));
  assert.ok(sig.endsWith('# Formats a user-facing error message'), sig);
});

test('JS: tag-only doc and no doc → signature unchanged', () => {
  const sigs = js.extract(JS_SRC);
  assert.ok(!sigs.find((s) => s.includes('tagOnly')).includes('#'));
  assert.ok(!sigs.find((s) => s.includes('noDoc')).includes('#'));
});

test('JS: hint capped at 60 chars', () => {
  const sig = js.extract(JS_SRC).find((s) => s.includes('walkConfig'));
  const hint = sig.split('# ')[1];
  assert.ok(hint.length <= 60, `hint ${hint.length} chars: ${hint}`);
});

const TS_SRC = `
/**
 * Fetches the user profile from the session store. Extra.
 */
export async function fetchProfile(id: string): Promise<P> { return db.get(id); }

/** Debounces the search input */
export const useSearch = (q: string) => { return { query: q }; };

export function noDoc(x: number) { return x; }
`;

test('TS: hints on exported function and arrow const; no doc → unchanged', () => {
  const sigs = ts.extract(TS_SRC);
  assert.ok(sigs.find((s) => s.includes('fetchProfile')).endsWith('# Fetches the user profile from the session store'));
  assert.ok(sigs.find((s) => s.includes('useSearch')).includes('# Debounces the search input'));
  assert.ok(!sigs.find((s) => s.includes('noDoc')).includes('#'));
});

test('vocab-mismatch query retrieves the file ONLY via its doc hint', () => {
  // Query vocabulary is fully disjoint from every identifier (BM25 splits
  // camelCase, so hint words must not overlap the function name either).
  const src = `
/** Waits between failed attempts before contacting the gateway again */
export function chargeBackoff(n) { return n; }
`;
  const withHints = js.extract(src);
  const noHints = withHints.map((s) => s.split('  # ')[0]);
  const decoy = { file: 'util/strings.js', sigs: ['function pad(s, w)', 'function trim(s)'] };
  const query = 'waits between failed attempts gateway';
  const hinted = bm25rank(query, [{ file: 'billing/charge.js', sigs: withHints }, decoy]);
  const plain = bm25rank(query, [{ file: 'billing/charge.js', sigs: noHints }, decoy]);
  assert.ok(hinted[0].file === 'billing/charge.js' && hinted[0].score > 0, 'hinted arm must match');
  const plainScore = plain.find((r) => r.file === 'billing/charge.js').score;
  assert.strictEqual(plainScore, 0, 'without hints the query matches nothing');
});

test('JS/TS extraction with hints is deterministic (same input → same output)', () => {
  assert.deepStrictEqual(js.extract(JS_SRC), js.extract(JS_SRC));
  assert.deepStrictEqual(ts.extract(TS_SRC), ts.extract(TS_SRC));
});

// ── E2: sigmap memory ───────────────────────────────────────────────────────

function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-mem-'));
  fs.mkdirSync(path.join(dir, '.context'));
  fs.writeFileSync(path.join(dir, '.context/session.json'), JSON.stringify({ intent: 'x' }));
  fs.writeFileSync(path.join(dir, '.context/notes.ndjson'), '{"text":"a"}\n{"text":"b"}\n');
  fs.writeFileSync(path.join(dir, '.context/weights.json'), JSON.stringify({ files: { 'a.js': 1.1, 'b.js': 0.9 } }));
  return dir;
}

test('memory: inspectMemory reports counts, sizes, ages for existing stores', () => {
  const dir = tmpStore();
  const byName = Object.fromEntries(inspectMemory(dir).map((s) => [s.store, s]));
  assert.strictEqual(byName.notes.entries, 2);
  assert.strictEqual(byName.weights.entries, 2);
  assert.strictEqual(byName.session.entries, 1);
  assert.strictEqual(byName.evidence.exists, false);
  assert.ok(byName.gain && byName.usage, 'tracking stores listed');
  assert.ok(!byName.gain.clearable && !byName.usage.clearable, 'tracking stores not clearable here');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('memory: clearMemory removes exactly the named store; rejects unknown/protected', () => {
  const dir = tmpStore();
  assert.deepStrictEqual(clearMemory(dir, 'notes'), ['notes']);
  assert.ok(!fs.existsSync(path.join(dir, '.context/notes.ndjson')));
  assert.ok(fs.existsSync(path.join(dir, '.context/weights.json')), 'other stores untouched');
  assert.throws(() => clearMemory(dir, 'gain'), /protected/);
  assert.throws(() => clearMemory(dir, 'bogus'), /unknown or protected/);
  const removed = clearMemory(dir, 'all');
  assert.ok(removed.includes('session') && removed.includes('weights'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('CLI: `sigmap memory` runs and --help documents it', () => {
  const dir = tmpStore();
  const out = execFileSync(process.execPath, [path.join(ROOT, 'gen-context.js'), 'memory', '--json'], { cwd: dir, encoding: 'utf8' });
  const { stores } = JSON.parse(out);
  assert.strictEqual(stores.find((s) => s.store === 'notes').entries, 2);
  const help = execFileSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--help'], { encoding: 'utf8' });
  assert.ok(/memory\s+List cross-session stores/.test(help), '--help missing memory');
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(`\n  semantic-bridge: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
