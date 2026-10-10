'use strict';

/**
 * Unified knowledge map, increment 1 (#626, #543): typed nodes/edges from
 * existing producers, deterministic serialization, and the epic's headline
 * query — "what breaks if I upgrade <lib>": lib → importing files → their
 * callers → the tests covering the blast set.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const CLI = path.join(ROOT, 'gen-context.js');
const km = require(path.join(ROOT, 'src/map/knowledge-map'));
const { queryKnowledgeMap, getImpact, getArchitectureOverview } = require(path.join(ROOT, 'src/mcp/handlers'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/**
 * Fixture: a declared+installed dep (leftpad, faked in node_modules), a file
 * importing it, a caller of that file, and a test covering the caller chain.
 */
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-km-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'node_modules', 'leftpad'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'km-fixture', version: '1.0.0', dependencies: { leftpad: '^9.1.0' },
    scripts: { lint: 'true' },
  }));
  fs.writeFileSync(path.join(dir, '.env.example'), 'PAD_WIDTH=8\nUNUSED_FLAG=0\n');
  fs.mkdirSync(path.join(dir, 'migrations'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'migrations', '20240101120000_create_pads.sql'), 'CREATE TABLE pads (id int);\n');
  fs.writeFileSync(path.join(dir, 'node_modules', 'leftpad', 'package.json'), JSON.stringify({
    name: 'leftpad', version: '9.1.4', main: 'index.js',
  }));
  fs.writeFileSync(path.join(dir, 'node_modules', 'leftpad', 'index.js'), 'module.exports = (s) => s;\n');
  fs.writeFileSync(path.join(dir, 'src', 'pad.js'),
    "const leftpad = require('leftpad');\nconst WIDTH = process.env.PAD_WIDTH;\nfunction padded(s) {\n  return leftpad(s, WIDTH);\n}\nmodule.exports = { padded };\n");
  fs.writeFileSync(path.join(dir, 'src', 'banner.js'),
    "const { padded } = require('./pad');\nfunction banner(text) {\n  return padded(text);\n}\nmodule.exports = { banner };\n");
  fs.writeFileSync(path.join(dir, 'test', 'banner.test.js'),
    "const { banner } = require('../src/banner');\nfunction checkBanner() {\n  return banner('x');\n}\nmodule.exports = { checkBanner };\n");
  fs.writeFileSync(path.join(dir, 'src', 'app.js'),
    "const express = require('express');\nconst app = express();\napp.get('/pad/:id', (req, res) => {\n  res.send(req.params.id);\n});\nmodule.exports = { app };\n");
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({
    srcDirs: ['src', 'test'], changes: false,
  }));
  execFileSync('node', [CLI], { cwd: dir, stdio: 'pipe' });
  return dir;
}

const dir = repo();
const map = km.buildKnowledgeMap(dir);

test('two consecutive builds are byte-identical (determinism)', () => {
  const again = km.buildKnowledgeMap(dir);
  assert.strictEqual(km.canonicalJson(map), km.canonicalJson(again));
});

test('typed nodes: files, symbols with anchors, and the pinned library', () => {
  const kinds = new Set(map.nodes.map((n) => n.kind));
  assert.ok(kinds.has('file') && kinds.has('symbol'), `missing kinds: ${[...kinds]}`);
  const lib = map.nodes.find((n) => n.kind === 'library');
  assert.ok(lib, 'library node missing');
  assert.strictEqual(lib.id, 'lib:leftpad@9.1.4', `installed version must pin the node id: ${lib.id}`);
  const sym = map.nodes.find((n) => n.id === 'symbol:src/pad.js#padded');
  assert.ok(sym && sym.anchor, `symbol with anchor missing: ${JSON.stringify(sym)}`);
});

test('edges: uses-lib, imports, defines, tests all present', () => {
  const kinds = new Set(map.edges.map((e) => e.kind));
  for (const k of ['uses-lib', 'imports', 'defines', 'tests']) {
    assert.ok(kinds.has(k), `edge kind ${k} missing (have: ${[...kinds]})`);
  }
  assert.ok(map.edges.some((e) => e.from === 'file:src/pad.js' && e.kind === 'uses-lib' && e.to === 'lib:leftpad@9.1.4'));
  assert.ok(map.edges.some((e) => e.from === 'file:src/banner.js' && e.kind === 'imports' && e.to === 'file:src/pad.js'));
});

