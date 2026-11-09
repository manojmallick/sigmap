#!/usr/bin/env node
'use strict';

/**
 * agent-ab-compat-shim.mjs — a loopback shim between Claude Code and an
 * Anthropic-compatible relay, for running the agent A/B (`run-agent-ab.mjs`)
 * through a relay instead of api.anthropic.com.
 *
 *   node scripts/agent-ab-compat-shim.mjs --upstream https://relay.example.com
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:18082 ANTHROPIC_API_KEY=<your relay key> \
 *     npm run benchmark:agent-ab -- --model <a model the relay serves> --save
 *
 * WHY: Claude Code 2.1.x sends, after the user's prompt, a message of the form
 * `{"role":"system","content":[]}`. Anthropic's API tolerates it; at least one
 * relay validates every message and refuses the whole request with
 * `messages[1].content must contain instruction text`. Nothing else was wrong
 * with the requests, and every run fails until that one message is gone.
 *
 * WHAT IT CHANGES — exactly one thing, and it counts what it changed:
 *   - Messages whose content is empty (`[]`, `""`, whitespace, null, absent) are
 *     dropped from POST /v1/messages bodies. An empty message carries nothing
 *     for a model to read, and both arms of the A/B get the same treatment.
 *   - `--max-tokens N` (off by default) lowers a larger `max_tokens` to N, for a
 *     relay whose models cap output below what the agent asks for.
 * Everything else — path, query, method, headers, every other field of the body,
 * the response, status and stream — passes through untouched. A body that is not
 * JSON, and any path other than /v1/messages, is forwarded byte for byte.
 *
 * WHAT IT DOES NOT DO: log or store a header, so an API key is never written
 * anywhere by this process. The key travels in `x-api-key` from the agent to the
 * upstream and nowhere else. It listens on 127.0.0.1 only.
 *
 * `--stats <file>` writes what happened (requests, messages dropped, upstream
 * status counts, the first bytes of any upstream error body) so a report can say
 * the shim was in the path and what it did. Zero dependencies.
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import { pathToFileURL } from 'url';

export const DEFAULT_PORT = 18082;
const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'te', 'trailer', 'upgrade'];

const isEmptyContent = (c) => c === undefined || c === null
  || (Array.isArray(c) && c.length === 0)
  || (typeof c === 'string' && c.trim() === '');

/**
 * @param {object} o
 * @param {string} o.upstream   base URL of the relay, e.g. https://relay.example.com
 * @param {number} [o.port]     0 picks a free port
 * @param {string} [o.statsFile]
 * @param {number|null} [o.maxTokens]
 * @returns {{ server: http.Server, stats: object, listen: () => Promise<number>, close: () => Promise<void>, flush: () => void }}
 */
