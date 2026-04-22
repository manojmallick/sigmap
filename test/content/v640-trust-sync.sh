#!/usr/bin/env bash
# Content-consistency test for v6.4.0 trust sync changes.
# Run from the repo root: bash test/content/v640-trust-sync.sh

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }

check_absent() {
  local desc="$1"; shift
  if grep -qn "$@" 2>/dev/null; then fail "$desc"; else pass "$desc"; fi
}

check_present() {
  local desc="$1"; shift
  if grep -qn "$@" 2>/dev/null; then pass "$desc"; else fail "$desc"; fi
}

# 1. Homepage must not have bare "Latest: v6.0"
check_absent "index.md: no bare 'Latest: v6.0'" 'Latest:.*v6\.0' docs-vp/index.md

# 2. Homepage must have separate Release and Benchmark labels
check_present "index.md: has Release label" '<strong>Release:</strong>' docs-vp/index.md
check_present "index.md: has Benchmark label" '<strong>Benchmark:</strong>' docs-vp/index.md

# 3. No v5.9-main references in generalization.md
check_absent "generalization.md: no v5.9-main reference" 'v5\.9-main' docs-vp/guide/generalization.md

# 4. generalization.md references v6.0-main
check_present "generalization.md: has v6.0-main reference" 'v6\.0-main' docs-vp/guide/generalization.md

# 5. README must not contain the overclaim phrase
check_absent "README.md: no 'every time' overclaim" 'every time' README.md

# 6. README demo section has at most 2 commands in the first bash block
DEMO_LINES=$(awk '/^## Try it now/{f=1} f && /^---/{f=0} f' README.md | grep -c '^\(npx\|sigmap\)') || DEMO_LINES=0
if [ "$DEMO_LINES" -le 2 ]; then pass "README.md: top demo has ≤2 commands ($DEMO_LINES)";
else fail "README.md: top demo has $DEMO_LINES commands (expected ≤2)"; fi

# 7. benchmark.md has v6.3.0 release note
check_present "benchmark.md: has v6.3.0 release note" 'v6\.3\.0 release note' docs-vp/guide/benchmark.md

# 8. retrieval-benchmark.md has v6.3.0 release note
check_present "retrieval-benchmark.md: has v6.3.0 release note" 'v6\.3\.0 release note' docs-vp/guide/retrieval-benchmark.md

# 9. task-benchmark.md has v6.3.0 release note
check_present "task-benchmark.md: has v6.3.0 release note" 'v6\.3\.0 release note' docs-vp/guide/task-benchmark.md

# 10. mcp.md has v6.3.0 native tool callout
check_present "mcp.md: has v6.3.0 callout" 'v6\.3\.0' docs-vp/guide/mcp.md

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
