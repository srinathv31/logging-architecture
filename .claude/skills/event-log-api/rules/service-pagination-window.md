---
title: Pagination with Window Function
impact: HIGH
impactDescription: enables efficient pagination without separate COUNT query
tags: service, pagination, window-function, mssql, drizzle
---

## Pagination with Window Function

Use `count(*) over()` window function to get total count in the same query as paginated data. Helper function handles edge cases.

**Incorrect (separate COUNT query):**

```typescript
export async function getByAccount(accountId: string, filters: { page: number; pageSize: number }) {
  const db = await getDb();
  // Two separate queries — doubles database round trips
  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(eventLogs).where(where);
  const rows = await db.select().from(eventLogs).where(where).limit(filters.pageSize).offset(offset);
  return { events: rows, totalCount: countRow.count };
}
```

**Correct (window function in same query):**

```typescript
// In query - add window function column
const rows = await db
  .select({
    ...getColumns(eventLogs),
    _totalCount: sql<number>`cast(count(*) over() as int)`,
  })
  .from(eventLogs)
  .where(where)
  .orderBy(desc(eventLogs.eventTimestamp))
  .offset(offset)
  .fetch(filters.pageSize);

// Helper to extract totalCount from results
async function getTotalCountFromPaginatedRows(db, where, rows, offset) {
  if (rows.length > 0) return rows[0]._totalCount;
  if (offset === 0) return 0;  // No rows + first page = empty table
  // Only run separate count if on a page beyond results
  const [countRow] = await db.select({ count: sql<number>`cast(count(*) as int)` })
    .from(eventLogs).where(where);
  return countRow?.count ?? 0;
}

const totalCount = await getTotalCountFromPaginatedRows(db, where, rows, offset);
const hasMore = offset + filters.pageSize < totalCount;
const events = rows.map(({ _totalCount, ...event }) => event);
```

The `_totalCount` field is stripped from the response using destructuring. Uses `.fetch()` instead of `.limit()` for MSSQL compatibility (FETCH NEXT N ROWS ONLY).
