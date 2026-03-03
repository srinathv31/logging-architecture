---
title: Paginated Response Format Convention
impact: MEDIUM
impactDescription: ensures consistent API response structure across all endpoints
tags: response, pagination, format, convention
---

## Paginated Response Format Convention

All paginated endpoints return a consistent shape: `{ items/events/traces, totalCount, page, pageSize, hasMore }`. The collection field name matches the resource type. `hasMore` is computed server-side as `offset + pageSize < totalCount`.

**Incorrect (inconsistent response shapes, missing pagination metadata, different field names):**

```typescript
// BAD: inconsistent naming, missing fields, client must compute hasMore
return reply.send({ data: traces, total: 50 });

// BAD: different shape for different endpoints
return reply.send({ results: events, count: 10, next: '/v1/events?page=2' });
```

**Correct (consistent paginated response, based on api/src/schemas/traces.ts):**

```typescript
// Response schema
export const listTracesResponseSchema = z.object({
  traces: z.array(traceSummarySchema),
  totalCount: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  hasMore: z.boolean(),
});

// In service layer
const offset = (filters.page - 1) * filters.pageSize;
const hasMore = offset + filters.pageSize < totalCount;

return { traces, totalCount, hasMore };

// In route handler
return reply.send({ traces, totalCount, page, pageSize, hasMore });
```

- The collection field name matches the resource: `events` for events, `traces` for traces, `correlationIds` for correlation IDs.
- `totalCount` is always an integer representing the full count of matching records.
- `hasMore` is computed server-side (`offset + pageSize < totalCount`) so clients do not need to compute it themselves.
- `page` and `pageSize` are echoed back in the response so clients can confirm what was requested.
- This convention applies to every paginated endpoint in the API for a uniform client experience.
