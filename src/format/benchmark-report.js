'use strict';

const fs = require('fs');
const path = require('path');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'n/a';
  return Math.round(n).toLocaleString('en-US');
}

function formatCompact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'n/a';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatPct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'n/a';
  return `${n.toFixed(digits)}%`;
}

function formatMaybePct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'n/a';
  return `${n.toFixed(digits)}%`;
}

function formatRatio(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'n/a';
  return `${n.toFixed(digits)}x`;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'n/a';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function durationLabel(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return 'n/a';
  const sec = n / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const rem = sec - (min * 60);
  return `${min}m ${rem.toFixed(1)}s`;
}

function maxOrZero(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return Math.max(...values.map((v) => (Number.isFinite(v) ? v : 0)));
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function loadBenchmarkReports(cwd) {
  const reportsDir = path.join(cwd, 'benchmarks', 'reports');
  return {
    reportsDir,
    token: readJson(path.join(reportsDir, 'token-reduction.json')),
    retrieval: readJson(path.join(reportsDir, 'retrieval.json')),
    quality: readJson(path.join(reportsDir, 'quality.json')),
    task: readJson(path.join(reportsDir, 'task-benchmark.json')),
    matrix: readJson(path.join(reportsDir, 'benchmark-matrix.json')),
  };
}

function buildRetrievalSummary(retrieval) {
  if (!retrieval || !Array.isArray(retrieval.repos) || retrieval.repos.length === 0) return null;
  let totalTasks = 0;
  let weightedHit = 0;
  let weightedRand = 0;
  let correct = 0;
  let partial = 0;
  let wrong = 0;
  let repoCount = 0;

  for (const repo of retrieval.repos) {
    const tasks = Number(repo.tasks) || 0;
    repoCount++;
    totalTasks += tasks;
    weightedHit += (Number(repo.hitAt5) || 0) * tasks;
    weightedRand += (Number(repo.randomBaseline) || 0) * tasks;
    correct += Number(repo.tiers && repo.tiers.correct) || 0;
    partial += Number(repo.tiers && repo.tiers.partial) || 0;
    wrong += Number(repo.tiers && repo.tiers.wrong) || 0;
  }

  const hitAt5 = totalTasks > 0 ? (weightedHit / totalTasks) * 100 : null;
  const randomBaseline = totalTasks > 0 ? (weightedRand / totalTasks) * 100 : null;
  const lift = hitAt5 && randomBaseline ? hitAt5 / randomBaseline : null;

  return {
    repoCount,
    totalTasks,
    hitAt5,
    randomBaseline,
    lift,
    correct,
    partial,
    wrong,
  };
}

function buildBenchmarkSummary(reports, matrixSummary) {
  const missing = [];
  if (!reports.token) missing.push('token-reduction.json');
  if (!reports.retrieval) missing.push('retrieval.json');
  if (!reports.quality) missing.push('quality.json');
  if (!reports.task) missing.push('task-benchmark.json');

  const retrievalSummary = buildRetrievalSummary(reports.retrieval);
  const qualitySummary = reports.quality && reports.quality.summary ? reports.quality.summary : null;
  const tokenSummary = reports.token && reports.token.summary ? reports.token.summary : null;
  const taskSummary = reports.task && reports.task.summary ? reports.task.summary : null;
  const matrix = matrixSummary || reports.matrix || null;

  const generatedCandidates = [
    matrix && matrix.generated,
    reports.task && reports.task.generated,
    reports.retrieval && reports.retrieval.generated,
    reports.quality && reports.quality.timestamp,
    reports.token && reports.token.timestamp,
  ].filter(Boolean);
  const generatedAt = generatedCandidates
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time)[0];

  return {
    generatedAt: (generatedAt && generatedAt.value) || generatedCandidates[0] || new Date().toISOString(),
    missing,
    tokenSummary,
    retrievalSummary,
    qualitySummary,
    taskSummary,
    matrix,
  };
}

function renderCard(label, value, hint, tone) {
  const toneClass = tone ? ` ${tone}` : '';
  return [
    `<article class="card${toneClass}">`,
    `<div class="label">${escapeHtml(label)}</div>`,
    `<div class="value">${escapeHtml(value)}</div>`,
    `<div class="hint">${escapeHtml(hint || '')}</div>`,
    '</article>',
  ].join('');
}

function renderProgress(label, value, max, suffix) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeMax = Math.max(1, Number.isFinite(max) ? max : 1);
  const width = Math.max(2, Math.min(100, (safeValue / safeMax) * 100));
  return [
    '<div class="progress-row">',
    `<div class="progress-label">${escapeHtml(label)}</div>`,
    '<div class="progress-bar"><span style="width:',
    String(width.toFixed(1)),
    '%"></span></div>',
    `<div class="progress-value">${escapeHtml(`${safeValue}${suffix || ''}`)}</div>`,
    '</div>',
  ].join('');
}

