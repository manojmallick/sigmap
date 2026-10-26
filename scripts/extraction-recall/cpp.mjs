#!/usr/bin/env node
// Extraction recall against clangd: C and C++ (#975; scripts/run-extraction-recall.mjs runs every case).
//
// Asks clangd, a language server built on clang's own parser and preprocessor, which classes, enums,
// functions and methods each file defines, asks SigMap's C/C++ extractor the same question, and
// reports how many SigMap finds, per kind, by name within each file. Two populations: the
// extractor's raw output, and the index as shipped (what a first-time `sigmap` run keeps, after the
// per-file cap). The index row is scored over the files the index holds, so the cap is not
// confused with coverage; `filesTotal` is every file compared.
//
// Two more rows are judged on what the extractor EMITS, not on what clangd finds, as for Ruby:
// "anchored" is the share of emitted definition lines that carry a `:start-end` anchor, and
// "anchor-exact" the share of the anchors clangd can judge (it lists the same kind and name in the
// same file) that equal the lines clangd gives that declaration. A definition in code the
// preprocessor removes on this machine is invisible to clangd, so its anchor is left out of
// "anchor-exact" and counted as skipped, not as a miss. One convention differs on purpose: clangd's
// range for a template starts at the declaration and leaves out the `template <...>` header above it,
// while SigMap's anchor includes the header (it is part of what an agent needs to read). An anchor
// that ends where clangd's does and starts on the header lines directly above clangd's start is exact.
//
// Dev-only: needs `clangd` and `node` on PATH and the pinned clones under benchmarks/repos; with
// either missing it says "unmeasured" and exits 0. clangd's answers are cached on disk by content,
// flags and clangd version (SIGMAP_RECALL_CACHE or the temp directory), so a second run reads them.
//
//   node scripts/extraction-recall/cpp.mjs [--repos <dir>] [--extractor <file>] [--json] [--index] [--dev | --held-out] [--misses N]
//
// THE FILE SET is fixed and sampled deterministically (every Nth file of a sorted list): libuv
// (include/ and src/, the files this host compiles), spdlog (include/spdlog and src/, without the
// bundled fmt) and abseil-cpp (absl/, without tests, benchmarks and mocks). `--dev` adds fmt, the
// repository the extractor was developed against; it is never part of a saved report or a floor.
// `--held-out` measures four other repositories instead (HELD_OUT_REPOS: leveldb, hiredis, yaml-cpp and
// cJSON at fixed commits, cloned by hand, recipe in docs-vp/guide/extraction-recall.md): the extractor
// was not developed against them, until the first check of them found two gaps (see the page).
// Include directories and the language standard are given to clangd in a compile database made
// in a scratch directory, never in a clone. Platform code for another operating system is left out,
// because on this host clangd sees it as empty.
//
// Names that start with `_` are left out on both sides, as the extractors omit them on purpose.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newTally, record, skip, population, rowsOf } from '../lib/extraction-recall.mjs';
import { DEFAULT_REPOS, shaOf, probe, withShippedIndex, indexedSigs, bare } from './common.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const require = createRequire(import.meta.url);
const { stripComments } = require(path.join(root, 'src', 'extractors', 'scan.js'));

export const language = 'cpp';
export const KINDS = ['class', 'enum', 'function', 'method', 'owner', 'anchored', 'anchor-exact'];

const OTHER_OS = /(^|\/)(aix|os390|sunos|haiku|qnx|cygwin|android|linux|bsd|netbsd|openbsd|freebsd|kqueue|epoll|procfs)[^/]*\.[ch]$/;
const TESTISH = /(^|\/)(test|tests|testing|bench|benchmark|benchmarks|example|examples|fuzz)(\/|$)|(_test|_benchmark|_testing|_mock|_fuzz|_bench)\b|(^|\/)(test_|mock_)|_test_|_benchmark\.|_mocks?\./;

/**
 * The repositories read, with the roots under them, the extensions, a pattern for what to leave
 * out, the compile arguments (`{root}` is the clone) and how sparsely to sample.
 */
