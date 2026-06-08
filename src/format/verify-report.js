'use strict';

/**
 * Hallucination Guard report view (Surface A, v6.15.0).
 *
 * Turns the `verify-ai-output --json` result into a standalone, self-contained
 * HTML report — red/amber/green per issue, with closest-match suggestions
 * inline. The visual language deliberately mirrors the planned PR-comment
 * styling so a single screenshot is reusable across docs and CI (plan proof #5).
 *
 * Zero dependencies, inline CSS/SVG, no external assets. Also exports a compact
 * Markdown renderer for CI / PR comments that shares the same structure.
 */

const TYPE_META = {
  'fake-file': { label: 'Fake file', tone: 'red', icon: '✕' },
  'fake-test-file': { label: 'Fake test file', tone: 'red', icon: '✕' },
  'fake-import': { label: 'Fake import', tone: 'red', icon: '✕' },
  'fake-npm-script': { label: 'Fake npm script', tone: 'red', icon: '✕' },
  'fake-symbol': { label: 'Fake symbol', tone: 'amber', icon: '!' },
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toneFor(issue) {
  const meta = TYPE_META[issue.type];
  if (meta) return meta.tone;
  return issue.confidence === 'high' ? 'red' : 'amber';
}

function labelFor(issue) {
  return (TYPE_META[issue.type] && TYPE_META[issue.type].label) || issue.type;
}

/**
 * Render the verify result to a full HTML document.
 * @param {{ file?: string, issues: object[], summary: object }} result
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @returns {string} HTML
 */
function renderReportHtml(result, opts = {}) {
  const issues = Array.isArray(result.issues) ? result.issues : [];
  const summary = result.summary || { total: issues.length, byType: {}, clean: issues.length === 0 };
  const file = result.file || opts.file || 'AI answer';
  const title = opts.title || 'SigMap — Hallucination Guard report';
  const clean = summary.clean || issues.length === 0;
  const byType = summary.byType || {};

  const chips = Object.keys(TYPE_META)
    .filter((t) => byType[t])
    .map((t) => `<span class="chip chip-${TYPE_META[t].tone}">${escapeHtml(TYPE_META[t].label)}: ${byType[t]}</span>`)
    .join('');

  const banner = clean
    ? `<div class="banner banner-green"><span class="dot"></span> No hallucinations detected — ${escapeHtml(String(summary.symbolsIndexed || 0))} symbols indexed</div>`
    : `<div class="banner banner-red"><span class="dot"></span> ${issues.length} issue${issues.length === 1 ? '' : 's'} found in <code>${escapeHtml(file)}</code></div>`;

  const rows = issues.map((issue) => {
    const tone = toneFor(issue);
    const sugg = issue.suggestion
      ? `<div class="suggestion">↳ ${escapeHtml(issue.suggestion)} <span class="conf">heuristic</span></div>`
      : '';
    return [
      `<li class="issue issue-${tone}">`,
      `  <div class="issue-head">`,
      `    <span class="badge badge-${tone}">${escapeHtml(labelFor(issue))}</span>`,
      `    <span class="loc">${escapeHtml(issue.location || ('L' + issue.line))}</span>`,
      `    <span class="conf conf-${escapeHtml(issue.confidence || 'high')}">${escapeHtml(issue.confidence || 'high')} confidence</span>`,
      `  </div>`,
      `  <div class="msg">${escapeHtml(issue.message || issue.value)}</div>`,
      `  ${sugg}`,
      `</li>`,
    ].join('\n');
  }).join('\n');

  const list = clean
    ? '<p class="empty">Nothing to report — every file, import, symbol, and script in the answer resolves against the repository.</p>'
    : `<ul class="issues">${rows}</ul>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: #0d1117; color: #e6edf3; }
  .wrap { max-width: 880px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #8b949e; margin: 0 0 20px; font-size: 13px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #161b22; padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
  .banner { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 8px; font-weight: 600; margin-bottom: 16px; }
  .banner-green { background: rgba(46,160,67,.15); border: 1px solid rgba(46,160,67,.4); color: #3fb950; }
  .banner-red { background: rgba(248,81,73,.12); border: 1px solid rgba(248,81,73,.4); color: #f85149; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: currentColor; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
  .chip { font-size: 12px; padding: 3px 9px; border-radius: 999px; font-weight: 600; }
  .chip-red { background: rgba(248,81,73,.15); color: #f85149; }
  .chip-amber { background: rgba(210,153,34,.18); color: #d29922; }
  ul.issues { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .issue { border: 1px solid #30363d; border-left-width: 4px; border-radius: 8px; padding: 12px 14px; background: #0f141a; }
  .issue-red { border-left-color: #f85149; }
  .issue-amber { border-left-color: #d29922; }
  .issue-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .badge { font-size: 11.5px; font-weight: 700; padding: 2px 8px; border-radius: 5px; text-transform: uppercase; letter-spacing: .03em; }
  .badge-red { background: rgba(248,81,73,.18); color: #f85149; }
  .badge-amber { background: rgba(210,153,34,.2); color: #d29922; }
  .loc { font-family: ui-monospace, monospace; color: #8b949e; font-size: 12px; }
  .conf { font-size: 11px; color: #8b949e; }
  .conf-high { color: #f85149; }
  .conf-medium { color: #d29922; }
  .msg { margin-top: 7px; font-family: ui-monospace, monospace; font-size: 12.5px; color: #e6edf3; }
  .suggestion { margin-top: 6px; font-size: 12.5px; color: #3fb950; }
  .suggestion .conf { margin-left: 6px; }
  .empty { color: #8b949e; }
  footer { margin-top: 28px; color: #6e7681; font-size: 12px; }
  a { color: #58a6ff; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Hallucination Guard report</h1>
  <p class="sub">Deterministic verification of an AI answer against the real repository — <code>sigmap verify-ai-output</code></p>
  ${banner}
  ${chips ? `<div class="chips">${chips}</div>` : ''}
  ${list}
  <footer>Generated by <a href="https://github.com/manojmallick/sigmap">SigMap</a> · offline, no LLM · suggestions are heuristic (closest-match)</footer>
</div>
</body>
</html>
`;
}

/** Compact Markdown rendering of the same result (CI / PR comments). */
function renderReportMarkdown(result) {
  const issues = Array.isArray(result.issues) ? result.issues : [];
  const summary = result.summary || {};
  const file = result.file || 'AI answer';
  if (summary.clean || issues.length === 0) {
    return `### ✅ Hallucination Guard — clean\n\nNo fabricated files, imports, symbols, or scripts in \`${file}\`.`;
  }
  const lines = [
    `### ❌ Hallucination Guard — ${issues.length} issue${issues.length === 1 ? '' : 's'} in \`${file}\``,
    '',
    '| Type | Location | Detail | Suggestion |',
    '| --- | --- | --- | --- |',
  ];
  for (const i of issues) {
    const sugg = i.suggestion ? i.suggestion.replace(/\|/g, '\\|') : '—';
    lines.push(`| ${labelFor(i)} | ${i.location || ('L' + i.line)} | \`${String(i.value).replace(/\|/g, '\\|')}\` | ${sugg} |`);
  }
  return lines.join('\n');
}

module.exports = { renderReportHtml, renderReportMarkdown, escapeHtml };
