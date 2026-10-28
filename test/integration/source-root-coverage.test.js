'use strict';

/**
 * #997 — source roots that cover the repository, and a figure that says how much.
 *
 * Detection counted a directory's code two levels deep. A layout that keeps its code deeper
 * (Rails: `activerecord/lib/active_record/…`, a gem each) scored 0 for most of its directories,
 * and the roots that were picked were capped at six: a first `sigmap` run on Rails indexed 42%
 * of the code, printed "Indexed 100%" and "In context 100%", and said nothing about the rest.
 *
 * Pinned here:
 *   1. a Rails-shaped repository's default roots reach 90% or more of its code (counted by this
 *      test's own walk, not by the code under test), with more than six roots
 *   2. the order the roots come in follows the code they hold, and is the same on every run
 *   3. `generate` names the roots and prints the share of the repository they cover, and warns,
 *      naming the directories left out, when that share is under 80%
 *   4. `generate`, `validate`, `validate --json`, `doctor` and `roots` print the same figure
 *   5. a directory the scorer penalises by name (`docs/`, `examples/`, `documentation-*`) is not
 *      promoted to a root by the deeper count
 *   6. in a multi-module JVM build a module's own directory (the parent of its source sets) is not
 *      a root next to the source sets it holds
 *   7. a repository with one `src/` is unchanged: one root, 100%
 *   8. the figure is the same from a relative working directory as from an absolute one
 *
 * Every test that runs the CLI gives it an empty HOME and CODEX_HOME: a developer's own
 * configuration must not decide what this suite expects.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-rootcov-'));
const HOME = path.join(tmpRoot, 'home');
fs.mkdirSync(HOME, { recursive: true });
const ENV = { ...process.env, HOME, CODEX_HOME: path.join(HOME, '.codex') };
let counter = 0;

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function git(dir) {
  spawnSync('git', ['init', '-q'], { cwd: dir });
  spawnSync('git', ['add', '-A'], { cwd: dir });
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init'], { cwd: dir });
}

/**
 * Eight gems, each with its code three levels down (`<gem>/lib/<gem>/…`), plus a `railties` with a
 * `guides/` and a `tools/` of five files each: the shape that scored 0 for every gem.
 */
const GEMS = ['actioncable', 'actionmailer', 'actionpack', 'actionview', 'activejob', 'activerecord', 'activestorage', 'activesupport'];
function railsShaped() {
  const dir = path.join(tmpRoot, `rails${counter++}`);
  for (const d of ['guides', 'tools']) {
    for (let i = 0; i < 5; i++) write(path.join(dir, 'railties', d, `f${i}.rb`), `class ${d}${i}\n  def a; end\nend\n`);
  }
  GEMS.forEach((g, gi) => {
    // Different sizes, so the order the roots come in has something to follow.
    for (let i = 0; i < 20 + gi * 5; i++) write(path.join(dir, g, 'lib', g, `m${i}.rb`), `module M${i}\n  def x(a); end\nend\n`);
    for (let i = 0; i < 4; i++) write(path.join(dir, g, 'test', `t${i}_test.rb`), `class T${i}\nend\n`);
  });
  write(path.join(dir, 'Gemfile'), 'source "https://rubygems.org"\n');
  git(dir);
  return dir;
}

const CODE = new Set(['.rb', '.js', '.ts', '.py', '.kt', '.java']);
/** Implementation files under `dir` (tests excluded), by this test's own walk. */
function implFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules' || e.name === '.context') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      const rel = path.relative(dir, p).split(path.sep).join('/');
      if (CODE.has(path.extname(e.name)) && !/(^|\/)test\//.test(rel)) out.push(rel);
    }
  })(dir);
  return out;
}
function shareUnder(dir, roots) {
  const all = implFiles(dir);
  const under = all.filter((f) => roots.some((r) => r === '.' || f === r || f.startsWith(r.replace(/\/$/, '') + '/')));
  return { covered: under.length, all: all.length, pct: Math.round((100 * under.length) / all.length) };
}

