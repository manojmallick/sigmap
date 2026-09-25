'use strict';

/**
 * Dependency inventory (#2a, v8.50).
 *
 * `config-manifest.js` reported `pom.xml (maven) | present` and
 * `requirements.txt (python) | present`. "Present" is not grounding — it names
 * a file without naming a single package or version. These tests pin the real
 * extraction across every ecosystem SigMap claims to support, including the
 * two cases that make the difference between useful and decorative: Maven
 * property resolution, and preferring a locked exact version over a declared
 * range.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const inv = require(path.join(ROOT, 'src/deps/inventory'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/** Run `fn` against a hermetic temp repo seeded with `files`. */
function withRepo(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-deps-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    }
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const find = (deps, name) => deps.find((d) => d.name === name);
function expectDep(deps, name, version, scope) {
  const hit = find(deps, name);
  assert.ok(hit, `no dependency named "${name}" in:\n${deps.map((d) => `${d.ecosystem} ${d.name}@${d.version} (${d.scope})`).join('\n')}`);
  if (version !== undefined) assert.strictEqual(hit.version, version, `${name} version`);
  if (scope !== undefined) assert.strictEqual(hit.scope, scope, `${name} scope`);
  return hit;
}

// ─────────────────────────────── npm ───────────────────────────────

test('npm: all four dependency scopes are read', () => {
  withRepo({
    'package.json': JSON.stringify({
      name: 'demo', version: '1.2.3',
      dependencies: { express: '^5.1.0' },
      devDependencies: { jest: '29.0.0' },
      peerDependencies: { react: '>=18' },
      optionalDependencies: { fsevents: '^2.3.0' },
    }),
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    expectDep(r.deps, 'express', '^5.1.0', 'runtime');
    expectDep(r.deps, 'jest', '29.0.0', 'dev');
    expectDep(r.deps, 'react', '>=18', 'peer');
    expectDep(r.deps, 'fsevents', '^2.3.0', 'optional');
    assert.strictEqual(r.manifests[0].name, 'demo');
    assert.strictEqual(r.manifests[0].version, '1.2.3');
  });
});

test('npm: a locked exact version is preferred over a declared range', () => {
  withRepo({
    'package.json': JSON.stringify({ name: 'd', dependencies: { express: '^5.1.0' } }),
    'package-lock.json': JSON.stringify({
      lockfileVersion: 3,
      packages: { '': { name: 'd' }, 'node_modules/express': { version: '5.1.4' } },
    }),
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    const e = expectDep(r.deps, 'express', '^5.1.0', 'runtime');
    assert.strictEqual(e.resolved, '5.1.4', 'lock version not folded in');
    // The pin must use the exact version — the range is not what runs.
    assert.deepStrictEqual(inv.versionPins(r).pins, ['express@5.1.4']);
  });
});

test('npm: lockfileVersion 1 flat map is still read', () => {
  withRepo({
    'package.json': JSON.stringify({ name: 'd', dependencies: { lodash: '^4' } }),
    'package-lock.json': JSON.stringify({ lockfileVersion: 1, dependencies: { lodash: { version: '4.17.21' } } }),
  }, (dir) => {
    assert.strictEqual(find(inv.collectDependencies(dir).deps, 'lodash').resolved, '4.17.21');
  });
});

test('npm: scoped package names survive the lock key parse', () => {
  withRepo({
    'package.json': JSON.stringify({ name: 'd', dependencies: { '@scope/pkg': '^1' } }),
    'package-lock.json': JSON.stringify({
      lockfileVersion: 3, packages: { 'node_modules/@scope/pkg': { version: '1.4.0' } },
    }),
  }, (dir) => {
    assert.strictEqual(find(inv.collectDependencies(dir).deps, '@scope/pkg').resolved, '1.4.0');
  });
});

// ────────────────────────────── python ─────────────────────────────

