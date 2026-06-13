'use strict';

/**
 * Squeeze input classifier (v7.0.0).
 *
 * Deterministic, zero-dep detector that labels a pasted blob as a
 * `stacktrace`, `cilog`, or `json` payload — or `null` (pass through). Pure
 * regex/heuristics; runs in well under 10ms even on large input.
 *
 * Order matters: stack traces are highest value and a CI log often *contains*
 * a trace, so stacktrace is checked first, then cilog, then json.
 */

const FRAME_RE = [
  /^\s*at\s+.+\(.+:\d+:\d+\)\s*$/,          // JS: at fn (file:line:col)
  /^\s*at\s+.+:\d+:\d+\s*$/,                 // JS: at file:line:col
  /^\s*at\s+[\w$.<>]+\(.+\.\w+:\d+\)/,       // Java/Kotlin: at pkg.Cls.m(File.java:42)
  /^\s*File\s+".+",\s+line\s+\d+/,           // Python frame
  /^\s+\w+.*\([^)]*\.(go|rs):\d+\)/,         // Go/Rust frame with file:line
  /^\s*#\d+\s+0x[0-9a-f]+/,                  // native/gdb frame
];

const STACK_HEADER_RE = [
  /Traceback \(most recent call last\)/,
  /Exception in thread/,
  /\bat Object\.<anonymous>\b/,
  /thread '.*' panicked at/,
  /^panic:/m,
  /goroutine \d+ \[/,
];

function countFrames(lines) {
  let n = 0;
  for (const line of lines) {
    if (FRAME_RE.some((re) => re.test(line))) n++;
  }
  return n;
}

function matchesStackTrace(input, lines) {
  const frames = countFrames(lines);
  const header = STACK_HEADER_RE.some((re) => re.test(input));
  // A single explicit header (Traceback/panic) counts as strong evidence even
  // with few parsed frames; otherwise require 2+ frame-like lines.
  if (!header && frames < 2) return { match: false, confidence: 0, frames };
  // Confidence scales with frame count; a header alone floors it at 0.6.
  let confidence = Math.min(0.97, 0.15 * frames);
  if (header) confidence = Math.max(confidence, 0.6 + Math.min(0.3, 0.05 * frames));
  return { match: true, confidence: Number(confidence.toFixed(2)), frames };
}

const TS_RE = /(\b\d{1,2}:\d{2}:\d{2}\b)|(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/;
const PROGRESS_RE = /(\d{1,3}%)|(\bDownloading\b)|(\bnpm (WARN|notice|http)\b)|(##\[(group|endgroup|command)\])|(\[\d+\/\d+\])|(▕|█|━|⠿)|(\bETA\b)|(\r$)/;

function matchesCiLog(input, lines) {
  if (lines.length < 8) return { match: false, confidence: 0 };
  let logish = 0;
  const seen = new Map();
  let repeats = 0;
  for (const line of lines) {
    if (TS_RE.test(line) || PROGRESS_RE.test(line)) logish++;
    const norm = line.replace(/\d+/g, '#').trim();
    if (norm) {
      const c = (seen.get(norm) || 0) + 1;
      seen.set(norm, c);
      if (c > 1) repeats++;
    }
  }
  const density = logish / lines.length;
  const repeatRatio = repeats / lines.length;
  if (density < 0.4 && repeatRatio < 0.4) return { match: false, confidence: 0 };
  const confidence = Math.min(0.95, Math.max(density, repeatRatio) + 0.15);
  return { match: true, confidence: Number(confidence.toFixed(2)) };
}

function matchesJsonPayload(input) {
  const trimmed = input.trim();
  if (/^[[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return { match: true, confidence: 0.95 };
    } catch (_) { /* not strict JSON — fall through to heuristic */ }
  }
  const lines = trimmed.split('\n');
  if (lines.length < 4) return { match: false, confidence: 0 };
  let kv = 0;
  for (const line of lines) {
    if (/^\s*"[^"]+"\s*:\s*.+/.test(line) || /^\s*[}\]],?\s*$/.test(line)) kv++;
  }
  const ratio = kv / lines.length;
  if (ratio < 0.6) return { match: false, confidence: 0 };
  return { match: true, confidence: Number(Math.min(0.9, ratio).toFixed(2)) };
}

/**
 * @param {string} input
 * @returns {{ category: 'stacktrace'|'cilog'|'json'|null, confidence: number }}
 */
function classify(input) {
  if (typeof input !== 'string' || !input.trim()) return { category: null, confidence: 0 };
  const lines = input.split('\n');

  const st = matchesStackTrace(input, lines);
  if (st.match) return { category: 'stacktrace', confidence: st.confidence };

  const ci = matchesCiLog(input, lines);
  if (ci.match) return { category: 'cilog', confidence: ci.confidence };

  const js = matchesJsonPayload(input);
  if (js.match) return { category: 'json', confidence: js.confidence };

  return { category: null, confidence: 0 };
}

module.exports = { classify, countFrames };
