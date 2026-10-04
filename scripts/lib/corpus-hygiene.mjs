#!/usr/bin/env node
'use strict';

/**
 * corpus-hygiene.mjs — which files can never be a labelled retrieval answer.
 *
 * A generated output is rewritten by tooling on nearly every source commit, so
 * a commit's touched-file list always contains it. Mined as ground truth it
 * labels a build artefact as "the answer": five mined tasks listed the bundled
 * `gen-context.js` as their only expected file and were unwinnable, although
 * the ranker returned the real implementation first (#883).
 *
 * Two classes, because `gen-context.js` is a hybrid — a generated bundle of
 * `src/` PLUS the hand-written CLI core (see scripts/build-bundle.mjs):
 *
 *   isGeneratedOutput  never a valid answer in ANY corpus: tooling-written
 *                      context artefacts, adapter outputs, llms*.txt, `.context/`
 *                      and machine-emitted sources.
 *   isBundle           invalid only as MINED ground truth, where "expected" means
 *                      "touched by the commit" and the bundle is regeneration
 *                      noise. A hand-labelled task may legitimately name it for
 *                      the CLI core (easy-corpus t006 does).
 *
 * Zero-dependency; path predicates only, no fs access.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { isGeneratedFile, isGeneratedDir } = require('../../src/util/file-class');

const norm = (p) => String(p || '').replace(/\\/g, '/');

// Adapter outputs by basename, anywhere in the tree: per-module strategies write
// a CLAUDE.md beside each package (packages/cli/CLAUDE.md), not only at the root.
const ADAPTER_OUTPUT = /^(CLAUDE\.md|AGENTS\.md|GEMINI\.md|\.cursorrules|\.windsurfrules|copilot-instructions\.md|llms?(-full)?\.txt)$/;

/** Tooling-written outputs that are never a valid retrieval answer. */
export function isGeneratedOutput(relPath) {
  const p = norm(relPath);
  if (/(^|\/)\.context(\/|$)/.test(p)) return true;
  if (ADAPTER_OUTPUT.test(p.slice(p.lastIndexOf('/') + 1))) return true;
  return isGeneratedFile(p) || isGeneratedDir(p);
}

/** The standalone bundle: generated `src/` modules wrapped around a hand-written core. */
export function isBundle(relPath) {
  return norm(relPath) === 'gen-context.js';
}

/** What the miner removes from a commit's touched files before it judges focus. */
export function isMinedNoise(relPath) {
  return isGeneratedOutput(relPath) || isBundle(relPath);
}
