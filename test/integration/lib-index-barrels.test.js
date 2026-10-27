'use strict';

/**
 * #990 — the installed-library index was empty for the libraries people actually
 * use, and the output still said it grounded against them.
 *
 * `resolveEntry` read only the package's entry `.d.ts`. zod and rxjs keep their
 * names behind `export * from './…'` barrels, so they read as 0 and 1 names.
 * Each fixture below fails on the code before this change:
 *
 *   1. a `export *` barrel is followed (cycles, `./x.js` → `x.d.ts`, `export * as ns`)
 *   2. `typesVersions` redirects the entry (and a range newer than the assumed compiler does not)
 *   3. the `exports` map's `types` condition is the entry
 *   4. `node_modules/@types/<dep>` supplies an untyped package's declarations
 *   5. what could not be followed is reported as partial, never silently dropped
 *   6. a changed child file invalidates the cached entry
 *   7. the result is deterministic, and a barrel library no longer false-flags its own calls
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '../..');
const { buildLibraryIndex } = require(path.join(ROOT, 'src', 'verify', 'lib-index'));
const { verify } = require(path.join(ROOT, 'src', 'verify', 'hallucination-guard'));
const { libraryLines } = require(path.join(ROOT, 'src', 'verify', 'coverage'));

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

const made = [];

/** A project whose node_modules holds the given packages: { name: { 'package.json': {...}, 'file.d.ts': 'text' } }. */
function project(packages, deps) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-libidx-'));
  made.push(dir);
  const declared = deps || Object.keys(packages).filter((n) => !n.startsWith('@types/'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'proj', version: '1.0.0', dependencies: Object.fromEntries(declared.map((d) => [d, '*'])) }));
  for (const [name, files] of Object.entries(packages)) {
    for (const [rel, body] of Object.entries(files)) {
      const abs = path.join(dir, 'node_modules', name, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, typeof body === 'string' ? body : JSON.stringify(body));
    }
  }
  return dir;
}

const lib = (idx, name) => idx.libraries.find((l) => l.name === name);

// ---------------------------------------------------------------------------
// 1. Barrels
// ---------------------------------------------------------------------------
const barrel = project({
  barrel: {
    'package.json': { name: 'barrel', version: '1.0.0', types: 'index.d.ts' },
    'index.d.ts': "export * from './core';\nexport * from './util/index';\nexport * as ns from './ns';\nexport { thing as renamed } from './other';\n",
    'core.d.ts': "export declare function alpha(): void;\nexport declare class Beta {}\nexport * from './index';\n", // a cycle
    'util/index.d.ts': "export declare const gamma: number;\nexport * from './deep.js';\n",
    'util/deep.d.ts': 'export declare function delta(): void;\n',
    'ns.d.ts': 'export declare const inner: number;\n',
  },
});

test('export * barrels are followed: names behind ./core, ./util/index and ./deep.js are indexed', () => {
  const idx = buildLibraryIndex(barrel, { cache: false });
  for (const n of ['alpha', 'Beta', 'gamma', 'delta']) assert.ok(idx.symbols.has(n), `missing ${n}`);
  assert.ok(idx.symbols.has('ns') && idx.symbols.has('renamed'), 'export * as ns and export { x as y } from');
  assert.strictEqual(lib(idx, 'barrel').symbols, 6);
  assert.ok(!lib(idx, 'barrel').partial, 'everything behind it was readable');
});

test('a barrel library no longer false-flags its own calls as fake symbols', () => {
  const answer = 'Call `alpha()` and `delta()`, then `notInBarrel()`.';
  const { issues } = verify(answer, barrel);
  const fake = issues.filter((i) => i.type === 'fake-symbol').map((i) => i.value);
  assert.ok(!fake.includes('alpha') && !fake.includes('delta'), `barrel names were flagged: ${fake}`);
});

// ---------------------------------------------------------------------------
// 2. typesVersions
// ---------------------------------------------------------------------------
test('typesVersions redirects the entry; a range newer than the assumed compiler does not apply', () => {
  const dir = project({
    tv: {
      'package.json': { name: 'tv', version: '2.0.0', types: 'index.d.ts', typesVersions: { '>=99.0': { '*': ['future/*'] }, '>=4.0': { '*': ['ts4/*'] } } },
      'index.d.ts': 'export declare const wrong: number;\n',
      'ts4/index.d.ts': 'export declare const viaTypesVersions: number;\n',
      'future/index.d.ts': 'export declare const tooNew: number;\n',
    },
  });
  const idx = buildLibraryIndex(dir, { cache: false });
  assert.ok(idx.symbols.has('viaTypesVersions'), [...idx.symbols].join());
  assert.ok(!idx.symbols.has('wrong') && !idx.symbols.has('tooNew'));
});

