'use strict';

/**
 * Regression tests for #934 — the import graph, the call graph and the
 * live-overlay freshen walk the source roots detection chose, not a hard-coded
 * `src app lib` list.
 *
 * Before the fix a repo with no `srcDirs` pin whose code sits in `mypkg/`,
 * `django/` or the repo root got an EMPTY graph: `--impact` and `--callers`
 * answered "nothing depends on this" with no warning, and `freshen` never
 * healed an edit. 21 of the 50 benchmark clones were in that state.
 *
 * Each acceptance criterion gets a test that fails against the pre-fix code.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const GEN = path.join(ROOT, 'gen-context.js');

const { buildFromCwd, buildRankingGraph, build, extractFileDeps, DEFAULT_SRC_DIRS } = require('../../src/graph/builder');
const { buildCallGraph, buildCallFileGraph, buildRankingCallFileGraph } = require('../../src/graph/call-graph');
const { resolveGraphDirs, mergeDirs, configuredSrcDirs } = require('../../src/graph/src-dirs');
const { graphKey } = require('../../src/graph/path-key');
const { freshen } = require('../../src/cache/freshen');
const overlay = require('../../src/cache/overlay');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const made = [];
function tmpRepo(tag) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `sigmap-roots-${tag}-`)));
  made.push(d);
  return d;
}
function write(root, rel, body) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return abs;
}
const nodes = (g) => [...g.forward.keys()];
const hasNode = (g, tail) => nodes(g).some((k) => k.endsWith(tail.toLowerCase()));
const edgeCount = (g) => [...g.forward.values()].reduce((n, v) => n + v.length, 0);
const importersOf = (g, tail) => {
  const k = nodes(g).find((n) => n.endsWith(tail.toLowerCase()));
  return k ? (g.reverse.get(k) || []) : null;
};

/** A Django-shaped package: nothing under src/app/lib, no config file. */
function pythonPackage() {
  const r = tmpRepo('py');
  write(r, 'mypkg/__init__.py', '');
  write(r, 'mypkg/models.py', 'def save_record(x):\n    return x\n');
  write(r, 'mypkg/views.py', 'from mypkg.models import save_record\n\ndef handle(req):\n    return save_record(req)\n');
  write(r, 'mypkg/urls.py', 'from .views import handle\n\nurlpatterns = [handle]\n');
  write(r, 'tests/test_views.py', 'from mypkg.views import handle\n\ndef test_handle():\n    assert handle(1) == 1\n');
  return r;
}

/** A flat Go module: the code is at the repo root (cobra, gin, gorm, echo). */
function goModule() {
  const r = tmpRepo('go');
  write(r, 'go.mod', 'module example.com/m\n\ngo 1.21\n');
  write(r, 'main.go', 'package main\n\nimport "example.com/m/store"\n\nfunc main() { store.Put(1) }\n');
  write(r, 'util.go', 'package main\n\nfunc helper() {}\n');
  write(r, 'store/store.go', 'package store\n\nfunc Put(x int) {}\n');
  return r;
}

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

test('mergeDirs: order-preserving union; one directory spelled two ways is kept once', () => {
  assert.deepStrictEqual(mergeDirs(['pkg', 'src'], ['src', 'app', 'lib']), ['pkg', 'src', 'app', 'lib']);
  assert.deepStrictEqual(mergeDirs(['./src/'], ['src', 'lib']), ['./src/', 'lib']);
  assert.deepStrictEqual(mergeDirs([], ['src']), ['src']);
});

test('resolveGraphDirs: a config pin wins, and brings no exclude list of its own', () => {
  const r = pythonPackage();
  write(r, 'gen-context.config.json', JSON.stringify({ srcDirs: ['other'] }));
  const d = resolveGraphDirs(r, DEFAULT_SRC_DIRS);
  assert.deepStrictEqual(d.srcDirs, ['other']);
  assert.strictEqual(d.source, 'config');
  assert.strictEqual(d.exclude, null, 'a pinned repo keeps its caller\'s legacy exclude list');
  assert.deepStrictEqual(configuredSrcDirs(r), ['other']);
});

