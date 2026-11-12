#!/usr/bin/env node
// Offline, no model call: can the prefetch hook tell, from what it already holds, that its ranking is probably wrong?
//
//   HELDOUT_ROOT=<dir> HELDOUT2_ROOT=<dir> node benchmarks/agent-study/guard-eval.mjs
//
// For each of the 222 held-out questions the benchmark's wrapped prompt is focused (src/session/query-focus.js) and ranked by the real
// `sigmap ask`; a ranking is "right" when an expected file is among the files it shows. Four families of signal, fixed before any was scored,
// are tried: the flatness of the shown scores, the top score, the margin between the first two, and the share of the query's letters the
// ranker can read. Part 1 prints each family's AUC; part 2 the leave-one-repository-out threshold selection of the registered procedure
// (docs-vp/guide/agent-study-protocol.md, Stage F) for each family and each pair; part 3 the rule that ships (src/session/prefetch.js:
// `readable < 0.9`) and its counterfactual on the agent runs of Stages D and E in data/runs.ndjson (a pair the guard would skip takes its
// baseline arm's outcome).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { prepareArm } from '../../scripts/lib/agent-ab-arms.mjs';
import { wrappedPrompt } from '../../scripts/lib/agent-ab.mjs';
import { geometricChange } from '../../scripts/lib/agent-ab-stats.mjs';
import { loadManifest, readTasks, TASKS_REL } from '../../scripts/lib/xrepo.mjs';

const CODE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { focusQuery } = require(path.join(CODE, 'src', 'session', 'query-focus.js'));
const pf = require(path.join(CODE, 'src', 'session', 'prefetch.js'));

export const FAMILIES = {
  flatness: (r) => { const a = r.rows[0]?.score, b = r.rows[r.rows.length - 1]?.score; return a > 0 && r.rows.length > 1 ? 1 - b / a : 1; },
  topScore: (r) => r.rows[0]?.score ?? 0,
  margin: (r) => (r.rows.length > 1 && r.rows[1].score > 0 ? r.rows[0].score / r.rows[1].score : 9),
  readable: (r) => pf.readableShare(r.query),
};

function ask(cwd, q) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(CODE, 'gen-context.js'), 'ask', q.replace(/^[-\s]+/, '')], { cwd, env: { ...process.env, SIGMAP_NO_UPDATE_CHECK: '1', NO_COLOR: '1' } });
    let out = ''; p.stdout.on('data', (d) => { out += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), 60000);
    p.on('close', () => { clearTimeout(t); resolve(out); });
  });
}
const parse = (out) => out.split('\n').map((l) => /^\s*(\d+)\s+(\S+)\s+(-?[\d.]+)\s+(\d+)\s*tok\b/.exec(l)).filter(Boolean).map((m) => ({ file: m[2], score: +m[3] }));

