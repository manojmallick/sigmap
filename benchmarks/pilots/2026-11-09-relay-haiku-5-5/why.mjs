#!/usr/bin/env node
// Why SigMap saved neither tokens nor time in the real-API runs: the arithmetic, from the saved raw records. Offline.
//
//   node benchmarks/pilots/2026-11-09-relay-haiku-5-5/why.mjs
//
// A. Where an agent run's tokens go: nearly all of them are the same prompt prefix and the growing conversation re-read on every turn,
//    so a run's tokens are about (turns × tokens per turn). SigMap adds a fixed amount to every turn.
// B. How many turns SigMap would have to remove to break even on tokens, against how many it removed.
// C. Time: per turn, and whether it moved.
// D. The size of what SigMap's published "token reduction" is measured against, next to what the baseline agent actually used.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const load = (sub) => fs.readdirSync(path.join(here, 'session-auth', sub), { withFileTypes: true })
  .filter((e) => e.isDirectory()).flatMap((e) => require(path.join(here, 'session-auth', sub, e.name, 'raw.json')));
const key = (x) => `${x.repo}/${x.task}|${x.run}`;
function complete(set) { const bad = new Set(set.filter((x) => !x.ok).map(key)); return set.filter((x) => !bad.has(key(x))); }
const sets = {
  index: complete([...load('index-first5'), ...load('index-rest'), ...load('index-large')]),
  lean: complete(load('lean')),
  current: complete(load('current')),
};

const tokens = (x) => x.usage.in + x.usage.out + x.usage.cacheRead + x.usage.cacheWrite;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const turns = (x) => x.toolCalls.total + 1; // each tool call is followed by another model turn, plus the final answer
const k = (v) => `${(v / 1000).toFixed(1)}k`;

// ── A. tokens are turns × tokens per turn
console.log('A. Where the tokens go (baseline arms of all three invocations, 270 runs)');
const base = Object.values(sets).flatMap((s) => s.filter((x) => x.arm === 'without'));
const n = base.length; const mx = mean(base.map(turns)); const my = mean(base.map(tokens));
const slope = base.reduce((s, x) => s + (turns(x) - mx) * (tokens(x) - my), 0) / base.reduce((s, x) => s + (turns(x) - mx) ** 2, 0);
const icpt = my - slope * mx;
const ssRes = base.reduce((s, x) => s + (tokens(x) - (icpt + slope * turns(x))) ** 2, 0); const ssTot = base.reduce((s, x) => s + (tokens(x) - my) ** 2, 0);
console.log(`   a baseline run: ${mean(base.map((x) => x.toolCalls.total)).toFixed(1)} tool calls = ${mx.toFixed(1)} turns, ${k(my)} tokens, ${k(my / mx)} per turn on average`);
console.log(`   fit: tokens ≈ ${k(icpt)} + ${k(slope)} × turns   (R² ${(1 - ssRes / ssTot).toFixed(2)}, n=${n})  → a run costs what its turns cost; the prefix is read again on each one`);

console.log('\n   per turn, SigMap arm against its own baseline (the static text SigMap adds is the difference):');
const STATIC = { index: 1577, lean: 1028, current: 4315 }; // arm-audit.mjs: tool definitions + section, tokens per turn
for (const [name, set] of Object.entries(sets)) {
  const w = set.filter((x) => x.arm === 'with'); const b = set.filter((x) => x.arm === 'without');
  const pw = mean(w.map(tokens)) / mean(w.map(turns)); const pb = mean(b.map(tokens)) / mean(b.map(turns));
  console.log(`   ${name.padEnd(8)} baseline ${k(pb)}/turn, SigMap ${k(pw)}/turn, difference ${k(pw - pb)}/turn against ${k(STATIC[name])} of text added by the setup`);
}

// ── B. break-even
console.log('\nB. Turns SigMap must remove to break even on tokens, against turns it removed');
for (const [name, set] of Object.entries(sets)) {
  const w = set.filter((x) => x.arm === 'with'); const b = set.filter((x) => x.arm === 'without');
  const tb = mean(b.map(turns)); const tw = mean(w.map(turns));
  const pb = mean(b.map(tokens)) / tb; const delta = STATIC[name];
  const need = 1 - pb / (pb + delta); // T_w × (pb + delta) = T_b × pb
  console.log(`   ${name.padEnd(8)} needs ${(need * 100).toFixed(0)}% fewer turns (${tb.toFixed(1)} → ${(tb * (1 - need)).toFixed(1)}); got ${((tw / tb - 1) * 100).toFixed(0)}% (${tb.toFixed(1)} → ${tw.toFixed(1)}); tokens ${((mean(w.map(tokens)) / mean(b.map(tokens)) - 1) * 100).toFixed(0)}%`);
}

// ── C. time
console.log('\nC. Time');
for (const [name, set] of Object.entries(sets)) {
  const w = set.filter((x) => x.arm === 'with'); const b = set.filter((x) => x.arm === 'without');
  console.log(`   ${name.padEnd(8)} baseline ${(mean(b.map((x) => x.durationMs)) / 1000).toFixed(1)} s over ${mean(b.map(turns)).toFixed(1)} turns = ${(mean(b.map((x) => x.durationMs)) / 1000 / mean(b.map(turns))).toFixed(1)} s/turn; SigMap ${(mean(w.map((x) => x.durationMs)) / 1000).toFixed(1)} s over ${mean(w.map(turns)).toFixed(1)} turns = ${(mean(w.map((x) => x.durationMs)) / 1000 / mean(w.map(turns))).toFixed(1)} s/turn`);
}
console.log('   time follows turns, not tokens: the cached prefix adds almost no latency, so time moves only if turns do.');

// ── D. what the published reduction is measured against
console.log('\nD. The "before" in SigMap\'s published token reduction, against what the agent used');
const repos = path.resolve(here, '..', '..', 'repos');
const exts = { gin: /\.go$/, flask: /\.py$/, express: /\.js$/, fastify: /\.js$/, fastapi: /\.py$/, django: /\.py$/, rails: /\.rb$/, laravel: /\.php$/ };
let shown = false;
for (const [repo, re] of Object.entries(exts)) {
  const dir = path.join(repos, repo);
  if (!fs.existsSync(path.join(dir, '.git'))) continue;
  let bytes = 0; let files = 0;
  for (const f of execFileSync('git', ['-C', dir, 'ls-files'], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter((l) => re.test(l))) {
    try { bytes += fs.statSync(path.join(dir, f)).size; files++; } catch (_) { /* gone */ }
  }
  const mine = base.filter((x) => x.repo === repo);
  console.log(`   ${repo.padEnd(8)} ${String(files).padStart(5)} source files ≈ ${k(bytes / 4).padStart(8)} tokens if read whole; the baseline agent used ${k(mean(mine.map(tokens)))} per run, in ${mean(mine.map((x) => x.toolCalls.total)).toFixed(1)} calls`);
  shown = true;
}
if (!shown) console.log('   (fetch the checkouts with npm run fetch:xrepo to see this block)');
console.log('   A reduction measured against "put the whole repository, or all its signatures, in the prompt" is real, and it is not what an agent that greps does.');
