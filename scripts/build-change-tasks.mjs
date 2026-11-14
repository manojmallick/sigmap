#!/usr/bin/env node
// Build article-style tasks from this repository's own history: merged bug fixes the agent has to reproduce, graded by the fix's tests.
//
//   node scripts/build-change-tasks.mjs --out <dir> [--since 2026-07-01] [--max 24]
//
// For each merged `fix(...)` commit since --since (after the models' knowledge cutoff, so nothing here has been read before) that
// changes source under src/ (and, if it needs to, the CLI's gen-context.js) and a test under test/ and creates no new source file, and whose message closes or refers to a GitHub ISSUE:
//   - a file the fix creates must not be named by its tests; an issue gives at most one task; a feature request is not a fix; the tests stay under 25 KB;
//   - the base is the commit's parent, a sanitised snapshot (answer keys, generated agent context and the history are left out);
//   - the task text is the issue title and its first paragraph, with every path and file name of the real fix taken out, because
//     where the code lives is what SigMap claims to find;
//   - the hidden tests are the test files the commit added or changed;
//   - the task is KEPT only if those tests fail on the base and pass with the real fix (src/ part only) applied, twice, each run under
//     the time limit, and the failure is an assertion, not a missing module or a syntax error.
// The selection rule is mechanical and fixed here; no agent has seen a task when it is chosen. Output is a data root the harness reads
// like any other (benchmarks/xrepo-repos.json, benchmarks/tasks/retrieval-xrepo.jsonl, one single-commit repository per task).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { problemStatement } from './lib/agent-ab-change.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = val('--out', null);
const SINCE = val('--since', '2026-07-01');
const MAX = Number(val('--max', '24'));
const SLUG = val('--slug', 'manojmallick/sigmap');
const TEST_TIMEOUT_MS = 90000;
if (!OUT) { console.error('usage: build-change-tasks.mjs --out <dir> [--since YYYY-MM-DD] [--max N]'); process.exit(2); }

const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
const out = path.resolve(OUT);
fs.mkdirSync(path.join(out, 'issues'), { recursive: true });
fs.mkdirSync(path.join(out, 'benchmarks', 'tasks'), { recursive: true });
fs.mkdirSync(path.join(out, 'benchmarks', 'repos'), { recursive: true });

// What a sanitised snapshot leaves out: the answer keys and everything SigMap generates for agents.
const STRIP = ['benchmarks', 'public-benchmarks', '.claude', 'CLAUDE.md', 'AGENTS.md', 'llms.txt', 'llms-full.txt', '.github/copilot-instructions.md', '.github/gemini-context.md', '.cursorrules', '.windsurfrules', 'docs-vp/public/llms.txt', 'docs-vp/public/llms-full.txt'];

function issueOf(message) {
  const m = /\b(?:closes|fixes|resolves)\s+#(\d+)/i.exec(message) || /\brefs?\s+#(\d+)/i.exec(message);
  return m ? Number(m[1]) : null;
}

function fetchIssue(n) {
  const cache = path.join(out, 'issues', `${n}.json`);
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const r = spawnSync('gh', ['api', `repos/${SLUG}/issues/${n}`, '--jq', '{n:.number,title:.title,body:.body,pr:(.pull_request!=null),state:.state}'], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) return null;
  const j = JSON.parse(r.stdout);
  fs.writeFileSync(cache, JSON.stringify(j));
  return j;
}

function sh(cmd, args, cwd, timeout = TEST_TIMEOUT_MS, env) {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 1 << 26, env: env || Object.assign({}, process.env, { SIGMAP_NO_UPDATE_CHECK: '1' }) });
  return { code: r.status === null ? 124 : r.status, out: `${r.stdout || ''}${r.stderr || ''}`, ms: Date.now() - t };
}

function snapshot(commit, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const tar = path.join(os.tmpdir(), `snap-${process.pid}-${Date.now()}.tar`);
  execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', '-o', tar, commit]);
  execFileSync('tar', ['-xf', tar, '-C', dest]);
  fs.rmSync(tar, { force: true });
  for (const s of STRIP) fs.rmSync(path.join(dest, s), { recursive: true, force: true });
}

