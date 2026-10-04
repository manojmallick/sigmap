# Layering configuration

Configuration lives in `src/app/config.py`: call `load_config(path)` and then `merge_defaults(config, defaults)`.
Ranking is in `src/app/ranker.py` through `rank_files(query, files)`.
The existing test is `tests/test_config.py`.

```python
from app.config import load_config
```
