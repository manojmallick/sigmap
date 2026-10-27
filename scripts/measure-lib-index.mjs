#!/usr/bin/env node
'use strict';

/**
 * measure-lib-index.mjs — how much of the packages people actually use does the
 * installed-library index read? (#990)
 *
 * The index behind `verify` / `verify_suggestion` grounds an answer's imports in
 * the declarations installed under node_modules. For a long time it read only a
 * package's entry file, so a package that keeps its names behind `export * from`
 * barrels (zod, rxjs, lodash-style packages) read as empty while the output still
 * said it grounded against it. This installs a pinned sample of popular packages
 * and reports, per package, the names read, whether any types were found, and
 * whether a re-export could not be followed.
 *
 *   node scripts/measure-lib-index.mjs --dir <empty dir>             # install the pins, then measure
 *   node scripts/measure-lib-index.mjs --dir <dir> --no-install      # measure what is already there
 *   node scripts/measure-lib-index.mjs --dir <dir> --gate            # exit 1 if more than 3 read as 0 names
 *   node scripts/measure-lib-index.mjs --dir <dir> --runtime         # also compare with Object.keys(require(pkg))
 *
 * The install uses `npm install --ignore-scripts` (no package code runs). `--runtime`
 * does run it: it `require()`s each package in a child process, which is the only way
 * to count runtime exports, so it is off by default. Needs the network to install;
 * measuring an existing tree does not.
 *
 * The list is benchmarks/lib-index-sample.json (exact versions). Zero dependencies.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { buildLibraryIndex } = require(join(ROOT, 'src', 'verify', 'lib-index.js'));

const MAX_ZERO = 3; // the acceptance bar: at most this many packages may read as empty
const LOW_SHARE = 0.1; // ...or under this share of their runtime exports

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const dirIdx = args.indexOf('--dir');
if (dirIdx === -1 || !args[dirIdx + 1]) {
  console.error('usage: node scripts/measure-lib-index.mjs --dir <directory> [--no-install] [--runtime] [--gate] [--json]');
  process.exit(2);
}
const dir = resolve(args[dirIdx + 1]);
const sample = JSON.parse(readFileSync(join(ROOT, 'benchmarks', 'lib-index-sample.json'), 'utf8'));
const names = Object.keys(sample.packages);

if (!flag('--no-install')) {
  mkdirSync(dir, { recursive: true });
  if (readdirSync(dir).length) {
    console.error(`${dir} is not empty; pass an empty directory, or --no-install to measure what is there`);
    process.exit(2);
  }
  const all = { ...sample.packages, ...sample.types };
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'lib-index-sample', version: '0.0.0', private: true, dependencies: all }, null, 2));
  console.error(`installing ${Object.keys(all).length} pinned packages into ${dir} (no install scripts) ...`);
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps', '--loglevel=error'], { cwd: dir, stdio: ['ignore', 'inherit', 'inherit'] });
} else if (!existsSync(join(dir, 'node_modules'))) {
  console.error(`${dir}/node_modules not found`);
  process.exit(2);
}

// Only the sample packages count; their @types companions are read through them.
const pkgJson = join(dir, 'package.json');
const original = existsSync(pkgJson) ? readFileSync(pkgJson, 'utf8') : null;
writeFileSync(pkgJson, JSON.stringify({ name: 'lib-index-sample', version: '0.0.0', dependencies: Object.fromEntries(names.map((n) => [n, '*'])) }));
const idx = buildLibraryIndex(dir, { cache: false });
if (original !== null) writeFileSync(pkgJson, original);

function runtimeExports(name) {
  const r = spawnSync(process.execPath, ['-e', `const m=require(${JSON.stringify(name)});console.log(Object.keys(m).length)`], { cwd: dir, encoding: 'utf8', timeout: 20000 });
  const n = Number((r.stdout || '').trim());
  return r.status === 0 && Number.isFinite(n) ? n : null;
}

const rows = names.map((name) => {
  const l = idx.libraries.find((x) => x.name === name);
  const row = { name, version: l ? l.version : null, installed: !!l, names: l ? l.symbols : 0, typed: l ? l.typed : false, partial: !!(l && l.partial) };
  if (flag('--runtime') && l) {
    row.runtime = runtimeExports(name);
    row.share = row.runtime ? Math.min(1, row.names / row.runtime) : null;
  }
  return row;
});

const missing = rows.filter((r) => !r.installed);
const zero = rows.filter((r) => r.installed && r.names === 0);
const low = rows.filter((r) => r.installed && r.share !== undefined && r.share !== null && r.share < LOW_SHARE);
const partial = rows.filter((r) => r.partial);

if (flag('--json')) {
  process.stdout.write(JSON.stringify({ packages: rows.length, installed: rows.length - missing.length, zeroNames: zero.length, partial: partial.length, lowShare: flag('--runtime') ? low.length : null, rows }, null, 2) + '\n');
} else {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`${pad('package', 28)}${pad('version', 10)}${pad('names', 8)}${pad('types', 7)}${flag('--runtime') ? pad('runtime', 9) : ''}note`);
  for (const r of rows) {
    const note = !r.installed ? 'NOT INSTALLED' : r.names === 0 ? 'EMPTY' : r.partial ? 'partial' : '';
    console.log(`${pad(r.name, 28)}${pad(r.version || '-', 10)}${pad(r.names, 8)}${pad(r.typed ? 'yes' : 'no', 7)}${flag('--runtime') ? pad(r.runtime == null ? '-' : r.runtime, 9) : ''}${note}`);
  }
  console.log(`\n${rows.length} packages · ${rows.length - missing.length} installed · ${zero.length} read as 0 names · ${partial.length} partial${flag('--runtime') ? ` · ${low.length} under ${LOW_SHARE * 100}% of runtime exports` : ''}`);
}

if (flag('--gate') && (zero.length > MAX_ZERO || missing.length > 0)) {
  console.error(`FAIL: ${zero.length} package(s) read as 0 names (allowed ${MAX_ZERO}), ${missing.length} not installed`);
  process.exit(1);
}
