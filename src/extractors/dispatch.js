'use strict';

const fs = require('fs');

/**
 * Bundle-safe extractor dispatch.
 *
 * `packages/core`'s extract() resolves extractors via dynamic `require(path.join(…))`,
 * which cannot run inside the standalone bundle (no filesystem `src/`). This module
 * uses STATIC requires so the bundler rewrites them to `__require` and the extractors
 * resolve from the bundled factories. Used by the live-index MCP write hooks.
 */

const path = require('path');
const pipeline = require('./pipeline');

// Static language → extractor map (every entry is a bundled factory).
const EXTRACTORS = {
  typescript: require('./typescript'),
  typescript_react: require('./typescript_react'),
  javascript: require('./javascript'),
  python: require('./python'),
  java: require('./java'),
  kotlin: require('./kotlin'),
  go: require('./go'),
  rust: require('./rust'),
  csharp: require('./csharp'),
  cpp: require('./cpp'),
  ruby: require('./ruby'),
  php: require('./php'),
  swift: require('./swift'),
  dart: require('./dart'),
  scala: require('./scala'),
  astro: require('./astro'),
  elixir: require('./elixir'),
  lua: require('./lua'),
  gdscript: require('./gdscript'),
  r: require('./r'),
  vue_sfc: require('./vue_sfc'),
  svelte: require('./svelte'),
  html: require('./html'),
  css: require('./css'),
  yaml: require('./yaml'),
  shell: require('./shell'),
  sql: require('./sql'),
  graphql: require('./graphql'),
  terraform: require('./terraform'),
  protobuf: require('./protobuf'),
  toml: require('./toml'),
  properties: require('./properties'),
  xml: require('./xml'),
  markdown: require('./markdown'),
  pipeline: require('./pipeline'),
  dockerfile: require('./dockerfile'),
  generic: require('./generic'),
};

/**
 * Extension → extractor module name. **The single source of truth for
 * extractor resolution** (#591).
 *
 * Anything that decides *which extractor module to load* must go through
 * `langFor` rather than declaring its own copy. Three copies existed and two
 * had drifted: `src/eval/analyzer.js` carried a dead duplicate `.vue` key, and
 * the `--diagnose-extractors` map pointed at `vue.js` after that module was
 * deleted — which is how an unreachable extractor survived unnoticed (#582).
 *
 * Not every extension map in the codebase belongs here. `language-detector.js`
 * maps `.tsx → typescript` for language *statistics*, and `dashboard.js` keeps
 * short display *labels*. Both are correct for their purpose and deliberately
 * differ from resolution — folding them in would miscount languages.
 */
const EXT_MAP = {
  '.ts': 'typescript', '.tsx': 'typescript_react',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.pyw': 'python',
  '.java': 'java',
  '.kt': 'kotlin', '.kts': 'kotlin',
  '.go': 'go',
  '.rs': 'rust',
  '.cs': 'csharp',
  '.cpp': 'cpp', '.c': 'cpp', '.h': 'cpp', '.hpp': 'cpp', '.cc': 'cpp',
  '.rb': 'ruby', '.rake': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.dart': 'dart',
  '.scala': 'scala', '.sc': 'scala',
  '.astro': 'astro',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.lua': 'lua',
  '.gd': 'gdscript',
  '.r': 'r', '.R': 'r',
  '.vue': 'vue_sfc',
  '.svelte': 'svelte',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'css', '.sass': 'css', '.less': 'css',
  '.yml': 'yaml', '.yaml': 'yaml',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell', '.fish': 'shell',
  '.sql': 'sql',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.tf': 'terraform', '.tfvars': 'terraform',
  '.proto': 'protobuf',
  '.toml': 'toml',
  '.properties': 'properties',
  '.xml': 'xml',
  '.md': 'markdown',
};

/** Resolve a language key from a file path/name. */
function langFor(filePathOrName) {
  const raw = String(filePathOrName || '');
  // CI/pipeline definitions route by PATH, ahead of the extension map:
  // `.github/workflows/ci.yml` is a workflow first and YAML second, and
  // `Jenkinsfile` has no extension at all. Resolution stays single-source —
  // this is a path rule, not a second extension map.
  if (pipeline.platformFor(raw)) return 'pipeline';
  const base = path.basename(raw);
  if (base === 'Dockerfile' || base.startsWith('Dockerfile.')) return 'dockerfile';
  const ext = path.extname(base).toLowerCase();
  return EXT_MAP[ext] || null;
}

/**
 * Extract signatures from a file's content using the right extractor.
 * @param {string} filePathOrName - path or name (extension drives the extractor)
 * @param {string} src - file content
 * @returns {string[]}
 */
function extractFile(filePathOrName, src) {
  if (!src || typeof src !== 'string') return [];
  const lang = langFor(filePathOrName);
  const mod = lang ? EXTRACTORS[lang] : null;
  if (!mod || typeof mod.extract !== 'function') return [];
  try {
    // Every extractor receives the path: python.js uses it to reach the native
    // AST tier (#693) and pipeline.js uses it to route by location; the rest
    // ignore the extra argument.
    //
    // Resolved to an absolute path when the file is on disk, because python's
    // AST pass shells out and needs a real path. When it is NOT on disk the
    // ORIGINAL string is passed rather than undefined, so path-routed
    // extraction still works for in-memory content (MCP write hooks, tests) —
    // `tryNativeExtract` returns null for a path it cannot read, so python
    // falls back to regex on its own.
    const abs = path.isAbsolute(filePathOrName) ? filePathOrName : path.resolve(filePathOrName);
    const fileArg = fs.existsSync(abs) ? abs : filePathOrName;
    const out = mod.extract(src, fileArg);
    return Array.isArray(out) ? out : [];
  } catch (_) {
    return [];
  }
}

module.exports = { extractFile, langFor, EXT_MAP };
