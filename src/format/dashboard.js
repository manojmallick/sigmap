'use strict';

const fs = require('fs');
const path = require('path');
const { readLog } = require('../tracking/logger');

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  if (p <= 0) return sorted[0];
  if (p >= 100) return sorted[sorted.length - 1];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

function overBudgetStreak(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  let streak = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i] && entries[i].overBudget) streak++;
    else break;
  }
  return streak;
}

function loadConfig(cwd) {
  try {
    const p = path.join(cwd, 'gen-context.config.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

function shouldExclude(rel, excludeSet) {
  if (!rel) return true;
  const parts = rel.split('/');
  for (const part of parts) {
    if (excludeSet.has(part)) return true;
  }
  return false;
}

/**
 * Resolve a file to a language key.
 *
 * This was a second extension map covering the same 21 languages as the old
 * `LANGUAGE_KEYS`, which is why widening only the denominator would have made
 * the figure worse: the numerator could never reach it. Detection and the
 * supported set now come from the same module (#663).
 */
function detectLanguage(filePath) {
  try {
    const { langFor } = require('../extractors/dispatch');
    return langFor(filePath);
  } catch (_) {
    return null;
  }
}

function walkFiles(dir, maxDepth, depth, out, excludeSet) {
  if (depth > maxDepth) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = abs.replace(/\\/g, '/');
    if (shouldExclude(rel, excludeSet)) continue;
    if (entry.isDirectory()) {
      walkFiles(abs, maxDepth, depth + 1, out, excludeSet);
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
}

function computeExtractorCoverage(cwd) {
  const cfg = loadConfig(cwd) || {};
  const srcDirs = Array.isArray(cfg.srcDirs) && cfg.srcDirs.length > 0
    ? cfg.srcDirs
    : ['src', 'app', 'lib', 'packages', 'services', 'api'];
  const exclude = new Set([
    'node_modules', '.git', 'dist', 'build', 'out', '__pycache__', '.next',
    'coverage', 'target', 'vendor', '.context', 'jetbrains-plugin/build',
  ]);
  if (Array.isArray(cfg.exclude)) {
    for (const item of cfg.exclude) exclude.add(String(item));
  }

  let languages = [];
  try { ({ LANGUAGES: languages } = require('../extractors/dispatch')); } catch (_) { languages = []; }

  const counts = {};
  for (const key of languages) counts[key] = 0;

  const files = [];
  for (const relDir of srcDirs) {
    const absDir = path.join(cwd, relDir);
    if (!fs.existsSync(absDir)) continue;
    walkFiles(absDir, 8, 0, files, exclude);
  }

  for (const f of files) {
    const lang = detectLanguage(f);
    if (lang && counts[lang] !== undefined) counts[lang]++;
  }

  const covered = languages.filter((k) => counts[k] > 0).length;
  const supported = languages.length;
  const pct = supported > 0 ? parseFloat(((covered / supported) * 100).toFixed(1)) : 0;
  return { supported, covered, pct, perLanguage: counts };
}

function readBenchmarkTrend(cwd) {
  // Prefer per-user history file written by benchmark scripts
  const histPath = path.join(cwd, '.context', 'benchmark-history.ndjson');
  if (fs.existsSync(histPath)) {
    const values = [];
    try {
      const lines = fs.readFileSync(histPath, 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'retrieval') {
            const v = toNumber(obj.hitAt5Pct);
            if (v !== null) values.push(v);
          }
        } catch (_) {}
      }
    } catch (_) {}
    if (values.length > 0) return values.slice(-30);
  }

  // Fallback: legacy benchmarks/results directory (CI artifacts)
  const resultDir = path.join(cwd, 'benchmarks', 'results');
  if (!fs.existsSync(resultDir)) return [];

  const files = [];
  walkFiles(resultDir, 6, 0, files, new Set());

  const values = [];
  for (const filePath of files) {
    const base = path.basename(filePath).toLowerCase();
    if (!base.endsWith('.json') && !base.endsWith('.jsonl') && !base.endsWith('.ndjson')) continue;
    let raw = '';
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
      continue;
    }

    if (base.endsWith('.json')) {
      try {
        const obj = JSON.parse(raw);
        const direct = toNumber(obj && obj.hitAt5);
        const nested = toNumber(obj && obj.metrics && obj.metrics.hitAt5);
        if (direct !== null) values.push(direct);
        else if (nested !== null) values.push(nested);
      } catch (_) {}
      continue;
    }

    const lines = raw.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const direct = toNumber(obj && obj.hitAt5);
        const nested = toNumber(obj && obj.metrics && obj.metrics.hitAt5);
        if (direct !== null) values.push(direct);
        else if (nested !== null) values.push(nested);
      } catch (_) {}
    }
  }

  return values.slice(-30);
}

