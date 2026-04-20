#!/usr/bin/env node
/**
 * sync-versions.mjs
 *
 * Syncs SigMap version across npm package files and plugin/runtime manifests.
 *
 * Usage:
 *   node scripts/sync-versions.mjs 3.2.1
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/sync-versions.mjs <x.y.z>');
  process.exit(1);
}

function updateJsonVersion(relPath) {
  const abs = join(ROOT, relPath);
  const json = JSON.parse(readFileSync(abs, 'utf8'));
  json.version = version;
  writeFileSync(abs, JSON.stringify(json, null, 2) + '\n');
  console.log(`  [32m✓[0m ${relPath}`);
}

function replaceOne(relPath, pattern, replacer) {
  const abs = join(ROOT, relPath);
  const src = readFileSync(abs, 'utf8');
  if (!pattern.test(src)) {
    console.error(`  [31m✗[0m ${relPath} (pattern not found)`);
    process.exit(1);
  }
  const out = src.replace(pattern, replacer);
  writeFileSync(abs, out);
  console.log(`  [32m✓[0m ${relPath}`);
}

console.log(`Syncing versions to ${version}`);

// npm package manifests
updateJsonVersion('package.json');
updateJsonVersion('packages/core/package.json');
updateJsonVersion('packages/cli/package.json');

// Core CLI/runtime constants
replaceOne(
  'gen-context.js',
  /const VERSION = '\d+\.\d+\.\d+';/,
  `const VERSION = '${version}';`
);

replaceOne(
  'gen-context.js',
  /(const SERVER_INFO = \{\n\s*name: 'sigmap',\n\s*version: ')\d+\.\d+\.\d+('\,)/,
  `$1${version}$2`
);

replaceOne(
  'src/mcp/server.js',
  /(const SERVER_INFO = \{\n\s*name: 'sigmap',\n\s*version: ')\d+\.\d+\.\d+('\,)/,
  `$1${version}$2`
);

console.log('Done.');
