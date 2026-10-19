#!/usr/bin/env node
// Extraction recall against a language-native parser: Python (#983).
//
// Asks CPython's own parser (ast) which functions, classes and methods each file defines,
// asks SigMap the same question four ways, and reports how many SigMap finds, per kind, by
// name within each file:
//
//   extractor-regex  the pure-Node tier a machine without python3 uses
//   extractor-ast    the AST tier a machine with python3 uses (python_ast.py, 30 signatures a file)
//   index-regex      what a first-time `sigmap` run keeps on a machine without python3
//   index-ast        what a first-time `sigmap` run keeps on a machine with python3
//
// The two `index-*` rows are the index as shipped, after the 25-signature-per-file cap and the
// per-class member cap; the two `extractor-*` rows are what the extractor returns before them.
// An index row is scored over the files the index holds (`filesCompared`), so the cap is not
// confused with coverage; `filesTotal` is every file compared and `rowsAllFiles` scores a file
// the index lacks as all missed.
//
// Dev-only: needs `python3` on PATH and the pinned clones under benchmarks/repos; with either
// missing it says "unmeasured" and exits 0.
//
// The file set is fixed: Flask's package and the Django libraries a user asks about most
// (db/models, http, core, forms, utils, contrib/admin), without tests, migrations and locale
// directories. Names the extractors omit on purpose (see `isOmitted`: underscore-prefixed
// functions and methods, dunders other than `__init__`) are skipped on both sides. A file ast
// cannot parse drops out of both sides.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newTally, record, skip, population, rowsOf } from '../lib/extraction-recall.mjs';
import { DEFAULT_REPOS, listFiles, shaOf, probe, withShippedIndex, indexedSigs, bare } from './common.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const require = createRequire(import.meta.url);

export const language = 'python';
export const KINDS = ['class', 'func', 'method'];
export const ROOTS = [
  ['flask', 'src/flask'],
  ['django', 'django/db/models'],
  ['django', 'django/http'],
  ['django', 'django/core'],
  ['django', 'django/forms'],
  ['django', 'django/utils'],
  ['django', 'django/contrib/admin'],
];
const SKIP_DIR = /^tests?$|migrations|locale/;

/**
 * The classes, functions and methods a list of signature lines names, in the shapes the
 * Python extractor prints them: `class X(...)`, `@dataclass X(...)`, `def f(...)`,
 * `async def f(...)` and an indented `def m(...)` under the class above it.
 * @returns {{class:Set<string>, func:Set<string>, method:Set<string>}}
 */
export function parseSigs(sigs) {
  const got = { class: new Set(), func: new Set(), method: new Set() };
  let cur = null;
  for (const raw of sigs) {
    const line = bare(raw);
    let m;
    if ((m = /^class\s+([A-Za-z_]\w*)/.exec(line) || /^@dataclass\s+([A-Za-z_]\w*)/.exec(line))) { cur = m[1]; got.class.add(cur); }
    else if ((m = /^(?:async\s+)?def\s+([A-Za-z_]\w*)/.exec(line))) { got.func.add(m[1]); cur = null; }
    else if ((m = /^\s+(?:async\s+)?def\s+([A-Za-z_]\w*)/.exec(line)) && cur) got.method.add(`${cur}.${m[1]}`);
  }
  return got;
}

/**
 * A reference symbol the extractors omit on purpose, so it is left out of the comparison on
 * both sides: a function or method whose name starts with "_" (private by convention) and
 * every dunder except `__init__`, which both tiers list (python.js extractClassMethods,
 * python_ast.py). A class is never skipped: neither tier filters classes by name.
 */
export function isOmitted(kind, name) {
  if (kind === 'class') return false;
  const last = String(name).split('.').pop();
  return last.startsWith('_') && last !== '__init__';
}

/**
 * Score one file's reference symbols against the names SigMap listed for it. A name counts
 * once per file and kind: a property's getter and setter, or an `@overload` series, are one
 * name, and the question is whether the file lists it.
 */
export function compareFile(tally, truth, got, where) {
  const seen = new Set();
  for (const [kind, name] of truth) {
    if (!tally[kind] || seen.has(`${kind}\0${name}`)) continue;
    seen.add(`${kind}\0${name}`);
    if (isOmitted(kind, name)) { skip(tally, kind); continue; }
    record(tally, kind, got[kind].has(name), `${where} :: ${name}`);
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
  const extractorPath = path.resolve(opts.extractorPath || path.join(root, 'src', 'extractors', 'python.js'));
  const files = listFiles(reposDir, ROOTS, '.py', SKIP_DIR);
  if (files.length === 0) return unmeasured(`no clones under ${reposDir}; run: node scripts/fetch-xrepo-repos.mjs`);
  if (!probe('python3', ['--version'])) return unmeasured('python3 is not on PATH');

  let ground;
  try {
    ground = JSON.parse(execFileSync('python3', [path.join(here, 'python-ast.py'), ...files.map((f) => f.abs)], { maxBuffer: 1 << 29, encoding: 'utf8' }));
  } catch (e) {
    return unmeasured(`python3 failed: ${String(e.message).split('\n')[0]}`);
  }
  const compared = files.filter((f) => ground.files[f.abs]);
  const extractor = require(extractorPath);
  const result = {
    measured: true,
    reference: { name: 'CPython ast', version: ground.version },
    pins: { flask: shaOf(reposDir, 'flask'), django: shaOf(reposDir, 'django') },
    populations: {},
  };

  // The extractor's own output, file by file.
  const regex = newTally(KINDS);
  for (const f of compared) {
    compareFile(regex, ground.files[f.abs], parseSigs(extractor.extract(fs.readFileSync(f.abs, 'utf8'))), `${f.repo}/${f.rel}`);
  }
  result.populations['extractor-regex'] = population('regex tier, as a machine without python3 runs it', compared.length, regex);

  extractor.prefetch(compared.map((f) => f.abs));
  const ast = newTally(KINDS);
  for (const f of compared) {
    compareFile(ast, ground.files[f.abs], parseSigs(extractor.tryNativeExtract(f.abs) || []), `${f.repo}/${f.rel}`);
  }
  result.populations['extractor-ast'] = population('AST tier, as a machine with python3 runs it', compared.length, ast);

  // The index as shipped: a first-time run on each clone, after the per-file cap.
  if (opts.index !== false) {
    for (const [id, pythonAst, label] of [
      ['index-regex', false, 'index as shipped on a machine without python3'],
      ['index-ast', true, 'index as shipped on a machine with python3'],
    ]) {
      const onIndexed = newTally(KINDS);
      const onAll = newTally(KINDS);
      let indexed = 0;
      for (const repo of [...new Set(compared.map((f) => f.repo))]) {
        withShippedIndex(reposDir, repo, { pythonAst }, (index) => {
          for (const f of compared.filter((x) => x.repo === repo)) {
            const got = parseSigs(indexedSigs(index, f.rel));
            const where = `${f.repo}/${f.rel}`;
            compareFile(onAll, ground.files[f.abs], got, where);
            if (index.has(f.rel)) { indexed++; compareFile(onIndexed, ground.files[f.abs], got, where); }
          }
        });
      }
      result.populations[id] = population(label, indexed, onIndexed, { filesTotal: compared.length, rowsAllFiles: rowsOf(onAll) });
    }
  } else {
    result.notRun = ['index-regex', 'index-ast'];
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined; };
  const r = measure({ reposDir: opt('--repos'), extractorPath: opt('--extractor'), index: !args.includes('--no-index') });
  console.log(JSON.stringify(r, null, args.includes('--json') ? 0 : 1));
}
