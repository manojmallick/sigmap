'use strict';

const fs = require('fs');
const path = require('path');
const { buildFromCwd } = require('../graph/builder');
const { buildCallFileGraph } = require('../graph/call-graph');
const { buildSigIndex } = require('../retrieval/ranker');
const { parseAnchor, findRelatedTests } = require('../evidence/pack');
const { directDeps, collectVersionPins } = require('../verify/lib-index');
const { collectRoutes } = require('./route-table');
const { collectEnvReads } = require('./env-schema');
const { collectMigrations } = require('./migrations');
const { collectTargets } = require('./build-ci');

// Unified knowledge map (#626, increment 1 of #543). SigMap already computes
// the pieces — import graph, call-file graph, signature index, installed
// library pins, route table, impl↔test discovery — but they live behind
// separate tools. This assembles them into ONE typed, deterministic store.
//
// ── Schema draft (v3) ──────────────────────────────────────────────────────
// Node ids (also the sort key):
//   file:<rel-path>          symbol:<rel-path>#<name> (anchor start-end kept)
//   lib:<name>@<version>     route:<METHOD> <path>
//   env:<NAME>               migration:<rel-path>     script:<runner>:<name>
// Edge kinds, serialized as { from, kind, to }:
//   imports        file → file          (import graph)
//   calls          file → file          (call-file graph)
//   defines        file → symbol       (signature index, with anchors)
//   tests          test-file → file    (impl↔test discovery)
//   uses-lib       file → lib          (bare imports matching declared deps)
//   exposes-route  file → route        (route table)
//   reads-env      file → env          (per-file env reads, #629)
// v3 (#632): file nodes carry a `tokens` estimate (chars/4 over signatures);
// graph endpoints missing from the signature index still get file nodes.
// Serialization: nodes sorted by id, edges by (from, kind, to), keys sorted
// recursively — two builds of the same tree are byte-identical. Symbol nodes
// are capped per file and the cap is disclosed in `truncated`.

const SCHEMA_VERSION = 3;
const MAX_SYMBOLS_PER_FILE = 50;
const CACHE_FILE = 'knowledge-map.json';

const _rel = (cwd, f) => path.relative(cwd, f).replace(/\\/g, '/');

/** Stable stringify: object keys sorted recursively (evidence-pack pattern). */
function _sortKeys(value) {
  if (Array.isArray(value)) return value.map(_sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = _sortKeys(value[k]);
    return out;
  }
  return value;
}
function canonicalJson(value) {
  return JSON.stringify(_sortKeys(value), null, 1);
}

