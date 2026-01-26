---
title: Unique Constraints
impact: HIGH
impactDescription: prevents duplicate values in columns
tags: schema, unique, constraint, index
---

## Unique Constraints

Unique constraints ensure no duplicate values exist in a column or combination of columns. Use inline `.unique()` for single columns or `unique()` function for composite constraints.

**Incorrect (no unique constraint on email):**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),  // Allows duplicates
});
```

**Correct (single column unique):**

```typescript
import { mssqlTable, int, varchar } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
});

// Or with custom constraint name
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique('users_email_unique'),
});
```

**Composite unique constraint:**

```typescript
import { mssqlTable, int, varchar, unique } from 'drizzle-orm/mssql-core';

export const memberships = mssqlTable('memberships', {
  id: int('id').primaryKey(),
  userId: int('user_id').notNull(),
  organizationId: int('organization_id').notNull(),
}, (table) => [
  // User can only be member of an organization once
  unique('user_org_unique').on(table.userId, table.organizationId),
]);
```

**Multiple unique constraints:**

```typescript
export const products = mssqlTable('products', {
  id: int('id').primaryKey(),
  sku: varchar('sku', { length: 50 }).notNull(),
  barcode: varchar('barcode', { length: 50 }),
  name: varchar('name', { length: 255 }).notNull(),
}, (table) => [
  unique('sku_unique').on(table.sku),
  unique('barcode_unique').on(table.barcode),
]);
```

**Important MSSQL limitation:** Cannot create unique constraints on `text`, `ntext`, `varchar(max)`, or `nvarchar(max)` columns. Use bounded length columns instead:

```typescript
// Won't work in MSSQL
email: varchar('email', { length: 'max' }).unique()  // Error!

// Use bounded length
email: varchar('email', { length: 255 }).unique()    // Works
```
