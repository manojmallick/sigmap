'use strict';

/**
 * Extract signatures from Terraform (.tf / .tfvars) configuration files.
 * Captures resource, data, module, variable, output, locals, provider,
 * terraform blocks, and moved/import blocks.
 *
 * @param {string} src - Raw Terraform content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // Strip single-line comments
  const stripped = src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/#[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // resource "<type>" "<name>" { ... }
  for (const m of stripped.matchAll(/\bresource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g)) {
    sigs.push(`resource "${m[1]}" "${m[2]}"`);
  }

  // data "<type>" "<name>" { ... }
  for (const m of stripped.matchAll(/\bdata\s+"([^"]+)"\s+"([^"]+)"\s*\{/g)) {
    sigs.push(`data "${m[1]}" "${m[2]}"`);
  }

  // module "<name>" { ... }
  for (const m of stripped.matchAll(/\bmodule\s+"([^"]+)"\s*\{/g)) {
    sigs.push(`module "${m[1]}"`);
  }

  // variable "<name>" { ... }
  for (const m of stripped.matchAll(/\bvariable\s+"([^"]+)"\s*\{/g)) {
    sigs.push(`variable "${m[1]}"`);
  }

  // output "<name>" { ... }
  for (const m of stripped.matchAll(/\boutput\s+"([^"]+)"\s*\{/g)) {
    sigs.push(`output "${m[1]}"`);
  }

  // provider "<name>" { ... }
  for (const m of stripped.matchAll(/\bprovider\s+"([^"]+)"\s*\{/g)) {
    sigs.push(`provider "${m[1]}"`);
  }

  // locals { ... } (just mark presence; key names too noisy to enumerate)
  if (/\blocals\s*\{/.test(stripped)) {
    sigs.push('locals { ... }');
  }

  // terraform { required_providers / backend }
  if (/\bterraform\s*\{/.test(stripped)) {
    sigs.push('terraform { ... }');
  }

  // moved block
  for (const m of stripped.matchAll(/\bmoved\s*\{[\s\S]*?from\s*=\s*([^\n]+)/g)) {
    sigs.push(`moved from ${m[1].trim()}`);
  }

  // import block (Terraform 1.5+)
  for (const m of stripped.matchAll(/\bimport\s*\{[\s\S]*?to\s*=\s*([^\n]+)/g)) {
    sigs.push(`import to ${m[1].trim()}`);
  }

  return sigs;
}

module.exports = { extract };
