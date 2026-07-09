'use strict';

/**
 * Graph builder alias resolution (P1) — tsconfig/jsconfig `paths` + `baseUrl`,
 * re-exports, and dynamic import() now produce dependency edges that the old
 * relative-only resolver missed.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { build, loadAliasMap, resolveAlias } = require('../../../src/graph/builder');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++; }
}

function withProject(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-alias-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
    fn(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const norm = (p) => path.normalize(p).toLowerCase();

console.log('[graph-aliases.test.js] tsconfig paths + baseUrl + re-export + dynamic import\n');

test('loadAliasMap parses tsconfig paths + baseUrl', () => {
  withProject({
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
  }, (dir) => {
    const m = loadAliasMap(dir);
    assert.ok(m, 'expected an alias map');
    assert.ok(m.entries.some((e) => e.prefix === '@/' && e.wildcard), `entries: ${JSON.stringify(m.entries)}`);
  });
});

test('loadAliasMap tolerates JSONC (comments + trailing commas)', () => {
  withProject({
    'tsconfig.json': '{\n  // a comment\n  "compilerOptions": { "paths": { "@/*": ["src/*"], } },\n}',
  }, (dir) => {
    const m = loadAliasMap(dir);
    assert.ok(m && m.entries.length === 1, `parse failed: ${JSON.stringify(m)}`);
  });
});

test('aliased import (@/foo) creates a real dependency edge', () => {
  withProject({
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    'src/util.ts': 'export const x = 1;\n',
    'src/app.ts': 'import { x } from "@/util";\nexport const y = x;\n',
  }, (dir) => {
    const graph = build([path.join(dir, 'src/util.ts'), path.join(dir, 'src/app.ts')], dir);
    const util = norm(path.join(dir, 'src/util.ts'));
    const app = norm(path.join(dir, 'src/app.ts'));
    assert.ok((graph.forward.get(app) || []).includes(util), 'app.ts should depend on util.ts via @/ alias');
    assert.ok((graph.reverse.get(util) || []).includes(app), 'util.ts reverse-dep should include app.ts');
  });
});

test('WITHOUT a tsconfig the aliased import is (correctly) unresolved', () => {
  withProject({
    'src/util.ts': 'export const x = 1;\n',
    'src/app.ts': 'import { x } from "@/util";\n',
  }, (dir) => {
    const graph = build([path.join(dir, 'src/util.ts'), path.join(dir, 'src/app.ts')], dir);
    const app = norm(path.join(dir, 'src/app.ts'));
    assert.deepStrictEqual(graph.forward.get(app) || [], [], 'no alias config → no edge (baseline behavior)');
  });
});

test('re-export (export … from) creates an edge (barrel files)', () => {
  withProject({
    'src/a.ts': 'export const a = 1;\n',
    'src/index.ts': 'export { a } from "./a";\n',
  }, (dir) => {
    const graph = build([path.join(dir, 'src/a.ts'), path.join(dir, 'src/index.ts')], dir);
    const a = norm(path.join(dir, 'src/a.ts'));
    const idx = norm(path.join(dir, 'src/index.ts'));
    assert.ok((graph.forward.get(idx) || []).includes(a), 'index.ts should re-export a.ts');
  });
});

test('dynamic import() creates an edge', () => {
  withProject({
    'src/lazy.ts': 'export const z = 2;\n',
    'src/main.ts': 'async function f(){ return import("./lazy"); }\n',
  }, (dir) => {
    const graph = build([path.join(dir, 'src/lazy.ts'), path.join(dir, 'src/main.ts')], dir);
    const lazy = norm(path.join(dir, 'src/lazy.ts'));
    const main = norm(path.join(dir, 'src/main.ts'));
    assert.ok((graph.forward.get(main) || []).includes(lazy), 'main.ts should depend on lazy.ts via dynamic import');
  });
});

test('bare npm imports do NOT create false edges', () => {
  withProject({
    'src/app.ts': 'import React from "react";\nimport _ from "lodash";\n',
  }, (dir) => {
    const graph = build([path.join(dir, 'src/app.ts')], dir);
    assert.deepStrictEqual(graph.forward.get(norm(path.join(dir, 'src/app.ts'))) || [], [], 'npm packages are not repo files');
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
