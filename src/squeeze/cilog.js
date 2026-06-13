'use strict';

/**
 * CI / build-log squeeze (v7.0.0).
 *
 * Strips timestamps, progress bars, and repeated noise; keeps every error line
 * plus a small context window around it. Never returns empty — when there are
 * no errors it falls back to a head/tail summary. Also reused by the stacktrace
 * squeezer to clean noise surrounding a trace.
 */

const TS_PREFIX_RE = /^\s*(?:\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?Z?\]?\s*|\[?\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?\]?\s*)+/;
const PROGRESS_LINE_RE = /(?:^|\s)(?:\d{1,3}%|Downloading|Receiving objects|Resolving deltas|Compressing objects|npm (?:WARN|notice|http|sill|verb)|##\[(?:group|endgroup|command|section)\]|\[\d+\/\d+\]|ETA[: ]|█|━|▕|⣿)/;
const ERROR_RE = /\b(?:error|err!|fail(?:ed|ure)?|exception|panic|fatal|traceback|ERR_|E[A-Z]{3,})\b|✗|❌/i;

/** Remove a leading timestamp prefix from a single line. */
function stripTimestamp(line) {
  return line.replace(TS_PREFIX_RE, '');
}

/**
 * @param {string} input
 * @param {object} [opts]
 * @param {number} [opts.context=2]  context lines kept around each error
 * @returns {{ squeezed: string, kept: string[], stripped: string[] }}
 */
function squeezeCiLog(input, opts = {}) {
  const ctx = opts.context != null ? opts.context : 2;
  const lines = input.split('\n');
  const keep = new Set();
  const errorIdx = [];

  for (let i = 0; i < lines.length; i++) {
    if (ERROR_RE.test(lines[i])) {
      errorIdx.push(i);
      for (let j = Math.max(0, i - ctx); j <= Math.min(lines.length - 1, i + ctx); j++) keep.add(j);
    }
  }

  let body;
  let keptDesc;
  if (errorIdx.length === 0) {
    const head = lines.slice(0, 10).map(stripTimestamp);
    const tail = lines.length > 20 ? lines.slice(-10).map(stripTimestamp) : [];
    body = head.slice();
    if (tail.length) body.push(`… (${lines.length - 20} lines omitted) …`, ...tail);
    keptDesc = ['head/tail summary (no error lines found)'];
  } else {
    const sorted = [...keep].sort((a, b) => a - b);
    body = [];
    let prev = -2;
    for (const idx of sorted) {
      // Drop pure progress/noise lines unless they are themselves errors.
      const line = stripTimestamp(lines[idx]);
      if (PROGRESS_LINE_RE.test(line) && !ERROR_RE.test(line)) continue;
      if (idx > prev + 1) body.push(`… (${idx - prev - 1} lines) …`);
      body.push(line);
      prev = idx;
    }
    if (body.length === 0) body = errorIdx.map((i) => stripTimestamp(lines[i])); // safety net
    keptDesc = [`${errorIdx.length} error line(s) + ${ctx}-line context`];
  }

  return {
    squeezed: body.join('\n'),
    kept: keptDesc,
    stripped: [`${Math.max(0, lines.length - body.length)} timestamp/progress/noise line(s)`],
  };
}

module.exports = { squeezeCiLog, stripTimestamp, ERROR_RE };
