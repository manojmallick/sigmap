'use strict';

/**
 * Extract signatures from GraphQL schema / operation files.
 * Captures type, interface, enum, input, union, scalar, query, mutation,
 * subscription, fragment definitions.
 *
 * @param {string} src - Raw GraphQL content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Strip comments (# style)
  const stripped = src.replace(/#[^\n]*/g, '');

  // Schema type definitions: type Foo [implements Bar] { ... }
  for (const m of stripped.matchAll(
    /\b(type|interface|input)\s+(\w+)(?:\s+implements\s+([\w\s&]+))?\s*\{/g
  )) {
    const implements_ = m[3] ? ` implements ${m[3].trim().replace(/\s+/g, ' ')}` : '';
    sigs.push(`${m[1]} ${m[2]}${implements_}`);
  }

  // enum
  for (const m of stripped.matchAll(/\benum\s+(\w+)\s*\{/g)) {
    sigs.push(`enum ${m[1]}`);
  }

  // union
  for (const m of stripped.matchAll(/\bunion\s+(\w+)\s*=/g)) {
    sigs.push(`union ${m[1]}`);
  }

  // scalar
  for (const m of stripped.matchAll(/\bscalar\s+(\w+)/g)) {
    sigs.push(`scalar ${m[1]}`);
  }

  // extend type / extend interface
  for (const m of stripped.matchAll(/\bextend\s+(type|interface)\s+(\w+)/g)) {
    sigs.push(`extend ${m[1]} ${m[2]}`);
  }

  // Query / Mutation / Subscription operations
  for (const m of stripped.matchAll(
    /\b(query|mutation|subscription)\s+(\w+)\s*(?:\([^)]*\))?\s*\{/g
  )) {
    sigs.push(`${m[1]} ${m[2]}`);
  }

  // Named fragments
  for (const m of stripped.matchAll(/\bfragment\s+(\w+)\s+on\s+(\w+)/g)) {
    sigs.push(`fragment ${m[1]} on ${m[2]}`);
  }

  // Top-level schema { query: ... }
  if (/\bschema\s*\{/.test(stripped)) {
    sigs.push('schema { ... }');
  }

  return sigs;
}

module.exports = { extract };
