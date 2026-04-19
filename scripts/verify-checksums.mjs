#!/usr/bin/env node
/**
 * verify-checksums.mjs — verify a sigmap binary against its .sha256 checksum file
 *
 * Usage:
 *   node scripts/verify-checksums.mjs                  # auto-detects current platform binary
 *   node scripts/verify-checksums.mjs dist/sigmap-linux-x64
 *
 * Exit codes:
 *   0 — checksum matches
 *   1 — mismatch or file not found
 */

import { createHash } from 'crypto';
import { createReadStream, existsSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { arch, platform } from 'os';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

function artifactName() {
  const plat = platform();
  const cpu  = arch();
  const ext  = plat === 'win32' ? '.exe' : '';
  return `sigmap-${plat}-${cpu}${ext}`;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash   = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

const binaryArg = process.argv[2];
const binaryPath = binaryArg
  ? (binaryArg.startsWith('/') ? binaryArg : join(process.cwd(), binaryArg))
  : join(DIST, artifactName());

const checksumPath = `${binaryPath}.sha256`;
const binaryName   = basename(binaryPath);

console.log(`\n── verify-checksums: ${binaryName} ────────────────────────────────────────────`);

if (!existsSync(binaryPath)) {
  console.error(`\nERROR: binary not found: ${binaryPath}`);
  console.error('Run  node scripts/build-binary.mjs  first.\n');
  process.exit(1);
}

if (!existsSync(checksumPath)) {
  console.error(`\nERROR: checksum file not found: ${checksumPath}`);
  console.error('Run  node scripts/build-binary.mjs  to regenerate checksums.\n');
  process.exit(1);
}

const checksumLine   = readFileSync(checksumPath, 'utf8').trim();
const expectedDigest = checksumLine.split(/\s+/)[0];

if (!expectedDigest || !/^[0-9a-f]{64}$/.test(expectedDigest)) {
  console.error(`\nERROR: malformed checksum file: ${checksumPath}`);
  process.exit(1);
}

const actualDigest = await sha256File(binaryPath);

if (actualDigest === expectedDigest) {
  console.log(`  ✓ SHA-256 matches: ${actualDigest}`);
  console.log(`\nChecksum OK — ${binaryName} is unmodified.\n`);
  process.exit(0);
} else {
  console.error(`  ✗ SHA-256 MISMATCH`);
  console.error(`    expected: ${expectedDigest}`);
  console.error(`    actual:   ${actualDigest}`);
  console.error(`\nDo not use this binary — it may have been tampered with.\n`);
  process.exit(1);
}
