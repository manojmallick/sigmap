'use strict';

/**
 * SigMap `gain` — terminal renderer.
 *
 * Zero-dependency ANSI dashboard for token savings. Honors NO_COLOR and
 * non-TTY output (plain text for pipes / --json consumers elsewhere).
 *
 * "saved" is a counterfactual estimate (whole-file baseline − actual context),
 * never a measured delta — the footer says so on every view.
 */

const USE_COLOR = !process.env.NO_COLOR && process.stdout.isTTY;

const C = {
  reset: USE_COLOR ? '\x1b[0m' : '',
  dim: USE_COLOR ? '\x1b[2m' : '',
  bold: USE_COLOR ? '\x1b[1m' : '',
  green: USE_COLOR ? '\x1b[32m' : '',
  yellow: USE_COLOR ? '\x1b[33m' : '',
  red: USE_COLOR ? '\x1b[31m' : '',
  cyan: USE_COLOR ? '\x1b[36m' : '',
  gray: USE_COLOR ? '\x1b[90m' : '',
};

// ── formatters ───────────────────────────────────────────────────────────
function humanTokens(n) {
  n = Number(n) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

function fmtInt(n) {
  return (Number(n) || 0).toLocaleString('en-US');
}

function fmtUSD(n) {
  n = Number(n) || 0;
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return '$' + n.toFixed(2);
}

function fmtDuration(ms) {
  ms = Number(ms) || 0;
  if (ms >= 3.6e6) return (ms / 3.6e6).toFixed(1) + 'h';
  if (ms >= 60000) return (ms / 60000).toFixed(1) + 'm';
  if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
  return Math.round(ms) + 'ms';
}

function fmtPct(p) {
  return (Number(p) || 0).toFixed(1) + '%';
}

function colorPct(p, text) {
  if (!USE_COLOR) return text;
  const c = p >= 85 ? C.green : p >= 60 ? C.yellow : C.red;
  return c + text + C.reset;
}

function pad(s, w, align) {
  s = String(s);
  const visible = s.replace(/\x1b\[[0-9;]*m/g, '');
  const gap = Math.max(0, w - visible.length);
  return align === 'right' ? ' '.repeat(gap) + s : s + ' '.repeat(gap);
}

/** Solid horizontal efficiency bar with a dotted remainder. */
function bar(pct, width) {
  const filled = Math.round((clamp(pct, 0, 100) / 100) * width);
  const solid = '█'.repeat(filled);
  const rest = '░'.repeat(Math.max(0, width - filled));
  return (USE_COLOR ? C.green : '') + solid + (USE_COLOR ? C.gray : '') + rest + C.reset;
}

/** Proportional impact bar (share of total saved). */
function impactBar(sharePct, width) {
  const n = Math.max(1, Math.round((clamp(sharePct, 0, 100) / 100) * width));
  return (USE_COLOR ? C.cyan : '') + '█'.repeat(n) + C.reset;
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const rule = (w) => C.gray + '─'.repeat(w) + C.reset;

// ── views ──────────────────────────────────────────────────────────────
/**
 * Render the global summary + by-operation table.
 * @param {object} agg     output of aggregate()
 * @param {object} [opts]  { version, scope }
 * @returns {string}
 */
function renderSummary(agg, opts = {}) {
  const W = 74;
  const t = agg.totals;
  const L = [];
  const scope = opts.scope || 'this repo';
  const ver = opts.version ? `v${opts.version}` : '';

  L.push('');
  const heading = `⚡ SigMap — Token Savings (${scope})`;
  L.push('  ' + C.bold + C.cyan + heading + C.reset +
    pad(`${C.green}✓${C.reset} ${C.dim}${ver}${C.reset}`, W - heading.length, 'right'));
  L.push('  ' + rule(W));
  L.push('');

  if (t.count === 0) {
    L.push(`  ${C.yellow}No usage recorded yet.${C.reset}`);
    L.push(`  ${C.dim}Run a few queries (sigmap ask "...") or seed a demo:${C.reset}`);
    L.push(`  ${C.dim}  node scripts/gain.mjs --demo${C.reset}`);
    L.push('');
    return L.join('\n');
  }

  const label = (k) => C.dim + pad(k, 21) + C.reset;
  L.push('  ' + label('Total operations') + ': ' + C.bold + fmtInt(t.count) + C.reset);
  L.push('  ' + label('Whole-file baseline') + ': ' + humanTokens(t.baseline) + ' tok' +
    `   ${C.dim}← est. cost of feeding full files${C.reset}`);
  L.push('  ' + label('SigMap context') + ': ' + humanTokens(t.actual) + ' tok');
  L.push('  ' + label('Tokens saved') + ': ' + C.bold + humanTokens(t.saved) + C.reset +
    '  (' + colorPct(t.savedPct, fmtPct(t.savedPct)) + ')');
  L.push('  ' + label('Est. money saved') + ': ' + C.bold + C.green + fmtUSD(t.usdSaved) + C.reset +
    `   ${C.dim}(${agg.price.model} input @ $${agg.price.perMtok}/M · --model to change)${C.reset}`);
  L.push('  ' + label('Avg latency') + ': ' + fmtDuration(t.avgMs) + ' / op' +
    `   ${C.dim}(local, no API round-trip)${C.reset}`);
  L.push('');
  L.push('  ' + label('Efficiency') + ': ▕' + bar(t.savedPct, 30) + '▏  ' +
    colorPct(t.savedPct, C.bold + fmtPct(t.savedPct) + C.reset));
  L.push('');

  // By operation table
  L.push(`  ${C.bold}By operation${C.reset}`);
  L.push('  ' + rule(W));
  L.push('  ' + C.dim +
    pad('#', 3) + pad('Operation', 24) + pad('Count', 8, 'right') +
    pad('Saved', 9, 'right') + pad('Avg%', 8, 'right') + pad('Time', 8, 'right') +
    '  Impact' + C.reset);
  agg.byOp.forEach((o, i) => {
    L.push('  ' +
      pad(`${i + 1}.`, 3) +
      pad(o.op, 24) +
      pad(fmtInt(o.count), 8, 'right') +
      pad(humanTokens(o.saved), 9, 'right') +
      pad(colorPct(o.avgPct, fmtPct(o.avgPct)), 8, 'right') +
      pad(fmtDuration(o.avgMs), 8, 'right') +
      '  ' + impactBar(o.sharePct, 12));
  });
  L.push('  ' + rule(W));
  L.push(`  ${C.dim}saved = baseline − actual · estimated vs whole-file reads · local-only${C.reset}`);
  L.push('');
  return L.join('\n');
}

/**
 * Render daily / weekly / monthly trend tables.
 * @param {object} agg
 * @returns {string}
 */
function renderBreakdown(agg) {
  const L = [];
  if (agg.totals.count === 0) return renderSummary(agg);

  const section = (icon, title, rows, keyHeader) => {
    L.push('');
    L.push(`  ${C.bold}${icon} ${title}${C.reset}`);
    L.push('  ' + C.dim +
      pad(keyHeader, 14) + pad('Ops', 7, 'right') + pad('Baseline', 11, 'right') +
      pad('Actual', 10, 'right') + pad('Saved', 10, 'right') + pad('Save%', 8, 'right') +
      pad('Time', 8, 'right') + C.reset);
    let TB = 0, TA = 0, TS = 0, TC = 0, TM = 0;
    for (const r of rows) {
      TB += r.baseline; TA += r.actual; TS += r.saved; TC += r.count; TM += r.ms;
      L.push('  ' +
        pad(r.key, 14) + pad(fmtInt(r.count), 7, 'right') +
        pad(humanTokens(r.baseline), 11, 'right') + pad(humanTokens(r.actual), 10, 'right') +
        pad(humanTokens(r.saved), 10, 'right') +
        pad(colorPct(r.savedPct, fmtPct(r.savedPct)), 8, 'right') +
        pad(fmtDuration(r.ms), 8, 'right'));
    }
    const tp = TB > 0 ? (TS / TB) * 100 : 0;
    L.push('  ' + C.bold +
      pad('TOTAL', 14) + pad(fmtInt(TC), 7, 'right') +
      pad(humanTokens(TB), 11, 'right') + pad(humanTokens(TA), 10, 'right') +
      pad(humanTokens(TS), 10, 'right') + pad(fmtPct(tp), 8, 'right') +
      pad(fmtDuration(TM), 8, 'right') + C.reset);
  };

  const daily = agg.buckets.daily.slice(-30);
  section('📅', `Daily (last ${daily.length})`, daily, 'Date');
  const weekly = agg.buckets.weekly.slice(-6);
  section('📆', `Weekly (last ${weekly.length})`, weekly, 'Week of');
  const monthly = agg.buckets.monthly.slice(-3);
  section('🗓️', `Monthly (last ${monthly.length})`, monthly, 'Month');
  L.push('');
  L.push(`  ${C.dim}saved = baseline − actual · estimated vs whole-file reads · local-only${C.reset}`);
  L.push('');
  return L.join('\n');
}

module.exports = {
  renderSummary,
  renderBreakdown,
  // exported for tests
  humanTokens, fmtUSD, fmtDuration, fmtPct,
};
