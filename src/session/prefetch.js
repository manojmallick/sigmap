'use strict';

/**
 * The prefetch hook (`sigmap hooks install claude --prefetch`).
 *
 * On every prompt Claude Code is about to send (the `UserPromptSubmit` hook), SigMap ranks the repository's files against the
 * prompt from its offline index and returns the top five, with their signatures and `:start-end` line anchors, as additional
 * context. The model starts the turn already holding a list of leads instead of having to ask for one. It is what `sigmap ask`
 * prints and writes to `.context/query-context.md`, run for you: this module calls the CLI, so there is one ranking implementation.
 *
 * Measured in the agent study (docs-vp/guide/agent-study), and the saving is small. On a clean comparison (Claude Code, Haiku 5.5, eight
 * repositories, first asks) this hook took real cost -4% [-7%, -1%], tool calls -41%, time -11%, total tokens -23%; the same ranking
 * placed in the prompt itself took cost -12%. A hook cannot write into the user's own turn: Claude Code adds its output as a separate
 * reminder, and the agent re-checks that list more. Three variants (plain stdout, a firmer header, a shorter block) did no better.
 * A long prompt is focused before it is ranked (src/session/query-focus.js), because a ranking over a whole prompt is only as good as the
 * prompt is focused. It is opt-in.
 *
 * What it does NOT do, and why:
 *   - It does not inject on every prompt. A prompt is skipped when it is a slash command, a shell escape or a note, has fewer than
 *     four words ("yes", "continue", "run the tests"), or when the project has no index (it never generates one: a hook must stay fast
 *     and write nothing but its own state).
 *   - It does not guess. A prompt less than 90% of whose letters are ASCII (the ranker reads only those) is not ranked: what is left of it
 *     is a few identifiers, and the list built from them was wrong for 18 of 22 such questions. On twelve repositories the guarded hook found
 *     the file in 485 runs of 540 against 492 without a hook (unguarded: 483 against 497), at no measurable cost to its saving. It does not
 *     catch an English prompt whose ranking is wrong: none of the signals tried predicts that.
 *   - It does not rank conversation. A prompt of more than two dozen words is reduced to the sentences that say something before it is
 *     ranked; a short one is ranked exactly as written.
 *   - It does not repeat itself. If the ranking for this prompt names the same files as the last one injected in the same session, it
 *     adds nothing: the earlier block is already in the conversation, and a long session would otherwise carry the same text on every turn.
 *   - It is bounded. The block is capped at 8 KiB (whole file sections, best-ranked first), the work at 8 seconds, and every failure
 *     is silent: no output, exit 0. A hook must never fail or stall someone's session.
 *
 * `SIGMAP_PREFETCH=0` in the environment turns it off without touching the settings file. `SIGMAP_PREFETCH_FOCUS=0` keeps the hook but
 * ranks the whole prompt as it was written, instead of the sentences of a long prompt that say something (src/session/query-focus.js).
 * `SIGMAP_PREFETCH_GUARD=0` ranks a prompt even when less than 90% of its letters are ASCII, which the guard otherwise leaves alone.
 *
 * Zero dependencies.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { focusQuery } = require('./query-focus');

const EVENT = 'UserPromptSubmit';
const MIN_WORDS = 4;
const READABLE_MIN = 0.9;
const MAX_QUERY_CHARS = 2000;
const MAX_BYTES = 8 * 1024;
const TIMEOUT_MS = 8000;
const STATE_FILE = 'prefetch-state.json';
const STATE_KEEP = 20;
const STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * What the block says above the ranking. It is not an instruction to do anything extra: the agent study found that "ask SigMap
 * first, then confirm" becomes a step added to the agent's own search. This only says what the list is and how far to trust it.
 * (scripts/lib/agent-ab.mjs holds the same text for the benchmark; a test keeps the two equal.)
 */
const HEADER = [
  '## Files SigMap ranked for this question',
  'Before you started, SigMap ranked this repository\'s files against the question from its offline index (no model call). These are leads, not an answer: the right file is often but not always among them. Each signature carries a `:start-end` line anchor you can Read directly. If none fits, search as you normally would.',
].join('\n');

