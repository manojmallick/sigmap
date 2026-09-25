'use strict';

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
    // Only the pipeline extractor takes the path as a second argument. It is
    // NOT passed blanket-wide: python's extract(src, filePath) would switch to
    // the native AST tier and change output for every caller of this function.
    const out = lang === 'pipeline' ? mod.extract(src, filePathOrName) : mod.extract(src);
    return Array.isArray(out) ? out : [];
  } catch (_) {
    return [];
  }
}

module.exports = { extractFile, langFor, EXT_MAP };
