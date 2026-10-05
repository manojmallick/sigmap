'use strict';

/**
 * Zero-config source roots for the layouts the third-party gate had to pin
 * (#900, from #893 section 1).
 *
 * With `srcDirs` removed from the manifest, riverpod, phoenix and
 * godot-demo-projects scored 0/5, 0/5 and 0/5 — every one of the 15 answers was
 * unindexed. Three different causes, one symptom: the language was detected
 * correctly and the resolver still had no way to reach its code.
 *
 *   Dart     `pubspec.yaml` was not a package manifest, so a pub workspace was
 *            not a monorepo, and Dart keeps its code in `lib/`, not `src/`.
 *   Elixir   `.ex` / `.exs` were not counted as code, so `lib/` scored zero and
 *            the JavaScript in `assets/` and `priv/` won.
 *   GDScript `.gd` was not counted either, and the repo root holds none of the
 *            code directly — scripts sit beside their scenes at any depth.
 *
 * Fixtures are built inline in temp dirs (the established pattern): a committed
 * fixture tree under test/ would be indexed into this repo's own corpus.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const { resolveSourceRoots } = require(path.join(ROOT, 'src/discovery/source-root-resolver'));
const { detectMonorepo, workspaceMarker } = require(path.join(ROOT, 'src/discovery/monorepo'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
}

function tmp(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-roots-lang-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

const roots = (dir) => resolveSourceRoots(dir).roots;
const dart = (cls) => `class ${cls} {\n  void run() {}\n}\n`;

/** A pub workspace in riverpod's shape: packages/*, each with lib/, test/ and example/. */
function dartWorkspace(n, { declared = true } = {}) {
  const names = Array.from({ length: n }, (_, i) => `pkg${i}`);
  const files = {
    'pubspec.yaml': declared
      ? `name: workspace\nworkspace:\n${names.map((p) => `  - packages/${p}`).join('\n')}\n`
      : 'name: workspace\n',
    // A docs site in another language: the old resolver's top pick.
    'website/docusaurus.config.js': 'module.exports = {};\n',
    'website/src/pages/index.js': 'export default function Home() {}\n',
    'website/src/components/a.js': 'export const a = 1;\n',
    'website/src/components/b.js': 'export const b = 1;\n',
    'benchmarks/bench.dart': dart('Bench'),
  };
  for (const p of names) {
    files[`packages/${p}/pubspec.yaml`] = `name: ${p}\nresolution: workspace\n`;
    files[`packages/${p}/lib/${p}.dart`] = dart(p.toUpperCase());
    for (const f of ['a', 'b', 'c']) files[`packages/${p}/lib/src/${f}.dart`] = dart(`${p}_${f}`);
    files[`packages/${p}/test/${p}_test.dart`] = dart(`${p}Test`);
    files[`packages/${p}/example/main.dart`] = dart(`${p}Example`);
  }
  return tmp(files);
}

// ── Dart ───────────────────────────────────────────────────────────────────

test('dart: a pub workspace resolves to each package\'s lib/, not to the docs site', () => {
  const r = roots(dartWorkspace(3));
  for (const p of ['pkg0', 'pkg1', 'pkg2']) {
    assert.ok(r.includes(`packages/${p}/lib`), `packages/${p}/lib missing from ${JSON.stringify(r)}`);
  }
  assert.notStrictEqual(r[0], 'website', `the docs site must not outrank the packages: ${JSON.stringify(r)}`);
});

test('dart: package tests and examples are not roots (they are indexed separately)', () => {
  const r = roots(dartWorkspace(3));
  assert.ok(!r.some((x) => /\/(test|example)(\/|$)/.test(x)), JSON.stringify(r));
  assert.ok(!r.includes('packages/pkg0'), `the package root would drag in test/ and example/: ${JSON.stringify(r)}`);
});

test('dart: every package of a large workspace is a root — one per package is the right answer, not over-detection', () => {
  const r = roots(dartWorkspace(10));
  const libs = r.filter((x) => /^packages\/pkg\d+\/lib$/.test(x));
  assert.strictEqual(libs.length, 10, `expected 10 package roots, got ${libs.length}: ${JSON.stringify(r)}`);
});

test('dart: a workspace is a monorepo, and the evidence names the pubspec', () => {
  const dir = dartWorkspace(3);
  assert.strictEqual(workspaceMarker(dir), 'pubspec.yaml workspace');
  const verdict = detectMonorepo(dir);
  assert.strictEqual(verdict.isMonorepo, true);
  assert.strictEqual(verdict.source, 'marker');
});

test('dart: without a workspace key, two packages under packages/ are still a monorepo by layout', () => {
  const dir = dartWorkspace(3, { declared: false });
  assert.strictEqual(workspaceMarker(dir), null);
  const verdict = detectMonorepo(dir);
  assert.strictEqual(verdict.isMonorepo, true);
  assert.strictEqual(verdict.source, 'layout');
  const r = roots(dir);
  assert.ok(r.includes('packages/pkg0/lib') && r.includes('packages/pkg1/lib'), JSON.stringify(r));
});

test('dart: melos.yaml declares a workspace', () => {
  const dir = tmp({ 'melos.yaml': 'name: ws\npackages:\n  - packages/**\n', 'packages/a/pubspec.yaml': 'name: a\n', 'packages/a/lib/a.dart': dart('A') });
  assert.strictEqual(workspaceMarker(dir), 'melos.yaml');
});

