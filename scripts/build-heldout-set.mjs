#!/usr/bin/env node
// Build a held-out question set from repositories SigMap was never tuned on: each question is the title of a change the maintainers merged
// after a date, and its label is the source file(s) that change touched.
//
//   node scripts/build-heldout-set.mjs --out <dir> --repos owner/name,owner/name [--since 2026-07-01] [--max-per-repo 12] [--min-per-repo 8]
//   node scripts/build-heldout-set.mjs --out <dir> --repos python:owner/a,python:owner/b,go:owner/c --keep-per-language 2   (stop a language after 2 usable repositories)
//
// The rule is mechanical and fixed before any agent runs (it reads a repository's own git history, nothing else):
//   - the commits on the default branch since --since, first-parent: a squash-merged pull request is one commit, a merge-commit pull
//     request is its merge commit, whose title is the first line of its message body;
//   - the title has its trailing "(#123)" and its conventional-commit type ("fix(parser):" becomes "parser:") taken off, and is 25 to
//     160 characters; bots, dependency bumps, releases, reverts and merges are left out;
//   - a title of fewer than 4 words, or one about lint, formatting, tests, docs, refactoring, renames or CI, is left out;
//   - the commit changes 1 to 3 source files (a code extension, not a test, fixture, example, demo, doc, config, generated or minified file), every one
//     of which still exists at the pinned commit (the default branch's head when the set is built), and the title names none of them;
//   - the questions are the oldest qualifying commits up to --max-per-repo, so the choice does not depend on how they might score;
//   - a repository with fewer than --min-per-repo qualifying commits contributes nothing and is reported.
// Output is a data root the harness reads like any other: benchmarks/xrepo-repos.json, benchmarks/tasks/retrieval-xrepo.jsonl and one
// shallow checkout per repository under benchmarks/repos/. Needs network access to clone; no key, no GitHub API.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = val('--out', null);
const ENTRIES = (val('--repos', '') || '').split(',').map((s) => s.trim()).filter(Boolean).map((e) => (e.includes(':') ? { lang: e.split(':')[0], slug: e.split(':').slice(1).join(':') } : { lang: null, slug: e }));
const REPOS = ENTRIES.map((e) => e.slug);
const KEEP = val('--keep-per-language', null) ? Number(val('--keep-per-language', '0')) : null;
const keptBy = {};
const SINCE = val('--since', '2026-07-01');
const MAX = Number(val('--max-per-repo', '12'));
const MIN = Number(val('--min-per-repo', '8'));
if (!OUT || !REPOS.length) { console.error('usage: build-heldout-set.mjs --out <dir> --repos owner/name,... [--since YYYY-MM-DD] [--max-per-repo N] [--min-per-repo N]'); process.exit(2); }

