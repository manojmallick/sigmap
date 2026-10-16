# ENTERPRISE_SETUP.md — Enterprise & Team Setup Guide

> This guide covers GitHub Enterprise API integration for tracking Copilot acceptance rates,
> CI pipeline setup with structured JSON reporting, usage log analysis for teams, and
> self-hosted runner configuration.

---

## Overview

SigMap ships three observability features from v0.9:

| Feature | Command | Output |
|---|---|---|
| JSON token report | `--report --json` | Structured JSON, exits 1 if over budget |
| Usage log | `--track` or `config.tracking: true` | `.context/usage.ndjson` |
| Usage history | `--report --history` | Aggregate stats from usage log |

---

## 1 — CI token reporting (`--report --json`)

### What it outputs

Real output from SigMap's own repo (v8.77.1); `cacheFit.models` lists one entry per model in the roster and one is shown; the command prints the object on one line and it is pretty-printed here:

```json
{
  "version": "8.77.1",
  "timestamp": "2026-10-15T00:23:24.226Z",
  "rawTokens": 868873,
  "inputTokens": 868873,
  "finalTokens": 13543,
  "fileCount": 206,
  "droppedCount": 130,
  "reductionPct": 98.4,
  "overBudget": false,
  "budgetLimit": 16000,
  "autoBudget": false,
  "cacheFit": {
    "layout": "stable-prefix",
    "ttl": "5m",
    "asOf": "2026-10-04",
    "models": [
      {
        "model": "claude-fable-5-1",
        "cacheMin": 512,
        "tokens": 13271,
        "estimated": true,
        "verdict": "fits",
        "note": "above the 512-token minimum"
      }
    ]
  },
  "coverage": {
    "score": 36,
    "grade": "D",
    "confidence": "LOW",
    "totalFiles": 203,
    "includedFiles": 73,
    "droppedFiles": 130,
    "perModule": {
      "src": {
        "total": 191,
        "included": 61,
        "pct": 32
      },
      "packages": {
        "total": 12,
        "included": 12,
        "pct": 100
      }
    }
  }
}
```

### Exit codes

| Condition | Exit code |
|---|---|
| Output within budget | `0` |
| `finalTokens` exceeds `budgetLimit` (`overBudget: true`) | `1` |

This lets CI pipelines fail automatically if context bloat is detected.

### GitHub Actions integration

```yaml
# .github/workflows/context.yml
name: Context freshness

on: [push, pull_request]

jobs:
  context:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Generate context
        run: node gen-context.js --format cache

      - name: Token report (JSON, fail if over budget)
        id: report
        run: |
          REPORT=$(node gen-context.js --report --json)
          echo "report=$REPORT" >> "$GITHUB_OUTPUT"
          # Exit 1 if overBudget=true (gen-context.js sets exit code automatically)

      - name: Upload context artifact
        uses: actions/upload-artifact@v4
        with:
          name: sigmap-output
          path: |
            .github/copilot-instructions.md
            .github/copilot-instructions.cache.json
```

### Parsing the JSON report in CI

```bash
# In a shell step — check reduction and fail if below threshold
REPORT=$(node gen-context.js --report --json)
REDUCTION=$(echo "$REPORT" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).reductionPct))")

if (( $(echo "$REDUCTION < 60" | bc -l) )); then
  echo "Context reduction below 60% — context may need cleanup"
  exit 1
fi
```

---

## 2 — Usage log (`--track`)

### Enable tracking

**CLI flag (one-time):**
```bash
node gen-context.js --track
```

**Config (permanent):**
```json
{
  "tracking": true
}
```

Once enabled, every `node gen-context.js` run appends one JSON line to `.context/usage.ndjson`.

### Log format (NDJSON)

