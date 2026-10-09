---
title: "ADR 0006 — Append-only local NDJSON for shared state"
description: Why cross-session state lives in local, append-only NDJSON files — no daemon, socket or hosted store — and why that constraint keeps multi-agent shared context deferred.
---

# ADR 0006 — Cross-session state is local, append-only NDJSON; no daemon, socket or hosted store

| | |
|---|---|
| **Status** | Accepted — shared multi-agent context ([#677](https://github.com/manojmallick/sigmap/issues/677)) stays deferred on this basis |
| **Recorded** | 2026-10-09 ([#930](https://github.com/manojmallick/sigmap/issues/930)); the session store shipped in [#922](https://github.com/manojmallick/sigmap/issues/922) |
| **Applies to** | the session store (`.context/sessions.ndjson`), which defines the contract below, and the other `.context/*.ndjson` ledgers that share its storage rule |

## Context

More than one agent can work in a repository at once — Claude Code, Cursor, a CI job — and notes, checkpoints, spend and sessions need to outlive a process. The obvious designs are a shared database, a background daemon that agents talk to, or a hosted service.

## Decision

State that crosses sessions lives in `.context/*.ndjson`. The session store — the one built for concurrent writers — spells out the contract, and it is **append-only**:

- a writer adds one self-contained JSON line with a single write on an `O_APPEND` descriptor;
- a reader **folds** the lines by session id into the current picture;
- a correction is a new event, never an edit in place;
- compaction rolls old events into monthly `rollup` events;
- an event is capped at 4,000 bytes, so one write is not interleaved with another writer's.

There is **no daemon-mediated sync, no socket, and nothing hosted.** If a use case needs one of those, the answer is no.

## Why

1. **Concurrent writers cannot corrupt an append.** An upsert in place races between writers; a single append does not need a lock for ordinary writes. Only compaction takes one (`.context/sessions.lock`).
2. **Folding makes retries safe.** A `usage` event carries cumulative totals up to a transcript offset and the fold keeps the highest, so a hook that fires twice, or two parsers racing, writes the same totals and the fold counts them once.
3. **It keeps the other decisions true.** A daemon or a hosted store is a runtime dependency and a place data leaves the machine ([ADR 0003](/adr/0003-no-llm-in-the-deterministic-core)); a local text file is neither.

## Consequences

- **No cross-machine sharing.** Two machines have two stores.
- **Reads fold the log,** so cost grows with the file; monthly compaction bounds it.
- **Live push is out of scope.** One agent cannot notify another instantly; it can only leave something the next reader folds in.
- **Shared multi-agent context is deferred, not rejected.** Attribution already exists — session ids carry an agent prefix — but sharing a checkpoint or budget across agents is built only when a real multi-agent workflow is named, and then only on this storage. [#677](https://github.com/manojmallick/sigmap/issues/677) requires that gate to be documented, and a test with two concurrent writers, before implementation starts.

## Evidence

- `src/session/store.js` header: the append-only contract, event kinds, and "a single `O_APPEND` write"; `MAX_EVENT_BYTES`; `withLock` used by `compact` only.
- `test/integration/session-store.test.js`: real concurrent processes produce a fold-clean store with no torn or interleaved line; oversize events are refused because they would interleave; a double-fire is idempotent.
- [#682](https://github.com/manojmallick/sigmap/issues/682), the Session Intelligence epic: "upsert-in-place is impossible with concurrent writers".

## Revisit when

A named multi-agent workflow cannot be served by append-and-fold, and the mechanism it needs can stay local, dependency-free and optional. A requirement for a daemon, a socket or a hosted service does not reopen this record — those are the cases it exists to refuse.
