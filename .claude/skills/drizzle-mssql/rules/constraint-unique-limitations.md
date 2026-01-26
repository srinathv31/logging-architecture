---
title: MSSQL Unique Constraint Limitations
impact: CRITICAL
impactDescription: prevents runtime errors from invalid unique constraints
tags: mssql, unique, constraint, limitation, varchar, text
---

## MSSQL Unique Constraint Limitations

MSSQL cannot create unique constraints or indexes on certain large data types. Attempting to do so will cause a migration error.

**Types that CANNOT have unique constraints:**
- `text`
- `ntext`
- `varchar(max)` / `varchar({ length: 'max' })`
- `nvarchar(max)` / `nvarchar({ length: 'max' })`

**Incorrect (will fail):**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  // ERROR: Cannot create unique constraint on varchar(max)
  email: varchar('email', { length: 'max' }).unique(),
});

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  // ERROR: Cannot create unique constraint on nvarchar(max)
  slug: nvarchar('slug', { length: 'max' }).unique(),
});

export const documents = mssqlTable('documents', {
  id: int('id').primaryKey(),
  // ERROR: Cannot create unique index on text
  content: text('content'),
}, (table) => [
  uniqueIndex('content_idx').on(table.content),  // Will fail!
]);
```

**Correct (use bounded length):**

```typescript
import { mssqlTable, int, varchar, nvarchar, uniqueIndex } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  // Use bounded length for columns needing unique constraints
  // 255 is typically enough for emails
  email: varchar('email', { length: 255 }).notNull().unique(),
});

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  // 200 characters is reasonable for URL slugs
  slug: nvarchar('slug', { length: 200 }).notNull().unique(),
  // nvarchar(max) is fine for content that doesn't need uniqueness
  content: nvarchar('content', { length: 'max' }),
});

export const products = mssqlTable('products', {
  id: int('id').primaryKey(),
  // SKUs are typically short - 50 chars is plenty
  sku: varchar('sku', { length: 50 }).notNull(),
  name: nvarchar('name', { length: 255 }).notNull(),
  description: nvarchar('description', { length: 'max' }),  // No unique needed
}, (table) => [
  uniqueIndex('sku_idx').on(table.sku),  // Works with bounded length
]);
```

**Maximum lengths for unique constraints:**

```typescript
// varchar: max 8,000 characters for unique
export const codes = mssqlTable('codes', {
  code: varchar('code', { length: 8000 }).unique(),  // Maximum allowed
});

// nvarchar: max 4,000 characters for unique (Unicode = 2 bytes per char)
export const names = mssqlTable('names', {
  name: nvarchar('name', { length: 4000 }).unique(),  // Maximum allowed
});
```

**Practical length recommendations:**

```typescript
export const entities = mssqlTable('entities', {
  id: int('id').primaryKey(),
  // Email: RFC 5321 allows 254 chars, use 255
  email: varchar('email', { length: 255 }).notNull().unique(),
  // URLs: 2000 chars covers most browsers' limits
  canonicalUrl: varchar('canonical_url', { length: 2000 }).unique(),
  // Usernames: 50-100 chars is typically sufficient
  username: varchar('username', { length: 50 }).notNull().unique(),
  // Slugs: 200 chars covers most use cases
  slug: varchar('slug', { length: 200 }).unique(),
  // External IDs: depends on source system
  externalId: varchar('external_id', { length: 100 }).unique(),
});
```

**Workaround for long text uniqueness:**

```typescript
import { sql } from 'drizzle-orm';

export const documents = mssqlTable('documents', {
  id: int('id').primaryKey(),
  // Store full content without unique
  content: nvarchar('content', { length: 'max' }).notNull(),
  // Store hash for uniqueness checking
  contentHash: binary('content_hash', { length: 32 }).notNull().unique(),
});

// In application code:
// contentHash = crypto.createHash('sha256').update(content).digest()
```

**Guidelines:**
- Never use `varchar(max)`, `nvarchar(max)`, `text`, or `ntext` with `.unique()`
- Always specify an explicit bounded length for columns needing uniqueness
- Use the smallest practical length - it improves index performance
- For truly large text that needs uniqueness, use a hash column instead
