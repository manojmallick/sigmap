#!/bin/bash
# Measure what SigMap saves, with your own Anthropic API key, on your own machine.
#
#   export ANTHROPIC_API_KEY=...          # in your shell only: never in a file, a chat or a commit
#   bash benchmarks/pilots/2026-11-09-relay-haiku-5-5/run-token-saving.sh           # checks + plan + cost ceiling; starts NOTHING
#   GO=1 bash benchmarks/pilots/2026-11-09-relay-haiku-5-5/run-token-saving.sh      # runs it
#
# It runs the agent A/B (scripts/run-agent-ab.mjs: the same questions with and without SigMap, in clean copies of pinned
# repositories, Claude Code under --bare) on two sets of questions and prints one report per set:
#   unfamiliar   30 labelled questions about THIS repository's source, which a model has not memorised (closed-book.mjs: 0 of 30
#                answered from memory). This is the case that resembles a private codebase.
#   famous       the pilot's 45 questions about 8 well-known frameworks (40 of 45 answered from memory, so little to save).
# The SigMap arm is set up by the harness itself, so "is SigMap set up correctly" is not left to chance: `index` is the documented
# setup (strategy "index" + the 7-tool core MCP profile), `prefetch` puts SigMap's ranking in the prompt before the first turn.
#
# Variables (all optional):
#   SETS            "unfamiliar famous"         which question sets
#   VARIANTS        "index prefetch"            which SigMap setups (also: lean, current)
#   MODEL           claude-haiku-5-5            the model both arms use (claude-sonnet-5-5 costs several times more a run)
#   RUNS            4                           repetitions per arm per question (4 is the fewest the harness calls a result)
#   MAX_TOTAL_USD   25                          stop before the next batch once the spend recorded so far passes this
#   BUDGET          0.25                        the agent's own cap for ONE run, in USD
#   OUT             ./token-saving-runs         where reports, raw records and the unfamiliar data root go
#   CLAUDE_BIN                                  another claude executable (the tests use a fake one)
#
# It is resumable: a batch whose raw.json exists is skipped, a batch that fails records nothing, so rerunning carries on.
# Spend so far is read from the saved records (the agent's own total_cost_usd per run). Haiku 5.5 measured about $0.003 a run
# on the session login; under an API key and --bare the prompt prefix is smaller, so expect that order of size, not that figure.
set -u
cd "$(dirname "$0")/../../.." || exit 1
HERE=benchmarks/pilots/2026-11-09-relay-haiku-5-5
SETS=${SETS:-"unfamiliar famous"}; VARIANTS=${VARIANTS:-"index prefetch"}; MODEL=${MODEL:-claude-haiku-5-5}
RUNS=${RUNS:-4}; MAX_TOTAL_USD=${MAX_TOTAL_USD:-25}; BUDGET=${BUDGET:-0.25}; OUT=${OUT:-./token-saving-runs}
CLAUDE=${CLAUDE_BIN:-claude}

UNFAMILIAR="sigmap-src:h001,h002,h003,h004,h005,h006,h007,h008 sigmap-src:h009,h010,h011,h012,h013,h014,h015 sigmap-src:h016,h017,h018,h019,h020,h021,h022,h023 sigmap-src:h024,h025,h026,h027,h028,h029,h030"
FAMOUS="gin:x001,x002,x003,x004,x005 flask:x032,x033,x034,x035,x036 express:x037,x038,x039,x040 fastify:x137,x138,x139,x140,x141,x142,x143,x144 fastapi:x145,x146,x147,x148,x149,x150,x151,x152 django:x027,x028,x029,x030,x031 rails:x084,x085,x086,x087,x088 laravel:x046,x047,x048,x049,x050"
FAMOUS_REPOS="gin flask express fastify fastapi django rails laravel"

problems=0
say() { printf '%s\n' "$*"; }
bad() { printf '  ✗ %s\n' "$*"; problems=$((problems + 1)); }
ok() { printf '  ✓ %s\n' "$*"; }

say "SigMap token-saving A/B: checks"
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then ok "ANTHROPIC_API_KEY is set (not shown)"; else bad "ANTHROPIC_API_KEY is not set: export it in this shell (console.anthropic.com → API keys)"; fi
if command -v node >/dev/null 2>&1; then ok "node $(node --version)"; else bad "node is not installed"; fi
if command -v "$CLAUDE" >/dev/null 2>&1; then ok "claude $("$CLAUDE" --version 2>/dev/null | head -1)"; else bad "the claude CLI is not installed (npm install -g @anthropic-ai/claude-code)"; fi
if [ "$(uname -s)" = "Linux" ] && ! command -v bwrap >/dev/null 2>&1; then bad "bubblewrap is missing, and --bare needs it on Linux (apt-get install bubblewrap)"; fi
for set in $SETS; do
  case "$set" in
    unfamiliar) ok "unfamiliar: built from this checkout into $OUT/unfamiliar-root (no download)" ;;
    famous)
      missing=""
      for r in $FAMOUS_REPOS; do [ -e "benchmarks/repos/$r/.git" ] || missing="$missing $r"; done
      if [ -z "$missing" ]; then ok "famous: the 8 pinned checkouts are present"; else bad "famous: missing checkouts:$missing — run: node scripts/fetch-xrepo-repos.mjs --only $(echo $FAMOUS_REPOS | tr ' ' ',')"; fi ;;
    *) bad "unknown set \"$set\" (unfamiliar, famous)" ;;
  esac
