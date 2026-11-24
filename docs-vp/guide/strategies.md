---
title: Context strategies
description: Choose the right SigMap strategy — full, index, per-module, or hot-cold. Measured token cost, what each one leaves out of the file, and a decision guide.
head:
  - - meta
    - property: og:title
      content: "SigMap Strategies — full, index, per-module, hot-cold"
  - - meta
    - property: og:description
      content: "Choose the right SigMap strategy for your workflow. Measured token cost, what each one leaves out, and a decision guide."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/strategies"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap strategy, sigmap full, sigmap index, sigmap per-module, sigmap hot-cold, ai context strategy, token budget"
---
# Context strategies

SigMap supports four output strategies: `full`, `index`, `per-module`, and `hot-cold`. This page says what each one writes, what that costs in tokens, what it leaves out of the file, and what has been measured about it.

One thing is the same under all four: the retrieval index, `.context/sig-index.json`, holds every file SigMap scanned (its entries were identical under all four strategies on all 28 repositories measured), so `sigmap ask` reaches any file whichever strategy you pick. The strategy only decides what is **injected** without anyone asking.

Every strategy's always-on file carries the same `## SigMap commands` block (~224 tokens), which is what tells an agent to run `sigmap ask` instead of reading files. Before v8.51.8 the `per-module` overview and the `hot-cold` file left it out, so they were about 224 tokens smaller and did not tell the agent to run `sigmap ask`. It is now in all four, counted inside the token budget.

## Quick comparison