function run(dir, args = []) {
  const r = spawnSync('node', [SCRIPT, ...args], { cwd: dir, encoding: 'utf8', env: ENV });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '' };
}
function resolve(dir) {
  const { resolveSourceRoots } = require(path.join(ROOT, 'src', 'discovery', 'source-root-resolver.js'));
  return resolveSourceRoots(dir, {});
}
const FIGURE = /(\d+)% of the repository's code \(([\d,]+) of ([\d,]+) files\) is under the source roots/;
function figureOf(text) {
  const m = FIGURE.exec(text);
  assert.ok(m, `no repository figure in:\n${text.slice(-900)}`);
  return `${m[1]}|${m[2]}|${m[3]}`;
}

test('a Rails-shaped repository: the default roots reach 90% or more of its code, in more than six roots', () => {
  const dir = railsShaped();
  const { roots } = resolve(dir);
  const s = shareUnder(dir, roots);
  assert.ok(s.pct >= 90, `roots [${roots.join(', ')}] reach ${s.covered} of ${s.all} files (${s.pct}%)`);
  assert.ok(roots.length > 6, `eight gems are eight roots; got ${roots.length}: ${roots.join(', ')}`);
});

test('the roots come in the order of the code they hold, and the same on every run', () => {
  const dir = railsShaped();
  const a = resolve(dir).roots;
  const b = resolve(dir).roots;
  assert.deepStrictEqual(a, b, 'two runs on one tree chose differently');
  // activesupport holds the most (20 + 7 * 5 = 55); it must come before a smaller gem of the same score.
  assert.ok(a.indexOf('activesupport') < a.indexOf('actioncable'), `larger gems first: ${a.join(', ')}`);
});

test('generate names the roots and prints the share of the repository they cover', () => {
  const dir = railsShaped();
  const r = run(dir);
  assert.strictEqual(r.status, 0, r.out);
  assert.ok(/Source roots\s*:.*activesupport/.test(r.out), `the roots are named, the largest first:\n${r.out}`);
  const [pct] = figureOf(r.out).split('|').map(Number);
  assert.ok(pct >= 90, `${pct}%`);
  assert.ok(!/outside the source roots/.test(r.out), 'no warning when the roots cover the repository');
});

test('under 80% generate warns, names the directories left out, and says what to run', () => {
  const dir = railsShaped();
  write(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['railties/guides', 'railties/tools'] }));
  const r = run(dir);
  assert.strictEqual(r.status, 0, r.out);
  const [pct] = figureOf(r.out).split('|').map(Number);
  assert.ok(pct < 10, `${pct}%`);
  assert.ok(/⚠ \d+% of the repository's code is outside the source roots/.test(r.out), r.out);
  assert.ok(/activesupport \(\d+\)/.test(r.out), 'the largest directory left out is named with its count');
  assert.ok(/sigmap roots --explain/.test(r.out), 'it says what to run');
});

test('generate, validate, validate --json, doctor and roots print one figure', () => {
  const dir = railsShaped();
  const gen = run(dir);
  const want = figureOf(gen.out);
  assert.strictEqual(figureOf(run(dir, ['validate']).out), want, 'validate');
  assert.strictEqual(figureOf(run(dir, ['doctor']).out), want, 'doctor');
  assert.strictEqual(figureOf(run(dir, ['roots']).out), want, 'roots');
  const j = JSON.parse(run(dir, ['validate', '--json']).stdout);
  const [pct, covered, all] = want.split('|');
  assert.deepStrictEqual(
    { covered: String(j.repositoryCoverage.covered), all: String(j.repositoryCoverage.all), pct: String(j.repositoryCoverage.pct) },
    { covered: covered.replace(/,/g, ''), all: all.replace(/,/g, ''), pct },
    'validate --json'
  );
});

test('doctor turns the config row to a warning when the roots cover under 80%', () => {
  const dir = railsShaped();
  write(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['railties/guides'] }));
  const out = run(dir, ['doctor']).out;
  assert.ok(/⚠ Config & source roots/.test(out), out);
  assert.ok(/sigmap roots --explain/.test(out), 'doctor says what to run');
});

