#!/usr/bin/env node
// Choose repositories for the held-out question sets by a fixed rule, from GitHub's repository search.
//
//   node scripts/select-heldout-repos.mjs --languages python,typescript,go,rust,java --per-language 4 [--skip owner/name,...]
//
// The rule (the same for every language, applied in star order, nothing chosen by hand):
//   - not a fork, not archived, created before 2026, pushed since --pushed-since, 100 to 500 stars, 0.8 to 10 MB;
//   - the description does not say it is a list, a collection, a template, a tutorial or a set of examples;
//   - at least --min-prs pull requests merged since --since (so there are enough changes to ask about).
// It prints one `language:owner/name` per line, up to --per-language per language, for `build-heldout-set.mjs --repos`.
// `--skip` leaves out repositories already used. Needs the GitHub CLI (`gh`), authenticated; uses the search API only.
import { spawnSync } from 'child_process';

const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const LANGS = val('--languages', 'python,typescript,go,rust,java').split(',').map((s) => s.trim()).filter(Boolean);
const PER = Number(val('--per-language', '4'));
const SINCE = val('--since', '2026-07-01');
const PUSHED = val('--pushed-since', '2026-10-15');
const MIN_PRS = Number(val('--min-prs', '15'));
const SKIP = new Set((val('--skip', '') || '').split(',').filter(Boolean).map((s) => s.toLowerCase()));
const LIST_LIKE = /\b(awesome|curated|collection|resources?|templates?|boilerplate|starters?|tutorials?|cheat ?sheets?|examples?|samples?|list of|roadmap|dotfiles)\b/i;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function gh(args) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = spawnSync('gh', ['api', '-X', 'GET', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.status === 0) return JSON.parse(r.stdout);
    if (/rate limit|403|secondary/i.test(r.stderr || '')) { sleep(30000); continue; }
    throw new Error((r.stderr || '').trim().split('\n').pop());
  }
  throw new Error('gh api kept failing');
}

for (const lang of LANGS) {
  const q = `stars:100..500 pushed:>${PUSHED} created:<2026-01-01 archived:false fork:false size:800..10000 language:${lang}`;
  const items = gh(['search/repositories', '-f', `q=${q}`, '-f', 'sort=stars', '-f', 'per_page=40']).items;
  let kept = 0;
  for (const it of items) {
    if (kept >= PER) break;
    const slug = it.full_name;
    if (SKIP.has(slug.toLowerCase()) || LIST_LIKE.test(it.description || '')) continue;
    sleep(2300); // the search API allows 30 requests a minute
    const prs = gh(['search/issues', '-f', `q=repo:${slug} is:pr is:merged merged:>${SINCE}`]).total_count;
    process.stderr.write(`  ${lang.padEnd(10)} ${slug.padEnd(48)} ${String(it.stargazers_count).padStart(4)}★  merged PRs since ${SINCE}: ${prs}${prs >= MIN_PRS ? '' : '  (too few)'}\n`);
    if (prs >= MIN_PRS) { kept++; console.log(`${lang}:${slug}`); }
  }
}
