---
title: Service Layer Structure
impact: HIGH
impactDescription: ensures consistent service architecture across the API
tags: service, architecture, module, exports
---

## Service Layer Structure

Services are plain TypeScript modules with named function exports. No classes. Each function gets db via `const db = await getDb()`.

**Incorrect (class-based service with module-level db):**

```typescript
import { getDb } from '../db/client';

const db = await getDb(); // Module-level — fails if DB not ready at import time

export class EventLogService {
  async createEvent(entry: EventLogEntry) {
    const [result] = await db.insert(eventLogs).output().values(entryToInsert(entry));
    return result;
  }
}
```

**Correct (named function exports, per-call db):**

```typescript
import { getDb } from '../db/client';
import { eventLogs } from '../db/schema/index';

export async function createEvent(entry: EventLogEntry) {
  const db = await getDb();
  const [result] = await db.insert(eventLogs).output().values(entryToInsert(entry));
  return result;
}

export async function getByAccount(accountId: string, filters: {...}) {
  const db = await getDb();
  // ...query logic
}
```

Import in routes as: `import * as eventLogService from '../../services/event-log.service';`

The `getDb()` call is async because the connection may be lazy-initialized.
