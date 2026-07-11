'use strict';

/**
 * Integration tests for the terse signature encoder (D7, #462).
 *
 * Covers: deterministic transforms, byte-exact anchor preservation (including
 * Python doc hints that trail the anchor), symbol-name extraction on terse
 * lines, measureTerse, the `--terse` generate path, ranker parse-back of a
 * terse context file, and the default path staying byte-identical.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const GEN_CONTEXT = path.resolve(__dirname, '../../gen-context.js');
const { encodeTerseSig, encodeTerseSigs, measureTerse, splitAnchor } = require('../../src/format/terse');
const { extractName } = require('../../src/extractors/prdiff');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

function withProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-terse-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'app.js'), [
      'async function fetchUser(id, opts = {}) {',
      '  return { id };',
      '}',
      'function formatUser(user, style) {',
      '  return String(user);',
      '}',
      'module.exports = { fetchUser, formatUser };',
      '',
    ].join('\n'));
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function generate(dir, ...args) {
  return spawnSync(process.execPath, [GEN_CONTEXT, ...args], { cwd: dir, encoding: 'utf8' });
}

function readOutput(dir) {
  return fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
}

// ── encoder transforms ──────────────────────────────────────────────────────

test('function keyword compacts to fn, params tighten, anchor untouched', () => {
  assert.strictEqual(
    encodeTerseSig('function formatUser(user, style)  :4-6'),
    'fn formatUser(user,style)  :4-6'
  );
});

test('async function compacts to async fn', () => {
  assert.strictEqual(
    encodeTerseSig('async function fetchWithTimeout(url, opts, timeoutMs) → Promise<Response>  :72-80'),
    'async fn fetchWithTimeout(url,opts,timeoutMs)→Promise<Response>  :72-80'
  );
});

test('module.exports line compacts to exports=', () => {
  assert.strictEqual(
    encodeTerseSig('module.exports = { extract, rank, scan }  :254-267'),
    'exports={extract,rank,scan}  :254-267'
  );
});

test('default params compact', () => {
  assert.strictEqual(
    encodeTerseSig('function extract(src, language = "js") → string[]  :91-120'),
    'fn extract(src,language="js")→string[]  :91-120'
  );
});

test('python doc hint after the anchor is preserved byte-exactly', () => {
  const sig = 'def annotation_to_str(node)  :25-48  # Convert an AST annotation node';
  const out = encodeTerseSig(sig);
  assert.ok(out.endsWith('  :25-48  # Convert an AST annotation node'), out);
});

test('sig without anchor still compacts and gains no anchor', () => {
  assert.strictEqual(encodeTerseSig('function walk(dir, out)'), 'fn walk(dir,out)');
});

test('splitAnchor keeps the anchor suffix byte-exact', () => {
  const { text, suffix } = splitAnchor('fn x(a,b)  :12-34');
  assert.strictEqual(text, 'fn x(a,b)');
  assert.strictEqual(suffix, '  :12-34');
});

test('terse encoding is idempotent', () => {
  const once = encodeTerseSig('function formatUser(user, style)  :4-6');
  assert.strictEqual(encodeTerseSig(once), once);
});

test('extractName still resolves symbols on terse lines', () => {
  assert.strictEqual(extractName('fn formatUser(user,style)  :4-6'), 'formatUser');
  assert.strictEqual(extractName('async fn fetchUser(id,opts={})  :1-3'), 'fetchUser');
  assert.strictEqual(extractName('exports={fetchUser,formatUser}  :7-7'), '');
});

test('measureTerse reports a real reduction with the chars/4 rule', () => {
  const sigs = [
    'module.exports = { fetchUser, formatUser }  :7-7',
    'async function fetchUser(id, opts = {})  :1-3',
    'function formatUser(user, style)  :4-6',
  ];
  const m = measureTerse([sigs]);
  assert.ok(m.beforeTokens > m.afterTokens, `${m.beforeTokens} > ${m.afterTokens}`);
  assert.ok(m.reductionPct > 0 && m.reductionPct < 100, String(m.reductionPct));
  assert.strictEqual(m.beforeTokens, Math.ceil(sigs.join('\n').length / 4));
});

test('encodeTerseSigs maps arrays and tolerates empty input', () => {
  assert.deepStrictEqual(encodeTerseSigs([]), []);
  assert.deepStrictEqual(encodeTerseSigs(null), []);
  assert.strictEqual(encodeTerseSigs(['function a(b, c)  :1-2'])[0], 'fn a(b,c)  :1-2');
});

// ── generate path ───────────────────────────────────────────────────────────

test('--terse generates compacted sig block with anchors intact and reports the delta', () => {
  withProject((dir) => {
    const res = generate(dir, '--terse');
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(/\[sigmap\] terse: sig block \d+ → \d+ tokens \(-[\d.]+%\)/.test(res.stderr), res.stderr);
    const out = readOutput(dir);
    assert.ok(out.includes('fn formatUser(user,style)  :4-6'), out);
    assert.ok(out.includes('async fn fetchUser(id,opts={})  :1-3'), out);
    assert.ok(!out.includes('function formatUser(user, style)'), 'default form leaked into terse output');
  });
});

test('without --terse the sig block keeps the default form', () => {
  withProject((dir) => {
    const res = generate(dir);
    assert.strictEqual(res.status, 0, res.stderr);
    const out = readOutput(dir);
    assert.ok(out.includes('function formatUser(user, style)  :4-6'), out);
    assert.ok(!out.includes('fn formatUser'), 'terse form leaked into default output');
  });
});

test('ranker parses a terse context file back into a sig index', () => {
  withProject((dir) => {
    const res = generate(dir, '--terse');
    assert.strictEqual(res.status, 0, res.stderr);
    const { buildSigIndex, rank } = require('../../src/retrieval/ranker');
    const index = buildSigIndex(dir);
    const appSigs = [...index.entries()].find(([f]) => f.endsWith('src/app.js'));
    assert.ok(appSigs, 'src/app.js missing from parsed index');
    assert.ok(appSigs[1].some((s) => s.includes('fn formatUser(user,style)')), appSigs[1].join('|'));
    const ranked = rank('format user', index, {});
    assert.ok(ranked.length > 0 && ranked[0].file.endsWith('src/app.js'), JSON.stringify(ranked[0] || null));
  });
});

test('--help documents --terse', () => {
  const res = spawnSync(process.execPath, [GEN_CONTEXT, '--help'], { encoding: 'utf8' });
  assert.ok((res.stdout || '').includes('--terse'), 'missing --terse in help');
});

console.log(`\nterse: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
