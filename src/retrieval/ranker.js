'use strict';

/**
 * SigMap zero-dependency relevance ranker.
 *
 * Ranks all files in a signature index against a natural-language query.
 * Scoring weights:
 *   - keyword overlap (exact token match against sigs)
 *   - symbol match (token appears in a top-level identifier / function name)
 *   - partial prefix match (token is prefix of a sig token, length ≥ 4)
 *   - path relevance (query token appears in the file path)
 *   - recency boost (applied externally via recency map)
 *
 * Usage:
 *   const { rank } = require('./src/retrieval/ranker');
 *   const results = rank(query, sigIndex, { topK: 10 });
 *   // results: [{ file, score, sigs, tokens }]
 */

const { loadWeights } = require('../learning/weights');
const { tokenize, STOP_WORDS } = require('./tokenizer');

// ---------------------------------------------------------------------------
// Default weights
// ---------------------------------------------------------------------------
const DEFAULT_WEIGHTS = {
  exactToken: 1.0,       // query token exactly in sig tokens
  symbolMatch: 0.5,      // bonus if token appears in a function/class name line
  prefixMatch: 0.3,      // partial prefix hit (query token ≥ 4 chars)
  pathMatch: 0.8,        // query token appears in the file path
  recencyBoost: 1.5,     // multiplier applied when file is in recencySet
  graphBoost: 0.4,       // additive bonus for 1-hop import neighbors of matching files
};

// Graph boost amounts for 2-hop traversal with decay (v6.7)
const GRAPH_BOOST_AMOUNTS = {
  hop1: 0.40,   // direct import neighbor of a file with score > 0
  hop2: 0.15,   // 2 hops away (transitive), with decay
};

// Intent-specific weight adjustments
const INTENT_WEIGHTS = {
  search:     DEFAULT_WEIGHTS,
  debug:      { ...DEFAULT_WEIGHTS, exactToken: 1.2, pathMatch: 0.6 },
  explain:    { ...DEFAULT_WEIGHTS, symbolMatch: 0.8, pathMatch: 0.9 },
  refactor:   { ...DEFAULT_WEIGHTS, symbolMatch: 0.9, exactToken: 0.8 },
  review:     { ...DEFAULT_WEIGHTS, pathMatch: 1.0, exactToken: 0.9 },
  test:       { ...DEFAULT_WEIGHTS, exactToken: 0.7, symbolMatch: 0.4 },
  integrate:  { ...DEFAULT_WEIGHTS, graphBoost: 0.7, pathMatch: 1.1 },
  navigate:   { ...DEFAULT_WEIGHTS, pathMatch: 1.2, exactToken: 0.9 },
};

// Penalty multipliers for negative signals
const PENALTY_SIGNALS = {
  testFile:      0.4,    // test/spec/__tests__ in path
  generatedCode: 0.3,    // dist/build/.next in path
  docsFile:      0.2,    // docs/doc/README in path
  nodeModules:   0.0,    // node_modules (zero score)
};

function _computePenalty(filePath) {
  const pathLower = filePath.toLowerCase();
  if (pathLower.includes('node_modules')) return PENALTY_SIGNALS.nodeModules;
  if (/(^|\/)(test|tests|spec|__tests__|e2e)($|\/)/.test(pathLower)) return PENALTY_SIGNALS.testFile;
  if (/(^|\/)(dist|build|\.next|\.nuxt|out|\.venv|venv)($|\/)/.test(pathLower)) return PENALTY_SIGNALS.generatedCode;
  if (/(^|\/)(docs|doc|readme|changelog)($|\/)/.test(pathLower)) return PENALTY_SIGNALS.docsFile;
  return 1.0;
}

// Detect hub files: those with fanout > 20% of all files in the graph
function _computeHubs(graph) {
  if (!graph || !graph.reverse) return new Set();
  const fileCount = Math.max(1, graph.reverse.size);
  const threshold = Math.ceil(fileCount * 0.2);
  const hubs = new Set();
  for (const [file, deps] of graph.reverse) {
    if ((deps && deps.size >= threshold) || (Array.isArray(deps) && deps.length >= threshold)) {
      hubs.add(file);
    }
  }
  return hubs;
}

