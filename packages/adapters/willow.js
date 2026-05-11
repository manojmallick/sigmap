'use strict';

/**
 * Willow adapter — writes SigMap context to Willow MCP knowledge store.
 *
 * Instead of writing a flat .willow-context.md file, this adapter sends
 * signature atoms to a Willow MCP server (https://github.com/rudi193-cmd/willow-1.9)
 * via HTTP POST. Each indexed file becomes a searchable knowledge atom.
 *
 * Contract:
 *   format(context, opts?) → string   (markdown for display/debug)
 *   outputPath(cwd)        → string   (placeholder — no file written)
 *   write(context, cwd, opts?) → Promise<void> (POSTs to Willow MCP, must await)
 *
 * Configuration (env vars or opts):
 *   WILLOW_MCP_URL   — MCP server base URL (default: http://localhost:8000)
 *   WILLOW_AGENT     — agent namespace (default: sigmap)
 *   WILLOW_TIMEOUT   — fetch timeout in ms (default: 30000)
 *   WILLOW_MAX_ATOM_SIZE — max atom size in bytes (default: 100000)
 *   WILLOW_RETRIES   — max retry attempts for transient failures (default: 3)
 */

const crypto = require('crypto');
const name = 'willow';
const DEFAULT_MCP_URL = 'http://localhost:8000';
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_ATOM_SIZE = 100000;
const DEFAULT_RETRIES = 3;

/**
 * Format SigMap context as markdown for display or debug.
 * @param {string} context - Raw SigMap context string
 * @param {object} [opts] - Unused; reserved for future options
 * @returns {string}
 */
function format(context, opts = {}) {
  if (!context || typeof context !== 'string') return '';
  const ts = new Date().toISOString();
  return `<!-- SigMap Willow context — ${ts} -->\n\n${context}`;
}

/**
 * Return the placeholder output path (no file is written by this adapter).
 * @param {string} cwd - Working directory
 * @returns {string}
 */
function outputPath(cwd) {
  return '.willow-context.md';
}

/**
 * Generate a cryptographically strong ID for an atom.
 * Uses SHA256 hash of the filepath to ensure uniqueness and prevent collisions.
 * @param {string} filepath - File path to hash
 * @returns {string} - sigmap-{32-char-hex}
 */
function generateAtomId(filepath) {
  const hash = crypto
    .createHash('sha256')
    .update(filepath)
    .digest('hex');
  return `sigmap-${hash}`;
}

/**
 * Fetch with timeout support.
 * @param {string} url - URL to fetch
 * @param {object} opts - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * POST an atom to Willow with exponential backoff retry.
 * @param {object} atom - Atom to ingest
 * @param {string} mcpUrl - MCP server URL
 * @param {number} timeoutMs - Fetch timeout
 * @param {number} maxRetries - Max retry attempts
 * @returns {Promise<boolean>} - True if succeeded, false if all retries exhausted
 */
async function postAtomWithRetry(atom, mcpUrl, timeoutMs, maxRetries) {
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetchWithTimeout(
        `${mcpUrl}/tools/call`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'willow_knowledge_ingest',
            arguments: {
              app_id: atom.agent,
              title: atom.title,
              summary: atom.summary,
              domain: atom.domain,
              source_type: atom.source_type,
              category: 'code',
              record_id: atom.id,
            },
          }),
        },
        timeoutMs,
      );

      if (resp.ok) {
        return true;
      }

      if (resp.status >= 500) {
        lastErr = new Error(`HTTP ${resp.status}`);
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));
          continue;
        }
      } else {
        process.stderr.write(`[willow-adapter] ${atom.id}: HTTP ${resp.status} (not retryable)\n`);
        return false;
      }
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  process.stderr.write(
    `[willow-adapter] ${atom.id}: failed after ${maxRetries} attempts: ${lastErr?.message || 'unknown'}\n`,
  );
  return false;
}

/**
 * POST each file section from SigMap context to the Willow MCP knowledge store.
 * Each `## filepath` section becomes one searchable knowledge atom.
 * Failures are per-atom and logged to stderr; function never throws.
 * IMPORTANT: This is async — caller MUST await write() before process exit.
 *
 * @param {string} context - Raw SigMap context string
 * @param {string} cwd - Working directory (used as project label)
 * @param {object} [opts] - Optional overrides: { mcpUrl, agent, timeoutMs, maxAtomSize, maxRetries }
 * @returns {Promise<void>}
 */
async function write(context, cwd, opts = {}) {
  if (!context) return;

  const mcpUrl = opts.mcpUrl || process.env.WILLOW_MCP_URL || DEFAULT_MCP_URL;
  const agent = opts.agent || process.env.WILLOW_AGENT || 'sigmap';
  const timeoutMs = opts.timeoutMs || parseInt(process.env.WILLOW_TIMEOUT, 10) || DEFAULT_TIMEOUT_MS;
  const maxAtomSize = opts.maxAtomSize || parseInt(process.env.WILLOW_MAX_ATOM_SIZE, 10) || DEFAULT_MAX_ATOM_SIZE;
  const maxRetries = opts.maxRetries || parseInt(process.env.WILLOW_RETRIES, 10) || DEFAULT_RETRIES;

  const sections = context.split(/\n(?=##\s)/);
  const atoms = sections
    .map((section) => {
      const titleMatch = section.match(/^##\s+(.+)/);
      if (!titleMatch) return null;

      const title = titleMatch[1].trim();
      const contentSize = section.length;

      if (contentSize > maxAtomSize) {
        process.stderr.write(`[willow-adapter] ${title}: oversized (${contentSize} > ${maxAtomSize} bytes)\n`);
        return null;
      }

      return {
        id: generateAtomId(title),
        title,
        summary: `${title} (${contentSize} bytes)`,
        content: section.trim(),
        domain: 'code',
        source_type: 'sigmap',
        agent,
        project: cwd ? require('path').basename(cwd) : 'unknown',
      };
    })
    .filter(Boolean);

  if (!atoms.length) return;

  await Promise.all(
    atoms.map((atom) => postAtomWithRetry(atom, mcpUrl, timeoutMs, maxRetries).catch((err) => {
      process.stderr.write(`[willow-adapter] ${atom.id}: unexpected error: ${err.message}\n`);
    })),
  );
}

module.exports = { name, format, outputPath, write };
