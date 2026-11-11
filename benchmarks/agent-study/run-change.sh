#!/usr/bin/env bash
# Stage 2 of the agent study: change tasks. The agent gets a bug report and a checkout of the code before a merged fix, edits it and runs the
# repository's tests; its patch is graded by the fix's own tests, which it never sees (docs-vp/guide/agent-study-protocol.md).
#
#   DATA=<data root> bash benchmarks/agent-study/run-change.sh              # prints the plan and the worst-case spend; starts nothing
#   GO=1 DATA=<data root> ANTHROPIC_API_KEY=... bash benchmarks/agent-study/run-change.sh
#
# The data root comes from `node scripts/build-change-tasks.mjs --out <dir> --max 16` (needs `gh` for the issues, or a cached issues/ folder).
# One process per task, so a stopped run resumes where it stopped: a task whose raw file exists is skipped.
#
#   MODEL     claude-haiku-5-5   the model
#   VARIANT   index              a SigMap variant: index (the documented optimum) or prefetch
#   RUNS      3                  repetitions per arm
#   TASKS     c01,c02,...        the task ids (default: every task in the data root except the two umbrella issues named in the protocol)
#   CAP       0.5                USD cap per run; a run that reaches it is graded on what it had done
#   OUT       benchmarks/agent-study/raw/change/<model>/<variant>
set -u
cd "$(dirname "$0")/../.."
DATA="${DATA:?DATA must be the data root built by scripts/build-change-tasks.mjs}"
MODEL="${MODEL:-claude-haiku-5-5}"
VARIANT="${VARIANT:-index}"
RUNS="${RUNS:-3}"
CAP="${CAP:-0.5}"
TASKS="${TASKS:-c01,c02,c03,c04,c05,c06,c07,c09,c11}"
OUT="${OUT:-benchmarks/agent-study/raw/change/$MODEL/$VARIANT}"
KEY="${ANTHROPIC_API_KEY:-${BENCH_ANTHROPIC_KEY:-}}"

IFS=',' read -r -a IDS <<< "$TASKS"
RUNS_TOTAL=$(( ${#IDS[@]} * RUNS * 2 ))
echo "change tasks: ${#IDS[@]} tasks x $RUNS runs x 2 arms = $RUNS_TOTAL agent runs, model $MODEL, variant $VARIANT"
echo "worst case: <= \$$(awk -v n="$RUNS_TOTAL" -v c="$CAP" 'BEGIN{printf "%.2f", n*c}') (cap \$$CAP per run); output $OUT"
if [ "${GO:-}" != "1" ]; then echo "nothing started: set GO=1 to run"; exit 0; fi
[ -n "$KEY" ] || { echo "no API key: set ANTHROPIC_API_KEY (it is read, never printed)"; exit 2; }

mkdir -p "$OUT"
for id in "${IDS[@]}"; do
  if [ -s "$OUT/$id.json" ]; then echo "skip $id (done)"; continue; fi
  ANTHROPIC_API_KEY="$KEY" SIGMAP_XREPO_DATA="$DATA" node scripts/run-agent-ab.mjs --agent api --change \
    --model "$MODEL" --sigmap-variant "$VARIANT" --task-ids "$id" --runs "$RUNS" --allow-unpublishable \
    --max-budget-usd "$CAP" --timeout-ms 600000 --raw-out "$OUT/$id.json.part" --out-dir "$OUT/report-$id" 2>&1 | grep -E '^\s+\[[0-9]+/' \
    || echo "  $id: no run line (see above)"
  [ -s "$OUT/$id.json.part" ] && mv "$OUT/$id.json.part" "$OUT/$id.json"
done
echo "done: $OUT"
