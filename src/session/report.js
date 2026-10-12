'use strict';

/**
 * The sessions report (#951, SI-4): the data behind `sigmap --report --sessions`
 * and the dashboard's sessions panel. Pure — it reads the store, the pricing
 * profile and the gain log, and returns plain data; `render.renderReport` and the
 * dashboard turn it into text and HTML.
 *
 * The epic's correctness contract (#682) is enforced here, not described:
 *
 *   - Usage is only ever merged by `sumClass`, which takes ONE provenance class
 *     and throws on a row of another. There is no grand total anywhere in the
 *     result, so no renderer can print one by accident (guard-tested: this file
 *     calls `mergeUsage` in exactly one place).
 *   - Cost is a FLOOR. The pricing profile carries a verified standard INPUT
 *     price per model and nothing else — no output or cache price — so only the
 *     `in` category is priced and every figure says so. A model that is not in
 *     the table is "unpriced", never $0.
 *   - SigMap's own savings are `modeled` and are not attributed to a session:
 *     the gain log keys a run by a day bucket or SIGMAP_SESSION, never by an
 *     agent's session id, so a time-window join would credit every overlapping
 *     session with the same savings.
 *   - Unknown is unknown: a session with no usage has no cost, a duration of an
 *     unclosed session is `null`, and nothing is rendered as zero.
 *
 * Zero dependencies.
 */

const store = require('./store');
const capabilities = require('./capabilities');

const COST_NOTE = 'cost = input tokens × the pricing table\'s standard input price; output and cache tokens are not priced '
  + '(the profile carries no verified price for them), so every cost is a floor';
const SAVINGS_NOTE = 'SigMap savings are modeled (baseline − emitted, chars/4) and are not attributable to a session: '
  + 'the gain log carries no agent session id';

// A duration is only known when the record's start is the session's start. A transcript
// carries that (the SessionStart hook, or its first message). An agent-reported or CI
// record's "start" is the moment of the first report, so its span is not the session's
// length — unknown, never `0s`.
function _durationMs(s) {
  if (s.source !== 'transcript' || !s.ended) return null;
  const a = store.tsMs(s.startedAt);
  const b = store.tsMs(s.endedAt);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return b - a;
}

/**
 * The input-priced floor of one session, or why there is none.
 * A mixed-model session prices each named model's own input tokens; tokens of a
 * message that named no model stay unpriced, so the figure remains a floor.
 *
 * @returns {{ usd: number|null, pricedIn: number, partial: boolean, why: string|null }}
 */
function costOf(session, profile, models) {
  const u = session.usage;
  if (!u) return { usd: null, pricedIn: 0, partial: false, why: 'usage unavailable' };
  const parts = session.model === 'mixed' && session.models
    ? Object.entries(session.models).map(([name, m]) => [name, m && m.in])
    : [[session.model, u.in]];
  let usd = 0;
  let pricedIn = 0;
  let any = false;
  const missing = [];
  for (const [name, tokens] of parts) {
    const hit = models.lookup(profile, name);
    if (!hit || hit.model.inputPerMtok == null || !Number.isFinite(tokens)) { missing.push(name); continue; }
    usd += tokens * hit.model.inputPerMtok / 1e6;
    pricedIn += tokens;
    any = true;
  }
  if (!any) {
    const named = missing.filter((n) => n && n !== 'unknown' && n !== 'mixed');
    return {
      usd: null, pricedIn: 0, partial: false,
      why: named.length ? `${named.join(', ')} is not in the pricing table` : 'the model is not known',
    };
  }
  return { usd, pricedIn, partial: pricedIn < u.in, why: null };
}

/**
 * Sum one provenance class. The ONLY place usage is merged: a row of another
 * class is an error, never a quiet addition.
 */
function sumClass(label, rows) {
  let acc = null;
  let usd = 0;
  let priced = 0;
  let unpriced = 0;
  let withUsage = 0;
  for (const r of rows) {
    if (r.provenance !== label) {
      throw new Error(`cannot sum a "${r.provenance}" session into the "${label}" class`);
    }
    const u = store.usageOf(r);
    if (!u) continue;
    withUsage++;
    acc = store.mergeUsage(acc, u);
    if (r.cost.usd === null) unpriced++;
    else { usd += r.cost.usd; priced++; }
  }
  return {
    provenance: label,
    sessions: rows.length,
    withUsage,
    usage: acc ? acc.usage : null,
    unreported: acc ? acc.unreported : [],
    cost: { usd: priced ? usd : null, priced, unpriced },
  };
}