test('python: requirements.txt pins, extras, comments and pip flags', () => {
  withRepo({
    'requirements.txt': [
      '# comment line',
      'requests==2.31.0',
      'flask>=3.0,<4.0',
      'uvicorn[standard]==0.30.1',
      'django  # trailing comment',
      '-r other.txt',
      '--index-url https://example.com/simple',
      'git+https://github.com/x/y.git',
      '',
    ].join('\n'),
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    expectDep(r.deps, 'requests', '==2.31.0', 'runtime');
    expectDep(r.deps, 'flask', '>=3.0,<4.0', 'runtime');
    expectDep(r.deps, 'uvicorn', '==0.30.1', 'runtime');
    expectDep(r.deps, 'django', '', 'runtime');
    assert.ok(!find(r.deps, 'other.txt'), 'pip -r flag parsed as a package');
    assert.strictEqual(r.deps.length, 4, `unexpected rows: ${r.deps.map((d) => d.name).join(',')}`);
  });
});

test('python: PEP 621 pyproject dependencies and project identity', () => {
  withRepo({
    'pyproject.toml': [
      '[project]',
      'name = "myapp"',
      'version = "0.4.2"',
      'dependencies = [',
      '  "httpx>=0.27",',
      '  "pydantic==2.7.1",',
      ']',
    ].join('\n'),
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    expectDep(r.deps, 'httpx', '>=0.27', 'runtime');
    expectDep(r.deps, 'pydantic', '==2.7.1', 'runtime');
    const m = r.manifests.find((x) => x.file === 'pyproject.toml');
    assert.strictEqual(m.name, 'myapp');
    assert.strictEqual(m.version, '0.4.2');
  });
});

test('python: poetry tables, with the python constraint excluded', () => {
  withRepo({
    'pyproject.toml': [
      '[tool.poetry]', 'name = "p"', 'version = "1.0.0"',
      '[tool.poetry.dependencies]',
      'python = "^3.11"',
      'requests = "^2.31"',
      'boto3 = { version = "1.34.0", optional = true }',
      '[tool.poetry.dev-dependencies]',
      'pytest = "^8.0"',
    ].join('\n'),
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    expectDep(r.deps, 'requests', '^2.31', 'runtime');
    expectDep(r.deps, 'boto3', '1.34.0', 'runtime');
    expectDep(r.deps, 'pytest', '^8.0', 'dev');
    assert.ok(!find(r.deps, 'python'), 'the python constraint is not a dependency');
  });
});

// ─────────────────────────────── maven ─────────────────────────────

test('maven: coordinates, scopes, and property resolution', () => {
  const POM = [
    '<project>',
    '  <groupId>com.example</groupId>',
    '  <artifactId>demo-app</artifactId>',
    '  <version>2.1.0</version>',
    '  <properties>',
    '    <jackson.version>2.17.1</jackson.version>',
    '  </properties>',
    '  <!-- <dependency><groupId>ghost</groupId><artifactId>ghost</artifactId></dependency> -->',
    '  <dependencies>',
    '    <dependency>',
    '      <groupId>com.fasterxml.jackson.core</groupId>',
    '      <artifactId>jackson-databind</artifactId>',
    '      <version>${jackson.version}</version>',
    '    </dependency>',
    '    <dependency>',
    '      <groupId>junit</groupId>',
    '      <artifactId>junit</artifactId>',
    '      <version>4.13.2</version>',
    '      <scope>test</scope>',
    '    </dependency>',
    '  </dependencies>',
    '</project>',
  ].join('\n');

  withRepo({ 'pom.xml': POM }, (dir) => {
    const r = inv.collectDependencies(dir);
    // The whole point: a resolved version, not the literal placeholder.
    expectDep(r.deps, 'com.fasterxml.jackson.core:jackson-databind', '2.17.1', 'runtime');
    expectDep(r.deps, 'junit:junit', '4.13.2', 'test');
    assert.ok(!find(r.deps, 'ghost:ghost'), 'commented-out dependency was counted');
    const m = r.manifests.find((x) => x.file === 'pom.xml');
    assert.strictEqual(m.name, 'demo-app');
    assert.strictEqual(m.version, '2.1.0');
  });
});

