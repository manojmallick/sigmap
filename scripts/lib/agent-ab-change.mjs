#!/usr/bin/env node
'use strict';

/**
 * agent-ab-change.mjs — the part of the agent A/B that asks the agent to FIX something, and grades the fix by running tests.
 *
 * The locate tasks ask the agent to name the files that implement a behaviour; the article this study follows replays merged changes
 * and grades the patches. A change task here is a merged bug fix (scripts/build-change-tasks.mjs): the agent gets the issue's problem
 * statement and a checkout of the code as it was before the fix, with the tools to read, search, edit and run the repository's own
 * tests; when it stops, its changes become a patch, the patch is applied to a pristine copy of the base, the fix's tests (which the
 * agent never saw) are put on top and run. The task passes if they all exit 0.
 *
 * The agent can edit anything in the checkout, including tests; the hidden tests are written over whatever it did to those files.
 * Child processes (the tests, `node` run by the agent through RunTest) get a minimal environment: no API key, no tokens.
 *
 * Zero dependencies.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync, execFileSync } from 'child_process';

export const CHANGE_SYSTEM_PROMPT = [
  'You fix bugs in the repository checked out in the current working directory.',
  'You are given a bug report. Find the cause with the tools, change the source so the described behaviour is correct, and run the existing tests that cover what you changed.',
  'Keep the change as small as the fix allows and do not touch unrelated code. When the fix is in place, reply with one short paragraph saying what you changed.',
].join(' ');

export const CHANGE_MAX_TURNS = 40;

export const CHANGE_TOOL_DEFS = Object.freeze([
  { name: 'Edit', description: 'Replace one exact occurrence of old_string in a file with new_string. old_string must match exactly once.', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' } }, required: ['file_path', 'old_string', 'new_string'] } },
  { name: 'Write', description: 'Create a file or replace its whole content.', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } },
  { name: 'RunTest', description: 'Run one of the repository\'s test files with node and return its output (the tail if long).', input_schema: { type: 'object', properties: { file_path: { type: 'string', description: 'A test file, e.g. test/integration/foo.test.js.' } }, required: ['file_path'] } },
]);

export function changePrompt(task) {
  return ['Bug report for this repository:', '', task.query, '', 'Fix it in the source. Tests that check the behaviour will be run on your change.'].join('\n');
}

const MINIMAL_ENV = () => ({ PATH: process.env.PATH || '/usr/bin:/bin', HOME: os.tmpdir(), LANG: 'C.UTF-8', SIGMAP_NO_UPDATE_CHECK: '1', NO_COLOR: '1' });
const cap = (s, n = 6000) => (s.length > n ? `… (first ${s.length - n} characters cut)\n${s.slice(-n)}` : s);
const FORBIDDEN_DIR = /(^|\/)(\.git|\.context|node_modules)(\/|$)/;

function inside(root, p) {
  const abs = path.resolve(root, String(p || ''));
  const base = fs.realpathSync(root);
  // the nearest ancestor that exists, resolved (so a symlink cannot lead out), plus the part that does not exist yet
  let head = abs; const tail = [];
  while (!fs.existsSync(head) && head !== path.dirname(head)) { tail.unshift(path.basename(head)); head = path.dirname(head); }
  const real = path.join(fs.realpathSync(head), ...tail);
  if (real !== base && !real.startsWith(base + path.sep)) throw new Error(`path outside the repository: ${p}`);
  const rel = path.relative(base, real).replace(/\\/g, '/');
  if (FORBIDDEN_DIR.test(rel)) throw new Error(`not editable: ${rel}`);
  return abs;
}

/** Run Edit, Write or RunTest in `cwd`. Returns { text, isError }. */
export function runChangeTool(name, input, { cwd }) {
  const i = input && typeof input === 'object' ? input : {};
  try {
    if (name === 'Edit') {
      const file = inside(cwd, i.file_path);
      if (typeof i.old_string !== 'string' || typeof i.new_string !== 'string' || !i.old_string) return { text: 'old_string and new_string are required', isError: true };
      const src = fs.readFileSync(file, 'utf8');
      const n = src.split(i.old_string).length - 1;
      if (n === 0) return { text: 'old_string was not found in the file', isError: true };
      if (n > 1) return { text: `old_string matches ${n} places; add more context so it matches once`, isError: true };
      fs.writeFileSync(file, src.replace(i.old_string, () => i.new_string));
      return { text: `edited ${i.file_path}`, isError: false };
    }
    if (name === 'Write') {
      const file = inside(cwd, i.file_path);
      if (typeof i.content !== 'string') return { text: 'content is required', isError: true };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, i.content);
      return { text: `wrote ${i.file_path} (${i.content.length} characters)`, isError: false };
    }
    if (name === 'RunTest') {
      const file = inside(cwd, i.file_path);
      const rel = path.relative(fs.realpathSync(cwd), fs.realpathSync(file)).replace(/\\/g, '/');
      if (!/^test\/.+\.js$/.test(rel)) return { text: 'RunTest runs files under test/ only', isError: true };
      const r = spawnSync(process.execPath, [file], { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, env: MINIMAL_ENV() });
      const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
      return { text: cap(`exit ${r.status === null ? 'timeout' : r.status}\n${out}`), isError: r.status !== 0 };
    }
    return { text: `unknown tool: ${name}`, isError: true };
  } catch (e) {
    return { text: String(e && e.message ? e.message : e), isError: true };
  }
}

