'use strict';

/**
 * Local-library signature index (v9.0 G5/D5 — the moat).
 *
 * Covers:
 *   extractDtsExports — parses the common `.d.ts` export forms
 *   buildLibraryIndex — resolves installed direct deps → symbols + versions (D8),
 *                       caches via sig-cache, degrades gracefully
 *   verify() integration — a real installed-library call is no longer
 *                          false-flagged; a genuinely fake symbol still flags;
 *                          summary reports librariesIndexed + version pins
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '../..');
const lib = require(path.join(ROOT, 'src', 'verify', 'lib-index'));
const { verify } = require(path.join(ROOT, 'src', 'verify', 'hallucination-guard'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}

/** Build a temp project: package.json deps + an installed node_modules/<dep>. */
function withProject(deps, installed, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-libidx-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'proj', dependencies: deps }));
    for (const [name, spec] of Object.entries(installed || {})) {
      const pkgDir = path.join(dir, 'node_modules', name);
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(spec.pkg));
      if (spec.dts != null) fs.writeFileSync(path.join(pkgDir, spec.dtsName || 'index.d.ts'), spec.dts);
    }
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('\nlib-index (G5/D5 moat) tests\n');

// ── extractDtsExports ───────────────────────────────────────────────────────
test('extractDtsExports parses declaration, list, and namespace exports', () => {
  const src = [
    'export declare function debounce(fn: any): any;',
    'export const VERSION: string;',
    'export class Router {}',
    'export interface Options {}',
    'export type Handler = () => void;',
    'export enum Level { A, B }',
    'declare function hidden(): void;',        // not exported → excluded
    'export { helper as helperAlias, plain };',
    'export as namespace Acme;',
  ].join('\n');
  const names = lib.extractDtsExports(src);
  for (const want of ['debounce', 'VERSION', 'Router', 'Options', 'Handler', 'Level', 'helperAlias', 'plain', 'Acme']) {
    assert.ok(names.includes(want), `missing export ${want}`);
  }
  assert.ok(!names.includes('hidden'), 'non-exported symbol leaked');
  assert.deepStrictEqual(names, [...names].sort(), 'output not sorted (determinism)');
});

// ── buildLibraryIndex ───────────────────────────────────────────────────────
test('buildLibraryIndex indexes installed direct deps with version (D8)', () => {
  withProject(
    { acme: '^1.0.0' },
    { acme: { pkg: { name: 'acme', version: '1.2.3', types: 'index.d.ts' }, dts: 'export declare function foo(): void;\nexport const bar: string;' } },
    (dir) => {
      const idx = lib.buildLibraryIndex(dir, { version: '8.0.0' });
      assert.deepStrictEqual([...idx.symbols].sort(), ['bar', 'foo']);
      assert.strictEqual(idx.count, 2);
      assert.strictEqual(idx.libraries.length, 1);
      assert.deepStrictEqual(idx.libraries[0], { name: 'acme', version: '1.2.3', symbols: 2, typed: true });
      assert.deepStrictEqual(lib.formatVersionPins(idx.libraries), ['acme@1.2.3']);
    });
});

test('buildLibraryIndex resolves typings dir + main→.d.ts fallback', () => {
  withProject(
    { widget: '^2.0.0' },
    { widget: { pkg: { name: 'widget', version: '2.0.0', main: 'index.js' }, dts: 'export class Widget {}' } },
    (dir) => {
      const idx = lib.buildLibraryIndex(dir, { version: '8.0.0' });
      assert.ok(idx.symbols.has('Widget'), 'did not resolve index.d.ts default');
    });
});

test('buildLibraryIndex is cached via sig-cache (repeat build is consistent)', () => {
  withProject(
    { acme: '^1' },
    { acme: { pkg: { name: 'acme', version: '1.0.0', types: 'index.d.ts' }, dts: 'export const A: number;' } },
    (dir) => {
      const a = lib.buildLibraryIndex(dir, { version: '8.0.0' });
      assert.ok(fs.existsSync(path.join(dir, '.sigmap-cache.json')), 'cache file not written');
      const b = lib.buildLibraryIndex(dir, { version: '8.0.0' }); // second → cache hit
      assert.deepStrictEqual([...a.symbols].sort(), [...b.symbols].sort());
    });
});

