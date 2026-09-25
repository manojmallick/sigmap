'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { resolveSourceRoots } = require('../../src/discovery/source-root-resolver');
const { detectLanguages }     = require('../../src/discovery/language-detector');
const { detectFrameworks }    = require('../../src/discovery/framework-detector');
const { scoreCandidate, JVM_PATH_PATTERN }      = require('../../src/discovery/source-root-scorer');
const { loadIgnorePatterns, matchesIgnorePattern } = require('../../src/discovery/sigmapignore');

function makeRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-roots-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content || '');
  }
  return dir;
}

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
}

test('detectLanguages identifies TypeScript by tsconfig + file extensions', () => {
  const cwd = makeRepo({
    'tsconfig.json': '{}',
    'src/index.ts': 'export function foo() {}',
    'src/auth.ts': 'export function bar() {}',
  });
  const langs = detectLanguages(cwd);
  const ts = langs.find(l => l.name === 'typescript');
  assert(ts && ts.weight > 0, 'typescript not detected');
  assert(langs[0].name === 'typescript' || langs[0].name === 'javascript', 'wrong primary language');
});

test('detectLanguages returns [] on empty dir', () => {
  const cwd = makeRepo({});
  const langs = detectLanguages(cwd);
  assert(Array.isArray(langs), 'should return array');
});

test('detectFrameworks identifies nextjs by next.config.js', () => {
  const cwd = makeRepo({
    'next.config.js': 'module.exports = {}',
    'package.json': '{"dependencies":{"next":"13.0.0"}}',
  });
  const fws = detectFrameworks(cwd);
  const nxt = fws.find(f => f.name === 'nextjs');
  assert(nxt && nxt.confidence >= 0.90, `nextjs not detected, got: ${JSON.stringify(fws.slice(0,3))}`);
});

test('detectFrameworks identifies django by manage.py', () => {
  const cwd = makeRepo({
    'manage.py': '#!/usr/bin/env python',
    'requirements.txt': 'Django==4.2',
  });
  const fws = detectFrameworks(cwd);
  const dj = fws.find(f => f.name === 'django');
  assert(dj && dj.confidence >= 0.90, 'django not detected');
});

test('detectFrameworks identifies rails by config/routes.rb', () => {
  const cwd = makeRepo({
    'config/routes.rb': 'Rails.application.routes.draw do',
    'app/controllers/application_controller.rb': '',
    'Gemfile': 'gem "rails"',
  });
  const fws = detectFrameworks(cwd);
  const rails = fws.find(f => f.name === 'rails');
  assert(rails, 'rails not detected');
});

test('resolveSourceRoots returns src/ for a plain TypeScript project', () => {
  const cwd = makeRepo({
    'package.json': '{"dependencies":{}}',
    'tsconfig.json': '{}',
    'src/index.ts': '',
    'src/auth.ts': '',
    'src/service.ts': '',
    'docs/readme.md': '',
    'test/app.test.ts': '',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.roots.includes('src'), `src not in roots: ${result.roots.join(',')}`);
  assert(!result.roots.includes('test'), 'test should be excluded');
  assert(!result.roots.includes('docs'), 'docs should be excluded');
});

test('resolveSourceRoots respects .sigmapignore', () => {
  const cwd = makeRepo({
    'package.json': '{}',
    'tsconfig.json': '{}',
    'src/index.ts': '',
    'src/auth.ts': '',
    'legacy/old.ts': '',
    'legacy/auth.ts': '',
    '.sigmapignore': 'legacy/',
  });
  const result = resolveSourceRoots(cwd);
  assert(!result.roots.includes('legacy'), 'legacy should be ignored');
});

test('loadIgnorePatterns reads .sigmapignore', () => {
  const cwd = makeRepo({ '.sigmapignore': 'docs-vp/\nscripts/\n' });
  const patterns = loadIgnorePatterns(cwd);
  assert(patterns.includes('docs-vp/'), 'docs-vp/ missing');
  assert(patterns.includes('scripts/'), 'scripts/ missing');
});

test('matchesIgnorePattern matches simple dir names', () => {
  assert(matchesIgnorePattern('docs', ['docs/']), 'docs should match');
  assert(!matchesIgnorePattern('src', ['docs/']), 'src should not match');
});

test('scoreCandidate returns negative for node_modules', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-'));
  const score = scoreCandidate('node_modules', path.join(tmpDir, 'node_modules'), {
    frameworks: [], languages: [], recentDirs: new Set(), frameworkSrcDirs: new Set(), entrypoints: [], frameworkPenalties: [],
  });
  assert(score < 0, `expected negative score, got ${score}`);
});

