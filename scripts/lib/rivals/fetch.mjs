#!/usr/bin/env node
'use strict';

/**
 * fetch.mjs — getting a rival's artifact onto this machine, and refusing to run one that is not the
 * one benchmarks/rivals.json pins (#972).
 *
 * A downloaded binary is untrusted. Nothing here installs it anywhere but a self-ignoring directory
 * (benchmarks/rivals/, or $SIGMAP_RIVALS_DIR), and every artifact is hashed and compared with the SHA-256
 * pinned in the manifest BEFORE it is unpacked or run; a mismatch throws and leaves nothing behind that a
 * later run would pick up. The runner gives every rival a scratch HOME.
 *
 * Zero-dependency; Node built-ins only. The network and the process runner are injectable, so the tests
 * run it without either.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const MANIFEST = path.join(CODE_ROOT, 'benchmarks', 'rivals.json');

/** The parsed manifest. */
export function loadRivals(file = MANIFEST) {
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!m || typeof m.tools !== 'object') throw new Error(`${file}: "tools" must be an object`);
  return m;
}

/** Where rivals live: a directory that ignores itself, so nothing in it can reach git. */
export function rivalsDir(root = process.env.SIGMAP_RIVALS_DIR || path.join(CODE_ROOT, 'benchmarks', 'rivals')) {
  fs.mkdirSync(root, { recursive: true });
  const ignore = path.join(root, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
  return root;
}

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** This machine, as the manifest names platforms: darwin-arm64, darwin-x64, linux-x64, linux-arm64. */
export function platformId(p = process.platform, a = process.arch) {
  return `${p}-${a}`;
}

/**
 * Throw unless `buf` is the artifact the manifest pins.
 * @param {Buffer} buf
 * @param {string} want  pinned hex SHA-256
 * @param {string} what  a name for the message
 */
export function assertPinned(buf, want, what) {
  const got = sha256(buf);
  if (got !== String(want).toLowerCase()) {
    throw new Error(`${what}: SHA-256 ${got} is not the pinned ${want}; refusing to use it`);
  }
  return got;
}

/** The SHA-256 a release's published checksums.txt gives for a file, or null. */
export function checksumFor(checksumsText, file) {
  for (const line of String(checksumsText).split('\n')) {
    const m = /^([0-9a-f]{64})\s+\*?(\S+)\s*$/i.exec(line.trim());
    if (m && m[2] === file) return m[1].toLowerCase();
  }
  return null;
}

async function defaultDownload(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * codebase-memory-mcp: a self-contained native executable in a tarball.
 * Downloads it, checks it against the pin AND the release's own checksums.txt, unpacks it, and
 * returns the binary's path. Idempotent: an unpacked, runnable binary of the pinned version is reused.
 *
 * @returns {Promise<{ bin: string, version: string, sha256: string, installMs: number, reused: boolean }>}
 */
export async function ensureCbm(tool, { dir = rivalsDir(), platform = platformId(), download = defaultDownload, run = spawnSync } = {}) {
  const art = tool.artifacts && tool.artifacts[platform];
  if (!art) throw new Error(`codebase-memory-mcp ${tool.version}: no pinned artifact for ${platform} (pinned: ${Object.keys(tool.artifacts || {}).join(', ')})`);
  const root = path.join(dir, 'codebase-memory-mcp', tool.tag);
  const bin = path.join(root, tool.binary || 'codebase-memory-mcp');
  const t0 = Date.now();
  if (fs.existsSync(bin)) {
    const v = run(bin, ['--version'], { encoding: 'utf8' });
    if (v.status === 0 && String(v.stdout).includes(tool.version)) return { bin, version: tool.version, sha256: art.sha256, installMs: 0, reused: true };
  }
  const tarball = await download(`${tool.repository}/releases/download/${tool.tag}/${art.file}`);
  assertPinned(tarball, art.sha256, art.file);
  // The release's own list must agree with the pin: a pin that was copied wrong is caught as well.
  if (tool.checksumsUrl) {
    const published = checksumFor((await download(tool.checksumsUrl)).toString('utf8'), art.file);
    if (published !== art.sha256.toLowerCase()) throw new Error(`${art.file}: the release's checksums.txt says ${published}, the pin says ${art.sha256}`);
  }
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const tgz = path.join(root, art.file);
  fs.writeFileSync(tgz, tarball);
  const x = run('tar', ['-xzf', tgz, '-C', root], { encoding: 'utf8' });
  if (x.status !== 0) throw new Error(`could not unpack ${art.file}: ${x.stderr || x.error}`);
  fs.rmSync(tgz, { force: true });
  fs.chmodSync(bin, 0o755);
  const v = run(bin, ['--version'], { encoding: 'utf8' });
  if (v.status !== 0 || !String(v.stdout).includes(tool.version)) throw new Error(`${bin} --version did not report ${tool.version}: ${v.stdout || v.stderr}`);
  return { bin, version: tool.version, sha256: art.sha256, installMs: Date.now() - t0, reused: false };
}

/**
 * Find a Python that satisfies the manifest's requirement (">=3.10"): $SIGMAP_RIVALS_PYTHON, then python3.14 .. python3.10.
 */
export function findPython(min = [3, 10], { run = spawnSync, env = process.env } = {}) {
  const candidates = [env.SIGMAP_RIVALS_PYTHON, 'python3.14', 'python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3'].filter(Boolean);
  for (const c of candidates) {
    const r = run(c, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' });
    if (r.status !== 0) continue;
    const [maj, mnr] = String(r.stdout).trim().split('.').map(Number);
    if (maj > min[0] || (maj === min[0] && mnr >= min[1])) return c;
  }
  return null;
}

/**
 * code-review-graph: a PyPI wheel into its own venv. `pip download --no-deps` fetches the wheel, the
 * wheel is checked against the pin, and only then installed (its dependencies resolve from PyPI as
 * pip always does; `pip freeze` is returned so the report records what they were).
 *
 * @returns {{ bin: string, version: string, sha256: string, installMs: number, reused: boolean, freeze: string }}
 */
export function ensureCrg(tool, { dir = rivalsDir(), run = spawnSync, python = findPython(undefined, { run }) } = {}) {
  const root = path.join(dir, 'code-review-graph', tool.tag);
  const bin = path.join(root, 'venv', 'bin', 'code-review-graph');
  const t0 = Date.now();
  const pip = path.join(root, 'venv', 'bin', 'python');
  if (fs.existsSync(bin)) {
    const v = run(bin, ['--version'], { encoding: 'utf8' });
    if (v.status === 0 && String(v.stdout + v.stderr).includes(tool.version)) {
      const fz = run(pip, ['-m', 'pip', 'freeze'], { encoding: 'utf8' });
      return { bin, version: tool.version, sha256: tool.wheel.sha256, installMs: 0, reused: true, freeze: String(fz.stdout || '') };
    }
  }
  if (!python) throw new Error(`code-review-graph ${tool.version} needs Python ${tool.python}; none found (set SIGMAP_RIVALS_PYTHON)`);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'dl'), { recursive: true });
  let r = run(python, ['-m', 'venv', path.join(root, 'venv')], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`venv failed: ${r.stderr}`);
  r = run(pip, ['-m', 'pip', 'download', `code-review-graph==${tool.version}`, '--no-deps', '-d', path.join(root, 'dl'), '-q'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`pip download failed: ${r.stderr}`);
  const wheel = path.join(root, 'dl', tool.wheel.file);
  if (!fs.existsSync(wheel)) throw new Error(`pip did not fetch ${tool.wheel.file}`);
  assertPinned(fs.readFileSync(wheel), tool.wheel.sha256, tool.wheel.file);
  r = run(pip, ['-m', 'pip', 'install', '-q', wheel], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`pip install failed: ${r.stderr}`);
  const fz = run(pip, ['-m', 'pip', 'freeze'], { encoding: 'utf8' });
  return { bin, version: tool.version, sha256: tool.wheel.sha256, installMs: Date.now() - t0, reused: false, freeze: String(fz.stdout || '') };
}
