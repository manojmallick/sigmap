#!/usr/bin/env node
// Turn the harness's per-batch records into rows of the study's table (data/runs.ndjson), so summarize.mjs can read your own runs.
//
//   node benchmarks/agent-study/to-runs.mjs token-saving-runs --route api --model claude-haiku-5-5 > mine.ndjson
//   node benchmarks/agent-study/to-runs.mjs raw/change/claude-haiku-5-5/index --variant index --model claude-haiku-5-5 > change.ndjson
//   node benchmarks/agent-study/summarize.mjs --runs mine.ndjson
//
// Two layouts are read. A folder of <set>/<variant>/<batch>/raw.json is what run-token-saving.sh writes (set = unfamiliar | famous); each
// variant becomes one series. With --variant, the folder is a flat one of <task>.json files, what run-change.sh writes (set = change); a
// row then also carries the size of the patch (files, added, removed) and why a run failed its tests. A run a turn cap, a budget cap or a
// timeout stopped is a scored miss (or, for a change run, graded on what it had left), never a dropped pair.
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const dir = argv[0];
const val = (name, d) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const route = val('--route', 'api'); const model = val('--model', 'unknown-model'); const flat = val('--variant', null);
if (!dir || !fs.existsSync(dir)) { console.error('usage: to-runs.mjs <dir> [--route api|claude-code] [--model <id>] [--variant <v>  (a flat folder of change runs)]'); process.exit(2); }

function row(x, set, variant) {
  const t = x.toolCalls || { total: 0, byTool: {}, byCommand: {} };
  const cap = !x.ok && typeof x.error === 'string' && /^turn limit/.test(x.error);
  return {
    series: `${route}-${model}-${set}-${variant}`, route, model, set, variant, repo: x.repo, task: x.task, arm: x.arm, run: x.run,
    ok: cap ? true : !!x.ok, pass: cap ? false : !!x.pass, turns: x.turns ?? null, calls: t.total ?? null,
    mcp: Object.entries(t.byTool || {}).filter(([k]) => /^mcp__sigmap__/.test(k)).reduce((s, [, n]) => s + n, 0),
    cli: (t.byCommand && t.byCommand.sigmap) || 0, skill: (t.byTool && t.byTool.Skill) || 0,
    in: x.usage ? x.usage.in : null, out: x.usage ? x.usage.out : null, cacheRead: x.usage ? x.usage.cacheRead : null, cacheWrite: x.usage ? x.usage.cacheWrite : null,
    usd: x.cost ? x.cost.usd : null, ms: x.durationMs ?? null, limit: cap ? x.error : (x.limit || null),
    ...(Array.isArray(x.hooks) ? { hookBytes: (x.hooks.find((h) => h && h.event === 'UserPromptSubmit') || {}).bytes || 0 } : {}),
    ...(x.patch ? { files: x.patch.files, added: x.patch.added, removed: x.patch.removed, why: x.why || null } : {}),
  };
}
const emit = (r) => process.stdout.write(`${JSON.stringify(r)}\n`);

if (flat) {
  for (const f of fs.readdirSync(dir).filter((n) => /\.json$/.test(n)).sort()) for (const x of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) emit(row(x, 'change', flat));
} else {
  for (const set of fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory() && d !== 'unfamiliar-root')) {
    const setDir = path.join(dir, set);
    for (const variant of fs.readdirSync(setDir).filter((d) => fs.statSync(path.join(setDir, d)).isDirectory())) {
      const vDir = path.join(setDir, variant);
      for (const batch of fs.readdirSync(vDir)) {
        const f = path.join(vDir, batch, 'raw.json');
        if (fs.existsSync(f)) for (const x of JSON.parse(fs.readFileSync(f, 'utf8'))) emit(row(x, set, variant));
      }
    }
  }
}