export function createShim({ upstream, port = DEFAULT_PORT, statsFile = null, maxTokens = null }) {
  const target = new URL(upstream);
  if (target.protocol !== 'https:' && target.protocol !== 'http:') throw new Error(`--upstream must be an http(s) URL, got "${upstream}"`);
  const client = target.protocol === 'https:' ? https : http;
  const basePath = target.pathname.replace(/\/+$/, '');
  const stats = {
    upstream: `${target.protocol}//${target.host}${basePath}`,
    requests: 0, messagePosts: 0, modified: 0,
    droppedEmptyMessages: 0, droppedByRole: {}, clampedMaxTokens: 0,
    upstreamStatus: {}, errors: [],
  };
  const flush = () => { if (statsFile) { try { fs.writeFileSync(statsFile, `${JSON.stringify(stats, null, 2)}\n`); } catch (_) { /* best effort */ } } };
  const recordError = (e) => { stats.errors.push(e); if (stats.errors.length > 30) stats.errors.shift(); };

  const server = http.createServer((req, res) => {
    stats.requests++;
    const chunks = [];
    req.on('data', (d) => chunks.push(d));
    req.on('end', () => {
      let body = Buffer.concat(chunks);
      if (req.method === 'POST' && /^\/v1\/messages(\?|$)/.test(req.url)) {
        stats.messagePosts++;
        try {
          const j = JSON.parse(body.toString('utf8'));
          let changed = false;
          if (Array.isArray(j.messages)) {
            const kept = j.messages.filter((m) => {
              if (isEmptyContent(m && m.content)) {
                stats.droppedEmptyMessages++;
                const role = String(m && m.role);
                stats.droppedByRole[role] = (stats.droppedByRole[role] || 0) + 1;
                return false;
              }
              return true;
            });
            if (kept.length !== j.messages.length) { j.messages = kept; changed = true; }
          }
          if (maxTokens && typeof j.max_tokens === 'number' && j.max_tokens > maxTokens) { j.max_tokens = maxTokens; stats.clampedMaxTokens++; changed = true; }
          if (changed) { stats.modified++; body = Buffer.from(JSON.stringify(j)); }
        } catch (_) { /* not JSON: forwarded untouched */ }
      }

      const headers = Object.assign({}, req.headers, { host: target.host, 'accept-encoding': 'identity', 'content-length': String(body.length) });
      for (const h of HOP_BY_HOP) delete headers[h];
      const up = client.request({ protocol: target.protocol, hostname: target.hostname, port: target.port || undefined, method: req.method, path: basePath + req.url, headers }, (ur) => {
        stats.upstreamStatus[ur.statusCode] = (stats.upstreamStatus[ur.statusCode] || 0) + 1;
        const h = Object.assign({}, ur.headers);
        for (const k of HOP_BY_HOP) delete h[k];
        res.writeHead(ur.statusCode, h);
        if (ur.statusCode >= 400) {
          const eb = [];
          ur.on('data', (d) => { eb.push(d); res.write(d); });
          ur.on('end', () => {
            recordError({ status: ur.statusCode, path: req.url.split('?')[0], body: Buffer.concat(eb).toString('utf8').slice(0, 300) });
            res.end(); flush();
          });
        } else {
          ur.pipe(res);
          ur.on('end', flush);
        }
      });
      up.on('error', (e) => {
        recordError({ status: 0, path: req.url.split('?')[0], body: String(e.message).slice(0, 200) });
        flush();
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: `compat shim: upstream unreachable (${e.message})` } }));
      });
      up.end(body);
    });
  });

  return {
    server, stats, flush,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => resolve(server.address().port));
    }),
    close: () => new Promise((resolve) => { flush(); server.close(() => resolve()); server.closeAllConnections && server.closeAllConnections(); }),
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const KNOWN = new Set(['--upstream', '--port', '--stats', '--max-tokens']);
const say = (s) => process.stderr.write(`${s}\n`);
const fail = (s, code = 1) => { say(`[agent-ab-shim] ${s}`); process.exit(code); };

async function main(argv) {
  for (const a of argv) if (a.startsWith('--') && !KNOWN.has(a)) fail(`unknown flag ${a}`, 2);
  const val = (f, d) => {
    const i = argv.indexOf(f);
    if (i === -1) return d;
    const next = argv[i + 1];
    if (next === undefined || next === '' || next.startsWith('--')) fail(`${f} needs a value`, 2);
    return next;
  };
  const upstream = val('--upstream', null);
  if (!upstream) fail('--upstream <url> is required, e.g. --upstream https://relay.example.com', 2);
  const intArg = (f, d) => {
    const v = val(f, null);
    if (v === null) return d;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) fail(`${f} must be a positive integer, got "${v}"`, 2);
    return n;
  };
  let shim;
  try { shim = createShim({ upstream, port: intArg('--port', DEFAULT_PORT), statsFile: val('--stats', null), maxTokens: intArg('--max-tokens', null) }); }
  catch (e) { fail(e.message, 2); }
  const port = await shim.listen().catch((e) => fail(`cannot listen: ${e.message}`));
  say(`[agent-ab-shim] 127.0.0.1:${port} -> ${shim.stats.upstream}`);
  say(`[agent-ab-shim] use: ANTHROPIC_BASE_URL=http://127.0.0.1:${port} ANTHROPIC_API_KEY=<your key> npm run benchmark:agent-ab -- --model <model>`);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { shim.flush(); process.exit(0); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
