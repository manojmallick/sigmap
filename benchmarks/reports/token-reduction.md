# SigMap Token Reduction Benchmark

Measured with `node gen-context.js --report --json` on public repos (depth-1 clone).
Each repo's raw source tokens are compared against SigMap's compressed signature output.

**Command:**
```bash
node scripts/run-benchmark.mjs --skip-clone --save
```

## Results

| Repo | Language | Raw tokens | After SigMap | Reduction |
|------|----------|------------|--------------|-----------|
| **express** | JavaScript | 15.5K | 201 | **98.7%** |
| **flask** | Python | 84.8K | 3.4K | **96.0%** |
| **gin** | Go | 172.8K | 5.7K | **96.7%** |
| **spring-petclinic** | Java | 77.0K | 634 | **99.2%** |
| **rails** | Ruby | 1.5M | 7.1K | **99.5%** |
| **axios** | TypeScript | 31.7K | 1.5K | **95.2%** |
| **rust-analyzer** | Rust | 3.5M | 5.9K | **99.8%** |
| **AVERAGE** | 7 repos | — | — | **97.6%** |

> Token counts estimated at 4 chars/token (standard approximation).
> "Raw tokens" = estimated tokens of all source files in the indexed dirs.

## Highlights

- **Rust** (rust-analyzer): 3.5M raw → 5.9K compressed — **99.8% reduction**
- **Ruby** (Rails monorepo): 1.5M raw → 7.1K — **99.5% reduction**
- **Java** (Spring PetClinic): 77K raw → 634 tokens — **99.2% reduction**
- **JavaScript** (Express): 15.5K → 201 tokens — **98.7% reduction**
- Worst case (TypeScript, axios): still **95.2%** — well above 90%

## How to reproduce

```bash
# Clone and run (requires git + Node 18+)
node scripts/run-benchmark.mjs --save

# Skip re-cloning if repos already in benchmarks/repos/
node scripts/run-benchmark.mjs --skip-clone --save
```

*Measured with SigMap v3.3.1 — last run: 2025*
