# Loading settings

`internal/config/config.go` provides `LoadConfig(path)` and `MergeDefaults(cfg, defaults)`.
Candidate filtering is `RankFiles(query, files)` in `internal/rank/rank.go`, covered by `internal/rank/rank_test.go`.

```go
import (
	"fmt"
	"example.com/fx/internal/rank"
)
```
