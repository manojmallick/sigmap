# Adding a rank filter

Edit `src/index.js`, which exposes `loadConfig(path)` and `rankFiles(query, files)`.
Table output lives in `src/format/table.js` through `renderTable(rows)`.

```js
import { helper } from './src/util';
import chalk from 'chalk';
```

Run `npm run build`, then `npm run test`. The existing test is `test/index.test.js`.
