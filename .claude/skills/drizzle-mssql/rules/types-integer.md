---
title: MSSQL Integer Types
impact: HIGH
impactDescription: ensures correct integer size and JavaScript type handling
tags: mssql, integer, int, bigint, smallint, tinyint
---

## MSSQL Integer Types

MSSQL provides four integer types with different ranges. Choose based on your data requirements and be aware of bigint's JavaScript handling.

**Integer type ranges:**

| Type | Bytes | Range |
|------|-------|-------|
| tinyint | 1 | 0 to 255 |
| smallint | 2 | -32,768 to 32,767 |
| int | 4 | -2,147,483,648 to 2,147,483,647 |
| bigint | 8 | -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807 |

**Incorrect (using int for everything):**

```typescript
export const analytics = mssqlTable('analytics', {
  id: int('id').primaryKey(),
  pageViews: int('page_views'),      // May overflow for high-traffic sites
  userCount: int('user_count'),      // int is fine here
  isActive: int('is_active'),        // Should use bit
  statusCode: int('status_code'),    // Wasteful - smallint is enough
});
```

**Correct (appropriate sizes):**

```typescript
import { mssqlTable, int, bigint, smallint, tinyint, bit } from 'drizzle-orm/mssql-core';

export const analytics = mssqlTable('analytics', {
  id: int('id').primaryKey(),
  pageViews: bigint('page_views', { mode: 'number' }),  // Large counts
  userCount: int('user_count'),                         // Standard integer
  statusCode: smallint('status_code'),                  // HTTP codes (100-599)
  priority: tinyint('priority'),                        // 0-255 range
  isActive: bit('is_active'),                           // Boolean
});
```

**Bigint modes:**

```typescript
// Mode: 'number' - Returns JavaScript number (may lose precision for very large values)
export const stats = mssqlTable('stats', {
  viewCount: bigint('view_count', { mode: 'number' }),  // Returns: number
});

// Mode: 'bigint' - Returns JavaScript BigInt (full precision, requires BigInt handling)
export const ledger = mssqlTable('ledger', {
  amount: bigint('amount', { mode: 'bigint' }),  // Returns: bigint
});

// Mode: 'string' - Returns string (safe for JSON serialization)
export const ids = mssqlTable('ids', {
  externalId: bigint('external_id', { mode: 'string' }),  // Returns: string
});
```

**Guidelines:**
- Use `tinyint` for small positive integers (0-255): flags, ratings, priorities
- Use `smallint` for values up to ~32,000: HTTP codes, years, small counters
- Use `int` for most cases: IDs, counts, standard integers
- Use `bigint` for very large numbers: timestamps in ms, large counters, financial cents
- For `bigint`, use `mode: 'number'` for convenience or `mode: 'bigint'` for precision
