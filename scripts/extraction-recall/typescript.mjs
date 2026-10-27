#!/usr/bin/env node
// Extraction recall against a language-native parser: TypeScript (#996; scripts/run-extraction-recall.mjs
// runs every case, #983).
//
// Asks the TypeScript compiler's own parse which top-level exports each file declares, asks
// SigMap's TypeScript extractor the same question, and reports how many SigMap finds, per kind,
// by name within each file. Two populations: the extractor's raw output, and the index as
// shipped (what a first-time `sigmap` run keeps, after the per-file cap). An index row is scored
// over the files the index holds, so the cap is not confused with coverage; `filesTotal` is every
// file compared and `rowsAllFiles` scores a file the index lacks as all missed.
//
// Dev-only: needs a `typescript` package (--typescript <path>, $SIGMAP_TYPESCRIPT, or one that
// resolves from here; see typescript-reference.mjs) and the pinned clones under benchmarks/repos;
// with either missing it says "unmeasured" and exits 0. SigMap never depends on a compiler.
//
//   node scripts/extraction-recall/typescript.mjs [--repos <dir>] [--extractor <file>] [--typescript <path>] [--json] [--no-index]
//
// The file set is fixed: zod's package, three vue-core libraries, excalidraw's element package and
// vitepress's node side, without declaration files, tests and fixtures. zod's `locales/` directory is
// deliberately kept: its files are all `export default function () {}`, the anonymous default export
// the extractor did not read before #996.
//
// Rows (see typescript-reference.mjs for what each asks): function, class, interface, type, enum,
// arrow (an exported const bound to an arrow function), factory (an exported const bound to a call),
// default (an anonymous default export, asked once per file), and dollar (every name above that starts
// with `$`, counted a second time because that is the share #996 reports: 33% of zod's exports).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { newTally, record, population, rowsOf } from '../lib/extraction-recall.mjs';
import { DEFAULT_REPOS, listFiles, shaOf, withShippedIndex, indexedSigs, bare } from './common.mjs';
import { findTypeScript, truthOf } from './typescript-reference.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const require = createRequire(import.meta.url);

export const language = 'typescript';
export const KINDS = ['function', 'class', 'interface', 'type', 'enum', 'arrow', 'factory', 'default', 'dollar'];
export const ROOTS = [
  ['zod', 'packages/zod/src'],
  ['vue-core', 'packages/runtime-core/src'],
  ['vue-core', 'packages/reactivity/src'],
  ['vue-core', 'packages/compiler-core/src'],
  ['excalidraw', 'packages/element/src'],
  ['vitepress', 'src/node'],
];
const SKIP_DIR = /^(__tests__|tests?|fixtures?)$/;
const SKIP_FILE = /\.(d|test|spec)\.ts$/;

/**
 * The names a list of signature lines declares, in the shapes the TypeScript extractor prints
 * them: `export function f(...)`, `export const f = (...) =>`, `export const f = make(...)`,
 * `export default function (...)`, `export interface|type|enum|class X`.
 * @returns {Object<string, Set<string>>}
 */
