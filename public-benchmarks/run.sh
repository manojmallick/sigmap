#!/usr/bin/env bash
#
# SigMap public retrieval benchmark — one-command reproducible harness.
#
# Clones each pinned repo from repos.csv at its exact commit into ./.repos/,
# then runs the scorer (score.mjs) which builds a SigMap signature map per repo
# and reports hit@1 / hit@5 / MRR over the queries in queries.json.
#
# Deterministic: pinned commits + a byte-stable map + rank-only math → the same
# numbers on any machine. No LLM, no API keys, no external dependencies.
#
#   ./run.sh                 clone (shallow, pinned) + score
#   ./run.sh --skip-clone    reuse repos already in ./.repos
#   ./run.sh --json          also write results.json
#
# Requirements: git, Node.js 18+.
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
REPOS_DIR="$HERE/.repos"
CSV="$HERE/repos.csv"

SKIP_CLONE=0
SCORE_ARGS=""
for arg in "$@"; do
  case "$arg" in
    --skip-clone) SKIP_CLONE=1 ;;
    *) SCORE_ARGS="$SCORE_ARGS $arg" ;;
  esac
done

command -v git >/dev/null 2>&1 || { echo "error: git is required" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "error: Node.js 18+ is required" >&2; exit 1; }

mkdir -p "$REPOS_DIR"

if [ "$SKIP_CLONE" -eq 0 ]; then
  # Skip the header line; each row is: repo,url,commit,srcDirs
  tail -n +2 "$CSV" | while IFS=',' read -r repo url commit _rest; do
    [ -n "$repo" ] || continue
    dir="$REPOS_DIR/$repo"
    if [ -d "$dir/.git" ]; then
      echo "  = $repo already cloned"
      continue
    fi
    echo "  ↓ $repo @ ${commit:0:12}"
    rm -rf "$dir"
    git init -q "$dir"
    git -C "$dir" remote add origin "$url"
    if git -C "$dir" fetch --depth 1 --quiet origin "$commit"; then
      git -C "$dir" checkout -q FETCH_HEAD
    else
      echo "    ! pinned commit unavailable — fetching default HEAD (results may drift)" >&2
      git -C "$dir" fetch --depth 1 --quiet origin HEAD
      git -C "$dir" checkout -q FETCH_HEAD
    fi
  done
fi

echo ""
echo "  Scoring…"
# shellcheck disable=SC2086
node "$HERE/score.mjs" --repos-dir "$REPOS_DIR" $SCORE_ARGS
