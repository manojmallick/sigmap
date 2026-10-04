'use strict';

/**
 * Cache-stable context layout (#683).
 *
 * A provider's prompt cache matches on an exact prefix: the first byte that
 * differs ends the hit, and everything after it is billed as new input. The
 * generated context used to put a block that changes on every commit — and a
 * relative age that changed on every run — ahead of the whole signature body,
 * so the body could never be a cache hit.
 *
 * `cacheLayout: "stable-prefix"` (the default) therefore orders every output
 * as:  stable body  ->  VOLATILE_MARKER  ->  volatile tail. The marker is an
 * invisible HTML comment; it is also what `--format cache` splits on, so the
 * stable/volatile boundary is one fact in one place rather than a heading
 * heuristic each consumer re-derives.
 *
 * This module owns that boundary, the two config enums, the Anthropic
 * two-block payload, and the per-model fit-check. It reads cache minimums from
 * the model profile (src/config/models.js) and keeps no model literal of its own.
 */

const { lookup, tokenBasis, DEFAULT_CHARS_PER_TOKEN } = require('../config/models');

// Ends the stable body. Everything after it may change run to run.
const VOLATILE_MARKER = '<!-- sigmap:volatile -->';

const LAYOUTS = ['stable-prefix', 'legacy'];
const DEFAULT_LAYOUT = 'stable-prefix';

// Exactly the values Anthropic's `cache_control.ttl` accepts.
const CACHE_TTLS = ['5m', '1h'];
const DEFAULT_TTL = '5m';

// A prefix within this share of a model's minimum is too close to call: SigMap
// counts characters, the provider counts tokens.
const BORDERLINE_BAND = 0.15;

/**
 * The layout in force. An unrecognised value falls back to the default and is
 * reported, never silently trusted.
 * @param {object} [config]
 * @returns {{ value: 'stable-prefix'|'legacy', invalid: string|null }}
 */
function resolveLayout(config) {
  const raw = config && config.cacheLayout;
  if (raw == null) return { value: DEFAULT_LAYOUT, invalid: null };
  return LAYOUTS.includes(raw)
    ? { value: raw, invalid: null }
    : { value: DEFAULT_LAYOUT, invalid: String(raw) };
}

/**
 * The cache TTL in force: exactly "5m" or "1h".
 * @param {object} [config]
 * @returns {{ value: '5m'|'1h', invalid: string|null }}
 */
function resolveTtl(config) {
  const raw = config && config.cacheTtl;
  if (raw == null) return { value: DEFAULT_TTL, invalid: null };
  return CACHE_TTLS.includes(raw)
    ? { value: raw, invalid: null }
    : { value: DEFAULT_TTL, invalid: String(raw) };
}

/**
 * Split generated context at the volatile marker.
 * @param {string} content
 * @returns {{ stable: string, volatile: string, split: boolean }}
 *   `split` is false for a legacy-layout file, which has no boundary to honour.
 */
function splitVolatile(content) {
  const text = typeof content === 'string' ? content : '';
  const idx = text.indexOf(VOLATILE_MARKER);
  if (idx === -1) return { stable: text, volatile: '', split: false };
  return {
    stable: text.slice(0, idx).replace(/\s+$/, '') + '\n',
    volatile: text.slice(idx + VOLATILE_MARKER.length).replace(/^\s+/, ''),
    split: true,
  };
}

/** `cache_control` for a TTL; 5m is the API default so it is left implicit. */
function cacheControl(ttl) {
  return ttl === '1h' ? { type: 'ephemeral', ttl: '1h' } : { type: 'ephemeral' };
}

/**
 * The Anthropic `system` array for a context file: the stable body carrying
 * `cache_control`, then the volatile tail without it. A tail that is empty is
 * omitted rather than sent as an empty text block, which the API rejects.
 * @param {string} content
 * @param {{ ttl?: '5m'|'1h' }} [opts]
 * @returns {Array<{type:'text', text:string, cache_control?:object}>}
 */
function buildSystemBlocks(content, opts = {}) {
  const { stable, volatile } = splitVolatile(content);
  const blocks = [];
  if (stable.trim()) blocks.push({ type: 'text', text: stable, cache_control: cacheControl(opts.ttl) });
  if (volatile.trim()) blocks.push({ type: 'text', text: volatile });
  return blocks;
}

/**
 * Does a prefix of this size reach each model's minimum cacheable length?
 *
 * Only models whose minimum the profile carries are judged; a model with no
 * verified `cacheMin` is left out rather than given a guessed verdict. Inside
 * the borderline band the verdict is never "fits" or "below" — SigMap's count
 * is an estimate and a confident answer there would be made up.
 *
 * @param {string} stableText - the prefix that would carry `cache_control`
 * @param {object} profile - from resolveProfile
 * @returns {Array<{ model:string, cacheMin:number, tokens:number, estimated:boolean,
 *   verdict:'fits'|'borderline'|'below', note:string }>}
 */
function fitCheck(stableText, profile) {
  const chars = typeof stableText === 'string' ? stableText.length : 0;
  const names = profile.rosterDeclared ? profile.roster : Object.keys(profile.models);
  const rows = [];
  for (const name of names) {
    const hit = lookup(profile, name);
    if (!hit || !(hit.model.cacheMin > 0)) continue;
    const basis = tokenBasis(profile, hit.id);
    const tokens = Math.ceil(chars / basis.charsPerToken);
    const min = hit.model.cacheMin;
    const lo = min * (1 - BORDERLINE_BAND);
    const hi = min * (1 + BORDERLINE_BAND);
    let verdict;
    let note;
    if (tokens < lo) {
      verdict = 'below';
      note = `below the ${min}-token minimum — this prefix will not be cached`;
    } else if (tokens > hi) {
      verdict = 'fits';
      note = `above the ${min}-token minimum`;
    } else {
      verdict = 'borderline';
      note = `within ${Math.round(BORDERLINE_BAND * 100)}% of the ${min}-token minimum — verify with a provider token counter`;
    }
    rows.push({ model: hit.id, cacheMin: min, tokens, estimated: basis.estimated, verdict, note });
  }
  return rows.sort((a, b) => a.model.localeCompare(b.model));
}

/**
 * Human lines for a fit-check, one per model.
 * @param {ReturnType<typeof fitCheck>} rows
 * @param {object} profile
 * @returns {string[]}
 */
function formatFit(rows, profile) {
  if (!rows.length) return [];
  const w = Math.max(...rows.map((r) => r.model.length));
  const lines = [`cache fit (stable prefix; minimums as of ${profile.asOf}):`];
  for (const r of rows) {
    const mark = r.verdict === 'fits' ? 'fits      ' : r.verdict === 'below' ? 'below     ' : 'borderline';
    const count = `${r.estimated ? '~' : ''}${r.tokens} tokens${r.estimated ? ` (est. chars/${DEFAULT_CHARS_PER_TOKEN})` : ''}`;
    lines.push(`  ${r.model.padEnd(w)}  ${mark}  ${count} — ${r.note}`);
  }
  return lines;
}

module.exports = {
  VOLATILE_MARKER, LAYOUTS, DEFAULT_LAYOUT, CACHE_TTLS, DEFAULT_TTL, BORDERLINE_BAND,
  resolveLayout, resolveTtl, splitVolatile, cacheControl, buildSystemBlocks, fitCheck, formatFit,
};
