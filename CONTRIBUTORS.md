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
