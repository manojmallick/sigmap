#!/usr/bin/env node
/**
 * build-binary.mjs — Phase A: Node.js SEA binary builder
 *
 * Builds a standalone sigmap binary for the current platform using
 * Node.js Single Executable Applications (Node 20+).
 *
 * Usage:
 *   node scripts/build-binary.mjs
 *
 * Output:
 *   dist/sigmap-darwin-arm64
 *   dist/sigmap-darwin-x64
 *   dist/sigmap-linux-x64
 *   dist/sigmap-win32-x64.exe
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { arch, platform } from 'os';
import { createRequire } from 'module';

const __require = createRequire(import.meta.url);
const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const DIST = join(ROOT, 'dist');

// ── Artifact naming ─────────────────────────────────────────────────────────

function artifactName() {
  const plat = platform(); // 'darwin' | 'linux' | 'win32'
  const cpu  = arch();    // 'arm64' | 'x64'
  const ext  = plat === 'win32' ? '.exe' : '';
  return `sigmap-${plat}-${cpu}${ext}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function log(msg) { console.log(`\n${msg}`); }
function ok(msg)  { console.log(`  ✓ ${msg}`); }

// ── Main ─────────────────────────────────────────────────────────────────────

log('── Phase A: build standalone binary ──────────────────────────────────────');

// 1. Pre-flight: ensure all src/ modules are present in gen-context.js __factories
{
  const { readdirSync, readFileSync, statSync } = await import('fs');
  const { join: pjoin } = await import('path');
  const bundle = readFileSync(join(ROOT, 'gen-context.js'), 'utf8');

  function walkSrc(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      const full = pjoin(dir, e.name);
      if (e.isDirectory()) files.push(...walkSrc(full));
      else if (e.isFile() && e.name.endsWith('.js')) files.push(full);
    }
    return files;
  }

  const srcDir = join(ROOT, 'src');
  const missing = [];
  for (const file of walkSrc(srcDir)) {
    const key = './' + file.slice(ROOT.length + 1).replace(/\.js$/, '').replace(/\\/g, '/');
    if (!bundle.includes(`"${key}"`)) missing.push(key);
  }

  if (missing.length > 0) {
    console.error('\nERROR: The following src/ modules are missing from gen-context.js __factories:');
    for (const m of missing) console.error(`  ${m}`);
    console.error('\nAdd them to gen-context.js before building the binary.');
    process.exit(1);
  }
  ok('bundle pre-flight: all src/ modules present in gen-context.js');
}

// 2. Verify Node version
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 20) {
  console.error(`ERROR: Node.js 20+ required for SEA. Current: ${process.versions.node}`);
  process.exit(1);
}
ok(`Node.js ${process.versions.node} — SEA supported`);

// 3. Ensure dist/ exists
if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });

// 4. Write sea-config.json
const seaConfig = {
  main: join(ROOT, 'gen-context.js'),
  output: join(DIST, 'sea-prep.blob'),
  disableExperimentalSEAWarning: true,
};
const seaConfigPath = join(DIST, 'sea-config.json');
writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));
ok('wrote dist/sea-config.json');

// 5. Generate the SEA blob
log('Generating SEA blob…');
run(`node --experimental-sea-config ${seaConfigPath}`);
ok('blob generated → dist/sea-prep.blob');

// 6. Copy the node binary as the base executable
const name = artifactName();
const dest = join(DIST, name);
copyFileSync(process.execPath, dest);
ok(`copied node binary → dist/${name}`);

// 7. Platform-specific: remove existing signature before injection
const plat = platform();
if (plat === 'darwin') {
  log('Removing existing macOS code signature…');
  run(`codesign --remove-signature "${dest}"`);
  ok('signature removed');
} else if (plat === 'win32') {
  // signtool remove not needed for unsigned Node binaries on Windows
  ok('Windows — no pre-removal needed');
}

// 8. Inject the SEA blob using postject
log('Injecting SEA blob with postject…');
const blobPath = join(DIST, 'sea-prep.blob');
const fuse = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

if (plat === 'darwin') {
  run(`npx --yes postject "${dest}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse ${fuse} --macho-segment-name NODE_SEA`);
} else {
  run(`npx --yes postject "${dest}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse ${fuse}`);
}
ok('blob injected');

// 9. macOS: ad-hoc re-sign
if (plat === 'darwin') {
  log('Re-signing binary (ad-hoc)…');
  run(`codesign --sign - "${dest}"`);
  ok('binary signed (ad-hoc)');
}

// 10. Make executable on Unix
if (plat !== 'win32') {
  run(`chmod +x "${dest}"`);
  ok('chmod +x applied');
}

log('──────────────────────────────────────────────────────────────────────────');
console.log(`\nBinary ready: dist/${name}`);
console.log('Run  node scripts/verify-binary.mjs  to smoke-test it.\n');
