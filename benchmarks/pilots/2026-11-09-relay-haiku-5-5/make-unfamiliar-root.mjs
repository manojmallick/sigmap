#!/usr/bin/env node
// Build a data root for the agent A/B on code the model has NOT memorised: this repository itself, with its own labelled
// "hard" questions (benchmarks/tasks/retrieval-hard.jsonl: behaviour described in other words than the code uses).
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/make-unfamiliar-root.mjs <dir> [how-many-questions=30]
//   SIGMAP_XREPO_DATA=<dir> node scripts/run-agent-ab.mjs --repos sigmap-src --task-ids h001,... --session-auth ...
//
// The eight repos of the pilot are famous frameworks: closed-book.mjs shows a model names the right file for most of those
// questions with no repository at all, so they cannot show what retrieval is worth on code a model has never seen. SigMap's own
// source is public but obscure and changes weekly; closed-book.mjs on these questions measures how much of it a model knows.
//
// The clone is sanitised so neither arm is handed the answers: the label corpora and saved reports (benchmarks/), and every
// file SigMap generated for agents (CLAUDE.md, AGENTS.md, llms*.txt, the copilot/gemini context files) and the checkout's own
// agent settings (.claude/, whose permission list would widen both arms' shell) are removed and the
// result committed, and that commit is the pin. Everything else (source, tests, docs, the changelog, the bundled gen-context.js)
// stays, as it would in a real checkout. The questions are the first N by id whose expected files all exist at that commit,
// a rule fixed before any run.
//
// Caveat to carry into any result: SigMap's ranker was tuned on corpora of this repository, so this is home turf for it.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const [dest, nArg] = process.argv.slice(2);
if (!dest) { console.error('usage: make-unfamiliar-root.mjs <dir> [n=30]'); process.exit(2); }
const N = Number(nArg) || 30;
const NAME = 'sigmap-src';
const root = path.resolve(dest);
const clone = path.join(root, 'benchmarks', 'repos', NAME);
const git = (dir, args) => execFileSync('git', ['-c', 'user.name=pilot', '-c', 'user.email=pilot@example.invalid', '-C', dir, ...args], { encoding: 'utf8' }).trim();

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(path.join(root, 'benchmarks', 'tasks'), { recursive: true });
fs.mkdirSync(path.dirname(clone), { recursive: true });
const source = git(ROOT, ['rev-parse', 'HEAD']);
execFileSync('git', ['clone', '-q', '--no-hardlinks', ROOT, clone]);
git(clone, ['checkout', '-q', '--detach', source]);
const REMOVE = ['benchmarks', 'public-benchmarks', '.claude', 'CLAUDE.md', 'AGENTS.md', 'llms.txt', 'llms-full.txt', '.github/copilot-instructions.md', '.github/gemini-context.md', '.cursorrules', '.windsurfrules', 'gen-context.config.json'];
const removed = [];
for (const p of REMOVE) if (fs.existsSync(path.join(clone, p))) { git(clone, ['rm', '-r', '-q', '--', p]); removed.push(p); }
git(clone, ['commit', '-q', '-m', 'sanitised snapshot for the unfamiliar-code A/B: answer keys and generated agent context removed']);
const commit = git(clone, ['rev-parse', 'HEAD']);

const hard = fs.readFileSync(path.join(ROOT, 'benchmarks', 'tasks', 'retrieval-hard.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const usable = hard.filter((t) => t.expected_files.length && t.expected_files.every((f) => fs.existsSync(path.join(clone, f))));
const tasks = usable.slice(0, N).map((t) => ({ id: t.id, split: 'hard', source: 'labelled', repo: NAME, query: t.query, expected_files: t.expected_files }));
fs.writeFileSync(path.join(root, 'benchmarks', 'tasks', 'retrieval-xrepo.jsonl'), tasks.map((t) => JSON.stringify(t)).join('\n') + '\n');
const manifest = { _comment: `unfamiliar-code data root: ${NAME} = this repository at ${source}, sanitised`, repos: [{ name: NAME, url: 'https://github.com/manojmallick/sigmap.git', commit, language: 'javascript', layout: 'src', srcDirs: ['src', 'packages'] }] };
fs.writeFileSync(path.join(root, 'benchmarks', 'xrepo-repos.json'), JSON.stringify(manifest, null, 2) + '\n');
const files = git(clone, ['ls-files']).split('\n');
console.log(`data root: ${root}`);
console.log(`  ${NAME} at ${commit.slice(0, 12)} (from ${source.slice(0, 12)}), ${files.length} tracked files, ${files.filter((f) => /^(src|packages)\//.test(f)).length} under src/ and packages/`);
console.log(`  removed: ${removed.join(', ')}`);
console.log(`  questions: ${tasks.length} of ${hard.length} (${hard.length - usable.length} skipped: an expected file is gone at this commit): ${tasks.map((t) => t.id).join(',')}`);
