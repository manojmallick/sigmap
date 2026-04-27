'use strict';

const path = require('path');
const fs = require('fs');
const { buildFromCwd } = require('../graph/builder');
const { getImpact } = require('../graph/impact');
const { buildSigIndex, rank, detectIntent } = require('../retrieval/ranker');
const { buildTestIndex, isTested } = require('../extractors/coverage');

module.exports = { createPlan };

function createPlan(goal, cwd, config) {
  // Step 1: Detect intent and rank files for the goal
  const intent = detectIntent(goal);
  const sigIndex = buildSigIndex(cwd);
  if (sigIndex.size === 0) {
    return { error: 'no context found' };
  }

  const ranked = rank(goal, sigIndex, { topK: 15, cwd });

  // Step 2: Separate into confidence levels
  const highConf = ranked.filter(r => r.confidence === 'high').slice(0, 5);
  const medConf = ranked.filter(r => r.confidence === 'medium').slice(0, 5);

  // Step 3: Compute impact radius for highest-confidence file
  let impact = null;
  if (highConf.length > 0) {
    const entryFile = highConf[0].file;
    try {
      const graph = buildFromCwd(cwd);
      impact = getImpact(entryFile, graph, { maxDepth: 3, cwd });
    } catch (_) {
      // Graph build failed, continue without impact
    }
  }

  // Step 4: Identify likely-affected tests
  let testedFiles = [];
  try {
    const testIndex = buildTestIndex(cwd, config.testDirs || ['test', 'tests', '__tests__', 'spec']);
    testedFiles = highConf.filter(r => {
      const sigs = r.sigs || [];
      const fnNames = sigs.map(s => {
        const m = s.match(/(?:function|def|fn)\s+(\w+)/);
        return m ? m[1] : null;
      }).filter(Boolean);
      return fnNames.some(fn => isTested(fn, testIndex));
    });
  } catch (_) {
    // Coverage index failed, continue without test info
  }

  return {
    goal,
    intent,
    inspectFirst: highConf.map(r => r.file),
    likelyToChange: medConf.map(r => r.file),
    impactRadius: impact ? {
      direct: [...(impact.direct || [])],
      transitive: [...(impact.transitive || [])],
    } : null,
    testsAffected: testedFiles.map(r => r.file),
  };
}
