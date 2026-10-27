'use strict';

/**
 * host-limits.js — how much of an instruction file each host reads (#995).
 *
 * A host loads a bounded part of the file SigMap writes for it and says nothing
 * about the rest:
 *
 *   - Codex reads at most `project_doc_max_bytes` of an `AGENTS.md` (32 KiB unless
 *     the user's `~/.codex/config.toml` says otherwise), so a 43 KB file reaches the
 *     agent cut in the middle of a section.
 *   - Claude Code's own guidance is to keep `CLAUDE.md` short, about 200 lines; a
 *     file of 887 lines is mostly paid for and mostly unread.
 *
 * This module answers "what is the limit for this target" in one place, so the
 * writer that trims to it and `sigmap doctor` that reports against it cannot
 * disagree. Zero dependencies; the only I/O is one bounded read of the host's own
 * config file, with no TOML parser.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const CODEX_DEFAULT_BYTES = 32 * 1024;
const CLAUDE_DEFAULT_LINES = 200;

/**
 * `project_doc_max_bytes` from Codex's own config, or null when it is absent.
 * `CODEX_HOME` moves the directory, exactly as it does for Codex itself.
 */
function codexConfiguredBytes(env, home) {
  const dir = (env && env.CODEX_HOME) || path.join(home || os.homedir(), '.codex');
  try {
    const text = fs.readFileSync(path.join(dir, 'config.toml'), 'utf8').slice(0, 262144);
    const m = /^\s*project_doc_max_bytes\s*=\s*(\d[\d_]*)\s*(?:#.*)?$/m.exec(text);
    if (m) {
      const n = parseInt(m[1].replace(/_/g, ''), 10); // TOML allows 65_536
      if (n > 0) return n;
    }
  } catch (_) { /* no Codex config: the default applies */ }
  return null;
}

/**
 * The limit on the instruction file written for `target`, or null when the host has
 * none or the project turned the cap off (`codexMaxBytes` / `claudeMaxLines` of 0).
 *
 * @param {string} target - 'codex' | 'claude'
 * @param {object} [config] - loaded SigMap config
 * @param {object} [env] - process.env (for CODEX_HOME)
 * @param {string} [home] - home directory (for tests)
 * @returns {{ unit: 'bytes'|'lines', max: number, source: string, host: string }|null}
 */
function hostLimit(target, config, env, home) {
  const cfg = config || {};
  if (target === 'codex') {
    if (cfg.codexMaxBytes === 0) return null;
    if (Number.isFinite(cfg.codexMaxBytes) && cfg.codexMaxBytes > 0) {
      return { unit: 'bytes', max: cfg.codexMaxBytes, source: 'codexMaxBytes in gen-context.config.json', host: 'Codex' };
    }
    const fromHost = codexConfiguredBytes(env || process.env, home);
    if (fromHost) return { unit: 'bytes', max: fromHost, source: "project_doc_max_bytes in Codex's config.toml", host: 'Codex' };
    return { unit: 'bytes', max: CODEX_DEFAULT_BYTES, source: "Codex's default project_doc_max_bytes", host: 'Codex' };
  }
  if (target === 'claude') {
    if (cfg.claudeMaxLines === 0) return null;
    if (Number.isFinite(cfg.claudeMaxLines) && cfg.claudeMaxLines > 0) {
      return { unit: 'lines', max: cfg.claudeMaxLines, source: 'claudeMaxLines in gen-context.config.json', host: 'Claude Code' };
    }
    return { unit: 'lines', max: CLAUDE_DEFAULT_LINES, source: "Claude Code's guidance for CLAUDE.md", host: 'Claude Code' };
  }
  return null;
}

/** The size of `text` in the limit's own unit. */
function measure(unit, text) {
  const s = String(text == null ? '' : text);
  return unit === 'lines' ? s.split('\n').length : Buffer.byteLength(s, 'utf8');
}

/** `28.4 KiB` or `187 lines`. */
function formatSize(unit, n) {
  return unit === 'lines' ? `${n.toLocaleString('en-US')} lines` : `${(n / 1024).toFixed(1)} KiB`;
}

module.exports = { hostLimit, measure, formatSize, codexConfiguredBytes, CODEX_DEFAULT_BYTES, CLAUDE_DEFAULT_LINES };