test('resolveGraphDirs: no pin → the detected roots first, then the defaults', () => {
  const r = pythonPackage();
  const d = resolveGraphDirs(r, DEFAULT_SRC_DIRS);
  assert.strictEqual(d.source, 'detected');
  assert.strictEqual(d.srcDirs[0], 'mypkg', `detection's root must come first: ${JSON.stringify(d.srcDirs)}`);
  for (const dflt of DEFAULT_SRC_DIRS) assert.ok(d.srcDirs.includes(dflt), `default ${dflt} must remain (union)`);
});

test('resolveGraphDirs: node_modules and .git stay excluded even when the project sets its own exclude', () => {
  const r = pythonPackage();
  write(r, 'gen-context.config.json', JSON.stringify({ exclude: ['dist'] }));
  const d = resolveGraphDirs(r, DEFAULT_SRC_DIRS);
  assert.strictEqual(d.source, 'detected', 'a config without srcDirs is still a detected walk');
  assert.ok(d.exclude.includes('node_modules') && d.exclude.includes('.git'), JSON.stringify(d.exclude));
  assert.ok(d.exclude.includes('dist'), 'the project\'s own entries are honoured');
});

// ---------------------------------------------------------------------------
// Import graph
// ---------------------------------------------------------------------------

test('import graph: a package outside src/app/lib is walked, and its imports resolve', () => {
  const r = pythonPackage();
  const g = buildFromCwd(r);
  assert.ok(hasNode(g, 'mypkg/models.py'), `the package must be in the graph: ${JSON.stringify(nodes(g))}`);
  const imps = importersOf(g, 'mypkg/models.py');
  assert.ok(imps && imps.some((k) => k.endsWith('mypkg/views.py')), 'views.py must be recorded as importing models.py');
});

test('import graph: a flat Go module (detected root `.`) resolves its imports', () => {
  const r = goModule();
  const g = buildFromCwd(r);
  assert.ok(hasNode(g, 'main.go') && hasNode(g, 'store/store.go'), JSON.stringify(nodes(g)));
  const imps = importersOf(g, 'store/store.go');
  assert.ok(imps && imps.some((k) => k.endsWith('main.go')), 'main.go must import store/store.go');
});

test('import graph: a config pin still wins over detection', () => {
  const r = pythonPackage();
  write(r, 'other/thing.py', 'X = 1\n');
  write(r, 'gen-context.config.json', JSON.stringify({ srcDirs: ['other'] }));
  const g = buildFromCwd(r);
  assert.ok(hasNode(g, 'other/thing.py'));
  assert.ok(!hasNode(g, 'mypkg/models.py'), 'the detected package must not be walked when the project pinned srcDirs');
});

test('import graph: explicit opts.srcDirs still wins over detection', () => {
  const r = pythonPackage();
  write(r, 'other/thing.py', 'X = 1\n');
  const g = buildFromCwd(r, { srcDirs: ['other'] });
  assert.ok(hasNode(g, 'other/thing.py'));
  assert.ok(!hasNode(g, 'mypkg/models.py'));
});

test('import graph: the conventional defaults are still walked beside the detected roots', () => {
  const r = pythonPackage();
  write(r, 'src/legacy.py', 'def old():\n    return 1\n');
  const g = buildFromCwd(r);
  assert.ok(hasNode(g, 'mypkg/models.py'), 'detected root');
  assert.ok(hasNode(g, 'src/legacy.py'), 'a default dir must never drop out of the graph');
});

test('import graph: build output under a detected root is not walked', () => {
  const r = goModule();
  write(r, 'vendor/dep/dep.go', 'package dep\n\nfunc D() {}\n');
  write(r, 'node_modules/x/index.js', 'module.exports = 1;\n');
  const g = buildFromCwd(r);
  assert.ok(!hasNode(g, 'vendor/dep/dep.go'), 'vendor/ is in the index\'s exclude list');
  assert.ok(!nodes(g).some((k) => k.includes('node_modules')), 'node_modules is never source');
});

