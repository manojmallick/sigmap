'use strict';

/**
 * Extraction recall harness (#983): `scripts/run-extraction-recall.mjs`, its adapters and
 * its arithmetic in `scripts/lib/extraction-recall.mjs`.
 *
 * The harness asks a language's own parser what each file defines and counts how many of
 * those names SigMap lists. What is pinned here is the part that has to be right for the
 * numbers to mean anything: a name counts once, private names are skipped on both sides, a
 * floor can neither pass by absence nor be compared with a run on a different reference
 * version, every language is accounted for, and the published page says what the saved
 * report says. The two end-to-end cases run the real adapters over a few lines of Python
 * and Ruby, and skip (loudly) where the interpreter is not installed.
 *
 * Run: node test/integration/extraction-recall.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const RUNNER = path.join(ROOT, 'scripts/run-extraction-recall.mjs');

let passed = 0;
let failed = 0;
let skipped = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  PASS  ${name}`); passed++; })
    .catch((err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; });
}
function skip(name, why) {
  console.log(`  SKIP  ${name} (${why})`);
  skipped++;
}

const have = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return !r.error && r.status === 0; };
const tmpDirs = [];
function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
const run = (args) => spawnSync(process.execPath, [RUNNER, ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });

(async () => {
  const lib = await import('../../scripts/lib/extraction-recall.mjs');
  const py = await import('../../scripts/extraction-recall/python.mjs');
  const rb = await import('../../scripts/extraction-recall/ruby.mjs');
  const runner = await import('../../scripts/run-extraction-recall.mjs');

  // ── the arithmetic ────────────────────────────────────────────────────────

  await test('python: what the extractors omit on purpose is left out of the comparison, and nothing else', () => {
    for (const [kind, n] of [['func', '_x'], ['method', 'A._x'], ['method', 'A.__eq__'], ['method', 'A.__call__'], ['func', '__main__']]) assert.strictEqual(py.isOmitted(kind, n), true, `${kind} ${n}`);
    for (const [kind, n] of [['method', 'A.__init__'], ['method', 'A.run'], ['func', 'run_'], ['func', 'a_b'], ['class', 'Public'], ['class', '_Hidden'], ['class', '__Mangled']]) assert.strictEqual(py.isOmitted(kind, n), false, `${kind} ${n}`);
  });

  await test('recall is rounded to one decimal and is null, not 0 or NaN, with nothing to find', () => {
    assert.strictEqual(lib.pct(2, 3), 66.7);
    assert.strictEqual(lib.pct(1, 3), 33.3);
    assert.strictEqual(lib.pct(944, 944), 100);
    assert.strictEqual(lib.pct(0, 0), null);
  });

  await test('a tally counts hits and misses, keeps the first MISS_CAP misses and still counts the rest', () => {
    const t = lib.newTally(['func']);
    for (let i = 0; i < lib.MISS_CAP + 10; i++) lib.record(t, 'func', false, `m${i}`);
    lib.record(t, 'func', true, 'ok');
    lib.skip(t, 'func');
    const [row] = lib.rowsOf(t);
    assert.deepStrictEqual({ r: row.reference, f: row.found, s: row.skipped, m: row.missed }, { r: lib.MISS_CAP + 11, f: 1, s: 1, m: lib.MISS_CAP + 10 });
    assert.strictEqual(lib.missesOf(t).func.length, lib.MISS_CAP);
    assert.strictEqual(lib.missesOf(t).func[0], 'm0');
  });

  // ── floors ────────────────────────────────────────────────────────────────

  const spec = { references: [{ match: '3.', floors: { pop: { class: 90, func: 80 } } }, { match: '2.6', floors: { pop: { class: 50 } } }] };
  const measured = (version, rows, extra = {}) => ({
    measured: true, reference: { name: 'x', version },
    populations: { pop: { label: 'p', filesCompared: 1, rows: rows.map(([kind, recall]) => ({ kind, recall, reference: 10, found: 9, skipped: 0, missed: 1 })), misses: {} } },
    ...extra,
  });

  await test('the floors that apply are those of the first matching version prefix', () => {
    assert.strictEqual(lib.floorsFor(spec, '3.12.3').match, '3.');
    assert.strictEqual(lib.floorsFor(spec, '2.6.10').match, '2.6');
    assert.strictEqual(lib.floorsFor(spec, '2.7.8'), null);
    assert.strictEqual(lib.floorsFor(spec, '3'), null, 'a bare "3" is not under "3."');
    assert.strictEqual(lib.floorsFor(spec, '13.0'), null, 'a prefix, not a substring');
    assert.strictEqual(lib.floorsFor(spec, '2.3.1'), null, 'a prefix, not a substring');
    assert.strictEqual(lib.floorsFor(spec, null), null);
  });

  await test('a recall at the floor passes and one point of a percent below it fails', () => {
    assert.strictEqual(lib.evaluate(measured('3.9.6', [['class', 90], ['func', 80]]), spec).status, 'pass');
    const v = lib.evaluate(measured('3.9.6', [['class', 89.9], ['func', 95]]), spec);
    assert.strictEqual(v.status, 'fail');
    assert.deepStrictEqual(v.checks.filter((c) => c.status === 'fail').map((c) => c.kind), ['class']);
  });

  await test('a floor is never compared with a run on a version it was not recorded for', () => {
    const v = lib.evaluate(measured('2.7.8', [['class', 1], ['func', 1]]), spec);
    assert.strictEqual(v.status, 'not-enforced');
    assert.deepStrictEqual(v.checks, []);
    assert.ok(/3\., 2\.6/.test(v.note) && /2\.7\.8/.test(v.note), v.note);
  });

  await test('a floor cannot pass by absence: a missing population or kind fails, a population not requested is skipped', () => {
    const noKind = lib.evaluate(measured('3.9.6', [['class', 99]]), spec);
    assert.strictEqual(noKind.status, 'fail');
    assert.strictEqual(noKind.checks.find((c) => c.kind === 'func').recall, null);
    const noPop = measured('3.9.6', []);
    delete noPop.populations.pop;
    assert.strictEqual(lib.evaluate(noPop, spec).status, 'fail');
    const asked = lib.evaluate({ ...noPop, notRun: ['pop'] }, spec);
    assert.strictEqual(asked.status, 'pass');
    assert.ok(asked.checks.every((c) => c.status === 'skipped'));
  });

  await test('an unmeasured language and a language with no floors are reported, not passed off as measured', () => {
    assert.strictEqual(lib.evaluate({ measured: false, reason: 'ruby is not on PATH' }, spec).status, 'unmeasured');
    assert.strictEqual(lib.evaluate({ measured: false, reason: 'r' }, spec).note, 'r');
    assert.strictEqual(lib.evaluate(measured('3.9.6', [['class', 100]]), undefined).status, 'unfloored');
  });

  // ── Python: reading signature lines, scoring a file ──────────────────────

  await test('python signature lines are read as classes, functions, and methods of the class above', () => {
    const got = py.parseSigs([
      'class A(Base)  :1-9', '  def run(self) → None', '  async def go()', '@dataclass Point(x, y)  :11-12',
      'def top(a) → int  :14-15', 'async def fetch()', '  def stray()',
      'class B  :20-30', '  def only()', '… +14 more signatures',
    ]);
    assert.deepStrictEqual([...got.class].sort(), ['A', 'B', 'Point']);
    assert.deepStrictEqual([...got.func].sort(), ['fetch', 'top']);
    assert.deepStrictEqual([...got.method].sort(), ['A.go', 'A.run', 'B.only']);
  });

  await test('python: a name counts once per file; omitted names are skipped; __init__ and underscore classes count; a miss says where', () => {
    const t = lib.newTally(['class', 'func', 'method']);
    const got = py.parseSigs(['class A', '  def run()']);
    py.compareFile(
      t,
      [['class', 'A'], ['class', '_Hidden'], ['method', 'A.run'], ['method', 'A.run'], ['method', 'A.save'], ['method', 'A.__init__'], ['method', 'A.__eq__'], ['method', 'A._x'], ['func', '_hidden'], ['func', 'helper']],
      got, 'flask/src/flask/a.py',
    );
    const rows = Object.fromEntries(lib.rowsOf(t).map((r) => [r.kind, r]));
    assert.deepStrictEqual([rows.class.reference, rows.class.found, rows.class.skipped], [2, 1, 0], 'an underscore class is a reference symbol');
    assert.deepStrictEqual([rows.method.reference, rows.method.found, rows.method.skipped], [3, 1, 2], 'run twice is one name; __init__ counts; __eq__ and _x are skipped');
    assert.deepStrictEqual([rows.func.reference, rows.func.found, rows.func.skipped], [1, 0, 1]);
    assert.deepStrictEqual(lib.missesOf(t).method, ['flask/src/flask/a.py :: A.save', 'flask/src/flask/a.py :: A.__init__']);
    assert.deepStrictEqual(lib.missesOf(t).class, ['flask/src/flask/a.py :: _Hidden']);
  });

  // ── Ruby: scoring a file ──────────────────────────────────────────────────

  const rubyTruth = [['module', 'Sidekiq'], ['class', 'Worker'], ['method', 'Worker#perform'], ['method', 'Worker.build'], ['method', 'Worker#_hidden'], ['class', 'Top'], ['method', 'Top#run']];
  const rubyTally = () => lib.newTally(rb.KINDS);
  const rubyRows = (t) => Object.fromEntries(lib.rowsOf(t).map((r) => [r.kind, `${r.found}/${r.reference}`]));

  await test('ruby: a method listed under the wrong class is found by name and missed by owner', () => {
    const t = rubyTally();
    rb.compareFile(t, rubyTruth, ['module Sidekiq', '  class Worker', '    def perform', '    def self.build', 'class Top', '  def perform'], 'x.rb');
    // Top#run is not listed anywhere; Worker's two are under Worker; the extra `perform` under Top is not asked for
    assert.deepStrictEqual(rubyRows(t), { class: '2/2', module: '1/1', method: '2/3', owner: '2/3' });
    const wrongOwner = rubyTally();
    rb.compareFile(wrongOwner, [['class', 'A'], ['class', 'B'], ['method', 'B#save']], ['class A', '  def save', 'class B'], 'x.rb');
    assert.deepStrictEqual(rubyRows(wrongOwner), { class: '2/2', module: '0/0', method: '1/1', owner: '0/1' });
  });

  await test('ruby: a private method is skipped, and a method listed twice is still one owner hit per definition', () => {
    const t = rubyTally();
    rb.compareFile(t, [['class', 'A'], ['method', 'A#_x'], ['method', 'A#a'], ['method', 'A#a']], ['class A', '  def a', '  def a'], 'x.rb');
    assert.deepStrictEqual(rubyRows(t), { class: '1/1', module: '0/0', method: '2/2', owner: '2/2' });
    assert.strictEqual(t.method.skipped, 1);
    const once = rubyTally();
    rb.compareFile(once, [['class', 'A'], ['method', 'A#a'], ['method', 'A#a']], ['class A', '  def a'], 'x.rb');
    assert.strictEqual(rubyRows(once).owner, '1/2');
  });

  // ── the runner ────────────────────────────────────────────────────────────

  await test('every extractor language is either measured or listed as unmeasured, none omitted', () => {
    const { LANGUAGES } = require('../../src/extractors/dispatch');
    const empty = tmp('sigmap-recall-empty-');
    const r = run(['--repos', empty, '--json']);
    assert.strictEqual(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    const accounted = new Set([...Object.keys(out.languages), ...Object.keys(out.unmeasured)]);
    assert.deepStrictEqual([...accounted].sort(), [...LANGUAGES].sort());
    assert.deepStrictEqual(Object.keys(out.languages).sort(), [...runner.ADAPTERS].sort());
    for (const reason of Object.values(out.unmeasured)) assert.ok(reason);
  });

  await test('without clones every language is unmeasured: the run exits 0, and exits 1 only with --require-reference', () => {
    const empty = tmp('sigmap-recall-empty-');
    const plain = run(['--repos', empty, '--gate']);
    assert.strictEqual(plain.status, 0, plain.stderr);
    assert.ok(/python: unmeasured/.test(plain.stdout) && /ruby: unmeasured/.test(plain.stdout), plain.stdout);
    assert.ok(/unmeasured \(\d+\): .*javascript/.test(plain.stdout), plain.stdout);
    const strict = run(['--repos', empty, '--gate', '--require-reference']);
    assert.strictEqual(strict.status, 1);
    assert.ok(/python: unmeasured/.test(strict.stderr) && /ruby: unmeasured/.test(strict.stderr), strict.stderr);
  });

  await test('a partial or unmeasured run is never saved over the report', () => {
    const empty = tmp('sigmap-recall-empty-');
    const out = path.join(tmp('sigmap-recall-out-'), 'report.json');
    const r = run(['--repos', empty, '--save', '--out', out]);
    assert.strictEqual(r.status, 1);
    assert.ok(/not saved/.test(r.stderr), r.stderr);
    assert.strictEqual(fs.existsSync(out), false, 'an unmeasured run wrote a report');
    const partial = run(['--repos', empty, '--only', 'python', '--save', '--out', out]);
    assert.strictEqual(partial.status, 1);
    assert.strictEqual(fs.existsSync(out), false, 'a partial run wrote a report');
  });

  // ── end to end, over a few real lines ─────────────────────────────────────

  const PY_SRC = [
    'class App:', '    def __init__(self): pass', '    def run(self): pass', '    def _private(self): pass', '    def __eq__(self, o): pass', '    def handle(self): pass', '',
    'class _Hidden: pass', '',
    'def helper(): pass', 'async def fetch(): pass', 'def _hidden(): pass', '',
  ].join('\n');
  // 30 class-level constants ahead of the methods: the AST tier lists constants before methods and
  // stops at 30 signatures, so none of the three methods reaches the index; the regex tier lists them
  const PY_CONSTS = `class Big:\n${Array.from({ length: 30 }, (_, i) => `    CONST_${i} = ${i}\n`).join('')}    def __init__(self): pass\n    def run(self): pass\n    def stop(self): pass\n`;
  const floorsFile2 = (languages) => {
    const f = path.join(tmp('sigmap-recall-floors-'), 'floors.json');
    put(f, JSON.stringify({ languages }));
    return f;
  };
  const pyFloors = (n, match = '3.', pops = { 'extractor-regex': ['class', 'func', 'method'] }) => floorsFile2({
    python: { references: [{ match, floors: Object.fromEntries(Object.entries(pops).map(([pop, kinds]) => [pop, Object.fromEntries(kinds.map((k) => [k, n]))])) }] },
  });
  const cells = (rows) => rows.map((x) => `${x.kind} ${x.found}/${x.reference}`);

  if (have('python3', ['--version'])) {
    await test('python end to end: the real parser against an extractor that finds only some names', () => {
      const repos = tmp('sigmap-recall-py-');
      put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
      // directories the file set leaves out: tests, migrations, locale
      put(path.join(repos, 'flask/src/flask/tests/test_x.py'), 'class InTests:\n    def go(self): pass\n');
      put(path.join(repos, 'flask/src/flask/migrations/0001.py'), 'class InMigrations: pass\n');
      put(path.join(repos, 'flask/src/flask/locale/x.py'), 'class InLocale: pass\n');
      const extractor = path.join(tmp('sigmap-recall-ext-'), 'partial.js');
      put(extractor, `module.exports = {
        extract: () => ['class App  :1-6', '  def __init__()', '  def run()', 'def helper()'],
        prefetch: () => {},
        tryNativeExtract: () => ['class App  :1-6', '  def run()', '  def handle()', 'async def fetch()', 'class _Hidden'],
      };`);
      const r = py.measure({ reposDir: repos, extractorPath: extractor, index: false });
      assert.strictEqual(r.measured, true);
      assert.ok(/^3\./.test(r.reference.version), r.reference.version);
      const regex = r.populations['extractor-regex'];
      assert.strictEqual(regex.filesCompared, 1, 'tests, migrations and locale directories are not compared');
      assert.deepStrictEqual(cells(regex.rows), ['class 1/2', 'func 1/2', 'method 2/3']);
      assert.deepStrictEqual(regex.misses, { class: ['flask/src/flask/app.py :: _Hidden'], func: ['flask/src/flask/app.py :: fetch'], method: ['flask/src/flask/app.py :: App.handle'] });
      const ast = r.populations['extractor-ast'];
      assert.deepStrictEqual(cells(ast.rows), ['class 2/2', 'func 1/2', 'method 2/3']);
      assert.deepStrictEqual(ast.misses.method, ['flask/src/flask/app.py :: App.__init__'], '__init__ is a reference symbol');
      assert.deepStrictEqual(r.notRun, ['index-regex', 'index-ast']);
    });

    await test('python end to end with the real extractor: the shipped extractor finds every name of the fixture it lists on purpose', () => {
      const repos = tmp('sigmap-recall-py-');
      put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
      const r = py.measure({ reposDir: repos, index: false });
      for (const id of ['extractor-regex', 'extractor-ast']) {
        assert.deepStrictEqual(cells(r.populations[id].rows), ['class 2/2', 'func 2/2', 'method 3/3'], id);
        assert.deepStrictEqual(r.populations[id].rows.map((x) => x.skipped), [0, 1, 2], id);
      }
    });

    await test('python end to end: the index is built per tier, scored over the files it holds, with the files it lacks counted apart', () => {
      const repos = tmp('sigmap-recall-py-');
      put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
      put(path.join(repos, 'flask/src/flask/big.py'), PY_CONSTS);
      put(path.join(repos, 'flask/src/flask/skipme.py'), 'class Skipped:\n    def go(self): pass\n');
      put(path.join(repos, 'flask/.contextignore'), 'src/flask/skipme.py\n');
      const r = py.measure({ reposDir: repos });
      const regex = r.populations['index-regex'];
      const ast = r.populations['index-ast'];
      assert.deepStrictEqual([regex.filesCompared, regex.filesTotal, ast.filesCompared, ast.filesTotal], [2, 3, 2, 3]);
      assert.deepStrictEqual(cells(regex.rows), ['class 3/3', 'func 2/2', 'method 6/6'], 'the regex tier lists the methods behind the constants');
      assert.deepStrictEqual(cells(ast.rows), ['class 3/3', 'func 2/2', 'method 3/6'], 'the AST tier has spent its signatures on constants: this fails if the two tiers are swapped');
      assert.deepStrictEqual(cells(regex.rowsAllFiles), ['class 3/4', 'func 2/2', 'method 6/7'], 'the file the index lacks counts as all missed');
      assert.strictEqual(fs.existsSync(path.join(repos, 'flask/.context')), false, 'the checkout was left as it was found');
    });

    await test('the runner gates: exit 1 below a floor, 0 at it, and 0 below it when only reporting', () => {
      const repos = tmp('sigmap-recall-py-');
      put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
      const base = ['--repos', repos, '--only', 'python', '--no-index'];
      const at = run([...base, '--floors', pyFloors(100), '--gate']);
      assert.strictEqual(at.status, 0, at.stdout + at.stderr);
      assert.ok(/floor 100%/.test(at.stdout), at.stdout);
      const over = run([...base, '--floors', pyFloors(101), '--gate']);
      assert.strictEqual(over.status, 1, over.stdout);
      assert.ok(/python: below a floor — extractor-regex\/class 100% < 101%/.test(over.stderr), over.stderr);
      assert.strictEqual(run([...base, '--floors', pyFloors(101)]).status, 0, 'without --gate a run only reports');
      assert.strictEqual(run([...base, '--floors', pyFloors(101), '--require-reference']).status, 1, '--require-reference is a stricter --gate, not an add-on to it');
    });

    await test('--require-reference fails a reference it cannot use: no floors for this version, a language left out, a population not run', () => {
      const repos = tmp('sigmap-recall-py-');
      put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
      const base = ['--repos', repos, '--only', 'python', '--no-index'];
      const wrongVersion = pyFloors(50, '9.');
      assert.strictEqual(run([...base, '--floors', wrongVersion, '--gate']).status, 0, 'a gate alone reports "not enforced" and passes');
      const strict = run([...base, '--floors', wrongVersion, '--require-reference']);
      assert.strictEqual(strict.status, 1);
      assert.ok(/python: not-enforced/.test(strict.stderr), strict.stderr);
      const rubyToo = floorsFile2({
        python: { references: [{ match: '3.', floors: { 'extractor-regex': { class: 1 } } }] },
        ruby: { references: [{ match: '2.', floors: { extractor: { class: 1 } } }, { match: '3.', floors: { extractor: { class: 1 } } }] },
      });
      const left = run([...base, '--floors', rubyToo, '--require-reference']);
      assert.strictEqual(left.status, 1);
      assert.ok(/ruby: not measured \(left out by --only\)/.test(left.stderr), left.stderr);
      const indexFloor = pyFloors(1, '3.', { 'index-regex': ['class'] });
      const notRun = run([...base, '--floors', indexFloor, '--require-reference']);
      assert.strictEqual(notRun.status, 1);
      assert.ok(/floored population was not run/.test(notRun.stderr), notRun.stderr);
      assert.strictEqual(run([...base, '--floors', indexFloor, '--gate']).status, 0, 'a gate alone skips a population that was not asked for');
    });

    await test('an unknown language in --only is an error, not an empty pass', () => {
      const r = run(['--only', 'nonsense', '--gate', '--require-reference']);
      assert.strictEqual(r.status, 1);
      assert.ok(/unknown language: nonsense/.test(r.stderr), r.stderr);
    });
  } else {
    skip('python end to end (6 cases)', 'python3 is not installed');
  }

  const RB_SRC = [
    'module Sidekiq', '  class Worker', '    def perform; end', '    def self.build; end', '    def _hidden; end', '  end', 'end', '',
    'class Top', '  def run; end', 'end', '', 'def helper; end', '',
  ].join('\n');
  if (have('ruby', ['--version'])) {
    await test('ruby end to end: Ripper against the shipped extractor and against one that finds nothing', () => {
      const repos = tmp('sigmap-recall-rb-');
      put(path.join(repos, 'sidekiq/lib/a.rb'), RB_SRC);
      const real = rb.measure({ reposDir: repos, index: false });
      assert.strictEqual(real.measured, true);
      assert.deepStrictEqual(cells(real.populations.extractor.rows), ['class 2/2', 'module 1/1', 'method 4/4', 'owner 4/4'], 'a top-level def has no owner');
      const none = path.join(tmp('sigmap-recall-ext-'), 'none.js');
      put(none, 'module.exports = { extract: () => [] };');
      const blind = rb.measure({ reposDir: repos, extractorPath: none, index: false });
      assert.deepStrictEqual(blind.populations.extractor.rows.map((x) => x.recall), [0, 0, 0, 0]);
      assert.deepStrictEqual(blind.populations.extractor.misses.class.sort(), ['sidekiq/lib/a.rb :: Top', 'sidekiq/lib/a.rb :: Worker']);
      // a top-level def listed under the class above it is found by name and missed by owner
      const stale = path.join(tmp('sigmap-recall-ext-'), 'stale.js');
      put(stale, "module.exports = { extract: () => ['class Top', '  def helper'] };");
      const wrong = rb.measure({ reposDir: repos, extractorPath: stale, index: false });
      assert.deepStrictEqual(cells(wrong.populations.extractor.rows).slice(2), ['method 1/4', 'owner 0/4']);
    });

    await test('ruby.mjs keeps its command line, stays read-only without --index, and --min-* exits 1 under a floor', () => {
      const repos = tmp('sigmap-recall-rb-');
      put(path.join(repos, 'sidekiq/lib/a.rb'), RB_SRC);
      const script = path.join(ROOT, 'scripts/extraction-recall/ruby.mjs');
      const none = path.join(tmp('sigmap-recall-ext-'), 'none.js');
      put(none, 'module.exports = { extract: () => [] };');
      const ok = spawnSync(process.execPath, [script, '--repos', repos, '--min-class', '99'], { encoding: 'utf8' });
      assert.strictEqual(ok.status, 0, ok.stdout + ok.stderr);
      assert.ok(!/index:/.test(ok.stdout), 'the index step is opt-in');
      assert.strictEqual(fs.existsSync(path.join(repos, 'sidekiq/.context')), false);
      const bad = spawnSync(process.execPath, [script, '--repos', repos, '--extractor', none, '--min-class', '99'], { encoding: 'utf8' });
      assert.strictEqual(bad.status, 1, bad.stdout);
      assert.ok(/FAIL class: 0\.0% is below the floor of 99%/.test(bad.stdout), bad.stdout);
      const json = JSON.parse(spawnSync(process.execPath, [script, '--repos', repos, '--json'], { encoding: 'utf8' }).stdout);
      assert.deepStrictEqual(Object.keys(json).filter((k) => ['measured', 'filesCompared', 'pins', 'rows', 'failures'].includes(k)).sort(), ['failures', 'filesCompared', 'measured', 'pins', 'rows']);
      // a kind with nothing to find has a null recall: the command line must say so, not throw
      const empty = tmp('sigmap-recall-rb-');
      put(path.join(empty, 'sidekiq/lib/a.rb'), 'class A\nend\n');
      const r = spawnSync(process.execPath, [script, '--repos', empty, '--min-module', '50'], { encoding: 'utf8' });
      assert.strictEqual(r.status, 1, r.stdout + r.stderr);
      assert.ok(/module .*recall n\/a/.test(r.stdout) && /FAIL module: nothing to find/.test(r.stdout), r.stdout + r.stderr);
    });

    if (have('python3', ['--version'])) {
      await test('--save writes the report only for a complete run: not with --only, not without the index, and it does when complete', () => {
        const repos = tmp('sigmap-recall-both-');
        put(path.join(repos, 'flask/src/flask/app.py'), PY_SRC);
        put(path.join(repos, 'sidekiq/lib/a.rb'), RB_SRC);
        const out = path.join(tmp('sigmap-recall-out-'), 'report.json');
        const only = run(['--repos', repos, '--only', 'python', '--save', '--out', out]);
        assert.strictEqual(only.status, 1, only.stdout + only.stderr);
        assert.ok(/a partial run \(--only\)/.test(only.stderr), only.stderr);
        const noIndex = run(['--repos', repos, '--no-index', '--save', '--out', out]);
        assert.strictEqual(noIndex.status, 1, noIndex.stdout + noIndex.stderr);
        assert.ok(/without the index/.test(noIndex.stderr), noIndex.stderr);
        assert.strictEqual(fs.existsSync(out), false, 'a partial run wrote a report');
        const whole = run(['--repos', repos, '--save', '--out', out]);
        assert.strictEqual(whole.status, 0, whole.stdout + whole.stderr);
        const saved = JSON.parse(fs.readFileSync(out, 'utf8'));
        assert.deepStrictEqual(Object.keys(saved.languages).sort(), ['python', 'ruby']);
        assert.ok(saved.version && saved.generated, 'stamped');
      });
    } else {
      skip('--save case', 'python3 is not installed');
    }
  } else {
    skip('ruby end to end (3 cases)', 'ruby is not installed');
  }

  // ── the committed floors, the saved report and the published page ─────────

  const floorsFile = JSON.parse(fs.readFileSync(path.join(ROOT, runner.FLOORS_REL), 'utf8'));
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, runner.REPORT_REL), 'utf8'));

  await test('the saved report records the reference version and the pins of every measured language', () => {
    assert.deepStrictEqual(Object.keys(report.languages).sort(), [...runner.ADAPTERS].sort());
    for (const [name, r] of Object.entries(report.languages)) {
      assert.strictEqual(r.measured, true, name);
      assert.ok(/^\d+\.\d+/.test(r.reference.version), `${name}: ${r.reference.version}`);
      for (const [repo, sha] of Object.entries(r.pins)) assert.ok(/^[0-9a-f]{7,}$/.test(sha), `${name}/${repo}: ${sha}`);
      for (const p of Object.values(r.populations)) assert.ok(p.rows.length && p.rows.every((x) => x.reference > 0));
    }
    const { LANGUAGES } = require('../../src/extractors/dispatch');
    assert.deepStrictEqual([...Object.keys(report.languages), ...Object.keys(report.unmeasured)].sort(), [...LANGUAGES].sort());
  });

  await test('every committed floor names a real population and kind, and the saved report meets it', () => {
    for (const [name, spec] of Object.entries(floorsFile.languages)) {
      const measuredRun = report.languages[name];
      assert.ok(measuredRun, `${name} has floors but no report`);
      const v = lib.evaluate(measuredRun, spec);
      assert.notStrictEqual(v.status, 'not-enforced', `${name}: the saved report was made on ${measuredRun.reference.version}, which no floor covers`);
      assert.strictEqual(v.status, 'pass', JSON.stringify(v.checks.filter((c) => c.status !== 'pass')));
      for (const ref of spec.references) {
        assert.ok(ref.measuredWith && ref.measuredWith.version, `${name}/${ref.match}: no measuredWith`);
        for (const [pop, kinds] of Object.entries(ref.floors)) {
          assert.ok(measuredRun.populations[pop], `${name}: floor for unknown population ${pop}`);
          for (const [kind, floor] of Object.entries(kinds)) {
            assert.ok(measuredRun.populations[pop].rows.some((r) => r.kind === kind), `${name}/${pop}: floor for unknown kind ${kind}`);
            assert.ok(Number.isInteger(floor) && floor > 0 && floor <= 99, `${name}/${pop}/${kind}: ${floor}`);
          }
        }
      }
    }
  });

  await test('every floor is the recorded recall rounded down less one point: tight enough to trip on a loss, never above what was measured', () => {
    const floorOf = (x) => (x >= 100 ? 99 : Math.floor(x) - 1);
    for (const [name, spec] of Object.entries(floorsFile.languages)) {
      for (const ref of spec.references) {
        for (const [pop, kinds] of Object.entries(ref.floors)) {
          for (const [kind, floor] of Object.entries(kinds)) {
            const where = `${name}/${ref.match}/${pop}/${kind}`;
            if (ref.measuredWith.recorded) {
              assert.strictEqual(floor, floorOf(ref.measuredWith.recorded[pop][kind]), where);
            } else if (report.languages[name].reference.version.startsWith(ref.match)) {
              const recall = report.languages[name].populations[pop].rows.find((r) => r.kind === kind).recall;
              // several interpreters were checked for a prefix: the floor is the lowest of them
              assert.ok(floor <= floorOf(recall) && floor >= floorOf(recall) - 1, `${where}: ${floor} for a recall of ${recall}`);
            }
          }
        }
      }
    }
  });

  await test('the pins in the report and the floors are the commits the manifest pins', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/xrepo-repos.json'), 'utf8'));
    const commit = (name) => manifest.repos.find((r) => r.name === name).commit;
    const check = (pins, where) => {
      for (const [repo, sha] of Object.entries(pins)) assert.ok(commit(repo).startsWith(sha), `${where}: ${repo} is at ${sha}, the manifest pins ${commit(repo)}`);
    };
    for (const [name, r] of Object.entries(report.languages)) check(r.pins, `report/${name}`);
    for (const [name, spec] of Object.entries(floorsFile.languages)) {
      for (const ref of spec.references) check(ref.measuredWith.pins, `floors/${name}/${ref.match}`);
    }
  });

  await test('the docs page publishes the numbers of the saved report, and the language table links to it', () => {
    const page = fs.readFileSync(path.join(ROOT, 'docs-vp/guide/extraction-recall.md'), 'utf8');
    const cellsOf = (label) => {
      const line = page.split('\n').find((l) => l.startsWith(`| ${label}`));
      assert.ok(line, `no row for ${label}`);
      return line.split('|').slice(2, -1).map((c) => c.trim()); // after the label
    };
    const pct1 = (x) => `${x.recall.toFixed(1)}%`;
    const rows = (lang, pop) => report.languages[lang].populations[pop].rows;
    const pyRows = {
      'extractor, regex tier': 'extractor-regex', 'extractor, AST tier': 'extractor-ast',
      'index as shipped, without': 'index-regex', 'index as shipped, with `python3`': 'index-ast',
    };
    for (const [label, pop] of Object.entries(pyRows)) {
      const cells = cellsOf(label);
      assert.deepStrictEqual(cells.slice(1), rows('python', pop).map(pct1), label);
      assert.strictEqual(Number(cells[0].split(' ')[0]), report.languages.python.populations[pop].filesCompared, label);
    }
    const rbExtractor = cellsOf('extractor |');
    assert.deepStrictEqual(rbExtractor.slice(1), rows('ruby', 'extractor').map(pct1));
    const rbIndex = cellsOf('index as shipped |');
    assert.deepStrictEqual(rbIndex.slice(1), rows('ruby', 'index').map(pct1));
    const idx = report.languages.ruby.populations.index;
    assert.strictEqual(rbIndex[0], `${idx.filesCompared} of ${idx.filesTotal}`);
    for (const [lang, v] of [['python', report.languages.python.reference.version], ['ruby', report.languages.ruby.reference.version]]) {
      assert.ok(page.includes(v), `${lang} reference version ${v} not on the page`);
    }
    for (const sha of [...Object.values(report.languages.python.pins), ...Object.values(report.languages.ruby.pins)]) {
      assert.ok(page.includes(sha), `pin ${sha} not on the page`);
    }
    assert.ok(page.includes(`These ${Object.keys(report.unmeasured).length} have no adapter`), 'the unmeasured count');
    for (const l of Object.keys(report.unmeasured)) assert.ok(page.includes(l), `unmeasured language ${l} not listed`);
    // the prose figures, not only the table cells
    const n = (x) => x.toLocaleString('en-US');
    const regexRows = Object.fromEntries(report.languages.python.populations['extractor-regex'].rows.map((x) => [x.kind, x]));
    assert.ok(page.includes(`${n(regexRows.class.found)} of ${n(regexRows.class.reference)} classes, ${n(regexRows.func.found)} of ${n(regexRows.func.reference)} functions and ${n(regexRows.method.found)} of ${n(regexRows.method.reference)} methods`), 'the regex-tier counts');
    assert.ok(page.includes(`(${regexRows.func.skipped} functions and ${regexRows.method.skipped} methods for the regex tier)`), 'the skipped counts');
    const drop = (kind) => Math.round(regexRows[kind].recall - report.languages.python.populations['index-regex'].rows.find((x) => x.kind === kind).recall);
    assert.ok(page.includes(`classes fall ${drop('class')} points, functions ${drop('func')} and methods ${drop('method')}`), 'the cap cost in points');
    const idxRb = report.languages.ruby.populations.index;
    assert.ok(page.includes(`index recall is ${idxRb.rowsAllFiles.map((x) => `${x.recall.toFixed(1)}%`).join(' / ')}`), 'the all-files Ruby index recall');
    const rbRows = Object.fromEntries(report.languages.ruby.populations.extractor.rows.map((x) => [x.kind, x]));
    assert.ok(page.includes(`(${n(rbRows.class.found)} of ${n(rbRows.class.reference)} classes, ${n(rbRows.module.found)} of ${n(rbRows.module.reference)} modules, ${n(rbRows.method.found)} of ${n(rbRows.method.reference)} methods, ${n(rbRows.owner.found)} of ${n(rbRows.owner.reference)} under the right owner)`), 'the Ruby counts');
    const languages = fs.readFileSync(path.join(ROOT, 'docs-vp/guide/languages.md'), 'utf8');
    for (const lang of ['Python', 'Ruby']) {
      const row = languages.split('\n').find((l) => l.startsWith(`| ${lang} |`));
      assert.ok(row && row.includes('/guide/extraction-recall'), `${lang} row of the language table does not link to the report`);
    }
    assert.ok(fs.readFileSync(path.join(ROOT, 'docs-vp/.vitepress/config.mts'), 'utf8').includes("'/guide/extraction-recall'"), 'not in the sidebar');
  });

  await test('the gate is wired: an npm script, and a CI step in the job that fetches the pinned clones', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.scripts['validate:extraction-recall'], 'node scripts/run-extraction-recall.mjs --gate');
    const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    const job = ci.slice(ci.indexOf('\n  xrepo:'));
    const next = job.slice(1).search(/\n  [a-z][\w-]*:\n/);
    const body = next === -1 ? job : job.slice(0, next + 1);
    assert.ok(body.includes('node scripts/fetch-xrepo-repos.mjs'), 'the xrepo job does not fetch the clones');
    assert.ok(/npm run validate:extraction-recall -- --require-reference/.test(body), 'the xrepo job does not run the recall gate with --require-reference');
  });

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
  process.exit(failed > 0 ? 1 : 0);
})();
