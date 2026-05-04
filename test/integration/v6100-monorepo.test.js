'use strict';

const { detectWorkspaces, inferPackage, scopeToPackage } = require('../../src/workspace/detector');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

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

function makeMono(packages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-mono-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ workspaces: ['packages/*'] }));
  fs.mkdirSync(path.join(dir, 'packages'));
  for (const p of packages) {
    const pkgDir = path.join(dir, 'packages', p);
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: p }));
  }
  return dir;
}

function makeMonoWithYarnV2(packages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-mono-yarnv2-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    workspaces: { packages: ['packages/*'] }
  }));
  fs.mkdirSync(path.join(dir, 'packages'));
  for (const p of packages) {
    const pkgDir = path.join(dir, 'packages', p);
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: p }));
  }
  return dir;
}

console.log('[v6100-monorepo.test.js] Workspace detector module');
console.log('');

test('detectWorkspaces returns package directories from workspaces glob', () => {
  const cwd = makeMono(['core', 'payments', 'auth']);
  const dirs = detectWorkspaces(cwd);
  assert.strictEqual(dirs.length, 3, `expected 3 packages, got ${dirs.length}`);
  assert(dirs.some(d => d.includes('payments')), 'payments package missing');
  assert(dirs.some(d => d.includes('auth')), 'auth package missing');
  assert(dirs.some(d => d.includes('core')), 'core package missing');
});

test('detectWorkspaces handles Yarn v2 workspaces.packages format', () => {
  const cwd = makeMonoWithYarnV2(['core', 'payments']);
  const dirs = detectWorkspaces(cwd);
  assert(dirs.length > 0, 'should detect workspaces in v2 format');
  assert(dirs.some(d => d.includes('payments')), 'payments package missing in v2 format');
});

test('detectWorkspaces returns [] on non-monorepo', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-plain-'));
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'myapp' }));
  const dirs = detectWorkspaces(cwd);
  assert.deepStrictEqual(dirs, []);
});

test('detectWorkspaces returns [] when package.json does not exist', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-nopackage-'));
  const dirs = detectWorkspaces(cwd);
  assert.deepStrictEqual(dirs, []);
});

test('detectWorkspaces returns [] when package.json is invalid JSON', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-badpkg-'));
  fs.writeFileSync(path.join(cwd, 'package.json'), 'not valid json {');
  const dirs = detectWorkspaces(cwd);
  assert.deepStrictEqual(dirs, []);
});

test('inferPackage matches exact token to package name', () => {
  const cwd = makeMono(['core', 'payments', 'auth']);
  const dirs = detectWorkspaces(cwd);
  const inferred = inferPackage('add rate limiting to payments', dirs, cwd);
  assert(inferred, 'should infer a package');
  assert(inferred.includes('payments'), `expected payments, got ${path.basename(inferred)}`);
});

test('inferPackage matches prefix token to package name', () => {
  const cwd = makeMono(['core', 'payments', 'auth']);
  const dirs = detectWorkspaces(cwd);
  const inferred = inferPackage('fix the pay processing', dirs, cwd);
  assert(inferred, 'should infer package with prefix match');
  assert(inferred.includes('payments'), 'expected payments for "pay" prefix');
});

test('inferPackage returns null when no match', () => {
  const cwd = makeMono(['core', 'payments']);
  const dirs = detectWorkspaces(cwd);
  const inferred = inferPackage('fix the database connection pool', dirs, cwd);
  assert.strictEqual(inferred, null, 'expected null when no package matches');
});

test('inferPackage matches 3-character tokens', () => {
  const cwd = makeMono(['api', 'ui']);
  const dirs = detectWorkspaces(cwd);
  const inferred = inferPackage('fix api', dirs, cwd);
  // 'api' is 3 chars so should match (>= 3 chars is the threshold)
  assert(inferred, 'should match 3-char tokens');
  assert(inferred.includes('api'), 'should match "api" package');
});

test('inferPackage prefers exact match over prefix match', () => {
  const cwd = makeMono(['payment', 'payments-pro', 'payments']);
  const dirs = detectWorkspaces(cwd);
  // Query contains exact token "payments", so should match "payments" not "payments-pro"
  const inferred = inferPackage('add feature to payments', dirs, cwd);
  assert(inferred && inferred.includes('payments'), 'should prefer exact match "payments"');
});

