'use strict';

/**
 * scip-toolchains.mjs — the SCIP indexers of the call-graph accuracy benchmark (#976): how each
 * is installed into a scratch directory and how each is run. Nothing is installed system-wide,
 * and every download is checked against a checksum before it is unpacked.
 *
 * Wave 1 (scip-typescript, scip-python) are npm packages. Wave 2 needs a toolchain:
 *   go    the Go toolchain from go.dev, then `go install` of scip-go at its pinned version
 *   java  a Temurin JDK from Adoptium and the coursier launcher, then a bootstrapped scip-java
 *
 * `indexerCommand` is a pure function so the tests can check what would run without running it.
 *
 * Dev-only. Nothing here ships in the npm package.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';

export const WAVE2_FILE = 'wave2.json';

/** Platforms the setup knows how to fetch for. Others are reported, not guessed. */
const PLATFORMS = {
  'darwin-arm64': { go: 'darwin-arm64', adoptium: { os: 'mac', arch: 'aarch64' }, coursier: 'cs-aarch64-apple-darwin.gz', home: (jdk) => path.join(jdk, 'Contents', 'Home') },
  'linux-x64': { go: 'linux-amd64', adoptium: { os: 'linux', arch: 'x64' }, coursier: 'cs-x86_64-pc-linux.gz', home: (jdk) => jdk },
};

export const platformKey = () => `${process.platform}-${process.arch}`;

function run(cmd, argv, options = {}) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
  return { ok: r.status === 0 && !r.error, status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** Download `url`, refuse it unless its sha256 is `expect`, and write it to `dest`. */
async function download(url, expect, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (expect && got !== expect) throw new Error(`${url}: sha256 ${got} is not the published ${expect}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return got;
}

async function json(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const fresh = (dir) => { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); return dir; };
const tool = (cmd, argv, options) => { const r = run(cmd, argv, options); if (!r.ok) throw new Error(`${cmd} ${argv.slice(0, 2).join(' ')} failed: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' | ')}`); return r; };

/** The environment that makes a Go installation in `home` the only one a command sees. */
export function goEnv(home, base = process.env) {
  const goroot = path.join(home, 'go', 'goroot');
  return {
    ...base,
    GOROOT: goroot,
    GOPATH: path.join(home, 'go', 'gopath'),
    GOBIN: path.join(home, 'go', 'bin'),
    GOCACHE: path.join(home, 'go', 'cache'),
    GOTOOLCHAIN: 'local',
    PATH: `${path.join(goroot, 'bin')}${path.delimiter}${base.PATH || ''}`,
  };
}

/** The environment that makes a JDK in `javaHome` the only one a command sees. */
export function javaEnv(home, javaHome, base = process.env) {
  return {
    ...base,
    JAVA_HOME: javaHome,
    PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${base.PATH || ''}`,
    COURSIER_CACHE: path.join(home, 'java', 'coursier-cache'),
    MAVEN_OPTS: `-Dmaven.repo.local=${path.join(home, 'java', 'm2')}`,
    // a project's own Maven wrapper downloads its Maven distribution here, not into ~/.m2
    MAVEN_USER_HOME: path.join(home, 'java', 'maven-user'),
  };
}

/**
 * Install the Go toolchain and scip-go (protocol.indexers.go) under `home/go`.
 * @returns {Promise<{ bin: string, goVersion: string, scipGoVersion: string }>}
 */
