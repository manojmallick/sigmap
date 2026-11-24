#!/usr/bin/env node
// What each SigMap strategy writes, in tokens, for the three files an agent host reads (CLAUDE.md, AGENTS.md, the Copilot file), and what it leaves out
// of them. The figures on docs-vp/guide/strategies.md come from here: benchmarks/strategy-footprint.json is this script's output, and
// test/integration/strategies-page.test.js pins the page to it.
//
//   node scripts/measure-strategy-footprint.mjs --repos <dir of clones> [--only gin,flask] [--self] [--sweep] [--out benchmarks/strategy-footprint.json]
//   node scripts/measure-strategy-footprint.mjs --aggregate benchmarks/strategy-footprint.json
//
// For every repository and strategy it runs this checkout's gen-context.js once on a fresh copy, with only `strategy` and the four host outputs set
// (a repository's own gen-context.config.json keeps its other keys), and counts what was written. A token is ceil(chars / 4), the estimator SigMap
// itself uses; it is a size, not a tokenizer's count.
//
// Deterministic for a given SigMap commit, repository commit and `python3` (its presence and version change what SigMap writes for Python files); LC_ALL is pinned to C so that SigMap's thousands separators match the parser. Every strategy runs on the same copy: the files of `git archive HEAD`, so each file carries the commit's timestamp (the budget orders
// files by class, then recency, then signature density, then path, so equal times leave density and path to decide), and the same commit gives the same files on every machine; plus the repository's history in `.git`, which
// `hot-cold` reads its hot set from. CODEX_HOME points at an empty directory (a Codex config.toml would move the AGENTS.md limit), and the repository's own AGENTS.md, CLAUDE.md and Copilot file are removed, so
// what is measured is what SigMap wrote and nothing a person did.
//
// Exit 0: measured. Exit 2: nothing could be measured (no repository given or found).
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');
export const STRATEGIES = Object.freeze(['full', 'index', 'per-module', 'hot-cold']);
export const HOSTS = Object.freeze({ claude_md: 'CLAUDE.md', agents_md: 'AGENTS.md', copilot: '.github/copilot-instructions.md' });
export const SWEEP = Object.freeze([1, 5, 10, 25, 50, 100, 250, 500, 1000]);
const OUTPUTS = ['copilot', 'claude', 'codex', 'gemini'];
/** Questions put to `sigmap ask` on the SigMap repository itself (--self), so the page can say what one answer costs on top of the map. */
export const SELF_QUESTIONS = Object.freeze([
  "where is the token budget applied",
  "how does the watcher patch the live overlay",
  "which function parses the managed section of CLAUDE.md",
  "where is rank scoring of files against a query implemented in the retrieval ranker",
]);
const KEY = { full: 'full', index: 'index', 'per-module': 'per_module', 'hot-cold': 'hot_cold' };

/** SigMap's own estimator: characters divided by four, rounded up. */
export const tokens = (text) => Math.ceil(String(text).length / 4);

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; } };
const num = (s) => Number(String(s).replace(/,/g, ''));

/**
 * A fresh working copy of `repoDir`: the files of HEAD from `git archive`, and the repository's history beside them. The files are the same for every
 * strategy (a clone would add whatever `export-ignore` leaves out of an archive, and the retrieval indexes would then differ for that reason alone), and the
 * history is there for all four, as in a checkout: `hot-cold` reads its hot set from it, and `full` orders recently committed files first within their class and adds a changes section.
 */
function copyOf(repoDir) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-strategy-'));
  const tar = execFileSync('git', ['-C', repoDir, 'archive', 'HEAD'], { maxBuffer: 1 << 30 });
  const r = spawnSync('tar', ['-x', '-C', dir], { input: tar });
  if (r.status !== 0) throw new Error(`cannot unpack ${repoDir}: ${String(r.stderr)}`);
  const hist = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-history-'));
  try {
    execFileSync('git', ['clone', '--no-checkout', '--local', '--no-hardlinks', '--quiet', repoDir, hist], { stdio: 'ignore' });
    fs.renameSync(path.join(hist, '.git'), path.join(dir, '.git'));
  } finally { fs.rmSync(hist, { recursive: true, force: true }); }
  for (const rel of Object.values(HOSTS)) fs.rmSync(path.join(dir, rel), { force: true });
  return dir;
}

/**
 * One strategy on one repository.
 * @returns {{ claude_md: number, agents_md: number, copilot: number, on_demand: number, dropped: number, files_scanned: number|null,
 *             raw_tokens: number|null, modules: number|null, indexed: {n: number, of: number}|null, hot_files: number|null }}
 */
