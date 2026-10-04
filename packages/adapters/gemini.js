'use strict';

/**
 * Gemini adapter — formats context as a Gemini system instruction.
 * Use the output as the `system_instruction` field in a Gemini API request.
 *
 * Example usage:
 *   const { format } = require('sigmap/adapters/gemini');
 *   const instruction = format(context);
 *   // Pass to: genAI.getGenerativeModel({ model: 'gemini-pro', systemInstruction: instruction })
 *
 * Contract:
 *   format(context, opts?) → string
 *   outputPath(cwd) → string
 */

const path = require('path');
const fs = require('fs');
const { replaceManagedSection } = require('../../src/util/managed-section');

const name = 'gemini';

/**
 * Format context as a Gemini system instruction.
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
  // Stable-prefix layout (#683): the date trails the content, not heads it.
  const stampAtTail = opts.cacheLayout !== 'legacy';
  return [
    `You are a coding assistant with complete knowledge of this codebase.`,
    stampAtTail
      ? `The following code signatures were extracted by SigMap v${version}.`
      : `The following code signatures were extracted by SigMap v${version} on ${timestamp}.`,
    `<!-- ${meta} -->`,
    projectLine,
    `These signatures represent every public function, class, and type in the project.`,
    `Refer to them when answering questions about code structure, APIs, and implementation.`,
    `## Code Signatures`,
    ``,
    context,
    ...(stampAtTail ? [`<!-- Updated: ${timestamp} -->`] : []),
  ].join('\n');
}

/**
 * Return the output file path for this adapter.
 * @param {string} cwd - Project root
 * @returns {string}
 */
function outputPath(cwd) {
  return path.join(cwd, '.github', 'gemini-context.md');
}

/**
 * Write signatures into gemini-context.md using append-under-marker.
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

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, newContent, 'utf8');
}

function _confidenceMeta(opts) {
  const parts = [`version=${opts.version || 'unknown'}`];
  if (opts.confidence)    parts.push(`confidence=${opts.confidence}`);
  if (opts.coverage != null) parts.push(`coverage=${opts.coverage}%`);
  if (opts.dropped  != null) parts.push(`dropped=${opts.dropped}`);
  if (opts.commit)        parts.push(`commit=${opts.commit}`);
  return `sigmap: ${parts.join(' ')}`;
}

module.exports = { name, format, outputPath, write };
