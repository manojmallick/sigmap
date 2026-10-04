# Layering configuration

Configuration lives in `src/app/config.py`: call `load_confg(path)` and then `merge_default(config, defaults)`.
Ranking is in `src/app/ranker.py` through `rank_files(query, files)`, with caching in `src/app/cache.py`.
Cover it with `tests/test_cache.py`.

```python
from app.config import load_config
from app.cache import Cache
```