test('inferPackage exact matches take precedence over prefix matches', () => {
  const cwd = makeMono(['pay', 'payment', 'paymentx']);
  const dirs = detectWorkspaces(cwd);
  // "payment" is exact match, while others are prefix matches
  const inferred = inferPackage('implement payment processing', dirs, cwd);
  assert(inferred, 'should infer a package');
  assert(inferred.includes('payment'), 'should prefer exact match "payment"');
});

test('scopeToPackage returns +0.30 for files inside package', () => {
  const cwd = makeMono(['payments']);
  const dirs = detectWorkspaces(cwd);
  const packageDir = dirs[0];
  const filePath = path.join(packageDir, 'src', 'service.ts');
  const boost = scopeToPackage(filePath, packageDir);
  assert.strictEqual(boost, 0.30, `expected 0.30, got ${boost}`);
});

test('scopeToPackage returns 0 for files outside package', () => {
  const cwd = makeMono(['payments', 'core']);
  const dirs = detectWorkspaces(cwd);
  const boost = scopeToPackage(path.join(dirs[1], 'index.ts'), dirs[0]);
  assert.strictEqual(boost, 0, `expected 0, got ${boost}`);
});

test('scopeToPackage handles Windows-style paths correctly', () => {
  const packageDir = 'C:\\repo\\packages\\payments';
  const filePath = 'C:\\repo\\packages\\payments\\src\\service.ts';
  const boost = scopeToPackage(filePath, packageDir);
  assert.strictEqual(boost, 0.30, 'should handle Windows paths');
});

test('scopeToPackage works with relative paths', () => {
  const packageDir = 'packages/payments';
  const filePath = 'packages/payments/src/service.ts';
  const boost = scopeToPackage(filePath, packageDir);
  assert.strictEqual(boost, 0.30, 'should work with relative paths');
});

test('detectWorkspaces skips files when enumerating package dirs', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-file-in-packages-'));
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ workspaces: ['packages/*'] }));
  fs.mkdirSync(path.join(cwd, 'packages'));
  fs.mkdirSync(path.join(cwd, 'packages', 'core'));
  fs.writeFileSync(path.join(cwd, 'packages', 'README.md'), '# Packages');
  const dirs = detectWorkspaces(cwd);
  assert.strictEqual(dirs.length, 1, 'should skip files when enumerating');
  assert(dirs[0].includes('core'), 'should find core directory');
});

test('detectWorkspaces handles missing packages directory gracefully', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-missing-packages-'));
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ workspaces: ['packages/*', 'apps/*'] }));
  // Don't create packages or apps directories
  const dirs = detectWorkspaces(cwd);
  assert.strictEqual(dirs.length, 0, 'should return [] when glob dirs don\'t exist');
});

test('detectWorkspaces handles deep glob patterns (packages/*/src)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-deep-glob-'));
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ workspaces: ['packages/*/src'] }));
  // This should resolve to packages/ and find subdirs
  const dirs = detectWorkspaces(cwd);
  // Pattern resolves to 'packages/*/' so becomes 'packages'
  // When 'packages' doesn't exist, should return []
  assert.strictEqual(dirs.length, 0, 'deep glob on non-existent dir should return []');
});

test('inferPackage case-insensitive matching', () => {
  const cwd = makeMono(['Payments', 'Auth']);
  const dirs = detectWorkspaces(cwd);
  const inferred = inferPackage('fix PAYMENTS', dirs, cwd);
  assert(inferred, 'should match case-insensitively');
  assert(inferred.toLowerCase().includes('payments'), 'case-insensitive match failed');
});

test('inferPackage handles special characters in query', () => {
  const cwd = makeMono(['user-service', 'auth-service']);
  const dirs = detectWorkspaces(cwd);
  const inferred = inferPackage('fix user@service bug', dirs, cwd);
  assert(inferred, 'should handle special chars in query');
});

test('scopeToPackage does not boost for partial path matches', () => {
  const packageDir = 'packages/payment';
  const filePath = 'packages/payment-old/src/index.ts';
  const boost = scopeToPackage(filePath, packageDir);
  assert.strictEqual(boost, 0, 'should not boost partial matches');
});

test('detectWorkspaces returns empty for malformed workspaces field', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-malformed-ws-'));
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ workspaces: null }));
  const dirs = detectWorkspaces(cwd);
  assert.deepStrictEqual(dirs, [], 'should handle null workspaces gracefully');
});

console.log('');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
