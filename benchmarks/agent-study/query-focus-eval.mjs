#!/usr/bin/env node
// Offline, no model call: does the prefetch hook's query focusing (src/session/query-focus.js) rank a wrapped question as well as the bare one?
//
//   HELDOUT_ROOT=<dir> HELDOUT2_ROOT=<dir> node benchmarks/agent-study/query-focus-eval.mjs [--split tune|confirm|all] [--wrappers a,b,c]
//
// Each held-out question is put inside a wrapper (greetings, instructions about the answer, background, pasted output, constraints) and
// ranked by the real `sigmap ask`, three ways: the bare question, the wrapped prompt as the hook used to rank it, and the focused prompt.
// A question counts as found when an expected file is first (top-1) or among the first five (top-5). The roots are the two held-out
// data roots of run-hook-study.sh; the first (5 repositories, 55 questions) is the "tune" split, the second (15, 167) the "confirm" split.
//
// Wrappers were written in three batches: `tune` seven, while the rule was designed; `confirm` three, before the rule was scored on that
// split; `validate` four, after the confirm split had changed the rule once (a short "label:" lead-in was diluting the question). Which
// batch a wrapper belongs to is printed, because only the last is a clean test of the rule as shipped.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { prepareArm } from '../../scripts/lib/agent-ab-arms.mjs';
import { buildPrompt } from '../../scripts/lib/agent-ab.mjs';
import { loadManifest, readTasks, TASKS_REL } from '../../scripts/lib/xrepo.mjs';

const CODE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { focusQuery } = createRequire(import.meta.url)(path.join(CODE, 'src', 'session', 'query-focus.js'));

export const WRAPPERS = {
  bare: { batch: 'reference', wrap: (q) => q },
  template: { batch: 'tune', wrap: (q) => buildPrompt({ query: q }) },
  polite: { batch: 'tune', wrap: (q) => `Hi! I just joined this team and I'm still getting familiar with the codebase. Could you help me with something? ${q} Thanks so much. A short explanation is plenty, there's no need to be exhaustive.` },
  rules: { batch: 'tune', wrap: (q) => `Please be concise and do not modify any files. ${q} Respond in bullet points and mention the relevant file paths.` },
  log: { batch: 'tune', wrap: (q) => `${q}\n\nHere is what I saw when I ran the test suite earlier today:\n\`\`\`\n$ npm test\n> project@1.0.0 test\n> jest --coverage\n\n PASS  tests/unit/a.test.js (3.2 s)\n PASS  tests/unit/b.test.js (1.1 s)\n PASS  tests/integration/c.test.js (5.4 s)\n\nTest Suites: 3 passed, 3 total\nTests:       41 passed, 41 total\nSnapshots:   0 total\nTime:        9.9 s\nRan all test suites.\n\`\`\`` },
  context: { batch: 'tune', wrap: (q) => `Background: we are migrating our service to a new deployment pipeline next quarter and I want to be sure I understand the moving parts. The team does code review on every change and we ship weekly.\n\nOne question about the code: ${q}\n\nI will read whatever you point me to before changing anything.` },
  standards: { batch: 'tune', wrap: (q) => `Project conventions you should keep in mind for this session: follow the existing code style and naming, keep functions small and focused, write clear error messages, handle edge cases, add or update tests when behaviour changes, update the documentation when public interfaces change, avoid adding new dependencies unless necessary, and keep commits focused. Do not make unrelated refactors.\n\n${q}` },
  task: { batch: 'confirm', wrap: (q) => `Task: ${q}\n\nConstraints:\n- keep the public API unchanged\n- add tests for any new behaviour\n- no new dependencies\n\nAcceptance: the existing test suite still passes and the change is easy to review.` },
  trace: { batch: 'confirm', wrap: (q) => `I'm seeing a crash and I'm not sure where to start.\n\nTraceback (most recent call last):\n  File "main.py", line 42, in run\n    result = handler(request)\n  File "handler.py", line 17, in handle\n    raise RuntimeError("unexpected state")\nRuntimeError: unexpected state\n\nWhat I'm trying to do: ${q}` },
  chat: { batch: 'confirm', wrap: (q) => `ok so here's the thing. i've been looking at this for a while now and honestly i'm a bit lost. ${q} any pointers would be great, thanks!!` },
  issue: { batch: 'validate', wrap: (q) => `Issue #482 — ${q}\n\nSteps to reproduce:\n1. clone the repository\n2. run the build\n3. observe the behaviour described above\n\nExpected: it works as described in the documentation.\nActual: it does not.` },
  review: { batch: 'validate', wrap: (q) => `Could you take a look at this when you get a chance? I've been going back and forth on it all week and a second pair of eyes would really help. ${q} No rush at all, whenever you have time.` },
  longpolite: { batch: 'validate', wrap: (q) => `Hello there, hope your day is going well! I wanted to ask about something in this project that has been bugging me for a while now. I know you are busy so I will keep it brief. ${q} I really appreciate any help you can give me with this, and thanks again in advance.` },
  instr2: { batch: 'validate', wrap: (q) => `Answer in two or three sentences. Cite the files you looked at. Do not guess; if you are unsure, say so. ${q} Use plain language and avoid jargon.` },
};

