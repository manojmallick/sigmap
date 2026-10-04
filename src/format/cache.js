'use strict';

/**
 * Format context output for Anthropic prompt cache API.
 *
 * Usage:
 *   const { formatCache } = require('./src/format/cache');
 *   const json = formatCache(markdownContent, { ttl: '1h' });
 *   // json is a ready-to-use Anthropic `system` array
 *
 * The array is two blocks: the stable body carrying `cache_control`, then the
 * volatile tail (recent commits, routing hints) without it, so a new commit
 * only re-bills the tail. A legacy-layout file has no boundary and comes out
 * as one cached block.
 *
 * Writes: .github/copilot-instructions.cache.json
 */

const { buildSystemBlocks, cacheControl, DEFAULT_TTL } = require('./cache-layout');

/**
 * Wrap markdown context as an Anthropic `system` array.
 * @param {string} content - Markdown content from formatOutput()
 * @param {{ ttl?: '5m'|'1h' }} [opts]
 * @returns {string} - JSON string: the `system` content blocks
 */
function formatCache(content, opts = {}) {
  if (!content || typeof content !== 'string') content = '';
  const ttl = (opts && opts.ttl) || DEFAULT_TTL;
  let blocks = buildSystemBlocks(content, { ttl });
  // Nothing to split on and nothing to say: keep one (empty) cached block so
  // the output is still a well-formed system array.
  if (!blocks.length) blocks = [{ type: 'text', text: content, cache_control: cacheControl(ttl) }];
  return JSON.stringify(blocks, null, 2);
}

/**
 * Wrap markdown context in a full Anthropic messages API payload.
 * Includes the system array with cache_control so it can be copy-pasted
 * directly into an API call.
 * @param {string} content - Markdown content from formatOutput()
 * @param {string} [model] - Anthropic model ID (default: claude-opus-4-5)
 * @param {{ ttl?: '5m'|'1h' }} [opts]
 * @returns {string} - JSON string: { model, system: [...] }
 */
function formatCachePayload(content, model, opts = {}) {
  if (!content || typeof content !== 'string') content = '';
  const ttl = (opts && opts.ttl) || DEFAULT_TTL;
  const system = JSON.parse(formatCache(content, { ttl }));
  const payload = {
    model: model || 'claude-opus-4-5',
    system,
    messages: [],
  };
  return JSON.stringify(payload, null, 2);
}

module.exports = { formatCache, formatCachePayload };
