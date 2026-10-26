'use strict';

/**
 * Impact radius calculator (v2.5).
 *
 * Given a changed file and a dependency graph, finds every file that
 * transitively imports it using BFS. Handles circular dependencies safely.
 *
 * @module src/graph/impact
 */

const path = require('path');
const { buildFromCwd } = require('./builder');
const { displayPath } = require('./path-key');
const { markImpact, importNote, UNSUPPORTED } = require('./language-support');

// Normalize paths for cross-platform consistency (same as in builder.js)
function normalizePath(p) {
  return path.normalize(p).toLowerCase();
}

// ---------------------------------------------------------------------------
// Core BFS traversal
// ---------------------------------------------------------------------------

/**
 * Walk the reverse graph from `startFile` using BFS up to `maxDepth` levels.
 * Returns separate sets for direct and transitive dependents.
 *
 * @param {string} startFile - absolute path of file that changed
 * @param {Map<string,string[]>} reverseGraph
 * @param {number} maxDepth  - 0 = unlimited
 * @returns {{ direct: Set<string>, transitive: Set<string> }}
 */
function bfs(startFile, reverseGraph, maxDepth) {
  const direct     = new Set();
  const transitive = new Set();
  const visited    = new Set([startFile]);

  // Level 1 — direct importers
  const firstLevel = reverseGraph.get(startFile) || [];
  for (const f of firstLevel) {
    if (!visited.has(f)) {
      direct.add(f);
      visited.add(f);
    }
  }

  if (maxDepth === 1) return { direct, transitive };

  // BFS for deeper levels
  let frontier = [...direct];
  let depth = 1;

  while (frontier.length > 0 && (maxDepth === 0 || depth < maxDepth)) {
    const nextFrontier = [];
    for (const node of frontier) {
      const importers = reverseGraph.get(node) || [];
      for (const imp of importers) {
        if (!visited.has(imp)) {
          transitive.add(imp);
          visited.add(imp);
          nextFrontier.push(imp);
        }
      }
    }
    frontier = nextFrontier;
    depth++;
  }

  return { direct, transitive };
}

// ---------------------------------------------------------------------------
// Helper: classify impacted files into tests / routes / other
// ---------------------------------------------------------------------------

const TEST_PATTERNS = [
  /[./\\](test|tests|spec|__tests__)[./\\]/,
  /\.(test|spec)\.[jt]sx?$/,
  /_test\.[jt]sx?$/,
  /_test\.py$/,
  /test_[^/\\]+\.py$/,
];

const ROUTE_PATTERNS = [
  /router?\.[jt]sx?$/i,
  /routes?\.[jt]sx?$/i,
  /controller\.[jt]sx?$/i,
  /views?\.[jt]sx?$/i,
  /handlers?\.[jt]sx?$/i,
];

function isTestFile(f)  { return TEST_PATTERNS.some((re) => re.test(f.replace(/\\/g, '/'))); }
function isRouteFile(f) { return ROUTE_PATTERNS.some((re) => re.test(f.replace(/\\/g, '/'))); }

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the impact of changing `changedFile`.
 *
 * @param {string} changedFile - absolute or cwd-relative path
 * @param {{ forward: Map<string,string[]>, reverse: Map<string,string[]> }} graph
 * @param {object} [opts]
 * @param {number} [opts.depth=0]   - BFS depth limit (0 = unlimited)
 * @param {string} [opts.cwd]       - project root for relative path display
 * @returns {{
 *   changed:     string,
 *   direct:      string[],
 *   transitive:  string[],
 *   tests:       string[],
 *   routes:      string[],
 *   totalImpact: number
 * }}
 */
function getImpact(changedFile, graph, opts) {
  const { depth = 0, cwd = process.cwd() } = opts || {};

  const absChangedReal = path.resolve(cwd, changedFile);
  const absChanged = normalizePath(absChangedReal);

  // Bail gracefully if file not in graph
  if (!graph || !graph.reverse) {
    return withModule(markImpact({ changed: changedFile, direct: [], transitive: [], tests: [], routes: [], totalImpact: 0 }, { cwd }), cwd);
  }

  const { direct, transitive } = bfs(absChanged, graph.reverse, depth);

  const allImpacted = [...direct, ...transitive];
  const tests  = allImpacted.filter(isTestFile);
  const routes = allImpacted.filter(isRouteFile);

  // BFS results are lowercased graph keys; render them through the graph's
  // original-case map so `/Users/...` checkouts do not climb out of cwd.
  // The changed file is caller-supplied, so its real spelling is known even
  // when it is absent from the graph (unindexed / no importers).
  const realPaths = new Map(graph.realPaths || []);
  if (!realPaths.has(absChanged)) realPaths.set(absChanged, absChangedReal);
  const toRel = (f) => displayPath(f, cwd, realPaths);

  // An empty result for a file the graph cannot read is "not tracked", not
  // "nothing depends on it" (#979); markImpact leaves every other result as is.
  return withModule(markImpact({
    changed:     toRel(absChanged),
    direct:      [...direct].map(toRel),
    transitive:  [...transitive].map(toRel),
    tests:       tests.map(toRel),
    routes:      routes.map(toRel),
    totalImpact: direct.size + transitive.size,
  }, { cwd }), cwd);
}

