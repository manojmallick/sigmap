#!/bin/bash
# Run the pilot questions the relay's allowance did not cover, one question per invocation, each saved as it finishes.
# Resumable: a question whose raw.json already exists is skipped, and it stops at the first failed invocation (an exhausted
# balance, a bad key), so rerunning it after a top-up carries on where it stopped. A run that aborts records nothing, which is
# why this is one question at a time.
#
#   ANTHROPIC_API_KEY=<key> OUT=./ab-runs bash benchmarks/pilots/2026-11-09-relay-haiku-5-5/run-remaining.sh
#   DRY=1 bash benchmarks/pilots/2026-11-09-relay-haiku-5-5/run-remaining.sh      # print every plan, start nothing
#
# Variables (all optional):
#   VARIANTS  which SigMap arms to run, in order            (default: "index lean")
#   MODEL     the model both arms use                       (default: claude-haiku-5.5, what the pilot used)
#   RUNS      repetitions per arm per question               (default: 2)
#   OUT       where each question's report and raw data go  (default: ./ab-runs)
#   BUDGET    per-run spend cap in USD, the agent's own      (default: 0.3)
#   FORCE=1   ignore the questions already done in this directory
#   ORDER     "repo:id ..." to run instead of the fixed list     CLAUDE_BIN  the claude executable (tests use a fake one)
#   SESSION_AUTH=1  run on the logged-in session, no API key (counts against that account's plan); the relay runs' DONE lists are then ignored
#
# Through a relay that rejects Claude Code's empty system message, start scripts/agent-ab-compat-shim.mjs first and point
# ANTHROPIC_BASE_URL at it. Against api.anthropic.com no shim is needed. Linux needs bubblewrap (apt-get install bubblewrap).
set -u
cd "$(dirname "$0")/../../.." || exit 1
VARIANTS=${VARIANTS:-"index lean"}; MODEL=${MODEL:-claude-haiku-5.5}; RUNS=${RUNS:-2}; OUT=${OUT:-./ab-runs}; BUDGET=${BUDGET:-0.3}

# The order was fixed before any result was seen: the baseline's own mean tokens in the 40-run pilot, cheapest first. That favours
# easy questions, where SigMap has least to save; read results with that in mind. gin:x001 leads so every variant has it.
ORDER=${ORDER:-"gin:x001 gin:x002 express:x038 express:x037 flask:x033 fastapi:x145 fastify:x137 fastapi:x146 fastify:x138 flask:x032"}
# Already measured and saved in this directory's siblings (index-gin-4runs/, index-5questions/, lean-gin-4runs/).
DONE_index="gin:x001 gin:x002 express:x038 express:x037 flask:x033 fastapi:x145"
DONE_lean="gin:x001"

for variant in $VARIANTS; do
  case "$variant" in current|lean|index|skill|skill-always|skill-shipped|prefetch) ;; *) echo "unknown variant: $variant" >&2; exit 2 ;; esac
  done_var="DONE_$variant"
  for spec in $ORDER; do
    repo=${spec%%:*}; id=${spec##*:}; out="$OUT/$variant/$repo-$id"
    if [ "${FORCE:-0}" != "1" ] && [ "${SESSION_AUTH:-0}" != "1" ] && [[ " ${!done_var:-} " == *" $spec "* ]]; then echo "skip   $variant $spec (already in this directory's saved data)"; continue; fi
    if [ "${FORCE:-0}" != "1" ] && [ -f "$out/raw.json" ]; then echo "skip   $variant $spec (done: $out)"; continue; fi
    echo "run    $variant $spec -> $out"
    args=(scripts/run-agent-ab.mjs --repos "$repo" --task-ids "$id" --runs "$RUNS" --sigmap-variant "$variant" --model "$MODEL"
          --max-budget-usd "$BUDGET" --timeout-ms 420000 --max-consecutive-failures 2 --save --allow-unpublishable
          --out-dir "$out" --raw-out "$out/raw.json")
    [ -n "${CLAUDE_BIN:-}" ] && args+=(--claude "$CLAUDE_BIN")
    [ "${SESSION_AUTH:-0}" = "1" ] && args+=(--session-auth)
    if [ "${DRY:-0}" = "1" ]; then node "${args[@]}" --dry-run 2>&1 | sed -n '/tasks /p;/runs /p'; continue; fi
    mkdir -p "$out"
    if ! node "${args[@]}" > "$out/stdout.md" 2> "$out/stderr.log"; then
      rm -f "$out/raw.json"
      echo "STOPPED at $variant $spec: $(grep -E 'stopped after|FAIL' "$out/stderr.log" | tail -1 | cut -c1-160)" >&2
      echo "Rerun the same command to resume." >&2
      exit 1
    fi
  done
done
echo "all requested questions are done in $OUT"
