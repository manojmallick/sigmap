'use strict';

/**
 * Claude Code transcript reader (#922).
 *
 * A Claude Code session transcript is a JSONL file the host agent writes. Its
 * schema is NOT documented, so everything here treats it as untrusted input:
 * a line that does not parse is skipped and counted, a message whose usage is not
 * a set of finite non-negative numbers is skipped and counted, a transcript with
 * no readable usage reports `source: 'unavailable'` — never zeros — and a string
 * taken from it (model, timestamp) is stripped of control characters and capped
 * before it can reach the store, a terminal or an instruction file.
 *
 * Measured on 36 local transcripts: the host repeats an assistant `message.id`
 * across several lines (one per content block) with IDENTICAL usage, and the
 * repeats are not adjacent (up to ~2,700 lines apart). So usage is counted ONCE
 * per `message.id`, tracked with a seen-set over the whole file. A full parse of
 * a 15.8 MB transcript takes ~120 ms, which is why the totals are cumulative and
 * recomputed from byte 0 rather than resumed from a watermark.
 *
 * Coverage: the main conversation only. Sidechain (subagent) lines are skipped
 * and counted in `skippedSidechain`; the event says `coverage: 'main'`.
 *
 * Only a regular file is opened: a FIFO named `*.jsonl` would block `open(2)`
 * for ever, and this runs inside a host agent's hook.
 *
 * Zero dependencies.
 */

const fs = require('fs');
const { cleanStr, cleanIso } = require('./store');

const CHUNK = 1 << 20;
const DEFAULT_DEADLINE_MS = 1500;
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024;
const MAX_MODELS = 8;
const NL = 10;