Each line is one record (two consecutive runs on SigMap's own repo, v8.77.1):
```json
{"ts":"2026-10-15T00:22:13.021Z","version":"8.77.1","fileCount":206,"droppedCount":130,"rawTokens":868873,"finalTokens":13543,"reductionPct":98.4,"overBudget":false,"budgetLimit":16000}
{"ts":"2026-10-15T00:22:15.424Z","version":"8.77.1","fileCount":206,"droppedCount":130,"rawTokens":868873,"finalTokens":13543,"reductionPct":98.4,"overBudget":false,"budgetLimit":16000}
```

Because it's NDJSON (one JSON object per line), it's easy to process with standard tools:

```bash
# Count total runs
wc -l .context/usage.ndjson

# Average final token count
node -e "
  const lines = require('fs').readFileSync('.context/usage.ndjson','utf8').trim().split('\n');
  const entries = lines.map(l => JSON.parse(l));
  const avg = entries.reduce((s,e) => s + e.finalTokens, 0) / entries.length;
  console.log('avg final tokens:', Math.round(avg));
"

# Find any over-budget runs
grep '"overBudget":true' .context/usage.ndjson
```

### View summary

```bash
node gen-context.js --report --history
# [sigmap] usage history:
#   total runs      : 2
#   avg reduction   : 98.4%
#   avg tokens out  : ~13543
#   over-budget runs: 0
#   first run       : 2026-10-15T00:22:13.021Z
#   last run        : 2026-10-15T00:22:15.424Z

# JSON output for dashboards:
node gen-context.js --report --history --json
```

### Commit the log or keep it local

`.context/` ignores itself: the first time SigMap uses the directory it writes `.context/.gitignore` holding `*`, so the usage log stays local by default and nothing needs adding to your own `.gitignore`.

To share history across the team, edit `.context/.gitignore` — SigMap never overwrites an existing one — so that it re-includes the log:

```gitignore
# .context/.gitignore
*
!.gitignore
!usage.ndjson
```

then `git add .context`. The derived index and caches stay ignored. `sigmap doctor` lists tracked files under `.context/` as a warning; it cannot tell that you meant to.

If your own root `.gitignore` excludes `.context/` as a whole, this will not work: git cannot re-include a file under an excluded directory, and `git add` refuses it. Remove that root rule and let `.context/.gitignore` do the ignoring.

---

## 3 — GitHub Enterprise acceptance rate tracking

GitHub Enterprise provides Copilot suggestion acceptance rates via the REST API.
Use this to measure whether SigMap is actually improving suggestions.

### Get acceptance rate via API

```bash
# Requires: GitHub Enterprise Cloud, Copilot Business/Enterprise license
# Token scope: manage_billing:copilot or read:enterprise

curl -s \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/enterprises/{enterprise}/copilot/usage" \
  | node -e "
    process.stdin.resume();
    let d = '';
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      const data = JSON.parse(d);
      // Sum suggestions and acceptances across all days
      let totalSuggestions = 0, totalAcceptances = 0;
      for (const day of data) {
        totalSuggestions  += day.total_suggestions_count || 0;
        totalAcceptances  += day.total_acceptances_count || 0;
      }
      const rate = totalSuggestions > 0
        ? ((totalAcceptances / totalSuggestions) * 100).toFixed(1)
        : 0;
      console.log(JSON.stringify({ totalSuggestions, totalAcceptances, acceptanceRate: rate + '%' }));
    });
  "
```

### Acceptance rate targets

| Scenario | Expected rate |
|---|---|
| Without SigMap | ~26% |
| With SigMap (fresh context) | ≥32% |
| With SigMap + stale context (>1 week) | ~28% |

If the rate drops below 30%, run `node gen-context.js` to regenerate context.

### CI acceptance gate

Add a weekly job to check acceptance rate and fail if below threshold:

```yaml
# .github/workflows/copilot-acceptance.yml
name: Copilot acceptance rate check

on:
  schedule:
    - cron: '0 9 * * 1'  # every Monday at 9am

jobs:
  check-acceptance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check Copilot acceptance rate
        env:
          GITHUB_TOKEN: ${{ secrets.COPILOT_METRICS_TOKEN }}
          ENTERPRISE: ${{ vars.GITHUB_ENTERPRISE_SLUG }}
        run: |
          node -e "
            const https = require('https');
            const options = {
              hostname: 'api.github.com',
              path: '/enterprises/${{ vars.GITHUB_ENTERPRISE_SLUG }}/copilot/usage',
              headers: {
                'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'sigmap-ci'
              }
            };
            https.get(options, (res) => {
              let data = '';
              res.on('data', c => data += c);
              res.on('end', () => {
                const days = JSON.parse(data);
                const total = days.reduce((s,d) => ({ 
                  s: s.s + (d.total_suggestions_count||0),
                  a: s.a + (d.total_acceptances_count||0)
                }), { s: 0, a: 0 });
                const rate = total.s > 0 ? (total.a / total.s) * 100 : 0;
                console.log('Acceptance rate:', rate.toFixed(1) + '%');
                if (rate < 30) {
                  console.error('Below 30% threshold — regenerate context');
                  process.exit(1);
                }
              });
            });
          "

      - name: Regenerate context if needed
        if: failure()
        run: node gen-context.js
```

---

## 4 — Self-hosted runner configuration

For air-gapped or on-premise environments:

```bash
# Install on self-hosted runner (no npm needed)
git clone https://github.com/your-org/sigmap /opt/sigmap
# Or copy just gen-context.js to the project

# Add to runner environment
echo 'alias gen-context="node /opt/sigmap/gen-context.js"' >> ~/.bashrc

# Pre-commit hook (global git config)
git config --global core.hooksPath /opt/git-hooks
cat > /opt/git-hooks/post-commit << 'EOF'
#!/bin/sh
node "$(git rev-parse --show-toplevel)/gen-context.js" --generate 2>/dev/null || true
EOF
chmod +x /opt/git-hooks/post-commit
```

---

## 5 — Team dashboard (Prometheus + Grafana)

The `--report --json` output can be scraped into any time-series database.

### Push metrics to Prometheus Pushgateway

```bash
# In your CI step (after generating context)
REPORT=$(node gen-context.js --report --json)

FINAL_TOKENS=$(echo "$REPORT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).finalTokens))")
REDUCTION=$(echo "$REPORT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).reductionPct))")

cat <<PROM | curl --data-binary @- http://pushgateway:9091/metrics/job/sigmap
# TYPE context_forge_final_tokens gauge
context_forge_final_tokens{repo="${GITHUB_REPOSITORY}"} ${FINAL_TOKENS}
# TYPE context_forge_reduction_pct gauge
context_forge_reduction_pct{repo="${GITHUB_REPOSITORY}"} ${REDUCTION}
PROM
```

---

## 6 — Health score & self-healing CI (v1.0)

### Check installation health

```bash
node gen-context.js --health
# score           : 95/100 (grade A)
# token reduction : 91.2%
# days since regen: 1
# total runs      : 47
# over-budget runs: 0

# Machine-readable for CI:
node gen-context.js --health --json
# {"score":95,"grade":"A","tokenReductionPct":91.2,"daysSinceRegen":1,"totalRuns":47,"overBudgetRuns":0}
```

Add a health gate to CI to catch degradation early:

```yaml
- name: SigMap health check
  run: |
    HEALTH=$(node gen-context.js --health --json)
    SCORE=$(echo "$HEALTH" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).score))")
    echo "Health score: $SCORE/100"
    if [ "$SCORE" -lt 60 ]; then
      echo "Health score below 60 — context may need attention"
      exit 1
    fi
```

### Self-healing CI

Copy `examples/self-healing-github-action.yml` to `.github/workflows/` to automatically open a PR when:
- Copilot acceptance rate drops below 30% (requires `COPILOT_API_TOKEN` secret)
- Context file is older than 7 days (always active, no API needed)

See [examples/self-healing-github-action.yml](../examples/self-healing-github-action.yml) for the full workflow.

---

## Related docs

- [docs/REPOMIX_CACHE.md](REPOMIX_CACHE.md) — prompt cache cost reduction
- [docs/MODEL_ROUTING.md](MODEL_ROUTING.md) — model tier routing + `--suggest-tool`
- [docs/MCP_SETUP.md](MCP_SETUP.md) — MCP server configuration
- [docs/CI_GUIDE.md](CI_GUIDE.md) — CI integration and monorepo setup
- [docs/SESSION_DISCIPLINE.md](SESSION_DISCIPLINE.md) — session workflow

> *SigMap for daily always-on context; Repomix for deep one-off sessions — use both.*
