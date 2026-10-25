#!/usr/bin/env node
/**
 * Call-graph accuracy: how often do the edges of SigMap's method-level call graph agree with
 * the edges a compiler resolves? (#976)
 *
 *   node scripts/run-callgraph-accuracy.mjs --setup-indexers <dir>     # install the pinned indexers into <dir>
 *   node scripts/run-callgraph-accuracy.mjs --indexers <dir>           # score every registered repository
 *   node scripts/run-callgraph-accuracy.mjs --indexers <dir> --save    # also write benchmarks/reports/callgraph-accuracy.json
 *   node scripts/run-callgraph-accuracy.mjs --indexers <dir> --only flask,typescript --misses 5
 *   node scripts/run-callgraph-accuracy.mjs ... --repos <dir> --work <dir> --json --out <file> --reindex
 *
 * The method is benchmarks/CALLGRAPH_ACCURACY_PROTOCOL.md and its numbers are in
 * benchmarks/callgraph-accuracy-protocol.json, committed before the first run. In short: each
 * registered repository is exported at its pinned commit with `git archive` into a scratch tree,
 * a SCIP indexer indexes that tree, `buildCallGraph` runs on the same tree, and the two sets of
 * `<file>#<name> -> <file>#<name>` edges are compared.
 *
 * The pinned clones under benchmarks/repos are only READ (git archive); nothing is written into
 * them. Indexing is slow (minutes for the large repositories), so an index is cached in the work
 * directory by repository, commit and indexer version; --reindex discards it.
 *
 * HONESTY RULES (protocol sections 1 and 8): a repository whose indexer fails, or runs past the
 * timeout, is reported "unmeasured" with the reason and is never replaced. --save refuses a
 * partial run, a protocol that differs from the committed one, and a dirty scored tree.
 *
 * Dev-only. Nothing here ships in the npm package and no runtime code depends on an indexer.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readScipIndex, deriveReferenceEdges } from './lib/scip-edges.mjs';
import {
  SCHEMA, PROTOCOL_REL, loadProtocol, protocolState, compareRepo, tableOf, thresholdVerdict, checkPredictions,
  formatGroup, sumCounts,
} from './lib/callgraph-accuracy.mjs';
import { stamp } from './lib/report-stamp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
export const REPORT_REL = 'benchmarks/reports/callgraph-accuracy.json';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};

/** Run a program with an argument array — never through a shell. */
function run(cmd, argv, options = {}) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
  return { ok: r.status === 0 && !r.error, status: r.status, signal: r.signal, error: r.error, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const tail = (text, n = 6) => text.trim().split('\n').slice(-n).join(' | ');

// ── Indexers ─────────────────────────────────────────────────────────────────

const INDEXER_PACKAGES = { typescript: '@sourcegraph/scip-typescript', python: '@sourcegraph/scip-python' };

/** Install the pinned indexers into `dir` (no install scripts run). */
function setupIndexers(dir, protocol) {
  fs.mkdirSync(dir, { recursive: true });
  const specs = Object.values(protocol.indexers).filter((i) => i.wave === 1).map((i) => `${i.package}@${i.version}`);
  const r = run('npm', ['install', '--prefix', dir, '--ignore-scripts', '--no-audit', '--no-fund', ...specs]);
  if (!r.ok) { console.error(`[callgraph-accuracy] npm install failed: ${tail(r.stderr)}`); return 1; }
  for (const [name, pkg] of Object.entries(INDEXER_PACKAGES)) {
    console.log(`[callgraph-accuracy] ${name}: ${pkg}@${installedVersion(dir, pkg)} in ${dir}`);
  }
  return 0;
}

function installedVersion(dir, pkg) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', pkg, 'package.json'), 'utf8')).version; } catch { return null; }
}

/** The indexer for a group, or the reason there is none. */
function indexerFor(group, dir, protocol) {
  const key = group === 'javascript' ? 'typescript' : group;
  const spec = protocol.indexers[key];
  if (!spec) return { reason: `no indexer registered for ${group}` };
  if (spec.wave !== 1) return { reason: `${key} indexer is wave 2 and has not been set up (${spec.note})` };
  if (!dir) return { reason: 'no --indexers directory (run --setup-indexers <dir> first)' };
  const have = installedVersion(dir, spec.package);
  if (have !== spec.version) return { reason: `${spec.package} is ${have || 'not installed'} in ${dir}, the protocol pins ${spec.version}` };
  return { key, spec, bin: path.join(dir, 'node_modules', '.bin', key === 'typescript' ? 'scip-typescript' : 'scip-python') };
}

