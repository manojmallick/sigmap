'use strict';

/**
 * The retrieval index has its own per-file signature limit (#982).
 *
 * `maxSigsPerFile` (25) is a token budget for the GENERATED CONTEXT FILE. The index
 * (.context/sig-index.json) feeds `ask`, `verify`, `explain` and the MCP search tools
 * and is never injected into a prompt, yet it used to inherit the 25: on Django it held
 * 57-76% of the public symbols, and a file with 40 top-level functions hid every class
 * that came after them. `maxIndexSigsPerFile` (200) now governs what the index keeps. The
 * index file holds two lists per file: `files`, what the ranker, `ask` and the tools that
 * list a file have always read (the first `maxSigsPerFile`, exactly as before), and `more`,
 * the rest, for the tools that look a symbol up (`verify`, `get_callee_signatures`). The
 * context file is byte-identical to what it was.
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
const { entryConfig, indexLimit, capForIndex, splitForIndex } = require('../../src/cache/entry');

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
const rawIndex = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.context/sig-index.json'), 'utf8'));
/** What the ranker reads of each file: the index file's `files`. */
const indexOf = (dir) => rawIndex(dir).files;
/** Everything the index keeps of each file: `files` and `more` together, as `verify` reads it. */
const everythingOf = (dir) => {
  const raw = rawIndex(dir);
  return Object.fromEntries(Object.entries(raw.files).map(([rel, sigs]) => [rel, sigs.concat((raw.more || {})[rel] || [])]));
};
const nameCount = (sigs, re) => sigs.filter((x) => re.test(x)).length;
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

test('a file with 40 functions: the index keeps all 40, the ranker reads the first 25, the context file the same 25', () => {
  const dir = project({ 'src/big.js': fns(40) });
  generate(dir);
  assert.strictEqual(nameCount(everythingOf(dir)['src/big.js'], /^function fn\d+/), 40, 'the index keeps all of them');
  const read = indexOf(dir)['src/big.js'];
  assert.strictEqual(nameCount(read, /^function fn\d+/), 25, `what the ranker reads is what it always read: ${read.length}`);
  assert.strictEqual(nameCount(rawIndex(dir).more['src/big.js'], /^function fn\d+/), 15);
  const ctx = contextOf(dir);
  assert.ok(ctx.includes('function fn24(') && !ctx.includes('function fn25('), 'the context file stops at 25');
});

