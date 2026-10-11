'use strict';

/**
 * SigMap benchmark runner.
 * Zero npm dependencies.
 *
 * Loads evaluation tasks from a JSONL file, runs signature-based retrieval
 * against a target repo, and returns scored results.
 *
 * Usage (programmatic):
 *   const { run } = require('./src/eval/runner');
 *   const results = run('benchmarks/tasks/retrieval.jsonl', cwd);
 *   // results: { tasks: [...], metrics: { hitAt5, mrr, precisionAt5, avgTokens, tasks } }
 *
 * Usage (CLI via gen-context.js --benchmark):
 *   node gen-context.js --benchmark
 *   node gen-context.js --benchmark --json
 */

const fs = require('fs');
const path = require('path');
const { aggregate } = require('./scorer');
const { bm25rank } = require('../retrieval/bm25');

// ---------------------------------------------------------------------------
// Context file reader
// ---------------------------------------------------------------------------

/**
 * Read the generated context file and build a simple signature index:
 *   Map<filePath, string[]>  — file → list of signature strings
 *
 * The context file uses section headers like:
 *   ### src/extractors/python.js
 * followed by ``` blocks containing signatures.
 *
 * @param {string} cwd
 * @returns {Map<string, string[]>}
 */
function buildSigIndex(cwd) {
  // Delegate to the production index builder. This used to parse
  // .github/copilot-instructions.md directly — a second parallel implementation
  // that saw only the token-BUDGETED view, ignored the other adapters, the
  // hot-cold/per-module strategy splits, and the complete retrieval index. The
  // corpus therefore scored a smaller index than `sigmap ask` actually uses.
  return require('../retrieval/ranker').buildSigIndex(cwd);
}

// ---------------------------------------------------------------------------
// Identifier-aware BM25 ranking (v7.31; see src/retrieval/bm25.js and #395)
// ---------------------------------------------------------------------------

const { tokenize } = require('../retrieval/bm25');

/**
 * Rank all files in the index against a query with the identifier-aware BM25
 * re-ranker. Returns file entries sorted by relevance score descending; ties
 * are broken by file path alphabetically (deterministic).
 * @param {string} query
 * @param {Map<string, string[]>} index
 * @param {number} topK
 * @returns {{ file: string, score: number, sigs: string[] }[]}
 */
function rank(query, index, topK = 10, opts = {}) {
  // Measure the ranker users actually hit. This used to call bm25rank directly,
  // which meant the corpus scored a parallel implementation with no penalties,
  // graph boost, recency or learned weights — so no ranking regression in
  // src/retrieval/ranker.js could ever show up in the benchmark numbers.
  const { rank: prodRank } = require('../retrieval/ranker');
  const o = Object.assign({ topK }, opts);
  // What ships includes body words whenever retrieval.bodyWords is on (the default, or the
  // repository's own gen-context.config.json), so a caller that names none gets them: built in
  // memory from the sources under `cwd`, never cached, so a pinned checkout is left as it was.
  // A caller that names the option — a Map to use, or null or undefined for none — is scoring
  // something else on purpose and is left alone.
  if (!Object.prototype.hasOwnProperty.call(o, 'bodyWords') && o.cwd) {
    const bodyWords = defaultBodyWords(index, o.cwd);
    if (bodyWords) o.bodyWords = bodyWords;
  }
  return prodRank(query, index, o).slice(0, topK);
}

/** `index` -> its body words, so one index scored over many tasks reads its sources once. */
const _bodyWordsOf = new WeakMap();

/**
 * The body words the shipped ranker would use for the repository at `cwd`, or null when the
 * repository switches them off. Reads only the repository's own `gen-context.config.json`
 * for `retrieval.bodyWords`; the default is the one in src/config/defaults.js.
 *
 * @param {Map<string, string[]>} index
 * @param {string} cwd
 * @returns {Map<string, string>|null}
 */
function defaultBodyWords(index, cwd) {
  if (!(index instanceof Map) || index.size === 0) return null;
  let on = require('../config/defaults').DEFAULTS.retrieval.bodyWords;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(cwd, 'gen-context.config.json'), 'utf8'));
    if (cfg && cfg.retrieval && typeof cfg.retrieval.bodyWords === 'boolean') on = cfg.retrieval.bodyWords;
  } catch (_) { /* no config, or not JSON: the default stands */ }
  if (!on) return null;
  const known = _bodyWordsOf.get(index);
  if (known && known.cwd === cwd) return known.words;
  let words = null;
  try { words = require('../retrieval/body-words').buildFor(cwd, index); } catch (_) { words = null; }
  _bodyWordsOf.set(index, { cwd, words });
  return words;
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Estimate token count from character count (chars/4, ±5%).
 * @param {string[]} sigs
 * @returns {number}
 */
