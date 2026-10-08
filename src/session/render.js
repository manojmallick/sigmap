'use strict';

/**
 * Rendering for `sigmap session list|show` and the `budget` measured block (#922).
 *
 * Wording is part of the contract: the numbers are per-request BILLING
 * categories (input, output, cache read, cache write). They are never called
 * "context size", every row carries its provenance label, an unreadable usage
 * prints as unavailable, a category the agent never reported prints as n/a (not
 * 0), and totals are only summed within one provenance class — a partial sum is
 * shown as a floor (`≥`). Measured rows cover the main conversation only, and
 * the output says so wherever those numbers appear.
 *
 * Every string that came from a transcript or the store file is cleaned of
 * control characters before it is printed.
 */

const { PROVENANCE, cleanStr, cleanIso, mergeUsage, usageOf } = require('./store');

const NOTE = 'billed tokens per request category — not context size';
const COVERAGE_NOTE = 'measured = read from the agent\'s own transcript, main conversation only (subagent transcripts are not read)';
const NA_NOTE = 'n/a = the agent did not report that category (it is not zero)';

function _n(v) {
  return Number(v).toLocaleString('en-US');
}

function _when(ts) {
  const t = cleanIso(ts);
  return t ? t.slice(0, 16).replace('T', ' ') + 'Z' : 'unknown';
}

function _s(v, max) {
  return cleanStr(v, max || 40) || 'unknown';
}

function _cat(label, v, floor) {
  if (v === null || v === undefined) return `${label} n/a`;
  return `${label} ${floor ? '≥' : ''}${_n(v)}`;
}

/**
 * `in 1 · out 2 · cache read 3 · cache write 4`, or `unavailable`.
 * `unreported` (from a sum) marks categories some contributor did not report,
 * which makes that figure a floor.
 */
function formatUsage(usage, unreported) {
  if (!usage) return 'unavailable';
  const part = new Set(unreported || []);
  return [
    _cat('in', usage.in, part.has('in')),
    _cat('out', usage.out, part.has('out')),
    _cat('cache read', usage.cacheRead, part.has('cacheRead')),
    _cat('cache write', usage.cacheWrite, part.has('cacheWrite')),
  ].join(' · ');
}

/**
 * Sum sessions that HAVE usage, one bucket per provenance class.
 * @returns {Object<string, { sessions: number, usage: object, unreported: string[] }>}
 */
function totalsByProvenance(sessions) {
  const acc = {};
  for (const s of sessions) {
    const u = usageOf(s);
    if (!u) continue;
    const label = PROVENANCE[s.source];
    const b = acc[label] || (acc[label] = { sessions: 0, acc: null });
    b.sessions++;
    b.acc = mergeUsage(b.acc, u);
  }
  const out = {};
  for (const [label, b] of Object.entries(acc)) out[label] = { sessions: b.sessions, usage: b.acc.usage, unreported: b.acc.unreported };
  return out;
}

function _state(s) {
  if (s.partial) return 'partial';
  return s.ended ? 'ended' : 'open';
}

function renderList(sessions, rollups, info = {}) {
  const lines = [`[sigmap] ${sessions.length} session${sessions.length === 1 ? '' : 's'} (${NOTE})`];
  for (const s of sessions) {
    lines.push(`  ${_s(s.id, 60)}  ${_s(s.agent, 20).padEnd(11)} ${_when(s.startedAt)}  ${_state(s).padEnd(7)} ${_s(s.model)}  [${s.provenance}]  ${formatUsage(s.usage)}`);
  }
  const totals = totalsByProvenance(sessions);
  for (const [label, t] of Object.entries(totals)) {
    lines.push(`  total [${label}] ${t.sessions} session${t.sessions === 1 ? '' : 's'}: ${formatUsage(t.usage, t.unreported)}`);
  }
  if (Object.keys(totals).length > 1) lines.push('  (provenance classes are never summed into one total)');
  if (sessions.some((s) => s.source === 'transcript')) lines.push(`  ${COVERAGE_NOTE}`);
  if (sessions.some((s) => s.usage && (s.usage.cacheRead === null || s.usage.cacheWrite === null))) lines.push(`  ${NA_NOTE}`);
  if (rollups.length) lines.push(`  ${rollups.length} monthly rollup${rollups.length === 1 ? '' : 's'} of older sessions (see --json)`);
  if (info.corrupt) lines.push(`  skipped ${info.corrupt} unreadable line${info.corrupt === 1 ? '' : 's'} in .context/sessions.ndjson`);
  return lines.join('\n');
}

function renderShow(s) {
  const lines = [
    `[sigmap] session ${_s(s.id, 60)}`,
    `  agent       ${_s(s.agent, 20)}${s.ci ? ' (ci)' : ''}`,
    `  branch      ${_s(s.branch, 120)}`,
    `  started     ${_when(s.startedAt)}`,
    `  ended       ${s.ended ? `${_when(s.endedAt)}${s.endReason ? ` (${_s(s.endReason)})` : ''}` : 'not closed'}`,
    `  model       ${_s(s.model, 80)}${s.models ? ` (${Object.keys(s.models).map((m) => _s(m, 80)).join(', ')})` : ''}`,
    `  provenance  ${s.provenance}`,
    `  usage       ${formatUsage(s.usage)}   (${NOTE})`,
  ];
  if (s.partial) lines.push('  note        the transcript read stopped early; totals cover what was read');
  if (s.cacheGaps) lines.push(`  note        ${s.cacheGaps} message${s.cacheGaps === 1 ? '' : 's'} did not report a cache category; the figure sums the ones that did`);
  if (s.parseErrors) lines.push(`  parse       ${s.parseErrors} unreadable transcript line${s.parseErrors === 1 ? '' : 's'} skipped`);
  if (s.coverage) lines.push(`  coverage    ${_s(s.coverage, 20)} conversation only (subagent transcripts are not read)`);
  lines.push(`  queries     ${s.queries.length}`);
  lines.push(`  events      ${s.events}`);
  return lines.join('\n');
}

/** The `measured` block `budget` adds for a session found in the store. */
function measuredBlock(session) {
  return {
    session: session.id,
    provenance: session.provenance,
    source: session.source,
    model: session.model,
    partial: session.partial,
    coverage: session.coverage || null,
    usage: session.usage,
    note: session.coverage === 'main' ? `${NOTE}; main conversation only` : NOTE,
  };
}

module.exports = { NOTE, COVERAGE_NOTE, NA_NOTE, formatUsage, totalsByProvenance, renderList, renderShow, measuredBlock };
