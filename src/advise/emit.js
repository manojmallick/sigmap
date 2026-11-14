'use strict';

/**
 * emit.js — `sigmap advise --emit-root <dir>`: the inputs the paired agent harness reads, for THIS project.
 *
 * The harness (scripts/run-agent-ab.mjs, in the SigMap repository, not in the npm package) runs the same questions with and without a setup
 * against a real agent and pairs them. It reads a "data root": benchmarks/xrepo-repos.json (a manifest of repositories, each pinned to a
 * commit), benchmarks/tasks/retrieval-xrepo.jsonl (the questions) and a checkout under benchmarks/repos/<name>. The study built those from public
 * GitHub repositories (scripts/build-heldout-set.mjs); this builds them from the project in the current directory, private or not, out of the
 * questions `advise` already mined from its own git history.
 *
 * It writes ONLY under the directory it is given, never in the project: the checkout is a symlink to the project (the harness resolves a link
 * before it copies anything, so the project is never reset, cleaned or written; each arm is a throwaway copy that is hard-reset to the pin).
 * It will not write inside the project, and will not overwrite a directory that is not a root it wrote.
 *
 * Zero-dependency.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { CODE } = require('./mine');

const MARK = 'written by sigmap advise --emit-root';

function _git(cwd, args) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
}

/** A directory name the harness and a shell can both hold: letters, digits, dot, underscore, hyphen. */
function repoNameOf(dir) {
  const n = path.basename(dir).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').replace(/-+$/, '');
  return n || 'project';
}

/** The language most of the questions' files are in (by extension), as the study's builder names it. */
function languageOf(questions) {
  const tally = {};
  for (const q of questions) for (const f of q.files) { const l = CODE[(f.split('.').pop() || '').toLowerCase()]; if (l) tally[l] = (tally[l] || 0) + 1; }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return top ? top[0] : 'unknown';
}

const pad = (n, w) => String(n).padStart(w, '0');

/**
 * @param {string} cwd the project (a git work tree)
 * @param {string} outDir where to write the data root
 * @param {Array<{sha: string, title: string, files: string[]}>} questions as mined, oldest first
 * @returns {{ root: string, name: string, commit: string, dirty: boolean, questions: number, language: string, link: string, manifest: string, tasks: string }}
 * @throws {Error} with a message that says what to change
 */
function emitRoot(cwd, outDir, questions) {
  if (!Array.isArray(questions) || questions.length === 0) throw new Error('no question qualified, so there is nothing to write (try a longer --since)');
  const project = fs.realpathSync(cwd);
  const out = path.resolve(outDir);
  const rel = path.relative(project, out);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new Error(`--emit-root ${outDir} is inside the project; give a directory outside it (the harness copies the project, and a copy of its own inputs would be searchable by the agent)`);

  const manifestPath = path.join(out, 'benchmarks', 'xrepo-repos.json');
  if (fs.existsSync(out) && fs.readdirSync(out).length > 0) {
    let ours = false;
    try { ours = String(JSON.parse(fs.readFileSync(manifestPath, 'utf8'))._comment || '').includes(MARK); } catch (_) { /* not a root of ours */ }
    if (!ours) throw new Error(`${outDir} is not empty and is not a root this command wrote; use a new directory`);
  }

  let dotGit = null;
  try { dotGit = fs.lstatSync(path.join(project, '.git')); } catch (_) { /* absent: reported below */ }
  if (!dotGit || dotGit.isSymbolicLink() || !dotGit.isDirectory()) {
    throw new Error('this project\'s .git is not a directory of its own (a linked worktree or a submodule keeps it elsewhere), and the harness copies the project and resets the copy, which would write into that other repository; run advise in a plain clone (git clone <path> <dir>)');
  }

  const head = _git(project, ['rev-parse', 'HEAD']);
  if (head.error || head.status !== 0) throw new Error('not a git work tree with a commit: the harness pins every repository to one');
  const commit = head.stdout.trim();
  const st = _git(project, ['status', '--porcelain', '--untracked-files=no']);
  const dirty = st.status === 0 && st.stdout.trim().length > 0;

  const name = repoNameOf(project);
  const language = languageOf(questions);
  const tasks = questions.map((q, i) => ({ id: `p${pad(i + 1, 3)}`, split: 'local', source: 'merged-commit', repo: name, project: name, query: q.title, expected_files: q.files, goldCommit: q.sha }));
  const manifest = { _comment: `${MARK}: questions mined from this project's own git history`, repos: [{ name, url: 'local', commit, language, layout: 'local' }] };

  const tasksPath = path.join(out, 'benchmarks', 'tasks', 'retrieval-xrepo.jsonl');
  const link = path.join(out, 'benchmarks', 'repos', name);
  fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(tasksPath, `${tasks.map((t) => JSON.stringify(t)).join('\n')}\n`);
  let existing = null;
  try { existing = fs.lstatSync(link); } catch (_) { /* nothing there */ }
  if (existing) {
    if (!existing.isSymbolicLink()) throw new Error(`${link} exists and is not a link this command made; remove it or use a new directory`);
    fs.unlinkSync(link); // our own link from an earlier run
  }
  fs.symlinkSync(project, link, 'dir');
  return { root: out, name, commit, dirty, questions: tasks.length, language, link, manifest: manifestPath, tasks: tasksPath };
}

module.exports = { emitRoot, repoNameOf, languageOf, MARK };
