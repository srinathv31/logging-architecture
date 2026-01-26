---
title: Default Values
impact: MEDIUM
impactDescription: simplifies inserts and ensures consistent data
tags: schema, default, values, sql
---

## Default Values

Default values automatically populate columns when no value is provided during INSERT. Use static values, SQL expressions, or JavaScript functions.

**Incorrect (manual defaults in application):**

```typescript
export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: datetime2('created_at').notNull(),
});

// Application code must always provide these values
await db.insert(posts).values({
  status: 'draft',  // Must remember to set default
  createdAt: new Date(),  // Must remember to set default
});
```

**Correct (database defaults):**

```typescript
import { mssqlTable, int, varchar, datetime2 } from 'drizzle-orm/mssql-core';
import { sql } from 'drizzle-orm';

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  createdAt: datetime2('created_at').notNull().defaultNow(),
});

// Values are automatic - cleaner insert
await db.insert(posts).values({ title: 'My Post' });
```

**Static defaults:**

```typescript
export const settings = mssqlTable('settings', {
  id: int('id').primaryKey(),
  isEnabled: bit('is_enabled').notNull().default(true),
  retryCount: int('retry_count').notNull().default(3),
  tier: varchar('tier', { length: 20 }).notNull().default('free'),
});
```

**SQL expression defaults:**

```typescript
import { sql } from 'drizzle-orm';

export const records = mssqlTable('records', {
  id: int('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).notNull().default(sql`NEWID()`),
  createdAt: datetime2('created_at').notNull().default(sql`GETDATE()`),
  updatedAt: datetime2('updated_at').notNull().default(sql`GETDATE()`),
});
```

**JavaScript function defaults ($defaultFn):**

```typescript
import { randomUUID } from 'crypto';

export const items = mssqlTable('items', {
  id: int('id').primaryKey(),
  // Generated in JavaScript at insert time
  publicId: varchar('public_id', { length: 36 }).notNull().$defaultFn(() => randomUUID()),
  slug: varchar('slug', { length: 100 }).$defaultFn(() => generateSlug()),
});
```

**Update defaults ($onUpdate):**

```typescript
export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  updatedAt: datetime2('updated_at').$onUpdate(() => new Date()),
});
```

Use database defaults (`default()`, `defaultNow()`) when possible - they work even for direct SQL inserts. Use `$defaultFn()` when you need JavaScript logic.
