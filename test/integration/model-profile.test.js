'use strict';

/**
 * Dated model profile (#865, combining #688 and #778).
 *
 * The routing advice and the pricing table used to be two unrelated literals:
 * `--suggest-tool` printed names `gain --model` rejected, neither said when it
 * was true, and neither could be corrected from config. These tests pin the
 * properties that make that impossible to reintroduce — one definition, a date
 * on every output, config over shipped per field, and a staleness warning.
 *
 * Staleness is always measured against an injected clock, never the real one,
 * so this file cannot start failing on a calendar date.
 * Run: node test/integration/model-profile.test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN_CONTEXT = path.join(ROOT, 'gen-context.js');
const models = require(path.join(ROOT, 'src/config/models'));
const pricing = require(path.join(ROOT, 'src/tracking/pricing'));
const hints = require(path.join(ROOT, 'src/routing/hints'));
const { aggregate } = require(path.join(ROOT, 'src/tracking/aggregate'));
const { diagnose } = require(path.join(ROOT, 'src/doctor/diagnose'));
const { loadConfig } = require(path.join(ROOT, 'src/config/loader'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

function withProject(config, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-models-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function alpha(x){return x;}\nmodule.exports={alpha};\n');
    if (config) fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(config) + '\n');
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function cli(dir, args) {
  return spawnSync(process.execPath, [GEN_CONTEXT, ...args], { cwd: dir, encoding: 'utf8' });
}

const AS_OF_MS = Date.parse(models.AS_OF);
const DAY = 86400000;
const DATE = /\d{4}-\d{2}-\d{2}/;

// ── one definition ─────────────────────────────────────────────────────────

test('pricing table is derived from the profile, entry for entry', () => {
  const shipped = models.resolveProfile();
  for (const [id, m] of Object.entries(models.MODELS)) {
    assert.strictEqual(pricing.PRICES[id], m.inputPerMtok, `${id} price differs from the profile`);
  }
  for (const [alias, id] of Object.entries(models.ALIASES)) {
    assert.strictEqual(pricing.PRICES[alias], models.MODELS[id].inputPerMtok, `alias ${alias} differs from ${id}`);
  }
  const expected = Object.keys(models.MODELS).length + Object.keys(models.ALIASES).length;
  assert.strictEqual(Object.keys(pricing.PRICES).length, expected, 'pricing holds a key the profile does not define');
  assert.deepStrictEqual(pricing.listModels().sort(), pricing.listModels(shipped).sort());
});

test('pricing.js and hints.js carry no model or price literal of their own', () => {
  const names = [...Object.keys(models.MODELS), ...Object.keys(models.ALIASES)];
  for (const rel of ['src/tracking/pricing.js', 'src/routing/hints.js']) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    // Strip comments: prose may name a model, code may not.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const name of names) {
      assert.ok(!code.includes(`'${name}'`) && !code.includes(`"${name}"`), `${rel} hardcodes the model name ${name}`);
    }
    assert.ok(!/(gpt|gemini|claude|minimax)-[a-z0-9.-]+/i.test(code), `${rel} hardcodes a model name`);
    assert.ok(!/\$\d/.test(code), `${rel} hardcodes a dollar figure`);
    assert.ok(/config\/models'\)/.test(src), `${rel} does not read the profile`);
  }
});

test('every name --suggest-tool can print is accepted by gain --model', () => {
  const profile = models.resolveProfile();
  for (const tier of models.TIER_ORDER) {
    const info = hints.tierInfo(tier, profile);
    assert.ok(info.models.length > 0, `${tier} tier names no model`);
    for (const id of info.models) {
      const price = pricing.resolvePrice(id, profile);
      assert.strictEqual(price.fallback, false, `${id} (tier ${tier}) is not a pricing key`);
      assert.strictEqual(price.model, id);
    }
  }
});

test('within a vendor, a higher tier never costs less than a lower one', () => {
  const byVendor = {};
  for (const [id, m] of Object.entries(models.MODELS)) {
    if (!m.tier) continue;
    ((byVendor[m.vendor] = byVendor[m.vendor] || {})[m.tier] = byVendor[m.vendor][m.tier] || []).push([id, m.inputPerMtok]);
  }
  for (const [vendor, tiers] of Object.entries(byVendor)) {
    let floor = 0;
    let floorId = null;
    for (const tier of models.TIER_ORDER) {
      for (const [id, price] of tiers[tier] || []) {
        assert.ok(price >= floor, `${vendor}: ${id} (${tier}, $${price}) is cheaper than ${floorId} ($${floor}) in a lower tier`);
      }
      for (const [id, price] of tiers[tier] || []) {
        if (price > floor) { floor = price; floorId = id; }
      }
    }
  }
});

test('shipped figures are well-formed: dated, positive, never a guess', () => {
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(models.AS_OF) && !Number.isNaN(AS_OF_MS), 'AS_OF is not a date');
  for (const [id, m] of Object.entries(models.MODELS)) {
    assert.ok(m.vendor, `${id} has no vendor`);
    assert.ok(m.inputPerMtok > 0, `${id} has no price`);
    assert.ok(m.tier === null || models.TIER_ORDER.includes(m.tier), `${id} has an unknown tier`);
    for (const field of ['window', 'cacheMin']) {
      assert.ok(m[field] === null || (Number.isInteger(m[field]) && m[field] > 0), `${id}.${field} must be a positive integer or null`);
    }
    assert.strictEqual(id, id.toLowerCase(), `${id} must be lower-case`);
  }
  for (const [alias, id] of Object.entries(models.ALIASES)) {
    assert.ok(models.MODELS[id], `alias ${alias} points at an undefined model`);
    assert.ok(!models.MODELS[alias], `alias ${alias} shadows a model id`);
  }
  assert.ok(models.lookup(models.resolveProfile(), models.DEFAULT_MODEL), 'DEFAULT_MODEL does not resolve');
});

// ── override precedence ────────────────────────────────────────────────────

test('config wins over shipped, field by field, and leaves the rest alone', () => {
  const p = models.resolveProfile({ models: {
    prices: { 'claude-sonnet-5-5': 9, 'house-model': 0.5 },
    windows: { 'house-model': 32000 },
    cacheMin: { 'claude-haiku-4-5': 2048 },
    tiers: { 'house-model': 'balanced' },
    charsPerToken: { 'house-model': 3.2 },
  } });
  const sonnet = p.models['claude-sonnet-5-5'];
  assert.strictEqual(sonnet.inputPerMtok, 9);
  assert.strictEqual(sonnet.source, 'config');
  assert.strictEqual(sonnet.window, models.MODELS['claude-sonnet-5-5'].window, 'an unset field must keep the shipped value');
  assert.strictEqual(p.models['claude-haiku-4-5'].cacheMin, 2048);
  assert.strictEqual(p.models['claude-haiku-4-5'].inputPerMtok, models.MODELS['claude-haiku-4-5'].inputPerMtok);
  assert.deepStrictEqual(
    { ...p.models['house-model'] },
    { vendor: null, tier: 'balanced', inputPerMtok: 0.5, window: 32000, cacheMin: null, charsPerToken: 3.2, source: 'config' });
  assert.strictEqual(p.models['claude-opus-5-5'].source, 'shipped');
  // The shipped table itself is never mutated by a resolve.
  assert.strictEqual(models.MODELS['claude-sonnet-5-5'].inputPerMtok, 2);
  assert.strictEqual(pricing.resolvePrice('claude-sonnet', p).perMtok, 9, 'an alias must follow the override');
  assert.strictEqual(pricing.resolvePrice('claude-sonnet').perMtok, 2);
});

test('a config value of the wrong type is ignored, not trusted', () => {
  const p = models.resolveProfile({ models: {
    asOf: 'last tuesday',
    prices: { 'claude-sonnet-5-5': 'free', 'gpt-4o': -1 },
    tiers: { 'gpt-4o': 'galactic' },
    roster: 'claude-opus-5-5',
  } });
  assert.strictEqual(p.asOf, models.AS_OF);
  assert.strictEqual(p.asOfSource, 'shipped');
  assert.strictEqual(p.models['claude-sonnet-5-5'].inputPerMtok, 2);
  assert.strictEqual(p.models['gpt-4o'].inputPerMtok, 2.5);
  assert.strictEqual(p.models['gpt-4o'].tier, null);
  assert.strictEqual(p.rosterDeclared, false);
});

test('models.asOf from config replaces the shipped date and says so', () => {
  const p = models.resolveProfile({ models: { asOf: '2026-12-01' } });
  assert.strictEqual(p.asOf, '2026-12-01');
  assert.strictEqual(p.asOfSource, 'config');
  assert.ok(models.asOfLabel(p).includes('2026-12-01') && models.asOfLabel(p).includes('your config'));
  assert.ok(models.asOfLabel(models.resolveProfile()).includes('shipped profile'));
});

test('loadConfig carries the models namespace and keeps unset fields at their defaults', () => {
  withProject({ models: { roster: ['claude-haiku-4-5'] } }, (dir) => {
    const cfg = loadConfig(dir);
    assert.deepStrictEqual(cfg.models.roster, ['claude-haiku-4-5']);
    assert.deepStrictEqual(cfg.models.prices, {});
    assert.strictEqual(cfg.models.asOf, null);
    assert.ok(cfg._userKeys.includes('models'));
  });
});

// ── roster ─────────────────────────────────────────────────────────────────

test('a declared roster scopes the advice to its own models, aliases resolved', () => {
  const p = models.resolveProfile({ models: { roster: ['Claude-Sonnet', 'gpt-6-luna', 'claude-sonnet-5-5'] } });
  assert.deepStrictEqual(p.roster, ['claude-sonnet-5-5', 'gpt-6-luna'], 'alias and id must collapse to one entry');
  assert.deepStrictEqual(hints.tierInfo('balanced', p).models, ['claude-sonnet-5-5']);
  assert.deepStrictEqual(hints.tierInfo('fast', p).models, ['gpt-6-luna']);
  const powerful = hints.tierInfo('powerful', p);
  assert.deepStrictEqual(powerful.models, []);
  assert.ok(/none in your roster/.test(powerful.examples));
  assert.ok(/no priced model/.test(powerful.costHint));
});

test('a roster entry with no price is reported, and never advised', () => {
  const p = models.resolveProfile({ models: { roster: ['mystery-9', 'claude-opus-5-5'], tiers: { 'mystery-9': 'powerful' } } });
  assert.deepStrictEqual(p.rosterUnknown, ['mystery-9']);
  assert.deepStrictEqual(hints.tierInfo('powerful', p).models, ['claude-opus-5-5']);
});

test('a roster can lower the budget context limit, never raise it', () => {
  const big = { modelContextLimit: 128000, _userKeys: ['models'], models: { roster: ['claude-opus-5-5'] } };
  assert.deepStrictEqual(models.contextLimit(big), { limit: 128000, source: 'default', model: null });

  const small = { modelContextLimit: 128000, _userKeys: ['models'], models: { roster: ['claude-opus-5-5', 'house-model'], prices: { 'house-model': 1 }, windows: { 'house-model': 32000 } } };
  assert.deepStrictEqual(models.contextLimit(small), { limit: 32000, source: 'roster', model: 'house-model' });

  const pinned = Object.assign({}, small, { modelContextLimit: 500000, _userKeys: ['models', 'modelContextLimit'] });
  assert.deepStrictEqual(models.contextLimit(pinned), { limit: 500000, source: 'config', model: null });

  assert.deepStrictEqual(models.contextLimit({ modelContextLimit: 128000, _userKeys: [] }), { limit: 128000, source: 'default', model: null });
  // A roster whose windows are all unknown constrains nothing.
  assert.strictEqual(models.smallestRosterWindow(models.resolveProfile({ models: { roster: ['gpt-4o'] } })), null);
});

// ── chars/4 is labelled an estimate ────────────────────────────────────────

test('token basis is est. (chars/4) without a factor, and the factor when one is set', () => {
  const shipped = models.resolveProfile();
  const est = models.tokenBasis(shipped, 'claude-sonnet');
  assert.strictEqual(est.estimated, true);
  assert.strictEqual(est.scale, 1);
  assert.ok(/^est\. \(chars\/4\)$/.test(est.label));

  const p = models.resolveProfile({ models: { charsPerToken: { 'claude-sonnet': 3.2 } } });
  const set = models.tokenBasis(p, 'claude-sonnet-5-5');
  assert.strictEqual(set.estimated, false);
  assert.strictEqual(set.scale, 4 / 3.2);
  assert.ok(!/est\./.test(set.label) && /chars\/3\.2/.test(set.label));
});

test('gain dollars follow the configured factor and carry the basis', () => {
  const records = [{ ts: '2026-06-15T10:00:00Z', op: 'ask', baselineTokens: 1000000, actualTokens: 0 }];
  const plain = aggregate(records, { model: 'claude-sonnet' });
  assert.strictEqual(plain.totals.usdSaved, 2);
  assert.strictEqual(plain.price.tokensEstimated, true);
  assert.strictEqual(plain.price.asOf, models.AS_OF);

  const p = models.resolveProfile({ models: { charsPerToken: { 'claude-sonnet': 2 } } });
  const scaled = aggregate(records, { model: 'claude-sonnet', profile: p });
  assert.strictEqual(scaled.totals.usdSaved, 4, 'chars/2 means twice the tokens of chars/4');
  assert.strictEqual(scaled.price.tokensEstimated, false);
});

// ── doctor staleness ───────────────────────────────────────────────────────

function modelCheck(dir, nowMs) {
  return diagnose(dir, { nowMs }).checks.find((c) => c.id === 'models');
}

test('doctor: a fresh profile is ok and names its date', () => {
  withProject(null, (dir) => {
    const c = modelCheck(dir, AS_OF_MS + DAY);
    assert.strictEqual(c.status, 'ok');
    assert.ok(c.detail.includes(models.AS_OF));
  });
});

test('doctor: the profile warns after STALE_AFTER_DAYS, not on the day', () => {
  withProject(null, (dir) => {
    assert.strictEqual(modelCheck(dir, AS_OF_MS + models.STALE_AFTER_DAYS * DAY).status, 'ok');
    const stale = modelCheck(dir, AS_OF_MS + (models.STALE_AFTER_DAYS + 1) * DAY);
    assert.strictEqual(stale.status, 'warn');
    assert.ok(stale.detail.includes(`${models.STALE_AFTER_DAYS + 1} days old`), stale.detail);
    assert.ok(/models\.asOf/.test(stale.fix));
  });
});

test('doctor: a newer models.asOf in config clears the warning', () => {
  withProject({ models: { asOf: '2027-06-01' } }, (dir) => {
    const c = modelCheck(dir, Date.parse('2027-06-10'));
    assert.strictEqual(c.status, 'ok');
    assert.ok(c.detail.includes('2027-06-01') && c.detail.includes('your config'));
  });
});

test('doctor: a roster model with no price on record is a warning', () => {
  withProject({ models: { roster: ['mystery-9'] } }, (dir) => {
    const c = modelCheck(dir, AS_OF_MS);
    assert.strictEqual(c.status, 'warn');
    assert.ok(c.detail.includes('mystery-9'));
  });
});

// ── every consuming output prints the date ─────────────────────────────────

test('CLI: --suggest-tool prints the profile date, and its names price without fallback', () => {
  withProject(null, (dir) => {
    const text = cli(dir, ['--suggest-tool', 'refactor the ranker scoring weights']);
    assert.strictEqual(text.status, 0);
    assert.ok(text.stdout.includes(`as of  : ${models.AS_OF} (shipped profile)`), text.stdout);

    const json = JSON.parse(cli(dir, ['--suggest-tool', 'refactor the ranker scoring weights', '--json']).stdout);
    assert.strictEqual(json.asOf, models.AS_OF);
    assert.strictEqual(json.models, json.modelIds.join(', '));
    assert.ok(json.modelIds.length > 0);
    for (const id of json.modelIds) {
      const r = cli(dir, ['gain', '--model', id]);
      assert.strictEqual(r.status, 0);
      assert.ok(!/unknown model/.test(r.stderr), `gain rejected ${id}: ${r.stderr}`);
    }
  });
});

test('CLI: --suggest-tool follows the roster and the config date', () => {
  withProject({ models: { asOf: '2026-11-11', roster: ['house-model'], prices: { 'house-model': 0.5 }, tiers: { 'house-model': 'balanced' } } }, (dir) => {
    const json = JSON.parse(cli(dir, ['--suggest-tool', 'write unit tests for the parser', '--json']).stdout);
    assert.deepStrictEqual(json.modelIds, ['house-model']);
    assert.strictEqual(json.asOf, '2026-11-11');
    assert.strictEqual(json.asOfSource, 'config');
    assert.strictEqual(json.roster, true);
    const gain = cli(dir, ['gain', '--model', 'house-model']);
    assert.ok(!/unknown model/.test(gain.stderr), gain.stderr);
  });
});

test('CLI: gain --models, --cost and the routing section each print the date', () => {
  withProject(null, (dir) => {
    const listed = cli(dir, ['gain', '--models']).stdout;
    assert.ok(listed.includes(`as of ${models.AS_OF}`), listed);
    assert.ok(/claude-sonnet\s+\$2\/MTok\s+→ claude-sonnet-5-5\s+\(default\)/.test(listed), listed);

    const cost = cli(dir, ['--cost']);
    assert.ok(cost.stdout.includes(`as of ${models.AS_OF}`), cost.stdout);
    assert.ok(cost.stdout.includes('est. (chars/4)'), cost.stdout);
    const costJson = JSON.parse(cli(dir, ['--cost', '--json']).stdout.trim().split('\n').pop());
    assert.strictEqual(costJson.priceAsOf, models.AS_OF);
    assert.strictEqual(costJson.tokenBasis, 'est. (chars/4)');

    cli(dir, ['--routing']);
    const ctx = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
    assert.ok(ctx.includes(`Model names and prices: as of ${models.AS_OF} (shipped profile)`), 'routing section carries no date');
    // A date constant is stable across runs; a relative age would not be.
    assert.ok(!/ago\b/.test(ctx.slice(ctx.indexOf('## Model routing hints'))));
  });
});

test('CLI: --cost applies a configured charsPerToken and drops the est. label', () => {
  withProject({ models: { charsPerToken: { 'gpt-4o': 2 } } }, (dir) => {
    const withFactor = JSON.parse(cli(dir, ['--cost', '--json']).stdout.trim().split('\n').pop());
    assert.ok(!/est\./.test(withFactor.tokenBasis) && /chars\/2/.test(withFactor.tokenBasis));
    fs.unlinkSync(path.join(dir, 'gen-context.config.json'));
    const plain = JSON.parse(cli(dir, ['--cost', '--json']).stdout.trim().split('\n').pop());
    assert.strictEqual(withFactor.rawTokens, plain.rawTokens * 2);
  });
});

test('routing section text never names a model the profile lacks', () => {
  const section = hints.formatRoutingSection({ fast: [], balanced: [], powerful: [] });
  const named = section.match(/\*\*Examples:\*\* (.*?) {2}$/gm).join(' ');
  for (const id of named.replace(/\*\*Examples:\*\*/g, '').split(/[\s,]+/).filter(Boolean)) {
    assert.ok(models.MODELS[id], `routing section names ${id}, which the profile does not define`);
  }
  assert.ok(DATE.test(section));
});

console.log(`\nmodel-profile: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
