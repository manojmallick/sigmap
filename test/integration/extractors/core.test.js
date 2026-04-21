'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
const { analyzeFiles } = require(path.join(ROOT, 'src', 'eval', 'analyzer'));

let passed = 0;
let failed = 0;
let skipped = 0;

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

function skip(name, reason) {
  console.log(`  SKIP  ${name}: ${reason}`);
  skipped++;
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-p2-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function maybeRunExtractorCase(name, ext, source, expectations) {
  const extractorPath = path.join(ROOT, 'src', 'extractors', `${name}.js`);
  if (!fs.existsSync(extractorPath)) {
    skip(`${name} extractor readiness`, 'extractor not implemented yet');
    return;
  }

  const extractor = require(extractorPath);
  test(`${name} extractor returns signatures and is analyzable via ${ext}`, () => {
    const sigs = extractor.extract(source);
    assert.ok(Array.isArray(sigs), 'extract() must return an array');
    assert.ok(sigs.length > 0, 'expected at least one signature');

    const text = sigs.join('\n');
    for (const re of expectations) {
      assert.ok(re.test(text), `expected ${re} in signatures, got: ${text}`);
    }

    withTempDir((dir) => {
      const filePath = path.join(dir, `fixture${ext}`);
      fs.writeFileSync(filePath, source, 'utf8');
      const rows = analyzeFiles([filePath], dir);
      assert.strictEqual(rows.length, 1, 'analyzeFiles should recognize the new extension');
      assert.ok(rows[0].sigs > 0, 'analyzeFiles should report non-zero signatures');
    });
  });
}

maybeRunExtractorCase(
  'toml',
  '.toml',
  '[project]\nname = "demo"\nversion = "0.1.0"\n[tool.poetry]\ndescription = "x"\n',
  [/project/i, /tool\.poetry|poetry/i, /name|version/i],
);

maybeRunExtractorCase(
  'properties',
  '.properties',
  'spring.application.name=sigmap\nserver.port=8080\nmanagement.endpoint.health.enabled=true\n',
  [/spring\.application\.name/i, /server\.port/i],
);

maybeRunExtractorCase(
  'xml',
  '.xml',
  '<beans><bean id="authService" class="demo.AuthService" /><bean id="router" class="demo.Router" /></beans>',
  [/beans/i, /bean|authService|router/i],
);

maybeRunExtractorCase(
  'markdown',
  '.md',
  '# Architecture\n\n## Routing\n\n```ts\nexport function route() {}\n```\n',
  [/Architecture/i, /Routing/i, /ts|route/i],
);

console.log('');
console.log(`phase3-extractors: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) process.exit(1);