function renderMatrixSection(matrix) {
  if (!matrix || !Array.isArray(matrix.steps) || matrix.steps.length === 0) return '';
  const rows = matrix.steps.map((step) => {
    const status = step.ok ? 'ok' : 'fail';
    return [
      '<tr>',
      `<td>${escapeHtml(step.name)}</td>`,
      `<td><span class="badge ${status}">${escapeHtml(step.ok ? 'ok' : `exit ${step.status}`)}</span></td>`,
      `<td>${escapeHtml(durationLabel(step.durationMs))}</td>`,
      `<td><code>${escapeHtml(['node', step.script].concat(step.args || []).join(' '))}</code></td>`,
      '</tr>',
    ].join('');
  }).join('');

  return [
    '<section>',
    '<h2>Run matrix</h2>',
    '<p class="section-copy">This shows which benchmark jobs ran, whether they succeeded, and how long each step took.</p>',
    '<table>',
    '<thead><tr><th>Step</th><th>Status</th><th>Duration</th><th>Command</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '</section>',
  ].join('');
}

function renderTokenSection(token) {
  if (!token || !Array.isArray(token.repos) || token.repos.length === 0) return '';
  const rows = token.repos
    .slice()
    .sort((a, b) => (b.reductionPct || 0) - (a.reductionPct || 0))
    .map((repo) => [
      '<tr>',
      `<td>${escapeHtml(repo.repo)}</td>`,
      `<td>${escapeHtml(repo.language || 'n/a')}</td>`,
      `<td>${escapeHtml(formatCompact(repo.rawTokens))}</td>`,
      `<td>${escapeHtml(formatCompact(repo.finalTokens))}</td>`,
      `<td>${escapeHtml(formatMaybePct(repo.reductionPct, 1))}</td>`,
      '</tr>',
    ].join(''))
    .join('');

  return [
    '<section>',
    '<h2>Token reduction</h2>',
    '<p class="section-copy">Raw repository tokens versus SigMap output size across the benchmark repos.</p>',
    '<table>',
    '<thead><tr><th>Repo</th><th>Language</th><th>Raw tokens</th><th>Final tokens</th><th>Reduction</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '</section>',
  ].join('');
}

function renderRetrievalSection(retrieval) {
  if (!retrieval || !Array.isArray(retrieval.repos) || retrieval.repos.length === 0) return '';
  const rows = retrieval.repos.map((repo) => {
    const lift = repo.randomBaseline > 0 ? (repo.hitAt5 / repo.randomBaseline) : null;
    return [
      '<tr>',
      `<td>${escapeHtml(repo.repo)}</td>`,
      `<td>${escapeHtml(formatMaybePct((repo.randomBaseline || 0) * 100, 1))}</td>`,
      `<td>${escapeHtml(formatMaybePct((repo.hitAt5 || 0) * 100, 1))}</td>`,
      `<td>${escapeHtml(formatRatio(lift, 1))}</td>`,
      `<td>${escapeHtml(String((repo.tiers && repo.tiers.correct) || 0))}</td>`,
      `<td>${escapeHtml(String((repo.tiers && repo.tiers.partial) || 0))}</td>`,
      `<td>${escapeHtml(String((repo.tiers && repo.tiers.wrong) || 0))}</td>`,
      '</tr>',
    ].join('');
  }).join('');

  return [
    '<section>',
    '<h2>Retrieval quality</h2>',
    '<p class="section-copy">Hit@5 performance against the random baseline, plus the quality-tier mix that drives the task benchmark.</p>',
    '<table>',
    '<thead><tr><th>Repo</th><th>Random hit@5</th><th>SigMap hit@5</th><th>Lift</th><th>Correct</th><th>Partial</th><th>Wrong</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '</section>',
  ].join('');
}

