#!/usr/bin/env node
/**
 * SigMap token-reduction benchmark runner
 *
 * Clones a curated set of real-world repos, runs `node gen-context.js --report --json`
 * on each, and prints a Markdown table of raw-vs-compressed token counts.
 *
 * Usage:
 *   node scripts/run-benchmark.mjs               # run all repos, print table
 *   node scripts/run-benchmark.mjs --save        # also write benchmarks/reports/token-reduction.json
 *   node scripts/run-benchmark.mjs --skip-clone  # skip git clone if repos already present
 *
 * Requirements: git, node 18+
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPOS_DIR = path.join(ROOT, 'benchmarks', 'repos');
const REPORTS_DIR = path.join(ROOT, 'benchmarks', 'reports');
const GEN_CONTEXT = path.join(ROOT, 'gen-context.js');

const SKIP_CLONE = process.argv.includes('--skip-clone');
const SAVE = process.argv.includes('--save');

// ---------------------------------------------------------------------------
// Target repos
// Chosen to: cover multiple languages, be well-known, have large codebases
// ---------------------------------------------------------------------------
const REPOS = [
  {
    name: 'express',
    org: 'expressjs',
    url: 'https://github.com/expressjs/express.git',
    language: 'JavaScript',
    description: 'Node.js web framework',
    // default srcDirs work (lib/)
  },
  {
    name: 'flask',
    org: 'pallets',
    url: 'https://github.com/pallets/flask.git',
    language: 'Python',
    description: 'Python microframework',
    // default srcDirs work (src/)
  },
  {
    name: 'gin',
    org: 'gin-gonic',
    url: 'https://github.com/gin-gonic/gin.git',
    language: 'Go',
    description: 'Go HTTP web framework',
    // Go packages live at root + subdirs — override srcDirs
    configOverride: { srcDirs: ['.'] },
  },
  {
    name: 'spring-petclinic',
    org: 'spring-projects',
    url: 'https://github.com/spring-projects/spring-petclinic.git',
    language: 'Java',
    description: 'Spring Boot sample app',
    // Maven layout: src/main/java — default srcDirs work (src/)
  },
  {
    name: 'rails',
    org: 'rails',
    url: 'https://github.com/rails/rails.git',
    language: 'Ruby',
    description: 'Ruby on Rails (monorepo)',
    // Rails is a monorepo; primary gem code lives in <gem>/lib/
    configOverride: {
      srcDirs: [
        'activesupport/lib',
        'actionpack/lib',
        'railties/lib',
        'activerecord/lib',
        'actionview/lib',
        'actionmailer/lib',
        'activejob/lib',
      ],
    },
  },
  {
    name: 'axios',
    org: 'axios',
    url: 'https://github.com/axios/axios.git',
    language: 'TypeScript',
    description: 'Promise HTTP client',
    // default srcDirs work (lib/)
  },
  {
    name: 'rust-analyzer',
    org: 'rust-lang',
    url: 'https://github.com/rust-lang/rust-analyzer.git',
    language: 'Rust',
    description: 'Rust language server',
    configOverride: { srcDirs: ['crates'] },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function run(cmd, cwd) {
  const result = spawnSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function pad(str, width, right = false) {
  const s = String(str);
  if (right) return s.padStart(width);
  return s.padEnd(width);
}

// ---------------------------------------------------------------------------
// Clone phase
// ---------------------------------------------------------------------------
if (!fs.existsSync(REPOS_DIR)) fs.mkdirSync(REPOS_DIR, { recursive: true });
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

const results = [];

for (const repo of REPOS) {
  const repoDir = path.join(REPOS_DIR, repo.name);
  process.stdout.write(`\n[${repo.language}] ${repo.name}  — ${repo.description}\n`);

  // ── Clone (or skip) ──────────────────────────────────────────────────────
  if (!fs.existsSync(repoDir)) {
    if (SKIP_CLONE) {
      console.warn(`  SKIP (--skip-clone): ${repoDir} not found`);
      continue;
    }
    process.stdout.write(`  cloning ${repo.url} ...\n`);
    const cloneResult = run(
      `git clone --depth 1 --single-branch --quiet "${repo.url}" "${repoDir}"`,
      REPOS_DIR
    );
    if (cloneResult.status !== 0) {
      console.error(`  ERROR cloning: ${cloneResult.stderr.trim()}`);
      continue;
    }
  } else {
    process.stdout.write(`  repo already present, skipping clone\n`);
  }

  // ── Write temporary config override (if needed) ─────────────────────────
  const configPath = path.join(repoDir, 'gen-context.config.json');
  const hadConfig = fs.existsSync(configPath);
  const tempConfigWritten = !hadConfig && repo.configOverride;
  if (tempConfigWritten) {
    fs.writeFileSync(configPath, JSON.stringify(repo.configOverride, null, 2));
  }

  // ── Run sigmap --report --json ───────────────────────────────────────────
  process.stdout.write(`  running sigmap analysis ...\n`);
  const reportResult = run(`node "${GEN_CONTEXT}" --report --json`, repoDir);

  // ── Remove temp config ───────────────────────────────────────────────────
  if (tempConfigWritten) {
    try { fs.unlinkSync(configPath); } catch (_) {}
  }

  // The --report --json output goes to stdout as a single JSON line
  let reportData = null;
  for (const line of reportResult.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      reportData = JSON.parse(trimmed);
      break;
    } catch (_) {}
  }

  if (!reportData) {
    console.error(`  ERROR: could not parse report JSON`);
    if (reportResult.stderr) console.error(`  stderr: ${reportResult.stderr.slice(0, 300)}`);
    continue;
  }

  const entry = {
    repo: repo.name,
    language: repo.language,
    description: repo.description,
    rawTokens: reportData.rawTokens || reportData.inputTokens,
    finalTokens: reportData.finalTokens,
    reductionPct: reportData.reductionPct,
    fileCount: reportData.fileCount,
    droppedCount: reportData.droppedCount,
    timestamp: new Date().toISOString(),
  };

  process.stdout.write(
    `  raw: ${formatNum(entry.rawTokens)} tokens  →  final: ${formatNum(entry.finalTokens)} tokens  (${entry.reductionPct}% reduction)\n`
  );

  results.push(entry);
}

// ---------------------------------------------------------------------------
// Print Markdown table
// ---------------------------------------------------------------------------
if (results.length === 0) {
  console.error('\nNo results collected. Use --skip-clone only if repos are already cloned.');
  process.exit(1);
}

console.log('\n' + '═'.repeat(72));
console.log('SigMap Token Reduction Benchmark');
console.log('═'.repeat(72));

// Header
const cols = [
  { label: 'Repo', width: 22 },
  { label: 'Language', width: 14 },
  { label: 'Raw tokens', width: 12, right: true },
  { label: 'After SigMap', width: 14, right: true },
  { label: 'Reduction', width: 12, right: true },
];

const header = cols.map((c) => pad(c.label, c.width, c.right)).join('  ');
const divider = cols.map((c) => '-'.repeat(c.width)).join('  ');

console.log('\n' + header);
console.log(divider);

for (const r of results) {
  const row = [
    pad(r.repo, cols[0].width),
    pad(r.language, cols[1].width),
    pad(formatNum(r.rawTokens), cols[2].width, true),
    pad(formatNum(r.finalTokens), cols[3].width, true),
    pad(r.reductionPct + '%', cols[4].width, true),
  ].join('  ');
  console.log(row);
}

const avgReduction =
  results.reduce((s, r) => s + r.reductionPct, 0) / results.length;
const totalRaw = results.reduce((s, r) => s + r.rawTokens, 0);
const totalFinal = results.reduce((s, r) => s + r.finalTokens, 0);
const overallReduction = totalRaw > 0
  ? ((1 - totalFinal / totalRaw) * 100).toFixed(1)
  : 0;

console.log(divider);
console.log(
  pad(`AVERAGE (${results.length} repos)`, cols[0].width + 2 + cols[1].width) + '  ' +
  pad(formatNum(totalRaw), cols[2].width, true) + '  ' +
  pad(formatNum(totalFinal), cols[3].width, true) + '  ' +
  pad(overallReduction + '%', cols[4].width, true)
);

console.log('\n' + '═'.repeat(72));

// ---------------------------------------------------------------------------
// Markdown format (for copy-paste into README / LAUNCH.md)
// ---------------------------------------------------------------------------
const mdLines = [
  '## SigMap token reduction benchmark',
  '',
  '| Repo | Language | Raw tokens | After SigMap | Reduction |',
  '|------|----------|------------|--------------|-----------|',
];

for (const r of results) {
  mdLines.push(
    `| **${r.repo}** | ${r.language} | ${formatNum(r.rawTokens)} | ${formatNum(r.finalTokens)} | **${r.reductionPct}%** |`
  );
}
mdLines.push(`| **AVERAGE** | ${results.length} repos | ${formatNum(totalRaw)} | ${formatNum(totalFinal)} | **${overallReduction}%** |`);
mdLines.push('');
mdLines.push(`*Measured with SigMap v${getVersion()} — \`node gen-context.js --report --json\` on each repo (depth-1 clone)*`);

console.log('\nMarkdown table (copy into README):\n');
console.log(mdLines.join('\n'));

// ---------------------------------------------------------------------------
// Save report JSON
// ---------------------------------------------------------------------------
if (SAVE) {
  const reportPath = path.join(REPORTS_DIR, 'token-reduction.json');
  const report = {
    version: getVersion(),
    timestamp: new Date().toISOString(),
    repos: results,
    summary: {
      repoCount: results.length,
      avgReductionPct: parseFloat(avgReduction.toFixed(1)),
      overallReductionPct: parseFloat(overallReduction),
      totalRawTokens: totalRaw,
      totalFinalTokens: totalFinal,
    },
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved → ${path.relative(ROOT, reportPath)}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    return pkg.version || 'unknown';
  } catch (_) {
    return 'unknown';
  }
}
