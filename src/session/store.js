'use strict';

/**
 * Session store (#922, SI-2 of the Session Intelligence epic #682).
 *
 * `.context/sessions.ndjson` is an APPEND-ONLY, event-sourced log. Several agents
 * (and a CI job) may write it at once, so an upsert-in-place record would race;
 * instead every writer appends one self-contained line with a single O_APPEND
 * write, and readers FOLD the lines by session id.
 *
 * Event kinds
 *   start   a session began                       {agent, branch, source}
 *   usage   billed token totals so far            {source, model, usage, offset, ...}
 *   end     a session ended                       {reason}
 *   query   one `sigmap ask` during the session   {q | qh, files}
 *   rollup  written only by compaction            {month, agent, model, source, sessions, usage}
 *
 * Correctness contract (binding, from #682)
 *   - every number carries a provenance (`source`); totals are only ever summed
 *     within one provenance class, never blended;
 *   - unknown stays unknown: a session whose usage could not be read has
 *     `usage: null`, and a category an agent did not report is `null`, never 0;
 *   - token sums are per-request BILLING categories (in / out / cache read /
 *     cache write) — they are not "context size" and no output calls them that.
 *
 * A `usage` event carries CUMULATIVE totals (counted once per message) up to a
 * transcript byte `offset`; the fold keeps the event with the highest offset.
 * That makes a Stop + SessionEnd double-fire, or two parsers racing, idempotent:
 * both write the same totals and the fold takes one of them.
 *
 * The fold is order-independent: every field that can differ between lines is
 * decided by the event's own timestamp (ties: the later line), never by file order.
 *
 * Everything read back from the file is treated as untrusted text (a transcript
 * field ends up in it): strings are stripped of control characters and capped
 * before they reach a terminal, a summary, or an instruction file.
 *
 * Zero dependencies; local files only.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { redactText } = require('../security/redact');

const SCHEMA = 1;
const STORE_FILE = path.join('.context', 'sessions.ndjson');
const LOCK_FILE = path.join('.context', 'sessions.lock');
const LOCK_STALE_MS = 30000;
// A single write() of a short line is not interleaved with other appenders'.
// Keeping events small is what keeps that true, so oversize is refused.
const MAX_EVENT_BYTES = 4000;
const MAX_QUERY_CHARS = 200;
const MAX_TAIL_PASSES = 20;

const KINDS = ['start', 'usage', 'end', 'query', 'rollup'];
const CATEGORIES = ['in', 'out', 'cacheRead', 'cacheWrite'];
// A host that has no notion of caching may leave these unreported; in/out always count.
const OPTIONAL_CATEGORIES = ['cacheRead', 'cacheWrite'];
const SOURCES = ['transcript', 'agent-reported', 'estimate', 'unavailable'];
// Only used to break a tie between two usage events at the same offset.
const SOURCE_RANK = { transcript: 3, 'agent-reported': 2, estimate: 1, unavailable: 0 };
const PROVENANCE = {
  transcript: 'measured',
  'agent-reported': 'agent-reported',
  estimate: 'estimated (chars/4 ±5%)',
  unavailable: 'unavailable',
};
const PREFIXES = {
  'claude-code': 'cc', cursor: 'cur', codex: 'cod', ci: 'ci',
  copilot: 'cop', gemini: 'gem', windsurf: 'win', opencode: 'oc',
};

const DEFAULT_RETENTION_DAYS = 90;
const LOG_QUERY_MODES = ['full', 'hashed', 'off'];

function storePath(cwd) {
  return path.join(cwd, STORE_FILE);
}

function tsMs(ts) {
  const n = typeof ts === 'string' ? Date.parse(ts) : NaN;
  return Number.isFinite(n) ? n : NaN;
}

/**
 * A string safe to print, store and embed: control characters (including ESC and
 * newlines) become spaces, whitespace collapses, and the length is capped.
 * Returns null for anything that is not a non-empty string.
 */
function cleanStr(v, max) {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max || 80) : null;
}

/** An ISO-8601 timestamp, or null — a transcript's `timestamp` is not trusted to be one. */
function cleanIso(v) {
  if (typeof v !== 'string' || v.length > 40) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(v)) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

