'use strict';

/**
 * What the dependency graphs can and cannot read (#979).
 *
 * The import graph reads fifteen language families (eight, and seven more since #980)
 * and the method-level call graph seven (`GRAPH_FAMILIES`, `CALL_GRAPH_FAMILIES`). A file in any other
 * language contributes no edges, so a blast-radius query on it used to answer
 * "no importers found" — the same words as "nothing depends on this" — when
 * the truth is "this language is not tracked". Laravel's `Str.php`, imported by
 * 164 files, printed that.
 *
 * This module is the one place that tells the two apart. It is built on the
 * families the graphs themselves declare, so a language added there is
 * reported as tracked everywhere with no second list to forget.
 *
 * @module src/graph/language-support
 */

const fs = require('fs');
const path = require('path');
const { GRAPH_FAMILIES, GRAPH_EXTS, DEFAULT_SRC_DIRS, DEFAULT_WALK_DEPTH } = require('./builder');

/** The value of the machine-readable `graph` field and of the `graph:` token in text. */
const UNSUPPORTED = 'unsupported-language';

/** Display names for the extractor language keys the graphs cannot read. */
const LABELS = {
  php: 'PHP', csharp: 'C#', cpp: 'C/C++', objc: 'Objective-C', swift: 'Swift',
  dart: 'Dart', lua: 'Lua', gdscript: 'GDScript', vue_sfc: 'Vue', svelte: 'Svelte',
  astro: 'Astro', html: 'HTML', css: 'CSS', yaml: 'YAML', shell: 'Shell',
  powershell: 'PowerShell', sql: 'SQL', graphql: 'GraphQL', terraform: 'Terraform',
  protobuf: 'Protocol Buffers', toml: 'TOML', properties: '.properties', xml: 'XML',
  markdown: 'Markdown', dockerfile: 'Dockerfile', pipeline: 'CI pipeline',
  // Read by the import graph but not by the call graph, so a call-graph report can name them.
  ruby: 'Ruby', elixir: 'Elixir', r: 'R',
};

/**
 * Languages whose files are configuration, markup, queries or scripts: nobody
 * expects a module import graph for them, so `doctor` does not count them as a
 * gap. A blast-radius query on one of these files still gets the explicit
 * "not tracked" answer; only the census leaves them out.
 */
const NOT_EXPECTED = new Set([
  'html', 'css', 'yaml', 'toml', 'properties', 'xml', 'markdown', 'dockerfile',
  'pipeline', 'sql', 'graphql', 'terraform', 'protobuf', 'shell', 'powershell',
]);

