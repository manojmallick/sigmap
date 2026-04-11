## SigMap token reduction benchmark

| Repo | Language | Raw tokens | After SigMap | Reduction |
|------|----------|------------|--------------|-----------|
| **express** | JavaScript | 15.5K | 201 | **98.7%** |
| **flask** | Python | 84.8K | 3.4K | **96%** |
| **gin** | Go | 172.8K | 5.7K | **96.7%** |
| **spring-petclinic** | Java | 77.0K | 634 | **99.2%** |
| **rails** | Ruby | 1.5M | 7.1K | **99.5%** |
| **axios** | TypeScript | 31.7K | 1.5K | **95.2%** |
| **rust-analyzer** | Rust | 3.5M | 5.9K | **99.8%** |
| **abseil-cpp** | C++ | 2.3M | 6.3K | **99.7%** |
| **serilog** | C# | 113.7K | 5.8K | **94.9%** |
| **riverpod** | Dart | 682.7K | 6.5K | **99%** |
| **okhttp** | Kotlin | 31.3K | 1.4K | **95.5%** |
| **laravel** | PHP | 1.7M | 7.2K | **99.6%** |
| **akka** | Scala | 790.5K | 7.1K | **99.1%** |
| **vapor** | Swift | 171.2K | 6.4K | **96.3%** |
| **vue-core** | Vue | 404.2K | 8.8K | **97.8%** |
| **svelte** | Svelte | 438.2K | 8.0K | **98.2%** |
| **AVERAGE** | 16 repos | 12.0M | 82.0K | **99.3%** |

*Measured with SigMap v3.3.1 — node gen-context.js --report --json on each repo (depth-1 clone)*