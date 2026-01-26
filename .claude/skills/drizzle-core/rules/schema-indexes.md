---
title: Index Creation
impact: MEDIUM
impactDescription: improves query performance on frequently searched columns
tags: schema, index, performance, query
---

## Index Creation

Indexes improve query performance on columns used in WHERE clauses, JOINs, and ORDER BY. Add indexes strategically - they speed up reads but slow down writes.

**Incorrect (missing index on frequently queried column):**

```typescript
export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  userId: int('user_id').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: datetime2('created_at').notNull(),
});
// Queries filtering by userId or status will be slow without indexes
```

**Correct (indexes on query columns):**

```typescript
import { mssqlTable, int, varchar, datetime2, index } from 'drizzle-orm/mssql-core';

export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  userId: int('user_id').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: datetime2('created_at').notNull(),
}, (table) => [
  index('orders_user_id_idx').on(table.userId),
  index('orders_status_idx').on(table.status),
  index('orders_created_at_idx').on(table.createdAt),
]);
```

**Composite index (for multi-column queries):**

```typescript
export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  userId: int('user_id').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: datetime2('created_at').notNull(),
}, (table) => [
  // For queries: WHERE user_id = ? AND status = ?
  index('orders_user_status_idx').on(table.userId, table.status),
]);
```

**Unique index:**

```typescript
import { mssqlTable, int, varchar, uniqueIndex } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
}, (table) => [
  uniqueIndex('users_email_idx').on(table.email),
]);
```

**Index guidelines:**
- Add indexes on foreign key columns (for JOIN performance)
- Add indexes on columns frequently used in WHERE clauses
- Use composite indexes for queries filtering on multiple columns
- Order matters: `(userId, status)` index helps `WHERE userId = ?` but not `WHERE status = ?`
- Avoid over-indexing - each index adds write overhead