test('gradle: string-notation dependencies across configurations', () => {
  withRepo({
    'build.gradle': [
      'dependencies {',
      "  implementation 'org.springframework:spring-core:6.1.0'",
      '  api("com.google.guava:guava:33.0.0-jre")',
      "  testImplementation 'org.junit.jupiter:junit-jupiter:5.10.0'",
      "  // implementation 'commented:out:1.0'",
      '}',
    ].join('\n'),
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    expectDep(r.deps, 'org.springframework:spring-core', '6.1.0', 'runtime');
    expectDep(r.deps, 'com.google.guava:guava', '33.0.0-jre', 'runtime');
    expectDep(r.deps, 'org.junit.jupiter:junit-jupiter', '5.10.0', 'test');
    assert.ok(!find(r.deps, 'commented:out'), 'commented-out gradle dependency was counted');
  });
});

test('gradle: version catalog resolves a version reference through [versions]', () => {
  withRepo({
    'gradle/libs.versions.toml': [
      '[versions]',
      'ktor = "2.3.9"',
      '[libraries]',
      'ktor-core = { module = "io.ktor:ktor-client-core", version.ref = "ktor" }',
      'guava = { group = "com.google.guava", name = "guava", version = "33.0.0" }',
    ].join('\n'),
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    expectDep(r.deps, 'io.ktor:ktor-client-core', '2.3.9', 'runtime');
    expectDep(r.deps, 'com.google.guava:guava', '33.0.0', 'runtime');
  });
});

// ──────────────────────── go / rust / ruby / php ───────────────────

test('go: require block, single-line require, and indirect marking', () => {
  withRepo({
    'go.mod': [
      'module github.com/example/app',
      'go 1.22',
      'require (',
      '  github.com/gin-gonic/gin v1.10.0',
      '  golang.org/x/sys v0.18.0 // indirect',
      ')',
      'require github.com/spf13/cobra v1.8.0',
    ].join('\n'),
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    expectDep(r.deps, 'github.com/gin-gonic/gin', 'v1.10.0', 'runtime');
    expectDep(r.deps, 'golang.org/x/sys', 'v0.18.0', 'indirect');
    expectDep(r.deps, 'github.com/spf13/cobra', 'v1.8.0', 'runtime');
    const m = r.manifests.find((x) => x.file === 'go.mod');
    assert.strictEqual(m.name, 'github.com/example/app');
    assert.strictEqual(m.version, 'go 1.22');
  });
});

test('cargo: inline tables, dev/build scopes and sub-tables', () => {
  withRepo({
    'Cargo.toml': [
      '[package]', 'name = "app"', 'version = "0.9.0"',
      '[dependencies]',
      'serde = { version = "1.0.197", features = ["derive"] }',
      'tokio = "1.37.0"',
      '[dev-dependencies]',
      'criterion = "0.5"',
      '[build-dependencies]',
      'cc = "1.0"',
      '[dependencies.reqwest]',
      'version = "0.12.3"',
    ].join('\n'),
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    expectDep(r.deps, 'serde', '1.0.197', 'runtime');
    expectDep(r.deps, 'tokio', '1.37.0', 'runtime');
    expectDep(r.deps, 'criterion', '0.5', 'dev');
    expectDep(r.deps, 'cc', '1.0', 'build');
    expectDep(r.deps, 'reqwest', '0.12.3', 'runtime');
    const m = r.manifests.find((x) => x.file === 'Cargo.toml');
    assert.strictEqual(m.name, 'app');
  });
});

test('ruby: gems with and without version constraints, grouped by scope', () => {
  withRepo({
    Gemfile: [
      "source 'https://rubygems.org'",
      "gem 'rails', '~> 7.1.0'",
      "gem 'puma'",
      'group :test do',
      "  gem 'rspec', '3.13.0'",
      'end',
      "gem 'pg', '1.5.6'",
    ].join('\n'),
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    expectDep(r.deps, 'rails', '~> 7.1.0', 'runtime');
    expectDep(r.deps, 'puma', '', 'runtime');
    expectDep(r.deps, 'rspec', '3.13.0', 'dev');
    expectDep(r.deps, 'pg', '1.5.6', 'runtime');
  });
});

