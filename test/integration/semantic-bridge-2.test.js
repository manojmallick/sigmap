'use strict';

/**
 * Semantic Bridge II (v8.21, #501): Go/Rust/Java doc-comment hints (B1b) +
 * import-graph centrality rank blend (B3, opt-in retrieval.centralityBlend).
 * Run: node test/integration/semantic-bridge-2.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN_CONTEXT = path.join(ROOT, 'gen-context.js');
const go = require(path.join(ROOT, 'src/extractors/go.js'));
const rust = require(path.join(ROOT, 'src/extractors/rust.js'));
const java = require(path.join(ROOT, 'src/extractors/java.js'));
const { computeCentrality } = require(path.join(ROOT, 'src/graph/centrality.js'));
const { rank } = require(path.join(ROOT, 'src/retrieval/ranker.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

// ── B1b: Go doc hints ───────────────────────────────────────────────────────

const GO_SRC = `package main

//go:build linux
// ChargeBackoff retries the payment with exponential backoff. Second ignored.
func ChargeBackoff(n int) error { return nil }

// Store keeps active sessions in memory and evicts stale entries lazily too
type Store struct {
	m map[string]string
}

func NoDoc(x int) int { return x }
`;

test('Go: hint on func — first sentence, after anchor, `  # ` prefix; directive skipped', () => {
  const sig = go.extract(GO_SRC).find((s) => s.includes('ChargeBackoff'));
  assert.ok(/:\d+-\d+  # ChargeBackoff retries the payment with exponential backoff$/.test(sig), sig);
  assert.ok(!sig.includes('Second ignored'), 'must stop at first sentence');
  assert.ok(!sig.includes('go:build'), 'directive must not become the hint');
});

test('Go: hint on type; capped at 60 chars; no doc → unchanged', () => {
  const sigs = go.extract(GO_SRC);
  const store = sigs.find((s) => s.includes('Store'));
  const hint = store.split('# ')[1];
  assert.ok(hint && hint.startsWith('Store keeps active sessions'), store);
  assert.ok(hint.length <= 60, `hint ${hint.length} chars: ${hint}`);
  assert.ok(!sigs.find((s) => s.includes('NoDoc')).includes('#'));
});

// ── B1b: Rust doc hints ─────────────────────────────────────────────────────

const RUST_SRC = `
/// Retries the payment with exponential backoff. Extra.
#[inline]
pub fn charge_backoff(n: u32) -> Result<(), Error> { Ok(()) }

/// Holds the parsed session state
#[derive(Debug)]
pub struct Session { id: u64 }

impl Session {
    /// Serializes the session to disk
    pub fn persist(&self) -> io::Result<()> { Ok(()) }
}

pub fn no_doc(x: u32) -> u32 { x }
`;

test('Rust: hint on pub fn through an attribute line; first sentence only', () => {
  const sig = rust.extract(RUST_SRC).find((s) => s.includes('charge_backoff'));
  assert.ok(sig.endsWith('# Retries the payment with exponential backoff'), sig);
});

test('Rust: hints on struct and impl method; no doc → unchanged', () => {
  const sigs = rust.extract(RUST_SRC);
  assert.ok(sigs.find((s) => s.includes('struct Session')).endsWith('# Holds the parsed session state'));
  assert.ok(sigs.find((s) => s.includes('persist')).endsWith('# Serializes the session to disk'));
  assert.ok(!sigs.find((s) => s.includes('no_doc')).includes('#'));
});

// ── B1b: Java doc hints ─────────────────────────────────────────────────────

const JAVA_SRC = `
/**
 * Coordinates payment retries with exponential backoff. Extra.
 */
public class PaymentRetrier {
  /**
   * Charges the card, waiting between failed attempts.
   * @param amount cents
   */
  public boolean charge(int amount) { return true; }

  /**
   * @param x only tags here
   */
  public int tagOnly(int x) { return x; }