// Common utility paths that should be treated as hubs regardless of fanout
function _isHub(filePath) {
  return /\/(utils|helpers|shared|common|constants|types|interfaces|index)\.(ts|tsx|js|jsx)$/.test(filePath)
      || filePath.endsWith('/index.ts') || filePath.endsWith('/index.js');
}

/**
 * Score a single file against a query, returning detailed signal breakdown.
 *
 * @param {string}   filePath   - relative file path (e.g. 'src/extractors/python.js')
 * @param {string[]} sigs       - signature strings for this file
 * @param {string[]} queryTokens - pre-tokenized query
 * @param {object}   weights
 * @returns {{ score: number, signals: { exactToken: number, symbolMatch: number, prefixMatch: number, pathMatch: number, penalty: number } }}
 */
function scoreFile(filePath, sigs, queryTokens, weights) {
  if (!sigs || sigs.length === 0) return { score: 0, signals: { exactToken: 0, symbolMatch: 0, prefixMatch: 0, pathMatch: 0, penalty: 1.0 } };

  const w = weights || DEFAULT_WEIGHTS;
  const signals = { exactToken: 0, symbolMatch: 0, prefixMatch: 0, pathMatch: 0, penalty: _computePenalty(filePath) };

  // Build token set from all signatures
  const sigText = sigs.join(' ');
  const sigTokenSet = new Set(tokenize(sigText));

  // Build token set from the file path
  const pathTokenSet = new Set(tokenize(filePath));

  let score = 0;

  for (const qt of queryTokens) {
    if (STOP_WORDS.has(qt)) continue;

    // Exact token match in sigs
    if (sigTokenSet.has(qt)) {
      const bonus = w.exactToken;
      score += bonus;
      signals.exactToken += bonus;

      // Bonus: appears directly in a function/class/method name line
      const nameLineMatch = sigs.some((sig) => {
        const nt = tokenize(sig.replace(/[^a-zA-Z0-9_\s]/g, ' '));
        return nt.includes(qt);
      });
      if (nameLineMatch) {
        score += w.symbolMatch;
        signals.symbolMatch += w.symbolMatch;
      }
    }

    // Prefix match (e.g. query "python" matches "pythonDeps")
    if (qt.length >= 4) {
      for (const st of sigTokenSet) {
        if (st !== qt && st.startsWith(qt)) {
          score += w.prefixMatch;
          signals.prefixMatch += w.prefixMatch;
          break; // one bonus per query token
        }
      }
    }

    // Path token match
    if (pathTokenSet.has(qt)) {
      score += w.pathMatch;
      signals.pathMatch += w.pathMatch;
    }
  }

  // Apply penalty multiplier
  score *= signals.penalty;

  return { score, signals };
}

/**
 * Rank all files in a signature index against a query.
 *
 * @param {string}              query     - natural language query
 * @param {Map<string,string[]>} sigIndex - Map<file, sigs[]>
 * @param {object}  [opts]
 * @param {number}  [opts.topK=10]               - max results to return
 * @param {number}  [opts.recencyBoost=1.5]       - multiplier for recent files
 * @param {Set<string>} [opts.recencySet]         - set of recently-changed file paths
 * @param {object}  [opts.weights]               - override scoring weights
 * @param {string}  [opts.cwd]                   - project root for learned ranking weights
 * @param {{ forward: Map<string,string[]> }} [opts.graph] - dependency graph for neighbor boost
 * @returns {{ file: string, score: number, sigs: string[], tokens: number, intent: string, signals: object }[]}
 */