export async function setupGo(home, protocol) {
  const spec = protocol.indexers.go;
  const plat = PLATFORMS[platformKey()];
  if (!plat) throw new Error(`no Go setup for ${platformKey()}`);
  const version = `go${spec.toolchain.go}`;
  const dl = fresh(path.join(home, 'go', 'download'));
  const listing = await json('https://go.dev/dl/?mode=json&include=all');
  const rel = listing.find((r) => r.version === version);
  const file = rel && rel.files.find((f) => f.os === process.platform && f.arch === (process.arch === 'x64' ? 'amd64' : process.arch) && f.kind === 'archive');
  if (!file) throw new Error(`go.dev lists no ${version} archive for ${platformKey()}`);
  const archive = path.join(dl, file.filename);
  await download(`https://go.dev/dl/${file.filename}`, file.sha256, archive);
  const goroot = path.join(home, 'go', 'goroot');
  fresh(goroot);
  tool('tar', ['-xzf', archive, '-C', goroot, '--strip-components=1']);
  fs.rmSync(dl, { recursive: true, force: true });
  const env = goEnv(home);
  fs.mkdirSync(env.GOPATH, { recursive: true });
  fs.mkdirSync(env.GOBIN, { recursive: true });
  const got = tool(path.join(goroot, 'bin', 'go'), ['version'], { env }).stdout.trim();
  if (!got.includes(version)) throw new Error(`expected ${version}, found ${got}`);
  tool(path.join(goroot, 'bin', 'go'), ['install', `${spec.package}/cmd/scip-go@v${spec.version}`], { env });
  const bin = path.join(env.GOBIN, 'scip-go');
  const reported = tool(bin, ['--version'], { env }).stdout.trim();
  if (reported !== spec.version) throw new Error(`scip-go reports ${reported}, the protocol pins ${spec.version}`);
  return { bin, goVersion: spec.toolchain.go, scipGoVersion: reported };
}

/**
 * Install a Temurin JDK, coursier and scip-java (protocol.indexers.java) under `home/java`.
 * @returns {Promise<{ bin: string, javaHome: string, jdk: string, scipJavaVersion: string }>}
 */
export async function setupJava(home, protocol) {
  const spec = protocol.indexers.java;
  const plat = PLATFORMS[platformKey()];
  if (!plat) throw new Error(`no Java setup for ${platformKey()}`);
  const dl = fresh(path.join(home, 'java', 'download'));

  const release = `jdk-${spec.toolchain.jdk}`;
  const assets = await json(`https://api.adoptium.net/v3/assets/release_name/eclipse/${encodeURIComponent(release)}?architecture=${plat.adoptium.arch}&image_type=jdk&os=${plat.adoptium.os}&project=jdk`);
  // The release-name endpoint answers with one release holding `binaries`; the latest-release
  // endpoint answers with a list of releases each holding one `binary`. Take either.
  const rel = Array.isArray(assets) ? assets[0] : assets;
  const found = rel && (rel.binary || (rel.binaries || []).find((b) => b.image_type === 'jdk' && b.os === plat.adoptium.os && b.architecture === plat.adoptium.arch));
  const pkg = found && found.package;
  if (!pkg) throw new Error(`Adoptium lists no ${release} for ${platformKey()}`);
  const jdkArchive = path.join(dl, pkg.name);
  await download(pkg.link, pkg.checksum, jdkArchive);
  const jdkDir = fresh(path.join(home, 'java', 'jdk'));
  tool('tar', ['-xzf', jdkArchive, '-C', jdkDir, '--strip-components=1']);
  const javaHome = plat.home(jdkDir);
  const env = javaEnv(home, javaHome);
  const reported = tool(path.join(javaHome, 'bin', 'java'), ['-version'], { env }).stderr;
  if (!reported.includes(spec.toolchain.jdk.split('+')[0])) throw new Error(`expected JDK ${spec.toolchain.jdk}, found ${reported.split('\n')[0]}`);

  const csGz = path.join(dl, 'cs.gz');
  const expected = (spec.toolchain.coursierSha256 || {})[platformKey()];
  const csSha = await download(`https://github.com/coursier/coursier/releases/download/v${spec.toolchain.coursier}/${plat.coursier}`, expected, csGz);
  const cs = path.join(home, 'java', 'cs');
  fs.writeFileSync(cs, zlib.gunzipSync(fs.readFileSync(csGz)), { mode: 0o755 });
  fs.mkdirSync(env.COURSIER_CACHE, { recursive: true });
  const bin = path.join(home, 'java', 'scip-java');
  tool(cs, ['bootstrap', '--standalone', '-o', bin, `${spec.package}:${spec.version}`, '--main', 'com.sourcegraph.scip_java.ScipJava'], { env });
  const v = tool(bin, ['--version'], { env }).stdout.trim();
  if (v !== spec.version) throw new Error(`scip-java reports ${v}, the protocol pins ${spec.version}`);
  fs.rmSync(dl, { recursive: true, force: true });
  return { bin, javaHome, jdk: spec.toolchain.jdk, scipJavaVersion: v, coursierSha256: csSha };
}