function renderQualitySection(quality) {
  if (!quality || !Array.isArray(quality.repos) || quality.repos.length === 0) return '';
  const rows = quality.repos.map((repo) => {
    const overflow = (repo.rawTokens || 0) > 128000 ? 'overflow' : 'fits';
    return [
      '<tr>',
      `<td>${escapeHtml(repo.repo)}</td>`,
      `<td>${escapeHtml(formatInt(repo.groundedSymbols))}</td>`,
      `<td>${escapeHtml(formatInt(repo.darkSymbols))}</td>`,
      `<td>${escapeHtml(formatMaybePct(repo.groundingPct, 0))}</td>`,
      `<td>${escapeHtml(String(repo.filesHiddenRaw || 0))}</td>`,
      `<td><span class="badge ${overflow === 'overflow' ? 'warn' : 'ok'}">${escapeHtml(overflow)}</span></td>`,
      '</tr>',
    ].join('');
  }).join('');

  return [
    '<section>',
    '<h2>Quality and hallucination surface</h2>',
    '<p class="section-copy">How much code stays visible to the model, plus the overflow and dark-symbol risk by repo.</p>',
    '<table>',
    '<thead><tr><th>Repo</th><th>Grounded symbols</th><th>Dark symbols</th><th>Grounding</th><th>Hidden files (raw)</th><th>GPT-4o 128K</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '</section>',
  ].join('');
}

function renderTaskSection(task) {
  if (!task || !Array.isArray(task.repos) || task.repos.length === 0 || !task.summary) return '';
  const summary = task.summary;
  const maxReduction = maxOrZero(task.repos.map((repo) => Number(repo.reductionPct) || 0));
  const repoBars = task.repos
    .slice()
    .sort((a, b) => (b.reductionPct || 0) - (a.reductionPct || 0))
    .slice(0, 10)
    .map((repo) => renderProgress(repo.repo, Number(repo.reductionPct) || 0, maxReduction, '%'))
    .join('');

  return [
    '<section>',
    '<h2>Task benchmark</h2>',
    '<p class="section-copy">A prompt-reduction proxy derived from retrieval quality tiers. Lower prompts means the right file surfaces sooner.</p>',
    '<div class="split">',
    '<div class="panel">',
    '<h3>Answer quality tiers</h3>',
    renderProgress('Correct', Number(summary.correctPct) || 0, 100, '%'),
    renderProgress('Partial', Number(summary.partialPct) || 0, 100, '%'),
    renderProgress('Wrong', Number(summary.wrongPct) || 0, 100, '%'),
    '</div>',
    '<div class="panel">',
    '<h3>Best prompt reduction by repo</h3>',
    repoBars,
    '</div>',
    '</div>',
    '</section>',
  ].join('');
}