export function measureOne(repoDir, strategy, extra = {}, opts = {}) {
  const dir = copyOf(repoDir);
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-codexhome-'));
  try {
    const cfgPath = path.join(dir, 'gen-context.config.json');
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (_) { cfg = {}; }
    fs.writeFileSync(cfgPath, `${JSON.stringify({ ...cfg, strategy, outputs: OUTPUTS, ...extra }, null, 2)}\n`);
    const r = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js')], { cwd: dir, encoding: 'utf8', env: { ...process.env, CODEX_HOME: codexHome, LC_ALL: 'C' }, maxBuffer: 1 << 28, timeout: 900000 });
    if (r.status !== 0) throw new Error(`gen-context failed on ${repoDir} (${strategy}): ${(r.stderr || r.stdout || '').slice(-400)}`);
    const log = `${r.stderr || ''}\n${r.stdout || ''}`;
    // what one `sigmap ask` returns on top of the map: the size of .context/query-context.md, which is what an agent is told to read
    const askTokens = (opts.asks || []).map((q) => {
      const a = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), 'ask', q], { cwd: dir, encoding: 'utf8', env: { ...process.env, CODEX_HOME: codexHome, LC_ALL: 'C' }, maxBuffer: 1 << 26, timeout: 120000 });
      return a.status === 0 ? tokens(read(path.join(dir, '.context', 'query-context.md')) || '') : null;
    });
    const out = {};
    const sections = {};
    for (const [key, rel] of Object.entries(HOSTS)) { const t = read(path.join(dir, rel)); out[key] = t === null ? null : tokens(t); sections[key] = t === null ? null : (t.match(/^### /gm) || []).length; }
    let onDemand = 0;
    try { for (const f of fs.readdirSync(path.join(dir, '.github'))) if (/^context-.+\.md$/.test(f)) onDemand += tokens(read(path.join(dir, '.github', f)) || ''); } catch (_) { /* no .github */ }
    const red = log.match(/Token reduction:[^(]*\(([\d,]+)\s*\S+\s*([\d,]+)/);
    const idx = log.match(/Indexed\s*:\s*([\d,]+) of ([\d,]+) files with symbols/);
    const mod = log.match(/per-module: (\d+) modules/);
    // the retrieval index's entries, hashed: the page says they are the same under every strategy
    let indexHash = null;
    try { const j = JSON.parse(read(path.join(dir, '.context', 'sig-index.json'))); indexHash = crypto.createHash('sha256').update(JSON.stringify([Object.entries(j.files).sort(), j.bare])).digest('hex').slice(0, 16); } catch (_) { /* no index */ }
    const cap = log.match(/\[sigmap\] index: (\d+) file\(s\) hold more signatures than the index keeps; (\d+) not indexed/);
    const hot = log.match(/hot\s+\(auto-injected\)\s*:\s*(\d+) files/);
    const scanned = log.match(/Files scanned\s*:\s*([\d,]+)/);
    return {
      ...out,
      sections,
      index_hash: indexHash,
      on_demand: onDemand,
      dropped: [...log.matchAll(/^\[sigmap\] budget: dropped (\d+)/gm)].reduce((n, m) => n + Number(m[1]), 0),
      files_scanned: scanned ? num(scanned[1]) : null,
      raw_tokens: red ? num(red[1]) : null,
      modules: mod ? Number(mod[1]) : null,
      indexed: idx ? { n: num(idx[1]), of: num(idx[2]) } : null,
      hot_files: hot ? Number(hot[1]) : null,
      index_cap: cap ? { files: Number(cap[1]), signatures: Number(cap[2]) } : null,
      module_files: [...log.matchAll(/per-module: wrote \.github\/context-(.+)\.md \(~(\d+) tokens, (\d+) files\)/g)].map((m) => ({ module: m[1], tokens: Number(m[2]), files: Number(m[3]) })),
      ...(askTokens.length ? { ask_tokens: askTokens } : {}),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(codexHome, { recursive: true, force: true });
  }
}

/** All four strategies on one repository: one record. */
export function measureRepo(repoDir, name = path.basename(repoDir), opts = {}) {
  const git = (...a) => execFileSync('git', ['-C', repoDir, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
  const rec = { repo: name, commits: Number(git('rev-list', '--count', 'HEAD')), tracked_files: git('ls-files').split('\n').filter(Boolean).length };
  const by = {};
  for (const s of STRATEGIES) by[s] = measureOne(repoDir, s, {}, s === 'index' ? opts : {});
  rec.files_scanned = by.full.files_scanned;
  rec.raw_tokens = by.full.raw_tokens;
  rec.modules = by['per-module'].modules;
  rec.indexed = by.index.indexed;
  rec.index_cap = by.index.index_cap;
  rec.index_identical = STRATEGIES.every((s) => by[s].index_hash && by[s].index_hash === by.full.index_hash);
  rec.per_module_files = by['per-module'].module_files;
  if (by.index.ask_tokens) rec.ask_tokens = by.index.ask_tokens;
  for (const s of STRATEGIES) {
    const { claude_md, agents_md, copilot, sections, on_demand, dropped, hot_files } = by[s];
    rec[KEY[s]] = { claude_md, agents_md, copilot, sections, on_demand, dropped, ...(s === 'hot-cold' ? { hot_files } : {}) };
  }
  return rec;
}

/**
 * A window of N commits lists every file a smaller window lists, so a larger window cannot have fewer hot files. When it does, the measurement failed rather
 * than found something (SigMap reads `git log --name-only -n N` through a 1 MiB buffer and treats a failure as an empty set: akka at 1,000 commits prints
 * 1.2 MB). Such a point is kept as evidence and marked, so nothing quotes it as a result.
 */
export function flagInvalidSweep(points) {
  let most = 0;
  return points.map((p) => {
    if (p.hot_files > most) most = p.hot_files;
    return p.hot_files === 0 && most > 0 ? { ...p, invalid: 'the hot set is empty although a smaller window has files: the git log read failed, so this is not a measurement' } : p;
  });
}

/** hot-cold's always-on size as `hotCommits` grows, for a repository with history. */
export function measureSweep(repoDir) {
  return flagInvalidSweep(SWEEP.map((n) => { const m = measureOne(repoDir, 'hot-cold', { hotCommits: n }); return { hot_commits: n, hot_files: m.hot_files, claude_md: m.claude_md, agents_md: m.agents_md }; }));
}

const median = (a) => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const spread = (v) => ({ n: v.length, min: Math.min(...v), median: median(v), max: Math.max(...v) });

/**
 * The figures the strategies page quotes, from a list of records. Pure: the page is pinned to this.
 * @param {object[]} repos - records from measureRepo
 */
export function aggregate(repos) {
  const always = {};
  for (const s of ['full', 'index', 'per-module']) {
    always[s] = {};
    for (const h of Object.keys(HOSTS)) always[s][h] = spread(repos.map((r) => r[KEY[s]][h]));
  }
  const pts = repos.map((r) => [r.modules, r.per_module.claude_md]).filter((p) => p[0] !== null);
  const n = pts.length; const sx = pts.reduce((a, p) => a + p[0], 0); const sy = pts.reduce((a, p) => a + p[1], 0);
  const sxx = pts.reduce((a, p) => a + p[0] * p[0], 0); const sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const shallow = repos.filter((r) => r.commits <= 1);
  return {
    repos: repos.length,
    files_scanned: { min: Math.min(...repos.map((r) => r.files_scanned)), max: Math.max(...repos.map((r) => r.files_scanned)) },
    always_on: always,
    per_module_fit: { slope: Math.round(slope), intercept: Math.round((sy - slope * sx) / n) },
    full_lost_files: repos.filter((r) => r.full.dropped > 0).length,
    full_lost_nothing: repos.filter((r) => r.full.dropped === 0).map((r) => r.files_scanned).sort((a, b) => a - b),
    per_module_lost_files: repos.filter((r) => r.per_module.dropped > 0).length,
    index_identical_under_all_strategies: repos.filter((r) => r.index_identical).length,
    indexed_everything: repos.filter((r) => r.indexed && r.indexed.n === r.indexed.of).length,
    hot_cold_shallow: { n: shallow.length, claude_md: spread(shallow.map((r) => r.hot_cold.claude_md)), every_file_hot: shallow.filter((r) => r.hot_cold.hot_files === r.files_scanned).length },
  };
}

function parseArgs(argv) {
  const a = { repos: null, only: null, self: false, sweep: false, out: null, aggregate: null, list: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--repos') a.repos = argv[++i];
    else if (k === '--repo') a.list.push(argv[++i]);
    else if (k === '--only') a.only = argv[++i].split(',');
    else if (k === '--self') a.self = true;
    else if (k === '--sweep') a.sweep = true;
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--aggregate') a.aggregate = argv[++i];
  }
  return a;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.aggregate) {
    const j = JSON.parse(fs.readFileSync(a.aggregate, 'utf8'));
    process.stdout.write(`${JSON.stringify(aggregate(j.repos), null, 2)}\n`);
    return;
  }
  const targets = [...a.list.map((p) => [path.basename(p), path.resolve(p)])];
  if (a.repos) for (const d of fs.readdirSync(a.repos).sort()) { const p = path.join(a.repos, d); if (fs.existsSync(path.join(p, '.git')) && (!a.only || a.only.includes(d))) targets.push([d, p]); }
  if (a.self) targets.push(['sigmap', ROOT]);
  if (targets.length === 0) { console.error('no repository: pass --repos <dir of clones>, --repo <path> or --self'); process.exit(2); }
  const repos = []; const sweeps = {};
  for (const [name, dir] of targets) {
    const rec = measureRepo(dir, name, name === 'sigmap' && dir === ROOT ? { asks: SELF_QUESTIONS } : {}); repos.push(rec);
    if (a.sweep && rec.commits > 100) sweeps[name] = measureSweep(dir);
    console.error(`${name.padEnd(18)} scanned ${String(rec.files_scanned).padStart(5)}  CLAUDE.md full ${rec.full.claude_md} / index ${rec.index.claude_md} / per-module ${rec.per_module.claude_md} / hot-cold ${rec.hot_cold.claude_md}`);
  }
  const commit = (() => { try { return execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (_) { return null; } })();
  const result = { schema: 1, sigmap_version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, measured_with_commit: commit, unit: 'tokens = ceil(chars / 4)', repos, hot_cold_sweep: sweeps };
  if (a.out) fs.writeFileSync(a.out, `${JSON.stringify(result, null, 1)}\n`);
  process.stdout.write(`${JSON.stringify(aggregate(repos), null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