const git = (cwd, args, opts = {}) => spawnSync('git', ['-C', cwd, '-c', 'user.name=study', '-c', 'user.email=study@example.invalid', ...args], { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });

/**
 * Grade what the agent left in `cwd` against the task's hidden tests.
 *
 * @param {{ hidden: Array<{path:string, content:string}> }} task
 * @param {string} cwd the agent's checkout (a git repository whose HEAD is the base)
 * @returns {{ pass: boolean, why: string, patch: { files: number, added: number, removed: number }, failed: string[] }}
 */
export function gradeChange(task, cwd, { testTimeoutMs = 120000 } = {}) {
  // 1. the patch: every change to tracked files and every new file, except what the harness itself put there
  git(cwd, ['add', '-N', '--', '.', ':(exclude).context', ':(exclude)gen-context.config.json']);
  const diff = git(cwd, ['diff', 'HEAD', '--binary', '--', '.', ':(exclude).context', ':(exclude)gen-context.config.json']);
  const patch = diff.stdout || '';
  const num = (git(cwd, ['diff', 'HEAD', '--numstat', '--', '.', ':(exclude).context', ':(exclude)gen-context.config.json']).stdout || '').trim().split('\n').filter(Boolean).map((l) => l.split('\t'));
  const stats = { files: num.length, added: num.reduce((s, n) => s + (Number(n[0]) || 0), 0), removed: num.reduce((s, n) => s + (Number(n[1]) || 0), 0) };
  if (!patch.trim()) return { pass: false, why: 'empty patch', patch: stats, failed: [] };

  // 2. a pristine copy of the base with that patch and the hidden tests on top
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grade-'));
  try {
    fs.cpSync(cwd, tmp, { recursive: true, verbatimSymlinks: true, mode: fs.constants.COPYFILE_FICLONE });
    git(tmp, ['reset', '--hard', '--quiet', 'HEAD']);
    git(tmp, ['clean', '-ffdxq']);
    const pf = path.join(os.tmpdir(), `agent-${process.pid}-${Date.now()}.patch`);
    fs.writeFileSync(pf, patch);
    const ap = git(tmp, ['apply', '--whitespace=nowarn', pf]);
    fs.rmSync(pf, { force: true });
    if (ap.status !== 0) return { pass: false, why: `the patch does not apply: ${(ap.stderr || '').trim().split('\n')[0].slice(0, 120)}`, patch: stats, failed: [] };
    for (const t of task.hidden) {
      fs.mkdirSync(path.dirname(path.join(tmp, t.path)), { recursive: true });
      fs.writeFileSync(path.join(tmp, t.path), t.content);
    }
    const failed = [];
    for (const t of task.hidden) {
      const r = spawnSync(process.execPath, [t.path], { cwd: tmp, encoding: 'utf8', timeout: testTimeoutMs, maxBuffer: 1 << 26, env: MINIMAL_ENV() });
      if (r.status !== 0) failed.push(t.path);
    }
    return failed.length ? { pass: false, why: `hidden tests failed: ${failed.map((f) => path.basename(f)).join(', ')}`, patch: stats, failed } : { pass: true, why: 'hidden tests pass', patch: stats, failed: [] };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** First paragraph of the "Problem" section (or of the body), with the fix's locations taken out. */
export function problemStatement(issue, goldFiles) {
  const body = String(issue.body || '').replace(/\r/g, '');
  const sec = /^##\s*(?:Problem(?:\s*\/\s*Goal)?|Summary|Description|Bug)[^\n]*\n+([\s\S]*?)(?=\n##\s|\s*$)/im.exec(body);
  const first = (sec ? sec[1] : body).split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^(#|>|\||```|- |\* )/.test(p)) || '';
  let text = `${issue.title}\n\n${first}`;
  const names = new Set();
  for (const f of goldFiles) { names.add(f); names.add(path.basename(f)); }
  for (const n of [...names].sort((a, b) => b.length - a.length)) if (n.length >= 4) text = text.split(n).join('<file>');
  text = text.replace(/\b(?:src|test|scripts|docs|docs-vp|packages)\/[\w./@-]+/g, '<path>').replace(/[ \t]+\n/g, '\n').trim();
  return text.length > 1400 ? `${text.slice(0, 1400)}…` : text;
}

