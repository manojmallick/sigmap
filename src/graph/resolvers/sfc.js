'use strict';

/**
 * Single-file components: Vue, Svelte, Astro (#980).
 *
 * The imports of these files are ordinary ES imports; they sit in a `<script>` block
 * (Vue, Svelte) or in the frontmatter fence and `<script>` tags (Astro). This module
 * only finds that code. The graph builder resolves it with the same JS/TS resolver as
 * any other script, so relative paths, `tsconfig` aliases and extension-less
 * specifiers behave exactly as they do in a `.ts` file.
 *
 * Template markup, `<style>` blocks and component tags are not read: a tag
 * `<Child />` is an import only through the `import Child from './Child.vue'` that
 * names it, which is in the script.
 *
 * @module src/graph/resolvers/sfc
 */

const EXTS = new Set(['.vue', '.svelte', '.astro']);

const SCRIPT = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
const FENCE = /^﻿?[ \t]*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * The script source of a component file: every `<script>` body, and for Astro the
 * frontmatter before them. Returned as one string; import statements are line based.
 * @param {string} ext   '.vue' | '.svelte' | '.astro'
 * @param {string} content
 * @returns {string}
 */
function scriptOf(ext, content) {
  const parts = [];
  let body = content;
  if (ext === '.astro') {
    const f = FENCE.exec(content);
    if (f) { parts.push(f[1]); body = content.slice(f[0].length); }
  }
  SCRIPT.lastIndex = 0;
  let m;
  while ((m = SCRIPT.exec(body)) !== null) parts.push(m[1]);
  return parts.join('\n');
}

module.exports = { name: 'Vue/Svelte/Astro', EXTS, scriptOf };
