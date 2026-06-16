'use strict';

/**
 * SigMap usage aggregation for the `gain` dashboard.
 *
 * Pure, zero-dependency functions that turn raw NDJSON usage records into the
 * totals / by-operation / time-bucket shapes the terminal renderer consumes.
 *
 * Tolerant of BOTH schemas:
 *   - new:    { op, baselineTokens, actualTokens, savedTokens, savedPct, durationMs, model }
 *   - legacy: { rawTokens, finalTokens, reductionPct }   (from logger.js v0.9)
 *
 * "saved" is a counterfactual estimate (baseline − actual), never a measured
 * delta. Callers are responsible for labeling it as such in the UI.
 */

const { resolvePrice } = require('./pricing');

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/**
 * Normalize one raw record into a canonical shape.
 * @param {object} rec
 */
function normalize(rec) {
  const baseline = num(rec.baselineTokens != null ? rec.baselineTokens : rec.rawTokens);
  const actual = num(rec.actualTokens != null ? rec.actualTokens : rec.finalTokens);
  const saved = rec.savedTokens != null ? num(rec.savedTokens) : Math.max(0, baseline - actual);
  const savedPct = rec.savedPct != null
    ? num(rec.savedPct)
    : rec.reductionPct != null
      ? num(rec.reductionPct)
      : baseline > 0 ? (saved / baseline) * 100 : 0;
  return {
    ts: rec.ts || null,
    op: normalizeOp(rec.op),
    baseline,
    actual,
    saved,
    savedPct: clamp(savedPct, 0, 100),
    durationMs: num(rec.durationMs),
    model: rec.model || null,
  };
}

function normalizeOp(op) {
  if (!op) return 'generate';
  return String(op);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse a --since value into a cutoff Date (or null for "all time").
 * Accepts: "7d", "30d", "12h", or an ISO date "2026-06-01".
 * @param {string} since
 * @param {number} [nowMs] - injectable clock for tests
 * @returns {Date|null}
 */
function parseSince(since, nowMs) {
  if (!since) return null;
  const now = nowMs != null ? nowMs : Date.now();
  const rel = /^(\d+)([dhw])$/.exec(String(since).trim());
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2];
    const ms = unit === 'h' ? 3.6e6 : unit === 'w' ? 6.048e8 : 8.64e7;
    return new Date(now - n * ms);
  }
  const d = new Date(since);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Bucket records by calendar granularity.
 * @param {object[]} records - normalized records
 * @param {'day'|'week'|'month'} granularity
 * @returns {Array<{key,count,baseline,actual,saved,savedPct,ms}>} ascending by key
 */
function bucketBy(records, granularity) {
  const map = new Map();
  for (const r of records) {
    if (!r.ts) continue;
    const key = bucketKey(r.ts, granularity);
    if (!key) continue;
    let b = map.get(key);
    if (!b) { b = { key, count: 0, baseline: 0, actual: 0, saved: 0, ms: 0 }; map.set(key, b); }
    b.count += 1;
    b.baseline += r.baseline;
    b.actual += r.actual;
    b.saved += r.saved;
    b.ms += r.durationMs;
  }
  return [...map.values()]
    .map((b) => ({ ...b, savedPct: b.baseline > 0 ? clamp((b.saved / b.baseline) * 100, 0, 100) : 0 }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

function bucketKey(ts, granularity) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  if (granularity === 'month') return `${y}-${m}`;
  if (granularity === 'week') {
    // ISO-ish: key by the Monday (UTC) of that week.
    const tmp = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
    const dow = (tmp.getUTCDay() + 6) % 7; // 0 = Monday
    tmp.setUTCDate(tmp.getUTCDate() - dow);
    return `${tmp.getUTCFullYear()}-${String(tmp.getUTCMonth() + 1).padStart(2, '0')}-${String(tmp.getUTCDate()).padStart(2, '0')}`;
  }
  return `${y}-${m}-${day}`;
}

/**
 * Full aggregation for the `gain` dashboard.
 * @param {object[]} rawRecords
 * @param {object} [opts]
 * @param {string} [opts.model]   pricing model
 * @param {string} [opts.since]   window filter
 * @param {number} [opts.top]     limit byOp rows (0 = all)
 * @param {number} [opts.nowMs]   injectable clock
 * @returns {object}
 */
function aggregate(rawRecords, opts = {}) {
  const price = resolvePrice(opts.model);
  const cutoff = parseSince(opts.since, opts.nowMs);

  let records = (rawRecords || []).map(normalize);
  if (cutoff) records = records.filter((r) => r.ts && new Date(r.ts) >= cutoff);

  const totals = {
    count: records.length,
    baseline: 0,
    actual: 0,
    saved: 0,
    totalMs: 0,
    savedPct: 0,
    avgMs: 0,
    usdSaved: 0,
    firstTs: null,
    lastTs: null,
  };

  const opMap = new Map();
  for (const r of records) {
    totals.baseline += r.baseline;
    totals.actual += r.actual;
    totals.saved += r.saved;
    totals.totalMs += r.durationMs;
    if (r.ts) {
      if (!totals.firstTs || r.ts < totals.firstTs) totals.firstTs = r.ts;
      if (!totals.lastTs || r.ts > totals.lastTs) totals.lastTs = r.ts;
    }
    let o = opMap.get(r.op);
    if (!o) { o = { op: r.op, count: 0, baseline: 0, saved: 0, ms: 0 }; opMap.set(r.op, o); }
    o.count += 1;
    o.baseline += r.baseline;
    o.saved += r.saved;
    o.ms += r.durationMs;
  }

  totals.savedPct = totals.baseline > 0 ? clamp((totals.saved / totals.baseline) * 100, 0, 100) : 0;
  totals.avgMs = totals.count > 0 ? Math.round(totals.totalMs / totals.count) : 0;
  totals.usdSaved = totals.saved * price.perToken;

  let byOp = [...opMap.values()].map((o) => ({
    op: o.op,
    count: o.count,
    saved: o.saved,
    avgPct: o.baseline > 0 ? clamp((o.saved / o.baseline) * 100, 0, 100) : 0,
    avgMs: o.count > 0 ? Math.round(o.ms / o.count) : 0,
    usdSaved: o.saved * price.perToken,
    sharePct: totals.saved > 0 ? (o.saved / totals.saved) * 100 : 0,
  })).sort((a, b) => b.saved - a.saved);

  if (opts.top && opts.top > 0) byOp = byOp.slice(0, opts.top);

  return {
    price,
    totals,
    byOp,
    buckets: {
      daily: bucketBy(records, 'day'),
      weekly: bucketBy(records, 'week'),
      monthly: bucketBy(records, 'month'),
    },
  };
}

module.exports = { aggregate, bucketBy, parseSince, normalize };
