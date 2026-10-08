'use strict';

/**
 * Warm-start session summary (#922, SI-3 of #682).
 *
 * A deterministic, no-LLM rollup of the LAST session — what it spent, which
 * files its queries surfaced, the notes written since, the open threads — so the
 * next session on any agent starts warm.
 *
 * Contract
 *   - Deterministic: the same store + notes + branch state give a byte-identical
 *     block. The header carries the last session's own timestamp, never the
 *     generation time, and nothing in the body is relative to "now".
 *   - Hard budget of MAX_TOKENS (chars/4), enforced by dropping the least useful
 *     lines first; the window is the last session plus open threads, nothing older.
 *   - Stale collapse: past `contextTtlDays` (14 when unset) the block becomes one
 *     line carrying the ABSOLUTE date, not "N days ago".
 *   - Single writer: this module renders and, when asked, injects the block at
 *     generation time. No agent hook writes it mid-session.
 *   - Redaction: every free-text field passes through the secret redactor; query
 *     text appears only when `session.logQueries` is `full`.
 *   - Billed-token categories are labelled as such, with their provenance, and an
 *     unreadable usage renders as unavailable, never as zero.
 *
 * Zero dependencies.
 */

const fs = require('fs');
const path = require('path');
const store = require('./store');
const { readNotes } = require('./notes');
const { redactText } = require('../security/redact');
const { tryGit } = require('../util/git');
const { formatUsage } = require('./render');
const { managedSectionLineStart } = require('../util/managed-section');

const SUMMARY_VERSION = 1;
const MAX_TOKENS = 400;
const DEFAULT_TTL_DAYS = 14;
const MAX_NOTES = 5;
const MAX_THREADS = 5;
const MAX_FILES = 5;
const MAX_LINE = 160;
const THREAD_TAGS = new Set(['todo', 'open', 'thread', 'next']);

const OPEN = '<!-- sigmap:session-summary';
const CLOSE = '<!-- /sigmap:session-summary -->';

/** Instruction files the opt-in injection may update (never created). */
const TARGETS = [
  ['CLAUDE.md'],
  ['AGENTS.md'],
  ['.github', 'copilot-instructions.md'],
  ['.github', 'gemini-context.md'],
];

function estimateTokens(s) {
  return Math.ceil(String(s).length / 4);
}

/** Text that cannot close the block's own markers or open a comment inside it. */
function _neutral(text) {
  return String(text == null ? '' : text).replace(/<!--|-->/g, ' ');
}

function _clean(text) {
  let t = _neutral(text).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  try { t = redactText(t).text; } catch (_) { /* redactText never throws */ }
  return t.length > MAX_LINE ? t.slice(0, MAX_LINE - 1) + '…' : t;
}

