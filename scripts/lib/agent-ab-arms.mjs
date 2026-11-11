#!/usr/bin/env node
'use strict';

/**
 * agent-ab-arms.mjs — build the two checkouts an A/B run reads (#955).
 *
 * The question is only fair if the arms differ in one thing. So both start from
 * the SAME place: a throwaway copy of the pinned clone, hard-reset to the
 * manifest's commit and cleaned of everything untracked. That removes whatever
 * another suite or a hand-run `sigmap` left in the shared clone — `.context/`,
 * a modified CLAUDE.md, a generated config — which is exactly how the no-SigMap
 * arm could be handed the answer. Only then does the SigMap arm get what a
 * first-time user's `sigmap --adapter claude` run writes, generated the way the
 * xrepo gate generates (zero-config, plus the manifest's recorded `srcDirs`).
 *
 * The shared clone under benchmarks/repos is only ever read — including when it
 * is reached through a symlink, which is resolved before anything is copied.
 *
 * Zero dependencies.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { git, repoDir, zeroConfigEnv } from './xrepo.mjs';
import { SIGMAP_SERVER, SIGMAP_CLI, SIGMAP_VARIANTS, SKILL_VARIANTS, LEAN_SECTION, LOCATE_SKILL, LOCATE_SKILL_ALWAYS, PREFETCH_HEADER, PREFETCH_MAX_BYTES } from './agent-ab.mjs';

const require = createRequire(import.meta.url);
const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { findManagedSection } = require(path.join(CODE_ROOT, 'src/util/managed-section.js'));

/** A path, and what its realpath spells — an agent reports whichever it resolved. */
function aliases(p) {
  const out = [p];
  try { const r = fs.realpathSync(p); if (r !== p) out.push(r); } catch (_) { /* gone */ }
  return out;
}

/**
 * The copy's `.git` must be a directory of its own. Resolving the clone's path
 * makes the arm itself a real directory, but a `.git` that is a symlink (or a
 * gitfile pointing at a shared gitdir) is copied as the link it is, and `git
 * reset --hard` would then write into the repository it points at.
 */
function assertOwnGit({ dest, label }) {
  let st = null;
  try { st = fs.lstatSync(path.join(dest, '.git')); } catch (_) { /* absent: reported below */ }
  if (!st || st.isSymbolicLink() || !st.isDirectory()) {
    throw new Error(`${label}: the copy's .git is not a directory of its own, so git would write into another repository`);
  }
}

/** The MCP config JSON the SigMap arm hands the agent: the server `--setup` registers. */
export function mcpConfigFor(codeRoot) {
  return JSON.stringify({
    mcpServers: { [SIGMAP_SERVER]: { command: process.execPath, args: [path.join(codeRoot, 'gen-context.js'), '--mcp'] } },
  });
}

/**
 * The SigMap arm of a skill variant. The index is generated as in every other variant (`sigmap ask` answers from
 * `.context/`), then the generated CLAUDE.md is removed (the agent would read it by itself) and the skills are
 * written into the checkout's `.claude/skills/`, which the agent loads from `--setting-sources project`. `skill`
 * and `skill-always` write the one SKILL.md the harness owns (the same procedure under two descriptions); `skill-shipped` runs the product's own installer, so it is exactly what
 * `sigmap skills install --client claude` leaves in a repository. The arm gets the `sigmap` CLI on PATH and nothing
 * else: no MCP server, no appended section.
 */
function prepareSkillArm({ dest, prepared, variant, codeRoot, tmpRoot }) {
  fs.rmSync(path.join(dest, 'CLAUDE.md'), { force: true });
  if (variant === 'skill' || variant === 'skill-always') {
    const dir = path.join(dest, '.claude', 'skills', 'sigmap-locate');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), variant === 'skill' ? LOCATE_SKILL : LOCATE_SKILL_ALWAYS);
  } else {
    execFileSync(process.execPath, [path.join(codeRoot, 'gen-context.js'), 'skills', 'install', '--client', 'claude'], {
      cwd: dest, env: zeroConfigEnv(), stdio: ['ignore', 'ignore', 'pipe'],
    });
  }
  const missing = SKILL_VARIANTS[variant].filter((n) => !fs.existsSync(path.join(dest, '.claude', 'skills', n, 'SKILL.md')));
  if (missing.length) throw new Error(`${path.basename(dest)}: the ${variant} arm is missing its skill file(s): ${missing.join(', ')}`);
  return Object.assign(prepared, { binDir: sigmapShimDir(tmpRoot, codeRoot), skills: [...SKILL_VARIANTS[variant]] });
}

/**
 * A directory holding a `sigmap` executable that runs THIS checkout's
 * gen-context.js. The SigMap arm puts it on PATH so `sigmap ask` is the code
 * under test, never whichever release happens to be installed globally.
 *
 * @returns {string} the directory
 */
