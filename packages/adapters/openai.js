'use strict';

/**
 * OpenAI adapter — formats context as an OpenAI system message.
 * Use the output as the `content` field of a system role message.
 *
 * Example usage in code:
 *   const { format } = require('sigmap/adapters/openai');
 *   const systemPrompt = format(context);
 *   // Pass to: openai.chat.completions.create({ messages: [{ role: 'system', content: systemPrompt }] })
 *
 * Contract:
 *   format(context, opts?) → string
 *   outputPath(cwd) → string
 */

const path = require('path');

const name = 'openai';

/**
 * Format context as an OpenAI system prompt.
 * @param {string} context - Raw signature context string
 * @param {object} [opts]
 * @param {string} [opts.version] - SigMap version string
 * @param {string} [opts.projectName] - Optional project name
 * @returns {string}
 */
function format(context, opts = {}) {
  if (!context || typeof context !== 'string') return '';
  const version = opts.version || 'unknown';
  const timestamp = new Date().toISOString();
  const projectLine = opts.projectName
    ? `Project: ${opts.projectName}\n`
    : '';

  const meta = _confidenceMeta(opts);
  return [
    `You are a coding assistant with full knowledge of this codebase.`,
    `Below are the code signatures extracted by SigMap v${version} on ${timestamp}.`,
    `<!-- ${meta} -->`,
    projectLine,
    `Use these signatures to answer questions about the code accurately.`,
    `When the user asks about a specific file or function, refer to the signatures below.`,
    ``,
    `## Code Signatures`,
    ``,
    context,
  ].join('\n');
}

/**
 * Return the output file path for this adapter.
 * Writes a .openai-context.md file that can be loaded at runtime.
 * @param {string} cwd - Project root
 * @returns {string}
 */
function outputPath(cwd) {
  return path.join(cwd, '.github', 'openai-context.md');
}

function _confidenceMeta(opts) {
  const parts = [`version=${opts.version || 'unknown'}`];
  if (opts.confidence)    parts.push(`confidence=${opts.confidence}`);
  if (opts.coverage != null) parts.push(`coverage=${opts.coverage}%`);
  if (opts.dropped  != null) parts.push(`dropped=${opts.dropped}`);
  if (opts.commit)        parts.push(`commit=${opts.commit}`);
  return `sigmap: ${parts.join(' ')}`;
}

module.exports = { name, format, outputPath };
