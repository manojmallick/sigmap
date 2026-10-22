#!/usr/bin/env node
// Extraction recall against a language-native parser: Ruby (the first case of the
// extraction-recall benchmark, #981; scripts/run-extraction-recall.mjs runs every case, #983).
//
// Asks Ruby's own parser (Ripper) which classes, modules and methods each file defines,
// asks SigMap's Ruby extractor the same question, and reports how many SigMap finds, per
// kind, by name within each file. Two populations: the extractor's raw output, and the index
// as shipped (what a first-time `sigmap` run keeps, after the 25-signature-per-file cap). An index
// row is scored over the files the index holds, so the cap is not confused with coverage;
// `filesTotal` is every file compared and `rowsAllFiles` scores a file the index lacks as all missed.
// Dev-only: needs a `ruby` on PATH and the pinned clones under benchmarks/repos; with either
// missing it says "unmeasured" and exits 0.
//
//   node scripts/extraction-recall/ruby.mjs [--repos <dir>] [--extractor <file>] [--json] [--index]
//                                           [--min-class <pct>] [--min-module <pct>] [--min-method <pct>] [--min-owner <pct>]
//
// By default this measures the extractor only and touches nothing. --index adds the index as
// shipped, which regenerates context inside the Rails and Sidekiq clones and restores it (see
// scripts/run-extraction-recall.mjs for what that means). The floors given to --min-* apply to
// the extractor population. The committed floors, checked in CI against every population, live
// in benchmarks/extraction-recall-floors.json.
//
// The file set is fixed: the Rails libraries (actionpack, activerecord, activesupport) and
// Sidekiq, the files the Ruby on PATH can parse (757 with Ruby 2.6, the system Ruby on macOS).
// Ruby 2.6 rejects modern syntax, so files using it drop out on BOTH sides; that is a subset,
// not a random sample of Ruby. Method names are compared by their bare name from `def` lines,
// skipping names that start with "_" (the extractor omits them on purpose); operator and
// non-ASCII method names are listed by the extractor but are not matched by this comparison.
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
import { newTally, record, population, rowsOf } from '../lib/extraction-recall.mjs';
import { DEFAULT_REPOS, listFiles, shaOf, probe, withShippedIndex, indexedSigs, bare } from './common.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const require = createRequire(import.meta.url);

export const language = 'ruby';
export const KINDS = ['class', 'module', 'method', 'owner'];
export const ROOTS = [
  ['rails', 'actionpack/lib'],
  ['rails', 'activerecord/lib/active_record'],
  ['rails', 'activesupport/lib/active_support'],
  ['sidekiq', 'lib'],
];

/**
 * Score one file: `truth` is Ripper's `[[kind, name], ...]`, `sigs` what SigMap listed.
 * `class`, `module` and `method` are matched by name; `owner` asks whether each method is
 * listed under the class or module that defines it (counted with multiplicity).
 */
