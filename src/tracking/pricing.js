'use strict';

/**
 * SigMap pricing table — input-token $/Mtok assumptions for the `gain` dashboard.
 *
 * These are ASSUMPTIONS used only to translate "tokens saved" into an estimated
 * dollar figure. They are deliberately conservative and configurable via
 *   --model <name>   or   config.pricingModel
 * The `gain` views always print the model + rate inline so the $ is never
 * presented as exact. Zero npm dependencies.
 */

// USD per 1,000,000 input tokens.
const PRICES = {
  'claude-sonnet': 3.0,
  'claude-opus': 15.0,
  'claude-haiku': 0.8,
  'gpt-4o': 2.5,
  'gpt-4o-mini': 0.15,
  'gemini-1.5-pro': 1.25,
  'gemini-1.5-flash': 0.075,
};

const DEFAULT_MODEL = 'claude-sonnet';

/**
 * Resolve a price (USD per token) for a model name.
 * @param {string} [model]
 * @returns {{ model: string, perMtok: number, perToken: number }}
 */
function resolvePrice(model) {
  const key = (model || DEFAULT_MODEL).toLowerCase();
  const perMtok = PRICES[key] != null ? PRICES[key] : PRICES[DEFAULT_MODEL];
  const resolved = PRICES[key] != null ? key : DEFAULT_MODEL;
  return { model: resolved, perMtok, perToken: perMtok / 1_000_000 };
}

/** @returns {string[]} known model keys */
function listModels() {
  return Object.keys(PRICES);
}

module.exports = { PRICES, DEFAULT_MODEL, resolvePrice, listModels };
