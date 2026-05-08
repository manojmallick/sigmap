'use strict';

/**
 * Willow adapter — writes SigMap context to Willow MCP knowledge store.
 *
 * Instead of writing a flat .willow-context.md file, this adapter sends
 * signature atoms to a Willow MCP server (https://github.com/sean-campbell/willow-1.9)
 * via HTTP POST. Each indexed file becomes a searchable knowledge atom.
 *
 * Contract:
 *   format(context, opts?) → string   (markdown for display/debug)
 *   outputPath(cwd)        → string   (placeholder — no file written)
 *   write(context, cwd, opts?) → void (POSTs to Willow MCP)
 *
 * Configuration (env vars or opts):
 *   WILLOW_MCP_URL   — MCP server base URL (default: http://localhost:8000)
 *   WILLOW_AGENT     — agent namespace (default: sigmap)
 */

const name = 'willow';
const DEFAULT_MCP_URL = 'http://localhost:8000';

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
  // No file written — context lives in Willow KB
  return '.willow-context.md';
}

/**
 * POST each file section from SigMap context to the Willow MCP knowledge store.
 * Each `## filepath` section becomes one searchable knowledge atom.
 * Failures are per-atom and logged to stderr; the function never throws.
 *
 * @param {string} context - Raw SigMap context string
 * @param {string} cwd - Working directory (used as project label)
 * @param {object} [opts] - Optional overrides: { mcpUrl, agent }
 * @returns {Promise<void>}
 */
async function write(context, cwd, opts = {}) {
  if (!context) return;

  const mcpUrl = opts.mcpUrl || process.env.WILLOW_MCP_URL || DEFAULT_MCP_URL;
  const agent = opts.agent || process.env.WILLOW_AGENT || 'sigmap';

  // Parse context blocks: each file section becomes one atom
  const sections = context.split(/\n(?=##\s)/);
  const atoms = sections
    .map((section) => {
      const titleMatch = section.match(/^##\s+(.+)/);
      if (!titleMatch) return null;
      return {
        id: `sigmap-${Buffer.from(titleMatch[1]).toString('hex').slice(0, 16)}`,
        title: titleMatch[1].trim(),
        content: section.trim(),
        domain: 'code',
        source_type: 'sigmap',
        project: cwd ? require('path').basename(cwd) : 'unknown',
      };
    })
    .filter(Boolean);

  if (!atoms.length) return;

  // POST each atom to Willow knowledge ingest endpoint
  for (const atom of atoms) {
    try {
      const resp = await fetch(`${mcpUrl}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'willow_knowledge_ingest',
          arguments: {
            app_id: agent,
            title: atom.title,
            content: atom.content,
            domain: atom.domain,
            source_type: atom.source_type,
            project: atom.project,
            record_id: atom.id,
          },
        }),
      });
      if (!resp.ok) {
        process.stderr.write(`[willow-adapter] ingest failed: ${resp.status}\n`);
      }
    } catch (err) {
      process.stderr.write(`[willow-adapter] ${err.message}\n`);
    }
  }
}

module.exports = { name, format, outputPath, write };
