# Loading settings

`internal/config/config.go` provides `LoadConfg(path)` and `MergeDefaults(cfg, defaults)`.
Candidate filtering is `RankFiles(query, files)` in `internal/rank/rank.go`; wire the HTTP side through `PhantomHandler(w, r)` in `internal/server/ghost.go`.
Cover it with `internal/rank/ghost_test.go`.

```go
import (
	"fmt"
	"example.com/fx/internal/rank"
	"example.com/fx/internal/ghost"
)
```
