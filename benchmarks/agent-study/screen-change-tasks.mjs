#!/usr/bin/env node
// Describe the change tasks of a data root (scripts/build-change-tasks.mjs) and screen their hidden tests for one validity problem:
// a test that takes a name out of a module (`const { a, b } = require(...)`) that does not exist in that module at the base commit
// cannot pass unless the fix invents that very name, however correctly the bug is fixed. The bug report cannot name it, so such a task
// measures whether the agent guessed the author's API, not whether it fixed the bug. Modules that fail to load are reported apart
// (usually a fixture the test writes to a temp directory), not counted.
//
//   node benchmarks/agent-study/screen-change-tasks.mjs <data root> [--skip c08,c10] > tasks.json
//
// Prints one object per task: id, issue, base commit, the first line of the report, the real fix's source files, the hidden test files
// with their size, `invents` (names the tests need that the base lacks) and `unresolved`.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { screenHiddenTests } from '../../scripts/lib/change-task-screen.mjs';

const argv = process.argv.slice(2);
const root = argv[0];
const skip = new Set((argv.includes('--skip') ? argv[argv.indexOf('--skip') + 1] : '').split(',').filter(Boolean));
if (!root) { console.error('usage: screen-change-tasks.mjs <data root> [--skip c08,c10]'); process.exit(2); }

const tasks = fs.readFileSync(path.join(root, 'benchmarks/tasks/retrieval-xrepo.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const out = [];
for (const t of tasks) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'screen-'));
  fs.cpSync(path.join(root, 'benchmarks/repos', t.repo), tmp, { recursive: true });
  const { invents, unresolved } = screenHiddenTests(tmp, t.hidden);
  fs.rmSync(tmp, { recursive: true, force: true });
  out.push({
    id: t.id, issue: t.issue, base: t.parent, title: t.query.split('\n')[0], fixFiles: t.goldFiles || t.expected_files,
    hiddenTests: t.hidden.map((h) => ({ file: h.path, bytes: h.content.length })), invents, unresolved,
    ran: !skip.has(t.id),
    ...(skip.has(t.id) ? { leftOut: 'umbrella issue: its text does not say what the tests check (read before any agent ran)' } : {}),
  });
}
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
