---
title: Reusable Pagination and Date Range Schemas
impact: HIGH
impactDescription: Duplicating pagination fields across schemas leads to inconsistent defaults and missed coercion of query string parameters
tags: zod, pagination, reusable, merge
---

## Reusable Pagination and Date Range Schemas

Define reusable pagination and date range schemas in `common.ts`. Use `.merge()` or `.extend()` to compose them into endpoint-specific query schemas. Always use `z.coerce` for query string parameters since HTTP delivers them as strings.

**Incorrect (repeating page/pageSize in every schema, missing coercion):**

```typescript
// traces.ts - duplicated pagination fields
export const listTracesQuerySchema = z.object({
  page: z.number().int().positive().default(1),       // FAILS: query params are strings
  pageSize: z.number().int().min(1).max(100).default(20), // FAILS: same problem
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  processName: z.string().optional(),
});

// events.ts - same fields copied again with slightly different defaults
export const listEventsQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(50).default(10), // inconsistent max/default
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});
```

**Correct (reusable schemas with z.coerce and composition):**

```typescript
// schemas/common.ts
import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeQuerySchema = z.object({
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});
```

```typescript
// schemas/traces.ts - compose with .merge() and .extend()
import { paginationQuerySchema, dateRangeQuerySchema } from './common';

export const listTracesQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    processName: z.string().optional(),
    eventStatus: z.string().optional(),
  });
```

```typescript
// schemas/events.ts - same base schemas, different extensions
import { paginationQuerySchema, dateRangeQuerySchema } from './common';

export const listEventsQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    traceId: z.string().optional(),
    eventType: z.string().optional(),
  });
```

Key details:

- **`z.coerce.number()`** is essential for query string parameters because HTTP query params always arrive as strings (e.g., `?page=2` sends `"2"`, not `2`). Without coercion, Zod rejects valid requests.
- **`.default()`** provides sensible defaults when the parameter is omitted entirely.
- **`.merge()`** combines two `z.object()` schemas into one. Use it to add the date range fields.
- **`.extend()`** adds new fields to an existing schema. Use it for endpoint-specific fields.
- Centralizing pagination ensures consistent page sizes, defaults, and validation across all list endpoints.
