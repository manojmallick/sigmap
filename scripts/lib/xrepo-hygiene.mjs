#!/usr/bin/env node
'use strict';

/**
 * xrepo-hygiene.mjs — integrity checks for labelled third-party retrieval tasks.
 *
 * Static checks need no checkout (shape, leaks, answer eligibility); repo checks
 * need the pinned checkout and its zero-config index (the file exists, is
 * indexed, and the query does not copy phrasing out of its own answer).
 * Shared by the gate and the standalone checker so an authoring check and the
 * CI check can never disagree. Zero-dependency.
 *
 * WHAT MAY BE AN ANSWER is decided WITHOUT the ranker's own file classifiers
 * (src/util/file-class.js). Those classifiers demote tests, docs, mocks and
 * generated code at ranking time, and they misfire on real implementation:
 * `history.ts` and `security.py` read as docs, `test_harness.lua` as a test,
 * `core/build/` as build output. A corpus that excluded whatever the ranker
 * already calls non-source could never reveal that class of bug — the exact
 * failure this instrument exists to catch — so eligibility here is only what is
 * unambiguous: a conventional test/docs/example directory, a language's own
 * test-file naming, a machine-emitted marker, or a non-source extension.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { isGeneratedOutput } from './corpus-hygiene.mjs';

const require = createRequire(import.meta.url);
const { queryLeakage } = require('../../src/eval/corpus');
const { langFor } = require('../../src/extractors/dispatch');

/** Languages whose files are legitimate retrieval answers (not config or markup). */
export const ANSWER_LANGUAGES = new Set(['typescript', 'typescript_react', 'javascript', 'python', 'java', 'kotlin', 'go',
  'rust', 'csharp', 'cpp', 'objc', 'ruby', 'php', 'swift', 'dart', 'scala', 'astro', 'elixir', 'lua', 'gdscript', 'r',
  'vue_sfc', 'svelte']);

export const NGRAM = 4;
export const ID_FORM = /^x\d{3}$/;

// A path SEGMENT, anywhere: nobody labels `tests/foo.py` as the answer to a
// how-does question.
const NON_ANSWER_SEGMENT = /(^|\/)(tests?|__tests__|spec|specs|e2e|testdata|fixtures?|__fixtures__|mocks?|__mocks__|examples?|samples?|docs?|documentation|benchmarks?|scripts|\.github|\.circleci|\.gitlab)(\/|$)/i;
// Test-file naming that is unambiguous FOR ITS LANGUAGE. `test_*` is a pytest
// convention, so it is only read as a test for Python.
const TEST_NAME = [
  /\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte)$/,
  /_test\.(go|rs|rb|exs?|dart|lua|php|py)$/,
  /(^|\/)test_[^/]+\.py$/,
  /[a-z0-9](Test|Tests|Spec|Specs|IT)\.(java|kt|kts|scala|groovy|cs|swift)$/,
  /_spec\.rb$/,
];

/** Why a path cannot be a labelled answer, or null when it can. */
export function whyNotAnAnswer(p) {
  if (NON_ANSWER_SEGMENT.test(p)) return 'in a test, docs, example or tooling directory';
  if (TEST_NAME.some((re) => re.test(p))) return 'named like a test file';
  // Build output only as a TOP-LEVEL directory: `src/core/build/` is an
  // implementation package, not output (see corpus-hygiene.mjs).
  if (isGeneratedOutput(p)) return 'a generated or build-output file';
  return null;
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);

/**
 * Problems that need no checkout: shape, answer eligibility, basename leak.
 * @param {object} t one task
 * @param {Set<string>} [repoNames] manifest names; when given, `repo` must be one
 * @returns {Array<{id:string, kind:string, detail:string}>}
 */
export function staticProblems(t, repoNames) {
  const out = [];
  const id = t.id || `line ${t._line || '?'}`;
  const add = (kind, detail) => out.push({ id, kind, detail });
  if (!ID_FORM.test(t.id || '')) add('schema', 'id must look like x001');
  if (repoNames && !repoNames.has(t.repo)) add('schema', `repo ${JSON.stringify(t.repo)} is not in the manifest`);
  if (words(t.query).length < 6) add('schema', 'query must be a sentence of at least 6 words');
  if (/[\\/]|\.(go|py|js|ts|tsx|rs|kt|java|swift|ex|exs|lua|gd|astro|php|cs|dart|rb)\b/i.test(t.query || '')) add('schema', 'query contains a path or file extension');
  if (typeof t.rationale !== 'string' || t.rationale.trim().length < 40) add('schema', 'rationale must explain the choice (>= 40 chars)');
  const files = t.expected_files;
  if (!Array.isArray(files) || files.length < 1 || files.length > 3 || new Set(files).size !== files.length) {
    add('schema', 'expected_files must hold 1-3 distinct paths');
    return out;
  }
  for (const f of files) {
    if (typeof f !== 'string' || /^\.?\//.test(f) || f.includes('\\')) { add('schema', `${f}: must be a repo-relative forward-slash path`); continue; }
    const why = whyNotAnAnswer(f);
    if (why) add('not-an-answer', `${f} is ${why}`);
    const lang = langFor(f);
    if (!lang || !ANSWER_LANGUAGES.has(lang)) add('language', `${f} is not an answer language (${lang || 'no extractor'})`);
  }
  const leak = queryLeakage(t.query || '', files);
  if (!leak.clean) add('basename-leak', `query shares ${JSON.stringify(leak.leaked)} with an expected file's name`);
  return out;
}

/**
 * Does every expected file exist in the checkout? Needs no index, so an author
 * can check it without running anything that ranks.
 * @param {{tasks:object[], dir:string}} p
 */
export function existenceProblems({ tasks, dir }) {
  const out = [];
  for (const t of tasks) {
    const id = t.id || `line ${t._line || '?'}`;
    for (const f of t.expected_files || []) {
      const abs = path.join(dir, f);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) out.push({ id, kind: 'missing-file', file: f, detail: `${f} does not exist at the pin` });
    }
  }
  return out;
}

/**
 * Problems that need the pinned checkout and its zero-config index.
 * @param {{tasks:object[], index:Map<string,string[]>, dir:string}} p
 * @returns {Array<{id:string, kind:string, detail:string}>}
 */
export function repoProblems({ tasks, index, dir }) {
  const out = existenceProblems({ tasks, dir });
  const missing = new Set(out.map((p) => `${p.id}\u0000${p.file}`));
  for (const t of tasks) {
    const id = t.id || `line ${t._line || '?'}`;
    for (const f of t.expected_files || []) {
      if (missing.has(`${id}\u0000${f}`)) continue;
      if (!index.has(f)) { out.push({ id, kind: 'unindexed', file: f, detail: `${f} is not in the zero-config index` }); continue; }
      const hay = norm((index.get(f) || []).join(' '));
      const w = norm(t.query).split(' ').filter(Boolean);
      for (let i = 0; i + NGRAM <= w.length; i++) {
        const gram = w.slice(i, i + NGRAM).join(' ');
        if (hay.includes(gram)) { out.push({ id, kind: 'verbatim', file: f, detail: `${NGRAM}-gram "${gram}" appears in ${f}` }); break; }
      }
    }
  }
  return out;
}
