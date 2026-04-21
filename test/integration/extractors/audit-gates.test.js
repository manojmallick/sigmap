'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const AUDIT = path.join(ROOT, 'scripts', 'run-strategy-audit.mjs');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-audit-'));
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

function runAudit(repoDir, outDir) {
  return spawnSync(process.execPath, [AUDIT, '--repo', repoDir, '--out', outDir], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 20 * 1024 * 1024,
  });
}

test('strategy audit emits coverage and strategy comparison metrics for re-audit gates', () => {
  withTempDir((dir) => {
    const outDir = path.join(dir, '.context', 'strategy-audit');
    writeFiles(dir, {
      'package.json': JSON.stringify({ name: 'demo-app', dependencies: { react: '^19.0.0', next: '^15.0.0' } }),
      'app/page.tsx': 'export default function Home() { return null; }',
      'components/Nav.tsx': 'export function Nav() { return null; }',
      'lib/api.ts': 'export function fetchData() { return Promise.resolve(); }',
      'docs/architecture.md': '# Architecture\n\n## Routing\n\n```ts\nexport function route() {}\n```\n',
      'src/main/resources/application.properties': 'spring.application.name=demo\nserver.port=8080\n',
      'src/main/resources/beans.xml': '<beans><bean id="router" class="demo.Router" /></beans>',
    });

    const result = runAudit(dir, outDir);
    assert.strictEqual(result.status, 0, `exit ${result.status}: ${result.stderr}`);

    const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'summary.json'), 'utf8'));
    assert.ok(summary.coverageSummary, 'missing coverageSummary');
    assert.ok(typeof summary.coverageSummary.discoveredFileCount === 'number');
    assert.ok(typeof summary.coverageSummary.analyzedFileCount === 'number');
    assert.ok(Array.isArray(summary.coverageSummary.missingSupportedFiles));
    assert.ok(Array.isArray(summary.coverageSummary.missingImportantFiles));
    assert.ok(Array.isArray(summary.coverageSummary.zeroSigFiles));
    assert.ok(summary.strategies.full && summary.strategies['per-module'] && summary.strategies['hot-cold'], 'missing strategy results');
    assert.ok(typeof summary.strategies.full.report.finalTokens === 'number', 'missing full.report.finalTokens');
  });
});

test('strategy audit no longer flags Phase A formats as high-value unsupported', () => {
  withTempDir((dir) => {
    const outDir = path.join(dir, '.context', 'strategy-audit');
    writeFiles(dir, {
      'pom.xml': '<project><modelVersion>4.0.0</modelVersion></project>',
      'src/main/java/demo/App.java': 'class App { void boot() {} }',
      'src/main/resources/application.properties': 'spring.application.name=demo\n',
      'src/main/resources/routes.xml': '<routes><route path="/health" /></routes>',
      'docs/architecture.md': '# Architecture\n\n## Services\n\n```java\nclass App {}\n```\n',
    });

    const result = runAudit(dir, outDir);
    assert.strictEqual(result.status, 0, `exit ${result.status}: ${result.stderr}`);

    const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'summary.json'), 'utf8'));
    const exts = summary.coverageSummary.missingImportantFiles.map((entry) => entry.ext);
    assert.ok(!exts.includes('.properties'), 'did not expect .properties to remain important unsupported after Phase A');
    assert.ok(!exts.includes('.xml'), 'did not expect .xml to remain important unsupported after Phase A');
    assert.ok(!exts.includes('.md'), 'did not expect .md to remain important unsupported after Phase A');
  });
});

console.log('');
console.log(`phase34-audit-gates: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);