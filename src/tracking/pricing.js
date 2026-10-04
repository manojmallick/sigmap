'use strict';

/**
 * SigMap pricing — input-token $/Mtok assumptions for `gain`, `--cost` and `ask`.
 *
 * These are ASSUMPTIONS used only to translate "tokens saved" into an estimated
 * dollar figure. The figures themselves live in the dated model profile
 * (src/config/models.js) — this module holds no price of its own, so the names
 * the routing advice prints and the names priced here cannot drift apart
 * (#688, #778). Override per project via the `models` config namespace, or pick
 * a model with `--model <name>`. Every view prints the model, the rate and the
 * profile date inline so the $ is never presented as exact. Zero npm dependencies.
 */

const { resolveProfile, lookup, DEFAULT_MODEL } = require('../config/models');

const SHIPPED = resolveProfile();

function _priceMap(profile) {
  const out = {};
  for (const [id, m] of Object.entries(profile.models)) {
    if (m.inputPerMtok != null) out[id] = m.inputPerMtok;
  }
  for (const [alias, id] of Object.entries(profile.aliases)) {
    if (out[id] != null) out[alias] = out[id];
  }
  return out;
}

// USD per 1,000,000 input tokens, keyed by every accepted name (ids + aliases)
// of the shipped profile.
const PRICES = _priceMap(SHIPPED);

/**
 * Resolve a price (USD per token) for a model name.
 *
 * Unknown keys fall back to DEFAULT_MODEL rather than crashing the dashboard,
 * but the fallback is reported (#665): `requested` carries the original
 * (trimmed) input and `fallback` is true only when a non-empty, explicitly
 * requested key was unknown. A bare `resolvePrice()`/`resolvePrice('')` is the
 * documented default path, not a fallback.
 *
 * `model` is the profile's id for the name, so an alias (`claude-sonnet`)
 * reports the model it currently stands for.
 * @param {string} [model]
 * @param {object} [profile] - from resolveProfile(config); the shipped profile when omitted
 * @returns {{ model: string, perMtok: number, perToken: number, requested: string|null, fallback: boolean, asOf: string, asOfSource: string }}
 */
function resolvePrice(model, profile) {
  const p = profile || SHIPPED;
  const requested = String(model == null ? '' : model).trim();
  const hit = lookup(p, requested || DEFAULT_MODEL);
  const known = !!(hit && hit.model.inputPerMtok != null);
  const used = known ? hit : lookup(p, DEFAULT_MODEL);
  const perMtok = used.model.inputPerMtok;
  return {
    model: used.id,
    perMtok,
    perToken: perMtok / 1_000_000,
    requested: requested || null,
    fallback: !known && requested !== '',
    asOf: p.asOf,
    asOfSource: p.asOfSource,
  };
}

/**
 * @param {object} [profile] - from resolveProfile(config); the shipped profile when omitted
 * @returns {string[]} every accepted model name (ids, then aliases)
 */
function listModels(profile) {
  return Object.keys(profile ? _priceMap(profile) : PRICES);
}

module.exports = { PRICES, DEFAULT_MODEL, resolvePrice, listModels };