const rankedFiles = (t) => { const o = []; for (const l of String(t).split('\n')) { const m = /^\s*\d+\s+(\S+)\s+-?[\d.]+\s+\d+\s*tok\b/.exec(l); if (m) o.push(m[1]); } return o; };
const cache = new Map();
function askOne(cwd, query) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(CODE, 'gen-context.js'), 'ask', query.replace(/^[-\s]+/, '')], { cwd, env: { ...process.env, SIGMAP_NO_UPDATE_CHECK: '1', NO_COLOR: '1' } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    const timer = setTimeout(() => p.kill('SIGKILL'), 60000);
    p.on('close', () => { clearTimeout(timer); resolve(rankedFiles(out)); });
  });
}
async function rankAll(pairs, concurrency = 8) {
  const todo = [...new Map(pairs.filter(([c, q]) => !cache.has(`${c}\0${q}`)).map(([c, q]) => [`${c}\0${q}`, [c, q]])).values()];
  let i = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => { while (i < todo.length) { const [c, q] = todo[i++]; cache.set(`${c}\0${q}`, await askOne(c, q)); } }));
  return pairs.map(([c, q]) => cache.get(`${c}\0${q}`));
}

async function main() {
  const argv = process.argv.slice(2);
  const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const split = val('--split', 'all');
  const wrappers = (val('--wrappers', '') ? val('--wrappers', '').split(',') : Object.keys(WRAPPERS));
  for (const w of wrappers) if (!WRAPPERS[w]) { console.error(`unknown wrapper "${w}" (one of ${Object.keys(WRAPPERS).join(', ')})`); process.exit(2); }
  const roots = [[process.env.HELDOUT_ROOT, 'tune'], [process.env.HELDOUT2_ROOT, 'confirm']];
  if (roots.some(([r]) => !r || !fs.existsSync(path.join(r, TASKS_REL)))) { console.error('set HELDOUT_ROOT and HELDOUT2_ROOT to the held-out data roots (see run-hook-study.sh)'); process.exit(2); }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'query-focus-eval-'));
  const items = [];
  for (const [root, sp] of roots) {
    if (split !== 'all' && split !== sp) continue;
    const manifest = loadManifest(root); const tasks = readTasks(path.join(root, TASKS_REL));
    for (const repo of manifest.repos || manifest) {
      const mine = tasks.filter((t) => t.repo === repo.name);
      if (!mine.length || repo.name === 'emilk__egui_plot') continue; // the harness refuses it: its copy is not clean at the pinned commit
      const arm = prepareArm({ root, repo, arm: 'with', tmpRoot: tmp, codeRoot: CODE, variant: 'prefetch-hook', sessionAuth: true });
      for (const t of mine) items.push({ sp, cwd: arm.cwd, query: t.query, expected: t.expected_files.map((f) => f.replace(/^\.\//, '')) });
    }
  }
  console.log(`${items.length} questions (${split}), ranked by the real \`sigmap ask\`; rule = src/session/query-focus.js\n`);

  const pairs = [], meta = [];
  for (const it of items) for (const w of wrappers) {
    const p = WRAPPERS[w].wrap(it.query);
    pairs.push([it.cwd, p]); meta.push({ it, w, k: 'raw' });
    pairs.push([it.cwd, focusQuery(p).query]); meta.push({ it, w, k: 'focused' });
  }
  const ranked = await rankAll(pairs);
  const acc = {};
  ranked.forEach((r, i) => {
    const { it, w, k } = meta[i];
    const a = (((acc[w] ||= {})[k]) ||= { n: 0, h1: 0, h5: 0 });
    a.n++; if (it.expected.includes(r[0])) a.h1++; if (r.slice(0, 5).some((f) => it.expected.includes(f))) a.h5++;
  });
  const f = (a) => `${a.h5} ${Math.round((100 * a.h5) / a.n)}% (${a.h1} ${Math.round((100 * a.h1) / a.n)}%)`;
  console.log('top-5 hits, with top-1 in brackets'.padEnd(36) + 'raw prompt'.padEnd(20) + 'focused'.padEnd(20) + 'batch');
  for (const w of wrappers) console.log(w.padEnd(36) + f(acc[w].raw).padEnd(20) + f(acc[w].focused).padEnd(20) + WRAPPERS[w].batch);
  const identity = items.filter((it) => focusQuery(it.query).query !== it.query).length;
  console.log(`\nbare questions changed by focusing: ${identity} of ${items.length} (must be 0)`);
  const longW = wrappers.filter((w) => w !== 'bare');
  if (longW.length && acc.bare) {
    const sum = (k, key) => longW.reduce((s, w) => s + acc[w][k][key], 0);
    const total = longW.length * items.length;
    console.log(`pooled over ${longW.length} wrappers (${total} prompts): top-5 raw ${sum('raw', 'h5')} -> focused ${sum('focused', 'h5')}; top-1 raw ${sum('raw', 'h1')} -> focused ${sum('focused', 'h1')}; the bare question: ${acc.bare.raw.h5} and ${acc.bare.raw.h1} per ${items.length}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
