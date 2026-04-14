'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const { loadConfig } = require('../../src/config/loader');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-fw-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeFiles(root, files) {
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
}

function mkdirs(root, dirs) {
  for (const relPath of dirs) {
    fs.mkdirSync(path.join(root, relPath), { recursive: true });
  }
}

function assertContainsAll(actual, expected, label) {
  for (const entry of expected) {
    assert.ok(actual.includes(entry), `${label} should include ${entry}; got ${actual.join(', ')}`);
  }
}

test('Next/React discovery includes app/pages/components/hooks/lib when present', () => {
  withTempDir((dir) => {
    writeFiles(dir, {
      'package.json': JSON.stringify({ dependencies: { react: '^19.0.0', next: '^15.0.0' } }),
    });
    mkdirs(dir, ['src', 'app', 'pages', 'components', 'hooks', 'lib']);

    const cfg = loadConfig(dir);
    assertContainsAll(cfg.srcDirs, ['src', 'app', 'pages', 'components', 'hooks', 'lib'], 'next srcDirs');
  });
});

test('Angular discovery includes src/projects/apps/libs when present', () => {
  withTempDir((dir) => {
    writeFiles(dir, {
      'package.json': JSON.stringify({ dependencies: { '@angular/core': '^19.0.0' } }),
    });
    mkdirs(dir, ['src', 'projects', 'apps', 'libs']);

    const cfg = loadConfig(dir);
    assertContainsAll(cfg.srcDirs, ['src', 'projects', 'apps', 'libs'], 'angular srcDirs');
  });
});

test('Rails discovery includes conventional app/lib/config/db/spec/test folders', () => {
  withTempDir((dir) => {
    writeFiles(dir, { 'Gemfile': "source 'https://rubygems.org'\n" });
    mkdirs(dir, ['app', 'lib', 'config', 'db', 'spec', 'test']);

    const cfg = loadConfig(dir);
    assertContainsAll(cfg.srcDirs, ['app', 'lib', 'config', 'db', 'spec', 'test'], 'rails srcDirs');
  });
});

test('Laravel discovery includes app/resources/routes/database/tests folders', () => {
  withTempDir((dir) => {
    writeFiles(dir, { 'composer.json': JSON.stringify({ name: 'demo/laravel-app' }) });
    mkdirs(dir, ['app', 'resources', 'routes', 'database', 'tests']);

    const cfg = loadConfig(dir);
    assertContainsAll(cfg.srcDirs, ['app', 'resources', 'routes', 'database', 'tests'], 'laravel srcDirs');
  });
});

test('Flask/Python discovery includes src/app/tests/examples folders', () => {
  withTempDir((dir) => {
    writeFiles(dir, {
      'pyproject.toml': '[project]\nname = "flask-app"\ndependencies = ["flask"]\n',
    });
    mkdirs(dir, ['src', 'app', 'tests', 'examples']);

    const cfg = loadConfig(dir);
    assertContainsAll(cfg.srcDirs, ['src', 'app', 'tests', 'examples'], 'flask srcDirs');
  });
});

console.log('');
console.log(`framework-discovery: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);