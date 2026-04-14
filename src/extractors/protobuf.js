'use strict';

/**
 * Extract signatures from Protocol Buffer (.proto) files.
 * Captures message, enum, service, rpc, oneof, extend definitions.
 *
 * @param {string} src - Raw .proto content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Strip single-line and block comments
  const stripped = src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // syntax / package / option (top-level metadata)
  const syntaxM = stripped.match(/\bsyntax\s*=\s*"([^"]+)"/);
  if (syntaxM) sigs.push(`syntax = "${syntaxM[1]}"`);

  const pkgM = stripped.match(/\bpackage\s+([\w.]+)\s*;/);
  if (pkgM) sigs.push(`package ${pkgM[1]}`);

  // message <Name> { ... }
  for (const m of stripped.matchAll(/\bmessage\s+(\w+)\s*\{/g)) {
    sigs.push(`message ${m[1]}`);
  }

  // enum <Name> { ... }
  for (const m of stripped.matchAll(/\benum\s+(\w+)\s*\{/g)) {
    sigs.push(`enum ${m[1]}`);
  }

  // service <Name> { ... }
  for (const m of stripped.matchAll(/\bservice\s+(\w+)\s*\{/g)) {
    sigs.push(`service ${m[1]}`);
  }

  // rpc <Name>(<Request>) returns (<Response>)
  for (const m of stripped.matchAll(
    /\brpc\s+(\w+)\s*\(\s*(stream\s+)?(\w+)\s*\)\s+returns\s*\(\s*(stream\s+)?(\w+)\s*\)/g
  )) {
    const req = `${m[2] || ''}${m[3]}`.trim();
    const res = `${m[4] || ''}${m[5]}`.trim();
    sigs.push(`rpc ${m[1]}(${req}) returns (${res})`);
  }

  // oneof <name>
  for (const m of stripped.matchAll(/\boneof\s+(\w+)\s*\{/g)) {
    sigs.push(`oneof ${m[1]}`);
  }

  // extend <TypeName>
  for (const m of stripped.matchAll(/\bextend\s+([\w.]+)\s*\{/g)) {
    sigs.push(`extend ${m[1]}`);
  }

  return sigs;
}

module.exports = { extract };