// ---------------------------------------------------------------------------
// Call graph
// ---------------------------------------------------------------------------

test('call graph: definitions and the scope reported follow the detected roots', () => {
  const r = pythonPackage();
  const cg = buildCallGraph(r);
  const names = [...cg.defs.values()].map((d) => d.name);
  assert.ok(names.includes('save_record') && names.includes('handle'), `defs: ${names.join(',')}`);
  assert.ok(cg.scope.roots.includes('mypkg'), `scope must name the root searched: ${JSON.stringify(cg.scope.roots)}`);
});

test('call graph: a config pin still wins', () => {
  const r = pythonPackage();
  write(r, 'other/t.py', 'def only_here():\n    return 1\n');
  write(r, 'gen-context.config.json', JSON.stringify({ srcDirs: ['other'] }));
  const names = [...buildCallGraph(r).defs.values()].map((d) => d.name);
  assert.deepStrictEqual(names, ['only_here']);
});

test('MCP get_method_impact (no srcDirs passed) answers on a zero-config package layout', () => {
  const r = pythonPackage();
  const { getMethodImpact } = require('../../src/mcp/handlers');
  const text = getMethodImpact({ symbol: 'save_record' }, r);
  assert.ok(/handle/.test(text), `callers of save_record must include handle():\n${text}`);
});

// ---------------------------------------------------------------------------
// The product surfaces that built the graph with no srcDirs
// ---------------------------------------------------------------------------

test('CLI: --impact lists the importers of a file in a zero-config package layout', () => {
  const r = pythonPackage();
  const out = spawnSync(process.execPath, [GEN, '--impact', 'mypkg/models.py'], { cwd: r, encoding: 'utf8' });
  const text = (out.stdout || '') + (out.stderr || '');
  assert.ok(/views\.py/.test(text), `--impact mypkg/models.py must name its importer views.py:\n${text}`);
});

test('CLI: plan carries the blast radius of a zero-config package layout', () => {
  const r = pythonPackage();
  const gen = spawnSync(process.execPath, [GEN], { cwd: r, encoding: 'utf8' });
  assert.strictEqual(gen.status, 0, `generate failed: ${gen.stderr}`);
  const out = spawnSync(process.execPath, [GEN, 'plan', 'change how save_record stores a record', '--json'], { cwd: r, encoding: 'utf8' });
  const text = (out.stdout || '') + (out.stderr || '');
  assert.ok(/views\.py/.test(text), `the plan must reach views.py through the import graph:\n${text}`);
});

test('MCP get_impact: the cached knowledge map of an older schema is rebuilt, not trusted', () => {
  const r = pythonPackage();
  const gen = spawnSync(process.execPath, [GEN], { cwd: r, encoding: 'utf8' });
  assert.strictEqual(gen.status, 0, `generate failed: ${gen.stderr}`);
  const km = require('../../src/map/knowledge-map');
  const { getImpact } = require('../../src/mcp/handlers');

  // A map built before the fix: right cache key, previous schema, no edges.
  const cachePath = path.join(r, '.context', 'knowledge-map.json');
  const fresh = km.loadOrBuild(r);
  fs.writeFileSync(cachePath, JSON.stringify({ schema: km.SCHEMA_VERSION - 1, builtFor: fresh.builtFor, nodes: [], edges: [] }));

  const text = getImpact({ file: 'mypkg/models.py' }, r);
  assert.ok(/views\.py/.test(text), `get_impact must see views.py importing models.py:\n${text}`);
  assert.strictEqual(JSON.parse(fs.readFileSync(cachePath, 'utf8')).schema, km.SCHEMA_VERSION, 'the cache must be rewritten at the current schema');
});

