---
title: "ADR 0003 — No LLM in the deterministic core"
description: Why nothing on the path that produces SigMap's output calls a model, why the network is limited to two opt-in paths, where a model is allowed, and what that rules out.
---

# ADR 0003 — No LLM call on the path that produces SigMap's output, and no network beyond two opt-in paths

| | |
|---|---|
| **Status** | Accepted |
| **Recorded** | 2026-10-09 ([#930](https://github.com/manojmallick/sigmap/issues/930)); the decision predates it |
| **Applies to** | generating the context, ranking, `plan`, `verify`, `judge`, `review-pr` — everything that produces SigMap's own output |

## Context

AI-assisted code tools commonly put a model in the loop: to summarise files, to re-rank results, to grade an answer. SigMap's job is to be the layer an agent can check its work against.

## Decision

No code on the path that produces SigMap's output calls an LLM or an embedding service, and none calls the network except two opt-in paths: a remote config `extends` URL and the Willow adapter (see Consequences). The same repository, configuration, local state and question give a byte-identical result. A model appears only at the edge:

- the user's own agent, which reads SigMap's output;
- an opt-in script, `scripts/run-llm-ablation.mjs`, that measures with a live model; it says its own network access *"is confined to scripts/ (never the published library surface)"*. The published package (`files` in `package.json`) does not include `scripts/`.

## Why

1. **Reproducible, diffable, gateable.** A fixed input must give a fixed output, or CI cannot gate on it and a reviewer cannot tell a change in the code from a change in a model.
2. **A checker should not share the checked thing's failure mode.** `verify` and `judge` exist to catch an AI answer that names a function that does not exist. A judge that is itself a model would be checking a guess with a guess (this is the reasoning behind the decision, not a recorded quote). `verify` resolves claims against the symbol index, the source files, the checkout's manifests and installed libraries; `judge` adds a lexical overlap score to that claim check.
3. **No key, no account, no data leaving the machine.** Nothing to configure and nothing to disclose.

## Consequences

- **No paraphrase and no semantic understanding.** `judge` measures whether an answer's technical claims are grounded in the supplied code; it does not judge whether the answer is correct or well written.
- **Some claims cannot be measured by the deterministic suite.** Whether an agent finishes a task in fewer tool calls needs a live model. Those figures are labelled *modeled* where they are, and the agent-level A/B ([#812](https://github.com/manojmallick/sigmap/issues/812)) belongs in an opt-in script that states its model and date, outside CI and the default suite.
- **The network code that does exist is small and opt-in.** In the published surface it is the remote `extends` fetch in `src/config/loader.js` (a config the user points at a URL) and the optional Willow adapter, `packages/adapters/willow.js` (posts signatures to a server the user configures). Neither sends a prompt to a model.

## Evidence

- CI step "Bundle reproducibility" runs `node scripts/build-bundle.mjs --check`: the committed `gen-context.js` must equal a fresh build from `src/`.
- `scripts/check-benchmark-determinism.mjs` ([#522](https://github.com/manojmallick/sigmap/issues/522)) and `.github/workflows/benchmark-determinism.yml`: two runs of the honest benchmark must produce identical reports.
- A search of `src/` and `packages/` finds `require('https')` / `require('http')` only in `src/config/loader.js` and `fetch(` only in `packages/adapters/willow.js`.
- The README's claim — "no LLM calls, no embeddings, byte-stable output" — is this decision stated for users.

## Revisit when

A feature cannot be built deterministically and its value is demonstrated. It could then exist only as an opt-in edge adapter that cannot change what the core produces. A model inside `ask`, `verify` or `judge` is not that — it would end the guarantee this record exists to keep.
