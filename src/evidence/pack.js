'use strict';

/**
 * Evidence Pack v1 (v8.0 E1).
 *
 * A deterministic, machine-consumable signature-and-evidence map. Replaces the
 * "paste this into your prompt" workflow with a byte-stable JSON artifact that
 * an agent or CI can ingest directly — every entry anchored to a real file,
 * symbol, and line range.
 *
 * Composed entirely from shipped zero-dep modules:
 *   - retrieval/ranker        → ranked files, scores, signals
 *   - extractors/line-anchor  → `:start-end` suffix parsing (sourceLines)
 *   - security/scanner        → secret redaction of symbols
 *   - crypto (node builtin)    → sha256 grounding hash
 *
 * Determinism: the pack carries NO wall-clock timestamp. Given an unchanged
 * repository, `buildEvidencePack` returns a byte-identical object, and
 * `grounding.contextHash` is stable. This is the point — the pack is auditable.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { buildSigIndex, rank, detectIntent } = require('../retrieval/ranker');
const { scan } = require('../security/scanner');

const SCHEMA_VERSION = '1.0';
const DEFAULT_BUDGET = 6000;
const DEFAULT_TOP = 12;

const GENERATED_RE = /(^|\/)(dist|build|out|vendor|node_modules)\/|\.(generated|min|bundle)\.|\.(pb|_pb)\.|\.pb\.go$|_pb2\.py$/;
const TEST_RE = /(^|\/)(tests?|__tests__|spec|specs)\/|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$|_test\.(go|py|rb)$/;
const CONFIG_RE = /\.(json|ya?ml|toml|ini|conf|config|properties|env)$|(^|\/)(\.?[a-z]+rc)$|\.config\.[a-z]+$/i;
const SECURITY_RE = /(^|\/|[._-])(auth|authn|authz|login|password|passwd|secret|credential|token|session|crypto|cipher|payment|billing|checkout|oauth|jwt|permission|acl|rbac)([._-]|\/|$)/i;

/**
 * Split a signature's `  :start-end` line anchor from its symbol text.
 * @param {string} sig
 * @returns {{ symbol: string, start: number|null, end: number|null }}
 */
function parseAnchor(sig) {
  const m = /\s*:(\d+)-(\d+)\s*$/.exec(sig);
  if (!m) return { symbol: sig.trim(), start: null, end: null };
  return {
    symbol: sig.slice(0, m.index).trim(),
    start: parseInt(m[1], 10),
    end: parseInt(m[2], 10),
  };
}

/**
 * Classify a file into a coarse risk label. Path-based heuristic (v1) — the
 * richer label set (C3) lands in v8.5.
 * @param {string} relPath
 * @returns {'generated'|'test'|'config'|'security'|'source'}
 */
function riskLabelFor(relPath) {
  const p = relPath.replace(/\\/g, '/');
  if (GENERATED_RE.test(p)) return 'generated';
  if (TEST_RE.test(p)) return 'test';
  if (SECURITY_RE.test(p)) return 'security';
  if (CONFIG_RE.test(p)) return 'config';
  return 'source';
}

/** Filename stem (basename minus the first extension chain). */
function stemOf(relPath) {
  const base = path.basename(relPath);
  return base.replace(/\.[^.]+$/, '').replace(/\.(test|spec)$/i, '');
}

/**
 * Best-effort impl→test discovery (v1). Matches test files whose stem equals
 * the implementation file's stem, by common convention. Deterministic. The
 * accuracy-measured discovery (C2) lands in v8.5.
 * @param {string} relPath
 * @param {string[]} allFiles  - universe of indexed files (relative paths)
 * @returns {string[]}
 */
function findRelatedTests(relPath, allFiles) {
  if (riskLabelFor(relPath) === 'test') return [];
  const stem = stemOf(relPath).toLowerCase();
  if (!stem) return [];
  const out = [];
  for (const f of allFiles) {
    if (f === relPath) continue;
    if (riskLabelFor(f) !== 'test') continue;
    if (stemOf(f).toLowerCase() === stem) out.push(f);
  }
  return out.sort();
}

/** Map a ranker `signals` object into a short human-readable reason string. */
function reasonFor(signals) {
  if (!signals) return 'ranked match';
  const parts = [];
  if (signals.symbolMatch > 0) parts.push('symbol-name match');
  if (signals.exactToken > 0) parts.push('exact token match');
  if (signals.prefixMatch > 0) parts.push('prefix match');
  if (signals.pathMatch > 0) parts.push('path match');
  if (signals.graphBoost > 0) parts.push('dependency-graph neighbor');
  if (signals.recencyBoost > 1) parts.push('recently changed');
  if (signals.learnedWeights && signals.learnedWeights !== 1) parts.push('learned weight');
  return parts.length ? parts.join('; ') : 'ranked match';
}

/** Token estimate for a signature block (matches the ranker's heuristic). */
function sigTokens(sigs) {
  return Math.ceil(sigs.join('\n').length / 4);
}

/**
 * Stable stringify with recursively sorted object keys, for hashing.
 * @param {*} value
 * @returns {string}
 */
function canonicalize(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}