export function sigmapShimDir(tmpRoot, codeRoot = CODE_ROOT) {
  const dir = path.join(tmpRoot, 'bin');
  fs.mkdirSync(dir, { recursive: true });
  const q = (v) => `'${String(v).replace(/'/g, `'\\''`)}'`;
  fs.writeFileSync(path.join(dir, SIGMAP_CLI), `#!/bin/sh\nexec ${q(process.execPath)} ${q(path.join(codeRoot, 'gen-context.js'))} "$@"\n`, { mode: 0o755 });
  return dir;
}

/**
 * Prepare one arm of one repo.
 *
 * @param {object} p
 * @param {string} p.root data root holding benchmarks/repos
 * @param {{name:string, commit:string, srcDirs?:string[]}} p.repo manifest entry
 * @param {'without'|'with'} p.arm
 * @param {string} p.tmpRoot directory to build the copy in
 * @param {string} [p.codeRoot] checkout whose gen-context.js generates the SigMap arm
 * @param {boolean} [p.sessionAuth] the agent will run without --bare, so it would auto-discover a CLAUDE.md in the checkout: the SigMap
 *   arm's generated one is removed after its section is read, leaving the appended section as the only SigMap text
 * @param {'current'|'lean'|'index'|'skill'|'skill-shipped'} [p.variant] what the SigMap arm is told (see SIGMAP_VARIANTS); the index is the same.
 *   A skill variant hands SigMap over as skill files in the checkout and nothing else: no appended section, no MCP config.
 * @returns {{ cwd: string, cwds: string[], sigmapContext?: string, mcpConfig?: string, binDir?: string, skills?: string[] }}
 */
export function prepareArm({ root, repo, arm, tmpRoot, codeRoot = CODE_ROOT, variant = 'current', sessionAuth = false }) {
  if (!Object.prototype.hasOwnProperty.call(SIGMAP_VARIANTS, variant)) {
    throw new Error(`unknown SigMap variant "${variant}" (one of: ${Object.keys(SIGMAP_VARIANTS).join(', ')})`);
  }
  // `benchmarks/repos/<name>` may be a symlink (a worktree that borrows the shared
  // clones). `cpSync` with `verbatimSymlinks` copies a link AS a link, so the arm
  // would BE the shared clone: reset and clean would run in it, and both arms
  // would share one directory. Copy what the link points at.
  const src = fs.realpathSync(repoDir(root, repo.name));
  const dest = path.join(tmpRoot, `${repo.name}-${arm}`);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, verbatimSymlinks: true, mode: fs.constants.COPYFILE_FICLONE });
  assertOwnGit({ dest, label: `${repo.name} (${arm})` });

  const reset = git(dest, ['reset', '--hard', '--quiet', repo.commit]);
  if (!reset.ok) throw new Error(`${repo.name}: cannot reset the copy to ${repo.commit}: ${reset.err}`);
  const clean = git(dest, ['clean', '-ffdxq']);
  if (!clean.ok) throw new Error(`${repo.name}: cannot clean the copy: ${clean.err}`);
  const status = git(dest, ['status', '--porcelain']);
  if (!status.ok || status.out) throw new Error(`${repo.name}: the copy is not clean at ${repo.commit}`);

  const prepared = { cwd: dest, cwds: aliases(dest) };
  if (arm === 'without') return prepared;

  const cfg = path.join(dest, 'gen-context.config.json');
  const config = {};
  if (repo.srcDirs) config.srcDirs = repo.srcDirs;
  // The MCP server reads its tool profile from the config in the directory it runs in, so the
  // lean arm's 7-tool profile is set here and nowhere else. The index it answers from is unchanged.
  if (variant === 'lean' || variant === 'index') config.mcp = { tools: 'core' };
  // `index` is the docs' own setup for an agent that calls the tools: an always-on map instead of a
  // signature dump. The index the tools answer from is written before the strategy split and is
  // byte-identical (retrieval is the same under every strategy; checked on the pilot's questions).
  if (variant === 'index') config.strategy = 'index';
  if (Object.keys(config).length) fs.writeFileSync(cfg, JSON.stringify(config, null, 2) + '\n');
  execFileSync(process.execPath, [path.join(codeRoot, 'gen-context.js'), '--adapter', 'claude'], {
    cwd: dest, env: zeroConfigEnv(), stdio: ['ignore', 'ignore', 'pipe'],
  });
  if (SKILL_VARIANTS[variant]) return prepareSkillArm({ dest, prepared, variant, codeRoot, tmpRoot });
  if (variant === 'prefetch') {
    // The index is all this arm keeps: the ranking is computed per question (`prefetchContext`) and rides in the prompt.
    fs.rmSync(path.join(dest, 'CLAUDE.md'), { force: true });
    return Object.assign(prepared, { binDir: sigmapShimDir(tmpRoot, codeRoot), prefetch: true });
  }
  const claudeMd = fs.readFileSync(path.join(dest, 'CLAUDE.md'), 'utf8');
  const section = findManagedSection(claudeMd);
  if (!section) throw new Error(`${repo.name}: \`gen-context --adapter claude\` wrote no SigMap section`);
  // Without --bare the agent reads a CLAUDE.md in its working directory by itself. The section is already in
  // `sigmapContext` and goes in through --append-system-prompt; leaving the file would hand it over twice.
  if (sessionAuth) fs.rmSync(path.join(dest, 'CLAUDE.md'), { force: true });
  const shim = sigmapShimDir(tmpRoot, codeRoot);
  return Object.assign(prepared, {
    // The generated section is still produced and checked above (a run that cannot generate one
    // is a broken arm); the lean arm just does not hand it to the agent.
    sigmapContext: variant === 'lean' ? LEAN_SECTION : claudeMd.slice(section.index).trim(),
    mcpConfig: mcpConfigFor(codeRoot),
    binDir: shim,
  });
}