export function compareFile(tally, truth, sigs, where) {
  const got = { class: new Set(), module: new Set(), method: new Set() };
  const listed = new Map(); // "Owner|name" -> how many times the extractor lists it
  let owner = '';
  for (const raw of sigs) {
    const text = bare(raw);
    const line = text.trim();
    let m;
    if ((m = /^class\s+(?:[\w:]*::)?([A-Z]\w*)/.exec(line))) { got.class.add(m[1]); owner = m[1]; }
    else if ((m = /^module\s+(?:[\w:]*::)?([A-Z]\w*)/.exec(line))) { got.module.add(m[1]); owner = m[1]; }
    else if ((m = /^def\s+(?:self\.)?([A-Za-z_]\w*[?!=]?)/.exec(line))) got.method.add(m[1]);
    if ((m = /^(\s*)def\s+(?:\w+\.)?([^\s(→]+)/.exec(text))) {
      const key = `${m[1] ? owner : ''}|${m[2]}`;
      listed.set(key, (listed.get(key) || 0) + 1);
    }
  }
  const wanted = new Map();
  for (const [kind, name] of truth) {
    const last = name.split(/[#.]/).pop();
    if (kind === 'method') {
      if (/^_/.test(last)) { tally.method.skipped++; continue; }
      record(tally, 'method', got.method.has(last), `${where} :: ${name}`);
      const key = `${/[#.]/.test(name) ? name.split(/[#.]/).slice(0, -1).join('') : ''}|${last}`;
      const w = wanted.get(key) || { count: 0, name };
      w.count++;
      wanted.set(key, w);
    } else {
      record(tally, kind, got[kind].has(name), `${where} :: ${name}`);
    }
  }
  for (const [key, { count, name }] of wanted) {
    const hits = Math.min(count, listed.get(key) || 0);
    for (let i = 0; i < count; i++) record(tally, 'owner', i < hits, `${where} :: ${name}`);
  }
}

function unmeasured(reason) {
  return { measured: false, reason };
}

/**
 * @param {{reposDir?: string, extractorPath?: string, index?: boolean}} [opts]
 */
export function measure(opts = {}) {
  const reposDir = path.resolve(opts.reposDir || DEFAULT_REPOS);
  const extractorPath = path.resolve(opts.extractorPath || path.join(root, 'src', 'extractors', 'ruby.js'));
  const files = listFiles(reposDir, ROOTS, '.rb');
  if (files.length === 0) return unmeasured(`no clones under ${reposDir}; run: node scripts/fetch-xrepo-repos.mjs`);
  const version = probe('ruby', ['-e', 'puts RUBY_VERSION']);
  if (!version) return unmeasured('ruby is not on PATH');

  let truthByFile;
  try {
    truthByFile = JSON.parse(execFileSync('ruby', [path.join(here, 'ruby-ripper.rb'), ...files.map((f) => f.abs)], { maxBuffer: 1 << 29, encoding: 'utf8' }));
  } catch (e) {
    return unmeasured(`ruby failed: ${String(e.message).split('\n')[0]}`);
  }
  const compared = files.filter((f) => truthByFile[f.abs]);
  const extractor = require(extractorPath);
  const result = {
    measured: true,
    reference: { name: 'Ruby Ripper', version },
    pins: { rails: shaOf(reposDir, 'rails'), sidekiq: shaOf(reposDir, 'sidekiq') },
    populations: {},
  };

  const raw = newTally(KINDS);
  for (const f of compared) compareFile(raw, truthByFile[f.abs], extractor.extract(fs.readFileSync(f.abs, 'utf8')), `${f.repo}/${f.rel}`);
  result.populations.extractor = population('the extractor\'s output', compared.length, raw);

  if (opts.index !== false) {
    const onIndexed = newTally(KINDS);
    const onAll = newTally(KINDS);
    let indexed = 0;
    for (const repo of [...new Set(compared.map((f) => f.repo))]) {
      withShippedIndex(reposDir, repo, {}, (index) => {
        for (const f of compared.filter((x) => x.repo === repo)) {
          const sigs = indexedSigs(index, f.rel);
          const where = `${f.repo}/${f.rel}`;
          compareFile(onAll, truthByFile[f.abs], sigs, where);
          if (index.has(f.rel)) { indexed++; compareFile(onIndexed, truthByFile[f.abs], sigs, where); }
        }
      });
    }
    result.populations.index = population('the index as shipped, after the per-file cap', indexed, onIndexed, { filesTotal: compared.length, rowsAllFiles: rowsOf(onAll) });
  } else {
    result.notRun = ['index'];
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
  };
  const asJson = args.includes('--json');
  const floors = { class: opt('--min-class'), module: opt('--min-module'), method: opt('--min-method'), owner: opt('--min-owner') };
  const result = measure({
    reposDir: opt('--repos'), extractorPath: opt('--extractor'), index: args.includes('--index'),
  });
  if (!result.measured) {
    console.log(asJson ? JSON.stringify({ measured: false, reason: result.reason }) : `extraction-recall ruby: unmeasured (${result.reason})`);
    process.exit(0);
  }
  const pop = result.populations.extractor;
  const failures = pop.rows.filter((r) => floors[r.kind] != null && (r.recall === null || r.recall < Number(floors[r.kind])));
  if (asJson) {
    console.log(JSON.stringify({
      measured: true, filesCompared: pop.filesCompared, pins: result.pins, rows: pop.rows,
      failures: failures.map((r) => r.kind), reference: result.reference, populations: result.populations,
    }));
  } else {
    console.log(`extraction-recall ruby: ${pop.filesCompared} files compared against Ripper ${result.reference.version} (rails ${result.pins.rails || '?'}, sidekiq ${result.pins.sidekiq || '?'})`);
    for (const [id, p] of Object.entries(result.populations)) {
      console.log(`  ${id}: ${p.label}`);
      for (const r of p.rows) console.log(`    ${r.kind.padEnd(7)} reference ${String(r.reference).padStart(5)}  found ${String(r.found).padStart(5)}  recall ${r.recall === null ? 'n/a' : r.recall.toFixed(1) + '%'}`);
    }
    for (const r of failures) console.log(`  FAIL ${r.kind}: ${r.recall === null ? 'nothing to find' : r.recall.toFixed(1) + '%'} is below the floor of ${floors[r.kind]}%`);
  }
  process.exit(failures.length ? 1 : 0);
}
