'use strict';

/**
 * Codex adapter — writes OpenAI-style context to AGENTS.md.
 *
 * This adapter reuses the same prompt format as the OpenAI adapter,
 * but targets AGENTS.md so Codex-style agents can read repository guidance.
 *
 * Contract:
 *   format(context, opts?) → string
 *   outputPath(cwd) → string
 *   write(context, cwd, opts?) → void
 */

const path = require('path');
const fs = require('fs');
const { replaceManagedSection } = require('../../src/util/managed-section');

const name = 'codex';

/**
 * Format context for AGENTS.md — clean markdown, no LLM preamble.
 * @param {string} context - Raw signature context string
 * @param {object} [opts]
 * @returns {string}
 */
function format(context, opts = {}) {
  if (!context || typeof context !== 'string' || !context.trim()) return '';
  return `# Code signatures\n\n${context}`;
}

/**
 * Return the output file path for this adapter.
 * @param {string} cwd - Project root
 * @returns {string}
 */
function outputPath(cwd) {
  return path.join(cwd, 'AGENTS.md');
}

/**
 * Write signatures into AGENTS.md using append-under-marker.
 * If marker exists, content above marker is preserved.
 * If legacy generated content exists without marker, replace it cleanly.
 * @param {string} context - Raw signature context string
 * @param {string} cwd - Project root
 * @param {object} [opts]
 */
function write(context, cwd, opts = {}) {
  const filePath = outputPath(cwd);
  let existing = '';
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf8');
  }

  const formatted = format(context, opts);
  // A mention of the marker in prose or a code block is never the marker, and
  // only a file that is ENTIRELY generated is replaced whole (#873).
  const placed = replaceManagedSection(existing, formatted, { legacy: true });
  if (placed.warning) console.warn(`[sigmap] ${path.relative(cwd, filePath)}: ${placed.warning}`);
  const newContent = placed.content;

  fs.writeFileSync(filePath, newContent, 'utf8');
}

module.exports = { name, format, outputPath, write };