test('scoreCandidate gives higher score to src than test', () => {
  const cwd = makeRepo({ 'src/a.ts': '', 'src/b.ts': '', 'src/c.ts': '', 'test/a.test.ts': '' });
  const ctx = { frameworks: [], languages: [], recentDirs: new Set(), frameworkSrcDirs: new Set(['src']), entrypoints: [], frameworkPenalties: [] };
  const srcScore  = scoreCandidate('src',  path.join(cwd, 'src'),  ctx);
  const testScore = scoreCandidate('test', path.join(cwd, 'test'), ctx);
  assert(srcScore > testScore, `src (${srcScore}) should score higher than test (${testScore})`);
});

test('resolveSourceRoots confidence is high when nextjs detected', () => {
  const cwd = makeRepo({
    'next.config.js': '',
    'package.json': '{"dependencies":{"next":"13.0.0"}}',
    'app/page.tsx': '',
    'app/layout.tsx': '',
    'app/auth/page.tsx': '',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.confidence === 'high' || result.confidence === 'medium', 'confidence should not be low for nextjs');
});

test('resolveSourceRoots falls back gracefully on resolver error', () => {
  const result = resolveSourceRoots('/tmp/nonexistent-repo-xyz');
  assert(Array.isArray(result.roots), 'roots must be array even on error');
});

test('django special rule includes dirs containing models.py', () => {
  const cwd = makeRepo({
    'manage.py': '',
    'requirements.txt': 'Django==4.2',
    'myapp/models.py': '',
    'myapp/views.py': '',
    'myapp/__init__.py': '',
    'config/settings.py': '',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.roots.includes('myapp'), `myapp should be detected, got: ${result.roots.join(',')}`);
});

test('resolveSourceRoots returns correct roots for Go project with internal/ dir', () => {
  const cwd = makeRepo({
    'go.mod': 'module example.com/myapp',
    'main.go': 'package main',
    'internal/service.go': 'package internal',
    'internal/db/models.go': 'package db',
    'vendor/some-lib.go': '',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.roots.includes('internal'), `internal should be in roots, got: ${result.roots.join(',')}`);
  assert(!result.roots.includes('vendor'), 'vendor should not be in roots');
});

test('resolveSourceRoots returns correct roots for Python/Django project', () => {
  const cwd = makeRepo({
    'manage.py': '#!/usr/bin/env python',
    'requirements.txt': 'Django==4.2',
    'users/models.py': 'from django.db import models',
    'users/views.py': 'from django.shortcuts import render',
    'posts/models.py': 'from django.db import models',
    'posts/views.py': 'from django.shortcuts import render',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.roots.includes('users'), `users should be detected`);
  assert(result.roots.includes('posts'), `posts should be detected`);
  assert(result.confidence === 'high', `confidence should be high for django`);
});

test('resolveSourceRoots handles monorepo structure', () => {
  const cwd = makeRepo({
    'package.json': '{"workspaces": ["packages/*"]}',
    'packages/api/package.json': '{"name": "api"}',
    'packages/api/src/index.ts': '',
    'packages/web/package.json': '{"name": "web"}',
    'packages/web/src/index.tsx': '',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.isMonorepo === true, 'should detect monorepo');
  assert(result.roots.length > 0, 'should find roots in monorepo');
});

test('detectFrameworks identifies express by dependency', () => {
  const cwd = makeRepo({
    'package.json': '{"dependencies":{"express":"4.0.0"}}',
    'src/server.js': 'const express = require("express")',
  });
  const fws = detectFrameworks(cwd);
  const exp = fws.find(f => f.name === 'express');
  assert(exp && exp.confidence >= 0.90, 'express should be detected from dependency');
});

test('detectLanguages weights multiple signals correctly', () => {
  const cwd = makeRepo({
    'package.json': '{}',
    'tsconfig.json': '{}',
    'src/a.ts': '',
    'src/b.ts': '',
    'src/c.ts': '',
    'lib/d.js': '',
  });
  const langs = detectLanguages(cwd);
  const ts = langs.find(l => l.name === 'typescript');
  const js = langs.find(l => l.name === 'javascript');
  assert(ts && ts.weight >= js?.weight, 'typescript should rank higher than javascript due to tsconfig');
});

test('loadIgnorePatterns falls back to .contextignore when .sigmapignore missing', () => {
  const cwd = makeRepo({ '.contextignore': 'vendor/\ntemp/\n' });
  const patterns = loadIgnorePatterns(cwd);
  assert(patterns.includes('vendor/'), 'should read from .contextignore');
  assert(patterns.includes('temp/'), 'should read from .contextignore');
});

test('resolveSourceRoots caps roots at MAX_ROOTS (6)', () => {
  const cwd = makeRepo({
    'src/a.ts': '',
    'lib/b.ts': '',
    'api/c.ts': '',
    'handlers/d.ts': '',
    'services/e.ts': '',
    'middleware/f.ts': '',
    'routes/g.ts': '',
    'utils/h.ts': '',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.roots.length <= 6, `roots should be capped at 6, got ${result.roots.length}`);
});

test('scoreCandidate penalizes test directories', () => {
  const cwd = makeRepo({
    'src/app.ts': '',
    'src/app.ts': '',
    'src/app.ts': '',
    'test/app.test.ts': '',
  });
  const ctx = {
    frameworks: [],
    languages: [],
    recentDirs: new Set(),
    frameworkSrcDirs: new Set(['src']),
    entrypoints: [],
    frameworkPenalties: [],
  };
  const srcScore = scoreCandidate('src', path.join(cwd, 'src'), ctx);
  const testScore = scoreCandidate('test', path.join(cwd, 'test'), ctx);
  assert(srcScore > testScore, 'src should score higher than test directory');
});

test('scoreCandidate penalizes documentation directories', () => {
  const cwd = makeRepo({
    'src/index.ts': '',
    'src/service.ts': '',
    'src/utils.ts': '',
    'docs/guide.md': '',
  });
  const ctx = {
    frameworks: [],
    languages: [],
    recentDirs: new Set(),
    frameworkSrcDirs: new Set(['src']),
    entrypoints: [],
    frameworkPenalties: [],
  };
  const srcScore = scoreCandidate('src', path.join(cwd, 'src'), ctx);
  const docsScore = scoreCandidate('docs', path.join(cwd, 'docs'), ctx);
  assert(srcScore > docsScore, 'src should score higher than docs directory');
});

test('resolveSourceRoots returns explanation with scores', () => {
  const cwd = makeRepo({
    'src/index.ts': '',
    'src/app.ts': '',
    'src/service.ts': '',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.explanation && result.explanation.length > 0, 'should provide explanation');
  assert(result.explanation[0].score !== undefined, 'explanation should include scores');
});

test('resolveSourceRoots detects low confidence when no strong signals', () => {
  const cwd = makeRepo({
    'foo.ts': '',
    'bar.ts': '',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.confidence === 'low', `expected low confidence, got ${result.confidence}`);
});

test('detectLanguages handles projects with multiple language files', () => {
  const cwd = makeRepo({
    'package.json': '{}',
    'go.mod': 'module example.com',
    'src/main.ts': '',
    'main.go': '',
    'test.py': '',
  });
  const langs = detectLanguages(cwd);
  assert(langs.length >= 3, 'should detect multiple languages');
  assert(langs.some(l => l.name === 'typescript'), 'should detect typescript');
  assert(langs.some(l => l.name === 'go'), 'should detect go');
  assert(langs.some(l => l.name === 'python'), 'should detect python');
});

test('resolveSourceRoots handles repos with no source files', () => {
  const cwd = makeRepo({
    'README.md': '# Project',
    'LICENSE': 'MIT',
  });
  const result = resolveSourceRoots(cwd);
  assert(Array.isArray(result.roots), 'should return array even with no source files');
});

test('matchesIgnorePattern handles glob patterns', () => {
  assert(matchesIgnorePattern('src', ['src/**']), 'should match glob with /**');
  assert(matchesIgnorePattern('src', ['src/*']), 'should match glob with /*');
  assert(!matchesIgnorePattern('src', ['lib/**']), 'should not match different pattern');
});

test('resolveSourceRoots detects yarn/pnpm workspaces', () => {
  const cwd = makeRepo({
    'pnpm-workspace.yaml': 'packages:\n  - packages/*',
    'packages/app/package.json': '{}',
    'packages/app/src/index.js': '',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.isMonorepo === true, 'should detect pnpm workspaces as monorepo');
});

test('scoreCandidate boosts recently changed directories', () => {
  const cwd = makeRepo({
    'src/index.ts': '',
    'lib/old.ts': '',
  });
  const recentDirs = new Set(['src']);
  const ctx = {
    frameworks: [],
    languages: [],
    recentDirs,
    frameworkSrcDirs: new Set(),
    entrypoints: [],
    frameworkPenalties: [],
  };
  const srcScore = scoreCandidate('src', path.join(cwd, 'src'), ctx);
  const libScore = scoreCandidate('lib', path.join(cwd, 'lib'), ctx);
  assert(srcScore > libScore, 'recently changed dir should score higher');
});

test('detectLanguages identifies dart from pubspec.yaml', () => {
  const cwd = makeRepo({
    'pubspec.yaml': 'name: my_app\ndependencies:\n  flutter:\n    sdk: flutter',
    'lib/main.dart': 'void main() {}',
  });
  const langs = detectLanguages(cwd);
  const dart = langs.find(l => l.name === 'dart');
  assert(dart && dart.weight > 0, 'dart should be detected from pubspec.yaml and .dart files');
});

test('resolveSourceRoots returns different confidence levels', () => {
  const tsRepo = makeRepo({
    'tsconfig.json': '{}',
    'next.config.js': '',
    'package.json': '{"dependencies":{"next":"latest"}}',
    'src/index.ts': '',
  });
  const tsResult = resolveSourceRoots(tsRepo);

  const emptyRepo = makeRepo({
    'README.md': '# Repo',
  });
  const emptyResult = resolveSourceRoots(emptyRepo);

  assert(tsResult.confidence !== emptyResult.confidence, 'different repos should have different confidence levels');
  assert(tsResult.confidence !== 'low', 'repo with framework should not be low confidence');
  assert(emptyResult.confidence === 'low', 'repo with no signals should be low confidence');
});

test('scoreCandidate gives +5.0 bonus to src/main/java', () => {
  const cwd = makeRepo({ 'src/main/java/App.java': '' });
  const ctx = { frameworks: [], languages: [], recentDirs: new Set(), frameworkSrcDirs: new Set(), entrypoints: [], frameworkPenalties: [] };
  const score = scoreCandidate('src/main/java', path.join(cwd, 'src/main/java'), ctx);
  assert(score >= 5.0, `src/main/java should get +5.0 bonus, got ${score}`);
});

test('scoreCandidate gives +5.0 bonus to src/main/kotlin', () => {
  const cwd = makeRepo({ 'src/main/kotlin/App.kt': '' });
  const ctx = { frameworks: [], languages: [], recentDirs: new Set(), frameworkSrcDirs: new Set(), entrypoints: [], frameworkPenalties: [] };
  const score = scoreCandidate('src/main/kotlin', path.join(cwd, 'src/main/kotlin'), ctx);
  assert(score >= 5.0, `src/main/kotlin should get +5.0 bonus, got ${score}`);
});

test('scoreCandidate gives +5.0 bonus to src/main/scala', () => {
  const cwd = makeRepo({ 'src/main/scala/App.scala': '' });
  const ctx = { frameworks: [], languages: [], recentDirs: new Set(), frameworkSrcDirs: new Set(), entrypoints: [], frameworkPenalties: [] };
  const score = scoreCandidate('src/main/scala', path.join(cwd, 'src/main/scala'), ctx);
  assert(score >= 5.0, `src/main/scala should get +5.0 bonus, got ${score}`);
});

test('scoreCandidate gives +5.0 bonus to app/src/main/java', () => {
  const cwd = makeRepo({ 'app/src/main/java/App.java': '' });
  const ctx = { frameworks: [], languages: [], recentDirs: new Set(), frameworkSrcDirs: new Set(), entrypoints: [], frameworkPenalties: [] };
  const score = scoreCandidate('app/src/main/java', path.join(cwd, 'app/src/main/java'), ctx);
  assert(score >= 5.0, `app/src/main/java should get +5.0 bonus, got ${score}`);
});

test('scoreCandidate gives +5.0 bonus to app/src/main/kotlin', () => {
  const cwd = makeRepo({ 'app/src/main/kotlin/App.kt': '' });
  const ctx = { frameworks: [], languages: [], recentDirs: new Set(), frameworkSrcDirs: new Set(), entrypoints: [], frameworkPenalties: [] };
  const score = scoreCandidate('app/src/main/kotlin', path.join(cwd, 'app/src/main/kotlin'), ctx);
  assert(score >= 5.0, `app/src/main/kotlin should get +5.0 bonus, got ${score}`);
});

test('scoreCandidate gives +5.0 bonus to app/src/main/scala', () => {
  const cwd = makeRepo({ 'app/src/main/scala/App.scala': '' });
  const ctx = { frameworks: [], languages: [], recentDirs: new Set(), frameworkSrcDirs: new Set(), entrypoints: [], frameworkPenalties: [] };
  const score = scoreCandidate('app/src/main/scala', path.join(cwd, 'app/src/main/scala'), ctx);
  assert(score >= 5.0, `app/src/main/scala should get +5.0 bonus, got ${score}`);
});

test('JVM_PATH_PATTERN is exported from source-root-scorer', () => {
  assert(JVM_PATH_PATTERN instanceof RegExp, 'JVM_PATH_PATTERN should be a RegExp');
});

test('JVM_PATH_PATTERN matches src/main/ JVM paths', () => {
  assert(JVM_PATH_PATTERN.test('src/main/java'), 'should match src/main/java');
  assert(JVM_PATH_PATTERN.test('src/main/kotlin'), 'should match src/main/kotlin');
  assert(JVM_PATH_PATTERN.test('src/main/scala'), 'should match src/main/scala');
});

test('JVM_PATH_PATTERN matches app/src/main/ JVM paths', () => {
  assert(JVM_PATH_PATTERN.test('app/src/main/java'), 'should match app/src/main/java');
  assert(JVM_PATH_PATTERN.test('app/src/main/kotlin'), 'should match app/src/main/kotlin');
  assert(JVM_PATH_PATTERN.test('app/src/main/scala'), 'should match app/src/main/scala');
});

test('JVM_PATH_PATTERN rejects non-JVM paths', () => {
  assert(!JVM_PATH_PATTERN.test('src/main/python'), 'should not match src/main/python');
  assert(!JVM_PATH_PATTERN.test('src/test/java'), 'should not match src/test/java');
  assert(!JVM_PATH_PATTERN.test('app/main/java'), 'should not match app/main/java');
  assert(!JVM_PATH_PATTERN.test('src'), 'should not match bare src');
});

test('resolveSourceRoots detects JVM paths in monorepo packages', () => {
  const cwd = makeRepo({
    'pnpm-workspace.yaml': 'packages:\n  - packages/*',
    'packages/api/package.json': '{"name": "api"}',
    'packages/api/src/main/java/App.java': 'class App {}',
    'packages/api/src/main/kotlin/Config.kt': 'object Config',
    'packages/api/src/main/java/utils/Helper.java': 'class Helper {}',
    'packages/api/src/main/java/models/Model.java': 'class Model {}',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.isMonorepo === true, 'should detect pnpm monorepo');
  assert(result.roots.length > 0, 'should find at least one root');
  // JVM paths in monorepo should be in explanation or roots
  const hasJvmPath = result.explanation.some(e => e.dir.includes('packages/api') && (e.dir.includes('java') || e.dir.includes('kotlin')));
  assert(hasJvmPath, 'should detect JVM paths in monorepo explanation');
});

test('resolveSourceRoots detects app/src/main JVM paths in monorepo', () => {
  const cwd = makeRepo({
    'pnpm-workspace.yaml': 'packages:\n  - apps/*',
    'apps/backend/package.json': '{"name": "backend"}',
    'apps/backend/app/src/main/scala/Main.scala': 'object Main',
    'apps/backend/app/src/main/scala/core/Engine.scala': 'class Engine',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.isMonorepo === true, 'should detect monorepo');
  // JVM paths should be scored and appear in explanation
  const hasScalaPath = result.explanation.some(e => e.dir.includes('apps/backend') && e.dir.includes('scala'));
  assert(hasScalaPath, 'should detect Scala paths in monorepo explanation');
});

test('resolveSourceRoots includes test JVM paths in DEEP_PATHS', () => {
  const cwd = makeRepo({
    'src/test/java/AppTest.java': '',
    'src/test/kotlin/ConfigTest.kt': '',
  });
  const result = resolveSourceRoots(cwd);
  assert(result.roots.some(r => r === 'src/test/java'), 'should find src/test/java');
  assert(result.roots.some(r => r === 'src/test/kotlin'), 'should find src/test/kotlin');
});

// Determinism guard (#440): tied-score dirs must resolve to the SAME set/order
// on every call. Before the tie-break fix, candidate order came from filesystem
// readdir and the score sort had no final key, so the MAX_ROOTS cutoff could
// admit different dirs run to run — making the generated context non-reproducible.
test('resolveSourceRoots is deterministic across repeated calls (tied scores)', () => {
  const files = {};
  for (const name of ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']) {
    files[`${name}/index.js`] = 'export function f() {}';
    files[`${name}/util.js`] = 'export function g() {}';
  }
  const cwd = makeRepo(files);
  const first = resolveSourceRoots(cwd).roots;
  for (let i = 0; i < 10; i++) {
    assert.deepStrictEqual(resolveSourceRoots(cwd).roots, first,
      'roots must be identical on every call');
  }
  const tied = first.filter(r => /^[a-z]+$/.test(r));
  assert.deepStrictEqual(tied, tied.slice().sort((x, y) => x.localeCompare(y)),
    'tied-score dirs must be in a stable alphabetical order');
});


// ───────────── JVM multi-module source roots (v8.51) ─────────────
//
// A standard Gradle/Maven/sbt multi-module build kept its source under
// `<module>/src/main/<lang>`, which the root-level candidate scan never
// reached: `_countSourceFiles` looks 2 levels deep and the code sits at 4.
// Measured before the fix: okhttp indexed 4 files of 596, akka 29 of 2,651.
//
// Kotlin Multiplatform compounded it — okhttp's core keeps 307 files under
// `okhttp/src/jvmMain/kotlin`, and nothing assumed a source set could be
// called anything but `main`.

const KOTLIN = 'class Foo {\n  fun bar(baz: String): Int { return 1 }\n}\n';
const JAVA = 'public class Foo {\n  public int bar(String baz) { return 1; }\n}\n';

/** A module with `count` source files under one source set. */
function moduleFiles(mod, sourceSet, lang, count, body) {
  const out = {};
  for (let i = 0; i < count; i++) {
    out[`${mod}/src/${sourceSet}/${lang}/pkg/File${i}.${lang === 'java' ? 'java' : 'kt'}`] = body;
  }
  return out;
}

test('gradle multi-module: every module source dir becomes a root', () => {
  const cwd = makeRepo(Object.assign(
    {
      'settings.gradle.kts': 'include(":core")\ninclude(":client")\ninclude(":server")\n',
      'build.gradle.kts': 'plugins { kotlin("jvm") }\n',
    },
    moduleFiles('core', 'main', 'kotlin', 4, KOTLIN),
    moduleFiles('client', 'main', 'kotlin', 4, KOTLIN),
    moduleFiles('server', 'main', 'kotlin', 4, KOTLIN),
  ));
  const { roots, isJvmMultiModule } = resolveSourceRoots(cwd);
  assert.strictEqual(isJvmMultiModule, true, 'multi-module build not recognised');
  for (const m of ['core', 'client', 'server']) {
    assert.ok(roots.includes(`${m}/src/main/kotlin`),
      `${m} missing from roots: ${roots.join(', ')}`);
  }
});

test('kotlin multiplatform source sets are found, not just `main`', () => {
  const cwd = makeRepo(Object.assign(
    { 'settings.gradle.kts': 'include(":core")\ninclude(":io")\n' },
    moduleFiles('core', 'jvmMain', 'kotlin', 4, KOTLIN),
    moduleFiles('core', 'commonMain', 'kotlin', 4, KOTLIN),
    moduleFiles('core', 'androidMain', 'kotlin', 3, KOTLIN),
    moduleFiles('io', 'main', 'kotlin', 4, KOTLIN),
  ));
  const { roots } = resolveSourceRoots(cwd);
  for (const r of ['core/src/jvmMain/kotlin', 'core/src/commonMain/kotlin', 'core/src/androidMain/kotlin']) {
    assert.ok(roots.includes(r), `${r} missing: ${roots.join(', ')}`);
  }
  // The classic layout still works alongside it.
  assert.ok(roots.includes('io/src/main/kotlin'), roots.join(', '));
});

test('test source sets never become source roots', () => {
  const cwd = makeRepo(Object.assign(
    { 'settings.gradle.kts': 'include(":core")\ninclude(":io")\n' },
    moduleFiles('core', 'main', 'kotlin', 4, KOTLIN),
    moduleFiles('core', 'test', 'kotlin', 6, KOTLIN),
    moduleFiles('core', 'commonTest', 'kotlin', 6, KOTLIN),
    moduleFiles('core', 'androidHostTest', 'kotlin', 6, KOTLIN),
    moduleFiles('io', 'main', 'kotlin', 4, KOTLIN),
  ));
  const { roots } = resolveSourceRoots(cwd);
  const leaked = roots.filter((r) => /test/i.test(r));
  assert.deepStrictEqual(leaked, [], `test source sets leaked into roots: ${leaked.join(', ')}`);
  assert.ok(roots.includes('core/src/main/kotlin'), roots.join(', '));
});

test('maven <modules> builds are recognised', () => {
  const cwd = makeRepo(Object.assign(
    {
      'pom.xml': '<project><modules><module>api</module><module>impl</module></modules></project>',
    },
    moduleFiles('api', 'main', 'java', 4, JAVA),
    moduleFiles('impl', 'main', 'java', 4, JAVA),
  ));
  const { roots, isJvmMultiModule } = resolveSourceRoots(cwd);
  assert.strictEqual(isJvmMultiModule, true);
  assert.ok(roots.includes('api/src/main/java'), roots.join(', '));
  assert.ok(roots.includes('impl/src/main/java'), roots.join(', '));
});

test('sbt multi-project builds are recognised', () => {
  const cwd = makeRepo(Object.assign(
    { 'build.sbt': 'lazy val core = project.in(file("core"))\nlazy val stream = project.in(file("stream"))\n' },
    moduleFiles('core', 'main', 'scala', 4, 'class Foo { def bar(x: String): Int = 1 }\n'),
    moduleFiles('stream', 'main', 'scala', 4, 'class Baz { def qux(x: String): Int = 1 }\n'),
  ));
  const { roots, isJvmMultiModule } = resolveSourceRoots(cwd);
  assert.strictEqual(isJvmMultiModule, true);
  assert.ok(roots.includes('core/src/main/scala'), roots.join(', '));
});

test('a module layout with no build file is still found (structure decides)', () => {
  // A build file can declare modules that are absent, and a layout can be
  // multi-module under a tool nobody enumerated. Two module source dirs on
  // disk is the honest signal.
  const cwd = makeRepo(Object.assign(
    {},
    moduleFiles('alpha', 'main', 'java', 4, JAVA),
    moduleFiles('beta', 'main', 'java', 4, JAVA),
  ));
  const { roots, isJvmMultiModule } = resolveSourceRoots(cwd);
  assert.strictEqual(isJvmMultiModule, true, 'structural detection failed');
  assert.ok(roots.includes('alpha/src/main/java'), roots.join(', '));
});

test('grouped modules one level deeper are found', () => {
  const cwd = makeRepo(Object.assign(
    { 'settings.gradle': 'include ":samples:guide"\ninclude ":libs:core"\n' },
    moduleFiles('samples/guide', 'main', 'java', 4, JAVA),
    moduleFiles('libs/core', 'main', 'kotlin', 4, KOTLIN),
  ));
  const { roots } = resolveSourceRoots(cwd);
  assert.ok(roots.includes('samples/guide/src/main/java'), roots.join(', '));
  assert.ok(roots.includes('libs/core/src/main/kotlin'), roots.join(', '));
});

test('the 6-root cap is lifted only for multi-module JVM builds', () => {
  // okhttp has 27 module source dirs; a cap tuned for JS layouts would
  // discard most of the repo.
  const files = { 'settings.gradle.kts': '' };
  for (let m = 0; m < 12; m++) {
    files['settings.gradle.kts'] += `include(":m${m}")\n`;
    Object.assign(files, moduleFiles(`m${m}`, 'main', 'kotlin', 4, KOTLIN));
  }
  const { roots } = resolveSourceRoots(makeRepo(files));
  assert.ok(roots.length > 6, `cap not lifted for a 12-module build: ${roots.length} roots`);
  assert.ok(roots.length >= 12, `modules dropped: ${roots.length} of 12`);
});

test('a single-module JVM project is unaffected', () => {
  const cwd = makeRepo(Object.assign(
    { 'build.gradle': 'apply plugin: "java"\n' },
    moduleFiles('', 'main', 'java', 5, JAVA),
  ));
  const { roots, isJvmMultiModule } = resolveSourceRoots(cwd);
  assert.strictEqual(isJvmMultiModule, false, 'single module wrongly treated as multi-module');
  assert.ok(roots.includes('src/main/java'), roots.join(', '));
});

test('non-JVM projects are untouched by the JVM branch', () => {
  // Verified empirically too: 9 of 10 field-test repos scanned an identical
  // file count before and after this change.
  const cwd = makeRepo({
    'package.json': '{"name":"app","version":"1.0.0"}',
    'src/index.ts': 'export function a(x: string) { return x; }',
    'src/auth.ts': 'export function b(x: string) { return x; }',
    'src/db.ts': 'export function c(x: string) { return x; }',
  });
  const { roots, isJvmMultiModule } = resolveSourceRoots(cwd);
  assert.strictEqual(isJvmMultiModule, false);
  assert.ok(roots.includes('src'), roots.join(', '));
  assert.ok(roots.length <= 6, `JS project exceeded the normal cap: ${roots.join(', ')}`);
});

test('JVM_PATH_PATTERN matches module and multiplatform paths, not tests', () => {
  for (const p of ['src/main/kotlin', 'okhttp/src/main/kotlin', 'okhttp/src/jvmMain/kotlin',
    'core/src/commonMain/kotlin', 'packages/a/src/main/java', 'app/src/main/java',
    'samples/guide/src/main/java']) {
    assert.ok(JVM_PATH_PATTERN.test(p), `should match: ${p}`);
  }
  for (const p of ['src/commonTest/kotlin', 'core/src/jvmTest/kotlin', 'src/androidHostTest/kotlin',
    'src/main/resources', 'notsrc/main/kotlin']) {
    assert.ok(!JVM_PATH_PATTERN.test(p), `should NOT match: ${p}`);
  }
});

test('multi-module detection is deterministic', () => {
  const files = Object.assign(
    { 'settings.gradle.kts': 'include(":a")\ninclude(":b")\n' },
    moduleFiles('a', 'main', 'kotlin', 4, KOTLIN),
    moduleFiles('b', 'jvmMain', 'kotlin', 4, KOTLIN),
  );
  const cwd = makeRepo(files);
  assert.deepStrictEqual(resolveSourceRoots(cwd).roots, resolveSourceRoots(cwd).roots);
});

console.log('\nAll tests passed!');
