'use strict';

/**
 * The model profile — the one dated table behind every model name, price,
 * context window and cache minimum SigMap prints (#688, #778).
 *
 * Before this module the routing hints and the pricing table were two unrelated
 * literals: no name the first printed was a key of the second, neither said
 * when it was true, and neither could be corrected from config. Both now derive
 * from MODELS below and keep no model literal of their own (guard-tested).
 *
 * Every figure was read from the vendor's own pricing or models page on AS_OF.
 * A figure that was not verified there is `null`, never a guess. This is not a
 * mirror of any vendor's catalog — it is the handful of models the advice
 * names by default, plus the keys older releases accepted. Anything else is
 * declared by the user under the `models` config namespace, which wins over
 * the shipped values field by field.
 *
 * There is no live fetch, opt-in or otherwise. Freshness is `sigmap doctor`
 * warning once the profile is STALE_AFTER_DAYS old.
 */

// The date the figures below were checked against each vendor's pages.
const AS_OF = '2026-10-04';

// `sigmap doctor` warns once the profile in force is older than this.
const STALE_AFTER_DAYS = 90;

// Lowest to highest. A vendor's higher tier never costs less than its lower.
const TIER_ORDER = ['fast', 'balanced', 'powerful'];

// What an estimate assumes when a model has no `charsPerToken` of its own.
const DEFAULT_CHARS_PER_TOKEN = 4;

// inputPerMtok: USD per 1,000,000 input tokens, standard (uncached, non-batch).
// window:       context window in tokens. cacheMin: minimum cacheable prefix.
// A model with no `tier` is priced but never named as advice.
const MODELS = {
  'claude-fable-5-1':  { vendor: 'anthropic', tier: 'powerful', inputPerMtok: 10,   window: 1000000, cacheMin: 512 },
  'claude-opus-5-5':   { vendor: 'anthropic', tier: 'powerful', inputPerMtok: 4,    window: 1000000, cacheMin: 512 },
  'claude-sonnet-5-5': { vendor: 'anthropic', tier: 'balanced', inputPerMtok: 2,    window: 1000000, cacheMin: 512 },
  'claude-haiku-4-5':  { vendor: 'anthropic', tier: 'fast',     inputPerMtok: 1,    window: 200000,  cacheMin: 4096 },

  'gpt-6-astra':       { vendor: 'openai',    tier: 'powerful', inputPerMtok: 10,   window: 1050000, cacheMin: null },
  'gpt-6.1-sol':       { vendor: 'openai',    tier: 'balanced', inputPerMtok: 2,    window: 1050000, cacheMin: null },
  'gpt-6-luna':        { vendor: 'openai',    tier: 'fast',     inputPerMtok: 0.1,  window: 1050000, cacheMin: null },
  'gpt-4o':            { vendor: 'openai',    tier: null,       inputPerMtok: 2.5,  window: null,    cacheMin: null },
  'gpt-4o-mini':       { vendor: 'openai',    tier: null,       inputPerMtok: 0.15, window: null,    cacheMin: null },

  // gemini-3.1-pro-preview: prompts up to 200K tokens; longer prompts cost more.
  // gemini-3.8-flash: the vendor lists this rate as valid through 2026-12-31.
  'gemini-3.1-pro-preview': { vendor: 'google', tier: 'powerful', inputPerMtok: 2,    window: null, cacheMin: null },
  'gemini-3.8-flash':       { vendor: 'google', tier: 'balanced', inputPerMtok: 0.75, window: null, cacheMin: null },
  'gemini-3.5-flash-lite':  { vendor: 'google', tier: 'fast',     inputPerMtok: 0.3,  window: null, cacheMin: null },

  // minimax-m3: requests up to 512K input tokens; longer requests cost more.
  'minimax-m3':        { vendor: 'minimax',   tier: null,       inputPerMtok: 0.3,  window: null,    cacheMin: null },
  'minimax-m2.7':      { vendor: 'minimax',   tier: null,       inputPerMtok: 0.3,  window: null,    cacheMin: null },
};