function rank(query, sigIndex, opts) {
  if (!query || typeof query !== 'string') return [];
  if (!sigIndex || !(sigIndex instanceof Map) || sigIndex.size === 0) return [];

  const topK = (opts && opts.topK) || 10;
  const recencyMultiplier = (opts && opts.recencyBoost) || DEFAULT_WEIGHTS.recencyBoost;
  const recencySet = (opts && opts.recencySet) || null;
  const graph = (opts && opts.graph && opts.graph.forward instanceof Map) ? opts.graph : null;
  const cwd = (opts && opts.cwd) || null;

  // Detect query intent and get appropriate weights
  const intent = detectIntent(query);
  const intentWeights = INTENT_WEIGHTS[intent] || DEFAULT_WEIGHTS;
  const weights = (opts && opts.weights) ? Object.assign({}, intentWeights, opts.weights) : intentWeights;
  const learnedWeights = opts && opts.cwd ? loadWeights(opts.cwd) : null;

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    // Empty query: return top-K by file count (most signatures = most useful)
    const all = [];
    for (const [file, sigs] of sigIndex.entries()) {
      all.push({ file, score: sigs.length, sigs, tokens: Math.ceil(sigs.join('\n').length / 4), intent, signals: {} });
    }
    all.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
    return all.slice(0, topK);
  }

  const scored = [];
  for (const [file, sigs] of sigIndex.entries()) {
    const result = scoreFile(file, sigs, queryTokens, weights);
    let score = result.score;
    const signals = result.signals;

    // Recency boost
    if (recencySet && recencySet.has(file) && score > 0) {
      score *= recencyMultiplier;
      signals.recencyBoost = recencyMultiplier;
    }

    if (learnedWeights && score > 0) {
      const multiplier = learnedWeights[file] || 1.0;
      score *= multiplier;
      signals.learnedWeights = multiplier;
    }

    scored.push({
      file,
      score,
      sigs,
      tokens: Math.ceil(sigs.join('\n').length / 4),
      intent,
      signals,
    });
  }

  // Graph neighbor boost: 2-hop traversal with decay (v6.7)
  // Hop 1: add hop1 amount to direct import neighbors (score > 0)
  // Hop 2: add hop2 amount to neighbors of hop1 files (with decay)
  // Hub suppression: files with high fanout (>20%) are not boosted
  if (graph && cwd) {
    const path = require('path');
    // Build maps for relative ↔ absolute path conversion and index lookup
    const relToIdx = new Map();
    const absToRel = new Map();
    for (let i = 0; i < scored.length; i++) {
      relToIdx.set(scored[i].file, i);
      const abs = path.resolve(cwd, scored[i].file);
      absToRel.set(abs, scored[i].file);
    }

    const hubs = _computeHubs(graph);
    const hop1Files = new Set(); // track which files received hop1 boost

    // Hop 1: direct neighbors of scored files
    for (const entry of scored) {
      if (entry.score <= 0) continue;
      const abs = path.resolve(cwd, entry.file);
      const neighbors = graph.forward.get(abs) || [];
      for (const neighborAbs of neighbors) {
        if (_isHub(neighborAbs) || hubs.has(neighborAbs)) continue;
        const neighborRel = path.relative(cwd, neighborAbs).replace(/\\/g, '/');
        const idx = relToIdx.get(neighborRel);
        if (idx !== undefined) {
          scored[idx].score += GRAPH_BOOST_AMOUNTS.hop1;
          scored[idx].signals.graphBoost = (scored[idx].signals.graphBoost || 0) + GRAPH_BOOST_AMOUNTS.hop1;
          hop1Files.add(neighborAbs);
        }
      }
    }

    // Hop 2: neighbors of hop1 files (only if they didn't get a direct score)
    for (const hop1File of hop1Files) {
      if (!absToRel.has(hop1File)) continue; // skip files not in index
      const neighbors = graph.forward.get(hop1File) || [];
      for (const neighborAbs of neighbors) {
        if (_isHub(neighborAbs) || hubs.has(neighborAbs)) continue;
        if (hop1Files.has(neighborAbs)) continue; // skip already hop1-boosted
        const neighborRel = path.relative(cwd, neighborAbs).replace(/\\/g, '/');
        const idx = relToIdx.get(neighborRel);
        if (idx !== undefined && scored[idx].score > 0) {
          // Only boost files that have some baseline score (not noise)
          scored[idx].score += GRAPH_BOOST_AMOUNTS.hop2;
          scored[idx].signals.graphBoost = (scored[idx].signals.graphBoost || 0) + GRAPH_BOOST_AMOUNTS.hop2;
        }
      }
    }
  }

  scored.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
  return scored.slice(0, topK);
}

