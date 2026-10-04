# Using the crate

`src/lib.rs` exports `load_confg(path)` and `rank_files(query, files)`; arithmetic helpers live in `src/util.rs` as `double(n)`.
Metrics are emitted from `src/telemetry.rs` through `phantom_handler(event)`.
Cover it with `tests/telemetry.rs`.