Token figures are the median and the range over 28 repositories of 17 to 3,405 source files (SigMap's `Files scanned`: the files it extracts symbols from, Markdown and YAML included; the 28 have 66 to 8,743 tracked files), counted as chars/4 the way SigMap counts them; the method and its limits are [at the end of the page](#how-these-numbers-were-measured). The ranges are those of one-commit copies of these repositories, not bounds. The size depends on which file your tool reads, so `full` is shown for each.

With no config SigMap uses `strategy: full` and writes only the Copilot file. `sigmap --init` starts a new project on `index` and lists copilot, codex, claude and gemini in `outputs`, so `CLAUDE.md` and `AGENTS.md` exist.

| Strategy | Always injected | Left out of the written file | MCP required | Best fit |
|----------|-----------------|------------------------------|--------------|----------|
| `full` | `CLAUDE.md` 1,584 (833–2,309) · `AGENTS.md` 7,960 (1,371–8,164) · Copilot file 13,356 (1,419–27,428) | Over its budget, in the Copilot file: 25 of 28 repositories lost files. The three that lost none had 17, 25 and 49 source files. `CLAUDE.md` (about 200 lines) held 7 to 22 files and `AGENTS.md` (32 KiB) 17 to 113, so `CLAUDE.md` lost files on 28 of 28. Each file keeps at most 25 signatures (`maxSigsPerFile`) | No | A repository of about 50 source files or fewer, read from the Copilot file; a tool that can run neither commands nor MCP |
| `index` | A map with no signatures: 575 (477–1,031) in `CLAUDE.md` and `AGENTS.md`, 626 (525–1,079) in the Copilot file | Every signature, by design: they are in `.context/sig-index.json`, which holds every file SigMap scanned (a file with more than 200 signatures is cut at 200 there) | No: `sigmap ask` works from the shell | What `sigmap --init` writes; agents that run `sigmap ask` or the MCP tools |
| `per-module` | An overview: 413 (382–1,197) in `CLAUDE.md` and `AGENTS.md`, 463 (430–1,245) in the Copilot file; about 363 plus 15 per top-level module. The module files are not injected | Files over a module's own budget: 15 of 28 repositories had a module lose some | No | Clear module boundaries, opening one module file at a time |
| `hot-cold` | The files changed in the last `hotCommits` (10) commits, with no cap: 278 when none of them touched the source directories, every file on a one-commit clone ([details](#hot-cold)). No median: 26 of the 28 copies are one-commit clones, where every file is hot | Nothing is dropped; the rest goes to `context-cold.md`, which nothing injects | No: `sigmap ask` returns cold files; MCP `read_context` is another way (not on the `locate` profile) | A repository with history, when recent work should be in front of the agent |

## Best strategy by situation

This table says which strategy fits and what backs the choice. What was measured is in [Choosing a setup](/guide/choosing-a-setup), in Claude Code against no SigMap, on where-is-it questions, one question per run: `index` with the two-tool `locate` profile cost −16.6% with Haiku 5.5 and −8.8% with Sonnet 5.5 on the same 20 repositories, and −18.5% with Haiku 5.5 on 16 large repositories (where the agent named the right file 4.2 points less often than without SigMap). The runs of the old default (`current`: the `full` section and every tool) are the only ones that bear on `full`: +9% with Haiku 5.5 and −28% with Haiku 4.5, on eight well-known frameworks (with Haiku 5.5, 3 of the 8 cost more). The runs were not made against each other, so do not compare one percentage with another. No agent run exists for `per-module` or `hot-cold`: their rows are design intent, not measurement.

| Situation | Strategy | Why | Backed by |
|---|---|---|---|
| The agent runs the MCP tools (the `locate` profile) or `sigmap ask` to find where something is implemented | `index` | The always-on file is a map of 575 tokens at the median (477 to 1,031); signatures arrive per question | Cost, not time or tokens, on where-is-it questions, through the MCP tools (the three runs above). `sigmap ask` as the route, editing and long sessions were not measured. In the Messages-API agent the same setup saved no time (+1%) and total tokens rose 18%; with Sonnet in Claude Code tokens rose 9% while cost fell 12%. `index` with the `core` profile saved nothing (−1%, Messages-API agent) |
| A repository where `full` drops files (more than about 50 source files) | `index` | `full` drops the files over its budget, and the `hot-cold` hot set has no cap; the index holds every file SigMap scanned | Always-on sizes on this page. Agent study, Claude Code, Haiku 5.5, 16 repositories of 3,026 to 7,756 tracked files: cost −18.5%, but the agent named the right file 4.2 points less often than without SigMap (167 of 192 against 175); no Python or JavaScript repository above about 260 files was run |
| The agent cannot run commands or call tools | `full`, on a small repository | The signatures have to be in the file, and a large repository does not fit | Design intent |
| Clear module boundaries, one module at a time | `per-module` | Load only the module file you are working in | Design intent |
| Work concentrated in recently committed files, on a repository with history | `hot-cold` | Files changed in the last `hotCommits` commits are injected, and nothing else. Uncommitted edits are not; a history of merge commits can leave the set empty (SigMap's own last 25 commits held no source file) | Design intent; the hot set has no cap |

## Each strategy in detail

### full

One file per host with the signatures that fit the budget, at most 25 for each file (`maxSigsPerFile`; the cut is silent). Best when the repository is small, or when your tool can run neither commands nor MCP and the signatures have to be in the file.

```json
{
  "strategy": "full"
}
```

**The budget.** With `autoMaxTokens` on, which is the default, `maxTokens` plays no part in the size of the context files: the budget is 80% of the repository's signature tokens (`coverageTarget`), never below 4,000 and, by default, never above 25,600 tokens, which is 20% of a 128K window (`maxTokensHeadroom`). `maxTokens` (default 6,000) is the budget only with `autoMaxTokens` off: `{ "autoMaxTokens": false, "maxTokens": 6000 }`. The budget covers the file's header, the `## SigMap commands` block and the signature sections; the dependency map, the declared dependencies, the TODO and the changes sections are written after it, so the largest Copilot file measured (svelte) was 27,428 tokens, against the 25,600 cap.

**What it leaves out.** Over the budget, inside each top-level directory, generated files go first, then mocks, tests and config files, then the least recently changed; with several directories each first keeps up to 24 of its best files, so the order across directories is not strict. A file that no longer fits in full is collapsed to its line anchors before it is dropped. In the measurement 25 of 28 repositories lost files from the Copilot file (1,125 of 1,310 on svelte, 3,153 of 3,405 on rails). The retrieval index still holds them. A file that fits is still cut to its first 25 signatures.

**Two files hold less.** Since v8.85.0 (#995) `AGENTS.md` is trimmed to Codex's 32 KiB and `CLAUDE.md` to about 200 lines, so on django (2,069 source files) they carry the signatures of 57 and 13 files where the Copilot file carries 165. `sigmap doctor` prints each instruction file's size against its limit.

**No MCP needed.**

### index

The always-on file is a **map**, not a dump: how to retrieve, a module rollup, entry points, and direct-dependency version pins. Every signature stays in `.context/sig-index.json`, which `sigmap ask` already reads and which no adapter injects.

```json
{
  "strategy": "index"
}
```

This exists because a full dump costs tokens on every turn and, the reasoning goes, an agent that already holds what `sigmap ask` would return has little reason to call it, so the always-on file competes with the lookup path it exists to feed. That is the design reasoning, not a measured effect.

Measured on the SigMap repository itself (v8.88.0, its own config and its 16,000-token budget; tokens as chars/4):

| | `full` | `index` |
|---|---|---|
| Copilot file | 15,391 tokens | 540 tokens |
| `CLAUDE.md` | 1,696 tokens | 487 tokens |
| One `sigmap ask` on top | not needed | 1,242 to 2,084 tokens (four questions) |

For Claude Code the always-on saving on this repository is about 1,200 tokens, and the first answer under `index` (487 plus one `ask`, 1,729 to 2,571) is no smaller than `full`'s whole `CLAUDE.md` (1,696). For the Copilot file the saving is about 15,000 tokens. What the agent study measured is cost and time against no SigMap, not against `full`: see [Choosing a setup](/guide/choosing-a-setup).

Retrieval reaches the same files: the index is written before the strategy split, and a test pins that its entries are identical under `index` and `full`. Switching changes only *where* signatures are injected, never which files retrieval can reach.

**`sigmap --report` does not measure this.** It always prices the single-file `full` layout, whatever the strategy, so on an `index` project its `files dropped`, its coverage grade and its tip describe a file that is never written, and raising `maxTokens`, as the tip suggests, changes nothing while `autoMaxTokens` is on (the default) and, with it off, changes only the report. `sigmap doctor` has the same blind spot: it reports `in-context 0%` for an `index` project. A normal run prints the size of the map it wrote and the saving against `full`; the `budget: dropped N` line it also prints counts what `full` would drop, not a file `index` dropped.

**What it leaves out.** Nothing from the index: every file with symbols was indexed on all 28 repositories. One cap applies: a file with more than 200 signatures is cut at 200 in the index (`maxIndexSigsPerFile`; 9 of the 28 repositories had such a file, and on rails it was 13 files and 827 signatures), and SigMap says so when it happens.

**Two caveats, both reported by the tool rather than buried here.** Below the size of the map itself (477 to 1,031 tokens in the measurement, set by the repository) the map's fixed overhead costs more than inlining everything, and SigMap says `strategy:"full" is cheaper here` instead of reporting a saving of zero. And the payoff depends on the agent actually running `sigmap ask` (or the MCP tools) — the map tells it to, but an agent that ignores the instruction gets less context, not more.

**No MCP required** — `sigmap ask` works from the CLI.

### per-module

Writes one file per top-level module (`.github/context-<module>.md`) plus a short overview that lists them. Only the overview is injected; you open or attach the module file you are working in.

```json
{
  "srcDirs": ["server", "web", "desktop"],
  "strategy": "per-module"
}
```

**Size.** The overview is about 363 tokens plus 15 for each top-level module: a median of 413, and 1,197 at 55 modules (a module is the first path segment of a file's path, so a file at the repository root is a module of its own: echo's 55 are 4 directories and 51 root files). Against the medians for `full` that is 74% fewer than its `CLAUDE.md` (1,584) and 97% fewer than its Copilot file (463 against 13,356). The module files are not injected: open the one you need yourself. MCP `read_context` returns only the overview under `per-module`; `sigmap ask` and the MCP `query_context` rank files across every module.

**What it leaves out.** Each module gets its own full budget, the one `full` would get for the whole repository (4,000 to 25,600 tokens with `autoMaxTokens` on; `maxTokens`, at least 1,000, with it off), not a share of one pool, so a module larger than that loses files: 15 of 28 repositories had at least one. SigMap's own `src` keeps 92 files in `context-src.md` and loses 118, and the run prints a `budget: dropped N` line for each such module. `sigmap ask` still reaches the dropped files.

**No MCP needed.**

### hot-cold

Files changed in the last `hotCommits` commits (default 10; `0` also means 10) stay "hot" and are injected, provided `diffPriority` is true (the default; with `false` the hot set is empty). A merge commit counts toward the window but lists no files. Everything else goes to `.github/context-cold.md`, which nothing injects.

```json
{
  "strategy": "hot-cold",
  "hotCommits": 10,
  "diffPriority": true
}
```

**Cold files do not need MCP.** The retrieval index holds them (it is identical under all four strategies), so `sigmap ask` returns them from the shell, with no MCP server involved. MCP `read_context({ module })` (not on the `locate` profile that `sigmap --init` writes) and reading `context-cold.md` are two other ways. The file's own header says "MCP only" and the run summary says "MCP on-demand"; they name the route the file was written for, not a restriction.

**The hot set has no cap.** `hot-cold` applies neither the token budget nor the host limits that `full` does, so the always-on size follows the commits. On SigMap's repository (full history) `CLAUDE.md` was 278 tokens with no hot file at the default 10 commits and at 25, then 612 (2 files) at 50, 5,030 (17 files) at 100, 11,943 (48 files) at 250, 25,530 (114 files) at 500 and 34,837 (184 files) at 1,000. On akka it was 533 tokens (one file) at 10, then 2,513 (8 files) at 25, 19,219 (89 files) at 100 and 155,282 (974 files) at 250: at 250 commits it was about 90 times `full`'s `CLAUDE.md` (1,733). At the default that is 69% to 84% fewer tokens than `full`'s `CLAUDE.md` on those two repositories, and the saving is gone, then reversed, as the window grows. A clone with fewer commits than `hotCommits` makes every file hot, because its oldest commit lists every file (a `--depth 1` clone has one commit): across the 26 one-commit clones the `hot-cold` `CLAUDE.md` was 1,371 tokens for a 17-file repository (zustand) and 356,671 for rails (3,405 files). Keep `hotCommits` low, and do not use `hot-cold` on a shallow checkout, which is what many CI jobs give.

## Real usage scenarios

These are design intent: no agent run exists for `per-module` or `hot-cold`, and the numbers are the measurements above.

### Scenario A: Fix a login bug

You edited auth files in the last few commits and need fast iteration.

**Fits: `index`, or `hot-cold`.** With `hot-cold` the hot set holds the files you edited only if those commits are inside the last `hotCommits`; on SigMap's repository (at commit 930d1a0) the last 10 commits held no source file, so the hot set was empty, and on akka, a corpus checkout whose commit is not recorded, it held one file. Uncommitted edits are never in the hot set. With `index`, `sigmap ask "login"` ranks files by the question, not by what you edited, and it can miss: on the agent study's 222 questions the expected file was in its top five for 74.8% ([the study](/guide/agent-study#retrieval-on-the-weak-repositories-offline)).

### Scenario B: Cross-module question

You need frontend + backend context in one answer.

**Fits: `index`.** `sigmap ask` ranks files across every module in one answer. With `per-module` you load both module files yourself, and a module over its budget has lost some files.

### Scenario C: Team with MCP enabled

Claude Code / Cursor is standard across the team and MCP is always available.

**Fits: `index`.** MCP is not what makes retrieval work: `sigmap ask` reaches every file under every strategy. The MCP tools add to what an agent can do, and `locate` keeps that to two tools.

### Scenario D: Onboarding new engineers

Need broad project understanding quickly, with minimal setup complexity.

**Fits: `full`, if the repository is small enough that nothing is dropped** (3 of the 28 measured lost nothing, with 17, 25 and 49 source files; the file count alone does not decide, since flask, with 51, lost 22): one file with the signatures of every file, up to 25 a file (`maxSigsPerFile`). Read it from the Copilot file or `AGENTS.md`: on those three repositories `CLAUDE.md`, cut to about 200 lines, held 16, 13 and 12 of the files. On a larger repository `full` drops files over its budget, and a question such as "explain the architecture" is better put to `sigmap ask`.

## Decision tree

1. **Your agent runs `sigmap ask` (or the MCP tools)**: choose `index`, which is what `sigmap --init` writes. It is the setup with the most direct evidence: three pre-registered Claude Code runs with the `locate` profile, none with a repository that clearly cost more. `full` was run only as the old default (+9% with Haiku 5.5, −28% with Haiku 4.5); `per-module` and `hot-cold` were never run. The runs used the MCP route: `sigmap ask` on its own, editing and long sessions were not measured.
2. **It cannot, and you want everything inline**: choose `full`, on a repository small enough that nothing is dropped, and point the tool at the Copilot file or `AGENTS.md`: `CLAUDE.md` is cut to about 200 lines.
3. **Module boundaries are clear and you open one module file at a time**: choose `per-module`.
4. **The repository has history and your work sits in recent commits**: choose `hot-cold`, with a low `hotCommits`.
5. **Unsure**: choose `index` with the `locate` profile if your agent can run commands or call MCP tools, and measure it on your project; otherwise `full`.

## How these numbers were measured

Bare `sigmap` (8.88.0) was run once per strategy on a copy of each of 28 repositories: SigMap itself and 27 clones from the benchmark corpus (the names are in `benchmarks/strategy-footprint.json`). Each copy is the files of `git archive HEAD`, so every file carries the commit's timestamp and the same commit gives the same files on every machine, plus the repository's history, which `hot-cold` reads its hot set from and which `full` (the recency order) and source-directory detection also read. The only config was `strategy` and four outputs (`copilot`, `claude`, `codex`, `gemini`; the tables report the first three files, and the `gemini` file was written but not measured). SigMap's own config kept its source directories and 16,000-token budget, and the other repositories had source directories detected. A repository's own `CLAUDE.md`, `AGENTS.md` and Copilot file were removed from the copy, so each file holds only what SigMap wrote. A token is a character count divided by four and rounded up: SigMap's own estimator, not a tokenizer, so read the sizes as sizes. The script and the per-repository table are `scripts/measure-strategy-footprint.mjs` and `benchmarks/strategy-footprint.json`.

Limits. One run per strategy and repository, on a one-commit copy: every clone except SigMap and akka has a single commit, so read the ranges as typical values of these copies, not as bounds; a check on further repositories found values outside them. History matters beyond `hot-cold`: for zustand, the same files with 60 real commits (`git fetch --depth 60`) instead of one were scanned as 45 files instead of 17, and `full`'s `CLAUDE.md` came out 58% larger (1,323 to 2,086 tokens), because source-directory detection reads the history (with `srcDirs` pinned to `src` and `tests` the 60-commit copy gives 1,327 tokens; the recency order only changes which files `CLAUDE.md` holds); other repositories moved by other amounts and are not tabulated here. `hot-cold` was measured on SigMap and akka with history and on the others as a shallow clone, which is the case the page warns about. Python files were read with the `python3` on the PATH (3.9.6); without one, or with another version, the figures for Python repositories change. The repositories are the benchmark corpus, 17 to 3,405 files scanned; some of the 27 clones are not pinned to a commit in any committed file, `git archive` leaves out what a repository marks `export-ignore`, and the SigMap row and its `ask` figures reproduce only at commit 930d1a0. Nothing here measures how an agent behaves with `per-module` or `hot-cold`.

## Further reading

- Detailed guide in repository: [docs/readmes/CONTEXT_STRATEGIES.md](https://github.com/manojmallick/sigmap/blob/main/docs/readmes/CONTEXT_STRATEGIES.md)
- What was measured with an agent: [Choosing a setup](/guide/choosing-a-setup)
- MCP setup: [MCP server](/guide/mcp)
- CLI usage: [Quick start](/guide/quick-start)


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
