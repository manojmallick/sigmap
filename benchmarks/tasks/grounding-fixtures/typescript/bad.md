# Fetching a user

Use `createClient(options)` from `src/api.ts`, then call `fetchUsr(client, id)`.
Retries are configured in `src/retry.ts`, and the option types live in `src/types.ts`.

```ts
import { createClient } from './api';
import type { ClientOptions, GhostOptions } from './types';
import { backoff } from './gone';
import leftPad from 'left-pad-9000';
```

Compile with `npm run build` and check types with `npm run typecheck`.