/** "JavaScript/TypeScript, Python and R" from a family table. */
function familyList(families) {
  const names = families.map(([name]) => name);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The languages the import graph reads, as prose. */
function graphLanguageList() { return familyList(GRAPH_FAMILIES); }

/** The languages the method-level call graph reads, as prose. */
function callGraphLanguageList() { return familyList(require('./call-graph').CALL_GRAPH_FAMILIES); }

/**
 * Whether a graph can read a file, and what to call its language when it cannot.
 *
 * @param {string} file
 * @param {Set<string>} exts  the graph's extension set
 * @returns {{ tracked: boolean, key: string|null, label: string }}
 */
function support(file, exts) {
  const ext = path.extname(String(file || '')).toLowerCase();
  if (exts.has(ext)) return { tracked: true, key: null, label: '' };
  // Resolved only here, on the rare path, so a normal query never loads the extractors.
  const key = require('../extractors/dispatch').langFor(file);
  const label = (key && LABELS[key]) || (ext ? ext : 'this file type');
  return { tracked: false, key: key || null, label };
}

/** Can the import graph read this file? */
function graphSupport(file) { return support(file, GRAPH_EXTS); }

/** Can the method-level call graph read this file? */
function callGraphSupport(file) { return support(file, require('./call-graph').CALL_GRAPH_EXTS); }

/** "PHP imports" / "`.json` file imports" / "imports of this file type". */
function _subject(label) {
  if (label === 'this file type') return 'imports of this file type';
  return label.startsWith('.') ? `\`${label}\` file imports` : `${label} imports`;
}

/**
 * The explicit answer for a blast-radius query on a file the import graph
 * cannot read. Carries the `graph: unsupported-language` token so text-only
 * callers (the MCP tools return markdown) can still match it.
 */
function importNote(label) {
  const swift = label === 'Swift'
    ? ' Swift imports name modules (SwiftPM targets), not files, so no file-level edge is drawn; where a Package.swift declares the target, the files that import this file\'s module are listed below.'
    : '';
  return `graph: ${UNSUPPORTED} — ${_subject(label)} are not tracked (the import graph reads ${graphLanguageList()}). This is not evidence that nothing depends on this file.${swift}`;
}

/**
 * The same answer in one short clause, for the surfaces that print a blast
 * radius per file (diff context, PR evidence, verify-plan, `ask --with-source`,
 * `plan`): "PHP imports are not tracked (graph: unsupported-language); not
 * evidence that nothing depends on it".
 */
function shortNote(label) {
  return `${_subject(label)} are not tracked (graph: ${UNSUPPORTED}); not evidence that nothing depends on it`;
}

/** The same for a symbol declared in a file the call graph cannot read. */
function callNote(label, files) {
  const where = files && files.length ? ` in ${files.map((f) => `\`${f}\``).join(', ')}` : '';
  return `graph: ${UNSUPPORTED} — declared${where} (${label}); ${label} calls are not tracked (the call graph reads ${callGraphLanguageList()}). This is not evidence that nothing calls it.`;
}

/** What a call-graph search could not read, for a symbol it does not know. */
function unsearchedNote(unsearched) {
  const langs = unsearched.languages.slice(0, 4).map((l) => `${l.files.toLocaleString('en-US')} ${l.language}`).join(', ')
    + (unsearched.languages.length > 4 ? `, +${unsearched.languages.length - 4} more` : '');
  return `Not searched: ${langs} file(s) in the searched roots. The call graph reads ${callGraphLanguageList()}; if this symbol is declared in a language it does not read, its callers are not tracked.`;
}

/**
 * Mark an impact result whose target the import graph cannot read.
 *
 * Only an empty result for an unreadable file is marked: a file with importers
 * keeps its list, and every readable file's result is returned untouched, so
 * the output for supported languages does not change.
 *
 * A directory is not a file in a language, so it is never marked.
 *
 * @param {{ changed: string, totalImpact: number }} result
 * @param {{ cwd?: string }} [opts]  with `cwd`, a path that is a directory is left alone
 * @returns {object} the same object, with `graph` and `language` added when it applies
 */
function markImpact(result, opts) {
  if (!result || result.totalImpact > 0) return result;
  const cwd = opts && opts.cwd;
  if (cwd) {
    try { if (fs.statSync(path.resolve(cwd, result.changed)).isDirectory()) return result; } catch (_) { /* absent: judged by its extension */ }
  }
  const s = graphSupport(result.changed);
  if (!s.tracked) { result.graph = UNSUPPORTED; result.language = s.label; }
  return result;
}

/**
 * Count the files under a graph's walk roots by whether that graph reads them:
 * `doctor` for the import graph (same roots, exclusions and depth as
 * `buildFromCwd`), and the call-graph query for the roots it actually searched.
 *
 * @param {string} cwd
 * @param {object} [opts]  { srcDirs, exclude, maxDepth, exts } — `exts` is the
 *                         graph's extension set (default: the import graph's)
 * @returns {{ tracked: number, untracked: number, languages: Array<{ key: string, label: string, files: number }> }}
 */
function censusUntracked(cwd, opts) {
  const o = opts || {};
  const readable = o.exts || GRAPH_EXTS;
  let { srcDirs, exclude } = o;
  if (srcDirs === undefined) {
    const dirs = require('./src-dirs').resolveGraphDirs(cwd, DEFAULT_SRC_DIRS);
    srcDirs = dirs.srcDirs;
    if (exclude === undefined && dirs.exclude) exclude = dirs.exclude;
  }
  const excludeSet = new Set(exclude === undefined ? ['node_modules', '.git', 'dist', 'build'] : exclude);
  const maxDepth = o.maxDepth === undefined ? DEFAULT_WALK_DEPTH : o.maxDepth;
  const { EXT_MAP } = require('../extractors/dispatch');

  const seen = new Set();
  const byKey = new Map();
  let tracked = 0;
  const walk = (dir, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (excludeSet.has(e.name) || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, depth + 1); continue; }
      if (!e.isFile() || seen.has(full)) continue;
      seen.add(full);
      const ext = path.extname(e.name).toLowerCase();
      if (readable.has(ext)) { tracked++; continue; }
      const key = EXT_MAP[ext];
      if (!key || NOT_EXPECTED.has(key)) continue;
      byKey.set(key, (byKey.get(key) || 0) + 1);
    }
  };
  for (const sd of srcDirs) {
    const abs = path.resolve(cwd, sd);
    if (fs.existsSync(abs)) walk(abs, 0);
  }

  // `.c`, `.h`, `.cpp`… share one key: one row per language, not per extension.
  const languages = [...byKey.entries()]
    .map(([key, files]) => ({ key, label: LABELS[key] || key, files }))
    .sort((a, b) => b.files - a.files || (a.label < b.label ? -1 : 1));
  return { tracked, untracked: languages.reduce((n, l) => n + l.files, 0), languages };
}

module.exports = {
  UNSUPPORTED, LABELS, NOT_EXPECTED,
  graphSupport, callGraphSupport, graphLanguageList, callGraphLanguageList,
  importNote, shortNote, callNote, unsearchedNote, markImpact, censusUntracked,
};
