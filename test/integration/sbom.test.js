'use strict';

/**
 * CycloneDX SBOM export (#2c', v8.50).
 *
 * The ask behind this was "flag CVEs in my dependencies". SigMap deliberately
 * does NOT do that: a network-sourced vulnerability section would make two
 * runs on the same commit disagree, which contaminates the byte-reproducibility
 * claim for the whole artifact, and it would mean owning a vulnerability feed
 * forever against tools that already do it for free.
 *
 * What SigMap emits instead is the thing those scanners need and cannot derive
 * from a signature map: a complete, deterministic component list. These tests
 * pin the parts that make it actually consumable — correct purls per
 * ecosystem, scope mapping, byte-stability, and honest disclosure when a
 * version is an inferred lower bound rather than a real pin.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const CLI = path.join(ROOT, 'gen-context.js');
const sbom = require(path.join(ROOT, 'src/deps/sbom'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

function withRepo(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-sbom-'));
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

const POLYGLOT = {
  'package.json': JSON.stringify({
    name: 'shop', version: '2.0.0',
    dependencies: { express: '^5.1.0', '@scope/util': '~2.1.0' },
    devDependencies: { jest: '29.7.0' },
  }),
  'package-lock.json': JSON.stringify({
    lockfileVersion: 3, packages: { 'node_modules/express': { version: '5.1.4' } },
  }),
  'requirements.txt': 'requests==2.31.0\nflask>=3.0\n',
  'go.mod': 'module github.com/ex/app\ngo 1.22\nrequire github.com/gin-gonic/gin v1.10.0\n',
  'pom.xml': '<project><artifactId>svc</artifactId><version>1.0</version><dependencies>'
    + '<dependency><groupId>com.fasterxml</groupId><artifactId>jackson</artifactId><version>2.17.1</version></dependency>'
    + '</dependencies></project>',
  'composer.json': JSON.stringify({ name: 'vendor/app', require: { 'monolog/monolog': '3.5.0' } }),
};

const purls = (bom) => bom.components.map((c) => c.purl);
const byName = (bom, name) => bom.components.find((c) => c.name === name);

// ──────────────────────────── document shape ───────────────────────

test('emits a valid-shaped CycloneDX 1.5 document', () => {
  withRepo(POLYGLOT, (dir) => {
    const { bom } = sbom.buildSbom(dir);
    assert.strictEqual(bom.bomFormat, 'CycloneDX');
    assert.strictEqual(bom.specVersion, '1.5');
    assert.strictEqual(bom.version, 1);
    assert.ok(Array.isArray(bom.components) && bom.components.length > 0);
    for (const c of bom.components) {
      assert.strictEqual(c.type, 'library');
      assert.ok(c['bom-ref'], 'every component needs a bom-ref');
      assert.ok(c.name, 'every component needs a name');
      assert.ok(['required', 'optional', 'excluded'].includes(c.scope), `bad scope: ${c.scope}`);
    }
  });
});

test('the project itself is the metadata component', () => {
  withRepo(POLYGLOT, (dir) => {
    const { bom } = sbom.buildSbom(dir);
    assert.strictEqual(bom.metadata.component.type, 'application');
    assert.strictEqual(bom.metadata.component.name, 'shop');
    assert.strictEqual(bom.metadata.component.version, '2.0.0');
  });
});

test('no timestamp and no serial number — both would break byte-stability', () => {
  withRepo(POLYGLOT, (dir) => {
    const { bom } = sbom.buildSbom(dir);
    assert.ok(!('serialNumber' in bom), 'serialNumber would vary per run');
    assert.ok(!('timestamp' in bom.metadata), 'metadata.timestamp would vary per run');
  });
});

test('output is byte-identical across runs', () => {
  withRepo(POLYGLOT, (dir) => {
    const a = sbom.formatSbom(sbom.buildSbom(dir).bom);
    const b = sbom.formatSbom(sbom.buildSbom(dir).bom);
    assert.strictEqual(a, b, 'SBOM is not byte-stable');
  });
});

test('components are sorted, so manifest read order cannot leak in', () => {
  withRepo(POLYGLOT, (dir) => {
    const refs = sbom.buildSbom(dir).bom.components.map((c) => c['bom-ref']);
    assert.deepStrictEqual(refs, [...refs].sort(), 'components are not sorted');
  });
});

// ──────────────────────────────── purls ────────────────────────────

test('purls follow purl-spec for every supported ecosystem', () => {
  withRepo(POLYGLOT, (dir) => {
    const { bom } = sbom.buildSbom(dir);
    const all = purls(bom);
    assert.ok(all.includes('pkg:npm/express@5.1.4'), all.join('\n'));
    // npm scopes are a namespace with the @ percent-encoded.
    assert.ok(all.includes('pkg:npm/%40scope/util@2.1.0'), all.join('\n'));
    // Maven splits groupId/artifactId into namespace + name.
    assert.ok(all.includes('pkg:maven/com.fasterxml/jackson@2.17.1'), all.join('\n'));
    // Go keeps its slash-separated module path and its `v` prefix.
    assert.ok(all.includes('pkg:golang/github.com/gin-gonic/gin@v1.10.0'), all.join('\n'));
    assert.ok(all.includes('pkg:pypi/requests@2.31.0'), all.join('\n'));
    assert.ok(all.includes('pkg:composer/vendor/monolog%2Fmonolog@3.5.0')
      || all.includes('pkg:composer/monolog/monolog@3.5.0'), all.join('\n'));
  });
});

test('every component carries a purl (scanners key off it)', () => {
  withRepo(POLYGLOT, (dir) => {
    const missing = sbom.buildSbom(dir).bom.components.filter((c) => !c.purl);
    assert.deepStrictEqual(missing.map((c) => c.name), [], 'components without a purl are unscannable');
  });
});

// ───────────────────────── versions and honesty ────────────────────

test('a locked exact version wins over the declared range', () => {
  withRepo(POLYGLOT, (dir) => {
    const express = byName(sbom.buildSbom(dir).bom, 'express');
    assert.strictEqual(express.version, '5.1.4', 'the lockfile version was not used');
  });
});

test('an inferred lower bound is labelled as inferred, and the spec is kept', () => {
  withRepo(POLYGLOT, (dir) => {
    const util = byName(sbom.buildSbom(dir).bom, '@scope/util');
    assert.strictEqual(util.version, '2.1.0');
    const props = Object.fromEntries(util.properties.map((p) => [p.name, p.value]));
    assert.strictEqual(props['sigmap:versionInferred'], 'lower-bound-of-range',
      'a range-derived version must not masquerade as a pin');
    assert.strictEqual(props['sigmap:versionSpec'], '~2.1.0', 'the original spec was discarded');
  });
});

test('stats separate pinned from inferred so the caller can disclose it', () => {
  withRepo(POLYGLOT, (dir) => {
    const { stats } = sbom.buildSbom(dir);
    assert.ok(stats.exact > 0, 'no pinned components counted');
    assert.ok(stats.ranged > 0, 'range-derived components were not counted separately');
    assert.strictEqual(stats.total, stats.exact + stats.ranged + stats.unversioned);
    const summary = sbom.summarize(stats).join('\n');
    assert.ok(/declared as a range/.test(summary), `summary hides the imprecision:\n${summary}`);
    assert.ok(/osv-scanner/.test(summary), 'summary does not say what to do next');
  });
});

test('--exact-only drops everything that is not a real pin', () => {
  withRepo(POLYGLOT, (dir) => {
    const { bom, stats } = sbom.buildSbom(dir, { exactOnly: true });
    assert.strictEqual(stats.ranged, 0);
    assert.ok(!byName(bom, '@scope/util'), 'a range-derived component survived --exact-only');
    assert.ok(byName(bom, 'express'), 'a locked component was wrongly dropped');
  });
});

test('--no-dev drops dev and test tooling only', () => {
  withRepo(POLYGLOT, (dir) => {
    const { bom } = sbom.buildSbom(dir, { includeDev: false });
    assert.ok(!byName(bom, 'jest'), 'a dev dependency survived --no-dev');
    assert.ok(byName(bom, 'express'), 'a runtime dependency was wrongly dropped');
  });
});

test('runtime maps to required and dev maps to optional', () => {
  withRepo(POLYGLOT, (dir) => {
    const { bom } = sbom.buildSbom(dir);
    assert.strictEqual(byName(bom, 'express').scope, 'required');
    assert.strictEqual(byName(bom, 'jest').scope, 'optional');
  });
});

test('version normalization handles pins, ranges and junk', () => {
  assert.strictEqual(sbom.normalizeVersion('5.1.4'), '5.1.4');
  assert.strictEqual(sbom.normalizeVersion('v1.10.0'), 'v1.10.0');
  assert.strictEqual(sbom.normalizeVersion('^5.1.0'), '5.1.0');
  assert.strictEqual(sbom.normalizeVersion('~2.1.0'), '2.1.0');
  assert.strictEqual(sbom.normalizeVersion('>=3.0,<4.0'), '3.0');
  assert.strictEqual(sbom.normalizeVersion('==2.31.0'), '2.31.0');
  assert.strictEqual(sbom.normalizeVersion(''), '');
  assert.strictEqual(sbom.normalizeVersion('*'), '');
  assert.strictEqual(sbom.normalizeVersion(null), '');
});

// ────────────────────────────── the CLI ────────────────────────────

test('`sigmap sbom` prints parseable JSON on stdout', () => {
  withRepo(POLYGLOT, (dir) => {
    const out = execFileSync('node', [CLI, 'sbom'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const bom = JSON.parse(out);
    assert.strictEqual(bom.bomFormat, 'CycloneDX');
    assert.ok(bom.components.length >= 6, `expected the full component list, got ${bom.components.length}`);
  });
});

test('`sigmap sbom --out` writes a file and keeps stdout clean', () => {
  withRepo(POLYGLOT, (dir) => {
    execFileSync('node', [CLI, 'sbom', '--out', 'sbom.json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'sbom.json'), 'utf8'));
    assert.strictEqual(written.specVersion, '1.5');
  });
});

test('`sigmap deps` lists packages and points at a real scanner', () => {
  withRepo(POLYGLOT, (dir) => {
    const out = execFileSync('node', [CLI, 'deps'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.ok(out.includes('express'), out);
    assert.ok(out.includes('5.1.4') && out.includes('(locked)'), `lock state not shown:\n${out}`);
    assert.ok(out.includes('github.com/gin-gonic/gin'), out);
    // The scope boundary is stated, not implied.
    assert.ok(/Vulnerability scanning is deliberately out of scope/.test(out), out);
    assert.ok(/osv-scanner/.test(out), out);
  });
});

test('`sigmap deps --json` emits the raw inventory', () => {
  withRepo(POLYGLOT, (dir) => {
    const out = execFileSync('node', [CLI, 'deps', '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const inv = JSON.parse(out);
    assert.ok(Array.isArray(inv.deps) && inv.deps.length > 0);
    assert.ok(Array.isArray(inv.manifests) && inv.manifests.length > 0);
  });
});

test('both commands are registered so a typo cannot trigger a write', () => {
  const src = fs.readFileSync(CLI, 'utf8');
  const block = src.slice(src.indexOf('const KNOWN_COMMANDS'), src.indexOf('FLAG_GATED_COMMANDS'));
  assert.ok(/'sbom'/.test(block), 'sbom is not in KNOWN_COMMANDS');
  assert.ok(/'deps'/.test(block), 'deps is not in KNOWN_COMMANDS');
});

test('a repo with no manifests produces an empty BOM, not a crash', () => {
  withRepo({ 'README.md': '# nothing here\n' }, (dir) => {
    const { bom, stats } = sbom.buildSbom(dir);
    assert.deepStrictEqual(bom.components, []);
    assert.strictEqual(stats.total, 0);
    const out = execFileSync('node', [CLI, 'sbom'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.doesNotThrow(() => JSON.parse(out));
  });
});

test('SigMap does not ship a CVE database or any network call', () => {
  // The scope boundary is the feature. Pin it so it cannot drift in later.
  const src = fs.readFileSync(path.join(ROOT, 'src/deps/sbom.js'), 'utf8')
    + fs.readFileSync(path.join(ROOT, 'src/deps/inventory.js'), 'utf8');
  for (const forbidden of ['require(\'https\')', 'require("https")', 'require(\'http\')', 'fetch(', 'XMLHttpRequest']) {
    assert.ok(!src.includes(forbidden), `dependency tooling reaches the network via ${forbidden}`);
  }
});

console.log('');
console.log(`sbom: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