test('route ids with spaces survive edge serialization', () => {
  const route = map.nodes.find((n) => n.kind === 'route');
  assert.ok(route, 'route node missing — expected app.get to register');
  const edge = map.edges.find((e) => e.kind === 'exposes-route');
  assert.ok(edge && edge.to === route.id && edge.to.includes(' '),
    `route edge mangled: ${JSON.stringify(edge)} vs ${route.id}`);
});

test('upgrade impact walks lib → importers → callers → tests', () => {
  const impact = km.upgradeImpact(map, 'leftpad');
  assert.ok(impact, 'no impact result');
  assert.deepStrictEqual(impact.importers, ['file:src/pad.js']);
  assert.ok(impact.callers.includes('file:src/banner.js'), `callers: ${impact.callers}`);
  assert.ok(impact.tests.includes('file:test/banner.test.js'), `tests: ${impact.tests}`);
});

test('MCP handler renders the chain and the neighbors view', () => {
  const out = queryKnowledgeMap({ library: 'leftpad' }, dir);
  assert.ok(out.includes('lib:leftpad@9.1.4'), out.slice(0, 120));
  assert.ok(out.includes('src/pad.js') && out.includes('src/banner.js') && out.includes('test/banner.test.js'));
  const neighbors = queryKnowledgeMap({ file: 'src/pad.js' }, dir);
  assert.ok(neighbors.includes('importedBy') && neighbors.includes('usesLibs'), neighbors.slice(0, 160));
  const summary = queryKnowledgeMap({}, dir);
  assert.ok(new RegExp(`schema v${km.SCHEMA_VERSION} · \\d+ nodes · \\d+ edges`).test(summary), summary);
});

test('env-var nodes carry the example flag and per-file reads-env edges', () => {
  const envNode = map.nodes.find((n) => n.id === 'env:PAD_WIDTH');
  assert.ok(envNode && envNode.kind === 'env-var' && envNode.inExample === true,
    `PAD_WIDTH node wrong: ${JSON.stringify(envNode)}`);
  assert.ok(map.edges.some((e) => e.from === 'file:src/pad.js' && e.kind === 'reads-env' && e.to === 'env:PAD_WIDTH'),
    'reads-env edge missing for src/pad.js → PAD_WIDTH');
  const unused = map.nodes.find((n) => n.id === 'env:UNUSED_FLAG');
  assert.ok(unused && unused.inExample === true, 'example-only var must still get a node');
  assert.ok(!map.edges.some((e) => e.kind === 'reads-env' && e.to === 'env:UNUSED_FLAG'),
    'example-only var must have no reader edges');
});

test('migration and script nodes from the structured collectors', () => {
  const mig = map.nodes.find((n) => n.kind === 'migration');
  assert.ok(mig && mig.id === 'migration:migrations/20240101120000_create_pads.sql'
    && mig.version === '20240101120000', `migration node wrong: ${JSON.stringify(mig)}`);
  const script = map.nodes.find((n) => n.id === 'script:script:lint');
  assert.ok(script && script.runner === 'script' && script.detail === 'npm run lint',
    `script node wrong: ${JSON.stringify(script)}`);
});

test('MCP env query renders readers and the example-declaration status', () => {
  const out = queryKnowledgeMap({ env: 'PAD_WIDTH' }, dir);
  assert.ok(out.includes('env:PAD_WIDTH') && out.includes('declared in a committed .env example: yes')
    && out.includes('src/pad.js'), out);
  const miss = queryKnowledgeMap({ env: 'NOPE_VAR' }, dir);
  assert.ok(miss.startsWith('No env-var node'), miss);
});

test('fileNeighbors exposes readsEnv', () => {
  const n = km.fileNeighbors(map, 'src/pad.js');
  assert.deepStrictEqual(n.readsEnv, ['env:PAD_WIDTH']);
});

test('schema bump invalidates a v1 cache', () => {
  const cachePath = path.join(dir, '.context', 'knowledge-map.json');
  km.loadOrBuild(dir); // populate, then poison with a v1 shell keyed to the same mtime
  const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  fs.writeFileSync(cachePath, JSON.stringify({ schema: 1, nodes: [], edges: [], truncated: [], builtFor: cached.builtFor }));
  const rebuilt = km.loadOrBuild(dir);
  assert.strictEqual(rebuilt.schema, km.SCHEMA_VERSION);
  assert.ok(rebuilt.nodes.length > 0, 'stale v1 cache must be rebuilt, not served');
});

