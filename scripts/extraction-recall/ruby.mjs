#!/usr/bin/env node
// Extraction recall against a language-native parser: Ruby (the first case of the
// extraction-recall benchmark, #981; the harness for the other languages is #983).
//
// Asks Ruby's own parser (Ripper) which classes, modules and methods each file defines,
// asks SigMap's Ruby extractor the same question, and reports how many SigMap finds, per
// kind, by name within each file. Dev-only: needs a `ruby` on PATH and the pinned clones
// under benchmarks/repos; with either missing it says "unmeasured" and exits 0.
//
//   node scripts/extraction-recall/ruby.mjs [--repos <dir>] [--extractor <file>] [--json]
//                                           [--min-class <pct>] [--min-module <pct>] [--min-method <pct>] [--min-owner <pct>]
//
// The file set is fixed: the Rails libraries (actionpack, activerecord, activesupport) and
// Sidekiq, the 757 files Ruby 2.6 can parse (the system Ruby on macOS). Ruby 2.6 rejects
// modern syntax, so files using it drop out on BOTH sides; that is a subset, not a random
// sample of Ruby. Method names are compared by their bare name from `def` lines, skipping
// names that start with "_" (the extractor omits them on purpose); operator and non-ASCII
// method names are listed by the extractor but are not matched by this comparison.
//
// A fourth row, "owner", asks whether a method is listed under the class or module Ripper says
// defines it (a `def` line counts under the nearest class/module line above it; a column-0 `def`
// has no owner). Unlike the first three rows it matches every method name, operators included.
//
// Before #981 (column-0 classes, ownerless defs): class 13.8%, module 44.0%, method 82.7%.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const asJson = args.includes('--json');
const reposDir = path.resolve(opt('--repos', path.join(root, 'benchmarks', 'repos')));
const extractorPath = path.resolve(opt('--extractor', path.join(root, 'src', 'extractors', 'ruby.js')));
const floors = { class: opt('--min-class'), module: opt('--min-module'), method: opt('--min-method'), owner: opt('--min-owner') };

const ROOTS = [
  'rails/actionpack/lib',
  'rails/activerecord/lib/active_record',
  'rails/activesupport/lib/active_support',
  'sidekiq/lib',
];

function unmeasured(why) {
  if (asJson) console.log(JSON.stringify({ measured: false, reason: why }));
  else console.log(`extraction-recall ruby: unmeasured (${why})`);
  process.exit(0);
}

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.rb')) files.push(p);
  }
};
for (const r of ROOTS) {
  try { walk(path.join(reposDir, r)); } catch (_) { /* a missing clone is reported below */ }
}
if (files.length === 0) unmeasured(`no clones under ${reposDir}; run: node scripts/fetch-xrepo-repos.mjs`);
files.sort();

let truthByFile;
try {
  const out = execFileSync('ruby', [path.join(here, 'ruby-ripper.rb'), ...files], { maxBuffer: 1 << 29, encoding: 'utf8' });
  truthByFile = JSON.parse(out);
} catch (e) {
  unmeasured(e.code === 'ENOENT' ? 'ruby is not on PATH' : `ruby failed: ${String(e.message).split('\n')[0]}`);
}

const extractor = require(extractorPath);
const tally = { class: [0, 0], module: [0, 0], method: [0, 0], owner: [0, 0] };
let compared = 0;
for (const f of files) {
  const truth = truthByFile[f];
  if (!truth) continue;
  compared++;
  const got = { class: new Set(), module: new Set(), method: new Set() };
  const listed = new Map(); // "Owner|name" -> how many times the extractor lists it
  let owner = '';
  for (const raw of extractor.extract(fs.readFileSync(f, 'utf8'))) {
    const bare = raw.replace(/\s+:\d+-\d+.*$/, '');
    const line = bare.trim();
    let m;
    if ((m = /^class\s+(?:[\w:]*::)?([A-Z]\w*)/.exec(line))) { got.class.add(m[1]); owner = m[1]; }
    else if ((m = /^module\s+(?:[\w:]*::)?([A-Z]\w*)/.exec(line))) { got.module.add(m[1]); owner = m[1]; }
    else if ((m = /^def\s+(?:self\.)?([A-Za-z_]\w*[?!=]?)/.exec(line))) got.method.add(m[1]);
    if ((m = /^(\s*)def\s+(?:\w+\.)?([^\s(→]+)/.exec(bare))) {
      const key = `${m[1] ? owner : ''}|${m[2]}`;
      listed.set(key, (listed.get(key) || 0) + 1);
    }
  }
  const wanted = new Map();
  for (const [kind, name] of truth) {
    const bare = name.split(/[#.]/).pop();
    if (kind === 'method') {
      if (/^_/.test(bare)) continue;
      tally.method[0]++;
      if (got.method.has(bare)) tally.method[1]++;
      const key = `${/[#.]/.test(name) ? name.split(/[#.]/).slice(0, -1).join('') : ''}|${bare}`;
      wanted.set(key, (wanted.get(key) || 0) + 1);
    } else {
      tally[kind][0]++;
      if (got[kind].has(name)) tally[kind][1]++;
    }
  }
  for (const [key, count] of wanted) {
    tally.owner[0] += count;
    tally.owner[1] += Math.min(count, listed.get(key) || 0);
  }
}

const rows = Object.entries(tally).map(([kind, [reference, found]]) => ({
  kind, reference, found, recall: reference ? Math.round((1000 * found) / reference) / 10 : null,
}));
const sha = (repo) => {
  try { return execFileSync('git', ['-C', path.join(reposDir, repo), 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (_) { return null; }
};
const failures = rows.filter((r) => floors[r.kind] != null && r.recall < Number(floors[r.kind]));

if (asJson) {
  console.log(JSON.stringify({ measured: true, filesCompared: compared, pins: { rails: sha('rails'), sidekiq: sha('sidekiq') }, rows, failures: failures.map((r) => r.kind) }));
} else {
  console.log(`extraction-recall ruby: ${compared} files compared against Ripper (rails ${sha('rails') || '?'}, sidekiq ${sha('sidekiq') || '?'})`);
  for (const r of rows) {
    console.log(`  ${(r.kind === 'owner' ? 'owner' : r.kind).padEnd(7)} reference ${String(r.reference).padStart(5)}  found ${String(r.found).padStart(5)}  recall ${r.recall.toFixed(1)}%`);
  }
  for (const r of failures) console.log(`  FAIL ${r.kind}: ${r.recall.toFixed(1)}% is below the floor of ${floors[r.kind]}%`);
}
process.exit(failures.length ? 1 : 0);
