# Model Routing Guide

> **Goal:** Route each AI task to the cheapest model that can reliably do it.  
> Applying this guide cuts API costs by **40–80%** on a typical mixed workload.

---

## The three-tier model

SigMap classifies every file in your codebase into one of three tiers.
When you start a task, pick the tier that matches the *complexity of the task*,
not just the file — see the decision flow below.

| Tier | Label | Example models | Input price |
|---|---|---|---|
| `fast` | Fast (low-cost) | claude-haiku-4-5, gpt-6-luna, gemini-3.5-flash-lite | $0.1–$1 / MTok |
| `balanced` | Balanced (mid-tier) | claude-sonnet-5-5, gpt-6.1-sol, gemini-3.8-flash | $0.75–$2 / MTok |
| `powerful` | Powerful (high-cost) | claude-fable-5-1, claude-opus-5-5, gpt-6-astra, gemini-3.1-pro-preview | $2–$10 / MTok |

Names and prices are the shipped model profile **as of 2026-10-04**. They come from one
dated table (`src/config/models.js`) that `gain --model` also prices from, and every
output prints that date. Declare the models you actually have under `models.roster` in
`gen-context.config.json` and the advice names only those; override any figure under
`models.prices`. SigMap never fetches prices — `sigmap doctor` warns when the profile is
more than 90 days old.

---

## Generating routing hints

### One-off
```bash
node gen-context.js --routing
# Appends a "## Model routing hints" section to copilot-instructions.md
```

### Always-on (in config)
```json
// gen-context.config.json
{
  "routing": true
}
```

### Via MCP (inside a Copilot Chat session)
```
Use the get_routing MCP tool to show which files belong to which model tier.
```

---

## How files are classified

The classifier (`src/routing/classifier.js`) uses heuristics — no LLM calls:

### Fast tier

Assigned to files where tasks are inherently bounded in scope:

| Signal | Example |
|---|---|
| Extension: `.json`, `.yml`, `.yaml`, `.toml` | Config files |
| Extension: `.html`, `.htm`, `.css`, `.scss` | Markup and styles |
| Extension: `.sh`, `.bash`, `.zsh`, `Dockerfile` | Scripts and containers |
| Path contains `/config/`, `/fixtures/`, `/migrations/` | Setup/seeding code |
| ≤ 2 extracted signatures | Trivially small file |

### Balanced tier

The default for standard application code:

| Signal | Example |
|---|---|
| 3–11 extracted signatures | Typical service or controller |
| `*.test.js`, `*.spec.ts`, `*_test.go` | Test files |
| Everything else not matching fast or powerful | General purpose code |

### Powerful tier

Assigned when the task requires reasoning across many interactions or is security-critical:

| Signal | Example |
|---|---|
| ≥ 12 extracted signatures | Large module with many exports |
| ≥ 8 indented signatures (class methods) | Complex class hierarchy |
| Path contains `/security/`, `/auth/`, `/crypto/` | Security-sensitive code |
| Path contains `/core/`, `/engine/`, `/compiler/`, `/parser/` | Core execution logic |
| Path contains `/scheduler/`, `/orchestrat*` | Coordination logic |

---

## Task-to-tier decision flow

```
Is the task over a single config/markup/script file?
  └─ Yes → FAST

Is the task touching security/, auth/, or crypto/ code?
  └─ Yes → POWERFUL

Does the task span 3+ files or require design decisions?
  └─ Yes → POWERFUL

Does the target file have 12+ signatures or 8+ methods?
  └─ Yes → POWERFUL

Otherwise:
  └─ BALANCED
```

---

## Task type examples

### Use FAST for:
- Autocomplete inside a `.yml` or `.json` file
- "Fix the indentation in this Dockerfile"
- "Rename `user_id` to `userId` in config"
- "Explain this 10-line shell script"
- "Add a CSS class for dark mode"

### Use BALANCED for:
- "Write unit tests for `loginUser()`"
- "Implement the `getUserById()` endpoint"
- "Debug: why does `parseDate()` throw on null?"
- "Refactor `formatCurrency()` to handle internationalization"
- "Write a PR description for this commit"

### Use POWERFUL for:
- "Design the auth middleware chain for our API"
- "Migrate from Passport.js v0.6 to v0.7 across all routes"
- "Audit `src/security/` for OWASP Top 10 vulnerabilities"
- "Resolve the circular dependency between `core/engine.js` and `services/queue.js`"
- "Redesign the job scheduler to support distributed workers"

---

## Integrating with your tools

### VS Code Copilot Chat  

The routing hints appear in `copilot-instructions.md` when `routing: true`.  
Copilot reads this file automatically — no config needed in VS Code.

### Claude Code / Cursor (via MCP)

The `get_routing` MCP tool returns routing hints on demand:

```json
{ "method": "tools/call", "params": { "name": "get_routing", "arguments": {} } }
```

This is cheaper than re-reading the full context file every session.

### CI pipeline cost gate

Add a cost check to your CI using the routing report:

```yaml
# .github/workflows/context.yml
- name: Check routing tier distribution
  run: |
    node gen-context.js --routing --report --json > /tmp/report.json
    node -e "
      const r = require('/tmp/report.json');
      if (r.routing && r.routing.powerful.length > 20) {
        console.error('Too many powerful-tier files — review complexity');
        process.exit(1);
      }
    "
```

---

## Cost calculation reference

For a typical 60-minute session with context at each turn:

| Model tier | Turns | Tokens/turn | Cost (est.) |
|---|---|---|---|
| All powerful | 20 | 4,000 | **$1.20** |
| Mixed routing | 10 fast + 8 balanced + 2 powerful | 4,000 each | **$0.28** |
| **Saving** | | | **~77%** |

---

## Overriding the classifier

The classifier is intentionally heuristic-only — no AST, no LLM.  
To force a file into a different tier, move it to a conventionally-named path:

```
# Move to security/ → forces powerful
mv src/utils/token.js src/security/token.js

# Add to .contextignore to exclude from routing entirely
echo "src/generated/**" >> .contextignore
```

For custom tier rules, edit `src/routing/classifier.js` directly — the function is small
and fully documented.

---

## `--suggest-tool` — instant tier recommendation

Instead of consulting the table manually, ask SigMap:

```bash
node gen-context.js --suggest-tool "migrate from Passport.js v0.6 to v0.7"
# tier   : powerful
# models : claude-fable-5-1, claude-opus-5-5, gpt-6-astra, gemini-3.1-pro-preview
# cost   : $2–$10 / MTok input
# as of  : 2026-10-04 (shipped profile) — set "models.roster" in gen-context.config.json to name the models you have

node gen-context.js --suggest-tool "fix the typo in the dockerfile" --json
# {"tier":"fast","label":"Fast (low-cost)","models":"claude-haiku-4-5, gpt-6-luna, gemini-3.5-flash-lite","modelIds":[…],"costHint":"$0.1–$1 / MTok input","asOf":"2026-10-04",…}
```

Keyword matching covers the most common task patterns. When in doubt, start balanced and escalate.

---

*SigMap for daily always-on context; Repomix for deep one-off sessions — use both.*
