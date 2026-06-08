'use strict';

/**
 * Decision-log notes (Memory, v6.16.0).
 *
 * A tiny append-only log of human/agent notes that survives across sessions,
 * so an agent starting cold can recall "what were we doing / why". Stored as
 * NDJSON under `.context/` to match the project's other state logs
 * (usage.ndjson, benchmark-history.ndjson). Zero dependencies.
 *
 * Consumed by the `read_memory` MCP tool and the `sigmap note` / `sigmap status`
 * commands. Complements `src/session/memory.js` (ranking session) rather than
 * duplicating it.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NOTES_FILE = path.join('.context', 'notes.ndjson');
const MAX_TEXT = 2000;

function notesPath(cwd) {
  return path.join(cwd, NOTES_FILE);
}

function _currentBranch(cwd) {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim() || null;
  } catch (_) {
    return null;
  }
}

/**
 * Append a note. Returns the stored entry.
 * @param {string} cwd
 * @param {string} text
 * @param {object} [opts]
 * @param {string|null} [opts.branch]  override branch (default: current git branch)
 * @param {string} [opts.tag]          optional category tag
 */
function addNote(cwd, text, opts = {}) {
  const clean = String(text == null ? '' : text).trim().slice(0, MAX_TEXT);
  if (!clean) throw new Error('note text is empty');
  const entry = {
    ts: new Date().toISOString(),
    text: clean,
    branch: opts.branch !== undefined ? opts.branch : _currentBranch(cwd),
  };
  if (opts.tag) entry.tag = String(opts.tag).trim().slice(0, 40);
  const p = notesPath(cwd);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(entry) + '\n');
  return entry;
}

/**
 * Read notes in chronological order (oldest first).
 * @param {string} cwd
 * @param {number} [limit=0]  keep only the most recent N (0 = all)
 * @returns {object[]}
 */
function readNotes(cwd, limit = 0) {
  let raw;
  try { raw = fs.readFileSync(notesPath(cwd), 'utf8'); }
  catch (_) { return []; }
  const out = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch (_) { /* skip corrupt line */ }
  }
  if (limit > 0 && out.length > limit) return out.slice(out.length - limit);
  return out;
}

/** Format notes as a Markdown list (pass already-ordered notes). */
function formatNotes(notes) {
  if (!notes || !notes.length) {
    return 'No notes recorded yet. Add one with: sigmap note "<text>"';
  }
  return notes.map((n) => {
    const when = String(n.ts || '').replace('T', ' ').slice(0, 16);
    const br = n.branch ? ` (${n.branch})` : '';
    const tag = n.tag ? ` #${n.tag}` : '';
    return `- [${when}${br}]${tag} ${n.text}`;
  }).join('\n');
}

/** Delete the notes log. Returns true if a file was removed. */
function clearNotes(cwd) {
  try { fs.unlinkSync(notesPath(cwd)); return true; }
  catch (_) { return false; }
}

module.exports = { notesPath, addNote, readNotes, formatNotes, clearNotes };