function generateBenchmarkReportHtml(reports, opts = {}) {
  const summary = buildBenchmarkSummary(reports, opts.matrixSummary);
  const cards = [];
  cards.push(renderCard(
    'Token reduction',
    summary.tokenSummary ? formatPct(summary.tokenSummary.overallReductionPct, 1) : 'n/a',
    summary.tokenSummary ? `${formatInt(summary.tokenSummary.repoCount)} repos • ${formatCompact(summary.tokenSummary.totalRawTokens)} raw -> ${formatCompact(summary.tokenSummary.totalFinalTokens)} final` : 'token-reduction.json missing',
    'cool'
  ));
  cards.push(renderCard(
    'Retrieval hit@5',
    summary.retrievalSummary ? formatPct(summary.retrievalSummary.hitAt5, 1) : 'n/a',
    summary.retrievalSummary ? `${formatPct(summary.retrievalSummary.randomBaseline, 1)} random baseline • ${formatRatio(summary.retrievalSummary.lift, 1)} lift` : 'retrieval.json missing',
    'warm'
  ));
  cards.push(renderCard(
    'Prompt reduction',
    summary.taskSummary ? formatPct(summary.taskSummary.avgReductionPct, 0) : 'n/a',
    summary.taskSummary ? `${summary.taskSummary.avgPromptsWithout} -> ${summary.taskSummary.avgPromptsWith} prompts • ${formatInt(summary.taskSummary.totalTasks)} tasks` : 'task-benchmark.json missing',
    'neutral'
  ));
  cards.push(renderCard(
    'Overflow risk',
    summary.qualitySummary ? `${formatInt(summary.qualitySummary.overflowGPT4oCount)} repos` : 'n/a',
    summary.qualitySummary ? `${formatInt(summary.qualitySummary.totalHiddenFiles)} hidden raw files • ${formatMoney(summary.qualitySummary.gpt4oSavedPerMonth)}/month saved` : 'quality.json missing',
    summary.qualitySummary && summary.qualitySummary.overflowGPT4oCount > 0 ? 'warn' : 'ok'
  ));

  const missingHtml = summary.missing.length > 0
    ? `<div class="notice">Missing source reports: ${escapeHtml(summary.missing.join(', '))}. The page still renders whatever data is available.</div>`
    : '';

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>SigMap Benchmark Report</title>',
    '<style>',
    ':root { color-scheme: light; --bg:#f5f1e8; --panel:#fffaf2; --ink:#1f1b16; --muted:#6a6258; --line:#dccfbf; --gold:#c87f2a; --green:#2f6f52; --blue:#2f5f8f; --red:#9f4f43; --shadow:0 18px 40px rgba(54,38,14,.10);} ',
    '*{box-sizing:border-box} body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(180deg,#f3ecdf 0%,#f7f3ed 100%);color:var(--ink)}',
    '.page{max-width:1240px;margin:0 auto;padding:28px 20px 56px}',
    'header{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:24px}',
    'h1{margin:0;font-size:clamp(2rem,4vw,3.6rem);line-height:1.02;letter-spacing:-.04em}',
    '.lede{max-width:760px;color:var(--muted);font-size:1rem;line-height:1.6;margin-top:10px}',
    '.stamp{font-size:.92rem;color:var(--muted);text-align:right}',
    '.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:20px 0 24px}',
    '.card,.panel,.notice,section{background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow);border-radius:18px}',
    '.card{padding:18px 18px 16px}.card.cool{background:#f7f5ff}.card.warm{background:#fff4eb}.card.warn{background:#fff1eb}.card.ok{background:#eff8f1}',
    '.label{font-size:.84rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}',
    '.value{font-size:2rem;font-weight:700;letter-spacing:-.04em;margin-top:8px}',
    '.hint{font-size:.95rem;color:var(--muted);margin-top:8px;line-height:1.5}',
    '.notice{padding:14px 16px;margin-bottom:20px;color:var(--muted)}',
    'section{padding:20px;margin-top:18px}',
    'h2{margin:0 0 6px;font-size:1.4rem;letter-spacing:-.03em}',
    'h3{margin:0 0 14px;font-size:1rem}',
    '.section-copy{margin:0 0 16px;color:var(--muted);line-height:1.6}',
    'table{width:100%;border-collapse:collapse;font-size:.95rem}',
    'th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}',
    'th{font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}',
    'tbody tr:hover{background:rgba(200,127,42,.06)}',
    '.badge{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}',
    '.badge.ok{background:#e6f4ea;color:#21573f}.badge.warn{background:#fff0de;color:#8a4a17}.badge.fail{background:#fde8e5;color:#8a2e23}',
    '.split{display:grid;grid-template-columns:1fr 1fr;gap:16px}',
    '.panel{padding:16px}',
    '.progress-row{display:grid;grid-template-columns:140px 1fr 60px;gap:12px;align-items:center;margin:10px 0}',
    '.progress-label,.progress-value{font-size:.92rem}',
    '.progress-bar{height:10px;border-radius:999px;background:#efe4d5;overflow:hidden}',
    '.progress-bar span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold),#ebbb61)}',
    'code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85rem}',
    '@media (max-width: 1020px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.split{grid-template-columns:1fr}header{flex-direction:column;align-items:flex-start}.stamp{text-align:left}}',
    '@media (max-width: 640px){.grid{grid-template-columns:1fr}.progress-row{grid-template-columns:110px 1fr 52px}th:nth-child(n+5),td:nth-child(n+5){display:none}}',
    '</style>',
    '</head>',
    '<body>',
    '<div class="page">',
    '<header>',
    '<div>',
    '<h1>SigMap Benchmark Report</h1>',
    '<p class="lede">A self-contained view of token reduction, retrieval quality, hallucination surface, and task-level prompt reduction. This page reads the saved JSON benchmark artifacts so it stays easy to regenerate locally.</p>',
    '</div>',
    `<div class="stamp">Generated: ${escapeHtml(summary.generatedAt)}<br />Source directory: <code>benchmarks/reports</code></div>`,
    '</header>',
    missingHtml,
    `<div class="grid">${cards.join('')}</div>`,
    renderMatrixSection(summary.matrix),
    renderTokenSection(reports.token),
    renderRetrievalSection(reports.retrieval),
    renderQualitySection(reports.quality),
    renderTaskSection(reports.task),
    '</div>',
    '</body>',
    '</html>',
  ].join('');
}

function writeBenchmarkReport(cwd, opts = {}) {
  const reports = loadBenchmarkReports(cwd);
  const html = generateBenchmarkReportHtml(reports, opts);
  const filePath = path.join(reports.reportsDir, opts.fileName || 'benchmark-report.html');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html, 'utf8');
  return {
    file: filePath,
    summary: buildBenchmarkSummary(reports, opts.matrixSummary),
  };
}

module.exports = {
  loadBenchmarkReports,
  buildBenchmarkSummary,
  generateBenchmarkReportHtml,
  writeBenchmarkReport,
};
