# Fetching a user

Use `createClient(options)` from `src/api.ts`, then call `fetchUser(client, id)`.
The option and result types are declared in `src/types.ts`.

```ts
import { createClient, fetchUser } from './api';
import type { ClientOptions, User } from './types';
import { z } from 'zod';
```

Compile with `npm run build` and verify with `npm run test`.