/**
 * The share of a query's letters that are ASCII: what the ranker can read. Its tokenizer splits on anything that is not A-Z, a-z or 0-9, so
 * the words of a Chinese, Russian or Greek prompt never reach the ranking and only the identifiers inside it do. A query with no letters
 * counts as fully readable.
 */
function readableShare(text) {
  const letters = String(text).match(/\p{L}/gu) || [];
  if (letters.length === 0) return 1;
  return letters.filter((c) => /[A-Za-z]/.test(c)).length / letters.length;
}

/**
 * Whether a prompt is worth a ranking, and what to rank.
 *
 * A prompt of more than a couple of dozen words is focused first (src/session/query-focus.js): the sentences that are only conversation,
 * instructions about the answer, or pasted tool output are left out of the query. A short prompt is ranked exactly as it was written.
 *
 * @param {*} prompt
 * @param {{ focus?: boolean, guard?: boolean }} [opts] `focus: false` ranks the whole prompt; `guard: false` ranks it even when the ranker cannot read most of it
 * @returns {{ ok: boolean, reason: string|null, query?: string, focused?: boolean, readable?: number }}
 */
function screen(prompt, opts) {
  if (typeof prompt !== 'string') return { ok: false, reason: 'no prompt' };
  const text = prompt.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim();
  if (!text) return { ok: false, reason: 'empty prompt' };
  if (/^[/!#]/.test(text)) return { ok: false, reason: 'a slash command, shell escape or note' };
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORDS) return { ok: false, reason: `fewer than ${MIN_WORDS} words` };
  const f = opts && opts.focus === false ? { query: text, focused: false } : focusQuery(text);
  // One line, bounded; a leading dash would be read by `ask` as a flag.
  let query = f.query.replace(/\s+/g, ' ');
  if (query.length > MAX_QUERY_CHARS) query = query.slice(0, MAX_QUERY_CHARS).replace(/\s+\S*$/, '');
  query = query.replace(/^[-\s]+/, '');
  if (!query) return { ok: false, reason: 'empty prompt' };
  // The confidence guard. Over 222 held-out questions the ranking was wrong for 18 of the 22 whose query was less than 90% ASCII letters, and the
  // agent that trusted it found the file less often than one with no hook: a ranking built from a few identifiers in a prompt written in
  // another script is a guess, so nothing is injected and the agent works as it would without the hook.
  const readable = readableShare(query);
  if (!(opts && opts.guard === false) && readable < READABLE_MIN) {
    return { ok: false, reason: `mostly text the ranker cannot read (${Math.round(100 * readable)}% of the letters are ASCII)`, query, focused: f.focused, readable };
  }
  return { ok: true, reason: null, query, focused: f.focused, readable };
}

/** The file paths of the ranking `sigmap ask` prints: `1  path/to/file.js   8.290  299 tok`. */
function rankedFiles(ranking) {
  const out = [];
  for (const line of String(ranking).split('\n')) {
    const m = /^\s*\d+\s+(\S+)\s+-?[\d.]+\s+\d+\s*tok\b/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

/** header + ranking + signature sections, capped: whole file sections, best-ranked first, and a note saying so. */
function compose(ranking, body, maxBytes = MAX_BYTES) {
  const head = `${HEADER}\n\n${ranking}\n`;
  const room = maxBytes - Buffer.byteLength(head) - 2;
  let text = body;
  if (Buffer.byteLength(text) > room) {
    const sections = text.split(/\n(?=## )/);
    let kept = '';
    for (const s of sections) {
      if (Buffer.byteLength(kept) + Buffer.byteLength(s) + 1 > room - 60) break;
      kept += (kept ? '\n' : '') + s;
    }
    text = `${kept}\n\n(signatures of the lower-ranked files left out to keep this short)`.trim();
  }
  return text ? `${head}\n${text}\n` : head;
}

function _readState(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    return s && typeof s === 'object' && s.sessions && typeof s.sessions === 'object' ? s : { sessions: {} };
  } catch (_) { return { sessions: {} }; }
}

function _writeState(file, state, now) {
  try {
    const entries = Object.entries(state.sessions)
      .filter(([, v]) => v && now - (v.at || 0) < STATE_MAX_AGE_MS)
      .sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, STATE_KEEP);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ sessions: Object.fromEntries(entries) }), 'utf8');
    fs.renameSync(tmp, file);
  } catch (_) { /* a state file that cannot be written only means a repeat may be injected */ }
}