function _num(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

function _zero() {
  return { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
}

/**
 * Parse a transcript file.
 *
 * @param {string} file
 * @param {{ deadlineMs?: number, maxBytes?: number, now?: () => number }} [opts]
 * @returns {{
 *   ok: boolean, error?: string, size: number, offset: number, partial: boolean,
 *   parseErrors: number, skippedSidechain: number, unkeyed: number, messages: number,
 *   cacheGaps: number,
 *   usage: {in:number,out:number,cacheRead:number|null,cacheWrite:number|null}|null,
 *   source: 'transcript'|'unavailable', model: string,
 *   models: Object<string, object>|null, firstTs: string|null, lastTs: string|null
 * }}
 *   A cache category the host reported on NO message is `null`; one it reported on
 *   some messages is summed over those, and `cacheGaps` counts the messages that omitted it.
 */
function parseTranscript(file, opts = {}) {
  const now = opts.now || Date.now;
  const deadline = now() + (Number.isFinite(opts.deadlineMs) ? opts.deadlineMs : DEFAULT_DEADLINE_MS);
  const maxBytes = Number.isFinite(opts.maxBytes) ? opts.maxBytes : DEFAULT_MAX_BYTES;
  const res = {
    ok: false, size: 0, offset: 0, partial: false, parseErrors: 0, skippedSidechain: 0, unkeyed: 0,
    messages: 0, cacheGaps: 0, usage: null, source: 'unavailable', model: 'unknown', models: null, firstTs: null, lastTs: null,
  };

  let fd;
  try {
    // stat first: opening a FIFO or device would block before any check could run.
    if (!fs.statSync(file).isFile()) { res.error = 'not a regular file'; return res; }
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK || 0));
    const st = fs.fstatSync(fd);
    if (!st.isFile()) { fs.closeSync(fd); res.error = 'not a regular file'; return res; }
    res.size = st.size;
  } catch (e) {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) { /* ignore */ } }
    res.error = e.code || e.message;
    return res;
  }

  const seen = new Set();
  const total = _zero();
  const byModel = new Map();
  let unknownModelMessages = 0;
  let missingCacheRead = 0;
  let missingCacheWrite = 0;
  let lines = 0;

  /** Handle one complete line; mutates the accumulators. */
  const onLine = (line) => {
    if (!line) return;
    if (line.indexOf('"usage"') === -1) {
      // Not worth a JSON.parse, but a line that is not even brace-delimited is damage.
      const t = line.trim();
      if (t && (t.charCodeAt(0) !== 123 || t.charCodeAt(t.length - 1) !== 125)) res.parseErrors++;
      return;
    }
    let o;
    try { o = JSON.parse(line); } catch (_) { res.parseErrors++; return; }
    if (!o || typeof o !== 'object' || o.type !== 'assistant') return;
    const m = o.message;
    if (!m || typeof m !== 'object' || !m.usage || typeof m.usage !== 'object') return;
    if (o.isSidechain === true) { res.skippedSidechain++; return; }

    const key = typeof m.id === 'string' && m.id ? m.id : null;
    if (key && seen.has(key)) return;
    const u = m.usage;
    const crMissing = u.cache_read_input_tokens === undefined;
    const cwMissing = u.cache_creation_input_tokens === undefined;
    const inTok = _num(u.input_tokens);
    const outTok = _num(u.output_tokens);
    const cr = crMissing ? 0 : _num(u.cache_read_input_tokens);
    const cw = cwMissing ? 0 : _num(u.cache_creation_input_tokens);
    if (inTok === null || outTok === null || cr === null || cw === null) { res.parseErrors++; return; }
    if (key) seen.add(key); else res.unkeyed++;

    res.messages++;
    if (crMissing) missingCacheRead++;
    if (cwMissing) missingCacheWrite++;
    total.in += inTok; total.out += outTok; total.cacheRead += cr; total.cacheWrite += cw;
    // `<synthetic>` is the host's own placeholder for a message no model produced: it says
    // nothing about which model ran, so it neither names one nor counts as an unnamed one.
    const named = cleanStr(m.model, 80);
    if (named === '<synthetic>') {
      /* no model signal */
    } else if (named) {
      let b = byModel.get(named);
      if (!b) { b = { ..._zero(), messages: 0 }; byModel.set(named, b); }
      b.in += inTok; b.out += outTok; b.cacheRead += cr; b.cacheWrite += cw; b.messages++;
    } else {
      unknownModelMessages++;
    }
    const ts = cleanIso(o.timestamp);
    if (ts) {
      if (res.firstTs === null) res.firstTs = ts;
      res.lastTs = ts;
    }
  };

  try {
    const buf = Buffer.allocUnsafe(CHUNK);
    let carry = Buffer.alloc(0);
    let pos = 0; // absolute offset of the first byte of `carry`
    let read = 0;
    let stop = false;
    while (!stop && read < maxBytes) {
      const n = fs.readSync(fd, buf, 0, Math.min(CHUNK, maxBytes - read), read);
      if (n <= 0) break;
      read += n;
      const data = carry.length ? Buffer.concat([carry, buf.subarray(0, n)]) : Buffer.from(buf.subarray(0, n));
      let start = 0;
      let nl;
      while ((nl = data.indexOf(NL, start)) !== -1) {
        onLine(data.toString('utf8', start, nl));
        start = nl + 1;
        res.offset = pos + start;
        if ((++lines & 1023) === 0 && now() > deadline) { res.partial = true; stop = true; break; }
      }
      carry = data.subarray(start);
      pos += start;
    }
    if (!stop && carry.length && read >= res.size) {
      // A final line with no newline: take it only if it is whole JSON. A half-written
      // tail (the host is still appending) is left for the next parse, not counted as damage.
      const tail = carry.toString('utf8');
      let whole = false;
      try { JSON.parse(tail); whole = true; } catch (_) { /* mid-write */ }
      if (whole) { onLine(tail); res.offset = pos + carry.length; }
    }
    if (!res.partial && res.offset < res.size && read < res.size) res.partial = true; // stopped at maxBytes
    res.ok = true;
  } catch (e) {
    res.error = e.code || e.message;
  } finally {
    try { fs.closeSync(fd); } catch (_) { /* ignore */ }
  }

  if (res.ok && res.messages > 0) {
    res.usage = {
      in: total.in,
      out: total.out,
      cacheRead: missingCacheRead === res.messages ? null : total.cacheRead,
      cacheWrite: missingCacheWrite === res.messages ? null : total.cacheWrite,
    };
    const someMissing = (n) => n > 0 && n < res.messages;
    res.cacheGaps = Math.max(someMissing(missingCacheRead) ? missingCacheRead : 0, someMissing(missingCacheWrite) ? missingCacheWrite : 0);
    res.source = 'transcript';
    if (byModel.size === 0) res.model = 'unknown';
    else if (byModel.size === 1 && unknownModelMessages === 0) res.model = [...byModel.keys()][0];
    else res.model = 'mixed';
    if (byModel.size > 1 || (byModel.size === 1 && unknownModelMessages > 0)) {
      const names = [...byModel.keys()].sort().slice(0, MAX_MODELS);
      res.models = Object.create(null);
      for (const n of names) res.models[n] = byModel.get(n);
    }
  }
  return res;
}

module.exports = { parseTranscript, DEFAULT_DEADLINE_MS };