test('dart: a single package is not a monorepo and still resolves to lib/ (control)', () => {
  const dir = tmp({
    'pubspec.yaml': 'name: single\n',
    'lib/main.dart': dart('Main'), 'lib/src/a.dart': dart('A'), 'lib/src/b.dart': dart('B'), 'lib/src/c.dart': dart('C'),
    'test/a_test.dart': dart('ATest'), 'example/main.dart': dart('Ex'),
  });
  assert.strictEqual(detectMonorepo(dir).isMonorepo, false);
  const r = roots(dir);
  assert.ok(r.includes('lib'), JSON.stringify(r));
  assert.ok(!r.some((x) => x.startsWith('packages/')), JSON.stringify(r));
});

// ── Elixir ─────────────────────────────────────────────────────────────────

/** Phoenix's shape: lib/ is the application, assets/ and priv/ are front-end output. */
function elixirApp() {
  const files = {
    'mix.exs': 'defmodule App.MixProject do\n  use Mix.Project\nend\n',
    'config/config.exs': 'import Config\n',
    'test/app_test.exs': 'defmodule AppTest do\nend\n',
    'priv/static/app.js': 'console.log(1);\n',
    'priv/repo/migrations/20240101_init.exs': 'defmodule Init do\nend\n',
  };
  for (const f of ['app', 'app/router', 'app/endpoint', 'app/repo']) {
    files[`lib/${f}.ex`] = `defmodule ${f.replace(/[\/]/g, '.')} do\n  def run, do: :ok\nend\n`;
  }
  for (const f of ['app', 'socket', 'hooks', 'util']) files[`assets/js/${f}.js`] = `export const ${f} = 1;\n`;
  return tmp(files);
}

test('elixir: a mix project resolves to lib/, not to the JavaScript in assets/ and priv/', () => {
  const r = roots(elixirApp());
  assert.strictEqual(r[0], 'lib', `lib/ must be the first root: ${JSON.stringify(r)}`);
  assert.ok(!r.includes('priv'), `priv/ holds build output and migrations, not the application: ${JSON.stringify(r)}`);
});

test('elixir: an umbrella project resolves to each app\'s lib/', () => {
  const files = { 'mix.exs': 'defmodule Umbrella.MixProject do\nend\n' };
  for (const a of ['web', 'core']) {
    files[`apps/${a}/mix.exs`] = `defmodule ${a}.MixProject do\nend\n`;
    for (const f of ['one', 'two', 'three']) files[`apps/${a}/lib/${a}/${f}.ex`] = `defmodule ${a}.${f} do\nend\n`;
  }
  const r = roots(tmp(files));
  assert.ok(r.includes('apps/web/lib') && r.includes('apps/core/lib'), JSON.stringify(r));
});

// ── GDScript ───────────────────────────────────────────────────────────────

const gd = (n) => `extends Node\n\nfunc ${n}():\n\tpass\n`;

test('gdscript: scripts scattered below a root that holds none resolve to the root — from .gd files alone', () => {
  // The gate's godot checkout is sparse (`*.gd` only), so no project.godot here:
  // a rule that needed it would pass its fixture and fail the gate.
  const dir = tmp({
    '2d/platformer/player.gd': gd('move'), '2d/platformer/enemy.gd': gd('patrol'),
    '3d/fps/gun.gd': gd('fire'), 'gui/menu/menu.gd': gd('open'), 'audio/mixer/mixer.gd': gd('mix'),
  });
  assert.deepStrictEqual(roots(dir), ['.']);
});

test('gdscript: a Godot project with project.godot resolves to the root', () => {
  const dir = tmp({
    'project.godot': 'config_version=5\n',
    'scripts/player.gd': gd('move'), 'scripts/enemy.gd': gd('patrol'), 'scripts/ui.gd': gd('show'),
    'scenes/main.tscn': '[gd_scene format=3]\n',
  });
  assert.deepStrictEqual(roots(dir), ['.']);
});

// ── Controls: nothing else moves ───────────────────────────────────────────

test('control: a JS monorepo still resolves to its package roots, unchanged by the lib/ rule', () => {
  // Measured on the code BEFORE this change: JS packages resolve to the package
  // root (it outscores `<package>/src`), and the dedupe keeps the parent. The
  // `lib/` rule is gated on the language's registry entry (Dart, Elixir), so a
  // JS package's compiled `lib/` output must not become a root of its own.
  const files = { 'pnpm-workspace.yaml': 'packages:\n  - packages/*\n' };
  for (const p of ['a', 'b']) {
    files[`packages/${p}/package.json`] = `{"name":"${p}"}\n`;
    for (const f of ['index', 'util', 'core']) files[`packages/${p}/src/${f}.js`] = `export const ${f} = 1;\n`;
    for (const f of ['index', 'util', 'core']) files[`packages/${p}/lib/${f}.js`] = `exports.${f} = 1;\n`;
  }
  const resolved = resolveSourceRoots(tmp(files));
  assert.deepStrictEqual([...resolved.roots].sort(), ['packages/a', 'packages/b']);
  assert.strictEqual(resolved.isPackageWorkspace, false);
});

test('control: a stray .gd file in a Python project does not make the root a source root', () => {
  const files = { 'pyproject.toml': '[project]\nname = "x"\n', 'tools/one.gd': gd('a') };
  for (const f of ['app', 'models', 'views', 'utils']) files[`pkg/${f}.py`] = `def ${f}():\n    pass\n`;
  const r = roots(tmp(files));
  assert.ok(!r.includes('.'), JSON.stringify(r));
});

test('control: an Elixir file in a JS project does not move its roots', () => {
  const files = { 'package.json': '{"name":"x"}\n', 'scripts/seed.exs': 'IO.puts(1)\n' };
  for (const f of ['index', 'util', 'core', 'main']) files[`src/${f}.js`] = `export const ${f} = 1;\n`;
  const r = roots(tmp(files));
  assert.strictEqual(r[0], 'src', JSON.stringify(r));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