// ---------------------------------------------------------------------------
// 3. exports.types
// ---------------------------------------------------------------------------
test('the exports map types condition is the entry (nested import/require, and a subpath map)', () => {
  const dir = project({
    nested: {
      'package.json': { name: 'nested', version: '1.0.0', exports: { '.': { import: { types: './esm/index.d.mts', default: './esm/index.mjs' }, require: { types: './cjs/index.d.cts', default: './cjs/index.cjs' } }, './sub': { types: './sub.d.ts' } } },
      'esm/index.d.mts': 'export declare const fromEsm: number;\n',
      'cjs/index.d.cts': 'export declare const fromCjs: number;\n',
      'sub.d.ts': 'export declare const subpathOnly: number;\n',
    },
    flat: {
      'package.json': { name: 'flat', version: '1.0.0', exports: { types: './t.d.ts', default: './t.js' } },
      't.d.ts': 'export declare const fromConditions: number;\n',
    },
    jsonly: {
      'package.json': { name: 'jsonly', version: '1.0.0', exports: { '.': './lib/main.js' } },
      'lib/main.d.ts': 'export declare const pairedWithJs: number;\n',
    },
  });
  const idx = buildLibraryIndex(dir, { cache: false });
  assert.ok(idx.symbols.has('fromEsm'), 'nested import.types');
  assert.ok(!idx.symbols.has('subpathOnly'), 'a subpath export is not the root');
  assert.ok(idx.symbols.has('fromConditions'), 'top-level conditions');
  assert.ok(idx.symbols.has('pairedWithJs'), './lib/main.js is paired with lib/main.d.ts');
});

// ---------------------------------------------------------------------------
// 4. @types/<dep>
// ---------------------------------------------------------------------------
test('node_modules/@types/<dep> supplies an untyped package (plain and scoped)', () => {
  const dir = project({
    untyped: { 'package.json': { name: 'untyped', version: '3.1.0', main: 'index.js' } },
    '@types/untyped': { 'package.json': { name: '@types/untyped', version: '3.0.9', types: 'index.d.ts' }, 'index.d.ts': 'export declare function fromAtTypes(): void;\n' },
    '@scope/pkg': { 'package.json': { name: '@scope/pkg', version: '0.4.0' } },
    '@types/scope__pkg': { 'package.json': { name: '@types/scope__pkg', version: '0.4.1' }, 'index.d.ts': 'export declare function scopedAtTypes(): void;\n' },
    truly: { 'package.json': { name: 'truly', version: '1.0.0' } },
  });
  const idx = buildLibraryIndex(dir, { cache: false });
  assert.ok(idx.symbols.has('fromAtTypes'));
  assert.ok(idx.symbols.has('scopedAtTypes'));
  assert.strictEqual(lib(idx, 'untyped').version, '3.1.0', 'the pin is the installed package, not its @types');
  assert.strictEqual(lib(idx, 'truly').symbols, 0);
  assert.strictEqual(lib(idx, 'truly').typed, false);
});

