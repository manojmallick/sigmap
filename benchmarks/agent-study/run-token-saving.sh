#!/bin/bash
# Measure what SigMap saves, with your own Anthropic API key, on your own machine.
#
#   export ANTHROPIC_API_KEY=...          # in your shell only: never in a file, a chat or a commit
#                                         # (a cloud session reads BENCH_ANTHROPIC_KEY instead, so the session's own login is not switched to this key)
#   bash benchmarks/agent-study/run-token-saving.sh           # checks + plan + cost ceiling; starts NOTHING
#   GO=1 bash benchmarks/agent-study/run-token-saving.sh      # runs it
#
# One tiny test call (about $0.002) runs with the checks unless KEY_CHECK=0; the batches start only with GO=1.
# It runs the agent A/B (scripts/run-agent-ab.mjs: the same questions with and without SigMap, in clean copies of pinned
# repositories, Claude Code under --bare, or with AGENT=api the Messages API directly) on two sets of questions and prints one report per set:
#   unfamiliar   30 labelled questions about THIS repository's source, which a model has not memorised (closed-book.mjs: 0 of 30
#                answered from memory). This is the case that resembles a private codebase.
#   famous       45 questions about 8 well-known frameworks (40 of 45 answered from memory, so little to save).
# The SigMap arm is set up by the harness itself, so "is SigMap set up correctly" is not left to chance: `index` is the documented
# setup (strategy "index" + the 7-tool core MCP profile), `prefetch` puts SigMap's ranking in the prompt before the first turn.
#
# Variables (all optional):
#   SETS            "unfamiliar famous"         which question sets (also: heldout, with HELDOUT_ROOT=<data root from scripts/build-heldout-set.mjs>)
#   VARIANTS        "index prefetch"            which SigMap setups (also: lean, current, locate; placebo, API agent only: the size-matched control)
#   MODEL           claude-haiku-5-5            the model both arms use (claude-sonnet-5-5 costs several times more a run)
#   RUNS            4                           repetitions per arm per question (4 is the fewest the harness calls a result)
#   MAX_TOTAL_USD   25                          stop before the next batch once the spend recorded so far passes this
#   BUDGET          0.25                        the agent's own cap for ONE run, in USD
#   OUT             ./token-saving-runs         where reports, raw records and the unfamiliar data root go
#   AGENT           claude                      claude = Claude Code under --bare; api = the Messages API directly (scripts/lib/agent-ab-api.mjs).
#                                               Use api when Claude Code requests are refused for the key ("credit balance is too low" while plain
#                                               API calls work): it needs nothing but the key, but it is a different agent (a ~150-token prompt and
#                                               four tools, not Claude Code's ~12k-token prefix), so its numbers are not Claude Code's
#   KEY_CHECK       1                           make one tiny Claude Code call with the key first (about $0.002): a key that plain API
#                                               calls accept can still be refused for Claude Code requests, and it is better to know now
#   CLAUDE_BIN                                  another claude executable (the tests use a fake one)
#
# It is resumable: a batch whose raw.json exists is skipped, a batch that fails records nothing, so rerunning carries on.
# Spend so far is read from the saved records (the agent's own total_cost_usd per run). Haiku 5.5 measured about $0.003 a run
# on the session login; under an API key and --bare the prompt prefix is smaller, so expect that order of size, not that figure.
set -u
# A cloud session keeps its own login in ANTHROPIC_API_KEY's place, so the benchmark key is given under another name there.
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-${BENCH_ANTHROPIC_KEY:-}}
export ANTHROPIC_API_KEY
cd "$(dirname "$0")/../.." || exit 1
HERE=benchmarks/agent-study
SETS=${SETS:-"unfamiliar famous"};  # also: heldout (needs HELDOUT_ROOT)
 VARIANTS=${VARIANTS:-"index prefetch"}; MODEL=${MODEL:-claude-haiku-5-5}