// ── Repository trees ─────────────────────────────────────────────────────────

const inside = (dir, child) => { const r = path.relative(dir, child); return r !== '' && !r.startsWith('..') && !path.isAbsolute(r); };

/** `git archive` of the pinned commit into `tree`, once. */
function exportTree(clone, commit, tree, work) {
  const marker = path.join(tree, '.callgraph-accuracy-export');
  if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim() === commit) return null;
  if (!inside(work, tree)) return `refusing to write outside the work directory: ${tree}`;
  fs.rmSync(tree, { recursive: true, force: true });
  fs.mkdirSync(tree, { recursive: true });
  const tarFile = `${tree}.tar`;
  const a = run('git', ['-C', clone, 'archive', '--format=tar', '-o', tarFile, commit]);
  if (!a.ok) return `git archive failed: ${tail(a.stderr)}`;
  const x = run('tar', ['-xf', tarFile, '-C', tree]);
  fs.rmSync(tarFile, { force: true });
  if (!x.ok) return `tar failed: ${tail(x.stderr)}`;
  fs.writeFileSync(marker, `${commit}\n`);
  return null;
}

function projectFor(group, tree, protocol) {
  if (group !== 'javascript') {
    return fs.existsSync(path.join(tree, 'tsconfig.json')) ? null : 'the repository has no root tsconfig.json';
  }
  fs.writeFileSync(path.join(tree, 'tsconfig.json'), `${protocol.typescriptProject.javascript}\n`);
  return null;
}

