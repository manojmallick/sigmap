'use strict';

/**
 * mine.js — questions from a project's own git history, for `sigmap advise`.
 *
 * The rule is the one that built the agent study's held-out questions (scripts/build-heldout-set.mjs), so a number measured on them means the
 * same thing here. It is mechanical, reads the project's git history and nothing else, and does not depend on how a question might score:
 *   - the first-parent commits since a date: a squash-merged pull request is one commit, a merge-commit pull request is its merge commit, whose
 *     title is the first line of its message body; the oldest come first;
 *   - the title has its trailing "(#123)" and its conventional-commit type ("fix(parser):" becomes "parser:") taken off, and is 25 to 160
 *     characters; bots, dependency bumps, releases, reverts and merges are left out;
 *   - a title of fewer than 4 words, or one about lint, formatting, tests, docs, refactoring, renames or CI, is left out;
 *   - the commit changes 1 to 3 source files (a code extension that is not a test, fixture, example, demo, doc, config, generated or minified
 *     file), every one of which still exists, and the title names none of them;
 *   - the questions are the oldest qualifying commits up to `max`.
 * A question is the title; its label is the source file(s) the change touched.
 *
 * Zero-dependency, read-only: it runs `git log` and `git diff --name-only` and writes nothing.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CODE = { py: 'python', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', tsx: 'typescript', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', scala: 'scala', rb: 'ruby', php: 'php', c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', swift: 'swift' };
const NOT_SOURCE = [/(^|\/)(tests?|spec|specs|__tests__|e2e|integration-tests?|fixtures?|testdata|test-data|examples?|samples?|docs?|documentation|benchmarks?|scripts?|demos?|website|playground|\.github|vendor|node_modules)\//i, /\.config\.\w+$/i, /[._-](test|spec|tests)\.\w+$/i, /(^|\/)(tests?|testing|spec|conftest)\.\w+$/i, /(^|\/)test_[^/]*$/i, /_tests?\.\w+$/, /(Test|Tests|IT|Spec)\.(java|kt|scala)$/, /\.d\.ts$/, /generated|\.pb\.go$|_pb2|\.min\.|\.gen\./i, /(^|\/)setup\.py$/];
const NOT_A_FEATURE = /^(bump|chore\(deps|chore: bump|update dependency|build\(deps|release|prepare release|merge|revert|version|v?\d+\.\d+|\[?release|ci:|docs?:|style:|test:|tests:)/i;
const VAGUE = /\b(lint|linter|clippy|typos?|formatt?(ing|er)?|style|clean ?up|refactor(ing)?|rename[sd]?|readiness|wip|docs?|readme|tests?|dependenc(y|ies)|ci|workflow)\b/i;
const BOT = /\[bot\]|dependabot|renovate|github-actions|noreply@github\.com.*bot|bot@/i;

const DEFAULT_SINCE = '365d';
const DEFAULT_MAX = 12;
const MAX_COMMITS_EXAMINED = 3000; // a bound on work, not on the rule: the oldest 3,000 commits of the window

const isSource = (f) => !!CODE[(f.split('.').pop() || '').toLowerCase()] && !NOT_SOURCE.some((re) => re.test(f));

function cleanTitle(s) {
  let t = String(s).replace(/\s*\(#\d+\)\s*$/, '').replace(/^[\s\p{Extended_Pictographic}\u{FE0F}]+/u, '').trim();
  const m = /^([a-z]+)(?:\(([^)]+)\))?!?:\s*(.+)$/i.exec(t);
  if (m && /^(fix|feat|feature|perf|refactor|chore|build|improve|add|update)$/i.test(m[1])) t = m[2] ? `${m[2]}: ${m[3]}` : m[3];
  return t.trim();
}

/**
 * `--since` as a date git understands: an ISO date passes through, `<n>d`, `<n>m` and `<n>y` count back from `now`.
 * @returns {string|null} YYYY-MM-DD, or null when the value cannot be read
 */
function resolveSince(value, now = Date.now()) {
  const v = String(value == null ? DEFAULT_SINCE : value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d+)([dmy])$/.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  const days = m[2] === 'd' ? n : m[2] === 'm' ? n * 30 : n * 365;
  return new Date(now - days * 86400000).toISOString().slice(0, 10);
}

function git(cwd, args) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1', GIT_TERMINAL_PROMPT: '0' } });
}

/**
 * @param {string} cwd the project root (a git work tree)
 * @param {{ since?: string, max?: number, now?: number }} [opts]
 * @returns {{ ok: boolean, reason?: string, since?: string, examined?: number, qualifying?: number,
 *             questions: Array<{ sha: string, title: string, files: string[] }>, skipped: Object<string, number> }}
 */
function mineQuestions(cwd, opts = {}) {
  const none = (reason) => ({ ok: false, reason, questions: [], skipped: {} });
  const since = resolveSince(opts.since, opts.now);
  if (!since) return none(`cannot read --since "${opts.since}" (use 2026-01-01, 90d, 6m or 1y)`);
  const max = Number.isInteger(opts.max) && opts.max > 0 ? opts.max : DEFAULT_MAX;

  const inside = git(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (inside.error || inside.status !== 0) return none('not a git work tree');
  const raw = git(cwd, ['log', '--first-parent', `--since=${since}`, '--format=%H%x1f%P%x1f%s%x1f%an <%ae>%x1f%b%x1e']);
  if (raw.status !== 0) return none('git log failed');
  const log = raw.stdout.split('\x1e').map((s) => s.replace(/^\n/, '')).filter(Boolean).reverse().slice(0, MAX_COMMITS_EXAMINED);

  const skipped = {};
  const skip = (r) => { skipped[r] = (skipped[r] || 0) + 1; };
  const picks = [];
  let examined = 0;
  for (const rec of log) {
    examined++;
    const [sha, parents, subject, author, body] = rec.split('\x1f');
    const parent = (parents || '').split(' ')[0];
    if (!parent || BOT.test(author)) { skip('a bot, or no parent in the history'); continue; }
    let title = subject;
    if (/^Merge pull request #\d+/.test(subject)) title = (body || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
    title = cleanTitle(title);
    if (title.length < 25 || title.length > 160) { skip('title length'); continue; }
    if (title.split(/\s+/).length < 4 || VAGUE.test(title)) { skip('title is vague, about tooling, tests or docs'); continue; }
    if (NOT_A_FEATURE.test(title) || /dependabot|bump .* from .* to/i.test(title)) { skip('dependency bump, release, revert, merge or docs'); continue; }
    const diff = git(cwd, ['diff', '--name-only', parent, sha]);
    if (diff.status !== 0) { skip('git diff failed'); continue; }
    const src = diff.stdout.split('\n').filter(Boolean).filter(isSource);
    if (src.length < 1 || src.length > 3) { skip('not 1 to 3 source files'); continue; }
    if (src.some((f) => !fs.existsSync(path.join(cwd, f)))) { skip('a changed source file no longer exists'); continue; }
    const low = title.toLowerCase();
    if (src.some((f) => { const b = path.basename(f); const stem = b.replace(/\.[^.]+$/, ''); return low.includes(b.toLowerCase()) || (stem.length >= 6 && low.includes(stem.toLowerCase())); })) { skip('the title names a changed file'); continue; }
    picks.push({ sha, title, files: src });
    if (picks.length >= max) break; // the oldest `max` qualifying commits: stopping here selects the same ones the full pass would
  }
  return { ok: true, since, examined, qualifying: picks.length, questions: picks, skipped };
}

module.exports = { mineQuestions, resolveSince, cleanTitle, isSource, CODE, DEFAULT_SINCE, DEFAULT_MAX };
