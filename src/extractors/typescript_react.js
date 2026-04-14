'use strict';

/**
 * Extract React component signatures from .tsx files.
 * Captures component props interfaces, hooks usage, and exports.
 *
 * @param {string} src - Raw TypeScript/TSX content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Remove comments to simplify matching
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  // Component function declarations
  const compRe = /(?:export\s+)?(?:const|function)\s+([A-Z]\w*)\s*(?:<[^>]*>)?\s*\(\s*(?:props|{\s*[^}]*})?/g;
  for (const m of stripped.matchAll(compRe)) {
    sigs.push(`component ${m[1]}`);
  }

  // Props interfaces: interface SomeProps { ... }
  const propsRe = /interface\s+(\w*Props)\s*(?:<[^>]*>)?\s*{/g;
  for (const m of stripped.matchAll(propsRe)) {
    sigs.push(`props ${m[1]}`);
  }

  // React hooks (useState, useEffect, useContext, useCallback, useMemo, useReducer)
  const hookRe = /use([A-Z]\w*)\s*(?:<[^>]*>)?\s*\(/g;
  const hooks = new Set();
  for (const m of stripped.matchAll(hookRe)) {
    hooks.add(m[1]);
  }
  for (const h of hooks) {
    sigs.push(`hook use${h}`);
  }

  // Import/export statements for components
  const exportRe = /export\s+(?:const|function|default|interface|type)\s+([A-Z]\w*)/g;
  for (const m of stripped.matchAll(exportRe)) {
    sigs.push(`export ${m[1]}`);
  }

  // Event handler patterns: onClick, onChange, onSubmit, etc
  const handlerRe = /on([A-Z]\w+)\s*=\s*{?\s*\(?[a-zA-Z_$]/g;
  const handlers = new Set();
  for (const m of stripped.matchAll(handlerRe)) {
    handlers.add(m[1]);
  }
  for (const h of handlers) {
    sigs.push(`handler on${h}`);
  }

  return Array.from(new Set(sigs)).slice(0, 50);
}

module.exports = { extract };