/**
 * The `session` config block with every default applied and every bad value
 * replaced by its default (a typo in config must not disable capture silently
 * or crash a hook).
 */
function sessionConfig(config) {
  const raw = (config && config.session && typeof config.session === 'object') ? config.session : {};
  const ret = (raw.retention && typeof raw.retention === 'object') ? raw.retention : {};
  const days = Number.isFinite(ret.days) && ret.days > 0 ? ret.days : DEFAULT_RETENTION_DAYS;
  const compact = ret.compact === 'off' ? 'off' : 'monthly';
  const logQueries = LOG_QUERY_MODES.includes(raw.logQueries) ? raw.logQueries : 'hashed';
  return { retention: { days, compact }, logQueries, injectSummary: raw.injectSummary === true };
}

/** The agent-prefixed id for a raw agent session id (`cc-<uuid>`). */
function sessionId(agent, raw) {
  const prefix = PREFIXES[agent]
    || String(agent || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    || 'x';
  const clean = String(raw == null ? '' : raw).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80);
  if (!clean) throw new Error('session id is empty');
  return clean.startsWith(`${prefix}-`) ? clean : `${prefix}-${clean}`;
}

/** The agent an id belongs to, from its prefix; null when it has none we know. */
function agentOfId(id) {
  const prefix = String(id || '').split('-')[0];
  for (const [agent, p] of Object.entries(PREFIXES)) if (p === prefix) return agent;
  return null;
}

/**
 * Append one event. One `write(2)` on an O_APPEND descriptor, so concurrent
 * writers interleave whole lines, never bytes.
 * @returns {object} the stored event
 */
function appendEvent(cwd, event) {
  if (!event || !KINDS.includes(event.kind)) throw new Error(`unknown session event kind: ${event && event.kind}`);
  if (typeof event.id !== 'string' || !event.id) throw new Error('session event needs an id');
  const { kind, id, ts, ...rest } = event;
  const rec = { schema: SCHEMA, kind, id, ts: cleanIso(ts) || new Date().toISOString(), ...rest };
  const line = JSON.stringify(rec) + '\n';
  if (Buffer.byteLength(line) > MAX_EVENT_BYTES) throw new Error(`session event is larger than ${MAX_EVENT_BYTES} bytes`);
  const file = storePath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'a');
  try { fs.writeSync(fd, line); } finally { fs.closeSync(fd); }
  return rec;
}

/**
 * Read every event. Unparseable lines and lines of another schema version are
 * skipped and COUNTED, never fatal — a half-written or future line must not
 * hide the rest of the history.
 * @returns {{ events: object[], corrupt: number, unsupported: number }}
 */
function readEvents(cwd) {
  let raw;
  try { raw = fs.readFileSync(storePath(cwd), 'utf8'); } catch (_) { return { events: [], corrupt: 0, unsupported: 0 }; }
  return parseEvents(raw);
}

/** How compaction and the reader see one line: an event, a line to carry through untouched, or damage. */
function classifyLine(line) {
  const t = line.trim();
  if (!t) return { type: 'blank' };
  let e;
  try { e = JSON.parse(t); } catch (_) { return { type: 'corrupt' }; }
  if (!e || typeof e !== 'object' || Array.isArray(e)) return { type: 'corrupt' };
  if (e.schema !== SCHEMA) return { type: 'foreign', line: t };           // another SigMap's schema: not ours to judge
  if (typeof e.id !== 'string' || !e.id) return { type: 'corrupt' };
  if (!KINDS.includes(e.kind)) return { type: 'foreign', line: t };       // a kind a newer minor added
  return { type: 'event', event: e, line: t };
}

function parseEvents(raw) {
  const events = [];
  let corrupt = 0;
  let unsupported = 0;
  for (const line of raw.split('\n')) {
    const c = classifyLine(line);
    if (c.type === 'event') events.push(c.event);
    else if (c.type === 'foreign') unsupported++;
    else if (c.type === 'corrupt') corrupt++;
  }
  return { events, corrupt, unsupported };
}

/**
 * A usage object with each category a finite non-negative number — or, for the
 * cache categories only, an explicit `null` ("this agent did not report it").
 * Anything else is not usage at all.
 */