test('producer analyze output derives from the collectors (env table rows)', () => {
  const envSchema = require(path.join(ROOT, 'src/map/env-schema'));
  const absFiles = ['src/pad.js', 'src/banner.js', 'src/app.js', 'test/banner.test.js'].map((r) => path.join(dir, r));
  const table = envSchema.analyze(absFiles, dir);
  assert.ok(table.includes('| PAD_WIDTH | code, .env.example |'), table);
  assert.ok(table.includes('| UNUSED_FLAG | .env.example |'), table);
  const rows = envSchema.collectEnvReads(absFiles, dir);
  assert.deepStrictEqual(rows.find((r) => r.name === 'PAD_WIDTH').files, ['src/pad.js']);
});

test('file nodes carry a token estimate (v3)', () => {
  const f = map.nodes.find((n) => n.id === 'file:src/pad.js');
  assert.ok(f && typeof f.tokens === 'number' && f.tokens > 0, JSON.stringify(f));
});

test('impactView parity with the graph path (direct/transitive equal, tests/routes supersets)', () => {
  const { analyzeImpact } = require(path.join(ROOT, 'src/graph/impact'));
  // The old path mangles rel display paths when the cwd contains capital
  // letters (builder lowercases keys); compare realpath-normalized abs sets.
  const realDir = fs.realpathSync(dir);
  const norm = (r, base) => {
    try { return fs.realpathSync(path.resolve(base, r)).toLowerCase(); }
    catch (_) { return path.resolve(base, r).toLowerCase(); }
  };
  const old = analyzeImpact('src/pad.js', dir, { depth: 3 })[0].impact;
  const view = km.impactView(map, 'src/pad.js', 3);
  assert.deepStrictEqual(new Set(view.direct.map((r) => norm(r, realDir))), new Set(old.direct.map((r) => norm(r, dir))));
  assert.deepStrictEqual(new Set(view.transitive.map((r) => norm(r, realDir))), new Set(old.transitive.map((r) => norm(r, dir))));
  assert.strictEqual(view.totalImpact, old.totalImpact);
  const viewTests = new Set(view.tests.map((r) => norm(r, realDir)));
  for (const t of old.tests) assert.ok(viewTests.has(norm(t, dir)), `old test ${t} missing from view`);
  const viewRoutes = new Set(view.routes.map((r) => norm(r, realDir)));
  for (const r of old.routes) assert.ok(viewRoutes.has(norm(r, dir)), `old route ${r} missing from view`);
});

test('MCP get_impact renders from the store with tests-edge enrichment', () => {
  const out = getImpact({ file: 'src/pad.js' }, dir);
  assert.ok(out.includes('## Impact: `src/pad.js`'), out.slice(0, 120));
  assert.ok(out.includes('### Direct importers') && out.includes('src/banner.js'), out);
  assert.ok(out.includes('### Affected tests') && out.includes('test/banner.test.js'), out);
});

test('MCP get_architecture_overview derives every section from the store', () => {
  const out = getArchitectureOverview({}, dir);
  assert.ok(out.includes('# Architecture overview'), out.slice(0, 80));
  assert.ok(/\*\*\d+ indexed files · \d+ modules · ~\d+ tokens\*\*/.test(out), out);
  assert.ok(out.includes('| src |'), 'module table row missing');
  assert.ok(out.includes('## Hub files (most depended-on)') && out.includes('src/pad.js'), out);
  assert.ok(out.includes('**Dependency cycles:** 0 — none detected'), out);
  assert.ok(out.includes('Routes detected: 1'), out);
});

test('view handlers reuse the cached store across calls', () => {
  const first = getArchitectureOverview({}, dir);
  const cachePath = path.join(dir, '.context', 'knowledge-map.json');
  const bytesBefore = fs.readFileSync(cachePath, 'utf8');
  const second = getArchitectureOverview({}, dir);
  assert.strictEqual(first, second);
  assert.strictEqual(fs.readFileSync(cachePath, 'utf8'), bytesBefore, 'cache must not be rewritten on a hit');
});

test('knowledge-map.js source is NUL-free so git diffs it as text', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/map/knowledge-map.js'));
  assert.ok(!src.includes(0), 'raw NUL bytes make git treat the file as binary');
});

