# Hallucination Guard (`verify-ai-output`)

`verify-ai-output` flags claims in an AI answer that don't match your real
repository — fabricated files, imports, symbols, test paths, and npm scripts.
It is **deterministic and fully offline**: no network, no second LLM. It reuses
SigMap's symbol index, file map, and import resolver, so every check is grounded
in your actual code.

```bash
sigmap verify-ai-output answer.md
```

Exit code is `1` when any issue is found, `0` when the answer is clean — drop it
straight into CI.

## What it detects

| Type | Meaning | Confidence |
|---|---|---|
| `fake-file` | A referenced path is not on disk | High |
| `fake-test-file` | A referenced **test** path is not on disk | High |
| `fake-import` | A relative import doesn't resolve, or a bare package isn't in `package.json` | High |
| `fake-symbol` | A called function/class isn't in the SigMap symbol index | Medium |
| `fake-npm-script` | `npm run X` where `X` isn't a `package.json` script | High |

Node/Python builtins, scoped packages, and language globals are allow-listed to
keep precision high. Python bare imports are intentionally **not** flagged
(stdlib is unbounded offline).

## Closest-match suggestions

When a flagged name is a near miss for something real, the report adds a
heuristic suggestion (labeled as such — it's a Levenshtein guess, not a fact):

```
  L12  [Fake symbol]  Symbol not found in repo index: loadConfg()
         ↳ Did you mean `loadConfig()` in src/config/loader.js:42?
  L14  [Fake npm script]  npm script not in package.json: buidl
         ↳ Did you mean `build`?
```

## Output modes

### Terminal (default)

Grouped counts plus one line per issue, with suggestions inline.

### JSON — for CI

```bash
sigmap verify-ai-output answer.md --json
```

```json
{
  "file": "answer.md",
  "issues": [
    {
      "type": "fake-symbol",
      "value": "loadConfg",
      "line": 12,
      "location": "L12",
      "message": "Symbol not found in repo index: loadConfg()",
      "confidence": "medium",
      "suggestion": "Did you mean `loadConfig()` in src/config/loader.js:42?"
    }
  ],
  "summary": {
    "total": 1,
    "byType": { "fake-file": 0, "fake-test-file": 0, "fake-import": 0, "fake-symbol": 1, "fake-npm-script": 0 },
    "clean": false,
    "symbolsIndexed": 1842,
    "withSuggestion": 1
  }
}
```

### HTML report

```bash
sigmap verify-ai-output answer.md --report report.html
```

Writes a standalone, self-contained HTML report (red/amber/green per issue,
suggestions inline). It has no external assets or scripts, so it's safe to
publish or paste as a screenshot into a PR. `--report` can be combined with
`--json` (the report is written, JSON goes to stdout).

## Use in CI

```yaml
- name: Verify AI answer against the repo
  run: |
    npx sigmap verify-ai-output answer.md --json > verify.json
    npx sigmap verify-ai-output answer.md --report verify-report.html
```

A non-zero exit fails the job when the answer contains fabricated references.

## Precision

Detector precision is validated by a proof harness
(`npm run benchmark:verify`) that scores each detector group against labeled
cases and enforces targets (file ≥ 95%, import ≥ 85%, symbol ≥ 75%, script ≥
95%). Point it at your own repos with a manifest:

```bash
node scripts/run-verify-benchmark.mjs --manifest cases.json
```

It emits a per-detector precision/recall CSV.