RUNS=${RUNS:-4}; MAX_TOTAL_USD=${MAX_TOTAL_USD:-25}; BUDGET=${BUDGET:-0.25}; OUT=${OUT:-./token-saving-runs}
AGENT=${AGENT:-claude}; export AGENT
case "$AGENT" in claude|api) ;; *) echo "AGENT must be claude or api, got: $AGENT" >&2; exit 2 ;; esac
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
if [ "$AGENT" = "claude" ]; then
  if command -v "$CLAUDE" >/dev/null 2>&1; then ok "claude $("$CLAUDE" --version 2>/dev/null | head -1)"; else bad "the claude CLI is not installed (npm install -g @anthropic-ai/claude-code)"; fi
  if [ "$(uname -s)" = "Linux" ] && ! command -v bwrap >/dev/null 2>&1; then bad "bubblewrap is missing, and --bare needs it on Linux (apt-get install bubblewrap)"; fi
else
  ok "AGENT=api: the Messages API directly, no claude CLI needed"
  if command -v rg >/dev/null 2>&1; then ok "ripgrep is installed (the agent's Grep and Glob tools use it)"; else bad "ripgrep (rg) is not installed: apt-get install ripgrep / brew install ripgrep"; fi
fi
for set in $SETS; do
  case "$set" in
    unfamiliar) ok "unfamiliar: built from this checkout into $OUT/unfamiliar-root (no download)" ;;
    famous)
      missing=""
      for r in $FAMOUS_REPOS; do [ -e "benchmarks/repos/$r/.git" ] || missing="$missing $r"; done
      if [ -z "$missing" ]; then ok "famous: the 8 pinned checkouts are present"; else bad "famous: missing checkouts:$missing — run: node scripts/fetch-xrepo-repos.mjs --only $(echo $FAMOUS_REPOS | tr ' ' ',')"; fi ;;
    heldout) ;;  # checked below, once its data root is read
    *) bad "unknown set \"$set\" (unfamiliar, famous, heldout)" ;;
  esac
done
if [ "$problems" -eq 0 ] && [ "${KEY_CHECK:-1}" = "1" ] && [ "$AGENT" = "api" ]; then
  verdict=$(node --input-type=module -e '
import { pingKey } from "./scripts/lib/agent-ab-api.mjs";
const r = await pingKey({ apiKey: process.env.ANTHROPIC_API_KEY, model: process.argv[1], baseUrl: process.env.ANTHROPIC_BASE_URL || undefined });
console.log(r.ok ? "OK" : "REFUSED " + r.error);' "$MODEL" 2>/dev/null)
  case "$verdict" in
    OK) ok "the API accepts this key (one test call to $MODEL)" ;;
    REFUSED*) bad "the API refused this key: ${verdict#REFUSED }" ;;
    *) bad "the test call returned nothing readable: check the network and the key" ;;
  esac
elif [ "$problems" -eq 0 ] && [ "${KEY_CHECK:-1}" = "1" ]; then
  probe_dir=$(mktemp -d)
  verdict=$(cd "$probe_dir" && printf 'Reply with the single word: ok' | "$CLAUDE" -p --bare --output-format json --no-session-persistence --model "$MODEL" --tools "" --permission-mode dontAsk --max-budget-usd 0.05 --strict-mcp-config 2>/dev/null | node -e '
let t = ""; process.stdin.on("data", (d) => { t += d; }).on("end", () => {
  let r = null;
  for (const l of t.split("\n")) { try { const o = JSON.parse(l); if (o && o.type === "result") r = o; else if (o && !o.type && "is_error" in o) r = o; } catch (_) { /* not json */ } }
  if (!r) { console.log("NORESULT"); return; }
  console.log(r.is_error ? "REFUSED " + String(r.result).replace(/\s+/g, " ").slice(0, 160) : "OK");
});')
  rm -rf "$probe_dir"
  case "$verdict" in
    OK) ok "Claude Code accepts this key (one test call to $MODEL)" ;;
    REFUSED*) bad "Claude Code was refused with this key: ${verdict#REFUSED }. A key that plain API calls accept can still fail here (a user-scoped sk-ant-usr key did); create a standard key in Console → API keys under the organisation that holds the credit and check Plans & Billing; if plain API calls work with it, run with AGENT=api (the Messages API directly)" ;;
    *) bad "the test call to Claude Code returned nothing readable (run: echo ok | $CLAUDE -p --bare --model $MODEL) — fix that before spending anything" ;;
  esac