// ---------------------------------------------------------------------------
// 5. Partial
// ---------------------------------------------------------------------------
test('re-exports that cannot be followed make the library partial, and the footer says so', () => {
  const dir = project({
    gappy: {
      'package.json': { name: 'gappy', version: '1.0.0', types: 'index.d.ts' },
      'index.d.ts': "export declare const here: number;\nexport * from './missing';\nexport * from 'some-other-package';\n",
    },
  });
  const idx = buildLibraryIndex(dir, { cache: false });
  assert.strictEqual(lib(idx, 'gappy').partial, true);
  const lines = libraryLines(idx.libraries);
  assert.ok(/gappy@1\.0\.0: 1 name indexed \(partial/.test(lines[0]), lines[0]);
});

test('footer lines: a library read as 0 names is never "grounded", and a whole one has no caveat', () => {
  const lines = libraryLines([
    { name: 'rxjs', version: '7.8.2', symbols: 0, typed: false },
    { name: 'zod', version: '4.6.7', symbols: 260, typed: true },
  ]);
  assert.strictEqual(lines[0], 'rxjs@7.8.2: no readable types — library imports not checked');
  assert.strictEqual(lines[1], 'zod@4.6.7: 260 names indexed');
  assert.ok(!lines.some((l) => /grounded/i.test(l)));
});

// ---------------------------------------------------------------------------
// 5b. Specifier shapes found in the wild (date-fns, zustand, ramda, valibot, lodash)
// ---------------------------------------------------------------------------
test('./x.ts specifiers in a .d.cts entry resolve to the .d.cts family (date-fns)', () => {
  const dir = project({
    dual: {
      'package.json': { name: 'dual', version: '1.0.0', exports: { '.': { require: { types: './index.d.cts' }, import: { types: './index.d.ts' } } } },
      'index.d.cts': 'export * from "./add.ts";\nexport * from "./sub.ts";\n',
      'add.d.cts': 'export declare function add(): void;\n',
      'sub.d.cts': 'export declare function sub(): void;\n',
    },
  });
  const idx = buildLibraryIndex(dir, { cache: false });
  assert.ok(idx.symbols.has('add') && idx.symbols.has('sub'), [...idx.symbols].join());
});

test('a bare re-export reaches another installed package, and a subpath of the package itself', () => {
  const dir = project({
    host: {
      'package.json': { name: 'host', version: '1.0.0', types: 'index.d.ts' },
      'index.d.ts': "export * from 'other-types';\nexport * from 'host/vanilla';\nexport * from '@scoped/inner';\n",
      'vanilla.d.ts': 'export declare const fromSelfSubpath: number;\n',
    },
    'other-types': { 'package.json': { name: 'other-types', version: '1.0.0', types: 'index.d.ts' }, 'index.d.ts': 'export declare const fromOtherPackage: number;\n' },
    '@scoped/inner': { 'package.json': { name: '@scoped/inner', version: '1.0.0', types: 'dist/index.d.ts' }, 'dist/index.d.ts': 'export declare const fromScoped: number;\n' },
  }, ['host']);
  const idx = buildLibraryIndex(dir, { cache: false });
  for (const n of ['fromOtherPackage', 'fromSelfSubpath', 'fromScoped']) assert.ok(idx.symbols.has(n), `missing ${n}: ${[...idx.symbols].join()}`);
  assert.ok(!lib(idx, 'host').partial, 'everything behind it was readable');
});

test('a 600 KB declaration file is read (valibot ships one)', () => {
  const body = Array.from({ length: 20000 }, (_, i) => `export declare const name${i}: number;`).join('\n');
  assert.ok(body.length > 600 * 1024);
  const dir = project({ big: { 'package.json': { name: 'big', version: '1.0.0', types: 'index.d.ts' }, 'index.d.ts': body } });
  assert.strictEqual(buildLibraryIndex(dir, { cache: false }).libraries[0].symbols, 20000);
});

test('export = makes a library partial: its members are not enumerated, and the list says so', () => {
  const dir = project({
    cjs: {
      'package.json': { name: 'cjs', version: '1.0.0', types: 'index.d.ts' },
      'index.d.ts': 'declare function cjs(): void;\ndeclare namespace cjs { function member(): void; }\nexport = cjs;\n',
    },
  });
  const l = buildLibraryIndex(dir, { cache: false }).libraries[0];
  assert.strictEqual(l.partial, true);
  assert.ok(/partial/.test(libraryLines([l])[0]), libraryLines([l])[0]);
});

// ---------------------------------------------------------------------------
// 6. Cache
// ---------------------------------------------------------------------------
test('a changed child file invalidates the cached entry', () => {
  const dir = project({
    cached: {
      'package.json': { name: 'cached', version: '1.0.0', types: 'index.d.ts' },
      'index.d.ts': "export * from './child';\n",
      'child.d.ts': 'export declare const before: number;\n',
    },
  });
  const first = buildLibraryIndex(dir, { cache: true, version: 'test' });
  assert.ok(first.symbols.has('before'));
  const again = buildLibraryIndex(dir, { cache: true, version: 'test' });
  assert.deepStrictEqual([...again.symbols], [...first.symbols], 'a second call reads the cache and agrees');

  const child = path.join(dir, 'node_modules', 'cached', 'child.d.ts');
  fs.writeFileSync(child, 'export declare const after: number;\n');
  const future = new Date(Date.now() + 5000);
  fs.utimesSync(child, future, future); // the entry file is untouched: only a part changed
  const changed = buildLibraryIndex(dir, { cache: true, version: 'test' });
  assert.ok(changed.symbols.has('after') && !changed.symbols.has('before'), [...changed.symbols].join());
});

test('a cache entry written before barrels were followed (no parts) is not trusted', () => {
  const dir = project({
    old: {
      'package.json': { name: 'old', version: '1.0.0', types: 'index.d.ts' },
      'index.d.ts': "export * from './child';\n",
      'child.d.ts': 'export declare const real: number;\n',
    },
  });
  const entry = path.join(dir, 'node_modules', 'old', 'index.d.ts');
  fs.writeFileSync(path.join(dir, '.sigmap-cache.json'), JSON.stringify({ sigmapVersion: 'test', entries: { [entry]: { mtime: fs.statSync(entry).mtimeMs, sigs: [] } } }));
  const idx = buildLibraryIndex(dir, { cache: true, version: 'test' });
  assert.ok(idx.symbols.has('real'), 'the empty entry from the old format was ignored');
});

// ---------------------------------------------------------------------------
// 7. Determinism
// ---------------------------------------------------------------------------
test('the result is deterministic for a fixed tree', () => {
  const a = buildLibraryIndex(barrel, { cache: false });
  const b = buildLibraryIndex(barrel, { cache: false });
  assert.deepStrictEqual(JSON.stringify({ s: [...a.symbols], l: a.libraries }), JSON.stringify({ s: [...b.symbols], l: b.libraries }));
});

for (const d of made) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }

console.log(`\nlib-index-barrels: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