/** One bucket per provenance class present in `rows`, keys in sorted order. */
function perClass(rows) {
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.provenance)) groups.set(r.provenance, []);
    groups.get(r.provenance).push(r);
  }
  const out = {};
  for (const label of [...groups.keys()].sort()) out[label] = sumClass(label, groups.get(label));
  return out;
}

function _savings(cwd, rows, readGain) {
  const starts = rows.map((r) => store.tsMs(r.startedAt)).filter((t) => !Number.isNaN(t));
  if (starts.length === 0) return null;
  const since = Math.min(...starts);
  let runs = 0;
  let saved = 0;
  for (const e of readGain(cwd)) {
    const t = Date.parse(e && e.ts);
    if (!Number.isFinite(t) || t < since) continue;
    if (!Number.isFinite(e.savedTokens) || e.savedTokens < 0) continue;
    runs++;
    saved += e.savedTokens;
  }
  if (runs === 0) return null;
  return { provenance: 'modeled', runs, savedTokens: saved, since: new Date(since).toISOString(), note: SAVINGS_NOTE };
}

/**
 * Build the report.
 *
 * @param {string} cwd
 * @param {{ config?: object, limit?: number, agent?: string|null, now?: number }} [opts]
 * @returns {{
 *   sessions: object[], totals: object, branches: object[], savings: object|null,
 *   coverage: object[], pricing: object, notes: object, rollups: number, corrupt: number
 * }}
 */
function buildReport(cwd, opts = {}) {
  const models = require('../config/models');
  const profile = models.resolveProfile(opts.config || {});
  const limit = Number.isFinite(opts.limit) && opts.limit > 0 ? opts.limit : 20;
  const all = store.readSessions(cwd);
  const picked = opts.agent ? all.sessions.filter((s) => s.agent === opts.agent) : all.sessions;

  const rows = picked.slice(-limit).map((s) => ({
    id: s.id,
    agent: s.agent,
    branch: s.branch || null,
    startedAt: s.startedAt,
    durationMs: _durationMs(s),
    state: s.partial ? 'partial' : (s.ended ? 'ended' : 'open'),
    model: s.model,
    provenance: s.provenance,
    source: s.source,
    usage: s.usage,
    cost: costOf(s, profile, models),
  }));

  const byBranch = new Map();
  for (const r of rows) {
    const key = r.branch || 'unknown';
    if (!byBranch.has(key)) byBranch.set(key, []);
    byBranch.get(key).push(r);
  }
  const branches = [...byBranch.keys()].sort().map((branch) => ({
    branch, sessions: byBranch.get(branch).length, classes: perClass(byBranch.get(branch)),
  }));

  const seen = new Map();
  for (const r of rows) seen.set(r.agent, (seen.get(r.agent) || 0) + 1);
  const coverage = capabilities.DECLARATIONS.map((d) => ({
    agent: d.agent, name: d.name, text: capabilities.describe(d), can: capabilities.labelsOf(d), sessions: seen.get(d.agent) || 0,
  }));
  for (const [agent, n] of [...seen.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!agent || capabilities.forAgent(agent)) continue;
    coverage.push({ agent, name: agent, text: capabilities.describeUndeclared(agent), can: [], sessions: n });
  }

  const age = models.profileAge(profile, opts.now);
  const readGain = typeof opts.readGain === 'function' ? opts.readGain : require('../tracking/logger').readGainLog;
  return {
    sessions: rows,
    totals: perClass(rows),
    branches,
    savings: _savings(cwd, rows, readGain),
    coverage,
    pricing: { asOf: profile.asOf, asOfSource: profile.asOfSource, label: models.asOfLabel(profile), days: age.days, stale: age.stale },
    notes: { usage: require('./render').NOTE, cost: COST_NOTE },
    rollups: all.rollups.length,
    corrupt: all.corrupt || 0,
  };
}

module.exports = { buildReport, sumClass, perClass, costOf, COST_NOTE, SAVINGS_NOTE };
