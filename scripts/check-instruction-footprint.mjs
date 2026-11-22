#!/usr/bin/env node
// #1071, T3: the instruction files SigMap writes must fit what the host reads. For gin, flask, django and SigMap's own repository, under today's
// config and under Candidate A (`strategy: "index"` + `mcp.tools: "locate"`), the generated AGENTS.md is at most 32 KiB (Codex's default
// `project_doc_max_bytes`) and the generated CLAUDE.md at most 200 lines (what Claude Code asks for). The Copilot file is reported, not judged:
// no host limit is registered for it.
//
//   node scripts/check-instruction-footprint.mjs [--repos <dir of clones>] [--only gin,flask] [--require-repos] [--json]
//
// Exit 0: every measured file is within its limit. Exit 1: one is not. Exit 2: nothing could be measured, or `--require-repos` and a clone is
// missing. A clone that is absent is skipped and SAID so; it is never counted as a pass.
//
// Every measurement runs on a `git archive` copy of the repository's HEAD in a temp directory, with a CODEX_HOME that holds no config.toml, and
// with the repository's own AGENTS.md, CLAUDE.md and Copilot file left out, so what is measured is what SigMap generated and nothing a person wrote.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');
export const LIMITS = Object.freeze({ codexBytes: 32768, claudeLines: 200 });
export const CANDIDATE_A = Object.freeze({ strategy: 'index', mcp: { tools: 'locate' } });
export const CONFIGS = Object.freeze({ 'today': {}, 'candidate-a': CANDIDATE_A });
export const REPOS = Object.freeze(['gin', 'flask', 'django', 'sigmap']);
const OUTPUTS = ['copilot', 'codex', 'claude'];
const GENERATED = ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md'];

const lines = (s) => (s.length === 0 ? 0 : s.split('\n').length - (s.endsWith('\n') ? 1 : 0));

/** A copy of the repository's committed files, without the three instruction files a person may have written. */
function archive(repoDir, dest) {
  const tar = execFileSync('git', ['-C', repoDir, 'archive', 'HEAD'], { maxBuffer: 1 << 30 });
  const r = spawnSync('tar', ['-x', '-C', dest], { input: tar });
  if (r.status !== 0) throw new Error(`cannot unpack ${repoDir}: ${String(r.stderr)}`);
  for (const rel of GENERATED) fs.rmSync(path.join(dest, rel), { force: true });
}

/**
 * What SigMap writes for one repository under one config.
 * @returns {{ codexBytes: number, claudeLines: number, copilotBytes: number, ms: number }}
 */
export function measure({ repoDir, config }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-footprint-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-codexhome-'));
  try {
    archive(repoDir, dir);
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), `${JSON.stringify({ ...config, outputs: OUTPUTS }, null, 2)}\n`);
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js')], { cwd: dir, encoding: 'utf8', env: { ...process.env, CODEX_HOME: home }, maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`gen-context failed in ${repoDir}: ${(r.stderr || r.stdout || '').slice(-400)}`);
    const read = (rel) => { const f = path.join(dir, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; };
    const agents = read('AGENTS.md'); const claude = read('CLAUDE.md'); const copilot = read('.github/copilot-instructions.md');
    if (agents === null || claude === null) throw new Error(`gen-context wrote no ${agents === null ? 'AGENTS.md' : 'CLAUDE.md'} in ${repoDir}`);
    return { codexBytes: Buffer.byteLength(agents), claudeLines: lines(claude), copilotBytes: copilot === null ? 0 : Buffer.byteLength(copilot), ms: Date.now() - t0 };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true });
  }
}

/** Is a measurement inside the registered limits? */
export function verdict(m) {
  const problems = [];
  if (m.codexBytes > LIMITS.codexBytes) problems.push(`AGENTS.md ${m.codexBytes} B > ${LIMITS.codexBytes} B`);
  if (m.claudeLines > LIMITS.claudeLines) problems.push(`CLAUDE.md ${m.claudeLines} lines > ${LIMITS.claudeLines}`);
  return problems;
}

function main(argv) {
  const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const reposDir = path.resolve(val('--repos', path.join(ROOT, 'benchmarks', 'repos')));
  const only = val('--only', null); const names = only ? only.split(',') : REPOS;
  const require = argv.includes('--require-repos');
  const rows = []; const skipped = [];
  for (const name of names) {
    const repoDir = name === 'sigmap' ? ROOT : path.join(reposDir, name);
    if (!fs.existsSync(path.join(repoDir, '.git')) && !(name === 'sigmap' && fs.existsSync(path.join(ROOT, '.git')))) { skipped.push(name); continue; }
    for (const [cfgName, config] of Object.entries(CONFIGS)) {
      const m = measure({ repoDir, config });
      rows.push({ repo: name, config: cfgName, ...m, problems: verdict(m) });
    }
  }
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify({ limits: LIMITS, rows, skipped }, null, 1)}\n`);
  else {
    console.log(`limits: AGENTS.md <= ${LIMITS.codexBytes} B (Codex), CLAUDE.md <= ${LIMITS.claudeLines} lines (Claude Code)`);
    console.log(`${'repo'.padEnd(8)} ${'config'.padEnd(12)} ${'AGENTS.md B'.padStart(12)} ${'CLAUDE.md lines'.padStart(16)} ${'copilot B'.padStart(10)} ${'s'.padStart(6)}  verdict`);
    for (const r of rows) console.log(`${r.repo.padEnd(8)} ${r.config.padEnd(12)} ${String(r.codexBytes).padStart(12)} ${String(r.claudeLines).padStart(16)} ${String(r.copilotBytes).padStart(10)} ${(r.ms / 1000).toFixed(1).padStart(6)}  ${r.problems.length ? `NOT MET: ${r.problems.join('; ')}` : 'within limits'}`);
    if (skipped.length) console.log(`SKIPPED (no clone under ${reposDir}): ${skipped.join(', ')} -- not counted as a pass`);
  }
  if (rows.length === 0 || (require && skipped.length)) { console.error(rows.length === 0 ? 'nothing could be measured' : `--require-repos: missing ${skipped.join(', ')}`); process.exit(2); }
  process.exit(rows.some((r) => r.problems.length) ? 1 : 0);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main(process.argv.slice(2));
