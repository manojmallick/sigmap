#!/usr/bin/env node
// Rebuild a held-out data root from the saved pins, so a later session can repeat the study's runs on the SAME repositories at the SAME commits.
//
//   node benchmarks/agent-study/rebuild-heldout-root.mjs --out <dir>                           # all 21 repositories of both rounds
//   node benchmarks/agent-study/rebuild-heldout-root.mjs --out <dir> --exclude emilk__egui_plot  # the 20 of the Messages-API and hook series
//   node benchmarks/agent-study/rebuild-heldout-root.mjs --out <dir> --dry-run                   # the plan, fetches nothing
//   node benchmarks/agent-study/rebuild-heldout-root.mjs --out <dir> --pins heldout3-repos.json --questions heldout3-questions.jsonl   # another saved set (files in data/)
//
// scripts/build-heldout-set.mjs builds a set from each repository's CURRENT head, so running it again gives different questions. The study kept
// what it used: data/heldout-repos.json and data/heldout2-repos.json (the pinned commits) and data/heldout-questions.jsonl and
// data/heldout2-questions.jsonl (the questions with their labels). This script writes them out in the layout the harness reads
// (benchmarks/xrepo-repos.json, benchmarks/tasks/retrieval-xrepo.jsonl, one checkout per repository under benchmarks/repos/) and fetches each
// repository at its pinned commit with `git fetch --depth 1 <url> <commit>`, then checks that HEAD is that commit. It needs network access to
// the repositories' hosts and about 100 MB; no key, no GitHub API. It is resumable: a checkout already at its pinned commit is kept.
//
// `--out` must not be inside this repository (the harness copies repositories and resets the copies, and a checkout inside this tree would be
// indexed as part of it).
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DATA = path.join(HERE, 'data');

const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);

const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 300000, env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' }) });

export function readPins(dataDir = DATA, files = ['heldout-repos.json', 'heldout2-repos.json']) {
  const repos = [];
  const seen = new Set();
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
    for (const r of (Array.isArray(j) ? j : j.repos)) { if (!seen.has(r.name)) { seen.add(r.name); repos.push(r); } }
  }
  return repos;
}

export function readQuestions(dataDir = DATA, files = ['heldout-questions.jsonl', 'heldout2-questions.jsonl']) {
  return files.flatMap((f) => fs.readFileSync(path.join(dataDir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
}

/** True when `child` is `parent` or inside it (after resolving). */
export function isInside(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Write the manifest and the questions, and fetch every repository at its pinned commit.
 * @param {{ out: string, exclude?: string[], only?: string[], dryRun?: boolean, dataDir?: string, pinFiles?: string[], questionFiles?: string[], log?: (s: string) => void }} o
 * @returns {{ repos: object[], questions: number, fetched: string[], kept: string[], failed: Array<{ name: string, why: string }> }}
 */
export function rebuild(o) {
  const log = o.log || (() => {});
  const out = path.resolve(o.out);
  if (isInside(REPO_ROOT, out)) throw new Error(`--out ${out} is inside this repository: choose a directory outside it`);
  const exclude = new Set(o.exclude || []);
  const only = o.only && o.only.length ? new Set(o.only) : null;
  const pins = readPins(o.dataDir || DATA, o.pinFiles).filter((r) => !exclude.has(r.name) && (!only || only.has(r.name)));
  if (!pins.length) throw new Error('no repository left after --exclude / --only');
  const names = new Set(pins.map((r) => r.name));
  const questions = readQuestions(o.dataDir || DATA, o.questionFiles).filter((q) => names.has(q.repo));
  const missing = pins.filter((r) => !questions.some((q) => q.repo === r.name)).map((r) => r.name);
  if (missing.length) throw new Error(`no questions for: ${missing.join(', ')}`);

  const result = { repos: pins, questions: questions.length, fetched: [], kept: [], failed: [] };
  log(`${pins.length} repositories, ${questions.length} questions -> ${out}`);
  if (o.dryRun) return result;

  fs.mkdirSync(path.join(out, 'benchmarks', 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(out, 'benchmarks', 'repos'), { recursive: true });
  fs.writeFileSync(path.join(out, 'benchmarks', 'xrepo-repos.json'), `${JSON.stringify({ _comment: 'held-out repositories at the commits the agent study pinned (rebuild-heldout-root.mjs)', repos: pins }, null, 2)}\n`);
  fs.writeFileSync(path.join(out, 'benchmarks', 'tasks', 'retrieval-xrepo.jsonl'), `${questions.map((q) => JSON.stringify(q)).join('\n')}\n`);

  for (const r of pins) {
    const dir = path.join(out, 'benchmarks', 'repos', r.name);
    const head = () => { const h = git(['rev-parse', 'HEAD'], dir); return h.status === 0 ? h.stdout.trim() : null; };
    if (fs.existsSync(path.join(dir, '.git')) && head() === r.commit) { result.kept.push(r.name); log(`kept    ${r.name}`); continue; }
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const steps = [['init', '-q'], ['fetch', '-q', '--depth', '1', r.url, r.commit], ['checkout', '-q', 'FETCH_HEAD']];
    let why = null;
    for (const s of steps) { const x = git(s, dir); if (x.status !== 0) { why = `git ${s[0]} failed: ${(x.stderr || x.stdout || '').trim().split('\n').pop().slice(0, 160)}`; break; } }
    if (!why && head() !== r.commit) why = `HEAD is ${String(head()).slice(0, 10)}, not the pinned ${r.commit.slice(0, 10)}`;
    if (why) { result.failed.push({ name: r.name, why }); log(`FAILED  ${r.name}: ${why}`); fs.rmSync(dir, { recursive: true, force: true }); continue; }
    result.fetched.push(r.name); log(`fetched ${r.name} @ ${r.commit.slice(0, 10)}`);
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = val('--out', null);
  if (!out) { console.error('usage: rebuild-heldout-root.mjs --out <dir> [--exclude name,name] [--only name,name] [--pins file,file --questions file,file] [--dry-run]'); process.exit(2); }
  let res;
  try {
    const list = (n) => (val(n, '') || '').split(',').filter(Boolean);
    res = rebuild({ out, exclude: list('--exclude'), only: list('--only'), dryRun: has('--dry-run'), pinFiles: list('--pins').length ? list('--pins') : undefined, questionFiles: list('--questions').length ? list('--questions') : undefined, log: (s) => console.log(s) });
  } catch (e) { console.error(`rebuild-heldout-root: ${e.message}`); process.exit(2); }
  if (has('--dry-run')) { console.log('dry run: nothing fetched or written'); process.exit(0); }
  console.log(`\n${res.fetched.length} fetched, ${res.kept.length} kept, ${res.failed.length} failed`);
  if (res.failed.length) process.exit(1);
  console.log(`\nUse it as HELDOUT_ROOT=${path.resolve(out)}`);
}