test('the index file\'s `files` do not depend on the index limit, nor on anything past the context limit', () => {
  const a = project({ 'src/big.js': fns(40) });
  const b = project({ 'src/big.js': fns(25) + Array.from({ length: 15 }, (_, i) => `function other${i}() {}\n`).join('') }, { maxIndexSigsPerFile: 25 });
  generate(a);
  generate(b);
  assert.deepStrictEqual(indexOf(a)['src/big.js'], indexOf(b)['src/big.js'].map((x) => x), 'the first 25 are the first 25, whatever follows and whatever the limit');
  assert.strictEqual(rawIndex(b).more, undefined, 'at a limit of 25 nothing is kept apart');
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

test('lowering the index limit lowers what the index keeps and the one-line summary says what was left out', () => {
  const dir = project({ 'src/big.js': fns(60) }, { maxIndexSigsPerFile: 30 });
  const r = generate(dir);
  assert.strictEqual(nameCount(everythingOf(dir)['src/big.js'], /^function fn/), 30);
  assert.ok(/\[sigmap\] index: 1 file\(s\) hold more signatures than the index keeps; 30 not indexed \(maxIndexSigsPerFile is 30;/.test(r.stderr), r.stderr);
});

test('a file past the extractors\' own 200 is cut there, without the extractor\'s notice line, and the summary counts it', () => {
  const dir = project({ 'src/huge.js': fns(230) });
  const r = generate(dir);
  const sigs = everythingOf(dir)['src/huge.js'];
  assert.strictEqual(sigs.length, 200);
  assert.ok(!sigs.some((s) => /more signatures/.test(s)), 'no notice line in the index');
  assert.ok(/1 file\(s\) hold more signatures than the index keeps; 30 not indexed/.test(r.stderr), r.stderr);
});

test('a file the extractor ends with another file-level notice (headings, keys, entries) has it dropped and counted too', () => {
  for (const label of ['signatures', 'headings', 'keys', 'entries']) {
    const sigs = Array.from({ length: 5 }, (_, i) => `# h${i}`).concat(`… +60 more ${label}`);
    assert.deepStrictEqual(capForIndex(sigs, 200), { sigs: sigs.slice(0, 5), dropped: 60 }, label);
  }
  assert.deepStrictEqual(capForIndex(['class A', '… +3 more methods'], 200).dropped, 0, 'a class block\'s notice is not the file\'s');
});

test('a context limit of 0 keeps no file, as it always did', () => {
  const dir = project({ 'src/a.js': fns(3) }, { maxSigsPerFile: 0 });
  generate(dir);
  assert.deepStrictEqual(Object.keys(indexOf(dir)), []);
  assert.ok(!/## src/.test(contextOf(dir)), 'no empty section');
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
  assert.ok(everythingOf(dir)['src/many.js'].some((s) => /REDACTED/.test(s)), 'and was redacted, not dropped');
  assert.ok(rawIndex(dir).more['src/many.js'].some((s) => /REDACTED/.test(s)), 'in what is kept apart');
});

// ── the signature cache ───────────────────────────────────────────────────

test('a cache entry is reused when it carries the ceiling and not when it does not; a changed limit needs no new extraction', () => {
  const dir = project({ 'src/big.js': fns(40) }, { sigCache: true, maxIndexSigsPerFile: 30 });
  generate(dir);
  assert.strictEqual(nameCount(everythingOf(dir)['src/big.js'], /^function fn/), 30);
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'], sigCache: true }));
  generate(dir);
  assert.strictEqual(nameCount(everythingOf(dir)['src/big.js'], /^function fn/), 40, 'the cache kept the cut, not the list');
  // the cache is used: an entry that carries the ceiling is served in place of the file
  const cachePath = path.join(dir, '.sigmap-cache.json');
  let cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  for (const e of Object.values(cache.entries)) e.sigs = ['function fromTheCache()  :1-1'];
  fs.writeFileSync(cachePath, JSON.stringify(cache));
  generate(dir);
  assert.deepStrictEqual(everythingOf(dir)['src/big.js'].map((x) => x.replace(/\s+:.*/, '')).filter((x) => /fromTheCache/.test(x)), ['function fromTheCache()'], 'the cache was not used');
  // an entry as the previous version wrote it carries no ceiling and is not trusted
  cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  for (const e of Object.values(cache.entries)) { delete e.cap; e.sigs = ['function fromTheCache()  :1-1']; }
  fs.writeFileSync(cachePath, JSON.stringify(cache));
  generate(dir);
  assert.strictEqual(nameCount(everythingOf(dir)['src/big.js'], /fromTheCache/), 0, 'an entry without a ceiling was trusted');
  assert.strictEqual(nameCount(everythingOf(dir)['src/big.js'], /^function fn/), 40);
});

test('a warm cache gives the same index and the same context file as a cold one', () => {
  const files = { 'src/big.js': fns(60), 'src/small.js': fns(3, 'g') };
  const dir = project(files, { sigCache: true });
  generate(dir);
  const cold = { index: JSON.stringify(everythingOf(dir)), ctx: contextOf(dir) };
  generate(dir);
  assert.strictEqual(JSON.stringify(everythingOf(dir)), cold.index);
  assert.strictEqual(contextOf(dir), cold.ctx);
});

// ── who reads what ─────────────────────────────────────────────────────────

const { rank, buildSigIndex } = require('../../src/retrieval/ranker');
const { buildSymbolSet } = require('../../src/verify/hallucination-guard');
const handlers = require('../../src/mcp/handlers');

test('buildSigIndex reads what it always read; { full: true } adds the rest', () => {
  const dir = project({ 'src/big.js': fns(40) });
  generate(dir);
  const read = buildSigIndex(dir).get('src/big.js');
  const everything = buildSigIndex(dir, { full: true }).get('src/big.js');
  assert.strictEqual(nameCount(read, /^function fn\d+/), 25);
  assert.strictEqual(nameCount(everything, /^function fn\d+/), 40);
  assert.deepStrictEqual(everything.slice(0, read.length), read, 'the rest follows what the ranker reads');
});

test('ranking is untouched by what is kept apart: a word past the context limit scores nothing', () => {
  const dir = project({ 'src/big.js': fns(40) + 'function quarantineEverything() {}\n', 'src/other.js': fns(3, 'x') });
  generate(dir);
  assert.ok(rank('quarantine everything', buildSigIndex(dir), { learned: false }).every((r) => r.file !== 'src/big.js' || r.score === 0 || !/quarantine/i.test(r.sigs.join(' '))),
    'the ranker must not see a signature past the context limit');
  assert.ok(!buildSigIndex(dir).get('src/big.js').some((x) => /quarantine/.test(x)));
  assert.ok(buildSigIndex(dir, { full: true }).get('src/big.js').some((x) => /quarantine/.test(x)));
});

test('verify and get_callee_signatures see a symbol past what the ranker reads', () => {
  const dir = project({ 'src/big.js': fns(40) });
  generate(dir);
  assert.ok(buildSymbolSet(dir).set.has('fn39'), 'verify can see it');
  assert.ok(buildSymbolSet(dir).set.has('fn30'));
  const out = handlers.getCalleeSignatures({ symbols: ['fn39'] }, dir);
  assert.ok(/function fn39/.test(out), out);
});

test('a symbol added live is read by the ranker even in a file with more than 25 signatures', () => {
  const dir = project({ 'src/routes.js': fns(40) });
  generate(dir);
  handlers.notifySymbolAdded({ signature: 'function brandNewQuokkaFeature(x)', file: 'src/routes.js' }, dir);
  const r = rank('quokka feature', buildSigIndex(dir), { learned: false, cwd: dir });
  assert.ok(r.length > 0 && r[0].file === 'src/routes.js', JSON.stringify(r.map((x) => x.file)));
});

test('a live entry for a file past the context limit carries the rest apart, like a full run', () => {
  const dir = project({ 'src/big.js': fns(40) });
  generate(dir);
  fs.writeFileSync(path.join(dir, 'src/big.js'), fns(60));
  handlers.notifyFileCreated({ path: 'src/big.js' }, dir);
  assert.strictEqual(nameCount(buildSigIndex(dir).get('src/big.js'), /^function fn\d+/), 25);
  assert.strictEqual(nameCount(buildSigIndex(dir, { full: true }).get('src/big.js'), /^function fn\d+/), 60);
  generate(dir);
  assert.strictEqual(nameCount(buildSigIndex(dir, { full: true }).get('src/big.js'), /^function fn\d+/), 60, 'a full run agrees');
});

test('test and pipeline files are read by the ranker as before: whole, up to the extractors\' own limit', () => {
  const dir = project({ 'src/a.js': fns(2), 'tests/big.test.js': fns(40, 'helper') });
  generate(dir);
  assert.strictEqual(nameCount(indexOf(dir)['tests/big.test.js'] || [], /^function helper\d+/), 40);
});

test('a symbol the sig cache holds past the context limit does not outrank the index file\'s entry', () => {
  const dir = project({ 'src/big.js': fns(40) }, { sigCache: true });
  generate(dir);
  const read = buildSigIndex(dir).get('src/big.js');
  assert.ok(read.length <= 26, `the cache (raw, up to 1000) must not replace the entry the index file holds: ${read.length}`);
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
    const sigs = everythingOf(dir)['src/later.py'];
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
