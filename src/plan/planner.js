'use strict';

const fs = require('fs');
const { buildFromCwd } = require('../graph/builder');
const { getImpact } = require('../graph/impact');
const { buildSigIndex, rank, detectIntent, _queryWants } = require('../retrieval/ranker');
const { tokenize: queryTokens } = require('../retrieval/tokenizer');
const { tokenize: stemTokens } = require('../retrieval/bm25');
const { buildTestCoverageIndex } = require('../analysis/test-coverage');
const { isTestFile, isMockFile, isCiFile, isDocsFile, isGeneratedFile, isGeneratedDir } = require('../util/file-class');

// "Likely to change" is the ranker's `high` confidence band only — a normalised
// score above 0.66 of the corpus range (see rank()). The list used to be the
// `medium` band (0.33–0.66), which by construction left out the files the task
// names and let in anything scoring a third of the top match (#774).
const CHANGE_CONFIDENCE = 'high';
const MAX_ENTRIES = 5;
const MAX_REASON_TERMS = 3;

module.exports = { createPlan, isChangeCandidate, matchReason, CHANGE_CONFIDENCE };

/**
 * Whether a ranked file can be something the task changes. Tests, fixtures, CI
 * and docs rank on shared vocabulary, so they stay off the list unless the task
 * asks for them — the same condition the ranker's own penalties use.
 */
function isChangeCandidate(file, wants) {
  if (isTestFile(file) || isMockFile(file)) return !!(wants && wants.tests);
  if (isCiFile(file)) return !!(wants && wants.ci);
  if (isDocsFile(file)) return !!(wants && wants.docs);
  return !(isGeneratedFile(file) || isGeneratedDir(file));
}

/**
 * Why a file is on the list, in the task's own words: which of them its path
 * and its signatures carry. A bare score cannot be discounted — "pattern" in a
 * path and "pattern" in an unrelated helper score alike — so each entry says
 * what matched and where.
 */
function matchReason(goal, file, sigs) {
  const inPath = new Set(stemTokens(file));
  const inSigs = new Set(stemTokens((sigs || []).join('\n')));
  const parts = [];
  const seen = new Set();
  for (const word of String(goal).split(/[^A-Za-z0-9_]+/).filter(Boolean)) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const stems = stemTokens(word);
    const path = stems.some((t) => inPath.has(t));
    const sig = stems.some((t) => inSigs.has(t));
    if (!path && !sig) continue;
    parts.push(`"${key}" in ${path && sig ? 'path and signatures' : path ? 'path' : 'signatures'}`);
    if (parts.length === MAX_REASON_TERMS) break;
  }
  return parts.length ? parts.join('; ') : 'no task word in its path or signatures';
}

function createPlan(goal, cwd, config = {}) {
  // Step 1: Detect intent and rank files for the goal
  const intent = detectIntent(goal);
  const sigIndex = buildSigIndex(cwd);
  if (sigIndex.size === 0) {
    return { error: 'no context found' };
  }

  const ranked = rank(goal, sigIndex, { topK: 15, cwd });

  // Step 2: what to read, and what the task is likely to edit. Both come from
  // the high-confidence band; the change list keeps only implementation files
  // and carries, per entry, its score relative to the top match and its reason.
  const highConf = ranked.filter(r => r.confidence === 'high').slice(0, MAX_ENTRIES);
  const wants = _queryWants(queryTokens(goal));
  const topScore = ranked.length ? ranked[0].score : 0;
  const change = ranked
    .filter(r => r.confidence === CHANGE_CONFIDENCE && isChangeCandidate(r.file, wants))
    .slice(0, MAX_ENTRIES)
    .map(r => ({
      file: r.file,
      score: topScore > 0 ? Math.round((r.score / topScore) * 100) / 100 : 0,
      reason: matchReason(goal, r.file, r.sigs),
    }));

  // Step 3: Impact radius — union the reverse-dependency blast radius of EVERY
  // high-confidence file (not just the top one), bounded to 3 hops. Note the
  // dependency graph resolves relative imports only, so this is a *lower bound*
  // on real coupling (aliased/bare/dynamic imports are invisible). Previously
  // this passed `{ maxDepth: 3 }`, which getImpact ignores — it reads `depth`,
  // so the traversal silently ran unbounded (depth 0). Fixed to `depth: 3`.
  let impact = null;
  if (highConf.length > 0) {
    try {
      const graph = buildFromCwd(cwd);
      // getImpact already returns repo-relative, original-case paths (it renders
      // lowercased graph keys through the graph's realPaths map). Only the
      // separator needs normalising so dedup against the entry set matches.
      const clean = (f) => String(f).replace(/\\/g, '/');
      const entrySet = new Set(highConf.map(r => r.file));
      const direct = new Set();
      const transitive = new Set();
      for (const r of highConf) {
        const imp = getImpact(r.file, graph, { depth: 3, cwd });
        for (const f of (imp.direct || [])) direct.add(clean(f));
        for (const f of (imp.transitive || [])) transitive.add(clean(f));
      }
      // The files we plan to change are not their own blast radius; and a file
      // reached directly from one entry outranks a transitive reach from another.
      for (const e of entrySet) { direct.delete(e); transitive.delete(e); }
      for (const f of direct) transitive.delete(f);
      impact = { direct: [...direct], transitive: [...transitive] };
    } catch (_) {
      // Graph build failed, continue without impact
    }
  }

  // Step 4: which of the files to inspect a test exercises, and which tests.
  // One index shared with `--analyze` (#862); it names the test files, which
  // the function-name token index used here before could not.
  const relatedTests = {};
  try {
    const coverage = buildTestCoverageIndex(cwd, { files: [...sigIndex.keys()], exclude: config.exclude });
    for (const r of highConf) {
      const tests = coverage.testsFor(r.file);
      if (tests.length) relatedTests[r.file] = tests;
    }
  } catch (_) {
    // Coverage index failed, continue without test info
  }
  const coveredFiles = Object.keys(relatedTests);

  return {
    goal,
    intent,
    inspectFirst: highConf.map(r => r.file),
    likelyToChange: change.map(c => c.file),
    // Same order as `likelyToChange`: { file, score, reason } per entry.
    likelyToChangeEvidence: change,
    impactRadius: impact,
    coveredFiles,
    // Covered source file → the test files that name or load it.
    relatedTests,
    // `testsAffected` retained for backward compatibility; it is the set of
    // covered source files. The test files themselves are in `relatedTests`.
    testsAffected: coveredFiles,
  };
}