/**
 * Swift names modules, not files, so a Swift file has no file-level importers and is marked
 * "not tracked"; what is known is its module (#980). Attach the files in other targets that
 * import that module, labelled as module-level. Only a Swift file the graph could not read, and
 * only where a Package.swift declares the target that owns it.
 */
function withModule(result, cwd) {
  if (!result || result.graph !== UNSUPPORTED || result.language !== 'Swift' || !cwd) return result;
  try {
    const m = require('./resolvers/swift-modules').moduleImpact(cwd, path.resolve(cwd, result.changed));
    if (m) result.module = m;
  } catch (_) { /* module structure unreadable: the file-level answer stands */ }
  return result;
}

/**
 * Analyse the impact of one or more changed files, building the graph from cwd.
 * This is the high-level convenience function used by the CLI and MCP tool.
 *
 * @param {string|string[]} changedFiles
 * @param {string} cwd
 * @param {object} [opts]
 * @param {number} [opts.depth=3]
 * @param {string[]} [opts.srcDirs]
 * @param {string[]} [opts.exclude]
 * @returns {{ file: string, impact: object }[]}
 */
function analyzeImpact(changedFiles, cwd, opts) {
  const { depth = 3 } = opts || {};
  const files = Array.isArray(changedFiles) ? changedFiles : [changedFiles];

  let graph;
  try {
    graph = buildFromCwd(cwd, opts);
  } catch (_) {
    graph = { forward: new Map(), reverse: new Map() };
  }

  return files.map((f) => ({
    file: f,
    impact: getImpact(f, graph, { depth, cwd }),
  }));
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format an impact result as a readable markdown string.
 *
 * @param {object} result - return value of getImpact()
 * @returns {string}
 */
function formatImpact(result) {
  const lines = [];
  lines.push(`## Impact: \`${result.changed}\``);
  lines.push('');

  if (result.graph === UNSUPPORTED) {
    lines.push(`_${importNote(result.language)}_`);
    if (result.module) {
      const m = result.module;
      lines.push('');
      lines.push(`### Module-level importers (module \`${m.module}\`, target \`${m.dir}\`)`);
      lines.push(`**${m.importers.length}** file(s) in other targets import this file's module _(module level: a superset of what changing this file affects)_`);
      for (const f of m.importers.slice(0, 25)) lines.push(`- \`${f}\``);
      if (m.importers.length > 25) lines.push(`- _…and ${m.importers.length - 25} more_`);
    }
    return lines.join('\n');
  }

  if (result.direct.length === 0 && result.transitive.length === 0) {
    lines.push('_No importers found via relative + aliased imports (lower bound — dynamic/computed imports are not tracked)._');
    return lines.join('\n');
  }

  lines.push(`**Total impacted files:** ${result.totalImpact} _(lower bound — resolves relative + tsconfig/jsconfig-aliased imports)_`);
  lines.push('');

  if (result.direct.length > 0) {
    lines.push('### Direct importers');
    for (const f of result.direct) lines.push(`- \`${f}\``);
    lines.push('');
  }

  if (result.transitive.length > 0) {
    lines.push('### Transitive importers');
    for (const f of result.transitive) lines.push(`- \`${f}\``);
    lines.push('');
  }

  if (result.tests.length > 0) {
    lines.push('### Affected tests');
    for (const f of result.tests) lines.push(`- \`${f}\``);
    lines.push('');
  }

  if (result.routes.length > 0) {
    lines.push('### Affected routes / controllers');
    for (const f of result.routes) lines.push(`- \`${f}\``);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format an impact result as a JSON-serialisable object.
 *
 * @param {object} result - return value of getImpact()
 * @returns {object}
 */
function formatImpactJSON(result) {
  const out = {
    changed:     result.changed,
    direct:      result.direct,
    transitive:  result.transitive,
    tests:       result.tests,
    routes:      result.routes,
    totalImpact: result.totalImpact,
  };
  // Present only when the graph cannot read the file, so a readable file's
  // JSON is the shape it always was (#979).
  if (result.graph === UNSUPPORTED) { out.graph = result.graph; out.language = result.language; }
  if (result.module) out.module = result.module;
  return out;
}

module.exports = { getImpact, analyzeImpact, formatImpact, formatImpactJSON, isTestFile, isRouteFile };