const CODE = { py: 'python', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', tsx: 'typescript', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', scala: 'scala', rb: 'ruby', php: 'php', c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', swift: 'swift' };
const NOT_SOURCE = [/(^|\/)(tests?|spec|specs|__tests__|e2e|integration-tests?|fixtures?|testdata|test-data|examples?|samples?|docs?|documentation|benchmarks?|scripts?|demos?|website|playground|\.github|vendor|node_modules)\//i, /\.config\.\w+$/i, /[._-](test|spec|tests)\.\w+$/i, /(^|\/)(tests?|testing|spec|conftest)\.\w+$/i, /(^|\/)test_[^/]*$/i, /_tests?\.\w+$/, /(Test|Tests|IT|Spec)\.(java|kt|scala)$/, /\.d\.ts$/, /generated|\.pb\.go$|_pb2|\.min\.|\.gen\./i, /(^|\/)setup\.py$/];
const NOT_A_FEATURE = /^(bump|chore\(deps|chore: bump|update dependency|build\(deps|release|prepare release|merge|revert|version|v?\d+\.\d+|\[?release|ci:|docs?:|style:|test:|tests:)/i;
// a title that does not describe behaviour: tooling, style, a test or a docs pass, or too short to say anything
const VAGUE = /\b(lint|linter|clippy|typos?|formatt?(ing|er)?|style|clean ?up|refactor(ing)?|rename[sd]?|readiness|wip|docs?|readme|tests?|dependenc(y|ies)|ci|workflow)\b/i;
const BOT = /\[bot\]|dependabot|renovate|github-actions|noreply@github\.com.*bot|bot@/i;

const git = (cwd, ...a) => spawnSync('git', ['-C', cwd, ...a], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1', GIT_TERMINAL_PROMPT: '0' } });
const out = path.resolve(OUT);
fs.mkdirSync(path.join(out, 'benchmarks', 'tasks'), { recursive: true });
fs.mkdirSync(path.join(out, 'benchmarks', 'repos'), { recursive: true });

const isSource = (f) => CODE[(f.split('.').pop() || '').toLowerCase()] && !NOT_SOURCE.some((re) => re.test(f));
function cleanTitle(s) {
  let t = s.replace(/\s*\(#\d+\)\s*$/, '').replace(/^[\s\p{Extended_Pictographic}️]+/u, '').trim();
  const m = /^([a-z]+)(?:\(([^)]+)\))?!?:\s*(.+)$/i.exec(t);
  if (m && /^(fix|feat|feature|perf|refactor|chore|build|improve|add|update)$/i.test(m[1])) t = m[2] ? `${m[2]}: ${m[3]}` : m[3];
  return t.trim();
}

const manifest = { _comment: `held-out questions: merged changes since ${SINCE} in repositories SigMap was not tuned on (scripts/build-heldout-set.mjs)`, repos: [] };
const tasks = []; const report = [];
let n = 0;
for (const { slug, lang: wantLang } of ENTRIES) {
  if (KEEP && wantLang && (keptBy[wantLang] || 0) >= KEEP) { report.push(`${slug}: not tried (${KEEP} ${wantLang} repositories already usable)`); continue; }
  const name = slug.replace('/', '__');
  const dir = path.join(out, 'benchmarks', 'repos', name);
  if (!fs.existsSync(path.join(dir, '.git'))) {
    const c = spawnSync('git', ['clone', '-q', '--no-tags', `--shallow-since=${SINCE}`, `https://github.com/${slug}`, dir], { encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1', GIT_TERMINAL_PROMPT: '0' } });
    if (c.status !== 0) { report.push(`${slug}: clone failed: ${(c.stderr || '').trim().split('\n').pop()}`); continue; }
  }
  const head = git(dir, 'rev-parse', 'HEAD').stdout.trim();
  const log = git(dir, 'log', '--first-parent', `--since=${SINCE}`, '--format=%H%x1f%P%x1f%s%x1f%an <%ae>%x1f%b%x1e').stdout.split('\x1e').map((s) => s.replace(/^\n/, '')).filter(Boolean).reverse();
  const picks = []; const why = {};
  const skip = (r) => { why[r] = (why[r] || 0) + 1; };
  for (const rec of log) {
    const [sha, parents, subject, author, body] = rec.split('\x1f');
    const parent = (parents || '').split(' ')[0];
    if (!parent || BOT.test(author)) { skip('bot or no parent in the shallow history'); continue; }
    let title = subject;
    if (/^Merge pull request #\d+/.test(subject)) title = (body || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
    title = cleanTitle(title);
    if (title.length < 25 || title.length > 160) { skip('title length'); continue; }
    if (title.split(/\s+/).length < 4 || VAGUE.test(title)) { skip('title is vague, about tooling, tests or docs'); continue; }
    if (NOT_A_FEATURE.test(title) || /dependabot|bump .* from .* to/i.test(title)) { skip('dependency bump, release, revert, merge or docs'); continue; }
    const files = git(dir, 'diff', '--name-only', parent, sha).stdout.split('\n').filter(Boolean);
    const src = files.filter(isSource);
    if (src.length < 1 || src.length > 3) { skip('not 1 to 3 source files'); continue; }
    if (src.some((f) => !fs.existsSync(path.join(dir, f)))) { skip('a changed source file no longer exists'); continue; }
    const low = title.toLowerCase();
    if (src.some((f) => { const b = path.basename(f); const stem = b.replace(/\.[^.]+$/, ''); return low.includes(b.toLowerCase()) || (stem.length >= 6 && low.includes(stem.toLowerCase())); })) { skip('the title names a changed file'); continue; }
    picks.push({ sha, title, src });
  }
  const chosen = picks.slice(0, MAX);
  if (chosen.length < MIN) { report.push(`${slug}: ${chosen.length} qualifying question(s) (< ${MIN}); left out. Skipped: ${JSON.stringify(why)}`); fs.rmSync(dir, { recursive: true, force: true }); continue; }
  const langs = {}; for (const c of chosen) for (const f of c.src) { const l = CODE[f.split('.').pop().toLowerCase()]; langs[l] = (langs[l] || 0) + 1; }
  const language = Object.entries(langs).sort((a, b) => b[1] - a[1])[0][0];
  if (wantLang) keptBy[wantLang] = (keptBy[wantLang] || 0) + 1;
  manifest.repos.push({ name, url: `https://github.com/${slug}.git`, commit: head, language, layout: 'heldout' });
  for (const c of chosen) { n++; tasks.push({ id: `p${String(n).padStart(3, '0')}`, split: 'heldout', source: 'merged-commit', repo: name, project: slug, query: c.title, expected_files: c.src, goldCommit: c.sha }); }
  report.push(`${slug}: ${chosen.length} questions (of ${picks.length} qualifying; ${log.length} commits since ${SINCE}); pinned ${head.slice(0, 10)}; language ${language}. Skipped: ${JSON.stringify(why)}`);
}
fs.writeFileSync(path.join(out, 'benchmarks', 'xrepo-repos.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(out, 'benchmarks', 'tasks', 'retrieval-xrepo.jsonl'), `${tasks.map((t) => JSON.stringify(t)).join('\n')}\n`);
fs.writeFileSync(path.join(out, 'report.txt'), `${report.join('\n')}\n`);
console.log(report.join('\n'));
console.log(`\n${tasks.length} questions in ${manifest.repos.length} repositories -> ${out}`);
