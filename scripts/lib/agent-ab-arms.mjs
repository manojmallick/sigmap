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
 * The shared clone under benchmarks/repos is only ever read.
 *
 * Zero dependencies.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { git, repoDir, zeroConfigEnv } from './xrepo.mjs';
import { SIGMAP_SERVER, SIGMAP_CLI } from './agent-ab.mjs';

const require = createRequire(import.meta.url);
const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { findManagedSection } = require(path.join(CODE_ROOT, 'src/util/managed-section.js'));

/** A path, and what its realpath spells — an agent reports whichever it resolved. */
function aliases(p) {
  const out = [p];
  try { const r = fs.realpathSync(p); if (r !== p) out.push(r); } catch (_) { /* gone */ }
  return out;
}

/** The MCP config JSON the SigMap arm hands the agent: the server `--setup` registers. */
export function mcpConfigFor(codeRoot) {
  return JSON.stringify({
    mcpServers: { [SIGMAP_SERVER]: { command: process.execPath, args: [path.join(codeRoot, 'gen-context.js'), '--mcp'] } },
  });
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
 * @returns {{ cwd: string, cwds: string[], sigmapContext?: string, mcpConfig?: string, binDir?: string }}
 */
export function prepareArm({ root, repo, arm, tmpRoot, codeRoot = CODE_ROOT }) {
  const src = repoDir(root, repo.name);
  const dest = path.join(tmpRoot, `${repo.name}-${arm}`);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, verbatimSymlinks: true, mode: fs.constants.COPYFILE_FICLONE });

  const reset = git(dest, ['reset', '--hard', '--quiet', repo.commit]);
  if (!reset.ok) throw new Error(`${repo.name}: cannot reset the copy to ${repo.commit}: ${reset.err}`);
  const clean = git(dest, ['clean', '-ffdxq']);
  if (!clean.ok) throw new Error(`${repo.name}: cannot clean the copy: ${clean.err}`);
  const status = git(dest, ['status', '--porcelain']);
  if (!status.ok || status.out) throw new Error(`${repo.name}: the copy is not clean at ${repo.commit}`);

  const prepared = { cwd: dest, cwds: aliases(dest) };
  if (arm === 'without') return prepared;

  const cfg = path.join(dest, 'gen-context.config.json');
  if (repo.srcDirs) fs.writeFileSync(cfg, JSON.stringify({ srcDirs: repo.srcDirs }, null, 2) + '\n');
  execFileSync(process.execPath, [path.join(codeRoot, 'gen-context.js'), '--adapter', 'claude'], {
    cwd: dest, env: zeroConfigEnv(), stdio: ['ignore', 'ignore', 'pipe'],
  });
  const claudeMd = fs.readFileSync(path.join(dest, 'CLAUDE.md'), 'utf8');
  const section = findManagedSection(claudeMd);
  if (!section) throw new Error(`${repo.name}: \`gen-context --adapter claude\` wrote no SigMap section`);
  const shim = sigmapShimDir(tmpRoot, codeRoot);
  return Object.assign(prepared, {
    sigmapContext: claudeMd.slice(section.index).trim(),
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