function estimateTokens(sigs) {
  const text = (sigs || []).join('\n');
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Task loader
// ---------------------------------------------------------------------------

/**
 * Load tasks from a JSONL file.
 * Each line: { id, query, expected_files, repo, split? ('easy'|'hard') }
 * Invalid or blank lines are silently skipped.
 * @param {string} tasksFile - absolute or relative path
 * @returns {Array<{id:string, query:string, expected:string[], repo:string}>}
 */
function loadTasks(tasksFile) {
  if (!fs.existsSync(tasksFile)) return [];
  const lines = fs.readFileSync(tasksFile, 'utf8').split('\n');
  const tasks = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.query && Array.isArray(obj.expected_files)) {
        tasks.push({
          id: obj.id || String(tasks.length + 1),
          query: obj.query,
          expected: obj.expected_files,
          repo: obj.repo || '.',
          split: obj.split === 'hard' ? 'hard' : 'easy',
        });
      }
    } catch {
      // skip invalid JSON lines
    }
  }
  return tasks;
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run all tasks in tasksFile against the repo at cwd.
 *
 * @param {string} tasksFile - path to JSONL task file (absolute or relative to cwd)
 * @param {string} cwd       - project root
 * @param {object} [opts]
 * @param {number} [opts.topK=10] - how many results to rank per query
 * @returns {{
 *   tasks: Array<{id, query, expected, ranked, hit5, rr, precAt5, tokens}>,
 *   metrics: { hitAt5, mrr, precisionAt5, avgTokens, tasks }
 * }}
 */
function run(tasksFile, cwd, opts = {}) {
  const topK = opts.topK || 10;

  // Resolve paths
  const resolvedTasksFile = path.isAbsolute(tasksFile)
    ? tasksFile
    : path.resolve(cwd, tasksFile);

  const tasks = loadTasks(resolvedTasksFile);
  if (tasks.length === 0) {
    return {
      tasks: [],
      metrics: { hitAt5: 0, mrr: 0, precisionAt5: 0, avgTokens: 0, tasks: 0 },
    };
  }

  // Build index once (re-used across all tasks in the same repo)
  const index = buildSigIndex(cwd);
  // Import graph built once too — the hop-1/hop-2 boost is part of what ships.
  let graph = null;
  try { graph = require('../graph/builder').buildRankingGraph(cwd); } catch (_) {}

  const taskResults = [];
  for (const task of tasks) {
    const topResult = rank(task.query, index, topK, { cwd, graph, learned: opts.learned });
    const ranked = topResult.map((r) => r.file);
    const tokens = topResult.reduce((sum, r) => sum + estimateTokens(r.sigs), 0);

    const { hitAtK, reciprocalRank, precisionAtK } = require('./scorer');
    const hit5 = hitAtK(ranked, task.expected, 5);
    const rr = reciprocalRank(ranked, task.expected);
    const precAt5 = precisionAtK(ranked, task.expected, 5);

    taskResults.push({
      id: task.id,
      query: task.query,
      expected: task.expected,
      ranked,
      hit5,
      rr,
      precAt5,
      tokens,
    });
  }

  const metrics = aggregate(
    taskResults.map((r) => ({ ranked: r.ranked, expected: r.expected, tokens: r.tokens })),
  );

  return { tasks: taskResults, metrics };
}

// ---------------------------------------------------------------------------
// Table formatter
// ---------------------------------------------------------------------------

/**
 * Format task results as a markdown table string.
 * @param {Array} taskResults - from run()
 * @returns {string}
 */
function formatTable(taskResults) {
  const header = '| Task | Query | hit@5 | RR | Tokens |';
  const divider = '|---|---|:---:|:---:|---:|';
  const rows = taskResults.map((r) => {
    const q = r.query.length > 40 ? r.query.slice(0, 37) + '...' : r.query;
    return `| ${r.id} | ${q} | ${r.hit5 ? '✓' : '✗'} | ${r.rr.toFixed(2)} | ${r.tokens} |`;
  });
  return [header, divider, ...rows].join('\n');
}

/**
 * Format aggregate metrics as a human-readable string.
 * @param {object} metrics - from aggregate()
 * @returns {string}
 */
function formatMetrics(metrics) {
  return [
    `[sigmap] benchmark results:`,
    `  tasks       : ${metrics.tasks}`,
    `  hit@5       : ${(metrics.hitAt5 * 100).toFixed(1)}%`,
    `  MRR         : ${metrics.mrr.toFixed(3)}`,
    `  precision@5 : ${(metrics.precisionAt5 * 100).toFixed(1)}%`,
    `  avg tokens  : ${metrics.avgTokens}`,
  ].join('\n');
}

module.exports = { run, rank, loadTasks, buildSigIndex, formatTable, formatMetrics, tokenize };
