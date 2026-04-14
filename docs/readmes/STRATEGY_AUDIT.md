# SigMap Strategy Audit Runner

The strategy audit runner is a reusable benchmark helper for any repository. It runs all three SigMap strategies, stores every report side by side, identifies missed folders, and proposes a stronger config for future runs.

## What it produces

For a target repository, the runner writes:

- `summary.md` — human-readable strategy comparison and recommendations
- `summary.json` — machine-readable report for automation or CI
- `suggested-config.json` — recommended `gen-context.config.json` starting point
- `strategies/full/*` — `full` strategy outputs, report, and analyzer data
- `strategies/per-module/*` — `per-module` strategy outputs, report, and analyzer data
- `strategies/hot-cold/*` — `hot-cold` strategy outputs, report, and analyzer data

It also preserves the target repo's original generated context files unless you pass `--keep-generated`.

## Usage

Run from the SigMap repo:

```bash
node scripts/run-strategy-audit.mjs --repo /path/to/repo
```

Choose a custom output directory:

```bash
node scripts/run-strategy-audit.mjs \
  --repo /path/to/repo \
  --out /tmp/sigmap-audit
```

Keep the final generated SigMap files in the target repo instead of restoring the previous state:

```bash
node scripts/run-strategy-audit.mjs \
  --repo /path/to/repo \
  --keep-generated
```

Or use the package script:

```bash
npm run audit:strategies -- --repo /path/to/repo
```

## How the recommendations work

### Strategy recommendation

The runner compares:

- `full` final token count
- `per-module` always-on overview tokens and total module tokens
- `hot-cold` hot token count and cold file count

Recommendation rules are intentionally simple:

1. Prefer `hot-cold` only when the hot set is much smaller than the full output and there is a meaningful cold set.
2. Otherwise prefer `per-module` when it materially reduces always-injected context and the repo has multiple meaningful modules.
3. Fall back to `full` when the repo is small or the splits are not helpful.

### Missed folder detection

The runner discovers repository files directly and compares them against `sigmap --analyze --json`.

It reports three kinds of gaps:

1. Supported files missing from analysis
   These are files with a supported SigMap extractor that were not analyzed at all. This usually means the current `srcDirs` configuration is too narrow.

2. High-value unsupported files
   These are folders dominated by files like `.properties`, `.sql`, `.md`, `.xml`, or build files. SigMap currently treats these as important but not extractor-covered, so the script suggests manual index sections or future extractor improvements rather than just adding `srcDirs`.

3. Weak extractor folders
   These are folders where SigMap did analyze files but many produced `0` signatures or `0` tokens. This usually means the extractor is structurally weak for the file shape in that folder.

## Why this helps benchmarks

Before running token or retrieval benchmarks on a repo, use the strategy audit runner to:

1. Identify whether `per-module` or `hot-cold` is actually useful for that repo.
2. Find folders currently missing from `srcDirs`.
3. Detect high-value files that need manual indexing or new extractors.
4. Save a `suggested-config.json` you can reuse for repeated benchmark runs.

That means fewer failed benchmark passes caused by bad folder selection and less manual trial-and-error when onboarding a new repo.

## Recommended workflow for any new repo

```bash
# 1) Audit the repo once
node scripts/run-strategy-audit.mjs --repo /path/to/repo

# 2) Review the generated suggestion
cat /path/to/repo/.context/strategy-audit/summary.md

# 3) Apply the suggested config manually if it looks right
cat /path/to/repo/.context/strategy-audit/suggested-config.json

# 4) Re-run normal SigMap or benchmarks using the improved config
node gen-context.js --report --json
```

## Output layout

```text
.context/strategy-audit/
  summary.md
  summary.json
  suggested-config.json
  strategies/
    full/
      report.json
      analyze.json
      stdout.log
      outputs/
    per-module/
      report.json
      analyze.json
      stdout.log
      outputs/
    hot-cold/
      report.json
      analyze.json
      stdout.log
      outputs/
```