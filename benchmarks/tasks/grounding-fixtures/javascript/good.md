# Adding a rank filter

Edit `src/index.js`, which exposes `loadConfig(path)` and `rankFiles(query, files)`.
Table output lives in `src/format/table.js` through `renderTable(rows)`, which the Windows build copies from `src\format\table.js`.

```js
import {
  helper,
} from './src/util';
import chalk from 'chalk';
const { loadConfig, rankFiles } = require('./src/index');
```

Run `npm run build`, then `npm run test`. The existing test is `test/index.test.js`.