function lineChartSvg(values, title, ySuffix) {
  const width = 760;
  const height = 210;
  const left = 38;
  const right = 18;
  const top = 22;
  const bottom = 30;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const clean = values.filter((n) => Number.isFinite(n));

  if (clean.length === 0) {
    return [
      `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">`,
      '<rect x="0" y="0" width="100%" height="100%" fill="#0f1320" rx="12"/>',
      `<text x="20" y="36" fill="#d7defa" font-size="14" font-family="monospace">${title}</text>`,
      '<text x="20" y="96" fill="#8ea0d9" font-size="13" font-family="monospace">No data yet. Run with --track and --benchmark.</text>',
      '</svg>',
    ].join('');
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;

  const points = clean.map((v, i) => {
    const x = left + ((clean.length === 1 ? 0 : i / (clean.length - 1)) * innerW);
    const y = top + (1 - ((v - min) / span)) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const latest = clean[clean.length - 1];
  const yLabel = ySuffix || '';
  const grid = [];
  for (let i = 0; i <= 4; i++) {
    const gy = top + (i / 4) * innerH;
    grid.push(`<line x1="${left}" y1="${gy.toFixed(1)}" x2="${left + innerW}" y2="${gy.toFixed(1)}" stroke="#223056" stroke-width="1"/>`);
  }

  return [
    `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">`,
    '<defs><linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#42d392" stop-opacity="0.25"/><stop offset="100%" stop-color="#42d392" stop-opacity="0"/></linearGradient></defs>',
    '<rect x="0" y="0" width="100%" height="100%" fill="#0f1320" rx="12"/>',
    `<text x="20" y="26" fill="#d7defa" font-size="13" font-family="monospace">${title}</text>`,
    grid.join(''),
    `<polyline fill="none" stroke="#42d392" stroke-width="2.5" points="${points}"/>`,
    `<text x="20" y="${height - 8}" fill="#8ea0d9" font-size="12" font-family="monospace">latest: ${latest.toFixed(2)}${yLabel}</text>`,
    '</svg>',
  ].join('');
}

/**
 * Per-language file counts for the languages actually present in this repo.
 *
 * This charted a fixed 21 languages against a positionally-aligned list of 21
 * label abbreviations — a third copy of the language set, after `LANGUAGE_KEYS`
 * and the private extension map (#663). Charting all 36 supported languages
 * instead would put 20px between labels and read as noise, and most of them are
 * zero in any one repo. The chart now shows what is here, busiest first, so it
 * stays legible however many extractors SigMap ships.
 */
function barChartSvg(perLanguage) {
  const width = 760;
  const height = 260;
  const left = 20;
  const top = 34;
  const usableW = width - left * 2;

  const present = Object.entries(perLanguage || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const frame = (body) => [
    `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Extractor coverage by language">`,
    '<rect x="0" y="0" width="100%" height="100%" fill="#0f1320" rx="12"/>',
    '<text x="20" y="24" fill="#d7defa" font-size="13" font-family="monospace">Per-language extractor coverage (file counts)</text>',
    '<line x1="20" y1="194" x2="740" y2="194" stroke="#223056" stroke-width="1"/>',
    body,
    '</svg>',
  ].join('');

  if (present.length === 0) {
    return frame('<text x="380" y="120" fill="#8ea0d9" font-size="12" font-family="monospace" text-anchor="middle">no files in a supported language under srcDirs</text>');
  }

  const max = Math.max(1, ...present.map(([, v]) => v));
  const barW = usableW / present.length;
  const bars = [];
  const xLabels = [];
  for (let i = 0; i < present.length; i++) {
    const [key, v] = present[i];
    const h = (v / max) * 160;
    const x = left + i * barW + 2;
    const y = top + 160 - h;
    bars.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(2, barW - 4).toFixed(1)}" height="${h.toFixed(1)}" fill="#7aa2ff" rx="2"/>`);
    const cx = left + i * barW + barW / 2;
    xLabels.push(`<text x="${cx.toFixed(1)}" y="222" fill="#8ea0d9" font-size="9" font-family="monospace" text-anchor="middle">${escapeAttr(key)}</text>`);
  }

  return frame(bars.join('') + xLabels.join(''));
}

function sparkline(values) {
  const clean = values.filter((n) => Number.isFinite(n));
  if (clean.length === 0) return 'n/a';
  const ticks = '▁▂▃▄▅▆▇█';
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  return clean.map((v) => {
    const idx = Math.max(0, Math.min(ticks.length - 1, Math.round(((v - min) / span) * (ticks.length - 1))));
    return ticks[idx];
  }).join('');
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Surgical Context (v6.12.0): read the published token-reduction benchmark and
// aggregate it for the dashboard panel. Numbers are never hand-typed — they come
// straight from benchmarks/reports/token-reduction.json.
function readTokenReduction(cwd) {
  const p = path.join(cwd, 'benchmarks', 'reports', 'token-reduction.json');
  let data;
  try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
  const repos = Array.isArray(data.repos) ? data.repos : [];
  if (repos.length === 0) return null;

  let baseline = 0, signatures = 0, surgical = 0, hasSurgical = false;
  for (const r of repos) {
    baseline += toNumber(r.rawTokens) || 0;
    signatures += toNumber(r.finalTokens) || 0;
    const s = toNumber(r.surgicalTokens);
    if (s !== null) { surgical += s; hasSurgical = true; }
  }

  const out = {
    version: data.version || null,
    repoCount: repos.length,
    baseline,
    signatures,
    savedPct: baseline > 0 ? Math.round((1 - signatures / baseline) * 1000) / 10 : 0,
    perRepo: repos.map((r) => ({
      repo: r.repo,
      language: r.language,
      rawTokens: toNumber(r.rawTokens) || 0,
      finalTokens: toNumber(r.finalTokens) || 0,
      reductionPct: toNumber(r.reductionPct) || 0,
    })),
  };
  if (hasSurgical) {
    out.surgical = surgical;
    out.surgicalSavedPct = baseline > 0 ? Math.round((1 - surgical / baseline) * 1000) / 10 : 0;
  }
  return out;
}

function tokenReductionPanelHtml(tr) {
  if (!tr) {
    return '<div class="panel"><div class="label">Token Reduction</div>' +
      '<div class="value" style="font-size:13px">No token-reduction benchmark found — run the token benchmark to populate this panel.</div></div>';
  }
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const tiers = [
    { label: 'Whole-file baseline', value: fmt(tr.baseline) + ' tok' },
    { label: 'Ranked signatures (ask)', value: fmt(tr.signatures) + ' tok' },
  ];
  if (tr.surgical != null) {
    tiers.push({ label: 'Surgical (index + delta)', value: fmt(tr.surgical) + ' tok' });
    tiers.push({ label: 'Saved (surgical)', value: tr.surgicalSavedPct + '%' });
  } else {
    tiers.push({ label: 'Saved', value: tr.savedPct + '%' });
  }
  const tierHtml = tiers.map((t) =>
    `<div class="card"><div class="label">${escapeAttr(t.label)}</div><div class="value">${escapeAttr(t.value)}</div></div>`
  ).join('');

  // Proportional comparison bar (baseline = full width).
  const sigPct = tr.baseline > 0 ? Math.max(0.4, (tr.signatures / tr.baseline) * 100) : 0;
  const surgPct = (tr.surgical != null && tr.baseline > 0) ? Math.max(0.4, (tr.surgical / tr.baseline) * 100) : null;
  const barRow = (label, pct, color) =>
    `<div style="margin:4px 0;font-size:11px;color:#8ea0d9">${escapeAttr(label)}</div>` +
    `<div style="background:#0a0f1e;border:1px solid #223056;border-radius:6px;height:14px;overflow:hidden">` +
    `<div style="width:${pct.toFixed(1)}%;height:100%;background:${color}"></div></div>`;
  const bars = [
    barRow('Whole-file baseline (100%)', 100, '#3a4a78'),
    barRow(`Ranked signatures — ${tr.savedPct}% saved`, sigPct, '#2e7d6b'),
    surgPct != null ? barRow(`Surgical — ${tr.surgicalSavedPct}% saved`, surgPct, '#5ad1a8') : '',
  ].filter(Boolean).join('');

  const rows = tr.perRepo.slice(0, 8).map((r) =>
    `<tr><td>${escapeAttr(r.repo)}</td><td>${escapeAttr(r.language)}</td>` +
    `<td style="text-align:right">${fmt(r.rawTokens)}</td>` +
    `<td style="text-align:right">${fmt(r.finalTokens)}</td>` +
    `<td style="text-align:right">${r.reductionPct}%</td></tr>`
  ).join('');

  return [
    '<div class="panel">',
    `<div class="label">Token Reduction — ${tr.repoCount} benchmark repos${tr.version ? ' · v' + escapeAttr(tr.version) : ''}</div>`,
    `<div class="grid" style="margin:8px 0">${tierHtml}</div>`,
    bars,
    '<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px">',
    '<thead><tr style="color:#8ea0d9;text-align:left">',
    '<th>Repo</th><th>Lang</th><th style="text-align:right">Baseline</th><th style="text-align:right">Signatures</th><th style="text-align:right">Saved</th>',
    '</tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '</div>',
  ].join('');
}

// Sessions (#951, SI-4). Every string here came from `.context/sessions.ndjson`, which a
// repository can ship, so each goes through escapeAttr — the file is opened in a browser.
function sessionsPanelHtml(report) {
  const render = require('../session/render');
  const e = escapeAttr;
  const asOf = report.pricing.asOf;
  const head = '<div class="label">Sessions — billed tokens per request category, not context size</div>';
  const coverage = [
    '<div class="panel">',
    '<div class="label">Capture coverage — what each agent can report (declared, not inferred)</div>',
    '<ul style="margin:8px 0 0 16px;padding:0;font-size:12px;line-height:1.7">',
    report.coverage.map((c) => `<li>${e(c.text)}${c.sessions ? ` <span style="color:#8ea0d9">[${c.sessions} here]</span>` : ''}</li>`).join(''),
    '</ul>',
    '</div>',
  ].join('');

  if (report.sessions.length === 0) {
    return '<div class="panel">' + head +
      '<div class="value" style="font-size:13px;margin-top:8px">No sessions recorded yet — capture them with: sigmap hooks install claude</div></div>' +
      coverage;
  }

  const rows = report.sessions.map((s) =>
    `<tr><td>${e(render.when(s.startedAt))}</td><td>${e(s.agent || 'unknown')}</td><td>${e(s.branch || 'unknown')}</td>` +
    `<td style="text-align:right">${e(render.duration(s.durationMs))}</td><td>${e(s.provenance)}</td>` +
    `<td>${e(render.formatUsage(s.usage))}</td><td>${e(render.costText(s.cost, asOf))}</td></tr>`
  ).join('');

  const classLine = (label, t) => {
    const usage = t.usage ? render.formatUsage(t.usage, t.unreported) : 'unavailable';
    return `<div style="margin:4px 0;font-size:12px">[${e(label)}] ${t.sessions} session${t.sessions === 1 ? '' : 's'}: ` +
      `${e(usage)} · cost ${e(render.classCostText(t, asOf))}</div>`;
  };
  const totals = Object.entries(report.totals).map(([label, t]) => classLine(label, t)).join('');
  const branches = report.branches.map((b) =>
    `<div style="margin:8px 0 2px 0;font-size:12px;color:#8ea0d9">${e(b.branch)}</div>` +
    Object.entries(b.classes).map(([label, t]) => classLine(label, t)).join('')
  ).join('');
  const savings = report.savings
    ? `<div style="margin-top:8px;font-size:12px">SigMap savings [${e(report.savings.provenance)}]: ${report.savings.runs} logged run${report.savings.runs === 1 ? '' : 's'} ` +
      `since ${e(render.when(report.savings.since))} saved ~${Number(report.savings.savedTokens).toLocaleString('en-US')} tokens — not attributed to a session</div>`
    : '';

  return [
    '<div class="panel">',
    head,
    '<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px">',
    '<thead><tr style="color:#8ea0d9;text-align:left"><th>When</th><th>Agent</th><th>Branch</th>' +
      '<th style="text-align:right">Duration</th><th>Provenance</th><th>Tokens</th><th>Cost</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '<div class="label" style="margin-top:12px">Totals — one line per provenance class; classes are never summed together</div>',
    totals,
    '<div class="label" style="margin-top:12px">By branch</div>',
    branches,
    savings,
    `<div style="margin-top:10px;font-size:11px;color:#8ea0d9">pricing ${e(report.pricing.label)}` +
      `${report.pricing.stale ? ` — ${report.pricing.days} days old` : ''}. ${e(report.notes.cost)}</div>`,
    '</div>',
    coverage,
  ].join('');
}

function buildDashboardData(cwd, health) {
  // #773: one read path — usage.ndjson alone is empty whenever tracking is off.
  const entries = require('../tracking/usage-source').readRuns(cwd);
  const recent = entries.slice(-30);
  const tokenReductionTrend = recent.map((e) => toNumber(e.reductionPct)).filter((n) => n !== null);
  const hitAt5Trend = readBenchmarkTrend(cwd);
  const coverage = computeExtractorCoverage(cwd);

  const finals = entries.map((e) => toNumber(e.finalTokens)).filter((n) => n !== null);
  const summary = {
    grade: health.grade,
    score: health.score,
    daysSinceRegen: health.daysSinceRegen,
    totalRuns: entries.length,
    overBudgetRate: entries.length > 0
      ? parseFloat(((entries.filter((e) => e.overBudget).length / entries.length) * 100).toFixed(1))
      : 0,
    p50TokenCount: Math.round(percentile(finals, 50)),
    p95TokenCount: Math.round(percentile(finals, 95)),
    overBudgetStreak: overBudgetStreak(entries),
    extractorCoverage: coverage.pct,
  };

  const tokenReduction = readTokenReduction(cwd);

  // The sessions panel must never take the dashboard down: a store that cannot be read
  // is reported as an empty one, which the panel words as "no sessions recorded".
  let sessions;
  try {
    let config = {};
    try { config = require('../config/loader').loadConfig(cwd) || {}; } catch (_) { /* shipped profile */ }
    sessions = require('../session/report').buildReport(cwd, { config, limit: 20 });
  } catch (_) {
    sessions = null;
  }

  return {
    summary,
    tokenReductionTrend,
    hitAt5Trend,
    coverage,
    tokenReduction,
    charts: {
      tokenReductionSvg: lineChartSvg(tokenReductionTrend, 'Token reduction trend (last 30 tracked runs)', '%'),
      hitAt5Svg: lineChartSvg(hitAt5Trend, 'hit@5 trend (last 30 benchmark runs)', ''),
      coverageSvg: barChartSvg(coverage.perLanguage),
      tokenSavingsPanel: tokenReductionPanelHtml(tokenReduction),
    },
    sessions,
    sessionsPanel: sessions ? sessionsPanelHtml(sessions) : '',
  };
}

function generateDashboardHtml(cwd, health) {
  const data = buildDashboardData(cwd, health);
  const cards = [
    { label: 'Current grade', value: `${data.summary.grade} (${data.summary.score}/100)` },
    { label: 'Days since regen', value: data.summary.daysSinceRegen === null ? 'n/a' : String(data.summary.daysSinceRegen) },
    { label: 'Total tracked runs', value: String(data.summary.totalRuns) },
    { label: 'Over-budget %', value: `${data.summary.overBudgetRate}%` },
    { label: 'p50 token count', value: String(data.summary.p50TokenCount) },
    { label: 'p95 token count', value: String(data.summary.p95TokenCount) },
    { label: 'Over-budget streak', value: String(data.summary.overBudgetStreak) },
    { label: 'Extractor coverage', value: `${data.summary.extractorCoverage}%` },
  ];

  const cardHtml = cards.map((c) => `<div class="card"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`).join('');

  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>',
    '<title>SigMap Dashboard</title>',
    '<style>',
    'body{margin:0;background:#0a0f1e;color:#e6ecff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
    '.wrap{max-width:980px;margin:0 auto;padding:24px}',
    'h1{font-size:22px;margin:0 0 6px 0}',
    '.sub{color:#8ea0d9;font-size:12px;margin-bottom:20px}',
    '.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}',
    '.card{background:#111a33;border:1px solid #223056;border-radius:10px;padding:10px}',
    '.label{font-size:11px;color:#8ea0d9;margin-bottom:6px}',
    '.value{font-size:16px;color:#f5f7ff}',
    '.panel{background:#111a33;border:1px solid #223056;border-radius:12px;padding:10px;margin-top:12px}',
    '@media (max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));}}',
    '</style>',
    '</head>',
    '<body>',
    '<div class="wrap">',
    '<h1>SigMap v2.10 dashboard</h1>',
    '<div class="sub">Self-contained report. No external scripts, styles, or network calls.</div>',
    `<div class="grid">${cardHtml}</div>`,
    data.charts.tokenSavingsPanel,
    data.sessionsPanel,
    `<div class="panel">${data.charts.tokenReductionSvg}</div>`,
    `<div class="panel">${data.charts.hitAt5Svg}</div>`,
    `<div class="panel">${data.charts.coverageSvg}</div>`,
    '</div>',
    '</body>',
    '</html>',
  ].join('');

  return { html, data };
}

function renderHistoryCharts(cwd, health) {
  const data = buildDashboardData(cwd, health);
  const lines = [
    '[sigmap] history charts:',
    `  token reduction trend : ${sparkline(data.tokenReductionTrend)}`,
    `  hit@5 trend           : ${sparkline(data.hitAt5Trend)}`,
    `  extractor coverage    : ${data.coverage.covered}/${data.coverage.supported} (${data.coverage.pct}%)`,
    '',
    '[sigmap] inline svg: token reduction',
    data.charts.tokenReductionSvg,
    '',
    '[sigmap] inline svg: hit@5',
    data.charts.hitAt5Svg,
    '',
    '[sigmap] inline svg: coverage',
    data.charts.coverageSvg,
  ];

  return {
    text: lines.join('\n'),
    tokenReductionSparkline: sparkline(data.tokenReductionTrend),
    hitAt5Sparkline: sparkline(data.hitAt5Trend),
    summary: data.summary,
    charts: data.charts,
  };
}

module.exports = { generateDashboardHtml, renderHistoryCharts, computeExtractorCoverage, percentile, overBudgetStreak };
