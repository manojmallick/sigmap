'use strict';

/**
 * `maxDepth: 6` is right for the JS/Python-shaped trees it was tuned on, but a
 * JVM layout puts one directory per package segment, so real code sits 8-10
 * levels down. On spring-petclinic that indexed 6 of 47 Java files (#590),
 * and #561 had already raised the dependency-graph walk to 12 for the same
 * reason — extraction was the shallower half of an inconsistent pair.
 *
 * The depth is raised only for JVM layouts: deepening globally cost 2.2pp on
 * the 105-task matrix corpus while the unbiased `mined` corpus stayed flat,
 * so non-JVM repos must stay untouched.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { loadConfig } = require(path.join(ROOT, 'src/config/loader'));
const { DEFAULTS } = require(path.join(ROOT, 'src/config/defaults'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

function tmpRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-depth-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  return dir;
}

const JVM_DEPTH = 12;
const JAVA_CLASS = 'package com.acme.mod;\npublic class Thing { public void run() {} }\n';

// ── JVM layouts get the deeper walk ────────────────────────────────────────

test('pom.xml marks a JVM layout', () => {
  const d = tmpRepo({ 'pom.xml': '<project/>', 'src/main/java/com/acme/mod/Thing.java': JAVA_CLASS });
  assert.strictEqual(loadConfig(d).maxDepth, JVM_DEPTH);
});

test('build.gradle(.kts) and build.sbt mark a JVM layout', () => {
  for (const marker of ['build.gradle', 'build.gradle.kts', 'build.sbt']) {
    const d = tmpRepo({ [marker]: '', 'src/main/java/com/acme/mod/Thing.java': JAVA_CLASS });
    assert.strictEqual(loadConfig(d).maxDepth, JVM_DEPTH, `${marker} not detected`);
  }
});

test('src/main/{java,kotlin,scala} alone marks a JVM layout', () => {
  for (const d of ['src/main/java', 'src/main/kotlin', 'src/main/scala']) {
    const repo = tmpRepo({ [`${d}/com/acme/mod/Thing.java`]: JAVA_CLASS });
    assert.strictEqual(loadConfig(repo).maxDepth, JVM_DEPTH, `${d} not detected`);
  }
});

test('applies with no config file at all', () => {
  const d = tmpRepo({ 'pom.xml': '<project/>', 'src/main/java/com/acme/mod/Thing.java': JAVA_CLASS });
  assert.ok(!fs.existsSync(path.join(d, 'gen-context.config.json')));
  assert.strictEqual(loadConfig(d).maxDepth, JVM_DEPTH);
});

test('applies with a config that omits maxDepth (the gate config shape)', () => {
  const d = tmpRepo({
    'pom.xml': '<project/>',
    'src/main/java/com/acme/mod/Thing.java': JAVA_CLASS,
    'gen-context.config.json': JSON.stringify({ srcDirs: ['src'] }),
  });
  assert.strictEqual(loadConfig(d).maxDepth, JVM_DEPTH);
});

test('applies when the config file is unparsable', () => {
  const d = tmpRepo({
    'pom.xml': '<project/>',
    'src/main/java/com/acme/mod/Thing.java': JAVA_CLASS,
    'gen-context.config.json': '{ not json',
  });
  assert.strictEqual(loadConfig(d).maxDepth, JVM_DEPTH);
});

// ── Explicit user intent always wins ───────────────────────────────────────

test('an explicit maxDepth wins, including a shallower one', () => {
  const d = tmpRepo({
    'pom.xml': '<project/>',
    'src/main/java/com/acme/mod/Thing.java': JAVA_CLASS,
    'gen-context.config.json': JSON.stringify({ srcDirs: ['src'], maxDepth: 4 }),
  });
  assert.strictEqual(loadConfig(d).maxDepth, 4);
});

test('an explicit deeper maxDepth is not reduced', () => {
  const d = tmpRepo({
    'pom.xml': '<project/>',
    'src/main/java/com/acme/mod/Thing.java': JAVA_CLASS,
    'gen-context.config.json': JSON.stringify({ maxDepth: 20 }),
  });
  assert.strictEqual(loadConfig(d).maxDepth, 20);
});

// ── Non-JVM repos are untouched ────────────────────────────────────────────

test('a Python repo keeps the default depth', () => {
  const d = tmpRepo({ 'setup.py': '', 'src/pkg/mod.py': 'def f():\n    pass\n' });
  assert.strictEqual(loadConfig(d).maxDepth, DEFAULTS.maxDepth);
});

test('a JS repo keeps the default depth', () => {
  const d = tmpRepo({ 'package.json': '{"name":"x"}', 'src/index.js': 'module.exports={};\n' });
  assert.strictEqual(loadConfig(d).maxDepth, DEFAULTS.maxDepth);
});

test('the default itself is unchanged', () => {
  assert.strictEqual(DEFAULTS.maxDepth, 6,
    'the default must stay 6 — only JVM layouts deepen');
});

// ── The coverage the fix exists for ────────────────────────────────────────

test('deep JVM package files are reachable at the resolved depth', () => {
  const files = { 'pom.xml': '<project/>' };
  // src/main/java/com/acme/a/b/Deep.java — 8 directories down
  files['src/main/java/com/acme/a/b/Deep.java'] = 'package com.acme.a.b;\npublic class Deep { public int go() { return 1; } }\n';
  const d = tmpRepo(files);
  const cfg = loadConfig(d);
  const depth = 'src/main/java/com/acme/a/b'.split('/').length;
  assert.ok(cfg.maxDepth >= depth,
    `resolved depth ${cfg.maxDepth} cannot reach a file ${depth} directories down`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
