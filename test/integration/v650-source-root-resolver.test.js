'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { resolveSourceRoots } = require('../../src/discovery/source-root-resolver');
const { detectLanguages }     = require('../../src/discovery/language-detector');
const { detectFrameworks }    = require('../../src/discovery/framework-detector');
const { scoreCandidate }      = require('../../src/discovery/source-root-scorer');
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

console.log('\nAll tests passed!');