export const REPOS = [
  { repo: 'libuv', lang: 'c', roots: ['include', 'src'], exts: ['.h', '.c'], skip: /(^|\/)(win|test)\/|(^|\/)win\.h$/, otherOs: true, args: ['-std=gnu99', '-I{root}/include', '-I{root}/src'], step: 1 },
  { repo: 'spdlog', lang: 'cpp', roots: ['include/spdlog', 'src'], exts: ['.h', '.cpp'], skip: /(^|\/)bundled\//, args: ['-std=c++17', '-I{root}/include'], step: 1 },
  { repo: 'abseil-cpp', lang: 'cpp', roots: ['absl'], exts: ['.h', '.cc'], skip: TESTISH, args: ['-std=c++17', '-I{root}'], step: 6 },
];
export const HELD_OUT_REPOS = [
  { repo: 'leveldb', commit: 'bb74ef739973a70ca9f0d90788a1da89b788c0ad', url: 'https://github.com/google/leveldb', lang: 'cpp', roots: ['include/leveldb', 'db', 'table', 'util', 'helpers'], exts: ['.h', '.cc'], skip: TESTISH, args: ['-std=c++17', '-I{root}/include', '-I{root}'], step: 1 },
  { repo: 'hiredis', commit: '5bb7f030f6631b243438cf0fdd3be84352b905bb', url: 'https://github.com/redis/hiredis', lang: 'c', roots: [''], exts: ['.h', '.c'], skip: /(^|\/)(test|examples|fuzzing)\/|(^|\/)test\.c$|async_private|win32|sdsalloc/, args: ['-std=gnu99', '-I{root}'], step: 1 },
  { repo: 'yaml-cpp', commit: 'c5e65360373d1d99d6b6848c991cd4fcee435009', url: 'https://github.com/jbeder/yaml-cpp', lang: 'cpp', roots: ['include/yaml-cpp', 'src'], exts: ['.h', '.cpp'], skip: TESTISH, args: ['-std=c++17', '-I{root}/include', '-I{root}/src'], step: 1 },
  { repo: 'cJSON', commit: '6d9f2443ab071f86e5d9b43025a40929ec41c46c', url: 'https://github.com/DaveGamble/cJSON', lang: 'c', roots: [''], exts: ['.h', '.c'], skip: /(^|\/)(tests|fuzzing)\/|test\.c$/, args: ['-std=gnu99', '-I{root}'], step: 1 },
];
export const DEV_REPOS = [
  { repo: 'fmt', lang: 'cpp', roots: ['include/fmt', 'src'], exts: ['.h', '.cc'], skip: null, args: ['-std=c++17', '-I{root}/include'], step: 1 },
];

/** The files of one repository, sorted, filtered and sampled. */
export function filesOf(reposDir, spec) {
  const base = path.join(reposDir, spec.repo);
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(path.join(base, dir), { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) { walk(rel); continue; }
      if (!spec.exts.some((x) => e.name.endsWith(x))) continue;
      if (spec.skip && spec.skip.test(rel)) continue;
      if (spec.otherOs && OTHER_OS.test(rel)) continue;
      out.push(rel);
    }
  };
  for (const r of spec.roots) walk(r);
  out.sort();
  return out.filter((_, i) => i % spec.step === 0).map((rel) => ({ repo: spec.repo, rel, abs: path.join(base, rel), lang: spec.lang, args: argsFor(spec, base, rel) }));
}

function argsFor(spec, base, rel) {
  const header = /\.(h|hpp|hh)$/.test(rel);
  const lang = spec.lang === 'c' ? 'c' : 'c++';
  return [...(header ? ['-x', `${lang}-header`] : []), ...spec.args.map((a) => a.replace('{root}', base))];
}

// ── reading the extractor's lines ────────────────────────────────────────────