test('buildLibraryIndex degrades gracefully (uninstalled / untyped / malformed)', () => {
  // dep declared but not installed
  withProject({ ghost: '^1' }, {}, (dir) => {
    const idx = lib.buildLibraryIndex(dir, { version: '8.0.0' });
    assert.strictEqual(idx.count, 0);
    assert.strictEqual(idx.libraries.length, 0);
  });
  // installed but untyped (no .d.ts)
  withProject({ plain: '^1' }, { plain: { pkg: { name: 'plain', version: '3.0.0' }, dts: null } }, (dir) => {
    const idx = lib.buildLibraryIndex(dir, { version: '8.0.0' });
    assert.strictEqual(idx.count, 0);
    assert.deepStrictEqual(idx.libraries[0], { name: 'plain', version: '3.0.0', symbols: 0, typed: false });
  });
  // no package.json at all → empty, no throw
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-empty-'));
  try {
    const idx = lib.buildLibraryIndex(empty, { version: '8.0.0' });
    assert.strictEqual(idx.count, 0);
  } finally { fs.rmSync(empty, { recursive: true, force: true }); }
});

// ── verify() integration (the moat behavior) ────────────────────────────────
test('verify() no longer false-flags a real installed-library call', () => {
  withProject(
    { acme: '^1' },
    { acme: { pkg: { name: 'acme', version: '1.2.3', types: 'index.d.ts' }, dts: 'export declare function debounce(fn: any): any;\nexport class Router {}' } },
    (dir) => {
      const answer = 'Call `Router()` and `debounce(fn)` and `notARealThing()`.';
      const base = { symbolSet: new Set(['someRepoFn']), deps: new Set(['acme']), hasPkg: true };
      const li = lib.buildLibraryIndex(dir, { version: '8.0.0' });

      const off = verify(answer, dir, { ...base, libIndex: false });
      const on = verify(answer, dir, { ...base, libSymbols: li.symbols, libraries: li.libraries });

      const offFakes = off.issues.filter((i) => i.type === 'fake-symbol').map((i) => i.value).sort();
      const onFakes = on.issues.filter((i) => i.type === 'fake-symbol').map((i) => i.value).sort();
      assert.deepStrictEqual(offFakes, ['Router', 'debounce', 'notARealThing'], 'baseline should flag all three');
      assert.deepStrictEqual(onFakes, ['notARealThing'], 'lib index should suppress only the real library calls');
    });
});

test('verify() summary reports librariesIndexed + version pins (D8)', () => {
  withProject(
    { acme: '^1' },
    { acme: { pkg: { name: 'acme', version: '1.2.3', types: 'index.d.ts' }, dts: 'export class Router {}' } },
    (dir) => {
      const res = verify('Use `Router()`.', dir, { symbolSet: new Set(['x']), deps: new Set(['acme']), hasPkg: true, version: '8.0.0',
        libSymbols: lib.buildLibraryIndex(dir, { version: '8.0.0' }).symbols,
        libraries: lib.buildLibraryIndex(dir, { version: '8.0.0' }).libraries });
      assert.strictEqual(res.summary.librariesIndexed, 1);
      assert.deepStrictEqual(res.summary.libraries, [{ name: 'acme', version: '1.2.3', symbols: 1, typed: true }]);
    });
});

test('verify() auto-builds the lib index from cwd node_modules', () => {
  withProject(
    { acme: '^1' },
    { acme: { pkg: { name: 'acme', version: '9.9.9', types: 'index.d.ts' }, dts: 'export class Router {}' } },
    (dir) => {
      // No symbolSet/libSymbols override → verify must discover node_modules itself.
      const res = verify('Use `Router()`.', dir, { version: '8.0.0' });
      assert.strictEqual(res.summary.librariesIndexed, 1);
      assert.ok(!res.issues.some((i) => i.type === 'fake-symbol' && i.value === 'Router'),
        'auto lib index should recognize Router');
    });
});

// ── Python site-packages grounding ──────────────────────────────────────────

