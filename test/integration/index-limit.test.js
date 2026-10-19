'use strict';

/**
 * The retrieval index has its own per-file signature limit (#982).
 *
 * `maxSigsPerFile` (25) is a token budget for the GENERATED CONTEXT FILE. The index
 * (.context/sig-index.json) feeds `ask`, `verify`, `explain` and the MCP search tools
 * and is never injected into a prompt, yet it used to inherit the 25: on Django it held
 * 57-76% of the public symbols, and a file with 40 top-level functions hid every class
 * that came after them. `maxIndexSigsPerFile` (200) now governs the index; the context
 * file is byte-identical to what it was.
 *
 * Each case below fails against the code before the change.
 * Run: node test/integration/index-limit.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'gen-context.js');
const { DEFAULTS } = require('../../src/config/defaults');
const { entryConfig, indexLimit, capForIndex } = require('../../src/cache/entry');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const tmpDirs = [];
function project(files, config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-idxlimit-'));
  tmpDirs.push(dir);
  spawnSync('git', ['init', '-q', dir]);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(Object.assign({ srcDirs: ['src'] }, config || {})));
  return dir;
}
function generate(dir) {
  const r = spawnSync(process.execPath, [CLI], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  return r;
}
const indexOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.context/sig-index.json'), 'utf8')).files;
const contextOf = (dir) => fs.readFileSync(path.join(dir, '.github/copilot-instructions.md'), 'utf8').replace(/^<!-- Updated:.*$/m, '');
const fns = (n, prefix = 'fn') => Array.from({ length: n }, (_, i) => `function ${prefix}${i}(a) { return a; }\n`).join('');

// ── the setting ────────────────────────────────────────────────────────────

test('the index has its own limit, 200, beside the context file\'s 25', () => {
  assert.strictEqual(DEFAULTS.maxSigsPerFile, 25);
  assert.strictEqual(DEFAULTS.maxIndexSigsPerFile, 200);
});

test('the index never holds fewer than the context file; either key can be set alone', () => {
  assert.strictEqual(indexLimit({ maxSigsPerFile: 25, maxIndexSigsPerFile: 200 }), 200);
  assert.strictEqual(indexLimit({ maxSigsPerFile: 300, maxIndexSigsPerFile: 200 }), 300);
  assert.strictEqual(indexLimit({ maxSigsPerFile: 2 }), 200, 'lowering the context file alone leaves the index');
  assert.strictEqual(indexLimit({ maxSigsPerFile: 2, maxIndexSigsPerFile: 2 }), 2);
  assert.strictEqual(indexLimit({ maxIndexSigsPerFile: 50 }), 50);
  assert.strictEqual(indexLimit({}), 200);
  assert.strictEqual(indexLimit({ maxSigsPerFile: NaN, maxIndexSigsPerFile: 'x' }), 200);
});

test('the shared pipeline reads the key from the project config', () => {
  const dir = project({ 'src/a.js': fns(3) }, { maxIndexSigsPerFile: 7 });
  assert.strictEqual(entryConfig(dir).maxIndexSigsPerFile, 7);
  assert.strictEqual(entryConfig(dir).maxSigsPerFile, 25);
  assert.strictEqual(entryConfig(project({ 'src/a.js': fns(3) })).maxIndexSigsPerFile, 200);
});

// ── the cap itself ─────────────────────────────────────────────────────────

test('capForIndex cuts at the limit, drops the extractor\'s trailing notice and counts what was left out', () => {
  const sigs = Array.from({ length: 10 }, (_, i) => `def f${i}()`);
  assert.deepStrictEqual(capForIndex(sigs, 10), { sigs, dropped: 0 }, 'at the limit: untouched');
  assert.deepStrictEqual(capForIndex(sigs, 4), { sigs: sigs.slice(0, 4), dropped: 6 });
  const noticed = sigs.concat('… +50 more signatures');
  assert.deepStrictEqual(capForIndex(noticed, 200), { sigs, dropped: 50 }, 'the notice is not a signature');
  assert.deepStrictEqual(capForIndex(noticed, 4), { sigs: sigs.slice(0, 4), dropped: 56 }, 'the notice\'s count and the cut add up');
  const members = ['class A', '  def m()', '… +3 more methods'];
  assert.deepStrictEqual(capForIndex(members, 200), { sigs: members, dropped: 0 }, 'a notice inside a class block is not the file\'s');
  assert.deepStrictEqual(capForIndex([], 5), { sigs: [], dropped: 0 });
});

// ── a full run ─────────────────────────────────────────────────────────────

test('a file with 40 functions: the index holds all 40, the context file the first 25', () => {
  const dir = project({ 'src/big.js': fns(40) });
  generate(dir);
  const sigs = indexOf(dir)['src/big.js'];
  assert.strictEqual(sigs.filter((s) => /^function fn\d+/.test(s)).length, 40, `the index: ${sigs.length}`);
  const ctx = contextOf(dir);
  assert.ok(ctx.includes('function fn24(') && !ctx.includes('function fn25('), 'the context file stops at 25');
});

test('the index limit never changes the context file: byte-identical at 25, 200 and 500', () => {
  const files = { 'src/big.js': fns(60), 'src/small.js': fns(3, 'g') };
  const outputs = [25, 200, 500].map((limit) => {
    const dir = project(files, { maxIndexSigsPerFile: limit });
    generate(dir);
    return contextOf(dir).split(dir).join('<dir>');
  });
  assert.strictEqual(outputs[0], outputs[1]);
  assert.strictEqual(outputs[1], outputs[2]);
});

test('lowering the index limit lowers the index and the one-line summary says what was left out', () => {
  const dir = project({ 'src/big.js': fns(60) }, { maxIndexSigsPerFile: 30 });
  const r = generate(dir);
  assert.strictEqual(indexOf(dir)['src/big.js'].filter((s) => /^function fn/.test(s)).length, 30);
  assert.ok(/\[sigmap\] index: 1 file\(s\) hold more than 30 signatures; 30 not indexed/.test(r.stderr), r.stderr);
});

test('a file past the extractors\' own 200 is cut there, without the extractor\'s notice line, and the summary counts it', () => {
  const dir = project({ 'src/huge.js': fns(230) });
  const r = generate(dir);
  const sigs = indexOf(dir)['src/huge.js'];
  assert.strictEqual(sigs.length, 200);
  assert.ok(!sigs.some((s) => /more signatures/.test(s)), 'no notice line in the index');
  assert.ok(/1 file\(s\) hold more than 200 signatures; 30 not indexed/.test(r.stderr), r.stderr);
});

test('nothing is printed when no file reaches the limit', () => {
  const r = generate(project({ 'src/big.js': fns(60) }));
  assert.ok(!/\[sigmap\] index:/.test(r.stderr), r.stderr);
});

// ── the index is scanned for secrets in full ───────────────────────────────

test('a secret beyond the first 25 signatures is redacted in the index', () => {
  const secret = 'function connect(url = "postgres://admin:hunter2pass@db.internal/app") { return url; }\n';
  const dir = project({ 'src/many.js': fns(60) + secret });
  generate(dir);
  const text = fs.readFileSync(path.join(dir, '.context/sig-index.json'), 'utf8');
  assert.ok(!text.includes('hunter2pass'), 'the secret reached the index');
  assert.ok(indexOf(dir)['src/many.js'].some((s) => /REDACTED/.test(s)), 'and was redacted, not dropped');
});

// ── the signature cache ───────────────────────────────────────────────────

test('a cache entry from before (25 signatures, no ceiling recorded) is not reused; a changed limit needs no new extraction', () => {
  const dir = project({ 'src/big.js': fns(40) }, { sigCache: true, maxIndexSigsPerFile: 30 });
  generate(dir);
  assert.strictEqual(indexOf(dir)['src/big.js'].filter((s) => /^function fn/.test(s)).length, 30);
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'], sigCache: true }));
  generate(dir);
  assert.strictEqual(indexOf(dir)['src/big.js'].filter((s) => /^function fn/.test(s)).length, 40, 'the cache kept the cut, not the list');
  // an entry as the previous version wrote it: the first 25 signatures, no ceiling recorded
  const cachePath = path.join(dir, '.sigmap-cache.json');
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  for (const e of Object.values(cache.entries)) { delete e.cap; e.sigs = e.sigs.slice(0, 25); }
  fs.writeFileSync(cachePath, JSON.stringify(cache));
  generate(dir);
  assert.strictEqual(indexOf(dir)['src/big.js'].filter((s) => /^function fn/.test(s)).length, 40, 'an entry without a ceiling was trusted');
});

test('a warm cache gives the same index and the same context file as a cold one', () => {
  const files = { 'src/big.js': fns(60), 'src/small.js': fns(3, 'g') };
  const dir = project(files, { sigCache: true });
  generate(dir);
  const cold = { index: JSON.stringify(indexOf(dir)), ctx: contextOf(dir) };
  generate(dir);
  assert.strictEqual(JSON.stringify(indexOf(dir)), cold.index);
  assert.strictEqual(contextOf(dir), cold.ctx);
});

// ── the ranker reads what it always read ───────────────────────────────────

const { rank, buildSigIndex } = require('../../src/retrieval/ranker');
const { rankWindow, rankingView } = require('../../src/retrieval/rank-window');
const { buildSymbolSet } = require('../../src/verify/hallucination-guard');

test('rankingView keeps the module-doc lines and the first `limit` other lines, and leaves short files alone', () => {
  const long = ['# module: Rate limiter for the API', ...Array.from({ length: 40 }, (_, i) => `function f${i}()`)];
  const short = ['# module: tiny', 'function a()'];
  const index = new Map([['long.js', long], ['short.js', short]]);
  const view = rankingView(index, 25);
  assert.strictEqual(view.get('long.js').length, 26);
  assert.strictEqual(view.get('long.js')[0], '# module: Rate limiter for the API');
  assert.strictEqual(view.get('long.js')[25], 'function f24()');
  assert.strictEqual(view.get('short.js'), short, 'a file within the limit keeps the very array');
  assert.strictEqual(index.get('long.js').length, 41, 'the index passed in is not changed');
  assert.strictEqual(rankingView(new Map([['short.js', short]]), 25).get('short.js'), short);
  const untouched = new Map([['short.js', short]]);
  assert.strictEqual(rankingView(untouched, 25), untouched, 'nothing to cut: the same Map');
});

test('rankWindow follows maxSigsPerFile of the project, an explicit option first, 25 by default', () => {
  assert.strictEqual(rankWindow({}), 25);
  assert.strictEqual(rankWindow(undefined), 25);
  assert.strictEqual(rankWindow({ rankSigsPerFile: 7 }), 7);
  const dir = project({ 'src/a.js': fns(3) }, { maxSigsPerFile: 11 });
  assert.strictEqual(rankWindow({ cwd: dir }), 11);
  assert.strictEqual(rankWindow({ cwd: dir, rankSigsPerFile: 9 }), 9);
});

test('a word that appears only past the ranker\'s window changes no score and no order', () => {
  const body = (extra) => Array.from({ length: 30 }, (_, i) => `function helper${i}()`).concat(extra);
  const a = new Map([
    ['src/a.js', body(['function quarantineEverything()'])],
    ['src/b.js', ['function helper0()', 'function helper1()']],
  ]);
  const b = new Map([
    ['src/a.js', body(['function somethingElseEntirely()'])],
    ['src/b.js', ['function helper0()', 'function helper1()']],
  ]);
  const opts = { learned: false };
  const ra = rank('quarantine everything helper', a, opts).map((r) => [r.file, r.score]);
  const rb = rank('quarantine everything helper', b, opts).map((r) => [r.file, r.score]);
  assert.deepStrictEqual(ra, rb);
  const near = new Map([['src/a.js', Array.from({ length: 5 }, (_, i) => `function helper${i}()`).concat('function quarantineEverything()')]]);
  assert.ok(rank('quarantine everything', near, opts).length === 1 && rank('quarantine everything', near, opts)[0].score > 0, 'inside the window it counts');
});

test('what the ranker does not read, a symbol lookup still sees: the 40th function is in the symbol set', () => {
  const dir = project({ 'src/big.js': fns(40) });
  generate(dir);
  assert.ok(buildSymbolSet(dir).set.has('fn39'), 'verify can see it');
  assert.ok(buildSymbolSet(dir).set.has('fn30'));
  const idx = buildSigIndex(dir);
  assert.ok(idx.get('src/big.js').length > 25, 'the index holds more than the ranker reads');
  const r = rank('fn39', idx, { cwd: dir, learned: false });
  assert.ok(r.every((x) => x.sigs.length <= 26), 'ranked entries carry what the ranker read');
});

// ── the Python AST tier no longer stops at 30 ──────────────────────────────

const havePython = spawnSync('python3', ['--version']).status === 0;
if (havePython) {
  const py = require('../../src/extractors/python');
  const pyFile = (name, text) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-idxlimit-py-'));
    tmpDirs.push(dir);
    const f = path.join(dir, name);
    fs.writeFileSync(f, text);
    return f;
  };

  test('python AST tier: a class\'s methods behind 30 constants are listed (they were cut at 30 without a word)', () => {
    const src = `class Big:\n${Array.from({ length: 30 }, (_, i) => `    CONST_${i} = ${i}\n`).join('')}    def run(self): pass\n    def stop(self): pass\n`;
    const sigs = py.tryNativeExtract(pyFile('big.py', src));
    assert.ok(sigs.some((s) => /def run/.test(s)) && sigs.some((s) => /def stop/.test(s)), JSON.stringify(sigs.slice(-3)));
  });

  test('python AST tier: a class that comes after 40 functions is in the index (it was cut at 30, and at 25 in every file)', () => {
    const src = `${Array.from({ length: 40 }, (_, i) => `def f${i}(): pass\n`).join('')}class Later:\n    def run(self): pass\n`;
    const dir = project({ 'src/later.py': src });
    generate(dir);
    const sigs = indexOf(dir)['src/later.py'];
    assert.ok(sigs.some((x) => /^class Later/.test(x)) && sigs.some((x) => /def run/.test(x)), JSON.stringify(sigs.slice(-3)));
    assert.ok(!contextOf(dir).includes('class Later'), 'the context file keeps its first 25');
  });

  test('python AST tier: past 200 it ends with the same notice the regex tier writes, with the exact count', () => {
    const src = Array.from({ length: 260 }, (_, i) => `def f${i}(): pass\n`).join('');
    const sigs = py.tryNativeExtract(pyFile('many.py', src));
    assert.strictEqual(sigs.length, 201);
    assert.strictEqual(sigs[200], '… +60 more signatures');
    const regex = py.extract(src);
    assert.strictEqual(regex[regex.length - 1], '… +60 more signatures', 'both tiers speak the same way');
  });

  test('python AST tier: the first 25 signatures are what they were, so the context file does not move', () => {
    const src = `class A:\n    X = 1\n${Array.from({ length: 40 }, (_, i) => `    def m${i}(self): pass\n`).join('')}def top(): pass\n`;
    const sigs = py.tryNativeExtract(pyFile('order.py', src));
    assert.strictEqual(sigs[0].split(/\s+/)[0], 'class');
    assert.ok(/X\s*=\s*1/.test(sigs[1]) && /def m0/.test(sigs[2]) && /def m22/.test(sigs[24]), JSON.stringify(sigs.slice(0, 3)));
  });
} else {
  console.log('  SKIP  python AST tier cases (python3 is not installed)');
}

for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
console.log(`\nindex-limit: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