/** A git ref (or short hash) as it appears in the header: nothing outside a ref's usual characters. */
function _ref(text, max) {
  return String(text == null ? '' : text).replace(/[^A-Za-z0-9._/@+#-]/g, '_').slice(0, max);
}

function _utc(ts) {
  const ms = store.tsMs(ts);
  return Number.isNaN(ms) ? 'unknown' : new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
}

function _day(ts) {
  const ms = store.tsMs(ts);
  return Number.isNaN(ms) ? 'unknown' : new Date(ms).toISOString().slice(0, 10);
}

/** Top files surfaced by a session's queries, most-asked first, ties by path. */
function _topFiles(session) {
  const counts = new Map();
  for (const q of session.queries) for (const f of q.files) counts.set(f, (counts.get(f) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([f, n]) => `${_clean(f)} (${n})`);
}

function _header(branch, head, lastTs) {
  const b = branch ? _ref(branch, 80) : '';
  const h = head ? _ref(head, 40) : '';
  const at = b ? `${b}${h ? '@' + h : ''}` : (h || 'no-git');
  return `${OPEN} v${SUMMARY_VERSION} · ${at} · ${lastTs} -->`;
}

/**
 * Build the summary for the most recent conversational session.
 *
 * @param {string} cwd
 * @param {{ config?: object, exclude?: string, now?: number, branch?: string|null,
 *           head?: string|null, notes?: object[] }} [opts]
 * @returns {null | { text: string, stale: boolean, sessionId: string, lastTs: string,
 *                    tokens: number, truncated: boolean }}
 *   null when the store holds no eligible session.
 */
function buildSummary(cwd, opts = {}) {
  const config = opts.config || {};
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const cap = Number.isFinite(opts.maxTokens) && opts.maxTokens > 0 ? opts.maxTokens : MAX_TOKENS;
  const sc = store.sessionConfig(config);
  const { sessions } = store.readSessions(cwd);
  const eligible = sessions.filter((s) => s.id !== opts.exclude && s.agent !== 'ci' && s.lastTs);
  if (eligible.length === 0) return null;
  const last = eligible.reduce((best, s) => (store.tsMs(s.lastTs) >= store.tsMs(best.lastTs) ? s : best));

  const branch = opts.branch !== undefined ? opts.branch : (tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }) || null);
  const head = opts.head !== undefined ? opts.head : (tryGit(['rev-parse', '--short', 'HEAD'], { cwd }) || null);
  const header = _header(branch, head, last.lastTs);

  const ttlDays = Number.isFinite(config.contextTtlDays) && config.contextTtlDays > 0 ? config.contextTtlDays : DEFAULT_TTL_DAYS;
  if (now - store.tsMs(last.lastTs) > ttlDays * 86400000) {
    const text = [
      header,
      `Session summary stale — the last recorded session ended ${_day(last.lastTs)} (past the ${ttlDays}-day TTL); nothing newer to carry over.`,
      CLOSE,
    ].join('\n');
    return { text, stale: true, sessionId: last.id, lastTs: last.lastTs, tokens: estimateTokens(text), truncated: false };
  }

  const notes = Array.isArray(opts.notes) ? opts.notes : readNotes(cwd);
  const startMs = store.tsMs(last.startedAt);
  const since = notes.filter((n) => !THREAD_TAGS.has(String(n.tag || '').toLowerCase())
    && !Number.isNaN(store.tsMs(n.ts)) && (Number.isNaN(startMs) || store.tsMs(n.ts) >= startMs));
  const threads = notes.filter((n) => THREAD_TAGS.has(String(n.tag || '').toLowerCase()));
  const noteLines = since.slice(-MAX_NOTES).map((n) => `- ${_clean(n.text)}`);
  const threadLines = threads.slice(-MAX_THREADS).map((n) => `- ${_clean(n.text)}`);
  const files = _topFiles(last).slice(0, MAX_FILES);

  const when = last.ended
    ? `${_utc(last.startedAt)} → ${_utc(last.endedAt)}${last.endReason ? ` (${_clean(last.endReason)})` : ''}`
    : `${_utc(last.startedAt)} → still open or not closed cleanly`;
  const basis = [last.provenance, last.coverage === 'main' ? 'main conversation' : null, last.partial ? 'partial read' : null].filter(Boolean);
  const usageLine = last.usage
    ? `- Billed tokens (${basis.join(', ')}): ${formatUsage(last.usage)} · model ${_clean(last.model)}`
    : '- Billed tokens: unavailable (no usage was readable for this session)';
  const mode = sc.logQueries;
  const qCount = last.queries.length;
  const render = (n, t, f) => {
    const q = qCount === 0
      ? '- Queries: none recorded'
      : `- Queries: ${qCount} recorded${mode === 'full' ? '' : ' (' + mode + ')'}${f.length ? ' · files surfaced: ' + f.join(', ') : ''}`;
    const out = [
      header,
      '## Last session (warm start)',
      `- ${_clean(last.agent || 'agent')}${last.branch ? ' on ' + _clean(last.branch) : ''} · ${when}`,
      usageLine,
      q,
    ];
    if (n.length) out.push('### Notes since', ...n);
    if (t.length) out.push('### Open threads', ...t);
    out.push(CLOSE);
    return out.join('\n');
  };

  let n = noteLines.slice();
  let t = threadLines.slice();
  let f = files.slice();
  let text = render(n, t, f);
  let truncated = false;
  // Drop the least useful lines first: oldest notes, then surfaced files, then threads.
  while (estimateTokens(text) > cap) {
    truncated = true;
    if (n.length) n.shift();
    else if (f.length) f.pop();
    else if (t.length) t.pop();
    else break;
    text = render(n, t, f);
  }
  if (estimateTokens(text) > cap) {
    text = text.slice(0, Math.max(0, cap * 4 - CLOSE.length - 2)) + '…\n' + CLOSE;
    truncated = true;
  }
  return { text, stale: false, sessionId: last.id, lastTs: last.lastTs, tokens: estimateTokens(text), truncated };
}

// ── instruction-file injection (opt-in: session.injectSummary) ───────────

function _find(src) {
  const start = src.indexOf(OPEN);
  if (start === -1) return null;
  const close = src.indexOf(CLOSE, start);
  return close === -1 ? null : { start, end: close + CLOSE.length };
}

/** Put the block into file content: replace in place, else above the managed section, else append. */
function injectBlock(existing, block) {
  const src = String(existing || '');
  const hit = _find(src);
  if (hit) return src.slice(0, hit.start) + block + src.slice(hit.end);
  const sigIdx = managedSectionLineStart(src);
  if (sigIdx !== -1) return src.slice(0, sigIdx) + block + '\n\n' + src.slice(sigIdx);
  if (src.trim() === '') return block + '\n';
  return src + (src.endsWith('\n') ? '\n' : '\n\n') + block + '\n';
}

/** Remove the block (and the blank line that separated it), leaving everything else. */
function removeBlock(existing) {
  const src = String(existing || '');
  const hit = _find(src);
  if (!hit) return src;
  let end = hit.end;
  if (src.slice(end, end + 2) === '\n\n') end += 2;
  else if (src[end] === '\n') end += 1;
  const head = src.slice(0, hit.start);
  const tail = src.slice(end);
  // A block appended to the end of a file was preceded by the blank line inject added.
  if (tail === '' && head.endsWith('\n\n')) return head.slice(0, -1);
  return head + tail;
}

/**
 * Bring the instruction files in line with `session.injectSummary`:
 *   on  → inject/refresh the block (or remove it when there is nothing to say)
 *   off → remove a block an earlier run injected
 * Only files that already exist are touched, and only inside the markers.
 * Writes nothing when the content would not change, so a repo with no session
 * store is left byte-identical.
 *
 * @returns {{ enabled: boolean, files: Array<{ file: string, action: 'injected'|'updated'|'removed'|'unchanged' }> }}
 */
function syncSummaryBlocks(cwd, config, opts = {}) {
  const sc = store.sessionConfig(config);
  const res = { enabled: sc.injectSummary, files: [] };
  let block = null;
  if (sc.injectSummary) {
    try { const s = buildSummary(cwd, { config, now: opts.now, branch: opts.branch, head: opts.head }); block = s ? s.text : null; } catch (_) { block = null; }
  }
  for (const parts of TARGETS) {
    const file = path.join(cwd, ...parts);
    let existing;
    try { existing = fs.readFileSync(file, 'utf8'); } catch (_) { continue; }
    const had = _find(existing) !== null;
    const next = block ? injectBlock(existing, block) : removeBlock(existing);
    if (next === existing) { if (had || block) res.files.push({ file: parts.join('/'), action: 'unchanged' }); continue; }
    fs.writeFileSync(file, next);
    res.files.push({ file: parts.join('/'), action: block ? (had ? 'updated' : 'injected') : 'removed' });
  }
  return res;
}

module.exports = {
  SUMMARY_VERSION, MAX_TOKENS, DEFAULT_TTL_DAYS, OPEN, CLOSE, TARGETS,
  buildSummary, injectBlock, removeBlock, syncSummaryBlocks, estimateTokens,
};