function _cats(u) {
  if (!u || typeof u !== 'object') return null;
  const out = {};
  for (const c of CATEGORIES) {
    const v = u[c];
    if (v === null && OPTIONAL_CATEGORIES.includes(c)) { out[c] = null; continue; }
    if (!Number.isFinite(v) || v < 0) return null;
    out[c] = v;
  }
  return out;
}

/**
 * Add two usage accumulators. A category is null only when NEITHER side reported
 * it; `unreported` names every category at least one side did not report, so a
 * sum that is a floor rather than a total can say so.
 * An accumulator is `{ usage, unreported }`; `null` is the identity.
 */
function mergeUsage(a, b) {
  if (!a) return b;
  if (!b) return a;
  const usage = {};
  const unreported = new Set([...(a.unreported || []), ...(b.unreported || [])]);
  for (const c of CATEGORIES) {
    const av = a.usage[c];
    const bv = b.usage[c];
    if (av === null && bv === null) usage[c] = null;
    else usage[c] = (av || 0) + (bv || 0);
    if ((av === null) !== (bv === null)) unreported.add(c);
    if (av === null && bv === null) unreported.add(c);
  }
  return { usage, unreported: [...unreported].sort() };
}

/** The accumulator for one folded session (`null` when its usage is unavailable). */
function usageOf(session) {
  if (!session || !session.usage) return null;
  return { usage: session.usage, unreported: CATEGORIES.filter((c) => session.usage[c] === null) };
}

function _usageTie(a, b) {
  const at = tsMs(a.ts);
  const bt = tsMs(b.ts);
  if (Number.isNaN(at) !== Number.isNaN(bt)) return !Number.isNaN(at);   // a real timestamp beats a bad one, whatever the order
  if (!Number.isNaN(at) && at !== bt) return at > bt;
  return true;                                                          // equal in every respect: the later line wins
}

function _better(a, b) {
  if (!b) return true;
  const ao = Number.isFinite(a.offset) ? a.offset : 0;
  const bo = Number.isFinite(b.offset) ? b.offset : 0;
  if (ao !== bo) return ao > bo;
  const ar = SOURCE_RANK[a.source] || 0;
  const br = SOURCE_RANK[b.source] || 0;
  if (ar !== br) return ar > br;
  return _usageTie(a, b);
}

/** Should a value stamped `ts` replace one stamped `prev`? Latest timestamp wins; ties and unstamped: the later line. */
function _later(ts, prev) {
  const t = tsMs(ts);
  const p = tsMs(prev);
  if (Number.isNaN(p)) return true;
  if (Number.isNaN(t)) return false;
  return t >= p;
}

/**
 * Fold events into one record per session id, plus the compaction rollups.
 * Deterministic and independent of line order: sessions come back ordered by
 * start time, then id.
 * @returns {{ sessions: object[], rollups: object[] }}
 */
