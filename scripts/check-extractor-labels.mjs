#!/usr/bin/env node
// Score the real extractors against their hand-written labels (test/labels/<language>.json). See scripts/lib/extractor-labels.mjs.
//
//   node scripts/check-extractor-labels.mjs            # every label file
//   node scripts/check-extractor-labels.mjs go zig     # these languages only
//
// Exit 1 if any extractor falls below the gate or a label is unsound; exit 2 if a named language has no label file.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { scoreLabels } from './lib/extractor-labels.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { extractFile } = require(path.join(ROOT, 'src/extractors/dispatch.js'));
const dir = path.join(ROOT, 'test', 'labels');
const all = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort() : [];
const want = process.argv.slice(2);
const langs = want.length ? want : all;
let failed = 0;
for (const lang of langs) {
  const file = path.join(dir, `${lang}.json`);
  if (!fs.existsSync(file)) { console.error(`no label file for "${lang}": write test/labels/${lang}.json by hand (see CONTRIBUTING.md)`); process.exit(2); }
  const label = JSON.parse(fs.readFileSync(file, 'utf8'));
  const src = fs.readFileSync(path.join(ROOT, label.fixture), 'utf8');
  const r = scoreLabels((source, f) => extractFile(f, source), label, src);
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${lang.padEnd(12)} recall ${(r.recall * 100).toFixed(0)}% of ${new Set(label.defines).size} labelled names; probes ${r.probes.filter((p) => p.ok).length}/${r.probes.length}`);
  if (r.missing.length) console.log(`       not listed: ${r.missing.join(', ')}`);
  for (const p of r.probes.filter((x) => !x.ok)) console.log(`       ${p.name}: ${p.leaked.length ? `listed a decoy (${p.leaked.join(', ')})` : ''}${p.absent.length ? ` did not list ${p.absent.join(', ')}` : ''}`);
  for (const p of r.problems) console.log(`       label: ${p}`);
}
process.exit(failed ? 1 : 0);