  public int noDoc(int x) { return x; }
}
`;

test('Java: hints on class and member; tag-only and no doc → unchanged', () => {
  const sigs = java.extract(JAVA_SRC);
  assert.ok(sigs.find((s) => s.includes('class PaymentRetrier')).endsWith('# Coordinates payment retries with exponential backoff'));
  assert.ok(sigs.find((s) => s.includes('charge(')).endsWith('# Charges the card, waiting between failed attempts'));
  assert.ok(!sigs.find((s) => s.includes('tagOnly')).includes('#'));
  assert.ok(!sigs.find((s) => s.includes('noDoc')).includes('#'));
});

test('Go/Rust/Java extraction with hints is deterministic', () => {
  assert.deepStrictEqual(go.extract(GO_SRC), go.extract(GO_SRC));
  assert.deepStrictEqual(rust.extract(RUST_SRC), rust.extract(RUST_SRC));
  assert.deepStrictEqual(java.extract(JAVA_SRC), java.extract(JAVA_SRC));
});

// ── B3: centrality computation ──────────────────────────────────────────────

function syntheticGraph() {
  return { forward: new Map([
    ['/p/importer1.js', ['/p/hub.js']],
    ['/p/importer2.js', ['/p/hub.js']],
    ['/p/importer3.js', ['/p/hub.js', '/p/leaf.js']],
    ['/p/hub.js', []],
    ['/p/leaf.js', []],
  ]) };
}

test('computeCentrality: hub outranks leaf and importers; scores normalized to (0,1]', () => {
  const c = computeCentrality(syntheticGraph());
  assert.strictEqual(c.get('/p/hub.js'), 1, 'hub must carry the max score');
  assert.ok(c.get('/p/leaf.js') < 1 && c.get('/p/leaf.js') > 0);
  assert.ok(c.get('/p/importer1.js') < c.get('/p/hub.js'));
});

test('computeCentrality: deterministic; empty/missing graph → empty Map', () => {
  assert.deepStrictEqual([...computeCentrality(syntheticGraph())], [...computeCentrality(syntheticGraph())]);
  assert.strictEqual(computeCentrality(null).size, 0);
  assert.strictEqual(computeCentrality({ forward: new Map() }).size, 0);
});

// ── B3: rank() blend + isolation ────────────────────────────────────────────

test('rank(): centrality breaks the tie toward the hub; only score>0 files boosted', () => {
  const c = computeCentrality(syntheticGraph());
  const index = new Map([
    ['hub.js', ['function connectDb()']],
    ['leaf.js', ['function connectDb()']],
    ['importer1.js', ['function unrelatedStuff()']],
  ]);
  const on = rank('connect db', index, { topK: 5, cwd: '/p', centrality: c });
  const hub = on.find((r) => r.file === 'hub.js');
  const leaf = on.find((r) => r.file === 'leaf.js');
  const unrelated = on.find((r) => r.file === 'importer1.js');
  assert.ok(hub.signals.centrality > leaf.signals.centrality, 'hub must get the larger prior');
  assert.ok(hub.score > leaf.score, 'tie must break toward the hub');
  assert.strictEqual(unrelated.signals.centrality, undefined, 'zero-score file must not be boosted');
});

test('rank(): without centrality (absent or null) output is unchanged, no signal', () => {
  const index = new Map([['hub.js', ['function connectDb()']], ['leaf.js', ['function connectDb()']]]);
  const a = rank('connect db', index, { topK: 5, cwd: '/p' });
  const b = rank('connect db', index, { topK: 5, cwd: '/p', centrality: null });
  assert.deepStrictEqual(a.map((r) => [r.file, r.score]), b.map((r) => [r.file, r.score]));
  assert.ok(a.every((r) => r.signals.centrality === undefined));
});

// ── B3: config-gated CLI wiring ─────────────────────────────────────────────

/** JS fixture with a real import edge: a.js and b.js both import hub.js. */
function withJsProject(fn, config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-central-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'hub.js'),
      "'use strict';\nfunction connectDatabase(url) { return url; }\nmodule.exports = { connectDatabase };\n");
    fs.writeFileSync(path.join(dir, 'src', 'a.js'),
      "'use strict';\nconst { connectDatabase } = require('./hub');\nfunction startApp() { return connectDatabase('x'); }\nmodule.exports = { startApp };\n");
    fs.writeFileSync(path.join(dir, 'src', 'b.js'),
      "'use strict';\nconst { connectDatabase } = require('./hub');\nfunction runWorker() { return connectDatabase('y'); }\nmodule.exports = { runWorker };\n");
    if (config) {
      fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(config, null, 2));
    }
    const gen = spawnSync(process.execPath, [GEN_CONTEXT], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(gen.status, 0, gen.stderr);
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('--query: centrality signal appears only when retrieval.centralityBlend is on', () => {
  withJsProject((dir) => {
    const off = spawnSync(process.execPath, [GEN_CONTEXT, '--query', 'connect database', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(off.status, 0, off.stderr);
    assert.ok(!off.stdout.includes('"centrality"'), 'blend active without config');
  });
  withJsProject((dir) => {
    const on = spawnSync(process.execPath, [GEN_CONTEXT, '--query', 'connect database', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(on.status, 0, on.stderr);
    assert.ok(on.stdout.includes('"centrality"'), 'centrality signal missing with config on');
  }, { retrieval: { centralityBlend: true } });
});

console.log(`\n  semantic-bridge-2: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