// Family keys older releases accepted, kept valid as names for the current model.
const ALIASES = {
  'claude-opus': 'claude-opus-5-5',
  'claude-sonnet': 'claude-sonnet-5-5',
  'claude-haiku': 'claude-haiku-4-5',
};

// Priced when no model is named.
const DEFAULT_MODEL = 'claude-sonnet';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function _key(name) {
  return String(name == null ? '' : name).trim().toLowerCase();
}

function _isMap(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function _positive(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * The profile in force: the shipped table with the project's `models` config
 * laid over it, field by field.
 *
 * Precedence is config over shipped for every field. A config value of the
 * wrong type is ignored rather than trusted, so a typo cannot blank a price.
 *
 * @param {object} [config] - merged SigMap config (or nothing for the shipped profile)
 * @returns {{
 *   asOf: string, asOfSource: 'shipped'|'config',
 *   models: Object<string, {vendor:string|null, tier:string|null, inputPerMtok:number|null,
 *     window:number|null, cacheMin:number|null, charsPerToken:number|null, source:'shipped'|'config'}>,
 *   aliases: Object<string,string>, defaultModel: string,
 *   roster: string[], rosterDeclared: boolean, rosterUnknown: string[]
 * }}
 */
function resolveProfile(config) {
  const user = _isMap(config && config.models) ? config.models : {};
  const models = {};
  for (const [id, m] of Object.entries(MODELS)) {
    models[id] = Object.assign({ charsPerToken: null, source: 'shipped' }, m);
  }

  const entry = (name) => {
    const id = _key(name);
    if (!id) return null;
    if (!models[id]) {
      models[id] = { vendor: null, tier: null, inputPerMtok: null, window: null, cacheMin: null, charsPerToken: null, source: 'config' };
    }
    return models[id];
  };
  const lay = (map, field, valid) => {
    if (!_isMap(map)) return;
    for (const [name, value] of Object.entries(map)) {
      if (!valid(value)) continue;
      const id = ALIASES[_key(name)] || _key(name);
      const e = entry(id);
      if (!e) continue;
      e[field] = value;
      e.source = 'config';
    }
  };
  lay(user.prices, 'inputPerMtok', _positive);
  lay(user.windows, 'window', _positive);
  lay(user.cacheMin, 'cacheMin', _positive);
  lay(user.charsPerToken, 'charsPerToken', _positive);
  lay(user.tiers, 'tier', (v) => TIER_ORDER.includes(v));

  const roster = [];
  for (const name of Array.isArray(user.roster) ? user.roster : []) {
    const id = ALIASES[_key(name)] || _key(name);
    if (id && !roster.includes(id)) roster.push(id);
  }
  // A roster entry SigMap has no price for cannot be costed or tiered until
  // the project supplies the figures; doctor reports these.
  const rosterUnknown = roster.filter((id) => !models[id] || models[id].inputPerMtok == null);

  const userAsOf = typeof user.asOf === 'string' && DATE_RE.test(user.asOf) && !Number.isNaN(Date.parse(user.asOf));
  return {
    asOf: userAsOf ? user.asOf : AS_OF,
    asOfSource: userAsOf ? 'config' : 'shipped',
    models,
    aliases: Object.assign({}, ALIASES),
    defaultModel: DEFAULT_MODEL,
    roster,
    rosterDeclared: roster.length > 0,
    rosterUnknown,
  };
}

/**
 * Look a model name up in a profile, through aliases, ignoring case.
 *
 * @param {object} profile - from resolveProfile
 * @param {string} name
 * @returns {{ id: string, model: object }|null} null when the name is unknown
 */
function lookup(profile, name) {
  const key = _key(name);
  const id = profile.aliases[key] || key;
  const model = profile.models[id];
  return model ? { id, model } : null;
}

/**
 * The models advice names for a tier: the roster's, when one is declared;
 * otherwise every tiered model in the profile. Only priced models qualify, so
 * every name returned is one `gain --model` accepts.
 *
 * @param {object} profile
 * @param {string} tier - one of TIER_ORDER
 * @returns {string[]} model ids, in table order
 */
function tierModels(profile, tier) {
  const pool = profile.rosterDeclared ? profile.roster : Object.keys(profile.models);
  return pool.filter((id) => {
    const m = profile.models[id];
    return m && m.tier === tier && m.inputPerMtok != null;
  });
}

/**
 * Input-price span of a tier's models, or null when the tier names none.
 * @returns {{ min: number, max: number }|null}
 */
function tierPriceRange(profile, tier) {
  const prices = tierModels(profile, tier).map((id) => profile.models[id].inputPerMtok);
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * The smallest context window on the declared roster — the one a shared
 * context file has to fit. Null when no roster is declared or none of its
 * windows is known.
 *
 * @returns {{ window: number, model: string, unknown: string[] }|null}
 */
function smallestRosterWindow(profile) {
  if (!profile.rosterDeclared) return null;
  let best = null;
  const unknown = [];
  for (const id of profile.roster) {
    const m = profile.models[id];
    if (!m || m.window == null) { unknown.push(id); continue; }
    if (!best || m.window < best.window) best = { window: m.window, model: id };
  }
  return best ? Object.assign(best, { unknown }) : null;
}

/**
 * The context limit the auto budget caps against.
 *
 * A `modelContextLimit` the project set always wins. Otherwise a declared
 * roster can only LOWER the limit — to its smallest known window — never
 * raise it: declaring a 1M-window model is not a request for a larger
 * always-on context file, while declaring a small one is a hard constraint.
 *
 * @param {object} config - merged SigMap config
 * @returns {{ limit: number, source: 'config'|'roster'|'default', model: string|null }}
 */
function contextLimit(config) {
  const configured = (config && config.modelContextLimit != null) ? config.modelContextLimit : 128000;
  const userSet = !!(config && Array.isArray(config._userKeys) && config._userKeys.includes('modelContextLimit'));
  if (userSet) return { limit: configured, source: 'config', model: null };
  const smallest = smallestRosterWindow(resolveProfile(config));
  if (smallest && smallest.window < configured) return { limit: smallest.window, source: 'roster', model: smallest.model };
  return { limit: configured, source: 'default', model: null };
}

/**
 * How a token count priced against a model was obtained. SigMap counts
 * characters; without a per-model factor the count is the chars/4 estimate
 * and must be labelled as one.
 *
 * @param {object} profile
 * @param {string} name - model name or alias
 * @returns {{ charsPerToken: number, estimated: boolean, scale: number, label: string }}
 *   `scale` converts a chars/4 token count to this model's count.
 */
function tokenBasis(profile, name) {
  const hit = lookup(profile, name);
  const factor = hit && hit.model.charsPerToken;
  if (!_positive(factor)) {
    return { charsPerToken: DEFAULT_CHARS_PER_TOKEN, estimated: true, scale: 1, label: `est. (chars/${DEFAULT_CHARS_PER_TOKEN})` };
  }
  return { charsPerToken: factor, estimated: false, scale: DEFAULT_CHARS_PER_TOKEN / factor, label: `chars/${factor} (models.charsPerToken)` };
}

/**
 * Age of a profile against a clock.
 * @param {object} profile
 * @param {number} [nowMs] - injectable clock
 * @returns {{ days: number, stale: boolean }}
 */
function profileAge(profile, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const days = Math.max(0, Math.floor((now - Date.parse(profile.asOf)) / 86400000));
  return { days, stale: days > STALE_AFTER_DAYS };
}

/** `as of 2026-10-04 (shipped profile)` — the provenance tag outputs carry. */
function asOfLabel(profile) {
  return `as of ${profile.asOf} (${profile.asOfSource === 'config' ? 'your config' : 'shipped profile'})`;
}

module.exports = {
  AS_OF, STALE_AFTER_DAYS, TIER_ORDER, DEFAULT_MODEL, DEFAULT_CHARS_PER_TOKEN, MODELS, ALIASES,
  resolveProfile, lookup, tierModels, tierPriceRange, smallestRosterWindow, contextLimit,
  tokenBasis, profileAge, asOfLabel,
};
