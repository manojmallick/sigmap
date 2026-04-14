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
  // ── New languages ─────────────────────────────────────────────────────────
  {
    name: 'abseil-cpp',
    org: 'abseil',
    url: 'https://github.com/abseil/abseil-cpp.git',
    language: 'C++',
    description: 'Google Abseil C++ library',
    configOverride: { srcDirs: ['absl'] },
  },
  {
    name: 'serilog',
    org: 'serilog',
    url: 'https://github.com/serilog/serilog.git',
    language: 'C#',
    description: 'Structured logging for .NET',
    // default srcDirs works (src/)
  },
  {
    name: 'riverpod',
    org: 'rrousselGit',
    url: 'https://github.com/rrousselGit/riverpod.git',
    language: 'Dart',
    description: 'Flutter/Dart state management',
    configOverride: { srcDirs: ['packages'] },
  },
  {
    name: 'okhttp',
    org: 'square',
    url: 'https://github.com/square/okhttp.git',
    language: 'Kotlin',
    description: 'HTTP client for Android/JVM',
    configOverride: { srcDirs: ['okhttp/src/main/kotlin', 'okhttp-tls/src/main/kotlin', 'okhttp-logging-interceptor/src/main/kotlin'] },
  },
  {
    name: 'laravel',
    org: 'laravel',
    url: 'https://github.com/laravel/framework.git',
    language: 'PHP',
    description: 'Laravel PHP framework',
    configOverride: { srcDirs: ['src'] },
  },
  {
    name: 'akka',
    org: 'akka',
    url: 'https://github.com/akka/akka.git',
    language: 'Scala',
    description: 'Actor model runtime for JVM',
    configOverride: { srcDirs: ['akka-actor/src/main/scala', 'akka-stream/src/main/scala', 'akka-cluster/src/main/scala'] },
  },
  {
    name: 'vapor',
    org: 'vapor',
    url: 'https://github.com/vapor/vapor.git',
    language: 'Swift',
    description: 'Swift server-side web framework',
    configOverride: { srcDirs: ['Sources'] },
  },
  {
    name: 'vue-core',
    org: 'vuejs',
    url: 'https://github.com/vuejs/core.git',
    language: 'Vue',
    description: 'Vue.js 3 core monorepo',
    configOverride: { srcDirs: ['packages'] },
  },
  {
    name: 'svelte',
    org: 'sveltejs',
    url: 'https://github.com/sveltejs/svelte.git',
    language: 'Svelte',
    description: 'Cybernetically enhanced web apps',
    configOverride: { srcDirs: ['packages/svelte/src'] },
  },
  {
    name: 'fastify',
    org: 'fastify',
    url: 'https://github.com/fastify/fastify.git',
    language: 'JavaScript',
    description: 'Fast and low-overhead Node.js web framework',
    configOverride: { srcDirs: ['lib'] },
  },
  {
    name: 'fastapi',
    org: 'fastapi',
    url: 'https://github.com/fastapi/fastapi.git',
    language: 'Python',
    description: 'FastAPI Python framework',
    configOverride: { srcDirs: ['fastapi'] },
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
// Time-savings analysis
// Assumptions:
//   TOKENS_PER_SEC  — frontier LLM input-processing speed (Claude 3.5 / GPT-4o, uncached)
//   CACHE_SPEEDUP   — prompt-cache reads process ~10× faster (both Anthropic & OpenAI)
//   CALLS_PER_DAY   — typical daily AI-agent invocations on a repo
// ---------------------------------------------------------------------------
const TOKENS_PER_SEC = 2000;
const CACHE_SPEEDUP  = 10;
const CALLS_PER_DAY  = 10;

function fmtTime(sec) {
  if (sec < 0.1)  return '<0.1s';
  if (sec < 60)   return sec.toFixed(1) + 's';
  if (sec < 3600) { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return m + 'min ' + s + 's'; }
  const h = Math.floor(sec / 3600), rm = Math.round((sec % 3600) / 60);
  return h + 'hr ' + rm + 'min';
}

let totalSavedColdSec = 0, totalSavedCachedSec = 0;

for (const r of results) {
  const rawCold     = r.rawTokens   / TOKENS_PER_SEC;
  const sigCold     = r.finalTokens / TOKENS_PER_SEC;
  const savedCold   = rawCold - sigCold;
  const rawCached   = rawCold   / CACHE_SPEEDUP;
  const sigCached   = sigCold   / CACHE_SPEEDUP;
  const savedCached = rawCached - sigCached;
  totalSavedColdSec   += savedCold;
  totalSavedCachedSec += savedCached;
  r.timings = {
    rawColdSec: parseFloat(rawCold.toFixed(2)),
    sigColdSec: parseFloat(sigCold.toFixed(2)),
    savedColdSec: parseFloat(savedCold.toFixed(2)),
    rawCachedSec: parseFloat(rawCached.toFixed(2)),
    sigCachedSec: parseFloat(sigCached.toFixed(2)),
    savedCachedSec: parseFloat(savedCached.toFixed(2)),
    savedPerDaySec: parseFloat((savedCold * CALLS_PER_DAY).toFixed(2)),
  };
}

const W = 104;
console.log('\n' + '═'.repeat(W));
console.log('LLM Response-Time Savings');
console.log(`Assumptions: ~${TOKENS_PER_SEC.toLocaleString()} tok/s uncached · ×${CACHE_SPEEDUP} faster with prompt cache · ${CALLS_PER_DAY} calls/day`);
console.log('═'.repeat(W));

const tcols = [
  { label: 'Repo',           width: 22 },
  { label: 'Raw (cold)',     width: 12, right: true },
  { label: 'SigMap (cold)',  width: 13, right: true },
  { label: '1st call saved', width: 14, right: true },
  { label: 'Raw (cached)',   width: 13, right: true },
  { label: 'SigMap (cache)', width: 14, right: true },
  { label: 'Cache saved',    width: 13, right: true },
];
const thead = tcols.map(c => pad(c.label, c.width, c.right)).join('  ');
const tdiv  = tcols.map(c => '-'.repeat(c.width)).join('  ');
console.log('\n' + thead);
console.log(tdiv);

for (const r of results) {
  const t = r.timings;
  console.log([
    pad(r.repo,                    tcols[0].width),
    pad(fmtTime(t.rawColdSec),    tcols[1].width, true),
    pad(fmtTime(t.sigColdSec),    tcols[2].width, true),
    pad(fmtTime(t.savedColdSec),  tcols[3].width, true),
    pad(fmtTime(t.rawCachedSec),  tcols[4].width, true),
    pad(fmtTime(t.sigCachedSec),  tcols[5].width, true),
    pad(fmtTime(t.savedCachedSec),tcols[6].width, true),
  ].join('  '));
}

console.log(tdiv);
const totalSavedPerDay = totalSavedColdSec * CALLS_PER_DAY;
console.log(
  pad('TOTAL (' + results.length + ' repos)', tcols[0].width + 2 + tcols[1].width + 2 + tcols[2].width, false) +
  '  ' + pad(fmtTime(totalSavedColdSec),   tcols[3].width, true) +
  '  ' + pad('', tcols[4].width + 2 + tcols[5].width, false) +
  '  ' + pad(fmtTime(totalSavedCachedSec), tcols[6].width, true)
);
const yearlyHr = Math.round(totalSavedColdSec * CALLS_PER_DAY * 365 / 3600);
console.log('\n  Summed across all ' + results.length + ' repos at ' + CALLS_PER_DAY + ' calls/day each:');
console.log('    Per repo per call  → see table above (e.g. rust-analyzer saves 29min per call)');
console.log('    All repos, 1 call  → ' + fmtTime(totalSavedColdSec) + ' total saved');
console.log('    All repos, ' + CALLS_PER_DAY + ' calls/day → ' + fmtTime(totalSavedColdSec * CALLS_PER_DAY) + '/day');
console.log('    Yearly             → ' + yearlyHr.toLocaleString() + ' hr/year');
console.log('\n' + '═'.repeat(W));

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

// Time-savings markdown table
mdLines.push('');
mdLines.push('## LLM response-time savings');
mdLines.push('');
mdLines.push('> Assumptions: ~2 000 tok/s uncached (frontier LLMs) · ×10 faster with prompt cache');
mdLines.push('');
mdLines.push('| Repo | Raw (cold) | SigMap (cold) | 1st call saved | Raw (cached) | SigMap (cached) | Cache saved |');
mdLines.push('|------|:----------:|:-------------:|:--------------:|:------------:|:---------------:|:-----------:|');
for (const r of results) {
  const t = r.timings;
  mdLines.push(`| **${r.repo}** | ${fmtTime(t.rawColdSec)} | ${fmtTime(t.sigColdSec)} | **${fmtTime(t.savedColdSec)}** | ${fmtTime(t.rawCachedSec)} | ${fmtTime(t.sigCachedSec)} | **${fmtTime(t.savedCachedSec)}** |`);
}
mdLines.push('');
mdLines.push(`*At ${CALLS_PER_DAY} calls/day per repo: **${fmtTime(totalSavedColdSec)}** saved across all repos per round · **${fmtTime(totalSavedColdSec * CALLS_PER_DAY)}/day** · **${Math.round(totalSavedColdSec * CALLS_PER_DAY * 365 / 3600).toLocaleString()} hr/year***`);

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
    assumptions: {
      tokensPerSecUncached: TOKENS_PER_SEC,
      cacheSpeedup: CACHE_SPEEDUP,
      callsPerDay: CALLS_PER_DAY,
    },
    repos: results,
    summary: {
      repoCount: results.length,
      avgReductionPct: parseFloat(avgReduction.toFixed(1)),
      overallReductionPct: parseFloat(overallReduction),
      totalRawTokens: totalRaw,
      totalFinalTokens: totalFinal,
      totalSavedColdSec: parseFloat(totalSavedColdSec.toFixed(2)),
      totalSavedCachedSec: parseFloat(totalSavedCachedSec.toFixed(2)),
      savedPerDaySec: parseFloat((totalSavedColdSec * CALLS_PER_DAY).toFixed(2)),
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
