'use strict';

const fs = require('fs');
const path = require('path');

module.exports = { loadSession, saveSession, mergeSessionContext, clearSession };

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;   // 4 hours — one coding session

function sessionPath(cwd) {
  return path.join(cwd, '.context', 'session.json');
}

function loadSession(cwd) {
  const p = sessionPath(cwd);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (Date.now() - raw.ts > SESSION_TTL_MS) return null;  // expired
    return raw;
  } catch {
    return null;
  }
}

function saveSession(cwd, { intent, topFiles, query }) {
  const p = sessionPath(cwd);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({
    ts: Date.now(),
    intent,
    topFiles,   // [{ file, score }] — top 5 from last ask
    lastQuery: query,
  }));
}

// Merge session context as additional ranking signal:
// any file that appeared in the previous session's top-5 gets a +0.2 boost
// Reduce to +0.1 if the intent has changed (topic switch guard)
function mergeSessionContext(scores, session, currentIntent) {
  if (!session) return scores;

  const boostAmount = session.intent === currentIntent ? 0.20 : 0.10;
  const sessionBoost = new Map(session.topFiles.map(f => [f.file, boostAmount]));

  return scores.map(r => ({
    ...r,
    // Additive boost — cannot reduce a score
    score: r.score + (sessionBoost.get(r.file) || 0),
  }));
}

function clearSession(cwd) {
  const p = sessionPath(cwd);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
