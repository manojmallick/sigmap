'use strict';

/**
 * Path-only entries for source files the extractors read nothing from.
 *
 * The retrieval index lists what a file declares and exports. A file whose extractor finds
 * nothing (`export default new Plugin()`, a script with no exports, a Rust binary with no `pub`
 * item, a module of constants) has no line in it, so the ranker cannot return it at all, not even
 * for a question that names it: the path, which the ranker weighs three times as much as a word
 * in a signature, never gets a chance. In the 222 held-out questions of the agent study, 18 had
 * an expected file that was in this state (docs-vp/guide/agent-study-protocol.md, Stage H).
 *
 * `generate` records such a file under `bare` in `.context/sig-index.json` (src/retrieval/
 * sig-index-store.js), and `buildSigIndex(cwd, { bare: true })` returns it as an entry with no
 * signatures. Only the callers that rank ask for it. The context file handed to an agent is not
 * changed by it, and neither is any tool that lists or counts what the index holds.
 *
 * What counts is decided here and nowhere else, and is fixed, not tuned:
 *   - a programming language (not data or markup: no YAML, TOML, XML, HTML, CSS, Markdown, SQL);
 *   - not a test, a mock, generated, minified or a declaration file (these are ranked down or
 *     kept out of the context already);
 *   - at least MIN_LINES non-blank lines, so an empty `__init__.py` or a one-line shim is not an entry.
 *
 * Zero dependencies. Pure: the same path and text give the same answer.
 */

const { langFor } = require('../extractors/dispatch');
const { isTestFile, isMockFile, isGeneratedFile } = require('../util/file-class');

const MIN_LINES = 5;

/** The extractor names of EXTRACTORS/EXT_MAP (src/extractors/dispatch.js) that are programming languages. */
const PROGRAMMING = new Set([
  'typescript', 'typescript_react', 'javascript', 'python', 'java', 'kotlin', 'go', 'rust', 'csharp', 'cpp',
  'objc', 'ruby', 'php', 'swift', 'dart', 'scala', 'elixir', 'lua', 'gdscript', 'r', 'astro', 'vue_sfc', 'svelte',
  'shell', 'powershell',
]);

const DECLARATION_OR_MINIFIED = /\.d\.[cm]?ts$|\.min\.[cm]?js$/;

/**
 * Whether a path could be a path-only entry. Cheap and free of I/O, so a caller can test it before
 * reading the file.
 * @param {string} rel path relative to the project root
 * @returns {boolean}
 */
function isBareLanguage(rel) {
  const p = String(rel || '').replace(/\\/g, '/');
  if (!PROGRAMMING.has(langFor(p))) return false;
  if (DECLARATION_OR_MINIFIED.test(p)) return false;
  return !(isTestFile(p) || isMockFile(p) || isGeneratedFile(p));
}

/**
 * @param {string} rel path relative to the project root
 * @param {string} content the file's text
 * @returns {boolean} true when the file should be recorded as a path-only entry
 */
function isBareCandidate(rel, content) {
  if (typeof content !== 'string' || !isBareLanguage(rel)) return false;
  let lines = 0;
  for (const line of content.split('\n')) {
    if (/\S/.test(line) && ++lines >= MIN_LINES) return true;
  }
  return false;
}

module.exports = { isBareCandidate, isBareLanguage, MIN_LINES, PROGRAMMING };
