---
title: Table Definition Structure
impact: CRITICAL
impactDescription: ensures proper schema structure and type inference
tags: schema, table, definition, structure
---

## Table Definition Structure

Define tables using the database-specific table function with proper column definitions and exported constants. This ensures TypeScript type inference works correctly and schemas are reusable.

**Incorrect (inline, non-exported):**

```typescript
// Missing export - can't be used in queries or relations
const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }),
});

// Wrong: defining columns outside table function
const idColumn = int('id').primaryKey();
```

**Correct (exported with proper structure):**

```typescript
import { mssqlTable, int, varchar } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
});

// Type can be inferred for use in application code
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

**With constraints callback:**

```typescript
import { mssqlTable, int, varchar, uniqueIndex } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
}, (table) => [
  uniqueIndex('email_idx').on(table.email),
]);
```

The table function takes the table name as the first argument, column definitions as the second, and an optional callback for constraints/indexes as the third.
