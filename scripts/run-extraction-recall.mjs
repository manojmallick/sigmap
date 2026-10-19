#!/usr/bin/env node
/**
 * Extraction recall: of the symbols a language's own parser says a file defines, how many
 * does SigMap list, by name, in that file? (#983)
 *
 *   node scripts/run-extraction-recall.mjs                        # report every language
 *   node scripts/run-extraction-recall.mjs --gate                 # exit 1 below a recorded floor
 *   node scripts/run-extraction-recall.mjs --gate --require-reference   # also exit 1 if a language with floors cannot be measured (CI)
 *   node scripts/run-extraction-recall.mjs --save                 # write benchmarks/reports/extraction-recall.json
 *   node scripts/run-extraction-recall.mjs --save --out <file>   # write it elsewhere (the tests do)
 *   node scripts/run-extraction-recall.mjs --only python --misses 10
 *   node scripts/run-extraction-recall.mjs --json | --no-index | --repos <dir> | --floors <file>
 *
 * WHY: every other gate scores ranking, which hides what the extractor never emitted. A file
 * the extractor misses is a file the ranker cannot find, whatever the ranker does. This
 * measures the extractor against the language's own parser (CPython's ast, Ruby's Ripper),
 * on pinned third-party clones, in two populations: the extractor's raw output, and the
 * index as shipped (what a first-time `sigmap` run keeps, after the per-file cap).
 *
 * HOW A FLOOR IS ENFORCED: a floor is a promise about ONE reference parser. A different
 * version parses a different set of files, so benchmarks/extraction-recall-floors.json
 * records floors per version prefix and a run is only compared with the floors recorded
 * for ITS version; otherwise its numbers are printed with "floors not enforced". A language
 * with no reference parser here (no interpreter, no clones, no adapter yet) is listed as
 * "unmeasured", never omitted, and exits 0 unless --require-reference is given.
 *
 * Dev-only. Nothing here ships in the npm package and nothing at runtime depends on a
 * reference parser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { evaluate, formatLanguage, SCHEMA } from './lib/extraction-recall.mjs';
import { stamp } from './lib/report-stamp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
export const FLOORS_REL = 'benchmarks/extraction-recall-floors.json';
export const REPORT_REL = 'benchmarks/reports/extraction-recall.json';

/** The languages that have a reference-parser adapter, in report order. */
export const ADAPTERS = ['python', 'ruby'];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};

/** Every language SigMap extracts, from the dispatcher: the list the report must account for. */
function allLanguages() {
  const { LANGUAGES } = require(path.join(ROOT, 'src/extractors/dispatch'));
  return LANGUAGES;
}

function loadFloors() {
  return JSON.parse(fs.readFileSync(opt('--floors') ? path.resolve(opt('--floors')) : path.join(ROOT, FLOORS_REL), 'utf8'));
}

async function main() {
  const only = opt('--only') ? new Set(opt('--only').split(',')) : null;
  const floors = loadFloors();
  const reposDir = opt('--repos');
  const results = {};
  for (const name of ADAPTERS) {
    if (only && !only.has(name)) continue;
    const adapter = await import(`./extraction-recall/${name}.mjs`);
    results[name] = adapter.measure({ reposDir, index: !flag('--no-index') });
  }
  const verdicts = Object.fromEntries(Object.entries(results).map(([n, r]) => [n, evaluate(r, floors.languages[n])]));
  const unmeasured = Object.fromEntries(
    allLanguages().filter((l) => !ADAPTERS.includes(l)).map((l) => [l, 'no reference-parser adapter yet']),
  );

  if (flag('--json')) {
    console.log(JSON.stringify({ schema: SCHEMA, languages: results, verdicts, unmeasured }));
  } else {
    const misses = flag('--misses') ? Number(opt('--misses')) || 5 : 0;
    for (const [name, r] of Object.entries(results)) {
      console.log(formatLanguage(name, r, verdicts[name], { misses }).join('\n'));
      console.log('');
    }
    const names = Object.keys(unmeasured);
    console.log(`unmeasured (${names.length}): ${names.join(', ')} — no reference-parser adapter yet`);
  }

  let code = 0;
  for (const [name, v] of Object.entries(verdicts)) {
    const hasFloors = !!floors.languages[name];
    if (v.status === 'fail' && flag('--gate')) {
      code = 1;
      console.error(`[extraction-recall] ${name}: below a floor — ${v.checks.filter((c) => c.status === 'fail').map((c) => `${c.population}/${c.kind} ${c.recall}% < ${c.floor}%`).join('; ')}`);
    }
    if (flag('--require-reference') && hasFloors && (v.status === 'unmeasured' || v.status === 'not-enforced')) {
      code = 1;
      console.error(`[extraction-recall] ${name}: ${v.status} — ${v.note}. --require-reference needs a reference parser the floors cover.`);
    }
  }

  if (flag('--save')) {
    const missing = Object.entries(results).filter(([, r]) => r.measured === false);
    if (only || missing.length) {
      console.error(`[extraction-recall] not saved: ${only ? 'a partial run (--only)' : `unmeasured ${missing.map(([n]) => n).join(', ')}`} would drop numbers from the report`);
      code = code || 1;
    } else {
      const report = stamp({ schema: SCHEMA, benchmark: 'extraction-recall', method: 'scripts/run-extraction-recall.mjs', languages: results, unmeasured }, ROOT);
      const out = opt('--out') ? path.resolve(opt('--out')) : path.join(ROOT, REPORT_REL);
      fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
      console.log(`[extraction-recall] saved ${path.relative(ROOT, out) || out}`);
    }
  }
  process.exitCode = code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
