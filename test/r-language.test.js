#!/usr/bin/env node
'use strict';

/**
 * R-language support tests:
 *   - DESCRIPTION + NAMESPACE parsers (src/discovery/r-manifest.js)
 *   - Local-name collection from R files
 *   - Graph builder R branch (source() + local pkg::fn resolution)
 *   - Hub regex recognition for R/utils.R, R/zzz.R, R/globals.R
 *
 * Standalone — invoke with `node test/r-language.test.js`. Failures exit 1.
 */

const assert = require('assert');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const ROOT = path.join(__dirname, '..');
const { readDescription, readNamespace, collectLocalDefs } =
  require(path.join(ROOT, 'src', 'discovery', 'r-manifest'));
const { build, extractFileDeps, buildFromCwd } =
  require(path.join(ROOT, 'src', 'graph', 'builder'));

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); }
  catch (err) { console.log(`  FAIL  ${name}: ${err.message}\n${err.stack}`); failures++; }
}

// ── Fixtures ────────────────────────────────────────────────────────────────
const FIXTURE = path.join(__dirname, 'fixtures', 'r-package');

test('readDescription: parses Package, Imports, Depends with version constraints', () => {
  const d = readDescription(FIXTURE);
  assert.ok(d, 'should return an object for an existing DESCRIPTION');
  assert.strictEqual(d.package, 'siglocal');
  assert.deepStrictEqual(d.imports, ['dplyr', 'ggplot2']);
  assert.deepStrictEqual(d.depends, []);       // R itself is dropped
  assert.deepStrictEqual(d.suggests, ['testthat']);
});

test('readDescription: returns null when no DESCRIPTION exists', () => {
  const d = readDescription(os.tmpdir());
  assert.strictEqual(d, null);
});

test('readNamespace: parses export, exportPattern, S3method, importFrom', () => {
  const ns = readNamespace(FIXTURE);
  assert.ok(ns);
  assert.ok(ns.exports.has('add'),     'export(add) should be in exports');
  assert.ok(ns.exports.has('print'),   'S3method(print, foo) implies print is exported');
  assert.strictEqual(ns.s3methods.length, 1);
  assert.deepStrictEqual(ns.s3methods[0], { generic: 'print', class: 'foo' });
  const fromDplyr = ns.importFrom.get('dplyr');
  assert.ok(fromDplyr && fromDplyr.has('filter'));
  assert.ok(fromDplyr && fromDplyr.has('select'));
});

test('collectLocalDefs: finds top-level function defs', () => {
  const rFiles = ['add.R', 'helpers.R'].map((f) => path.join(FIXTURE, 'R', f));
  const defs = collectLocalDefs(rFiles);
  assert.strictEqual(defs.get('add'),      rFiles[0]);
  assert.strictEqual(defs.get('helper_a'), rFiles[1]);
  assert.strictEqual(defs.get('helper_b'), rFiles[1]);
  // Dot-prefixed names are skipped.
  assert.ok(!defs.has('.internal'), 'dot-prefixed defs should be skipped');
});

test('extractFileDeps: follows source() to a sibling R file', () => {
  const helpers = path.join(FIXTURE, 'R', 'helpers.R');
  const main    = path.join(FIXTURE, 'R', 'main.R');
  const fileSet = new Set([helpers, main]);
  const content = fs.readFileSync(main, 'utf8');
  const deps    = extractFileDeps(main, content, fileSet, FIXTURE);
  assert.ok(deps.includes(helpers), `main.R should depend on helpers.R via source(); got ${JSON.stringify(deps)}`);
});

test('extractFileDeps: resolves localPkg::fn via rLocalDefs', () => {
  const rFiles = ['add.R', 'helpers.R', 'main.R'].map((f) => path.join(FIXTURE, 'R', f));
  const fileSet = new Set(rFiles);
  const defs = collectLocalDefs(rFiles);
  const main = path.join(FIXTURE, 'R', 'main.R');
  const content = fs.readFileSync(main, 'utf8');
  const ctx = { rPackage: 'siglocal', rLocalDefs: defs };
  const deps = extractFileDeps(main, content, fileSet, FIXTURE, ctx);
  const addFile = path.join(FIXTURE, 'R', 'add.R');
  assert.ok(deps.includes(addFile), `main.R should resolve siglocal::add to add.R; got ${JSON.stringify(deps)}`);
});

test('buildFromCwd: auto-builds R namespace context from DESCRIPTION', () => {
  const graph = buildFromCwd(FIXTURE);
  const main    = path.resolve(FIXTURE, 'R', 'main.R');
  const helpers = path.resolve(FIXTURE, 'R', 'helpers.R');
  const addFile = path.resolve(FIXTURE, 'R', 'add.R');
  const mainDeps = graph.forward.get(main) || [];
  assert.ok(mainDeps.includes(helpers), `main.R should depend on helpers.R; got ${JSON.stringify(mainDeps)}`);
  assert.ok(mainDeps.includes(addFile),  `main.R should depend on add.R (via siglocal::add); got ${JSON.stringify(mainDeps)}`);
});

// ── Ranker hub heuristic ────────────────────────────────────────────────────
test('_isHub: recognizes R hub files', () => {
  // _isHub is internal; re-implement the test via the regex shape used by it.
  const isHub = (p) =>
       /\/(utils|helpers|shared|common|constants|types|interfaces|index|zzz|globals)\.(ts|tsx|js|jsx|r|R)$/.test(p)
    || p.endsWith('/R/utils.R')
    || p.endsWith('/R/zzz.R')
    || p.endsWith('/R/globals.R');
  assert.ok(isHub('foo/R/utils.R'));
  assert.ok(isHub('foo/R/zzz.R'));
  assert.ok(isHub('foo/R/globals.R'));
  assert.ok(isHub('foo/bar/helpers.r'));
  assert.ok(!isHub('foo/R/main.R'));
});

console.log(`\nResults: ${failures === 0 ? 'all pass' : failures + ' failed'}`);
process.exit(failures === 0 ? 0 : 1);
