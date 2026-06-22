# Contributors

SigMap is built by a great community of contributors. Thank you to everyone who has helped!

## Core Contributors

- [manojmallick](https://github.com/manojmallick) — Core architecture, graph builder, impact analysis, release management
- [Claude Code](https://claude.ai/code) — AI-assisted development, code generation, testing
- [ContextForge](https://github.com/contextforge) — Integration, adapters, multi-framework support

## Feature Contributors

- [David Schoch](https://github.com/schochastics) — GDScript extractor, language support
- [Sean Campbell](https://github.com/) — Framework detection, configuration
- [Denis Solonenko](https://github.com/dsolonenko) — GDScript extractor (#146)
- [Matt Van Horn](https://github.com/mvanhorn) — Testing, reliability improvements
- [kumamaki](https://github.com/kumamaki) — Bug fixes, improvements

## Supporters

- **SigMap Bot** — Release automation, version management
- Community members — Bug reports, feedback, discussions

## Contribution Attribution

When you contribute to SigMap, your GitHub account will appear in the [contributors graph](https://github.com/manojmallick/sigmap/graphs/contributors) if:
- Your commit author email is linked to your GitHub account profile
- You make commits using that email address

To ensure proper attribution:
1. Link your email to your GitHub account: https://github.com/settings/emails
2. Configure git locally: `git config user.email your-github-email@example.com`

## How to Contribute

We welcome contributions! See [Contributing](./docs/CONTRIBUTING.md) for guidelines.

### Recent Contributors (v7.26.0)
- **@manojmallick** — feat(evidence): Evidence Pack JSON v1 — deterministic, machine-consumable signature+evidence map (`sigmap evidence`) with JSON + Markdown handoff modes, byte-stable output, and a sha256 grounding hash (#372, PR #373)

### Recent Contributors (v7.24.2)
- **@manojmallick** — docs: surface the StarMapper stargazer map (517 stars · 37 countries) — README badge + Support link, docs community link, README-structure test (#360, PR #361)

### Recent Contributors (v7.24.1)
- **@manojmallick** — docs: publish the first measured §9 grounding result (`version.json` `ablation`) — 5×100 repo-fact tasks on Gemini: grounding cut flagged codebase-fact errors from 99.8 [99–100] to 0.2 [0–1] per 100 (factual-recall grounding)

### Recent Contributors (v7.24.0)
- **@manojmallick** — feat: redesign the §9 ablation corpus as checkable repo-fact questions (which file defines `<name>`, what params) — a wrong path is a checkable hallucination and example code is forbidden, so the metric isolates grounding instead of guard precision; ids `call-`→`fact-` (#356, PR #357)

### Recent Contributors (v7.23.0)
- **@manojmallick** — feat: robust §9 ablation — `--runs N` averaging (mean ± range) via pure `aggregateRuns`, 100-task real-symbol corpus (was 40); makes one invocation yield a statistically stable grounding number (#353, PR #354)

### Recent Contributors (v7.22.2)
- **@manojmallick** — fix: clear the last two `verify-ai-output` false-positive classes — camelCase placeholders (`myExample.js`) and documentation-placeholder imports (`@scope/utils`, `some-module`, `./local-file`); ordinary words and genuine fakes still flag; exposes the true §9 grounding delta (#350, PR #351)

### Recent Contributors (v7.22.1)
- **@manojmallick** — fix: harden `verify-ai-output` file-path extractor — skip runtime/library product names (`Node.js`, `Next.js`, …) and illustrative placeholders (`example.js`, `minimal-example.js`); genuine repo paths still flag; removes the dominant Hallucination Guard false-positive class (#347, PR #348)

### Recent Contributors (v7.22.0)
- **@manojmallick** — feat: realistic §9 ablation — real-symbol corpus (`gen-ablation-corpus.mjs`), exact-signature grounding, `--verbose` flagged items; `scoreAnswerDetail` (#344, PR #345); fix: default Gemini model → gemini-2.5-flash (#343)

### Recent Contributors (v7.21.0)
- **@manojmallick** — feat: Gemini (AI Studio) provider for the §9 LLM A/B ablation runner — auto-detected from GEMINI_API_KEY; `--provider`/`--model` flags (#340, PR #341)

### Recent Contributors (v7.20.0)
- **@manojmallick** — feat: `sigmap --init` writes a Creation workflow block into CLAUDE.md (`renderCreationWorkflowBlock` / `injectCreationWorkflow`); final IMPL item — grounded-codegen plan complete (#337, PR #338)

### Recent Contributors (v7.19.0)
- **@manojmallick** — feat: scaffold persistence — write an accepted proposal to `.context/scaffold/latest.md`; `renderScaffoldMarkdown` / `scaffoldPath`; Gap 2 §6.2 (#334, PR #335)

### Recent Contributors (v7.18.0)
- **@manojmallick** — feat: `sigmap conventions --update` — incremental rescan (refresh snapshot only when source changed); `changedSince` / `planUpdate`; completes the §4 flag set (#331, PR #332)

### Recent Contributors (v7.17.0)
- **@manojmallick** — feat: `sigmap conventions --fix` — exhaustive rename/move checklist (every offending file, full from→to paths); `buildFixList`; Layer 3 (#328, PR #329)

### Recent Contributors (v7.16.0)
- **@manojmallick** — feat: LLM A/B hallucination ablation harness (IMPL §9) — injected-completer harness (`buildGrounding` / `scoreAnswer` / `runAblation`) + live runner; offline-testable, network confined to scripts/ (#325, PR #326)

### Recent Contributors (v7.15.0)
- **@manojmallick** — feat: `sigmap conventions --ci` — CI gate on overall convention consistency (`--min`, `--no-regress`); `ciGate`; Layer 3 (#322, PR #323)

### Recent Contributors (v7.14.0)
- **@manojmallick** — feat: `sigmap conventions --report` — consistency audit + overall score + trend vs last run; `scoreReport` / `snapshot`; Layer 3 (#319, PR #320)

### Recent Contributors (v7.13.0)
- **@manojmallick** — feat: `sigmap create` — orchestrate the 4-stage grounded-creation pipeline (scaffold → verify-plan → verify-ai-output → review-pr) with n/4 numbering; `orchestrate`; Gap 2 capstone (#316, PR #317)

### Recent Contributors (v7.12.0)
- **@manojmallick** — feat: `sigmap review-pr` — diff audit (scope drift, god-node edits, missing tests, security-sensitive files); `reviewPr`; last guard stage of the create pipeline (Gap 2) (#313, PR #314)

### Recent Contributors (v7.11.0)
- **@manojmallick** — feat: `sigmap verify-plan` — check a plan against the live index (files/symbols exist, blast radius, scope) before execution; `verifyPlan`; Gap 2 grounded codegen (#310, PR #311)

### Recent Contributors (v7.10.0)
- **@manojmallick** — feat: `sigmap scaffold` — convention-matched proposal with a confidence floor (soft threshold 0.70, non-overridable hard floor 0.50); `proposeScaffold`; Layer 4 grounded codegen (#307, PR #308)

### Recent Contributors (v7.9.0)
- **@manojmallick** — feat: `sigmap conventions --inject` — write the auto-detected conventions block into CLAUDE.md (idempotent, marker-scoped); `renderConventionsBlock` / `injectConventions`; Layer 3 grounded codegen (#304, PR #305)

### Recent Contributors (v7.8.0)
- **@manojmallick** — feat: `sigmap conventions --conflicts` — per-convention breakdown (counts, bars, example files) + rename suggestions; `analyzeConflicts` / `toNamingStyle`; example-file tracking in `scoreConvention`; Layer 3 grounded codegen (#301, PR #302)

### Recent Contributors (v7.7.0)
- **@manojmallick** — feat: `sigmap conventions` — extract & report a repo's coding conventions (file naming, export style, test framework) for TS/JS/Python; reusable `scoreConvention` consistency scorer; Layer 3 grounded codegen (#298, PR #299)

### Recent Contributors (v7.0.1)
- **@manojmallick** — fix: shell-free subprocess calls (zero `execSync` in the published surface), `main` → core API, removed unused device fingerprint, star nudge counts plain `sigmap` runs (#250, PRs #251 #252)

### Recent Contributors (v6.14.0)
- **@manojmallick** — feat: `verify-ai-output` Hallucination Guard prototype — deterministic fake-file / fake-import / fake-symbol detectors, markdown + `--json`, offline (#227, PR #228)

### Recent Contributors (v6.13.0)
- **@manojmallick** — feat: line anchors for JavaScript + member-level anchors (TS & JS); index-mode token cut 4.6% → 32–42% on real repos; overhead-aware token budget (#223, PR #224)

### Recent Contributors (v6.12.0)
- **@manojmallick** — feat: Surgical Context Phase 2 — `get_lines` MCP tool, `ask --mode index`, `ask --since`, budget-aware body collapse, Token Reduction dashboard panel (#219, PR #220)
- **@manojmallick** — ci: add `workflow_dispatch` to the develop→main sync workflow (PR #218)

### Recent Contributors (v6.11.1)
- **@rudi193-cmd** — fix: include hot-cold cold signatures in the bundled MCP server (#201, PR #216)

### Recent Contributors (v6.11.0)
- Line anchors (`:start-end`) on TypeScript & Python signatures — Surgical Context Phase 1
- MCP registration with intelligent fallback to `.claude/settings.json`

### v6.10.11
- MCP cache improvements for hot/cold context indexing
- Binary build reliability with r-manifest module bundling
- npm publish workflow with automation token support
- Test assertion fixes and integration test reliability
- Documentation updates for 31 supported languages (R + GDScript)
- Cross-platform compatibility (macOS, Linux, Windows)

---

**Thank you to all contributors!** Your work makes SigMap better for everyone. 🙏