test('relatedTestsView returns sorted tests and omits store-absent files (#635)', () => {
  const view = km.relatedTestsView(map, ['src/banner.js', 'src/pad.js', 'not/there.js']);
  assert.deepStrictEqual(view.get('src/banner.js'), ['test/banner.test.js']);
  assert.deepStrictEqual(view.get('src/pad.js'), []);
  assert.ok(!view.has('not/there.js'), 'store-absent file must be omitted, not empty');
});

test('evidence pack over the store is byte-identical to the legacy path (#635)', () => {
  const { buildEvidencePack } = require(path.join(ROOT, 'src/evidence/pack'));
  const { buildSigIndex } = require(path.join(ROOT, 'src/retrieval/ranker'));
  const store = buildEvidencePack('banner text padding', dir);
  const legacy = buildEvidencePack('banner text padding', dir, { sigIndex: buildSigIndex(dir) });
  assert.strictEqual(store.grounding.contextHash, legacy.grounding.contextHash,
    'store-backed pack must hash identically to per-file discovery');
  const banner = store.files.find((f) => f.path === 'src/banner.js');
  assert.ok(banner, `banner.js not ranked: ${store.files.map((f) => f.path)}`);
  assert.deepStrictEqual(banner.relatedTests, ['test/banner.test.js']);
});

test('injected-index pack build writes nothing for a fake cwd (#635)', () => {
  const fake = path.join(os.tmpdir(), `sigmap-km-nowrite-${process.pid}`);
  const { buildEvidencePack } = require(path.join(ROOT, 'src/evidence/pack'));
  const idx = new Map([['src/x.js', ['function x()  :1-2']]]);
  buildEvidencePack('x', fake, { sigIndex: idx });
  assert.ok(!fs.existsSync(fake), 'injected-index build must not create the cwd or a .context cache');
});

test('PR evidence derives blast + related tests from the store (#635)', () => {
  const { buildPrEvidence } = require(path.join(ROOT, 'src/review/pr-evidence'));
  const { analyzeImpact } = require(path.join(ROOT, 'src/graph/impact'));
  const ev = buildPrEvidence([{ path: 'src/banner.js', status: 'M' }], dir, { scope: 'vs main' });
  const rep = ev.files[0];
  assert.deepStrictEqual(rep.relatedTests, ['test/banner.test.js']);
  assert.ok(rep.blast, 'blast radius missing');
  const old = analyzeImpact('src/banner.js', dir, { depth: 2 })[0].impact;
  assert.strictEqual(rep.blast.total, old.totalImpact, 'store blast count must match the graph path');
  assert.strictEqual(rep.blast.direct.length, old.direct.length);
  assert.ok(rep.blast.tests.includes('test/banner.test.js'), JSON.stringify(rep.blast));
});

test('context-less store keeps graph edges when the tmp path has uppercase (#636)', () => {
  // No gen-context run: every graph endpoint resolves via relOfGraphKey. The
  // uppercase dir name forces the case-sensitive-fs fallback on Linux.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-km-CASE-'));
  try {
    fs.mkdirSync(path.join(base, 'src'), { recursive: true });
    fs.writeFileSync(path.join(base, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'] }));
    fs.writeFileSync(path.join(base, 'src', 'auth.js'), 'function login() { return true; }\nmodule.exports = { login };\n');
    fs.writeFileSync(path.join(base, 'src', 'consumer.js'), "const { login } = require('./auth');\nmodule.exports = () => login();\n");
    const m = km.buildKnowledgeMap(base);
    assert.ok(m.edges.some((e) => e.kind === 'imports' && e.from === 'file:src/consumer.js' && e.to === 'file:src/auth.js'),
      `imports edge missing from context-less store: ${JSON.stringify(m.edges.filter((e) => e.kind === 'imports'))}`);
    const view = km.impactView(m, 'src/auth.js', 2);
    assert.strictEqual(view.totalImpact, 1, JSON.stringify(view));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('the store persists to .context and cache-hits on unchanged context', () => {
  const first = km.loadOrBuild(dir);
  const cachePath = path.join(dir, '.context', 'knowledge-map.json');
  assert.ok(fs.existsSync(cachePath), 'cache file missing');
  const second = km.loadOrBuild(dir);
  assert.strictEqual(JSON.stringify(first), JSON.stringify(second));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