// ---------------------------------------------------------------------------
// What ranking is handed does not change (#935 owns that)
// ---------------------------------------------------------------------------

test('ranking graph: the pre-#934 walk, so no published number and no baseline moves', () => {
  const r = pythonPackage();
  assert.ok(nodes(buildFromCwd(r)).length > 0, 'precondition: the blast-radius graph sees the package');
  assert.strictEqual(nodes(buildRankingGraph(r)).length, 0, 'the ranker must keep the conventional-names walk');
});

test('ranking graph: a pin and an explicit srcDirs behave exactly as buildFromCwd', () => {
  const r = pythonPackage();
  write(r, 'other/thing.py', 'X = 1\n');
  assert.deepStrictEqual(nodes(buildRankingGraph(r, { srcDirs: ['other'] })), nodes(buildFromCwd(r, { srcDirs: ['other'] })));
  write(r, 'gen-context.config.json', JSON.stringify({ srcDirs: ['other'] }));
  assert.deepStrictEqual(nodes(buildRankingGraph(r)), nodes(buildFromCwd(r)));
});

test('ranking graph: src/ is still walked (the unchanged default)', () => {
  const r = tmpRepo('rk');
  write(r, 'src/a.js', "const b = require('./b');\n");
  write(r, 'src/b.js', 'module.exports = {};\n');
  const g = buildRankingGraph(r);
  assert.ok(hasNode(g, 'src/a.js') && hasNode(g, 'src/b.js'));
  assert.ok(importersOf(g, 'src/b.js').some((k) => k.endsWith('src/a.js')));
});

test('ranking call graph: the opt-in call-neighbour boost keeps its src/app/lib walk', () => {
  const r = pythonPackage();
  assert.ok(buildCallFileGraph(r).forward.size > 0, 'precondition: the detected-roots call graph has edges');
  assert.strictEqual(buildRankingCallFileGraph(r).forward.size, 0);
});

test('the ranker is fed the ranking graph by the eval runner and the MCP query tool', () => {
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert.ok(/buildRankingGraph\(cwd\)/.test(read('src/eval/runner.js')), 'src/eval/runner.js');
  assert.ok(/buildRankingGraph\(cwd\)/.test(read('src/mcp/handlers.js')), 'src/mcp/handlers.js (query_context)');
  assert.ok(/buildRankingCallFileGraph\(cwd\)/.test(read('src/mcp/handlers.js')), 'src/mcp/handlers.js (callGraphBoost)');
});

// ---------------------------------------------------------------------------
// Live-overlay freshen
// ---------------------------------------------------------------------------

test('freshen: an edit under a detected root of a zero-config repo is healed', () => {
  const r = pythonPackage();
  const gen = spawnSync(process.execPath, [GEN], { cwd: r, encoding: 'utf8' });
  assert.strictEqual(gen.status, 0, `generate failed: ${gen.stderr}`);
  const file = path.join(r, 'mypkg', 'models.py');
  fs.writeFileSync(file, 'def save_record(x):\n    return x\n\ndef brand_new_thing(y):\n    return y\n');
  const ahead = new Date(Date.now() + 5000); // unambiguously after the index began
  fs.utimesSync(file, ahead, ahead);
  assert.ok(freshen(r, { force: true }) >= 1, 'freshen must re-read the edited file');
  const entry = overlay.load(r).get('mypkg/models.py');
  assert.ok(entry && !entry.deleted, 'the overlay must now describe mypkg/models.py');
});

// ---------------------------------------------------------------------------
// Import resolution is table-driven now — and must resolve exactly as the scan did
// ---------------------------------------------------------------------------

const keysOf = (...abs) => new Set(abs.map((p) => graphKey(p)));

/** The pre-#934 JVM resolver, verbatim in behaviour: scan every file, per import, per extension. */
function referenceJvm(fileSet, imp) {
  const asPath = imp.replace(/\./g, path.sep);
  const out = [];
  for (const ext of ['.java', '.kt', '.kts', '.scala', '.sc']) {
    for (const f of fileSet) {
      const k = graphKey(f);
      if (k.endsWith(graphKey(asPath + ext))) { out.push(k); break; }
    }
  }
  return out;
}