/** Bare (non-relative) import specifiers in a JS/TS source, root package only. */
function _bareImports(src) {
  const out = new Set();
  const stripped = String(src).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of stripped.matchAll(/(?:from\s+|require\s*\(\s*|import\s*\(\s*)['"]([^'".][^'"]*)['"]/g)) {
    const spec = m[1];
    const root = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    out.add(root);
  }
  return out;
}

/**
 * Build the unified knowledge map for a repo from existing producers.
 * Deterministic: same tree in, byte-identical store out.
 * @param {string} cwd
 * @returns {{ schema: number, nodes: object[], edges: object[], truncated: string[] }}
 */
function buildKnowledgeMap(cwd) {
  // The graph builder lowercases absolute node keys, and macOS tmpdirs are
  // symlinks — resolve the root and match graph nodes via a lowercased
  // abs→rel lookup or every membership check silently misses.
  try { cwd = fs.realpathSync(cwd); } catch (_) {}
  const nodes = new Map(); // id → node
  const edges = new Set(); // canonical "from\u0000kind\u0000to"
  const truncated = [];
  const addNode = (node) => { if (!nodes.has(node.id)) nodes.set(node.id, node); };
  const addEdge = (from, kind, to) => { edges.add(`${from}\u0000${kind}\u0000${to}`); };

  // Files + symbols + defines — from the signature index (anchors included).
  const sigIndex = buildSigIndex(cwd);
  const relFiles = [...sigIndex.keys()].map((f) => f.replace(/\\/g, '/')).sort();
  for (const rel of relFiles) {
    const sigs = sigIndex.get(rel) || sigIndex.get(rel.replace(/\//g, path.sep)) || [];
    addNode({ id: `file:${rel}`, kind: 'file', tokens: Math.ceil(sigs.join('\n').length / 4) });
    let emitted = 0;
    for (const sig of sigs) {
      const { symbol, start, end } = parseAnchor(sig);
      const nameMatch = /([A-Za-z_$][\w$]*)\s*(?:\(|=|:|$)/.exec(symbol.replace(/^[\s#]*(?:export\s+|async\s+|function\s+|class\s+|def\s+|defp\s+|fn\s+|pub\s+fn\s+|module\.exports\s*=?\s*)?/, ''));
      if (!nameMatch) continue;
      if (emitted >= MAX_SYMBOLS_PER_FILE) { truncated.push(`file:${rel}`); break; }
      emitted++;
      const id = `symbol:${rel}#${nameMatch[1]}`;
      addNode(start ? { id, kind: 'symbol', anchor: `${start}-${end}` } : { id, kind: 'symbol' });
      addEdge(`file:${rel}`, 'defines', id);
    }
  }

  // Imports — the file dependency graph.
  const absToRel = new Map(relFiles.map((r) => [path.join(cwd, r).toLowerCase(), r]));
  const relOf = (abs) => absToRel.get(String(abs).toLowerCase());
  const relOfGraphKey = (abs) => {
    const hit = relOf(abs);
    if (hit) return hit;
    const key = String(abs);
    try {
      const real = fs.realpathSync(key);
      if (real.toLowerCase().startsWith(cwd.toLowerCase() + path.sep)) {
        return real.slice(cwd.length + 1).replace(/\\/g, '/');
      }
    } catch (_) {
      // Graph keys are lowercased (graphKey), so on a case-sensitive fs the
      // realpath probe fails whenever the true path has uppercase — prefix-
      // match the lowercased cwd instead of dropping the file (#635/#636 CI).
      if (key.toLowerCase().startsWith(cwd.toLowerCase() + path.sep)) {
        return key.slice(cwd.length + 1).replace(/\\/g, '/');
      }
    }
    return null;
  };
  const importGraph = buildFromCwd(cwd);
  for (const [from, tos] of importGraph.forward) {
    const fromRel = relOfGraphKey(from);
    if (!fromRel) continue;
    for (const to of tos || []) {
      const toRel = relOfGraphKey(to);
      if (!toRel) continue;
      addNode({ id: `file:${fromRel}`, kind: 'file', tokens: 0 });
      addNode({ id: `file:${toRel}`, kind: 'file', tokens: 0 });
      addEdge(`file:${fromRel}`, 'imports', `file:${toRel}`);
    }
  }

  // Calls — file-level call-graph edges (may be empty for uncovered languages).
  try {
    const callGraph = buildCallFileGraph(cwd);
    for (const [from, tos] of callGraph.forward || []) {
      const fromRel = relOf(from);
      if (!fromRel) continue;
      for (const to of tos || []) {
        const toRel = relOf(to);
        if (toRel) addEdge(`file:${fromRel}`, 'calls', `file:${toRel}`);
      }
    }
  } catch (_) {}

  // Libraries + uses-lib — declared deps with installed versions, bound to
  // the files whose bare imports name them.
  const deps = new Set(directDeps(cwd));
  const pins = collectVersionPins(cwd).pins; // "name@version"
  const versionOf = new Map(pins.map((p) => {
    const at = p.lastIndexOf('@');
    return [p.slice(0, at), p.slice(at + 1)];
  }));
  const libId = (name) => `lib:${name}@${versionOf.get(name) || 'unknown'}`;
  if (deps.size > 0) {
    for (const rel of relFiles) {
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel)) continue;
      let src;
      try { src = fs.readFileSync(path.join(cwd, rel), 'utf8'); } catch (_) { continue; }
      for (const spec of _bareImports(src)) {
        if (!deps.has(spec)) continue;
        addNode({ id: libId(spec), kind: 'library', name: spec, version: versionOf.get(spec) || null });
        addEdge(`file:${rel}`, 'uses-lib', libId(spec));
      }
    }
  }

  // Tests — impl↔test discovery from the evidence pack.
  for (const rel of relFiles) {
    for (const t of findRelatedTests(rel, relFiles)) {
      addEdge(`file:${t}`, 'tests', `file:${rel}`);
    }
  }

  // Routes.
  const absFiles = relFiles.map((r) => path.join(cwd, r));
  try {
    for (const r of collectRoutes(absFiles, cwd) || []) {
      if (!r.method || !r.path) continue;
      const id = `route:${r.method} ${r.path}`;
      addNode({ id, kind: 'route', method: r.method, path: r.path });
      // collectRoutes already returns repo-relative paths.
      const routeRel = r.file && (relOf(r.file) || (nodes.has(`file:${r.file}`) ? r.file : null));
      if (routeRel) addEdge(`file:${routeRel}`, 'exposes-route', id);
    }
  } catch (_) {}

  // Env vars + reads-env — per-file attribution from the env-schema collector.
  try {
    for (const row of collectEnvReads(absFiles, cwd) || []) {
      const id = `env:${row.name}`;
      addNode({ id, kind: 'env-var', name: row.name, inExample: row.inExample });
      for (const rel of row.files) {
        if (nodes.has(`file:${rel}`)) addEdge(`file:${rel}`, 'reads-env', id);
      }
    }
  } catch (_) {}

  // Migrations — files outside srcDirs get nodes of their own.
  try {
    for (const m of collectMigrations(cwd) || []) {
      addNode({ id: `migration:${m.file}`, kind: 'migration', version: m.version, name: m.name });
    }
  } catch (_) {}

  // Scripts — npm scripts, CI workflows, and Makefile targets.
  try {
    for (const t of collectTargets(cwd) || []) {
      addNode({ id: `script:${t.kind}:${t.name}`, kind: 'script', runner: t.kind, name: t.name, detail: t.detail });
    }
  } catch (_) {}

  return {
    schema: SCHEMA_VERSION,
    nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...edges].sort().map((e) => {
      const [from, kind, to] = e.split('\u0000');
      return { from, kind, to };
    }),
    truncated: [...new Set(truncated)].sort(),
  };
}

/** Load from .context cache (keyed by newest context mtime) or build fresh. */
function loadOrBuild(cwd) {
  try { cwd = fs.realpathSync(cwd); } catch (_) {}
  const cachePath = path.join(cwd, '.context', CACHE_FILE);
  let ctxMtime = 0;
  try {
    for (const f of fs.readdirSync(path.join(cwd, '.context'))) {
      // live.json is watcher telemetry and *.tmp is a write in flight: neither changes the index.
      if (f === CACHE_FILE || f === 'live.json' || f.endsWith('.tmp')) continue;
      const st = fs.statSync(path.join(cwd, '.context', f));
      if (st.mtimeMs > ctxMtime) ctxMtime = st.mtimeMs;
    }
  } catch (_) {}
  try {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (cached.schema === SCHEMA_VERSION && cached.builtFor === ctxMtime) return cached;
  } catch (_) {}
  const map = buildKnowledgeMap(cwd);
  map.builtFor = ctxMtime;
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, canonicalJson(map));
  } catch (_) {}
  return map;
}

/**
 * Upgrade-impact walk: lib → importing files → their callers/importers →
 * the tests covering any file in the blast set.
 */
function upgradeImpact(map, libraryName) {
  const lib = map.nodes.find((n) => n.kind === 'library' && n.name === libraryName);
  if (!lib) return null;
  const importers = map.edges.filter((e) => e.kind === 'uses-lib' && e.to === lib.id).map((e) => e.from);
  const importerSet = new Set(importers);
  const callers = new Set();
  for (const e of map.edges) {
    if ((e.kind === 'calls' || e.kind === 'imports') && importerSet.has(e.to) && !importerSet.has(e.from)) {
      callers.add(e.from);
    }
  }
  const blast = new Set([...importers, ...callers]);
  const tests = new Set();
  for (const e of map.edges) {
    if (e.kind === 'tests' && blast.has(e.to)) tests.add(e.from);
  }
  return {
    library: lib.id,
    importers: importers.sort(),
    callers: [...callers].sort(),
    tests: [...tests].sort(),
  };
}

/**
 * Impact of changing one file, computed from the store's `imports` edges with
 * the same BFS semantics as src/graph/impact (direct = level 1, transitive =
 * deeper, depth 0 = unlimited). Tests/routes are the pattern-classified sets
 * the old path produced, enriched with the store's discovered `tests` and
 * `exposes-route` edges (supersets, never smaller). Result shape matches
 * getImpact() so formatImpact renders it unchanged.
 */
function impactView(map, relFile, depth) {
  const { isTestFile, isRouteFile } = require('../graph/impact');
  const rel = String(relFile).replace(/\\/g, '/');
  const id = `file:${rel}`;
  const reverse = new Map();
  for (const e of map.edges) {
    if (e.kind !== 'imports') continue;
    if (!reverse.has(e.to)) reverse.set(e.to, []);
    reverse.get(e.to).push(e.from);
  }
  const direct = new Set();
  const transitive = new Set();
  const visited = new Set([id]);
  for (const f of reverse.get(id) || []) {
    if (!visited.has(f)) { direct.add(f); visited.add(f); }
  }
  if (depth !== 1) {
    let frontier = [...direct];
    let d = 1;
    while (frontier.length > 0 && (depth === 0 || d < depth)) {
      const next = [];
      for (const node of frontier) {
        for (const imp of reverse.get(node) || []) {
          if (!visited.has(imp)) { transitive.add(imp); visited.add(imp); next.push(imp); }
        }
      }
      frontier = next;
      d++;
    }
  }
  const strip = (x) => x.replace(/^file:/, '');
  const impacted = [...direct, ...transitive].map(strip);
  const tests = impacted.filter(isTestFile);
  const testSet = new Set(tests);
  const coverTargets = new Set([id, ...impacted.map((r) => `file:${r}`)]);
  const extraTests = [];
  for (const e of map.edges) {
    if (e.kind === 'tests' && coverTargets.has(e.to) && !testSet.has(strip(e.from))) {
      testSet.add(strip(e.from));
      extraTests.push(strip(e.from));
    }
  }
  const routeFiles = new Set(map.edges.filter((e) => e.kind === 'exposes-route').map((e) => strip(e.from)));
  const routes = impacted.filter((f) => isRouteFile(f) || routeFiles.has(f));
  return {
    changed: rel,
    direct: [...direct].map(strip),
    transitive: [...transitive].map(strip),
    tests: tests.concat(extraTests.sort()),
    routes,
    totalImpact: direct.size + transitive.size,
  };
}

/**
 * Architecture rollup from the store: module token table, hub files by
 * reverse-import degree, dependency-cycle count, and the route total.
 */
function architectureView(map) {
  const files = map.nodes.filter((n) => n.kind === 'file');
  const groups = {};
  let totalTokens = 0;
  for (const n of files) {
    const rel = n.id.slice(5);
    const parts = rel.split('/');
    const mod = parts.length > 1 ? parts[0] : '.';
    const tok = n.tokens || 0;
    if (!groups[mod]) groups[mod] = { files: 0, tokens: 0 };
    groups[mod].files++;
    groups[mod].tokens += tok;
    totalTokens += tok;
  }
  const modules = Object.entries(groups)
    .map(([mod, d]) => ({ mod, files: d.files, tokens: d.tokens }))
    .sort((a, b) => b.tokens - a.tokens);
  const inDeg = new Map();
  const forward = new Map();
  for (const e of map.edges) {
    if (e.kind !== 'imports') continue;
    const from = e.from.slice(5);
    const to = e.to.slice(5);
    inDeg.set(to, (inDeg.get(to) || 0) + 1);
    if (!forward.has(from)) forward.set(from, []);
    forward.get(from).push(to);
  }
  const hubs = [...inDeg.entries()]
    .map(([file, count]) => ({ file, in: count }))
    .sort((a, b) => b.in - a.in || (a.file < b.file ? -1 : 1))
    .slice(0, 10);
  let cycles = 0;
  try { cycles = require('./import-graph').detectCycles(forward).length; } catch (_) {}
  const routes = map.nodes.filter((n) => n.kind === 'route').length;
  return { totalFiles: files.length, totalTokens, modules, hubs, cycles, routes };
}

/** Readers of one env var: the files that read it, and the committed-example flag. */
function envReaders(map, name) {
  const id = `env:${name}`;
  const node = map.nodes.find((n) => n.id === id);
  if (!node) return null;
  const readers = map.edges.filter((e) => e.kind === 'reads-env' && e.to === id).map((e) => e.from).sort();
  return { env: id, inExample: !!node.inExample, readers };
}

/**
 * Related tests per file, from the store's `tests` edges (test → impl) — the
 * evidence view (#635). One edge pass for a whole file list; keys are the
 * caller's original path strings, and files absent from the store are omitted
 * so callers can fall back to per-file discovery.
 * @param {object} map
 * @param {string[]} rels
 * @returns {Map<string, string[]>} input path → sorted test rel paths
 */
function relatedTestsView(map, rels) {
  const want = new Map(); // "file:<rel>" → original input string
  for (const r of rels || []) {
    const orig = String(r);
    want.set(`file:${orig.replace(/\\/g, '/')}`, orig);
  }
  const out = new Map();
  for (const n of map.nodes) {
    if (want.has(n.id)) out.set(want.get(n.id), []);
  }
  for (const e of map.edges) {
    if (e.kind !== 'tests') continue;
    const orig = want.get(e.to);
    if (orig !== undefined && out.has(orig)) out.get(orig).push(e.from.slice(5));
  }
  for (const list of out.values()) list.sort();
  return out;
}

/** Typed neighbors of one file node. */
function fileNeighbors(map, rel) {
  const id = `file:${rel.replace(/\\/g, '/')}`;
  if (!map.nodes.some((n) => n.id === id)) return null;
  const out = { imports: [], importedBy: [], calls: [], calledBy: [], tests: [], testedBy: [], usesLibs: [], defines: [], routes: [], readsEnv: [] };
  for (const e of map.edges) {
    if (e.from === id) {
      if (e.kind === 'imports') out.imports.push(e.to);
      else if (e.kind === 'calls') out.calls.push(e.to);
      else if (e.kind === 'tests') out.tests.push(e.to);
      else if (e.kind === 'uses-lib') out.usesLibs.push(e.to);
      else if (e.kind === 'defines') out.defines.push(e.to);
      else if (e.kind === 'exposes-route') out.routes.push(e.to);
      else if (e.kind === 'reads-env') out.readsEnv.push(e.to);
    } else if (e.to === id) {
      if (e.kind === 'imports') out.importedBy.push(e.from);
      else if (e.kind === 'calls') out.calledBy.push(e.from);
      else if (e.kind === 'tests') out.testedBy.push(e.from);
    }
  }
  for (const k of Object.keys(out)) out[k].sort();
  return out;
}

module.exports = { buildKnowledgeMap, loadOrBuild, upgradeImpact, fileNeighbors, envReaders, impactView, architectureView, relatedTestsView, canonicalJson, SCHEMA_VERSION };
