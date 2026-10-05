'use strict';

// Retrieval on the project shapes that broke in the field: flat Go, Gradle multi-module Kotlin, SwiftPM Sources/ (#810).

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'gen-context.js');
const { resolveSourceRoots } = require(path.join(ROOT, 'src/discovery/source-root-resolver'));
const { rank, buildSigIndex } = require(path.join(ROOT, 'src/retrieval/ranker'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const dirs = [];
function repo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-layout-'));
  dirs.push(dir);
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

/** Zero-config index, exactly as a first run builds it. */
function indexOf(dir) {
  const r = spawnSync('node', [CLI], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `gen-context failed: ${r.stderr}`);
  return buildSigIndex(dir);
}

const ranked = (dir, index, query) => rank(query, index, { topK: 10, cwd: dir, learned: false }).map((r) => r.file);

// The index key for a Swift `Tests/` file depends on the filesystem: the test-root
// walk looks for `tests`, so a case-insensitive filesystem indexes it under the
// LOWERCASED key and a case-sensitive one does not index it at all. Match any case.
const isDecoy = (f) => /(^|\/)tests?(\/|$)|tests?\.(swift|kt|go)$|_test\.go$|_mock\.go$|readme|\.github\//i.test(f);

/**
 * The implementation must lead, and outrank every non-implementation file that
 * surfaced. Returns how many decoys surfaced, so a caller can say whether the
 * ordering was actually contested.
 */
function assertImplementationLeads(order, impl) {
  assert.strictEqual(order[0], impl, `expected ${impl} first, got ${JSON.stringify(order.slice(0, 5))}`);
  const at = order.indexOf(impl);
  const surfaced = order.filter(isDecoy);
  for (const o of surfaced) {
    assert.ok(order.indexOf(o) > at, `${o} (rank ${order.indexOf(o) + 1}) must not outrank ${impl} (rank ${at + 1}): ${JSON.stringify(order.slice(0, 6))}`);
  }
  return surfaced.length;
}

// ── flat Go: source at the root, as gin ships it ────────────────────────────

const flatGo = () => repo({
  'go.mod': 'module example.com/web\n\ngo 1.21\n',
  'router.go': [
    'package web',
    '',
    '// Router matches an incoming URL path to a registered handler.',
    'type Router struct{ routes map[string]Handler }',
    '',
    'func (r *Router) Register(path string, h Handler) {}',
    'func (r *Router) Match(path string) (Handler, bool) { return nil, false }',
    'func (r *Router) Dispatch(path string) {}',
    '',
  ].join('\n'),
  'context.go': 'package web\n\n// Context carries one request through the handler chain.\ntype Context struct{ index int }\n\nfunc (c *Context) Advance() {}\n',
  'router_test.go': 'package web\n\nimport "testing"\n\nfunc TestMatchesRegisteredHandler(t *testing.T) {}\nfunc TestDispatchPathToHandler(t *testing.T) {}\nfunc TestRegisterHandler(t *testing.T) {}\n',
  'router_mock.go': 'package web\n\ntype mockRouter struct{}\n\nfunc (m *mockRouter) Match(path string) (Handler, bool) { return nil, false }\nfunc (m *mockRouter) Register(path string, h Handler) {}\n',
  'testdata/fixture.go': 'package testdata\n\nvar Handler = 1\n',
  'README.md': '# web\n\nHow incoming URL paths are matched to registered handlers.\n\n## Matching paths to handlers\n',
  '.github/workflows/ci.yml': 'name: ci\non: push\njobs:\n  match:\n    name: match incoming url paths to registered handlers\n    runs-on: ubuntu-latest\n    steps:\n      - run: go test ./...\n',
});

test('flat Go: the repo root is the source root and testdata is not', () => {
  const dir = flatGo();
  const { roots } = resolveSourceRoots(dir);
  assert.ok(roots.includes('.'), `the root must be a source root, got ${JSON.stringify(roots)}`);
  assert.ok(!roots.includes('testdata'), `testdata must never be a source root, got ${JSON.stringify(roots)}`);
});

test('flat Go: root-level implementation is indexed', () => {
  const dir = flatGo();
  const index = indexOf(dir);
  for (const f of ['router.go', 'context.go']) assert.ok(index.has(f), `${f} missing from the index: ${[...index.keys()].join(', ')}`);
});

test('flat Go: the implementation outranks its test, mock, README and CI file', () => {
  const dir = flatGo();
  const index = indexOf(dir);
  const order = ranked(dir, index, 'how are incoming url paths matched to the registered handlers');
  const contested = assertImplementationLeads(order, 'router.go');
  assert.ok(contested >= 3, `the ordering must be contested — only ${contested} decoy(s) surfaced: ${JSON.stringify(order)}`);
});

// ── Gradle multi-module Kotlin, as OkHttp ships it ──────────────────────────

const kotlin = () => repo({
  'settings.gradle.kts': 'rootProject.name = "acme"\ninclude(":core")\ninclude(":client")\n',
  'build.gradle.kts': 'plugins { kotlin("jvm") version "1.9.0" apply false }\n',
  'core/build.gradle.kts': 'plugins { kotlin("jvm") }\n',
  'client/build.gradle.kts': 'plugins { kotlin("jvm") }\n',
  'core/src/main/kotlin/com/acme/core/BackoffPolicy.kt': [
    'package com.acme.core',
    '',
    '/** Decides how long to wait before a failed call is attempted again. */',
    'class BackoffPolicy(private val baseMillis: Long) {',
    '  fun nextDelay(attempt: Int): Long = baseMillis shl attempt',
    '  fun shouldAttemptAgain(status: Int): Boolean = status >= 500',
    '}',
    '',
  ].join('\n'),
  'core/src/test/kotlin/com/acme/core/BackoffPolicyTest.kt': 'package com.acme.core\n\nclass BackoffPolicyTest {\n  fun nextDelayGrowsWithEachAttempt() {}\n  fun shouldAttemptAgainOnServerError() {}\n}\n',
  'client/src/main/kotlin/com/acme/client/Connector.kt': 'package com.acme.client\n\nclass Connector {\n  fun open(host: String) {}\n  fun close() {}\n}\n',
  'client/src/test/kotlin/com/acme/client/FakeConnector.kt': 'package com.acme.client\n\nclass FakeConnector {\n  fun nextDelay(attempt: Int): Long = 0\n  fun shouldAttemptAgain(status: Int): Boolean = false\n}\n',
  'README.md': '# acme\n\nHow long the client waits before a failed call is attempted again.\n\n## Waiting before another attempt\n',
});

test('Kotlin multi-module: every module\'s main source set is a root and test source sets are not', () => {
  const dir = kotlin();
  const { roots } = resolveSourceRoots(dir);
  const joined = roots.join(',');
  assert.ok(/core\/src\/main/.test(joined), `core's main source set must be a root, got ${joined}`);
  assert.ok(/client\/src\/main/.test(joined), `client's main source set must be a root, got ${joined}`);
  assert.ok(!/src\/test/.test(joined), `a test source set must not be a root, got ${joined}`);
});

test('Kotlin multi-module: implementation in EVERY module is indexed', () => {
  const dir = kotlin();
  const index = indexOf(dir);
  for (const f of ['core/src/main/kotlin/com/acme/core/BackoffPolicy.kt', 'client/src/main/kotlin/com/acme/client/Connector.kt']) {
    assert.ok(index.has(f), `${f} missing from the index: ${[...index.keys()].join(', ')}`);
  }
});

test('Kotlin multi-module: test source sets never reach the index, and the implementation leads what does', () => {
  const dir = kotlin();
  const index = indexOf(dir);
  // Here the protection is EXCLUSION at detection, not demotion at ranking: the
  // test and the fake carry the query's vocabulary and would outrank otherwise.
  for (const f of ['core/src/test/kotlin/com/acme/core/BackoffPolicyTest.kt', 'client/src/test/kotlin/com/acme/client/FakeConnector.kt']) {
    assert.ok(!index.has(f), `${f} must not be indexed: ${[...index.keys()].join(', ')}`);
  }
  const order = ranked(dir, index, 'how long does the client wait before trying a failed call again');
  assertImplementationLeads(order, 'core/src/main/kotlin/com/acme/core/BackoffPolicy.kt');
});

// ── SwiftPM: Sources/<Target>/ beside Tests/<Target>Tests/, as Alamofire ships it ──

const swift = () => repo({
  'Package.swift': '// swift-tools-version:5.9\nimport PackageDescription\nlet package = Package(name: "Networking", targets: [.target(name: "Networking"), .testTarget(name: "NetworkingTests", dependencies: ["Networking"])])\n',
  'Sources/Networking/Session.swift': 'import Foundation\n\npublic final class Session {\n  public func send(_ request: URLRequest) {}\n  public func cancelAll() {}\n}\n',
  'Sources/Networking/Pacer.swift': [
    'import Foundation',
    '',
    '/// Decides how long a failed request waits before it is sent again.',
    'public struct Pacer {',
    '  public func delay(forAttempt attempt: Int) -> TimeInterval { 0 }',
    '  public func shouldSendAgain(statusCode: Int) -> Bool { statusCode >= 500 }',
    '}',
    '',
  ].join('\n'),
  'Tests/NetworkingTests/PacerTests.swift': 'import XCTest\n\nfinal class PacerTests: XCTestCase {\n  func testDelayForAttemptGrows() {}\n  func testShouldSendAgainOnServerError() {}\n}\n',
  'README.md': '# Networking\n\nHow long a failed request waits before it is sent again.\n\n## Waiting before sending again\n',
  '.github/workflows/ci.yml': 'name: ci\non: push\njobs:\n  wait:\n    name: how long a failed request waits before it is sent again\n    runs-on: macos-latest\n    steps:\n      - run: swift test\n',
});

test('Swift Sources/: the target sources are roots and Tests/ is not', () => {
  const dir = swift();
  const { roots } = resolveSourceRoots(dir);
  const joined = roots.join(',');
  assert.ok(/Sources/.test(joined), `Sources must be reached, got ${joined}`);
  assert.ok(!/(^|,)Tests(\/|,|$)/.test(joined), `Tests must not be a root, got ${joined}`);
});

test('Swift Sources/: every target source file is indexed', () => {
  const dir = swift();
  const index = indexOf(dir);
  for (const f of ['Sources/Networking/Session.swift', 'Sources/Networking/Pacer.swift']) {
    assert.ok(index.has(f), `${f} missing from the index: ${[...index.keys()].join(', ')}`);
  }
});

test('Swift Sources/: the implementation outranks its XCTest file and the CI workflow wherever they are indexed', () => {
  const dir = swift();
  const index = indexOf(dir);
  const order = ranked(dir, index, 'how long does a failed request wait before it goes out again');
  const contested = assertImplementationLeads(order, 'Sources/Networking/Pacer.swift');
  assert.ok(contested >= 1, `the CI workflow shares the query's vocabulary and must surface: ${JSON.stringify(order)}`);
});

for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
