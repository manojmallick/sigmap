'use strict';

/**
 * Import-resolver accuracy harness (#980): `scripts/run-import-accuracy.mjs`, the comparison in
 * `scripts/lib/import-accuracy.mjs`, the per-language references in `scripts/import-accuracy/`
 * and the page tables in `scripts/lib/import-accuracy-doc.mjs`.
 *
 * The harness compares the import graph's file-to-file edges with the edges a language's own
 * tooling reports. What is pinned here is the part that has to be right for the numbers to mean
 * anything: which edges count (only those whose importing file BOTH sides read), that the
 * interval is reproducible and a thin cell is marked, that the protocol committed before the run
 * is the one the harness reads and the prose quotes, that every registered repository is pinned
 * to the commit the other manifests pin, and that the page cannot differ from the saved report.
 * The C reference runs the real compiler over a few lines of C and skips (loudly) where clang is
 * absent; the PHP and component references skip unless SIGMAP_IMPORT_REFERENCES names the
 * directory `run-import-accuracy.mjs --setup-references` filled.
 *
 * Run: node test/integration/import-accuracy.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const RUNNER = path.join(ROOT, 'scripts/run-import-accuracy.mjs');

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

const tmpDirs = [];
function tmp(prefix) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  tmpDirs.push(d);
  return d;
}
function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
const have = (cmd) => { const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' }); return !r.error && r.status === 0; };

(async () => {
  const lib = await import(path.join(ROOT, 'scripts/lib/import-accuracy.mjs'));
  const doc = await import(path.join(ROOT, 'scripts/lib/import-accuracy-doc.mjs'));
  const runner = await import(RUNNER);
  const protocol = lib.loadProtocol(ROOT);

  // ── comparing edges ────────────────────────────────────────────────────────

  const e = (...pairs) => pairs.map((p) => p.split('>'));
  const everyone = () => true;

  await test('an edge is scored only when its importing file is in the universe: walked AND covered by the reference', () => {
    const r = lib.compareImports({
      graphEdges: e('a>b', 'a>c', 'd>e', 'z>q'),
      refEdges: e('a>b', 'a>x', 'd>e', 'f>g'),
      walked: new Set(['a', 'd', 'z']), covered: new Set(['a', 'd', 'f']), importers: everyone,
    });
    assert.deepStrictEqual([r.counts.walked, r.counts.covered], [3, 3]);
    assert.deepStrictEqual([r.counts.graphEdgesOutsideUniverse, r.counts.referenceEdgesOutsideUniverse], [1, 1]);
    assert.strictEqual(r.counts.universe, 2, 'f is covered by the reference but not walked by the graph; z is walked but not covered');
    assert.strictEqual(r.counts.truePositives, 2);
    assert.strictEqual(r.counts.graphEdges, 3, 'z>q is not scored');
    assert.strictEqual(r.counts.referenceEdges, 3, 'f>g is not scored');
    assert.deepStrictEqual(r.samples.missed, ['a -> x']);
    assert.deepStrictEqual(r.samples.wrong, ['a -> c']);
  });

  await test('why an edge is missed or wrong: the adapter\'s account, else the file it reaches; a file importing itself is named', () => {
    const r = lib.compareImports({
      graphEdges: e('a.vue>a.vue', 'a.vue>k.ts'), walked: new Set(['a.vue']), covered: new Set(['a.vue']), importers: everyone,
      refEdges: [['a.vue', 'm.d.ts', 'a bare specifier'], ['a.vue', 'n.d.ts', 'a bare specifier'], ['a.vue', 'x.inc'], ['a.vue', 'k.ts', 'a relative path']],
    });
    assert.deepStrictEqual(r.diagnostics.missedByKind, { 'a bare specifier': 2, 'reaches a .inc file': 1 }, 'k.ts was found, so it is not a miss');
    assert.deepStrictEqual(r.diagnostics.wrongByKind, { 'a file importing itself': 1 });
    assert.deepStrictEqual(lib.sumKinds([{ x: 1, y: 2 }, { x: 3 }, undefined]), { x: 4, y: 2 });
  });

  await test('an edge to a file outside the walk is still compared: the graph cannot have it, so it is a miss, not scope', () => {
    const r = lib.compareImports({ graphEdges: [], refEdges: e('a>outside'), walked: new Set(['a']), covered: new Set(['a']), importers: everyone });
    assert.strictEqual(r.counts.referenceEdges, 1);
    assert.deepStrictEqual(r.samples.missed, ['a -> outside']);
  });

  await test('the importing-file filter keeps each group to its own files; a reference self-edge is not an edge', () => {
    const r = lib.compareImports({
      graphEdges: e('a.c>b.h', 'doc.md>a.c'), refEdges: e('a.c>b.h', 'a.c>a.c', 'doc.md>a.c'),
      walked: new Set(['a.c', 'doc.md']), covered: new Set(['a.c', 'doc.md']), importers: (f) => f.endsWith('.c'),
    });
    assert.strictEqual(r.counts.universe, 1);
    assert.strictEqual(r.counts.referenceEdges, 1, 'neither the markdown file nor a.c -> a.c');
    assert.strictEqual(r.counts.graphEdges, 1);
    assert.strictEqual(r.counts.truePositives, 1);
  });

  await test('the pooled table: values, a thin cell is marked, and the interval is the same on every run', () => {
    const big = new Map();
    for (let i = 0; i < 300; i++) big.set(`f${i}`, { ref: 1, graph: 2, tp: i % 10 === 0 ? 0 : 1 });
    const thin = new Map([['x', { ref: 3, graph: 3, tp: 3 }]]);
    const a = lib.tableOf([big], protocol);
    assert.strictEqual(a.precision.n, 600, 'precision is over the graph edges');
    assert.strictEqual(a.recall.n, 300, 'recall is over the reference edges');
    assert.ok(Math.abs(a.precision.value - 270 / 600) < 1e-9, 'true positives / graph edges');
    assert.ok(Math.abs(a.recall.value - 270 / 300) < 1e-9, 'true positives / reference edges');
    assert.strictEqual(a.precision.small, false);
    assert.ok(a.precision.lo < a.precision.value && a.precision.value < a.precision.hi);
    assert.deepStrictEqual(lib.tableOf([big], protocol), a, 'the bootstrap seed is registered, so the interval is reproducible');
    assert.strictEqual(lib.tableOf([thin], protocol).precision.small, true, 'fewer than 100 edges is not quoted');
    const pooled = lib.tableOf([big, thin], protocol);
    assert.strictEqual(pooled.precision.n, 603, 'two repositories pool by summing their files, not by averaging their rates');
    assert.strictEqual(pooled.recall.n, 303);
  });

  await test('the Swift edge list is the module relation the product reports; a target\'s importers are listed once however many of its files are asked', () => {
    const impact = (root, file) => {
      const mod = file.includes('Core') ? 'Core' : file.includes('Net') ? 'Net' : null;
      if (!mod) return null;
      return { module: mod, importers: mod === 'Core' ? ['App/main.swift', 'Net/Net.swift'] : [] };
    };
    const edges = lib.swiftModuleEdges(impact, '/r', ['Core/A.swift', 'Core/B.swift', 'Net/N.swift', 'Loose.swift']);
    assert.deepStrictEqual(edges, [['App/main.swift', 'module:Core'], ['Net/Net.swift', 'module:Core']], 'Core/A and Core/B both ask for Core: two edges, not four; a file in no target adds none');
  });

  await test('the Swift edge list built from the real moduleImpact: the whole relation, and a repository without a Package.swift has none', () => {
    const { moduleImpact, swiftFiles } = require('../../src/graph/swift-modules');
    const root = tmp('sigmap-impacc-swiftgraph-');
    put(path.join(root, 'Package.swift'), ['// swift-tools-version:5.9', 'import PackageDescription', 'let package = Package(name: "Pkg", targets: [',
      '    .target(name: "Core"),', '    .executableTarget(name: "App", dependencies: ["Core"]),', '    .target(name: "Net", path: "Libs/Net"),',
      '    .testTarget(name: "CoreTests", dependencies: ["Core"]),', '])'].join('\n'));
    const files = {
      'Sources/Core/Core.swift': 'public struct Core {}\n', 'Sources/Core/Inner.swift': 'import Foundation\nimport Core\nstruct Inner { let c = Core() }\n',
      'Sources/App/main.swift': 'import Foundation\nimport Core\nprint(Core())\n', 'Libs/Net/Net.swift': '@testable import Core\n',
      'Tests/CoreTests/CoreTests.swift': '@testable import Core\nimport XCTest\n', 'Sources/App/Other.swift': 'import struct Core.Core\n',
      'Sources/App/NotCore.swift': 'import CoreFoundation\n',
    };
    for (const [rel, text] of Object.entries(files)) put(path.join(root, rel), text);
    assert.deepStrictEqual(lib.swiftModuleEdges(moduleImpact, root, swiftFiles(root)).map((x) => x.join(' ')).sort(),
      ['Libs/Net/Net.swift module:Core', 'Sources/App/Other.swift module:Core', 'Sources/App/main.swift module:Core', 'Tests/CoreTests/CoreTests.swift module:Core'],
      'Inner.swift imports its own target and CoreFoundation is not a target');
    const bare = tmp('sigmap-impacc-swiftbare-');
    put(path.join(bare, 'a.swift'), 'import Foundation\n');
    assert.deepStrictEqual(lib.swiftModuleEdges(moduleImpact, bare, ['a.swift']), [], 'no Package.swift, no targets, no edge');
  });

  // ── the protocol ───────────────────────────────────────────────────────────

  await test('the protocol pins every repository to the commit the other manifests pin, and keeps development repositories out', () => {
    const xrepo = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/xrepo-repos.json'), 'utf8')).repos.map((r) => [r.name, r]));
    const seen = [];
    for (const [group, def] of Object.entries(protocol.groups)) {
      if (def.reference === null) {
        assert.ok(def.unmeasured && def.unmeasured.length > 20, `${group} is unmeasured without a reason`);
        assert.deepStrictEqual(def.repos.eval, [], `${group} has no reference, so no repository is registered for it`);
        continue;
      }
      assert.ok(def.repos.eval.length >= 2, `${group} has fewer than two evaluation repositories`);
      for (const r of def.repos.eval) {
        seen.push(r.name);
        assert.match(r.commit, /^[0-9a-f]{40}$/, `${r.name}: not a full commit`);
        assert.strictEqual(r.commit, xrepo[r.name] && xrepo[r.name].commit, `${r.name}: the protocol and the xrepo manifest disagree`);
        assert.strictEqual(Boolean(r.sparse), Boolean(xrepo[r.name].sparse), `${r.name}: sparse-ness differs from the xrepo manifest`);
      }
    }
    assert.strictEqual(new Set(seen).size, seen.length, 'a repository is listed twice');
    for (const dev of ['spdlog', 'vitepress', 'guzzle']) assert.ok(!seen.includes(dev), `${dev} was used to develop an adapter and must not be measured`);
    assert.deepStrictEqual(Object.keys(protocol.unmeasured).sort(), Object.entries(protocol.groups).filter(([, d]) => d.reference === null).map(([k]) => k).sort());
    assert.deepStrictEqual([protocol.bootstrap.resamples, protocol.bootstrap.seed, protocol.minSample], [2000, 980, 100]);
  });

  await test('every prediction names a measured group and a metric; the tools are pinned exactly', () => {
    for (const p of protocol.predictions) {
      assert.ok(protocol.groups[p.group] && protocol.groups[p.group].reference, `${p.id}: ${p.group} is not a measured group`);
      assert.ok(['precision', 'recall'].includes(p.metric) && p.op === '>=' && p.value > 0 && p.value <= 1, `${p.id}: malformed`);
    }
    assert.deepStrictEqual(new Set(protocol.predictions.map((p) => p.id)).size, protocol.predictions.length);
    for (const [name, version] of Object.entries(protocol.tools.npm)) assert.match(version, /^\d+\.\d+\.\d+$/, `${name} is not pinned to a version`);
    for (const a of Object.values(protocol.tools.php.archives)) assert.match(a.sha256, /^[0-9a-f]{64}$/);
    assert.match(protocol.tools.php.composer.sha256, /^[0-9a-f]{64}$/);
  });

  await test('the prose protocol quotes the numbers the harness reads and names every registered repository and prediction', () => {
    const prose = fs.readFileSync(path.join(ROOT, 'benchmarks/IMPORT_RESOLVER_PROTOCOL.md'), 'utf8');
    for (const s of ['2000 resamples of importing files, seed 980, 95%', '100 edges', '## 9. Deviation log', 'C#, Dart, Lua and GDScript are unmeasured']) {
      assert.ok(prose.includes(s), `the prose protocol does not say "${s}"`);
    }
    for (const def of Object.values(protocol.groups)) for (const r of def.repos.eval) assert.ok(prose.includes(r.name), `${r.name} is not in the prose protocol`);
    for (const p of protocol.predictions) assert.ok(prose.includes(`**${p.id}.**`), `${p.id} is not in the prose protocol`);
    for (const [name, version] of Object.entries(protocol.tools.npm)) assert.ok(JSON.stringify(protocol).includes(version) && name.length > 0);
  });

  await test('protocolState: an untracked or edited protocol file is not "committed"; a committed one is, with its hash', () => {
    const repo = tmp('sigmap-impacc-proto-');
    const git = (...a) => spawnSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
    git('init', '-q');
    put(path.join(repo, lib.PROTOCOL_REL), '{"a":1}\n');
    const first = lib.protocolState(repo);
    assert.strictEqual(first.committed, false, 'untracked');
    assert.strictEqual(first.commit, null);
    git('add', lib.PROTOCOL_REL);
    git('commit', '-q', '-m', 'protocol');
    const second = lib.protocolState(repo);
    assert.strictEqual(second.committed, true);
    assert.match(second.commit, /^[0-9a-f]{40}$/);
    assert.match(second.sha256, /^[0-9a-f]{64}$/);
    put(path.join(repo, lib.PROTOCOL_REL), '{"a":2}\n');
    const third = lib.protocolState(repo);
    assert.strictEqual(third.committed, false, 'edited after the commit');
    assert.notStrictEqual(third.sha256, second.sha256);
  });

  // ── the page ───────────────────────────────────────────────────────────────

  const cellOf = (value, n, lo, hi) => ({ value, n, lo, hi, small: n < 100 });
  const synthetic = () => ({
    version: '9.9.9', sigmap: { commit: 'abcdef0123456789' }, protocol: { commit: '0123456789abcdef' },
    environment: { node: 'v22.0.0', platform: 'darwin-arm64' },
    groups: { c: { repos: ['libuv', 'abseil-cpp'], reference: 'Apple clang 17', counts: {}, diagnostics: { missedByKind: { 'reaches a .inc file': 11 }, wrongByKind: { 'reaches a .h file': 7, 'a file importing itself': 1 } }, table: { precision: cellOf(0.91, 400, 0.88, 0.94), recall: cellOf(0.97, 380, 0.95, 0.99), f1: 0.939 } },
      swift: { repos: ['alamofire'], reference: 'swift 6.2', counts: {}, table: { precision: cellOf(1, 12, 1, 1), recall: cellOf(1, 12, 1, 1), f1: 1 } } },
    repos: { c: { libuv: { status: 'measured', commit: 'a'.repeat(40), diagnostics: { missedByKind: { 'reaches a .inc file': 11 }, wrongByKind: {} }, counts: { universe: 90, walked: 100, covered: 95, referenceEdges: 200, graphEdges: 210, truePositives: 190, graphEdgesOutsideUniverse: 3, referenceEdgesOutsideUniverse: 4 } },
      'abseil-cpp': { status: 'unmeasured', commit: 'b'.repeat(40), reason: 'no clone at /x' } } },
    unmeasured: { 'c/abseil-cpp': 'no clone at /x' }, unregistered: { lua: 'no reference exists to run' },
    predictions: { P1: { claim: 'C recall is at least 90%', status: 'held', value: 0.97 }, P7: { claim: 'Swift precision', status: 'not-testable', value: 1 } },
  });

  await test('the page block: quotes the report, marks a thin cell, lists what was not measured, and injects idempotently', () => {
    const block = doc.renderBlock(synthetic());
    assert.ok(block.startsWith(doc.BEGIN) && block.endsWith(doc.END));
    assert.ok(block.includes('| **C / C++ / Objective-C** | libuv, abseil-cpp | 380 | 97.0% (95-99) | 400 | 91.0% (88-94) | 93.9% |'), block);
    assert.ok(block.includes('n=12, too few'), 'a cell under the minimum is not quoted');
    assert.ok(block.includes('| reaches a .inc file | 11 |'), 'the reasons edges were missed');
    assert.ok(block.includes('| C / C++ / Objective-C | libuv | reaches a .inc file | 11 |'), 'and the repository they are in');
    assert.ok(block.includes('| **all** | **8** |'), 'and the graph edges the reference lacks, in total');
    assert.ok(block.includes('| Reference edges the graph lacks, by how the import reaches its file | C / C++ / Objective-C |\n'), 'a group without diagnostics has no column');
    assert.ok(block.includes('| Lua | language | no reference exists to run |'));
    assert.ok(block.includes('| C / C++ / Objective-C | abseil-cpp | `bbbbbbb` | unmeasured'));
    assert.ok(block.includes('| P1 | C recall is at least 90% | held | 97.0% |'));
    const page = `# t\n\nprose\n\n${doc.BEGIN}\nold\n${doc.END}\n\nmore prose\n`;
    const once = doc.inject(page, block);
    assert.ok(once.includes('prose\n\n' + doc.BEGIN) && once.endsWith('more prose\n'));
    assert.strictEqual(doc.extract(once), block);
    assert.strictEqual(doc.inject(once, block), once, 'regenerating a current page changes nothing');
    assert.strictEqual(doc.inject('no markers', block), null);
  });

  // ── the saved report, the page, and the figures other documents quote ───────

  const reportFile = path.join(ROOT, runner.REPORT_REL);
  const pageFile = path.join(ROOT, runner.PAGE_REL);
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert.ok(fs.existsSync(reportFile), `${runner.REPORT_REL} is missing: node scripts/run-import-accuracy.mjs --references <dir> --save`);
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const page = fs.readFileSync(pageFile, 'utf8');
  const p1 = (v) => `${(100 * v).toFixed(1)}%`;
  const n0 = (n) => n.toLocaleString('en-US');
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

  await test('the saved report came from the committed protocol, a clean tree, and covers every registered repository, pinned to its commit', () => {
    assert.strictEqual(report.benchmark, 'import-accuracy');
    assert.strictEqual(report.protocol.committed, true, 'the report was made from an edited protocol');
    assert.strictEqual(report.protocol.sha256, lib.protocolState(ROOT).sha256, 'the report was scored under another protocol than the committed one');
    assert.match(report.protocol.commit, /^[0-9a-f]{40}$/);
    assert.strictEqual(report.sigmap.dirty, false, 'the report was made from a dirty tree');
    assert.match(report.sigmap.commit, /^[0-9a-f]{40}$/);
    const listed = Object.entries(protocol.groups).flatMap(([g, def]) => def.repos.eval.map((r) => `${g}/${r.name}`)).sort();
    const reported = Object.entries(report.repos).flatMap(([g, byRepo]) => Object.keys(byRepo).map((n) => `${g}/${n}`)).sort();
    assert.deepStrictEqual(reported, listed, 'a registered repository is missing from the report, or one was added');
    for (const [g, byRepo] of Object.entries(report.repos)) {
      for (const [name, r] of Object.entries(byRepo)) {
        assert.strictEqual(r.commit, protocol.groups[g].repos.eval.find((x) => x.name === name).commit, `${g}/${name} was measured at another commit than the protocol pins`);
        assert.ok(r.status === 'measured' || (r.reason && r.reason.length > 20), `${g}/${name} is unmeasured without a reason`);
      }
    }
    assert.deepStrictEqual(Object.keys(report.unregistered).sort(), ['csharp', 'dart', 'gdscript', 'lua']);
    assert.deepStrictEqual(Object.keys(report.predictions).sort(), protocol.predictions.map((p) => p.id).sort(), 'every registered prediction has a result, and only those');
  });

  await test('the tables on the page are the tables the saved report renders to', () => {
    assert.strictEqual(doc.extract(page), doc.renderBlock(report), 'run: node scripts/run-import-accuracy.mjs --write-doc');
  });

  await test('every claim the page\'s prose makes about the headline findings is one the report yields', () => {
    const g = report.groups;
    const has = (text) => assert.ok(page.includes(text), `the page does not say "${text}"`);
    const { LEGACY_FAMILIES, GRAPH_FAMILIES } = require('../../src/graph/builder');
    assert.deepStrictEqual([LEGACY_FAMILIES.length, GRAPH_FAMILIES.length], [8, 15]);
    has('Until #980 it read eight language families; it now reads fifteen');
    // components: perfect precision, the lowest recall, and the one prediction that was missed
    assert.strictEqual(g.sfc.table.precision.value, 1);
    has('Every edge the graph draws between components is one the reference has');
    const lowest = Object.entries(g).sort((a, b) => a[1].table.recall.value - b[1].table.recall.value)[0][0];
    assert.strictEqual(lowest, 'sfc');
    has('component recall is the lowest of the four groups');
    assert.deepStrictEqual(Object.entries(report.predictions).filter(([, p]) => p.status === 'missed').map(([id]) => id), ['P4']);
    assert.strictEqual(protocol.predictions.find((p) => p.id === 'P4').value, 0.9);
    has('The registered prediction was 90% recall; it was **missed**');
    // where the component misses are
    const bare = 'a bare specifier that resolves inside the repository';
    const mapped = 'written .js/.jsx, the file is .ts/.tsx';
    assert.strictEqual(g.sfc.diagnostics.missedByKind[bare], report.repos.sfc.svelte.diagnostics.missedByKind[bare], 'every bare-specifier miss is in svelte');
    has('all of the "bare specifier" misses are in that one repository');
    assert.strictEqual(g.sfc.diagnostics.missedByKind[mapped], report.repos.sfc.astro.diagnostics.missedByKind[mapped]);
    assert.strictEqual(g.sfc.diagnostics.missedByKind[mapped], 12);
    has('a dozen edges, all in astro');
    assert.ok(g.sfc.diagnostics.missedByKind[bare] > g.sfc.diagnostics.missedByKind[mapped], 'the package naming itself is the larger cause');
    has('the larger cause is the package naming itself, in svelte');
    // C: the missed edges are all .inc, the extra ones are headers; PHP: one extra edge; Swift: one miss, in vapor
    assert.deepStrictEqual(Object.keys(g.c.diagnostics.missedByKind), ['reaches a .inc file']);
    has('The missed edges are all `.inc` files');
    assert.strictEqual(sum(g.php.diagnostics.wrongByKind), 1);
    has('The one extra edge is a literal `require` of a file');
    assert.strictEqual(sum(g.swift.diagnostics.missedByKind), 1);
    assert.strictEqual(sum(report.repos.swift.vapor.diagnostics.missedByKind), 1);
    has('The one miss is a C-language target of vapor');
  });

  await test("the figures KNOWN_LIMITATIONS quotes are the report's, and the other docs point at the page", () => {
    const kl = read('KNOWN_LIMITATIONS.md');
    const t = (k) => report.groups[k].table;
    const has = (text) => assert.ok(kl.includes(text), `KNOWN_LIMITATIONS does not say "${text}"`);
    has(`C and C++ ${p1(t('c').precision.value)} precision and ${p1(t('c').recall.value)} recall`);
    has(`PHP ${p1(t('php').precision.value)} and ${p1(t('php').recall.value)}`);
    has(`Swift at module level ${p1(t('swift').precision.value)} and ${p1(t('swift').recall.value)}`);
    has(`Vue, Svelte and Astro ${p1(t('sfc').precision.value)} precision and **${p1(t('sfc').recall.value)} recall**`);
    has('The registered prediction of 90% component recall was missed');
    assert.ok(kl.includes('docs-vp/guide/import-accuracy.md'));
    assert.ok(read('docs-vp/guide/cli.md').includes('(/guide/import-accuracy)'));
    assert.ok(read('docs-vp/guide/mcp.md').includes('(/guide/import-accuracy)'));
    assert.ok(read('docs-vp/.vitepress/config.mts').includes("link: '/guide/import-accuracy'"), 'the page is in the sidebar');
    assert.ok(!read('docs-vp/guide/cli.md').includes('Languages the import graph cannot read'), 'the old statement that PHP, C#, C/C++ and the component languages are unread is gone');
    assert.ok(n0(report.groups.c.table.precision.n).length > 0);
  });

  // ── the runner ─────────────────────────────────────────────────────────────

  await test('the runner reports every registered repository unmeasured, with the reason, when there are no clones; and --save refuses', () => {
    const work = tmp('sigmap-impacc-work-');
    const r = spawnSync(process.execPath, [RUNNER, '--work', work, '--repos', path.join(work, 'none'), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, SIGMAP_IMPORT_REFERENCES: '' } });
    assert.strictEqual(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout);
    const all = Object.entries(protocol.groups).flatMap(([g, def]) => def.repos.eval.map((x) => `${g}/${x.name}`));
    assert.deepStrictEqual(Object.keys(report.unmeasured).sort(), all.sort());
    for (const why of Object.values(report.unmeasured)) assert.ok(why.length > 10, 'a bare "unmeasured" says nothing');
    assert.deepStrictEqual(Object.keys(report.unregistered).sort(), ['csharp', 'dart', 'gdscript', 'lua']);

    const out = path.join(work, 'report.json');
    const s = spawnSync(process.execPath, [RUNNER, '--work', work, '--repos', path.join(work, 'none'), '--only', 'libuv', '--save', '--out', out], { encoding: 'utf8', maxBuffer: 1 << 26 });
    assert.strictEqual(s.status, 1);
    assert.match(s.stderr, /not saved: a partial run/);
    assert.ok(!fs.existsSync(out), 'a refused run writes nothing');
  });

  await test('a development run needs a tool and says so when it is missing', () => {
    const work = tmp('sigmap-impacc-dev-');
    const r = spawnSync(process.execPath, [RUNNER, '--dev', 'php', '--tree', work, '--work', work, '--references', path.join(work, 'nowhere')], { encoding: 'utf8' });
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /references\.json/);
  });

  // ── the references, on a few lines of real code ───────────────────────────

  const c = await import(path.join(ROOT, 'scripts/import-accuracy/c.mjs'));
  if (have('clang')) {
    await test('the C reference: direct includes only, resolved by the compiler; a system header, a missing header and a nested include are not edges, and a missing header does not stop the file', () => {
      const tree = tmp('sigmap-impacc-c-');
      put(path.join(tree, 'main.c'), '#include <stdio.h>\n#include "util.h"\n#include "inc/only_in_include_dir.h"\n#include <third_party/missing.h>\n#ifdef _WIN32\n#include "win.h"\n#endif\nint main(void) { return 0; }\n');
      put(path.join(tree, 'util.h'), '#pragma once\n#include "deep.h"\n');
      put(path.join(tree, 'deep.h'), '#pragma once\n');
      put(path.join(tree, 'include/inc/only_in_include_dir.h'), '#pragma once\n');
      put(path.join(tree, 'win.h'), '#pragma once\n');
      const work = tmp('sigmap-impacc-cwork-');
      const ref = c.reference({ tree, files: ['main.c', 'util.h', 'deep.h', 'win.h', 'include/inc/only_in_include_dir.h'], protocol, work });
      const got = ref.edges.map(([a, b]) => `${a} > ${b}`).sort();
      assert.deepStrictEqual(got, ['main.c > include/inc/only_in_include_dir.h', 'main.c > util.h', 'main.c > win.h', 'util.h > deep.h'],
        'win.h is behind _WIN32: the Windows configuration sees it; deep.h is util.h\'s include, not main.c\'s; stdio.h and the header the repository lacks are not in the tree, and the include after the missing one is still read');
      assert.strictEqual(ref.covered.size, 5, 'every file was preprocessed in every configuration');
      assert.strictEqual(ref.notes.failed, 0);
    });
  } else {
    skip('the C reference runs the real compiler', 'clang is not installed');
  }

  if (have('swiftc') && have('swift')) {
    const swift = await import(path.join(ROOT, 'scripts/import-accuracy/swift.mjs'));
    await test('the Swift reference: a file importing a local target from another target; main.swift (top-level code) is read, not dropped', () => {
      const tree = tmp('sigmap-impacc-swift-');
      put(path.join(tree, 'Package.swift'), ['// swift-tools-version:5.9', 'import PackageDescription', 'let package = Package(name: "Pkg", targets: [',
        '    .target(name: "Core"),', '    .executableTarget(name: "App", dependencies: ["Core"]),', '    .target(name: "Net", path: "Libs/Net"),',
        '    .testTarget(name: "CoreTests", dependencies: ["Core"]),', '    .target(name: "CLib"),', '])'].join('\n'));
      const files = {
        'Sources/Core/Core.swift': 'public struct Core {}\n', 'Sources/Core/Inner.swift': 'import Foundation\nimport Core\nstruct Inner { let c = Core() }\n',
        'Sources/App/main.swift': 'import Foundation\nimport Core\nprint(Core())\n', 'Libs/Net/Net.swift': '@testable import Core\n',
        'Tests/CoreTests/CoreTests.swift': '@testable import Core\nimport XCTest\n', 'Sources/App/Other.swift': 'import struct Core.Core\n',
        'Sources/App/NotCore.swift': 'import CoreFoundation\n', 'Sources/App/UsesC.swift': 'import CLib\n',
        'Sources/CLib/clib.c': 'int clib(void) { return 1; }\n', 'Sources/CLib/include/clib.h': 'int clib(void);\n',
      };
      for (const [rel, text] of Object.entries(files)) put(path.join(tree, rel), text);
      const list = ['Package.swift', ...Object.keys(files).filter((f) => f.endsWith('.swift'))];
      const ref = swift.reference({ tree, files: list, protocol });
      assert.ok(!(ref.notes && ref.notes.unmeasured), JSON.stringify(ref.notes));
      assert.deepStrictEqual(ref.edges.map(([a, b, kind]) => `${a} > ${b} | ${kind}`).sort(), [
        'Libs/Net/Net.swift > module:Core | a module of Swift files',
        'Sources/App/Other.swift > module:Core | a module of Swift files',
        'Sources/App/UsesC.swift > module:CLib | a module with no Swift file (a C-language target)',
        'Sources/App/main.swift > module:Core | a module of Swift files',
        'Tests/CoreTests/CoreTests.swift > module:Core | a module of Swift files',
      ], 'Inner.swift imports its own target and CoreFoundation is not a target');
      assert.strictEqual(ref.covered.size, list.length, 'every file was read: main.swift is the entry point, so top-level code is not an error');
      assert.strictEqual(ref.notes.failed, 0);
    });
  } else {
    skip('the Swift reference runs the real compiler', 'swift is not installed');
  }

  const refsDir = process.env.SIGMAP_IMPORT_REFERENCES || '';
  if (refsDir && fs.existsSync(path.join(refsDir, 'references.json'))) {
    const rec = JSON.parse(fs.readFileSync(path.join(refsDir, 'references.json'), 'utf8'));
    if (rec.php && fs.existsSync(rec.php.php)) {
      const php = await import(path.join(ROOT, 'scripts/import-accuracy/php.mjs'));
      await test('the PHP reference: the use statements Composer\'s autoloader resolves, nothing for a vendor class or a function', () => {
        const tree = tmp('sigmap-impacc-php-');
        put(path.join(tree, 'composer.json'), JSON.stringify({ name: 't/t', autoload: { 'psr-4': { 'App\\': 'src/' } } }));
        put(path.join(tree, 'src/Str.php'), '<?php\nnamespace App;\nclass Str {}\n');
        put(path.join(tree, 'src/Arr.php'), '<?php\nnamespace App;\nclass Arr {}\n');
        put(path.join(tree, 'src/Main.php'), '<?php\nnamespace App;\nuse App\\Str;\nuse App\\{Arr};\nuse Vendor\\Thing;\nuse function App\\helper;\nclass Main {}\n');
        const work = tmp('sigmap-impacc-pwork-');
        const ref = php.reference({ tree, files: ['src/Main.php', 'src/Str.php', 'src/Arr.php', 'src/Ghost.php'], tools: { php: rec.php.php, composer: rec.php.composer }, work });
        assert.ok(!(ref.notes && ref.notes.unmeasured), JSON.stringify(ref.notes));
        assert.deepStrictEqual(ref.edges.map(([a, b]) => `${a} > ${b}`).sort(), ['src/Main.php > src/Arr.php', 'src/Main.php > src/Str.php']);
        assert.deepStrictEqual([...ref.covered].sort(), ['src/Arr.php', 'src/Main.php', 'src/Str.php'], 'a file that cannot be read is not covered, so its edges are not scored');
        assert.strictEqual(ref.notes.failed, 1);
      });
    } else {
      skip('the PHP reference', 'no PHP in the references directory');
    }
    const sfc = await import(path.join(ROOT, 'scripts/import-accuracy/sfc.mjs'));
    await test('the component reference: the framework\'s script, TypeScript\'s resolution; a package and a missing file are not edges', async () => {
      const tree = tmp('sigmap-impacc-sfc-');
      put(path.join(tree, 'tsconfig.json'), JSON.stringify({ compilerOptions: { moduleResolution: 'bundler', module: 'esnext', target: 'es2020', resolveJsonModule: true, baseUrl: '.', paths: { '@/*': ['src/*'] } } }));
      put(path.join(tree, 'package.json'), JSON.stringify({ name: 'app', imports: { '#c/*': './src/*' } }));
      put(path.join(tree, 'src/App.vue'), '<script setup lang="ts">\nimport Child from "./Child.vue"\nimport { x } from "./util"\nimport vue from "vue"\nimport nope from "./nope"\nimport b from "./b.js"\nimport data from "./data.json"\nimport type { T } from "./types"\nimport z from "@/zed"\nimport o from "#c/util2.js"\n</script>\n<template><Child/></template>\n');
      put(path.join(tree, 'src/b.ts'), 'export default 1\n');
      put(path.join(tree, 'src/data.json'), '{}');
      put(path.join(tree, 'src/types.d.ts'), 'export type T = 1\n');
      put(path.join(tree, 'src/zed.ts'), 'export default 1\n');
      put(path.join(tree, 'src/util2.ts'), 'export default 2\n');
      put(path.join(tree, 'src/Child.vue'), '<template><i/></template>\n');
      put(path.join(tree, 'src/util.ts'), 'export const x = 1\n');
      put(path.join(tree, 'node_modules/vue/package.json'), '{"name":"vue","main":"index.js"}');
      put(path.join(tree, 'node_modules/vue/index.js'), 'module.exports = {}\n');
      const work = tmp('sigmap-impacc-swork-');
      const ref = await sfc.reference({ tree, files: ['src/App.vue', 'src/Child.vue'], tools: { dir: refsDir }, protocol, work });
      assert.ok(!(ref.notes && ref.notes.unmeasured), JSON.stringify(ref.notes));
      assert.deepStrictEqual(ref.edges.map(([a, b, kind]) => `${a} > ${b} | ${kind}`).sort(), [
        'src/App.vue > src/Child.vue | a relative path',
        'src/App.vue > src/b.ts | written .js/.jsx, the file is .ts/.tsx',
        'src/App.vue > src/data.json | a JSON module',
        'src/App.vue > src/types.d.ts | a relative path that resolves to a .d.ts',
        'src/App.vue > src/util.ts | a relative path',
        'src/App.vue > src/util2.ts | a "#name" import of the package.json imports map',
        'src/App.vue > src/zed.ts | a bare specifier that resolves inside the repository',
      ], 'the reference says how each import is written; vue (a package) and ./nope (no file) are not edges');
    });
  } else {
    skip('the PHP and component references', 'set SIGMAP_IMPORT_REFERENCES to the directory `run-import-accuracy.mjs --setup-references` filled');
  }

  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
  process.exit(failed > 0 ? 1 : 0);
})();