test('php, dotnet and dart manifests are read', () => {
  withRepo({
    'composer.json': JSON.stringify({
      name: 'vendor/app',
      require: { 'monolog/monolog': '^3.0' },
      'require-dev': { 'phpunit/phpunit': '^11' },
    }),
    'App.csproj': '<Project><ItemGroup><PackageReference Include="Newtonsoft.Json" Version="13.0.3" /></ItemGroup></Project>',
    'pubspec.yaml': ['name: flutter_app', 'version: 1.0.0', 'dependencies:', '  http: ^1.2.0', 'dev_dependencies:', '  test: ^1.25.0'].join('\n'),
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    expectDep(r.deps, 'monolog/monolog', '^3.0', 'runtime');
    expectDep(r.deps, 'phpunit/phpunit', '^11', 'dev');
    expectDep(r.deps, 'Newtonsoft.Json', '13.0.3', 'runtime');
    expectDep(r.deps, 'http', '^1.2.0', 'runtime');
    expectDep(r.deps, 'test', '^1.25.0', 'dev');
    assert.deepStrictEqual(r.ecosystems, ['composer', 'nuget', 'pub']);
  });
});

// ──────────────────────────── behaviour ────────────────────────────

test('a polyglot repo reports every ecosystem at once', () => {
  withRepo({
    'package.json': JSON.stringify({ name: 'poly', dependencies: { express: '5.0.0' } }),
    'requirements.txt': 'requests==2.31.0\n',
    'go.mod': 'module x\ngo 1.22\nrequire github.com/a/b v1.0.0\n',
  }, (dir) => {
    const r = inv.collectDependencies(dir);
    assert.deepStrictEqual(r.ecosystems, ['go', 'npm', 'pypi']);
    assert.strictEqual(r.manifests.length, 3);
    assert.strictEqual(r.deps.length, 3);
  });
});

test('version pins cover runtime deps only, sorted and capped', () => {
  const pkg = { name: 'p', dependencies: {}, devDependencies: { mocha: '10.0.0' } };
  for (let i = 0; i < 50; i++) pkg.dependencies[`pkg-${String(i).padStart(2, '0')}`] = `1.0.${i}`;
  withRepo({ 'package.json': JSON.stringify(pkg) }, (dir) => {
    const r = inv.collectDependencies(dir);
    const { pins, total } = inv.versionPins(r, { limit: 10 });
    assert.strictEqual(pins.length, 10);
    assert.strictEqual(total, 50, 'total must report the full count, not the capped one');
    assert.deepStrictEqual(pins, [...pins].sort(), 'pins must be sorted');
    assert.ok(!pins.some((p) => p.startsWith('mocha@')), 'dev dependency leaked into pins');
  });
});

test('pins render in each ecosystem\'s own requirement syntax', () => {
  withRepo({
    'package.json': JSON.stringify({ name: 'd', dependencies: { express: '^5.1.0' } }),
    'requirements.txt': 'requests==2.31.0\nflask>=3.0\ndjango\n',
    'go.mod': 'module x\ngo 1.22\nrequire github.com/a/b v1.0.0\n',
  }, (dir) => {
    const { pins } = inv.versionPins(inv.collectDependencies(dir));
    // PyPI carries its own operator; an interposed @ would not be a real spec.
    assert.ok(pins.includes('requests==2.31.0'), `got: ${pins.join(' ')}`);
    assert.ok(pins.includes('flask>=3.0'), `got: ${pins.join(' ')}`);
    assert.ok(pins.includes('express@^5.1.0'), `got: ${pins.join(' ')}`);
    assert.ok(pins.includes('github.com/a/b@v1.0.0'), `got: ${pins.join(' ')}`);
    // A bare requirement with no version cannot be pinned at all.
    assert.ok(!pins.some((p) => p.startsWith('django')), `unversioned dep pinned: ${pins.join(' ')}`);
  });
});

test('per-manifest overflow is capped and disclosed', () => {
  const pkg = { name: 'big', dependencies: {} };
  for (let i = 0; i < inv.MAX_DEPS_PER_MANIFEST + 25; i++) pkg.dependencies[`p${i}`] = '1.0.0';
  withRepo({ 'package.json': JSON.stringify(pkg) }, (dir) => {
    const r = inv.collectDependencies(dir);
    assert.strictEqual(r.deps.length, inv.MAX_DEPS_PER_MANIFEST);
    assert.strictEqual(r.truncated, 25, 'the dropped count must be reported, not silent');
  });
});