test('JVM resolution: same edges as the linear scan, including bare names and ties', () => {
  const abs = path.sep + 'r';
  const set = keysOf(
    `${abs}/c/BarFoo.java`,        // a bare `Foo.java` is also its tail — the scan matched it
    `${abs}/a/Foo.java`,
    `${abs}/b/Foo.java`,           // same file name, another package: first in set order wins
    `${abs}/pkg/util/Helper.kt`,
    `${abs}/pkg/util/Helper.scala`,
    `${abs}/pkg/util/Other.java`,
  );
  for (const imp of ['pkg.util.Helper', 'Foo', 'a.Foo', 'b.Foo', 'pkg.util.Other', 'pkg.util.Missing', 'util.Helper']) {
    const content = `import ${imp};\n`;
    const got = extractFileDeps(`${abs}/Main.java`, content, set, abs, {});
    assert.deepStrictEqual([...got].sort(), [...new Set(referenceJvm(set, imp))].sort(), `import ${imp}`);
  }
});

test('Go resolution: a file named for the import and a directory named for it, first in set order', () => {
  const abs = path.sep + 'r';
  const set = keysOf(
    `${abs}/x/store/z.go`,         // directory component `store`
    `${abs}/y/store.go`,           // file named `store.go`
    `${abs}/q/other.go`,
  );
  const reference = (suffix) => {
    for (const k of set) {
      if (k.endsWith(path.sep + suffix + '.go') || k.includes(path.sep + suffix + path.sep)) return k;
    }
    return null;
  };
  for (const suffix of ['store', 'other', 'missing']) {
    const content = `package main\nimport "example.com/m/${suffix}"\n`;
    const got = extractFileDeps(`${abs}/main.go`, content, set, abs, {});
    const want = reference(suffix);
    assert.deepStrictEqual(got, want ? [want] : [], `import …/${suffix}`);
  }
});

test('Elixir resolution: longest snake_case suffix first, the importing file skipped', () => {
  const abs = path.sep + 'r';
  const set = keysOf(`${abs}/lib/my_app/billing/invoice.ex`, `${abs}/lib/other/invoice.ex`, `${abs}/lib/my_app/billing.ex`);
  const got = extractFileDeps(`${abs}/lib/my_app/web.ex`, 'defmodule W do\n  alias MyApp.Billing.Invoice\nend\n', set, abs, {});
  assert.deepStrictEqual(got, [graphKey(`${abs}/lib/my_app/billing/invoice.ex`)]);
});

test('cost: a few thousand JVM files resolve in linear time (was O(imports × files))', () => {
  const r = tmpRepo('jvm');
  const FILES = 2500;
  const PKGS = 50;
  const files = [];
  for (let i = 0; i < FILES; i++) {
    const pkg = `p${i % PKGS}`;
    const imports = [];
    for (let k = 1; k <= 12; k++) {
      const j = (i * 7 + k * 13) % FILES;
      imports.push(`import com.acme.p${j % PKGS}.C${j};`);
    }
    files.push(write(r, `src/main/java/com/acme/${pkg}/C${i}.java`,
      `package com.acme.${pkg};\n${imports.join('\n')}\npublic class C${i} {}\n`));
  }
  const t0 = Date.now();
  const g = build(files, r);
  const ms = Date.now() - t0;
  assert.strictEqual(g.forward.size, FILES);
  assert.ok(edgeCount(g) > FILES, `imports must resolve: ${edgeCount(g)} edges`);
  // The scan took minutes at this size; the tables take well under a second.
  assert.ok(ms < 15000, `graph build took ${ms}ms — import resolution is no longer linear`);
});

for (const d of made) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }

console.log(`\ngraph-follows-detected-roots: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
