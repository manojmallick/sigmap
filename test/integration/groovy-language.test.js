'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { extract } = require(path.join(__dirname, '..', '..', 'src', 'extractors', 'groovy'));
const dispatch = require(path.join(__dirname, '..', '..', 'src', 'extractors', 'dispatch'));
const { buildFromCwd } = require(path.join(__dirname, '..', '..', 'src', 'graph', 'builder'));
const { extractJavaDeps } = require(path.join(__dirname, '..', '..', 'src', 'extractors', 'deps'));
const ROOT = path.join(__dirname, '..', '..');
const CLI = path.join(ROOT, 'gen-context.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
}

test('Groovy classes and methods carry anchored signatures', () => {
  const sigs = extract('class Greeter {\n  Greeter(String name) { }\n  private String hidden() { return "x" }\n  String greet(String name) { return name }\n}\n', 'Greeter.groovy');
  assert.ok(sigs.some((s) => s.startsWith('class Greeter')));
  assert.ok(sigs.some((s) => s.includes('Greeter(name)')));
  assert.ok(sigs.some((s) => s.includes('greet(name) → String')));
  assert.ok(!sigs.some((s) => s.includes('hidden')));
});

test('both Groovy and Gradle extensions use the extractor', () => {
  assert.strictEqual(dispatch.langFor('src/main/groovy/App.groovy'), 'groovy');
  assert.strictEqual(dispatch.langFor('build.gradle'), 'groovy');
});

test('Gradle reports build surface without dependency coordinates', () => {
  const src = [
    "plugins { id 'java' }",
    'repositories { mavenCentral() }',
    'dependencies { implementation "org.example:library:1.0" }',
    "tasks.register('checkStyle') { doLast { println 'ok' } }",
  ].join('\n');
  const sigs = dispatch.extractFile('build.gradle', src);
  const text = sigs.join('\n');
  assert.ok(text.includes('plugins { }'));
  assert.ok(text.includes('repositories { }'));
  assert.ok(text.includes('dependencies { }'));
  assert.ok(text.includes("register('checkStyle')"));
  assert.ok(!text.includes('doLast()'), 'nested Gradle closures must not become DSL signatures');
  assert.ok(!text.includes('org.example:library:1.0'));
});

test('Groovy parameters render names only and balance nested defaults', () => {
  const sigs = extract('def f(String a, b = compute(1, 2)) { return b }\n', 'sample.groovy');
  assert.ok(sigs.some((s) => s.includes('f(a, b)')), `unexpected parameters: ${sigs.join('\\n')}`);
  assert.ok(!sigs.some((s) => s.includes('compute') || s.includes('String')));
});

test('Groovy named closures render their parameter names', () => {
  const sigs = extract('def handler = { String a, int b -> println(a + b) }\n', 'sample.groovy');
  assert.ok(sigs.some((s) => s.includes('def handler = { a, b -> }')));
});

test('Groovy handles annotations, empty input, and disclosed caps', () => {
  assert.deepStrictEqual(extract(''), []);
  assert.ok(extract('@CompileStatic class Fast { }', 'Fast.groovy').some((s) => s.startsWith('class Fast')));
  const source = `class Large {\n${Array.from({ length: 130 }, (_, i) => `  def method${i}() { }`).join('\n')}\n}\n`;
  const sigs = extract(source, 'Large.groovy');
  assert.ok(sigs.some((s) => String(s).includes('… +10 more methods')), 'member cap was not disclosed');
});

test('Groovy imports use JVM dependency extraction', () => {
  assert.deepStrictEqual(extractJavaDeps('import com.example.Database\n'), ['com.example']);
});

test('Jenkinsfile remains path-routed to pipeline', () => {
  assert.strictEqual(dispatch.langFor('Jenkinsfile'), 'pipeline');
});

test('Groovy imports resolve to Groovy targets in the dependency graph', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-groovy-graph-'));
  fs.mkdirSync(path.join(dir, 'src', 'main', 'groovy', 'com', 'example'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'main', 'groovy', 'com', 'example', 'App.groovy'),
    'package com.example\nimport com.example.Database\nclass App {}\n');
  fs.writeFileSync(path.join(dir, 'src', 'main', 'groovy', 'com', 'example', 'Database.groovy'),
    'package com.example\nclass Database {}\n');
  fs.writeFileSync(path.join(dir, 'build.gradle'), 'plugins { id \'groovy\' }\n');
  const graph = buildFromCwd(dir);
  const app = [...graph.forward.keys()].find((key) => key.endsWith('app.groovy'));
  assert.ok(app, 'App.groovy missing from graph');
  assert.ok((graph.forward.get(app) || []).some((key) => key.endsWith('database.groovy')),
    'Groovy import did not resolve to Database.groovy');
});

test('root build.gradle is included in generated context', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-groovy-build-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'build.gradle'), 'plugins { id \'groovy\' }\n');
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'], changes: false }));
  execFileSync(process.execPath, [CLI], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  const out = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
  assert.ok(out.includes('plugins { }'), 'root build.gradle was not included in context');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