test('roots --explain says how many files each root holds and what the cap left out', () => {
  const dir = path.join(tmpRoot, `wide${counter++}`);
  // 45 modules of 12 files, three levels down: more than the 40 the extension may take.
  for (let m = 0; m < 45; m++) for (let i = 0; i < 12; i++) write(path.join(dir, `mod${String(m).padStart(2, '0')}`, 'lib', 'x', `f${i}.rb`), 'class A\nend\n');
  git(dir);
  const r = resolve(dir);
  assert.ok(r.roots.length <= 40, `${r.roots.length} roots`);
  assert.ok(r.omitted > 0 && r.truncated === true, `omitted ${r.omitted}`);
  const out = run(dir, ['roots']).out;
  assert.ok(/\d+ code file\(s\)/.test(out), out);
  assert.ok(new RegExp(`${r.omitted} more candidate directories scored above zero and were not chosen`).test(out), out);
});

test('a directory the scorer penalises by name is not made a root by the deeper count', () => {
  const dir = path.join(tmpRoot, `noise${counter++}`);
  for (let i = 0; i < 6; i++) write(path.join(dir, 'src', `a${i}.py`), `def f${i}(): pass\n`);
  for (const d of ['docs', 'examples', 'documentation-website']) {
    for (let i = 0; i < 6; i++) write(path.join(dir, d, 'deep', 'er', `x${i}.py`), `def g${i}(): pass\n`);
  }
  git(dir);
  const { roots } = resolve(dir);
  assert.ok(roots.includes('src'), roots.join(', '));
  for (const d of ['docs', 'examples', 'documentation-website']) assert.ok(!roots.includes(d), `${d} became a root: ${roots.join(', ')}`);
});

test('in a multi-module JVM build a module directory is not a root beside its source sets', () => {
  const dir = path.join(tmpRoot, `jvm${counter++}`);
  for (const m of ['core', 'util', 'net']) {
    for (let i = 0; i < 5; i++) write(path.join(dir, m, 'src', 'main', 'kotlin', 'p', 'q', `K${i}.kt`), `class K${i}\n`);
    for (let i = 0; i < 3; i++) write(path.join(dir, m, 'src', 'test', 'kotlin', 'p', `T${i}.kt`), `class T${i}\n`);
  }
  write(path.join(dir, 'settings.gradle.kts'), 'include(":core", ":util", ":net")\n');
  git(dir);
  const { roots } = resolve(dir);
  for (const m of ['core', 'util', 'net']) {
    assert.ok(roots.includes(`${m}/src/main/kotlin`), `${m}'s source set is a root: ${roots.join(', ')}`);
    assert.ok(!roots.includes(m), `${m}'s own directory is not: ${roots.join(', ')}`);
  }
});

test('a repository with one src/ is unchanged: one root, 100%', () => {
  const dir = path.join(tmpRoot, `flat${counter++}`);
  for (let i = 0; i < 6; i++) write(path.join(dir, 'src', `a${i}.js`), `function f${i}(a) { return a; }\nmodule.exports = { f${i} };\n`);
  write(path.join(dir, 'package.json'), '{"name":"flat","version":"1.0.0"}');
  git(dir);
  assert.deepStrictEqual(resolve(dir).roots, ['src']);
  const r = run(dir);
  assert.ok(/^\s*100%/.test(figureOf(r.out)) || figureOf(r.out).startsWith('100|'), figureOf(r.out));
});

test('the figure is the same from a relative working directory as from an absolute one', () => {
  const dir = railsShaped();
  const cov = require(path.join(ROOT, 'src', 'analysis', 'coverage-score.js'));
  const config = { srcDirs: GEMS.slice(0, 3) };
  const abs = cov.repositoryCoverage(dir, config);
  const here = process.cwd();
  process.chdir(dir);
  let rel;
  try { rel = cov.repositoryCoverage('.', config); } finally { process.chdir(here); }
  assert.deepStrictEqual({ covered: rel.covered, all: rel.all, pct: rel.pct }, { covered: abs.covered, all: abs.all, pct: abs.pct });
  assert.ok(abs.all > 0 && abs.covered < abs.all, JSON.stringify(abs));
});

try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}

console.log(`\nsource-root-coverage: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
