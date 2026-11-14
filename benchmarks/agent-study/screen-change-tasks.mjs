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
import { spawnSync } from 'child_process';

const argv = process.argv.slice(2);
const root = argv[0];
const skip = new Set((argv.includes('--skip') ? argv[argv.indexOf('--skip') + 1] : '').split(',').filter(Boolean));
if (!root) { console.error('usage: screen-change-tasks.mjs <data root> [--skip c08,c10]'); process.exit(2); }

const tasks = fs.readFileSync(path.join(root, 'benchmarks/tasks/retrieval-xrepo.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const out = [];
for (const t of tasks) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'screen-'));
  fs.cpSync(path.join(root, 'benchmarks/repos', t.repo), tmp, { recursive: true });
  const invents = []; const unresolved = [];
  for (const h of t.hidden) {
    const re = /const\s*\{([^}]+)\}\s*=\s*require\(([^;]+?)\);/g;
    const checks = [];
    for (let m; (m = re.exec(h.content));) checks.push({ names: m[1].split(',').map((s) => s.trim().split(':')[0].trim()).filter(Boolean), expr: m[2] });
    const dir = path.join(tmp, path.dirname(h.path));
    fs.mkdirSync(dir, { recursive: true });
    const lines = ["const path = require('path'); const fs = require('fs'); const os = require('os'); const ROOT = path.resolve(__dirname, '../..'); const res = { missing: [], unresolved: [] };"];
    for (const c of checks) lines.push(`try { const m = require(${c.expr}); for (const n of ${JSON.stringify(c.names)}) if (typeof m[n] === 'undefined') res.missing.push(n); } catch (e) { res.unresolved.push(${JSON.stringify(c.expr.slice(0, 60))}); }`);
    lines.push('console.log(JSON.stringify(res));');
    const f = path.join(dir, '__screen.js');
    fs.writeFileSync(f, lines.join('\n'));
    const r = spawnSync(process.execPath, [f], { cwd: tmp, encoding: 'utf8', timeout: 60000 });
    try {
      const j = JSON.parse(r.stdout.trim().split('\n').pop());
      for (const n of j.missing) if (!invents.includes(n)) invents.push(n);
      for (const n of j.unresolved) if (!unresolved.includes(n)) unresolved.push(n);
    } catch (_) { unresolved.push(`screen failed for ${h.path}`); }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  out.push({
    id: t.id, issue: t.issue, base: t.parent, title: t.query.split('\n')[0], fixFiles: t.goldFiles || t.expected_files,
    hiddenTests: t.hidden.map((h) => ({ file: h.path, bytes: h.content.length })), invents, unresolved,
    ran: !skip.has(t.id),
    ...(skip.has(t.id) ? { leftOut: 'umbrella issue: its text does not say what the tests check (read before any agent ran)' } : {}),
  });
}
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