async function build() {
  const roots = [[process.env.HELDOUT_ROOT, 'tune'], [process.env.HELDOUT2_ROOT, 'confirm']];
  if (roots.some(([r]) => !r || !fs.existsSync(path.join(r, TASKS_REL)))) { console.error('set HELDOUT_ROOT and HELDOUT2_ROOT to the held-out data roots (see run-hook-study.sh)'); process.exit(2); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-eval-'));
  const items = [];
  for (const [root, split] of roots) {
    const manifest = loadManifest(root); const tasks = readTasks(path.join(root, TASKS_REL));
    for (const repo of manifest.repos || manifest) {
      const mine = tasks.filter((t) => t.repo === repo.name);
      if (!mine.length || repo.name === 'emilk__egui_plot') continue;
      const arm = prepareArm({ root, repo, arm: 'with', tmpRoot: tmp, codeRoot: CODE, variant: 'prefetch-hook', sessionAuth: true });
      for (const t of mine) items.push({ split, repo: repo.name, cwd: arm.cwd, id: t.id, query: focusQuery(wrappedPrompt({ id: t.id, repo: repo.name, query: t.query }, 'q00000000')).query, expected: t.expected_files.map((f) => f.replace(/^\.\//, '')) });
    }
  }
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (i < items.length) { const it = items[i++]; it.rows = parse(await ask(it.cwd, it.query)); it.right = it.rows.some((x) => it.expected.includes(x.file)); } }));
  fs.rmSync(tmp, { recursive: true, force: true });
  return items;
}

function auc(rows, f) {
  const pos = rows.filter((r) => r.right).map(f), neg = rows.filter((r) => !r.right).map(f);
  let s = 0; for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}

function loro(rows, names, need = 1 / 3) {
  const val = {}; for (const n of names) val[n] = rows.map((r) => FAMILIES[n](r));
  const repos = [...new Set(rows.map((r) => r.repo))];
  const thin = (c) => (c.length <= 40 ? c : c.filter((_, k) => k % Math.ceil(c.length / 40) === 0));
  const skipped = new Array(rows.length).fill(false);
  for (const repo of repos) {
    const train = rows.map((r, i) => (r.repo !== repo ? i : -1)).filter((i) => i >= 0), test = rows.map((r, i) => (r.repo === repo ? i : -1)).filter((i) => i >= 0);
    const miss = train.filter((i) => !rows[i].right), hit = train.filter((i) => rows[i].right);
    const grids = names.map((n) => thin([...new Set(train.map((i) => val[n][i]))].sort((a, b) => a - b).concat([-Infinity])));
    let best = null;
    const walk = (k, cur) => {
      if (k === names.length) {
        const sk = (i) => names.some((n, j) => val[n][i] < cur[j]);
        const ms = miss.filter(sk).length / miss.length, hs = hit.filter(sk).length / hit.length;
        if (ms >= need && (!best || hs < best.hs - 1e-9)) best = { cur: [...cur], hs };
        return;
      }
      for (const T of grids[k]) { cur[k] = T; walk(k + 1, cur); }
    };
    walk(0, []);
    if (best) for (const i of test) skipped[i] = names.some((n, j) => val[n][i] < best.cur[j]);
  }
  const miss = rows.filter((r) => !r.right), hit = rows.filter((r) => r.right);
  const ms = miss.filter((_, k) => skipped[rows.indexOf(miss[k])]).length / miss.length;
  const hs = hit.filter((_, k) => skipped[rows.indexOf(hit[k])]).length / hit.length;
  return { ms, hs, overall: skipped.filter(Boolean).length / rows.length };
}

function counterfactual(rows, rule) {
  const EIGHT = new Set(['ionos-cloud__cluster-api-provider-proxmox', 'flamingock__flamingock-java', 'conda__constructor', 'GDQuest__GDScript-formatter', 'intaro__pinboard', 'statelyai__agent', 'chatmail__relay', 'stefankoegl__python-json-patch']);
  const runs = fs.readFileSync(path.join(CODE, 'benchmarks', 'agent-study', 'data', 'runs.ndjson'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => r.set === 'heldout-w' && r.variant === 'prefetch-hook');
  const skip = new Map(rows.map((r) => [`${r.repo}/${r.id}`, rule(r)]));
  const pct = (x) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)}%`;
  for (const [label, subset] of [['all twenty repositories', () => true], ['the twelve outside the eight', (r) => !EIGHT.has(r)], ['the eight', (r) => EIGHT.has(r)]]) {
    const m = new Map();
    for (const r of runs) { if (!subset(r.repo)) continue; const k = `${r.repo}/${r.task}|${r.run}`; (m.get(k) || m.set(k, {}).get(k))[r.arm] = r; }
    const pairs = [...m.entries()].filter(([, p]) => p.with && p.without);
    const sk = (k) => skip.get(k.split('|')[0]) === true;
    const mk = (g) => pairs.map(([k, p]) => ({ without: p.without.usd, with: g && sk(k) ? p.without.usd : p.with.usd }));
    const found = (g) => pairs.filter(([k, p]) => ((g && sk(k)) ? p.without : p.with).pass).length, base = pairs.filter(([, p]) => p.without.pass).length, n = pairs.length;
    const u = geometricChange(mk(false)), g = geometricChange(mk(true));
    console.log(`  ${label.padEnd(30)} ${String(n).padStart(3)} pairs, ${(100 * pairs.filter(([k]) => sk(k)).length / n).toFixed(0)}% skipped | cost ${pct(u.change)} -> ${pct(g.change)} [${pct(g.lo)}, ${pct(g.hi)}], ${(100 * g.change / u.change).toFixed(0)}% of the saving kept | file found vs baseline ${((100 * (found(false) - base)) / n).toFixed(1)} -> ${((100 * (found(true) - base)) / n).toFixed(1)} points`);
  }
}

async function main() {
  const rows = await build();
  console.log(`${rows.length} questions, ${rows.filter((r) => r.right).length} with the expected file among the files shown, ${rows.filter((r) => !r.right).length} without\n`);
  console.log('1. AUC of each family for "the ranking is right" (0.5 is chance)');
  for (const [n, f] of Object.entries(FAMILIES)) console.log(`  ${n.padEnd(10)} ${auc(rows, f).toFixed(2)}`);
  console.log('\n2. leave-one-repository-out, thresholds chosen to skip at least a third of the wrong rankings');
  const names = Object.keys(FAMILIES);
  const show = (label, r) => console.log(`  ${label.padEnd(26)} skips ${(100 * r.ms).toFixed(0)}% of wrong, ${(100 * r.hs).toFixed(0)}% of right; separation ${(r.ms - r.hs).toFixed(2)}; ${(100 * r.overall).toFixed(0)}% of questions skipped`);
  for (const n of names) show(n, loro(rows, [n]));
  for (let x = 0; x < names.length; x++) for (let y = x + 1; y < names.length; y++) show(`${names[x]} OR ${names[y]}`, loro(rows, [names[x], names[y]]));
  const shipped = (r) => FAMILIES.readable(r) < pf.READABLE_MIN;
  const miss = rows.filter((r) => !r.right), hit = rows.filter((r) => r.right);
  console.log(`\n3. the rule that ships: readable < ${pf.READABLE_MIN}: skips ${miss.filter(shipped).length}/${miss.length} wrong rankings and ${hit.filter(shipped).length}/${hit.length} right ones (${rows.filter(shipped).length} of ${rows.length} questions)`);
  console.log('   counterfactual on the agent runs of Stages D and E (a skipped pair takes its baseline arm\'s outcome):');
  counterfactual(rows, shipped);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