fi
for v in $VARIANTS; do case "$v" in index|prefetch|lean|current|placebo|locate) ;; *) bad "variant \"$v\" is not one this script runs with an API key (index, prefetch, lean, current, placebo, locate; the skill variants need --session-auth)" ;; esac; done

# A held-out set is a data root from scripts/build-heldout-set.mjs (HELDOUT_ROOT): one batch per repository, every question in it
# (HELDOUT_REPOS=a,b limits it to those repositories, so a set can be run in parallel shards).
HELDOUT=""
case " $SETS " in *" heldout "*)
  if [ -f "${HELDOUT_ROOT:-/nonexistent}/benchmarks/tasks/retrieval-xrepo.jsonl" ]; then
    HELDOUT=$(node -e 'const only=(process.env.HELDOUT_REPOS||"").split(",").filter(Boolean);const by={};for(const l of require("fs").readFileSync(process.argv[1]+"/benchmarks/tasks/retrieval-xrepo.jsonl","utf8").split("\n").filter(Boolean)){const t=JSON.parse(l);if(only.length&&!only.includes(t.repo))continue;(by[t.repo]=by[t.repo]||[]).push(t.id);}console.log(Object.entries(by).map(([r,ids])=>r+":"+ids.join(",")).join(" "));' "$HELDOUT_ROOT")
    ok "heldout: $(printf '%s\n' $HELDOUT | wc -l) repositories from $HELDOUT_ROOT"
  else bad "the heldout set needs HELDOUT_ROOT=<a data root built by scripts/build-heldout-set.mjs>"; fi ;;
esac
questions=0; batches=0
for set in $SETS; do
  case "$set" in unfamiliar) list=$UNFAMILIAR ;; famous) list=$FAMOUS ;; heldout) list=$HELDOUT ;; *) list="" ;; esac
  for spec in $list; do batches=$((batches + 1)); ids=${spec##*:}; n=$(printf '%s\n' "$ids" | tr ',' '\n' | grep -c .); questions=$((questions + n)); done
done
nvar=$(printf '%s\n' $VARIANTS | wc -l)
runs=$((questions * RUNS * 2 * nvar))
say ""
say "Plan"
say "  sets       $SETS"
say "  SigMap     $VARIANTS   (each against its own no-SigMap baseline)"
say "  agent      $AGENT"
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
  elif [ "$set" = "heldout" ]; then
    list=$HELDOUT
    export SIGMAP_XREPO_DATA="$HELDOUT_ROOT"
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
      VARIANTS="$v" MODEL="$MODEL" RUNS="$RUNS" BUDGET="$BUDGET" ORDER="$spec" OUT="$OUT/$set" SESSION_AUTH=0 AGENT="$AGENT" bash "$HERE/run-remaining.sh" || { say "a batch failed (see the message above); nothing from it was recorded. Fix it and rerun: finished batches are skipped."; exit 1; }
    done
  done
done

read -r usd n <<EOF
$(spent)
EOF
say ""
say "done: $n runs recorded, \$$usd spent by the agent's own count"
say ""
node "$HERE/to-runs.mjs" "$OUT" --route "$([ "$AGENT" = api ] && echo api || echo claude-code)" --model "$MODEL" > "$OUT/runs.ndjson"
node "$HERE/summarize.mjs" --runs "$OUT/runs.ndjson" --study