function indexTree({ indexer, group, repo, tree, scip, protocol, work, reindex }) {
  if (!reindex && fs.existsSync(scip)) return { cached: true };
  const tmp = path.join(work, 'tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const argv = indexer.key === 'typescript'
    ? ['index', '--no-progress-bar', '--output', scip]
    : ['index', '.', '--project-name', repo.name, '--project-version', repo.commit.slice(0, 7), '--output', scip, '--quiet'];
  const heap = Math.floor((os.totalmem() / 1048576) * 0.75);
  const env = { ...process.env, TMPDIR: tmp, NODE_OPTIONS: process.env.NODE_OPTIONS || `--max-old-space-size=${Math.min(heap, 12288)}` };
  const started = Date.now();
  const r = run(indexer.bin, argv, { cwd: tree, env, timeout: protocol.indexTimeoutMinutes * 60000, killSignal: 'SIGKILL' });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (r.error && r.error.code === 'ETIMEDOUT') return { failed: `the indexer ran past ${protocol.indexTimeoutMinutes} minutes` };
  if (!r.ok || !fs.existsSync(scip)) return { failed: `the indexer exited ${r.status ?? r.signal}: ${tail(r.stderr || r.stdout)}` };
  return { cached: false, seconds: Math.round((Date.now() - started) / 1000) };
}

// ── One repository ───────────────────────────────────────────────────────────

function measureRepo(group, repo, ctx) {
  const { protocol, reposDir, work, indexersDir } = ctx;
  const unmeasured = (reason) => ({ status: 'unmeasured', commit: repo.commit, reason });
  const found = indexerFor(group, indexersDir, protocol);
  if (found.reason) return unmeasured(found.reason);

  const clone = path.join(reposDir, repo.name);
  if (!fs.existsSync(path.join(clone, '.git'))) return unmeasured(`no clone at ${clone} (node scripts/fetch-xrepo-repos.mjs --only ${repo.name})`);
  if (!run('git', ['-C', clone, 'cat-file', '-e', `${repo.commit}^{commit}`]).ok) return unmeasured(`the clone does not contain the pinned commit ${repo.commit.slice(0, 7)}`);

  const dir = path.join(work, `${repo.name}-${repo.commit.slice(0, 7)}`);
  const tree = path.join(dir, 'tree');
  let err = exportTree(clone, repo.commit, tree, work);
  if (!err) err = projectFor(group, tree, protocol);
  if (err) return unmeasured(err);

  const scip = path.join(dir, `${found.key}-${found.spec.version}.scip`);
  const indexed = indexTree({ indexer: found, group, repo, tree, scip, protocol, work, reindex: flag('--reindex') });
  if (indexed.failed) return unmeasured(indexed.failed);

  const index = readScipIndex(fs.readFileSync(scip));
  const ref = deriveReferenceEdges(index, (rel) => {
    if (rel.split('/').includes('..') || path.isAbsolute(rel)) return null;
    try { return fs.readFileSync(path.join(tree, rel), 'utf8'); } catch { return null; }
  });
  if (!ref.documents.size) return unmeasured('the index holds no documents');

  const { buildCallGraph } = require(path.join(ROOT, 'src/graph/call-graph.js'));
  const graph = buildCallGraph(tree);
  const result = compareRepo(graph, ref);
  return {
    status: 'measured',
    commit: repo.commit,
    indexer: index.tool,
    scope: result.scope,
    diagnostics: result.diagnostics,
    fileLevel: result.fileLevel,
    samples: result.samples,
    clusters: result.clusters,
    seconds: indexed.seconds,
  };
}

// ── Groups ───────────────────────────────────────────────────────────────────

const sumNested = (list, pick) => sumCounts(list.map(pick));

function poolGroup(name, measured, protocol) {
  const table = tableOf(measured.map((m) => m.clusters), protocol);
  const scope = {
    ...sumNested(measured, (m) => m.scope),
    referenceEdgesOutsideU: sumNested(measured, (m) => m.scope.referenceEdgesOutsideU),
  };
  scope.scopeInclusiveRecall = scope.referenceEdges ? scope.truePositives / scope.referenceEdges : null;
  const fl = sumNested(measured, (m) => m.fileLevel);
  const fileLevel = {
    ...fl,
    precision: fl.graphPairs ? fl.found / fl.graphPairs : null,
    recall: fl.referencePairs ? fl.found / fl.referencePairs : null,
  };
  const diagnostics = sumNested(measured, (m) => ({ ...m.diagnostics, ...m.diagnostics.wrongEdgesByReason, wrongEdgesByReason: undefined }));
  const threshold = thresholdVerdict(table, protocol);
  return { repos: measured.map((m) => m.name), table, scope, fileLevel, diagnostics, threshold };
}

/**
 * Development mode: score one existing tree against one existing index. Not a registered run,
 * never saved, and it reads nothing from the protocol's repository list, so the reference
 * deriver can be built and checked on code that is not being measured.
 */
function devRun(tree, scipFile, protocol) {
  const ref = deriveReferenceEdges(readScipIndex(fs.readFileSync(scipFile)), (rel) => {
    try { return fs.readFileSync(path.join(tree, rel), 'utf8'); } catch { return null; }
  });
  const { buildCallGraph } = require(path.join(ROOT, 'src/graph/call-graph.js'));
  const result = compareRepo(buildCallGraph(tree), ref);
  const group = poolGroup('dev', [{ name: path.basename(tree), ...result }], protocol);
  console.log(formatGroup('dev (not a registered run)', group).join('\n'));
  console.log(`\nreference counts: ${JSON.stringify(ref.counts)}`);
  console.log(`wrong graph edges by reason: ${JSON.stringify(result.diagnostics.wrongEdgesByReason)}`);
  const n = Number(opt('--misses')) || 0;
  if (n) {
    console.log('\nmissed (reference edges the graph lacks):');
    for (const m of result.samples.missed.slice(0, n)) console.log(`  [${m.kind}] ${m.edge}`);
    console.log('wrong (graph edges the reference lacks):');
    for (const w of result.samples.wrong.slice(0, n)) console.log(`  [${w.reason}] ${w.edge}`);
  }
}

async function main() {
  const protocol = loadProtocol(ROOT);
  if (opt('--setup-indexers')) { process.exitCode = setupIndexers(path.resolve(opt('--setup-indexers')), protocol); return; }
  if (opt('--tree')) {
    if (!opt('--scip')) { console.error('[callgraph-accuracy] --tree needs --scip <index file>'); process.exitCode = 1; return; }
    devRun(path.resolve(opt('--tree')), path.resolve(opt('--scip')), protocol);
    return;
  }

  const indexersRaw = opt('--indexers') || process.env.SIGMAP_SCIP_INDEXERS;
  const indexersDir = indexersRaw ? path.resolve(indexersRaw) : null;
  const reposDir = path.resolve(opt('--repos') || path.join(ROOT, 'benchmarks/repos'));
  const work = path.resolve(opt('--work') || path.join(os.tmpdir(), 'callgraph-accuracy'));
  fs.mkdirSync(work, { recursive: true });
  const only = opt('--only') ? new Set(opt('--only').split(',')) : null;
  const ctx = { protocol, reposDir, work, indexersDir };

  const results = {};
  const unmeasured = {};
  for (const [group, repos] of Object.entries(protocol.repos)) {
    results[group] = {};
    for (const repo of repos) {
      if (only && !only.has(repo.name) && !only.has(group)) continue;
      const t0 = Date.now();
      const r = measureRepo(group, repo, ctx);
      results[group][repo.name] = r;
      if (r.status === 'measured') {
        console.error(`[callgraph-accuracy] ${group}/${repo.name}: ${r.scope.referenceEdgesInU} reference edges, ${r.scope.graphEdgesInU} graph edges in U (${Math.round((Date.now() - t0) / 1000)} s)`);
      } else {
        unmeasured[`${group}/${repo.name}`] = r.reason;
        console.error(`[callgraph-accuracy] ${group}/${repo.name}: unmeasured — ${r.reason}`);
      }
    }
  }

  const groups = {};
  const tables = {};
  for (const [group, byRepo] of Object.entries(results)) {
    const measured = Object.entries(byRepo).filter(([, r]) => r.status === 'measured').map(([name, r]) => ({ name, ...r }));
    if (!measured.length) continue;
    groups[group] = poolGroup(group, measured, protocol);
    tables[group] = groups[group].table;
  }
  const predictions = Object.keys(tables).length ? checkPredictions(tables, protocol) : null;

  const repos = Object.fromEntries(Object.entries(results).map(([g, byRepo]) => [g, Object.fromEntries(Object.entries(byRepo).map(([n, r]) => {
    const { clusters, ...rest } = r; // eslint-disable-line no-unused-vars
    return [n, rest];
  }))]));
  const state = protocolState(ROOT);
  const sigmap = {
    commit: run('git', ['-C', ROOT, 'rev-parse', 'HEAD']).stdout.trim(),
    dirty: run('git', ['-C', ROOT, 'status', '--porcelain', '--', 'src', 'scripts', PROTOCOL_REL]).stdout.trim() !== '',
  };
  const report = {
    schema: SCHEMA,
    benchmark: 'callgraph-accuracy',
    method: 'scripts/run-callgraph-accuracy.mjs',
    protocol: { file: PROTOCOL_REL, sha256: state.sha256, commit: state.commit, committed: state.committed },
    sigmap,
    environment: { node: process.version, platform: `${process.platform}-${process.arch}`, loadAverage: os.loadavg().map((x) => Math.round(x * 100) / 100) },
    groups: Object.fromEntries(Object.entries(groups).map(([g, v]) => [g, { ...v, table: { rows: v.table.rows, sites: v.table.sites, receiverOnly: v.table.receiverOnly } }])),
    repos,
    unmeasured,
    predictions,
  };

  if (flag('--json')) {
    console.log(JSON.stringify(report));
  } else {
    for (const [g, v] of Object.entries(groups)) { console.log(formatGroup(g, v).join('\n')); console.log(''); }
    if (predictions) {
      console.log('registered predictions');
      for (const [id, p] of Object.entries(predictions)) console.log(`  ${id}: ${p.status}  ${(p.parts || []).map((x) => `${x.group} ${x.value === null || x.value === undefined ? '-' : (100 * x.value).toFixed(1) + '%'}`).join(', ')}`);
    }
    const names = Object.keys(unmeasured);
    if (names.length) console.log(`unmeasured (${names.length}): ${names.join(', ')}`);
    if (flag('--misses')) {
      const n = Number(opt('--misses')) || 5;
      for (const [g, byRepo] of Object.entries(repos)) for (const [name, r] of Object.entries(byRepo)) {
        if (r.status !== 'measured') continue;
        console.log(`\n${g}/${name} missed (reference edges the graph lacks):`);
        for (const m of r.samples.missed.slice(0, n)) console.log(`  [${m.kind}] ${m.edge}`);
        console.log(`${g}/${name} wrong (graph edges the reference lacks):`);
        for (const w of r.samples.wrong.slice(0, n)) console.log(`  [${w.reason}] ${w.edge}`);
      }
    }
  }

  let code = 0;
  if (flag('--save')) {
    const why = only ? 'a partial run (--only)'
      : !state.committed ? 'the protocol differs from the committed copy (or was never committed)'
        : sigmap.dirty ? 'the scored tree has uncommitted changes under src/ or scripts/'
          : null;
    if (why) {
      console.error(`[callgraph-accuracy] not saved: ${why}`);
      code = 1;
    } else {
      const out = opt('--out') ? path.resolve(opt('--out')) : path.join(ROOT, REPORT_REL);
      fs.writeFileSync(out, JSON.stringify(stamp(report, ROOT), null, 2) + '\n');
      console.log(`[callgraph-accuracy] saved ${path.relative(ROOT, out) || out}`);
    }
  }
  process.exitCode = code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