export function parseSigs(sigs) {
  const got = Object.fromEntries(KINDS.map((k) => [k, new Set()]));
  const add = (kind, name) => {
    got[kind].add(name);
    if (name.startsWith('$')) got.dollar.add(name);
  };
  for (const raw of sigs) {
    const line = bare(raw);
    if (/^\s/.test(line)) continue; // a member of the declaration above it
    let m;
    if ((m = /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([\w$]+)/.exec(line))) add('class', m[1]);
    else if ((m = /^export\s+interface\s+([\w$]+)/.exec(line))) add('interface', m[1]);
    else if ((m = /^export\s+type\s+([\w$]+)/.exec(line))) add('type', m[1]);
    else if ((m = /^export\s+enum\s+([\w$]+)/.exec(line))) add('enum', m[1]);
    else if (/^export\s+default\s+(?:async\s+)?(?:function\s*\(|\()/.test(line)) got.default.add('(default)');
    else if ((m = /^export\s+(?:default\s+)?(?:async\s+)?function\s+([\w$]+)/.exec(line))) add('function', m[1]);
    else if ((m = /^export\s+(?:default\s+)?const\s+([\w$]+)\s*=\s*(?:async\s+)?\(.*\)\s*=>/.exec(line))) add('arrow', m[1]);
    else if ((m = /^export\s+(?:default\s+)?const\s+([\w$]+)\s*=\s*[\w$.]+(?:<[^>]*>)?\(\.\.\.\)/.exec(line))) add('factory', m[1]);
  }
  return got;
}

/**
 * Score one file's reference symbols against the names SigMap listed for it. A name counts once
 * per file and kind: overloads of one function are one name, and the question is whether the
 * file lists it.
 */
export function compareFile(tally, truth, got, where) {
  const seen = new Set();
  for (const [kind, name] of truth) {
    if (!tally[kind] || seen.has(`${kind}\0${name}`)) continue;
    seen.add(`${kind}\0${name}`);
    record(tally, kind, got[kind].has(name), `${where} :: ${name}`);
  }
}

function unmeasured(reason) {
  return { measured: false, reason };
}

/**
 * @param {{reposDir?: string, extractorPath?: string, typescript?: string, index?: boolean}} [opts]
 */
export function measure(opts = {}) {
  const reposDir = path.resolve(opts.reposDir || DEFAULT_REPOS);
  const extractorPath = path.resolve(opts.extractorPath || path.join(root, 'src', 'extractors', 'typescript.js'));
  const files = listFiles(reposDir, ROOTS, '.ts', SKIP_DIR).filter((f) => !SKIP_FILE.test(f.rel));
  if (files.length === 0) return unmeasured(`no clones under ${reposDir}; run: node scripts/fetch-xrepo-repos.mjs`);
  const found = findTypeScript(opts.typescript);
  if (!found) return unmeasured('no typescript package found: pass --typescript <path> (a typescript.js, its lib/ or the package directory), set SIGMAP_TYPESCRIPT, or install one that resolves from here');

  const truth = new Map();
  for (const f of files) {
    try { truth.set(f.abs, truthOf(found.ts, fs.readFileSync(f.abs, 'utf8'), f.abs)); } catch (_) { /* unreadable: drops out of both sides */ }
  }
  const compared = files.filter((f) => truth.has(f.abs));
  const extractor = require(extractorPath);
  const result = {
    measured: true,
    reference: { name: 'TypeScript compiler API (parse only)', version: found.version },
    pins: Object.fromEntries([...new Set(ROOTS.map(([r]) => r))].map((r) => [r, shaOf(reposDir, r)])),
    populations: {},
  };

  const raw = newTally(KINDS);
  for (const f of compared) {
    compareFile(raw, truth.get(f.abs), parseSigs(extractor.extract(fs.readFileSync(f.abs, 'utf8'))), `${f.repo}/${f.rel}`);
  }
  result.populations.extractor = population('extractor output, before the per-file cap', compared.length, raw);

  // The index as shipped: a first-time run on each clone, after the per-file cap.
  if (opts.index !== false) {
    const onIndexed = newTally(KINDS);
    const onAll = newTally(KINDS);
    let indexed = 0;
    for (const repo of [...new Set(compared.map((f) => f.repo))]) {
      withShippedIndex(reposDir, repo, {}, (index) => {
        for (const f of compared.filter((x) => x.repo === repo)) {
          const got = parseSigs(indexedSigs(index, f.rel));
          const where = `${f.repo}/${f.rel}`;
          compareFile(onAll, truth.get(f.abs), got, where);
          if (index.has(f.rel)) { indexed++; compareFile(onIndexed, truth.get(f.abs), got, where); }
        }
      });
    }
    result.populations.index = population('index as shipped', indexed, onIndexed, { filesTotal: compared.length, rowsAllFiles: rowsOf(onAll) });
  } else {
    result.notRun = ['index'];
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined; };
  const r = measure({ reposDir: opt('--repos'), extractorPath: opt('--extractor'), typescript: opt('--typescript'), index: !args.includes('--no-index') });
  console.log(JSON.stringify(r, null, args.includes('--json') ? 0 : 1));
}
