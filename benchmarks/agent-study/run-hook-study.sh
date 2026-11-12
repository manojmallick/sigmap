#!/bin/bash
# The hook study's runs: the eight repositories and 87 questions of the third round, one delivery of SigMap's ranking at a time, on a
# logged-in Claude Code session (no API key; it counts against the account's plan). Resumable like run-remaining.sh, which it calls.
#
#   HELDOUT_ROOT=<dir> HELDOUT2_ROOT=<dir> VARIANTS="prefetch-hook prefetch" OUT=./hook-runs bash benchmarks/agent-study/run-hook-study.sh
#   SHARD=0..3 runs one quarter (two repositories) so four can run side by side; unset, it runs all eight.
#
# HELDOUT_ROOT / HELDOUT2_ROOT hold benchmarks/tasks/retrieval-xrepo.jsonl and the pinned repositories of the first and second
# held-out rounds (see run-token-saving.sh). MODEL and RUNS default to claude-haiku-5-5 and 2; BUDGET to 0.25 USD a run.
set -u
cd "$(dirname "$0")/../.." || exit 1
: "${HELDOUT_ROOT:?set HELDOUT_ROOT}"; : "${HELDOUT2_ROOT:?set HELDOUT2_ROOT}"
VARIANTS=${VARIANTS:-"prefetch-hook prefetch"}; OUT=${OUT:-./hook-runs}
case "${SHARD:-all}" in
  0) JOBS="HELDOUT:ionos-cloud__cluster-api-provider-proxmox HELDOUT:flamingock__flamingock-java" ;;
  1) JOBS="HELDOUT2:conda__constructor HELDOUT2:GDQuest__GDScript-formatter" ;;
  2) JOBS="HELDOUT2:intaro__pinboard HELDOUT:statelyai__agent" ;;
  3) JOBS="HELDOUT2:chatmail__relay HELDOUT:stefankoegl__python-json-patch" ;;
  all) JOBS="HELDOUT:ionos-cloud__cluster-api-provider-proxmox HELDOUT:flamingock__flamingock-java HELDOUT2:conda__constructor HELDOUT2:GDQuest__GDScript-formatter HELDOUT2:intaro__pinboard HELDOUT:statelyai__agent HELDOUT2:chatmail__relay HELDOUT:stefankoegl__python-json-patch" ;;
  *) echo "SHARD must be 0, 1, 2, 3 or unset" >&2; exit 2 ;;
esac
for job in $JOBS; do
  which=${job%%:*}; repo=${job##*:}
  if [ "$which" = "HELDOUT" ]; then root=$HELDOUT_ROOT; else root=$HELDOUT2_ROOT; fi
  [ -f "$root/benchmarks/tasks/retrieval-xrepo.jsonl" ] || { echo "$root has no benchmarks/tasks/retrieval-xrepo.jsonl" >&2; exit 1; }
  ids=$(node -e 'const t=require("fs").readFileSync(process.argv[1]+"/benchmarks/tasks/retrieval-xrepo.jsonl","utf8").split("\n").filter(Boolean).map(JSON.parse).filter(x=>x.repo===process.argv[2]).map(x=>x.id).join(","); console.log(t)' "$root" "$repo")
  [ -n "$ids" ] || { echo "no questions for $repo in $root" >&2; exit 1; }
  # One variant after another for each repository, so a slow hour of the service falls on every variant alike.
  for v in $VARIANTS; do
    SIGMAP_XREPO_DATA=$root VARIANTS=$v MODEL=${MODEL:-claude-haiku-5-5} RUNS=${RUNS:-2} BUDGET=${BUDGET:-0.25} SESSION_AUTH=1 ORDER="$repo:$ids" OUT=$OUT \
      bash benchmarks/agent-study/run-remaining.sh || { echo "STOPPED at $v $repo" >&2; exit 1; }
  done
done
echo "hook study: done in $OUT"