/**
 * Build an Evidence Pack for a query.
 *
 * @param {string} query
 * @param {string} cwd
 * @param {object} [opts]
 * @param {number} [opts.budget=6000]      - token budget for included files
 * @param {number} [opts.top=12]           - max ranked files to consider
 * @param {Map<string,string[]>} [opts.sigIndex] - pre-built index (else built from cwd)
 * @returns {object} Evidence Pack v1
 */
function buildEvidencePack(query, cwd, opts = {}) {
  const budget = Number.isFinite(opts.budget) ? opts.budget : DEFAULT_BUDGET;
  const top = Number.isFinite(opts.top) ? opts.top : DEFAULT_TOP;

  const sigIndex = opts.sigIndex instanceof Map ? opts.sigIndex : buildSigIndex(cwd);
  const intent = detectIntent(query);
  const allFiles = Array.from(sigIndex.keys());

  const ranked = rank(query, sigIndex, { topK: top, cwd })
    .filter((r) => r.score > 0 || ranked0Empty(query));
  const maxScore = ranked.reduce((m, r) => Math.max(m, r.score), 0);

  // Greedy budget fill in rank order; the remainder is reported as dropped.
  const files = [];
  const droppedFiles = [];
  let used = 0;

  for (const r of ranked) {
    const tokens = sigTokens(r.sigs);
    if (files.length > 0 && used + tokens > budget) {
      droppedFiles.push({ path: r.file, reason: `budget: would exceed ${budget}-token limit` });
      continue;
    }
    used += tokens;

    const safe = scan(r.sigs, r.file).safe;
    const symbols = [];
    const sourceLines = [];
    for (const sig of safe) {
      const { symbol, start, end } = parseAnchor(sig);
      symbols.push(symbol);
      if (start !== null) sourceLines.push({ symbol, start, end });
    }

    files.push({
      path: r.file,
      symbols,
      reason: reasonFor(r.signals),
      confidence: maxScore > 0 ? Math.round((r.score / maxScore) * 100) / 100 : 0,
      sourceLines,
      relatedTests: findRelatedTests(r.file, allFiles),
      riskLabel: riskLabelFor(r.file),
    });
  }

  const symbolCount = files.reduce((n, f) => n + f.symbols.length, 0);
  const anchoredSymbols = files.reduce((n, f) => n + f.sourceLines.length, 0);

  const pack = {
    schemaVersion: SCHEMA_VERSION,
    query,
    intent,
    files,
    tokenBudget: { limit: budget, used, remaining: Math.max(0, budget - used) },
    droppedFiles,
    grounding: {
      symbolCount,
      anchoredSymbols,
      anchorCoverage: symbolCount > 0 ? Math.round((anchoredSymbols / symbolCount) * 1000) / 1000 : 0,
      contextHash: null,
      deterministic: true,
    },
  };

  // Hash everything except the hash field itself.
  const forHash = Object.assign({}, pack, {
    grounding: Object.assign({}, pack.grounding, { contextHash: undefined }),
  });
  pack.grounding.contextHash = 'sha256:' + crypto.createHash('sha256').update(canonicalize(forHash)).digest('hex');

  return pack;
}

// rank() returns [] for an empty/whitespace query; keep the filter readable.
function ranked0Empty(query) {
  return !query || !query.trim();
}

/** Pretty-printed canonical JSON rendering of a pack. */
function formatJSON(pack) {
  return JSON.stringify(pack, null, 2);
}

/** Markdown handoff rendering of a pack. */
function formatMarkdown(pack) {
  const L = [];
  L.push(`# Evidence Pack — \`${pack.query}\``);
  L.push('');
  L.push(`- **Schema:** v${pack.schemaVersion}`);
  L.push(`- **Intent:** ${pack.intent}`);
  L.push(`- **Budget:** ${pack.tokenBudget.used} / ${pack.tokenBudget.limit} tokens used (${pack.tokenBudget.remaining} remaining)`);
  L.push(`- **Grounding:** ${pack.grounding.anchoredSymbols}/${pack.grounding.symbolCount} symbols anchored (${Math.round(pack.grounding.anchorCoverage * 100)}%)`);
  L.push(`- **Hash:** \`${pack.grounding.contextHash}\``);
  L.push('');

  for (const f of pack.files) {
    L.push(`## \`${f.path}\`  _(${f.riskLabel}, confidence ${f.confidence})_`);
    L.push(`_${f.reason}_`);
    if (f.relatedTests.length) L.push(`Related tests: ${f.relatedTests.map((t) => `\`${t}\``).join(', ')}`);
    L.push('');
    L.push('```');
    for (const s of f.symbols) L.push(s);
    L.push('```');
    L.push('');
  }

  if (pack.droppedFiles.length) {
    L.push('## Dropped (over budget)');
    for (const d of pack.droppedFiles) L.push(`- \`${d.path}\` — ${d.reason}`);
    L.push('');
  }

  return L.join('\n');
}

module.exports = {
  buildEvidencePack,
  formatJSON,
  formatMarkdown,
  parseAnchor,
  riskLabelFor,
  findRelatedTests,
  SCHEMA_VERSION,
};