/** The first line of `mvn -version` under the Java installation in `home`, or null. */
export function mavenVersion(home, javaHome) {
  const r = run('mvn', ['-version'], { env: javaEnv(home, javaHome) });
  return r.ok ? r.stdout.split('\n')[0].trim() : null;
}

export function readWave2(home) {
  try { return JSON.parse(fs.readFileSync(path.join(home, WAVE2_FILE), 'utf8')); } catch { return null; }
}

export function writeWave2(home, record) {
  const old = readWave2(home) || {};
  fs.writeFileSync(path.join(home, WAVE2_FILE), `${JSON.stringify({ ...old, ...record, platform: platformKey() }, null, 2)}\n`);
}

/**
 * The tools of a wave-2 language, or the reason there are none: they must have been installed
 * into `home` at the versions the protocol pins.
 */
export function wave2Tools(key, home, protocol) {
  const spec = protocol.indexers[key];
  const rec = home ? readWave2(home) : null;
  const mine = rec && rec[key];
  if (!home) return { reason: `no --indexers directory (run --setup-indexers <dir> --with ${key} first)` };
  if (!mine) return { reason: `${key} is not set up in ${home} (run --setup-indexers <dir> --with ${key})` };
  const have = key === 'go' ? [mine.goVersion, mine.scipGoVersion] : [mine.jdk, mine.scipJavaVersion];
  const want = key === 'go' ? [spec.toolchain.go, spec.version] : [spec.toolchain.jdk, spec.version];
  if (have[0] !== want[0] || have[1] !== want[1]) return { reason: `${key} is ${have.join(' / ')} in ${home}, the protocol pins ${want.join(' / ')}` };
  if (!fs.existsSync(mine.bin)) return { reason: `${mine.bin} is missing` };
  return { tools: mine };
}

/**
 * What to run to index one tree (protocol, indexers).
 * @returns {{ bin: string, argv: string[], env: object }}
 */
export function indexerCommand({ key, spec, tools, home, repo, scip, tmp, heapMb, base = process.env }) {
  if (key === 'typescript') {
    return { bin: tools.bin, argv: ['index', '--no-progress-bar', '--output', scip], env: { ...base, TMPDIR: tmp, NODE_OPTIONS: base.NODE_OPTIONS || `--max-old-space-size=${heapMb}` } };
  }
  if (key === 'python') {
    return { bin: tools.bin, argv: ['index', '.', '--project-name', repo.name, '--project-version', repo.commit.slice(0, 7), '--output', scip, '--quiet'], env: { ...base, TMPDIR: tmp, NODE_OPTIONS: base.NODE_OPTIONS || `--max-old-space-size=${heapMb}` } };
  }
  if (key === 'go') {
    return { bin: tools.bin, argv: ['--output', scip], env: { ...goEnv(home, base), TMPDIR: tmp } };
  }
  if (key === 'java') {
    return { bin: tools.bin, argv: ['index', '--build-tool', spec.toolchain.buildTool, '--output', scip], env: { ...javaEnv(home, tools.javaHome, base), TMPDIR: tmp } };
  }
  throw new Error(`no indexer command for ${key}`);
}