test('output is deterministic and sorted', () => {
  withRepo({
    'package.json': JSON.stringify({ name: 'd', dependencies: { zod: '3', axios: '1', lodash: '4' } }),
  }, (dir) => {
    const a = inv.collectDependencies(dir);
    const b = inv.collectDependencies(dir);
    assert.deepStrictEqual(a.deps, b.deps);
    assert.deepStrictEqual(a.deps.map((d) => d.name), ['axios', 'lodash', 'zod']);
  });
});

test('an empty repo yields empty results, never a throw', () => {
  withRepo({}, (dir) => {
    const r = inv.collectDependencies(dir);
    assert.deepStrictEqual(r.deps, []);
    assert.deepStrictEqual(r.manifests, []);
    assert.deepStrictEqual(r.ecosystems, []);
    assert.deepStrictEqual(inv.versionPins(r).pins, []);
  });
});

test('malformed manifests degrade to no rows rather than throwing', () => {
  withRepo({
    'package.json': '{ not valid json',
    'pom.xml': '<project><dependencies><dependency>',
    'Cargo.toml': '[[[[',
    'go.mod': ' ',
  }, (dir) => {
    let r;
    assert.doesNotThrow(() => { r = inv.collectDependencies(dir); });
    assert.ok(Array.isArray(r.deps));
  });
});

test('SigMap itself reports zero runtime dependencies (the claim is load-bearing)', () => {
  const r = inv.collectDependencies(ROOT);
  const runtime = r.deps.filter((d) => d.ecosystem === 'npm' && d.scope === 'runtime');
  assert.deepStrictEqual(runtime, [], `sigmap declared runtime dependencies: ${runtime.map((d) => d.name).join(', ')}`);
  const pkg = r.manifests.find((m) => m.file === 'package.json');
  assert.strictEqual(pkg.name, 'sigmap');
});

// ─────────────── rendering: the "present" regression ───────────────

const configManifest = require(path.join(ROOT, 'src/map/config-manifest'));

test('the manifest map renders coordinates, never the word "present"', () => {
  withRepo({
    'package.json': JSON.stringify({ name: 'shop', version: '2.0.0', dependencies: { express: '^5.1.0' }, devDependencies: { jest: '^29' } }),
    'pom.xml': ['<project>', '<artifactId>svc</artifactId>', '<version>1.4.0</version>',
      '<properties><j.version>2.17.1</j.version></properties>',
      '<dependencies><dependency><groupId>com.fasterxml</groupId><artifactId>jackson</artifactId>',
      '<version>${j.version}</version></dependency></dependencies></project>'].join('\n'),
    'requirements.txt': 'requests==2.31.0\n',
  }, (dir) => {
    const md = configManifest.analyze([], dir);
    // The exact regression this feature exists to fix.
    assert.ok(!/\|\s*present\s*\|/.test(md), `still rendering "present":\n${md}`);
    assert.ok(md.includes('shop@2.0.0'), md);
    assert.ok(md.includes('svc@1.4.0'), md);
    // Scope counts replace the old bare presence flag.
    assert.ok(/\|\s*1 runtime, 1 dev\s*\|/.test(md), `npm scope counts missing:\n${md}`);
    // Property-resolved Maven coordinate reaches the rendered table.
    assert.ok(md.includes('com.fasterxml:jackson@2.17.1'), md);
    assert.ok(md.includes('requests==2.31.0'), md);
  });
});

test('the manifest map still renders for a repo with no manifests at all', () => {
  withRepo({ 'tsconfig.json': '{}' }, (dir) => {
    const md = configManifest.analyze([], dir);
    assert.ok(md.includes('tsconfig.json'), md);
  });
  withRepo({}, (dir) => {
    assert.strictEqual(configManifest.analyze([], dir), '');
  });
});

console.log('');
console.log(`dependency-inventory: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