function runTests(dir, files) {
  return files.map((f) => ({ file: f, ...sh(process.execPath, [f], dir) }));
}

// ── candidates ───────────────────────────────────────────────────────────────
const hashes = git('log', `--since=${SINCE}`, '--no-merges', '--reverse', '--format=%H').trim().split('\n').filter(Boolean);
const report = [];
const usedIssues = new Set();
const tasks = [];
const manifest = { _comment: `merged-fix tasks from ${SLUG} since ${SINCE}`, repos: [] };

for (const h of hashes) {
  if (tasks.length >= MAX) break;
  const subject = git('show', '-s', '--format=%s', h).trim();
  const note = (why) => report.push(`${h.slice(0, 7)} ${subject.slice(0, 70)} → ${why}`);
  if (!/^fix(\(|:)/.test(subject)) continue;
  const message = git('show', '-s', '--format=%B', h);
  const rows = git('show', '--name-status', '--format=', '-M', h).trim().split('\n').filter(Boolean).map((l) => l.split('\t'));
  // Source is src/ and the CLI's own gen-context.js (whose bundled-modules section mirrors src/ and whose core is real code).
  const isSrc = (p) => /^src\//.test(p) || p === 'gen-context.js';
  const src = rows.filter((r) => isSrc(r[r.length - 1]));
  const tests = rows.filter((r) => /^test\/.*\.test\.js$/.test(r[r.length - 1]) && r[0][0] !== 'D');
  if (!src.length || !tests.length) continue;
  if (src.some((r) => r[0][0] === 'D' || r[0][0] === 'R')) { note('removes or renames a source file'); continue; }
  if (src.length > 6) { note('more than 6 source files'); continue; }
  const num = git('show', '--numstat', '--format=', h).trim().split('\n').filter(Boolean).map((l) => l.split('\t'));
  const goldLines = num.filter((n) => /^src\//.test(n[2])).reduce((s, n) => s + (Number(n[0]) || 0) + (Number(n[1]) || 0), 0);
  if (goldLines > 250) { note(`${goldLines} changed source lines`); continue; }
  const issueNo = issueOf(message);
  if (!issueNo) { note('names no issue'); continue; }
  const issue = fetchIssue(issueNo);
  if (!issue) { note(`issue #${issueNo} not readable`); continue; }
  if (issue.pr) { note(`#${issueNo} is a pull request, not an issue`); continue; }
  const goldFiles = src.map((r) => r[r.length - 1]).filter((p) => p !== 'gen-context.js');
  const hiddenText = tests.map((r) => git('show', `${h}:${r[r.length - 1]}`)).join('\n');
  const named = src.filter((r) => r[0][0] === 'A').find((r) => { const p = r[r.length - 1]; const b = path.basename(p, path.extname(p)); return hiddenText.includes(p) || hiddenText.includes(`/${b}`) || hiddenText.includes(`'${b}'`) || hiddenText.includes(`./${b}`); });
  if (named) { note(`the hidden tests name a file the fix creates (${named[named.length - 1]}): nobody could guess it`); continue; }
  if (/^(add|feat|support|implement)\b/i.test(issue.title.replace(/^[\w-]+:\s*/, ''))) { note('the issue asks for a feature, not a fix'); continue; }
  if (usedIssues.has(issueNo)) { note(`issue #${issueNo} already gave a task: an umbrella issue does not say what this commit tests`); continue; }
  if (hiddenText.length > 25000) { note(`the hidden tests are ${Math.round(hiddenText.length / 1000)} KB`); continue; }
  if (!goldFiles.length) { note('changes only gen-context.js'); continue; }
  const text = problemStatement(issue, [...goldFiles, ...tests.map((r) => r[r.length - 1])]);
  if (text.length < 70) { note('task text under 70 characters'); continue; }

  const parent = git('rev-parse', `${h}^`).trim();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'change-task-'));
  try {
    snapshot(parent, tmp);
    const hidden = tests.map((r) => ({ path: r[r.length - 1], content: git('show', `${h}:${r[r.length - 1]}`) }));
    const goldPatch = git('diff', '--binary', parent, h, '--', 'src/', 'gen-context.js');
    for (const t of hidden) { fs.mkdirSync(path.dirname(path.join(tmp, t.path)), { recursive: true }); fs.writeFileSync(path.join(tmp, t.path), t.content); }
    const files = hidden.map((t) => t.path);
    const before = runTests(tmp, files);
    if (before.every((b) => b.code === 0)) { note('the hidden tests already pass on the base'); continue; }
    if (before.some((b) => b.code !== 0 && /Cannot find module|SyntaxError|ERR_MODULE_NOT_FOUND|is not a function \(reading|ENOENT/.test(b.out.slice(0, 4000)) && !/assert|expected|AssertionError|FAIL/i.test(b.out))) { note('fails on the base for a missing module or a syntax error, not an assertion'); continue; }
    const patchFile = path.join(tmp, '.gold.patch'); fs.writeFileSync(patchFile, goldPatch);
    const ap = sh('git', ['apply', '--whitespace=nowarn', patchFile], tmp, 30000);
    if (ap.code !== 0) { note('the source part of the fix does not apply on its own'); continue; }
    const after = runTests(tmp, files);
    if (!after.every((a) => a.code === 0)) { note(`the hidden tests do not pass with the real fix (${after.filter((a) => a.code !== 0).map((a) => path.basename(a.file)).join(', ')})`); continue; }
    const again = runTests(tmp, files);
    if (!again.every((a) => a.code === 0)) { note('flaky: passed once, failed on the repeat'); continue; }
    const ms = Math.max(...after.map((a) => a.ms));
    if (ms > 60000) { note(`a hidden test takes ${Math.round(ms / 1000)} s`); continue; }

    // kept: write the single-commit snapshot of the BASE (not the fixed tree) as this task's repository
    const id = `c${String(tasks.length + 1).padStart(2, '0')}`;
    const name = `sigmap-${id}`;
    const repoDir = path.join(out, 'benchmarks', 'repos', name);
    fs.rmSync(repoDir, { recursive: true, force: true });
    snapshot(parent, repoDir);
    execFileSync('git', ['init', '-q', repoDir]);
    execFileSync('git', ['-C', repoDir, 'add', '-A']);
    execFileSync('git', ['-C', repoDir, '-c', 'user.name=study', '-c', 'user.email=study@example.invalid', 'commit', '-q', '-m', `base of ${id}`]);
    const base = execFileSync('git', ['-C', repoDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    manifest.repos.push({ name, url: `https://github.com/${SLUG}.git`, commit: base, language: 'javascript', layout: 'src', srcDirs: ['src', 'packages'] });
    usedIssues.add(issueNo);
    tasks.push({ id, split: 'change', source: 'merged-fix', repo: name, query: text, expected_files: goldFiles, hidden, issue: issueNo, upstream: h.slice(0, 10), parent: parent.slice(0, 10), goldLines, goldFiles: goldFiles.length, testMs: ms });
    console.log(`kept ${id}  ${h.slice(0, 7)}  #${issueNo}  src ${goldFiles.length} files / ${goldLines} lines  tests ${files.length} (${ms} ms)  ${subject.slice(0, 60)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

fs.writeFileSync(path.join(out, 'benchmarks', 'xrepo-repos.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(out, 'benchmarks', 'tasks', 'retrieval-xrepo.jsonl'), `${tasks.map((t) => JSON.stringify(t)).join('\n')}\n`);
fs.writeFileSync(path.join(out, 'excluded.txt'), `${report.join('\n')}\n`);
console.log(`\n${tasks.length} tasks kept (${report.length} fix commits examined and left out; reasons in ${path.join(out, 'excluded.txt')})`);