/**
 * All paths where sigmap adapters write their context files, in probe order.
 * The first existing file with a non-empty index wins when no explicit path
 * is supplied.
 */
const ADAPTER_OUTPUT_PATHS = [
  ['.github', 'copilot-instructions.md'], // copilot (default)
  ['CLAUDE.md'],                           // claude
  ['AGENTS.md'],                           // codex
  ['.cursorrules'],                        // cursor
  ['.windsurfrules'],                      // windsurf
  ['.github', 'openai-context.md'],        // openai
  ['.github', 'gemini-context.md'],        // gemini
  ['llm-full.txt'],                        // llm-full
  ['llm.txt'],                             // llm
];

/**
 * Parse a single context file into a Map<filePath, string[]>.
 *
 * Files that contain human-written content before an
 * "## Auto-generated signatures" marker (e.g. CLAUDE.md) are handled
 * by skipping everything above the marker before scanning for ### headers.
 *
 * @param {string} contextPath  - absolute path to the context file
 * @returns {Map<string, string[]>}
 */
function _parseContextFile(contextPath) {
  const fs = require('fs');
  const index = new Map();

  if (!fs.existsSync(contextPath)) return index;

  let content = fs.readFileSync(contextPath, 'utf8');

  // Skip any human-written preamble that sits above the auto-generated block.
  const markerIdx = content.indexOf('## Auto-generated signatures');
  if (markerIdx !== -1) content = content.slice(markerIdx);

  const lines = content.split('\n');
  let currentFile = null;
  let inBlock = false;
  let sigs = [];

  for (const line of lines) {
    const headerMatch = line.match(/^###\s+(\S+)\s*$/);
    if (headerMatch) {
      if (currentFile !== null) index.set(currentFile, sigs);
      currentFile = headerMatch[1];
      sigs = [];
      inBlock = false;
      continue;
    }
    if (line.startsWith('```')) { inBlock = !inBlock; continue; }
    if (inBlock && currentFile && line.trim()) sigs.push(line.trim());
  }
  if (currentFile !== null) index.set(currentFile, sigs);

  return index;
}

/**
 * Build a signature index from the generated context file.
 * Returns Map<filePath, string[]> where filePath is the relative path
 * as it appears in the ### headers of the context file.
 *
 * Resolution priority:
 *  1. `opts.contextPath` — explicit path from --output or --adapter flag
 *  2. `customOutput` key in gen-context.config.json — persisted from a
 *     previous `--output <file>` generation run
 *  3. All known adapter output paths probed in order (first non-empty wins)
 *
 * @param {string} cwd
 * @param {{ contextPath?: string }} [opts]
 * @returns {Map<string, string[]>}
 */
function buildSigIndex(cwd, opts) {
  const fs   = require('fs');
  const path = require('path');

  // 1. Caller supplied an explicit path — use it directly.
  if (opts && opts.contextPath) {
    return _parseContextFile(opts.contextPath);
  }

  // 2. Check gen-context.config.json for a persisted customOutput path.
  try {
    const cfgPath = path.join(cwd, 'gen-context.config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.customOutput) {
        const customPath = path.resolve(cwd, cfg.customOutput);
        const index = _parseContextFile(customPath);
        if (index.size > 0) return index;
      }
    }
  } catch (_) {}

  // 3. Probe all known adapter output paths; return first non-empty index.
  for (const parts of ADAPTER_OUTPUT_PATHS) {
    const contextPath = path.join(cwd, ...parts);
    const index = _parseContextFile(contextPath);
    if (index.size > 0) return index;
  }

  return new Map();
}