const CLASS_LINE = /^(\s*)(?:template\s*<[^>]*>\s*)?(class|struct|union)\s+([A-Za-z_][\w:]*)/;
const ENUM_LINE = /^(\s*)enum\s+(?:class\s+|struct\s+)?([A-Za-z_]\w*)/;
// An operator is tried before a plain name, or `operator()` would be read as `operator`.
const CALL_LINE = /^(\s*)((?:[A-Za-z_]\w*::)*(?:operator\b\s*\(\s*\)|operator\b\s*[^\s(]+|operator\b\s+[\w:<>*& ]+?|~?[A-Za-z_]\w*))\s*\(/;

/**
 * One signature line as the harness reads it: `{ kind, name, owner, indent }` or null for a line that
 * is not a definition (a notice such as `… +3 more signatures`). A class line starts a scope that
 * lasts while the lines below are indented further; an indented call line is a method of that scope,
 * an unindented `A::b(` is a method of A, and any other unindented call line is a function.
 */
export function readLine(raw, scope) {
  const text = bare(raw);
  let m;
  if ((m = CLASS_LINE.exec(text))) {
    const indent = m[1].length;
    while (scope.length && scope[scope.length - 1].indent >= indent) scope.pop();
    const name = m[3].split('::').pop();
    const owner = scope.length ? scope[scope.length - 1].name : '';
    scope.push({ indent, name });
    return { kind: 'class', name, owner, indent };
  }
  if ((m = ENUM_LINE.exec(text))) return { kind: 'enum', name: m[2], owner: '', indent: m[1].length };
  if ((m = CALL_LINE.exec(text))) {
    const indent = m[1].length;
    while (scope.length && scope[scope.length - 1].indent >= indent) scope.pop();
    const full = m[2].replace(/\s+/g, ' ');
    const parts = full.split('::');
    const name = parts.pop();
    if (indent > 0 && scope.length) return { kind: 'method', name, owner: scope[scope.length - 1].name, indent };
    if (parts.length) return { kind: 'method', name, owner: parts.pop(), indent };
    return { kind: 'function', name, owner: '', indent };
  }
  return null;
}

/** Is `lines` (source lines, comments blanked) only a `template <...>` header? */
function isTemplateHeader(lines) {
  const text = lines.join('\n').trim();
  return /^template\s*</.test(text) && !/[{};]/.test(text);
}

/**
 * Score one file: `truth` is clangd's `[[kind, name, first, last, owner], ...]`, `sigs` what SigMap
 * listed. `class`, `enum`, `function` and `method` are matched by name, once per file and kind;
 * `owner` asks whether each method is listed under the class that holds it. `source` (the file's text,
 * comments blanked) lets an anchor that starts on a template header count as exact; without it only an
 * identical range does.
 */
export function compareFile(tally, truth, sigs, where, source) {
  const srcLines = source ? source.split('\n') : null;
  const scope = [];
  const lines = [];
  for (const raw of sigs) {
    const l = readLine(raw, scope);
    if (l) lines.push({ ...l, raw });
  }
  const got = { class: new Set(), enum: new Set(), function: new Set(), method: new Set() };
  const listed = new Set(); // "Owner|name"
  for (const l of lines) {
    got[l.kind].add(l.name);
    if (l.kind === 'method') listed.add(`${l.owner}|${l.name}`);
  }
  // clangd lists a forward or friend declaration (`class logger;`) as a class, and an opaque
  // `enum class E : int;` as an enum. They define nothing to read, so the comparison is about
  // definitions: a class or enum whose lines hold no `{` is left out.
  if (srcLines) {
    truth = truth.filter(([kind, , first, last]) => (kind !== 'class' && kind !== 'enum') || srcLines.slice(first - 1, last).some((l) => l.includes('{')));
  }
  const seen = new Set();
  const refKinds = new Set();   // "kind|name" clangd lists in this file
  const ranges = new Set();     // "kind|name|first|last"
  const rangesOf = new Map();   // "kind|name" -> [[first, last], ...]
  for (const [kind, name, first, last] of truth) {
    refKinds.add(`${kind}|${name}`);
    ranges.add(`${kind}|${name}|${first}|${last}`);
    if (!rangesOf.has(`${kind}|${name}`)) rangesOf.set(`${kind}|${name}`, []);
    rangesOf.get(`${kind}|${name}`).push([first, last]);
  }
  for (const [kind, name, , , owner] of truth) {
    const key = `${kind}|${name}`;
    if (/^_/.test(name)) { if (!seen.has(`s|${key}`)) { seen.add(`s|${key}`); skip(tally, kind); } continue; }
    if (!seen.has(key)) { seen.add(key); record(tally, kind, got[kind].has(name), `${where} :: ${name}`); }
    if (kind === 'method') {
      const okey = `${owner}|${name}`;
      if (!seen.has(`o|${okey}`)) { seen.add(`o|${okey}`); record(tally, 'owner', listed.has(okey), `${where} :: ${owner ? `${owner}::` : ''}${name}`); }
    }
  }
  for (const l of lines) {
    const a = /\s:(\d+)-(\d+)\s*$/.exec(l.raw);
    record(tally, 'anchored', !!a, `${where} :: ${bare(l.raw).trim()}`);
    if (!a) continue;
    if (!refKinds.has(`${l.kind}|${l.name}`)) { skip(tally, 'anchor-exact'); continue; }
    const first = Number(a[1]);
    const last = Number(a[2]);
    const exact = ranges.has(`${l.kind}|${l.name}|${first}|${last}`)
      || (srcLines && rangesOf.get(`${l.kind}|${l.name}`).some(([f2, l2]) => l2 === last && f2 > first && isTemplateHeader(srcLines.slice(first - 1, f2 - 1))));
    record(tally, 'anchor-exact', exact, `${where} :: ${bare(l.raw).trim()} :${first}-${last}`);
  }
}

function unmeasured(reason) {
  return { measured: false, reason };
}

/**
 * @param {{reposDir?: string, extractorPath?: string, index?: boolean, dev?: boolean, heldOut?: boolean, cacheDir?: string, concurrency?: number}} [opts]
 */
export function measure(opts = {}) {
  const reposDir = path.resolve(opts.reposDir || DEFAULT_REPOS);
  const extractorPath = path.resolve(opts.extractorPath || path.join(root, 'src', 'extractors', 'cpp.js'));
  const specs = opts.heldOut ? HELD_OUT_REPOS : [...REPOS, ...(opts.dev ? DEV_REPOS : [])];
  for (const s of specs) {
    // a held-out repository is only held out at the commit it was checked at
    const at = s.commit && shaOf(reposDir, s.repo);
    if (s.commit && at && !s.commit.startsWith(at)) return unmeasured(`${s.repo} is at ${at}, not ${s.commit.slice(0, 7)}`);
  }
  const files = specs.flatMap((s) => filesOf(reposDir, s));
  if (files.length === 0) return unmeasured(opts.heldOut ? `no clones under ${reposDir}; the commands are in docs-vp/guide/extraction-recall.md` : `no clones under ${reposDir}; run: node scripts/fetch-xrepo-repos.mjs`);
  const probed = probe('clangd', ['--version']);
  const version = probed && (/clangd version ([\d.]+)/.exec(probed) || [])[1];
  if (!version) return unmeasured('clangd is not on PATH');

  const job = {
    clangd: 'clangd', concurrency: opts.concurrency || Math.max(2, Math.min(8, os.cpus().length - 2)),
    cacheDir: opts.cacheDir || process.env.SIGMAP_RECALL_CACHE || path.join(os.tmpdir(), 'sigmap-recall-cache', 'cpp'),
    files: files.map((f) => ({ abs: f.abs, lang: f.lang, args: f.args })),
  };
  const r = spawnSync(process.execPath, [path.join(here, 'cpp-reference.mjs')], { input: JSON.stringify(job), encoding: 'utf8', maxBuffer: 1 << 29, timeout: 6 * 3600 * 1000 });
  if (r.status !== 0 || !r.stdout) return unmeasured(`clangd failed: ${String(r.stderr || r.error || '').split('\n')[0]}`);
  let truth;
  try { truth = JSON.parse(r.stdout).files; } catch (e) { return unmeasured(`clangd's answers were unreadable: ${e.message}`); }
  const compared = files.filter((f) => Array.isArray(truth[f.abs]));
  if (compared.length === 0) return unmeasured('clangd answered for no file');

  const extractor = require(extractorPath);
  const pins = Object.fromEntries(specs.map((s) => [s.repo, shaOf(reposDir, s.repo)]));
  const result = {
    measured: true,
    reference: { name: 'clangd', version },
    pins,
    populations: {},
    filesAsked: files.length,
  };

  const raw = newTally(KINDS);
  for (const f of compared) {
    const src = fs.readFileSync(f.abs, 'utf8');
    compareFile(raw, truth[f.abs], extractor.extract(src, f.abs), `${f.repo}/${f.rel}`, stripComments(src));
  }
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
          const text = stripComments(fs.readFileSync(f.abs, 'utf8'));
          compareFile(onAll, truth[f.abs], sigs, where, text);
          if (index.has(f.rel)) { indexed++; compareFile(onIndexed, truth[f.abs], sigs, where, text); }
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
  const result = measure({ reposDir: opt('--repos'), extractorPath: opt('--extractor'), index: args.includes('--index'), dev: args.includes('--dev'), heldOut: args.includes('--held-out') });
  if (!result.measured) {
    console.log(args.includes('--json') ? JSON.stringify({ measured: false, reason: result.reason }) : `extraction-recall cpp: unmeasured (${result.reason})`);
    process.exit(0);
  }
  if (args.includes('--json')) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`extraction-recall cpp: ${result.reference.name} ${result.reference.version}, pins ${Object.entries(result.pins).map(([r, s]) => `${r} ${s || '?'}`).join(', ')}`);
    const misses = Number(opt('--misses', 0));
    for (const [id, p] of Object.entries(result.populations)) {
      console.log(`  ${id}: ${p.label} (${p.filesCompared} files)`);
      for (const r of p.rows) console.log(`    ${r.kind.padEnd(13)} ${String(r.found).padStart(6)} of ${String(r.reference).padStart(6)}  ${r.recall === null ? '  n/a' : r.recall.toFixed(1).padStart(5) + '%'}${r.skipped ? `  (${r.skipped} skipped)` : ''}`);
      if (misses) for (const [kind, list] of Object.entries(p.misses)) if (list.length) console.log(`    first ${Math.min(misses, list.length)} ${kind} misses:`, ...list.slice(0, misses).map((m) => `\n      ${m}`));
    }
  }
}