/** Temp project with a venv site-packages containing installed Python packages. */
function withPyProject(requirements, packages, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-py-'));
  try {
    fs.writeFileSync(path.join(dir, 'requirements.txt'), requirements);
    const sp = path.join(dir, '.venv', 'lib', 'python3.11', 'site-packages');
    fs.mkdirSync(sp, { recursive: true });
    for (const [name, spec] of Object.entries(packages)) {
      if (spec.init != null) {
        const pkgDir = path.join(sp, spec.dir || name);
        fs.mkdirSync(pkgDir, { recursive: true });
        fs.writeFileSync(path.join(pkgDir, spec.stub ? '__init__.pyi' : '__init__.py'), spec.init);
      }
      if (spec.version) fs.mkdirSync(path.join(sp, `${spec.distName || name}-${spec.version}.dist-info`), { recursive: true });
    }
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('extractPyExports parses __all__, def/class, assignments, and re-exports', () => {
  const src = [
    'import os',
    '_private = 1',
    'MAX = 5',
    'def connect(url):',
    '    pass',
    'class Client:',
    '    pass',
    'from .session import Session, _hidden, helper as h',
    "__all__ = ['connect', 'Client', 'Session', 'MAX']",
  ].join('\n');
  const names = lib.extractPyExports(src);
  for (const want of ['connect', 'Client', 'Session', 'MAX', 'h']) assert.ok(names.includes(want), `missing ${want}`);
  assert.ok(!names.includes('_private'), 'private assignment leaked');
  assert.ok(!names.includes('_hidden'), 'private re-export leaked');
  assert.ok(!names.includes('os'), 'plain import should not be an export');
  assert.deepStrictEqual(names, [...names].sort(), 'not sorted');
});

test('buildLibraryIndex indexes Python venv site-packages with versions (D8)', () => {
  withPyProject(
    'acme==1.0.0\n# comment\nrequests>=2\n',
    {
      acme: { init: 'def connect(u):\n    pass\nclass Client:\n    pass\n__all__ = ["connect","Client"]\n', version: '1.0.0' },
      requests: { init: 'def get(u): pass\ndef post(u): pass\n', version: '2.31.0' },
    },
    (dir) => {
      const idx = lib.buildLibraryIndex(dir, { version: '8.0.0' });
      for (const want of ['connect', 'Client', 'get', 'post']) assert.ok(idx.symbols.has(want), `missing ${want}`);
      const byName = Object.fromEntries(idx.libraries.map((l) => [l.name, l]));
      assert.strictEqual(byName.acme.version, '1.0.0');
      assert.strictEqual(byName.requests.version, '2.31.0');
      assert.ok(byName.acme.typed && byName.requests.typed);
    });
});

test('verify() grounds Python calls against installed venv libs', () => {
  withPyProject(
    'acme==1.0.0\n',
    { acme: { init: 'def connect(u):\n    pass\nclass Client:\n    pass\n', version: '1.0.0' } },
    (dir) => {
      const res = verify('Call `connect(url)` and `Client()` and `notReal()`.', dir, { version: '8.0.0' });
      assert.strictEqual(res.summary.librariesIndexed, 1);
      assert.deepStrictEqual(res.summary.libraries, [{ name: 'acme', version: '1.0.0', symbols: 2, typed: true }]);
      const fakes = res.issues.filter((i) => i.type === 'fake-symbol').map((i) => i.value);
      assert.ok(fakes.includes('notReal'), 'the fake symbol should flag');
      assert.ok(!fakes.includes('connect') && !fakes.includes('Client'), 'real venv-lib calls must not flag');
    });
});

test('Python grounding degrades gracefully (no venv / unresolved dep)', () => {
  // requirements but no venv
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-py-none-'));
  try {
    fs.writeFileSync(path.join(dir, 'requirements.txt'), 'ghost\n');
    const idx = lib.buildLibraryIndex(dir, { version: '8.0.0' });
    assert.strictEqual(idx.libraries.length, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  // venv present but dep not installed
  withPyProject('ghost==1\n', {}, (dir) => {
    const idx = lib.buildLibraryIndex(dir, { version: '8.0.0' });
    assert.strictEqual(idx.libraries.length, 0);
  });
});

console.log(`\nlib-index: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
