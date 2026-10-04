# Adding a rank filter

Edit `src/index.js`, which exposes `loadConfig(path)`, and also `src/ghost.js`.
Scoring happens in `loadConfg(path)` and `phantomFn(x)`; callers use `rank(query)`.
Table output lives in `src/format/table.js` through `renderTable(rows)`.
Add a test at `test/ghost.test.js`, and see `lib/index.js` for the entrypoint.

```js
import { helper } from './src/util';
import chalk from 'chalk';
import ghost from 'ghost-pkg-9000';
import { missing } from './src/missing';
```

Run `npm run build`, then `npm run nope`.
