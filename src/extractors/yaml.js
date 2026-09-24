'use strict';

const { capWithNotice } = require('../util/truncate');

// Ceiling sits above the default `maxSigsPerFile` so the configured budget
// governs output rather than a literal buried here, and omissions are disclosed (#576).
const PER_FILE_LIMIT = 200;

/**
 * Extract signatures from YAML configuration files.
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */
function extract(src) {
  if (!src || typeof src !== 'string') return [];

  // A workflow living outside its conventional path (vendored templates,
  // generator fixtures) still deserves semantic signatures rather than a bare
  // key list. The sniff is deliberately narrow so plain config never matches.
  try {
    const pipeline = require('./pipeline');
    if (pipeline.sniffPlatform(src)) {
      const routed = pipeline.extract(src, '');
      if (routed.length > 0) return routed;
    }
  } catch (_) { /* fall through to the generic key scan */ }

  const sigs = [];

  const lines = src.split('\n');

  // Top-level keys (no leading whitespace)
  const topKeys = [];
  for (const line of lines) {
    if (/^#/.test(line)) continue;
    const m = line.match(/^([\w-]+)\s*:/);
    if (m) topKeys.push(m[1]);
  }
  if (topKeys.length > 0) sigs.push(`keys: [${topKeys.slice(0, 12).join(', ')}]`);

  // GitHub Actions: jobs
  let inJobs = false;
  for (const line of lines) {
    if (/^jobs\s*:/.test(line)) { inJobs = true; continue; }
    if (inJobs && /^[a-z]/.test(line) && !line.startsWith('jobs')) inJobs = false;
    if (inJobs) {
      const m = line.match(/^  ([\w-]+)\s*:/);
      if (m) sigs.push(`job: ${m[1]}`);
    }
  }

  // Docker Compose: services
  let inServices = false;
  for (const line of lines) {
    if (/^services\s*:/.test(line)) { inServices = true; continue; }
    if (inServices && /^[a-z]/.test(line) && !line.startsWith('services')) inServices = false;
    if (inServices) {
      const m = line.match(/^  ([\w-]+)\s*:/);
      if (m) sigs.push(`service: ${m[1]}`);
    }
  }

  // OpenAPI paths
  let inPaths = false;
  for (const line of lines) {
    if (/^paths\s*:/.test(line)) { inPaths = true; continue; }
    if (inPaths && /^[a-z]/.test(line) && !line.startsWith('paths')) inPaths = false;
    if (inPaths) {
      const m = line.match(/^  (\/[\w/{}-]*)\s*:/);
      if (m) sigs.push(`path: ${m[1]}`);
    }
  }

  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

module.exports = { extract };