function foldSessions(events) {
  const byId = new Map();
  const rollups = [];
  for (const e of events) {
    if (e.kind === 'rollup') { rollups.push(e); continue; }
    let s = byId.get(e.id);
    if (!s) {
      s = {
        id: e.id, agent: agentOfId(e.id), startedAt: null, endedAt: null, lastTs: null, endReason: null,
        branch: null, queries: [], events: 0, _best: null, _at: {},
      };
      byId.set(e.id, s);
    }
    s.events++;
    const ts = cleanIso(e.ts);
    const t = tsMs(ts);
    if (!Number.isNaN(t) && (s.lastTs == null || t > tsMs(s.lastTs))) s.lastTs = ts;
    const agent = cleanStr(e.agent, 20);
    if (agent && _later(ts, s._at.agent)) { s.agent = agent; s._at.agent = ts; }
    if (e.kind === 'start') {
      if (!Number.isNaN(t) && (s.startedAt == null || t < tsMs(s.startedAt))) s.startedAt = ts;
      if (!Number.isNaN(t) && (s.lastStartAt == null || t > tsMs(s.lastStartAt))) s.lastStartAt = ts;
      if (typeof e.branch === 'string' && _later(ts, s._at.branch)) { s.branch = cleanStr(e.branch, 120); s._at.branch = ts; }
      if (typeof e.startSource === 'string' && _later(ts, s._at.startSource)) { s.startSource = cleanStr(e.startSource, 20); s._at.startSource = ts; }
      if (e.ci === true) s.ci = true;
    } else if (e.kind === 'end') {
      // The end time and its reason come from the same (latest) `end`, never one from each.
      if (!Number.isNaN(t) && (s.endedAt == null || t >= tsMs(s.endedAt))) {
        s.endedAt = ts;
        s.endReason = cleanStr(e.reason, 40);
      }
    } else if (e.kind === 'query') {
      s.queries.push({
        ts, q: typeof e.q === 'string' ? cleanStr(e.q, MAX_QUERY_CHARS) : null,
        qh: typeof e.qh === 'string' ? cleanStr(e.qh, 32) : null,
        files: Array.isArray(e.files) ? e.files.map((f) => cleanStr(f, 200)).filter(Boolean) : [],
      });
    } else if (e.kind === 'usage') {
      if (_better(e, s._best)) s._best = e;
    }
  }
  const sessions = [];
  for (const s of byId.values()) {
    const b = s._best;
    delete s._best;
    delete s._at;
    const usage = b && b.source !== 'unavailable' ? _cats(b.usage) : null;
    s.usage = usage;
    s.source = usage ? b.source : 'unavailable';
    s.provenance = PROVENANCE[s.source];
    s.model = (b && cleanStr(b.model, 80)) || 'unknown';
    s.models = null;
    if (b && b.models && typeof b.models === 'object' && !Array.isArray(b.models)) {
      s.models = Object.create(null);
      for (const [name, v] of Object.entries(b.models).slice(0, 8)) {
        const n = cleanStr(name, 80);
        if (n && v && typeof v === 'object') s.models[n] = v;
      }
    }
    s.partial = !!(b && b.partial === true);
    s.offset = b && Number.isFinite(b.offset) ? b.offset : 0;
    s.parseErrors = b && Number.isFinite(b.parseErrors) ? b.parseErrors : 0;
    s.messages = b && Number.isFinite(b.messages) ? b.messages : null;
    s.cacheGaps = b && Number.isFinite(b.cacheGaps) ? b.cacheGaps : 0;
    s.coverage = b && typeof b.coverage === 'string' ? cleanStr(b.coverage, 20) : null;
    if (s.startedAt == null) s.startedAt = (b && cleanIso(b.firstTs)) || s.lastTs;
    // A `start` after the last `end` is a resumed session: open again.
    s.ended = s.endedAt != null && !(s.lastStartAt != null && tsMs(s.lastStartAt) > tsMs(s.endedAt));
    delete s.lastStartAt;
    sessions.push(s);
  }
  sessions.sort((a, b) => {
    const at = tsMs(a.startedAt), bt = tsMs(b.startedAt);
    if (at !== bt && !Number.isNaN(at) && !Number.isNaN(bt)) return at - bt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { sessions, rollups };
}

/** Read + fold in one call. */
function readSessions(cwd) {
  const { events, corrupt, unsupported } = readEvents(cwd);
  return { ...foldSessions(events), corrupt, unsupported };
}

// ── privacy ──────────────────────────────────────────────────────────────

/**
 * The query fields to store for a mode, redacted ON WRITE:
 *   off    → null (nothing is logged)
 *   hashed → { qh } a 12-hex sha256 prefix (counts and dedupe, not content)
 *   full   → { q }  the redacted text, capped
 */
function queryRecord(text, mode) {
  if (mode === 'off') return null;
  const clean = String(text == null ? '' : text).trim();
  if (!clean) return null;
  if (mode === 'full') {
    let safe = clean;
    try { safe = redactText(clean).text; } catch (_) { /* redactText never throws; belt and braces */ }
    return { q: safe.slice(0, MAX_QUERY_CHARS) };
  }
  return { qh: crypto.createHash('sha256').update(clean).digest('hex').slice(0, 12) };
}

// ── retention ────────────────────────────────────────────────────────────

/**
 * Run `fn` holding the compaction lock; `{locked:true}` when someone else has it.
 *
 * A lock is only ever stale after a crash. Two processes that find the same stale
 * lock at the same instant may both proceed; that is tolerated because compaction
 * is idempotent (each rewrites from what is on disk and copies the tail across),
 * so the worst case is one redundant rewrite, not a double count.
 */
function withLock(cwd, fn) {
  const lock = path.join(cwd, LOCK_FILE);
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  let fd;
  for (let attempt = 0; attempt < 2 && fd === undefined; attempt++) {
    try {
      fd = fs.openSync(lock, 'wx');
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let age = 0;
      try { age = Date.now() - fs.statSync(lock).mtimeMs; } catch (_) { continue; } // vanished: retry
      if (age <= LOCK_STALE_MS) return { locked: true };
      try { fs.unlinkSync(lock); } catch (_) { /* someone else cleared it */ }
    }
  }
  if (fd === undefined) return { locked: true };
  try {
    fs.writeSync(fd, String(process.pid));
    return { locked: false, value: fn() };
  } finally {
    try { fs.closeSync(fd); } catch (_) { /* already closed */ }
    try { fs.unlinkSync(lock); } catch (_) { /* already gone */ }
  }
}

function _month(ts) {
  return typeof ts === 'string' && /^\d{4}-\d{2}/.test(ts) ? ts.slice(0, 7) : 'unknown';
}

/**
 * Fold sessions older than `days` into monthly rollups and drop their raw events.
 * Rollups are keyed by (month, agent, model, source), so two provenance classes
 * never merge. A rollup of sessions whose usage was unavailable carries
 * `usage: null`; a category none of them reported is `null`, and `unreported`
 * names the categories some did not. Idempotent, and a no-op (no rewrite) when
 * nothing is old.
 *
 * Lines compaction does not understand are NOT its to delete: another schema
 * version, or a kind a newer SigMap added, is carried through byte for byte.
 * Only lines that are not JSON at all are dropped.
 *
 * The rewrite is tmp-file + rename. Appenders take no lock, so after the tmp
 * file is written the live file is re-checked and whatever was appended in the
 * meantime is copied across — repeatedly, until the size stops moving. What
 * remains is the instant between the last size check and the rename.
 *
 * @param {string} cwd
 * @param {{ days?: number, now?: number, _afterTmpWrite?: Function }} [opts]
 *        `_afterTmpWrite` is a test seam: it runs right after the tmp file is written.
 */
function compact(cwd, opts = {}) {
  const days = Number.isFinite(opts.days) && opts.days > 0 ? opts.days : DEFAULT_RETENTION_DAYS;
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const file = storePath(cwd);
  if (!fs.existsSync(file)) return { action: 'none', sessions: 0, removedEvents: 0 };
  const res = withLock(cwd, () => {
    const buf = fs.readFileSync(file);
    const entries = [];
    for (const line of buf.toString('utf8').split('\n')) {
      const c = classifyLine(line);
      if (c.type === 'event' || c.type === 'foreign') entries.push(c);
    }
    const events = entries.filter((c) => c.type === 'event').map((c) => c.event);
    const { sessions } = foldSessions(events);
    const cutoff = now - days * 86400000;
    const old = new Set(sessions.filter((s) => {
      const t = tsMs(s.lastTs);
      return !Number.isNaN(t) && t < cutoff;
    }).map((s) => s.id));
    if (old.size === 0) return { action: 'none', sessions: 0, removedEvents: 0 };

    const groups = new Map();
    const group = (key, init) => {
      if (!groups.has(key)) groups.set(key, init);
      return groups.get(key);
    };
    for (const s of sessions) {
      if (!old.has(s.id)) continue;
      const m = _month(s.lastTs);
      const g = group([m, s.agent || 'unknown', s.model, s.source].join('|'),
        { month: m, agent: s.agent || 'unknown', model: s.model, source: s.source, sessions: 0, acc: null });
      g.sessions++;
      g.acc = mergeUsage(g.acc, usageOf(s));
    }
    for (const e of events) {
      if (e.kind !== 'rollup') continue;
      const g = group([e.month, e.agent, e.model, e.source].join('|'),
        { month: e.month, agent: e.agent, model: e.model, source: e.source, sessions: 0, acc: null });
      g.sessions += Number.isFinite(e.sessions) ? e.sessions : 0;
      const u = _cats(e.usage);
      if (u) g.acc = mergeUsage(g.acc, { usage: u, unreported: Array.isArray(e.unreported) ? e.unreported : [] });
    }

    const stamp = new Date(now).toISOString();
    const out = [];
    for (const key of [...groups.keys()].sort()) {
      const g = groups.get(key);
      const rec = {
        schema: SCHEMA, kind: 'rollup', id: `rollup-${g.month}-${g.agent}-${g.model}-${g.source}`.replace(/[^A-Za-z0-9._-]/g, '_'),
        ts: stamp, month: g.month, agent: g.agent, model: g.model, source: g.source, sessions: g.sessions,
        usage: g.acc ? g.acc.usage : null,
      };
      if (g.acc && g.acc.unreported.length) rec.unreported = g.acc.unreported;
      out.push(JSON.stringify(rec));
    }
    let kept = 0;
    let removed = 0;
    for (const c of entries) {
      if (c.type === 'foreign') { out.push(c.line); continue; }
      if (c.event.kind === 'rollup') continue;
      if (old.has(c.event.id)) { removed++; continue; }
      out.push(c.line);
      kept++;
    }
    const tmp = `${file}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tmp, out.join('\n') + '\n');
      if (typeof opts._afterTmpWrite === 'function') opts._afterTmpWrite();
      let copied = buf.length;
      for (let pass = 0; pass < MAX_TAIL_PASSES; pass++) {
        const size = fs.statSync(file).size;
        if (size <= copied) break;
        const fd = fs.openSync(file, 'r');
        const delta = Buffer.alloc(size - copied);
        try { fs.readSync(fd, delta, 0, delta.length, copied); } finally { fs.closeSync(fd); }
        fs.appendFileSync(tmp, delta);
        copied = size;
      }
      fs.renameSync(tmp, file);
    } finally {
      try { fs.unlinkSync(tmp); } catch (_) { /* renamed away, or never written */ }
    }
    return { action: 'compacted', sessions: old.size, removedEvents: removed, rollups: groups.size, keptEvents: kept };
  });
  return res.locked ? { action: 'locked', sessions: 0, removedEvents: 0 } : res.value;
}

/**
 * Compact when retention asks for it and the file is big enough to be worth a
 * read. Never throws — a failed housekeeping pass must not fail a hook.
 */
function maybeCompact(cwd, config, opts = {}) {
  try {
    const sc = sessionConfig(config);
    if (sc.retention.compact === 'off') return { action: 'off' };
    let size = 0;
    try { size = fs.statSync(storePath(cwd)).size; } catch (_) { return { action: 'none' }; }
    if (size < (opts.minBytes != null ? opts.minBytes : 65536)) return { action: 'none' };
    return compact(cwd, { days: sc.retention.days, now: opts.now });
  } catch (e) {
    return { action: 'error', error: e.message };
  }
}

/** Store health for `doctor`. */
function inspect(cwd) {
  const file = storePath(cwd);
  let bytes = 0;
  try { bytes = fs.statSync(file).size; } catch (_) { return { exists: false, path: file, bytes: 0, events: 0, corrupt: 0, unsupported: 0, sessions: 0, open: 0, rollups: 0 }; }
  const { sessions, rollups, corrupt, unsupported } = readSessions(cwd);
  let locked = false;
  try { locked = Date.now() - fs.statSync(path.join(cwd, LOCK_FILE)).mtimeMs > LOCK_STALE_MS; } catch (_) { /* no lock */ }
  return {
    exists: true, path: file, bytes, events: sessions.reduce((n, s) => n + s.events, 0),
    corrupt, unsupported, sessions: sessions.length, open: sessions.filter((s) => !s.ended).length,
    rollups: rollups.length, staleLock: locked,
  };
}

module.exports = {
  SCHEMA, STORE_FILE, KINDS, CATEGORIES, OPTIONAL_CATEGORIES, SOURCES, PROVENANCE, LOG_QUERY_MODES, DEFAULT_RETENTION_DAYS,
  storePath, sessionConfig, sessionId, agentOfId, appendEvent, readEvents, parseEvents, classifyLine, foldSessions,
  readSessions, queryRecord, compact, maybeCompact, inspect, tsMs, cleanStr, cleanIso, mergeUsage, usageOf,
};
