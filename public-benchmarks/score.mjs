#!/usr/bin/env node
/**
 * SigMap public retrieval benchmark — third-party-runnable scorer.
 *
 * Self-contained: reads `repos.csv` (pinned repos + srcDirs) and `queries.json`
 * (per-repo query → expected files), runs `gen-context.js` on each cloned repo,
 * parses the generated signature index, ranks each query with the shipped
 * identifier-aware BM25 ranker, and reports hit@1 / hit@5 / MRR.
 *
 * No LLM, no network (repos are cloned by run.sh), no external deps — pure
 * retrieval-rank math. Deterministic: same repos + same commits → same numbers.
 *
 * Usage:
 *   node score.mjs                # run gen-context on each repo, then score
 *   node score.mjs --skip-run     # score existing gen-context output only
 *   node score.mjs --json         # also write results.json
 *   node score.mjs --repos-dir D  # cloned repos live under D (default ./.repos)
 *
 * Requirements: Node 18+. Clone the repos first with `./run.sh` (or --skip-clone).
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const GEN_CONTEXT = path.join(ROOT, 'gen-context.js');
const { bm25rank } = require(path.join(ROOT, 'src', 'retrieval', 'bm25.js'));

const SKIP_RUN = process.argv.includes('--skip-run');
const JSON_OUT = process.argv.includes('--json');
const reposDirIdx = process.argv.indexOf('--repos-dir');
const REPOS_DIR = reposDirIdx !== -1 && process.argv[reposDirIdx + 1]
  ? path.resolve(process.argv[reposDirIdx + 1])
  : path.join(HERE, '.repos');

// ── Inputs ───────────────────────────────────────────────────────────────────
function parseCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
  const header = lines.shift().split(',');
  return lines.map((line) => {
    const parts = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = i === header.length - 1 ? parts.slice(i).join(',') : parts[i]; });
    return row;
  });
}

const repos = parseCsv(path.join(HERE, 'repos.csv'));
const queries = JSON.parse(fs.readFileSync(path.join(HERE, 'queries.json'), 'utf8'));

// ── Signature index parser (reads .github/copilot-instructions.md) ────────────
function buildSigIndex(contextPath) {
  const index = new Map();
  if (!fs.existsSync(contextPath)) return index;
  let currentFile = null; let inBlock = false; let sigs = [];
  for (const line of fs.readFileSync(contextPath, 'utf8').split('\n')) {
    const h = line.match(/^###\s+(\S+)\s*$/);
    if (h) {
      if (currentFile !== null) index.set(currentFile, sigs);
      currentFile = h[1]; sigs = []; inBlock = false; continue;
    }
    if (line.startsWith('```')) { inBlock = !inBlock; continue; }
    if (inBlock && currentFile && line.trim()) sigs.push(line.trim());
  }
  if (currentFile !== null) index.set(currentFile, sigs);
  return index;
}

// ── Scoring ───────────────────────────────────────────────────────────────────
const normalize = (p) => String(p).replace(/^\.\//, '').replace(/\\/g, '/');

function rank(query, index, topK = 10) {
  const candidates = [...index.entries()].map(([file, sigs]) => ({ file, sigs }));
  return bm25rank(query, candidates).slice(0, topK).map((r) => r.file);
}

function firstRank(ranked, expected) {
  const exp = new Set(expected.map(normalize));
  for (let i = 0; i < ranked.length; i++) if (exp.has(normalize(ranked[i]))) return i + 1;
  return Infinity;
}

// ── gen-context runner ────────────────────────────────────────────────────────
function runGenContext(repoDir, srcDirs) {
  const configPath = path.join(repoDir, 'gen-context.config.json');
  const prev = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : null;
  fs.writeFileSync(configPath, JSON.stringify({ srcDirs: srcDirs.split(';') }, null, 2));
  try {
    execFileSync('node', [GEN_CONTEXT], { cwd: repoDir, stdio: 'pipe', timeout: 120_000 });
    return true;
  } catch {
    return false;
  } finally {
    if (prev !== null) fs.writeFileSync(configPath, prev); else { try { fs.unlinkSync(configPath); } catch {} }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const perRepo = [];
let hit1 = 0; let hit5 = 0; let rrSum = 0; let n = 0; let scoredRepos = 0; let missing = 0;

for (const { repo, srcDirs } of repos) {
  const repoDir = path.join(REPOS_DIR, repo);
  const tasks = queries[repo] || [];
  if (!fs.existsSync(repoDir)) {
    console.log(`  ⚠ ${repo.padEnd(18)} not cloned — run ./run.sh first (skipping ${tasks.length} queries)`);
    missing += tasks.length;
    continue;
  }
  if (!SKIP_RUN) runGenContext(repoDir, srcDirs);

  const index = buildSigIndex(path.join(repoDir, '.github', 'copilot-instructions.md'));
  if (index.size === 0) {
    console.log(`  ⚠ ${repo.padEnd(18)} no gen-context output — skipping ${tasks.length} queries`);
    missing += tasks.length;
    continue;
  }

  let rH1 = 0; let rH5 = 0; let rRr = 0;
  for (const t of tasks) {
    const ranked = rank(t.query, index);
    const fr = firstRank(ranked, t.expected_files);
    if (fr === 1) rH1++;
    if (fr <= 5) rH5++;
    rRr += fr === Infinity ? 0 : 1 / fr;
  }
  const c = tasks.length || 1;
  perRepo.push({ repo, queries: tasks.length, files: index.size, hit_at_1: rH1 / c, hit_at_5: rH5 / c, mrr: rRr / c });
  hit1 += rH1; hit5 += rH5; rrSum += rRr; n += tasks.length; scoredRepos++;
}

const agg = {
  repos_scored: scoredRepos,
  queries_scored: n,
  queries_missing: missing,
  hit_at_1: n ? hit1 / n : 0,
  hit_at_5: n ? hit5 / n : 0,
  mrr: n ? rrSum / n : 0,
};

const pct = (x) => (x * 100).toFixed(1) + '%';
console.log('\n  repo                queries  files   hit@1   hit@5    MRR');
console.log('  ' + '─'.repeat(58));
for (const r of perRepo) {
  console.log(`  ${r.repo.padEnd(18)} ${String(r.queries).padStart(6)} ${String(r.files).padStart(6)}  ${pct(r.hit_at_1).padStart(6)}  ${pct(r.hit_at_5).padStart(6)}  ${r.mrr.toFixed(3)}`);
}
console.log('  ' + '─'.repeat(58));
console.log(`  ${'AGGREGATE'.padEnd(18)} ${String(n).padStart(6)} ${''.padStart(6)}  ${pct(agg.hit_at_1).padStart(6)}  ${pct(agg.hit_at_5).padStart(6)}  ${agg.mrr.toFixed(3)}`);
if (missing) console.log(`\n  note: ${missing} queries skipped (repos not cloned / no output). Run ./run.sh for the full set.`);

if (JSON_OUT) {
  const outPath = path.join(HERE, 'results.json');
  fs.writeFileSync(outPath, JSON.stringify({ aggregate: agg, perRepo }, null, 2) + '\n');
  console.log(`\n  wrote ${path.relative(process.cwd(), outPath)}`);
}

process.exit(agg.queries_scored === 0 ? 1 : 0);
