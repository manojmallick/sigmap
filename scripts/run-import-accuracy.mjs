#!/usr/bin/env node
/**
 * Import-resolver accuracy: how often do the import graph's file-to-file edges agree with what a
 * language's own tooling reports? (#980)
 *
 *   node scripts/run-import-accuracy.mjs --setup-references <dir>        # install the pinned reference tools into <dir>
 *   node scripts/run-import-accuracy.mjs --references <dir>              # score every registered repository
 *   node scripts/run-import-accuracy.mjs --references <dir> --save       # also write benchmarks/reports/import-accuracy.json
 *   node scripts/run-import-accuracy.mjs --references <dir> --only c,libuv --misses 5
 *   node scripts/run-import-accuracy.mjs --dev <group> --tree <dir> --references <dir>   # score one tree; not a registered run
 *   node scripts/run-import-accuracy.mjs --write-doc                     # re-render the tables of the guide page from the saved report
 *
 * The method is benchmarks/IMPORT_RESOLVER_PROTOCOL.md, the numbers in
 * benchmarks/import-resolver-protocol.json, committed before the first registered run. Each
 * registered repository is exported at its pinned commit into a scratch tree (the pinned clones
 * are only read); the graph is built on that pristine tree, and the reference runs on a second
 * copy, because a reference tool may write into the tree it runs in (Composer writes vendor/).
 *
 * HONESTY RULES: a repository whose reference cannot run is reported "unmeasured" with the reason
 * and is never replaced. `--save` refuses a partial run, a protocol that differs from the committed
 * one, and a dirty scored tree.
 *
 * Dev-only. Nothing here ships in the npm package.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  SCHEMA, PROTOCOL_REL, loadProtocol, protocolState, compareImports, tableOf, sumCounts, formatGroup, swiftModuleEdges,
} from './lib/import-accuracy.mjs';
import { stamp } from './lib/report-stamp.mjs';
import { renderBlock, inject } from './lib/import-accuracy-doc.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
export const REPORT_REL = 'benchmarks/reports/import-accuracy.json';
export const PAGE_REL = 'docs-vp/guide/import-accuracy.md';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};

function run(cmd, argv, options = {}) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
  return { ok: r.status === 0 && !r.error, status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
const tail = (t, n = 4) => t.trim().split('\n').slice(-n).join(' | ').slice(0, 400);

// ── the groups ───────────────────────────────────────────────────────────────

const families = Object.fromEntries(require(path.join(ROOT, 'src/graph/import-resolvers.js')).FAMILIES.map((f) => [f.name, f]));
/** Importing-file extensions of each group. */
const EXTS = { c: families['C/C++/Objective-C'].EXTS, php: families.PHP.EXTS, sfc: families['Vue/Svelte/Astro'].EXTS, swift: new Set(['.swift']) };
const ADAPTERS = {
  c: () => import('./import-accuracy/c.mjs'),
  php: () => import('./import-accuracy/php.mjs'),
  sfc: () => import('./import-accuracy/sfc.mjs'),
  swift: () => import('./import-accuracy/swift.mjs'),
};

// ── reference tools ──────────────────────────────────────────────────────────