/**
 * Prove the SigMap arm's MCP server answers in its prepared checkout: initialise,
 * list tools, read the count. It costs no model call, and it catches a broken arm
 * before the first paid run rather than as a failed integrity check after it.
 *
 * @returns {{ ok: boolean, tools: number, error: string|null }}
 */
export function probeMcp({ cwd, codeRoot = CODE_ROOT, timeoutMs = 30000 }) {
  const input = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'agent-ab-probe', version: '1' } } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ].map((m) => JSON.stringify(m)).join('\n') + '\n';
  const r = spawnSync(process.execPath, [path.join(codeRoot, 'gen-context.js'), '--mcp'], { cwd, input, encoding: 'utf8', timeout: timeoutMs });
  if (r.error) return { ok: false, tools: 0, error: r.error.message };
  for (const line of (r.stdout || '').split('\n')) {
    let m;
    try { m = JSON.parse(line); } catch (_) { continue; }
    if (m && m.id === 2 && m.result && Array.isArray(m.result.tools)) {
      return { ok: m.result.tools.length > 0, tools: m.result.tools.length, error: m.result.tools.length ? null : 'the server lists no tools' };
    }
  }
  return { ok: false, tools: 0, error: 'the server did not answer tools/list' };
}

/**
 * Prove the CLI a skill arm relies on answers in its prepared checkout: `sigmap ask` through the arm's own shim must
 * exit 0 and name at least one file. Like `probeMcp` it costs no model call and fails before the first paid run.
 *
 * @returns {{ ok: boolean, error: string|null }}
 */
export function probeCli({ cwd, binDir, timeoutMs = 60000 }) {
  const r = spawnSync(path.join(binDir, SIGMAP_CLI), ['ask', 'where is the main entry point defined'], { cwd, encoding: 'utf8', timeout: timeoutMs });
  if (r.error) return { ok: false, error: r.error.message };
  if (r.status !== 0) return { ok: false, error: `exit ${r.status}: ${(r.stderr || '').trim().slice(0, 200)}` };
  return /\S/.test(r.stdout || '') ? { ok: true, error: null } : { ok: false, error: 'sigmap ask printed nothing' };
}

/**
 * What a prompt hook would put in front of the agent for one question: `sigmap ask "<question>"` run in the arm's checkout
 * through the arm's own shim, before any model call. The ranking it prints, then the signatures and line anchors it writes
 * to `.context/query-context.md`, under PREFETCH_HEADER, cut at a section boundary to stay under PREFETCH_MAX_BYTES.
 * Deterministic for a given checkout and question, so both repetitions of a question carry the same text.
 *
 * @returns {string}
 */
export function prefetchContext({ cwd, binDir, query, timeoutMs = 60000, maxBytes = PREFETCH_MAX_BYTES }) {
  const out = path.join(cwd, '.context', 'query-context.md');
  fs.rmSync(out, { force: true });
  const r = spawnSync(path.join(binDir, SIGMAP_CLI), ['ask', String(query)], { cwd, encoding: 'utf8', timeout: timeoutMs });
  if (r.error || r.status !== 0) throw new Error(`sigmap ask failed for the prefetch arm: ${r.error ? r.error.message : `exit ${r.status}: ${(r.stderr || '').trim().slice(0, 200)}`}`);
  const ranking = (r.stdout || '').trim();
  if (!ranking) throw new Error('sigmap ask printed no ranking for the prefetch arm');
  let body = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/^# SigMap Query Context\n(?:Generated: .*\n)?/, '').trim() : '';
  const head = `${PREFETCH_HEADER}\n\n${ranking}\n`;
  const room = maxBytes - Buffer.byteLength(head) - 2;
  if (Buffer.byteLength(body) > room) {
    // Keep whole file sections, best-ranked first; say what was left out so the agent knows the list above is longer.
    const sections = body.split(/\n(?=## )/);
    let kept = '';
    for (const s of sections) { if (Buffer.byteLength(kept) + Buffer.byteLength(s) + 1 > room - 60) break; kept += (kept ? '\n' : '') + s; }
    body = `${kept}\n\n(signatures of the lower-ranked files left out to keep this short)`.trim();
  }
  return body ? `${head}\n${body}\n` : head;
}