/**
 * Format ranked results as a markdown table string.
 *
 * @param {{ file: string, score: number, sigs: string[], tokens: number, intent: string, signals: object }[]} results
 * @param {string} query
 * @returns {string}
 */
function formatRankTable(results, query) {
  if (!results || results.length === 0) {
    return `No matching files found for query: "${query}"\n`;
  }

  const intent = (results[0] && results[0].intent) || 'search';
  const lines = [
    `## Query: ${query}`,
    `Intent: ${intent}`,
    '',
    '| Rank | File | Score | Sigs | Penalty |',
    '|------|------|-------|------|---------|',
    ...results.map((r, i) => {
      const penalty = r.signals && r.signals.penalty ? r.signals.penalty.toFixed(2) : '1.00';
      return `| ${i + 1} | ${r.file} | ${r.score.toFixed(2)} | ${r.sigs.length} | ${penalty} |`;
    }),
    '',
  ];

  // Add signature details for top results
  for (const r of results.slice(0, 3)) {
    if (r.sigs.length > 0) {
      lines.push(`### ${r.file}`);
      if (r.signals) {
        const sig = r.signals;
        lines.push(`Signals: exactToken=${(sig.exactToken || 0).toFixed(2)} symbolMatch=${(sig.symbolMatch || 0).toFixed(2)} prefixMatch=${(sig.prefixMatch || 0).toFixed(2)} pathMatch=${(sig.pathMatch || 0).toFixed(2)} penalty=${(sig.penalty || 1).toFixed(2)}`);
      }
      lines.push('```');
      lines.push(...r.sigs.slice(0, 10));
      if (r.sigs.length > 10) lines.push(`... (${r.sigs.length - 10} more)`);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Format ranked results as a structured JSON-serialisable object.
 *
 * @param {{ file: string, score: number, sigs: string[], tokens: number, intent: string, signals: object }[]} results
 * @param {string} query
 * @returns {object}
 */
function formatRankJSON(results, query) {
  const intent = (results && results[0] && results[0].intent) || 'search';
  return {
    query,
    intent,
    results: (results || []).map((r, i) => ({
      rank: i + 1,
      file: r.file,
      score: r.score,
      sigs: r.sigs,
      tokens: r.tokens,
      signals: r.signals || {},
    })),
    totalResults: (results || []).length,
  };
}

// ---------------------------------------------------------------------------
// Intent detection — 7 intents
// ---------------------------------------------------------------------------
const INTENT_PATTERNS = {
  debug:    /\b(bug|fix|error|crash|exception|broken|failing|issue|problem|regression)\b/i,
  explain:  /\b(explain|how does|what is|understand|overview|architecture|describe|walk me|teach)\b/i,
  refactor: /\b(refactor|restructure|redesign|clean up|extract|move|rename|simplify|optimize)\b/i,
  review:   /\b(review|check|audit|security|pr|pull request|assess|validate)\b/i,
  test:     /\b(test|unit test|integration test|testing|spec|assert|mock)\b/i,
  integrate:/\b(import|integrate|connect|wire|bind|require|export|depend|graph)\b|require[ds]\b/i,
  navigate: /\b(find|locate|where|search|look for|show me|navigate|browse|list)\b/i,
};

function detectIntent(query) {
  if (!query || typeof query !== 'string') return 'search';
  for (const [intent, re] of Object.entries(INTENT_PATTERNS)) {
    if (re.test(query)) return intent;
  }
  return 'search';
}

module.exports = { rank, buildSigIndex, scoreFile, formatRankTable, formatRankJSON, DEFAULT_WEIGHTS, GRAPH_BOOST_AMOUNTS, detectIntent };