async function download(url, expect, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = crypto.createHash('sha256').update(buf).digest('hex');
  if (expect && got !== expect) throw new Error(`${url}: sha256 ${got} is not the pinned ${expect}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return got;
}

/** Install the pinned reference tools into `dir`. */
async function setupReferences(dir, protocol) {
  const t = protocol.tools;
  fs.mkdirSync(dir, { recursive: true });
  const specs = Object.entries(t.npm).map(([name, version]) => `${name}@${version}`);
  const npm = run('npm', ['install', '--prefix', dir, '--ignore-scripts', '--no-audit', '--no-fund', ...specs]);
  if (!npm.ok) { console.error(`[import-accuracy] npm install failed: ${tail(npm.stderr)}`); return 1; }
  const record = { npm: t.npm };
  const plat = `${process.platform}-${process.arch}`;
  const php = t.php;
  if (php && php.archives[plat]) {
    try {
      const a = php.archives[plat];
      const tarball = path.join(dir, 'php-download', path.basename(a.url));
      fs.rmSync(path.join(dir, 'php'), { recursive: true, force: true });
      fs.mkdirSync(path.join(dir, 'php'), { recursive: true });
      await download(a.url, a.sha256, tarball);
      const x = run('tar', ['-xzf', tarball, '-C', path.join(dir, 'php')]);
      if (!x.ok) throw new Error(`tar failed: ${tail(x.stderr)}`);
      const composer = path.join(dir, 'php', 'composer.phar');
      await download(php.composer.url, php.composer.sha256, composer);
      const v = run(path.join(dir, 'php', 'php'), ['--version']);
      if (!v.ok || !v.stdout.includes(php.version)) throw new Error(`expected PHP ${php.version}, found ${v.stdout.split('\n')[0]}`);
      fs.rmSync(path.join(dir, 'php-download'), { recursive: true, force: true });
      record.php = { php: path.join(dir, 'php', 'php'), composer, version: php.version, composerVersion: php.composer.version };
      console.log(`[import-accuracy] PHP ${php.version}, Composer ${php.composer.version} in ${dir}`);
    } catch (e) {
      console.error(`[import-accuracy] php setup failed: ${e.message}`);
      return 1;
    }
  } else {
    console.error(`[import-accuracy] no PHP archive pinned for ${plat}: the PHP reference will be unmeasured`);
  }
  fs.writeFileSync(path.join(dir, 'references.json'), `${JSON.stringify(record, null, 2)}\n`);
  for (const [name, version] of Object.entries(t.npm)) console.log(`[import-accuracy] ${name}@${version} in ${dir}`);
  return 0;
}

/** The tools of a group, or the reason there are none. */
function toolsFor(group, dir, protocol) {
  const need = protocol.groups[group].reference;
  if (!need) return { reason: protocol.groups[group].unmeasured || 'no reference registered' };
  if (group === 'c') {
    const v = run(need.compiler, ['--version']);
    if (!v.ok) return { reason: `${need.compiler} cannot run` };
    return { tools: { compiler: need.compiler, version: v.stdout.split('\n')[0] } };
  }
  if (group === 'swift') {
    const v = run(need.swift, ['--version']);
    return v.ok ? { tools: { version: v.stdout.split('\n')[0] } } : { reason: `${need.swift} cannot run` };
  }
  if (!dir) return { reason: 'no --references directory (run --setup-references <dir> first)' };
  let rec;
  try { rec = JSON.parse(fs.readFileSync(path.join(dir, 'references.json'), 'utf8')); } catch (_) { return { reason: `${dir} holds no references.json (run --setup-references)` }; }
  for (const [name, version] of Object.entries(protocol.tools.npm)) {
    let have = null;
    try { have = JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', name, 'package.json'), 'utf8')).version; } catch (_) { /* absent */ }
    if (group === 'sfc' && have !== version) return { reason: `${name} is ${have || 'not installed'} in ${dir}, the protocol pins ${version}` };
  }
  if (group === 'php') {
    if (!rec.php || !fs.existsSync(rec.php.php)) return { reason: `PHP is not installed in ${dir} (no archive pinned for ${process.platform}-${process.arch}, or setup failed)` };
    if (rec.php.version !== protocol.tools.php.version) return { reason: `PHP is ${rec.php.version} in ${dir}, the protocol pins ${protocol.tools.php.version}` };
    return { tools: { php: rec.php.php, composer: rec.php.composer, version: `PHP ${rec.php.version}, Composer ${rec.php.composerVersion}` } };
  }
  return { tools: { dir, version: `typescript ${protocol.tools.npm.typescript}, @vue/compiler-sfc ${protocol.tools.npm['@vue/compiler-sfc']}, svelte ${protocol.tools.npm.svelte}, @astrojs/compiler ${protocol.tools.npm['@astrojs/compiler']}` } };
}

// ── repository trees ─────────────────────────────────────────────────────────

const inside = (dir, child) => { const r = path.relative(dir, child); return r !== '' && !r.startsWith('..') && !path.isAbsolute(r); };

/** Export the pinned commit into `tree`: `git archive`, or the tracked files present on disk for a sparse checkout. */
function exportTree(clone, repo, tree, work) {
  if (!inside(work, tree)) return `refusing to write outside the work directory: ${tree}`;
  const marker = path.join(tree, '.import-accuracy-export');
  if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim() === repo.commit) return null;
  fs.rmSync(tree, { recursive: true, force: true });
  fs.mkdirSync(tree, { recursive: true });
  if (repo.sparse) {
    const ls = run('git', ['-C', clone, 'ls-files', '-z'], { maxBuffer: 1 << 28 });
    if (!ls.ok) return `git ls-files failed: ${tail(ls.stderr)}`;
    for (const rel of ls.stdout.split('\0').filter(Boolean)) {
      const src = path.join(clone, rel);
      if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;
      fs.mkdirSync(path.dirname(path.join(tree, rel)), { recursive: true });
      fs.copyFileSync(src, path.join(tree, rel));
    }
  } else {
    const tarFile = `${tree}.tar`;
    const a = run('git', ['-C', clone, 'archive', '--format=tar', '-o', tarFile, repo.commit]);
    if (!a.ok) return `git archive failed: ${tail(a.stderr)}`;
    const x = run('tar', ['-xf', tarFile, '-C', tree]);
    fs.rmSync(tarFile, { force: true });
    if (!x.ok) return `tar failed: ${tail(x.stderr)}`;
  }
  fs.writeFileSync(marker, `${repo.commit}\n`);
  return null;
}

// ── one repository ───────────────────────────────────────────────────────────

/** Graph edges of the group, as repo-relative [from, to], and the files it walked. */
function graphSide(group, tree) {
  const { buildFromCwd } = require(path.join(ROOT, 'src/graph/builder.js'));
  const rel = (g, k) => path.relative(tree, g.realPaths.get(k) || k).replace(/\\/g, '/');
  if (group === 'swift') {
    const { moduleImpact, swiftFiles } = require(path.join(ROOT, 'src/graph/swift-modules.js'));
    const files = swiftFiles(tree);
    return { edges: swiftModuleEdges(moduleImpact, tree, files), walked: new Set(files) };
  }
  const g = buildFromCwd(tree);
  const edges = [];
  const walked = new Set();
  for (const [from, tos] of g.forward) {
    const f = rel(g, from);
    if (!EXTS[group].has(path.extname(f).toLowerCase())) continue;
    walked.add(f);
    for (const to of tos) edges.push([f, rel(g, to)]);
  }
  return { edges, walked };
}

async function measureRepo(group, repo, ctx) {
  const { protocol, reposDir, work, refsDir } = ctx;
  const unmeasured = (reason) => ({ status: 'unmeasured', commit: repo.commit, reason });
  const found = toolsFor(group, refsDir, protocol);
  if (found.reason) return unmeasured(found.reason);
  const clone = path.join(reposDir, repo.name);
  if (!fs.existsSync(path.join(clone, '.git'))) return unmeasured(`no clone at ${clone} (node scripts/fetch-xrepo-repos.mjs --only ${repo.name})`);
  if (!run('git', ['-C', clone, 'cat-file', '-e', `${repo.commit}^{commit}`]).ok) return unmeasured(`the clone does not contain the pinned commit ${repo.commit.slice(0, 7)}`);

  const dir = path.join(work, `${repo.name}-${repo.commit.slice(0, 7)}`);
  const tree = path.join(dir, 'tree');
  let err = exportTree(clone, repo, tree, work);
  if (err) return unmeasured(err);

  const graph = graphSide(group, tree);
  if (!graph.walked.size) return unmeasured(`the graph walked no ${group} file`);
  // the reference gets its own copy: a tool may write into the tree it runs in
  const refTree = path.join(dir, 'ref-tree');
  fs.rmSync(refTree, { recursive: true, force: true });
  err = exportTree(clone, repo, refTree, work);
  if (err) return unmeasured(err);

  const adapter = await ADAPTERS[group]();
  const refWork = path.join(dir, 'ref-work');
  fs.rmSync(refWork, { recursive: true, force: true });
  fs.mkdirSync(refWork, { recursive: true });
  const started = Date.now();
  const ref = await adapter.reference({ tree: refTree, files: [...graph.walked].sort(), tools: found.tools, protocol, work: refWork });
  fs.rmSync(refTree, { recursive: true, force: true });
  if (ref.notes && ref.notes.unmeasured) return unmeasured(ref.notes.unmeasured);
  const result = compareImports({ graphEdges: graph.edges, refEdges: ref.edges, walked: graph.walked, covered: ref.covered, importers: (f) => EXTS[group].has(path.extname(f).toLowerCase()) });
  return { status: 'measured', commit: repo.commit, counts: result.counts, samples: result.samples, notes: ref.notes, seconds: Math.round((Date.now() - started) / 1000), clusters: result.clusters };
}

function poolGroup(group, measured, protocol, tools) {
  const table = tableOf(measured.map((m) => m.clusters), protocol);
  const counts = sumCounts(measured.map((m) => m.counts));
  return { repos: measured.map((m) => m.name), table, counts, reference: tools };
}

function checkPredictions(groups, protocol) {
  const out = {};
  for (const p of protocol.predictions) {
    const g = groups[p.group];
    const cell = g && g.table[p.metric];
    if (!cell || cell.value === null || cell.small) { out[p.id] = { claim: p.claim, status: 'not-testable', value: cell ? cell.value : null }; continue; }
    const ok = p.op === '>=' ? cell.value >= p.value : cell.value <= p.value;
    out[p.id] = { claim: p.claim, status: ok ? 'held' : 'missed', value: cell.value, threshold: p.value };
  }
  return out;
}

function writeDoc() {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, REPORT_REL), 'utf8'));
  const file = path.join(ROOT, PAGE_REL);
  const next = inject(fs.readFileSync(file, 'utf8'), renderBlock(report));
  if (next === null) { console.error(`[import-accuracy] ${PAGE_REL} has no generated-block markers`); return 1; }
  fs.writeFileSync(file, next);
  console.log(`[import-accuracy] wrote the tables of ${REPORT_REL} (${report.generated}) into ${PAGE_REL}`);
  return 0;
}

async function main() {
  const protocol = loadProtocol(ROOT);
  if (flag('--write-doc')) { process.exitCode = writeDoc(); return; }
  if (opt('--setup-references')) { process.exitCode = await setupReferences(path.resolve(opt('--setup-references')), protocol); return; }
  const refsRaw = opt('--references') || process.env.SIGMAP_IMPORT_REFERENCES;
  const refsDir = refsRaw ? path.resolve(refsRaw) : null;
  const reposDir = path.resolve(opt('--repos') || path.join(ROOT, 'benchmarks/repos'));
  const work = path.resolve(opt('--work') || path.join(os.tmpdir(), 'import-accuracy'));
  fs.mkdirSync(work, { recursive: true });
  const ctx = { protocol, reposDir, work, refsDir };

  if (opt('--dev')) {                                   // one existing tree, one group; not a registered run
    const group = opt('--dev');
    const tree = path.resolve(opt('--tree') || '');
    const found = toolsFor(group, refsDir, protocol);
    if (found.reason) { console.error(`[import-accuracy] ${found.reason}`); process.exitCode = 1; return; }
    const graph = graphSide(group, tree);
    const adapter = await ADAPTERS[group]();
    const refWork = path.join(work, `dev-${group}`);
    fs.rmSync(refWork, { recursive: true, force: true });
    fs.mkdirSync(refWork, { recursive: true });
    const copy = path.join(refWork, 'tree');
    fs.cpSync(tree, copy, { recursive: true });
    const ref = await adapter.reference({ tree: copy, files: [...graph.walked].sort(), tools: found.tools, protocol, work: refWork });
    if (ref.notes && ref.notes.unmeasured) { console.error(`[import-accuracy] unmeasured: ${ref.notes.unmeasured}`); process.exitCode = 1; return; }
    const r = compareImports({ graphEdges: graph.edges, refEdges: ref.edges, walked: graph.walked, covered: ref.covered, importers: (f) => EXTS[group].has(path.extname(f).toLowerCase()) });
    const g = poolGroup(group, [{ name: path.basename(tree), ...r }], protocol, found.tools.version);
    console.log(formatGroup(`${group} (dev, not a registered run)`, g).join('\n'));
    console.log(`counts: ${JSON.stringify(r.counts)}  notes: ${JSON.stringify(ref.notes)}`);
    const n = Number(opt('--misses')) || 0;
    if (n) { console.log('missed:'); r.samples.missed.slice(0, n).forEach((x) => console.log(`  ${x}`)); console.log('wrong:'); r.samples.wrong.slice(0, n).forEach((x) => console.log(`  ${x}`)); }
    return;
  }

  const only = opt('--only') ? new Set(opt('--only').split(',')) : null;
  const results = {};
  const unmeasured = {};
  for (const [group, def] of Object.entries(protocol.groups)) {
    results[group] = {};
    for (const repo of def.repos.eval) {
      if (only && !only.has(repo.name) && !only.has(group)) continue;
      const t0 = Date.now();
      const r = await measureRepo(group, repo, ctx);
      results[group][repo.name] = r;
      if (r.status === 'measured') console.error(`[import-accuracy] ${group}/${repo.name}: ${r.counts.referenceEdges} reference edges, ${r.counts.graphEdges} graph edges (${Math.round((Date.now() - t0) / 1000)} s)`);
      else { unmeasured[`${group}/${repo.name}`] = r.reason; console.error(`[import-accuracy] ${group}/${repo.name}: unmeasured — ${r.reason}`); }
    }
  }
  const groups = {};
  for (const [group, byRepo] of Object.entries(results)) {
    const measured = Object.entries(byRepo).filter(([, r]) => r.status === 'measured').map(([name, r]) => ({ name, ...r }));
    if (measured.length) groups[group] = poolGroup(group, measured, protocol, toolsFor(group, refsDir, protocol).tools.version);
  }
  const predictions = checkPredictions(groups, protocol);
  const repos = Object.fromEntries(Object.entries(results).map(([g, byRepo]) => [g, Object.fromEntries(Object.entries(byRepo).map(([n, r]) => { const { clusters, ...rest } = r; return [n, rest]; }))]));
  const state = protocolState(ROOT);
  const sigmap = {
    commit: run('git', ['-C', ROOT, 'rev-parse', 'HEAD']).stdout.trim(),
    dirty: run('git', ['-C', ROOT, 'status', '--porcelain', '--', 'src', 'scripts', PROTOCOL_REL]).stdout.trim() !== '',
  };
  const report = {
    schema: SCHEMA, benchmark: 'import-accuracy', method: 'scripts/run-import-accuracy.mjs',
    protocol: { file: PROTOCOL_REL, sha256: state.sha256, commit: state.commit, committed: state.committed },
    sigmap, environment: { node: process.version, platform: `${process.platform}-${process.arch}`, loadAverage: os.loadavg().map((x) => Math.round(x * 100) / 100) },
    groups, repos, unmeasured, unregistered: protocol.unmeasured, predictions,
  };
  if (flag('--json')) console.log(JSON.stringify(report));
  else {
    for (const [g, v] of Object.entries(groups)) { console.log(formatGroup(g, v).join('\n')); console.log(''); }
    console.log('registered predictions');
    for (const [id, p] of Object.entries(predictions)) console.log(`  ${id}: ${p.status}  ${p.value === null || p.value === undefined ? '' : (100 * p.value).toFixed(1) + '%'}`);
    if (Object.keys(unmeasured).length) console.log(`unmeasured (${Object.keys(unmeasured).length}): ${Object.keys(unmeasured).join(', ')}`);
    if (flag('--misses')) {
      const n = Number(opt('--misses')) || 5;
      for (const [g, byRepo] of Object.entries(repos)) for (const [name, r] of Object.entries(byRepo)) {
        if (r.status !== 'measured') continue;
        console.log(`\n${g}/${name} missed (reference edges the graph lacks):`); r.samples.missed.slice(0, n).forEach((x) => console.log(`  ${x}`));
        console.log(`${g}/${name} wrong (graph edges the reference lacks):`); r.samples.wrong.slice(0, n).forEach((x) => console.log(`  ${x}`));
      }
    }
  }
  let code = 0;
  if (flag('--save')) {
    const why = only ? 'a partial run (--only)' : !state.committed ? 'the protocol differs from the committed copy (or was never committed)' : sigmap.dirty ? 'the scored tree has uncommitted changes under src/ or scripts/' : null;
    if (why) { console.error(`[import-accuracy] not saved: ${why}`); code = 1; }
    else {
      const out = opt('--out') ? path.resolve(opt('--out')) : path.join(ROOT, REPORT_REL);
      fs.writeFileSync(out, JSON.stringify(stamp(report, ROOT), null, 2) + '\n');
      console.log(`[import-accuracy] saved ${path.relative(ROOT, out) || out}`);
    }
  }
  process.exitCode = code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
