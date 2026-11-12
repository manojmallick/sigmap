#!/bin/bash
# Run the study's questions one batch per invocation, each saved as it finishes.
# Resumable: a batch whose raw.json already exists is skipped, and it stops at the first failed invocation (an exhausted
# balance, a bad key), so rerunning it after a top-up carries on where it stopped. A run that aborts records nothing, which is
# why this is one batch at a time. `run-token-saving.sh` calls it for each batch of the plan.
#
#   ANTHROPIC_API_KEY=<key> OUT=./ab-runs bash benchmarks/agent-study/run-remaining.sh
#   DRY=1 bash benchmarks/agent-study/run-remaining.sh      # print every plan, start nothing
#
# Variables (all optional):
#   VARIANTS  which SigMap arms to run, in order            (default: "index lean")
#   MODEL     the model both arms use                       (default: claude-haiku-5.5)
#   RUNS      repetitions per arm per question               (default: 2)
#   OUT       where each batch's report and raw data go     (default: ./ab-runs)
#   BUDGET    per-run spend cap in USD, the agent's own      (default: 0.3)
#   FORCE=1   ignore the batches already done in this directory
#   ORDER     "repo:id[,id...] ..." to run instead of the fixed list     CLAUDE_BIN  the claude executable (tests use a fake one)
#   AGENT=api       talk to the Messages API directly with ANTHROPIC_API_KEY (scripts/lib/agent-ab-api.mjs), not through Claude Code
#   SESSION_AUTH=1  run on the logged-in Claude Code session, no API key (counts against that account's plan)
#   PROMPT_STYLE=question  the bare question as the prompt, answer format in the system prompt, every run a first ask (Claude Code only)
#
# Linux needs bubblewrap for Claude Code's --bare (apt-get install bubblewrap); the API agent does not.
set -u
cd "$(dirname "$0")/../.." || exit 1
VARIANTS=${VARIANTS:-"index lean"}; MODEL=${MODEL:-claude-haiku-5.5}; RUNS=${RUNS:-2}; OUT=${OUT:-./ab-runs}; BUDGET=${BUDGET:-0.3}

# The default order was fixed before any result was seen, cheapest questions first. That favours easy questions, where SigMap has
# least to save; read results with that in mind.
ORDER=${ORDER:-"gin:x001 gin:x002 express:x038 express:x037 flask:x033 fastapi:x145 fastify:x137 fastapi:x146 fastify:x138 flask:x032"}

for variant in $VARIANTS; do
  case "$variant" in current|lean|index|skill|skill-always|skill-shipped|prefetch|placebo|locate|prefetch-hook|hook-plain|hook-firm|hook-brief) ;; *) echo "unknown variant: $variant" >&2; exit 2 ;; esac
  for spec in $ORDER; do
    repo=${spec%%:*}; id=${spec##*:}; out="$OUT/$variant/$repo-$id"
    if [ "${FORCE:-0}" != "1" ] && [ -f "$out/raw.json" ]; then echo "skip   $variant $spec (done: $out)"; continue; fi
    echo "run    $variant $spec -> $out"
    args=(scripts/run-agent-ab.mjs --repos "$repo" --task-ids "$id" --runs "$RUNS" --sigmap-variant "$variant" --model "$MODEL"
          --max-budget-usd "$BUDGET" --timeout-ms 420000 --max-consecutive-failures 2 --save --allow-unpublishable
          --out-dir "$out" --raw-out "$out/raw.json")
    [ -n "${CLAUDE_BIN:-}" ] && args+=(--claude "$CLAUDE_BIN")
    [ "${SESSION_AUTH:-0}" = "1" ] && args+=(--session-auth)
    [ "${AGENT:-claude}" = "api" ] && args+=(--agent api)
    [ -n "${PROMPT_STYLE:-}" ] && args+=(--prompt-style "$PROMPT_STYLE")
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