done
for v in $VARIANTS; do case "$v" in index|prefetch|lean|current) ;; *) bad "variant \"$v\" is not one this script runs with an API key (index, prefetch, lean, current; the skill variants need --session-auth)" ;; esac; done

questions=0; batches=0
for set in $SETS; do
  case "$set" in unfamiliar) list=$UNFAMILIAR ;; famous) list=$FAMOUS ;; *) list="" ;; esac
  for spec in $list; do batches=$((batches + 1)); ids=${spec##*:}; n=$(printf '%s\n' "$ids" | tr ',' '\n' | grep -c .); questions=$((questions + n)); done
done
nvar=$(printf '%s\n' $VARIANTS | wc -l)
runs=$((questions * RUNS * 2 * nvar))
say ""
say "Plan"
say "  sets       $SETS"
say "  SigMap     $VARIANTS   (each against its own no-SigMap baseline)"
say "  model      $MODEL"
say "  questions  $questions per SigMap setup, $RUNS repetitions per arm → $runs agent runs in $((batches * nvar)) batches"
say "  spend      stops before the next batch once \$$MAX_TOTAL_USD is passed; one run is capped at \$$BUDGET by the agent"
say "  output     $OUT"

if [ "$problems" -gt 0 ]; then say ""; say "$problems problem(s) above: nothing started."; exit 1; fi
if [ "${GO:-0}" != "1" ]; then say ""; say "Nothing started. To run it:  GO=1 bash $HERE/run-token-saving.sh"; exit 0; fi

spent() { node -e '
const fs = require("fs"), path = require("path");
let usd = 0, runs = 0;
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name);
  if (e.isDirectory()) { if (e.name !== "unfamiliar-root") walk(p); }
  else if (e.name === "raw.json") { try { for (const x of JSON.parse(fs.readFileSync(p, "utf8"))) { runs++; if (x.cost && Number.isFinite(x.cost.usd)) usd += x.cost.usd; } } catch (_) {} } } };
if (fs.existsSync(process.argv[1])) walk(process.argv[1]);
process.stdout.write(usd.toFixed(4) + " " + runs);' "$OUT"; }
over() { node -e 'process.exit(Number(process.argv[1]) > Number(process.argv[2]) ? 0 : 1)' "$1" "$MAX_TOTAL_USD"; }

mkdir -p "$OUT"
for set in $SETS; do
  if [ "$set" = "unfamiliar" ]; then
    list=$UNFAMILIAR
    if [ ! -f "$OUT/unfamiliar-root/benchmarks/xrepo-repos.json" ]; then
      say ""; say "building the unfamiliar data root"
      node "$HERE/make-unfamiliar-root.mjs" "$OUT/unfamiliar-root" 30 || { say "could not build the unfamiliar data root"; exit 1; }
    fi
    export SIGMAP_XREPO_DATA="$OUT/unfamiliar-root"
  else
    list=$FAMOUS
    unset SIGMAP_XREPO_DATA
  fi
  for v in $VARIANTS; do
    for spec in $list; do
      read -r usd n <<EOF
$(spent)
EOF
      if over "$usd"; then say ""; say "STOPPED: \$$usd recorded over $n runs, past MAX_TOTAL_USD=\$$MAX_TOTAL_USD. Raise it and rerun to carry on; finished batches are kept."; exit 3; fi
      VARIANTS="$v" MODEL="$MODEL" RUNS="$RUNS" BUDGET="$BUDGET" ORDER="$spec" OUT="$OUT/$set" SESSION_AUTH=0 bash "$HERE/run-remaining.sh" || { say "a batch failed (see the message above); nothing from it was recorded. Fix it and rerun: finished batches are skipped."; exit 1; }
    done
  done
done

read -r usd n <<EOF
$(spent)
EOF
say ""
say "done: $n runs recorded, \$$usd spent by the agent's own count"
for set in $SETS; do
  say ""
  say "──────────────── $set ────────────────"
  node "$HERE/variant-combined.mjs" "$OUT/$set" "$MODEL, API key"
done