/**
 * Build the hook's output for one prompt.
 *
 * @param {object} payload the UserPromptSubmit payload (`prompt`, `session_id`)
 * @param {string} cwd the project root
 * @param {{ script?: string, env?: object, now?: number, maxBytes?: number, timeoutMs?: number }} [opts]
 *   `script` is the SigMap entry to run `ask` with (default: the one running now)
 * @returns {{ stdout: string|null, skipped: string|null, files: string[], bytes: number, query?: string, focused?: boolean }}
 */
function prefetch(payload, cwd, opts = {}) {
  const none = (skipped) => ({ stdout: null, skipped, files: [], bytes: 0 });
  try {
    const env = opts.env || process.env;
    if (String(env.SIGMAP_PREFETCH).trim() === '0') return none('SIGMAP_PREFETCH=0');
    const s = screen(payload && payload.prompt, { focus: String(env.SIGMAP_PREFETCH_FOCUS).trim() !== '0', guard: String(env.SIGMAP_PREFETCH_GUARD).trim() !== '0' });
    if (!s.ok) return none(s.reason);
    const indexFile = require('../retrieval/sig-index-store').indexPath(cwd);
    if (!fs.existsSync(indexFile)) return none('no index (run sigmap first)');

    const script = opts.script || process.argv[1];
    if (!script) return none('no sigmap entry to run');
    const outFile = path.join(cwd, '.context', 'query-context.md');
    fs.rmSync(outFile, { force: true }); // never read a file an earlier prompt left behind
    const r = spawnSync(process.execPath, [script, 'ask', s.query], {
      cwd, encoding: 'utf8', timeout: opts.timeoutMs || TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024,
      env: { ...env, SIGMAP_NO_UPDATE_CHECK: '1', NO_COLOR: '1' },
    });
    if (r.error || r.status !== 0) return none('ask failed');
    const ranking = String(r.stdout || '').trim();
    const files = rankedFiles(ranking);
    if (!ranking || files.length === 0) return none('nothing ranked');

    // The same files as the last block injected in this session: it is already in the conversation.
    const now = opts.now || Date.now();
    const sid = payload && typeof payload.session_id === 'string' ? payload.session_id : '';
    const sig = crypto.createHash('sha1').update(files.join('\n')).digest('hex');
    const stateFile = path.join(cwd, '.context', STATE_FILE);
    const state = sid ? _readState(stateFile) : { sessions: {} };
    if (sid && state.sessions[sid] && state.sessions[sid].sig === sig) return { ...none('same files as the last prompt'), files };

    let body = '';
    try { body = fs.readFileSync(outFile, 'utf8').replace(/^# SigMap Query Context\n(?:Generated: .*\n)?/, '').trim(); } catch (_) { body = ''; }
    const block = compose(ranking, body, opts.maxBytes || MAX_BYTES);
    if (sid) { state.sessions[sid] = { sig, at: now }; _writeState(stateFile, state, now); }
    return {
      stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: EVENT, additionalContext: block } }),
      skipped: null, files, bytes: Buffer.byteLength(block), query: s.query, focused: s.focused,
    };
  } catch (e) {
    return none(`error: ${e && e.message ? e.message : e}`);
  }
}

module.exports = { EVENT, HEADER, MIN_WORDS, READABLE_MIN, MAX_BYTES, TIMEOUT_MS, screen, readableShare, rankedFiles, compose, prefetch };
